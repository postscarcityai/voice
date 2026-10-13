import { getSessionByConversation } from "@/lib/db/queries";
import { verifyWebhook, type ElevenConversation } from "@/lib/elevenlabs";
import { fail, json } from "@/lib/http";
import { mergeConversation } from "@/lib/sessions";

/**
 * Optional ElevenLabs post-call webhook. Point a workspace webhook at
 * /api/webhooks/elevenlabs and set ELEVENLABS_WEBHOOK_SECRET; finished calls
 * then fill in without anyone opening them.
 */
export async function POST(request: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) return fail("Webhook not configured.", 404);

  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get("elevenlabs-signature"), secret)) return fail("Bad signature.", 401);

  const event = JSON.parse(raw) as { type?: string; data?: ElevenConversation };
  if (event.type !== "post_call_transcription" || !event.data?.conversation_id) return json({ ok: true });

  const session = await getSessionByConversation(event.data.conversation_id);
  // Retries are normal; merging the same conversation twice is harmless
  if (session) await mergeConversation(session, { ...event.data, status: "done" });
  return json({ ok: true });
}
