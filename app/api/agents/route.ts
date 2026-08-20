import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import type { AgentName } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowed: AgentName[] = ["Ingest", "Graph", "Monitor", "Counterfactual"];

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { agent?: string; entityId?: string } | null;
  const agent = allowed.find((name) => name.toLowerCase() === body?.agent?.toLowerCase());
  if (!agent) return NextResponse.json({ ok: false, message: "Choose Ingest, Graph, Monitor, or Counterfactual." }, { status: 400 });
  const result = await orchestrator.evaluateConsoleAgent(agent, body?.entityId);
  return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
}
