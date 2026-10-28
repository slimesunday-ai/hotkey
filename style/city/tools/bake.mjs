// Streaming pass · THE BAKE: every block's tiers built ahead of time, so the page reads memory → baked file → IndexedDB → a worker build.
//   node style/city/tools/bake.mjs [--workers 24] [--tods d,n] [--port <n>] [--verify <day-hash-label>[,<night-hash-label>]]
// One command rebuilds it (a minute or two): the output, style/city/baked/, is generated and git-ignored. Rebake after any change to the
// build code (jobs.js and everything it imports, the kits, heroes and block files): the page only reads a bake whose hash is its own.
// How:
//   · the builds run in the page itself: this tool serves the city (like style/serve.mjs, on a port of its own) and opens
//     ?bake=1&workers=N in headless Chrome, whose worker pool builds every block of the universe, day and night, exactly as the live
//     stream does (same code, same fonts). A node build would differ: the display-face signage rasters system fonts on an OffscreenCanvas
//     and node has no canvas (signage/art.js: px5 stands in). The page posts each record raw (cache.js packRaw) to this server.
//   · here, in node worker_threads, each finished region file is encoded: every tier mesh through the meshopt vertex codec (lossless,
//     cache.js encodeRecord; the page decodes it in its baked-data workers, ~1 ms a block), decoded back and compared with what the page
//     built, field by field (the characters' animation data included: a mismatch stops the bake), then gzipped:
//       baked/<hash>/<d|n>/<ri>_<rj>.<far|mid|full|cf>.bin.gz   (a region is 4 × 4 blocks) + baked/<hash>/index.json
//     The hash is the page's own source hash (pool.js bundleOf), so a bake of older code is never read. Older bakes are removed.
//   · --verify compares every baked tier with a hash report of the live build (tools/audit.mjs hash <label> --q=district=all [--night]):
//     it decodes the files here and hashes them like regress.js. --verify-only <labels> checks the existing bake without rebuilding.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unpackRaw, encodeRecord, decodeRecord, payload, packContainer, unpackBaked, BAKED, isTier } from '../cache.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..'), ROOT = path.resolve(CITY, '../..'), OUT = path.join(CITY, 'baked'), TOOLS = path.join(OUT, '.tools');
// SPREAD: SPREAD=<m> bakes (and verifies) the city at ?spread=<m>; without it, the default spread (world/city.js SPREAD_DEFAULT, read as text: no three here)
const SPREAD_NOW = process.env.SPREAD ? +process.env.SPREAD : +(/SPREAD_DEFAULT = (\d+)/.exec(fss.readFileSync(path.join(ROOT, 'world/city.js'), 'utf8'))?.[1] ?? 0);
const MO_VER = '1.1.0', ENC_URL = `https://cdn.jsdelivr.net/npm/meshoptimizer@${MO_VER}/meshopt_encoder.js`, DEC_URL = `https://cdn.jsdelivr.net/npm/meshoptimizer@${MO_VER}/meshopt_decoder.mjs`;   // (three r185's decoder is meshoptimizer 1.1)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));
async function tool(url) { const f = path.join(TOOLS, `${path.basename(url).replace(/\.m?js$/, '')}-${MO_VER}.mjs`); if (!fss.existsSync(f)) { await fs.mkdir(TOOLS, { recursive: true }); const r = await fetch(url); if (!r.ok) throw new Error(`download ${url}: ${r.status}`); await fs.writeFile(f, await r.text()); } return pathToFileURL(f).href; }

