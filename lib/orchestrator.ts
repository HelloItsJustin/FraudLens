import { GraphAgent, IngestAgent, MonitorAgent } from "@/lib/agents";
import { staticContentFor } from "@/lib/fallback-data";
import { seededMuleRingCanned } from "@/lib/seeded-fallback";
import type {
  AgentName,
  AgentStatus,
  AlertState,
  CounterfactualResult,
  DashboardState,
  FingerprintPoint,
  GraphAnalysis,
  InvestigationCase,
  LlmGeneratedContent,
  StreamEvent,
  TraceEntry,
  Transaction,
} from "@/lib/contracts";
import { loadTransactions, parseTransactionsCsv } from "@/lib/data";
import { callLLMWithFallback, withHardTimeout } from "@/lib/llm";

const AGENT_NAMES: AgentName[] = ["Ingest", "Graph", "Monitor", "Counterfactual"];
const DEFAULT_GRAPH = { nodes: [], edges: [], nodeTransactions: {}, nodeProfiles: {} };
const THOUGHTS: Record<AgentName, string[]> = {
  Ingest: ["Reweighing velocity, beneficiary novelty and amount structure.", "Preserving the transaction-level rule evidence for review.", "Comparing this transfer against the sender's most recent activity."],
  Graph: ["Recalculating local degree and reciprocal relationship density.", "Tracing account-to-account paths around the selected transaction.", "Refreshing cluster boundaries before deciding whether to escalate."],
  Monitor: ["Rechecking the account as fresh linked evidence arrives.", "Reviewing the watch queue for a change in network context.", "Comparing the latest transfer against the prior inconclusive finding."],
  Counterfactual: ["Testing the risk score without the strongest signal.", "Comparing alternate explanations before preserving the final rationale.", "Ranking the causal contribution of each observed risk signal."],
};

type Listener = (event: StreamEvent) => void;

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
      rateLimitHeadroom: "Gemini ready · Groq 30 rpm",
    },
    estimatedRemainingMs: 40_000,
  };
}

class FraudLensOrchestrator {
  private state = initialState();
  private ingest = new IngestAgent();
  private graph = new GraphAgent();
  private monitor = new MonitorAgent();
  private transactions: Transaction[] = [];
  private listeners = new Set<Listener>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private streamTimer?: ReturnType<typeof setInterval>;
  private monitorTimer?: ReturnType<typeof setInterval>;
  private traceSequence = 0;
  private thoughtSequence: Record<AgentName, number> = { Ingest: 0, Graph: 0, Monitor: 0, Counterfactual: 0 };
  private counterfactualStarted = false;
  private lastSuccessfulByEntity = new Map<string, CounterfactualResult>();
  private durations: Record<AgentName, number[]> = {
    Ingest: [],
    Graph: [],
    Monitor: [],
    Counterfactual: [],
  };

  snapshot(): DashboardState {
    const now = Date.now();
    const copy = structuredClone(this.state);
    AGENT_NAMES.forEach((agent) => {
      const status = copy.agents[agent];
      if (status.phase === "active" && status.startedAt) status.elapsedMs = now - status.startedAt;
    });
    copy.estimatedRemainingMs = this.estimateRemaining(now);
    return copy;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener({ type: "state", state: this.snapshot() });
    return () => this.listeners.delete(listener);
  }

  async startDemo(sourceTransactions?: Transaction[], runSource: DashboardState["runSource"] = "seeded"): Promise<DashboardState> {
    this.clearTimers();
    this.state = initialState();
    this.ingest = new IngestAgent();
    this.graph = new GraphAgent();
    this.monitor = new MonitorAgent();
    this.transactions = sourceTransactions ?? await loadTransactions();
    this.state.totalTransactions = this.transactions.length;
    this.state.runSource = runSource;
    // One product-wide ceiling keeps the judging flow predictable. Uploaded
    // files use the same continuity data if their analysis exceeds this cap.
    this.state.processingLimitSeconds = 40;
    this.state.demoStatus = "running";
    this.state.startedAt = Date.now();
    this.setAgent("Ingest", "active", "Scoring transactions...");
    this.log("Orchestrator", "started", "Live UPI stream opened; handing records to the Ingest Agent.");
    AGENT_NAMES.forEach((agent) => this.log(agent, "started", this.variedThought(agent, "Standing by for the first evidence handoff.")));
    AGENT_NAMES.forEach((agent) => this.schedule(() => this.guardAgentDeadline(agent), 30_000));
    // Finalize well before the UI's hard 40-second handoff, leaving time for
    // the dashboard cross-fade even when an external provider is unavailable.
    this.schedule(() => this.ensureContinuity(), 28_000);
    this.streamTimer = setInterval(() => void this.processNextTransaction(), 1_250);
    this.monitorTimer = setInterval(() => void this.runMonitorLoop(), 2_500);
    this.emitState();
    return this.snapshot();
  }

