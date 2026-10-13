import { addLibraryVoice, searchVoiceLibrary } from "@/lib/elevenlabs";
import { errorMessage, fail, json, readJson } from "@/lib/http";

/** Search the shared ElevenLabs voice library */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    const voices = await searchVoiceLibrary({
      search: p.get("search") ?? undefined,
      gender: p.get("gender") ?? undefined,
      language: p.get("language") ?? undefined,
      accent: p.get("accent") ?? undefined,
      age: p.get("age") ?? undefined,
    });
    return json({
      voices: voices.map((v) => ({
        publicOwnerId: v.public_owner_id,
        id: v.voice_id,
        name: v.name,
        description: v.description ?? "",
        tags: [v.gender, v.age, v.accent, v.descriptive, v.use_case].filter(Boolean).join(" · "),
        languages: [...new Set([v.language, ...(v.verified_languages ?? []).map((l) => l.language)].filter(Boolean))],
        previewUrl: v.preview_url ?? null,
        uses: v.cloned_by_count ?? 0,
      })),
    });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}

/** Add a library voice to the account, returning the id agents use */
export async function POST(request: Request) {
  const { publicOwnerId, voiceId, name } = (await readJson(request)) as Record<string, string | undefined>;
  if (!publicOwnerId || !voiceId) return fail("publicOwnerId and voiceId are required.");
  try {
    return json({ voiceId: await addLibraryVoice(publicOwnerId, voiceId, name || "Library voice") });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