// ── meshopt: P as 8-byte vertices (x y z 0), N + C as 8 bytes (nx ny nz r g b a 0) — worker.js `mesh()` undoes exactly this
export function meshEncoder(E) {
  return (t, pay) => { const n = t.n, P8 = new Int16Array(n * 4), NC = new Uint8Array(n * 8);
    for (let v = 0; v < n; v++) { P8[v * 4] = t.P[v * 3]; P8[v * 4 + 1] = t.P[v * 3 + 1]; P8[v * 4 + 2] = t.P[v * 3 + 2]; const a = v * 8; NC[a] = t.N[v * 3] & 255; NC[a + 1] = t.N[v * 3 + 1] & 255; NC[a + 2] = t.N[v * 3 + 2] & 255; NC[a + 3] = t.C[v * 4]; NC[a + 4] = t.C[v * 4 + 1]; NC[a + 5] = t.C[v * 4 + 2]; NC[a + 6] = t.C[v * 4 + 3]; }
    const [pOff, pLen] = pay.add(E.encodeVertexBuffer(new Uint8Array(P8.buffer), n, 8)), [cOff, cLen] = pay.add(E.encodeVertexBuffer(NC, n, 8)), [fOff, fLen] = pay.add(t.F), [kOff, kLen] = t.K ? pay.add(t.K) : [-1, 0];
    const u8 = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength), anim = (a, sz) => a && a.byteLength === n * sz ? pay.add(E.encodeVertexBuffer(u8(a), n, sz)) : [-1, 0];   // (the characters' idle data, charbake.js: X Int16 × 4, Y Uint8 × 4)
    if ((t.X && t.X.byteLength !== n * 8) || (t.Y && t.Y.byteLength !== n * 4)) throw new Error('a tier mesh with X/Y of an unexpected size');
    const [xOff, xLen] = anim(t.X, 8), [yOff, yLen] = anim(t.Y, 4);
    return [n, t.o[0], t.o[1], t.o[2], pOff, pLen, cOff, cLen, fOff, fLen, kOff, kLen, xOff, xLen, yOff, yLen]; };
}
export function meshDecoder(D, buf) {
  return d => { const [n, o0, o1, o2, pOff, pLen, cOff, cLen, fOff, fLen, kOff, kLen, xOff = -1, xLen = 0, yOff = -1, yLen = 0] = d, s = new Uint8Array(n * 8), P = new Int16Array(n * 3), N = new Int8Array(n * 3), C = new Uint8Array(n * 4);
    D.decodeVertexBuffer(s, n, 8, new Uint8Array(buf, pOff, pLen)); const s16 = new Int16Array(s.buffer); for (let v = 0; v < n; v++) { P[v * 3] = s16[v * 4]; P[v * 3 + 1] = s16[v * 4 + 1]; P[v * 3 + 2] = s16[v * 4 + 2]; }
    D.decodeVertexBuffer(s, n, 8, new Uint8Array(buf, cOff, cLen)); const s8 = new Int8Array(s.buffer); for (let v = 0; v < n; v++) { const a = v * 8; N[v * 3] = s8[a]; N[v * 3 + 1] = s8[a + 1]; N[v * 3 + 2] = s8[a + 2]; C[v * 4] = s[a + 3]; C[v * 4 + 1] = s[a + 4]; C[v * 4 + 2] = s[a + 5]; C[v * 4 + 3] = s[a + 6]; }
    const t = { n, o: [o0, o1, o2], P, N, C, F: new Uint8Array(buf.slice(fOff, fOff + fLen)), K: kOff >= 0 ? new Uint8Array(buf.slice(kOff, kOff + kLen)) : null };
    if (xOff >= 0) { t.X = new Int16Array(n * 4); D.decodeVertexBuffer(new Uint8Array(t.X.buffer), n, 8, new Uint8Array(buf, xOff, xLen)); }
    if (yOff >= 0) { t.Y = new Uint8Array(n * 4); D.decodeVertexBuffer(t.Y, n, 4, new Uint8Array(buf, yOff, yLen)); }
    return t; };
}
const rawBytes = v => !v || typeof v !== 'object' ? 0 : ArrayBuffer.isView(v) ? v.byteLength : Object.values(v).reduce((s, x) => s + rawBytes(x), 0);

// the round-trip check: a decoded record must equal what the page built, array for array (else the bake stops)
function same(a, b, at = '') {
  if (a === b) return null; if (a === undefined || a === null || typeof a !== 'object') return a === b ? null : `${at}: ${a} ≠ ${b}`;
  if (ArrayBuffer.isView(a)) { if (!ArrayBuffer.isView(b) || a.constructor !== b.constructor || a.length !== b.length) return `${at}: array type or length`; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(a[i] !== a[i] && b[i] !== b[i])) return `${at}[${i}]`; return null; }
  if (Array.isArray(a)) { if (!Array.isArray(b) || a.length !== b.length) return `${at}: length`; for (let i = 0; i < a.length; i++) { const w = same(a[i], b[i], `${at}/${i}`); if (w) return w; } return null; }
  for (const k of Object.keys(a)) { if (a[k] === undefined || typeof a[k] === 'function') continue; const w = same(a[k], b?.[k], `${at}.${k}`); if (w) return w; } return null; }
