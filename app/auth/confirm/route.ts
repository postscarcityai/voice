import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { issueAdminCookie } from "@/lib/auth";
import { verifyMagicLink } from "@/lib/magic-link";

/** Where the emailed link lands: check the token, then sign in with the app's own admin cookie. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const next = params.get("next");
  const email = tokenHash ? await verifyMagicLink(tokenHash).catch(() => null) : null;
  if (!email) return NextResponse.redirect(new URL("/login?error=link", request.url));
  (await cookies()).set(await issueAdminCookie());
  return NextResponse.redirect(new URL(next?.startsWith("/admin") ? next : "/admin", request.url));
}
