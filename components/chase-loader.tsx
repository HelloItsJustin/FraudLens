"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crest, DecorativeFrame, NetworkBackdrop, Wordmark } from "@/components/ornaments";

const preparationSteps = ["Securing the forensic workspace...", "Calibrating signal thresholds...", "Preparing explainable intelligence..."];

export function ChaseLoader({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setProgress(Math.min(100, Math.round(((Date.now() - startedAt) / 4_000) * 100))), 40);
    // Keep the loader's lifecycle independent of parent rendering. This screen
    // deliberately has a fixed 4.1-second lifetime, including in Strict Mode.
    const finish = window.setTimeout(() => {
      setProgress(100);
      onCompleteRef.current();
    }, 4_100);
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, []);
  const message = preparationSteps[Math.min(preparationSteps.length - 1, Math.floor(progress / 34))];
  return <main className="boot-loader-screen">
    <NetworkBackdrop className="boot-loader-network" />
    <DecorativeFrame />
    <div className="boot-loader-meta boot-loader-meta--left"><span>✦</span><div><b>FRAUD INTELLIGENCE, REVEALED.</b><em>For clarity. For decisions. For trust.</em></div></div>
    <div className="boot-loader-meta boot-loader-meta--right"><div><b>SYSTEM STATUS</b><em>SECURE &amp; OPERATIONAL</em></div><span className="boot-loader-shield">✦</span></div>
    <motion.section className="boot-loader-center" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .55, ease: [0.16, 1, 0.3, 1] }}>
      <div className="boot-constellation" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
      <Wordmark hero />
      <div className="boot-progress" aria-label={`Loading ${progress}%`}><motion.i animate={{ width: `${progress}%` }} transition={{ duration: .16, ease: "linear" }} /></div>
      <div className="boot-status"><AnimatePresence mode="wait"><motion.p key={message} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .25 }}>{message}</motion.p></AnimatePresence><strong>{progress}%</strong></div>
    </motion.section>
    <div className="boot-loader-crest"><Crest /><small>EST. 2024</small></div>
    <div className="boot-loader-context">INTELLIGENCE<br />WITH CONTEXT</div>
  </main>;
}
