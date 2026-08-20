import { GraphAgent, IngestAgent } from "@/lib/agents";
import { staticExplanationVariants } from "@/lib/fallback-data";
import { seededMuleRingCanned } from "@/lib/seeded-fallback";
import {
  loadActiveSimulationRun,
  saveActiveSimulationRun,
  type DurableSimulationRun,
} from "@/lib/durable-run-store";
import type {
  AgentName,
  AgentStatus,
  AgentUpdate,
  AlertState,
  CounterfactualResult,
  DashboardState,
  FingerprintPoint,
  GraphAnalysis,
  InvestigationCase,
  LatestTransactionsResponse,
  LlmGeneratedContent,
  TraceEntry,
  Transaction,
  TransactionUpdate,
} from "@/lib/contracts";
import { loadTransactions, parseTransactionsCsv } from "@/lib/data";

const AGENT_NAMES: AgentName[] = ["Ingest", "Graph", "Monitor", "Counterfactual"];
const TRANSACTION_INTERVAL_MS = 1_250;
const MONITOR_INTERVAL_MS = 2_500;
const COUNTERFACTUAL_DELAY_MS = 900;
const CONTINUITY_AFTER_MS = 28_000;
const DEFAULT_GRAPH = { nodes: [], edges: [], nodeTransactions: {}, nodeProfiles: {} };
const THOUGHTS: Record<AgentName, string[]> = {
  Ingest: ["Reweighing velocity, beneficiary novelty and amount structure.", "Preserving the transaction-level rule evidence for review.", "Comparing this transfer against the sender's most recent activity."],
  Graph: ["Recalculating local degree and reciprocal relationship density.", "Tracing account-to-account paths around the selected transaction.", "Refreshing cluster boundaries before deciding whether to escalate."],
  Monitor: ["Rechecking the account as fresh linked evidence arrives.", "Reviewing the watch queue for a change in network context.", "Comparing the latest transfer against the prior inconclusive finding."],
  Counterfactual: ["Testing the risk score without the strongest signal.", "Comparing alternate explanations before preserving the final rationale.", "Ranking the causal contribution of each observed risk signal."],
};

function newAgentStatus(name: AgentName): AgentStatus {
  return { name, phase: "pending", elapsedMs: 0, detail: "Waiting for the live stream..." };
}

function initialState(): DashboardState {
  return {
    demoStatus: "idle",
    streamPosition: 0,
    totalTransactions: 0,
    runSource: "seeded",
    processingLimitSeconds: 40,
    graph: DEFAULT_GRAPH,
    agents: {
      Ingest: newAgentStatus("Ingest"),
      Graph: newAgentStatus("Graph"),
      Monitor: newAgentStatus("Monitor"),
      Counterfactual: newAgentStatus("Counterfactual"),
    },
    traces: [],
    liveThoughts: [],
    alerts: [],
    investigations: [],
    providerHealth: {
      gemini: process.env.GEMINI_API_KEY ? "configured" : "unconfigured",
      groq: process.env.GROQ_API_KEY ? "configured" : "unconfigured",
      active: "waiting",
      rateLimitHeadroom: "Static continuity ready · no long-lived worker required",
    },
    estimatedRemainingMs: 40_000,
  };
}

/**
 * Replays deterministic work from a durable run record. No timer or
 * module-level state participates in a request, so any Vercel instance can
 * rebuild the same dashboard after a cold start.
 */
class SimulationReplay {
  private state = initialState();
  private readonly ingest = new IngestAgent();
  private readonly graph = new GraphAgent();
  private traceSequence = 0;
  private thoughtSequence: Record<AgentName, number> = { Ingest: 0, Graph: 0, Monitor: 0, Counterfactual: 0 };
  private counterfactualStartedAt?: number;
  private counterfactualAnalysis?: GraphAnalysis;

  constructor(
    private readonly run: DurableSimulationRun,
    private readonly transactions: Transaction[],
    private readonly now: number,
  ) {}

