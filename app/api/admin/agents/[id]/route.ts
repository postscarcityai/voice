import { deleteAgent, updateAgent } from "@/lib/db/queries";
import { resyncLater } from "@/lib/admin";
import { fail, json, readJson } from "@/lib/http";
import { parseAgentInput } from "@/lib/validate";

export async function PUT(request: Request, ctx: RouteContext<"/api/admin/agents/[id]">) {
  const { id } = await ctx.params;
  const { input, error } = parseAgentInput(await readJson(request));
  if (!input) return fail(error!);
  const agent = await updateAgent(id, input);
  if (!agent) return fail("Not found", 404);
  resyncLater({ agentId: id });
  return json({ agent });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/agents/[id]">) {
  await deleteAgent((await ctx.params).id);
  return json({ ok: true });
}
