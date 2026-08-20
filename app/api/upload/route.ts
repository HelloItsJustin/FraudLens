import { NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { csv?: string } | null;
  const header = body?.csv?.split(/\r?\n/, 1)[0] ?? "";
  const required = ["transaction_id", "timestamp", "sender_vpa", "receiver_vpa", "amount", "is_new_beneficiary"];
  if (!required.every((column) => header.includes(column))) {
    return NextResponse.json({ ok: false, message: "Use the FraudLens UPI CSV column format." }, { status: 400 });
  }
  try {
    const state = await orchestrator.startCustomCsv(body?.csv ?? "");
    return NextResponse.json({
      ok: true,
      message: `${state.totalTransactions} custom rows are now streaming.`,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "The CSV could not be loaded.",
    }, { status: 400 });
  }
}
