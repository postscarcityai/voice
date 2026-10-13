import type { Brief } from "./types";
import { publicPoints, type Progress } from "./progress";
import { speakerName } from "./prompt";

/**
 * What the client's browser is allowed to know: names, topic titles, openers
 * and examples, and their own progress. Never the context, rules, guidance
 * notes, or anything captured off the record.
 */
export function publicBrief(brief: Brief, orgName: string, progress: Progress | null) {
  const { client, agent, interview } = brief;
  return {
    agentName: agent.name,
    // Whoever is on the call (the client, or a teammate for a briefing)
    clientFirstName: speakerName(brief).trim().split(/\s+/)[0] || null,
    ownerFirstName: interview.audience === "team" ? null : client.owner.trim().split(/\s+/)[0] || null,
    orgName,
    kind: interview.kind,
    title: interview.title,
    estimatedMinutes: interview.estimatedMinutes,
    topics: interview.topics.map((t) => ({ id: t.id, title: t.title, opener: t.opener, examples: t.examples })),
    checklist: interview.checklist.map((c) => ({ id: c.id, label: c.label })),
    progress: progress && progress.calls > 0
      ? {
          calls: progress.calls,
          topics: progress.topics.map((t) => ({ id: t.topicId, status: t.status, points: publicPoints(t.points) })),
          checked: progress.checklist.map((c) => c.itemId),
        }
      : null,
  };
}

export type PublicBrief = ReturnType<typeof publicBrief>;
