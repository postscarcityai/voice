import { getBrief } from "@/lib/db/queries";
import { fail, json } from "@/lib/http";
import { generateReport, reportsEnabled } from "@/lib/report";

// Long interviews make long prompts; give the model room
export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/admin/interviews/[id]/report">) {
  if (!reportsEnabled()) return fail("Set ANTHROPIC_API_KEY to generate handoff reports.", 400);
  const brief = await getBrief((await ctx.params).id);
  if (!brief) return fail("Not found", 404);
  try {
    return json({ markdown: await generateReport(brief) });
  } catch (err) {
    console.error("[voice] report failed:", err);
    return fail(err instanceof Error ? err.message : "Couldn't generate the report.", 502);
  }
}
