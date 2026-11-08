// Canary Cage front end. Plain JS, no build step. Talks to /api on the same host.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STAGE_ORDER = ["inspecting", "probing", "baseline", "discovering", "awaiting_approval", "compiling", "replaying"];
const STAGE_ALIAS = { attributing: "discovering", proposing: "awaiting_approval", comparing: "replaying", explaining: "replaying", bundling: "replaying", complete: "complete" };
let meta = null, run = null, es = null, cached = false;

async function api(path, opts) { const r = await fetch(path, { headers: { "content-type": "application/json" }, ...opts }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status, body: j }); return j; }

function setStages(status) {
  const s = STAGE_ALIAS[status] || status;
  const idx = s === "complete" ? STAGE_ORDER.length : STAGE_ORDER.indexOf(s);
  [...$("stages").children].forEach((li, i) => { li.classList.toggle("done", i < idx); li.classList.toggle("active", i === idx); });
}
function badges() {
  const b = [];
  if (cached) b.push('<span class="badge warn">cached, pre-recorded run</span>');
  if (run?.probe?.label === "FIXTURE") b.push('<span class="badge warn">FIXTURE probe and contract, no model call</span>');
  if (meta?.fake_llm && !cached) b.push('<span class="badge warn">no inference key on this host</span>');
  if (run?.runs?.B?.tracer && !run.runs.B.tracer.attached) b.push('<span class="badge warn">strace not attached, evidence limited</span>');
  if (run?.runs?.B?.tracer?.attached) b.push('<span class="badge ok">host-side strace attached</span>');
  if (run?.hashes?.replay_identity_verified) b.push('<span class="badge ok">replay identity verified</span>');
  $("badges").innerHTML = b.join("");
}

