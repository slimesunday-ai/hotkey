// Kerb props pass (2026-10-09) · THE KERB CHECK: every block of the universe built with the audit on (headless Chrome, the page's own
// build code), then, voxel against voxel:
//   · every prop the block stamped (kerb clutter, one-off scenes, yards, the corner kits, street furniture, parked cars) against every
//     other (bags are soft: never counted) — what audit.js 'prop-overlap' tests, over the whole city, not the section
//   · the sim layer's run-time ground pieces, which no build sees — each dealing corner's hotspot (simstate/layer.js hotspotAt, every
//     step from quiet to busiest, the full set or the compact one as placed) and each supply site's piles and spill — against the
//     props, structures and masses of the block they stand in;
//     a hit is split into its base row (the piece's bottom 0.1 m sunk in paving or a kerb strip) and above it (the piece runs through it)
//   · the corner stand spots (simstate/stands.json) standing inside a hotspot
//   node style/city/tools/kerbcheck.mjs [--runtime-only] [--out <file.json>] [--base http://127.0.0.1:5320/style/city/]
// The page must be served (node style/serve.mjs <port>). Prints the counts; --out keeps every pair and hit.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = opt('--base') || process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/', OUT = opt('--out'), RTO = args.includes('--runtime-only');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', sleep = ms => new Promise(r => setTimeout(r, ms));

