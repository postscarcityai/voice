import { deleteClient, getClient, updateClient } from "@/lib/db/queries";
import { resyncLater } from "@/lib/admin";
import { fail, json, readJson } from "@/lib/http";
import { parseClientInput } from "@/lib/validate";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/clients/[id]">) {
  const client = await getClient((await ctx.params).id);
  return client ? json({ client }) : fail("Not found", 404);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/clients/[id]">) {
  const { id } = await ctx.params;
  const { input, error } = parseClientInput(await readJson(request));
  if (!input) return fail(error!);
  const client = await updateClient(id, input);
  if (!client) return fail("Not found", 404);
  resyncLater({ clientId: id });
  return json({ client });
}

/** Deletes the client and everything under it here. ElevenLabs agents are left in place. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/clients/[id]">) {
  await deleteClient((await ctx.params).id);
  return json({ ok: true });
}
