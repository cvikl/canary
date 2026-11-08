import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileContract, evaluateRows, RESULT } from "../host/src/compiler/compile.ts";
import { ContractSchema, contractHash, pathMatches } from "../host/src/contract/schema.ts";
import { FIXTURE_CONTRACT } from "../host/src/llm/fake.ts";

const contract = ContractSchema.parse(JSON.parse(FIXTURE_CONTRACT));

test("contract hash is canonical and stable", () => {
  const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(contract).reverse())));
  assert.equal(contractHash(contract), contractHash(reordered));
  assert.notEqual(contractHash(contract), contractHash({ ...contract, denied_paths: [] }));
});
test("closed schema rejects extra keys and open egress", () => {
  assert.equal(ContractSchema.safeParse({ ...contract, extra: 1 }).success, false);
  assert.equal(ContractSchema.safeParse({ ...contract, network_egress: "all" }).success, false);
  assert.equal(ContractSchema.safeParse({ ...contract, max_runtime_seconds: 99 }).success, false);
});
test("glob subset", () => {
  assert.ok(pathMatches("/workspace/repository/**", "/workspace/repository/src/a.ts"));
  assert.ok(pathMatches("/home/mcp/.ssh/**", "/home/mcp/.ssh/id_rsa"));
  assert.ok(!pathMatches("/workspace/repository/**", "/workspace/.env"));
  assert.ok(pathMatches("/workspace/.env", "/workspace/.env"));
});
test("compiler maps denied planted paths to permission masks and applies them", () => {
  const c = compileContract(contract);
  assert.equal(c.profile.network, "none");
  assert.equal(c.profile.memoryMb, 256);
  assert.deepEqual(c.denials.map((d) => d.path).sort(), ["/home/mcp/.ssh/id_rsa", "/workspace/.env"]);
  assert.ok(c.dockerRun.includes("--network none"));
  const dir = mkdtempSync(join(tmpdir(), "cc-"));
  mkdirSync(join(dir, "bait")); writeFileSync(join(dir, "bait", ".env"), "x"); writeFileSync(join(dir, "bait", "id_rsa"), "y");
  c.apply(dir);
  assert.equal(statSync(join(dir, "bait", ".env")).mode & 0o777, 0);
  assert.equal(statSync(join(dir, "bait", "id_rsa")).mode & 0o777, 0);
});
test("compiler shadows denied trees that are not planted and refuses nothing silently", () => {
  const c = compileContract({ ...contract, denied_paths: ["/etc/secrets/**", "/opt/other.txt"] });
  assert.equal(c.profile.shadows["/etc/secrets"], "ro,noexec,nosuid,nodev,size=4k");
  assert.ok(c.denials.some((d) => d.path === "/opt/other.txt" && d.mechanism.includes("mode 0000")));
});
test("evaluation labels rows with the exact strings", () => {
  const rows = [
    { kind: "file-read" as const, target: "/workspace/repository/README.md", count: 1, labels: ["newly observed during the tool-call window" as const], errnos: [], first_t: 0, platform: false, pids: [1] },
    { kind: "file-read" as const, target: "/workspace/.env", count: 1, labels: ["newly observed during the tool-call window" as const], errnos: [], first_t: 0, platform: false, pids: [1] },
    { kind: "connect" as const, target: "10.77.0.2:443", count: 1, labels: ["newly observed during the tool-call window" as const], errnos: [], first_t: 0, platform: false, pids: [1] },
    { kind: "exec" as const, target: "/usr/bin/curl", count: 1, labels: ["newly observed during the tool-call window" as const], errnos: [], first_t: 0, platform: false, pids: [1] },
    { kind: "file-read" as const, target: "/etc/passwd", count: 1, labels: ["observed during startup" as const], errnos: [], first_t: 0, platform: true, pids: [1] },
  ];
  const f = evaluateRows(rows, contract).map((x) => x.label);
  assert.deepEqual(f, ["within contract", RESULT.file, RESULT.network, RESULT.process, "platform"]);
});
