import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrief, listLinks, listSessions } from "@/lib/db/queries";
import { buildFirstMessage, buildSystemPrompt } from "@/lib/prompt";
import { interviewProgress } from "@/lib/progress";
import { reportsEnabled } from "@/lib/report";
import { callContext } from "@/lib/sessions";
import { ActionButton } from "@/components/admin/form";
import { InterviewForm } from "@/components/admin/InterviewForm";
import { LinkManager } from "@/components/admin/LinkManager";
import { ReportPanel } from "@/components/admin/ReportPanel";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { Badge, Card, Crumbs, SectionTitle, TopicBadge, btn, fmtDate } from "@/components/admin/ui";

type Props = PageProps<"/admin/interviews/[id]">;

export default function InterviewPage({ params }: Props) {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
      <InterviewDetail params={params} />
    </Suspense>
  );
}

async function InterviewDetail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) notFound();
  const { client, agent, interview } = brief;
  const [links, sessions, ctx] = await Promise.all([
    listLinks(id),
    listSessions({ interviewId: id }, 200),
    callContext(brief),
  ]);
  const progress = interviewProgress(interview, sessions);
  const opts = {
    orgName: process.env.ORG_NAME || "PostScarcity AI",
    orgNameSpoken: process.env.ORG_NAME_SPOKEN || "Post Scarcity A.I.",
  };
  const isInterview = interview.kind === "interview";

  return (
    <>
      <Crumbs
        items={[
          { href: "/admin", label: "Clients" },
          { href: `/admin/clients/${client.id}`, label: client.name },
          { href: `/admin/agents/${agent.id}`, label: agent.name },
          { label: interview.title },
        ]}
      />
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl leading-none">{interview.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <span>
              {agent.name} with {client.name}
            </span>
            {interview.kind === "open_line" && <Badge tone="accent">Open line</Badge>}
            {interview.archived && <Badge>Archived</Badge>}
            {interview.elevenlabsAgentId ? (
              <Badge tone="ok">Synced {fmtDate(interview.syncedAt)}</Badge>
            ) : (
              <Badge tone="warn">Syncs on save or first call</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ActionButton url={`/api/admin/interviews/${id}/sync`}>Sync</ActionButton>
          <ActionButton
            url={`/api/admin/interviews/${id}/duplicate`}
            go="/admin/interviews/:id"
          >
            Duplicate
          </ActionButton>
          <ActionButton url={`/api/admin/interviews/${id}`} method="PATCH" body={{ archived: !interview.archived }}>
            {interview.archived ? "Restore" : "Archive"}
          </ActionButton>
          <ActionButton
            url={`/api/admin/interviews/${id}`}
            method="DELETE"
            className={btn.danger}
            confirmText="Delete this interview, its links and every call? This can't be undone."
            go={`/admin/clients/${client.id}`}
          >
            Delete
          </ActionButton>
        </div>
      </div>

      <div className="flex flex-col gap-12">
        <LinkManager
          interviewId={id}
          links={links}
          defaultLabel={client.name}
          publicUrl={process.env.PUBLIC_URL?.replace(/\/$/, "") || null}
        />

        {isInterview && (
          <section>
            <SectionTitle
              action={
                sessions.length > 0 && (
                  <span className="flex gap-1">
                    <a className={btn.ghost} href={`/api/admin/interviews/${id}/export?format=md`}>
                      Everything (.md)
                    </a>
                    <a className={btn.ghost} href={`/api/admin/interviews/${id}/export?format=csv`}>
                      Answers (.csv)
                    </a>
                  </span>
                )
              }
            >
              Progress · {progress.calls} call{progress.calls === 1 ? "" : "s"}
            </SectionTitle>
            <Card className="divide-y divide-border">
              {interview.topics.map((t) => {
                const st = progress.topics.find((x) => x.topicId === t.id);
                return (
                  <div key={t.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium">{t.title}</div>
                      <TopicBadge status={st?.status ?? "pending"} />
                    </div>
                    {st?.summary && <p className="mt-1.5 text-sm leading-relaxed">{st.summary}</p>}
                    {!!st?.points.length && (
                      <ul className="mt-2 flex flex-col gap-1 text-sm text-fg-muted">
                        {st.points.map((p) => (
                          <li key={p.text}>
                            {p.kind === "quote" ? (
                              <span className="font-serif italic text-fg">“{p.text}”</span>
                            ) : p.kind === "off_record" ? (
                              <span>
                                <Badge tone="danger">Off the record</Badge> {p.text}
                              </span>
                            ) : (
                              <>· {p.text}</>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {interview.checklist.length > 0 && (
                <div className="px-5 py-4">
                  <div className="mb-2 font-medium">Checklist</div>
                  <ul className="grid gap-1 text-sm sm:grid-cols-2">
                    {interview.checklist.map((c) => {
                      const v = progress.checklist.find((x) => x.itemId === c.id)?.value;
                      return (
                        <li key={c.id} className={v ? "" : "text-fg-muted"}>
                          {v ? "✓" : "○"} {c.label}
                          {v && <span className="text-fg-muted">: {v}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Card>
          </section>
        )}

        {isInterview && (
          <section>
            <SectionTitle>Handoff</SectionTitle>
            <ReportPanel
              interviewId={id}
              markdown={interview.reportMarkdown}
              generatedAt={interview.reportGeneratedAt}
              enabled={reportsEnabled()}
              hasCalls={sessions.some((s) => s.transcript.length > 0)}
            />
          </section>
        )}

        {!isInterview && (
          <Card className="px-5 py-4 text-sm text-fg-muted">
            Requests from this line land in{" "}
            <Link href={`/admin/clients/${client.id}`} className="text-accent hover:underline">
              {client.name}&apos;s requests
            </Link>
            . Status and notes you add there are what {agent.name} tells {client.name.split(" ")[0]} if they ask.
          </Card>
        )}

        <section>
          <SectionTitle>Calls · {sessions.length}</SectionTitle>
          <SessionsTable sessions={sessions} showClient={false} />
        </section>

        <section>
          <SectionTitle>Brief</SectionTitle>
          <InterviewForm interview={interview} />
        </section>

        <details>
          <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted hover:text-fg">
            What {agent.name} is told on the next call (generated)
          </summary>
          <Card className="mt-3 p-5">
            <div className="mb-2 text-xs font-medium text-fg-muted">First message</div>
            <p className="mb-5 text-sm">{buildFirstMessage(brief, opts, ctx)}</p>
            <div className="mb-2 text-xs font-medium text-fg-muted">System prompt</div>
            <pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {buildSystemPrompt(brief, opts, ctx)}
            </pre>
          </Card>
        </details>
      </div>
    </>
  );
}
