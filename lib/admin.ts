import "server-only";
import { after } from "next/server";
import { getBrief, listAgents, listInterviews } from "./db/queries";
import { syncInterview } from "./elevenlabs";
import { callContext } from "./sessions";

/** Push one interview to ElevenLabs with its current call context. Returns an error message or null. */
export async function trySync(interviewId: string, force = false): Promise<string | null> {
  try {
    const brief = await getBrief(interviewId);
    if (!brief || brief.interview.archived) return null;
    await syncInterview(brief, { force, ctx: await callContext(brief) });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** After a client or agent changes, every one of its interviews' ElevenLabs agents is stale. Update them after responding. */
export function resyncLater(scope: { clientId?: string; agentId?: string }) {
  after(async () => {
    const agentIds = scope.agentId ? [scope.agentId] : (await listAgents(scope.clientId!)).map((a) => a.id);
    for (const agentId of agentIds) {
      for (const i of await listInterviews(agentId)) {
        if (!i.archived && i.elevenlabsAgentId) await trySync(i.id);
      }
    }
  });
}
