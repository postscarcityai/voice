import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MEMBER_COOKIE, memberCookieClient } from "@/lib/auth";
import { getClient } from "@/lib/db/queries";
import { clientPortal } from "@/lib/portal";
import { SignOut } from "@/components/admin/SignOut";
import { Badge, Card, Empty, RequestStatusBadge, SectionTitle, btn, fmtDate } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Your conversations", robots: { index: false } };

/**
 * A client member's own page: every conversation their agents can have with
 * them, with a button to start talking and what's been captured so far.
 * Only what the client's own call screen could show: no background context,
 * guardrails, agent guidance or anything off the record.
 */
export default function MePage() {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={<div className="mx-auto max-w-3xl px-5 py-10"><Card className="h-40 animate-pulse" /></div>}>
        <Me />
      </Suspense>
    </div>
  );
}

async function Me() {
  const clientId = await memberCookieClient((await cookies()).get(MEMBER_COOKIE)?.value);
  const client = clientId ? await getClient(clientId) : null;
  if (!client) redirect("/login?next=/me");

  const { items: cards, requests } = (await clientPortal(client.id))!;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl leading-none">{client.name}</span>
            {client.company && <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted sm:inline">{client.company}</span>}
          </div>
          <SignOut />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-serif text-4xl leading-none">Your conversations</h1>
        <p className="mt-2 text-sm text-fg-muted">Tap one to start talking. Everything you say lands back here.</p>

        <div className="mt-8 flex flex-col gap-4">
          {cards.length === 0 && <Empty>Nothing here yet. New conversations show up the moment they&apos;re made.</Empty>}
          {cards.map((item) => {
            const open = item.kind === "open_line";
            const { covered, notes } = item;
            return (
              <Card key={item.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{item.title}</h2>
                      {open ? <Badge tone="accent">Any time</Badge> : item.calls > 0 && covered === item.topicCount ? <Badge tone="ok">Done</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-fg-muted">
                      With {item.agentName}
                      {!open && ` · ${item.topicCount} topics · about ${item.estimatedMinutes} min`}
                      {item.calls > 0 && ` · ${item.calls} call${item.calls === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {item.path ? (
                    <Link href={item.path} className={btn.primary}>
                      {item.calls > 0 && !open ? "Pick up where we left off" : "Start talking"}
                    </Link>
                  ) : (
                    <span className="text-sm text-fg-muted">Not open yet</span>
                  )}
                </div>
                {!open && item.topicCount > 0 && item.calls > 0 && (
                  <p className="mt-3 text-xs text-fg-muted">
                    {covered} of {item.topicCount} topics covered
                  </p>
                )}
                {item.lastSummary && (
                  <div className="mt-4 rounded-lg bg-muted p-3 text-sm leading-relaxed">
                    <span className="font-medium">Last time: </span>
                    {item.lastSummary}
                  </div>
                )}
                {notes.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                    {notes.map((p, i) => (
                      <li key={i} className={p.kind === "quote" ? "italic" : ""}>
                        {p.kind === "quote" ? `“${p.text}”` : `· ${p.text}`}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>

        {requests.length > 0 && (
          <section className="mt-12">
            <SectionTitle>What you&apos;ve asked for</SectionTitle>
            <Card className="divide-y divide-border">
              {requests.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="font-medium">{r.title}</div>
                    {r.response && <p className="mt-1 text-sm text-fg-muted">{r.response}</p>}
                    <div className="mt-1 text-xs text-fg-muted">{fmtDate(r.createdAt)}</div>
                  </div>
                  <RequestStatusBadge status={r.status} />
                </div>
              ))}
            </Card>
          </section>
        )}
      </main>
    </>
  );
}
