// The loop. Inspect, Probe, Baseline (A), Discover (B), Attribute, Contract, Enforce, Replay (C), Explain, Bundle.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, cpSync, chmodSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { config, ROOT } from "../config.ts";
import { chat } from "../llm/vultr.ts";
import { validateProbe, sha256 } from "../probe/validator.ts";
import { deriveBaseline } from "../probe/derive.ts";
import { writeProbe, EXAMPLE_PROBE } from "../probe/agent.ts";
import { runSandbox, DISCOVERY_PROFILE, imageId, type SandboxProfile, type SandboxResult } from "../sandbox/docker.ts";
import { ensureGateway, gatewayEvents } from "../gateway/manager.ts";
import { attachTracer } from "../trace/strace.ts";
import { labelEvents, matrix, parseTranscript, type LabelledEvent } from "./attribution.ts";
import { proposeContract } from "../contract/propose.ts";
import { ContractSchema, type Contract } from "../contract/schema.ts";
import { compileContract, evaluateRows, RESULT, type ResultLabel, type Finding } from "../compiler/compile.ts";
import { compareOutputs } from "./compare.ts";
// @ts-ignore plain ESM module without types
import { fixtureDigest } from "../../../fixture/bin/digest.mjs";
import { writeBundle } from "../evidence/bundle.ts";
import type { RunRecord, SandboxRun } from "./record.ts";

export type Emit = (event: { type: string; [k: string]: unknown }) => void;
const noop: Emit = () => {};

const INSPECT_PROBE = EXAMPLE_PROBE.split("\n").filter((l) => !l.includes("tools/call") && !l.includes("assertSchema(result")).join("\n") + "\n";

export const runDir = (id: string) => resolve(config.dataDir, "runs", id);
export function saveRun(run: RunRecord): void { run.updated_at = new Date().toISOString(); mkdirSync(runDir(run.id), { recursive: true }); writeFileSync(join(runDir(run.id), "run.json"), JSON.stringify(run, null, 2)); }
export function loadRun(id: string): RunRecord | null { const f = join(runDir(id), "run.json"); return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as RunRecord) : null; }
export function listRuns(): RunRecord[] { const d = resolve(config.dataDir, "runs"); if (!existsSync(d)) return []; return readdirSync(d).map(loadRun).filter((r): r is RunRecord => !!r).sort((a, b) => b.created_at.localeCompare(a.created_at)); }

export function createRun(opts: { tool?: string; task?: string; scenario?: string }): RunRecord {
  const id = randomUUID();
  const tool = opts.tool ?? "summarize_repository";
  const run: RunRecord = {
    id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), scenario: opts.scenario ?? "repo-assistant", tool,
    task: opts.task ?? `Summarise the repository at /workspace/repository as JSON using the ${tool} tool and check the result has content.`,
    server_command: "repo-assistant", canary_host: `${id}.${config.canarySuffix}`,
    bait: { env: `# synthetic bait planted by Canary Cage, run ${id}\nSTRIPE_SECRET_KEY=sk_live_CANARY_${id}\nDATABASE_URL=postgres://ledger:CANARY_${id}@db.internal:5432/ledger\n`, id_rsa: `-----BEGIN OPENSSH PRIVATE KEY-----\nCANARY-${id}-NOT-A-REAL-KEY\n-----END OPENSSH PRIVATE KEY-----\n` },
    status: "created", stage_log: [], tools_list: [],
    probe: { attempts: [], accepted_hash: null, source: null, baseline_source: null, call: null, call_hash: null, label: config.fakeLlm || !config.vultrKey ? "FIXTURE" : "live" },
    runs: {}, matrix: [], discovery_findings: [], discovery_labels: [],
    contract: { proposed: null, proposal_errors: [], approved: null, hash: null, approved_by: null, approved_at: null },
    compiled_profile: null, replay_findings: [], replay_labels: [], comparison: null, denied_errors: [],
    hashes: { probe: null, call: null, image: null, fixture: null, contract: null, replay_identity_verified: null },
    inference_ledger: [], explanation: null, hero: [], bundle_path: null, error: null, vm: null,
  };
  saveRun(run);
  return run;
}

