import type { AlertState, FingerprintPoint, GraphNode, InvestigationCase, NodeProfile, Transaction } from "@/lib/contracts";

export interface SeedInvestigation extends InvestigationCase {
  openedAt: string;
  summary: string;
  pattern: "Layered ring" | "Star funnel" | "Slow-burn structuring" | "Beneficiary takeover" | "False positive review";
  documents: string[];
}

export interface DirectoryEntity {
  node: GraphNode;
  profile: NodeProfile;
  transactions: Transaction[];
  activeInvestigation: boolean;
}

const now = Date.parse("2026-08-20T10:30:00.000Z");
const isoDaysAgo = (days: number, hours = 0) => new Date(now - days * 86_400_000 - hours * 3_600_000).toISOString();
const caseEntityGroups = [
  ["lakshmi.ring@upi", "pallavi.ring@upi", "reema.ring@upi", "sameer.ring@upi", "tara.ring@upi"],
  ["nidhi@upi", "ravi.terminal@upi", "yash.fin@upi"],
  ["aarti.k@upi", "bina.store@upi"],
  ["orbit.logistics@upi", "ledger.line@upi", "supply.chain@upi", "market@upi", "metro.spares@upi", "xpress.courier@upi"],
  ["farmer.collective@upi", "greenbasket@upi"],
  ["supply.chain@upi", "ledger.line@upi", "yash.fin@upi", "cashback.hub@upi"],
  ["brightmart@upi", "quickcart@upi", "safepay.merchant@upi"],
  ["ravi.terminal@upi", "nidhi@upi", "pallavi.ring@upi", "sameer.ring@upi", "tara.ring@upi"],
  ["theatre.club@upi", "uma.store@upi"],
  ["northstar@upi", "westend.salon@upi", "village.mart@upi", "zen.traders@upi"],
];

const caseRows: Array<[string, SeedInvestigation["status"], number, number, number, SeedInvestigation["pattern"], string]> = [
  ["FL-2608-041", "Escalated", 5, 428000, 0, "Layered ring", "Five connected VPAs recycled round-value transfers through a compact reciprocal loop."],
  ["FL-2608-038", "Open", 3, 86000, 1, "Star funnel", "Three new beneficiaries received successive high-value credits from one rapidly active sender."],
  ["FL-2608-034", "Resolved", 2, 12400, 2, "Beneficiary takeover", "A short beneficiary-novelty spike was confirmed as a legitimate family remittance change."],
  ["FL-2608-031", "Escalated", 6, 712500, 3, "Layered ring", "Six accounts formed two reciprocal clusters linked by timed relay payments."],
  ["FL-2608-029", "False Positive", 2, 18500, 4, "False positive review", "Unusual activity matched a documented merchant settlement cycle after analyst review."],
  ["FL-2608-024", "Open", 4, 173000, 6, "Slow-burn structuring", "Recurring neat-value transfers accumulated across four accounts over six days."],
  ["FL-2608-019", "Closed", 3, 49200, 8, "Beneficiary takeover", "The originating bank placed a hold and confirmed account ownership recovery."],
  ["FL-2608-012", "Escalated", 5, 396000, 11, "Star funnel", "A hub VPA distributed funds to five first-seen recipients inside 19 minutes."],
  ["FL-2608-008", "Resolved", 2, 7600, 14, "False positive review", "A flagged tuition payment schedule was cleared with supporting customer evidence."],
  ["FL-2607-097", "Closed", 4, 241000, 18, "Slow-burn structuring", "A previously watched network was closed after linked counterparties were off-boarded."],
];

export const seededInvestigations: SeedInvestigation[] = caseRows.map(([id, status, accountCount, valueAtRisk, days, pattern, summary], index) => ({
  id,
  status,
  accountCount,
  valueAtRisk,
  detectedAt: isoDaysAgo(days, index % 5),
  openedAt: isoDaysAgo(days, index % 4 + 2),
  confidence: status === "False Positive" ? 31 : Math.min(97, 62 + index * 3),
  entityIds: caseEntityGroups[index].slice(0, accountCount),
  pattern,
  summary,
  documents: status === "Open" ? ["Initial evidence packet"] : ["Initial evidence packet", "Agent reasoning trace", ...(status === "Escalated" ? ["1930 complaint draft"] : [])],
}));

