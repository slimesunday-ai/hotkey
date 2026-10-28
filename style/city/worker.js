// Build worker (pass 1c; pass 2: page isolation). Module workers can't use the page's import map, so the main thread ships the job
// module graph as source text; each module becomes a Blob URL with `three` pointed at the CDN build and relative imports pointed at
// the other blobs. The core (jobs.js) must load; then every optional module (district kits, heroes, block overrides) is imported on
// its own (streaming pass: all at once, in parallel), and whatever fails is reported instead of taking the worker down. Then jobs run
// here: far tiers (and far chunks), full block builds, character bakes — all off the main thread, results sent as transferables.
// Streaming pass · the same script is also a BAKED-DATA worker (init 'baked', cache.js openBaked): it fetches baked region files
// (style/city/baked/, tools/bake.mjs), unzips them, keeps them resident, and decodes one block's tier on request (meshopt vertex codec:
// ~1 ms for a downtown block's full tier), so the main thread only ever receives ready typed arrays.
import { THREE_URL, ADDONS_URL, FROM_RE } from './srcmap.js';
import { unpackBaked, decodeRecord } from './cache.js';
let J = null, MO = null; const regions = new Map();   // baked: url → Promise<{ header, payload, bytes }>
function maker(bundle) {
  const src = new Map(bundle), blob = new Map(), stack = new Set();
  const make = url => { if (blob.has(url)) return blob.get(url); if (stack.has(url)) throw new Error('import cycle at ' + url); stack.add(url);
    try { const code = src.get(url); if (code === undefined) throw new Error('missing source ' + url);
      const out = code.replace(FROM_RE, (m, pre, q, spec) => pre + q + (spec === 'three' ? THREE_URL : spec.startsWith('three/addons/') ? ADDONS_URL + spec.slice(13) : spec.startsWith('.') ? make(new URL(spec, url).href) : spec) + q);
      const b = URL.createObjectURL(new Blob([out], { type: 'text/javascript' })); blob.set(url, b); return b; } finally { stack.delete(url); } };
  return make;
}
const errText = err => String(err && (err.stack || err.message) || err).split('\n').slice(0, 3).join(' · ');
// baked: one region file (gzip) → resident { header, payload }
async function region(url) {
  let p = regions.get(url); if (p) return p;
  p = (async () => { const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(`baked region ${url}: ${res.status}`);
    const buf = await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); return { ...unpackBaked(buf), bytes: buf.byteLength }; })();
  regions.set(url, p); p.catch(() => regions.delete(url)); return p; }
// meshopt: P as 8-byte vertices (x y z 0, Int16) and N+C as 8 bytes (nx ny nz r g b a 0) → the tier mesh's own arrays
let scratch = new Uint8Array(1 << 20); const need = n => { if (scratch.length < n) scratch = new Uint8Array(Math.max(n, scratch.length * 2)); return scratch; };
function mesh(d, payload) {
  const [n, o0, o1, o2, pOff, pLen, cOff, cLen, fOff, fLen, kOff, kLen, xOff = -1, xLen = 0, yOff = -1, yLen = 0] = d, P = new Int16Array(n * 3), N = new Int8Array(n * 3), C = new Uint8Array(n * 4);
  const s = need(n * 8); MO.decodeVertexBuffer(s.subarray(0, n * 8), n, 8, new Uint8Array(payload, pOff, pLen)); const s16 = new Int16Array(s.buffer, 0, n * 4);
  for (let v = 0; v < n; v++) { P[v * 3] = s16[v * 4]; P[v * 3 + 1] = s16[v * 4 + 1]; P[v * 3 + 2] = s16[v * 4 + 2]; }
  MO.decodeVertexBuffer(s.subarray(0, n * 8), n, 8, new Uint8Array(payload, cOff, cLen)); const s8 = new Int8Array(s.buffer, 0, n * 8);
  for (let v = 0; v < n; v++) { const a = v * 8; N[v * 3] = s8[a]; N[v * 3 + 1] = s8[a + 1]; N[v * 3 + 2] = s8[a + 2]; C[v * 4] = s[a + 3]; C[v * 4 + 1] = s[a + 4]; C[v * 4 + 2] = s[a + 5]; C[v * 4 + 3] = s[a + 6]; }
  const t = { n, o: [o0, o1, o2], P, N, C, F: new Uint8Array(payload.slice(fOff, fOff + fLen)), K: kOff >= 0 ? new Uint8Array(payload.slice(kOff, kOff + kLen)) : null };
  // the characters' idle animation data (charbake.js, the fidelity pass): X Int16 × 4 (origin + facing), Y Uint8 × 4 (part, class, phase, lean)
  if (xOff >= 0) { t.X = new Int16Array(n * 4); MO.decodeVertexBuffer(new Uint8Array(t.X.buffer), n, 8, new Uint8Array(payload, xOff, xLen)); }
  if (yOff >= 0) { t.Y = new Uint8Array(n * 4); MO.decodeVertexBuffer(t.Y, n, 4, new Uint8Array(payload, yOff, yLen)); }
  return t;
}
onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    try { const make = maker(m.bundle); J = await import(make(m.entry));
      // streaming pass: the optional modules import in parallel (one at a time cost 20–90 ms per worker); `mods` keeps the manifest order
      const opt = m.optional || [], got = await Promise.all(opt.map(o => import(make(o.url)).catch(err => ({ __error: errText(err) }))));
      const mods = {}; opt.forEach((o, k) => { mods[o.path] = got[k]; });
      postMessage({ type: 'ready', mods: J.installModules(mods) });
    } catch (err) { postMessage({ type: 'ready', error: String(err && err.stack || err) }); }
    return; }
  if (m.type === 'initBaked') { try { MO = (await import(ADDONS_URL + 'libs/meshopt_decoder.module.js')).MeshoptDecoder; await MO.ready; postMessage({ type: 'ready' }); } catch (err) { postMessage({ type: 'ready', error: errText(err) }); } return; }
  const { id, job } = m;
  try {
    if (job.type === 'region') { const g = await region(job.url); postMessage({ id, r: { bytes: g.bytes, keys: Object.keys(g.header.recs) } }); return; }
    if (job.type === 'rec') { const g = await region(job.url), enc = g.header.recs[job.key]; if (!enc) { postMessage({ id, r: null }); return; }
      const t = performance.now(), r = decodeRecord(enc, g.payload, d => mesh(d, g.payload)); r.decodeMs = performance.now() - t; const tr = []; collect(r, tr); postMessage({ id, r }, tr); return; }
    if (job.type === 'drop') { regions.delete(job.url); postMessage({ id, r: true }); return; }
    const r = job.type === 'far' ? J.jobFar(job) : job.type === 'farChunk' ? J.jobFarChunk(job) : job.type === 'peds' ? J.jobPeds(job) : J.jobBlock(job); const tr = []; collect(r, tr); postMessage({ id, r }, tr); }
  catch (err) { postMessage({ id, error: String(err && err.stack || err) }); }
};
function collect(o, tr, seen = new Set()) { if (!o || typeof o !== 'object') return; if (ArrayBuffer.isView(o)) { if (!seen.has(o.buffer)) { seen.add(o.buffer); tr.push(o.buffer); } return; }
  for (const v of Array.isArray(o) ? o : Object.values(o)) collect(v, tr, seen); }
