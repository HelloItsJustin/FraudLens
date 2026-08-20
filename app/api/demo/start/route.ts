import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const state = await orchestrator.startDemo();
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
