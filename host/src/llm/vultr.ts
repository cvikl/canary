// Every model call in Canary Cage goes through here, to Vultr Serverless Inference only.
// Each call is appended to the inference ledger that the UI shows in the log drawer.
import { config } from "../config.ts";
import { fakeCompletion } from "./fake.ts";

export interface LedgerEntry {
  id: number;
  purpose: string;
  model: string;
  endpoint: string;
  started_at: string;
  latency_ms: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  status: "ok" | "error";
  error?: string;
  response_excerpt: string;
  label: "live" | "FIXTURE";
}

export interface ChatOptions { purpose: string; model?: string; temperature?: number; maxTokens?: number; jsonSchema?: object }
export interface ChatResult { text: string; entry: LedgerEntry }

let counter = 0;
const dailyCount = new Map<string, number>();
const today = () => new Date().toISOString().slice(0, 10);
export function inferenceCallsToday(): number { return dailyCount.get(today()) ?? 0; }
export function budgetRemaining(): number { return Math.max(0, config.dailyInferenceBudget - inferenceCallsToday()); }

export async function chat(messages: { role: "system" | "user" | "assistant"; content: string }[], opts: ChatOptions): Promise<ChatResult> {
  const model = opts.model ?? config.model;
  const started = Date.now();
  const base: Omit<LedgerEntry, "latency_ms" | "status" | "response_excerpt" | "label"> = {
    id: ++counter, purpose: opts.purpose, model, endpoint: config.vultrBaseUrl + "/chat/completions",
    started_at: new Date(started).toISOString(), prompt_tokens: null, completion_tokens: null,
  };
  if (config.fakeLlm || !config.vultrKey) {
    const text = fakeCompletion(opts.purpose, messages);
    const entry: LedgerEntry = { ...base, model: "none (FIXTURE, no key)", latency_ms: Date.now() - started, status: "ok", response_excerpt: text.slice(0, 400), label: "FIXTURE" };
    return { text, entry };
  }
  if (budgetRemaining() <= 0) throw new Error("daily inference budget exhausted");
  dailyCount.set(today(), inferenceCallsToday() + 1);
  const body: Record<string, unknown> = { model, messages, temperature: opts.temperature ?? 0, max_tokens: opts.maxTokens ?? 2000 };
  if (opts.jsonSchema) body.response_format = { type: "json_schema", json_schema: { name: "response", schema: opts.jsonSchema, strict: true } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    let res = await fetch(base.endpoint, { method: "POST", headers: { authorization: `Bearer ${config.vultrKey}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok && opts.jsonSchema) {
      // Endpoint may not support json_schema response_format. Retry with a strict JSON instruction instead.
      delete body.response_format;
      body.response_format = { type: "json_object" };
      res = await fetch(base.endpoint, { method: "POST", headers: { authorization: `Bearer ${config.vultrKey}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      if (!res.ok) {
        delete body.response_format;
        res = await fetch(base.endpoint, { method: "POST", headers: { authorization: `Bearer ${config.vultrKey}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      }
    }
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 500);
      const entry: LedgerEntry = { ...base, latency_ms: Date.now() - started, status: "error", error: `HTTP ${res.status} ${errText}`, response_excerpt: "", label: "live" };
      throw Object.assign(new Error(`Vultr inference HTTP ${res.status}: ${errText}`), { entry });
    }
    const json = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const text = json.choices?.[0]?.message?.content ?? "";
    const entry: LedgerEntry = { ...base, prompt_tokens: json.usage?.prompt_tokens ?? null, completion_tokens: json.usage?.completion_tokens ?? null, latency_ms: Date.now() - started, status: "ok", response_excerpt: text.slice(0, 400), label: "live" };
    return { text, entry };
  } finally { clearTimeout(timer); }
}

export async function listModels(): Promise<string[]> {
  if (!config.vultrKey) return [];
  const res = await fetch(config.vultrBaseUrl + "/models", { headers: { authorization: `Bearer ${config.vultrKey}` } });
  if (!res.ok) throw new Error(`models HTTP ${res.status}`);
  const json = await res.json() as { data?: { id: string }[] };
  return (json.data ?? []).map((m) => m.id);
}
