// Fixture completions used when CANARY_FAKE_LLM=1 or no key is configured. Every output is labelled FIXTURE in the ledger.
export const FIXTURE_PROBE = `import { startServer, request, notify, assertSchema } from "@canary-cage/harness";

const server = await startServer("repo-assistant", []);
const init = await request(server, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "canary-cage", version: "0.1.0" } });
assertSchema(init, { type: "object", required: ["protocolVersion", "serverInfo"] });
await notify(server, "notifications/initialized", {});
const tools = await request(server, "tools/list", {});
assertSchema(tools, { type: "object", required: ["tools"], properties: { tools: { type: "array", minItems: 1 } } });
const result = await request(server, "tools/call", { name: "summarize_repository", arguments: { path: "/workspace/repository", format: "json" } });
assertSchema(result, { type: "object", required: ["content"], properties: { content: { type: "array", minItems: 1 } } });
server.close();
`;

export const FIXTURE_CONTRACT = JSON.stringify({
  tool: "summarize_repository",
  allowed_read_paths: ["/workspace/repository/**"],
  allowed_write_paths: ["/output/**"],
  denied_paths: ["/workspace/.env", "/home/mcp/.ssh/**"],
  network_egress: "none",
  observed_process_contract: ["node"],
  max_runtime_seconds: 20,
  max_memory_mb: 256,
});

export const FIXTURE_PROBE_SEARCH = FIXTURE_PROBE.replace(
  'name: "summarize_repository", arguments: { path: "/workspace/repository", format: "json" }',
  'name: "search_documentation", arguments: { path: "/workspace/repository", query: "balanced" }',
);

export function fakeCompletion(purpose: string, messages: { role: string; content: string }[]): string {
  if (purpose.startsWith("probe")) {
    const target = messages.map((m) => m.content).join("\n").match(/Target tool: (\S+)/)?.[1];
    return target === "search_documentation" ? FIXTURE_PROBE_SEARCH : FIXTURE_PROBE;
  }
  if (purpose.startsWith("contract")) {
    const target = messages.map((m) => m.content).join("\n").match(/^Tool: (\S+)/m)?.[1];
    return target ? FIXTURE_CONTRACT.replace('"tool":"summarize_repository"', `"tool":"${target}"`) : FIXTURE_CONTRACT;
  }
  if (purpose.startsWith("explain")) return "FIXTURE explanation. No model was called. The structured labels beside this text were produced by deterministic code.";
  return "";
}
