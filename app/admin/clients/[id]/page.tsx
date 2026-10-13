import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient, listAgents, listInterviews, listRequests, listSessions } from "@/lib/db/queries";
import { TEMPLATES } from "@/lib/templates";
import { ClientForm } from "@/components/admin/ClientForm";
import { ActionButton } from "@/components/admin/form";
import { NewInterview } from "@/components/admin/NewInterview";
import { RequestsBoard } from "@/components/admin/RequestsBoard";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { Badge, Card, Crumbs, SectionTitle, btn, fmtDate } from "@/components/admin/ui";

type Props = PageProps<"/admin/clients/[id]">;

export default function ClientPage({ params }: Props) {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
      <ClientDetail params={params} />
    </Suspense>
  );
}

const templates = TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));

async function ClientDetail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const agents = await listAgents(id);
  const [interviews, requests, sessions] = await Promise.all([
    Promise.all(agents.map((a) => listInterviews(a.id))),
    listRequests({ clientId: id }),
    listSessions({ clientId: id }, 20),
  ]);

  return (
    <>
      <Crumbs items={[{ href: "/admin", label: "Clients" }, { label: client.name }]} />
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl leading-none">{client.name}</h1>
          <p className="mt-3 text-sm text-fg-muted">
            {client.company}
            {client.owner && <> · works with {client.owner}</>}
          </p>
        </div>
        <ActionButton
          url={`/api/admin/clients/${id}`}
          method="DELETE"
          className={btn.danger}
          confirmText={`Delete ${client.name}, their agents, interviews, calls and requests? This can't be undone.`}
          go="/admin"
        >
          Delete client
        </ActionButton>
      </div>

      <div className="flex flex-col gap-12">
        <section>
          <SectionTitle
            action={
              <Link href={`/admin/clients/${id}/agents/new`} className={btn.ghost}>
                + New agent
              </Link>
            }
          >
            Agents
          </SectionTitle>
          {agents.length === 0 ? (
            <Card className="px-5 py-8 text-center text-sm text-fg-muted">
              No agents yet.{" "}
              <Link href={`/admin/clients/${id}/agents/new`} className="text-accent hover:underline">
                Create one
              </Link>{" "}
              to start talking to {client.name.split(" ")[0]}.
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {agents.map((a, i) => (
                <Card key={a.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/agents/${a.id}`} className="font-serif text-3xl leading-none hover:text-accent">
                        {a.name}
                      </Link>
                      <p className="mt-1.5 line-clamp-1 max-w-xl text-sm text-fg-muted">{a.persona}</p>
                    </div>
                    <Link href={`/admin/agents/${a.id}`} className={btn.ghost}>
                      Agent settings
                    </Link>
                  </div>
                  <ul className="mt-5 divide-y divide-border border-y border-border">
                    {interviews[i].map((iv) => (
                      <li key={iv.id}>
                        <Link
                          href={`/admin/interviews/${iv.id}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-accent"
                        >
                          <span className="font-medium">{iv.title}</span>
                          {iv.kind === "open_line" && <Badge tone="accent">Open line</Badge>}
                          {iv.archived && <Badge>Archived</Badge>}
                          <span className="ml-auto font-mono text-[11px] text-fg-muted">
                            {iv.kind === "interview" && `${iv.topics.length} topics · `}
                            {iv.callCount} call{iv.callCount === 1 ? "" : "s"}
                            {iv.lastCallAt && ` · ${fmtDate(iv.lastCallAt)}`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <NewInterview agentId={a.id} templates={templates} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Requests</SectionTitle>
          <RequestsBoard requests={requests} />
        </section>

        <section>
          <SectionTitle>Calls</SectionTitle>
          <SessionsTable sessions={sessions} showClient={false} />
        </section>

        <section>
          <SectionTitle>Profile</SectionTitle>
          <ClientForm client={client} />
        </section>
      </div>
    </>
  );
}