const entitySpecs: Array<[string, number, boolean, number]> = [
  ["aarti.k@upi", 6, false, 0], ["anil.b@upi", 9, false, 0], ["banking.mitra@upi", 14, false, 0], ["bina.store@upi", 11, false, 0],
  ["brightmart@upi", 18, false, 1], ["cafe.anu@upi", 7, false, 0], ["cashback.hub@upi", 29, false, 2], ["civic.pay@upi", 12, false, 0],
  ["dev.r@upi", 16, false, 0], ["disha.home@upi", 8, false, 0], ["farmer.collective@upi", 22, false, 3], ["gita.works@upi", 13, false, 0],
  ["greenbasket@upi", 10, false, 0], ["hari.s@upi", 19, false, 0], ["indigo.arts@upi", 15, false, 0], ["jaya.trade@upi", 24, false, 4],
  ["kiran.009@upi", 5, false, 0], ["lakshmi.ring@upi", 94, true, 0], ["ledger.line@upi", 43, false, 5], ["mango.merchant@upi", 17, false, 0],
  ["market@upi", 31, false, 1], ["meera.g@upi", 12, false, 0], ["metro.spares@upi", 26, false, 4], ["naveen.pay@upi", 7, false, 0],
  ["nidhi@upi", 62, false, 1], ["northstar@upi", 20, false, 0], ["omkar.services@upi", 11, false, 0], ["orbit.logistics@upi", 47, false, 6],
  ["pallavi.ring@upi", 91, true, 0], ["pranav.works@upi", 9, false, 0], ["quickcart@upi", 16, false, 0], ["ravi.terminal@upi", 78, false, 2],
  ["reema.ring@upi", 96, true, 0], ["saanvi.pay@upi", 13, false, 0], ["safepay.merchant@upi", 18, false, 0], ["sameer.ring@upi", 89, true, 0],
  ["supply.chain@upi", 35, false, 7], ["tara.ring@upi", 93, true, 0], ["theatre.club@upi", 10, false, 0], ["uma.store@upi", 21, false, 0],
  ["village.mart@upi", 15, false, 0], ["vikram.r@upi", 27, false, 3], ["westend.salon@upi", 8, false, 0], ["xpress.courier@upi", 33, false, 8],
  ["yash.fin@upi", 56, false, 5], ["zen.traders@upi", 23, false, 0],
];

function fingerprint(signals: NodeProfile["ingest"]["signals"], centrality: number): FingerprintPoint[] {
  return [
    { signal: "Velocity", value: signals.velocity, fullMark: 100 },
    { signal: "Layering", value: Math.min(100, Math.round(signals.roundNumber * .55 + centrality * .45)), fullMark: 100 },
    { signal: "Behavioral Anomaly", value: Math.min(100, Math.round(signals.newBeneficiaryHighValue * .7 + signals.velocity * .3)), fullMark: 100 },
    { signal: "Sanctions Proximity", value: 8 + (centrality % 18), fullMark: 100 },
    { signal: "Network Centrality", value: centrality, fullMark: 100 },
    { signal: "Structuring", value: signals.roundNumber, fullMark: 100 },
  ];
}

function makeTransactions(id: string, index: number, risk: number): Transaction[] {
  const amounts = [2400 + index * 50, 6800 + index * 110, risk >= 70 ? 25000 + index * 1000 : 9200 + index * 125];
  return amounts.map((amount, transactionIndex) => ({
    transactionId: `DIR-${String(index + 1).padStart(3, "0")}-${transactionIndex + 1}`,
    timestamp: isoDaysAgo((index + transactionIndex) % 15, transactionIndex + 1),
    senderVpa: transactionIndex % 2 ? `counterparty${(index + transactionIndex) % 18 + 1}@upi` : id,
    receiverVpa: transactionIndex % 2 ? id : `counterparty${(index + transactionIndex) % 18 + 1}@upi`,
    amount,
    isNewBeneficiary: risk >= 55 && transactionIndex === 2,
  }));
}