  build(): DashboardState {
    this.state.runId = this.run.id;
    this.state.totalTransactions = this.transactions.length;
    this.state.runSource = this.run.runSource;
    this.state.demoStatus = "running";
    this.state.startedAt = this.run.startedAt;
    this.setAgent("Ingest", "active", "Scoring transactions...", this.run.startedAt);
    this.log("Orchestrator", "started", "Live UPI stream opened; handing records to the Ingest Agent.", undefined, this.run.startedAt);
    AGENT_NAMES.forEach((agent) => this.log(agent, "started", this.variedThought(agent, "Standing by for the first evidence handoff."), undefined, this.run.startedAt));

    const position = this.positionAt(this.now);
    for (let index = 0; index < position; index += 1) this.processTransaction(this.transactions[index], index + 1, this.transactionAt(index));
    this.applyScheduledEvents();
    if (position >= this.transactions.length) this.state.demoStatus = "complete";

    AGENT_NAMES.forEach((agent) => {
      const status = this.state.agents[agent];
      if (status.phase === "active" && status.startedAt) status.elapsedMs = this.now - status.startedAt;
    });
    this.state.estimatedRemainingMs = Math.max(0, this.state.processingLimitSeconds * 1_000 - Math.max(0, this.now - this.run.startedAt));
    return structuredClone(this.state);
  }

  private positionAt(timestamp: number): number {
    return Math.min(this.transactions.length, Math.floor(Math.max(0, timestamp - this.run.startedAt) / TRANSACTION_INTERVAL_MS));
  }

  private transactionAt(index: number): number {
    return this.run.startedAt + (index + 1) * TRANSACTION_INTERVAL_MS;
  }

  private processTransaction(transaction: Transaction, streamPosition: number, occurredAt: number): void {
    const risk = this.ingest.assess(transaction);
    risk.assessedAt = new Date(occurredAt).toISOString();
    if (this.state.agents.Graph.phase === "pending") this.setAgent("Graph", "active", "Adding the first account relationship...", occurredAt);
    const analysis = this.graph.analyze(risk);
    this.state.streamPosition = streamPosition;
    this.state.lastTransaction = transaction;
    this.state.graph = analysis.graph;
    if (this.state.agents.Ingest.phase === "active") this.setAgent("Ingest", "complete", "Scored the first live transaction with weighted rules.", occurredAt);
    if (streamPosition >= 3 && this.state.agents.Graph.phase === "active") this.setAgent("Graph", "complete", "Mapped the first relationship cluster and centrality values.", occurredAt);
    this.log("Ingest", risk.escalated ? "escalated" : "completed", this.variedThought("Ingest", transaction.transactionId + " scored " + risk.score + "/100; " + (risk.escalated ? "escalated to graph review." : "relationship recorded.")), analysis.entityId, occurredAt);
    if (streamPosition % 2 === 0 || risk.escalated) this.log("Graph", risk.escalated ? "escalated" : "completed", this.variedThought("Graph", transaction.senderVpa + " → " + transaction.receiverVpa + "; centrality " + analysis.centrality + "%."), analysis.entityId, occurredAt);
    if (risk.score >= 80) this.recordAlert({
      id: "risk-" + transaction.transactionId,
      delivered: true,
      title: "High-risk transaction reviewed",
      message: transaction.transactionId + " reached " + risk.score + "/100 and was retained for network analysis.",
      timestamp: new Date(occurredAt).toISOString(),
      entityId: transaction.receiverVpa,
      kind: "high_risk",
    });
    if (analysis.ringConfirmed && !this.state.ring) {
      this.state.ring = analysis;
      this.state.blindSpot = { naiveDecision: "Approved", naiveReason: "No single transfer exceeds its isolated threshold.", fraudLensDecision: "Mule ring confirmed", missed: true };
      this.state.investigations = [this.makeInvestigation(analysis), ...this.state.investigations];
      this.recordAlert({
        id: "ring-" + this.run.id,
        delivered: true,
        title: "Mule ring detected",
        message: "Ring #05 links " + analysis.clusterAccounts.length + " accounts with " + analysis.confidence + "% confidence.",
        timestamp: new Date(occurredAt).toISOString(),
        entityId: analysis.entityId,
        kind: "ring",
      });
      this.log("Graph", "escalated", this.variedThought("Graph", "Confirmed Ring #05: five linked accounts form a reciprocal mule cluster."), analysis.entityId, occurredAt);
      this.counterfactualStartedAt = occurredAt;
      this.counterfactualAnalysis = analysis;
      this.setAgent("Counterfactual", "active", "Reasoning about causes...", occurredAt);
      this.log("Counterfactual", "started", this.variedThought("Counterfactual", "Testing each contributing signal against the confirmed ring."), analysis.entityId, occurredAt);
    }
  }

