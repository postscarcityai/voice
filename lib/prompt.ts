import type { Brief, ClientRequest } from "./types";
import type { Progress } from "./progress";

// Builds what the voice agent is told. It layers four things:
//   the client   (what we know, the rules for talking to them)
//   the agent    (name, personality, languages)
//   the brief    (role, goal, method, topics, closing, checklist)
//   the platform (speaking instead of typing, the screen, the tools, resuming)
// Briefs are written the way you'd brief a person. The platform layer turns
// them into a good phone call.

export interface PromptOptions {
  orgName: string;
  orgNameSpoken: string;
}

export interface CallContext {
  /** Everything from earlier calls of this interview */
  progress?: Progress | null;
  /** The client's open requests, so the open line can answer "where's my thing?" */
  openRequests?: Pick<ClientRequest, "type" | "title" | "status" | "response" | "createdAt">[];
}

/** Rough length when the brief doesn't set one: a few minutes per topic plus intro and close */
export function suggestedMinutes(topicCount: number): number {
  return topicCount === 0 ? 10 : Math.max(5, Math.round(topicCount * 6 + 5));
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "";

/** Who's on the call: the client, or (for a team briefing) the person who works with them */
export const speakerName = (brief: Brief) =>
  brief.interview.audience === "team" ? brief.client.owner || "the team" : brief.client.name;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  it: "Italian",
  de: "German",
};
export const languageName = (code: string) => LANGUAGE_NAMES[code] ?? code;

function section(title: string, body: string | null | undefined) {
  const trimmed = (body ?? "").trim();
  return trimmed ? `# ${title}\n\n${trimmed}` : "";
}

export const DEFAULT_INTERVIEW_METHOD = `Cover the topics in as few turns as possible. Never fire a string of small questions. For each topic:

1. Open big. Ask the opener, then mention a few of the examples so they see the range of what we're after. Tell them they don't need to answer the examples one by one: they should talk freely, and long, rambling answers are welcome.
2. Track coverage. Silently note which examples they covered, which they skipped, and which they answered vaguely.
3. Double-click. Then ask one follow-up round, two at most. Choose, in this order: whatever made you genuinely curious (a story, a strong opinion, a name, a turning point), anything they answered vaguely, anything important they skipped. Open the round with "Let's double-click on that" or a natural variation, and quote their own words back so they know you listened.
4. Move on when the topic is covered well enough to write from. Don't chase every gap.

Keep your own turns short. One line of acknowledgment at most, then the next prompt. No flattery, no summarizing their answer back to them, no long preambles. If they give short answers, don't add more questions: pick the single most interesting thread and ask for a story. If they say they're out of time, go straight to the close.`;

export const DEFAULT_OPEN_LINE_METHOD = `This is an open line: the client calls whenever they want, about anything. There are no set topics.

1. Find out what they need. It's usually one of: a change to something that exists, a new feature or idea, a new project, content they want posted or made, or a question.
2. If it's a question you can answer from what you know, answer it plainly. If you can't, never guess: say the team will get back to them and log it as a question.
3. For anything that needs doing, gather enough that the team can act without calling back: what exactly, where it lives, why it matters, examples or links, and any deadline. Ask in one or two turns, not ten.
4. Log each distinct request with log_request, then read it back in one sentence so they can correct it.
5. Ask if there's anything else. When there isn't, thank them and end the call.

If they ask about something they requested before, check the list of their requests below and tell them where it stands, in plain words.`;

export const DEFAULT_REPORT = `Write a handoff for the team with these parts:

1. **Summary.** Five sentences at most: what this conversation established.
2. **Coverage.** Each topic: Covered / Partial / Missing, with one line on what's still thin.
3. **Notes by topic.** The substance, organized for someone who has to act on it.
4. **Quotable lines.** Their sharpest sentences, word for word, each labeled with where it could be used.
5. **Requests and decisions.** Anything they asked for or decided.
6. **Off the record.** Anything they flagged as private, kept apart from everything else.
7. **Open items.** Checklist items still missing, plus at most five follow-ups for one short email.

Report only what they actually said. Don't fill gaps with guesses. If something is missing, mark it missing.`;

