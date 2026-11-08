#!/usr/bin/env node
// Command line loop. npm run loop -- --tool summarize_repository [--approve] [--task "..."]
import { config } from "./config.ts";
import { buildImages } from "./sandbox/docker.ts";
import { listModels } from "./llm/vultr.ts";
import { createRun, runDiscovery, approveAndReplay, type Emit } from "./runs/orchestrator.ts";
import type { RunRecord } from "./runs/record.ts";

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (name: string) => args.includes(`--${name}`);

function heroTable(run: RunRecord): string {
  const w1 = Math.max(...run.hero.map((r) => r.discovery.length), 20), w2 = Math.max(...run.hero.map((r) => r.replay.length), 20);
  const line = `+${"-".repeat(w1 + 2)}+${"-".repeat(w2 + 2)}+`;
  const rows = [line, `| ${"Discovery (Run B)".padEnd(w1)} | ${"Enforced replay (Run C)".padEnd(w2)} |`, line, ...run.hero.map((r) => `| ${r.discovery.padEnd(w1)} | ${r.replay.padEnd(w2)} |  ${r.state}`), line];
  return rows.join("\n");
}

const emit: Emit = (ev) => { if (ev.type === "stage") console.log(`[${new Date().toISOString().slice(11, 19)}] ${ev.status}: ${ev.detail}`); else console.log(`  ${ev.type} ${JSON.stringify({ ...ev, type: undefined })}`); };

if (cmd === "build-images") {
  await buildImages((s) => console.log(s));
} else if (cmd === "cache") {
  // Store a finished run as the pre-recorded fallback the UI serves, labelled cached, when the sandbox host is unhealthy.
  const { loadRun } = await import("./runs/orchestrator.ts");
  const { writeFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const run = loadRun(args[1] ?? "");
  if (!run || run.status !== "complete") { console.log("usage: cli.ts cache <run-id of a complete run>"); process.exit(2); }
  writeFileSync(resolve(config.dataDir, "cached-run.json"), JSON.stringify(run));
  console.log("cached", run.id);
} else if (cmd === "models") {
  console.log((await listModels()).join("\n") || "(no key)");
} else if (cmd === "loop") {
  if (has("build")) await buildImages((s) => console.log(s));
  const run = createRun({ tool: flag("tool") ?? "summarize_repository", task: flag("task") });
  console.log(`run ${run.id} (${run.probe.label}), model ${config.model}`);
  await runDiscovery(run, emit);
  console.log("\nprobe hash", run.hashes.probe, "\ncall hash ", run.hashes.call, "\nimage id  ", run.hashes.image, "\nfixture   ", run.hashes.fixture);
  console.log("\nobserved matrix (non-platform rows):");
  for (const r of run.matrix.filter((r) => !r.platform)) console.log(`  ${r.kind.padEnd(10)} ${r.target.padEnd(44)} x${r.count} ${r.errnos.join(",").padEnd(8)} ${r.labels.join(" | ")}`);
  console.log("discovery labels:", run.discovery_labels.join("; ") || "(none)");
  console.log("gateway events:", run.runs.B?.gateway_log.length ?? 0);
  console.log("proposed contract:", JSON.stringify(run.contract.proposed));
  if (run.contract.proposal_errors.length) console.log("proposal errors:", run.contract.proposal_errors.join("; "));
  if (run.status === "awaiting_approval" && has("approve")) {
    const contract = run.contract.proposed ?? JSON.parse(flag("contract") ?? "null");
    if (!contract) { console.log("no contract to approve; pass --contract '<json>'"); process.exit(2); }
    await approveAndReplay(run, contract, "cli --approve", emit);
    console.log("\ncontract hash", run.hashes.contract, "\nreplay identity verified:", run.hashes.replay_identity_verified);
    console.log("denied:", JSON.stringify(run.denied_errors));
    console.log("comparison:", run.comparison?.note);
    console.log("replay labels:", run.replay_labels.join("; "));
    console.log("\n" + heroTable(run));
    console.log("\nexplanation (" + run.explanation?.label + "):", run.explanation?.text);
    console.log("bundle:", run.bundle_path);
  } else if (run.status === "awaiting_approval") {
    console.log("\nawaiting approval. Re-run with --approve to accept the proposal as is.");
    console.log(heroTable(run));
  }
  if (run.status === "failed") { console.log("FAILED:", run.error); process.exit(1); }
} else {
  console.log("usage: cli.ts loop [--tool name] [--task text] [--approve] [--build] | build-images | models | cache <run-id>");
}