function stage(run: RunRecord, emit: Emit, status: RunRecord["status"], detail: string): void {
  run.status = status;
  run.stage_log.push({ t: new Date().toISOString(), stage: status, detail });
  saveRun(run);
  emit({ type: "stage", status, detail, run_id: run.id });
}

/** Prepare a read-only input tree for one sandbox run: probe, run.json, bait. World-readable so uid 10001 can read it. */
function prepareInput(run: RunRecord, name: string, probeSource: string): string {
  const dir = join(runDir(run.id), `input-${name}`);
  mkdirSync(join(dir, "probe"), { recursive: true });
  mkdirSync(join(dir, "bait"), { recursive: true });
  writeFileSync(join(dir, "probe", "probe.mjs"), probeSource);
  writeFileSync(join(dir, "run.json"), JSON.stringify({ run_id: run.id, canary_host: run.canary_host, note: "synthetic Canary Cage run inputs" }));
  writeFileSync(join(dir, "bait", ".env"), run.bait.env);
  writeFileSync(join(dir, "bait", "id_rsa"), run.bait.id_rsa);
  for (const p of [dir, join(dir, "probe"), join(dir, "bait")]) chmodSync(p, 0o755);
  for (const f of [join(dir, "probe", "probe.mjs"), join(dir, "run.json"), join(dir, "bait", ".env"), join(dir, "bait", "id_rsa")]) chmodSync(f, 0o644);
  return dir;
}

