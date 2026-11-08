// Sandbox runner. Two profiles, one hardening set, destroyed on every exit path.
import Docker from "dockerode";
import { config } from "../config.ts";
import { PassThrough } from "node:stream";

export const docker = new Docker();

export interface SandboxProfile {
  name: "discovery" | "enforced" | "inspect";
  network: "gateway" | "none";
  memoryMb: number;
  nanoCpus: number;
  pidsLimit: number;
  wallClockSeconds: number;
  /** Extra read-only tmpfs shadows (container path -> tmpfs options) */
  shadows: Record<string, string>;
  /** Extra read-only binds host:container */
  extraBinds: string[];
}

export const DISCOVERY_PROFILE: SandboxProfile = { name: "discovery", network: "gateway", memoryMb: 256, nanoCpus: 1e9, pidsLimit: 64, wallClockSeconds: config.maxRunSeconds, shadows: {}, extraBinds: [] };

export interface SandboxResult {
  containerId: string;
  imageId: string;
  ip: string | null;
  startedAt: number;
  launchedAt: number;
  endedAt: number;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  changes: { path: string; kind: number }[];
  hostConfig: Record<string, unknown>;
  envManifest: string[];
  lifecycle: string[];
}

export const SANDBOX_ENV = ["PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/home/mcp"];

export function hostConfigFor(profile: SandboxProfile, inputDir: string): Docker.HostConfig & Record<string, unknown> {
  const tmpfs: Record<string, string> = { "/tmp": "rw,noexec,nosuid,nodev,size=64m", "/output": "rw,noexec,nosuid,nodev,size=64m", ...profile.shadows };
  return {
    Binds: [`${inputDir}:/run-input:ro`, ...profile.extraBinds],
    ReadonlyRootfs: true,
    Tmpfs: tmpfs,
    CapDrop: ["ALL"],
    SecurityOpt: ["no-new-privileges"],
    Memory: profile.memoryMb * 1024 * 1024,
    MemorySwap: profile.memoryMb * 1024 * 1024,
    NanoCpus: profile.nanoCpus,
    PidsLimit: profile.pidsLimit,
    NetworkMode: profile.network === "gateway" ? config.network : "none",
    Dns: profile.network === "gateway" ? [config.gatewayIp] : [],
    AutoRemove: false,
    Privileged: false,
  };
}

/** Human-readable docker run equivalent of a profile, for the UI panel. Presentation only; execution uses the API object above. */
export function dockerRunEquivalent(profile: SandboxProfile, inputDir = "<run-input>"): string[] {
  const flags = [
    `--user 10001:10001`, `--cap-drop ALL`, `--security-opt no-new-privileges`, `--read-only`,
    `--tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m`, `--tmpfs /output:rw,noexec,nosuid,nodev,size=64m`,
    ...Object.entries(profile.shadows).map(([p, o]) => `--tmpfs ${p}:${o}`),
    `--memory ${profile.memoryMb}m`, `--memory-swap ${profile.memoryMb}m`, `--cpus ${profile.nanoCpus / 1e9}`, `--pids-limit ${profile.pidsLimit}`,
    profile.network === "gateway" ? `--network ${config.network} --dns ${config.gatewayIp}` : `--network none`,
    `--env-file /dev/null`, ...SANDBOX_ENV.map((e) => `--env ${e}`),
    `--volume ${inputDir}:/run-input:ro`, ...profile.extraBinds.map((b) => `--volume ${b}`),
    `--stop-timeout 0`, `(host watchdog: kill after ${profile.wallClockSeconds} s)`,
  ];
  return flags;
}

export async function imageId(ref: string): Promise<string> {
  const info = await docker.getImage(ref).inspect();
  return info.Id;
}

function demux(stream: NodeJS.ReadableStream): { stdout: PassThrough; stderr: PassThrough } {
  const stdout = new PassThrough(), stderr = new PassThrough();
  docker.modem.demuxStream(stream, stdout, stderr);
  return { stdout, stderr };
}

/**
 * Run the frozen probe in a fresh container. onStarted(pid) is awaited before the launcher gets the go signal,
 * so a host-side tracer can attach first. The container is removed in finally.
 */
