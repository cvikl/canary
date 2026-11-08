# Limits

What Canary Cage can show, for one recorded run, and what it does not claim.

| Can show | Does not claim |
|---|---|
| Which file, process and network actions the host observed during startup and during one isolated tool call | That the tool is safe for every input, environment, version or future run |
| Whether an action fell outside the approved capability contract | That every obfuscated, kernel-level or encrypted action can always be decoded |
| Whether a run-specific canary was contacted or included in an attempted outbound payload | That no canary contact proves the tool is benign |
| Whether the locked probe produced a useful result after enforcement | That output equivalence can always be decided by exact string equality |

## Words

Words we may use. Observed, for this run; newly observed during the tool-call window after baseline comparison; useful output preserved under enforcement for this locked probe; the canary attempt was caught at our gateway; evidence coverage is strace, gateway and DNS, with gaps listed; the model wrote the probe and proposed the contract, and code validated both; undeclared process execution was observed and compared with the contract.

Words we must not use. The tool is safe, or malicious; proven tool-attributed behaviour; works identically in every environment; no exfiltration is possible; complete visibility; the AI secured the tool; undeclared executables are prevented.

## Known gaps in this build

- Executed processes are observed, not prevented. Prevention needs seccomp or AppArmor.
- Denied paths that are neither planted fixture files nor directory trees fall back to a read-only bind of a mode 0000 file. If that mount fails, the run reports Policy could not be enforced rather than guessing.
- The tracer needs root or `CAP_SYS_PTRACE` on the host. Without it every screen says Insufficient evidence.
- `search_documentation` is offered as a second tool but the curated story is `summarize_repository`.
- Output comparison is field-level JSON equality. Markdown output falls back to text equality.
- Clock skew between strace and the harness transcript is assumed under 30 ms on the same kernel; events within that band are labelled attribution uncertain.
- gVisor is not used. The sandbox is Docker with the hardening set in the README.
