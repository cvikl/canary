import type { ValidationResult } from "../probe/validator.ts";
import type { LedgerEntry } from "../llm/vultr.ts";
import type { TraceEvent } from "../trace/strace.ts";
import type { LabelledEvent, MatrixRow, Window } from "./attribution.ts";
import type { GatewayEvent } from "../gateway/manager.ts";
import type { Contract } from "../contract/schema.ts";
import type { Denial, Finding, ResultLabel } from "../compiler/compile.ts";
import type { Comparison } from "./compare.ts";

export type RunStatus = "created" | "inspecting" | "probing" | "baseline" | "discovering" | "attributing" | "proposing" | "awaiting_approval" | "compiling" | "replaying" | "comparing" | "explaining" | "bundling" | "complete" | "failed";

export interface SandboxRun {
  profile: string;
  container_id: string;
  image_id: string;
  ip: string | null;
  started_at: string;
  ended_at: string;
  exit_code: number | null;
  timed_out: boolean;
  mcp_transcript: { t: number; dir: string; msg: unknown }[];
  server_stderr: string[];
  probe_stdout: string;
  window: Window;
  tracer: { attached: boolean; coverage: string; reason?: string; event_count: number };
  strace_events: TraceEvent[] | LabelledEvent[];
  gateway_log: GatewayEvent[];
  docker_changes: { path: string; kind: number }[];
  output: unknown;
  error: string | null;
  lifecycle: string[];
  host_config: Record<string, unknown>;
  env_manifest: string[];
}

export interface RunRecord {
  id: string;
  created_at: string;
  updated_at: string;
  scenario: string;
  tool: string;
  task: string;
  server_command: string;
  canary_host: string;
  bait: { env: string; id_rsa: string };
  status: RunStatus;
  stage_log: { t: string; stage: string; detail: string }[];
  tools_list: { name: string; description?: string; inputSchema?: object }[];
  probe: { attempts: { n: number; model: string; source: string; validation: ValidationResult; runtimeError?: string }[]; accepted_hash: string | null; source: string | null; baseline_source: string | null; call: { name: string; arguments: Record<string, unknown> } | null; call_hash: string | null; label: "live" | "FIXTURE" };
  runs: { inspect?: SandboxRun; A?: SandboxRun; B?: SandboxRun; C?: SandboxRun };
  matrix: MatrixRow[];
  discovery_findings: Finding[];
  discovery_labels: ResultLabel[];
  contract: { proposed: Contract | null; proposal_errors: string[]; approved: Contract | null; hash: string | null; approved_by: string | null; approved_at: string | null };
  compiled_profile: { docker_run: string[]; denials: Denial[]; enforced: Record<string, string> } | null;
  replay_findings: Finding[];
  replay_labels: ResultLabel[];
  comparison: Comparison | null;
  denied_errors: { path: string; errno: string | null; label: string }[];
  hashes: { probe: string | null; call: string | null; image: string | null; fixture: string | null; contract: string | null; replay_identity_verified: boolean | null };
  inference_ledger: LedgerEntry[];
  explanation: { text: string; label: "live" | "FIXTURE" } | null;
  hero: { discovery: string; replay: string; state: "observed" | "denied" | "preserved" | "exceeded" | "pending" | "failed" }[];
  bundle_path: string | null;
  error: string | null;
  vm: { region?: string; instance_id?: string; hostname?: string } | null;
}
