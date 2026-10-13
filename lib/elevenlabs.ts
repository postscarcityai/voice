import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { buildFirstMessage, buildSystemPrompt, type CallContext } from "./prompt";
import { getSetting, markInterviewSynced, setSetting } from "./db/queries";
import type { Brief, TranscriptTurn } from "./types";

// Server-side ElevenLabs (ElevenAgents) client. The API key never leaves the
// server. Each interview gets its own ElevenLabs agent with auth required and
// no client overrides; the browser only ever gets a short-lived WebRTC token.
//
// API reference: https://elevenlabs.io/docs/eleven-agents/api-reference

const API = process.env.ELEVENLABS_API_BASE?.replace(/\/$/, "") || "https://api.elevenlabs.io";

/** Eleven v4 Turbo: the real-time v4 voice model built for agents (90+ languages) */
export const DEFAULT_TTS_MODEL = "eleven_v4_turbo";
/** ElevenLabs recommends a high-intelligence model when the agent calls tools */
export const DEFAULT_LLM = "claude-sonnet-5-5";
/** ElevenLabs' stock agent voice, used until a voice is picked */
export const FALLBACK_VOICE_ID = "cjVigY5qzO86Huf0OWal";
/** Data collection allows 25 fields per agent on most plans */
const MAX_DATA_COLLECTION = 25;

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": env.elevenlabsApiKey, "content-type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail);
      detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail ?? parsed);
    } catch {}
    throw new ElevenLabsError(`ElevenLabs ${res.status} on ${path.split("?")[0]}: ${detail.slice(0, 500)}`, res.status);
  }
  return (await res.json()) as T;
}

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

// ------------------------------------------------------------ client tools
// These run in the browser (components/session/useInterview.ts) and drive
// the client's screen. They're silent and fire-and-forget, so the agent never
// waits on them.

const topicId = { type: "string", description: "The topic id from your topic list, or \"general\" if none fits" };

export const CLIENT_TOOLS = [
  {
    name: "set_topic",
    description: "Call right before you open a topic. The screen shows the topic, its opener and all its examples.",
    parameters: { type: "object", required: ["topic_id"], properties: { topic_id: topicId } },
  },
  {
    name: "capture_point",
    description:
      "Call whenever they share something worth keeping. One short point per call, in their words. It appears on their screen unless it's off the record.",
    parameters: {
      type: "object",
      required: ["topic_id", "point", "kind"],
      properties: {
        topic_id: topicId,
        point: { type: "string", description: "The point. For a quote, their exact words." },
        kind: {
          type: "string",
          enum: ["note", "quote", "off_record"],
          description: "note for most things, quote for a line worth quoting word for word, off_record for anything private",
        },
      },
    },
  },
  {
    name: "complete_topic",
    description: "Call when you move on from a topic: answered, partly answered, or skipped.",
    parameters: {
      type: "object",
      required: ["topic_id", "status", "summary"],
      properties: {
        topic_id: topicId,
        status: { type: "string", enum: ["answered", "partial", "skipped"], description: "How fully it was covered" },
        summary: { type: "string", description: "One or two sentences on what they said" },
      },
    },
  },
  {
    name: "check_item",
    description: "Call when they answer an item on the checklist of quick facts.",
    parameters: {
      type: "object",
      required: ["item_id", "value"],
      properties: {
        item_id: { type: "string", description: "The checklist item id" },
        value: { type: "string", description: "Their answer" },
      },
    },
  },
  {
    name: "log_request",
    description:
      "Call when they ask for something to be done (a change, feature, project, content) or ask a question you can't answer. One call per request.",
    parameters: {
      type: "object",
      required: ["type", "title", "details", "urgency"],
      properties: {
        type: { type: "string", enum: ["change", "feature", "project", "content", "question", "other"], description: "What kind of request" },
        title: { type: "string", description: "A short title, under 10 words" },
        details: { type: "string", description: "Everything needed to act on it: what, where, why, examples, deadline" },
        urgency: { type: "string", enum: ["low", "normal", "high"], description: "How soon they need it" },
      },
    },
  },
  {
    name: "save_summary",
    description: "Call once during the close with a full written summary of this call, including corrections.",
    parameters: {
      type: "object",
      required: ["summary"],
      properties: { summary: { type: "string", description: "What you heard in this call, organized by topic" } },
    },
  },
] as const;

export type ClientToolName = (typeof CLIENT_TOOLS)[number]["name"];

