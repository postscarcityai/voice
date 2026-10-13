import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export const env = {
  get elevenlabsApiKey() {
    return required("ELEVENLABS_API_KEY");
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
    return secret;
  },
  get databaseUrl() {
    return process.env.DATABASE_URL || "file:data/voice.db";
  },
  get databaseAuthToken() {
    return process.env.DATABASE_AUTH_TOKEN || undefined;
  },
  get webhookSecret() {
    return process.env.ELEVENLABS_WEBHOOK_SECRET || null;
  },
  get orgName() {
    return process.env.ORG_NAME || "PostScarcity AI";
  },
  /** How the org name should be said out loud, if it reads oddly */
  get orgNameSpoken() {
    return process.env.ORG_NAME_SPOKEN || "Post Scarcity A.I.";
  },
  get defaultVoiceId() {
    return process.env.ELEVENLABS_DEFAULT_VOICE_ID || "";
  },
  get defaultLlm() {
    return process.env.ELEVENLABS_DEFAULT_LLM || "";
  },
  get ttsModel() {
    return process.env.ELEVENLABS_TTS_MODEL || "";
  },
  get publicUrl() {
    return process.env.PUBLIC_URL?.replace(/\/$/, "") || null;
  },
};