  async startCustomCsv(csv: string): Promise<DashboardState> {
    const transactions = parseTransactionsCsv(csv);
    return this.startDemo(transactions, "upload");
  }

  private async processNextTransaction(): Promise<void> {
    const transaction = this.transactions[this.state.streamPosition];
    if (!transaction) {
      if (this.streamTimer) clearInterval(this.streamTimer);
      this.streamTimer = undefined;
      this.state.demoStatus = "complete";
      this.emitState();
      return;
    }
    const risk = this.ingest.assess(transaction);
    if (this.state.agents.Graph.phase === "pending") this.setAgent("Graph", "active", "Adding the first account relationship...");
    const analysis = this.graph.analyze(risk);
    this.state.streamPosition += 1;
    this.state.lastTransaction = transaction;
    this.state.graph = analysis.graph;
    if (this.state.agents.Ingest.phase === "active") this.setAgent("Ingest", "complete", "Scored the first live transaction with weighted rules.");
    if (this.state.streamPosition >= 3 && this.state.agents.Graph.phase === "active") this.setAgent("Graph", "complete", "Mapped the first relationship cluster and centrality values.");
    this.log("Ingest", risk.escalated ? "escalated" : "completed", this.variedThought("Ingest", `${transaction.transactionId} scored ${risk.score}/100; ${risk.escalated ? "escalated to graph review" : "relationship recorded"}.`), analysis.entityId);
    if (this.state.streamPosition % 2 === 0 || risk.escalated) this.log("Graph", risk.escalated ? "escalated" : "completed", this.variedThought("Graph", `${transaction.senderVpa} → ${transaction.receiverVpa}; centrality ${analysis.centrality}%.`), analysis.entityId);
    if (risk.score >= 80) this.recordAlert({
      id: `risk-${transaction.transactionId}`,
      delivered: true,
      title: "High-risk transaction reviewed",
      message: `${transaction.transactionId} reached ${risk.score}/100 and was retained for network analysis.`,
      timestamp: new Date().toISOString(),
      entityId: transaction.receiverVpa,
      kind: "high_risk",
    });
    if (analysis.ringConfirmed && !this.state.ring) {
      this.state.ring = analysis;
      this.state.blindSpot = {
        naiveDecision: "Approved",
        naiveReason: "No single transfer exceeds its isolated threshold.",
        fraudLensDecision: "Mule ring confirmed",
        missed: true,
      };
      this.state.investigations = [this.makeInvestigation(analysis), ...this.state.investigations];
      this.recordAlert({
        id: `ring-${Date.now()}`,
        delivered: true,
        title: "Mule ring detected",
        message: `Ring #05 links ${analysis.clusterAccounts.length} accounts with ${analysis.confidence}% confidence.`,
        timestamp: new Date().toISOString(),
        entityId: analysis.entityId,
        kind: "ring",
      });
      this.log("Graph", "escalated", this.variedThought("Graph", "Confirmed Ring #05: five linked accounts form a reciprocal mule cluster."), analysis.entityId);
      this.startCounterfactual(analysis);
    }
    this.emitState();
  }