function dayStart(): number { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

async function sandboxRun(run: RunRecord, name: "inspect" | "A" | "B" | "C", profile: SandboxProfile, inputDir: string, emit: Emit): Promise<SandboxRun> {
  const traceFile = join(runDir(run.id), `strace-${name}.txt`);
  let tracer: Awaited<ReturnType<typeof attachTracer>> | null = null;
  const result: SandboxResult = await runSandbox(profile, inputDir, async (pid) => {
    tracer = await attachTracer(pid, traceFile, dayStart());
    emit({ type: "tracer", run: name, attached: tracer.attached, reason: tracer.reason });
  });
  const traced = tracer ? await (tracer as Awaited<ReturnType<typeof attachTracer>>).stop() : { events: [], raw: "", coverage: "none" };
  const { messages, window, serverStderr } = parseTranscript(result.stderr);
  const callId = (messages.find((m) => m.dir === "c2s" && (m.msg as { method?: string }).method === "tools/call")?.msg as { id?: unknown } | undefined)?.id;
  const output = callId === undefined ? null : (messages.find((m) => m.dir === "s2c" && (m.msg as { id?: unknown }).id === callId)?.msg as { result?: unknown } | undefined)?.result ?? null;
  const gateway = profile.network === "gateway" ? await gatewayEvents(result.startedAt, result.endedAt, result.ip) : [];
  const probeError = result.exitCode !== 0 ? (result.stdout + "\n" + serverStderr.filter((l) => !l.startsWith("[repo-assistant]")).join("\n")).trim().slice(0, 1500) : null;
  return {
    profile: profile.name, container_id: result.containerId, image_id: result.imageId, ip: result.ip,
    started_at: new Date(result.startedAt).toISOString(), ended_at: new Date(result.endedAt).toISOString(), exit_code: result.exitCode, timed_out: result.timedOut,
    mcp_transcript: messages, server_stderr: serverStderr, probe_stdout: result.stdout.slice(0, 4000), window,
    tracer: { attached: !!(tracer as Awaited<ReturnType<typeof attachTracer>> | null)?.attached, coverage: traced.coverage, reason: (tracer as Awaited<ReturnType<typeof attachTracer>> | null)?.reason, event_count: traced.events.length },
    strace_events: traced.events, gateway_log: gateway, docker_changes: result.changes, output,
    error: result.timedOut ? `wall clock exceeded (${profile.wallClockSeconds} s), container killed` : probeError, lifecycle: result.lifecycle, host_config: result.hostConfig, env_manifest: result.envManifest,
  };
}

function gatewaySummary(run: SandboxRun, canaryHost: string, runId: string): { lines: string[]; labels: ResultLabel[] } {
  const lines: string[] = []; const labels = new Set<ResultLabel>();
  for (const ev of run.gateway_log) {
    if (ev.kind === "dns") { lines.push(`DNS query ${ev.name} ${ev.answered ? "(answered with the gateway address)" : "(NXDOMAIN)"}`); if (String(ev.name).includes(runId)) labels.add(RESULT.contact); }
    if (ev.kind === "tls" || ev.kind === "tls-connection") { lines.push(`TLS connection${ev.sni ? ` for ${ev.sni}` : ""}`); if (String(ev.sni ?? "").includes(runId)) labels.add(RESULT.contact); }
    if (ev.kind === "http") { lines.push(`${String(ev.scheme).toUpperCase()} ${ev.method} ${ev.path} to ${ev.host}, ${ev.body_bytes} body bytes`); labels.add(RESULT.contact); if (String(ev.body ?? "").includes(runId)) labels.add(RESULT.disclosure); }
  }
  void canaryHost;
  return { lines, labels: [...labels] };
}

export async function runDiscovery(run: RunRecord, emit: Emit = noop): Promise<RunRecord> {
  try {
    await ensureGateway();
    run.hashes.image = await imageId(config.sandboxImage);
    run.hashes.fixture = fixtureDigest(resolve(ROOT, "fixture", "repository"), { ".env": run.bait.env, id_rsa: run.bait.id_rsa });

    // 1. Inspect
    stage(run, emit, "inspecting", "fresh container, initialize, tools/list, destroy");
    const inspectProfile: SandboxProfile = { ...DISCOVERY_PROFILE, name: "inspect", network: "none" };
    run.runs.inspect = await sandboxRun(run, "inspect", inspectProfile, prepareInput(run, "inspect", INSPECT_PROBE), emit);
    const listMsg = run.runs.inspect.mcp_transcript.find((m) => m.dir === "s2c" && (m.msg as { result?: { tools?: unknown } }).result?.tools);
    if (!listMsg) throw new Error(`inspect run returned no tools/list (exit ${run.runs.inspect.exit_code}): ${run.runs.inspect.error ?? ""}`);
    run.tools_list = ((listMsg.msg as { result: { tools: RunRecord["tools_list"] } }).result.tools);
    if (!run.tools_list.some((t) => t.name === run.tool)) throw new Error(`tool ${run.tool} not offered by the server`);
    saveRun(run);

    // 2. Probe (model writes, validator decides, one repair)
    stage(run, emit, "probing", `Vultr inference writes the probe (${run.probe.label})`);
    let attempt = await writeProbe({ tools: run.tools_list, targetTool: run.tool, task: run.task, serverCommand: run.server_command, attemptNumber: 1 });
    run.inference_ledger.push(attempt.ledger); run.probe.attempts.push({ n: 1, model: attempt.model, source: attempt.source, validation: attempt.validation });
    emit({ type: "probe_attempt", n: 1, ok: attempt.validation.ok, violations: attempt.validation.ok ? [] : attempt.validation.violations });
    if (!attempt.validation.ok) {
      attempt = await writeProbe({ tools: run.tools_list, targetTool: run.tool, task: run.task, serverCommand: run.server_command, attemptNumber: 2, repair: true, feedback: { previousSource: attempt.source, error: "validator: " + attempt.validation.violations.join("; ") } });
      run.inference_ledger.push(attempt.ledger); run.probe.attempts.push({ n: 2, model: attempt.model, source: attempt.source, validation: attempt.validation });
      emit({ type: "probe_attempt", n: 2, ok: attempt.validation.ok, violations: attempt.validation.ok ? [] : attempt.validation.violations });
    }
    if (!attempt.validation.ok) { run.discovery_labels = [RESULT.incomplete]; throw new Error("probe rejected twice: " + attempt.validation.violations.join("; ")); }
    const accept = (a: typeof attempt) => { const v = a.validation as Extract<typeof a.validation, { ok: true }>; run.probe.source = a.source; run.probe.accepted_hash = v.hash; run.probe.call = v.call; run.probe.call_hash = v.callHash; run.probe.baseline_source = deriveBaseline(a.source); run.hashes.probe = v.hash; run.hashes.call = v.callHash; };
    accept(attempt);
    saveRun(run);

    // 3. Baseline (Run A) and 4. Discover (Run B)
    const runB = async () => { stage(run, emit, "discovering", "Run B, accepted probe, discovery profile, gateway network, strace attached"); run.runs.B = await sandboxRun(run, "B", DISCOVERY_PROFILE, prepareInput(run, "B", run.probe.source!), emit); };
    stage(run, emit, "baseline", "Run A, accepted probe minus the tools/call, strace attached");
    run.runs.A = await sandboxRun(run, "A", DISCOVERY_PROFILE, prepareInput(run, "A", run.probe.baseline_source!), emit);
    await runB();
    let B = run.runs.B!;
    if (B.exit_code !== 0 && run.probe.attempts.length < 2) {
      // Runtime failure: one repair round with the error fed back, then re-derive A and rerun both.
      const err = B.error ?? `exit code ${B.exit_code}`;
      run.probe.attempts[run.probe.attempts.length - 1].runtimeError = err;
      emit({ type: "probe_runtime_error", error: err });
      stage(run, emit, "probing", "runtime error fed back to the model, one repair");
      const repaired = await writeProbe({ tools: run.tools_list, targetTool: run.tool, task: run.task, serverCommand: run.server_command, attemptNumber: 2, repair: true, feedback: { previousSource: run.probe.source!, error: "runtime: " + err } });
      run.inference_ledger.push(repaired.ledger); run.probe.attempts.push({ n: 2, model: repaired.model, source: repaired.source, validation: repaired.validation });
      if (!repaired.validation.ok) { run.discovery_labels = [RESULT.incomplete]; throw new Error("repaired probe rejected: " + repaired.validation.violations.join("; ")); }
      accept(repaired);
      stage(run, emit, "baseline", "Run A again with the repaired probe");
      run.runs.A = await sandboxRun(run, "A", DISCOVERY_PROFILE, prepareInput(run, "A", run.probe.baseline_source!), emit);
      await runB();
      B = run.runs.B!;
    }
    if (B.exit_code !== 0) { run.discovery_labels = [RESULT.incomplete]; throw new Error(`Run B failed: ${B.error ?? "exit " + B.exit_code}`); }

    // 5. Attribute
    stage(run, emit, "attributing", "labelling every event against the baseline and the tool-call window");
    const labelled = labelEvents(B.strace_events, B.window, run.runs.A.strace_events);
    B.strace_events = labelled;
    run.runs.A.strace_events = labelEvents(run.runs.A.strace_events, { callSentAt: null, resultAt: null }, []).map((e) => ({ ...e, label: "observed during startup" as const }));
    run.matrix = matrix(labelled);
    const gw = gatewaySummary(B, run.canary_host, run.id);
    const provisional: Contract = { tool: run.tool, allowed_read_paths: ["/workspace/repository/**"], allowed_write_paths: ["/output/**"], denied_paths: [], network_egress: "none", observed_process_contract: ["node"], max_runtime_seconds: 20, max_memory_mb: 256 };
    run.discovery_findings = evaluateRows(run.matrix, provisional);
    run.discovery_labels = [...new Set([...run.discovery_findings.map((f) => f.label).filter((l): l is ResultLabel => Object.values(RESULT).includes(l as ResultLabel)), ...gw.labels])];
    if (!B.tracer.attached) run.discovery_labels.push(RESULT.insufficient);
    saveRun(run);

    // 6. Contract proposal
    stage(run, emit, "proposing", `Vultr inference proposes the narrowest contract (${run.probe.label})`);
    const proposal = await proposeContract({ tool: run.tool, task: run.task, call: run.probe.call!.arguments, rows: run.matrix, gatewaySummary: gw.lines });
    run.inference_ledger.push(proposal.ledger, ...proposal.ledgerExtra);
    run.contract.proposed = proposal.contract; run.contract.proposal_errors = proposal.errors;
    if (!proposal.contract) emit({ type: "proposal_rejected", errors: proposal.errors });
    run.hero = heroRows(run);
    stage(run, emit, "awaiting_approval", "a person must approve or edit the contract");
    return run;
  } catch (e) {
    run.error = (e as Error).message; run.hero = heroRows(run);
    stage(run, emit, "failed", run.error);
    return run;
  }
}

export async function approveAndReplay(run: RunRecord, contractInput: unknown, approvedBy: string, emit: Emit = noop): Promise<RunRecord> {
  try {
    if (run.status !== "awaiting_approval") throw new Error(`run is ${run.status}, not awaiting approval`);
    const parsed = ContractSchema.safeParse(contractInput);
    if (!parsed.success) throw new Error("contract rejected by schema: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    if (parsed.data.tool !== run.tool) throw new Error("contract tool does not match the locked tools/call");
    run.contract.approved = parsed.data; run.contract.approved_by = approvedBy; run.contract.approved_at = new Date().toISOString();

    // 7. Enforce (compile)
    stage(run, emit, "compiling", "deterministic compiler, contract to Docker profile");
    const compiled = compileContract(parsed.data);
    run.contract.hash = compiled.contractHash; run.hashes.contract = compiled.contractHash;
    const inputC = prepareInput(run, "C", run.probe.source!);
    compiled.apply(inputC);
    run.compiled_profile = { docker_run: compiled.dockerRun, denials: compiled.denials, enforced: compiled.enforced };
    saveRun(run);

    // 8. Replay (Run C)
    stage(run, emit, "replaying", "Run C, identical probe by hash, enforced profile, bait still planted");
    run.runs.C = await sandboxRun(run, "C", compiled.profile, inputC, emit);
    const probeC = readFileSync(join(inputC, "probe", "probe.mjs"), "utf8");
    const fixtureC = fixtureDigest(resolve(ROOT, "fixture", "repository"), { ".env": run.bait.env, id_rsa: run.bait.id_rsa });
    run.hashes.replay_identity_verified = sha256(probeC) === run.hashes.probe && run.runs.C.image_id === run.hashes.image && fixtureC === run.hashes.fixture && run.runs.C.mcp_transcript.some((m) => m.dir === "c2s" && (m.msg as { method?: string }).method === "tools/call" && JSON.stringify((m.msg as { params?: unknown }).params) === JSON.stringify({ name: run.probe.call!.name, arguments: run.probe.call!.arguments }));

    // 9. Compare and label
    stage(run, emit, "comparing", "field-level comparison with Run B, denied reads recorded with the real OS error");
    const labelledC = labelEvents(run.runs.C.strace_events, run.runs.C.window, run.runs.A!.strace_events);
    run.runs.C.strace_events = labelledC;
    const rowsC = matrix(labelledC);
    run.replay_findings = evaluateRows(rowsC, parsed.data);
    run.denied_errors = rowsC.filter((r) => parsed.data.denied_paths.some((p) => p === r.target || (p.endsWith("/**") && r.target.startsWith(p.slice(0, -3) + "/")))).map((r) => ({ path: r.target, errno: r.errnos[0] ?? null, label: r.errnos.length ? `access denied by the operating system (${r.errnos.join(", ")})` : "opened without error" }));
    const deniedOpened = run.denied_errors.filter((d) => d.errno === null);
    const gwC = run.runs.C.gateway_log.length ? gatewaySummary(run.runs.C, run.canary_host, run.id) : { lines: [], labels: [] as ResultLabel[] };
    // Network in Run C. A connect that the kernel refused (ENETUNREACH and friends) is the enforced profile working
    // and is recorded as denied. A connect that got through (no error, or EINPROGRESS on a non-blocking socket) is a failure.
    const netRowsC = rowsC.filter((r) => (r.kind === "connect" || r.kind === "sendto") && !r.target.startsWith("unix:") && r.labels.some((l) => l.startsWith("newly") || l === "attribution uncertain"));
    const netDeniedC = netRowsC.filter((r) => r.errnos.length > 0 && !r.errnos.includes("EINPROGRESS"));
    const netC = netRowsC.filter((r) => r.errnos.length === 0 || r.errnos.includes("EINPROGRESS"));
    for (const r of netDeniedC) run.denied_errors.push({ path: `network ${r.target}`, errno: r.errnos[0], label: `network attempt refused by the kernel under --network none (${r.errnos.join(", ")})` });
    run.comparison = compareOutputs(run.runs.B!.output, run.runs.C.output);
    const labels = new Set<ResultLabel>();
    if (gwC.labels.length) { labels.add(RESULT.unenforced); for (const l of gwC.labels) labels.add(l); }
    if (deniedOpened.length) labels.add(RESULT.unenforced);
    if (run.runs.C.exit_code !== 0 || !run.comparison.schemaValid) labels.add(RESULT.incomplete);
    else if (run.comparison.allMatch) labels.add(RESULT.preserved);
    for (const f of run.replay_findings) if (f.label === RESULT.file && !deniedOpened.some((d) => d.path === f.row.target) && !run.denied_errors.some((d) => d.path === f.row.target)) labels.add(RESULT.file);
    for (const f of run.replay_findings) if (f.label === RESULT.process) labels.add(RESULT.process);
    if (netC.length) labels.add(RESULT.network);
    if (!run.runs.C.tracer.attached) labels.add(RESULT.insufficient);
    if (labels.size === 0 || (labels.size === 1 && labels.has(RESULT.preserved))) labels.add(RESULT.within);
    run.replay_labels = [...labels];
    saveRun(run);

    // Explain (model writes prose beside the structured verdict, cannot change a label)
    stage(run, emit, "explaining", "plain-language explanation beside the structured verdict");
    const verdict = { discovery_labels: run.discovery_labels, replay_labels: run.replay_labels, denied: run.denied_errors, comparison: run.comparison.note, replay_identity_verified: run.hashes.replay_identity_verified, gateway_discovery: gatewaySummary(run.runs.B!, run.canary_host, run.id).lines };
    try {
      const { text, entry } = await chat([
        { role: "system", content: "You explain a Canary Cage result to a security reviewer in at most 120 words of plain English. Use only the words observed, newly observed during the tool-call window, denied by the operating system, caught at our gateway, useful output preserved under enforcement. Never say safe, malicious, guaranteed, complete visibility or secured. Do not add or remove any finding. No markdown." },
        { role: "user", content: JSON.stringify(verdict) },
      ], { purpose: "explain verdict", temperature: 0, maxTokens: 2500 });
      run.inference_ledger.push(entry); run.explanation = { text: text.trim(), label: entry.label };
    } catch (e) { run.explanation = { text: `explanation unavailable: ${(e as Error).message}`, label: "live" }; }

    // Bundle
    stage(run, emit, "bundling", "zipping probe, transcripts, labelled events, gateway log, profile, contract, hashes, ledger");
    run.hero = heroRows(run);
    run.bundle_path = await writeBundle(run, runDir(run.id));
    stage(run, emit, "complete", "done");
    return run;
  } catch (e) {
    run.error = (e as Error).message; run.hero = heroRows(run);
    stage(run, emit, "failed", run.error);
    return run;
  }
}

export function heroRows(run: RunRecord): RunRecord["hero"] {
  const B = run.runs.B, C = run.runs.C;
  const row = (discovery: string, replay: string, state: RunRecord["hero"][number]["state"]) => ({ discovery, replay, state });
  const tracedB = !!B?.tracer.attached, tracedC = !!C?.tracer.attached;
  const fileRow = (path: string, name: string) => {
    const seenB = run.matrix.some((r) => r.target === path && r.kind === "file-read" && r.labels.some((l) => l.startsWith("newly") || l === "attribution uncertain"));
    const d = run.denied_errors.find((x) => x.path === path);
    const discovery = !B ? "pending" : !tracedB ? `${name} read: no host evidence (tracer not attached)` : seenB ? `${name} read observed` : `${name} read not observed`;
    const replay = !C ? "pending" : d ? (d.errno ? `${name} access denied, ${d.errno}` : `${name} opened without error`) : !tracedC ? `${name}: no host evidence (tracer not attached)` : `${name} not touched`;
    return row(discovery, replay, !C ? "pending" : d?.errno ? "denied" : d ? "failed" : tracedC ? "preserved" : "pending");
  };
  const repoB = run.matrix.some((r) => r.target.startsWith("/workspace/repository") && r.labels.some((l) => l.startsWith("newly") || l === "attribution uncertain"));
  const canaryB = run.discovery_labels.includes(RESULT.contact) || run.discovery_labels.includes(RESULT.disclosure);
  const netB = run.discovery_labels.includes(RESULT.network);
  const out = [
    row(B?.output ? "Repository summary returned" : B ? "No summary returned" : "pending", !C ? "pending" : run.comparison?.allMatch ? "Same summary returned" : run.comparison?.schemaValid ? "Summary returned with divergence" : "No summary returned", !C ? "pending" : run.comparison?.allMatch ? "preserved" : "failed"),
    row(!B ? "pending" : !tracedB ? "Repository read: no host evidence (tracer not attached)" : repoB ? "Repository read observed" : "Repository read not observed in window", !C ? "pending" : "Repository read permitted", !C ? "pending" : "preserved"),
    fileRow("/workspace/.env", ".env"),
    fileRow("/home/mcp/.ssh/id_rsa", "SSH key"),
    row(canaryB ? (run.discovery_labels.includes(RESULT.disclosure) ? "Canary egress attempted, caught at gateway with bait in body" : "Canary egress attempted, caught at gateway") : netB ? "Network attempt observed" : "No network attempt observed", !C ? "pending" : run.replay_labels.includes(RESULT.unenforced) || run.replay_labels.includes(RESULT.network) ? "Network attempt got through" : run.denied_errors.some((d) => d.path.startsWith("network ")) ? `No network available, attempt refused (${run.denied_errors.find((d) => d.path.startsWith("network "))!.errno})` : "No network available", !C ? "pending" : run.replay_labels.includes(RESULT.unenforced) || run.replay_labels.includes(RESULT.network) ? "failed" : "denied"),
    row(run.discovery_labels.some((l) => l !== RESULT.within && l !== RESULT.insufficient) ? "Contract exceeded" : B ? "Within provisional contract" : "pending", !C ? "pending" : run.replay_labels.includes(RESULT.preserved) && run.replay_labels.includes(RESULT.within) ? "Useful output preserved within approved contract" : run.replay_labels.join(", "), !C ? "pending" : run.replay_labels.includes(RESULT.preserved) && run.replay_labels.includes(RESULT.within) ? "preserved" : "failed"),
  ];
  return out;
}
