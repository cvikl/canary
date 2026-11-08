import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueue, position, queueState } from "../host/src/api/queue.ts";
import { allow } from "../host/src/api/ratelimit.ts";

test("queue runs one job at a time and reports positions", async () => {
  const order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  enqueue({ id: "a", kind: "discovery", work: async () => { order.push("a-start"); await gate; order.push("a-end"); } });
  const p = enqueue({ id: "b", kind: "discovery", work: async () => { order.push("b"); } });
  assert.equal(p, 1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(position("a"), 0); assert.equal(position("b"), 1); assert.deepEqual(queueState().waiting, ["b"]);
  release();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(order, ["a-start", "a-end", "b"]);
  assert.equal(position("b"), -1);
});

test("rate limit per ip", () => {
  assert.equal(allow("1.2.3.4", 2, 1000).ok, true);
  assert.equal(allow("1.2.3.4", 2, 1000).ok, true);
  const third = allow("1.2.3.4", 2, 1000);
  assert.equal(third.ok, false); assert.ok(third.retryAfterSeconds >= 1);
  assert.equal(allow("5.6.7.8", 2, 1000).ok, true);
});
