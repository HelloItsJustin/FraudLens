import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Durable storage for the active simulation run.
 *
 * Vercel KV exposes the Upstash Redis REST API through these environment
 * variables. The development-only fallback makes `next dev` pleasant to use,
 * but production deliberately refuses to fall back to process memory.
 */
const ACTIVE_RUN_KEY = "fraudlens:simulation:active";
const RUN_TTL_SECONDS = 4 * 60 * 60;

export interface DurableSimulationRun {
  id: string;
  startedAt: number;
  runSource: "seeded" | "upload";
  totalTransactions: number;
  /** Uploaded rows must travel with the run because instances do not share disks. */
  transactions?: import("@/lib/contracts").Transaction[];
}

export class DurableStoreUnavailableError extends Error {
  constructor() {
    super("Vercel KV is required in production to retain the active FraudLens simulation between serverless invocations.");
    this.name = "DurableStoreUnavailableError";
  }
}

const developmentRunFile = path.join(process.cwd(), ".fraudlens-local-run.json");

function kvConfig(): { url: string; token: string } | undefined {
  const url = process.env.KV_REST_API_URL ?? process.env.VERCEL_KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.VERCEL_KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : undefined;
}

function canUseMemoryFallback(): boolean {
  return process.env.NODE_ENV !== "production";
}

async function kvRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const config = kvConfig();
  if (!config) throw new DurableStoreUnavailableError();
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Vercel KV request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function loadActiveSimulationRun(): Promise<DurableSimulationRun | undefined> {
  if (!kvConfig()) {
    if (!canUseMemoryFallback()) throw new DurableStoreUnavailableError();
    try {
      return JSON.parse(await readFile(developmentRunFile, "utf8")) as DurableSimulationRun;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  const result = await kvRequest<{ result: string | null }>(`/get/${encodeURIComponent(ACTIVE_RUN_KEY)}`);
  return result.result ? JSON.parse(result.result) as DurableSimulationRun : undefined;
}

export async function saveActiveSimulationRun(run: DurableSimulationRun): Promise<void> {
  const serialized = JSON.stringify(run);
  if (!kvConfig()) {
    if (!canUseMemoryFallback()) throw new DurableStoreUnavailableError();
    await writeFile(developmentRunFile, serialized, "utf8");
    return;
  }
  // `/pipeline` keeps a potentially sizeable uploaded source out of a URL and
  // refreshes its expiry in the same request.
  const result = await kvRequest<Array<{ error?: string }>>("/pipeline", {
    method: "POST",
    body: JSON.stringify([
      ["SET", ACTIVE_RUN_KEY, serialized],
      ["EXPIRE", ACTIVE_RUN_KEY, String(RUN_TTL_SECONDS)],
    ]),
  });
  const error = result.find((entry) => entry.error)?.error;
  if (error) throw new Error(`Vercel KV write failed: ${error}`);
}
