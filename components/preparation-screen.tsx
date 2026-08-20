"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DecorativeFrame, NetworkBackdrop, Wordmark } from "@/components/ornaments";

const preparationSteps = ["Fetching data from Kaggle...", "Cleaning transaction records...", "Normalizing account identifiers...", "Preparing live stream..."];

export function PreparationScreen({ progress }: { progress: number }) {
  const step = preparationSteps[Math.min(preparationSteps.length - 1, Math.floor(progress / 25))];
  return (
    <main className="prep-screen">
      <DecorativeFrame />
      <div className="loader-meta loader-meta--left"><span>✦</span><div><b>FRAUD INTELLIGENCE, REVEALED.</b><em>For clarity. For decisions. For trust.</em></div></div>
      <div className="loader-meta loader-meta--right"><div><b>SYSTEM STATUS</b><em>SECURE &amp; OPERATIONAL</em></div><span className="shield-glyph">✦</span></div>
      <NetworkBackdrop focus className="loader-network" />
      <motion.div className="loader-brand" initial={{ opacity: 0, scale: 0.975 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
        <Wordmark hero />
        <div className="loader-progress"><motion.i initial={{ width: "0%" }} animate={{ width: `${progress}%` }} transition={{ duration: 0.18, ease: "easeOut" }} /></div>
        <div className="loader-status">
          <AnimatePresence mode="wait"><motion.p key={step} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.32 }}>{step}</motion.p></AnimatePresence>
          <strong>{Math.round(progress)}%</strong>
        </div>
      </motion.div>
      <div className="loader-est"><div className="crest crest--small"><span>F</span></div><small>EST. 2024</small></div>
      <div className="loader-context">INTELLIGENCE<br />WITH CONTEXT</div>
    </main>
  );
}
