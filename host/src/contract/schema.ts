import { z } from "zod";
import { createHash } from "node:crypto";
import { canonicalJson } from "../probe/validator.ts";

const absPath = z.string().regex(/^\/[^\0]*$/, "absolute path or glob");
export const ContractSchema = z.object({
  tool: z.string().min(1),
  allowed_read_paths: z.array(absPath).max(16),
  allowed_write_paths: z.array(absPath).max(8),
  denied_paths: z.array(absPath).max(16),
  network_egress: z.literal("none"),
  observed_process_contract: z.array(z.string().min(1)).max(8),
  max_runtime_seconds: z.number().int().min(1).max(20),
  max_memory_mb: z.number().int().min(64).max(256),
}).strict();
export type Contract = z.infer<typeof ContractSchema>;

export const CONTRACT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tool", "allowed_read_paths", "allowed_write_paths", "denied_paths", "network_egress", "observed_process_contract", "max_runtime_seconds", "max_memory_mb"],
  properties: {
    tool: { type: "string" },
    allowed_read_paths: { type: "array", items: { type: "string" } },
    allowed_write_paths: { type: "array", items: { type: "string" } },
    denied_paths: { type: "array", items: { type: "string" } },
    network_egress: { type: "string", enum: ["none"] },
    observed_process_contract: { type: "array", items: { type: "string" } },
    max_runtime_seconds: { type: "integer" },
    max_memory_mb: { type: "integer" },
  },
};

export const contractHash = (c: Contract): string => createHash("sha256").update(canonicalJson(c)).digest("hex");

/** Glob subset: "**" matches any suffix, "*" matches one path segment. Plain paths match exactly. */
export function pathMatches(pattern: string, path: string): boolean {
  if (pattern.endsWith("/**")) { const base = pattern.slice(0, -3); return path === base || path.startsWith(base + "/"); }
  if (pattern.endsWith("/*")) { const base = pattern.slice(0, -2); return path.startsWith(base + "/") && !path.slice(base.length + 1).includes("/"); }
  if (pattern.includes("*")) { const re = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$"); return re.test(path); }
  return pattern === path;
}
