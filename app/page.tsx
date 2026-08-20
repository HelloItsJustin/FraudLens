"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DashboardState, StreamEvent } from "@/lib/contracts";
import { Dashboard } from "@/components/dashboard";
import { ChaseLoader } from "@/components/chase-loader";
import { OpeningScreen } from "@/components/opening-screen";
import { ProcessingScreen } from "@/components/processing-screen";

type Screen = "boot" | "opening" | "thinking" | "dashboard";
// Leave room for the dashboard's exit/enter animation inside the user's
// 40-second maximum, even when the API or SSE stream is unavailable.
const DASHBOARD_HARD_CAP_MS = 38_500;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [state, setState] = useState<DashboardState>();
  const [clock, setClock] = useState(0);
  const thinkingEnteredAt = useRef<number | undefined>(undefined);
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
    setState(undefined);
    setScreen("thinking");
  }, []);

  useEffect(() => {
    const tick = () => setClock(Date.now());
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== "thinking" && screen !== "dashboard") return;
    const source = new EventSource("/api/stream");
    const receiveState = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as StreamEvent;
      if (message.type === "state") setState(message.state);
    };
    source.addEventListener("state", receiveState as EventListener);
    return () => source.close();
  }, [screen]);

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
    // fetch completion, EventSource delivery, or the render clock.
    const timer = window.setTimeout(forceDashboard, remaining);
    return () => window.clearTimeout(timer);
  }, [forceDashboard, screen]);

  const enterLiveFeed = async () => {
    beginThinking();
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      if (response.ok) setState(await response.json() as DashboardState);
    } catch {
      // The SSE/default screen remains usable while the server becomes available.
    }
  };

  const returnToAgentFlow = () => {
    beginThinking();
  };

  const restartSeededDemo = async () => {
    beginThinking();
    try {
      const response = await fetch("/api/demo/start", { method: "POST" });
      if (response.ok) setState(await response.json() as DashboardState);
    } catch {
      // The visual handoff remains intact while a server is restarting.
    }
  };

  const transition = { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };
  return <AnimatePresence mode="wait">
    {screen === "boot" && <motion.div key="boot" className="screen-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.008 }} transition={transition}><ChaseLoader onComplete={completeBoot} /></motion.div>}
    {screen === "opening" && <motion.div key="opening" className="screen-shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.012 }} transition={transition}><OpeningScreen onEnter={() => void enterLiveFeed()} /></motion.div>}
    {screen === "thinking" && <motion.div key="thinking" className="screen-shell" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.008 }} transition={transition}><ProcessingScreen state={state} now={clock} /></motion.div>}
    {screen === "dashboard" && <motion.div key="dashboard" className="screen-shell" initial={{ opacity: 0, scale: 0.986 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...transition, duration: 0.65 }}><Dashboard state={state} onCustomStreamStarted={returnToAgentFlow} onRestartDemo={() => void restartSeededDemo()} /></motion.div>}
  </AnimatePresence>;
}
