// The probe agent. Vultr Serverless Inference writes a probe against the harness; the validator decides.
import { chat, type LedgerEntry } from "../llm/vultr.ts";
import { validateProbe, type ToolDescriptor, type ValidationResult, HARNESS } from "./validator.ts";
import { config } from "../config.ts";

export const EXAMPLE_PROBE = `import { startServer, request, notify, assertSchema } from "${HARNESS}";

const server = await startServer("repo-assistant", []);
const init = await request(server, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "canary-cage", version: "0.1.0" } });
assertSchema(init, { type: "object", required: ["protocolVersion", "serverInfo"] });
await notify(server, "notifications/initialized", {});
const tools = await request(server, "tools/list", {});
assertSchema(tools, { type: "object", required: ["tools"] });
const result = await request(server, "tools/call", { name: "<tool>", arguments: { /* literal arguments matching the tool's inputSchema */ } });
assertSchema(result, { type: "object", required: ["content"] });
server.close();`;

export const SYSTEM_PROMPT = `You write a behavioural probe for one MCP tool. The probe is a short JavaScript ES module that runs inside an isolated sandbox.

Harness, the only module you may import:
  import { startServer, request, notify, assertSchema } from "${HARNESS}";
  startServer(cmd: string, args: string[]): Promise<ServerHandle>      start the MCP server over stdio
  request(handle, method: string, params: object): Promise<unknown>     JSON-RPC request, returns the result or throws
  notify(handle, method: string, params: object): Promise<void>         JSON-RPC notification
  assertSchema(value: unknown, schema: object): void                    throws if value does not match a JSON schema subset (type, required, properties, items, enum, const, minItems)
  handle.close(): void

Rules the validator enforces on the syntax tree. A probe that breaks one is rejected.
1. Exactly one import, the harness line above, no aliases. No other imports, no dynamic import, no require, eval, Function, process, globalThis, fetch, fs, child_process, net, http. Allowed globals: JSON, Object, Array, String, Number, Boolean, Math, Error, console, Promise, Map, Set.
2. Lifecycle calls in this exact order, each once: startServer, request "initialize", notify "notifications/initialized", request "tools/list", request "tools/call". Method names are string literals.
3. Exactly one tools/call. Its params are an object literal { name, arguments } with literal values that match the tool's inputSchema from tools/list.
4. No classes, no this, no computed member access except literal keys, no properties named constructor, prototype or __proto__.
5. At most ${40} statements and 8192 bytes. Top-level await is fine.

Output only the program. No markdown fences, no prose.`;

export interface ProbeAttempt { n: number; model: string; source: string; validation: ValidationResult; runtimeError?: string; ledger: LedgerEntry }
export interface ProbeOutcome { accepted: { source: string; hash: string; call: { name: string; arguments: Record<string, unknown> }; callHash: string } | null; attempts: ProbeAttempt[] }

function stripFences(text: string): string {
  const m = text.match(/```(?:javascript|js|mjs|typescript|ts)?\s*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim() + "\n";
}

export function userPrompt(tools: ToolDescriptor[], targetTool: string, task: string, serverCommand: string): string {
  return `Server command: startServer(${JSON.stringify(serverCommand)}, [])\n\nLive tools/list result:\n${JSON.stringify({ tools }, null, 2)}\n\nTarget tool: ${targetTool}\nTask: ${task}\n\nExample of a probe that passes the validator:\n${EXAMPLE_PROBE}\n\nWrite the probe for the target tool. Assert the shape of the tools/call result.`;
}

export async function writeProbe(opts: { tools: ToolDescriptor[]; targetTool: string; task: string; serverCommand: string; feedback?: { previousSource: string; error: string }; attemptNumber: number; repair?: boolean }): Promise<ProbeAttempt> {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt(opts.tools, opts.targetTool, opts.task, opts.serverCommand) },
  ];
  if (opts.feedback) {
    messages.push({ role: "assistant", content: opts.feedback.previousSource });
    messages.push({ role: "user", content: `That probe failed:\n${opts.feedback.error}\n\nRewrite the whole probe so it passes. Output only the program.` });
  }
  const model = opts.repair ? config.modelRepair || config.model : config.model;
  const { text, entry } = await chat(messages, { purpose: opts.feedback ? "probe repair" : "probe synthesis", model, temperature: 0, maxTokens: 4000 });
  const source = stripFences(text);
  return { n: opts.attemptNumber, model: entry.model, source, validation: validateProbe(source, opts.tools, opts.targetTool), ledger: entry };
}
