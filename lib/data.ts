import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Transaction } from "@/lib/contracts";

export const MULE_RING_ACCOUNTS = [
  "mule-a@upi",
  "mule-b@upi",
  "mule-c@upi",
  "mule-d@upi",
  "mule-e@upi",
] as const;

function parseCsvLine(line: string): string[] {
  return line.split(",").map((value) => value.trim());
}

export async function loadTransactions(): Promise<Transaction[]> {
  const file = path.join(process.cwd(), "data", "upi_transactions.csv");
  const raw = await readFile(file, "utf8");
  return parseTransactionsCsv(raw);
}

export function parseTransactionsCsv(raw: string): Transaction[] {
  const [, ...rows] = raw.trim().split(/\r?\n/);
  const transactions = rows.filter(Boolean).map((row) => {
    const [transactionId, timestamp, senderVpa, receiverVpa, amount, isNewBeneficiary] = parseCsvLine(row);
    if (!transactionId || !timestamp || !senderVpa || !receiverVpa || !Number.isFinite(Number(amount))) {
      throw new Error("One or more rows do not match the FraudLens UPI CSV format.");
    }
    return {
      transactionId,
      timestamp,
      senderVpa,
      receiverVpa,
      amount: Number(amount),
      isNewBeneficiary: isNewBeneficiary === "true",
    };
  });
  if (!transactions.length) throw new Error("The CSV contains no transaction rows.");
  return transactions;
}
