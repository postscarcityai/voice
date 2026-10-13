"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import type { PublicBrief } from "@/lib/public";
import type { Point, PointKind, RequestType, SessionEvent, TopicStatus } from "@/lib/types";
import { runDemo } from "./demo";

export type Phase = "ready" | "connecting" | "live" | "ended" | "error";

export interface TopicView {
  id: string;
  title: string;
  opener: string;
  examples: string[];
  status: TopicStatus;
  points: Point[];
  /** Points captured privately this call. Only the count is shown. */
  privateCount: number;
}

export interface RequestView {
  id: string;
  type: RequestType;
  title: string;
}

export interface Caption {
  role: "agent" | "user";
  text: string;
}

type Params = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "").trim();

/**
 * Runs one call in the browser: starts the ElevenLabs session with a token
 * from our server, turns the agent's client tool calls into screen state, and
 * reports everything back to the server in ordered batches.
 */
export function useInterview(linkToken: string, brief: PublicBrief, { demo = false } = {}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicView[]>(() =>
    brief.topics.map((t) => {
      const prior = brief.progress?.topics.find((p) => p.id === t.id);
      // A topic left mid-way last time shows as partly done, not in progress
      const status = prior?.status === "active" ? "partial" : (prior?.status ?? "pending");
      return { ...t, status, points: prior?.points ?? [], privateCount: 0 };
    }),
  );
  const [general, setGeneral] = useState<Point[]>([]);
  const [checked, setChecked] = useState<string[]>(() => brief.progress?.checked ?? []);
  const [requests, setRequests] = useState<RequestView[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [caption, setCaption] = useState<Caption | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedEarly, setEndedEarly] = useState(false);
  const [demoSpeaking, setDemoSpeaking] = useState(false);
  const stopDemo = useRef<(() => void) | null>(null);

  // ---- ordered event reporting
  const session = useRef<{ id: string; key: string } | null>(null);
  const queue = useRef<SessionEvent[]>([]);
  const inFlight = useRef(false);
  const summaryRef = useRef<string | null>(null);
  const connected = useRef(false);

  // One request at a time, so the server applies events in order
  const flush = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    while (session.current && queue.current.length) {
      const batch = queue.current.splice(0, queue.current.length);
      try {
        const res = await fetch(`/api/session/${linkToken}/events`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session.current.id, sessionKey: session.current.key, events: batch }),
          keepalive: true,
        });
        if (!res.ok && res.status >= 500) throw new Error(String(res.status));
      } catch {
        queue.current.unshift(...batch);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    inFlight.current = false;
  }, [linkToken]);

  const report = useCallback(
    (event: SessionEvent) => {
      queue.current.push(event);
      void flush();
    },
    [flush],
  );

  // If the tab closes mid-call, get the last events out with a beacon
  useEffect(() => {
    const onHide = () => {
      if (!session.current || phase !== "live") return;
      const events = [...queue.current.splice(0), { type: "ended", early: true } as SessionEvent];
      const body = JSON.stringify({ sessionId: session.current.id, sessionKey: session.current.key, events });
      navigator.sendBeacon(`/api/session/${linkToken}/events`, new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [linkToken, phase]);

  // ---- tool calls from the agent
  const updateTopic = useCallback((id: string, fn: (t: TopicView) => TopicView) => {
    setTopics((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const tools = useRef({
    set_topic: (p: Params) => {
      const id = s(p.topic_id);
      setTopics((all) =>
        all.map((t) =>
          t.id === id
            ? { ...t, status: t.status === "answered" ? t.status : "active" }
            : t.status === "active"
              ? { ...t, status: "partial" }
              : t,
        ),
      );
      setCurrentId(id);
      report({ type: "set_topic", topicId: id });
      return "Shown on screen.";
    },
    capture_point: (p: Params) => {
      const topicId = s(p.topic_id) || "general";
      const text = s(p.point);
      const kind: PointKind = p.kind === "quote" || p.kind === "off_record" ? p.kind : "note";
      if (text) {
        const known = brief.topics.some((t) => t.id === topicId);
        if (kind === "off_record") {
          if (known) updateTopic(topicId, (t) => ({ ...t, privateCount: t.privateCount + 1 }));
        } else if (known) {
          updateTopic(topicId, (t) =>
            t.points.some((x) => x.text === text) ? t : { ...t, points: [...t.points, { text, kind }] },
          );
        } else {
          setGeneral((g) => (g.some((x) => x.text === text) ? g : [...g, { text, kind }]));
        }
        report({ type: "capture_point", topicId, point: text, kind });
      }
      return "Captured.";
    },
    complete_topic: (p: Params) => {
      const id = s(p.topic_id);
      const status = p.status === "skipped" || p.status === "partial" ? p.status : "answered";
      updateTopic(id, (t) => ({ ...t, status }));
      setCurrentId((c) => (c === id ? null : c));
      report({ type: "complete_topic", topicId: id, status, summary: s(p.summary) });
      return "Saved.";
    },
    check_item: (p: Params) => {
      const id = s(p.item_id);
      if (id) {
        setChecked((c) => (c.includes(id) ? c : [...c, id]));
        report({ type: "check_item", itemId: id, value: s(p.value) });
      }
      return "Checked off.";
    },
    log_request: (p: Params) => {
      const title = s(p.title);
      if (!title) return "A request needs a title.";
      const types: RequestType[] = ["change", "feature", "project", "content", "question", "other"];
      const type = types.includes(p.type as RequestType) ? (p.type as RequestType) : "other";
      const id = crypto.randomUUID();
      setRequests((r) => [...r, { id, type, title }]);
      report({
        type: "log_request",
        requestId: id,
        requestType: type,
        title,
        details: s(p.details),
        urgency: p.urgency === "high" || p.urgency === "low" ? p.urgency : "normal",
      });
      return "Logged.";
    },
    save_summary: (p: Params) => {
      const text = s(p.summary);
      summaryRef.current = text;
      setSummary(text);
      report({ type: "save_summary", summary: text });
      return "Summary saved.";
    },
  });

  const conversation = useConversation({
    clientTools: {
      set_topic: (p) => tools.current.set_topic(p),
      capture_point: (p) => tools.current.capture_point(p),
      complete_topic: (p) => tools.current.complete_topic(p),
      check_item: (p) => tools.current.check_item(p),
      log_request: (p) => tools.current.log_request(p),
      save_summary: (p) => tools.current.save_summary(p),
    },
    onConnect: ({ conversationId }) => {
      connected.current = true;
      setPhase("live");
      setStartedAt(Date.now());
      if (conversationId) report({ type: "conversation_id", conversationId });
    },
    onMessage: ({ message, role }) => {
      if (!message?.trim()) return;
      const r = role === "agent" ? "agent" : "user";
      setCaption({ role: r, text: message });
      report({ type: "transcript", role: r, message });
    },
    onDisconnect: (details) => {
      if (!connected.current) {
        setPhase("error");
        setError("We couldn't connect the call. Check your connection and try again.");
        report({ type: "ended", early: true });
        return;
      }
      // The agent hangs up after the goodbye. Hanging up on the open line is normal; in an
      // interview, leaving before the agent saved a summary means the call was cut short.
      const early = brief.kind === "interview" && details?.reason !== "agent" && !summaryRef.current;
      setEndedEarly(early);
      report({ type: "ended", early });
      setPhase((p) => (p === "error" ? p : "ended"));
    },
    onError: (message) => {
      console.error("[voice]", message);
    },
  });

  const start = useCallback(async () => {
    setError(null);
    if (demo) {
      setPhase("live");
      setStartedAt(Date.now());
      stopDemo.current = runDemo(brief, {
        tools: tools.current,
        speak: (role, text) => {
          setCaption({ role, text });
          setDemoSpeaking(role === "agent");
        },
        end: () => {
          setDemoSpeaking(false);
          setPhase("ended");
        },
      });
      return;
    }
    setPhase("connecting");
    try {
      // Ask for the mic first, inside the click, so the browser prompt is tied to it
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPhase("error");
      setError("We need your microphone to talk. Allow mic access in your browser and try again.");
      return;
    }
    try {
      const res = await fetch(`/api/session/${linkToken}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't start the call.");
      session.current = { id: data.sessionId, key: data.sessionKey };
      conversation.startSession({ conversationToken: data.conversationToken, connectionType: "webrtc" });
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Couldn't start the call.");
    }
  }, [brief, conversation, demo, linkToken]);

  const end = useCallback(() => {
    if (demo) {
      stopDemo.current?.();
      setPhase("ended");
      return;
    }
    conversation.endSession();
  }, [conversation, demo]);

  useEffect(() => () => stopDemo.current?.(), []);
  const demoVolume = useCallback(() => (demoSpeaking ? 0.25 + Math.random() * 0.25 : 0), [demoSpeaking]);

  // Keep a phone screen awake during the call
  useEffect(() => {
    if (phase !== "live" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then(
      (l) => (lock = l),
      () => {},
    );
    return () => void lock?.release();
  }, [phase]);

  const progress = useMemo(() => {
    const done = topics.filter((t) => t.status === "answered" || t.status === "skipped").length;
    return { done, total: topics.length };
  }, [topics]);

  return {
    phase,
    error,
    topics,
    general,
    checked,
    requests,
    current: topics.find((t) => t.id === currentId) ?? null,
    progress,
    summary,
    caption,
    startedAt,
    endedEarly,
    start,
    end,
    isSpeaking: demo ? demoSpeaking : conversation.isSpeaking,
    isMuted: conversation.isMuted,
    setMuted: conversation.setMuted,
    getInputVolume: demo ? () => 0 : conversation.getInputVolume,
    getOutputVolume: demo ? demoVolume : conversation.getOutputVolume,
  };
}
