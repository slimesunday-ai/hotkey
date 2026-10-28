// IndexedDB block cache (pass 1c): built tiers are stored per block and tier ('far', 'mid', 'full', 'cm' = character mid+far,
// 'cf' = character full) under the build's source hash + time of day, so a repeat load reads blocks instead of building them.
// When the code changes the hash changes and the old entries are dropped. Every call degrades to a miss if storage is unavailable.
// Streaming pass · the BAKED city (openBaked, below): every block's tiers built ahead of time by tools/bake.mjs into style/city/baked/
// <hash>/, keyed by the same source hash, so a stale bake is simply not found. The stream reads memory → baked → IndexedDB → a worker
// build. The file formats (the raw records the bake page posts, the baked region files) and their encoders live here too: worker-safe,
// no DOM at module level (worker.js and tools/bake.mjs import this file).
export async function openCache(hash, enabled = true) {
  const miss = { get: async () => undefined, put: async () => {}, stats: { hits: 0, misses: 0, puts: 0, bytes: 0 }, on: false };
  if (!enabled || typeof indexedDB === 'undefined') return miss;
  let db; try { db = await new Promise((res, rej) => { const r = indexedDB.open('aicity-blocks', 1); r.onupgradeneeded = () => { r.result.createObjectStore('t'); r.result.createObjectStore('meta'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  catch { return miss; }
  // F16 (audit 2026-10-08) · one database serves every build of the page on this origin, and a build that opens it with another hash
  // clears it; but an older build still open in another tab (the deploy before, another ?spread) went on writing its late worker
  // results under the very same keys, and the new build read them back: another build's geometry and anchors. Every record now lives
  // under its build's hash ('<hash>|<key>'), so a build only ever reads its own; the meta hash (format 2: '2:<hash>') still clears
  // the rest when it changes.
  const META = '2:' + hash, K = key => hash + '|' + key;
  const tx = (store, mode, fn) => new Promise((res, rej) => { try { const t = db.transaction(store, mode), s = t.objectStore(store), q = fn(s); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch (e) { rej(e); } });
  try { const h = await tx('meta', 'readonly', s => s.get('hash')); if (h !== META) { await tx('t', 'readwrite', s => s.clear()); await tx('meta', 'readwrite', s => s.put(META, 'hash')); } } catch { return miss; }
  const stats = { hits: 0, misses: 0, puts: 0, bytes: 0 };
  return { on: true, stats,
    async get(key) { try { const v = await tx('t', 'readonly', s => s.get(K(key))); v === undefined ? stats.misses++ : stats.hits++; return v; } catch { stats.misses++; return undefined; } },
    async put(key, val, bytes = 0) { try { await tx('t', 'readwrite', s => s.put(val, K(key))); stats.puts++; stats.bytes += bytes; } catch (e) { /* quota or private mode: stay a pure build */ } } };
}

// ── streaming pass · record files. A container is 8 magic bytes, a u32 header length, the header (JSON), then an 8-aligned payload.
// A record (whatever the stream caches for a block and tier: tier meshes, typed arrays, plain values) becomes JSON in the header with
// every typed array moved to the payload ({ $a: [offset, bytes, type] }), and in a baked file every tier mesh encoded with the meshopt
// vertex codec ({ $m: [n, origin…, P, NC, F, K, X, Y] }: P as 8-byte vertices x y z 0, N + C as 8 bytes nx ny nz r g b a 0, and the
// fidelity pass's character animation data X (Int16 × 4) and Y (Uint8 × 4) when present; lossless). Any other field a tier mesh
// carries rides along as it is ({ $x: { name: … } }), so a new per-vertex attribute is never dropped by the cache or the bake.
const CTORS = { Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array };
export const RAW = 'CITYRW01', BAKED = 'CITYBK01';
export const isTier = x => !!x && typeof x === 'object' && typeof x.n === 'number' && x.P instanceof Int16Array && x.N instanceof Int8Array && x.C instanceof Uint8Array && x.F instanceof Uint8Array;
const CORE = new Set(['n', 'o', 'P', 'N', 'C', 'F', 'K', 'X', 'Y']);
export function payload() { const parts = []; let len = 0;
  return { parts, get length() { return len; }, add(u8) { const off = len; parts.push([off, u8]); len = (len + u8.byteLength + 7) & ~7; return [off, u8.byteLength]; } }; }
export function encodeRecord(v, pay, meshEnc = null) {
  if (v === null || typeof v !== 'object') return v;
  if (meshEnc && isTier(v)) { const m = { $m: meshEnc(v, pay) }, x = {}; for (const [k, y] of Object.entries(v)) if (!CORE.has(k) && y !== undefined && y !== null && typeof y !== 'function') x[k] = encodeRecord(y, pay, meshEnc);
    if (Object.keys(x).length) m.$x = x; return m; }
  if (ArrayBuffer.isView(v)) return { $a: [...pay.add(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)), v.constructor.name] };
  if (Array.isArray(v)) return v.map(x => encodeRecord(x, pay, meshEnc));
  const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined && typeof x !== 'function') o[k] = encodeRecord(x, pay, meshEnc); return o;
}
// (typed arrays come back as copies: a worker transfers them to the page, and the region stays resident)
export function decodeRecord(v, buf, meshDec) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => decodeRecord(x, buf, meshDec));
  if (v.$m) { const m = meshDec(v.$m); if (v.$x) for (const [k, x] of Object.entries(v.$x)) m[k] = decodeRecord(x, buf, meshDec); return m; }
  if (v.$a) { const [off, len, ct] = v.$a; return new CTORS[ct](buf.slice(off, off + len)); }
  const o = {}; for (const [k, x] of Object.entries(v)) o[k] = decodeRecord(x, buf, meshDec); return o;
}
export function packContainer(magic, header, pay) {
  const hj = new TextEncoder().encode(JSON.stringify(header)), p0 = (12 + hj.length + 7) & ~7, out = new Uint8Array(p0 + pay.length);
  for (let k = 0; k < 8; k++) out[k] = magic.charCodeAt(k); new DataView(out.buffer).setUint32(8, hj.length, true); out.set(hj, 12);
  for (const [off, u8] of pay.parts) out.set(u8, p0 + off); return out.buffer;
}
export function unpackContainer(buf, magic) {
  const u = new Uint8Array(buf); for (let k = 0; k < 8; k++) if (u[k] !== magic.charCodeAt(k)) throw new Error(`not a ${magic} file`);
  const hl = new DataView(buf).getUint32(8, true), header = JSON.parse(new TextDecoder().decode(u.subarray(12, 12 + hl))), p0 = (12 + hl + 7) & ~7;
  return { header, payload: buf.slice(p0) };
}
// the bake page posts each record raw (tools/bake.mjs encodes it); a worker unpacks a baked region file
export const packRaw = (meta, rec) => { const pay = payload(); return packContainer(RAW, { meta, rec: encodeRecord(rec, pay) }, pay); };
export const unpackRaw = buf => { const { header, payload: p } = unpackContainer(buf, RAW); return { meta: header.meta, rec: decodeRecord(header.rec, p, () => null) }; };
export const unpackBaked = buf => unpackContainer(buf, BAKED);

// ── streaming pass · THE BAKED CITY (main thread). baked/<hash>/index.json lists the regions (4 × 4 blocks) and, per time of day, which
// records each region's files hold: <tod>/<ri>_<rj>.<tier>.bin.gz, tier = far (block far tiers + the woods chunk) · mid (mid tier + its
// anchors, lanes, stats + the character mid/far tiers) · full · cf (character full bodies). A few baked-data workers (worker.js, init
// 'baked') fetch, unzip and keep region files resident and decode one record per request, so nothing heavy runs on the main thread.
//   has(key, tier) · get(key, tier) → Promise<record | undefined> · preload([[region, tier], …], onProgress) · regionOf(i, j) · stats
export async function openBaked(base, hash, tod, o = {}) {
  const off = { on: false, has: () => false, get: async () => undefined, preload: async () => {}, stats: {}, regionOf: () => null, index: null, close() {} };
  let index = null; try { const r = await fetch(new URL(`${hash}/index.json`, base), { cache: 'no-store' }); if (r.ok) index = await r.json(); } catch { index = null; }
  if (!index || index.hash !== hash || !index.tods?.includes(tod)) return off;
  const RS = index.region, n = o.workers ?? 3, S = [], wait = new Map(); let seq = 0, restarts = 0, live = false;
  const kOf = rk => { let h = 0; for (let k = 0; k < rk.length; k++) h = (h * 31 + rk.charCodeAt(k)) | 0; return Math.abs(h) % n; };   // a region's worker slot
  // F09 (audit 2026-10-08) · a baked-data worker that died (an uncaught error, a reply it couldn't send) took every request it held
  // with it, unsettled, and its slot (a fixed share of the regions) went on taking requests nobody answered. Now its requests reject
  // (get() reads that as a miss: the stream builds the block instead), the regions it held are forgotten (their files lived in it) and
  // a fresh worker takes the slot, at most 2 × n times; a slot left without a worker answers every request with a miss at once.
  function start(k) { const s = { w: new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) }; S[k] = s;
    s.ready = new Promise((res, rej) => { s.fail = rej;
      s.w.onmessage = e => { const m = e.data; if (m.type === 'ready') { if (m.error) rej(new Error(m.error)); else res(); return; } const p = wait.get(m.id); if (!p) return; wait.delete(m.id); if (m.error) p.rej(new Error(m.error)); else p.res(m.r); }; });
    s.w.onerror = ev => lost(s, new Error('baked worker: ' + (ev?.message || ev?.type || 'error')));
    s.w.onmessageerror = () => lost(s, new Error('baked worker: a reply could not be read'));
    s.ready.catch(e => lost(s, e)); s.w.postMessage({ type: 'initBaked' }); return s.ready; }
  function lost(s, e) { const k = S.indexOf(s); if (k < 0) return; S[k] = null; s.fail(e); try { s.w.terminate(); } catch {}
    for (const [id, p] of wait) if (p.s === s) { wait.delete(id); p.rej(e); }
    if (!live) return; console.warn(e.message + (restarts < 2 * n ? ': a fresh worker takes its regions' : ': its regions read as misses'));
    for (const u of [...loaded.keys()]) if (kOf(u.slice(u.lastIndexOf('/') + 1).split('.')[0]) === k) loaded.delete(u);
    if (restarts < 2 * n) { restarts++; start(k); } }
  try { await Promise.all(Array.from({ length: n }, (_, k) => start(k))); live = true; } catch (e) { console.warn('baked data off:', e.message); S.forEach(s => { try { s?.w.terminate(); } catch {} }); return off; }
  const call = async (k, job) => { const s = S[k]; if (!s) throw new Error(`baked worker ${k} is gone`); await s.ready; if (S[k] !== s) throw new Error(`baked worker ${k} was lost`);
    return new Promise((res, rej) => { const id = ++seq; wait.set(id, { res, rej, s }); s.w.postMessage({ id, job }); }); };
  // key sets per region and tier, for this time of day
  const sets = new Map(); for (const [rk, R] of Object.entries(index.regions)) { const T = R[tod]; if (!T) continue; for (const [tier, f] of Object.entries(T)) sets.set(rk + '|' + tier, new Set(f.keys)); }
  const regionOf = (i, j) => Math.floor(i / RS) + '_' + Math.floor(j / RS);
  const urlOf = (rk, tier) => new URL(`${hash}/${tod}/${rk}.${tier}.bin.gz`, base).href, loaded = new Map();
  const stats = { gets: 0, misses: 0, decodeMs: 0, regions: 0, resident: 0, files: index.regions ? Object.keys(index.regions).length : 0 };
  const load = (rk, tier) => { const u = urlOf(rk, tier); let p = loaded.get(u); if (!p) { p = call(kOf(rk), { type: 'region', url: u }).then(r => { stats.regions++; stats.resident += r.bytes; return r; }); loaded.set(u, p); p.catch(() => { if (loaded.get(u) === p) loaded.delete(u); }); } return p; };
  const has = (key, tier, rk) => !!sets.get((rk ?? regionOfKey(key)) + '|' + tier)?.has(key);
  const regionOfKey = key => { const [i, j] = key.split(',').map(Number); return regionOf(i, j); };
  return { on: true, index, stats, regionOf, has, loaded: (rk, tier) => loaded.has(urlOf(rk, tier)),
    // key: 'i,j' (or 'chunk' with rk given): the record, decoded in the region's worker; undefined when the bake has none
    async get(key, tier, rk = regionOfKey(key)) { if (!has(key, tier, rk)) { stats.misses++; return undefined; }
      try { load(rk, tier); const r = await call(kOf(rk), { type: 'rec', url: urlOf(rk, tier), key }); if (r) { stats.gets++; stats.decodeMs += r.decodeMs || 0; } return r || undefined; }
      catch (e) { console.warn('baked read failed', key, tier, e.message); stats.misses++; return undefined; } },
    // fetch region files ahead (the load-in): `list` in priority order, a few at a time
    async preload(list, onProgress, conc = 6) { let k = 0, done = 0; const todo = list.filter(([rk, t]) => sets.has(rk + '|' + t));
      await Promise.all(Array.from({ length: conc }, async () => { while (k < todo.length) { const [rk, t] = todo[k++]; try { await load(rk, t); } catch (e) { console.warn('baked preload', rk, t, e.message); } onProgress?.(++done, todo.length); } }));
      return todo.length; },
    // everything the bake has for this time of day, by tier
    regions: tier => Object.keys(index.regions).filter(rk => sets.has(rk + '|' + tier)),
    restarts: () => restarts,
    close() { live = false; for (const s of S) if (s) lost(s, new Error('baked data closed')); } };
}