export const directoryEntities: DirectoryEntity[] = entitySpecs.map(([id, riskScore, ring, caseIndex], index) => {
  const degree = ring ? 4 : riskScore >= 55 ? 3 : (index % 3) + 1;
  const signals = {
    velocity: ring ? 86 : Math.min(72, Math.max(4, riskScore - 8)),
    newBeneficiaryHighValue: ring ? 92 : riskScore >= 55 ? 68 : 0,
    roundNumber: ring ? 79 : riskScore >= 45 ? 58 : (index % 4) * 6,
  };
  const centrality = ring ? 74 + index % 16 : Math.min(62, degree * 12 + index % 11);
  const transactions = makeTransactions(id, index, riskScore);
  const activeInvestigation = ring || (caseIndex > 0 && seededInvestigations[caseIndex]?.status !== "Closed" && seededInvestigations[caseIndex]?.status !== "Resolved" && seededInvestigations[caseIndex]?.status !== "False Positive");
  const firstSeen = transactions.at(-1)?.timestamp ?? isoDaysAgo(16);
  const monitorStatus: NodeProfile["monitor"]["status"] = ring ? "confirmed" : riskScore >= 55 ? "recheck" : "watching";
  const profile: NodeProfile = {
    entityId: id,
    ingest: {
      score: riskScore,
      signals,
      reasons: [signals.velocity >= 44 ? "compressed payment velocity" : "normal observed velocity", signals.newBeneficiaryHighValue ? "high-value payment to new beneficiary" : "known-beneficiary activity", signals.roundNumber >= 44 ? "repeated round-number amount" : "unstructured payment amounts"],
      assessedAt: transactions[0]?.timestamp ?? firstSeen,
    },
    graph: { degree, centrality, position: ring ? "confirmed five-account mule ring" : degree >= 3 ? "connected intermediary" : "peripheral account", ringMember: ring },
    monitor: {
      status: monitorStatus,
      summary: ring ? "Ring evidence remains consistent across reciprocal transfers." : riskScore >= 55 ? "Held on the watch-list pending one additional linked event." : "No escalation threshold reached; activity remains under passive observation.",
      watchSince: firstSeen,
      checkedAt: isoDaysAgo(index % 3),
      nextCheckAt: ring ? undefined : new Date(now + (index % 8 + 1) * 60_000).toISOString(),
    },
    counterfactual: {
      status: ring ? "ready" : "not_yet_evaluated",
      explanation: ring ? `${id} is a high-centrality relay in the confirmed cluster; removing its velocity and round-amount evidence materially reduces the ring score.` : undefined,
      fingerprint: fingerprint(signals, centrality),
    },
  };
  return {
    node: { id, label: id.replace("@upi", ""), firstSeen, x: .12 + (index % 8) * .105, y: .15 + Math.floor(index / 8) * .14, degree, ring, riskScore, lastActivity: transactions[0]?.timestamp ?? firstSeen, valueAtRisk: transactions.reduce((sum, transaction) => sum + transaction.amount, 0) },
    profile,
    transactions,
    activeInvestigation,
  };
});

