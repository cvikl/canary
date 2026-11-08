import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProbe } from "../host/src/probe/validator.ts";
import { FIXTURE_PROBE } from "../host/src/llm/fake.ts";

const TOOLS = [{ name: "summarize_repository", inputSchema: { type: "object", properties: { path: { type: "string" }, format: { type: "string", enum: ["json", "markdown"] } }, required: ["path", "format"], additionalProperties: false } }, { name: "search_documentation", inputSchema: { type: "object", properties: { path: { type: "string" }, query: { type: "string" } }, required: ["path", "query"] } }];
const reject = (src: string, re: RegExp) => { const r = validateProbe(src, TOOLS, "summarize_repository"); assert.equal(r.ok, false, "expected rejection"); if (!r.ok) assert.ok(r.violations.some((v) => re.test(v)), `violations ${JSON.stringify(r.violations)} did not match ${re}`); };

test("fixture probe is accepted with stable hashes", () => {
  const r = validateProbe(FIXTURE_PROBE, TOOLS, "summarize_repository");
  assert.equal(r.ok, true);
  if (r.ok) { assert.match(r.hash, /^[0-9a-f]{64}$/); assert.deepEqual(r.call, { name: "summarize_repository", arguments: { path: "/workspace/repository", format: "json" } }); assert.equal(validateProbe(FIXTURE_PROBE, TOOLS).ok && (validateProbe(FIXTURE_PROBE, TOOLS) as { hash: string }).hash, r.hash); }
});
test("second import rejected", () => reject(FIXTURE_PROBE + 'import fs from "node:fs";\n', /exactly one import/));
test("wrong import source rejected", () => reject(FIXTURE_PROBE.replace("@canary-cage/harness", "node:child_process"), /import source/));
test("import alias rejected", () => reject(FIXTURE_PROBE.replace("request, notify", "request as r, notify").replace(/request\(/g, "r("), /alias/));
test("dynamic import rejected", () => reject(FIXTURE_PROBE + 'await import("node:fs");\n', /dynamic import/));
test("require rejected", () => reject(FIXTURE_PROBE + 'const fs = require("fs");\n', /require/));
test("eval rejected", () => reject(FIXTURE_PROBE + 'eval("1");\n', /eval/));
test("Function constructor rejected", () => reject(FIXTURE_PROBE + 'Function("return 1")();\n', /Function/));
test("process global rejected", () => reject(FIXTURE_PROBE + 'console.log(process.env);\n', /"process" is not declared/));
test("globalThis rejected", () => reject(FIXTURE_PROBE + 'const g = globalThis;\n', /globalThis/));
test("fetch rejected", () => reject(FIXTURE_PROBE + 'await fetch("http://x");\n', /fetch/));
test("computed property with string key to constructor rejected", () => reject(FIXTURE_PROBE + 'const F = ({})["constructor"];\n', /constructor/));
test("computed property with non-literal key rejected", () => reject(FIXTURE_PROBE + 'const k = "cons" + "tructor"; const F = ({})[k];\n', /literal key/));
test("prototype access rejected", () => reject(FIXTURE_PROBE + 'const p = Object.prototype;\n', /prototype/));
test("this rejected", () => reject(FIXTURE_PROBE + 'const t = this;\n', /this/));
test("shadowing a harness export rejected", () => reject(FIXTURE_PROBE + 'function request() {}\n', /redeclared|shadows|already been declared/));
test("two tools/call rejected", () => reject(FIXTURE_PROBE + 'await request(server, "tools/call", { name: "summarize_repository", arguments: { path: "/x", format: "json" } });\n', /exactly one tools\/call|lifecycle/));
test("lifecycle out of order rejected", () => reject(FIXTURE_PROBE.replace('await notify(server, "notifications/initialized", {});\n', "").replace('const tools = await request(server, "tools/list", {});', 'const tools = await request(server, "tools/list", {});\nawait notify(server, "notifications/initialized", {});'), /lifecycle/));
test("non-literal method rejected", () => reject(FIXTURE_PROBE.replace('"tools/list"', '"tools/" + "list"'), /string literal|lifecycle/));
test("arguments outside the live schema rejected", () => reject(FIXTURE_PROBE.replace('format: "json"', 'format: "yaml"'), /live schema/));
test("non-literal tools/call arguments rejected", () => reject(FIXTURE_PROBE.replace('path: "/workspace/repository"', 'path: String("/workspace/repository")'), /literal value/));
test("unknown tool rejected", () => reject(FIXTURE_PROBE.replace(/summarize_repository/g, "delete_everything"), /not in tools\/list/));
test("wrong target tool rejected", () => reject(FIXTURE_PROBE.replace('name: "summarize_repository", arguments: { path: "/workspace/repository", format: "json" }', 'name: "search_documentation", arguments: { path: "/workspace/repository", query: "ledger" }'), /not the requested tool/));
test("size cap", () => reject(FIXTURE_PROBE + "// " + "x".repeat(9000) + "\n", /bytes/));
test("statement cap", () => reject(FIXTURE_PROBE + Array.from({ length: 45 }, (_, i) => `const v${i} = ${i};`).join("\n") + "\n", /statements/));
test("parse error is a rejection, not a crash", () => reject("import { startServer } from '@canary-cage/harness'; const = ;", /parse error/));