// ── in the page (serialized): returns { blocks, pairs, runtime, errs }
async function inPage(runtimeOnly) {
  const B = new URL('.', location.href).pathname, W = await import(new URL('../../world/city.js', location.href).href);
  const M = await import(B + 'main.js'), J = await import(B + 'jobs.js'), A = await import(B + 'audit.js'), MO = await import(B + 'modules.js');
  const L = await import(B + 'simstate/layer.js'), SA = await import(B + 'simassets/index.js'), PL = await import(B + 'plan.js'), AD = await import(B + 'simstate/adapter.js');
  const P = PL.P, REG = A.REG; let CAP = null; const end0 = REG.end; REG.end = function (c, g) { CAP = this.blk; return end0.call(this, c, g); };   // (the block record, voxels and all)
  const flags = { neutral: true, pass2: true, faces: true, letters: 'new' }, ROT = [[1, 0], [0, 1], [-1, 0], [0, -1]], SOFT = new Set(['bags']);
  const hit = (a, b, e = 0) => a[0] < b[3] - e && a[3] > b[0] + e && a[1] < b[4] - e && a[4] > b[1] + e && a[2] < b[5] - e && a[5] > b[2] + e;
  const solidAt = (pl, x, y, z) => { const V = pl.V; let lx = x - pl.t[0], lz = z - pl.t[2]; const ly = y - pl.t[1];
    if (pl.rot) { const [c, s] = ROT[pl.rot & 3], ux = lx * c - lz * s, uz = lx * s + lz * c; lx = ux; lz = uz; }
    const i = Math.floor((lx - V.org[0]) / V.s), j = Math.floor((ly - V.org[1]) / V.s), k = Math.floor((lz - V.org[2]) / V.s);
    return i >= 0 && j >= 0 && k >= 0 && i < V.nx && j < V.ny && k < V.nz && V.d[i + k * V.nx + j * V.sxz] !== 0; };
  const cells = pl => { if (pl._c) return pl._c; const V = pl.V, out = [], [c, s] = ROT[pl.rot & 3], [tx, ty, tz] = pl.t;
    for (let j = 0; j < V.ny; j++) for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) if (V.d[i + k * V.nx + j * V.sxz]) {
      const x = V.org[0] + (i + .5) * V.s, y = V.org[1] + (j + .5) * V.s, z = V.org[2] + (k + .5) * V.s; out.push(x * c + z * s + tx, y + ty, -x * s + z * c + tz); }
    return (pl._c = out); };
  const boxOf = pl => { const c = cells(pl), h = pl.V.s / 2, o = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (let k = 0; k < c.length; k += 3) for (let q = 0; q < 3; q++) { o[q] = Math.min(o[q], c[k + q] - h); o[q + 3] = Math.max(o[q + 3], c[k + q] + h); } return o; };
  const ov = (a, b) => { const ca = cells(a), cb = cells(b), [lg, c] = ca.length <= cb.length ? [b, ca] : [a, cb]; let n = 0; for (let k = 0; k < c.length; k += 3) if (solidAt(lg, c[k], c[k + 1], c[k + 2])) n++; return [n, c.length / 3]; };
  const grp = id => id.split('·')[1];
  const places = await fetch(new URL(W.sdata('../../sim2/places.json'), location.href).href).then(r => r.json()), kits = new Set(PL.PLACES.filter(p => p.kind === 'corner').map(p => p.id));
  const stands = await fetch(new URL(W.sdata('simstate/stands.json'), location.href).href).then(r => r.json()).catch(() => null);
  const runtime = [], at = (V, rot, x, z) => ({ V, rot, t: [x, J.groundAt(x, z), z] });
  for (const c of places.places.filter(p => p.kind === 'corner')) { const [x, z, rot, , , compact] = L.hotspotAt(c, kits.has(c.id));   // (compact: the tight corners' set)
    for (const st of [0, 1, 2, 3, 4]) runtime.push({ what: 'hotspot' + st + (compact ? 'c' : ''), place: c.id, name: c.name, pl: at(SA.hotspot({ heat: st / 4, compact: !!compact }), rot, x, z), i: Math.floor(x / P), j: Math.floor(z / P) }); }
  for (const p of places.places.filter(p => p.kind === 'site')) { const ks = AD.RULES?.YIELDS?.[p.id] || [p.yields];   // (simstate/layer.js drawPile, at the fullest)
    ks.forEach((k, n) => { const x = p.x + (ks.length > 1 ? (n ? 2.7 : -2.7) : 0); runtime.push({ what: 'pile', place: p.id, name: p.name, pl: at(SA.pile(k, 1), 0, x, p.z), i: Math.floor(x / P), j: Math.floor(p.z / P) }); });
    runtime.push({ what: 'spill', place: p.id, name: p.name, pl: at(SA.pile(ks[0], .35), 1, p.x + 4.6, p.z + 2.2), i: Math.floor((p.x + 4.6) / P), j: Math.floor((p.z + 2.2) / P) }); }
  const mine = new Set(runtime.map(r => r.i + ',' + r.j)), list = M.worldBlocks().filter(([i, j]) => MO.buildsBlock(i, j) && (!runtimeOnly || mine.has(i + ',' + j)));
  const pairs = [], rt = [], errs = []; let n = 0;
  for (const [i, j] of list) { CAP = null; try { J.jobBlock({ i, j, night: false, audit: true, chars: false, flags }); } catch (e) { errs.push([i, j, String(e).slice(0, 200)]); continue; }
    const b = CAP; if (!b) { errs.push([i, j, 'no block record']); continue; } n++; const pls = b.pls.filter(p => !SOFT.has(p.kind));
    if (!runtimeOnly) for (let a = 0; a < pls.length; a++) for (let c = a + 1; c < pls.length; c++) { const X = pls[a], Y = pls[c]; if (!hit(X.box, Y.box, .01)) continue; const [o, m] = ov(X, Y);
      if (o > Math.max(2, m * .01)) pairs.push({ blk: i + ',' + j, a: X.id, b: Y.id, kinds: [X.kind, Y.kind].sort().join(' × '), ov: o, of: m }); }
    for (const r of runtime.filter(r => r.i === i && r.j === j)) { const bx = boxOf(r.pl), hits = [], c = cells(r.pl), y0 = r.pl.t[1] + .1;
      const split = q => { let base = 0, up = 0; for (let k = 0; k < c.length; k += 3) if (solidAt(q, c[k], c[k + 1], c[k + 2])) c[k + 1] < y0 ? base++ : up++; return [base, up]; };
      for (const q of b.pls) { if (SOFT.has(q.kind) || !hit(bx, q.box, .01)) continue; const [base, up] = split(q); if (base + up > 2) hits.push({ id: q.id, kind: q.kind, base, up }); }
      for (const q of b.structs) { if (!hit(bx, q.box, .01)) continue; const [base, up] = split(q); if (base + up > 2) hits.push({ id: q.id, kind: 'structure', base, up }); }
      const spots = r.what.startsWith('hotspot') ? (stands?.places?.[r.place]?.spots || []).filter(s => s.x > bx[0] - .3 && s.x < bx[3] + .3 && s.z > bx[2] - .3 && s.z < bx[5] + .3).length : 0;
      rt.push({ what: r.what, name: r.name, at: [+r.pl.t[0].toFixed(2), +r.pl.t[2].toFixed(2), r.pl.rot], hits, spots }); } }
  return { blocks: n, pairs, runtime: rt, errs };
}

