import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgent, getClient, listInterviews } from "@/lib/db/queries";
import { TEMPLATES } from "@/lib/templates";
import { AgentForm } from "@/components/admin/AgentForm";
import { ActionButton } from "@/components/admin/form";
import { NewInterview } from "@/components/admin/NewInterview";
import { Badge, Card, Crumbs, SectionTitle, btn, fmtDate } from "@/components/admin/ui";

type Props = PageProps<"/admin/agents/[id]">;

export default function AgentPage({ params }: Props) {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
      <AgentDetail params={params} />
    </Suspense>
  );
}

async function AgentDetail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) notFound();
  const [client, interviews] = await Promise.all([getClient(agent.clientId), listInterviews(id)]);

  return (
    <>
      <Crumbs
        items={[
          { href: "/admin", label: "Clients" },
          { href: `/admin/clients/${agent.clientId}`, label: client?.name ?? "Client" },
          { label: agent.name },
        ]}
      />
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-serif text-5xl leading-none">{agent.name}</h1>
        <ActionButton
          url={`/api/admin/agents/${id}`}
          method="DELETE"
          className={btn.danger}
          confirmText={`Delete ${agent.name} and all its interviews and calls?`}
          go={`/admin/clients/${agent.clientId}`}
        >
          Delete agent
        </ActionButton>
      </div>

      <section className="mb-12">
        <SectionTitle>Interviews</SectionTitle>
        <Card className="p-5">
          {interviews.length > 0 && (
            <ul className="mb-4 divide-y divide-border border-b border-border">
              {interviews.map((iv) => (
                <li key={iv.id}>
                  <Link href={`/admin/interviews/${iv.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:text-accent">
                    <span className="font-medium">{iv.title}</span>
                    {iv.kind === "open_line" && <Badge tone="accent">Open line</Badge>}
                    {iv.archived && <Badge>Archived</Badge>}
                    <span className="ml-auto font-mono text-[11px] text-fg-muted">
                      {iv.callCount} calls{iv.lastCallAt && ` · ${fmtDate(iv.lastCallAt)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <NewInterview agentId={id} templates={TEMPLATES.map(({ id, name, description }) => ({ id, name, description }))} />
        </Card>
      </section>

      <AgentForm agent={agent} />
    </>
  );
}
