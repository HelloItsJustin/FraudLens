import type { CounterfactualResult, FingerprintPoint, LlmGeneratedContent } from "@/lib/contracts";

/**
 * Frozen from the verified seeded five-account mule-ring run: the same rule
 * scores, cluster evidence and dual-register wording shown during successful
 * local Gemini execution. This is intentionally scenario-specific continuity
 * data, not generic placeholder copy.
 */
export const seededMuleRingCanned: Pick<CounterfactualResult,
  "baselineScore" | "dominantSignal" | "leaveOneOut" | "fingerprint"
> & LlmGeneratedContent = {
  baselineScore: 94,
  dominantSignal: "Velocity",
  leaveOneOut: [
    { signal: "Velocity", scoreWithout: 50, impact: 44 },
    { signal: "Layering", scoreWithout: 61, impact: 33 },
    { signal: "Network centrality", scoreWithout: 65, impact: 29 },
    { signal: "New-beneficiary pairing", scoreWithout: 69, impact: 25 },
    { signal: "Structuring", scoreWithout: 73, impact: 21 },
  ],
  fingerprint: [
    { signal: "Velocity", value: 75, fullMark: 100 },
    { signal: "Layering", value: 78, fullMark: 100 },
    { signal: "Behavioral Anomaly", value: 83, fullMark: 100 },
    { signal: "Sanctions Proximity", value: 26, fullMark: 100 },
    { signal: "Network Centrality", value: 69, fullMark: 100 },
    { signal: "Structuring", value: 72, fullMark: 100 },
  ] satisfies FingerprintPoint[],
  analystExplanation: "The dominant factor is transaction velocity. Five linked accounts moved similar round-value payments through reciprocal paths inside a short time window. Removing velocity reduces the network risk from 94 to 50, which is consistent with coordinated mule-account layering rather than independent customer activity.",
  eli70Explanation: "We found five accounts passing money between one another very quickly. It looks less like ordinary payments and more like people moving money around together to hide where it came from. We have kept the evidence together so a person can check it safely.",
  complaintBody: "I request that the Cyber Crime authorities review a suspected coordinated UPI mule-account network. Five connected accounts moved repeated round-value payments in a compressed window. FraudLens preserved the linked transaction references, account relationships and risk explanation for investigation.",
};
