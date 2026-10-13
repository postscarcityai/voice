import "server-only";
import { applyEvent, listRequests, listSessions, saveSession } from "./db/queries";
import { getConversation, readConversation, type ElevenConversation } from "./elevenlabs";
import { interviewProgress } from "./progress";
import type { CallContext } from "./prompt";
import type { Brief, Session } from "./types";

/**
 * What the next call needs to know: progress from earlier calls of this
 * interview, and for the open line, where the client's requests stand.
 */
export async function callContext(brief: Brief): Promise<CallContext> {
  const sessions = await listSessions({ interviewId: brief.interview.id }, 500);
  const progress = brief.interview.kind === "open_line" ? null : interviewProgress(brief.interview, sessions);
  const openRequests =
    brief.interview.kind === "open_line"
      ? (await listRequests({ clientId: brief.client.id, clientFacingOnly: true }, 40)).filter(
          // Open ones, plus anything closed in the last 30 days
          (r) => r.status === "new" || r.status === "in_progress" || Date.parse(r.updatedAt) > Date.now() - 30 * 864e5,
        )
      : [];
  return { progress, openRequests };
}

/**
 * Pull the finished conversation from ElevenLabs: the authoritative transcript,
 * per-topic extraction (data collection) and its call summary. Safe to call
 * repeatedly; it does nothing once synced or while ElevenLabs is still processing.
 */
export async function syncFromElevenLabs(session: Session, { force = false } = {}): Promise<Session> {
  if (!session.conversationId) return session;
  if (session.syncedAt && !force) return session;
  return mergeConversation(session, await getConversation(session.conversationId));
}

/** Fold a finished ElevenLabs conversation (from the API or a webhook) into the session */
export async function mergeConversation(session: Session, raw: ElevenConversation): Promise<Session> {
  const convo = readConversation(raw);
  if (!convo.done) return session;

  let next: Session = {
    ...session,
    transcript: convo.transcript.length ? convo.transcript : session.transcript,
    extracted: { ...session.extracted, ...convo.extracted },
    callSummary: convo.callSummary ?? session.callSummary,
    durationSeconds: convo.durationSeconds ?? session.durationSeconds,
    syncedAt: new Date().toISOString(),
  };
  // The browser may have closed before it could report the end
  if (next.status === "active") next = applyEvent(next, { type: "ended", early: !next.closingSummary });
  await saveSession(next);
  return next;
}
