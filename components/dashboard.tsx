"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Network,
  Play,
  RotateCcw,
  ScanSearch,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TerminalSquare,
  Upload,
  X,
} from "lucide-react";
import { EntityGraph } from "@/components/entity-graph";
import { NodeSelectionProvider, useNodeSelection } from "@/components/node-selection-context";
import { Crest, LensMark } from "@/components/ornaments";
import type { AgentName, AlertState, DashboardState, FingerprintPoint, GraphNode, InvestigationCase, NodeProfile, Transaction } from "@/lib/contracts";
import { downloadEvidencePdf } from "@/lib/pdf";
import {
  directoryEntities,
  reportLeaderboard,
  reportPatternBreakdown,
  reportTrend,
  seededAlerts,
  seededCasebookNotes,
  seededInvestigations,
  type DirectoryEntity,
  type SeedInvestigation,
} from "@/lib/workspace-seed";

const nav = [[LayoutDashboard, "Intelligence"], [FolderOpen, "Investigations"], [Network, "Entities"], [Bell, "Alerts"], [BookOpen, "Casebook"], [FileText, "Reports"], [Settings, "Settings"]] as const;
type Section = (typeof nav)[number][1];
type ModalKind = "comparison" | "complaint" | "node" | "case" | "report" | "agent" | null;
const ease = [0.16, 1, 0.3, 1] as const;
const agentNames: AgentName[] = ["Ingest", "Graph", "Monitor", "Counterfactual"];
const chartPalette = ["var(--color-sage)", "var(--color-oxblood)", "var(--color-antique-gold)", "var(--color-ink-raised)"];
const fingerprintFallback: FingerprintPoint[] = [
  { signal: "Velocity", value: 18, fullMark: 100 }, { signal: "Layering", value: 21, fullMark: 100 }, { signal: "Behavioral Anomaly", value: 24, fullMark: 100 },
  { signal: "Sanctions Proximity", value: 12, fullMark: 100 }, { signal: "Network Centrality", value: 17, fullMark: 100 }, { signal: "Structuring", value: 16, fullMark: 100 },
];
const money = (amount = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const stamp = (iso?: string) => iso ? `${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC", hour12: false }).format(new Date(iso))} UTC` : "Awaiting stream";
const day = (iso?: string) => iso ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso)) : "In review";
const phase = (value?: string) => value === "complete" ? "Complete" : value === "active" ? "Active" : value === "timed_out" ? "Verified" : "Pending";

function classify(node?: GraphNode, profile?: NodeProfile): string {
  if (node?.ring || profile?.monitor.status === "confirmed") return "Confirmed Ring Member";
  if (profile?.monitor.status === "recheck" || (node?.riskScore ?? 0) >= 55) return "Watching";
  return "Clear";
}

function riskBadgeClass(label: string): string {
  if (label === "Confirmed Ring Member") return "case-status case-status--urgent";
  if (label === "Watching") return "case-status case-status--watch";
  return "case-status case-status--clear";
}

