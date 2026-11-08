// Recording gateway. Logs one JSON line per event to stdout; the host reads them with docker logs.
// Events: dns (every query, answered only for the canary suffix), tls (connection, SNI), http (method, path, headers, body excerpt).
// Nothing is forwarded anywhere. Caps: 64 requests, 64 KiB body per run.
import dgram from "node:dgram";
import tls from "node:tls";
import http from "node:http";
import { readFileSync } from "node:fs";

const SUFFIX = ".canary.canary-lab.io";
const SELF_IP = process.argv[2] ?? "10.77.0.2";
const MAX_REQUESTS = 64, MAX_BODY = 65536;
let requests = 0;
const emit = (ev) => process.stdout.write(JSON.stringify({ t: Date.now(), ...ev }) + "\n");

// DNS, UDP 53
const dns = dgram.createSocket("udp4");
dns.on("message", (msg, rinfo) => {
  try {
    const id = msg.subarray(0, 2);
    let off = 12; const labels = [];
    while (off < msg.length) { const len = msg[off]; if (len === 0) { off++; break; } labels.push(msg.subarray(off + 1, off + 1 + len).toString("ascii")); off += len + 1; }
    const qtype = msg.readUInt16BE(off); off += 4;
    const name = labels.join(".");
    const canary = name.endsWith(SUFFIX.slice(1)) || name.endsWith(SUFFIX);
    emit({ kind: "dns", from: rinfo.address, name, qtype, answered: canary && qtype === 1 });
    const header = Buffer.alloc(12);
    id.copy(header, 0);
    header.writeUInt16BE(canary ? 0x8180 : 0x8183, 2); // response, RA; NXDOMAIN if not canary
    header.writeUInt16BE(1, 4); header.writeUInt16BE(canary && qtype === 1 ? 1 : 0, 6);
    const question = msg.subarray(12, off);
    const parts = [header, question];
    if (canary && qtype === 1) {
      const ans = Buffer.alloc(16);
      ans.writeUInt16BE(0xc00c, 0); ans.writeUInt16BE(1, 2); ans.writeUInt16BE(1, 4); ans.writeUInt32BE(5, 6); ans.writeUInt16BE(4, 10);
      SELF_IP.split(".").forEach((o, i) => ans.writeUInt8(Number(o), 12 + i));
      parts.push(ans);
    }
    dns.send(Buffer.concat(parts), rinfo.port, rinfo.address);
  } catch (e) { emit({ kind: "dns-error", error: String(e) }); }
});
dns.bind(53, "0.0.0.0", () => emit({ kind: "ready", service: "dns", ip: SELF_IP }));

function onRequest(scheme) {
  return (req, res) => {
    requests++;
    const chunks = []; let size = 0;
    req.on("data", (c) => { if (size < MAX_BODY) { chunks.push(c); size += c.length; } });
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8").slice(0, MAX_BODY);
      emit({ kind: "http", scheme, from: req.socket.remoteAddress, host: req.headers.host, method: req.method, path: req.url, headers: req.headers, body_bytes: size, body, capped: requests > MAX_REQUESTS });
      res.statusCode = requests > MAX_REQUESTS ? 429 : 204;
      res.end();
    });
  };
}

const key = readFileSync("/certs/sink.key"), cert = readFileSync("/certs/sink.crt");
const httpsServer = tls.createServer({ key, cert, SNICallback: (name, cb) => { emit({ kind: "tls", sni: name }); cb(null, tls.createSecureContext({ key, cert })); } });
const inner = http.createServer(onRequest("https"));
httpsServer.on("secureConnection", (sock) => { emit({ kind: "tls-connection", from: sock.remoteAddress, protocol: sock.getProtocol() }); inner.emit("connection", sock); });
httpsServer.on("tlsClientError", (e, sock) => emit({ kind: "tls-error", from: sock?.remoteAddress, error: e.code ?? String(e) }));
httpsServer.listen(443, "0.0.0.0", () => emit({ kind: "ready", service: "https" }));
http.createServer(onRequest("http")).listen(80, "0.0.0.0", () => emit({ kind: "ready", service: "http" }));
