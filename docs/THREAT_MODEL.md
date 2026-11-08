# Threat model

## Assets

The host VM and its Docker daemon. The Vultr inference key. The evidence record of each run. The public URL's availability.

## Adversaries considered

1. The MCP server under test. It may do anything a process can do inside the sandbox. Read files, spawn processes, open sockets, consume resources, corrupt its stdout, lie on stderr.
2. The model-written probe. It is untrusted code. It may try to import modules, reach the network, or escape the harness.
3. The public. Judges and strangers clicking the demo URL at the same time, or scripting it.
4. The model's proposals. The contract proposal may be too wide, malformed or adversarial.

## Boundaries and controls

| Boundary | Control | What it stops |
|---|---|---|
| Sandbox to host | Docker, fixed non-root uid, all capabilities dropped, no new privileges, read-only root, no Docker socket, no host mounts except a read-only input tree, cgroup limits, 20 s kill | Code in the container touching the host or the app runtime |
| Sandbox to network | Internal Docker network with the recording gateway as the only other member in discovery, `--network none` in replay | Exfiltration to the internet, reaching cloud metadata or private ranges |
| Sandbox to secrets | Empty environment except `PATH` and `HOME`, inference key only on the host | Credentials inside the sandbox |
| Probe to runtime | AST validator (one import, lifecycle order, literal tool arguments against the live schema, no dynamic code). A language restriction, not a security boundary. Docker is the boundary | Probes that do more than the lifecycle |
| Model to decisions | The model never decides a verdict, emits Docker flags, mounts or shell, overrides a result or approves its own contract. Contract validated against a closed schema, approved by a person, compiled by deterministic code | Prompt injection through tool output changing enforcement |
| Sandbox to evidence | Host-side strace attached from outside the container before the probe starts, gateway and DNS logs on the host, `docker diff` | The server tampering with in-process hooks. Server stderr is kept but marked untrusted |
| Public to host | One active run, queue, per-IP rate limits, daily inference budget, curated scenarios only, operator token on admin endpoints, 64 KiB body limit | Overload, abuse, arbitrary packages or paths |

## Residual risks, stated

Processes executed inside the sandbox are observed and compared with the contract, not prevented. Baseline subtraction is useful but not proof of attribution; the uncertain label exists for this reason. A tool that sleeps past the 20 second window, uses kernel features strace does not see, or encrypts payloads can hide behaviour; coverage is listed per run. The validator can be bypassed by a sufficiently creative probe, which is why Docker and not the validator is the boundary. A canary contact during replay is reported as a critical enforcement failure rather than hidden.
