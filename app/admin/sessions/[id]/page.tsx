import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession, listRequests } from "@/lib/db/queries";
import { answerRows } from "@/lib/export";
import { syncFromElevenLabs } from "@/lib/sessions";
import { SessionTools } from "@/components/admin/SessionTools";
import {
  Badge,
  Card,
  Crumbs,
  REQUEST_TYPE_LABEL,
  SectionTitle,
  SessionBadge,
  TopicBadge,
  fmtDate,
  fmtDuration,
} from "@/components/admin/ui";
import type { TopicStatus } from "@/lib/types";

type Props = PageProps<"/admin/sessions/[id]">;

export default function SessionPage({ params }: Props) {
  return (
    <Suspense fallback={<Card className="h-64 animate-pulse" />}>
      <SessionDetail params={params} />
    </Suspense>
  );
}

const clock = (secs: number | null) =>
  secs == null ? "" : `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

async function SessionDetail({ params }: Pick<Props, "params">) {
  const { id } = await params;
  let session = await getSession(id);
  if (!session) notFound();
  let syncError: string | null = null;
  try {
    session = await syncFromElevenLabs(session);
  } catch (err) {
    syncError = err instanceof Error ? err.message : String(err);
  }
  const { client, agent, interview } = session.brief;
  const rows = answerRows(session).filter((r) => r.status !== "pending" || r.points.length || r.extracted);
  const requests = (await listRequests({ clientId: client.id })).filter((r) => r.sessionId === id);

  return (
    <>
      <Crumbs
        items={[
          { href: "/admin", label: "Clients" },
          { href: `/admin/clients/${client.id}`, label: client.name },
          { href: `/admin/interviews/${interview.id}`, label: interview.title },
          { label: `Call ${session.callNumber}` },
        ]}
      />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl leading-none">
            {interview.title}, call {session.callNumber}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <span>
              {agent.name} with {client.name}
            </span>
            <span className="opacity-40">·</span>
            <span>{fmtDate(session.startedAt)}</span>
            {session.durationSeconds ? (
              <>
                <span className="opacity-40">·</span>
                <span>{fmtDuration(session.durationSeconds)}</span>
              </>
            ) : null}
            <SessionBadge status={session.status} />
          </div>
        </div>
        <SessionTools id={session.id} canSync={Boolean(session.conversationId)} />
      </div>

      {syncError && (
        <Card className="mb-6 border-warn/40 px-4 py-3 text-sm text-warn">
          Couldn&apos;t reach ElevenLabs for the final transcript: {syncError}
        </Card>
      )}
      {session.conversationId && !session.syncedAt && !syncError && (
        <Card className="mb-6 px-4 py-3 text-sm text-fg-muted">
          {session.status === "active"
            ? "This call may still be live. What's below was captured as it happened."
            : "ElevenLabs is still processing this call. The full transcript and extraction will appear shortly."}
        </Card>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-10">
          <section>
            <SectionTitle>Summary</SectionTitle>
            <Card className="p-5">
              {session.closingSummary ? (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{session.closingSummary}</p>
              ) : (
                <p className="text-sm italic text-fg-muted">{agent.name} didn&apos;t save a summary on this call.</p>
              )}
              {session.callSummary && (
                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-1.5 text-xs font-medium text-fg-muted">ElevenLabs call summary</div>
                  <p className="text-sm leading-relaxed text-fg-muted">{session.callSummary}</p>
                </div>
              )}
            </Card>
          </section>

          {requests.length > 0 && (
            <section>
              <SectionTitle>Requests from this call</SectionTitle>
              <Card className="divide-y divide-border">
                {requests.map((r) => (
                  <div key={r.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge>{REQUEST_TYPE_LABEL[r.type]}</Badge>
                      <span className="font-medium">{r.title}</span>
                    </div>
                    {r.details && <p className="mt-1 text-sm text-fg-muted">{r.details}</p>}
                  </div>
                ))}
              </Card>
            </section>
          )}

          {session.checklist.length > 0 && (
            <section>
              <SectionTitle>Checklist answers</SectionTitle>
              <Card className="divide-y divide-border">
                {session.checklist.map((c) => (
                  <div key={c.itemId} className="px-5 py-3 text-sm">
                    <span className="font-medium">{interview.checklist.find((x) => x.id === c.itemId)?.label ?? c.itemId}:</span>{" "}
                    {c.value}
                  </div>
                ))}
              </Card>
            </section>
          )}

          {rows.length > 0 && (
            <section>
              <SectionTitle>Notes by topic</SectionTitle>
              <div className="flex flex-col gap-3">
                {rows.map((r) => (
                  <Card key={r.topicId} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[15px] font-medium leading-snug">{r.topic}</h3>
                      {r.status && <TopicBadge status={r.status as TopicStatus} />}
                    </div>
                    {r.summary && <p className="mt-3 text-sm leading-relaxed">{r.summary}</p>}
                    {r.points.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                        {r.points.map((p) => (
                          <li key={p.text} className="flex gap-2">
                            {p.kind === "quote" ? (
                              <span className="font-serif text-base italic">“{p.text}”</span>
                            ) : (
                              <>
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                                <span>
                                  {p.kind === "off_record" && <Badge tone="danger">Off the record</Badge>} {p.text}
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.extracted && (
                      <div className="mt-4 border-t border-border pt-3">
                        <div className="mb-1 text-xs font-medium text-fg-muted">Extracted from the transcript</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{r.extracted}</p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        <section>
          <SectionTitle>Transcript</SectionTitle>
          <Card className="max-h-[80vh] overflow-y-auto p-5 lg:sticky lg:top-20">
            {session.transcript.length === 0 ? (
              <p className="text-sm italic text-fg-muted">No transcript yet.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {session.transcript.map((t, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className={`text-xs font-semibold ${t.role === "agent" ? "text-accent" : ""}`}>
                        {t.role === "agent" ? agent.name : client.name}
                      </span>
                      <span className="font-mono text-[10px] text-fg-muted">{clock(t.time)}</span>
                    </div>
                    <p>{t.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
