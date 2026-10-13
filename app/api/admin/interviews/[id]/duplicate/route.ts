import { createInterview, getAgent, getInterview } from "@/lib/db/queries";
import { fail, json, readJson } from "@/lib/http";

/** Copy an interview's brief, optionally to another agent (and so another client). Calls aren't copied. */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/interviews/[id]/duplicate">) {
  const source = await getInterview((await ctx.params).id);
  if (!source) return fail("Not found", 404);
  const { agentId } = (await readJson(request)) as { agentId?: string };
  const target = agentId ? await getAgent(agentId) : null;
  if (agentId && !target) return fail("Unknown agent.");
  const copy = await createInterview(target?.id ?? source.agentId, {
    kind: source.kind,
    audience: source.audience,
    title: target ? source.title : `${source.title} (copy)`,
    role: source.role,
    goal: source.goal,
    method: source.method,
    opening: source.opening,
    topics: source.topics,
    closing: source.closing,
    checklist: source.checklist,
    report: source.report,
    estimatedMinutes: source.estimatedMinutes,
    archived: false,
  });
  return json({ interview: copy }, 201);
}