/** Create the client tools once per workspace and remember their ids */
async function ensureTools(): Promise<string[]> {
  const configs = CLIENT_TOOLS.map((t) => ({
    type: "client",
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    expects_response: false,
    execution_mode: "immediate",
  }));
  // Tools belong to a workspace, so a different key or region means new tools
  const hash = sha({ configs, api: API, key: sha(env.elevenlabsApiKey) });
  const stored = await getSetting("elevenlabs_tools");
  if (stored) {
    const parsed = JSON.parse(stored) as { hash: string; ids: string[] };
    if (parsed.hash === hash) return parsed.ids;
  }
  const ids: string[] = [];
  for (const tool_config of configs) {
    const res = await call<{ id: string }>("/v1/convai/tools", { method: "POST", body: JSON.stringify({ tool_config }) });
    ids.push(res.id);
  }
  await setSetting("elevenlabs_tools", JSON.stringify({ hash, ids }));
  return ids;
}

// ------------------------------------------------------------ agent sync

const systemTool = (name: string, description: string, params: Record<string, unknown> = {}) => ({
  type: "system",
  name,
  description,
  params: { system_tool_type: name, ...params },
});

export function agentConfig(brief: Brief, toolIds: string[], ctx: CallContext = {}) {
  const { client, agent, interview } = brief;
  const opts = { orgName: env.orgName, orgNameSpoken: env.orgNameSpoken };
  const multilingual = agent.extraLanguages.length > 0;

  const dataCollection = Object.fromEntries(
    interview.topics.slice(0, MAX_DATA_COLLECTION).map((t) => [
      t.id,
      {
        type: "string",
        description: `Everything the client said about "${t.title}" (${t.opener}). Include specifics, names, numbers, stories and corrections, in their own words where possible. Leave out anything they asked to keep off the record. Empty if not discussed.`,
      },
    ]),
  );

  return {
    name: `${agent.name} · ${client.company || client.name} · ${interview.title}`.slice(0, 120),
    tags: ["voice", interview.kind],
    conversation_config: {
      agent: {
        first_message: buildFirstMessage(brief, opts, ctx),
        language: agent.language || "en",
        prompt: {
          prompt: buildSystemPrompt(brief, opts, ctx),
          llm: agent.llm || env.defaultLlm || DEFAULT_LLM,
          tool_ids: toolIds,
          built_in_tools: {
            end_call: systemTool("end_call", "End the call after you've said goodbye, or if they ask to stop."),
            skip_turn: systemTool(
              "skip_turn",
              "Stay quiet when they ask for a moment to think or look something up.",
              { wait_timeout_secs: -1 },
            ),
            ...(multilingual
              ? {
                  language_detection: systemTool(
                    "language_detection",
                    "Switch language when they start speaking another language or ask you to.",
                    { only_at_conversation_start: false },
                  ),
                }
              : {}),
          },
        },
      },
      // Each extra language the agent may switch into mid-call
      ...(multilingual
        ? {
            language_presets: Object.fromEntries(agent.extraLanguages.map((l) => [l, { overrides: {} }])),
          }
        : {}),
      tts: {
        model_id: env.ttsModel || DEFAULT_TTS_MODEL,
        voice_id: agent.voiceId || env.defaultVoiceId || FALLBACK_VOICE_ID,
      },
      // Interviews mean long answers and thinking pauses: wait before taking the turn
      turn: { turn_eagerness: "patient", turn_timeout: 15 },
      conversation: {
        // Twice the estimate plus ten minutes, within ElevenLabs' 2 hour cap
        max_duration_seconds: Math.min(7200, Math.max(600, interview.estimatedMinutes * 120 + 600)),
      },
    },
    platform_settings: {
      auth: { enable_auth: true },
      data_collection: dataCollection,
      evaluation: {
        criteria:
          interview.kind === "open_line"
            ? [
                {
                  id: "requests_captured",
                  name: "Requests captured",
                  type: "prompt",
                  conversation_goal_prompt:
                    "Did the agent capture every request or question the client raised with enough detail to act on, and read each one back?",
                },
              ]
            : [
                {
                  id: "topics_covered",
                  name: "Topics covered",
                  type: "prompt",
                  conversation_goal_prompt:
                    "Did the agent cover each topic (or skip it at the client's request) and follow the closing instructions?",
                },
              ],
      },
    },
  };
}

/**
 * Push an interview's config to ElevenLabs, creating its agent the first time.
 * Returns the agent id and, when this call changed it, the new version id, so
 * a conversation can be pinned to exactly what was just pushed.
 */
