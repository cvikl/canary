// Run A derivation. Deterministic AST transform: remove the statement that contains the tools/call
// request and every later statement that references a binding introduced by it. Everything else stays.
import { parse, type Node } from "acorn";
type AnyNode = Node & Record<string, any>;

const FN = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
/** True when the tools/call sits in this statement outside any nested function body. */
function containsToolsCall(node: AnyNode): boolean {
  let found = false;
  (function rec(n: AnyNode) {
    if (!n || typeof n.type !== "string" || found) return;
    if (FN.has(n.type)) return;
    if (n.type === "CallExpression" && n.callee.type === "Identifier" && n.callee.name === "request") {
      const m = n.arguments[1];
      if (m && ((m.type === "Literal" && m.value === "tools/call") || (m.type === "TemplateLiteral" && m.quasis[0]?.value.cooked === "tools/call"))) { found = true; return; }
    }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(rec); else if (v && typeof v.type === "string") rec(v); }
  })(node);
  return found;
}

function bindingsOf(stmt: AnyNode): Set<string> {
  const out = new Set<string>();
  const add = (p: AnyNode) => { if (!p) return; if (p.type === "Identifier") out.add(p.name); else if (p.type === "ObjectPattern") p.properties.forEach((q: AnyNode) => add(q.type === "RestElement" ? q.argument : q.value)); else if (p.type === "ArrayPattern") p.elements.forEach(add); else if (p.type === "AssignmentPattern") add(p.left); else if (p.type === "RestElement") add(p.argument); };
  if (stmt.type === "VariableDeclaration") stmt.declarations.forEach((d: AnyNode) => add(d.id));
  return out;
}

function references(node: AnyNode, names: Set<string>): boolean {
  let hit = false;
  (function rec(n: AnyNode, parent: AnyNode | null) {
    if (!n || typeof n.type !== "string" || hit) return;
    if (n.type === "Identifier" && names.has(n.name) && !(parent && parent.type === "MemberExpression" && parent.property === n && !parent.computed) && !(parent && parent.type === "Property" && parent.key === n && !parent.computed)) { hit = true; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => rec(c, n)); else if (v && typeof v.type === "string") rec(v, n); }
  })(node, null);
  return hit;
}

export function deriveBaseline(source: string): string {
  const ast = parse(source, { ecmaVersion: 2024, sourceType: "module", allowAwaitOutsideFunction: true }) as AnyNode;
  const removals: [number, number][] = [];
  const process = (body: AnyNode[]) => {
    const idx = body.findIndex((s) => containsToolsCall(s));
    if (idx < 0) {
      // Descend into nested function bodies and blocks (e.g. async function main() { ... }).
      const visit = (n: AnyNode) => { if (!n || typeof n.type !== "string") return; if (n.type === "BlockStatement") { process(n.body); return; } for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === "string") visit(v); } };
      for (const s of body) visit(s);
      return;
    }
    const removed = new Set<string>();
    for (let i = idx; i < body.length; i++) {
      const s = body[i];
      if (i === idx || references(s, removed)) { removals.push([s.start, s.end]); for (const b of bindingsOf(s)) removed.add(b); }
    }
  };
  process(ast.body);
  let out = source;
  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + out.slice(end);
  return out.replace(/\n{3,}/g, "\n\n");
}
