// Admin auth: one shared password (ADMIN_PASSWORD) and a signed, expiring
// cookie. Web Crypto only, so the same code runs in proxy.ts and route handlers.

export const ADMIN_COOKIE = "voice_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

const encoder = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Buffer.from(sig).toString("base64url");
}

/** Constant-time string comparison */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  return s;
}

export async function issueAdminCookie() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const value = `${expires}.${await hmac(secret(), `admin.${expires}`)}`;
  return {
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function isValidAdminCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(secret(), `admin.${expires}`));
}

// Client members (lib/db client_members) get their own cookie, bound to one
// client. It opens /me and nothing under /admin.
export const MEMBER_COOKIE = "voice_member";

export async function issueMemberCookie(clientId: string) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const value = `${expires}.${clientId}.${await hmac(secret(), `member.${clientId}.${expires}`)}`;
  return { ...(await issueAdminCookie()), name: MEMBER_COOKIE, value };
}

/** The client id a member cookie is good for, or null */
export async function memberCookieClient(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [expires, clientId, sig] = value.split(".");
  if (!expires || !clientId || !sig || Number(expires) < Date.now() / 1000) return null;
  return safeEqual(sig, await hmac(secret(), `member.${clientId}.${expires}`)) ? clientId : null;
}

export function checkPassword(attempt: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not set.");
  return safeEqual(attempt, password);
}
