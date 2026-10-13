import { getSession } from "@/lib/db/queries";
import { errorMessage, fail, json } from "@/lib/http";
import { syncFromElevenLabs } from "@/lib/sessions";

/** Re-pull transcript, extraction and summary from ElevenLabs */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/sessions/[id]/sync">) {
  const session = await getSession((await ctx.params).id);
  if (!session) return fail("Not found", 404);
  if (!session.conversationId) return fail("This session never connected to ElevenLabs.");
  try {
    const synced = await syncFromElevenLabs(session, { force: true });
    return json({ session: synced, pending: !synced.syncedAt });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
