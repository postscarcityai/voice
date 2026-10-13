import { countRecentSessions, createSession, getSession, resolveLink, saveSession } from "@/lib/db/queries";
import { conversationToken, syncInterview } from "@/lib/elevenlabs";
import { fail, json } from "@/lib/http";
import { callContext } from "@/lib/sessions";

/** Calls one link may start per day, so a leaked link can't run up the bill */
const DAILY_LIMIT = Number(process.env.SESSIONS_PER_LINK_PER_DAY || 10);

/**
 * Start a call from a share link. The interview's ElevenLabs agent is brought
 * up to date with progress from earlier calls (server-side, so the browser
 * can't change what the agent is told), the call is pinned to that version,
 * and the browser gets a short-lived WebRTC token. The API key never leaves
 * the server.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/session/[token]/start">) {
  const resolved = await resolveLink((await ctx.params).token);
  if (!resolved) return fail("This link is no longer active.", 404);
  const { link, brief } = resolved;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if ((await countRecentSessions(link.id, since)) >= DAILY_LIMIT) {
    return fail("This link has been used a lot today. Please reach out to the team.", 429);
  }

  try {
    const { agentId, versionId } = await syncInterview(brief, { ctx: await callContext(brief) });
    const { token, conversation_id } = await conversationToken(agentId, versionId);
    const { id, sessionKey } = await createSession(link, brief);
    if (conversation_id) await saveSession({ ...(await getSession(id))!, conversationId: conversation_id });
    return json({ sessionId: id, sessionKey, conversationToken: token });
  } catch (err) {
    // Details stay in the server log; the client gets a plain message
    console.error("[voice] couldn't start call:", err);
    return fail("This conversation can't start right now. Please let the team know.", 502);
  }
}
