import type {
  AgentInput,
  ChecklistItem,
  ClientInput,
  InterviewInput,
  PointKind,
  RequestType,
  SessionEvent,
  Topic,
} from "./types";
import { suggestedMinutes } from "./prompt";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Ids the agent says back through tools: lowercase letters, digits, dashes */
export function slug(v: string) {
  return v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function uniqueIds<T extends { id: string }>(items: T[], prefix: string): T[] {
  const seen = new Set<string>();
  return items.map((item, i) => {
    let id = item.id || `${prefix}${i + 1}`;
    while (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    return { ...item, id };
  });
}

function lines(v: unknown, maxItems: number, maxLen: number): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return list
    .map((x) => text(x, maxLen).replace(/^\s*(\d+[.)]|[-*•])\s*/, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function parseTopics(raw: unknown): Topic[] {
  if (!Array.isArray(raw)) return [];
  const topics = raw
    .map((item): Topic | null => {
      const t = (typeof item === "string" ? { opener: item } : item) as Partial<Topic> & { prompt?: string };
      const opener = text(t?.opener ?? t?.prompt, 2000);
      const title = text(t?.title, 80);
      if (!opener && !title) return null;
      return {
        id: slug(text(t?.id, 60) || title),
        title: title || opener.slice(0, 60),
        opener,
        examples: lines(t?.examples, 12, 300),
        notes: text(t?.notes, 3000) || undefined,
      };
    })
    .filter((t): t is Topic => t !== null);
  return uniqueIds(topics, "t").slice(0, 30);
}

export function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item): ChecklistItem | null => {
      const c = (typeof item === "string" ? { label: item } : item) as Partial<ChecklistItem>;
      const label = text(c?.label, 200);
      if (!label) return null;
      return { id: slug(text(c?.id, 60) || label), label, notes: text(c?.notes, 1000) || undefined };
    })
    .filter((c): c is ChecklistItem => c !== null);
  return uniqueIds(items, "c").slice(0, 40);
}

type Result<T> = { input?: T; error?: string };

export function parseClientInput(body: unknown): Result<ClientInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 120);
  if (!name) return { error: "The client needs a name." };
  return {
    input: {
      name,
      company: text(b.company, 160),
      owner: text(b.owner, 120),
      context: text(b.context, 100000),
      guardrails: text(b.guardrails, 20000),
    },
  };
}

export function parseAgentInput(body: unknown): Result<AgentInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 80);
  if (!name) return { error: "The agent needs a name." };
  const language = text(b.language, 10).toLowerCase() || "en";
  return {
    input: {
      name,
      persona: text(b.persona, 6000),
      voiceId: text(b.voiceId, 80),
      language,
      extraLanguages: lines(b.extraLanguages, 10, 10)
        .map((l) => l.toLowerCase())
        .filter((l) => l !== language),
      llm: text(b.llm, 80),
    },
  };
}

export function parseInterviewInput(body: unknown): Result<InterviewInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = text(b.title, 120);
  if (!title) return { error: "The interview needs a title." };
  const topics = parseTopics(b.topics);
  const minutes = Number(b.estimatedMinutes);
  return {
    input: {
      kind: b.kind === "open_line" ? "open_line" : "interview",
      audience: b.audience === "team" ? "team" : "client",
      title,
      role: text(b.role, 6000),
      goal: text(b.goal, 4000),
      method: text(b.method, 20000),
      opening: text(b.opening, 2000),
      topics,
      closing: text(b.closing, 10000),
      checklist: parseChecklist(b.checklist),
      report: text(b.report, 20000),
      estimatedMinutes:
        Number.isFinite(minutes) && minutes >= 3 && minutes <= 120 ? Math.round(minutes) : suggestedMinutes(topics.length),
      archived: Boolean(b.archived),
    },
  };
}

const REQUEST_TYPES: RequestType[] = ["change", "feature", "project", "content", "question", "other"];
const POINT_KINDS: PointKind[] = ["note", "quote", "off_record"];

export function parseEvents(body: unknown): SessionEvent[] {
  const list = Array.isArray((body as { events?: unknown })?.events) ? (body as { events: unknown[] }).events : [];
  const out: SessionEvent[] = [];
  for (const raw of list.slice(0, 100)) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const topicId = text(e.topicId, 60);
    switch (e.type) {
      case "set_topic":
        if (topicId) out.push({ type: "set_topic", topicId });
        break;
      case "capture_point": {
        const point = text(e.point, 1000);
        const kind = POINT_KINDS.includes(e.kind as PointKind) ? (e.kind as PointKind) : "note";
        if (point) out.push({ type: "capture_point", topicId: topicId || "general", point, kind });
        break;
      }
      case "complete_topic": {
        const status = e.status === "skipped" || e.status === "partial" ? e.status : "answered";
        if (topicId) out.push({ type: "complete_topic", topicId, status, summary: text(e.summary, 4000) });
        break;
      }
      case "check_item": {
        const itemId = text(e.itemId, 60);
        if (itemId) out.push({ type: "check_item", itemId, value: text(e.value, 1000) });
        break;
      }
      case "log_request": {
        const requestId = text(e.requestId, 60);
        const title = text(e.title, 200);
        if (!/^[a-f0-9-]{36}$/.test(requestId) || !title) break;
        out.push({
          type: "log_request",
          requestId,
          requestType: REQUEST_TYPES.includes(e.requestType as RequestType) ? (e.requestType as RequestType) : "other",
          title,
          details: text(e.details, 6000),
          urgency: e.urgency === "high" || e.urgency === "low" ? e.urgency : "normal",
        });
        break;
      }
      case "save_summary": {
        const summary = text(e.summary, 20000);
        if (summary) out.push({ type: "save_summary", summary });
        break;
      }
      case "transcript": {
        const message = text(e.message, 10000);
        if (message) out.push({ type: "transcript", role: e.role === "agent" ? "agent" : "user", message });
        break;
      }
      case "conversation_id": {
        const conversationId = text(e.conversationId, 120);
        if (conversationId) out.push({ type: "conversation_id", conversationId });
        break;
      }
      case "ended":
        out.push({ type: "ended", early: Boolean(e.early) });
        break;
    }
  }
  return out;
}
