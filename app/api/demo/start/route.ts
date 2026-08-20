import { NextResponse } from "next/server";
import { DurableStoreUnavailableError } from "@/lib/durable-run-store";
import { orchestrator } from "@/lib/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    const state = await orchestrator.startDemo();
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DurableStoreUnavailableError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
}
