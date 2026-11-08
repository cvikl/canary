// One active sandbox run at a time. Everyone else sees a queue position, never an error page.
export interface Job { id: string; kind: "discovery" | "replay"; work: () => Promise<void> }
const queue: Job[] = [];
let active: Job | null = null;
const listeners = new Set<() => void>();
export const onQueueChange = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => { for (const fn of listeners) fn(); };

export function enqueue(job: Job): number {
  queue.push(job);
  notify();
  void pump();
  return position(job.id);
}
export function position(runId: string): number {
  if (active?.id === runId) return 0;
  const i = queue.findIndex((j) => j.id === runId);
  return i < 0 ? -1 : i + 1;
}
export const queueState = () => ({ active: active?.id ?? null, waiting: queue.map((j) => j.id) });

async function pump(): Promise<void> {
  if (active || queue.length === 0) return;
  active = queue.shift()!;
  notify();
  try { await active.work(); } catch (e) { console.error("job failed", active.id, e); }
  active = null;
  notify();
  void pump();
}