export async function runSandbox(profile: SandboxProfile, inputDir: string, onStarted?: (pid: number, containerId: string) => Promise<void>): Promise<SandboxResult> {
  const lifecycle: string[] = [];
  const stamp = (s: string) => lifecycle.push(`${new Date().toISOString()} ${s}`);
  const hostConfig = hostConfigFor(profile, inputDir);
  const container = await docker.createContainer({
    Image: config.sandboxImage,
    User: "10001:10001",
    Env: SANDBOX_ENV,
    OpenStdin: true, StdinOnce: false, AttachStdin: true, AttachStdout: true, AttachStderr: true, Tty: false,
    HostConfig: hostConfig,
    Labels: { "canary-cage": "sandbox", "canary-cage.profile": profile.name },
  });
  stamp(`container created ${container.id.slice(0, 12)} profile=${profile.name}`);
  let stdout = "", stderr = "", timedOut = false, exitCode: number | null = null, ip: string | null = null, startedAt = 0, launchedAt = 0, endedAt = 0;
  let changes: { path: string; kind: number }[] = [];
  let image = "";
  try {
    const attach = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true, hijack: true });
    const { stdout: so, stderr: se } = demux(attach);
    so.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    se.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    await container.start();
    startedAt = Date.now();
    stamp("container started");
    const info = await container.inspect();
    image = info.Image;
    ip = info.NetworkSettings?.Networks?.[config.network]?.IPAddress || null;
    if (onStarted) await onStarted(info.State.Pid, container.id);
    launchedAt = Date.now();
    attach.write("go\n");
    stamp("probe launched");
    const waited = await Promise.race([
      container.wait().then((r: { StatusCode: number }) => ({ kind: "exit" as const, code: r.StatusCode })),
      new Promise<{ kind: "timeout" }>((res) => setTimeout(() => res({ kind: "timeout" }), profile.wallClockSeconds * 1000)),
    ]);
    if (waited.kind === "timeout") {
      timedOut = true;
      stamp(`wall clock ${profile.wallClockSeconds} s exceeded, SIGKILL`);
      try { await container.kill({ signal: "SIGKILL" }); } catch {}
      try { const r = await container.wait(); exitCode = r.StatusCode; } catch {}
    } else exitCode = waited.code;
    endedAt = Date.now();
    stamp(`container exited code=${exitCode}${timedOut ? " (killed)" : ""}`);
    try { attach.end(); } catch {}
    try { changes = ((await container.changes()) ?? []).map((c: { Path: string; Kind: number }) => ({ path: c.Path, kind: c.Kind })); } catch {}
  } finally {
    try { await container.remove({ force: true, v: true }); stamp("container removed"); } catch (e) { stamp(`container remove failed: ${(e as Error).message}`); }
  }
  return { containerId: container.id, imageId: image, ip, startedAt, launchedAt, endedAt, exitCode, timedOut, stdout, stderr, changes, hostConfig: hostConfig as Record<string, unknown>, envManifest: SANDBOX_ENV, lifecycle };
}

export async function ensureNetwork(): Promise<void> {
  const nets = await docker.listNetworks({ filters: { name: [config.network] } });
  if (nets.some((n) => n.Name === config.network)) return;
  // Dynamic addresses come from the upper half so the gateway's fixed address can never be handed to a sandbox.
  await docker.createNetwork({ Name: config.network, Driver: "bridge", Internal: true, IPAM: { Config: [{ Subnet: config.networkSubnet, IPRange: config.networkDynamicRange }] }, Labels: { "canary-cage": "net" } });
}

export async function buildImages(log: (s: string) => void = () => {}): Promise<void> {
  const { ROOT } = await import("../config.ts");
  for (const [tag, dockerfile] of [[config.sandboxImage, "fixture/Dockerfile"], [config.gatewayImage, "gateway/Dockerfile"]] as const) {
    log(`building ${tag} from ${dockerfile}`);
    const stream = await docker.buildImage({ context: ROOT, src: ["fixture", "harness", "gateway"] }, { t: tag, dockerfile });
    await new Promise<void>((resolve, reject) => docker.modem.followProgress(stream, (err: Error | null) => (err ? reject(err) : resolve()), (ev: { stream?: string; error?: string }) => { if (ev.error) reject(new Error(ev.error)); if (ev.stream && ev.stream.trim()) log(ev.stream.trim()); }));
  }
}
