# Disclosure of prior work and dependencies

Canary Cage for MCP was built on 8 November 2026 for Vultr Agent Rush. Earlier projects by the same team informed patterns. No file from an earlier project was copied into this repository. The table lists the patterns and where the new code lives.

| Prior project (licence) | Pattern that informed this build | New code here |
|---|---|---|
| Origit (MIT) | Hashed provenance for agent reads, writes and runs | `host/src/probe/validator.ts` (probe and call hashes), `host/src/runs/orchestrator.ts` (four-part replay identity, contract hash shown apart) |
| CRA Watch (MIT) | Evidence-driven review workflow, deploy script shape (rsync, build, restart, health check), documentary page style | `deploy/publish.sh`, `web/` |
| Marksweep (MIT) | Hashes and a model-call ledger | `host/src/llm/vultr.ts` (inference ledger), evidence bundle |
| NoticeGuard, RentCite | Model proposes, deterministic code decides | `host/src/contract/`, `host/src/compiler/compile.ts` |

## Copied code

None. Every file in this repository was written for this submission. Where a file follows an earlier convention it is named above.

## Third-party dependencies (npm, all permissive licences)

acorn and acorn-walk (MIT), ajv (MIT), archiver (MIT), dockerode (Apache-2.0), fastify and @fastify/static (MIT), zod (MIT), typescript and @types (MIT, Apache-2.0). Container base image `node:24-slim` (MIT, Debian). Host tools: Docker CE, strace, Caddy, openssl.
