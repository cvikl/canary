// Drives one real run on the live Canary Cage URL and captures the states the film needs.
// node shot-run.mjs  -> remotion/public/{home,running,awaiting,complete,panels}.png + rects-*.json
import puppeteer from '/home/timotej/Avtonet-WebApp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import fs from 'fs'; import { fileURLToPath } from 'url';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const OUT = fileURLToPath(new URL('./remotion/public/', import.meta.url));
const base = process.env.BASE || 'http://95.179.177.22';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
const shot = async (name) => {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const fullH = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewport({ width: 1920, height: Math.min(fullH, 8000), deviceScaleFactor: 1 });
  await sleep(700);
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
  const rects = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll('[data-shot]')) {
      if (el.hidden || el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      out[el.getAttribute('data-shot')] = [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)];
    }
    out.__page = [document.documentElement.scrollWidth, document.documentElement.scrollHeight];
    return out;
  });
  fs.writeFileSync(OUT + 'rects-' + name + '.json', JSON.stringify(rects, null, 1));
  console.log('shot', name, rects.__page, Object.keys(rects).length - 1, 'rects');
};
const waitStatus = async (re, timeoutMs) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = await page.evaluate(() => document.getElementById('status').textContent);
    if (re.test(s)) return s;
    await sleep(1000);
  }
  throw new Error('timeout waiting for ' + re);
};
await page.goto(base + '/', { waitUntil: 'networkidle0', timeout: 60000 });
await sleep(1500);
await shot('home');
await page.click('#run');
await sleep(2500);
await shot('running');
console.log(await waitStatus(/awaiting_approval/, 150000));
await sleep(1500);
await page.evaluate(() => { document.getElementById('probeDetails').open = true; document.getElementById('straceDetails').open = true; });
await sleep(800);
await shot('awaiting');
const runId = new URL(page.url()).searchParams.get('run');
await page.evaluate(() => { document.getElementById('probeDetails').open = false; document.getElementById('straceDetails').open = false; });
await page.click('#approve');
console.log(await waitStatus(/complete|failed/, 150000));
await sleep(2500);
await shot('complete');
await page.evaluate(() => { for (const id of ['straceDetails', 'ledgerDetails', 'compareDetails', 'bundleDetails']) document.getElementById(id).open = true; });
await sleep(600);
await page.evaluate(() => { const tabs = document.querySelectorAll('#stracePanel .tabs button'); const c = [...tabs].find((b) => b.dataset.k === 'C'); if (c) c.click(); });
await sleep(800);
await shot('panels');
fs.writeFileSync(OUT + 'run-id.txt', runId + '\n');
console.log('run', runId);
await browser.close();
