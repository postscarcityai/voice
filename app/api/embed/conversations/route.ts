import { clientForKey } from "@/lib/db/queries";
import { fail, json } from "@/lib/http";
import { clientPortal } from "@/lib/portal";

/**
 * One client's conversations, for that client's own dashboard to show (the
 * same view as /me). Server to server only: send `Authorization: Bearer
 * vk_...` (npm run client-key). Call paths are relative to PUBLIC_URL, which
 * is returned as `base`.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const clientId = auth.toLowerCase().startsWith("bearer ") ? await clientForKey(auth.slice(7).trim()) : null;
  if (!clientId) return fail("Unauthorized", 401);
  const portal = await clientPortal(clientId);
  if (!portal) return fail("Unauthorized", 401);
  const base = process.env.PUBLIC_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  return json({ base, ...portal });
}
