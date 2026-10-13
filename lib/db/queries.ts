import { randomBytes, randomUUID } from "node:crypto";
import { db, type Args, type Row } from "./index";
import type {
  Agent,
  AgentInput,
  Brief,
  Client,
  ClientInput,
  ClientRequest,
  Interview,
  InterviewInput,
  RequestStatus,
  Session,
  SessionEvent,
  SessionLink,
} from "../types";

const now = () => new Date().toISOString();

/** Unguessable URL-safe token for share links and session keys */
export const newToken = (bytes = 18) => randomBytes(bytes).toString("base64url");

function json<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const str = (v: unknown) => (v == null ? null : String(v));

async function rows(sql: string, args: Args = []) {
  return (await db()).query(sql, args);
}

async function run(sql: string, args: Args = []) {
  await (await db()).query(sql, args);
}

// ---------------------------------------------------------------- clients

function toClient(r: Row): Client {
  return {
    id: String(r.id),
    name: String(r.name),
    company: String(r.company),
    owner: String(r.owner),
    context: String(r.context),
    guardrails: String(r.guardrails),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

const CLIENT_CALLS = `SELECT s.started_at FROM sessions s
  JOIN interviews i ON i.id = s.interview_id JOIN agents a ON a.id = i.agent_id WHERE a.client_id = c.id`;

export async function listClients() {
  const rs = await rows(
    `SELECT c.*,
      (SELECT COUNT(*) FROM agents a WHERE a.client_id = c.id) AS agent_count,
      (SELECT COUNT(*) FROM (${CLIENT_CALLS}) AS calls) AS call_count,
      (SELECT MAX(started_at) FROM (${CLIENT_CALLS}) AS calls) AS last_call_at,
      (SELECT COUNT(*) FROM requests r WHERE r.client_id = c.id AND r.status = 'new') AS new_requests
     FROM clients c ORDER BY c.updated_at DESC`,
  );
  return rs.map((r) => ({
    ...toClient(r),
    agentCount: Number(r.agent_count),
    callCount: Number(r.call_count),
    newRequests: Number(r.new_requests),
    lastCallAt: str(r.last_call_at),
  }));
}

export async function getClient(id: string): Promise<Client | null> {
  const [r] = await rows("SELECT * FROM clients WHERE id = ?", [id]);
  return r ? toClient(r) : null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const id = randomUUID();
  const t = now();
  await run(
    `INSERT INTO clients (id, name, company, owner, context, guardrails, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.company, input.owner, input.context, input.guardrails, t, t],
  );
  return (await getClient(id))!;
}

export async function updateClient(id: string, input: ClientInput) {
  await run(
    "UPDATE clients SET name = ?, company = ?, owner = ?, context = ?, guardrails = ?, updated_at = ? WHERE id = ?",
    [input.name, input.company, input.owner, input.context, input.guardrails, now(), id],
  );
  return getClient(id);
}

export async function deleteClient(id: string) {
  const c = await db();
  const agentIds = "SELECT id FROM agents WHERE client_id = ?";
  const interviewIds = `SELECT id FROM interviews WHERE agent_id IN (${agentIds})`;
  await c.batch([
    { sql: `DELETE FROM sessions WHERE interview_id IN (${interviewIds})`, args: [id] },
    { sql: `DELETE FROM links WHERE interview_id IN (${interviewIds})`, args: [id] },
    { sql: `DELETE FROM interviews WHERE agent_id IN (${agentIds})`, args: [id] },
    { sql: "DELETE FROM agents WHERE client_id = ?", args: [id] },
    { sql: "DELETE FROM requests WHERE client_id = ?", args: [id] },
    { sql: "DELETE FROM clients WHERE id = ?", args: [id] },
  ]);
}

// ----------------------------------------------------------------- agents

function toAgent(r: Row): Agent {
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    name: String(r.name),
    persona: String(r.persona),
    voiceId: String(r.voice_id),
    language: String(r.language),
    extraLanguages: json(r.extra_languages, []),
    llm: String(r.llm),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listAgents(clientId: string): Promise<Agent[]> {
  return (await rows("SELECT * FROM agents WHERE client_id = ? ORDER BY created_at", [clientId])).map(toAgent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  const [r] = await rows("SELECT * FROM agents WHERE id = ?", [id]);
  return r ? toAgent(r) : null;
}

export async function createAgent(clientId: string, input: AgentInput): Promise<Agent> {
  const id = randomUUID();
  const t = now();
  await run(
    `INSERT INTO agents (id, client_id, name, persona, voice_id, language, extra_languages, llm, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clientId,
      input.name,
      input.persona,
      input.voiceId,
      input.language,
      JSON.stringify(input.extraLanguages),
      input.llm,
      t,
      t,
    ],
  );
  return (await getAgent(id))!;
}

export async function updateAgent(id: string, input: AgentInput) {
  await run(
    `UPDATE agents SET name = ?, persona = ?, voice_id = ?, language = ?, extra_languages = ?, llm = ?, updated_at = ?
     WHERE id = ?`,
    [input.name, input.persona, input.voiceId, input.language, JSON.stringify(input.extraLanguages), input.llm, now(), id],
  );
  return getAgent(id);
}

export async function deleteAgent(id: string) {
  const c = await db();
  const interviewIds = "SELECT id FROM interviews WHERE agent_id = ?";
  await c.batch([
    { sql: `DELETE FROM sessions WHERE interview_id IN (${interviewIds})`, args: [id] },
    { sql: `DELETE FROM links WHERE interview_id IN (${interviewIds})`, args: [id] },
    { sql: "DELETE FROM interviews WHERE agent_id = ?", args: [id] },
    { sql: "DELETE FROM agents WHERE id = ?", args: [id] },
  ]);
}

// ------------------------------------------------------------- interviews

function toInterview(r: Row): Interview {
  return {
    id: String(r.id),
    agentId: String(r.agent_id),
    kind: String(r.kind) === "open_line" ? "open_line" : "interview",
    audience: String(r.audience) === "team" ? "team" : "client",
    title: String(r.title),
    role: String(r.role),
    goal: String(r.goal),
    method: String(r.method),
    opening: String(r.opening),
    topics: json(r.topics, []),
    closing: String(r.closing),
    checklist: json(r.checklist, []),
    report: String(r.report),
    estimatedMinutes: Number(r.estimated_minutes),
    archived: Boolean(Number(r.archived)),
    elevenlabsAgentId: str(r.elevenlabs_agent_id),
    syncedHash: str(r.synced_hash),
    syncedAt: str(r.synced_at),
    reportMarkdown: str(r.report_markdown),
    reportGeneratedAt: str(r.report_generated_at),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listInterviews(agentId: string) {
  const rs = await rows(
    `SELECT i.*,
      (SELECT COUNT(*) FROM sessions s WHERE s.interview_id = i.id) AS call_count,
      (SELECT MAX(s.started_at) FROM sessions s WHERE s.interview_id = i.id) AS last_call_at
     FROM interviews i WHERE i.agent_id = ?
     ORDER BY i.archived, i.kind = 'open_line' DESC, i.created_at DESC`,
    [agentId],
  );
  return rs.map((r) => ({ ...toInterview(r), callCount: Number(r.call_count), lastCallAt: str(r.last_call_at) }));
}

export async function getInterview(id: string): Promise<Interview | null> {
  const [r] = await rows("SELECT * FROM interviews WHERE id = ?", [id]);
  return r ? toInterview(r) : null;
}

function interviewArgs(input: InterviewInput) {
  return [
    input.kind,
    input.audience,
    input.title,
    input.role,
    input.goal,
    input.method,
    input.opening,
    JSON.stringify(input.topics),
    input.closing,
    JSON.stringify(input.checklist),
    input.report,
    input.estimatedMinutes,
    input.archived ? 1 : 0,
  ];
}

export async function createInterview(agentId: string, input: InterviewInput): Promise<Interview> {
  const id = randomUUID();
  const t = now();
  await run(
    `INSERT INTO interviews (kind, audience, title, role, goal, method, opening, topics, closing, checklist, report,
       estimated_minutes, archived, id, agent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...interviewArgs(input), id, agentId, t, t],
  );
  return (await getInterview(id))!;
}

export async function updateInterview(id: string, input: InterviewInput) {
  await run(
    `UPDATE interviews SET kind = ?, audience = ?, title = ?, role = ?, goal = ?, method = ?, opening = ?, topics = ?, closing = ?,
       checklist = ?, report = ?, estimated_minutes = ?, archived = ?, updated_at = ?
     WHERE id = ?`,
    [...interviewArgs(input), now(), id],
  );
  return getInterview(id);
}

export async function markInterviewSynced(id: string, elevenlabsAgentId: string, hash: string) {
  await run("UPDATE interviews SET elevenlabs_agent_id = ?, synced_hash = ?, synced_at = ? WHERE id = ?", [
    elevenlabsAgentId,
    hash,
    now(),
    id,
  ]);
}

export async function saveInterviewReport(id: string, markdown: string) {
  await run("UPDATE interviews SET report_markdown = ?, report_generated_at = ? WHERE id = ?", [markdown, now(), id]);
}

export async function deleteInterview(id: string) {
  const c = await db();
  await c.batch([
    { sql: "DELETE FROM sessions WHERE interview_id = ?", args: [id] },
    { sql: "DELETE FROM links WHERE interview_id = ?", args: [id] },
    { sql: "DELETE FROM interviews WHERE id = ?", args: [id] },
  ]);
}

/** The client, agent and interview behind an interview id */
export async function getBrief(interviewId: string): Promise<Brief | null> {
  const interview = await getInterview(interviewId);
  if (!interview) return null;
  const agent = await getAgent(interview.agentId);
  if (!agent) return null;
  const client = await getClient(agent.clientId);
  return client ? { client, agent, interview } : null;
}

// ----------------------------------------------------------------- links

function toLink(r: Row): SessionLink {
  return {
    id: String(r.id),
    interviewId: String(r.interview_id),
    token: String(r.token),
    label: String(r.label),
    revoked: Boolean(Number(r.revoked)),
    createdAt: String(r.created_at),
    sessionCount: r.session_count == null ? undefined : Number(r.session_count),
  };
}

export async function listLinks(interviewId: string): Promise<SessionLink[]> {
  const rs = await rows(
    `SELECT l.*, (SELECT COUNT(*) FROM sessions s WHERE s.link_id = l.id) AS session_count
     FROM links l WHERE l.interview_id = ? ORDER BY l.created_at DESC`,
    [interviewId],
  );
  return rs.map(toLink);
}

export async function createLink(interviewId: string, label: string): Promise<SessionLink> {
  const id = randomUUID();
  await run("INSERT INTO links (id, interview_id, token, label, created_at) VALUES (?, ?, ?, ?, ?)", [
    id,
    interviewId,
    newToken(),
    label,
    now(),
  ]);
  const [r] = await rows("SELECT * FROM links WHERE id = ?", [id]);
  return toLink(r);
}

export async function setLinkRevoked(id: string, revoked: boolean) {
  await run("UPDATE links SET revoked = ? WHERE id = ?", [revoked ? 1 : 0, id]);
}

/** A live link and its brief, or null when the token is unknown, turned off or archived */
export async function resolveLink(token: string): Promise<{ link: SessionLink; brief: Brief } | null> {
  const [r] = await rows("SELECT * FROM links WHERE token = ?", [token]);
  if (!r) return null;
  const link = toLink(r);
  if (link.revoked) return null;
  const brief = await getBrief(link.interviewId);
  if (!brief || brief.interview.archived) return null;
  return { link, brief };
}

// -------------------------------------------------------------- sessions

function toSession(r: Row): Session {
  return {
    id: String(r.id),
    linkId: String(r.link_id),
    interviewId: String(r.interview_id),
    callNumber: Number(r.call_number),
    brief: json(r.brief, {} as Brief),
    conversationId: str(r.conversation_id),
    status: String(r.status) as Session["status"],
    topics: json(r.topics, []),
    checklist: json(r.checklist, []),
    currentTopicId: str(r.current_topic_id),
    closingSummary: str(r.closing_summary),
    transcript: json(r.transcript, []),
    extracted: json(r.extracted, {}),
    callSummary: str(r.call_summary),
    durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    startedAt: String(r.started_at),
    endedAt: str(r.ended_at),
    syncedAt: str(r.synced_at),
  };
}

export async function createSession(link: SessionLink, brief: Brief) {
  const id = randomUUID();
  const sessionKey = newToken(24);
  const [count] = await rows("SELECT COUNT(*) AS n FROM sessions WHERE interview_id = ?", [brief.interview.id]);
  const topics = brief.interview.topics.map((t) => ({ topicId: t.id, status: "pending", points: [], summary: null }));
  await run(
    `INSERT INTO sessions (id, link_id, interview_id, call_number, session_key, brief, topics, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, link.id, brief.interview.id, Number(count.n) + 1, sessionKey, JSON.stringify(brief), JSON.stringify(topics), now()],
  );
  return { id, sessionKey };
}

export async function getSession(id: string): Promise<Session | null> {
  const [r] = await rows("SELECT * FROM sessions WHERE id = ?", [id]);
  return r ? toSession(r) : null;
}

export async function getSessionByConversation(conversationId: string): Promise<Session | null> {
  const [r] = await rows("SELECT * FROM sessions WHERE conversation_id = ?", [conversationId]);
  return r ? toSession(r) : null;
}

/** The session, if `key` is the secret handed to the browser that started it */
export async function getSessionForKey(id: string, key: string): Promise<Session | null> {
  const [r] = await rows("SELECT * FROM sessions WHERE id = ? AND session_key = ?", [id, key]);
  return r ? toSession(r) : null;
}

export type SessionRow = Session & { linkLabel: string };

export async function listSessions(
  filter: { interviewId?: string; clientId?: string } = {},
  limit = 50,
): Promise<SessionRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.interviewId) {
    where.push("s.interview_id = ?");
    args.push(filter.interviewId);
  }
  if (filter.clientId) {
    where.push("a.client_id = ?");
    args.push(filter.clientId);
  }
  const rs = await rows(
    `SELECT s.*, l.label AS link_label FROM sessions s
     JOIN links l ON l.id = s.link_id
     JOIN interviews i ON i.id = s.interview_id
     JOIN agents a ON a.id = i.agent_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY s.started_at DESC LIMIT ?`,
    [...args, limit],
  );
  return rs.map((r) => ({ ...toSession(r), linkLabel: String(r.link_label) }));
}

export async function countRecentSessions(linkId: string, sinceIso: string) {
  const [r] = await rows("SELECT COUNT(*) AS n FROM sessions WHERE link_id = ? AND started_at > ?", [linkId, sinceIso]);
  return Number(r.n);
}

export async function deleteSession(id: string) {
  await run("DELETE FROM sessions WHERE id = ?", [id]);
}

/** Fold one live event from the browser into the stored session */
export function applyEvent(session: Session, event: SessionEvent): Session {
  const s: Session = {
    ...session,
    topics: session.topics.map((t) => ({ ...t, points: [...t.points] })),
    checklist: [...session.checklist],
  };
  const topic = (id: string) => s.topics.find((t) => t.topicId === id);

  switch (event.type) {
    case "set_topic": {
      const t = topic(event.topicId);
      if (!t) break;
      for (const other of s.topics) if (other.status === "active") other.status = "partial";
      if (t.status !== "answered") t.status = "active";
      s.currentTopicId = t.topicId;
      break;
    }
    case "capture_point": {
      // Points on an unknown topic (the open line has none) are kept under "general"
      let t = topic(event.topicId) ?? topic("general");
      if (!t) {
        t = { topicId: "general", status: "pending", points: [], summary: null };
        s.topics.push(t);
      }
      if (!t.points.some((p) => p.text === event.point)) t.points.push({ text: event.point, kind: event.kind });
      break;
    }
    case "complete_topic": {
      const t = topic(event.topicId);
      if (!t) break;
      t.status = event.status;
      t.summary = event.summary || t.summary;
      if (s.currentTopicId === t.topicId) s.currentTopicId = null;
      break;
    }
    case "check_item":
      s.checklist = [...s.checklist.filter((c) => c.itemId !== event.itemId), { itemId: event.itemId, value: event.value }];
      break;
    case "save_summary":
      s.closingSummary = event.summary;
      break;
    case "transcript":
      s.transcript = [...s.transcript, { role: event.role, message: event.message, time: null }];
      break;
    case "conversation_id":
      s.conversationId = event.conversationId;
      break;
    case "ended":
      if (s.status === "active") {
        s.status = event.early ? "ended_early" : "completed";
        s.endedAt = now();
      }
      break;
    case "log_request":
      // Stored in the requests table by the events route
      break;
  }
  return s;
}

export async function saveSession(s: Session) {
  await run(
    `UPDATE sessions SET conversation_id = ?, status = ?, topics = ?, checklist = ?, current_topic_id = ?,
       closing_summary = ?, transcript = ?, extracted = ?, call_summary = ?, duration_seconds = ?, ended_at = ?, synced_at = ?
     WHERE id = ?`,
    [
      s.conversationId,
      s.status,
      JSON.stringify(s.topics),
      JSON.stringify(s.checklist),
      s.currentTopicId,
      s.closingSummary,
      JSON.stringify(s.transcript),
      JSON.stringify(s.extracted),
      s.callSummary,
      s.durationSeconds == null ? null : Math.round(s.durationSeconds),
      s.endedAt,
      s.syncedAt,
      s.id,
    ],
  );
}

// -------------------------------------------------------------- requests

function toRequest(r: Row): ClientRequest {
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    sessionId: str(r.session_id),
    type: String(r.type) as ClientRequest["type"],
    title: String(r.title),
    details: String(r.details),
    urgency: String(r.urgency) as ClientRequest["urgency"],
    status: String(r.status) as RequestStatus,
    response: String(r.response),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export type RequestRow = ClientRequest & { clientName: string; clientCompany: string };

export async function listRequests(
  filter: { clientId?: string; openOnly?: boolean } = {},
  limit = 200,
): Promise<RequestRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.clientId) {
    where.push("r.client_id = ?");
    args.push(filter.clientId);
  }
  if (filter.openOnly) where.push("r.status IN ('new', 'in_progress')");
  const rs = await rows(
    `SELECT r.*, c.name AS client_name, c.company AS client_company FROM requests r
     JOIN clients c ON c.id = r.client_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY CASE r.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, r.created_at DESC LIMIT ?`,
    [...args, limit],
  );
  return rs.map((r) => ({ ...toRequest(r), clientName: String(r.client_name), clientCompany: String(r.client_company) }));
}

/** Idempotent: the browser may resend the same request after a network blip */
export async function insertRequest(
  req: Pick<ClientRequest, "id" | "clientId" | "sessionId" | "type" | "title" | "details" | "urgency">,
) {
  const t = now();
  await run(
    `INSERT INTO requests (id, client_id, session_id, type, title, details, urgency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    [req.id, req.clientId, req.sessionId, req.type, req.title, req.details, req.urgency, t, t],
  );
}

export async function updateRequest(id: string, patch: { status?: RequestStatus; response?: string }) {
  const sets: string[] = [];
  const args: string[] = [];
  if (patch.status) {
    sets.push("status = ?");
    args.push(patch.status);
  }
  if (patch.response != null) {
    sets.push("response = ?");
    args.push(patch.response);
  }
  if (!sets.length) return;
  await run(`UPDATE requests SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`, [...args, now(), id]);
}

export async function deleteRequest(id: string) {
  await run("DELETE FROM requests WHERE id = ?", [id]);
}

// -------------------------------------------------------------- settings

export async function getSetting(key: string): Promise<string | null> {
  const [r] = await rows("SELECT value FROM settings WHERE key = ?", [key]);
  return r ? String(r.value) : null;
}

export async function setSetting(key: string, value: string) {
  await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    key,
    value,
  ]);
}
