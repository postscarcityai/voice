"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { SessionLink } from "@/lib/types";
import { Badge, Card, SectionTitle, btn, fmtDate } from "./ui";

const noop = () => () => {};

export function LinkManager({
  interviewId,
  links,
  defaultLabel,
  publicUrl,
}: {
  interviewId: string;
  links: SessionLink[];
  defaultLabel: string;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(defaultLabel);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = useSyncExternalStore(
    noop,
    () => publicUrl ?? window.location.origin,
    () => publicUrl ?? "",
  );

  const url = (l: SessionLink) => `${origin}/s/${l.token}`;

  async function create() {
    setBusy(true);
    const res = await fetch(`/api/admin/interviews/${interviewId}/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusy(false);
    if (res.ok) {
      const { link } = await res.json();
      await navigator.clipboard?.writeText(url(link)).catch(() => {});
      setCopied(link.id);
      router.refresh();
    }
  }

  async function toggle(l: SessionLink) {
    if (!l.revoked && !confirm("Turn this link off? Anyone who opens it will see that it's no longer active.")) return;
    await fetch(`/api/admin/links/${l.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revoked: !l.revoked }),
    });
    router.refresh();
  }

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Share links</SectionTitle>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="field"
          placeholder="Label, e.g. the client's name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className={`${btn.primary} shrink-0`} onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create link"}
        </button>
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        Anyone with a link can talk to this agent, so send it only to the client. Every call on this interview
        picks up where the last one left off, whichever link it came from. New links are copied to your clipboard.
      </p>

      {links.length > 0 && (
        <ul className="mt-5 flex flex-col divide-y divide-border">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {l.label || "Untitled link"}
                  {l.revoked && <Badge tone="danger">Off</Badge>}
                </div>
                <div className="truncate font-mono text-xs text-fg-muted">{url(l)}</div>
              </div>
              <span className="font-mono text-[11px] text-fg-muted">
                {l.sessionCount ?? 0} sessions · {fmtDate(l.createdAt)}
              </span>
              <div className="flex gap-1">
                <button
                  className={btn.ghost}
                  disabled={l.revoked}
                  onClick={async () => {
                    await navigator.clipboard.writeText(url(l));
                    setCopied(l.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                >
                  {copied === l.id ? "Copied" : "Copy"}
                </button>
                <a className={btn.ghost} href={url(l)} target="_blank" rel="noreferrer">
                  Open
                </a>
                <button className={btn.ghost} onClick={() => toggle(l)}>
                  {l.revoked ? "Turn on" : "Turn off"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
