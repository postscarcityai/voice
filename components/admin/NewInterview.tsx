"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./ui";

interface Template {
  id: string;
  name: string;
  description: string;
}

/** Start an interview from a template; it opens in the editor to tailor */
export function NewInterview({ agentId, templates }: { agentId: string; templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function create(template: string) {
    setBusy(template);
    const res = await fetch(`/api/admin/agents/${agentId}/interviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) router.push(`/admin/interviews/${data.interview.id}`);
  }

  if (!open) {
    return (
      <button className={btn.secondary} onClick={() => setOpen(true)}>
        New interview
      </button>
    );
  }
  return (
    <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">
      {[...templates, { id: "blank", name: "Blank", description: "Start from nothing." }].map((t) => (
        <button
          key={t.id}
          disabled={!!busy}
          onClick={() => create(t.id)}
          className="rounded-lg border border-border bg-surface p-4 text-left transition hover:border-accent/60 disabled:opacity-50"
        >
          <div className="font-medium">{busy === t.id ? "Creating…" : t.name}</div>
          <div className="mt-1 text-xs leading-relaxed text-fg-muted">{t.description}</div>
        </button>
      ))}
      <button className={`${btn.ghost} sm:col-span-2`} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