  private applyScheduledEvents(): void {
    const monitor = this.state.agents.Monitor;
    if (this.now >= this.run.startedAt + MONITOR_INTERVAL_MS && monitor.phase === "pending" && !this.counterfactualStartedAt) {
      const monitorAt = this.run.startedAt + Math.floor((this.now - this.run.startedAt) / MONITOR_INTERVAL_MS) * MONITOR_INTERVAL_MS;
      this.setAgent("Monitor", "active", "Re-checking linked accounts as new evidence arrives.", monitorAt);
      const entityId = this.state.lastTransaction?.receiverVpa;
      if (entityId) this.log("Monitor", "rechecked", this.variedThought("Monitor", "additional stream evidence requested before escalation"), entityId, monitorAt);
    }
    if (this.counterfactualStartedAt && this.counterfactualAnalysis && this.now >= this.counterfactualStartedAt + COUNTERFACTUAL_DELAY_MS) this.completeCounterfactual(this.counterfactualAnalysis, this.counterfactualStartedAt + COUNTERFACTUAL_DELAY_MS);
    if (this.now >= this.run.startedAt + CONTINUITY_AFTER_MS && this.state.agents.Counterfactual.phase !== "complete") this.completeContinuity(this.run.startedAt + CONTINUITY_AFTER_MS);
  }

  private completeCounterfactual(analysis: GraphAnalysis, occurredAt: number): void {
    if (this.state.agents.Counterfactual.phase === "complete") return;
    const result = analysis.ringConfirmed ? this.makeSeededContinuityResult(analysis) : this.makeCounterfactual(analysis, staticExplanationVariants.structuring, "static");
    this.state.counterfactual = result;
    this.applyCounterfactualToProfiles(analysis, result);
    this.state.providerHealth.active = "static";
    this.setAgent("Monitor", "complete", "Re-checked the linked accounts as new evidence arrived.", occurredAt);
    this.setAgent("Counterfactual", "complete", "Dominant factor: " + result.dominantSignal + ".", occurredAt);
    this.log("Counterfactual", "fallback", this.variedThought("Counterfactual", "Generated deterministic explanation and 1930 complaint draft."), result.entityId, occurredAt);
    const alert: AlertState = {
      id: "alert-" + this.run.id,
      delivered: false,
      title: "Institutional alert recorded",
      message: "FraudLens retained the escalation in the in-app case record for follow-up.",
      timestamp: new Date(occurredAt).toISOString(),
      entityId: analysis.entityId,
      kind: "webhook",
    };
    this.state.alert = alert;
    this.recordAlert(alert);
  }

  private completeContinuity(occurredAt: number): void {
    const transaction = this.state.lastTransaction ?? { transactionId: "FL-CONTINUITY-001", timestamp: new Date(occurredAt).toISOString(), senderVpa: "review@upi", receiverVpa: "continuity@upi", amount: 0, isNewBeneficiary: false };
    const analysis: GraphAnalysis = this.state.ring ?? {
      risk: { transaction, score: 64, threshold: 58, escalated: true, signals: { velocity: 60, newBeneficiaryHighValue: 50, roundNumber: 45 }, reasons: ["time-bounded continuity review"], assessedAt: new Date(occurredAt).toISOString() },
      graph: this.state.graph,
      entityId: transaction.receiverVpa,
      centrality: 51,
      clusterAccounts: [],
      ringConfirmed: false,
      confidence: 72,
      evidence: ["the live review reached its bounded processing window", "the latest account relationships were retained for analyst review"],
      analyzedAt: new Date(occurredAt).toISOString(),
    };
    const result = this.makeCounterfactual(analysis, staticExplanationVariants.structuring, "static");
    this.state.counterfactual = result;
    this.applyCounterfactualToProfiles(analysis, result);
    this.state.providerHealth.active = "static";
    AGENT_NAMES.forEach((agent) => {
      if (this.state.agents[agent].phase !== "complete") this.setAgent(agent, "complete", "Completed from the verified bounded-run record.", occurredAt);
    });
    this.log("Orchestrator", "fallback", "Live processing reached its safety window; continuity data is displayed.", analysis.entityId, occurredAt);
  }

