"use client";

import { useMemo, useState } from "react";
import type { ChecklistItem, Interview, InterviewInput, Topic } from "@/lib/types";
import { DEFAULT_INTERVIEW_METHOD, DEFAULT_OPEN_LINE_METHOD, DEFAULT_REPORT, suggestedMinutes } from "@/lib/prompt";
import { Field, FormCard, SaveBar, useSave } from "./form";
import { btn } from "./ui";

const toId = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

function nextId(existing: { id: string }[], prefix: string) {
  let n = existing.length + 1;
  const ids = new Set(existing.map((x) => x.id));
  while (ids.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const autosize = "[field-sizing:content]";

export function InterviewForm({ interview }: { interview: Interview }) {
  const [d, setD] = useState<InterviewInput>(() => ({
    kind: interview.kind,
    audience: interview.audience,
    title: interview.title,
    role: interview.role,
    goal: interview.goal,
    method: interview.method,
    opening: interview.opening,
    topics: interview.topics,
    closing: interview.closing,
    checklist: interview.checklist,
    report: interview.report,
    estimatedMinutes: interview.estimatedMinutes,
    archived: interview.archived,
  }));
  const set = <K extends keyof InterviewInput>(k: K, v: InterviewInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const { save, saving, message } = useSave<InterviewInput>(`/api/admin/interviews/${interview.id}`, "PUT");
  const suggested = useMemo(() => suggestedMinutes(d.topics.length), [d.topics.length]);
  const openLine = d.kind === "open_line";

  const setTopic = (i: number, patch: Partial<Topic>) =>
    set(
      "topics",
      d.topics.map((t, j) => (j === i ? { ...t, ...patch } : t)),
    );
  const setItem = (i: number, patch: Partial<ChecklistItem>) =>
    set(
      "checklist",
      d.checklist.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    );

  return (
    <div className="flex flex-col gap-6">
      <FormCard title="Basics">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px_180px_110px]">
          <Field label="Title">
            <input className="field" value={d.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Kind">
            <select className="field" value={d.kind} onChange={(e) => set("kind", e.target.value as InterviewInput["kind"])}>
              <option value="interview">Interview (topics)</option>
              <option value="open_line">Open line (requests)</option>
            </select>
          </Field>
          <Field label="Talking to">
            <select
              className="field"
              value={d.audience}
              onChange={(e) => set("audience", e.target.value as InterviewInput["audience"])}
            >
              <option value="client">The client</option>
              <option value="team">My team (briefing)</option>
            </select>
          </Field>
          <Field label="Minutes" hint={openLine ? undefined : `Suggested: ${suggested}`}>
            <input
              className="field"
              type="number"
              min={3}
              max={120}
              value={d.estimatedMinutes || ""}
              placeholder={String(suggested)}
              onChange={(e) => set("estimatedMinutes", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="Role" hint="Who the agent is in this conversation, and on whose behalf.">
            <textarea className={`field min-h-20 ${autosize}`} value={d.role} onChange={(e) => set("role", e.target.value)} />
          </Field>
          <Field label="Goal">
            <textarea className={`field min-h-16 ${autosize}`} value={d.goal} onChange={(e) => set("goal", e.target.value)} />
          </Field>
          <Field
            label="Opening line"
            hint={
              openLine
                ? "What the agent says when it picks up. Empty: a short hello."
                : "Spoken word for word on the first call. Later calls get a welcome back instead."
            }
          >
            <textarea className={`field min-h-20 ${autosize}`} value={d.opening} onChange={(e) => set("opening", e.target.value)} />
          </Field>
          <Field label="How the conversation works" hint="Empty uses the default method shown.">
            <textarea
              className={`field min-h-28 font-mono text-[13px] ${autosize}`}
              value={d.method}
              placeholder={openLine ? DEFAULT_OPEN_LINE_METHOD : DEFAULT_INTERVIEW_METHOD}
              onChange={(e) => set("method", e.target.value)}
            />
          </Field>
        </div>
      </FormCard>

      {!openLine && (
        <FormCard
          title={`Topics · ${d.topics.length}`}
          action={
            <button
              className={btn.ghost}
              onClick={() => set("topics", [...d.topics, { id: nextId(d.topics, "topic-"), title: "", opener: "", examples: [] }])}
            >
              + Add topic
            </button>
          }
        >
          {d.topics.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">No topics yet.</p>}
          <ol className="flex flex-col gap-3">
            {d.topics.map((t, i) => (
              <li key={i} className="rounded-lg border border-border p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-fg-muted">{i + 1}</span>
                  <input
                    className="w-40 rounded border border-transparent bg-transparent px-1 font-mono text-[11px] text-fg-muted hover:border-border focus:border-accent focus:outline-none"
                    value={t.id}
                    aria-label="Topic id"
                    title="Topic id: what the agent passes to its tools. Keep it stable once calls have happened."
                    onChange={(e) => setTopic(i, { id: toId(e.target.value) })}
                  />
                  <div className="ml-auto flex">
                    <button className={btn.ghost} onClick={() => set("topics", move(d.topics, i, -1))} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button
                      className={btn.ghost}
                      onClick={() => set("topics", move(d.topics, i, 1))}
                      disabled={i === d.topics.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button className={btn.ghost} onClick={() => set("topics", d.topics.filter((_, j) => j !== i))} aria-label="Remove">
                      ✕
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
                  <input
                    className="field font-medium"
                    placeholder="Title the client sees"
                    value={t.title}
                    onChange={(e) => setTopic(i, { title: e.target.value })}
                  />
                  <textarea
                    className={`field min-h-[42px] ${autosize}`}
                    rows={1}
                    placeholder="Opener: the big question"
                    value={t.opener}
                    onChange={(e) => setTopic(i, { opener: e.target.value })}
                  />
                  <textarea
                    className={`field text-[13px] sm:col-span-2 ${autosize}`}
                    rows={2}
                    placeholder="Examples, one per line. All are shown on the client's screen; the agent says a few."
                    value={t.examples.join("\n")}
                    onChange={(e) => setTopic(i, { examples: e.target.value.split("\n") })}
                  />
                  <textarea
                    className={`field text-xs sm:col-span-2 ${autosize}`}
                    rows={1}
                    placeholder="Guidance for the agent only (optional)"
                    value={t.notes ?? ""}
                    onChange={(e) => setTopic(i, { notes: e.target.value })}
                  />
                </div>
              </li>
            ))}
          </ol>
        </FormCard>
      )}

      <FormCard title="Closing">
        <textarea
          className={`field min-h-24 ${autosize}`}
          value={d.closing}
          placeholder="Final questions to ask together, how to wrap up."
          onChange={(e) => set("closing", e.target.value)}
        />
      </FormCard>

      <FormCard
        title={`Checklist · ${d.checklist.length}`}
        action={
          <button className={btn.ghost} onClick={() => set("checklist", [...d.checklist, { id: nextId(d.checklist, "item-"), label: "" }])}>
            + Add item
          </button>
        }
      >
        <p className="mb-3 text-xs text-fg-muted">
          Quick facts the client can answer in one reply or by email. Shown on their screen at the close; the agent checks
          off anything answered during the call.
        </p>
        <ul className="flex flex-col gap-2">
          {d.checklist.map((c, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className="field" placeholder="What we need" value={c.label} onChange={(e) => setItem(i, { label: e.target.value, id: c.id || toId(e.target.value) })} />
              <input className="field text-[13px]" placeholder="Agent-only detail (optional)" value={c.notes ?? ""} onChange={(e) => setItem(i, { notes: e.target.value })} />
              <button className={btn.ghost} onClick={() => set("checklist", d.checklist.filter((_, j) => j !== i))} aria-label="Remove">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </FormCard>

      <FormCard title="Handoff report">
        <textarea
          className={`field min-h-28 font-mono text-[13px] ${autosize}`}
          value={d.report}
          placeholder={DEFAULT_REPORT}
          onChange={(e) => set("report", e.target.value)}
        />
        <p className="mt-2 text-xs text-fg-muted">
          What the written handoff should contain. Claude writes it from every call. Empty uses the default shown.
        </p>
      </FormCard>

      <SaveBar onSave={() => save(d)} saving={saving} message={message} label="Save and sync" disabled={!d.title.trim()} />
    </div>
  );
}
