import { ElevenLabsError } from "./elevenlabs";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

/** A readable message for errors we expect: missing config and ElevenLabs API failures */
export function errorMessage(err: unknown): string {
  if (err instanceof ElevenLabsError) return err.message;
  if (err instanceof Error && /^Missing |must be set|is not set/.test(err.message)) return err.message;
  console.error(err);
  return "Something went wrong.";
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
