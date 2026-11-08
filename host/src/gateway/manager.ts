// Starts and reads the recording gateway container on the internal network.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.ts";
import { docker, ensureNetwork } from "../sandbox/docker.ts";

export interface GatewayEvent { t: number; kind: string; [k: string]: unknown }
const NAME = "canary-gateway";

function ensureCerts(): string {
  const dir = resolve(config.localDir, "gateway-certs");
  mkdirSync(dir, { recursive: true });
  const key = resolve(dir, "sink.key"), crt = resolve(dir, "sink.crt");
  if (!existsSync(key) || !existsSync(crt)) {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "30", "-subj", "/CN=canary.canary-lab.io", "-addext", `subjectAltName=DNS:*.${config.canarySuffix},DNS:${config.canarySuffix}`], { stdio: "ignore" });
  }
  // The sink certificate is a dummy for a network that forwards nothing. The gateway runs with all capabilities dropped, so it must be world-readable.
  chmodSync(key, 0o644); chmodSync(crt, 0o644); chmodSync(dir, 0o755);
  return dir;
}

export async function ensureGateway(): Promise<{ id: string; ip: string }> {
  await ensureNetwork();
  const certs = ensureCerts();
  const existing = await docker.listContainers({ all: true, filters: { name: [NAME] } });
  let c = existing.length ? docker.getContainer(existing[0].Id) : null;
  if (c) {
    const info = await c.inspect();
    if (info.State.Running && info.Config.Image === config.gatewayImage) return { id: c.id, ip: config.gatewayIp };
    await c.remove({ force: true });
  }
  c = await docker.createContainer({
    name: NAME, Image: config.gatewayImage, Cmd: [config.gatewayIp],
    HostConfig: { Binds: [`${certs}:/certs:ro`], ReadonlyRootfs: true, CapDrop: ["ALL"], CapAdd: ["NET_BIND_SERVICE"], SecurityOpt: ["no-new-privileges"], Memory: 128 * 1024 * 1024, PidsLimit: 32, RestartPolicy: { Name: "unless-stopped" }, NetworkMode: config.network },
    NetworkingConfig: { EndpointsConfig: { [config.network]: { IPAMConfig: { IPv4Address: config.gatewayIp } } } },
    Labels: { "canary-cage": "gateway" },
  });
  await c.start();
  return { id: c.id, ip: config.gatewayIp };
}

function demuxLogs(buf: Buffer): string {
  // docker logs without TTY: 8-byte frame headers
  let out = "", off = 0;
  while (off + 8 <= buf.length) {
    const size = buf.readUInt32BE(off + 4);
    out += buf.subarray(off + 8, off + 8 + size).toString("utf8");
    off += 8 + size;
  }
  return out;
}

export async function gatewayEvents(sinceMs: number, untilMs: number, fromIp?: string | null): Promise<GatewayEvent[]> {
  const list = await docker.listContainers({ filters: { name: [NAME] } });
  if (!list.length) return [];
  const c = docker.getContainer(list[0].Id);
  const raw = (await c.logs({ stdout: true, stderr: false, since: Math.floor(sinceMs / 1000) - 1 })) as unknown as Buffer;
  const text = Buffer.isBuffer(raw) ? demuxLogs(raw) : String(raw);
  const events: GatewayEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try { const ev = JSON.parse(line) as GatewayEvent; if (ev.t >= sinceMs - 500 && ev.t <= untilMs + 500 && ev.kind !== "ready" && (!fromIp || !ev.from || ev.from === fromIp)) events.push(ev); } catch {}
  }
  return events;
}