function Portrait() {
  return <div className="persona-ascii" aria-label="An older fraud investigator"><pre>{"  .-''''-.\n /  _  _  \\\n|  (o)(o)  |\n|    __   |\n \\  '--'  /\n  '._  _.'\n  /| /\\ |\\\n /_|/  \\|_\\"}</pre><span>YOUR FRAUDLENS GUIDE</span></div>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.section className={`modal-card paper-texture ${wide ? "modal-card--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 13, scale: .985 }} transition={{ duration: .42, ease }} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Close modal"><X size={18}/></button></div>{children}
    </motion.section>
  </motion.div>;
}

function RadarCard({ data }: { data: FingerprintPoint[] }) {
  const { selectedNodeId } = useNodeSelection();
  return <div className="fingerprint-chart" aria-label={selectedNodeId ? `Signal profile for ${selectedNodeId}` : "Aggregate signal profile"}>
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} cx="50%" cy="51%" outerRadius="72%">
        <PolarGrid stroke="var(--color-paper-shadow)" strokeOpacity={.72}/>
        <PolarAngleAxis dataKey="signal" tick={{ fill: "var(--color-ink)", fontFamily: "var(--font-newsreader)", fontSize: 12, fontWeight: 600 }}/>
        <Radar name={selectedNodeId ?? "Aggregate"} dataKey="value" stroke="var(--color-sage)" fill="var(--color-sage)" fillOpacity={.25} strokeWidth={2.3} isAnimationActive animationDuration={720} animationEasing="ease-out"/>
      </RadarChart>
    </ResponsiveContainer>
  </div>;
}

function runtimeEntity(node: GraphNode, state?: DashboardState): DirectoryEntity {
  const transactions = state?.graph.nodeTransactions[node.id] ?? [];
  const profile = state?.graph.nodeProfiles[node.id] ?? directoryEntities[0].profile;
  return { node, profile, transactions, activeInvestigation: Boolean(node.ring || profile.monitor.status === "recheck") };
}

function NodeDetailModal({ entity, state }: { entity?: DirectoryEntity; state?: DashboardState }) {
  if (!entity) return <p className="modal-intro">Choose any account from the graph or Entity directory to inspect its live evidence.</p>;
  const { node, profile, transactions } = entity;
  const totalSent = transactions.filter((transaction) => transaction.senderVpa === node.id).reduce((total, transaction) => total + transaction.amount, 0);
  const totalReceived = transactions.filter((transaction) => transaction.receiverVpa === node.id).reduce((total, transaction) => total + transaction.amount, 0);
  const counterparties = new Set(transactions.map((transaction) => transaction.senderVpa === node.id ? transaction.receiverVpa : transaction.senderVpa));
  const inDegree = state?.graph.edges.filter((edge) => edge.target === node.id).length ?? Math.floor(node.degree / 2);
  const outDegree = state?.graph.edges.filter((edge) => edge.source === node.id).length ?? Math.ceil(node.degree / 2);
  const classification = classify(node, profile);
  const signalRows = [
    ["Velocity anomaly", profile.ingest.signals.velocity],
    ["New beneficiary + high value", profile.ingest.signals.newBeneficiaryHighValue],
    ["Round-amount pattern", profile.ingest.signals.roundNumber],
  ] as const;
  return <div className="node-inspection node-inspection--complete">
    <div className="inspection-summary">
      <div><small>ACCOUNT / VPA</small><h3>{node.id}</h3><p>First seen {day(node.firstSeen)} · last activity {stamp(node.lastActivity)}</p></div>
      <div className="inspection-risk"><small>CLASSIFICATION</small><span className={riskBadgeClass(classification)}>{classification}</span><b>{node.riskScore}<em>/100</em></b></div>
    </div>
    <section className="node-metrics" aria-label="Transaction summary">
      <article><small>Transactions</small><b>{transactions.length}</b><span>linked records retained</span></article>
      <article><small>Value sent</small><b>{money(totalSent)}</b><span>outgoing transfer value</span></article>
      <article><small>Value received</small><b>{money(totalReceived)}</b><span>incoming transfer value</span></article>
      <article><small>Counterparties</small><b>{counterparties.size}</b><span>unique linked accounts</span></article>
    </section>
    <section className="inspection-agent-grid inspection-agent-grid--deep">
      <article><small>Ingest Agent · {profile.ingest.score}/100</small><p>{profile.ingest.reasons.join(" · ")}</p><div className="signal-list">{signalRows.map(([label, score]) => <span key={label}><i style={{ width: `${score}%` }}/><b>{label}</b><em>{score}</em></span>)}</div></article>
      <article><small>Graph Agent · network position</small><p>{profile.graph.position}</p><dl><div><dt>In-degree</dt><dd>{inDegree}</dd></div><div><dt>Out-degree</dt><dd>{outDegree}</dd></div><div><dt>Centrality</dt><dd>{profile.graph.centrality}%</dd></div><div><dt>Cluster</dt><dd>{profile.graph.ringMember ? "Ring #05" : "Observed network"}</dd></div></dl></article>
      <article><small>Monitor Agent · {profile.monitor.status.replaceAll("_", " ")}</small><p>{profile.monitor.summary}</p><dl><div><dt>Watch since</dt><dd>{day(profile.monitor.watchSince)}</dd></div><div><dt>Last check</dt><dd>{stamp(profile.monitor.checkedAt)}</dd></div><div><dt>Next check</dt><dd>{profile.monitor.nextCheckAt ? stamp(profile.monitor.nextCheckAt) : "Continuous confirmation"}</dd></div></dl></article>
      <article><small>Counterfactual Agent</small><p>{profile.counterfactual.status === "ready" ? profile.counterfactual.explanation : "Not yet evaluated. This account has not contributed to a confirmed ring explanation."}</p><dl><div><dt>Profile state</dt><dd>{profile.counterfactual.status === "ready" ? "Explained" : "Awaiting ring"}</dd></div><div><dt>Fingerprint</dt><dd>{profile.counterfactual.fingerprint.length} signals</dd></div></dl></article>
    </section>
    <section className="inspection-transfers"><h3>Recent retained transactions</h3>{transactions.length ? transactions.slice().reverse().slice(0, 6).map((transaction) => <div key={transaction.transactionId}><span><b>{transaction.senderVpa === node.id ? "To" : "From"} {transaction.senderVpa === node.id ? transaction.receiverVpa : transaction.senderVpa}</b><small>{transaction.transactionId} · {stamp(transaction.timestamp)}</small></span><strong>{money(transaction.amount)}</strong></div>) : <p>No transaction detail is retained for this freshly discovered account yet.</p>}</section>
  </div>;
}

function AgentModal({ agent, entity }: { agent: AgentName; entity?: DirectoryEntity }) {
  const logic: Record<AgentName, string[]> = {
    Ingest: ["Scores velocity, recipient novelty and round-number patterns.", "Preserves the calculated sub-scores with each retained transaction.", "Escalates evidence above the review threshold."],
    Graph: ["Measures directed in/out relationships, degree and centrality.", "Separates compact reciprocal clusters from ordinary payment pairs.", "Records the network position with the selected account."],
    Monitor: ["Keeps watching and recheck entities in a background loop.", "Reassesses risk when fresh linked evidence arrives.", "Stores the next review time for operational follow-up."],
    Counterfactual: ["Tests removal of each material risk signal.", "Ranks the signal that causes the largest score drop.", "Produces analyst, accessible and complaint-ready explanations."],
  };
  const profile = entity?.profile;
  const evidence = !profile ? "No selected entity is available." : agent === "Ingest" ? `${profile.ingest.score}/100 with velocity ${profile.ingest.signals.velocity}, beneficiary ${profile.ingest.signals.newBeneficiaryHighValue}, and structuring ${profile.ingest.signals.roundNumber}.` : agent === "Graph" ? `${profile.graph.position}; degree ${profile.graph.degree}; centrality ${profile.graph.centrality}%.` : agent === "Monitor" ? profile.monitor.summary : profile.counterfactual.explanation ?? "Counterfactual assessment has not started for this account.";
  return <div className="agent-document"><p className="modal-intro">{entity ? `Latest reasoning record for ${entity.node.id}.` : "Most recent network reasoning record."}</p><ol>{logic[agent].map((line) => <li key={line}>{line}</li>)}</ol><div className="agent-document-evidence"><small>SELECTED ENTITY EVIDENCE</small><p>{evidence}</p></div></div>;
}

function MiniCaseGraph({ investigation }: { investigation: SeedInvestigation }) {
  const points = investigation.entityIds.map((id, index) => ({ id, x: 60 + (index % 3) * 102, y: 48 + Math.floor(index / 3) * 70 }));
  return <div className="mini-case-graph"><svg viewBox="0 0 330 160" aria-label={`Relationship miniature for ${investigation.id}`}>{points.slice(1).map((point, index) => <path key={point.id} d={`M ${points[index].x} ${points[index].y} L ${point.x} ${point.y}`} />)}{points.map((point) => <g key={point.id}><circle cx={point.x} cy={point.y} r="11"/><text x={point.x} y={point.y + 27}>{point.id.replace("@upi", "").slice(0, 10)}</text></g>)}</svg></div>;
}

function CaseModal({ investigation, onOpenEntity }: { investigation?: SeedInvestigation; onOpenEntity: (id: string) => void }) {
  if (!investigation) return null;
  return <div className="case-detail case-detail--deep"><div className="case-detail-title"><div><small>{investigation.pattern.toUpperCase()}</small><h3>{investigation.id}</h3><p>{investigation.summary}</p></div><span className={riskBadgeClass(investigation.status === "False Positive" ? "Clear" : investigation.status === "Escalated" ? "Confirmed Ring Member" : "Watching")}>{investigation.status}</span></div><div className="case-detail-grid"><MiniCaseGraph investigation={investigation}/><div><small>CASE METADATA</small><p>Opened {day(investigation.openedAt)} · {investigation.accountCount} accounts · {money(investigation.valueAtRisk)} at risk · {investigation.confidence}% confidence.</p><small>GENERATED DOCUMENTS</small><ul>{investigation.documents.map((document) => <li key={document}>{document}</li>)}</ul></div></div><div className="case-detail-trace">{agentNames.map((agent, index) => <p key={agent}><time>{String(10 + index * 2).padStart(2, "0")}:2{index} UTC</time><b>{agent} Agent</b>{agent === "Ingest" ? " retained anomalous transaction evidence." : agent === "Graph" ? ` mapped the ${investigation.pattern.toLowerCase()} structure.` : agent === "Monitor" ? " scheduled a linked-account re-evaluation." : " preserved the explainable decision record."}</p>)}</div><button className="modal-action" onClick={() => onOpenEntity(investigation.entityIds[0])}>Inspect linked entity <ChevronRight size={16}/></button></div>;
}

interface Props { state?: DashboardState; onCustomStreamStarted: () => void; onRestartDemo: () => void; }

export function Dashboard(props: Props) {
  return <NodeSelectionProvider><DashboardContent {...props}/></NodeSelectionProvider>;
}

function DashboardContent({ state, onCustomStreamStarted, onRestartDemo }: Props) {
  const { selectedNodeId, selectNode } = useNodeSelection();
  const [section, setSection] = useState<Section>("Intelligence");
  const [collapsed, setCollapsed] = useState(false);
  const [eli70, setEli70] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [caseItem, setCaseItem] = useState<SeedInvestigation>();
  const [agent, setAgent] = useState<AgentName>("Graph");
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [investigationFilter, setInvestigationFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [note, setNote] = useState("Review counterfactual evidence before institutional escalation.");
  const [saved, setSaved] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [result, setResult] = useState("Type /help to see the forensic console commands.");
  const [replay, setReplay] = useState(0);
  const [message, setMessage] = useState("");
  const [webhook, setWebhook] = useState("Fraud Operations / Institutional Queue");
  const [toast, setToast] = useState<AlertState | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const lastToast = useRef({ id: "", shownAt: 0 });

  const entities = useMemo(() => {
    const merged = new Map(directoryEntities.map((entity) => [entity.node.id, entity]));
    (state?.graph.nodes ?? []).forEach((node) => merged.set(node.id, runtimeEntity(node, state)));
    return [...merged.values()];
  }, [state]);
  const selectedEntity = entities.find((entity) => entity.node.id === selectedNodeId);
  const selectedProfile = selectedEntity?.profile;
  const counter = state?.counterfactual;
  const fingerprint = selectedProfile?.counterfactual.fingerprint?.length ? selectedProfile.counterfactual.fingerprint : counter?.fingerprint ?? fingerprintFallback;
  const explanation = selectedProfile?.counterfactual.status === "ready" ? (eli70 ? "This account is part of a group that keeps passing money around in a tight circle. That is much less likely to be ordinary payments." : selectedProfile.counterfactual.explanation ?? "") : counter ? (eli70 ? counter.eli70Explanation : counter.analystExplanation) : "FraudLens is connecting account relationships and will explain any pattern that needs a human decision.";
  const runtimeCase = state?.investigations[0];
  const cases = useMemo(() => {
    const seeded = seededInvestigations.slice();
    if (!runtimeCase) return seeded;
    const live: SeedInvestigation = { ...runtimeCase, openedAt: runtimeCase.detectedAt, pattern: "Layered ring", summary: "Live FraudLens session confirmed a compact reciprocal five-account mule network.", documents: ["Live evidence packet", "Counterfactual explanation", "1930 complaint draft"] };
    return [live, ...seeded.filter((entry) => entry.id !== live.id)];
  }, [runtimeCase]);
  const alerts = useMemo(() => {
    const runtimeAlerts = state?.alerts ?? [];
    const byId = new Map([...runtimeAlerts, ...seededAlerts].map((alert) => [alert.id, alert]));
    return [...byId.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [state?.alerts]);
  const filteredEntities = useMemo(() => entities.filter((entity) => {
    const risk = entity.node.riskScore >= 75 ? "high" : entity.node.riskScore >= 35 ? "medium" : "low";
    const active = entity.activeInvestigation ? "active" : "clear";
    const recent = Date.now() - Date.parse(entity.node.lastActivity) < 7 * 86_400_000 ? "recent" : "older";
    return entity.node.id.toLowerCase().includes(query.toLowerCase()) && (riskFilter === "all" || risk === riskFilter) && (investigationFilter === "all" || active === investigationFilter) && (activityFilter === "all" || recent === activityFilter);
  }), [activityFilter, entities, investigationFilter, query, riskFilter]);

  useEffect(() => {
    const alert = state?.alert;
    if (!alert || alert.id === lastToast.current.id || Date.now() - lastToast.current.shownAt < 45_000) return;
    lastToast.current = { id: alert.id, shownAt: Date.now() };
    setToast(alert);
    const timer = window.setTimeout(() => setToast(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [state?.alert]);

  const inspect = (id: string) => { selectNode(id); setModal("node"); };
  const openCase = (item: SeedInvestigation) => { setCaseItem(item); setModal("case"); };
  const upload = async (chosen?: File) => {
    if (!chosen) return;
    try {
      const response = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: await chosen.text() }) });
      const data = await response.json() as { ok?: boolean; message?: string };
      setMessage(data.message ?? "The CSV could not be read.");
      if (response.ok && data.ok) window.setTimeout(onCustomStreamStarted, 180);
    } catch { setMessage("The CSV could not be read. Check the required column headings and try again."); }
  };
  const run = async () => {
    const [verb = "", arg = ""] = command.trim().split(/\s+/, 2);
    const lower = `/${verb.replace(/^[/.]+/, "").toLowerCase()}`;
    const directAgent = agentNames.find((name) => name.toLowerCase() === lower.slice(1));
    if (directAgent) {
      setResult(`Calling ${directAgent} Agent…`);
      try {
        const response = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent: directAgent, entityId: selectedNodeId }) });
        const data = await response.json() as { ok?: boolean; result?: { summary: string; entityId?: string } };
        if (!response.ok || !data.ok || !data.result) throw new Error("Agent unavailable");
        if (data.result.entityId) selectNode(data.result.entityId);
        setAgent(directAgent); setResult(data.result.summary); setModal("agent");
      } catch { setResult(`${directAgent} Agent is temporarily unavailable; the latest verified reasoning remains visible.`); }
      setCommand(""); return;
    }
    if (lower === "/help") setResult("/ingest  /graph  /monitor  /counterfactual  /expand <agent>  /status  /ring <id>  /report [id]  /focus <entity>  /replay  /alerts");
    else if (lower === "/status") setResult(`Provider: ${state?.providerHealth.active ?? "waiting"}. ${state?.providerHealth.rateLimitHeadroom ?? "Rate limits initializing"}. ${state?.streamPosition ?? 0} of ${state?.totalTransactions ?? 0} transactions processed.`);
    else if (lower === "/expand") { const match = agentNames.find((name) => name.toLowerCase() === arg.toLowerCase()); if (match) { setAgent(match); setModal("agent"); } else setResult("Choose Ingest, Graph, Monitor or Counterfactual."); }
    else if (lower === "/ring") { const ring = entities.find((entity) => entity.node.ring); if (ring) { setSection("Intelligence"); inspect(ring.node.id); } else setResult("No confirmed ring is available yet."); }
    else if (lower === "/report") { setModal("report"); setResult(`Assembled evidence report ${arg || "FL-2608-041"} and staged simulated submission.`); }
    else if (lower === "/focus") { const entity = entities.find((entry) => entry.node.id.toLowerCase().includes(arg.toLowerCase())); if (entity) { setSection("Intelligence"); inspect(entity.node.id); } else setResult("No matching entity in this session."); }
    else if (lower === "/replay") { setSection("Intelligence"); setReplay((value) => value + 1); setResult("Replaying choreographed network reveal."); }
    else if (lower === "/alerts") { setSection("Alerts"); setResult("Opened the chronological alert archive."); }
    else setResult("Unknown command. Type /help for available commands.");
    setCommand("");
  };
  const evidenceLines = [`Case ID: ${counter?.complaintDraft.reference ?? "FL-2608-041"}`, `Generated: ${new Date().toISOString()}`, `Selected entity: ${selectedEntity?.node.id ?? "Aggregate network"}`, `Risk score: ${selectedEntity?.node.riskScore ?? counter?.baselineScore ?? 94}/100`, `Graph finding: ${state?.ring?.evidence.join(" ") ?? "A compact reciprocal account cluster was observed."}`, `Counterfactual finding: ${selectedProfile?.counterfactual.explanation ?? counter?.analystExplanation ?? "Velocity produces the largest material risk drop."}`, "Prepared by FraudLens for formal cybercrime and bank-fraud review. Human validation remains required."];

  const intelligence = <>
    <section className="graph-panel"><div className="panel-heading"><div><h2>ENTITY GRAPH</h2><p>{selectedNodeId ? `SELECTED ENTITY · ${selectedNodeId}` : `LIVE RELATIONSHIP VIEW · ${stamp(state?.lastTransaction?.timestamp)}`}</p></div><span className="live-dot">LIVE</span></div><EntityGraph state={state} showLabels={showLabels} replayToken={replay} onInspect={() => setModal("node")}/></section>
    <section className="analysis-column"><article className="analysis-card fingerprint-card paper-texture"><div className="card-title"><h2>Risk Signal Fingerprint</h2><p>{selectedNodeId ? `INDIVIDUAL PROFILE · ${selectedNodeId}` : "AGGREGATE SIGNAL PROFILE"}</p></div><RadarCard data={fingerprint}/><div className="fingerprint-foot"><em>Higher = riskier</em><span>Model v2.7.4 · XAI</span></div></article><article className="analysis-card explanation-card explanation-card--refined paper-texture"><div className="explanation-title"><div><h2>Explain Like I&apos;m 70</h2><small>{selectedNodeId ? "Selected account context" : "Confirmed-ring context"}</small></div><button className={eli70 ? "toggle toggle--on" : "toggle"} role="switch" aria-checked={eli70} onClick={() => setEli70((value) => !value)}><span>{eli70 ? "PLAIN" : "ANALYST"}</span><i/></button></div><div className="explanation-body"><Portrait/><AnimatePresence mode="wait"><motion.div key={`${eli70}-${selectedNodeId ?? "network"}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .36, ease }}><p>{explanation}</p><p className="explanation-detail">{selectedNodeId ? <>Risk score: <b>{selectedProfile?.ingest.score ?? "—"}</b> · network: <b>{selectedProfile?.graph.position ?? "being mapped"}</b></> : <>Confidence: <b>High</b> · factor: <b>{counter?.dominantSignal ?? "being evaluated"}</b></>}</p></motion.div></AnimatePresence></div><div className="explanation-footer"><span>Readable decision support</span><button onClick={() => setModal("complaint")}>Open 1930 draft <ChevronRight size={14}/></button></div></article></section>
    <section className="trace-strip">{agentNames.map((name, index) => { const current = state?.agents[name]; const trace = (selectedNodeId ? state?.traces.filter((entry) => !entry.entityId || entry.entityId === selectedNodeId) : state?.traces)?.filter((entry) => entry.agent === name).at(-1); return <div className="trace-step" key={name}><div className="trace-top"><span>{index + 1}</span><h3>{name}{name === "Counterfactual" ? " Agent" : ""}</h3><i className={current?.phase === "complete" ? "trace-state trace-state--done" : "trace-state"}>{phase(current?.phase)}</i></div><div className="trace-line"/><p>{trace?.summary ?? current?.detail ?? "Waiting for an agent handoff…"}</p></div>; })}<button className="comparison-button" onClick={() => setModal("comparison")}><ScanSearch size={16}/> Blind-Spot Comparison</button></section>
    <ReasoningFeed state={state} selectedNodeId={selectedNodeId} onConsole={() => setConsoleOpen((value) => !value)}/>
  </>;

  const workspace = () => {
    if (section === "Intelligence") return intelligence;
    if (section === "Investigations") return <section className="workspace-view"><Header eyebrow="CASE REGISTER" title="Investigations" aside={`${cases.length} active records`}/><div className="data-table data-table--investigations"><div className="data-table-head"><span>Case / AI summary</span><span>Status</span><span>Opened</span><span>Accounts</span><span>Value at risk</span><span/></div>{cases.map((item) => <button className="data-table-row data-table-row--case" key={item.id} onClick={() => openCase(item)}><span><b>{item.id}</b><small>{item.summary}</small></span><span className={riskBadgeClass(item.status === "False Positive" || item.status === "Closed" || item.status === "Resolved" ? "Clear" : item.status === "Escalated" ? "Confirmed Ring Member" : "Watching")}>{item.status}</span><span>{day(item.openedAt)}</span><span>{item.accountCount}</span><strong>{money(item.valueAtRisk)}</strong><ChevronRight size={16}/></button>)}</div></section>;
    if (section === "Entities") return <section className="workspace-view"><Header eyebrow="ACCOUNT DIRECTORY" title="Entities" aside={`${entities.length} indexed accounts`}/><div className="table-tools table-tools--deep"><label><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search VPA or entity ID" aria-label="Search entities"/></label><FilterGroup value={riskFilter} onChange={setRiskFilter} options={[["all", "All risk"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]]}/><FilterGroup value={investigationFilter} onChange={setInvestigationFilter} options={[["all", "All cases"], ["active", "Active investigation"], ["clear", "No active case"]]}/><FilterGroup value={activityFilter} onChange={setActivityFilter} options={[["all", "Any activity"], ["recent", "Last 7 days"], ["older", "Earlier"]]}/></div><div className="data-table entity-table"><div className="data-table-head"><span>Entity</span><span>Risk score</span><span>Last activity</span><span>Investigation</span><span/></div>{filteredEntities.map((entity) => <button className="data-table-row" key={entity.node.id} onClick={() => inspect(entity.node.id)}><b>{entity.node.id}</b><strong>{entity.node.riskScore}/100</strong><span>{stamp(entity.node.lastActivity)}</span><span className={riskBadgeClass(classify(entity.node, entity.profile))}>{entity.activeInvestigation ? "Active case" : classify(entity.node, entity.profile)}</span><ChevronRight size={16}/></button>)}</div></section>;
    if (section === "Alerts") return <section className="workspace-view"><Header eyebrow="INSTITUTIONAL QUEUE" title="Alerts" aside={`${alerts.length} recorded`}/><div className="alert-list alert-list--deep">{alerts.map((alert) => <button className="alert-record" key={alert.id} onClick={() => alert.entityId ? inspect(alert.entityId) : setSection("Investigations")}><CircleAlert size={23}/><div><small>{stamp(alert.timestamp)} · {alert.kind.replaceAll("_", " ")}</small><h3>{alert.title}</h3><p>{alert.message}</p></div><ChevronRight size={17}/></button>)}</div></section>;
    if (section === "Casebook") return <section className="workspace-view"><Header eyebrow="CASE-FILE ARCHIVE" title="Casebook" action="Open 1930 draft" onClick={() => setModal("complaint")}/><div className="casebook-layout casebook-layout--deep"><article className="casebook-card"><small>{counter?.complaintDraft.reference ?? "FL-2608-041 / EVIDENCE"}</small><h3>{counter?.complaintDraft.subject ?? "Seeded mule-ring evidence file"}</h3><p>{counter?.complaintDraft.body ?? "This case file retains graph evidence, explanation and a complaint-ready timeline after confirmation."}</p><button className="workspace-action" onClick={() => setModal("report")}>Generate authority report <Download size={15}/></button></article><article className="analyst-note"><small>ANALYST NOTEBOOK</small><textarea value={note} onChange={(event) => { setNote(event.target.value); setSaved(false); }}/><button className="workspace-action" onClick={() => setSaved(true)}>{saved ? "Note saved to this session" : "Save note"}</button></article><section className="casebook-history"><small>RECENT ANNOTATIONS</small>{seededCasebookNotes.map((entry) => <article key={entry.id}><b>{entry.caseId}</b><span>{entry.author} · {day(entry.timestamp)}</span><p>{entry.text}</p></article>)}</section></div></section>;
    if (section === "Reports") return <ReportsView state={state} cases={cases} onReport={() => setModal("report")}/>;
    return <SettingsView showLabels={showLabels} setShowLabels={setShowLabels} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} webhook={webhook} setWebhook={setWebhook} state={state} onRestart={onRestartDemo}/>;
  };

  return <main className={`dashboard-screen ${collapsed ? "dashboard-screen--collapsed" : ""}`}><aside className="sidebar"><div><div className="sidebar-brand"><LensMark compact/><div><h1>FraudLens</h1><p>SEE WHAT OTHERS MISS</p></div><button className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <Menu size={18}/> : <ChevronLeft size={18}/>}</button></div><div className="sidebar-rule"/><nav>{nav.map(([Icon, label]) => <button className={section === label ? "nav-item nav-item--active" : "nav-item"} title={label} key={label} onClick={() => setSection(label)}><Icon size={21} strokeWidth={1.35}/><span>{label}</span>{label === "Alerts" && alerts.length > 0 && <b>{alerts.length}</b>}</button>)}</nav><div className="sidebar-rule"/><div className="environment"><small>ENVIRONMENT</small><div>Production <span>▾</span><i/></div></div><button className="upload-control" onClick={() => file.current?.click()}><Upload size={14}/><span>Upload your own CSV</span></button><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(event) => void upload(event.target.files?.[0])}/>{message && <p className="upload-note">{message}</p>}<blockquote>“In God we trust.<br/>All others must<br/>bring data.”<cite>— W. Edwards Deming</cite></blockquote></div><div className="sidebar-crest"><Crest/><small>VERITAS EX DATA</small></div></aside><section className={`dashboard-main ${section === "Intelligence" ? "dashboard-main--intelligence" : "dashboard-main--workspace"}`}><AnimatePresence mode="wait"><motion.div className={section === "Intelligence" ? "section-stage section-stage--intelligence" : "section-stage"} key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .42, ease }}>{workspace()}</motion.div></AnimatePresence></section><button className="console-fab" onClick={() => setConsoleOpen((value) => !value)}><TerminalSquare size={19}/><span>Console</span></button><AnimatePresence>{consoleOpen && <motion.section className="agent-console" initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 35 }} transition={{ duration: .42, ease }}><div className="agent-console-heading"><span>FRAUDLENS // AGENT CONSOLE</span><button onClick={() => setConsoleOpen(false)}><X size={16}/></button></div><p>{result}</p><form onSubmit={(event) => { event.preventDefault(); void run(); }}><span>$</span><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="/help" autoFocus/><button type="submit"><Play size={15}/> Run</button></form></motion.section>}</AnimatePresence><AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><ShieldCheck size={19}/><div><b>{toast.title}</b><span>{toast.message}</span></div></motion.div>}{modal === "comparison" && <Modal title="Live Blind-Spot Comparison" onClose={() => setModal(null)}><p className="modal-intro">The same events are assessed in parallel. A naive model sees one transfer; FraudLens sees its relationship network.</p><div className="comparison-grid"><div><small>NAIVE SINGLE-SIGNAL MODEL</small><strong>{state?.blindSpot?.naiveDecision ?? "Approved"}</strong><p>{state?.blindSpot?.naiveReason ?? "Scores isolated transfers only."}</p></div><div className="comparison-winner"><small>FRAUDLENS NETWORK VIEW</small><strong>{state?.blindSpot?.fraudLensDecision ?? "Mule ring confirmed"}</strong><p>Connects velocity, recipient novelty and five-account circulation.</p></div></div></Modal>}{modal === "complaint" && <Modal title="1930 Cybercrime Complaint" onClose={() => setModal(null)}><div className="complaint-meta"><span>{counter?.complaintDraft.reference ?? "FL-1930-2026-05"}</span><span>{counter?.complaintDraft.preparedFor ?? "National Cyber Crime Reporting Portal / 1930"}</span></div><h3>{counter?.complaintDraft.subject ?? "Suspected five-account UPI mule-ring activity"}</h3><p className="complaint-copy">{counter?.complaintDraft.body ?? "FraudLens preserved transaction references, account links and an explainable reason for this suspected mule-ring pattern."}</p><button className="modal-action" onClick={() => downloadEvidencePdf("fraudlens-1930-complaint.pdf", "FraudLens 1930 Cybercrime Complaint", evidenceLines)}><Download size={17}/> Download draft for review</button></Modal>}{modal === "node" && <Modal title="Entity inspection" onClose={() => setModal(null)} wide><NodeDetailModal entity={selectedEntity} state={state}/></Modal>}{modal === "case" && <Modal title="Investigation detail" onClose={() => setModal(null)} wide><CaseModal investigation={caseItem} onOpenEntity={(id) => { setSection("Entities"); inspect(id); }}/></Modal>}{modal === "agent" && <Modal title={`${agent} Agent reasoning`} onClose={() => setModal(null)} wide><AgentModal agent={agent} entity={selectedEntity}/></Modal>}{modal === "report" && <Modal title="Fraud evidence report" onClose={() => setModal(null)} wide><article className="authority-report"><header><Crest/><div><small>FRAUDLENS / EVIDENCE DOSSIER</small><h3>{counter?.complaintDraft.reference ?? "FL-2608-041"}</h3><span>Prepared {day(new Date().toISOString())} · Simulated authority submission ready</span></div></header><section><h4>Evidence summary</h4><p>{state?.ring?.evidence.join(" ") ?? "A compact five-account reciprocal transfer network was retained for cybercrime review."}</p><h4>Agent findings</h4><p>{counter?.analystExplanation ?? "Counterfactual analysis finds velocity to be the dominant material risk contributor."}</p><h4>Submission status</h4><p className="submission-confirmation"><ShieldCheck size={18}/> Document submitted to cybercrime authorities with full evidentiary proof.</p></section><footer>FraudLens preserves an explainable decision record. Authorities must independently validate all evidence before action.</footer></article><button className="modal-action" onClick={() => downloadEvidencePdf("fraudlens-evidence-dossier.pdf", "FraudLens Fraud Evidence Dossier", evidenceLines)}><Download size={17}/> Download a copy</button></Modal>}</AnimatePresence></main>;
}