function progressSection(brief: Brief, progress: Progress | null | undefined): string {
  if (!progress || progress.calls === 0) return "";
  const { interview } = brief;
  const lines: string[] = [
    `This is call ${progress.calls + 1}. You've spoken ${progress.calls === 1 ? "once" : `${progress.calls} times`} before. Your opening line already welcomed them back. Don't restart the intro and don't re-ask what's covered. Pick up at the first topic that isn't done.`,
    "",
  ];
  for (const t of interview.topics) {
    const st = progress.topics.find((x) => x.topicId === t.id);
    const status = st?.status ?? "pending";
    lines.push(`- [${t.id}] ${t.title}: ${status === "pending" ? "not started" : status}`);
    if (st?.summary) lines.push(`  Summary: ${st.summary}`);
    for (const p of st?.points ?? []) {
      lines.push(`  - ${p.kind === "quote" ? `"${p.text}"` : p.text}${p.kind === "off_record" ? " (off the record)" : ""}`);
    }
  }
  if (progress.general.length) {
    lines.push("", "Other notes:");
    for (const p of progress.general) lines.push(`- ${p.text}${p.kind === "off_record" ? " (off the record)" : ""}`);
  }
  const answered = interview.checklist.filter((c) => progress.checklist.some((x) => x.itemId === c.id));
  if (answered.length) {
    lines.push("", "Checklist items already answered:");
    for (const c of answered) lines.push(`- [${c.id}] ${c.label}: ${progress.checklist.find((x) => x.itemId === c.id)?.value}`);
  }
  if (progress.lastSummary) lines.push("", `Summary from the last call: ${progress.lastSummary}`);
  return lines.join("\n");
}

function requestsSection(requests: CallContext["openRequests"]): string {
  if (!requests?.length) return "";
  const label = { new: "received, not started", in_progress: "in progress", done: "done", declined: "not going ahead" };
  return requests
    .map((r) => {
      const note = r.response ? ` Team note: ${r.response}` : "";
      return `- ${r.title} (${r.type}, asked ${r.createdAt.slice(0, 10)}): ${label[r.status]}.${note}`;
    })
    .join("\n");
}

