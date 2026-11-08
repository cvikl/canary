// Fastify host: serves web/ and the API. Judge path (curated scenario, run, approve) is public and rate limited.
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, ROOT } from "./config.ts";
import { createRun, runDiscovery, approveAndReplay, loadRun, listRuns, runDir, type Emit } from "./runs/orchestrator.ts";
import { enqueue, position, queueState, onQueueChange } from "./api/queue.ts";
import { allow } from "./api/ratelimit.ts";
import { budgetRemaining, inferenceCallsToday, listModels } from "./llm/vultr.ts";
import { docker, buildImages } from "./sandbox/docker.ts";
import { ensureGateway } from "./gateway/manager.ts";
import type { RunRecord } from "./runs/record.ts";

const app = Fastify({ logger: { level: "info" }, trustProxy: true, bodyLimit: 64 * 1024 });
await app.register(fastifyStatic, { root: resolve(ROOT, "web"), prefix: "/", index: ["index.html"], cacheControl: false });

// Per-run event buffers for SSE, with late-subscriber replay.
const events = new Map<string, { type: string; [k: string]: unknown }[]>();
const subscribers = new Map<string, Set<(ev: unknown) => void>>();
const emitFor = (id: string): Emit => (ev) => {
  const list = events.get(id) ?? []; list.push(ev); events.set(id, list);
  for (const fn of subscribers.get(id) ?? []) fn(ev);
};
onQueueChange(() => { for (const id of queueState().waiting) emitFor(id)({ type: "queue", position: position(id) }); const a = queueState().active; if (a) emitFor(a)({ type: "queue", position: 0 }); });

let vmMeta: { region?: string; instance_id?: string; hostname?: string; label?: string } | null = null;
async function fetchVmMeta(): Promise<void> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch("http://169.254.169.254/v1.json", { signal: ctrl.signal }); clearTimeout(t);
    if (res.ok) { const j = await res.json() as { region?: { regioncode?: string }; "instance-v2-id"?: string; instanceid?: string; hostname?: string }; vmMeta = { region: j.region?.regioncode, instance_id: j["instance-v2-id"] ?? j.instanceid, hostname: j.hostname, label: "Vultr metadata service" }; }
  } catch { vmMeta = null; }
}
void fetchVmMeta();

async function dockerHealthy(): Promise<boolean> { try { await docker.ping(); return true; } catch { return false; } }
const cachedPath = resolve(config.dataDir, "cached-run.json");
const cachedRun = (): RunRecord | null => (existsSync(cachedPath) ? (JSON.parse(readFileSync(cachedPath, "utf8")) as RunRecord) : null);

app.get("/healthz", async () => ({ ok: true, docker: await dockerHealthy(), fake_llm: config.fakeLlm || !config.vultrKey, inference_calls_today: inferenceCallsToday(), budget_remaining: budgetRemaining(), queue: queueState(), time: new Date().toISOString() }));

app.get("/api/meta", async () => ({
  public_url: config.publicUrl, model: config.model, model_repair: config.modelRepair, inference_endpoint: config.vultrBaseUrl,
  fake_llm: config.fakeLlm || !config.vultrKey, budget_remaining: budgetRemaining(), daily_budget: config.dailyInferenceBudget,
  docker: await dockerHealthy(), vm: vmMeta, queue: queueState(), cached_available: existsSync(cachedPath),
  scenarios: [{ id: "repo-assistant", server: "@canary-lab/repo-assistant (synthetic fixture)", tools: ["summarize_repository", "search_documentation"], default_tool: "summarize_repository" }],
  sandbox_image: config.sandboxImage, network: config.network, max_run_seconds: config.maxRunSeconds,
}));

app.get("/api/runs", async () => listRuns().slice(0, 20).map((r) => ({ id: r.id, created_at: r.created_at, status: r.status, tool: r.tool, probe_label: r.probe.label, discovery_labels: r.discovery_labels, replay_labels: r.replay_labels })));