function ReasoningFeed({ state, selectedNodeId, onConsole }: { state?: DashboardState; selectedNodeId?: string; onConsole: () => void }) {
  const entries = useMemo(() => {
    const scoped = (selectedNodeId ? state?.liveThoughts.filter((entry) => !entry.entityId || entry.entityId === selectedNodeId) : state?.liveThoughts) ?? [];
    const latest = agentNames.flatMap((agent) => { const entry = scoped.filter((item) => item.agent === agent).at(-1); return entry ? [entry] : []; });
    return [...latest, ...scoped.slice(-6)].filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index).sort((a, b) => a.sequence - b.sequence).slice(-8);
  }, [selectedNodeId, state?.liveThoughts]);
  return <section className="reasoning-feed" aria-live="polite"><div className="reasoning-feed-heading"><div><TerminalSquare size={16}/><span>LIVE AGENT REASONING</span></div><button onClick={onConsole}>Open console</button></div><div className="reasoning-lines"><AnimatePresence initial={false}>{entries.map((entry) => <motion.p key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -9 }} transition={{ duration: .34, ease }}><time>{stamp(entry.timestamp)}</time><b>{entry.agent} Agent</b><span>→</span>{entry.summary}</motion.p>)}</AnimatePresence>{!entries.length && <p><time>LIVE</time><b>Orchestrator</b><span>→</span>Ready to describe the next account relationship.</p>}</div></section>;
}

