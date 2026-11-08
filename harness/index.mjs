// @canary-cage/harness. The only module a probe may import. Exactly four exports.
// Transport: child process over stdio, newline-delimited JSON-RPC 2.0.
// Every message in both directions is echoed to stderr as a transcript line:
//   {"cc":"mcp","t":<epoch ms>,"dir":"c2s"|"s2c"|"stderr","msg":...}
// so the host can mark the tools/call window on the same clock as strace.
import { spawn } from "node:child_process";

const REQUEST_TIMEOUT_MS = 8000;

function transcript(dir, msg) {
  process.stderr.write(JSON.stringify({ cc: "mcp", t: Date.now(), dir, msg }) + "\n");
}

export async function startServer(cmd, args = []) {
  if (typeof cmd !== "string" || !Array.isArray(args)) throw new TypeError("startServer(cmd: string, args: string[])");
  const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let nextId = 1;
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { transcript("s2c-invalid", line.slice(0, 2000)); continue; }
      transcript("s2c", msg);
      if (msg && msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`));
        else resolve(msg.result);
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => transcript("stderr", chunk));
  const exited = new Promise((resolve) => child.on("exit", (code, signal) => { transcript("exit", { code, signal }); resolve(); }));
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  const handle = {
    pid: child.pid,
    close() { try { child.stdin.end(); } catch {} setTimeout(() => { try { child.kill("SIGTERM"); } catch {} }, 200); },
    _send(obj) { transcript("c2s", obj); child.stdin.write(JSON.stringify(obj) + "\n"); },
    _pending: pending,
    _nextId() { return nextId++; },
    _exited: exited,
  };
  return handle;
}

export async function request(handle, method, params = {}) {
  if (!handle || typeof handle._send !== "function") throw new TypeError("request(handle, method, params): bad handle");
  if (typeof method !== "string") throw new TypeError("method must be a string");
  const id = handle._nextId();
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { handle._pending.delete(id); reject(new Error(`timeout waiting for ${method}`)); }, REQUEST_TIMEOUT_MS);
    handle._pending.set(id, { resolve, reject, timer });
  });
  handle._send({ jsonrpc: "2.0", id, method, params });
  return result;
}

export async function notify(handle, method, params = {}) {
  if (!handle || typeof handle._send !== "function") throw new TypeError("notify(handle, method, params): bad handle");
  handle._send({ jsonrpc: "2.0", method, params });
}

export function assertSchema(value, schema) {
  const errors = [];
  check(value, schema, "$", errors);
  if (errors.length) throw new Error("schema mismatch: " + errors.join("; "));
}

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function check(value, schema, path, errors) {
  if (!schema || typeof schema !== "object") return;
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) errors.push(`${path} not in enum`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const t = typeOf(value);
    const ok = types.some((x) => x === t || (x === "number" && t === "integer"));
    if (!ok) { errors.push(`${path} expected ${types.join("|")} got ${t}`); return; }
  }
  if (schema.type === "object" || schema.properties || schema.required) {
    if (typeOf(value) !== "object") { errors.push(`${path} expected object`); return; }
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key} is required`);
    for (const [key, sub] of Object.entries(schema.properties ?? {})) if (key in value) check(value[key], sub, `${path}.${key}`, errors);
  }
  if (schema.type === "array" || schema.items || schema.minItems !== undefined) {
    if (!Array.isArray(value)) { errors.push(`${path} expected array`); return; }
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} needs at least ${schema.minItems} items`);
    if (schema.items) value.forEach((item, i) => check(item, schema.items, `${path}[${i}]`, errors));
  }
}
