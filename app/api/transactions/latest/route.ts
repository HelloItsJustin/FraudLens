import { NextResponse } from "next/server";
import { DurableStoreUnavailableError } from "@/lib/durable-run-store";
import { orchestrator } from "@/lib/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns immediately: progress is derived from the durable run timestamp,
 * never from a server-side timer or a persistent connection.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const since = new URL(request.url).searchParams.get("since") ?? undefined;
  try {
    const latest = await orchestrator.latest(since);
    return NextResponse.json(latest, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Server-Timing": "simulation;desc=stateless polling",
      },
    });
  } catch (error) {
    if (error instanceof DurableStoreUnavailableError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
}
