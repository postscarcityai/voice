import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { listClients, listRequests, listSessions } from "@/lib/db/queries";
import { RequestsBoard } from "@/components/admin/RequestsBoard";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { Badge, Card, SectionTitle, btn, fmtDate } from "@/components/admin/ui";

export default function AdminHome() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl leading-none">Clients</h1>
          <p className="mt-2 text-sm text-fg-muted">Everyone your voice agents talk to, and what they&apos;ve asked for.</p>
        </div>
        <Link href="/admin/clients/new" className={btn.primary}>
          New client
        </Link>
      </div>
      <Suspense fallback={<Card className="h-40 animate-pulse" />}>
        <Clients />
      </Suspense>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle action={<Link href="/admin/requests" className="text-xs text-fg-muted hover:text-fg">All requests →</Link>}>
            Open requests
          </SectionTitle>
          <Suspense fallback={<Card className="h-32 animate-pulse" />}>
            <Requests />
          </Suspense>
        </section>
        <section>
          <SectionTitle action={<Link href="/admin/sessions" className="text-xs text-fg-muted hover:text-fg">All calls →</Link>}>
            Recent calls
          </SectionTitle>
          <Suspense fallback={<Card className="h-32 animate-pulse" />}>
            <Recent />
          </Suspense>
        </section>
      </div>
    </>
  );
}

async function Clients() {
  await connection();
  const clients = await listClients();
  if (clients.length === 0) {
    return (
      <Card className="px-6 py-12 text-center">
        <p className="font-serif text-3xl">No clients yet.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          Add one here, or load a client file with <code className="font-mono">npm run seed</code>.
        </p>
        <Link href="/admin/clients/new" className={`${btn.primary} mt-6`}>
          Add your first client
        </Link>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clients.map((c) => (
        <Link key={c.id} href={`/admin/clients/${c.id}`} className="group">
          <Card className="flex h-full flex-col p-5 transition group-hover:border-accent/50">
            <div className="flex items-start justify-between gap-3">
              <div className="font-serif text-3xl leading-none">{c.name}</div>
              {c.newRequests > 0 && <Badge tone="accent">{c.newRequests} new</Badge>}
            </div>
            <div className="mt-2 text-sm text-fg-muted">{c.company || "No company set"}</div>
            <div className="mt-auto flex gap-4 pt-6 font-mono text-[11px] text-fg-muted">
              <span>
                {c.agentCount} agent{c.agentCount === 1 ? "" : "s"}
              </span>
              <span>
                {c.callCount} call{c.callCount === 1 ? "" : "s"}
              </span>
              <span className="ml-auto">{c.lastCallAt ? `Last call ${fmtDate(c.lastCallAt)}` : "No calls yet"}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

async function Requests() {
  await connection();
  return <RequestsBoard requests={await listRequests({ openOnly: true }, 8)} showClient />;
}

async function Recent() {
  await connection();
  return <SessionsTable sessions={await listSessions({}, 8)} />;
}
