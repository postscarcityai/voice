// Clients → Agents → Interviews → Calls.
//
// A client is who you work for (and what you already know about them). An
// agent is a voice and personality assigned to that client ("June"). An
// interview is one brief the agent runs: a discovery interview, a content
// session, or an always-on open line the client can call with anything. Each
// interview has share links, and every time the client talks, that's a call.
// Interviews can stretch across several calls; each call picks up where the
// last one left off.

export interface Client {
  id: string;
  /** The person we talk to, e.g. "Alex Rivera" */
  name: string;
  /** Their company, e.g. "Rivera Ceramics" */
  company: string;
  /** Who at our org they work with, e.g. "Sam Lee" */
  owner: string;
  /** What we already know. Agents never ask the client to repeat it. */
  context: string;
  /** Rules for every conversation with this client: confidential topics, claims to avoid, language */
  guardrails: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  clientId: string;
  /** What the agent calls itself, e.g. "June" */
  name: string;
  /** Personality and speaking style */
  persona: string;
  voiceId: string;
  /** Primary language (ISO code) */
  language: string;
  /** Other languages the client may switch to mid-call */
  extraLanguages: string[];
  llm: string;
  createdAt: string;
  updatedAt: string;
}

export type InterviewKind = "interview" | "open_line";

export interface Topic {
  /** Stable id the agent passes to its tools, e.g. "story" */
  id: string;
  /** Short label the client sees, e.g. "Her story" */
  title: string;
  /** The big opening question */
  opener: string;
  /** "For example" prompts: shown on screen, a few spoken aloud */
  examples: string[];
  /** Agent-only guidance */
  notes?: string;
}

export interface ChecklistItem {
  /** Stable id for check_item, e.g. "domain" */
  id: string;
  /** What we need, e.g. "Domain choice" */
  label: string;
  /** Agent-only detail, e.g. "riveraceramics.com is available and recommended" */
  notes?: string;
}

export interface Interview {
  id: string;
  agentId: string;
  kind: InterviewKind;
  title: string;
  /** Who the agent is in this conversation and on whose behalf */
  role: string;
  goal: string;
  /** How the conversation should run. Empty uses the default for the kind. */
  method: string;
  /** What the agent says first, word for word */
  opening: string;
  topics: Topic[];
  /** How to close: final questions, wrap-up */
  closing: string;
  /** Quick facts the client can send later ("send-us list") */
  checklist: ChecklistItem[];
  /** What the written handoff should contain. Empty uses the default. */
  report: string;
  estimatedMinutes: number;
  /** Archived interviews keep their history but their links stop working */
  archived: boolean;
  elevenlabsAgentId: string | null;
  syncedHash: string | null;
  syncedAt: string | null;
  /** The latest written handoff, generated from every call */
  reportMarkdown: string | null;
  reportGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InterviewInput = Omit<
  Interview,
  | "id"
  | "agentId"
  | "elevenlabsAgentId"
  | "syncedHash"
  | "syncedAt"
  | "reportMarkdown"
  | "reportGeneratedAt"
  | "createdAt"
  | "updatedAt"
>;
export type AgentInput = Omit<Agent, "id" | "clientId" | "createdAt" | "updatedAt">;
export type ClientInput = Omit<Client, "id" | "createdAt" | "updatedAt">;

/** Everything one conversation needs, snapshotted onto each call */
export interface Brief {
  client: Client;
  agent: Agent;
  interview: Interview;
}

export interface SessionLink {
  id: string;
  interviewId: string;
  token: string;
  label: string;
  revoked: boolean;
  createdAt: string;
  sessionCount?: number;
}

export type SessionStatus = "active" | "completed" | "ended_early";
export type TopicStatus = "pending" | "active" | "answered" | "partial" | "skipped";
export type PointKind = "note" | "quote" | "off_record";

export interface Point {
  text: string;
  kind: PointKind;
}

export interface TopicState {
  topicId: string;
  status: TopicStatus;
  points: Point[];
  summary: string | null;
}

export interface ChecklistState {
  itemId: string;
  value: string;
}

export interface TranscriptTurn {
  role: "agent" | "user";
  message: string;
  /** Seconds from the start of the call */
  time: number | null;
}

export interface Session {
  id: string;
  linkId: string;
  interviewId: string;
  /** Call number within the interview, starting at 1 */
  callNumber: number;
  brief: Brief;
  conversationId: string | null;
  status: SessionStatus;
  topics: TopicState[];
  checklist: ChecklistState[];
  currentTopicId: string | null;
  closingSummary: string | null;
  transcript: TranscriptTurn[];
  /** Per-topic extraction from ElevenLabs data collection, keyed by topic id */
  extracted: Record<string, string>;
  callSummary: string | null;
  durationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
  syncedAt: string | null;
}

export type RequestType = "change" | "feature" | "project" | "content" | "question" | "other";
export type RequestStatus = "new" | "in_progress" | "done" | "declined";

export interface ClientRequest {
  id: string;
  clientId: string;
  sessionId: string | null;
  type: RequestType;
  title: string;
  details: string;
  urgency: "low" | "normal" | "high";
  status: RequestStatus;
  /** Your notes, visible to the agent on the open line ("Chris is on it, Friday") */
  response: string;
  createdAt: string;
  updatedAt: string;
}

/** Live events the browser reports while the agent works */
export type SessionEvent =
  | { type: "set_topic"; topicId: string }
  | { type: "capture_point"; topicId: string; point: string; kind: PointKind }
  | { type: "complete_topic"; topicId: string; status: "answered" | "partial" | "skipped"; summary: string }
  | { type: "check_item"; itemId: string; value: string }
  | {
      type: "log_request";
      requestId: string;
      requestType: RequestType;
      title: string;
      details: string;
      urgency: "low" | "normal" | "high";
    }
  | { type: "save_summary"; summary: string }
  | { type: "transcript"; role: "agent" | "user"; message: string }
  | { type: "conversation_id"; conversationId: string }
  | { type: "ended"; early: boolean };
