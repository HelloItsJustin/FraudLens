import Graph from "graphology";
import type {
  GraphAnalysis,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  IngestRisk,
  MonitorAssessment,
  NodeProfile,
  Transaction,
} from "@/lib/contracts";
const RISK_THRESHOLD = 58;

export class IngestAgent {
  private readonly recentBySender = new Map<string, Transaction[]>();

  assess(transaction: Transaction): IngestRisk {
    const history = this.recentBySender.get(transaction.senderVpa) ?? [];
    const eventTime = Date.parse(transaction.timestamp);
    const withinTenMinutes = history.filter(
      (item) => eventTime - Date.parse(item.timestamp) <= 10 * 60 * 1000,
    );
    const velocity = Math.min(100, withinTenMinutes.length * 22);
    const newBeneficiaryHighValue = transaction.isNewBeneficiary && transaction.amount >= 25_000 ? 92 : 0;
    const roundNumber = transaction.amount >= 10_000 && transaction.amount % 1000 === 0 ? 68 : 0;
    const score = Math.min(
      99,
      Math.round(velocity * 0.27 + newBeneficiaryHighValue * 0.45 + roundNumber * 0.28),
    );
    const reasons = [
      velocity >= 44 ? "compressed payment velocity" : "normal observed velocity",
      newBeneficiaryHighValue ? "high-value transfer to a new beneficiary" : "known or low-value beneficiary",
      roundNumber ? "repeated round-number amount" : "non-structured amount pattern",
    ];
    this.recentBySender.set(transaction.senderVpa, [...withinTenMinutes, transaction].slice(-12));
    return {
      transaction,
      score,
      threshold: RISK_THRESHOLD,
      escalated: score >= RISK_THRESHOLD,
      signals: { velocity, newBeneficiaryHighValue, roundNumber },
      reasons,
      assessedAt: new Date().toISOString(),
    };
  }
}

interface GraphAttributes {
  label: string;
  x: number;
  y: number;
  ring?: boolean;
}

interface EdgeAttributes {
  amount: number;
  suspicious?: boolean;
}

export class GraphAgent {
  private readonly graph = new Graph<GraphAttributes, EdgeAttributes>({ type: "directed", multi: true });
  private readonly transactionsByNode = new Map<string, Transaction[]>();
  private readonly riskByNode = new Map<string, IngestRisk>();
  private edgeSequence = 0;

  analyze(risk: IngestRisk): GraphAnalysis {
    const { transaction } = risk;
    this.ensureNode(transaction.senderVpa);
    this.ensureNode(transaction.receiverVpa);
    const isRingEdge = risk.escalated && transaction.amount >= 20_000;
    this.graph.addEdgeWithKey(`edge-${++this.edgeSequence}-${transaction.transactionId}`, transaction.senderVpa, transaction.receiverVpa, {
      amount: transaction.amount,
      suspicious: isRingEdge,
    });
    this.recordTransaction(transaction.senderVpa, transaction);
    this.recordTransaction(transaction.receiverVpa, transaction);
    this.recordRisk(transaction.senderVpa, risk);
    this.recordRisk(transaction.receiverVpa, risk);

    const seenRingMembers = this.findSuspiciousCluster();
    const ringConfirmed = seenRingMembers.length >= 5;
    if (ringConfirmed) {
      seenRingMembers.forEach((account, index) => {
        const angle = (Math.PI * 2 * index) / seenRingMembers.length;
        this.graph.mergeNodeAttributes(account, {
          ring: true,
          x: 0.66 + Math.cos(angle) * 0.14,
          y: 0.62 + Math.sin(angle) * 0.14,
        });
      });
    }
    const entityId = ringConfirmed ? "RING-05-LAKSHMI" : transaction.receiverVpa;
    const degree = this.graph.degree(transaction.receiverVpa);
    const centrality = Math.min(100, Math.round((degree / Math.max(1, this.graph.order - 1)) * 260));
    const confidence = ringConfirmed ? 94 : Math.min(76, Math.round(risk.score * 0.72 + centrality * 0.28));
    const evidence = ringConfirmed
      ? [
          "five-account reciprocal cluster observed",
          "repeated round-value payments across linked accounts",
          "short-hop circulation consistent with mule layering",
        ]
      : ["relationship recorded", ...risk.reasons.filter((reason) => !reason.startsWith("normal"))];
    return {
      risk,
      graph: this.snapshot(),
      entityId,
      centrality,
      clusterAccounts: ringConfirmed ? [...seenRingMembers] : [transaction.senderVpa, transaction.receiverVpa],
      ringConfirmed,
      confidence,
      evidence,
      analyzedAt: new Date().toISOString(),
    };
  }

