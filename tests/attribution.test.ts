import { test } from "node:test";
import assert from "node:assert/strict";
import { labelEvents, matrix, parseTranscript, ATTRIBUTION } from "../host/src/runs/attribution.ts";
import { parseStrace } from "../host/src/trace/strace.ts";
import { compareOutputs } from "../host/src/runs/compare.ts";

const RAW = `12 10:00:00.100000 execve("/usr/local/bin/node", ["node", "/opt/sandbox/probe/probe.mjs"], 0x7ffd) = 0
12 10:00:00.200000 openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3
12 10:00:00.300000 clone3({flags=CLONE_VM|CLONE_VFORK, exit_signal=SIGCHLD, stack=0x7f, stack_size=0x9000}, 88) = 13
13 10:00:00.310000 execve("/usr/local/bin/repo-assistant", ["repo-assistant"], 0x55) = 0
13 10:00:00.400000 openat(AT_FDCWD, "/workspace/repository/README.md", O_RDONLY|O_CLOEXEC <unfinished ...>
12 10:00:00.401000 openat(AT_FDCWD, "/proc/self/stat", O_RDONLY) = 20
13 10:00:00.402000 <... openat resumed>) = 21
13 10:00:00.450000 openat(AT_FDCWD, "/workspace/.env", O_RDONLY|O_CLOEXEC) = -1 EACCES (Permission denied)
13 10:00:00.460000 connect(22, {sa_family=AF_INET, sin_port=htons(443), sin_addr=inet_addr("10.77.0.2")}, 16) = -1 EINPROGRESS (Operation now in progress)
13 10:00:00.700000 openat(AT_FDCWD, "/tmp/x", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 23
13 10:00:00.900000 +++ exited with 0 +++
`;
const DAY = Date.UTC(2026, 10, 8) - new Date().getTimezoneOffset() * 60000;

test("strace parser handles unfinished/resumed, errno, connect addresses and classification", () => {
  const ev = parseStrace(RAW, DAY);
  assert.equal(ev.length, 9);
  const env = ev.find((e) => e.target === "/workspace/.env")!;
  assert.equal(env.errno, "EACCES"); assert.equal(env.kind, "file-read");
  assert.equal(ev.find((e) => e.target === "/workspace/repository/README.md")!.ret, "21");
  assert.equal(ev.find((e) => e.kind === "connect")!.target, "10.77.0.2:443");
  assert.equal(ev.find((e) => e.target === "/tmp/x")!.kind, "file-write");
  assert.equal(ev.find((e) => e.syscall === "execve" && e.pid === 13)!.target, "/usr/local/bin/repo-assistant");
});

test("five attribution labels against window and baseline", () => {
  const ev = parseStrace(RAW, DAY);
  const t = (hms: string) => parseStrace(`1 ${hms} openat(AT_FDCWD, "/x", O_RDONLY) = 1\n`, DAY)[0].t;
  const window = { callSentAt: t("10:00:00.350000"), resultAt: t("10:00:00.800000") };
  const baseline = parseStrace(`9 10:00:00.100000 openat(AT_FDCWD, "/workspace/repository/README.md", O_RDONLY) = 3\n`, DAY);
  const labelled = labelEvents(ev, window, baseline);
  const by = (target: string) => labelled.find((e) => e.target === target)!.label;
  assert.equal(by("/etc/ld.so.cache"), ATTRIBUTION.startup);
  assert.equal(by("/workspace/repository/README.md"), ATTRIBUTION.baseline);
  assert.equal(by("/workspace/.env"), ATTRIBUTION.window);
  assert.equal(by("10.77.0.2:443"), ATTRIBUTION.window);
  assert.equal(by("/tmp/x"), ATTRIBUTION.window);
  assert.equal(labelled.find((e) => e.pid === 13 && e.syscall === "execve")!.label, ATTRIBUTION.startup);
  const inside = labelEvents(parseStrace(`1 10:00:00.790000 openat(AT_FDCWD, "/y", O_RDONLY) = 1\n`, DAY), window, []);
  assert.equal(inside[0].label, ATTRIBUTION.window);
  const justAfter = labelEvents(parseStrace(`1 10:00:00.810000 openat(AT_FDCWD, "/y", O_RDONLY) = 1\n`, DAY), window, []);
  assert.equal(justAfter[0].label, ATTRIBUTION.uncertain);
  const justBefore = labelEvents(parseStrace(`1 10:00:00.340000 openat(AT_FDCWD, "/y", O_RDONLY) = 1\n`, DAY), window, []);
  assert.equal(justBefore[0].label, ATTRIBUTION.uncertain);
  assert.equal(labelEvents(ev, { callSentAt: null, resultAt: null }, [])[0].label, ATTRIBUTION.uncertain);
  const m = matrix(labelled);
  assert.ok(m.find((r) => r.target === "/workspace/.env")!.errnos.includes("EACCES"));
  assert.equal(m.find((r) => r.target === "/etc/ld.so.cache")!.platform, true);
});

test("transcript parser finds the tools/call window", () => {
  const stderr = [
    JSON.stringify({ cc: "mcp", t: 100, dir: "c2s", msg: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } }),
    JSON.stringify({ cc: "mcp", t: 110, dir: "s2c", msg: { jsonrpc: "2.0", id: 1, result: {} } }),
    JSON.stringify({ cc: "mcp", t: 200, dir: "c2s", msg: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "x", arguments: {} } } }),
    JSON.stringify({ cc: "mcp", t: 205, dir: "stderr", msg: "[repo-assistant] beacon status 204\n" }),
    JSON.stringify({ cc: "mcp", t: 260, dir: "s2c", msg: { jsonrpc: "2.0", id: 3, result: { content: [] } } }),
  ].join("\n");
  const p = parseTranscript(stderr);
  assert.deepEqual(p.window, { callSentAt: 200, resultAt: 260 });
  assert.equal(p.messages.length, 4);
  assert.equal(p.serverStderr.length, 1);
});

test("field-level output comparison", () => {
  const b = { content: [{ type: "text", text: JSON.stringify({ repository: "ledgerlite", file_count: 10 }) }] };
  const c = { content: [{ type: "text", text: JSON.stringify({ file_count: 10, repository: "ledgerlite" }) }] };
  assert.equal(compareOutputs(b, c).allMatch, true);
  const d = compareOutputs(b, { content: [{ type: "text", text: JSON.stringify({ repository: "ledgerlite", file_count: 9 }) }] });
  assert.equal(d.allMatch, false); assert.equal(d.fields.find((f) => f.field === "file_count")!.match, false); assert.equal(d.schemaValid, true);
  assert.equal(compareOutputs(b, { content: [], isError: true }).schemaValid, false);
});
