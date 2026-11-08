// Attribution engine. Five labels, exact strings. Baseline subtraction is useful, not proof, so uncertainty is shown.
import type { TraceEvent } from "../trace/strace.ts";

export const ATTRIBUTION = {
  startup: "observed during startup",
  baseline: "also present in baseline",
  window: "newly observed during the tool-call window",
  teardown: "observed during teardown",
  uncertain: "attribution uncertain",
} as const;
export type Attribution = (typeof ATTRIBUTION)[keyof typeof ATTRIBUTION];
export const SKEW_MS = 30;

export interface Window { callSentAt: number | null; resultAt: number | null }
export interface LabelledEvent extends TraceEvent { label: Attribution; platform: boolean }
export interface MatrixRow { kind: TraceEvent["kind"]; target: string; count: number; labels: Attribution[]; errnos: string[]; first_t: number; platform: boolean; pids: number[] }

const PLATFORM = [/^\/usr\//, /^\/lib/, /^\/etc\//, /^\/run-input\/run\.json$/, /^\/proc\//, /^\/sys\//, /^\/dev\//, /^\/opt\/sandbox\/node_modules\/@canary-cage\//, /^\/opt\/sandbox\/node_modules\/@canary-lab\//, /^\/opt\/sandbox\/probe/, /^\/opt\/sandbox\/package\.json/, /^\/opt\/sandbox\/node_modules\/package\.json/, /^\/opt\/package\.json/, /^\/package\.json$/, /^\/etc\/(passwd|group|hosts|resolv\.conf|nsswitch\.conf|localtime|ssl|gai\.conf|host\.conf|services)/, /^\/usr\/local\/bin\//, /^\/run-input\/probe/, /^unix:/];
export const isPlatform = (ev: TraceEvent): boolean => ev.target === null || PLATFORM.some((re) => re.test(ev.target!)) || (ev.kind === "exec" && /\/node$|\/sh$|\/launch$/.test(ev.target));

export const eventKey = (ev: TraceEvent): string | null => (ev.target ? `${ev.kind}:${ev.target}` : null);

export function labelEvents(events: TraceEvent[], window: Window, baseline: TraceEvent[]): LabelledEvent[] {
  const baselineKeys = new Set(baseline.map(eventKey).filter(Boolean) as string[]);
  return events.map((ev) => {
    let label: Attribution;
    // The window is [callSentAt, resultAt]. Events just before the call was sent, or just after the result
    // arrived, sit inside the clock-skew band and are labelled uncertain rather than assigned either way.
    if (window.callSentAt === null) label = ATTRIBUTION.uncertain;
    else if (ev.t < window.callSentAt - SKEW_MS) label = ATTRIBUTION.startup;
    else if (ev.t < window.callSentAt) label = ATTRIBUTION.uncertain;
    else if (window.resultAt !== null && ev.t > window.resultAt + SKEW_MS) label = ATTRIBUTION.teardown;
    else if (window.resultAt !== null && ev.t > window.resultAt) label = ATTRIBUTION.uncertain;
    else { const k = eventKey(ev); label = k && baselineKeys.has(k) ? ATTRIBUTION.baseline : ATTRIBUTION.window; }
    return { ...ev, label, platform: isPlatform(ev) };
  });
}

export function matrix(events: LabelledEvent[]): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  for (const ev of events) {
    if (!ev.target || ev.kind === "clone" || ev.kind === "other") continue;
    const key = eventKey(ev)!;
    const row = rows.get(key) ?? { kind: ev.kind, target: ev.target, count: 0, labels: [], errnos: [], first_t: ev.t, platform: ev.platform, pids: [] };
    row.count++;
    if (!row.labels.includes(ev.label)) row.labels.push(ev.label);
    if (ev.errno && !row.errnos.includes(ev.errno)) row.errnos.push(ev.errno);
    if (!row.pids.includes(ev.pid)) row.pids.push(ev.pid);
    row.first_t = Math.min(row.first_t, ev.t);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.first_t - b.first_t);
}

/** Window markers from the harness transcript (stderr lines {"cc":"mcp",...}). */
export function parseTranscript(stderr: string): { messages: { t: number; dir: string; msg: unknown }[]; window: Window; serverStderr: string[] } {
  const messages: { t: number; dir: string; msg: unknown }[] = [];
  const serverStderr: string[] = [];
  for (const line of stderr.split("\n")) {
    if (!line.trim()) continue;
    try { const o = JSON.parse(line); if (o && o.cc === "mcp") { if (o.dir === "stderr") serverStderr.push(String(o.msg)); else messages.push({ t: o.t, dir: o.dir, msg: o.msg }); continue; } } catch {}
    serverStderr.push(line);
  }
  let callSentAt: number | null = null, resultAt: number | null = null, callId: unknown = null;
  for (const m of messages) {
    const msg = m.msg as { method?: string; id?: unknown; result?: unknown; error?: unknown };
    if (m.dir === "c2s" && msg.method === "tools/call") { callSentAt = m.t; callId = msg.id; }
    else if (m.dir === "s2c" && callId !== null && msg.id === callId && (msg.result !== undefined || msg.error !== undefined)) resultAt = m.t;
  }
  return { messages, window: { callSentAt, resultAt }, serverStderr };
}