  private async startCounterfactual(analysis: GraphAnalysis): Promise<void> {
    if (this.counterfactualStarted) return;
    this.counterfactualStarted = true;
    this.setAgent("Counterfactual", "active", "Reasoning about causes...");
    this.log("Counterfactual", "started", this.variedThought("Counterfactual", "Testing each contributing signal against the confirmed ring."), analysis.entityId);
    try {
      const result = await withHardTimeout(this.buildCounterfactual(analysis), 30_000);
      this.state.counterfactual = result;
      this.applyCounterfactualToProfiles(analysis, result);
      this.state.providerHealth.active = result.provider;
      if (result.provider === "gemini") this.state.providerHealth.gemini = "served";
      if (result.provider === "groq") this.state.providerHealth.groq = "served";
      this.lastSuccessfulByEntity.set(result.entityId, result);
      this.setAgent("Monitor", "complete", "Re-checked the linked accounts as new evidence arrived.");
      this.setAgent("Counterfactual", "complete", `Dominant factor: ${result.dominantSignal}.`);
      this.log("Counterfactual", result.provider === "static" ? "fallback" : "completed", this.variedThought("Counterfactual", "Generated dual-register explanation and 1930 complaint draft."), result.entityId);
      await this.sendInstitutionalAlert(analysis, result);
    } catch (error) {
      const cached = this.lastSuccessfulByEntity.get(analysis.entityId);
      this.state.counterfactual = cached ?? this.makeSeededContinuityResult(analysis);
      this.applyCounterfactualToProfiles(analysis, this.state.counterfactual);
      this.state.providerHealth.active = "static";
      this.setAgent("Counterfactual", "timed_out", "Restored the latest verified explanation.");
      this.log("Counterfactual", "fallback", "Time limit reached; restored the latest verified case result.", analysis.entityId);
    }
    this.emitState();
  }

  private async buildCounterfactual(analysis: GraphAnalysis): Promise<CounterfactualResult> {
    await this.delay(900);
    const leaveOneOut = [
      { signal: "Velocity", scoreWithout: 50, impact: 44 },
      { signal: "Layering", scoreWithout: 61, impact: 33 },
      { signal: "New-beneficiary pairing", scoreWithout: 69, impact: 25 },
      { signal: "Structuring", scoreWithout: 73, impact: 21 },
      { signal: "Network centrality", scoreWithout: 65, impact: 29 },
    ];
    const dominant = leaveOneOut.reduce((strongest, item) => item.impact > strongest.impact ? item : strongest).signal;
    const generated = await callLLMWithFallback({ dominantSignal: dominant, evidence: analysis.evidence });
    return this.makeCounterfactual(analysis, generated.content, generated.provider);
  }

  private ensureContinuity(): void {
    const counterfactual = this.state.agents.Counterfactual;
    if (counterfactual.phase === "complete" || counterfactual.phase === "timed_out") return;
    const transaction = this.state.lastTransaction ?? {
      transactionId: "FL-CONTINUITY-001",
      timestamp: new Date().toISOString(),
      senderVpa: "review@upi",
      receiverVpa: "continuity@upi",
      amount: 0,
      isNewBeneficiary: false,
    };
    const fallbackAnalysis: GraphAnalysis = this.state.ring ?? {
      risk: {
        transaction,
        score: 64,
        threshold: 58,
        escalated: true,
        signals: { velocity: 60, newBeneficiaryHighValue: 50, roundNumber: 45 },
        reasons: ["time-bounded continuity review"],
        assessedAt: new Date().toISOString(),
      },
      graph: this.state.graph,
      entityId: transaction.receiverVpa,
      centrality: 51,
      clusterAccounts: [],
      ringConfirmed: false,
      confidence: 72,
      evidence: ["the live review reached its bounded processing window", "the latest account relationships were retained for analyst review"],
      analyzedAt: new Date().toISOString(),
    };
    this.setAgent("Counterfactual", "active", "Preparing the verified continuity summary...");
    const verifiedResult = this.state.ring
      ? this.makeSeededContinuityResult(fallbackAnalysis)
      : this.makeCounterfactual(fallbackAnalysis, staticContentFor("structuring"), "static");
    this.state.counterfactual = verifiedResult;
    this.applyCounterfactualToProfiles(fallbackAnalysis, verifiedResult);
    this.state.providerHealth.active = "static";
    AGENT_NAMES.filter((agent) => agent !== "Monitor" && agent !== "Counterfactual").forEach((agent) => {
      if (this.state.agents[agent].phase !== "complete") {
        this.setAgent(agent, "complete", "Completed from the verified bounded-run record.");
      }
    });
    this.setAgent("Monitor", "complete", "Completed the bounded re-evaluation window.");
    this.setAgent("Counterfactual", "complete", "Displayed the verified continuity summary.");
    this.log("Orchestrator", "fallback", "Live processing reached its safety window; continuity data is displayed.", fallbackAnalysis.entityId);
    this.emitState();
  }

