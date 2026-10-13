# Contributing

Thanks for helping. Voice is small on purpose. Changes that keep it that way are the easiest to merge.

## Setup

```bash
npm install
cp .env.example .env.local   # add your own ElevenLabs key
npm run dev
```

Add `?demo` to any share link to work on the client screen without a microphone or an ElevenLabs session.

## Before you open a PR

```bash
npm run lint
npm run typecheck
npm run build
```

- Match the code around you: TypeScript, server components for reads, route handlers for writes, Tailwind for styles.
- Prompt changes (`lib/prompt.ts`) change how every interview feels. In the PR, say what you changed and what you tried it on.
- Never commit client data, transcripts or keys. See [SECURITY.md](./SECURITY.md).

## Where things live

- How the agent behaves: `lib/prompt.ts`
- What gets sent to ElevenLabs: `lib/elevenlabs.ts`
- The client's screen: `components/session/`
- The admin: `app/admin/` and `components/admin/`
