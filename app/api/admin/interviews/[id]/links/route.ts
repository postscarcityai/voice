import { createLink, getInterview, listLinks } from "@/lib/db/queries";
import { fail, json, readJson } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/interviews/[id]/links">) {
  return json({ links: await listLinks((await ctx.params).id) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/admin/interviews/[id]/links">) {
  const interview = await getInterview((await ctx.params).id);
  if (!interview) return fail("Not found", 404);
  const { label } = (await readJson(request)) as { label?: string };
  return json({ link: await createLink(interview.id, String(label ?? "").trim().slice(0, 120)) }, 201);
}
