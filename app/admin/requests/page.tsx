import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listRequests } from "@/lib/db/queries";
import { RequestsBoard } from "@/components/admin/RequestsBoard";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <>
      <h1 className="font-serif text-5xl leading-none">Requests</h1>
      <p className="mb-8 mt-2 text-sm text-fg-muted">
        Changes, ideas, projects, content and questions clients raised on calls. Agents read status and notes back to
        clients who ask.
      </p>
      <Suspense fallback={<Card className="h-40 animate-pulse" />}>
        <All />
      </Suspense>
    </>
  );
}

async function All() {
  await connection();
  return <RequestsBoard requests={await listRequests({}, 500)} showClient />;
}