function renderHero() {
  if (!run?.hero?.length) { $("hero").hidden = true; return; }
  $("hero").hidden = false;
  const heroKey = JSON.stringify(run.hero);
  if ($("heroBody").dataset.key !== heroKey) {
    $("heroBody").dataset.key = heroKey;
    $("heroBody").innerHTML = run.hero.map((r) => {
      const bait = r.state === "denied" || /\.env read observed|SSH key read observed|Canary egress attempted/.test(r.discovery);
      const exceeded = /Contract exceeded/.test(r.discovery);
      const err = r.replay.match(/\b(E[A-Z]{3,})\b/);
      const replayText = err ? r.replay.replace(/,?\s*\(?\b(E[A-Z]{3,})\b\)?/, "").replace(/, attempt refused$/, ", attempt refused") : r.replay;
      const left = bait ? `<span class="rtag out">outside the job</span>${esc(r.discovery.replace("Canary egress attempted, caught at gateway with bait in body", "Tried to send both secrets out, caught at our gateway"))}` : esc(r.discovery);
      const right = bait && r.state === "denied" ? `<span class="rtag blk">blocked</span>${esc(replayText)}${err ? `<span class="errno">${esc(err[1])}</span>` : ""}` : esc(r.replay);
      return `<tr class="${esc(r.state)}${bait ? " bait" : ""}${exceeded ? " exceeded" : ""}"><td>${left}</td><td>${right}</td></tr>`;
    }).join("");
  }
  const fullStop = (t) => { const i = t.lastIndexOf("."); return i > 40 ? t.slice(0, i + 1) : t; };
  $("explanation").innerHTML = run.explanation ? `<b>Model's explanation.</b> ${esc(fullStop(run.explanation.text))} <span class="badge${run.explanation.label === "FIXTURE" ? " warn" : ""}">explanation ${esc(run.explanation.label)}</span>` : "";
  $("explanation").classList.remove("clamped");
}
function renderIdentity() {
  const h = run?.hashes; if (!h?.probe) { $("identity").hidden = true; return; }
  $("identity").hidden = false;
  const v = h.replay_identity_verified;
  $("identityLabel").textContent = v === true ? "Replay identity verified. Probe, call, server and fixture match discovery." : v === false ? "Replay identity NOT verified. Something differed between discovery and replay." : "Replay identity pending. Discovery hashes frozen.";
  $("identityLabel").className = "idlabel " + (v === true ? "ok" : v === false ? "bad" : "pending");
  $("hashes").innerHTML = [["Probe hash", h.probe], ["Call hash", h.call], ["Server image id", h.image], ["Fixture digest", h.fixture]].map(([k, val]) => `<tr><td>${k}</td><td><code>${esc(val || "pending")}</code></td></tr>`).join("");
  $("contractHash").textContent = h.contract ? `Contract hash, shown apart because it names the one deliberate change. ${h.contract}` : "Contract hash appears after approval.";
}
const inWindow = (r) => r.labels.some((l) => l.startsWith("newly") || l === "attribution uncertain");
function renderContract() {
  if (!run || !["awaiting_approval", "compiling", "replaying", "comparing", "explaining", "bundling", "complete", "failed"].includes(run.status) || !run.matrix) { $("contractCard").hidden = true; return; }
  $("contractCard").hidden = false;
  const rows = run.matrix.filter((r) => !r.platform && inWindow(r));
  const isOutside = (r) => !(r.kind === "file-read" && r.target.startsWith("/workspace/repository"));
  const gw = (run.runs?.B?.gateway_log || []).filter((e) => e.kind !== "ready");
  const gwRows = gw.map((e) => ({ kind: "gateway", target: e.kind === "dns" ? `DNS ${e.name}` : e.kind === "http" ? `${String(e.scheme).toUpperCase()} ${e.method} ${e.path} host ${e.host}, ${e.body_bytes} body bytes` : e.kind.startsWith("tls") ? `TLS ${e.sni || e.protocol || ""}` : e.kind, labels: ["caught at our gateway"], errnos: [], outside: true }));
  const all = [...rows.map((r) => ({ ...r, outside: isOutside(r) })), ...gwRows].sort((a, b) => Number(b.outside) - Number(a.outside));
  const rowHtml = (r) => `<tr class="${r.outside ? "outside" : ""}"><td>${esc(r.kind)}</td><td>${esc(r.target)}${r.errnos.length ? ` <span class="tag err">${esc(r.errnos.join(","))}</span>` : ""}</td><td><span class="jtag${r.outside ? " out" : ""}">${r.outside ? "outside the job" : "part of the job"}</span>${r.labels.map((l) => `<span class="tag${l.startsWith("newly") || l.startsWith("caught") ? " window" : ""}">${esc(l)}</span>`).join("")}</td></tr>`;
  $("matrixWindow").innerHTML = `<tr><th>kind</th><th>target</th><th>labels</th></tr>` + (all.length ? all.map(rowHtml).join("") : `<tr><td colspan="3" class="muted">no non-platform events in the window${run.runs?.B?.tracer?.attached ? "" : " (tracer not attached)"}</td></tr>`);
  const editable = run.status === "awaiting_approval";
  const current = run.contract.approved || run.contract.proposed;
  if (!$("contractText").dataset.filled || $("contractText").dataset.run !== run.id) { $("contractText").value = current ? JSON.stringify(current, null, 2) : JSON.stringify({ tool: run.tool, allowed_read_paths: ["/workspace/repository/**"], allowed_write_paths: ["/output/**"], denied_paths: [], network_egress: "none", observed_process_contract: ["node"], max_runtime_seconds: 20, max_memory_mb: 256 }, null, 2); $("contractText").dataset.filled = "1"; $("contractText").dataset.run = run.id; }
  $("contractText").readOnly = !editable;
  $("approve").hidden = !editable;
  $("approve").classList.toggle("nudge", editable && !cached);
  $("approveTop").hidden = !(editable && !cached);
  $("contractError").textContent = run.contract.proposal_errors?.length ? "Proposal rejected by the schema, " + run.contract.proposal_errors.join("; ") + ". Edit the default below." : run.contract.approved ? `Approved by ${run.contract.approved_by}, ${new Date(run.contract.approved_at).toUTCString()}` : "";
  $("contractError").classList.toggle("note", !!run.contract.approved && !run.contract.proposal_errors?.length);
}
function pre(obj) { return `<pre>${esc(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2))}</pre>`; }
function tabs(container, items, render) {
  const keys = Object.keys(items);
  if (!keys.length) { container.innerHTML = '<p class="muted">nothing yet</p>'; return; }
  const show = (k) => { container.innerHTML = `<div class="tabs">${keys.map((x) => `<button class="${x === k ? "on" : ""}" data-k="${x}">${esc(x)}</button>`).join("")}</div>` + render(items[k], k); container.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => show(b.dataset.k)); };
  show(keys[keys.length - 1]);
}
function renderStats() {
  const set = (id, v, cls) => { const el = $(id); el.textContent = v; el.className = (v === "pending" ? "pending " : "") + (cls || ""); };
  const src = run && (run.runs?.B || run.status === "complete") ? run : null;
  if (!src) { $("statsNote").textContent = ""; return; }
  const B = src.runs?.B, C = src.runs?.C;
  const first = src.runs?.inspect?.started_at ? new Date(src.runs.inspect.started_at).getTime() : null;
  const last = C?.ended_at ? new Date(C.ended_at).getTime() : B?.ended_at ? new Date(B.ended_at).getTime() : null;
  set("statSyscalls", B ? String(B.strace_events.length) : "pending", B && !B.tracer.attached ? "red" : "");
  set("statGateway", B ? String((B.gateway_log || []).filter((e) => e.kind !== "ready").length) : "pending", B && B.gateway_log?.length ? "red" : "");
  set("statCalls", String(src.inference_ledger?.length || 0));
  set("statSeconds", first && last ? String(Math.round((last - first) / 1000)) : "pending");
  set("statContainers", String(Object.values(src.runs || {}).filter(Boolean).length));
  const denied = (src.denied_errors || []).filter((d) => d.errno).length;
  set("statDenied", C ? String(denied) : "pending", C && denied ? "green" : "");
  $("statsNote").textContent = `${cached ? "Last recorded run" : "This run"} ${src.id.slice(0, 8)}, ${src.probe.label === "FIXTURE" ? "FIXTURE probe" : (src.inference_ledger?.[0]?.model || "live model")}, tracer ${B?.tracer?.attached ? "attached" : "not attached"}.`;
}
function renderPanels() {
  if (!run) { $("panels").hidden = true; $("panelsEmpty").hidden = false; return; }
  $("panels").hidden = false; $("panelsEmpty").hidden = true;
  $("probePanel").innerHTML = (run.probe.attempts || []).map((a) => `<p class="muted" data-shot="probeMeta${a.n}">Attempt ${a.n}, model ${esc(a.model)}, validator ${a.validation.ok ? `<span class="tag">accepted, hash ${esc(a.validation.hash.slice(0, 16))}…</span>` : a.validation.violations.map((v) => `<span class="tag err">${esc(v)}</span>`).join("")}${a.runtimeError ? ` runtime <span class="tag err">${esc(a.runtimeError.slice(0, 200))}</span>` : ""}</p>${pre(a.source)}`).join("") + (run.probe.baseline_source ? `<p class="muted">Run A baseline, derived deterministically by removing the tools/call:</p>${pre(run.probe.baseline_source)}` : "") || '<p class="muted">not written yet</p>';
  const runs = Object.fromEntries(Object.entries(run.runs || {}).filter(([, r]) => r));
  tabs($("mcpPanel"), runs, (r) => `<p class="muted">profile ${esc(r.profile)}, container ${esc(r.container_id.slice(0, 12))}, exit ${r.exit_code}${r.timed_out ? ", killed on wall clock" : ""}, window ${r.window.callSentAt ? `${r.window.callSentAt} to ${r.window.resultAt}` : "none"}</p>` + pre(r.mcp_transcript.map((m) => `${new Date(m.t).toISOString().slice(11, 23)} ${m.dir} ${JSON.stringify(m.msg)}`).join("\n")) + `<p class="muted">server stderr (untrusted, from inside the sandbox)</p>` + pre(r.server_stderr.join("")));
  tabs($("stracePanel"), runs, (r, k) => {
    const rows = r.strace_events || [];
    const id = `plat-${k}`;
    const table = (hide) => `<table class="matrix"><tr><th>time</th><th>pid</th><th>syscall</th><th>target</th><th>result</th><th>label</th></tr>${rows.filter((e) => !(hide && e.platform)).slice(0, 600).map((e) => `<tr><td>${new Date(e.t).toISOString().slice(11, 23)}</td><td>${e.pid}</td><td>${esc(e.syscall)}</td><td>${esc(e.target || e.args.slice(0, 80))}</td><td>${esc(e.errno ? e.errno : e.ret)}</td><td>${e.label ? `<span class="tag${e.label.startsWith("newly") ? " window" : ""}">${esc(e.label)}</span>` : ""}</td></tr>`).join("")}</table>`;
    setTimeout(() => { const cb = document.getElementById(id); const host = document.getElementById(id + "-t"); if (cb && host) cb.onchange = () => { host.innerHTML = table(cb.checked); }; }, 0);
    return `<p class="muted" data-shot="tracer-${k}">tracer ${r.tracer.attached ? "attached" : "not attached" + (r.tracer.reason ? ", " + esc(r.tracer.reason) : "")}, coverage ${esc(r.tracer.coverage)}, ${r.tracer.event_count} events. Gateway events: ${r.gateway_log.length}.</p><label class="filter"><input type="checkbox" id="${id}" checked> hide platform noise (node internals, /usr, /proc, /etc)</label><div id="${id}-t">${table(true)}</div>` + (r.gateway_log.length ? `<p class="muted">gateway log</p>${pre(r.gateway_log)}` : "");
  });
  $("profilePanel").innerHTML = run.compiled_profile ? `<p class="muted">Equivalent docker run flags for the enforced profile (execution uses the Docker API with the same values).</p>${pre(run.compiled_profile.docker_run.join("\n"))}<p class="muted">Denied paths and mechanism</p>${pre(run.compiled_profile.denials)}<p class="muted">Enforced versus observed</p>${pre(run.compiled_profile.enforced)}` : `<p class="muted">Discovery profile (Run A and B): non-root uid 10001, all capabilities dropped, no new privileges, read-only root, tmpfs /tmp and /output noexec, 256 MB, 1 CPU, 64 PIDs, 20 s wall clock, internal network whose only exit is the recording gateway, empty environment. The enforced profile appears after approval.</p>` + (run.runs?.B ? pre(run.runs.B.host_config) : "");
  $("ledgerPanel").innerHTML = run.inference_ledger?.length ? `<table><tr><th>#</th><th>purpose</th><th>model</th><th>latency</th><th>tokens in/out</th><th>status</th><th>label</th></tr>${run.inference_ledger.map((e) => `<tr><td>${e.id}</td><td>${esc(e.purpose)}</td><td class="mono">${esc(e.model)}</td><td>${e.latency_ms} ms</td><td>${e.prompt_tokens ?? "?"}/${e.completion_tokens ?? "?"}</td><td>${esc(e.status)}${e.error ? " " + esc(e.error) : ""}</td><td><span class="badge${e.label === "FIXTURE" ? " warn" : ""}">${esc(e.label)}</span></td></tr>`).join("")}</table><p class="muted">Endpoint ${esc(run.inference_ledger[0].endpoint)}. Structured responses are in the evidence bundle.</p>` : '<p class="muted">no model calls yet</p>';
  $("comparePanel").innerHTML = (run.comparison ? `<p class="muted">${esc(run.comparison.note)}; schema valid ${run.comparison.schemaValid}</p><table><tr><th>field</th><th>discovery</th><th>replay</th><th></th></tr>${run.comparison.fields.map((f) => `<tr><td>${esc(f.field)}</td><td class="mono">${esc(JSON.stringify(f.discovery))}</td><td class="mono">${esc(JSON.stringify(f.replay))}</td><td>${f.match ? '<span class="tag">equal</span>' : '<span class="tag window">divergence for human review</span>'}</td></tr>`).join("")}</table>` : '<p class="muted">after Run C</p>') + (run.denied_errors?.length ? `<p class="muted">Denied paths, with the error the operating system actually returned</p>${pre(run.denied_errors)}` : "") + `<p class="muted">Discovery labels ${(run.discovery_labels || []).map((l) => `<span class="tag">${esc(l)}</span>`).join("") || "none"}<br>Replay labels ${(run.replay_labels || []).map((l) => `<span class="tag">${esc(l)}</span>`).join("") || "none"}</p>`;
  $("bundlePanel").innerHTML = run.bundle_path && !cached ? `<p><a href="/api/runs/${run.id}/bundle.zip">Download evidence bundle (zip)</a>. Probe, transcripts, labelled strace events, gateway log, compiled profile, contract, hashes, inference ledger.</p>` : '<p class="muted">available after Run C' + (cached ? " (not for the cached run)" : "") + "</p>";
  const lc = run.runs?.C?.lifecycle || run.runs?.B?.lifecycle;
  if (lc) $("lifecycleLine").textContent = "Containers. " + lc.map((l) => l.slice(24)).join("; ");
}
function renderTimeline() {
  const lanes = ["B", "C"].map((k) => ({ k, r: run?.runs?.[k] })).filter((l) => l.r && l.r.strace_events?.length);
  if (!lanes.length) { $("timeline").hidden = true; return; }
  $("timeline").hidden = false;
  const W = 1200, left = 150, right = 20, laneH = 72, top = 26;
  const H = top + lanes.length * laneH + 34;
  const spans = lanes.map(({ r }) => { const t0 = Math.min(...r.strace_events.map((e) => e.t)); const t1 = Math.max(...r.strace_events.map((e) => e.t), r.window.resultAt || 0); return { t0, t1 }; });
  const maxSpan = Math.max(...spans.map((s) => s.t1 - s.t0), 1);
  const x = (ms) => left + (ms / maxSpan) * (W - left - right);
  const rows = [];
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Syscall timeline per run">`;
  const step = maxSpan > 4000 ? 1000 : maxSpan > 1500 ? 500 : maxSpan > 600 ? 200 : 100;
  for (let ms = 0; ms <= maxSpan; ms += step) svg += `<line class="axis" x1="${x(ms)}" y1="${top - 6}" x2="${x(ms)}" y2="${H - 30}"/><text x="${x(ms)}" y="${H - 12}" text-anchor="middle">${ms} ms</text>`;
  lanes.forEach(({ k, r }, i) => {
    const { t0 } = spans[i]; const y = top + i * laneH; const base = y + 50;
    const name = k === "B" ? "Run B, discovery" : "Run C, enforced replay";
    svg += `<text class="lane-label" x="0" y="${y + 30}">${name}</text><text x="0" y="${y + 46}">${r.strace_events.length} events</text>`;
    if (r.window.callSentAt) { const a = x(r.window.callSentAt - t0), b = x((r.window.resultAt || r.window.callSentAt + 1) - t0); svg += `<rect class="band" x="${a}" y="${y + 4}" width="${Math.max(b - a, 2)}" height="${laneH - 10}"/><text class="band-label" x="${a + 4}" y="${y + 14}">tool-call window, ${Math.round(b >= a ? ((r.window.resultAt || 0) - r.window.callSentAt) : 0)} ms</text>`; }
    svg += `<line class="axis" x1="${left}" y1="${base}" x2="${W - right}" y2="${base}"/>`;
    for (const e of r.strace_events) {
      if (e.kind === "clone" || e.kind === "other") continue;
      const plat = e.platform, hollow = !!e.errno && !plat && e.errno !== "EINPROGRESS";
      const h = plat ? 10 : 26; const xx = x(e.t - t0);
      svg += `<rect class="ev${plat ? " plat" : ""}${hollow ? " hollow" : ""}" x="${(xx - 1.5).toFixed(1)}" y="${base - h}" width="3" height="${h}" rx="1"><title>${esc(e.syscall)} ${esc(e.target || "")}${e.errno ? " " + esc(e.errno) : ""} at +${e.t - t0} ms, ${esc(e.label || "")}</title></rect>`;
      if (!plat) rows.push(`<tr><td>${esc(name)}</td><td>+${e.t - t0}</td><td>${esc(e.syscall)}</td><td>${esc(e.target || "")}</td><td>${esc(e.errno || "")}</td><td>${esc(e.label || "")}</td></tr>`);
    }
  });
  svg += "</svg>";
  $("timelineSvg").innerHTML = svg;
  $("timelineTable").innerHTML = `<table><tr><th>run</th><th>ms</th><th>syscall</th><th>target</th><th>result</th><th>label</th></tr>${rows.join("")}</table>`;
}
function renderVultr() {
  if (meta) {
    $("vmRegion").textContent = meta.vm ? `Region ${meta.vm.region}, Amsterdam` : "metadata not reachable from this host";
    $("vmInstance").textContent = meta.vm?.instance_id || "n/a";
    $("vmHost").textContent = meta.vm?.hostname || "n/a";
    $("infModel").textContent = meta.model;
    $("infEndpoint").textContent = meta.inference_endpoint;

  }
  if (run?.inference_ledger?.length) { const l = run.inference_ledger; const ms = l.reduce((a, e) => a + (e.latency_ms || 0), 0); $("infCalls").textContent = `${l.length} (${l.map((e) => e.purpose).join(", ")}), ${(ms / 1000).toFixed(1)} s of model time, label ${l[0].label}`; }
}
function render() { if (!run) return; renderVultr(); setStages(run.status); badges(); renderIdentity(); renderHero(); renderContract(); renderPanels(); renderStats(); renderTimeline(); }

