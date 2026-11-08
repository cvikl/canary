// AST validator for model-written probes. Parses, never pattern-matches.
// It restricts what a probe may say. It is a language restriction, not a security boundary. Docker is.
import { parse, type Node } from "acorn";
import { createHash } from "node:crypto";
import { Ajv } from "ajv";

export const HARNESS = "@canary-cage/harness";
export const HARNESS_EXPORTS = ["startServer", "request", "notify", "assertSchema"] as const;
const ALLOWED_GLOBALS = new Set(["JSON", "Object", "Array", "String", "Number", "Boolean", "Math", "Error", "TypeError", "console", "undefined", "Promise", "Map", "Set", "Infinity", "NaN"]);
const FORBIDDEN_PROPS = new Set(["constructor", "__proto__", "prototype", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"]);
const LIFECYCLE = ["startServer", "initialize", "notifications/initialized", "tools/list", "tools/call"] as const;
export const MAX_BYTES = 8192;
export const MAX_STATEMENTS = 40;

export interface ToolDescriptor { name: string; inputSchema?: object }
export interface Accepted { ok: true; hash: string; call: { name: string; arguments: Record<string, unknown> }; callHash: string; statements: number; bytes: number }
export interface Rejected { ok: false; violations: string[] }
export type ValidationResult = Accepted | Rejected;

type AnyNode = Node & Record<string, any>;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value as object).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson((value as any)[k])).join(",") + "}";
  return JSON.stringify(value);
}
export const sha256 = (s: string | Buffer): string => createHash("sha256").update(s).digest("hex");

/** Evaluate an object/array/primitive literal AST to a value. Returns undefined marker on non-literal. */
function literalValue(node: AnyNode, violations: string[], where: string): unknown {
  switch (node.type) {
    case "Literal": return node.value;
    case "TemplateLiteral": if (node.expressions.length === 0) return node.quasis.map((q: AnyNode) => q.value.cooked).join(""); break;
    case "UnaryExpression": if (node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number") return -node.argument.value; break;
    case "ArrayExpression": return node.elements.map((e: AnyNode, i: number) => (e ? literalValue(e, violations, `${where}[${i}]`) : null));
    case "ObjectExpression": {
      const out: Record<string, unknown> = {};
      for (const p of node.properties) {
        if (p.type !== "Property" || p.computed || p.kind !== "init" || p.method) { violations.push(`${where}: only plain literal properties are allowed`); continue; }
        const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? String(p.key.value) : null;
        if (key === null) { violations.push(`${where}: unsupported property key`); continue; }
        out[key] = literalValue(p.value, violations, `${where}.${key}`);
      }
      return out;
    }
  }
  violations.push(`${where}: must be a literal value (got ${node.type})`);
  return undefined;
}

function collectDeclared(ast: AnyNode): Set<string> {
  const names = new Set<string>();
  const addPattern = (p: AnyNode): void => {
    if (!p) return;
    switch (p.type) {
      case "Identifier": names.add(p.name); break;
      case "ObjectPattern": for (const prop of p.properties) addPattern(prop.type === "RestElement" ? prop.argument : prop.value); break;
      case "ArrayPattern": for (const el of p.elements) addPattern(el); break;
      case "RestElement": addPattern(p.argument); break;
      case "AssignmentPattern": addPattern(p.left); break;
    }
  };
  walk(ast, (n) => {
    if (n.type === "VariableDeclarator") addPattern(n.id);
    else if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") { if (n.id) names.add(n.id.name); for (const p of n.params) addPattern(p); }
    else if (n.type === "CatchClause" && n.param) addPattern(n.param);
    else if (n.type === "ImportSpecifier") names.add(n.local.name);
  });
  return names;
}

function walk(node: AnyNode, visit: (n: AnyNode, parent: AnyNode | null) => void, parent: AnyNode | null = null): void {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "range") continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") walk(c, visit, node); }
    else if (v && typeof v.type === "string") walk(v, visit, node);
  }
}

