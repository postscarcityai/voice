# Security

## Reporting a vulnerability

Please email **hello@postscarcity.ai** with the details. Don't open a public issue. We'll acknowledge it within a few days and keep you posted while we fix it.

## What to keep out of this repo

Voice holds sensitive material: background on clients, what they say in interviews, and API keys. None of it belongs in git.

- **Keys** go in `.env.local` (or your host's environment). Only `.env.example` is committed.
- **Client configs** go in `clients/` or in files ending `.local.json`. Both are gitignored. Only `examples/` is committed, and it uses fictional clients.
- **Data** lives in `data/` (gitignored) or your remote libSQL database.

Before you open a PR, check `git status` for anything under `clients/`, `data/` or `.env*`.

## How keys are handled

- `ELEVENLABS_API_KEY` is read only in server code (`lib/env.ts` imports `server-only`).
- Browsers get a short-lived WebRTC conversation token per session, minted by `POST /api/session/<token>/start` after the share link is checked.
- ElevenLabs agents are created with `enable_auth: true` and no client overrides, so a token can't be used to change the agent's prompt, voice or tools. Per-call context (progress from earlier calls, request status) is pushed server-side before the token is minted, and the call is pinned to that agent version.
- What a client's browser receives is limited to `lib/public.ts`: names, topic titles, openers and examples, and their own captured points. Never the background context, rules, agent guidance, or anything captured off the record.
