"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RequestRow } from "@/lib/db/queries";
import type { RequestStatus } from "@/lib/types";
import { Badge, Card, Empty, REQUEST_TYPE_LABEL, RequestStatusBadge, fmtDate } from "./ui";

const STATUSES: { id: RequestStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
  { id: "declined", label: "Declined" },
];

export function RequestsBoard({ requests, showClient = false }: { requests: RequestRow[]; showClient?: boolean }) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const shown = filter === "open" ? requests.filter((r) => r.status === "new" || r.status === "in_progress") : requests;

  return (
    <div>
      <div className="mb-3 flex gap-1 text-sm">
        {(["open", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-2.5 py-1 ${filter === f ? "bg-muted text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {f === "open" ? "Open" : "All"}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty>
          {filter === "open" ? "Nothing open. " : ""}Requests appear here when a client asks for something on a call.
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((r) => (
            <RequestCard key={r.id} r={r} showClient={showClient} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ r, showClient }: { r: RequestRow; showClient: boolean }) {
  const router = useRouter();
  const [response, setResponse] = useState(r.response);
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, string>) {
    setSaving(true);
    await fetch(`/api/admin/requests/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{REQUEST_TYPE_LABEL[r.type]}</Badge>
            {r.urgency === "high" && <Badge tone="danger">Urgent</Badge>}
            <RequestStatusBadge status={r.status} />
            <span className="font-mono text-[11px] text-fg-muted">
              {showClient && (
                <>
                  <Link href={`/admin/clients/${r.clientId}`} className="hover:text-fg">
                    {r.clientName}
                  </Link>{" "}
                  ·{" "}
                </>
              )}
              {fmtDate(r.createdAt)}
              {r.sessionId && (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/admin/sessions/${r.sessionId}`} className="hover:text-fg">
                    call
                  </Link>
                </>
              )}
            </span>
          </div>
          <h3 className="mt-2 font-medium leading-snug">{r.title}</h3>
          {r.details && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{r.details}</p>}
        </div>
        <select
          className="field w-auto py-1.5 text-sm"
          value={r.status}
          disabled={saving}
          onChange={(e) => patch({ status: e.target.value })}
          aria-label="Status"
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="field text-sm"
          placeholder="Note for the client (the open line reads this back if they ask)"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
        {response !== r.response && (
          <button className="shrink-0 rounded-lg bg-fg px-3 text-sm font-medium text-bg" disabled={saving} onClick={() => patch({ response })}>
            Save
          </button>
        )}
      </div>
    </Card>
  );
}
