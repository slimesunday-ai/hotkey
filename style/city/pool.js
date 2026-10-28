// Worker pool + source bundle (pass 1c; pass 2: optional modules). The page fetches the job module graph once (jobs.js and everything
// it imports, world/city.js and world/chars.js included) plus every optional module of manifest.js with its own imports, hashes it
// all (the cache key — any code change invalidates cached blocks), and hands the sources to N module workers that instantiate them
// from Blob URLs. The core must load; an optional module that is missing or broken is loaded (and fails) on its own (worker.js).
// Streaming pass: the optional modules are fetched in parallel, here and in the workers. The same hash keys the baked city (cache.js).
import { FROM_RE } from './srcmap.js';
import { SPREAD_Q } from '../../world/city.js';   // (SPREAD: a worker reads the spread from its own URL — world/city.js)
export async function bundleOf(entryUrl, optional = []) {
  const map = new Map(), missing = [];
  const visit = async (url, core) => { if (map.has(url)) return true; map.set(url, '');
    let res = null; try { res = await fetch(url, { cache: 'no-store' }); } catch { res = null; }
    if (!res || !res.ok) { map.delete(url); if (core) throw new Error(`core module missing: ${url} (${res ? res.status : 'network'})`); missing.push(url); return false; }
    const src = await res.text(); map.set(url, src);
    const deps = []; src.replace(FROM_RE, (m, pre, q, spec) => { if (spec.startsWith('.')) deps.push(new URL(spec, url).href); return m; }); await Promise.all(deps.map(d => visit(d, core))); return true; };
  await visit(entryUrl, true);
  const got = await Promise.all(optional.map(o => visit(o.url, false)));   // streaming pass: every optional module at once (they were fetched one after another)
  const ok = optional.filter((o, k) => got[k]); for (const o of optional) if (!ok.includes(o) && !missing.includes(o.url)) missing.push(o.url);
  let h = 0x811c9dc5; for (const [u, s] of [...map].sort((a, b) => a[0] < b[0] ? -1 : 1)) { const t = u.replace(/^.*\/(style|world)\//, '$1/') + s; for (let k = 0; k < t.length; k++) { h ^= t.charCodeAt(k); h = Math.imul(h, 16777619); } }
  return { bundle: [...map], hash: (h >>> 0).toString(36), files: map.size, optional: ok, missing };
}
export function createPool(n, bundle, entryUrl, optional = []) {
  // F09 (audit 2026-10-08) · a worker that died after its init (an uncaught error, a reply it couldn't send) kept its job and its slot:
  // the job's promise never settled (its block never streamed, the load-in never finished) and the pool never had that worker back.
  // Each worker now knows the job it runs. When it dies the job goes back to the front of the queue once (a second death rejects it,
  // and the stream marks that block failed), the worker is terminated and a fresh one takes its slot, at most RESTARTS times over the
  // pool's life. A worker whose init fails still rejects `ready` (the first failure, as before) and gets no replacement (it would fail
  // the same way); a pool with no worker left rejects every job it holds and every new one (they used to wait in the backlog forever).
  const RESTARTS = Math.max(4, n * 2), slots = new Set(), idle = [], waiting = new Map(), backlog = []; let seq = 0, readyN = 0, restarts = 0, down = null;
  const pool = { mods: null }; let readyRes, readyRej; const ready = new Promise((res, rej) => { readyRes = res; readyRej = rej; }); ready.catch(() => {});
  const settle = (id, e, r) => { const p = waiting.get(id); if (!p) return; waiting.delete(id); if (e) p.rej(e); else p.res(r); };
  const pump = () => { while (idle.length && backlog.length) { const s = idle.pop(), it = backlog.shift(); s.job = it; s.w.postMessage({ id: it.id, job: it.job }); } };
  function shut(e) { down ??= e; for (const s of slots) { try { s.w.terminate(); } catch {} } slots.clear(); idle.length = 0;
    for (const it of backlog.splice(0)) settle(it.id, down); for (const id of [...waiting.keys()]) settle(id, down); readyRej(down); }
  function died(s, e) {
    if (!slots.has(s)) return; slots.delete(s); const k = idle.indexOf(s); if (k >= 0) idle.splice(k, 1); try { s.w.terminate(); } catch {} console.error(e.message);
    if (!s.up) readyRej(e); else if (restarts < RESTARTS) { restarts++; spawnWorker(false); }
    const it = s.job; s.job = null; if (it) { if (++it.tries < 2 && slots.size) backlog.unshift(it); else settle(it.id, e); }
    if (!slots.size) shut(new Error('worker pool: no worker left (' + e.message + ')')); else pump(); }
  function spawnWorker(first) {
    const s = { w: new Worker(new URL('./worker.js' + SPREAD_Q, import.meta.url), { type: 'module' }), job: null, up: false }; slots.add(s);
    s.w.onmessage = e => { if (!slots.has(s)) return; const m = e.data;
      if (m.type === 'ready') { if (m.error) { died(s, new Error(m.error)); return; } s.up = true; pool.mods ??= m.mods; idle.push(s); if (first && ++readyN === n) readyRes(); pump(); return; }
      const it = s.job; if (!it || it.id !== m.id) return; s.job = null; idle.push(s); pump(); settle(it.id, m.error ? new Error(m.error) : null, m.r); };
    s.w.onerror = ev => died(s, new Error('worker error: ' + (ev?.message || ev?.type || 'unknown')));
    s.w.onmessageerror = () => died(s, new Error('worker error: a reply could not be read'));
    s.w.postMessage({ type: 'init', bundle, entry: entryUrl, optional }); }
  for (let k = 0; k < n; k++) spawnWorker(true);
  return Object.assign(pool, { ready, n, free: () => Math.max(0, idle.length - backlog.length), busy: () => waiting.size, restarts: () => restarts, alive: () => slots.size,
    exec(job) { const id = ++seq; return new Promise((res, rej) => { if (down) { rej(down); return; } waiting.set(id, { res, rej }); backlog.push({ id, job, tries: 0 }); pump(); }); },
    terminate() { shut(new Error('worker pool terminated')); } });
}
