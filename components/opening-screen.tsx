"use client";

import { BellRing, Fingerprint, MessageSquareText, Scale } from "lucide-react";
import { motion } from "framer-motion";
import { DecorativeFrame, NetworkBackdrop, Wordmark } from "@/components/ornaments";

const features = [
  [Fingerprint, "Risk Fingerprint"],
  [MessageSquareText, "Plain-Language Mode"],
  [Scale, "Live Comparison"],
  [BellRing, "Instant Alerts"],
] as const;

export function OpeningScreen({ onEnter }: { onEnter: () => void }) {
  return <main className="landing-screen">
    <NetworkBackdrop />
    <DecorativeFrame />
    <motion.section className="landing-content" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}>
      <div className="track-badge">AGENTRIX 2026 {"\u00b7"} FINGUARD TRACK</div>
      <Wordmark hero />
      <p className="eyebrow landing-eyebrow">EXPLAINABLE FRAUD-RING DETECTION, LIVE</p>
      <div className="ornament-rule"><i /><b>{"\u2726"}</b><i /></div>
      <p className="landing-intro">Four autonomous AI agents trace mule-account networks<br />invisible to single-transaction systems {"\u2014"} and explain<br />exactly why, in real time.</p>
      <div className="feature-pills">{features.map(([Icon, label]) => <div className="feature-pill" key={label}><Icon size={25} strokeWidth={1.35} /><span>{label}</span></div>)}</div>
      <motion.button className="enter-button" onClick={onEnter} whileHover={{ scale: 1.018, y: -2 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}><span>{"\u2726"}</span> ENTER LIVE FEED <span>{"\u2726"}</span></motion.button>
      <div className="team-signature">TEAM XCALIBUR <span>{"\u25c7"}</span></div>
    </motion.section>
  </main>;
}
