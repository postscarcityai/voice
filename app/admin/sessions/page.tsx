import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { listSessions } from "@/lib/db/queries";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { Card } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Calls" };

export default function SessionsPage() {
  return (
    <>
      <h1 className="mb-8 font-serif text-5xl leading-none">Calls</h1>
      <Suspense fallback={<Card className="h-40 animate-pulse" />}>
        <All />
      </Suspense>
    </>
  );
}

async function All() {
  await connection();
  return <SessionsTable sessions={await listSessions({}, 500)} />;
}
