// Per-IP sliding window. Small and in memory; the host is a single process.
const hits = new Map<string, number[]>();
export function allow(ip: string, limit: number, windowMs: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(ip, arr); return { ok: false, retryAfterSeconds: Math.ceil((arr[0] + windowMs - now) / 1000) }; }
  arr.push(now); hits.set(ip, arr);
  return { ok: true, retryAfterSeconds: 0 };
}
