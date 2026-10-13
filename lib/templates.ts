import type { InterviewInput } from "./types";

// Starting points for new interviews. They're generic on purpose: the client's
// context and rules live on the client, so a template only describes the
// shape of a conversation. Pick one, then tailor it.

type Template = { id: string; name: string; description: string; input: InterviewInput };

const base = {
  role: "",
  method: "",
  opening: "",
  closing: "",
  checklist: [],
  report: "",
  archived: false,
} satisfies Partial<InterviewInput>;

export const TEMPLATES: Template[] = [
  {
    id: "open-line",
    name: "Open line",
    description: "Always on. The client calls with a question, a change, an idea or content to post, and it lands in Requests.",
    input: {
      ...base,
      kind: "open_line",
      title: "Open line",
      role: "You're the client's direct line to the team. They call when they have a question, want something changed, have a new idea or project, or want content made or posted.",
      goal: "Understand what they need, answer what you can from what you know, and log everything else with enough detail that the team can act without calling back.",
      topics: [],
      estimatedMinutes: 10,
    },
  },
  {
    id: "discovery",
    name: "Discovery interview",
    description: "The big first interview: their story, business, clients, process, work, goals and brand.",
    input: {
      ...base,
      kind: "interview",
      title: "Discovery interview",
      role: "You're running the discovery interview. Everything they tell you becomes the raw material for their website, bio, social content, and the team's understanding of their business.",
      goal: "A complete picture of the business and everything the marketing site needs, in as few turns as possible. They're busy: ask big, open prompts, then go deeper where it counts.",
      closing: `Ask these together in one turn:
- "What didn't I ask that I should have?"
- "What's the one thing you're afraid the site will get wrong?"
- "Who else should we talk to?"
Then mention the checklist items still missing, thank them, and say goodbye.`,
      topics: [
        {
          id: "story",
          title: "Your story",
          opener: "Start at the beginning. How did you end up doing this work? Take me from the start to today.",
          examples: ["where you grew up", "your training", "earlier companies or roles", "the moment this business had to exist"],
        },
        {
          id: "what-you-do",
          title: "What you do",
          opener: "Explain what you do like I'm a potential partner you just met. Then explain it to a customer. What changes?",
          examples: ["what you actually do on a job", "work you turn down", "who you compete with", "where the name comes from"],
        },
        {
          id: "clients",
          title: "Your clients",
          opener: "Tell me about the best client you've ever had, and the worst. Then tell me who you want more of.",
          examples: ["who hires you today", "how they find you", "what worries them on the first call", "typical budgets"],
        },
        {
          id: "process",
          title: "How a project works",
          opener: "Walk me through a project from the first phone call to the finish. Pick a real one.",
          examples: ["the first meeting", "who does what", "how you price", "where projects usually go wrong"],
        },
        {
          id: "work",
          title: "Work you can show",
          opener: "Let's go through your work. For each piece, what did you do, and can we show it publicly?",
          examples: ["finished work", "work in progress", "past roles we can describe in words", "who could give a testimonial"],
        },
        {
          id: "business",
          title: "Where it's going",
          opener: "Where is the business now, and where do you want it in three years?",
          examples: ["what pays the bills", "what you want to grow", "the pipeline", "where your hours go"],
        },
        {
          id: "brand",
          title: "The brand and the site",
          opener: "Someone lands on your site. What should they feel in the first ten seconds, and what should they do next?",
          examples: ["three words a visitor should leave with", "brands you admire", "languages", "the main action"],
        },
      ],
      estimatedMinutes: 50,
    },
  },
  {
    id: "change-request",
    name: "Change request",
    description: "A focused call about changes to something that already exists: the site, a deliverable, a process.",
    input: {
      ...base,
      kind: "interview",
      title: "Change request",
      role: "You're collecting changes to something the team already built for them.",
      goal: "A clear, prioritized list of changes the team can act on without another call.",
      topics: [
        {
          id: "whats-wrong",
          title: "What should change",
          opener: "What would you change? Start with whatever bugs you most.",
          examples: ["wording", "photos", "layout", "something missing", "something that's wrong"],
        },
        {
          id: "why",
          title: "Why it matters",
          opener: "For the big ones, what's the reason? What should it do for you that it doesn't now?",
          examples: ["a customer said something", "a new offer", "it doesn't feel like you"],
        },
        {
          id: "priority",
          title: "Priority and timing",
          opener: "If we could only do three of these this week, which three?",
          examples: ["deadlines", "events coming up", "things that can wait"],
        },
      ],
      closing: "Read the changes back as a short prioritized list and ask if anything is missing. Log each change with log_request, then thank them and say goodbye.",
      estimatedMinutes: 15,
    },
  },
  {
    id: "content",
    name: "Content session",
    description: "Ten to fifteen minutes to pull stories and opinions out of the client for posts, captions and articles.",
    input: {
      ...base,
      kind: "interview",
      title: "Content session",
      role: "You're interviewing them for social posts and articles. You want stories, opinions and specific moments, in their voice.",
      goal: "Enough raw material for a week of posts: at least three stories, two strong opinions, and quotable lines.",
      topics: [
        {
          id: "recent",
          title: "What's been happening",
          opener: "What's happened in the last couple of weeks that you'd tell a friend about?",
          examples: ["a job", "a client moment", "something that went wrong", "a win"],
        },
        {
          id: "opinion",
          title: "A strong opinion",
          opener: "What's something most people in your industry get wrong?",
          examples: ["a myth customers believe", "a trend you hate", "advice you'd give your younger self"],
        },
        {
          id: "behind",
          title: "Behind the scenes",
          opener: "What's a part of your work people never see?",
          examples: ["a tool", "a ritual", "a day in your life", "your team"],
        },
      ],
      closing: "Tell them which two or three stories you'll turn into posts first, thank them, and say goodbye.",
      estimatedMinutes: 15,
    },
  },
];

export const BLANK: InterviewInput = { ...base, kind: "interview", title: "New interview", goal: "", topics: [], estimatedMinutes: 20 };
