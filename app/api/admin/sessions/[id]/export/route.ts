import { getSession } from "@/lib/db/queries";
import { sessionCSV, sessionFileBase, sessionJSON, sessionMarkdown } from "@/lib/export";
import { fail } from "@/lib/http";
import type { Session } from "@/lib/types";

const FORMATS = {
  md: { type: "text/markdown; charset=utf-8", render: sessionMarkdown },
  json: { type: "application/json", render: (s: Session) => JSON.stringify(sessionJSON(s), null, 2) },
  csv: { type: "text/csv; charset=utf-8", render: sessionCSV },
} as const;

export async function GET(request: Request, ctx: RouteContext<"/api/admin/sessions/[id]/export">) {
  const session = await getSession((await ctx.params).id);
  if (!session) return fail("Not found", 404);
  const format = new URL(request.url).searchParams.get("format") ?? "md";
  const f = FORMATS[format as keyof typeof FORMATS];
  if (!f) return fail("format must be md, json or csv");
  return new Response(f.render(session), {
    headers: {
      "content-type": f.type,
      "content-disposition": `attachment; filename="${sessionFileBase(session)}.${format}"`,
    },
  });
}
