import { listSessions, resolveLink } from "@/lib/db/queries";
import { fail, json } from "@/lib/http";
import { interviewProgress } from "@/lib/progress";
import { publicBrief } from "@/lib/public";

/**
 * The call screen's data as JSON (what /s/<token> renders), so a client's own
 * dashboard can run the call natively with /start and /events.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/session/[token]">) {
  const resolved = await resolveLink((await ctx.params).token);
  if (!resolved) return fail("This link is no longer active.", 404);
  const { brief } = resolved;
  const progress =
    brief.interview.kind === "interview"
      ? interviewProgress(brief.interview, await listSessions({ interviewId: brief.interview.id }, 500))
      : null;
  return json({ brief: publicBrief(brief, process.env.ORG_NAME || "PostScarcity AI", progress) });
}
