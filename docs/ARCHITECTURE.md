# Canary Cage architecture (component contract for the build)

Derived from the sealed concept note (Vanta Point Labs, 8 November 2026). The host on the Vultr VM is the only place with authority. It owns the MCP lifecycle, the sandboxes, the tracer, the recording gateway, the compiler and the evidence store. The Vultr inference key lives there and never enters a container.

## Nine steps

1. **Inspect.** Host starts the fixture server in a throwaway container, sends initialize, initialized, tools/list, stores the live tool schema, destroys the container.
2. **Probe.** Vultr inference writes a probe program against the four-function harness. AST validator accepts or rejects; one repair round. Accepted probe is hashed and frozen.
3. **Baseline (Run A).** Accepted probe minus its final tools/call, fresh container, discovery profile, strace attached. Events recorded.
4. **Discover (Run B).** Accepted probe, fresh container, discovery profile (private network to the gateway only), strace attached, gateway and DNS logging. Window markers at tools/call send and result.
5. **Attribute.** Each event labelled (startup, also in baseline, newly observed in window, teardown, uncertain). Compared with nothing yet; shown as the observed matrix.
6. **Contract.** Vultr inference proposes the narrowest contract consistent with the declared job and the observed matrix. Closed schema. Human edits or approves. Contract hash computed.
7. **Enforce.** Compiler turns the contract into an enforced Docker profile and evaluation rules. Deterministic.
8. **Replay (Run C).** Identical probe (hash), identical fixture (digest), identical image (digest), enforced profile, bait still planted. OS errors recorded as they happened. Output compared field by field with Run B.
9. **Explain and bundle.** Vultr inference writes the plain-language explanation beside the structured verdict (it cannot change a label). Evidence bundle zipped. Hero screen rendered.

## Processes and trust boundaries

| Component | Runs where | Trust |
|---|---|---|
| Orchestrator (Fastify, TS) | VM host, systemd, as a service user with docker group and ptrace capability (or root for the day, documented) | Trusted |
| Tracer (`strace -f -p`) | VM host, child of the orchestrator | Trusted |
| Gateway (DNS + HTTP(S) sink) | Container on `canary-net` (internal) or host process bound to that bridge | Trusted, logs only |
| Sandbox (fixture server + probe runner) | Fresh container per run, hardened profile | Untrusted |
| Vultr Serverless Inference | External API, called only from the orchestrator | Untrusted output, validated |
| Browser UI | Static files served by the orchestrator | Untrusted input, curated scenarios only |

## Harness API (the only thing a probe may import)

```ts
import { startServer, request, notify, assertSchema } from "@canary-cage/harness";
const s = await startServer("repo-assistant", []);
const init = await request(s, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "canary-cage", version: "0.1.0" } });
await notify(s, "notifications/initialized", {});
const tools = await request(s, "tools/list", {});
const result = await request(s, "tools/call", { name: "summarize_repository", arguments: { path: "/workspace/repository", format: "markdown" } });
assertSchema(result, { type: "object", required: ["content"] });
```

The probe runs inside the sandbox container with Node 24, the harness pre-installed, no network of its own beyond the container's profile, and no environment variables. The harness spawns the fixture server as a child process inside the same container; strace follows children (`-f`).

## Run record (persisted JSON per run)

`id, created_at, scenario, tool, probe {attempts[], accepted_hash, source}, runs {A,B,C: {container_id, image_digest, started_at, ended_at, exit, mcp_transcript[], strace_events[], gateway_log[], docker_changes[], output}}, labels[], matrix, contract {proposed, approved, hash, approved_by, approved_at}, compiled_profile, comparison, verdict_labels[], hashes {probe, call, image, fixture, contract}, inference_ledger[] (model, purpose, latency_ms, prompt_tokens, completion_tokens, structured_response), status`.

## Result labels (exact strings, nothing else)

Within approved capability contract · Undeclared file access observed · Undeclared process execution observed · Undeclared network attempt observed · Confirmed canary contact · Confirmed canary disclosure attempt · Useful output preserved under enforcement · Execution incomplete · Policy could not be enforced · Insufficient evidence.