function FilterGroup({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>;
}

function ReportsView({ state, cases, onReport }: { state?: DashboardState; cases: SeedInvestigation[]; onReport: () => void }) {
  const trendData = reportTrend.map((value, index) => ({ week: `W${index + 1}`, detections: value, reviewed: value + 8 + index % 5 }));
  return <section className="workspace-view reports-view"><Header eyebrow="SUMMARY ANALYTICS" title="Reports" action="Generate evidence report" onClick={onReport}/><div className="stat-grid stat-grid--six"><Stat label="Transactions processed" value={`${Math.max(state?.streamPosition ?? 0, 1248600).toLocaleString("en-IN")}`} detail="all observed sources"/><Stat label="Rings detected" value="37" detail="in the last 30 days"/><Stat label="Value protected" value={money(4280000)} detail="estimated linked exposure"/><Stat label="Average detection" value="6.2s" detail="relationship emergence"/><Stat label="System accuracy" value="96.8%" detail="reviewed-case agreement"/><Stat label="Cost per case" value={money(184)} detail="operational review estimate"/></div><div className="report-chart-grid"><article className="report-chart"><small>DETECTIONS · 21-DAY TREND</small><ResponsiveContainer width="100%" height={242}><LineChart data={trendData}><CartesianGrid stroke="var(--color-antique-gold)" strokeOpacity={.18} vertical={false}/><XAxis dataKey="week" tick={{ fill: "var(--color-parchment-dim)", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "var(--color-parchment-dim)", fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "var(--color-ink-raised)", border: "1px solid var(--color-antique-gold)", color: "var(--color-parchment)" }}/><Line type="monotone" dataKey="detections" stroke="var(--color-sage-bright)" strokeWidth={3} dot={false} isAnimationActive animationDuration={900}/><Line type="monotone" dataKey="reviewed" stroke="var(--color-antique-gold)" strokeWidth={2} dot={false} strokeDasharray="5 5" isAnimationActive animationDuration={1000}/></LineChart></ResponsiveContainer></article><article className="report-chart"><small>FRAUD PATTERN BREAKDOWN</small><ResponsiveContainer width="100%" height={242}><PieChart><Pie data={reportPatternBreakdown} dataKey="value" nameKey="label" innerRadius={47} outerRadius={82} paddingAngle={3} isAnimationActive animationDuration={850}>{reportPatternBreakdown.map((entry, index) => <Cell key={entry.label} fill={chartPalette[index]}/>)}</Pie><Tooltip contentStyle={{ background: "var(--color-ink-raised)", border: "1px solid var(--color-antique-gold)", color: "var(--color-parchment)" }}/></PieChart></ResponsiveContainer><div className="pattern-legend">{reportPatternBreakdown.map((entry, index) => <span key={entry.label}><i style={{ background: chartPalette[index] }}/>{entry.label} <b>{entry.value}%</b></span>)}</div></article></div><div className="report-chart-grid"><article className="report-chart"><small>CASES REVIEWED · BY PATTERN</small><ResponsiveContainer width="100%" height={218}><BarChart data={reportPatternBreakdown}><CartesianGrid stroke="var(--color-antique-gold)" strokeOpacity={.18} vertical={false}/><XAxis dataKey="label" tick={{ fill: "var(--color-parchment-dim)", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "var(--color-parchment-dim)", fontSize: 11 }} axisLine={false} tickLine={false}/><Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={820}>{reportPatternBreakdown.map((entry, index) => <Cell key={entry.label} fill={chartPalette[index]}/>)}</Bar></BarChart></ResponsiveContainer></article><article className="report-chart report-leaderboard"><small>HIGHEST-VALUE CASES THIS WEEK</small>{reportLeaderboard.map((item, index) => <div key={item.id}><span>{index + 1}</span><b>{item.id}</b><em>{item.pattern}</em><strong>{money(item.valueAtRisk)}</strong></div>)}</article></div></section>;
}

function SettingsView({ showLabels, setShowLabels, reducedMotion, setReducedMotion, webhook, setWebhook, state, onRestart }: { showLabels: boolean; setShowLabels: (value: boolean) => void; reducedMotion: boolean; setReducedMotion: (value: boolean) => void; webhook: string; setWebhook: (value: string) => void; state?: DashboardState; onRestart: () => void }) {
  return <section className="workspace-view"><Header eyebrow="DISPLAY & DEMO CONTROLS" title="Settings"/><div className="settings-list"><Setting label="Show account labels" detail="Render every entity label after the graph reveal completes." checked={showLabels} change={setShowLabels}/><Setting label="Reduced motion" detail="Respect a calmer presentation mode for this browser session." checked={reducedMotion} change={(value) => { document.documentElement.classList.toggle("fraudlens-reduced-motion", value); setReducedMotion(value); }}/><label className="settings-provider"><div><b>LLM provider health</b><span>Gemini: {state?.providerHealth.gemini ?? "configured"} · Groq: {state?.providerHealth.groq ?? "configured"} · active: {state?.providerHealth.active ?? "standby"}</span></div><em>{state?.providerHealth.rateLimitHeadroom ?? "Gemini 12 rpm · Groq 30 rpm"}</em></label><label className="settings-webhook"><div><b>Institutional queue</b><span>Server-side delivery remains protected; this is its demonstration label.</span></div><input value={webhook} onChange={(event) => setWebhook(event.target.value)}/></label><label className="settings-provider"><div><b>Review threshold</b><span>Escalate weighted account risk to focused graph analysis.</span></div><em>58 / 100</em></label><button className="reset-demo" onClick={onRestart}><RotateCcw size={17}/> Restart seeded live demonstration</button></div></section>;
}

function Header({ eyebrow, title, action, onClick, aside }: { eyebrow: string; title: string; action?: string; onClick?: () => void; aside?: string }) { return <div className="workspace-heading"><div><p>{eyebrow}</p><h2>{title}</h2></div>{action ? <button className="workspace-action" onClick={onClick}>{action}<ChevronRight size={16}/></button> : aside ? <span className="workspace-count">{aside}</span> : <SlidersHorizontal size={22}/>}</div>; }
function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><small>{label}</small><b>{value}</b><span>{detail}</span></article>; }
function Setting({ label, detail, checked, change }: { label: string; detail: string; checked: boolean; change: (value: boolean) => void }) { return <label><div><b>{label}</b><span>{detail}</span></div><button className={checked ? "toggle toggle--on" : "toggle"} role="switch" aria-checked={checked} onClick={() => change(!checked)}><span>{checked ? "ON" : "OFF"}</span><i/></button></label>; }
