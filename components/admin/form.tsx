"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SectionTitle, btn } from "./ui";

export function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-fg-muted">{hint}</span>}
    </label>
  );
}

export function FormCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </Card>
  );
}

/** Save a draft to the API, then refresh or navigate. Reports sync problems without blocking the save. */
export function useSave<T>(url: string, method: "POST" | "PUT", onSaved?: (data: Record<string, unknown>) => void) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(draft: T) {
    setSaving(true);
    setMessage(null);
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: data.error || "Couldn't save." });
      return;
    }
    setMessage(
      data.syncError
        ? { ok: false, text: `Saved. ElevenLabs sync failed: ${data.syncError}` }
        : { ok: true, text: "Saved." },
    );
    if (onSaved) onSaved(data);
    else router.refresh();
  }
  return { save, saving, message };
}

export function SaveBar({
  onSave,
  saving,
  message,
  label = "Save changes",
  disabled,
}: {
  onSave: () => void;
  saving: boolean;
  message: { ok: boolean; text: string } | null;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-5 flex flex-wrap items-center gap-3 border-t border-border bg-bg/90 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8">
      <button className={btn.primary} onClick={onSave} disabled={saving || disabled}>
        {saving ? "Saving…" : label}
      </button>
      {message && <p className={`text-sm ${message.ok ? "text-ok" : "text-danger"}`}>{message.text}</p>}
    </div>
  );
}

/** A textarea that can append text files (notes, docs, transcripts) */
export function TextWithFiles({
  value,
  onChange,
  placeholder,
  className = "min-h-56",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const file = useRef<HTMLInputElement>(null);
  async function addFiles(files: FileList | null) {
    if (!files) return;
    let next = value;
    for (const f of Array.from(files)) next = `${next.trim()}\n\n## From ${f.name}\n\n${(await f.text()).trim()}`.trim();
    onChange(next);
  }
  return (
    <div>
      <textarea
        className={`field font-mono text-[13px] leading-relaxed ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className="mt-1.5 flex items-center justify-between text-xs text-fg-muted">
        <span>{value.length.toLocaleString()} characters</span>
        <button type="button" className="hover:text-fg" onClick={() => file.current?.click()}>
          + Add text files
        </button>
        <input
          ref={file}
          type="file"
          multiple
          accept=".txt,.md,.markdown,.csv,.json,text/*"
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

interface Voice {
  id: string;
  name: string;
  description: string;
  previewUrl: string | null;
}

export function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/admin/voices")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setVoices(data.voices);
      })
      .catch((e) => setError(e.message || "Couldn't load voices"));
  }, []);

  const current = voices?.find((v) => v.id === value);
  return (
    <Field
      label="Voice"
      hint={error ? "Couldn't load your voices (is ELEVENLABS_API_KEY set?). Paste a voice id instead." : current?.description || "From your ElevenLabs voice library."}
    >
      <div className="flex gap-2">
        {voices && !error ? (
          <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Default voice</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
            {value && !current && <option value={value}>{value}</option>}
          </select>
        ) : (
          <input
            className="field"
            value={value}
            placeholder={voices === null && !error ? "Loading voices…" : "Voice id"}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {current?.previewUrl && (
          <button
            type="button"
            className={btn.secondary}
            aria-label="Play a sample"
            onClick={() => {
              audio.current?.pause();
              audio.current = new Audio(current.previewUrl!);
              void audio.current.play();
            }}
          >
            ▶
          </button>
        )}
      </div>
    </Field>
  );
}

/** Small buttons that call an endpoint, then refresh or go somewhere */
export function ActionButton({
  url,
  method = "POST",
  body,
  confirmText,
  children,
  className = btn.secondary,
  go,
}: {
  url: string;
  method?: string;
  body?: unknown;
  confirmText?: string;
  children: React.ReactNode;
  className?: string;
  /** Where to go after success. ":id" becomes the id of whatever the endpoint returned. */
  go?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirmText && !confirm(confirmText)) return;
          setBusy(true);
          setError(null);
          const res = await fetch(url, {
            method,
            headers: body ? { "content-type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) {
            setError(data.error || "Something went wrong.");
            return;
          }
          if (go) {
            const created = (data.interview ?? data.agent ?? data.client) as { id?: string } | undefined;
            router.push(go.replace(":id", created?.id ?? ""));
          }
          router.refresh();
        }}
      >
        {busy ? "…" : children}
      </button>
      {error && <span className="mt-1 max-w-xs text-right text-xs text-danger">{error}</span>}
    </span>
  );
}