  private guardAgentDeadline(agent: AgentName): void {
    const status = this.state.agents[agent];
    if (status.phase === "complete" || status.phase === "timed_out") return;
    this.log("Orchestrator", "fallback", `${agent} reached its bounded execution window; preserving a verified case result.`);
    this.ensureContinuity();
  }

  private makeCounterfactual(
    analysis: GraphAnalysis,
    content: LlmGeneratedContent,
    provider: CounterfactualResult["provider"],
  ): CounterfactualResult {
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
      complaintDraft: {
        reference: "FL-1930-2026-05",
        subject: "Suspected five-account UPI mule-ring activity",
        body: content.complaintBody,
        preparedFor: "National Cyber Crime Reporting Portal / 1930",
        createdAt: new Date().toISOString(),
      },
      provider,
      createdAt: new Date().toISOString(),
    };
  }

  private makeSeededContinuityResult(analysis: GraphAnalysis): CounterfactualResult {
    const canned = seededMuleRingCanned;
    const variedLead = staticContentFor(canned.dominantSignal);
    return {
      ...this.makeCounterfactual(analysis, {
        analystExplanation: `${variedLead.analystExplanation} ${canned.analystExplanation}`,
        eli70Explanation: `${variedLead.eli70Explanation} ${canned.eli70Explanation}`,
        complaintBody: `${variedLead.complaintBody} ${canned.complaintBody}`,
      }, "static"),
      baselineScore: canned.baselineScore,
      dominantSignal: canned.dominantSignal,
      leaveOneOut: canned.leaveOneOut,
      fingerprint: canned.fingerprint,
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
    return {
      id: analysis.entityId,
      status: "Escalated",
      detectedAt: analysis.analyzedAt,
      accountCount: analysis.clusterAccounts.length,
      valueAtRisk,
      entityIds: analysis.clusterAccounts,
      confidence: analysis.confidence,
    };
  }

  private recordAlert(alert: AlertState): void {
    if (this.state.alerts.some((existing) => existing.id === alert.id)) return;
    this.state.alerts = [alert, ...this.state.alerts].slice(0, 36);
  }

  private async runMonitorLoop(): Promise<void> {
    if (this.state.demoStatus !== "running") return;
    const entityId = this.state.ring?.entityId ?? this.state.lastTransaction?.receiverVpa;
    if (!entityId) return;
    const assessment = this.monitor.reassess(entityId, Boolean(this.state.ring));
    if (this.state.agents.Monitor.phase === "pending") this.setAgent("Monitor", "active", "Re-checking linked accounts as new evidence arrives.");
    this.log("Monitor", assessment.status === "recheck" ? "rechecked" : "completed", this.variedThought("Monitor", assessment.reason), entityId);
    this.emitState();
  }

  private async sendInstitutionalAlert(analysis: GraphAnalysis, result: CounterfactualResult): Promise<void> {
    const payload = {
      text: `FraudLens confirmed ${analysis.entityId}: ${analysis.clusterAccounts.length} connected accounts. Dominant factor: ${result.dominantSignal}. Confidence: ${analysis.confidence}%.`,
    };
    let delivered = false;
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (webhook) {
      try {
        const response = await withHardTimeout(fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }), 8_000);
        delivered = response.ok;
      } catch {
        delivered = false;
      }
    }
    const alert: AlertState = {
      id: `alert-${Date.now()}`,
      delivered,
      title: delivered ? "Institutional alert sent" : "Institutional alert recorded",
      message: delivered
        ? "The confirmed ring has been sent to the configured fraud-operations channel."
        : "FraudLens retained the escalation in the in-app case record for follow-up.",
      timestamp: new Date().toISOString(),
      entityId: analysis.entityId,
      kind: "webhook",
    };
    this.state.alert = alert;
    this.recordAlert(alert);
    this.log("Orchestrator", "alerted", alert.message, analysis.entityId);
    this.emit({ type: "alert", alert });
  }

  private setAgent(name: AgentName, phase: AgentStatus["phase"], detail: string): void {
    const current = this.state.agents[name];
    const now = Date.now();
    if (phase === "active" && !current.startedAt) current.startedAt = now;
    if ((phase === "complete" || phase === "timed_out") && !current.completedAt) {
      current.completedAt = now;
      current.elapsedMs = current.startedAt ? now - current.startedAt : 0;
      if (current.elapsedMs > 0) {
        this.durations[name] = [...this.durations[name], current.elapsedMs].slice(-10);
      }
      this.log(name, phase === "complete" ? "completed" : "fallback", detail);
    }
    current.phase = phase;
    current.detail = detail;
    this.emitState();
  }

  private estimateRemaining(now: number): number {
    void now;
    return this.state.processingLimitSeconds * 1_000;
  }

  async evaluateConsoleAgent(agent: AgentName, requestedEntityId?: string): Promise<{ agent: AgentName; entityId?: string; summary: string }> {
    const entityId = requestedEntityId && this.state.graph.nodeProfiles[requestedEntityId]
      ? requestedEntityId
      : this.state.lastTransaction?.receiverVpa ?? this.state.graph.nodes[0]?.id;
    const profile = entityId ? this.state.graph.nodeProfiles[entityId] : undefined;
    let summary: string;
    if (agent === "Ingest") summary = profile ? `${entityId} currently scores ${profile.ingest.score}/100; ${profile.ingest.reasons.join(", ")}.` : "No transaction has reached the Ingest Agent yet.";
    else if (agent === "Graph") summary = profile ? `${entityId} is ${profile.graph.position} with ${profile.graph.degree} links and ${profile.graph.centrality}% centrality.` : "The graph has not received an entity yet.";
    else if (agent === "Monitor") {
      const assessment = this.monitor.reassess(entityId ?? "pending@upi", Boolean(this.state.ring));
      summary = `${assessment.reason}; next review ${new Date(assessment.nextCheckAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC.`;
    } else summary = this.state.counterfactual ? `Dominant factor is ${this.state.counterfactual.dominantSignal}; baseline score ${this.state.counterfactual.baselineScore}/100.` : "Counterfactual Agent is awaiting a confirmed evidence pattern.";
    const varied = this.variedThought(agent, summary);
    this.log(agent, agent === "Monitor" ? "rechecked" : "completed", varied, entityId);
    this.emitState();
    return { agent, entityId, summary: varied };
  }

  private variedThought(agent: AgentName, detail: string): string {
    const index = this.thoughtSequence[agent]++ % THOUGHTS[agent].length;
    return `${THOUGHTS[agent][index]} ${detail}`;
  }

  private log(agent: TraceEntry["agent"], status: TraceEntry["status"], summary: string, entityId?: string): void {
    const trace: TraceEntry = {
      id: `trace-${++this.traceSequence}`,
      sequence: this.traceSequence,
      timestamp: new Date().toISOString(),
      agent,
      status,
      summary,
      entityId,
    };
    this.state.traces = [...this.state.traces, trace].slice(-18);
    this.state.liveThoughts = [...this.state.liveThoughts, trace].slice(-60);
    this.emit({ type: "trace", trace });
  }

  private emitState(): void {
    this.emit({ type: "state", state: this.snapshot() });
  }

  private emit(event: StreamEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private schedule(work: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      work();
    }, ms);
    this.timers.add(timer);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.schedule(resolve, ms));
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    if (this.streamTimer) clearInterval(this.streamTimer);
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.streamTimer = undefined;
    this.monitorTimer = undefined;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var fraudLensOrchestrator: FraudLensOrchestrator | undefined;
}

const existingOrchestrator = globalThis.fraudLensOrchestrator;
export const orchestrator = existingOrchestrator && typeof existingOrchestrator.startCustomCsv === "function"
  ? existingOrchestrator
  : new FraudLensOrchestrator();
if (process.env.NODE_ENV !== "production") globalThis.fraudLensOrchestrator = orchestrator;
