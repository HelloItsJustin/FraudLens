export type AgentName = "Ingest" | "Graph" | "Monitor" | "Counterfactual";
export type AgentPhase = "pending" | "active" | "complete" | "timed_out";

export interface Transaction {
  transactionId: string;
  timestamp: string;
  senderVpa: string;
  receiverVpa: string;
  amount: number;
  isNewBeneficiary: boolean;
}

export interface RiskSignals {
  velocity: number;
  newBeneficiaryHighValue: number;
  roundNumber: number;
}

export interface IngestRisk {
  transaction: Transaction;
  score: number;
  threshold: number;
  escalated: boolean;
  signals: RiskSignals;
  reasons: string[];
  assessedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  firstSeen: string;
  x: number;
  y: number;
  degree: number;
  ring?: boolean;
  riskScore: number;
  lastActivity: string;
  valueAtRisk: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  suspicious?: boolean;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeTransactions: Record<string, Transaction[]>;
  nodeProfiles: Record<string, NodeProfile>;
}

export interface NodeProfile {
  entityId: string;
  ingest: { score: number; signals: RiskSignals; reasons: string[]; assessedAt: string };
  graph: { degree: number; centrality: number; position: string; ringMember: boolean };
  monitor: {
    status: "watching" | "recheck" | "confirmed" | "not_yet_evaluated";
    summary: string;
    watchSince?: string;
    checkedAt?: string;
    nextCheckAt?: string;
  };
  counterfactual: { status: "ready" | "not_yet_evaluated"; explanation?: string; fingerprint: FingerprintPoint[] };
}

export interface GraphAnalysis {
  risk: IngestRisk;
  graph: GraphSnapshot;
  entityId: string;
  centrality: number;
  clusterAccounts: string[];
  ringConfirmed: boolean;
  confidence: number;
  evidence: string[];
  analyzedAt: string;
}

export interface MonitorAssessment {
  entityId: string;
  priorStatus: "inconclusive" | "confirmed";
  status: "inconclusive" | "recheck" | "confirmed";
  reason: string;
  nextCheckAt: string;
  checkedAt: string;
}

export interface FingerprintPoint {
  signal: "Velocity" | "Layering" | "Behavioral Anomaly" | "Sanctions Proximity" | "Network Centrality" | "Structuring";
  value: number;
  fullMark: number;
}

export interface ComplaintDraft {
  reference: string;
  subject: string;
  body: string;
  preparedFor: string;
  createdAt: string;
}

export interface LeaveOneOutResult {
  signal: string;
  scoreWithout: number;
  impact: number;
}

export interface CounterfactualResult {
  entityId: string;
  baselineScore: number;
  dominantSignal: string;
  leaveOneOut: LeaveOneOutResult[];
  fingerprint: FingerprintPoint[];
  analystExplanation: string;
  eli70Explanation: string;
  complaintDraft: ComplaintDraft;
  provider: "gemini" | "groq" | "static";
  createdAt: string;
}

export interface TraceEntry {
  id: string;
  sequence: number;
  timestamp: string;
  agent: AgentName | "Orchestrator";
  status: "started" | "completed" | "escalated" | "rechecked" | "alerted" | "fallback";
  summary: string;
  entityId?: string;
}

export interface AgentStatus {
  name: AgentName;
  phase: AgentPhase;
  startedAt?: number;
  completedAt?: number;
  elapsedMs: number;
  detail: string;
}

export interface BlindSpotResult {
  naiveDecision: "Approved" | "Flagged";
  naiveReason: string;
  fraudLensDecision: "Mule ring confirmed" | "Monitoring";
  missed: boolean;
}

export interface AlertState {
  id: string;
  delivered: boolean;
  title: string;
  message: string;
  timestamp: string;
  entityId?: string;
  kind: "ring" | "webhook" | "high_risk" | "system" | "watchlist" | "case_update";
}

export interface InvestigationCase {
  id: string;
  status: "Open" | "Escalated" | "Closed" | "Resolved" | "False Positive";
  detectedAt: string;
  accountCount: number;
  valueAtRisk: number;
  entityIds: string[];
  confidence: number;
}

export interface ProviderHealth {
  gemini: "configured" | "unconfigured" | "served" | "limited";
  groq: "configured" | "unconfigured" | "served" | "limited";
  active: "gemini" | "groq" | "static" | "waiting";
  rateLimitHeadroom: string;
}

export interface DashboardState {
  demoStatus: "idle" | "running" | "complete";
  startedAt?: number;
  streamPosition: number;
  totalTransactions: number;
  runSource: "seeded" | "upload";
  processingLimitSeconds: 40;
  graph: GraphSnapshot;
  agents: Record<AgentName, AgentStatus>;
  traces: TraceEntry[];
  liveThoughts: TraceEntry[];
  alerts: AlertState[];
  investigations: InvestigationCase[];
  providerHealth: ProviderHealth;
  ring?: GraphAnalysis;
  counterfactual?: CounterfactualResult;
  blindSpot?: BlindSpotResult;
  alert?: AlertState;
  estimatedRemainingMs: number;
  lastTransaction?: Transaction;
}

export type StreamEvent =
  | { type: "state"; state: DashboardState }
  | { type: "trace"; trace: TraceEntry }
  | { type: "alert"; alert: AlertState };

export interface LlmGeneratedContent {
  analystExplanation: string;
  eli70Explanation: string;
  complaintBody: string;
}
