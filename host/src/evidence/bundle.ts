import archiver from "archiver";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RunRecord } from "../runs/record.ts";

export async function writeBundle(run: RunRecord, dir: string): Promise<string> {
  const out = join(dir, "bundle.zip");
  const archive = archiver("zip", { zlib: { level: 6 } });
  const stream = createWriteStream(out);
  const done = new Promise<void>((resolve, reject) => { stream.on("close", () => resolve()); archive.on("error", reject); });
  archive.pipe(stream);
  const add = (name: string, content: string | Buffer) => archive.append(content, { name });
  add("README.txt", `Canary Cage evidence bundle for run ${run.id}\nGenerated ${new Date().toISOString()}\nLabels are observations for this run only. Coverage: ${run.runs.B?.tracer.coverage ?? "unknown"}.\nProbe label: ${run.probe.label}. Inference ledger entries labelled FIXTURE were produced without a model call.\n`);
  if (run.probe.source) add("probe/probe.mjs", run.probe.source);
  if (run.probe.baseline_source) add("probe/probe-baseline.mjs", run.probe.baseline_source);
  for (const [name, r] of Object.entries(run.runs)) {
    if (!r) continue;
    add(`runs/${name}/mcp-transcript.json`, JSON.stringify(r.mcp_transcript, null, 2));
    add(`runs/${name}/server-stderr.txt`, r.server_stderr.join("\n"));
    add(`runs/${name}/strace-events.json`, JSON.stringify(r.strace_events, null, 2));
    add(`runs/${name}/gateway-log.json`, JSON.stringify(r.gateway_log, null, 2));
    add(`runs/${name}/lifecycle.txt`, r.lifecycle.join("\n"));
    add(`runs/${name}/host-config.json`, JSON.stringify(r.host_config, null, 2));
    const raw = join(dir, `strace-${name}.txt`);
    if (existsSync(raw)) add(`runs/${name}/strace-raw.txt`, readFileSync(raw));
  }
  add("matrix.json", JSON.stringify(run.matrix, null, 2));
  add("contract.json", JSON.stringify(run.contract, null, 2));
  add("compiled-profile.json", JSON.stringify(run.compiled_profile, null, 2));
  add("comparison.json", JSON.stringify(run.comparison, null, 2));
  add("labels.json", JSON.stringify({ discovery: run.discovery_labels, replay: run.replay_labels, denied: run.denied_errors }, null, 2));
  add("hashes.json", JSON.stringify(run.hashes, null, 2));
  add("inference-ledger.json", JSON.stringify(run.inference_ledger, null, 2));
  add("run-record.json", JSON.stringify(run, null, 2));
  await archive.finalize();
  await done;
  return out;
}
