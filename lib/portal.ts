import { getClient, listAgents, listInterviews, listLinks, listRequests, listSessions } from "@/lib/db/queries";
import { interviewProgress, isCovered, publicPoints } from "@/lib/progress";
import type { Point, RequestStatus } from "@/lib/types";

// One client's own view of their conversations: what /me shows, and what the
// embed API hands to a client's own dashboard. Only what the client's call
// screen could show: no background context, guardrails, agent guidance,
// interview goals or anything off the record.

export interface PortalItem {
  id: string;
  title: string;
  agentName: string;
  kind: "interview" | "open_line";
  topicCount: number;
  covered: number;
  estimatedMinutes: number;
  calls: number;
  lastSummary: string | null;
  notes: Point[];
  /** Path of the call screen, e.g. /s/<token>; null when the link is off */
  path: string | null;
  createdAt: string;
}

export interface Portal {
  client: { name: string; company: string };
  items: PortalItem[];
  requests: { id: string; title: string; status: RequestStatus; response: string; createdAt: string }[];
}

export async function clientPortal(clientId: string): Promise<Portal | null> {
  const client = await getClient(clientId);
  if (!client) return null;
  const agents = await listAgents(client.id);
  const pairs = (
    await Promise.all(
      agents.map(async (agent) =>
        (await listInterviews(agent.id)).filter((i) => !i.archived && i.audience === "client").map((interview) => ({ agent, interview })),
      ),
    )
  ).flat();
  const sessions = await listSessions({ clientId: client.id }, 200);
  const items = await Promise.all(
    pairs.map(async ({ agent, interview }): Promise<PortalItem> => {
      const link = (await listLinks(interview.id)).find((l) => !l.revoked);
      const progress = interviewProgress(interview, sessions.filter((s) => s.interviewId === interview.id));
      return {
        id: interview.id,
        title: interview.title,
        agentName: agent.name,
        kind: interview.kind,
        topicCount: interview.topics.length,
        covered: progress.topics.filter((t) => isCovered(t.status)).length,
        estimatedMinutes: interview.estimatedMinutes,
        calls: progress.calls,
        lastSummary: progress.lastSummary,
        notes: [...progress.topics.flatMap((t) => publicPoints(t.points)), ...publicPoints(progress.general)].slice(-6),
        path: link ? `/s/${link.token}` : null,
        createdAt: interview.createdAt,
      };
    }),
  );
  // Open lines first, then the newest
  items.sort((a, b) => (a.kind !== b.kind ? (a.kind === "open_line" ? -1 : 1) : b.createdAt.localeCompare(a.createdAt)));
  const requests = (await listRequests({ clientId: client.id, clientFacingOnly: true }))
    .slice(0, 20)
    .map((r) => ({ id: r.id, title: r.title, status: r.status, response: r.response, createdAt: r.createdAt }));
  return { client: { name: client.name, company: client.company }, items, requests };
}