async function refresh() { if (!run || cached) return; run = await api(`/api/runs/${run.id}`); render(); }
function subscribe(id) {
  if (es) es.close();
  es = new EventSource(`/api/runs/${id}/events`);
  es.onmessage = async (m) => {
    const ev = JSON.parse(m.data);
    if (ev.type === "queue") $("status").textContent = ev.position > 0 ? `Queued, position ${ev.position}. One sandbox run at a time.` : "Your run is active.";
    if (ev.type === "stage") { $("status").textContent = ev.status === "awaiting_approval" ? "Step 5 of 7. The model proposed a contract. Your turn: review it and approve to run the enforced replay." : `${ev.status}, ${ev.detail}`; await refresh(); if (ev.status === "complete" || ev.status === "failed") { es.close(); $("run").disabled = false; } }
    if (ev.type === "probe_attempt") $("status").textContent = `probe attempt ${ev.n}, ${ev.ok ? "accepted by the validator" : "rejected, " + ev.violations.join("; ")}`;
    if (ev.type === "tracer") $("status").textContent = `Run ${ev.run}, tracer ${ev.attached ? "attached" : "not attached"}`;
    if (ev.type === "snapshot") { await refresh(); }
  };
}
$("run").onclick = async () => {
  $("run").disabled = true; cached = false; $("contractText").dataset.filled = "";
  try {
    const r = await api("/api/runs", { method: "POST", body: JSON.stringify({ tool: $("tool").value, scenario: $("scenario").value }) });
    run = await api(`/api/runs/${r.id}`); render();
    $("status").textContent = r.position > 0 ? `Queued, position ${r.position}.` : "Starting.";
    history.replaceState(null, "", `?run=${r.id}`);
    subscribe(r.id);
  } catch (e) { $("status").textContent = `Could not start, ${e.message}.` + (e.body?.cached_available ? " A pre-recorded run is available below, labelled cached." : ""); $("run").disabled = false; if (e.body?.cached_available) $("showCached").hidden = false; }
};
$("approveTop").onclick = () => { const card = $("contractCard"); card.scrollIntoView({ behavior: "smooth", block: "start" }); card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); setTimeout(() => $("approve").focus({ preventScroll: true }), 900); };
$("approve").onclick = async () => {
  let contract; try { contract = JSON.parse($("contractText").value); } catch (e) { $("contractError").textContent = "Not valid JSON, " + e.message; return; }
  $("approve").disabled = true;
  try { await api(`/api/runs/${run.id}/approve`, { method: "POST", body: JSON.stringify({ contract, approved_by: "reviewer in browser" }) }); $("status").textContent = "Approved. Compiling the profile and replaying the identical probe."; $("approveTop").hidden = true; $("approve").classList.remove("nudge"); window.scrollTo({ top: 0, behavior: "smooth" }); subscribe(run.id); }
  catch (e) { $("contractError").textContent = e.message; }
  $("approve").disabled = false;
};
$("showCached").onclick = async () => { run = await api("/api/cached"); cached = true; $("status").textContent = "Showing the last recorded run from cache. Labelled cached everywhere."; render(); };
$("tool").onchange = () => { $("task").textContent = $("tool").value === "search_documentation" ? "Task. Search the documentation of /workspace/repository for a phrase with the chosen tool and check the result has content." : "Task. Summarise the repository at /workspace/repository as JSON with the chosen tool and check the result has content. Curated scenario, nothing arbitrary from the public."; };

