# Voice &middot; [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/postscarcityai/voice/blob/main/LICENSE) [![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/) [![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Eleven%20v4%20Turbo-white.svg)](https://elevenlabs.io/docs/eleven-agents/overview) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/postscarcityai/voice/pulls)

**Voice agents for your clients, in the browser.** Give each client an agent with a name and a personality. That agent runs structured interviews (discovery, change requests, content sessions), and it also keeps an open line the client can call whenever they have a question or want something done. Clients just open a link and talk. You get transcripts, structured answers, a request inbox, and a written handoff after every call.

Part of the [PostScarcity AI](https://github.com/postscarcityai) suite of open source repositories.

---

## How it's organized

```
Client        Alex Rivera, Rivera Ceramics
│             what we already know · rules and sensitivities · who she works with
└─ Agent      June: personality, voice, languages (English, follows them into Spanish)
   ├─ Interview   Website discovery: 7 topics, checklist, handoff spec   ── link ── calls 1, 2, 3…
   ├─ Interview   Content session (October)                              ── link ── call 1
   └─ Open line   Talk to June: questions, changes, ideas, content        ── link ── any time
```

- **Client.** Background (never asked again) and rules that apply to every conversation, such as confidential topics or claims never to make.
- **Agent.** A personality and a voice. One agent can run many interviews.
- **Interview.** One brief: a role, a goal, a method, topics (each with an opener and "for example" prompts), a closing round, a checklist of quick facts, and a spec for the written handoff. Interviews span calls. Every call picks up where the last one left off.
- **Open line.** An always-on interview with no topics. The client calls with whatever they need, and the agent logs each request to your inbox. When they ask how something is going, the agent reads back the status and notes you've set.

## A call, from the client's side

1. They open their link. No install, no typing. They see who they're talking to, how long it takes, and that they can stop any time.
2. **Intro.** The agent introduces itself, says it works with your org, and explains the session and its length.
3. **Interview.** For each topic, the agent asks the big opener and mentions a few examples. The screen shows the topic, the opener and all of the examples. The agent follows up on what's interesting and what's vague, quoting the client's own words back, and moves on when the client says "skip". As they talk, key points and quotable lines appear on screen. Anything confidential is captured off the record and never shown.
4. **Close.** The agent asks the closing questions, points to the checklist of quick facts still missing (it's on screen, and they can reply by email), saves a summary, thanks them and hangs up.
5. **Later.** If they stopped early, the same link greets them with "welcome back" and picks up at the next topic.

## What you get

- **Inbox.** Every request from any call (change, feature, project, content, question), with a status and a note the agent reads back to the client.
- **Progress.** Per interview: each topic's status, summary, captured notes, quotes and off-the-record points, plus checklist answers, merged across calls.
- **Handoff.** After each call, Claude writes the handoff the brief asks for (for example: a coverage table, quotable lines, notes by site page, business notes, off the record, open items), drawn from every call so far.
- **Calls.** The full transcript of each call, its summary, ElevenLabs' per-topic extraction, and any requests made during it.
- **Exports.** Markdown, JSON or CSV per call, plus Markdown or CSV for a whole interview.

## How it works

```
 Admin                          Server (Next.js)                          ElevenLabs
 ─────                          ────────────────                          ──────────
 save interview ──────────────▶ build prompt + tools ───────────────────▶ one agent per interview
                                                                          (auth required, Eleven v4 Turbo)
 Client opens /s/<token>, taps Start
              ────────────────▶ check link; add progress from earlier calls
                                and open requests; push it ─────────────▶ new agent version
                                mint WebRTC token for that version ─────▶ token
              ◀──────────────── token only (never the API key)
 talks ◀═════════════════════════════════ WebRTC audio ════════════════════▶ agent
 screen ◀── client tools: set_topic, capture_point, complete_topic, check_item, log_request, save_summary
        ──── events ──────────▶ saved as they happen (requests go to the inbox)
 hangs up ────────────────────▶ fetch transcript + extraction ◀───────────── (or post-call webhook)
                                Claude writes the handoff
```

- **Nothing sensitive reaches the browser.** The API key stays on the server. The client's page gets names, topic titles, openers, examples and its own captured points. It never gets the background context, rules, agent guidance, or anything off the record (`lib/public.ts`).
- **The browser can't change what the agent is told.** Every ElevenLabs agent has `enable_auth: true` and no client overrides. Per-call context is pushed from the server, and each call is pinned to the exact agent version that was pushed.
- **Two records of every answer.** Tool calls during the call are saved immediately, so a dropped call still leaves notes. After the call, ElevenLabs' data collection extracts each topic's answer from the full transcript.

## Quick start

You need Node 20.9+ and an [ElevenLabs](https://elevenlabs.io) API key. An [Anthropic](https://console.anthropic.com) API key is optional; it turns on the written handoffs.

```bash
git clone https://github.com/postscarcityai/voice.git
cd voice
npm install

cp .env.example .env.local
# Set ELEVENLABS_API_KEY, ADMIN_PASSWORD and SESSION_SECRET (openssl rand -base64 48)
# Optional: ANTHROPIC_API_KEY for handoff reports

npm run dev
# Open http://localhost:3030
```

Load the example client (fictional), or create one in the admin:

```bash
npm run seed -- examples/client.example.json
```

The seed prints a share link for each interview. Add `?demo` to any link to see a scripted, offline run of the client's screen: no microphone, no ElevenLabs session, nothing saved.

## Writing a brief

In the admin, start an interview from a template (Discovery interview, Change request, Content session, Open line) and tailor it. Or keep each client in a JSON file and load it with `npm run seed`. The file shape is in [`examples/client.example.json`](./examples/client.example.json):

```jsonc
{
  "client": { "name": "…", "company": "…", "owner": "…", "context": "…", "guardrails": "…" },
  "agents": [{
    "name": "June", "persona": "…", "language": "en", "extraLanguages": ["es"],
    "interviews": [{
      "kind": "interview",             // or "open_line"
      "title": "Brand discovery",
      "role": "…", "goal": "…",
      "method": "",                    // empty = the default "open big, double-click, move on" method
      "opening": "Hi Alex, I'm June…", // spoken word for word on the first call
      "topics": [{ "id": "story", "title": "Your story", "opener": "…", "examples": ["…"], "notes": "agent-only" }],
      "closing": "…",
      "checklist": [{ "id": "photos", "label": "Ten favorite product photos" }],
      "report": "",                    // empty = the default handoff spec
      "estimatedMinutes": 30
    }]
  }]
}
```

Long text can live in files next to the JSON: `contextFile` and `guardrailsFile` on the client, and `roleFile`, `methodFile` and `reportFile` on an interview. Keep real client files in `clients/`; it's gitignored. Re-running the seed updates matching records in place (client by name, agent by name, interview by title) and keeps calls, links and requests.

Briefs can be written the way you'd brief a person, even for text chat ("send her a message with…"). The platform layer in `lib/prompt.ts` turns that into a good phone call. Turns stay short. Lists of examples become a few spoken examples, with the rest shown on screen. "Message" means a spoken turn. The interview page shows the exact prompt for the next call under **What the agent is told**.

## ElevenLabs

Voice creates and updates agents through the [ElevenAgents API](https://elevenlabs.io/docs/eleven-agents/api-reference). You don't need to set anything up in the ElevenLabs dashboard. Each interview gets:

| | |
| --- | --- |
| Voice model | `eleven_v4_turbo`, the real-time Eleven v4 model (90+ languages). Override with `ELEVENLABS_TTS_MODEL`. |
| LLM | `claude-sonnet-5-5`, unless the agent or `ELEVENLABS_DEFAULT_LLM` sets another |
| Client tools | `set_topic`, `capture_point`, `complete_topic`, `check_item`, `log_request`, `save_summary`: created once per workspace, silent, fire-and-forget |
| System tools | `end_call`; `skip_turn` ("give me a second"); `language_detection` when the agent has extra languages |
| Languages | One `language_presets` entry for each extra language, so the agent follows the client mid-call |
| Turn-taking | `turn_eagerness: patient`, a 15-second turn timeout: room for long, rambling answers |
| Data collection | One field per topic (first 25), filled from the transcript after the call |
| Auth | `enable_auth: true`: calls need a token from this server |
| Max length | Twice the estimate plus ten minutes, capped at two hours |

**Post-call webhook (optional).** By default, a call pulls its transcript and analysis when it ends and again when you open it. To have results arrive without anyone opening the page, add a post-call webhook in ElevenAgents settings that points at `https://<your-host>/api/webhooks/elevenlabs`, and set `ELEVENLABS_WEBHOOK_SECRET`. The webhook signature is checked.

## Deploying

Voice is a standard Next.js app. It keeps its data in SQLite through [libSQL](https://github.com/tursodatabase/libsql):

- **On a server with a disk** (Fly, Railway, Render, a VPS): run `npm run build && npm start` and keep the default `DATABASE_URL=file:data/voice.db` on a persistent volume.
- **On serverless** (Vercel and similar): create a [Turso](https://turso.tech) database and set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN`. Tables are created on the first request. To load clients into it, run the seed locally with those variables set.

Set `PUBLIC_URL` so share links use your domain. Microphones need HTTPS, except on localhost.

## Security and privacy

- `/admin` and `/api/admin/*` require the admin cookie. It's signed with `SESSION_SECRET`, HTTP-only, and expires after 14 days.
- Share links are 144-bit random tokens. You can turn a link off, or archive an interview, at any time. Each link can start `SESSIONS_PER_LINK_PER_DAY` calls a day (default 10).
- Live events from a browser need that call's own secret key, issued when the call starts.
- The welcome screen tells the client that the call is recorded and transcribed and that the agent is an AI. Check what consent your clients' jurisdictions require.
- Client context, transcripts and requests live in your database and your ElevenLabs workspace. Handoffs are written through the Anthropic API. None of this belongs in the repo. See [SECURITY.md](./SECURITY.md).

## Architecture

```
app/
  s/[token]/              The client's call screen
  admin/                  Clients, agents, interviews, requests, calls
  api/
    session/[token]/      Public: start (push context, mint token), events (live tool calls + transcript)
    admin/                CRUD, sync, duplicate, links, reports, exports, voices
    webhooks/elevenlabs/  Optional post-call webhook
components/
  session/                Call screen, orb, useInterview hook, offline demo
  admin/                  Forms, editors, inbox, tables, report panel
lib/
  types.ts                The model: Client → Agent → Interview → Call, Requests
  prompt.ts               How conversations behave: layers, default methods, resume, voice rules
  elevenlabs.ts           ElevenAgents REST: agents, tools, tokens, conversations, webhooks
  progress.ts             Merge every call of an interview into one picture
  report.ts               The Claude-written handoff
  templates.ts            Starting points for new interviews
  public.ts               What a client's browser may see
  db/                     libSQL schema and queries
proxy.ts                  Guards /admin and /api/admin
scripts/seed.ts           Load a client from JSON
examples/                 A fictional client
```

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components) |
| React | 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Voice | ElevenLabs ElevenAgents, `@elevenlabs/react`, WebRTC, Eleven v4 Turbo |
| Handoffs | Claude Opus 5.5 via `@anthropic-ai/sdk` |
| Database | SQLite via libSQL (local file or Turso) |

## Scripts

```bash
npm run dev          # dev server on :3030
npm run build        # production build
npm start            # serve the build on :3030
npm run lint         # eslint
npm run typecheck    # route types + tsc
npm run seed -- <client.json>   # load or update a client, print share links
```

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. See [LICENSE](./LICENSE).

---

*PostScarcity AI. Unlock Abundance.*
