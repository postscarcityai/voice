"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Client, ClientInput } from "@/lib/types";
import { Field, FormCard, SaveBar, TextWithFiles, useSave } from "./form";

const EMPTY: ClientInput = { name: "", company: "", owner: "", context: "", guardrails: "" };

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [d, setD] = useState<ClientInput>(() => (client ? { ...EMPTY, ...client } : EMPTY));
  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const { save, saving, message } = useSave<ClientInput>(
    client ? `/api/admin/clients/${client.id}` : "/api/admin/clients",
    client ? "PUT" : "POST",
    client ? undefined : (data) => router.push(`/admin/clients/${(data.client as Client).id}`),
  );

  return (
    <div className="flex flex-col gap-6">
      <FormCard title="Client">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" hint="The person agents talk to.">
            <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Alex Rivera" />
          </Field>
          <Field label="Company">
            <input className="field" value={d.company} onChange={(e) => set("company", e.target.value)} />
          </Field>
          <Field label="Works with" hint="Who on your team agents speak for.">
            <input className="field" value={d.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Sam Lee" />
          </Field>
        </div>
      </FormCard>

      <FormCard title="What we already know">
        <TextWithFiles
          value={d.context}
          onChange={(v) => set("context", v)}
          placeholder="Background, history, what they've already shared, positioning, references. Every agent and interview for this client treats this as shared history: never asks for it again, and builds on it."
        />
      </FormCard>

      <FormCard title="Rules and sensitivities">
        <textarea
          className="field min-h-40 font-mono text-[13px] leading-relaxed"
          value={d.guardrails}
          onChange={(e) => set("guardrails", e.target.value)}
          placeholder="Confidential topics, claims never to make, how to handle past work, languages, tone. Applies to every conversation with this client."
        />
      </FormCard>

      <SaveBar
        onSave={() => save(d)}
        saving={saving}
        message={message}
        label={client ? "Save client" : "Create client"}
        disabled={!d.name.trim()}
      />
    </div>
  );
}
