import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { LoginForm } from "@/components/admin/LoginForm";
import { magicLinkEnabled } from "@/lib/magic-link";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted">PostScarcity AI</div>
        <h1 className="mt-2 font-serif text-5xl">Voice</h1>
        <p className="mt-2 text-sm text-fg-muted">Admin sign in.</p>
        <Suspense>
          <Methods />
        </Suspense>
      </div>
    </main>
  );
}

async function Methods() {
  await connection();
  return <LoginForm email={magicLinkEnabled()} password={Boolean(process.env.ADMIN_PASSWORD)} />;
}
