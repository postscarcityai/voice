import { getBrief, listSessions } from "@/lib/db/queries";
import { interviewCSV, interviewFileBase, interviewMarkdown } from "@/lib/export";
import { fail } from "@/lib/http";

/** The whole interview: handoff, notes by topic across calls, and every transcript */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/interviews/[id]/export">) {
  const brief = await getBrief((await ctx.params).id);
  if (!brief) return fail("Not found", 404);
  const sessions = await listSessions({ interviewId: brief.interview.id }, 500);
  const format = new URL(request.url).searchParams.get("format") ?? "md";
  const base = interviewFileBase(brief.interview, brief.client.company || brief.client.name);
  const out =
    format === "csv"
      ? { body: interviewCSV(brief.interview, sessions), type: "text/csv; charset=utf-8" }
      : format === "report" && brief.interview.reportMarkdown
        ? { body: brief.interview.reportMarkdown, type: "text/markdown; charset=utf-8" }
        : { body: interviewMarkdown(brief.interview, brief.client.name, sessions), type: "text/markdown; charset=utf-8" };
  const ext = format === "csv" ? "csv" : "md";
  const name = format === "report" ? `${base}-handoff` : base;
  return new Response(out.body, {
    headers: { "content-type": out.type, "content-disposition": `attachment; filename="${name}.${ext}"` },
  });
}
