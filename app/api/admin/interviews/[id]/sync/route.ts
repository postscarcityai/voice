import { getInterview } from "@/lib/db/queries";
import { trySync } from "@/lib/admin";
import { fail, json } from "@/lib/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/admin/interviews/[id]/sync">) {
  const { id } = await ctx.params;
  if (!(await getInterview(id))) return fail("Not found", 404);
  const error = await trySync(id, true);
  return error ? fail(error, 502) : json({ interview: await getInterview(id) });
}