app.post<{ Body: { tool?: string; scenario?: string } }>("/api/runs", async (req, reply) => {
  const rl = allow(req.ip, 4, 10 * 60 * 1000);
  if (!rl.ok) return reply.code(429).send({ error: `rate limit, try again in ${rl.retryAfterSeconds} s`, cached_available: existsSync(cachedPath) });
  if (!(await dockerHealthy())) return reply.code(503).send({ error: "sandbox host unhealthy", cached_available: existsSync(cachedPath) });
  if (budgetRemaining() <= 0 && !(config.fakeLlm || !config.vultrKey)) return reply.code(429).send({ error: "daily inference budget exhausted", cached_available: existsSync(cachedPath) });
  if (queueState().waiting.length >= 6) return reply.code(429).send({ error: "queue full, try again in a minute", cached_available: existsSync(cachedPath) });
  const tool = req.body?.tool ?? "summarize_repository";
  if (!["summarize_repository", "search_documentation"].includes(tool)) return reply.code(400).send({ error: "curated scenarios only" });
  const run = createRun({ tool, scenario: "repo-assistant" });
  const pos = enqueue({ id: run.id, kind: "discovery", work: async () => { await runDiscovery(run, emitFor(run.id)); } });
  return { id: run.id, position: pos, status: run.status };
});

app.get<{ Params: { id: string } }>("/api/runs/:id", async (req, reply) => { const run = loadRun(req.params.id); if (!run) return reply.code(404).send({ error: "no such run" }); return { ...run, queue_position: position(run.id) }; });

app.get<{ Params: { id: string } }>("/api/runs/:id/events", async (req, reply) => {
  const run = loadRun(req.params.id); if (!run) return reply.code(404).send({ error: "no such run" });
  reply.raw.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
  const send = (ev: unknown) => reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
  send({ type: "snapshot", status: run.status, position: position(run.id) });
  for (const ev of events.get(run.id) ?? []) send(ev);
  const set = subscribers.get(run.id) ?? new Set(); set.add(send); subscribers.set(run.id, set);
  const ka = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15000);
  req.raw.on("close", () => { clearInterval(ka); set.delete(send); });
  await new Promise(() => {});
});

app.post<{ Params: { id: string }; Body: { contract?: unknown; approved_by?: string } }>("/api/runs/:id/approve", async (req, reply) => {
  const rl = allow(req.ip + ":approve", 8, 10 * 60 * 1000);
  if (!rl.ok) return reply.code(429).send({ error: `rate limit, try again in ${rl.retryAfterSeconds} s` });
  const run = loadRun(req.params.id); if (!run) return reply.code(404).send({ error: "no such run" });
  if (run.status !== "awaiting_approval") return reply.code(409).send({ error: `run is ${run.status}` });
  const contract = req.body?.contract ?? run.contract.proposed;
  if (!contract) return reply.code(400).send({ error: "no contract to approve" });
  const pos = enqueue({ id: run.id, kind: "replay", work: async () => { await approveAndReplay(run, contract, (req.body?.approved_by ?? "reviewer in browser").slice(0, 80), emitFor(run.id)); } });
  return { id: run.id, position: pos };
});

app.get<{ Params: { id: string } }>("/api/runs/:id/bundle.zip", async (req, reply) => {
  const run = loadRun(req.params.id); if (!run?.bundle_path || !existsSync(run.bundle_path)) return reply.code(404).send({ error: "no bundle yet" });
  return reply.header("content-type", "application/zip").header("content-disposition", `attachment; filename="canary-cage-${run.id}.zip"`).send(readFileSync(run.bundle_path));
});

app.get("/api/ledger", async () => listRuns().slice(0, 20).flatMap((r) => r.inference_ledger.map((e) => ({ run: r.id, ...e }))));
app.get("/api/cached", async (_req, reply) => { const c = cachedRun(); if (!c) return reply.code(404).send({ error: "no cached run" }); return { ...c, cached: true, cached_note: "pre-recorded run served from cache, labelled cached" }; });

const operator = (req: { headers: Record<string, unknown> }) => config.operatorToken && req.headers["x-operator-token"] === config.operatorToken;
app.post("/api/admin/rebuild-images", async (req, reply) => { if (!operator(req)) return reply.code(401).send({ error: "operator token required" }); await buildImages(); return { ok: true }; });
app.post<{ Body: { run_id: string } }>("/api/admin/cache", async (req, reply) => { if (!operator(req)) return reply.code(401).send({ error: "operator token required" }); const run = loadRun(req.body?.run_id); if (!run) return reply.code(404).send({ error: "no such run" }); writeFileSync(cachedPath, JSON.stringify(run)); return { ok: true }; });
app.get("/api/admin/models", async (req, reply) => { if (!operator(req)) return reply.code(401).send({ error: "operator token required" }); return { models: await listModels() }; });

try { await ensureGateway(); } catch (e) { app.log.warn(`gateway not started: ${(e as Error).message}`); }
await app.listen({ port: config.port, host: "0.0.0.0" });
app.log.info(`Canary Cage host on ${config.port}, fake_llm=${config.fakeLlm || !config.vultrKey}, data=${config.dataDir}`);
void runDir;
