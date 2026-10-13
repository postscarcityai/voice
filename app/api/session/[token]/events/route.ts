import { after } from "next/server";
import { applyEvent, getBrief, getSession, getSessionForKey, insertRequest, resolveLink, saveSession } from "@/lib/db/queries";
import { fail, json, readJson } from "@/lib/http";
import { generateReport, reportsEnabled } from "@/lib/report";
import { syncFromElevenLabs } from "@/lib/sessions";
import { parseEvents } from "@/lib/validate";

// Waiting on ElevenLabs' analysis and writing the handoff can take a few minutes
export const maxDuration = 300;

/**
 * Live events from the browser: the agent's tool calls (topic, points,
 * checklist, requests, summary), transcript lines and the end of the call.
 * The browser sends one batch at a time, so each batch sees the last one's writes.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/session/[token]/events">) {
  const resolved = await resolveLink((await ctx.params).token);
  if (!resolved) return fail("This link is no longer active.", 404);

  const body = (await readJson(request)) as { sessionId?: string; sessionKey?: string };
  const session = await getSessionForKey(String(body.sessionId ?? ""), String(body.sessionKey ?? ""));
  if (!session || session.linkId !== resolved.link.id) return fail("Unknown session.", 403);

  const events = parseEvents(body);
  let next = session;
  for (const event of events) {
    if (event.type === "log_request") {
      await insertRequest({
        id: event.requestId,
        clientId: session.brief.client.id,
        sessionId: session.id,
        type: event.requestType,
        title: event.title,
        details: event.details,
        urgency: event.urgency,
      });
      continue;
    }
    // A conversation id is set once, by whichever side learns it first
    if (event.type === "conversation_id" && next.conversationId) continue;
    next = applyEvent(next, event);
  }
  await saveSession(next);

  if (events.some((e) => e.type === "ended")) {
    after(async () => {
      // ElevenLabs needs a little while to finish its transcript and analysis
      for (const wait of [5000, 15000, 30000, 60000]) {
        await new Promise((r) => setTimeout(r, wait));
        try {
          const latest = await getSession(next.id);
          if (!latest || (await syncFromElevenLabs(latest)).syncedAt) break;
        } catch {
          break;
        }
      }
      // Then refresh the written handoff with this call included
      const latest = await getSession(next.id);
      if (reportsEnabled() && latest?.transcript.length && latest.brief.interview.kind === "interview") {
        const brief = await getBrief(latest.interviewId);
        if (brief) await generateReport(brief).catch((err) => console.error("[voice] report failed:", err));
      }
    });
  }
  return json({ ok: true });
}
