import { fail, json, readJson } from "@/lib/http";
import { magicLinkEnabled, sendMagicLink } from "@/lib/magic-link";

/** Send an admin sign-in link. Always answers the same way, so it can't be used to find admin addresses. */
export async function POST(request: Request) {
  if (!magicLinkEnabled()) return fail("Email sign-in isn't set up.", 404);
  const { email, next } = (await readJson(request)) as { email?: string; next?: string };
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return fail("Enter a valid email.");

  const base = process.env.PUBLIC_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const confirm = new URL("/auth/confirm", base);
  if (typeof next === "string" && next.startsWith("/admin")) confirm.searchParams.set("next", next);
  try {
    await sendMagicLink(email, confirm.toString());
  } catch (err) {
    console.error("[voice] magic link failed:", err);
    return fail("Couldn't send the email. Try again in a minute.", 502);
  }
  return json({ ok: true });
}
