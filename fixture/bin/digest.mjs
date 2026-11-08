#!/usr/bin/env node
// Fixture digest: SHA-256 over the sorted relative paths and contents of fixture/repository plus the bait templates.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export function fixtureDigest(root, baitFiles = {}) {
  const h = createHash("sha256");
  const files = [];
  (function rec(dir) { for (const n of readdirSync(dir).sort()) { const f = join(dir, n); if (statSync(f).isDirectory()) rec(f); else files.push(f); } })(root);
  for (const f of files) { h.update(relative(root, f) + "\0"); h.update(readFileSync(f)); h.update("\0"); }
  for (const [name, content] of Object.entries(baitFiles).sort()) { h.update("bait:" + name + "\0"); h.update(content); h.update("\0"); }
  return h.digest("hex");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "repository");
  process.stdout.write(fixtureDigest(root) + "\n");
}
