// AI City · HOME BUILDER (2026-10-06) · SAVED HOMES: an owner's edited layout, per home id, in this browser. Every storage access is in
// try/catch (a private window, blocked site data or a full quota only means nothing persists: the page works the same without it).
//   load(id, tier)          → { v, home, rev, layout, inv } | null   (null too when the saved layout is for another tier: the home's tier
//                             changed, so its preset changed, and the default (the assembly) stands again)
//   save(id, layout, inv)   → the record (rec.local === false when the browser refused to store it)
//   clear(id)               back to the preset assembly
// The layout is the assembly format (FORMAT.md "Assemblies") plus `fill` on each slot: the owner's piece in it ({ id, variant } | null).
// Pure (no three, no DOM beyond localStorage); index.js reads it when it builds a home, the builder writes it.
const KEY = id => 'aicity.home.v1.' + id;

// ── HOOK · SAVING TO THE SIM OR A SERVER (not built yet). Set REMOTE.save to a function (id, record) → Promise and every save also goes
// there (the local copy is still written first); set REMOTE.load to (id, tier) → record | null and index.js could prefer it over the local
// copy. The sim owns who may write a home: send the owner's token with it (sim2 server, view=owner&handle&token, 2026-10-01 brief §5.6).
export const REMOTE = { save: null, load: null };

export function load(id, tier) {
  try { const s = globalThis.localStorage?.getItem(KEY(id)); if (!s) return null; const r = JSON.parse(s);
    if (!r || r.v !== 1 || !r.layout || !Array.isArray(r.layout.items) || !Array.isArray(r.layout.slots)) return null;
    return tier && r.layout.tier !== tier ? null : r; }
  catch { return null; }
}
export function save(id, layout, inv) {
  const rec = { v: 1, home: id, rev: Date.now(), layout, inv: inv ?? null }; let local = false;
  try { globalThis.localStorage?.setItem(KEY(id), JSON.stringify(rec)); local = !!globalThis.localStorage; } catch {}
  try { const p = REMOTE.save?.(id, rec); if (p?.catch) p.catch(e => console.warn('home builder: remote save failed', e)); } catch (e) { console.warn('home builder: remote save failed', e); }
  return local ? rec : { ...rec, local: false };
}
export function clear(id) { try { globalThis.localStorage?.removeItem(KEY(id)); } catch {} }
