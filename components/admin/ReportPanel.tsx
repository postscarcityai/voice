"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Markdown } from "./Markdown";
import { Card, btn, fmtDate } from "./ui";

export function ReportPanel({
  interviewId,
  markdown,
  generatedAt,
  enabled,
  hasCalls,
}: {
  interviewId: string;
  markdown: string | null;
  generatedAt: string | null;
  enabled: boolean;
  hasCalls: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/interviews/${interviewId}/report`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(data.error || "Couldn't generate the report.");
    router.refresh();
  }

  return (
    <Card className="p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-fg-muted">
          {generatedAt
            ? `Written by Claude from every call · ${fmtDate(generatedAt)}`
            : enabled
              ? "Written by Claude from every call. It refreshes after each call."
              : "Set ANTHROPIC_API_KEY to have Claude write a handoff after each call."}
        </p>
        <div className="flex gap-2">
          {markdown && (
            <a className={btn.secondary} href={`/api/admin/interviews/${interviewId}/export?format=report`}>
              Download
            </a>
          )}
          {enabled && (
            <button className={btn.primary} onClick={generate} disabled={busy || !hasCalls}>
              {busy ? "Writing… (a minute or two)" : markdown ? "Regenerate" : "Write handoff"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {markdown ? (
        <Markdown>{markdown}</Markdown>
      ) : (
        <p className="py-6 text-center text-sm text-fg-muted">
          {hasCalls ? "No handoff yet." : "The handoff appears here after the first call."}
        </p>
      )}
    </Card>
  );
}