const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-kerb-'));
const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=400,288', 'about:blank'], { stdio: 'ignore' });
let code = 1;
try {
  let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
  if (!port) throw new Error('chrome did not start');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'), ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }); let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const k = ++id; wait.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable'); await send('Page.navigate', { url: `${BASE}?audit=1&report=1&shot=1&blocks=;&w=64&h=64` });   // (an empty block list: the page loads every module and builds nothing)
  const t0 = Date.now(); let title = ''; while (Date.now() - t0 < 120000 && title !== 'audit-ready') { await sleep(500); title = (await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })).result?.result?.value; }
  if (title !== 'audit-ready') throw new Error('the page did not load: ' + title);
  const r = await send('Runtime.evaluate', { expression: `(${inPage.toString()})(${RTO})`, returnByValue: true, awaitPromise: true, timeout: 3600000 });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  const d = r.result.result.value; ws.close(); code = 0;
  if (OUT) await fs.writeFile(OUT, JSON.stringify(d, null, 1));
  const by = {}; for (const p of d.pairs) by[p.kinds] = (by[p.kinds] || 0) + 1;
  console.log(`${d.blocks} blocks built${d.errs.length ? ` (${d.errs.length} failed: ${d.errs.map(e => e.join(',')).join('; ')})` : ''}`);
  if (!RTO) console.log(`prop × prop overlaps: ${d.pairs.length}${d.pairs.length ? ' — ' + Object.entries(by).map(([k, v]) => `${k} ${v}`).join(', ') : ''}`);
  const through = d.runtime.filter(x => x.hits.some(h => h.up > 2)), base = d.runtime.filter(x => x.hits.length && !x.hits.some(h => h.up > 2));
  console.log(`run-time pieces: ${d.runtime.length} · running through something ${through.length} · only their base row sunk ${base.length} · stand spots inside a hotspot ${d.runtime.reduce((s, x) => s + x.spots, 0)}`);
  const hot = d.runtime.filter(x => x.what.startsWith('hotspot')), upIn = (x, f) => x.hits.some(h => h.up > 2 && f(h.kind));
  console.log(`hotspots (${hot.length / 5} corners × 5 steps, ${hot.filter(x => x.what.endsWith('c')).length / 5} compact): through a structure or mass ${hot.filter(x => upIn(x, k => k === 'structure' || k === 'mass')).length} · through a prop (street furniture) ${hot.filter(x => upIn(x, k => k !== 'structure' && k !== 'mass')).length}`);
  for (const x of d.runtime) if (x.hits.length || x.spots) console.log(`  ${x.what.padEnd(8)} ${x.name.padEnd(26)} [${x.at.join(', ')}] ${x.hits.map(h => `${h.id} ${h.base}+${h.up}`).join(' · ')}${x.spots ? ` · ${x.spots} stand spots inside` : ''}`);
} catch (e) { console.error('kerbcheck: ' + (e && e.message || e)); }
finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
process.exit(code);
