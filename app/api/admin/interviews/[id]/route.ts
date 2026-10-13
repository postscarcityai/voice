import { deleteInterview, getInterview, updateInterview } from "@/lib/db/queries";
import { trySync } from "@/lib/admin";
import { fail, json, readJson } from "@/lib/http";
import { parseInterviewInput } from "@/lib/validate";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/interviews/[id]">) {
  const interview = await getInterview((await ctx.params).id);
  return interview ? json({ interview }) : fail("Not found", 404);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/interviews/[id]">) {
  const { id } = await ctx.params;
  const { input, error } = parseInterviewInput(await readJson(request));
  if (!input) return fail(error!);
  if (!(await updateInterview(id, input))) return fail("Not found", 404);
  const syncError = await trySync(id);
  return json({ interview: await getInterview(id), syncError });
}

/** Deletes the interview, its links and calls here. The ElevenLabs agent is left in place. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/interviews/[id]">) {
  await deleteInterview((await ctx.params).id);
  return json({ ok: true });
}

/** Archive or restore. Archived interviews keep their history; their links stop working. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/interviews/[id]">) {
  const { id } = await ctx.params;
  const interview = await getInterview(id);
  if (!interview) return fail("Not found", 404);
  const { archived } = (await readJson(request)) as { archived?: boolean };
  await updateInterview(id, { ...interview, archived: Boolean(archived) });
  return json({ ok: true });
}
