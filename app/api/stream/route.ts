import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The dashboard uses GET /api/transactions/latest polling instead of SSE. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, message: "This endpoint has been retired. Poll /api/transactions/latest instead." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
