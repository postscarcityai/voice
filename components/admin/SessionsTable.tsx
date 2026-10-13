import Link from "next/link";
import type { SessionRow } from "@/lib/db/queries";
import { Card, Empty, SessionBadge, fmtDate, fmtDuration } from "./ui";

export function SessionsTable({ sessions, showClient = true }: { sessions: SessionRow[]; showClient?: boolean }) {
  if (sessions.length === 0) return <Empty>No calls yet. Share a link and they&apos;ll show up here.</Empty>;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            <th className="px-4 py-2.5 font-normal">Started</th>
            {showClient && <th className="px-4 py-2.5 font-normal">Client</th>}
            <th className="px-4 py-2.5 font-normal">Interview</th>
            <th className="px-4 py-2.5 font-normal">Covered</th>
            <th className="px-4 py-2.5 font-normal">Length</th>
            <th className="px-4 py-2.5 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const { client, agent, interview } = s.brief;
            const covered = s.topics.filter((t) => t.status === "answered" || t.status === "partial").length;
            return (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/sessions/${s.id}`} className="font-medium hover:text-accent">
                    {fmtDate(s.startedAt)}
                  </Link>
                </td>
                {showClient && <td className="px-4 py-2.5 text-fg-muted">{client.name}</td>}
                <td className="px-4 py-2.5 text-fg-muted">
                  {agent.name} · {interview.title}
                  {s.callNumber > 1 && <span className="font-mono text-[11px]"> · call {s.callNumber}</span>}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-fg-muted">
                  {interview.kind === "open_line" ? "–" : `${covered}/${interview.topics.length}`}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-fg-muted">{fmtDuration(s.durationSeconds) || "–"}</td>
                <td className="px-4 py-2.5">
                  <SessionBadge status={s.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