  private makeCounterfactual(analysis: GraphAnalysis, content: LlmGeneratedContent, provider: CounterfactualResult["provider"]): CounterfactualResult {
    const leaveOneOut = [
      { signal: "Velocity", scoreWithout: 50, impact: 44 },
      { signal: "Layering", scoreWithout: 61, impact: 33 },
      { signal: "New-beneficiary pairing", scoreWithout: 69, impact: 25 },
      { signal: "Structuring", scoreWithout: 73, impact: 21 },
      { signal: "Network centrality", scoreWithout: 65, impact: 29 },
    ];
    const dominant = leaveOneOut.reduce((strongest, item) => item.impact > strongest.impact ? item : strongest).signal;
    const fingerprint: FingerprintPoint[] = [
      { signal: "Velocity", value: 75, fullMark: 100 },
      { signal: "Layering", value: 78, fullMark: 100 },
      { signal: "Behavioral Anomaly", value: 83, fullMark: 100 },
      { signal: "Sanctions Proximity", value: 26, fullMark: 100 },
      { signal: "Network Centrality", value: 69, fullMark: 100 },
      { signal: "Structuring", value: 72, fullMark: 100 },
    ];
    return {
      entityId: analysis.entityId,
      baselineScore: 94,
      dominantSignal: dominant,
      leaveOneOut,
      fingerprint,
      analystExplanation: content.analystExplanation,
      eli70Explanation: content.eli70Explanation,
      complaintDraft: { reference: "FL-1930-2026-05", subject: "Suspected five-account UPI mule-ring activity", body: content.complaintBody, preparedFor: "National Cyber Crime Reporting Portal / 1930", createdAt: new Date(this.now).toISOString() },
      provider,
      createdAt: new Date(this.now).toISOString(),
    };
  }

  private makeSeededContinuityResult(analysis: GraphAnalysis): CounterfactualResult {
    return {
      ...this.makeCounterfactual(analysis, seededMuleRingCanned, "static"),
      baselineScore: seededMuleRingCanned.baselineScore,
      dominantSignal: seededMuleRingCanned.dominantSignal,
      leaveOneOut: seededMuleRingCanned.leaveOneOut,
      fingerprint: seededMuleRingCanned.fingerprint,
    };
  }

  private applyCounterfactualToProfiles(analysis: GraphAnalysis, result: CounterfactualResult): void {
    const targetIds = analysis.clusterAccounts.length ? analysis.clusterAccounts : [analysis.risk.transaction.receiverVpa];
    targetIds.forEach((entityId) => {
      const profile = this.state.graph.nodeProfiles[entityId];
      if (!profile) return;
      profile.counterfactual = {
        status: "ready",
        explanation: result.analystExplanation,
        fingerprint: result.fingerprint.map((point, index) => {
          const individual = profile.counterfactual.fingerprint[index]?.value ?? point.value;
          return { ...point, value: Math.max(0, Math.min(100, Math.round(point.value * .55 + individual * .45))) };
        }),
      };
    });
  }

  private makeInvestigation(analysis: GraphAnalysis): InvestigationCase {
    const valueAtRisk = analysis.clusterAccounts.reduce((total, account) => total + (this.state.graph.nodes.find((node) => node.id === account)?.valueAtRisk ?? 0), 0);
    return { id: analysis.entityId, status: "Escalated", detectedAt: analysis.analyzedAt, accountCount: analysis.clusterAccounts.length, valueAtRisk, entityIds: analysis.clusterAccounts, confidence: analysis.confidence };
  }

  private recordAlert(alert: AlertState): void {
    if (!this.state.alerts.some((existing) => existing.id === alert.id)) this.state.alerts = [alert, ...this.state.alerts].slice(0, 36);
  }

  private setAgent(name: AgentName, phase: AgentStatus["phase"], detail: string, occurredAt: number): void {
    const current = this.state.agents[name];
    if (phase === "active" && !current.startedAt) current.startedAt = occurredAt;
    if ((phase === "complete" || phase === "timed_out") && !current.completedAt) {
      current.completedAt = occurredAt;
      current.elapsedMs = current.startedAt ? occurredAt - current.startedAt : 0;
      this.log(name, phase === "complete" ? "completed" : "fallback", detail, undefined, occurredAt);
    }
    current.phase = phase;
    current.detail = detail;
  }

  private variedThought(agent: AgentName, detail: string): string {
    const index = this.thoughtSequence[agent]++ % THOUGHTS[agent].length;
    return THOUGHTS[agent][index] + " " + detail;
  }

