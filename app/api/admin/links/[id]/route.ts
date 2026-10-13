import { setLinkRevoked } from "@/lib/db/queries";
import { json, readJson } from "@/lib/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/links/[id]">) {
  const { revoked } = (await readJson(request)) as { revoked?: boolean };
  await setLinkRevoked((await ctx.params).id, Boolean(revoked));
  return json({ ok: true });
}
