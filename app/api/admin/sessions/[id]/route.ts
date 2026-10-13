import { deleteSession, getSession } from "@/lib/db/queries";
import { errorMessage, fail, json } from "@/lib/http";
import { syncFromElevenLabs } from "@/lib/sessions";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/sessions/[id]">) {
  let session = await getSession((await ctx.params).id);
  if (!session) return fail("Not found", 404);
  let syncError: string | null = null;
  try {
    session = await syncFromElevenLabs(session);
  } catch (err) {
    syncError = errorMessage(err);
  }
  return json({ session, syncError });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/sessions/[id]">) {
  await deleteSession((await ctx.params).id);
  return json({ ok: true });
}
