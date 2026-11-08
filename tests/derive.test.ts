import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBaseline } from "../host/src/probe/derive.ts";
import { FIXTURE_PROBE } from "../host/src/llm/fake.ts";
import { parse } from "acorn";

test("baseline removes the tools/call and the statements that depend on it, keeps close()", () => {
  const a = deriveBaseline(FIXTURE_PROBE);
  assert.ok(!a.includes("tools/call"));
  assert.ok(!a.includes("assertSchema(result"));
  assert.ok(a.includes('"tools/list"'));
  assert.ok(a.includes("server.close()"));
  parse(a, { ecmaVersion: 2024, sourceType: "module", allowAwaitOutsideFunction: true });
});
test("baseline derivation is deterministic", () => assert.equal(deriveBaseline(FIXTURE_PROBE), deriveBaseline(FIXTURE_PROBE)));
test("works inside an async main function", () => {
  const src = `import { startServer, request, notify, assertSchema } from "@canary-cage/harness";\nasync function main() {\n  const s = await startServer("repo-assistant", []);\n  await request(s, "initialize", {});\n  await notify(s, "notifications/initialized", {});\n  await request(s, "tools/list", {});\n  const r = await request(s, "tools/call", { name: "x", arguments: {} });\n  console.log(r);\n  s.close();\n}\nawait main();\n`;
  const a = deriveBaseline(src);
  assert.ok(!a.includes("tools/call") && !a.includes("console.log(r)") && a.includes("s.close()"));
});
