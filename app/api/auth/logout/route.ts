import { cookies } from "next/headers";
import { ADMIN_COOKIE, MEMBER_COOKIE } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  jar.delete(MEMBER_COOKIE);
  return json({ ok: true });
}
