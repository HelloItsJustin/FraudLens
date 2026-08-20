"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AlertState, DashboardState, LatestTransactionsResponse, TraceEntry } from "@/lib/contracts";
import { Dashboard } from "@/components/dashboard";
import { ChaseLoader } from "@/components/chase-loader";
import { OpeningScreen } from "@/components/opening-screen";
import { ProcessingScreen } from "@/components/processing-screen";

type Screen = "boot" | "opening" | "thinking" | "dashboard";
// Leave room for the dashboard's exit/enter animation inside the user's
// 40-second maximum, even when the API is temporarily unavailable.
const DASHBOARD_HARD_CAP_MS = 38_500;
const POLL_INTERVAL_MS = 1_750;

function mergeById<T extends { id: string }>(previous: T[], incoming: T[], limit: number): T[] {
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].slice(-limit);
}

function mergeLatestState(previous: DashboardState | undefined, update: LatestTransactionsResponse): DashboardState {
  const incoming = update.state;
  if (!previous || previous.runId !== incoming.runId) return incoming;
  const agentUpdates = Object.fromEntries(update.agentUpdates.map(({ agent, status }) => [agent, status]));
  const latestTransaction = update.transactions.at(-1)?.transaction;
  return {
    ...previous,
    ...incoming,
    streamPosition: Math.max(previous.streamPosition, incoming.streamPosition),
    lastTransaction: latestTransaction ?? incoming.lastTransaction ?? previous.lastTransaction,
    graph: incoming.graph,
    agents: { ...previous.agents, ...incoming.agents, ...agentUpdates },
    traces: mergeById<TraceEntry>(previous.traces, incoming.traces, 18).sort((a, b) => a.sequence - b.sequence),
    liveThoughts: mergeById<TraceEntry>(previous.liveThoughts, incoming.liveThoughts, 60).sort((a, b) => a.sequence - b.sequence),
    alerts: mergeById<AlertState>(previous.alerts, incoming.alerts, 36).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    investigations: incoming.investigations,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [state, setState] = useState<DashboardState>();
  const [clock, setClock] = useState(0);
  const thinkingEnteredAt = useRef<number | undefined>(undefined);
  const pollCursor = useRef<string | undefined>(undefined);
  const activeRunId = useRef<string | undefined>(undefined);
  const pollingPaused = useRef(true);
  const pollInFlight = useRef(false);
  // This must be stable while the boot screen is mounted. An inline callback
  // changes with the 100 ms clock tick, which would otherwise restart the
  // loader's effect and prevent its four-second timer from ever finishing.
  const completeBoot = useCallback(() => setScreen("opening"), []);
  const forceDashboard = useCallback(() => {
    setScreen((current) => current === "thinking" ? "dashboard" : current);
  }, []);
  const beginThinking = useCallback(() => {
    thinkingEnteredAt.current = Date.now();
    // Never let a prior completed run immediately satisfy the new run's UI.
    pollCursor.current = undefined;
    activeRunId.current = undefined;
    pollingPaused.current = true;
    setState(undefined);
    setScreen("thinking");
  }, []);

  const receiveLatest = useCallback((latest: LatestTransactionsResponse) => {
    // Never allow a stale response from a prior run to overwrite a restart.
    if (activeRunId.current && latest.runId && latest.runId !== activeRunId.current) return;
    activeRunId.current = latest.runId;
    pollCursor.current = latest.cursor;
    setState((previous) => mergeLatestState(previous, latest));
  }, []);

  const pollLatest = useCallback(async () => {
    if (pollingPaused.current || pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const since = pollCursor.current ? "?since=" + encodeURIComponent(pollCursor.current) : "";
      const response = await fetch("/api/transactions/latest" + since, { cache: "no-store" });
      if (!response.ok) return;
      receiveLatest(await response.json() as LatestTransactionsResponse);
    } catch {
      // A later interval retries; polling must not interrupt the dashboard.
    } finally {
      pollInFlight.current = false;
    }
  }, [receiveLatest]);

  const hydrateLatest = useCallback(async () => {
    try {
      const response = await fetch("/api/transactions/latest", { cache: "no-store" });
      if (response.ok) receiveLatest(await response.json() as LatestTransactionsResponse);
    } catch {
      // The processing handoff still has its independent visual deadline.
    } finally {
      pollingPaused.current = false;
      void pollLatest();
    }
  }, [pollLatest, receiveLatest]);

  const beginSeededRun = useCallback(async () => {
    beginThinking();
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      if (!response.ok) throw new Error("The demo could not be started.");
      const nextState = await response.json() as DashboardState;
      activeRunId.current = nextState.runId;
      pollCursor.current = new Date(nextState.startedAt ?? Date.now()).toISOString();
      setState(nextState);
      pollingPaused.current = false;
      void pollLatest();
    } catch {
      await hydrateLatest();
    }
  }, [beginThinking, hydrateLatest, pollLatest]);

  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== "thinking" && screen !== "dashboard") return;
    void pollLatest();
    const timer = window.setInterval(() => void pollLatest(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pollLatest, screen]);

  useEffect(() => {
    if (screen !== "thinking") return;
    const complete = state && Object.values(state.agents).every((agent) => agent.phase === "complete" || agent.phase === "timed_out");
    // The bound starts when the user enters the real agent flow.
    const processingStartedAt = state?.startedAt ?? thinkingEnteredAt.current;
    const limitReached = processingStartedAt !== undefined && clock - processingStartedAt >= DASHBOARD_HARD_CAP_MS;
    if (!complete && !limitReached) return;
    const timer = window.setTimeout(forceDashboard, 550);
    return () => window.clearTimeout(timer);
  }, [clock, forceDashboard, screen, state]);

  useEffect(() => {
    if (screen !== "thinking") return;
    const startedAt = thinkingEnteredAt.current ?? Date.now();
    const remaining = Math.max(0, DASHBOARD_HARD_CAP_MS - (Date.now() - startedAt));
    // This independent deadline is intentionally not tied to server state,
    // fetch completion, poll delivery, or the render clock.
    const timer = window.setTimeout(forceDashboard, remaining);
    return () => window.clearTimeout(timer);
  }, [forceDashboard, screen]);

  const enterLiveFeed = beginSeededRun;

  const returnToAgentFlow = () => {
    beginThinking();
    void hydrateLatest();
  };

  const restartSeededDemo = beginSeededRun;

  const transition = { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };
  return <AnimatePresence mode="wait">
    {screen === "boot" && <motion.div key="boot" className="screen-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.008 }} transition={transition}><ChaseLoader onComplete={completeBoot} /></motion.div>}
    {screen === "opening" && <motion.div key="opening" className="screen-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.012 }} transition={transition}><OpeningScreen onEnter={() => void enterLiveFeed()} /></motion.div>}
    {screen === "thinking" && <motion.div key="thinking" className="screen-shell" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.008 }} transition={transition}><ProcessingScreen state={state} now={clock} /></motion.div>}
    {screen === "dashboard" && <motion.div key="dashboard" className="screen-shell" initial={{ opacity: 0, scale: 0.986 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...transition, duration: 0.65 }}><Dashboard state={state} onCustomStreamStarted={returnToAgentFlow} onRestartDemo={() => void restartSeededDemo()} /></motion.div>}
  </AnimatePresence>;
}
