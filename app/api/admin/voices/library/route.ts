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
    const want = p.get("language");
    const rows = voices.map((v) => {
      const verified = v.verified_languages ?? [];
      const languages = [...new Set([v.language, ...verified.map((l) => l.language)].filter(Boolean))] as string[];
      // Accents the voice is verified for, per language, e.g. "es: venezuelan, cuban"
      const accents = languages
        .filter((l) => l === "en" || l === "es" || l === want)
        .map((l) => {
          const list = [...new Set(verified.filter((x) => x.language === l).map((x) => x.accent).filter(Boolean))];
          return list.length ? `${l}: ${list.join(", ")}` : l;
        });
      return {
        publicOwnerId: v.public_owner_id,
        id: v.voice_id,
        name: v.name,
        description: v.description ?? "",
        tags: [v.age, v.accent, v.descriptive, v.use_case].filter(Boolean).join(" · ").replace(/_/g, " "),
        accents: accents.join(" · "),
        bilingual: languages.includes("en") && languages.includes("es"),
        paidOnly: v.free_users_allowed === false,
        previewUrl: v.preview_url ?? null,
        uses: v.cloned_by_count ?? 0,
      };
    });
    // English + Spanish first, then the most used
    rows.sort((a, b) => Number(b.bilingual) - Number(a.bilingual) || b.uses - a.uses);
    return json({ voices: rows });
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
