"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm({ email: emailEnabled, password: passwordEnabled }: { email: boolean; password: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [mode, setMode] = useState<"email" | "password">(emailEnabled ? "email" : "password");
  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "That link expired or was already used. Send yourself a new one." : null,
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(mode === "email" ? "/api/auth/magic-link" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mode === "email" ? { email: value, next } : { password: value }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Couldn't sign in.");
      return;
    }
    if (mode === "email") {
      setSentTo(value.trim());
      return;
    }
    router.replace(next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  if (!emailEnabled && !passwordEnabled) {
    return <p className="mt-8 text-sm text-danger">No sign-in method is configured. Set ADMIN_EMAILS (with Supabase) or ADMIN_PASSWORD.</p>;
  }

  if (sentTo) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-surface p-5">
        <p className="font-medium">Check your inbox.</p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          If {sentTo} is an admin address, a sign-in link is on its way. It works on any device and expires in an hour.
        </p>
        <button className="mt-4 text-sm text-fg-muted underline hover:text-fg" onClick={() => setSentTo(null)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="credential">
        {mode === "email" ? "Email" : "Password"}
      </label>
      <input
        id="credential"
        type={mode === "email" ? "email" : "password"}
        autoComplete={mode === "email" ? "email" : "current-password"}
        autoFocus
        className="field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        disabled={busy || !value}
        className="mt-2 h-10 rounded-lg bg-fg text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? (mode === "email" ? "Sending…" : "Signing in…") : mode === "email" ? "Email me a sign-in link" : "Sign in"}
      </button>
      {emailEnabled && passwordEnabled && (
        <button
          type="button"
          className="text-left text-xs text-fg-muted underline hover:text-fg"
          onClick={() => {
            setMode(mode === "email" ? "password" : "email");
            setValue("");
            setError(null);
          }}
        >
          {mode === "email" ? "Use a password instead" : "Email me a link instead"}
        </button>
      )}
    </form>
  );
}
