"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./ui";

export function SessionTools({ id, canSync }: { id: string; canSync: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {(["md", "json", "csv"] as const).map((f) => (
          <a key={f} className={btn.secondary} href={`/api/admin/sessions/${id}/export?format=${f}`}>
            {f === "md" ? "Markdown" : f.toUpperCase()}
          </a>
        ))}
        {canSync && (
          <button
            className={btn.secondary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const res = await fetch(`/api/admin/sessions/${id}/sync`, { method: "POST" });
              const data = await res.json();
              setBusy(false);
              setMessage(
                !res.ok ? data.error : data.pending ? "ElevenLabs is still processing this call. Try again shortly." : "Refreshed.",
              );
              router.refresh();
            }}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        )}
        <button
          className={btn.danger}
          onClick={async () => {
            if (!confirm("Delete this session record? This can't be undone.")) return;
            await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
            router.back();
          }}
        >
          Delete
        </button>
      </div>
      {message && <p className="text-sm text-fg-muted">{message}</p>}
    </div>
  );
}
