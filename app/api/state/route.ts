import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(orchestrator.snapshot(), { headers: { "Cache-Control": "no-store" } });
}
