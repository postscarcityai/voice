import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { issueAdminCookie, issueMemberCookie } from "@/lib/auth";
import { roleFor, verifyMagicLink } from "@/lib/magic-link";

/**
 * Where the emailed link lands: check the token, then sign in with the app's
 * own cookie. Admins go to /admin; client members to their own page, /me.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const next = params.get("next");
  const email = tokenHash ? await verifyMagicLink(tokenHash).catch(() => null) : null;
  const role = email ? await roleFor(email) : null;
  if (!role) return NextResponse.redirect(new URL("/login?error=link", request.url));
  const jar = await cookies();
  if ("admin" in role) {
    jar.set(await issueAdminCookie());
    return NextResponse.redirect(new URL(next?.startsWith("/admin") ? next : "/admin", request.url));
  }
  jar.set(await issueMemberCookie(role.clientId));
  return NextResponse.redirect(new URL(next?.startsWith("/me") ? next : "/me", request.url));
}
