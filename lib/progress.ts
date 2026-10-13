import type { ChecklistState, Interview, Point, Session, TopicState, TopicStatus } from "./types";

// An interview can run over several calls. This folds every call into one
// picture: where each topic stands, what was captured, which checklist items
// came in. It feeds the next call's prompt and the client's screen.

const RANK: Record<TopicStatus, number> = { pending: 0, active: 1, skipped: 2, partial: 3, answered: 4 };

export interface Progress {
  topics: TopicState[];
  checklist: ChecklistState[];
  /** Points captured outside any topic (the open line, or stray ids) */
  general: Point[];
  calls: number;
  lastSummary: string | null;
}

export function interviewProgress(interview: Interview, sessions: Session[]): Progress {
  // Oldest first, so later calls refine earlier ones
  const ordered = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const topics: TopicState[] = interview.topics.map((t) => ({ topicId: t.id, status: "pending", points: [], summary: null }));
  const general: Point[] = [];
  const checklist = new Map<string, string>();
  let lastSummary: string | null = null;

  for (const s of ordered) {
    for (const st of s.topics) {
      const target = topics.find((t) => t.topicId === st.topicId);
      if (!target) {
        for (const p of st.points) if (!general.some((g) => g.text === p.text)) general.push(p);
        continue;
      }
      // A topic left "active" when a call ended counts as partly covered
      const status: TopicStatus = st.status === "active" ? "partial" : st.status;
      if (RANK[status] >= RANK[target.status]) target.status = status;
      if (st.summary) target.summary = target.summary && target.summary !== st.summary ? `${target.summary} ${st.summary}` : st.summary;
      for (const p of st.points) if (!target.points.some((x) => x.text === p.text)) target.points.push(p);
    }
    for (const c of s.checklist) checklist.set(c.itemId, c.value);
    if (s.closingSummary) lastSummary = s.closingSummary;
  }

  return {
    topics,
    checklist: [...checklist].map(([itemId, value]) => ({ itemId, value })),
    general,
    calls: ordered.length,
    lastSummary,
  };
}

export const isCovered = (status: TopicStatus) => status === "answered" || status === "skipped";

/** Drop anything marked off the record, for anything a client's browser can see */
export function publicPoints(points: Point[]): Point[] {
  return points.filter((p) => p.kind !== "off_record");
}
