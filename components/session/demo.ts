import type { PublicBrief } from "@/lib/public";

// A scripted, offline run of the call screen for design review and
// development: open any share link with ?demo. No ElevenLabs session, no
// microphone, and nothing is saved.

type Tool = (p: Record<string, unknown>) => unknown;
type Tools = Record<"set_topic" | "capture_point" | "complete_topic" | "check_item" | "log_request" | "save_summary", Tool>;

interface DemoHooks {
  tools: Tools;
  speak: (role: "agent" | "user", text: string) => void;
  end: () => void;
}

const SAMPLE: [string, "note" | "quote" | "off_record"][][] = [
  [
    ["Grew up between two cities and two languages", "note"],
    ["I've always built things, even as a kid with cardboard", "quote"],
    ["A partnership issue she'd rather keep private", "off_record"],
  ],
  [
    ["Brings design, construction and development under one vision", "note"],
    ["Turns down jobs where the budget can't match the vision", "note"],
  ],
];

export function runDemo(brief: PublicBrief, { tools, speak, end }: DemoHooks): () => void {
  const steps: [number, () => void][] = [];
  let t = 600;
  const at = (delay: number, fn: () => void) => {
    t += delay;
    steps.push([t, fn]);
  };
  const name = brief.clientFirstName ?? "there";

  if (brief.kind === "open_line") {
    at(0, () => speak("agent", `Hi ${name}, it's ${brief.agentName}. What can I help with today?`));
    at(3000, () => speak("user", "Can we swap the homepage photo for the new rooftop render?"));
    at(2500, () => speak("agent", "Of course. Which render, and is there a date you need it by?"));
    at(3000, () =>
      tools.log_request({ type: "change", title: "Swap homepage photo for rooftop render", details: "", urgency: "normal" }),
    );
    at(2500, () => speak("user", "Also, when is the Spanish version going live?"));
    at(2000, () => tools.log_request({ type: "question", title: "When does the Spanish site go live?", details: "", urgency: "low" }));
    at(2500, () => speak("agent", "Got both. I'll make sure they get to the team."));
    at(2500, end);
  } else {
    at(0, () => speak("agent", `Hi ${name}! I'm ${brief.agentName}. Ready?`));
    at(3000, () => speak("user", "Ready."));
    brief.topics.slice(0, 2).forEach((topic, i) => {
      at(2000, () => tools.set_topic({ topic_id: topic.id }));
      at(400, () => speak("agent", topic.opener));
      for (const [point, kind] of SAMPLE[i] ?? []) {
        at(2600, () => speak("user", `${point}.`));
        at(900, () => tools.capture_point({ topic_id: topic.id, point, kind }));
      }
      at(1800, () => tools.complete_topic({ topic_id: topic.id, status: "answered", summary: "" }));
    });
    for (const topic of brief.topics.slice(2)) {
      at(700, () => tools.complete_topic({ topic_id: topic.id, status: "answered", summary: "" }));
    }
    if (brief.checklist[0]) at(1500, () => tools.check_item({ item_id: brief.checklist[0].id, value: "demo" }));
    at(1500, () => speak("agent", "Last few things: what didn't I ask that I should have?"));
    at(4000, () => tools.save_summary({ summary: "Demo summary." }));
    at(2500, end);
  }

  const timers = steps.map(([ms, fn]) => setTimeout(fn, ms));
  return () => timers.forEach(clearTimeout);
}
