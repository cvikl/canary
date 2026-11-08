// Output comparison. Schema validity plus field-level equality, not whole-string equality.
export interface FieldRow { field: string; discovery: unknown; replay: unknown; match: boolean }
export interface Comparison { schemaValid: boolean; fields: FieldRow[]; allMatch: boolean; note: string }

export function extractSummary(result: unknown): Record<string, unknown> | null {
  const r = result as { structuredContent?: unknown; content?: { type: string; text?: string }[]; isError?: boolean } | null;
  if (!r || typeof r !== "object" || r.isError) return null;
  if (r.structuredContent && typeof r.structuredContent === "object") return r.structuredContent as Record<string, unknown>;
  const text = r.content?.find((c) => c.type === "text")?.text;
  if (text === undefined) return null;
  try { const parsed = JSON.parse(text); if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>; } catch {}
  return { text };
}

export function compareOutputs(discovery: unknown, replay: unknown): Comparison {
  const b = extractSummary(discovery), c = extractSummary(replay);
  const schemaValid = !!c && Array.isArray((replay as { content?: unknown })?.content) && ((replay as { content: unknown[] }).content.length > 0);
  if (!b || !c) return { schemaValid, fields: [], allMatch: false, note: !c ? "Run C returned no usable result" : "Run B returned no usable result" };
  const keys = [...new Set([...Object.keys(b), ...Object.keys(c)])].sort();
  const fields = keys.map((k) => ({ field: k, discovery: b[k], replay: c[k], match: JSON.stringify(b[k]) === JSON.stringify(c[k]) }));
  const allMatch = fields.every((f) => f.match);
  return { schemaValid, fields, allMatch, note: allMatch ? "all fields equal" : `${fields.filter((f) => !f.match).length} field(s) diverge, output divergence for human review` };
}