// ── worker thread: encode one region file, decode it back and compare (lossless, every mesh and every field), gzip, write
if (!isMainThread) {
  const E = (await import(workerData.enc)).MeshoptEncoder, D = (await import(workerData.dec)).MeshoptDecoder; await E.ready; await D.ready; const enc = meshEncoder(E);
  parentPort.on('message', async ({ id, file, header, recs }) => { try {
    const pay = payload(), out = {}, per = {}; for (const [k, rec] of Object.entries(recs)) { const before = pay.length; out[k] = encodeRecord(rec, pay, enc); per[k] = pay.length - before; }
    const buf = Buffer.from(packContainer(BAKED, { ...header, recs: out }, pay)), chk = unpackBaked(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    for (const [k, e] of Object.entries(chk.header.recs)) { const why = same(recs[k], decodeRecord(e, chk.payload, meshDecoder(D, chk.payload)), k); if (why) throw new Error(`round trip ${path.basename(file)} ${why}`); }
    const gz = zlib.gzipSync(buf, { level: 6 }); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, gz);
    parentPort.postMessage({ id, packed: buf.length, gz: gz.length, per }); } catch (e) { parentPort.postMessage({ id, error: String(e.stack || e) }); } });
} else await main();

async function main() {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
  const NW = +opt('workers', Math.max(4, Math.min(24, os.cpus().length - 6))), TODS = opt('tods', 'd,n'), T0 = Date.now(), el = () => ((Date.now() - T0) / 1000).toFixed(1) + ' s';
  if (opt('verify-only')) { const d = (await fs.readdir(OUT)).filter(x => !x.startsWith('.') && !x.endsWith('.tmp')); if (d.length !== 1) { console.error('verify-only: expected one bake in ' + OUT); process.exit(1); }
    const index = JSON.parse(await fs.readFile(path.join(OUT, d[0], 'index.json'), 'utf8')); await verify(path.join(OUT, d[0]), opt('verify-only').split(','), index.tods); return; }
  const enc = await tool(ENC_URL), dec = await tool(DEC_URL);
  // encode threads
  const threads = Array.from({ length: Math.max(2, Math.min(8, os.cpus().length >> 2)) }, () => new Worker(fileURLToPath(import.meta.url), { workerData: { enc, dec } })); let tq = 0; const tw = new Map(); let tseq = 0;
  threads.forEach(w => w.on('message', m => { const p = tw.get(m.id); tw.delete(m.id); m.error ? p.rej(new Error(m.error)) : p.res(m); }));
  const encode = (job, transfer) => new Promise((res, rej) => { const id = ++tseq; tw.set(id, { res, rej }); threads[tq++ % threads.length].postMessage({ id, ...job }, transfer); });
  // state
  let plan = null, tmp = null, doneMsg = null; const skippedAll = [], modulesAll = []; const files = new Map(), writing = [], stats = { groups: {}, tiers: {}, files: 0, raw: 0, packed: 0, gz: 0, skipped: [] };
  const G = g => stats.groups[g] ??= { blocks: 0, raw: {}, packed: {}, gz: {}, buildMs: 0, farMs: 0, tris: 0, trisMid: 0 };
  const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  function onRec(buf) {
    const { meta, rec } = unpackRaw(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), fk = `${meta.tod}|${meta.rk}|${meta.tier}`, F = files.get(fk);
    if (!F) throw new Error('record for a file not in the plan: ' + fk); F.got++;
    if (meta.skip) stats.skipped.push(`${meta.tod} ${meta.key} ${meta.tier}`);
    else { F.recs[meta.key] = rec; F.groups[meta.key] = meta.group; const g = G(meta.group); add(g.raw, meta.tier, rawBytes(rec));
      if (meta.tier === 'mid') { g.blocks += meta.tod === 'd' ? 1 : 0; if (Array.isArray(meta.ms)) g.buildMs += meta.ms[0] + meta.ms[1]; }
      if (meta.tier === 'far' && typeof meta.ms === 'number') g.farMs += meta.ms;
      if (meta.tier === 'full' && meta.tod === 'd') g.tris += rec.tris || 0; if (meta.tier === 'mid' && meta.tod === 'd') g.trisMid += rec.trisMid || 0; }
    // hardening pass · DETERMINISTIC FILES: the records arrive in whatever order the page's workers finish, and a region file's header listed
    // them in that order, so two bakes of the same code differed byte for byte (133 of 168 night files, contents identical). They go in
    // in the plan's own order (F.keys: the universe's order), whatever the workers did.
    if (F.got === F.keys.length) { const recs = {}, transfer = []; for (const k of F.keys) if (k in F.recs) recs[k] = F.recs[k]; const walk = v => { if (!v || typeof v !== 'object') return; if (ArrayBuffer.isView(v)) { if (!transfer.includes(v.buffer)) transfer.push(v.buffer); return; } Object.values(v).forEach(walk); }; walk(recs);
      F.recs = null; const [tod, rk, tier] = fk.split('|');
      writing.push(encode({ file: path.join(tmp, tod, `${rk}.${tier}.bin.gz`), header: { v: 1, tier, tod, region: rk, hash: plan.hash }, recs }, transfer).then(m => {
        stats.files++; stats.packed += m.packed; stats.gz += m.gz; add(stats.tiers, tier, m.gz); plan.regions[rk][tod] ??= {}; plan.regions[rk][tod][tier] = { keys: Object.keys(m.per), bytes: m.gz };
        const tot = Object.values(m.per).reduce((s, x) => s + x, 0) || 1; for (const [k, b] of Object.entries(m.per)) { const g = G(F.groups[k]); add(g.packed, tier, b); add(g.gz, tier, m.gz * b / tot); } })); }
  }
  // the server: the city, read-only (as style/serve.mjs), plus the bake endpoints
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url.startsWith('/__bake/')) { const parts = []; for await (const c of req) parts.push(c); const body = Buffer.concat(parts), what = req.url.slice(8);
        if (what === 'plan') { const pl = JSON.parse(body);   // (one page per time of day: a worker that built day blocks is never reused for night ones)
          if (!plan) { plan = { ...pl, regions: {} }; tmp = path.join(OUT, plan.hash + '.tmp'); await fs.rm(tmp, { recursive: true, force: true }); }
          else if (pl.hash !== plan.hash) throw new Error(`the code changed during the bake (hash ${plan.hash} → ${pl.hash}): run it again`);
          else plan.tods = [...new Set([...plan.tods, ...pl.tods])];
          for (const tod of pl.tods) for (const [rk, T] of Object.entries(pl.regions)) { plan.regions[rk] ??= {}; for (const [tier, keys] of Object.entries(T)) if (keys.length) files.set(`${tod}|${rk}|${tier}`, { keys, got: 0, recs: {}, groups: {} }); }
          console.log(`plan ${pl.tods.join('+')}: hash ${plan.hash} · ${Object.keys(pl.regions).length} regions · ${files.size} files so far · ${pl.workers} build workers (${el()})`); }
        else if (what === 'rec') onRec(body);
        else if (what === 'done') doneMsg = JSON.parse(body);
        res.writeHead(200); res.end('ok'); return; }
      let name = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (name.endsWith('/')) name += 'index.html';
      const f = path.resolve(ROOT, '.' + name); if (!f.startsWith(ROOT) || name.split('/').some(p => p.startsWith('.'))) { res.writeHead(403); res.end(); return; }
      const body = await fs.readFile(f); res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
    } catch (e) { if (req.method === 'POST') { console.error('bake receiver:', e.message); res.writeHead(500); res.end(String(e.message)); } else { res.writeHead(404); res.end('Not found'); } }
  });
  await new Promise(r => server.listen(+opt('port', 0), '127.0.0.1', r)); const port = server.address().port;   // (--port <n>: a fixed port; else any free one)
  // the page, in headless Chrome: one session per time of day
  const pageMs = [];
  for (const tod of TODS.split(',')) { doneMsg = null; const tp = Date.now();
    const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-bake-')), url = `http://127.0.0.1:${port}/style/city/?bake=1&workers=${NW}&tods=${tod}&w=400&h=250&q=medium${process.env.SPREAD ? '&spread=' + SPREAD_NOW : ''}`;
    const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=400,338', url], { stdio: 'ignore' });
    let title = '', port2 = null;
    try {
      for (let t = 0; t < 100 && !port2; t++) { await sleep(100); try { port2 = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
      const t0 = Date.now(); let last = '';
      while (Date.now() - t0 < 20 * 60000) { await sleep(1000); const list = await (await fetch(`http://127.0.0.1:${port2}/json/list`)).json().catch(() => []); title = list.find(t => t.type === 'page')?.title || '';
        if (title !== last) { if (/^baking \d/.test(title)) process.stdout.write(`\r${tod}: ${title} (${el()})   `); last = title; }
        if (title === 'baked' || title.startsWith('bake failed')) break; }
    } finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
    process.stdout.write('\n');
    if (title !== 'baked' || !doneMsg) { console.error(`bake failed (${tod}): ${title || 'no page'} (${el()})`); server.close(); threads.forEach(w => w.terminate()); process.exit(1); }
    pageMs.push(doneMsg.ms); skippedAll.push(...doneMsg.skipped); modulesAll.push(...doneMsg.modules); console.log(`${tod}: ${doneMsg.jobs} jobs built in ${(doneMsg.ms / 1000).toFixed(1)} s (${((Date.now() - tp) / 1000).toFixed(1)} s with the page load)`); }
  await Promise.all(writing); server.close(); threads.forEach(w => w.terminate());
  const incomplete = [...files.entries()].filter(([, F]) => F.got !== F.keys.length).map(([k]) => k);
  if (incomplete.length) { console.error('bake incomplete:', incomplete.slice(0, 10).join(' ')); process.exit(1); }
  // index.json, then the swap: the new bake in, every older one out
  // (hardening pass: the index lists the regions, times of day and tiers in a fixed order too, and the skipped list sorted: they were
  // filled in as files finished. Only its timings — when, ms, buildMs, the groups' build times — change from run to run)
  const canon = {}; for (const rk of Object.keys(plan.regions).sort()) { canon[rk] = {}; for (const tod of ['d', 'n']) { const T = plan.regions[rk][tod]; if (!T) continue; canon[rk][tod] = {}; for (const t of ['far', 'mid', 'full', 'cf']) if (T[t]) canon[rk][tod][t] = T[t]; } }
  for (const g of Object.values(stats.groups)) for (const t of Object.keys(g.gz)) g.gz[t] = Math.round(g.gz[t]);   // (apportioned float sums: their last digits followed the finishing order)
  plan.regions = canon; const sk = s => s.tod + '|' + s.rk + '|' + s.key; skippedAll.sort((a, b) => sk(a) < sk(b) ? -1 : sk(a) > sk(b) ? 1 : 0);
  const index = { hash: plan.hash, when: new Date().toISOString(), region: plan.region, tods: plan.tods, regions: plan.regions, ms: Date.now() - T0, buildMs: pageMs, workers: plan.workers, meshopt: MO_VER,
    bytes: { gz: stats.gz, packed: stats.packed, byTier: stats.tiers }, groups: Object.fromEntries(Object.entries(stats.groups).sort((a, b) => a[0] < b[0] ? -1 : 1)), skipped: skippedAll, modules: modulesAll };
  await fs.writeFile(path.join(tmp, 'index.json'), JSON.stringify(index));
  const dst = path.join(OUT, plan.hash); await fs.rm(dst, { recursive: true, force: true }); await fs.rename(tmp, dst);
  for (const d of await fs.readdir(OUT)) if (d !== plan.hash && !d.startsWith('.')) await fs.rm(path.join(OUT, d), { recursive: true, force: true });
  const MB = b => (b / 1e6).toFixed(1) + ' MB';
  console.log(`baked ${plan.hash}: ${stats.files} files · ${MB(stats.gz)} on disk (meshopt ${MB(stats.packed)}) · page builds ${pageMs.map(m => (m / 1000).toFixed(1) + ' s').join(' + ')} with ${plan.workers} workers · total ${el()}`);
  console.log(`  by tier (both times of day, gz): ${Object.entries(stats.tiers).map(([t, b]) => `${t} ${MB(b)}`).join(' · ')}`);
  for (const [g, s] of Object.entries(stats.groups)) { const raw = Object.values(s.raw).reduce((a, b) => a + b, 0), gz = Object.values(s.gz).reduce((a, b) => a + b, 0);
    console.log(`  ${g.padEnd(6)} ${s.blocks} blocks · raw ${MB(raw)} → meshopt ${MB(Object.values(s.packed).reduce((a, b) => a + b, 0))} → gz ${MB(gz)} (${Object.entries(s.gz).map(([t, b]) => `${t} ${MB(b)}`).join(', ')}) · block builds ${(s.buildMs / 1000).toFixed(1)} s + far ${(s.farMs / 1000).toFixed(1)} s of worker time · full ${(s.tris / 1e6).toFixed(1)}M tris, mid ${(s.trisMid / 1e6).toFixed(1)}M (day)`); }
  if (skippedAll.length) console.log(`  SKIPPED (module errors: these build live): ${skippedAll.map(s => s.tod + ' ' + s.key).join(', ')}`);
  if (opt('verify')) await verify(dst, opt('verify').split(','), plan.tods);
}

// ── --verify: every baked tier against a hash report of the live build (regress.js hashes: full layers, mid, far, character mid/far)
async function verify(dir, labels, tods) {
  const { hashJob } = await import('../regress.js'), D = (await import(await tool(DEC_URL))).MeshoptDecoder; await D.ready;
  const index = JSON.parse(await fs.readFile(path.join(dir, 'index.json'), 'utf8')), P = 32 + SPREAD_NOW;   // (world/city.js P: verify a bake made at the same SPREAD)
  for (const [n, tod] of tods.entries()) { const label = labels[n]; if (!label) continue;
    const ref = JSON.parse(await fs.readFile(path.join(HERE, 'runs', label + '.hash.json'), 'utf8')).blocks, got = {}; let same = 0, diff = 0; const bad = [];
    for (const [rk, R] of Object.entries(index.regions)) { const T = R[tod]; if (!T) continue;
      const read = async tier => { if (!T[tier]) return {}; const buf = zlib.gunzipSync(await fs.readFile(path.join(dir, tod, `${rk}.${tier}.bin.gz`))); const { header, payload: p } = unpackBaked(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        const out = {}; for (const [k, e] of Object.entries(header.recs)) out[k] = decodeRecord(e, p, meshDecoder(D, p)); return out; };
      const [far, mid, full] = [await read('far'), await read('mid'), await read('full')];
      for (const [k, r] of Object.entries(far)) { if (k !== 'chunk') { got['far:' + k.replace(',', '_')] = hashJob({ far: r.far }).far; continue; }
        // a chunk: each member's vertices (K = its index) shifted back to its own block's origin
        const t = r.far; let v = 0; r.members.forEach((m, idx) => { const key = 'far:' + m.i + '_' + m.j; if (!m.n) { got[key] = 0; return; }
          const o = [m.i * P + P / 2, 0, m.j * P + P / 2], dx = Math.round((o[0] - t.o[0]) * 100), dz = Math.round((o[2] - t.o[2]) * 100), Pm = t.P.slice(v * 3, (v + m.n) * 3);
          for (let q = 0; q < m.n; q++) { Pm[q * 3] -= dx; Pm[q * 3 + 2] -= dz; } const Fm = new Uint8Array(Math.ceil(m.n / 32)); for (let q = 0; q < m.n / 4; q++) { const g = (v >> 2) + q; if (t.F[g >> 3] & (1 << (g & 7))) Fm[q >> 3] |= 1 << (q & 7); }
          if (t.K[v] !== idx) throw new Error('chunk member order'); got[key] = hashJob({ far: { n: m.n, o, P: Pm, N: t.N.slice(v * 3, (v + m.n) * 3), C: t.C.slice(v * 4, (v + m.n) * 4), F: Fm } }).far; v += m.n; }); }
      for (const [k, r] of Object.entries(mid)) { const h = hashJob({ full: full[k]?.full || [], mid: r.mid, far: null, chars: { mid: r.cm.mid, far: r.cm.far, n: r.cm.n } }); got[k.replace(',', '_')] = h; } }
    for (const [k, h] of Object.entries(ref)) { const g = got[k]; if (g === undefined) { bad.push(`${k}: not baked`); diff++; continue; }
      const a = typeof h === 'number' ? h : JSON.stringify({ ...h, far: undefined }), b = typeof g === 'number' ? g : JSON.stringify({ ...g, far: undefined });   // (a block job's own far is not what the stream shows: the far job's is, checked as far:i_j)
      if (a === b) same++; else { diff++; bad.push(`${k}: ${a} ≠ ${b}`); } }
    console.log(`verify ${tod} against ${label}: ${same} identical, ${diff} different${bad.length ? '\n  ' + bad.slice(0, 20).join('\n  ') : ''}`); }
}
