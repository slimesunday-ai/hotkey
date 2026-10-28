// SIM LIVE pass · THE SIM AGENTS' LOOKS. An agent with a cast look (sim2 `look` 0–11: world/chars.js LOOKS, the same cast in the same
// order) walks in that look, in the traits it wears (adapter.js maps the sim's slots to chars.js's); the Locals and later handles roll a
// look from their handle; on Iron Island they wear the county jumpsuit. Each look is baked once in a worker of its own (lookjob.js: chars.js takes 5–20 ms to build one) and added
// to peds.js's batches (peds.addLook); until then the agent walks in a pooled generic look. No worker: baked here, one per PUMP ms.
// bakeFull / bakeMid mirror pedbake.js's (not exported there; pedbake.js is core) — keep them in step with it. ANIMATION MERGE
// (2026-09-29): the full body is pedbake.js's now, the lab's walk v2 body (anim/bake.js bakeSegFull), so sim agents walk like the crowd.
import * as THREE from 'three';
import { Bank, Vol, meshVol } from '../vox.js';
import { bakeSegFull } from '../anim/cast/bake.js';   // (cast pass: the fresh cast's bake, as pedbake.js)

const PUMP = 150;   // ms between two bakes
const LUT = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; LUT[i] = Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - .055)); }
const toS = v => LUT[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + .5) | 0];
const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const under = (m, g) => { for (let p = m.parent; p; p = p.parent) if (p === g) return true; return false; };
export function bakeFull(CH, o) {
  const rig = o.userData.rig, P = [], N = [], C = [], K = [], I = [], nm = new THREE.Matrix3(); let v = 0; const bands = [new Map(), new Map(), new Map()];
  o.traverse(m => { if (!m.isMesh || !visible(m)) return; let part = 0; ['legL', 'legR', 'armL', 'armR'].forEach((n, k) => { if (under(m, rig[n])) part = k + 1; });
    const li = Math.max(0, CH.MATS.indexOf(m.material)), g = m.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array, idx = g.index.array, e = m.matrixWorld.elements; nm.getNormalMatrix(m.matrixWorld); const q = nm.elements, n = pos.length / 3;
    for (let k = 0; k < n; k++) { const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2], a = nor[k * 3], b = nor[k * 3 + 1], c = nor[k * 3 + 2];
      const X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; P.push(X, Y, Z);
      let nx = q[0] * a + q[3] * b + q[6] * c, ny = q[1] * a + q[4] * b + q[7] * c, nz = q[2] * a + q[5] * b + q[8] * c; const l = Math.hypot(nx, ny, nz) || 1; N.push(Math.round(nx / l * 127), Math.round(ny / l * 127), Math.round(nz / l * 127));
      const r = toS(col[k * 3]), gg = toS(col[k * 3 + 1]), bb = toS(col[k * 3 + 2]); C.push(r, gg, bb, li * 85); K.push(part);
      const band = Y < .48 ? 0 : Y < .95 ? 1 : 2, h = (r << 16) | (gg << 8) | bb; bands[band].set(h, (bands[band].get(h) || 0) + 1); }
    for (let k = 0; k < idx.length; k++) I.push(idx[k] + v); v += n; });
  const main = bands.map(b => { let best = 0x777777, bc = -1; for (const [h, c] of b) if (c > bc) { bc = c; best = h; } return best; });
  return { P: new Float32Array(P), N: new Int8Array(N), C: new Uint8Array(C), K: new Uint8Array(K), I: new Uint32Array(I), main };
}
export function bakeMid(CH, o) {
  const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), tm = new THREE.Matrix4(), cells = new Map();
  o.traverse(m => { if (!m.isMesh || !visible(m)) return; const li = Math.max(0, CH.MATS.indexOf(m.material)); tm.multiplyMatrices(inv, m.matrixWorld); const e = tm.elements, g = m.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, col = g.attributes.color.array;
    for (let q = 0; q < pos.length / 12; q++) { const b = q * 12; let cx = 0, cy = 0, cz = 0; for (let t = 0; t < 4; t++) { cx += pos[b + t * 3]; cy += pos[b + t * 3 + 1]; cz += pos[b + t * 3 + 2]; }
      cx = cx / 4 - nor[b] * .5; cy = cy / 4 - nor[b + 1] * .5; cz = cz / 4 - nor[b + 2] * .5; const X = e[0] * cx + e[4] * cy + e[8] * cz + e[12], Y = e[1] * cx + e[5] * cy + e[9] * cz + e[13], Z = e[2] * cx + e[6] * cy + e[10] * cz + e[14];
      const k = Math.floor(X / 2) + ',' + Math.floor(Y / 2) + ',' + Math.floor(Z / 2), h = (toS(col[b]) << 16) | (toS(col[b + 1]) << 8) | toS(col[b + 2]); let c = cells.get(k); if (!c) cells.set(k, c = new Map()); const key = h * 4 + li; c.set(key, (c.get(key) || 0) + (li === 3 ? 3 : 1)); } });
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; for (const k of cells.keys()) { const [x, y, z] = k.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
  const V = new Vol(x1 - x0 + 3, y1 - y0 + 3, z1 - z0 + 3, { s: 2, org: [(x0 - 1) * 2, (y0 - 1) * 2, (z0 - 1) * 2], ground: false });
  for (const [k, c] of cells) { const [x, y, z] = k.split(',').map(Number); let best = 0, bc = -1; for (const [h, n] of c) if (n > bc) { bc = n; best = h; } V.set(x - x0 + 1, y - y0 + 1, z - z0 + 1, best >> 2, best & 3); }
  const nx = V.nx, ny = V.ny, nz = V.nz, seen = new Uint8Array(nx * ny * nz), st = [0]; seen[0] = 1; const id = (x, y, z) => x + nx * (z + nz * y);
  while (st.length) { const i = st.pop(), x = i % nx, z = ((i / nx) | 0) % nz, y = (i / (nx * nz)) | 0; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const X = x + dx, Y = y + dy, Z = z + dz; if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue; const j = id(X, Y, Z); if (seen[j] || V.has(X, Y, Z)) continue; seen[j] = 1; st.push(j); } }
  const fill = V.pal[1] ?? 0x777777; for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) if (!seen[id(x, y, z)] && !V.has(x, y, z)) V.set(x, y, z, fill);
  const bank = meshVol(V, new Bank(true)), P = [], N = [], C = [], I = []; let v = 0, sc = CH.S;
  bank.L.forEach((O, li) => { if (!O.v) return; for (let k = 0; k < O.v; k++) { P.push(O.P.a[k * 3] * sc, O.P.a[k * 3 + 1] * sc, O.P.a[k * 3 + 2] * sc); N.push(O.N.a[k * 3], O.N.a[k * 3 + 1], O.N.a[k * 3 + 2]); C.push(toS(O.C.a[k * 3]), toS(O.C.a[k * 3 + 1]), toS(O.C.a[k * 3 + 2]), li * 85); }
    for (let k = 0; k < O.I.n; k++) I.push(O.I.a[k] + v); v += O.v; });
  return { P: new Float32Array(P), N: new Int8Array(N), C: new Uint8Array(C), K: new Uint8Array(v), I: new Uint32Array(I) };
}
export function bake(CH, look) { const full = bakeSegFull(THREE, CH, look), o = CH.build(look); o.userData.open.visible = true; o.userData.shut.visible = false;
  CH.pose(o, Math.PI / 2, .8); o.updateMatrixWorld(true); const mid = bakeMid(CH, o); o.traverse(m => m.geometry?.dispose()); return { full, mid, main: full.main }; }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export function createLooks({ peds, CH, log = () => {}, worker = true }) {   // (worker false: a shot — headless virtual time and workers don't mix; bake here)
  const done = new Map(), queue = [], waiting = new Set(), S = { baked: 0, failed: 0, ms: 0, maxMs: 0, addMs: 0, inWorker: 0 }; let last = -1e9, pool = null, busy = 0;
  const keyOf = r => 'h:' + r.id + (r.status === 'jail' ? '|jail' : '') + (r.outfit ? '|' + r.outfit : '');   // (cast pass: a look per handle, see specOf)
  const pooled = r => hash(r.id) % Math.max(1, peds.looks || 24);
  // CAST PASS (2026-10-02) · FOR NOW every sim agent wears a stable random look from the city's new cast (cast.js rollLook), seeded by its
  // handle, so the live sim shows the fresh traits too. The sim's own look index (sim2 `look` 0–11, the old LOOKS order) and its worn
  // traits (`wear`: sim2 rules.mjs TRAITS ids, mapped by adapter.js to the OLD chars.js ids) are not drawn: those ids don't exist in the
  // fresh registry. LATER: map the sim's TRAITS table onto fresh cast ids (adapter.js WEAR) and lay them over the roll with CH.wear.
  // On Iron Island an agent wears the county issue (cast.js OUTFITS.county), like the yard's inmates. A look asked for in an outfit
  // (r.outfit: cast.js OUTFITS — the station cops' 'officer', simstate/stationcops.js) wears it over the roll.
  function specOf(r, wear = true) {
    const base = CH.rollLook(hash(r.id) & 0xffffff);
    if (r.status === 'jail') CH.wear(base, CH.OUTFITS.county);
    else if (r.outfit && CH.OUTFITS?.[r.outfit]) CH.wear(base, CH.OUTFITS[r.outfit]);
    return base; }
  const add = (k, r, res) => { const t0 = performance.now(), ix = res ? peds.addLook(res) : -1; S.addMs = Math.max(S.addMs, performance.now() - t0); done.set(k, ix >= 0 ? ix : pooled(r)); waiting.delete(k); S.baked++; };
  // the worker: a one-worker pool (pool.js) whose entry is lookjob.js; if it can't start, bakes run here, one per PUMP ms
  const ready = (async () => { if (!worker) return; try { const { bundleOf, createPool } = await import('../pool.js'), entry = new URL('./lookjob.js', import.meta.url).href, B = await bundleOf(entry, []);
    const P = createPool(1, B.bundle, entry, []); await P.ready; pool = P; } catch (e) { log('looks bake on the main thread (' + (e && e.message || e) + ')'); } })();
  async function bakeOne(k, r) {
    const t0 = performance.now();
    for (const wear of [true, false]) { try { const res = pool ? await pool.exec({ type: 'look', look: specOf(r, wear) }) : bake(CH, specOf(r, wear)); if (pool) S.inWorker++; add(k, r, res); break; }
      catch (e) { if (wear && r.wear) { log(`look for @${r.id}: a worn trait didn't build (${e && e.message || e}) — drawn without it`); continue; } log(`look for @${r.id}: ${e && e.message || e}`); S.failed++; add(k, r, null); } }
    const ms = performance.now() - t0; S.ms += ms; S.maxMs = Math.max(S.maxMs, ms); }
  return {
    ready,
    of(r) { const k = keyOf(r), d = done.get(k); if (d !== undefined) return d; if (!waiting.has(k)) { waiting.add(k); queue.push([k, r]); } return pooled(r); },
    async pumpAll() { await ready; while (queue.length) { const [k, r] = queue.shift(); await bakeOne(k, r); } },   // (a shot: every look now)
    pump() { if (!queue.length || !peds.ready) return;
      if (pool) { while (queue.length && busy < 2) { const [k, r] = queue.shift(); busy++; bakeOne(k, r).finally(() => busy--); } return; }   // (in the worker: the frame only adds the result)
      const now = performance.now(); if (now - last < PUMP) return; last = now; const [k, r] = queue.shift(); bakeOne(k, r); },
    stats: () => ({ baked: S.baked, failed: S.failed, queued: queue.length, inWorker: S.inWorker, msAvg: S.baked ? +(S.ms / S.baked).toFixed(2) : 0, maxMs: +S.maxMs.toFixed(2), addMaxMs: +S.addMs.toFixed(2) }),
  };
}
