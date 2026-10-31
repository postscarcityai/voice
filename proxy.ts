import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, MEMBER_COOKIE, isValidAdminCookie, memberCookieClient } from "@/lib/auth";

// Everything under /admin and /api/admin needs the admin cookie; /me needs a
// client member's cookie. Client session pages (/s/...) and their API
// (/api/session/...) are public and authorize with the link token instead.
export async function proxy(request: NextRequest) {
  const ok = request.nextUrl.pathname.startsWith("/me")
    ? Boolean(await memberCookieClient(request.cookies.get(MEMBER_COOKIE)?.value))
    : await isValidAdminCookie(request.cookies.get(ADMIN_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/me", "/me/:path*"],
};