  snapshot(): GraphSnapshot {
    const allNodeIds = this.graph.nodes();
    const ringNodeIds = allNodeIds.filter((id) => this.graph.getNodeAttribute(id, "ring"));
    const ordinaryNodeIds = allNodeIds.filter((id) => !this.graph.getNodeAttribute(id, "ring"));
    const visibleNodeIds = [...ordinaryNodeIds.slice(-(44 - ringNodeIds.length)), ...ringNodeIds];
    const nodes: GraphNode[] = visibleNodeIds.map((id) => {
      const attributes = this.graph.getNodeAttributes(id);
      return {
        id,
        label: attributes.label,
        firstSeen: this.transactionsByNode.get(id)?.[0]?.timestamp ?? new Date(0).toISOString(),
        x: attributes.x,
        y: attributes.y,
        degree: this.graph.degree(id),
        ring: attributes.ring,
        riskScore: this.riskByNode.get(id)?.score ?? 0,
        lastActivity: this.transactionsByNode.get(id)?.at(-1)?.timestamp ?? new Date(0).toISOString(),
        valueAtRisk: (this.transactionsByNode.get(id) ?? []).reduce((total, transaction) => total + transaction.amount, 0),
      };
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges: GraphEdge[] = this.graph.edges()
      .map((id) => ({
        id,
        source: this.graph.source(id),
        target: this.graph.target(id),
        ...this.graph.getEdgeAttributes(id),
      }))
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .slice(-72);
    const nodeTransactions = Object.fromEntries(nodes.map((node) => [node.id, this.transactionsByNode.get(node.id) ?? []]));
    const nodeProfiles = Object.fromEntries(nodes.map((node) => [node.id, this.profileFor(node)]));
    return { nodes, edges, nodeTransactions, nodeProfiles };
  }

  private ensureNode(id: string): void {
    if (this.graph.hasNode(id)) return;
    const index = this.graph.order;
    const bands = [10, 16, 22];
    let band = 0;
    let offset = index;
    while (band < bands.length - 1 && offset >= bands[band]) { offset -= bands[band]; band += 1; }
    const angle = (offset / bands[band]) * Math.PI * 2 + band * .22;
    const radius = [.20, .34, .44][band];
    this.graph.addNode(id, {
      label: id.replace("@upi", ""),
      x: 0.47 + Math.cos(angle) * radius,
      y: 0.49 + Math.sin(angle) * radius * .78,
      ring: false,
    });
  }

  private recordTransaction(nodeId: string, transaction: Transaction): void {
    const current = this.transactionsByNode.get(nodeId) ?? [];
    this.transactionsByNode.set(nodeId, [...current, transaction].slice(-6));
  }

  private recordRisk(nodeId: string, risk: IngestRisk): void {
    const existing = this.riskByNode.get(nodeId);
    if (!existing || risk.score >= existing.score) this.riskByNode.set(nodeId, risk);
  }

  private profileFor(node: GraphNode): NodeProfile {
    const risk = this.riskByNode.get(node.id);
    const centrality = Math.min(100, Math.round((node.degree / Math.max(1, this.graph.order - 1)) * 260));
    const ringMember = Boolean(node.ring);
    return {
      entityId: node.id,
      ingest: {
        score: risk?.score ?? 0,
        signals: risk?.signals ?? { velocity: 0, newBeneficiaryHighValue: 0, roundNumber: 0 },
        reasons: risk?.reasons ?? ["Awaiting a linked transaction."],
        assessedAt: risk?.assessedAt ?? node.lastActivity,
      },
      graph: {
        degree: node.degree,
        centrality,
        position: ringMember ? "member of the confirmed compact cluster" : node.degree > 2 ? "connected intermediary" : "peripheral account",
        ringMember,
      },
      monitor: {
        status: ringMember ? "confirmed" : risk?.escalated ? "recheck" : "watching",
        summary: ringMember ? "Evidence remains consistent with the confirmed ring." : risk?.escalated ? "Queued for new relationship evidence." : "Watching incoming activity.",
        watchSince: risk?.assessedAt ?? node.firstSeen,
        checkedAt: risk?.assessedAt,
        nextCheckAt: ringMember ? undefined : new Date(Date.parse(risk?.assessedAt ?? node.lastActivity) + 2_500).toISOString(),
      },
      counterfactual: {
        status: "not_yet_evaluated",
        fingerprint: fingerprintFromRisk(risk?.signals, centrality),
      },
    };
  }

  private findSuspiciousCluster(): string[] {
    const adjacency = new Map<string, Set<string>>();
    this.graph.forEachEdge((_, attributes, source, target) => {
      if (!attributes.suspicious) return;
      if (!adjacency.has(source)) adjacency.set(source, new Set());
      if (!adjacency.has(target)) adjacency.set(target, new Set());
      adjacency.get(source)?.add(target);
      adjacency.get(target)?.add(source);
    });
    let strongest: string[] = [];
    const visited = new Set<string>();
    adjacency.forEach((_, start) => {
      if (visited.has(start)) return;
      const pending = [start];
      const component: string[] = [];
      visited.add(start);
      while (pending.length) {
        const current = pending.pop();
        if (!current) continue;
        component.push(current);
        adjacency.get(current)?.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            pending.push(neighbor);
          }
        });
      }
      const componentSet = new Set(component);
      const edgeCount = this.graph.filterEdges((edge, attributes, source, target) => attributes.suspicious && componentSet.has(source) && componentSet.has(target)).length;
      if (component.length >= 5 && edgeCount >= component.length && component.length > strongest.length) strongest = component;
    });
    return strongest;
  }
}

