<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- Read `README.md` first. Voice is a Next.js 16 app with Cache Components on: wrap request-time reads in `<Suspense>` and call `await connection()` (or read params/cookies) so pages that use the DB aren't prerendered at build time.
- The model is Clients → Agents → Interviews → Calls (`lib/types.ts`). Each interview has its own ElevenLabs agent.
- `lib/prompt.ts` holds how conversations behave; `lib/elevenlabs.ts` maps it onto the ElevenAgents API. Tool names in `CLIENT_TOOLS` must match the handlers in `components/session/useInterview.ts`.
- Never pass functions as props from a server component to a client component, and never name a prop `then` (React treats the props object as a promise).
- Modules imported by `scripts/` (`lib/db/*`, `lib/validate.ts`, `lib/prompt.ts`, `lib/types.ts`) must not import `server-only`.
- Never commit anything under `clients/`, `data/` or `.env*`.
