import { deleteRequest, updateRequest } from "@/lib/db/queries";
import { json, readJson } from "@/lib/http";
import type { RequestStatus } from "@/lib/types";

const STATUSES: RequestStatus[] = ["new", "in_progress", "done", "declined"];

/** Status and the team's note. The open line reads both, so the client can ask how things are going. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/requests/[id]">) {
  const { status, response } = (await readJson(request)) as { status?: string; response?: string };
  await updateRequest((await ctx.params).id, {
    status: STATUSES.includes(status as RequestStatus) ? (status as RequestStatus) : undefined,
    response: typeof response === "string" ? response.slice(0, 2000) : undefined,
  });
  return json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/requests/[id]">) {
  await deleteRequest((await ctx.params).id);
  return json({ ok: true });
}
