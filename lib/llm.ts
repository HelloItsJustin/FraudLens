import { staticContentFor } from "@/lib/fallback-data";
import type { LlmGeneratedContent } from "@/lib/contracts";

type Provider = "gemini" | "groq";
interface Usage { at: number; tokens: number; }

class SlidingWindowLimiter {
  private usage: Usage[] = [];
  private dailyRequests: number[] = [];
  constructor(private readonly requestsPerMinute: number, private readonly tokensPerMinute: number, private readonly requestsPerDay: number) {}
  canUse(estimatedTokens: number): boolean {
    const now = Date.now();
    this.usage = this.usage.filter((entry) => now - entry.at < 60_000);
    this.dailyRequests = this.dailyRequests.filter((entry) => now - entry < 86_400_000);
    return this.usage.length < this.requestsPerMinute && this.usage.reduce((total, entry) => total + entry.tokens, 0) + estimatedTokens <= this.tokensPerMinute && this.dailyRequests.length < this.requestsPerDay;
  }
  record(tokens: number): void { const now = Date.now(); this.usage.push({ at: now, tokens }); this.dailyRequests.push(now); }
}

const geminiLimiter = new SlidingWindowLimiter(12, 6_000, 1_000);
const groqLimiter = new SlidingWindowLimiter(30, 12_000, 1_000);
let queue = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> { const next = queue.then(work, work); queue = next.then(() => undefined, () => undefined); return next; }

export function withHardTimeout<T>(promise: Promise<T>, timeoutMs = 40_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise, new Promise<T>((_, reject) => { timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs); })]).finally(() => { if (timeout) clearTimeout(timeout); });
}

function parseGeneratedContent(value: unknown): LlmGeneratedContent {
  if (!value || typeof value !== "object") throw new Error("LLM response was not an object");
  const candidate = value as Partial<LlmGeneratedContent>;
  if (![candidate.analystExplanation, candidate.eli70Explanation, candidate.complaintBody].every((part) => typeof part === "string" && part.trim())) throw new Error("LLM response did not meet the required schema");
  return { analystExplanation: candidate.analystExplanation!.trim(), eli70Explanation: candidate.eli70Explanation!.trim(), complaintBody: candidate.complaintBody!.trim() };
}

function promptFor(dominantSignal: string, evidence: string[]): string {
  return `You are a cautious fraud-operations writing assistant. Return only valid JSON with exactly analystExplanation, eli70Explanation, complaintBody. Ground all claims in this evidence: ${evidence.join("; ")}. Dominant risk factor: ${dominantSignal}. Analyst explanation: concise and technical. ELI70: gentle and simple. Complaint: concise factual draft for India's 1930 cybercrime channel. Do not invent people, losses, laws, or certainty.`;
}

async function requestGeminiModel(model: string, prompt: string): Promise<LlmGeneratedContent> {
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("Gemini key is unavailable");
  const response = await withHardTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) }), 6_500);
  if (!response.ok) throw new Error(`${model} returned ${response.status}`);
  const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text; if (!text) throw new Error(`${model} response was empty`);
  return parseGeneratedContent(JSON.parse(text));
}

async function requestGemini(prompt: string): Promise<LlmGeneratedContent> {
  // The contract intentionally has one primary Gemini attempt. A 503 or a slow
  // preview response must hand off quickly to Groq, rather than spending the
  // Counterfactual Agent's bounded execution time retrying the same provider.
  return requestGeminiModel("gemini-3-flash-preview", prompt);
}

async function requestGroq(prompt: string): Promise<LlmGeneratedContent> {
  const key = process.env.GROQ_API_KEY; if (!key) throw new Error("Groq key is unavailable");
  // Llama 3.3 was retired by Groq on 2026-08-16. This is their supported replacement.
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const response = await withHardTimeout(fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0.35, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) }), 9_000);
  if (!response.ok) throw new Error(`${model} returned ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = body.choices?.[0]?.message?.content; if (!text) throw new Error("Groq response was empty");
  return parseGeneratedContent(JSON.parse(text));
}

async function requestProvider(provider: Provider, prompt: string, estimatedTokens: number): Promise<LlmGeneratedContent> {
  const limiter = provider === "gemini" ? geminiLimiter : groqLimiter;
  if (!limiter.canUse(estimatedTokens)) throw new Error(`${provider} rate limit is proactively reserved`);
  const content = provider === "gemini" ? await requestGemini(prompt) : await requestGroq(prompt); limiter.record(estimatedTokens); return content;
}

export async function callLLMWithFallback(input: { dominantSignal: string; evidence: string[] }): Promise<{ content: LlmGeneratedContent; provider: "gemini" | "groq" | "static" }> {
  return enqueue(async () => {
    const prompt = promptFor(input.dominantSignal, input.evidence); const estimatedTokens = 850;
    try { const content = await requestProvider("gemini", prompt, estimatedTokens); console.info("[FraudLens] Counterfactual content served by Gemini."); return { content, provider: "gemini" as const }; } catch (geminiError) { console.info("[FraudLens] Gemini temporary recovery exhausted; trying Groq.", geminiError instanceof Error ? geminiError.message : geminiError); }
    try { const content = await requestProvider("groq", prompt, estimatedTokens); console.info("[FraudLens] Counterfactual content served by Groq."); return { content, provider: "groq" as const }; } catch (groqError) { console.info("[FraudLens] Groq recovery exhausted; static continuity selected.", groqError instanceof Error ? groqError.message : groqError); }
    return { content: staticContentFor(input.dominantSignal), provider: "static" as const };
  });
}