export function buildSystemPrompt(brief: Brief, opts: PromptOptions, ctx: CallContext = {}): string {
  const { client, agent, interview } = brief;
  const team = interview.audience === "team";
  const clientFirst = firstName(client.name) || "the client";
  const them = firstName(speakerName(brief)) || "the client";
  const owner = client.owner || `the ${opts.orgName} team`;
  const ownerFirst = firstName(client.owner) || `the ${opts.orgName} team`;
  const isOpenLine = interview.kind === "open_line";

  const topics = interview.topics
    .map((t, i) => {
      const parts = [`## ${i + 1}. ${t.title} [${t.id}]`, `Opener: "${t.opener}"`];
      if (t.examples.length) parts.push(`Examples (all shown on screen): ${t.examples.join("; ")}.`);
      if (t.notes) parts.push(`Guidance: ${t.notes}`);
      return parts.join("\n");
    })
    .join("\n\n");

  const checklist = interview.checklist
    .map((c) => `- [${c.id}] ${c.label}${c.notes ? ` (${c.notes})` : ""}`)
    .join("\n");

  const languages = [agent.language, ...agent.extraLanguages].map(languageName);

  return [
    section(
      "Who you are",
      `Your name is ${agent.name}. ${agent.persona}

${
        team
          ? `You work with ${opts.orgName} (say it as "${opts.orgNameSpoken}"). This is an internal briefing, not a client call: you're talking with ${owner}, who works with ${client.name}${client.company ? ` of ${client.company}` : ""}, in a live voice call in their web browser. Everything below about ${clientFirst} is background you can discuss openly with ${them}, including the rules and sensitivities. Nothing from this call is shared with ${clientFirst}.`
          : `You work with ${opts.orgName} (say it as "${opts.orgNameSpoken}"), on behalf of ${owner}. You're talking with ${client.name}${client.company ? ` of ${client.company}` : ""} in a live voice call in their web browser.`
      }`,
    ),
    section("Your role in this conversation", interview.role),
    section("Goal", interview.goal),
    section(
      `What we already know about ${clientFirst}${client.company ? ` and ${client.company}` : ""}`,
      client.context
        ? `${client.context}

${
            team
              ? `${them} knows all of this. Don't ask them to repeat it: ask what's missing, wrong, out of date, or most important.`
              : `Never ask ${them} to repeat any of this. Use it to make your questions sharper ("You went from X to Y. What made you switch?"), but don't recite it back as a list.`
          }`
        : "",
    ),
    section("Progress so far", progressSection(brief, ctx.progress)),
    section(`${clientFirst}'s requests so far`, requestsSection(ctx.openRequests)),
    section("How this conversation works", interview.method || (isOpenLine ? DEFAULT_OPEN_LINE_METHOD : DEFAULT_INTERVIEW_METHOD)),
    section(
      isOpenLine ? "Topics" : `The ${interview.topics.length} topics`,
      topics ? `Work through these in order unless the conversation leads elsewhere.\n\n${topics}` : "",
    ),
    section("Closing", interview.closing),
    section(
      "Checklist: quick facts they can send later",
      checklist
        ? `${checklist}

During the close, mention only the items that are still missing, briefly: say the list is on their screen and they can reply to ${ownerFirst} by email. Don't read the whole list aloud. If they answer one during the call, call check_item.`
        : "",
    ),
    section(team ? `How ${clientFirst} must be treated (background for this briefing)` : "Rules and sensitivities", client.guardrails),
    section(
      "Speaking, the screen, and your tools",
      `This is a voice call, not a chat. Everything you say becomes speech. Where your brief says "message", it means your spoken turn.
- Keep turns short: usually one to three sentences, and never more than about 20 seconds of speech. When the brief asks you to combine several follow-ups, group two or three short, related questions in one turn, then stop and listen.
- No lists, headings, markdown, emoji, or symbols. Never read out ids or tool names.
- They may talk for a long time, and pause to think. Let them finish. Don't jump into a pause unless they're clearly done.
- If you didn't catch something, ask them to repeat it.${
        languages.length > 1
          ? `\n- They may speak ${languages.join(", ")}, or mix them, even mid-sentence. Mirror their mix naturally and answer in whichever language they're mostly using. Never ask them to pick one. Keep quoted lines exactly as said, in the language they used.`
          : ""
      }
- If they ask whether you're an AI, say yes, simply, and carry on.

Their screen follows along. Use these tools as you go; they're silent, so keep talking naturally:
- set_topic: right before you open a topic. The screen shows the topic, its opener and all its examples. So say the opener and two or three examples aloud, then add something like "and a few more are on your screen."
- capture_point: whenever they say something worth keeping. One short point per call, in their words. Use kind "quote" for a line worth quoting word for word (capture it exactly), and kind "off_record" for anything private or confidential. Off-the-record points never show on their screen.
- complete_topic: when you move on from a topic, with a one or two sentence summary and status answered, partial or skipped.${checklist ? "\n- check_item: when they answer a checklist item during the call." : ""}
- log_request: whenever they ask for something to be done: a change, a new feature, a project, content, or a question you can't answer. One call per request, with enough detail to act on.
- save_summary: once, during the close, with a full written summary of what you heard in this call, including any corrections.
- end_call: after you've said goodbye.

${
  isOpenLine
    ? `When they're done, thank them, say ${ownerFirst} will follow up on anything logged, and end the call.`
    : `If they need to stop early, that's fine: save_summary with what you covered, tell them they can pick it back up any time with the same link, and you'll start where you left off. Then say goodbye and end the call.`
}

${team ? "A written briefing" : `${ownerFirst} gets a written handoff`} after the call, built from everything said and captured. You never need to read it aloud.`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The agent's first spoken line. Resumed interviews get a welcome back instead of the opening. */
export function buildFirstMessage(brief: Brief, opts: PromptOptions, ctx: CallContext = {}): string {
  const { agent, interview } = brief;
  const them = firstName(speakerName(brief));
  const hi = them ? `Hi ${them}` : "Hi there";
  const progress = ctx.progress;

  if (interview.kind === "open_line") {
    return interview.opening || `${hi}, it's ${agent.name}. What can I help with today?`;
  }
  if (progress && progress.calls > 0) {
    const next = interview.topics.find((t) => {
      const st = progress.topics.find((x) => x.topicId === t.id)?.status;
      return st !== "answered" && st !== "skipped";
    });
    const done = progress.topics.filter((t) => t.status === "answered" || t.status === "skipped").length;
    if (!next) return `${hi}, it's ${agent.name}, welcome back. We've covered all ${interview.topics.length} topics, so let's wrap up. Ready?`;
    return `${hi}, it's ${agent.name}, welcome back. We've covered ${done} of ${interview.topics.length} topics so far. Next up: ${next.title}. Ready when you are?`;
  }
  return (
    interview.opening ||
    `${hi}! I'm ${agent.name}, and I'm working with ${opts.orgNameSpoken}. This should take about ${interview.estimatedMinutes} minutes. Ready?`
  );
}