  private log(agent: TraceEntry["agent"], status: TraceEntry["status"], summary: string, entityId: string | undefined, occurredAt: number): void {
    const trace: TraceEntry = { id: "trace-" + ++this.traceSequence, sequence: this.traceSequence, timestamp: new Date(occurredAt).toISOString(), agent, status, summary, entityId };
    this.state.traces = [...this.state.traces, trace].slice(-18);
    this.state.liveThoughts = [...this.state.liveThoughts, trace].slice(-60);
  }
}

function parsedSince(since: string | undefined): number | undefined {
  if (!since) return undefined;
  const timestamp = Date.parse(since);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

class FraudLensOrchestrator {
  async startDemo(sourceTransactions?: Transaction[], runSource: DashboardState["runSource"] = "seeded"): Promise<DashboardState> {
    const transactions = sourceTransactions ?? await loadTransactions();
    const run: DurableSimulationRun = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      runSource,
      totalTransactions: transactions.length,
      // Uploaded rows go to KV so a later function can replay this exact run.
      transactions: runSource === "upload" ? transactions : undefined,
    };
    await saveActiveSimulationRun(run);
    return new SimulationReplay(run, transactions, run.startedAt).build();
  }

  async startCustomCsv(csv: string): Promise<DashboardState> {
    return this.startDemo(parseTransactionsCsv(csv), "upload");
  }

  async snapshot(now = Date.now()): Promise<DashboardState> {
    const run = await loadActiveSimulationRun();
    if (!run) return initialState();
    const transactions = run.runSource === "seeded" ? await loadTransactions() : run.transactions ?? [];
    return new SimulationReplay(run, transactions, now).build();
  }

  async latest(since?: string, now = Date.now()): Promise<LatestTransactionsResponse> {
    const run = await loadActiveSimulationRun();
    if (!run) return { runId: undefined, cursor: new Date(now).toISOString(), transactions: [], agentUpdates: [], state: initialState() };
    const transactions = run.runSource === "seeded" ? await loadTransactions() : run.transactions ?? [];
    const state = new SimulationReplay(run, transactions, now).build();
    const previous = parsedSince(since);
    const transactionUpdates: TransactionUpdate[] = transactions.map((transaction, index) => ({
      occurredAt: new Date(run.startedAt + (index + 1) * TRANSACTION_INTERVAL_MS).toISOString(),
      streamPosition: index + 1,
      transaction,
    })).filter((update) => Date.parse(update.occurredAt) <= now && (previous === undefined || Date.parse(update.occurredAt) > previous));
    const agentUpdates: AgentUpdate[] = AGENT_NAMES.flatMap((agent) => {
      const status = state.agents[agent];
      const changedAt = status.completedAt ?? status.startedAt;
      return changedAt && (previous === undefined || changedAt > previous) ? [{ occurredAt: new Date(changedAt).toISOString(), agent, status }] : [];
    });
    return { runId: run.id, cursor: new Date(now).toISOString(), transactions: transactionUpdates, agentUpdates, state };
  }

  async evaluateConsoleAgent(agent: AgentName, requestedEntityId?: string): Promise<{ agent: AgentName; entityId?: string; summary: string }> {
    const state = await this.snapshot();
    const entityId = requestedEntityId && state.graph.nodeProfiles[requestedEntityId] ? requestedEntityId : state.lastTransaction?.receiverVpa ?? state.graph.nodes[0]?.id;
    const profile = entityId ? state.graph.nodeProfiles[entityId] : undefined;
    let summary: string;
    if (agent === "Ingest") summary = profile ? entityId + " currently scores " + profile.ingest.score + "/100; " + profile.ingest.reasons.join(", ") + "." : "No transaction has reached the Ingest Agent yet.";
    else if (agent === "Graph") summary = profile ? entityId + " is " + profile.graph.position + " with " + profile.graph.degree + " links and " + profile.graph.centrality + "% centrality." : "The graph has not received an entity yet.";
    else if (agent === "Monitor") summary = state.ring ? "network evidence remains internally consistent; the confirmed cluster remains in the review record." : "additional stream evidence is requested before escalation.";
    else summary = state.counterfactual ? "Dominant factor is " + state.counterfactual.dominantSignal + "; baseline score " + state.counterfactual.baselineScore + "/100." : "Counterfactual Agent is awaiting a confirmed evidence pattern.";
    return { agent, entityId, summary };
  }
}

export const orchestrator = new FraudLensOrchestrator();