function methodLiteral(call: AnyNode): string | null {
  const arg = call.arguments[1];
  if (!arg) return null;
  if (arg.type === "Literal" && typeof arg.value === "string") return arg.value;
  if (arg.type === "TemplateLiteral" && arg.expressions.length === 0) return arg.quasis[0].value.cooked;
  return null;
}

export function validateProbe(source: string, tools: ToolDescriptor[], targetTool?: string): ValidationResult {
  const violations: string[] = [];
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > MAX_BYTES) violations.push(`source is ${bytes} bytes, cap is ${MAX_BYTES}`);
  let ast: AnyNode;
  try { ast = parse(source, { ecmaVersion: 2024, sourceType: "module", allowAwaitOutsideFunction: true }) as AnyNode; }
  catch (e) { return { ok: false, violations: [...violations, `parse error: ${(e as Error).message}`] }; }

  let statements = 0;
  walk(ast, (n) => { if (/Statement$|Declaration$/.test(n.type) && n.type !== "VariableDeclarator") statements++; });
  if (statements > MAX_STATEMENTS) violations.push(`${statements} statements, cap is ${MAX_STATEMENTS}`);

  const imports = ast.body.filter((n: AnyNode) => n.type === "ImportDeclaration");
  if (imports.length !== 1) violations.push(`exactly one import is required, found ${imports.length}`);
  for (const imp of imports) {
    if (imp.source.value !== HARNESS) violations.push(`import source must be "${HARNESS}", found "${imp.source.value}"`);
    for (const s of imp.specifiers) {
      if (s.type !== "ImportSpecifier") { violations.push(`only named imports from the harness are allowed (${s.type})`); continue; }
      const imported = s.imported.type === "Identifier" ? s.imported.name : String(s.imported.value);
      if (!(HARNESS_EXPORTS as readonly string[]).includes(imported)) violations.push(`"${imported}" is not a harness export`);
      if (s.local.name !== imported) violations.push(`import alias "${imported} as ${s.local.name}" is not allowed`);
    }
  }
  for (const n of ast.body) if (n.type === "ExportNamedDeclaration" || n.type === "ExportDefaultDeclaration" || n.type === "ExportAllDeclaration") violations.push("exports are not allowed");

  const declared = collectDeclared(ast);
  for (const name of HARNESS_EXPORTS) if (declared.has(name) && !imports.some((i: AnyNode) => i.specifiers.some((s: AnyNode) => s.local.name === name))) violations.push(`"${name}" may not be redeclared`);
  const declaredNonImport = new Set(declared);
  for (const i of imports) for (const s of i.specifiers) declaredNonImport.delete(s.local.name);
  for (const name of declaredNonImport) if ((HARNESS_EXPORTS as readonly string[]).includes(name)) violations.push(`"${name}" shadows a harness export`);

  const calls: { fn: string; node: AnyNode; method: string | null }[] = [];
  walk(ast, (n, parent) => {
    switch (n.type) {
      case "ImportExpression": violations.push("dynamic import() is not allowed"); break;
      case "MetaProperty": violations.push("import.meta is not allowed"); break;
      case "WithStatement": violations.push("with statements are not allowed"); break;
      case "ThisExpression": violations.push("this is not allowed"); break;
      case "ClassDeclaration": case "ClassExpression": violations.push("classes are not allowed"); break;
      case "TaggedTemplateExpression": violations.push("tagged templates are not allowed"); break;
      case "NewExpression": if (!(n.callee.type === "Identifier" && (n.callee.name === "Error" || n.callee.name === "TypeError"))) violations.push(`new ${n.callee.name ?? n.callee.type} is not allowed`); break;
      case "MemberExpression": {
        if (n.computed) {
          if (!(n.property.type === "Literal" && (typeof n.property.value === "string" || typeof n.property.value === "number"))) violations.push("computed member access must use a literal key");
          else if (typeof n.property.value === "string" && FORBIDDEN_PROPS.has(n.property.value)) violations.push(`property "${n.property.value}" is not allowed`);
        } else if (FORBIDDEN_PROPS.has(n.property.name)) violations.push(`property "${n.property.name}" is not allowed`);
        break;
      }
      case "Identifier": {
        const isPropertyKey = parent && ((parent.type === "MemberExpression" && parent.property === n && !parent.computed) || (parent.type === "Property" && parent.key === n && !parent.computed) || (parent.type === "MethodDefinition" && parent.key === n) || (parent.type === "ImportSpecifier"));
        const isLabel = parent && (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement");
        if (!isPropertyKey && !isLabel && !declared.has(n.name) && !ALLOWED_GLOBALS.has(n.name)) violations.push(`identifier "${n.name}" is not declared and not an allowed global`);
        break;
      }
      case "CallExpression": {
        if (n.callee.type === "Identifier" && (HARNESS_EXPORTS as readonly string[]).includes(n.callee.name)) calls.push({ fn: n.callee.name, node: n, method: n.callee.name === "request" || n.callee.name === "notify" ? methodLiteral(n) : null });
        if (n.callee.type === "Identifier" && (n.callee.name === "eval" || n.callee.name === "Function" || n.callee.name === "require")) violations.push(`${n.callee.name}() is not allowed`);
        break;
      }
    }
  });

  // Lifecycle order. Harness calls in source order must be: startServer, request initialize, notify initialized, request tools/list, request tools/call. assertSchema may appear anywhere.
  const lifecycle = calls.filter((c) => c.fn !== "assertSchema");
  const seq = lifecycle.map((c) => (c.fn === "startServer" ? "startServer" : c.method ?? `${c.fn}(<non-literal method>)`));
  for (const c of lifecycle) if (c.fn !== "startServer" && c.method === null) violations.push(`${c.fn}() method must be a string literal`);
  const expected = [...LIFECYCLE];
  if (seq.length !== expected.length || seq.some((s, i) => s !== expected[i])) violations.push(`lifecycle calls must be exactly [${expected.join(", ")}] in order, found [${seq.join(", ")}]`);
  for (const c of lifecycle) {
    if (c.fn === "request" && c.method === "initialize") { if (c.node.arguments.length !== 3) violations.push("initialize must pass params"); }
    if (c.fn === "notify" && c.method !== "notifications/initialized") violations.push(`notify("${c.method}") is not allowed`);
  }
  const toolCalls = calls.filter((c) => c.fn === "request" && c.method === "tools/call");
  if (toolCalls.length !== 1) violations.push(`exactly one tools/call is required, found ${toolCalls.length}`);

  let call: Accepted["call"] | null = null;
  if (toolCalls.length === 1) {
    const params = toolCalls[0].node.arguments[2];
    if (!params || params.type !== "ObjectExpression") violations.push("tools/call params must be an object literal");
    else {
      const value = literalValue(params, violations, "tools/call params") as Record<string, unknown> | undefined;
      if (value && typeof value.name === "string" && value.arguments && typeof value.arguments === "object") {
        call = { name: value.name, arguments: value.arguments as Record<string, unknown> };
        const tool = tools.find((t) => t.name === call!.name);
        if (!tool) violations.push(`tool "${call.name}" is not in tools/list`);
        else if (targetTool && call.name !== targetTool) violations.push(`tool "${call.name}" is not the requested tool "${targetTool}"`);
        else if (tool.inputSchema) {
          const ajv = new Ajv({ strict: false, allErrors: true });
          const check = ajv.compile(tool.inputSchema);
          if (!check(call.arguments)) violations.push(`tools/call arguments do not match the live schema: ${ajv.errorsText(check.errors)}`);
        }
      } else violations.push("tools/call params need literal name and arguments");
    }
  }

  if (violations.length) return { ok: false, violations: [...new Set(violations)] };
  return { ok: true, hash: sha256(source), call: call!, callHash: sha256(canonicalJson({ method: "tools/call", params: call })), statements, bytes };
}
