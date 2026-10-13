"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, AgentInput } from "@/lib/types";
import { Field, FormCard, SaveBar, VoicePicker, useSave } from "./form";

const EMPTY: AgentInput = { name: "", persona: "", voiceId: "", language: "en", extraLanguages: [], llm: "" };
const LLMS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5", "gemini-3.8-flash", "gpt-6.1-sol"];

export function AgentForm({ agent, clientId }: { agent?: Agent; clientId?: string }) {
  const router = useRouter();
  const [d, setD] = useState<AgentInput>(() => (agent ? { ...EMPTY, ...agent } : EMPTY));
  const set = <K extends keyof AgentInput>(k: K, v: AgentInput[K]) => setD((x) => ({ ...x, [k]: v }));
  const { save, saving, message } = useSave<AgentInput>(
    agent ? `/api/admin/agents/${agent.id}` : `/api/admin/clients/${clientId}/agents`,
    agent ? "PUT" : "POST",
    agent ? undefined : (data) => router.push(`/admin/agents/${(data.agent as Agent).id}`),
  );

  return (
    <div className="flex flex-col gap-6">
      <FormCard title="Agent">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint='What the agent calls itself, e.g. "Viv".'>
            <input className="field" value={d.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <VoicePicker value={d.voiceId} onChange={(v) => set("voiceId", v)} />
          <Field label="Personality and voice" hint="How it sounds and behaves in every conversation." wide>
            <textarea
              className="field min-h-28"
              value={d.persona}
              onChange={(e) => set("persona", e.target.value)}
              placeholder="Warm, direct, curious, a little playful. A sharp friend who has done this a hundred times, not a form."
            />
          </Field>
          <Field label="Language" hint="ISO code, e.g. en.">
            <input className="field" value={d.language} onChange={(e) => set("language", e.target.value)} />
          </Field>
          <Field label="Can switch to" hint="Comma-separated, e.g. es. The agent follows the client if they switch mid-call.">
            <input
              className="field"
              value={d.extraLanguages.join(", ")}
              onChange={(e) =>
                set(
                  "extraLanguages",
                  e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                )
              }
            />
          </Field>
          <Field label="LLM" hint="ElevenLabs model id. Empty uses Claude Sonnet 5.5.">
            <input className="field" list="llms" value={d.llm} placeholder="claude-sonnet-5-5" onChange={(e) => set("llm", e.target.value)} />
            <datalist id="llms">
              {LLMS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        </div>
      </FormCard>
      <SaveBar onSave={() => save(d)} saving={saving} message={message} label={agent ? "Save agent" : "Create agent"} disabled={!d.name.trim()} />
    </div>
  );
}