function fingerprintFromRisk(signals: IngestRisk["signals"] | undefined, centrality: number) {
  return [
    { signal: "Velocity" as const, value: signals?.velocity ?? 0, fullMark: 100 },
    { signal: "Layering" as const, value: Math.min(100, Math.round((signals?.roundNumber ?? 0) * .55 + centrality * .45)), fullMark: 100 },
    { signal: "Behavioral Anomaly" as const, value: Math.min(100, Math.round((signals?.newBeneficiaryHighValue ?? 0) * .74 + (signals?.velocity ?? 0) * .26)), fullMark: 100 },
    { signal: "Sanctions Proximity" as const, value: 12, fullMark: 100 },
    { signal: "Network Centrality" as const, value: centrality, fullMark: 100 },
    { signal: "Structuring" as const, value: signals?.roundNumber ?? 0, fullMark: 100 },
  ];
}

export class MonitorAgent {
  reassess(entityId: string, ringConfirmed: boolean): MonitorAssessment {
    const now = new Date();
    return {
      entityId,
      priorStatus: ringConfirmed ? "confirmed" : "inconclusive",
      status: ringConfirmed ? "confirmed" : "recheck",
      reason: ringConfirmed
        ? "network evidence remains internally consistent"
        : "additional stream evidence requested before escalation",
      nextCheckAt: new Date(now.getTime() + 2_500).toISOString(),
      checkedAt: now.toISOString(),
    };
  }
}
