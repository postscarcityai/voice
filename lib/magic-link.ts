import "server-only";
import { createClient } from "@supabase/supabase-js";
import { memberClientId } from "@/lib/db/queries";

// Admin sign-in by email link, using Supabase Auth only to send the email and
// prove the address. Once proven, the app issues its own admin cookie
// (lib/auth.ts), so Supabase sessions never matter to the rest of the app.
//
// Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and ADMIN_EMAILS. The email
// template must link to {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
// (see supabase/templates/magic-link.html), which works on any device.

export const magicLinkEnabled = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && adminEmails().length);

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdminEmail = (email: string) => adminEmails().includes(email.trim().toLowerCase());

function supabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
}

/** Who an address signs in as: an admin, a member of one client, or nobody */
export async function roleFor(email: string): Promise<{ admin: true } | { clientId: string } | null> {
  if (isAdminEmail(email)) return { admin: true };
  const clientId = await memberClientId(email);
  return clientId ? { clientId } : null;
}

/** Email a sign-in link. Only admins and client members get one; callers shouldn't reveal which. */
export async function sendMagicLink(email: string, confirmUrl: string) {
  if (!(await roleFor(email))) return;
  const { error } = await supabase().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: confirmUrl, shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

/** Check a link's token. Returns the email it proves, or null. */
export async function verifyMagicLink(tokenHash: string): Promise<string | null> {
  const { data, error } = await supabase().auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  const email = data.user?.email;
  return error || !email ? null : email;
}
