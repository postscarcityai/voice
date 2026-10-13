"use client";

import { useEffect, useState } from "react";
import { ConversationProvider } from "@elevenlabs/react";
import type { PublicBrief } from "@/lib/public";
import type { Point } from "@/lib/types";
import { Orb } from "./Orb";
import { useInterview, type RequestView, type TopicView } from "./useInterview";

interface Props {
  token: string;
  brief: PublicBrief;
  demo?: boolean;
}

export function Interview(props: Props) {
  return (
    <ConversationProvider>
      <Stage {...props} />
    </ConversationProvider>
  );
}

type IV = ReturnType<typeof useInterview>;

const REQUEST_LABEL: Record<string, string> = {
  change: "Change",
  feature: "Feature",
  project: "Project",
  content: "Content",
  question: "Question",
  other: "Request",
};

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.2em]";

function Stage({ token, brief, demo }: Props) {
  const iv = useInterview(token, brief, { demo });
  const [captions, setCaptions] = useState(false);
  const live = iv.phase === "live";
  const openLine = brief.kind === "open_line";

  return (
    <main className="stage relative flex min-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <Backdrop />

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
        <div className={`${eyebrow} text-fg-muted`}>
          <span className="text-fg">{brief.agentName}</span> <span className="opacity-60">·</span> {brief.orgName}
        </div>
        {live && (
          <div className={`flex items-center gap-4 ${eyebrow} text-fg-muted`}>
            <Elapsed since={iv.startedAt} />
            {!openLine && (
              <span>
                {iv.progress.done}/{iv.progress.total}
                <span className="hidden sm:inline"> topics</span>
              </span>
            )}
          </div>
        )}
      </header>

      {live && !openLine && <Progress topics={iv.topics} />}

      {iv.phase === "ready" || iv.phase === "connecting" || iv.phase === "error" ? (
        <Welcome brief={brief} iv={iv} />
      ) : iv.phase === "ended" ? (
        <Ended brief={brief} iv={iv} />
      ) : (
        <div
          className={`relative z-10 mx-auto grid w-full flex-1 gap-8 px-5 pb-32 pt-4 sm:px-8 lg:gap-12 ${
            openLine && !iv.general.length ? "max-w-3xl" : "max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px]"
          }`}
        >
          <section className="flex flex-col items-center text-center lg:pt-2">
            <div className="aspect-square w-[min(52vw,240px)]">
              <Orb
                active
                speaking={iv.isSpeaking}
                getOutputVolume={iv.getOutputVolume}
                getInputVolume={iv.getInputVolume}
              />
            </div>
            <p className={`${eyebrow} -mt-2 text-fg-muted`} aria-live="polite">
              {iv.isSpeaking ? `${brief.agentName} is speaking` : iv.isMuted ? "You're muted" : "Listening"}
            </p>

            <div className="mt-8 w-full max-w-2xl">
              {openLine ? (
                <OpenLineCenter brief={brief} requests={iv.requests} />
              ) : iv.current ? (
                <TopicCard
                  key={iv.current.id}
                  topic={iv.current}
                  index={brief.topics.findIndex((t) => t.id === iv.current!.id)}
                  total={brief.topics.length}
                />
              ) : (
                <h1 className="fade-in font-serif text-4xl italic leading-[1.05] text-fg-muted sm:text-5xl">
                  {iv.progress.done === 0
                    ? "Getting started"
                    : iv.progress.done === iv.progress.total
                      ? "Wrapping up"
                      : "Just talking"}
                </h1>
              )}
            </div>

            {captions && iv.caption && (
              <p className="mt-8 max-w-xl text-balance text-sm leading-relaxed text-fg-muted" aria-live="polite">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg">
                  {iv.caption.role === "agent" ? brief.agentName : "You"}
                </span>{" "}
                {iv.caption.text}
              </p>
            )}
          </section>

          <aside className="flex flex-col gap-6">
            {!openLine && (
              <KeyPoints topic={iv.current} topics={iv.topics} general={iv.general} owner={brief.ownerFirstName} />
            )}
            {openLine && iv.general.length > 0 && <PointList title="Noted" points={iv.general} />}
            {!openLine &&
              brief.checklist.length > 0 &&
              (iv.progress.done === iv.progress.total || iv.checked.length > 0) && (
                <Checklist brief={brief} checked={iv.checked} />
              )}
            {!openLine && <TopicList topics={iv.topics} currentId={iv.current?.id ?? null} />}
          </aside>
        </div>
      )}

      {live && (
        <footer className="fixed inset-x-0 bottom-0 z-20 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/80 p-1.5 backdrop-blur-md">
            <ControlButton
              onClick={() => iv.setMuted(!iv.isMuted)}
              pressed={iv.isMuted}
              label={iv.isMuted ? "Unmute" : "Mute"}
            >
              {iv.isMuted ? <MicOffIcon /> : <MicIcon />}
            </ControlButton>
            <ControlButton onClick={() => setCaptions((c) => !c)} pressed={captions} label="Captions">
              <span className="font-mono text-[11px] font-semibold">CC</span>
            </ControlButton>
            <button
              onClick={() => {
                const ask = openLine
                  ? `Hang up with ${brief.agentName}?`
                  : "End the call? You can pick it back up later with this link.";
                if (confirm(ask)) iv.end();
              }}
              className="ml-1 h-11 rounded-full bg-[#c2412d] px-5 text-sm font-medium text-white transition hover:bg-[#a83725]"
            >
              End
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}

function TopicCard({ topic, index, total }: { topic: TopicView; index: number; total: number }) {
  return (
    <div className="fade-in">
      <div className={`${eyebrow} text-accent`}>
        Topic {index + 1} of {total}
      </div>
      <h1 className="mt-3 font-serif text-4xl leading-[1.05] sm:text-5xl">{topic.title}</h1>
      {topic.opener && (
        <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-snug text-fg/85 sm:text-xl">{topic.opener}</p>
      )}
      {topic.examples.length > 0 && (
        <div className="mt-6">
          <div className={`${eyebrow} text-fg-muted`}>For example</div>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {topic.examples.map((e, i) => (
              <li
                key={e}
                className="point-in rounded-full border border-border bg-surface/50 px-3 py-1.5 text-[13px] leading-snug text-fg/80"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {e}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-fg-muted">No need to go one by one. Talk freely.</p>
        </div>
      )}
    </div>
  );
}

function OpenLineCenter({ brief, requests }: { brief: PublicBrief; requests: RequestView[] }) {
  const owner = brief.ownerFirstName ?? "the team";
  if (!requests.length) {
    return (
      <div className="fade-in">
        <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl">What&apos;s on your mind?</h1>
        <p className="mx-auto mt-4 max-w-md text-balance text-fg-muted">
          A question, a change, a new idea, something to post. {brief.agentName} will log it for {owner}.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className={`${eyebrow} text-accent`}>Logged for {owner}</div>
      <ul className="mx-auto mt-4 flex max-w-lg flex-col gap-2 text-left">
        {requests.map((r) => (
          <li key={r.id} className="point-in flex items-start gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3">
            <span className="mt-0.5 rounded-full border border-accent/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              {REQUEST_LABEL[r.type]}
            </span>
            <span className="text-[15px] leading-snug">{r.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PointItem({ p }: { p: Point }) {
  if (p.kind === "quote") {
    return (
      <li className="point-in font-serif text-lg italic leading-snug">
        <span className="text-accent">“</span>
        {p.text}
        <span className="text-accent">”</span>
      </li>
    );
  }
  return (
    <li className="point-in flex gap-2.5 text-[15px] leading-snug">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>{p.text}</span>
    </li>
  );
}

function PointList({ title, points }: { title: string; points: Point[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 backdrop-blur-sm">
      <div className={`${eyebrow} text-fg-muted`}>{title}</div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {points.map((p) => (
          <PointItem key={p.text} p={p} />
        ))}
      </ul>
    </div>
  );
}

function KeyPoints({
  topic,
  topics,
  general,
  owner,
}: {
  topic: TopicView | null;
  topics: TopicView[];
  general: Point[];
  owner: string | null;
}) {
  // The current topic's points; between topics, the most recent ones overall
  const points = topic ? topic.points : [...topics.flatMap((t) => t.points), ...general].slice(-6);
  const privateCount = topic ? topic.privateCount : topics.reduce((n, t) => n + t.privateCount, 0);
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 backdrop-blur-sm">
      <div className={`${eyebrow} text-fg-muted`}>{topic ? "Key points" : "Captured so far"}</div>
      {points.length === 0 && !privateCount ? (
        <p className="mt-3 text-sm italic text-fg-muted/70">Notes appear here as you talk.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {points.map((p) => (
            <PointItem key={p.text} p={p} />
          ))}
        </ul>
      )}
      {privateCount > 0 && (
        <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-fg-muted">
          <LockIcon />
          {privateCount} {privateCount === 1 ? "note" : "notes"} kept private, just for {owner ?? "the team"}
        </p>
      )}
    </div>
  );
}

function Checklist({ brief, checked }: { brief: PublicBrief; checked: string[] }) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-5">
      <div className={`${eyebrow} text-accent`}>Quick facts for {brief.ownerFirstName ?? "the team"}</div>
      <p className="mt-1.5 text-xs text-fg-muted">Answer now, or reply by email later.</p>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {brief.checklist.map((c) => {
          const done = checked.includes(c.id);
          return (
            <li key={c.id} className={`flex gap-2.5 ${done ? "text-fg-muted line-through decoration-fg/30" : ""}`}>
              <span
                className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                  done ? "border-ok/60 text-ok" : "border-border"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              {c.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Welcome({ brief, iv }: { brief: PublicBrief; iv: IV }) {
  const connecting = iv.phase === "connecting";
  const openLine = brief.kind === "open_line";
  const resuming = !openLine && Boolean(brief.progress);
  const next = resuming ? iv.topics.find((t) => t.status !== "answered" && t.status !== "skipped") : null;
  const them = brief.clientFirstName;
  const owner = brief.ownerFirstName ?? "the team";

  const body = openLine
    ? `${brief.agentName} is your line to ${owner} at ${brief.orgName}. Ask a question, request a change, pitch an idea or send something to post. Just talk.`
    : resuming
      ? `${iv.progress.done} of ${iv.progress.total} topics done.${next ? ` ${brief.agentName} will pick up at “${next.title}”.` : ""}`
      : `${brief.agentName} is a voice agent working with ${brief.orgName}. ${brief.title}: about ${brief.estimatedMinutes} minutes, and you can stop and pick it back up whenever you want.`;

  const cta = connecting
    ? "Connecting…"
    : iv.phase === "error"
      ? "Try again"
      : resuming
        ? "Continue"
        : openLine
          ? `Call ${brief.agentName}`
          : "Start the conversation";

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
      <div className="aspect-square w-[min(56vw,240px)]">
        <Orb active={false} speaking={connecting} />
      </div>
      <h1 className="mt-4 font-serif text-5xl leading-[1.02] sm:text-6xl">
        {resuming ? `Welcome back${them ? `, ${them}` : ""}.` : them ? `Hi ${them}.` : "Hello."}
        <br />
        <span className="italic text-fg-muted">
          {openLine ? `Talk to ${brief.agentName}.` : resuming ? "Let's pick up." : `Meet ${brief.agentName}.`}
        </span>
      </h1>
      <p className="mt-6 max-w-md text-balance text-[15px] leading-relaxed text-fg-muted">{body}</p>

      {!openLine && !resuming && (
        <ul className="mt-8 flex max-w-md flex-wrap justify-center gap-2 text-[13px] text-fg-muted">
          {["Find a quiet spot", "Headphones help", "Long answers welcome", 'Say "skip" anytime'].map((tip) => (
            <li key={tip} className="rounded-full border border-border px-3 py-1.5">
              {tip}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={iv.start}
        disabled={connecting}
        className="mt-10 inline-flex h-14 items-center gap-3 rounded-full bg-accent px-8 text-base font-medium text-accent-fg shadow-[0_0_60px_-10px_rgba(240,138,62,0.7)] transition hover:brightness-110 disabled:opacity-70"
      >
        <MicIcon />
        {cta}
      </button>

      {iv.error && (
        <p role="alert" className="mt-5 max-w-md text-sm text-[#f3a08f]">
          {iv.error}
        </p>
      )}

      <p className="mt-10 max-w-md text-xs leading-relaxed text-fg-muted/80">
        Your browser will ask to use your microphone. The conversation is recorded and transcribed for the {brief.orgName}{" "}
        team. {brief.agentName} is an AI.
      </p>
    </div>
  );
}

function Ended({ brief, iv }: { brief: PublicBrief; iv: IV }) {
  const them = brief.clientFirstName;
  const owner = brief.ownerFirstName ?? "the team";
  const openLine = brief.kind === "open_line";
  const missing = brief.checklist.filter((c) => !iv.checked.includes(c.id));
  const finished = iv.progress.done === iv.progress.total;

  const body = openLine
    ? iv.requests.length
      ? `${owner} has your ${iv.requests.length === 1 ? "request" : `${iv.requests.length} requests`} and will follow up. Call again anytime with this same link.`
      : "Call again anytime with this same link."
    : finished && !iv.endedEarly
      ? `That's everything. ${owner} will take it from here. You can close this tab.`
      : `Everything so far is saved. Open this same link whenever you're ready and ${brief.agentName} will pick up where you left off.`;

  return (
    <div className="fade-in relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
      <h1 className="font-serif text-5xl leading-[1.02] sm:text-6xl">Thank you{them ? `, ${them}` : ""}.</h1>
      <p className="mt-6 max-w-md text-balance text-[15px] leading-relaxed text-fg-muted">{body}</p>

      {openLine && iv.requests.length > 0 && (
        <div className="mt-8 w-full max-w-md">
          <OpenLineCenter brief={brief} requests={iv.requests} />
        </div>
      )}

      {!openLine && missing.length > 0 && (
        <div className="mt-10 w-full max-w-md text-left">
          <Checklist brief={brief} checked={iv.checked} />
        </div>
      )}
    </div>
  );
}

function TopicList({ topics, currentId }: { topics: TopicView[]; currentId: string | null }) {
  return (
    <ol className="flex flex-col">
      {topics.map((t, i) => {
        const current = t.id === currentId;
        const done = t.status === "answered" || t.status === "partial";
        return (
          <li
            key={t.id}
            className={`flex gap-3 border-b border-border py-2.5 text-sm last:border-0 ${current ? "text-fg" : "text-fg-muted"}`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                current ? "border-accent bg-accent text-accent-fg" : done ? "border-ok/60 text-ok" : "border-border"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`leading-snug ${t.status === "skipped" ? "line-through opacity-60" : ""}`}>{t.title}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Progress({ topics }: { topics: TopicView[] }) {
  return (
    <div className="relative z-10 mx-5 mt-4 flex gap-1 sm:mx-8" aria-hidden>
      {topics.map((t) => (
        <div
          key={t.id}
          className={`h-[3px] flex-1 rounded-full transition-colors duration-700 ${
            t.status === "answered" || t.status === "partial"
              ? "bg-fg/80"
              : t.status === "active"
                ? "bg-accent"
                : t.status === "skipped"
                  ? "bg-fg/25"
                  : "bg-fg/10"
          }`}
        />
      ))}
    </div>
  );
}

function Elapsed({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since) return null;
  const sec = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span>
      {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
    </span>
  );
}

function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(60% 50% at 50% 30%, rgba(240,138,62,0.10), transparent 70%), radial-gradient(40% 40% at 85% 90%, rgba(245,239,226,0.05), transparent 70%)",
      }}
    />
  );
}

function ControlButton({
  children,
  onClick,
  pressed,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pressed: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
        pressed ? "bg-fg text-bg" : "text-fg hover:bg-fg/10"
      }`}
    >
      {children}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.7 3M12 18v3M3 3l18 18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
