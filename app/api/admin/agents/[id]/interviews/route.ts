import { createInterview, createLink, getAgent, getClient } from "@/lib/db/queries";
import { fail, json, readJson } from "@/lib/http";
import { BLANK, TEMPLATES } from "@/lib/templates";

/** Start a new interview from a template (or blank). It's tailored in the editor afterwards. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/agents/[id]/interviews">) {
  const agent = await getAgent((await ctx.params).id);
  if (!agent) return fail("Not found", 404);
  const { template } = (await readJson(request)) as { template?: string };
  const input = TEMPLATES.find((t) => t.id === template)?.input ?? BLANK;
  const interview = await createInterview(agent.id, input);
  const client = await getClient(agent.clientId);
  await createLink(interview.id, (interview.audience === "team" ? client?.owner : client?.name) ?? "");
  return json({ interview }, 201);
}
