import { Suspense } from "react";
import type { Metadata } from "next";
import { listSessions, resolveLink } from "@/lib/db/queries";
import { interviewProgress } from "@/lib/progress";
import { publicBrief } from "@/lib/public";
import { Interview } from "@/components/session/Interview";

export const metadata: Metadata = { title: "Conversation" };

type Props = PageProps<"/s/[token]">;

export default function SessionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Shell />}>
      <Session params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Session({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { token } = await params;
  const demo = "demo" in (await searchParams);
  const resolved = await resolveLink(token);
  if (!resolved) {
    return (
      <Shell>
        <h1 className="font-serif text-5xl">This link isn&apos;t active.</h1>
        <p className="mt-4 text-fg-muted">If you were expecting a conversation, ask the team for a fresh link.</p>
      </Shell>
    );
  }
  const { brief } = resolved;
  // Resume where earlier calls left off (the demo always starts fresh)
  const progress =
    brief.interview.kind === "interview" && !demo
      ? interviewProgress(brief.interview, await listSessions({ interviewId: brief.interview.id }, 500))
      : null;
  return <Interview token={token} demo={demo} brief={publicBrief(brief, process.env.ORG_NAME || "PostScarcity AI", progress)} />;
}

function Shell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="stage flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-fg">{children}</main>
  );
}
