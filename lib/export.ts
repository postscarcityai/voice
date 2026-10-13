import type { Interview, Session } from "./types";
import { interviewProgress } from "./progress";
import { speakerName } from "./prompt";

// Exports: Markdown for reading and sharing, JSON for pipelines, CSV (one row
// per topic) for spreadsheets. A single call, or a whole interview.

const fmtTime = (secs: number | null) =>
  secs == null ? "" : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function sessionFileBase(s: Session) {
  const { client, interview } = s.brief;
  return `${slugify(client.company || client.name)}-${slugify(interview.title)}-call-${s.callNumber}-${s.startedAt.slice(0, 10)}`;
}

export function interviewFileBase(i: Interview, clientName: string) {
  return `${slugify(clientName)}-${slugify(i.title)}`;
}

export interface AnswerRow {
  topicId: string;
  topic: string;
  status: string;
  summary: string;
  points: { text: string; kind: string }[];
  extracted: string;
}

function rows(interview: Interview, sessions: Session[]): AnswerRow[] {
  const progress = interviewProgress(interview, sessions);
  const extracted = (id: string) =>
    sessions
      .map((s) => s.extracted[id])
      .filter(Boolean)
      .join("\n\n");
  const out: AnswerRow[] = interview.topics.map((t) => {
    const st = progress.topics.find((x) => x.topicId === t.id);
    return {
      topicId: t.id,
      topic: t.title,
      status: st?.status ?? "pending",
      summary: st?.summary ?? "",
      points: st?.points ?? [],
      extracted: extracted(t.id),
    };
  });
  if (progress.general.length) {
    out.push({ topicId: "general", topic: "General", status: "", summary: "", points: progress.general, extracted: "" });
  }
  return out;
}

export const answerRows = (s: Session) => rows(s.brief.interview, [s]);

const pointLine = (p: { text: string; kind: string }) =>
  p.kind === "quote" ? `- "${p.text}"` : p.kind === "off_record" ? `- (off the record) ${p.text}` : `- ${p.text}`;

function answersMarkdown(answers: AnswerRow[]): string[] {
  const lines: string[] = [];
  for (const r of answers) {
    lines.push(`### ${r.topic}`, "");
    if (r.status) lines.push(`_Status: ${r.status}_`, "");
    if (r.summary) lines.push(r.summary, "");
    if (r.points.length) lines.push(...r.points.map(pointLine), "");
    if (r.extracted) lines.push(`> ${r.extracted.replace(/\n/g, "\n> ")}`, "");
  }
  return lines;
}

function transcriptMarkdown(s: Session): string[] {
  const { agent } = s.brief;
  return s.transcript.flatMap((t) => [
    `**${t.role === "agent" ? agent.name : speakerName(s.brief)}**${t.time != null ? ` (${fmtTime(t.time)})` : ""}: ${t.message}`,
    "",
  ]);
}

export function sessionMarkdown(s: Session): string {
  const { client, agent, interview } = s.brief;
  const lines = [
    `# ${client.name}: ${interview.title}, call ${s.callNumber}`,
    "",
    `- **With:** ${agent.name}`,
    `- **Date:** ${new Date(s.startedAt).toUTCString()}`,
    ...(s.durationSeconds ? [`- **Length:** ${fmtTime(s.durationSeconds)}`] : []),
    `- **Status:** ${s.status.replace("_", " ")}`,
    "",
  ];
  if (s.closingSummary || s.callSummary) lines.push("## Summary", "", s.closingSummary || s.callSummary || "", "");
  if (s.checklist.length) {
    lines.push("## Checklist answers", "");
    for (const c of s.checklist) lines.push(`- **${interview.checklist.find((x) => x.id === c.itemId)?.label ?? c.itemId}:** ${c.value}`);
    lines.push("");
  }
  lines.push("## Notes by topic", "", ...answersMarkdown(answerRows(s)));
  if (s.transcript.length) lines.push("## Transcript", "", ...transcriptMarkdown(s));
  return lines.join("\n");
}

export function sessionJSON(s: Session) {
  const { client, agent, interview } = s.brief;
  return {
    call: {
      id: s.id,
      number: s.callNumber,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationSeconds: s.durationSeconds,
      conversationId: s.conversationId,
    },
    client: { name: client.name, company: client.company },
    agent: agent.name,
    interview: { title: interview.title, kind: interview.kind, goal: interview.goal },
    summary: s.closingSummary,
    callSummary: s.callSummary,
    checklist: s.checklist,
    answers: answerRows(s),
    transcript: s.transcript,
  };
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

function toCSV(answers: AnswerRow[]) {
  const header = ["topic_id", "topic", "status", "summary", "quotes", "notes", "off_record", "extracted"];
  const pick = (r: AnswerRow, kind: string) => r.points.filter((p) => p.kind === kind).map((p) => p.text).join("\n");
  return [
    header.join(","),
    ...answers.map((r) =>
      [r.topicId, r.topic, r.status, r.summary, pick(r, "quote"), pick(r, "note"), pick(r, "off_record"), r.extracted]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}

export const sessionCSV = (s: Session) => toCSV(answerRows(s));

export function interviewMarkdown(interview: Interview, clientName: string, sessions: Session[]): string {
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const lines = [`# ${clientName}: ${interview.title}`, "", `${ordered.length} call${ordered.length === 1 ? "" : "s"}.`, ""];
  if (interview.reportMarkdown) lines.push("## Handoff", "", interview.reportMarkdown.replace(/^# .*\n/, ""), "");
  lines.push("## Notes by topic (all calls)", "", ...answersMarkdown(rows(interview, ordered)));
  for (const s of ordered) {
    lines.push(`## Call ${s.callNumber}: ${new Date(s.startedAt).toUTCString()}`, "");
    if (s.closingSummary) lines.push(s.closingSummary, "");
    lines.push(...transcriptMarkdown(s));
  }
  return lines.join("\n");
}

export const interviewCSV = (interview: Interview, sessions: Session[]) => toCSV(rows(interview, sessions));
