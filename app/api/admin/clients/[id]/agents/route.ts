import { createAgent, getClient } from "@/lib/db/queries";
import { fail, json, readJson } from "@/lib/http";
import { parseAgentInput } from "@/lib/validate";

export async function POST(request: Request, ctx: RouteContext<"/api/admin/clients/[id]/agents">) {
  const client = await getClient((await ctx.params).id);
  if (!client) return fail("Not found", 404);
  const { input, error } = parseAgentInput(await readJson(request));
  if (!input) return fail(error!);
  return json({ agent: await createAgent(client.id, input) }, 201);
}
