import Link from "next/link";
import type { RequestStatus, RequestType, SessionStatus, TopicStatus } from "@/lib/types";

export const btn = {
  primary:
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-fg px-4 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50",
  secondary:
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50",
  ghost:
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm text-fg-muted transition hover:bg-muted hover:text-fg disabled:opacity-50",
  danger:
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-danger/40 px-3.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50",
};

export function Card({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted">{children}</h2>
      {action}
    </div>
  );
}

const TONES = {
  ok: "bg-ok/12 text-ok border-ok/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  accent: "bg-accent/12 text-accent border-accent/30",
  muted: "bg-muted text-fg-muted border-border",
  danger: "bg-danger/10 text-danger border-danger/30",
};

export function Badge({ tone = "muted", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function SessionBadge({ status }: { status: SessionStatus }) {
  if (status === "completed") return <Badge tone="ok">Completed</Badge>;
  if (status === "active") return <Badge tone="accent">Live / unfinished</Badge>;
  return <Badge tone="warn">Cut short</Badge>;
}

export function TopicBadge({ status }: { status: TopicStatus }) {
  const map: Record<TopicStatus, [keyof typeof TONES, string]> = {
    answered: ["ok", "Answered"],
    partial: ["warn", "Partial"],
    skipped: ["muted", "Skipped"],
    active: ["accent", "In progress"],
    pending: ["muted", "Not reached"],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDuration(secs: number | null) {
  if (!secs) return "";
  const m = Math.floor(secs / 60);
  return `${m}m ${String(Math.round(secs % 60)).padStart(2, "0")}s`;
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="mb-4 flex items-center gap-2 text-sm text-fg-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="opacity-50">/</span>}
          {it.href ? (
            <Link href={it.href} className="hover:text-fg">
              {it.label}
            </Link>
          ) : (
            <span className="text-fg">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, [keyof typeof TONES, string]> = {
    new: ["accent", "New"],
    in_progress: ["warn", "In progress"],
    done: ["ok", "Done"],
    declined: ["muted", "Declined"],
  };
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  change: "Change",
  feature: "Feature",
  project: "Project",
  content: "Content",
  question: "Question",
  other: "Other",
};

export function Empty({ children }: { children: React.ReactNode }) {
  return <Card className="px-5 py-8 text-center text-sm text-fg-muted">{children}</Card>;
}
