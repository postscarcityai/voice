import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/db/queries";
import { AgentForm } from "@/components/admin/AgentForm";
import { Card, Crumbs } from "@/components/admin/ui";

type Props = PageProps<"/admin/clients/[id]/agents/new">;

export default function NewAgentPage({ params }: Props) {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
      <NewAgent params={params} />
    </Suspense>
  );
}

async function NewAgent({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return (
    <>
      <Crumbs items={[{ href: "/admin", label: "Clients" }, { href: `/admin/clients/${id}`, label: client.name }, { label: "New agent" }]} />
      <h1 className="mb-8 font-serif text-5xl leading-none">New agent for {client.name.split(" ")[0]}</h1>
      <AgentForm clientId={id} />
    </>
  );
}
