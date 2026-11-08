// Vultr Serverless Inference proposes the narrowest contract. Code validates. A human approves. Never automatic.
import { chat, type LedgerEntry } from "../llm/vultr.ts";
import { ContractSchema, CONTRACT_JSON_SCHEMA, type Contract } from "./schema.ts";
import type { MatrixRow } from "../runs/attribution.ts";

export const CONTRACT_SYSTEM = `You propose a least-privilege capability contract for one MCP tool, from the declared job and what a host-side tracer observed during the tool-call window. Output JSON only, matching this schema exactly, no extra keys:
${JSON.stringify(CONTRACT_JSON_SCHEMA)}

Rules.
- allowed_read_paths: only what the declared job needs. Use /dir/** for a tree.
- denied_paths: every observed read or write outside the job, especially credential files, keys and dotfiles. Use exact paths or /dir/**.
- allowed_write_paths: ["/output/**"] unless the job needs more.
- network_egress is always "none" today.
- observed_process_contract: executables the job legitimately needs, usually ["node"].
- max_runtime_seconds at most 20, max_memory_mb at most 256.
You propose. You never decide whether anything was violated.`;

export interface Proposal { contract: Contract | null; raw: string; errors: string[]; ledger: LedgerEntry; ledgerExtra: LedgerEntry[] }

export async function proposeContract(opts: { tool: string; task: string; call: Record<string, unknown>; rows: MatrixRow[]; gatewaySummary: string[] }): Promise<Proposal> {
  const observed = opts.rows.filter((r) => !r.platform && r.labels.some((l) => l.startsWith("newly observed") || l === "attribution uncertain")).map((r) => ({ kind: r.kind, target: r.target, count: r.count, labels: r.labels, errnos: r.errnos }));
  const user = `Tool: ${opts.tool}\nDeclared job: ${opts.task}\nLocked tools/call arguments: ${JSON.stringify(opts.call)}\n\nObserved during the tool-call window (host strace, non-platform rows):\n${JSON.stringify(observed, null, 2)}\n\nGateway and DNS observations:\n${opts.gatewaySummary.join("\n") || "none"}\n\nPropose the contract as JSON.`;
  // Reasoning models may spend their budget thinking, so the budget is generous and an empty or non-JSON
  // answer gets one retry in plain mode. Both calls land in the ledger.
  const messages = [{ role: "system" as const, content: CONTRACT_SYSTEM }, { role: "user" as const, content: user }];
  let { text, entry } = await chat(messages, { purpose: "contract proposal", temperature: 0, maxTokens: 4000, jsonSchema: CONTRACT_JSON_SCHEMA });
  const ledger = [entry];
  const parse = (raw: string): { contract: Contract | null; errors: string[] } => {
    const errors: string[] = [];
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error(raw.trim() ? "no JSON object in the answer" : "empty answer");
      const parsed = ContractSchema.safeParse(JSON.parse(m[0]));
      if (parsed.success) { if (parsed.data.tool !== opts.tool) { errors.push(`contract.tool "${parsed.data.tool}" does not match the locked tool "${opts.tool}"`); return { contract: null, errors }; } return { contract: parsed.data, errors }; }
      errors.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    } catch (e) { errors.push(`not JSON: ${(e as Error).message}`); }
    return { contract: null, errors };
  };
  let result = parse(text);
  if (!result.contract) {
    const retry = await chat([...messages, { role: "user" as const, content: "Answer with the JSON object only, no reasoning, no prose, no code fences." }], { purpose: "contract proposal retry", temperature: 0, maxTokens: 4000 });
    ledger.push(retry.entry);
    text = retry.text;
    result = parse(text);
  }
  return { contract: result.contract, raw: text, errors: result.errors, ledger: ledger[0], ledgerExtra: ledger.slice(1) };
}