export async function syncInterview(
  brief: Brief,
  { force = false, ctx = {} }: { force?: boolean; ctx?: CallContext } = {},
): Promise<{ agentId: string; versionId: string | null }> {
  const { interview } = brief;
  const toolIds = await ensureTools();
  const config = agentConfig(brief, toolIds, ctx);
  const hash = sha(config);
  if (!force && interview.elevenlabsAgentId && interview.syncedHash === hash) {
    return { agentId: interview.elevenlabsAgentId, versionId: null };
  }

  let agentId = interview.elevenlabsAgentId;
  let versionId: string | null = null;
  if (agentId) {
    try {
      const res = await call<{ version_id?: string }>(`/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(config),
      });
      versionId = res.version_id ?? null;
    } catch (err) {
      // Deleted on the ElevenLabs side: make a fresh one
      if (err instanceof ElevenLabsError && err.status === 404) agentId = null;
      else throw err;
    }
  }
  if (!agentId) {
    const res = await call<{ agent_id: string }>("/v1/convai/agents/create", { method: "POST", body: JSON.stringify(config) });
    agentId = res.agent_id;
  }
  await markInterviewSynced(interview.id, agentId, hash);
  return { agentId, versionId };
}

// ------------------------------------------------------------ sessions

/** A short-lived WebRTC token for one conversation. Mint it right before connecting. */
export async function conversationToken(agentId: string, versionId?: string | null) {
  const q = new URLSearchParams({ agent_id: agentId });
  if (versionId) q.set("version_id", versionId);
  return call<{ token: string; conversation_id?: string }>(`/v1/convai/conversation/token?${q}`);
}

export interface ElevenConversation {
  conversation_id: string;
  status: "initiated" | "in-progress" | "processing" | "done" | "failed";
  transcript: { role: "user" | "agent"; message: string | null; time_in_call_secs?: number }[];
  metadata?: { call_duration_secs?: number; start_time_unix_secs?: number; termination_reason?: string };
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
    data_collection_results?: Record<string, { value: unknown; rationale?: string }>;
  } | null;
}

export async function getConversation(conversationId: string) {
  return call<ElevenConversation>(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`);
}

/** Map an ElevenLabs conversation onto our transcript and extracted answers */
export function readConversation(c: ElevenConversation) {
  const transcript: TranscriptTurn[] = (c.transcript ?? [])
    .filter((t) => t.message && t.message.trim())
    .map((t) => ({ role: t.role, message: t.message!.trim(), time: t.time_in_call_secs ?? null }));

  const extracted: Record<string, string> = {};
  for (const [key, r] of Object.entries(c.analysis?.data_collection_results ?? {})) {
    if (r?.value != null && String(r.value).trim()) extracted[key] = String(r.value).trim();
  }
  return {
    done: c.status === "done" || c.status === "failed",
    transcript,
    extracted,
    callSummary: c.analysis?.transcript_summary?.trim() || null,
    durationSeconds: c.metadata?.call_duration_secs ?? null,
  };
}

export interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export async function listVoices(): Promise<Voice[]> {
  const res = await call<{ voices: Voice[] }>("/v1/voices");
  return res.voices ?? [];
}

export interface LibraryVoice {
  public_owner_id: string;
  voice_id: string;
  name: string;
  accent?: string;
  gender?: string;
  age?: string;
  descriptive?: string;
  use_case?: string;
  language?: string;
  locale?: string;
  description?: string;
  preview_url?: string;
  cloned_by_count?: number;
  live_moderation_enabled?: boolean;
  is_added_by_user?: boolean;
  free_users_allowed?: boolean;
  verified_languages?: { language: string; accent?: string; locale?: string; preview_url?: string }[] | null;
}

/** Search ElevenLabs' shared voice library. Live-moderated voices can't be used by agents, so they're left out. */
export async function searchVoiceLibrary(filters: {
  search?: string;
  gender?: string;
  language?: string;
  accent?: string;
  age?: string;
}) {
  const q = new URLSearchParams({ page_size: "100", include_live_moderated: "false", include_custom_rates: "false" });
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
  const res = await call<{ voices: LibraryVoice[]; has_more: boolean }>(`/v1/shared-voices?${q}`);
  return res.voices.filter((v) => !v.live_moderation_enabled);
}

/** Add a shared library voice to this account so agents can use it. Returns the voice id to use. */
export async function addLibraryVoice(publicOwnerId: string, voiceId: string, name: string) {
  const res = await call<{ voice_id: string }>(
    `/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`,
    { method: "POST", body: JSON.stringify({ new_name: name.slice(0, 80) }) },
  );
  return res.voice_id;
}

// ------------------------------------------------------------ webhooks

/**
 * Verify an ElevenLabs post-call webhook. Header: `ElevenLabs-Signature: t=<unix>,v0=<hex>`
 * where v0 = HMAC-SHA256(secret, `${t}.${rawBody}`). Rejects anything older than 30 minutes.
 */
export function verifyWebhook(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v0 || Math.abs(Date.now() / 1000 - t) > 30 * 60) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  const given = Buffer.from(parts.v0);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
