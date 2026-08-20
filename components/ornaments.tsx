"use client";

import { motion } from "framer-motion";

const constellationNodes = [
  [7, 16], [14, 23], [20, 11], [29, 28], [34, 18], [42, 35], [48, 12], [57, 25], [66, 15], [72, 31], [81, 20], [91, 35],
  [10, 72], [19, 67], [27, 81], [36, 63], [44, 76], [53, 64], [62, 81], [70, 68], [79, 80], [88, 64], [96, 73],
] as const;
const constellationLines = [[0, 1], [1, 3], [2, 4], [3, 5], [4, 6], [5, 9], [6, 7], [7, 8], [8, 10], [9, 11], [12, 13], [13, 15], [14, 16], [15, 17], [16, 18], [17, 19], [18, 20], [19, 21], [21, 22]] as const;

export function NetworkBackdrop({ className = "", focus = false }: { className?: string; focus?: boolean }) {
  return (
    <div className={`network-backdrop ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <g className="network-lines">
          {constellationLines.map(([from, to]) => (
            <line key={`${from}-${to}`} x1={constellationNodes[from][0]} y1={constellationNodes[from][1]} x2={constellationNodes[to][0]} y2={constellationNodes[to][1]} />
          ))}
        </g>
        <g className="network-nodes">
          {constellationNodes.map(([x, y], index) => (
            <motion.circle key={`${x}-${y}`} cx={x} cy={y} r={index % 5 === 0 ? 0.7 : 0.42} animate={{ opacity: [0.22, 0.58, 0.22], r: index % 5 === 0 ? [0.7, 0.9, 0.7] : [0.42, 0.5, 0.42] }} transition={{ duration: 6 + (index % 4), repeat: Infinity, ease: "easeInOut", delay: index * 0.18 }} />
          ))}
          {focus && <motion.circle className="focus-node" cx="70" cy="52" r="1.1" animate={{ opacity: [0.45, 1, 0.45], r: [1.05, 1.6, 1.05] }} transition={{ duration: 2.6, repeat: Infinity }} />}
        </g>
      </svg>
    </div>
  );
}

export function DecorativeFrame({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={`decorative-frame ${className}`}>{children}</div>;
}

export function LensMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? "lens-mark lens-mark--compact" : "lens-mark"} viewBox="0 0 100 100" aria-label="FraudLens network lens mark" role="img">
      <circle cx="45" cy="43" r="29" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M66 65 88 87" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
      <path d="M30 52 43 34 58 46 45 56 30 52Z" fill="none" stroke="currentColor" strokeWidth="2" opacity=".8" />
      <circle cx="30" cy="52" r="4" fill="var(--color-sage-bright)" />
      <circle cx="43" cy="34" r="4" fill="var(--color-parchment)" />
      <circle cx="58" cy="46" r="4" fill="var(--color-oxblood-bright)" />
      <circle cx="45" cy="56" r="4" fill="var(--color-sage-bright)" />
    </svg>
  );
}

export function Wordmark({ hero = false, accent = false }: { hero?: boolean; accent?: boolean }) {
  return (
    <div className={`wordmark ${hero ? "wordmark--hero" : ""} ${accent ? "wordmark--accent" : ""}`} aria-label="FraudLens">
      <span>Fraud</span><LensMark /><span>Lens</span>
    </div>
  );
}

export function Crest() {
  return <div className="crest" aria-hidden="true"><span>FL</span></div>;
}
