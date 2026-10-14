import { cookies } from "next/headers";
import { checkPassword, issueAdminCookie } from "@/lib/auth";
import { fail, json, readJson } from "@/lib/http";

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) return fail("Password sign-in is off.", 404);
  const { password } = (await readJson(request)) as { password?: string };
  // A small fixed delay blunts password guessing
  await new Promise((r) => setTimeout(r, 400));
  if (typeof password !== "string" || !checkPassword(password)) return fail("Wrong password.", 401);
  (await cookies()).set(await issueAdminCookie());
  return json({ ok: true });
}
