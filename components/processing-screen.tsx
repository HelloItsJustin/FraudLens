"use client";

import { motion } from "framer-motion";
import type { AgentName, DashboardState } from "@/lib/contracts";
import { DecorativeFrame, NetworkBackdrop, Wordmark } from "@/components/ornaments";

const names: AgentName[] = ["Ingest", "Graph", "Monitor", "Counterfactual"];

function elapsed(milliseconds: number): string {
  return `${Math.max(0, milliseconds / 1000).toFixed(1)}s`;
}

function AgentGlyph({ phase }: { phase: string }) {
  if (phase === "complete") return <span className="agent-glyph agent-glyph--complete">{"\u2713"}</span>;
  if (phase === "active") return <span className="agent-glyph agent-glyph--active">{"\u2726"}</span>;
  if (phase === "timed_out") return <span className="agent-glyph agent-glyph--complete">{"\u2713"}</span>;
  return <span className="agent-glyph" />;
}

export function ProcessingScreen({ state, now }: { state?: DashboardState; now: number }) {
  const completed = names.filter((name) => state?.agents[name].phase === "complete" || state?.agents[name].phase === "timed_out").length;
  const active = names.filter((name) => state?.agents[name].phase === "active").length;
  const progress = Math.min(100, completed * 25 + (active ? 12 : 0));
  const totalElapsed = state?.startedAt ? now - state.startedAt : 0;
  // The whole product uses one fixed dashboard handoff ceiling.
  const limit = state?.processingLimitSeconds ?? 40;
  return <main className="processing-screen">
    <NetworkBackdrop className="processing-network" />
    <DecorativeFrame />
    <div className="processing-header"><Wordmark accent /><div className="processing-star">{"\u2726"}</div></div>
    <motion.section className="processing-card" initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <h1>PROCESSING LIVE TRANSACTION STREAM</h1>
      <div className="processing-rule"><span>{"\u2726"}</span></div>
      <div className="agent-list">
        {names.map((name) => {
          const status = state?.agents[name] ?? { phase: "pending", elapsedMs: 0, detail: "Waiting for upstream evidence..." };
          const liveElapsed = status.phase === "active" && status.startedAt ? now - status.startedAt : status.elapsedMs;
          return <motion.div layout className={`agent-row agent-row--${status.phase}`} key={name} transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}>
            <AgentGlyph phase={status.phase} />
            <div className="agent-copy"><h2>{name} Agent</h2><motion.p key={`${status.phase}-${status.detail}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>{status.detail}</motion.p></div>
            <time>{status.phase === "pending" ? "—" : elapsed(liveElapsed)}</time>
          </motion.div>;
        })}
      </div>
      <div className="processing-progress"><motion.i animate={{ width: `${progress}%` }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} /></div>
      <div className="time-row"><span>ESTIMATED TIME: {limit}s</span><span>ELAPSED: {elapsed(totalElapsed)}</span></div>
      <div className="processing-foot"><span>{"\u2726"}</span><em>{state?.ring ? "Verifying the confirmed network..." : "Agents are tracing the live relationship graph..."}</em><span>{"\u2726"}</span></div>
    </motion.section>
  </main>;
}
