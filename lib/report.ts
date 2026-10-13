import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";
import { DEFAULT_REPORT } from "./prompt";
import { listRequests, listSessions, saveInterviewReport } from "./db/queries";
import { interviewProgress } from "./progress";
import type { Brief, Session } from "./types";

// The written handoff: Claude reads every call of an interview (transcripts,
// captured points, checklist answers, requests) and writes the report the
// brief asks for. Optional: it needs ANTHROPIC_API_KEY.

const MODEL = process.env.REPORT_MODEL || "claude-opus-5-5";

export const reportsEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const clock = (secs: number | null) =>
  secs == null ? "" : `[${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}] `;

function callBlock(brief: Brief, s: Session): string {
  const { client, agent, interview } = brief;
  const title = (id: string) => interview.topics.find((t) => t.id === id)?.title ?? id;
  const lines = [`<call number="${s.callNumber}" date="${s.startedAt.slice(0, 16).replace("T", " ")} UTC" status="${s.status}">`];

  const captured = s.topics.filter((t) => t.points.length || t.summary || t.status !== "pending");
  if (captured.length) {
    lines.push("<captured_during_call>");
    for (const t of captured) {
      lines.push(`Topic "${title(t.topicId)}" (${t.status})${t.summary ? `: ${t.summary}` : ""}`);
      for (const p of t.points) lines.push(`  - [${p.kind}] ${p.text}`);
    }
    for (const c of s.checklist) {
      const label = interview.checklist.find((x) => x.id === c.itemId)?.label ?? c.itemId;
      lines.push(`Checklist "${label}": ${c.value}`);
    }
    lines.push("</captured_during_call>");
  }
  if (s.closingSummary) lines.push(`<agent_summary>${s.closingSummary}</agent_summary>`);
  lines.push("<transcript>");
  for (const t of s.transcript) lines.push(`${clock(t.time)}${t.role === "agent" ? agent.name : client.name}: ${t.message}`);
  lines.push("</transcript>", "</call>");
  return lines.join("\n");
}

export async function generateReport(brief: Brief): Promise<string> {
  const { client, agent, interview } = brief;
  const sessions = (await listSessions({ interviewId: interview.id }, 500)).sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  );
  if (!sessions.some((s) => s.transcript.length)) throw new Error("There's no conversation to report on yet.");
  const progress = interviewProgress(interview, sessions);
  const sessionIds = new Set(sessions.map((s) => s.id));
  const requests = (await listRequests({ clientId: client.id }, 200)).filter((r) => r.sessionId && sessionIds.has(r.sessionId));
  const owner = client.owner || `the ${env.orgName} team`;

  const brief_ = [
    `<client>${client.name}${client.company ? `, ${client.company}` : ""}</client>`,
    `<interview title="${interview.title}" kind="${interview.kind}">`,
    interview.goal && `<goal>${interview.goal}</goal>`,
    interview.topics.length &&
      `<topics>\n${interview.topics
        .map((t) => {
          const st = progress.topics.find((x) => x.topicId === t.id)?.status ?? "pending";
          return `- ${t.title} [status across calls: ${st}]: ${t.opener}${t.examples.length ? ` Examples: ${t.examples.join("; ")}.` : ""}`;
        })
        .join("\n")}\n</topics>`,
    interview.checklist.length &&
      `<checklist>\n${interview.checklist
        .map((c) => {
          const v = progress.checklist.find((x) => x.itemId === c.id)?.value;
          return `- ${c.label}${c.notes ? ` (${c.notes})` : ""}: ${v ? `answered: ${v}` : "not answered in a call"}`;
        })
        .join("\n")}\n</checklist>`,
    "</interview>",
    requests.length &&
      `<requests_logged>\n${requests.map((r) => `- [${r.type}, ${r.urgency}] ${r.title}: ${r.details}`).join("\n")}\n</requests_logged>`,
    `<what_we_knew_before>\n${client.context || "(nothing on file)"}\n</what_we_knew_before>`,
    client.guardrails && `<rules_and_sensitivities>\n${client.guardrails}\n</rules_and_sensitivities>`,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `You write handoff reports for ${owner} at ${env.orgName}, from voice conversations between ${client.name} and ${agent.name}, a voice agent. The transcripts come from speech recognition, so expect small transcription errors; quote carefully and fix only obvious mis-hearings.

What the handoff must contain:

${interview.report || DEFAULT_REPORT}

Write in GitHub-flavored Markdown. Use tables where the spec asks for one. Start with a level-one heading naming the client and the interview. Points marked [off_record] and anything the rules call confidential go only in an "Off the record" section, never elsewhere. Report only what was actually said; mark anything missing as missing.`;

  const user = `${brief_}

${sessions.map((s) => callBlock(brief, s)).join("\n\n")}

Write the handoff.`;

  const anthropic = new Anthropic();
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    output_config: { effort: "high" },
    // Re-run on a fallback model if the request is declined, instead of failing the report
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages: [{ role: "user", content: user }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The report request was declined. Try regenerating.");

  const markdown = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!markdown) throw new Error("The report came back empty. Try regenerating.");
  await saveInterviewReport(interview.id, markdown);
  return markdown;
}
