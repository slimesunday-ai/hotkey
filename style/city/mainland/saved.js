// MAINLAND · HOUSE BUILDER (2026-10-06) · SAVED LOTS: an owner's house and yard, per plot id, in this browser. The same contract as the
// city's home builder (interiors/city/saved.js): every storage access in try/catch (a private window or a full quota only means nothing
// persists; the page works the same), and an unedited plot stores nothing, so it keeps its generated look.
//   load(id)             → { v, plot, rev, lot: { house, yard: { edges, paths, items } } } | null
//   save(id, lot)        → the record (rec.local === false when the browser refused to store it)
//   clear(id) · ids()    back to the generated look · every plot this browser has a saved lot for
// The lot format (yard.js): house { style, wall, roof, accent, garage, porch, dormers, hoop, pool, show, car, hx, hz } · yard.edges
// { F, LF, LB, RF, RB, B: { k, c } } · yard.paths [[x, z, material]] (0.5 m cells, lot frame) · yard.items [{ id, v, x, z, r, a? }].
const KEY = id => 'aicity.mainland.lot.v1.' + id, PRE = 'aicity.mainland.lot.v1.';

// ── HOOK · SAVING TO THE SIM OR A SERVER (not built yet). Set REMOTE.save to (id, record) → Promise and every save also goes there (the
// local copy is still written first); REMOTE.load (id) → record | null could be preferred over the local copy by main.js. Who may write a
// plot is the sim's (or the mint's) call: send the owner's token with it, as the city's home builder will.
export const REMOTE = { save: null, load: null };

export const valid = r => !!r && r.v === 1 && !!r.lot && !!r.lot.house && typeof r.lot.house.style === 'string' && !!r.lot.yard && Array.isArray(r.lot.yard.paths) && Array.isArray(r.lot.yard.items) && !!r.lot.yard.edges;
export function load(id) { try { const s = globalThis.localStorage?.getItem(KEY(id)); if (!s) return null; const r = JSON.parse(s); return valid(r) ? r : null; } catch { return null; } }
export function save(id, lot) {
  const rec = { v: 1, plot: id, rev: Date.now(), lot }; let local = false;
  try { globalThis.localStorage?.setItem(KEY(id), JSON.stringify(rec)); local = !!globalThis.localStorage; } catch {}
  try { const p = REMOTE.save?.(id, rec); if (p?.catch) p.catch(e => console.warn('mainland builder: remote save failed', e)); } catch (e) { console.warn('mainland builder: remote save failed', e); }
  return local ? rec : { ...rec, local: false };
}
export function clear(id) { try { globalThis.localStorage?.removeItem(KEY(id)); } catch {} }
export function ids() { const out = []; try { const S = globalThis.localStorage; for (let k = 0; S && k < S.length; k++) { const key = S.key(k); if (key?.startsWith(PRE)) out.push(key.slice(PRE.length)); } } catch {} return out; }
