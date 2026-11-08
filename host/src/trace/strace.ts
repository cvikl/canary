// Host-side tracer. strace -f attached from outside the container is authoritative evidence.
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { config } from "../config.ts";

export interface TraceEvent {
  pid: number;
  t: number;              // epoch ms (host clock, same kernel clock as the container)
  syscall: string;
  args: string;
  ret: string;
  errno: string | null;
  kind: "file-read" | "file-write" | "exec" | "connect" | "sendto" | "clone" | "other";
  target: string | null;  // path, exe or ip:port
}

export interface TraceSession { stop(): Promise<{ events: TraceEvent[]; raw: string; coverage: string }>; attached: boolean; reason?: string }

const SYSCALLS = "trace=openat,open,openat2,connect,sendto,sendmsg,execve,execveat,clone,clone3,vfork";

export async function attachTracer(pid: number, outFile: string, dayStartMs: number): Promise<TraceSession> {
  if (config.traceDisabled) return { attached: false, reason: "tracer disabled by CANARY_NO_STRACE", stop: async () => ({ events: [], raw: "", coverage: "none (tracer disabled)" }) };
  let child: ChildProcess;
  try { child = spawn("strace", ["-f", "-tt", "-s", "256", "-e", SYSCALLS, "-o", outFile, "-p", String(pid)], { stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return { attached: false, reason: String(e), stop: async () => ({ events: [], raw: "", coverage: `none (${String(e)})` }) }; }
  let err = "";
  child.stderr!.on("data", (c: Buffer) => { err += c.toString(); });
  const attached = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    const check = () => { if (/attached/.test(err)) { clearTimeout(timer); resolve(true); } else if (/Operation not permitted|No such process|Could not attach/.test(err)) { clearTimeout(timer); resolve(false); } };
    child.stderr!.on("data", check);
    child.on("exit", () => { clearTimeout(timer); resolve(/attached/.test(err)); });
  });
  if (!attached) { try { child.kill("SIGKILL"); } catch {} return { attached: false, reason: err.trim() || "strace did not attach", stop: async () => ({ events: [], raw: "", coverage: `none (${err.trim() || "strace did not attach"})` }) }; }
  return {
    attached: true,
    async stop() {
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        const t = setTimeout(() => { try { child.kill("SIGINT"); } catch {} setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve(); }, 1500); }, 1500);
        child.on("exit", () => { clearTimeout(t); resolve(); });
      });
      const raw = existsSync(outFile) ? readFileSync(outFile, "utf8") : "";
      return { events: parseStrace(raw, dayStartMs), raw, coverage: `strace -f (${SYSCALLS.replace("trace=", "")}), host side` };
    },
  };
}

function classify(syscall: string, args: string): { kind: TraceEvent["kind"]; target: string | null } {
  if (/^open(at2?)?$/.test(syscall)) {
    const m = args.match(/"((?:[^"\\]|\\.)*)"/);
    const path = m ? m[1] : null;
    const write = /O_WRONLY|O_RDWR|O_CREAT|O_TRUNC/.test(args);
    return { kind: write ? "file-write" : "file-read", target: path };
  }
  if (/^execve(at)?$/.test(syscall)) { const m = args.match(/"((?:[^"\\]|\\.)*)"/); return { kind: "exec", target: m ? m[1] : null }; }
  if (syscall === "connect" || syscall === "sendto" || syscall === "sendmsg") {
    const ip = args.match(/inet_addr\("([^"]+)"\)/)?.[1] ?? args.match(/inet_pton\([^,]+,\s*"([^"]+)"/)?.[1];
    const port = args.match(/htons\((\d+)\)/)?.[1];
    const unix = args.match(/sun_path="([^"]+)"/)?.[1];
    const target = ip ? `${ip}:${port ?? "?"}` : unix ? `unix:${unix}` : null;
    return { kind: syscall === "connect" ? "connect" : "sendto", target };
  }
  if (/^(clone3?|vfork)$/.test(syscall)) return { kind: "clone", target: null };
  return { kind: "other", target: null };
}

export function parseStrace(raw: string, dayStartMs: number): TraceEvent[] {
  const events: TraceEvent[] = [];
  const unfinished = new Map<number, { t: number; head: string }>();
  const toMs = (hms: string): number => {
    const [h, m, s] = hms.split(":");
    const sec = Number(s);
    return dayStartMs + ((Number(h) * 60 + Number(m)) * 60 + sec) * 1000;
  };
  for (const line of raw.split("\n")) {
    const m = line.match(/^(\d+)\s+(\d\d:\d\d:\d\d\.\d+)\s+(.*)$/);
    if (!m) continue;
    const pid = Number(m[1]); const t = Math.round(toMs(m[2])); let rest = m[3];
    if (rest.startsWith("+++") || rest.startsWith("---")) continue;
    if (rest.endsWith("<unfinished ...>")) { unfinished.set(pid, { t, head: rest.replace(/\s*<unfinished \.\.\.>$/, "") }); continue; }
    const resumed = rest.match(/^<\.\.\. (\w+) resumed>\s*(.*)$/);
    if (resumed) { const u = unfinished.get(pid); if (!u) continue; unfinished.delete(pid); rest = u.head + resumed[2]; }
    const call = rest.match(/^(\w+)\((.*)\)\s*=\s*(-?\d+|0x[0-9a-f]+|\?)(?:\s+(E[A-Z]+)\s*\(([^)]*)\))?/);
    if (!call) continue;
    const [, syscall, args, ret, errno] = call;
    const { kind, target } = classify(syscall, args);
    events.push({ pid, t, syscall, args: args.slice(0, 400), ret, errno: errno ?? null, kind, target });
  }
  return events;
}
