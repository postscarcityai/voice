import { listVoices } from "@/lib/elevenlabs";
import { errorMessage, fail, json } from "@/lib/http";

export async function GET() {
  try {
    const voices = await listVoices();
    return json({
      voices: voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        previewUrl: v.preview_url ?? null,
        description: [v.labels?.gender, v.labels?.accent, v.labels?.age, v.labels?.description]
          .filter(Boolean)
          .join(", "),
      })),
    });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