const alertRows: Array<[AlertState["kind"], string, string, number, string?]> = [
  ["ring", "Mule ring confirmed", "Five linked accounts formed a reciprocal layer-and-return pattern.", 0, "lakshmi.ring@upi"],
  ["webhook", "Institutional alert recorded", "Evidence packet was added to the simulated authority queue.", 0, "lakshmi.ring@upi"],
  ["high_risk", "High-risk transfer reviewed", "DIR-033-3 triggered velocity and beneficiary pairing controls.", 1, "reema.ring@upi"],
  ["watchlist", "Watch-list recheck due", "A connected intermediary has new linked activity for review.", 1, "ravi.terminal@upi"],
  ["case_update", "Case FL-2608-038 opened", "Three recipient funnel pattern entered analyst review.", 2],
  ["high_risk", "Round-number pattern retained", "Repeated 25,000 INR amounts were preserved for review.", 3, "sameer.ring@upi"],
  ["system", "Graph monitor heartbeat", "Relationship graph refreshed and 46 active entities indexed.", 3],
  ["case_update", "Case FL-2608-029 cleared", "Customer-provided settlement documentation resolved the alert.", 4],
  ["watchlist", "Beneficiary novelty elevated", "New recipient appeared in an otherwise low-risk account chain.", 5, "yash.fin@upi"],
  ["high_risk", "Velocity threshold crossed", "Short-interval transfers moved to focused graph analysis.", 6, "orbit.logistics@upi"],
  ["case_update", "Evidence packet generated", "A 1930-ready draft was attached to the escalated case file.", 7],
  ["system", "Provider continuity check", "Static continuity protection remained available to all live agents.", 8],
  ["watchlist", "Slow-burn pattern observed", "Repeated small payments accumulated beyond the review threshold.", 9, "supply.chain@upi"],
  ["case_update", "Case FL-2608-012 escalated", "Hub-and-spoke recipient pattern sent to institutional review.", 10],
  ["high_risk", "New-beneficiary transfer flagged", "High-value first payment received a temporary watch designation.", 11, "nidhi@upi"],
  ["system", "Daily detection report ready", "Operations metrics and case outcomes have been refreshed.", 12],
  ["case_update", "Case FL-2608-019 closed", "Originating institution confirmed remediation and returned funds.", 13],
  ["watchlist", "Centrality changed", "A peripheral entity became a bridge between two account groups.", 15, "ledger.line@upi"],
  ["system", "Casebook archive indexed", "Analyst notes and evidence documents are available for review.", 17],
  ["case_update", "Historical case FL-2607-097 closed", "Off-boarded linked accounts ended the observed slow-burn pattern.", 19],
];

export const seededAlerts: AlertState[] = alertRows.map(([kind, title, message, days, entityId], index) => ({
  id: `seed-alert-${String(index + 1).padStart(2, "0")}`,
  kind,
  title,
  message,
  timestamp: isoDaysAgo(days, index % 6),
  delivered: kind !== "webhook" || index % 2 === 0,
  entityId,
}));

export const seededCasebookNotes = [
  { id: "note-01", caseId: "FL-2608-041", author: "A. Raman, Senior Analyst", timestamp: isoDaysAgo(0, 2), text: "Reciprocal transfers remain materially more consistent with mule layering than with independent remittances. Preserve source timestamps." },
  { id: "note-02", caseId: "FL-2608-038", author: "K. Joseph, Fraud Ops", timestamp: isoDaysAgo(2, 1), text: "Requested beneficiary verification from the originating institution before escalation." },
  { id: "note-03", caseId: "FL-2608-029", author: "M. Shah, Quality Review", timestamp: isoDaysAgo(4, 3), text: "False positive rationale logged: merchant settlement batch confirmed with invoices and prior history." },
  { id: "note-04", caseId: "FL-2608-012", author: "R. Iyer, Investigations", timestamp: isoDaysAgo(11, 2), text: "Hub account links to five first-seen recipients. Complaint draft held pending bank acknowledgement." },
];

export const reportTrend = [4, 6, 5, 8, 7, 9, 12, 10, 14, 16, 13, 18, 17, 21, 19, 24, 22, 26, 29, 27, 31];
export const reportPatternBreakdown = [
  { label: "Layered rings", value: 38, color: "sage" },
  { label: "Star funnels", value: 26, color: "oxblood" },
  { label: "Slow-burn", value: 21, color: "gold" },
  { label: "Beneficiary takeover", value: 15, color: "ink" },
];
export const reportLeaderboard = seededInvestigations.slice().sort((a, b) => b.valueAtRisk - a.valueAtRisk).slice(0, 5);
