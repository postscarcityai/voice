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

interface LibraryVoice {
  publicOwnerId: string;
  id: string;
  name: string;
  description: string;
  tags: string;
  languages: string[];
  previewUrl: string | null;
  uses: number;
}

/** One audio element for every preview button, so only one sample plays at a time */
let previewAudio: HTMLAudioElement | null = null;
function playPreview(url: string) {
  previewAudio?.pause();
  previewAudio = new Audio(url);
  void previewAudio.play();
}

export function VoicePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  function load() {
    fetch("/api/admin/voices")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setVoices(data.voices);
      })
      .catch((e) => setError(e.message || "Couldn't load voices"));
  }
  useEffect(load, []);

  const current = voices?.find((v) => v.id === value);
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <Field
        label="Voice"
        hint={
          error
            ? "Couldn't load your voices (is ELEVENLABS_API_KEY set?). Paste a voice id instead."
            : current?.description || "Your ElevenLabs voices. Browse the library to add more."
        }
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
            <button type="button" className={btn.secondary} aria-label="Play a sample" onClick={() => playPreview(current.previewUrl!)}>
              ▶
            </button>
          )}
          <button type="button" className={`${btn.secondary} shrink-0`} onClick={() => setBrowsing((b) => !b)}>
            {browsing ? "Close library" : "Browse library"}
          </button>
        </div>
      </Field>
      {browsing && (
        <VoiceLibrary
          onPick={(id) => {
            load();
            onChange(id);
            setBrowsing(false);
          }}
        />
      )}
    </div>
  );
}

function VoiceLibrary({ onPick }: { onPick: (voiceId: string) => void }) {
  const [filters, setFilters] = useState({ search: "", gender: "female", language: "es", accent: "", age: "" });
  const [results, setResults] = useState<LibraryVoice[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  async function search() {
    setBusy("search");
    setError(null);
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const res = await fetch(`/api/admin/voices/library?${q}`);
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error || "Search failed.");
    setResults(data.voices);
  }

  async function use(v: LibraryVoice) {
    setBusy(v.id);
    setError(null);
    const res = await fetch("/api/admin/voices/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicOwnerId: v.publicOwnerId, voiceId: v.id, name: v.name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(data.error || "Couldn't add that voice.");
    onPick(data.voiceId);
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <form
        className="grid gap-2 sm:grid-cols-[1fr_120px_90px_140px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input className="field" placeholder="Search: warm, latina, miami, bilingual…" value={filters.search} onChange={(e) => set("search", e.target.value)} />
        <select className="field" value={filters.gender} onChange={(e) => set("gender", e.target.value)} aria-label="Gender">
          <option value="">Any gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="neutral">Neutral</option>
        </select>
        <input className="field" placeholder="Lang" value={filters.language} onChange={(e) => set("language", e.target.value)} aria-label="Language code" />
        <input className="field" placeholder="Accent" value={filters.accent} onChange={(e) => set("accent", e.target.value)} aria-label="Accent" />
        <button className={btn.primary} disabled={busy === "search"}>
          {busy === "search" ? "Searching…" : "Search"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {results && results.length === 0 && <p className="mt-4 text-sm text-fg-muted">No voices match. Try fewer filters.</p>}
      {results && results.length > 0 && (
        <ul className="mt-4 flex max-h-96 flex-col divide-y divide-border overflow-y-auto">
          {results.map((v) => (
            <li key={`${v.publicOwnerId}-${v.id}`} className="flex items-start gap-3 py-3">
              <button
                type="button"
                className={btn.secondary}
                disabled={!v.previewUrl}
                aria-label={`Play ${v.name}`}
                onClick={() => v.previewUrl && playPreview(v.previewUrl)}
              >
                ▶
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{v.name}</div>
                <div className="text-xs text-fg-muted">
                  {v.tags}
                  {v.languages.length > 0 && <> · speaks {v.languages.join(", ")}</>}
                </div>
                {v.description && <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{v.description}</p>}
              </div>
              <button type="button" className={btn.primary} disabled={!!busy} onClick={() => use(v)}>
                {busy === v.id ? "Adding…" : "Use"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