(async () => {
  try { meta = await api("/api/meta"); } catch { meta = null; }
  if (meta) {
    $("vmLine").textContent = meta.vm ? `Served from a Vultr Cloud Compute VM, region ${meta.vm.region}, instance ${meta.vm.instance_id}, read from the Vultr metadata service. Inference endpoint ${meta.inference_endpoint}, model ${meta.model}. Budget left today ${meta.budget_remaining} of ${meta.daily_budget} calls.` : `Vultr metadata not reachable from this host (development machine). Inference endpoint ${meta.inference_endpoint}, model ${meta.model}.`;
    if (meta.cached_available) $("showCached").hidden = false;
    if (!meta.docker) $("status").textContent = "Sandbox host unhealthy. A cached run is available if one was recorded.";
  }
  badges(); renderStats(); renderVultr();
  const id = new URLSearchParams(location.search).get("run");
  if (!id && meta?.cached_available) { try { run = await api("/api/cached"); cached = true; render(); $("status").textContent = "Idle. Showing the last recorded run, labelled cached. Press Run the loop for a live one."; } catch {} }
  if (id) { try { run = await api(`/api/runs/${id}`); render(); if (!["complete", "failed"].includes(run.status)) { $("run").disabled = true; subscribe(id); } } catch {} }
})();
