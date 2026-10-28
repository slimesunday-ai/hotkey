// HUMAN LAYER · SECTION 2b · THE HEAT MAP, THE DATA (pure: no DOM, no three; ui/tools/diarycheck.mjs runs it in node).
// A coarse grid over the island, one value per cell, over a time window, in one of three modes:
//   presence   where people spent their time: every agent's stays and trips (public `move` events, tripsOf)   LIVE ok (positions are public)
//   crimes     where the public crimes happened: robberies, burglaries, arrests, searches, deaths, bounties         LIVE ok (public events)
//   deals      where the deals were made: offers, contracts, sales, fronts, fences, loans, bribes, scams …         TAPE only: many are private
// The lens is enforced here as well as by the caller: `deals` takes events only up to the tape's horizon (none at all with no horizon),
// unless the season is archived; `presence` and `crimes` drop every event that isn't of their public types.
import { tripsOf } from './trails-data.js';

export const HEAT_MODES = ['presence', 'crimes', 'deals'];
export const HEAT_LIVE = { presence: true, crimes: true, deals: false };
export const CRIME_TYPES = new Set(['rob', 'burgle', 'arrest', 'search', 'death', 'bounty']);
export const DEAL_TYPES = new Set(['offer', 'contract', 'sale', 'loan_offer', 'hire_offer', 'hire', 'front', 'fill', 'fence', 'list', 'bid', 'market', 'buy', 'bribe', 'scam', 'loan', 'repay']);
// the island (sim2/places.json spans x -400…330, z -338…390) with a margin; 128 cells of ~6.4 m
export const GRID = { x0: -440, z0: -380, size: 820, n: 128 };

// opt: { mode, from, to, lens: 'live' | 'tape' | 'archive', horizon, pos(placeId) → { x, z } | null, handles (presence: whose), grid }
export function heatOf(events, opt) {
  const G = opt.grid || GRID, n = G.n, cell = G.size / n, v = new Float32Array(n * n), mode = opt.mode, lens = opt.lens || 'live';
  const out = { mode, n, grid: G, values: v, max: 0, count: 0, lens, refused: null };
  if (!HEAT_MODES.includes(mode)) { out.refused = 'unknown mode'; return out; }
  let limit = opt.to;
  if (mode === 'deals' && lens !== 'archive') { if (opt.horizon == null) { out.refused = 'deals are on the tape only, and the tape is pending'; return out; } limit = Math.min(limit, opt.horizon); }
  const add = (x, z, w) => { const i = Math.floor((x - G.x0) / cell), j = Math.floor((z - G.z0) / cell); if (i < 0 || j < 0 || i >= n || j >= n) return; v[j * n + i] += w; out.count++; };
  const from = opt.from, evs = (events || []).filter(e => e && e.t >= from - (mode === 'presence' ? 2 * 1440 : 0) && e.t <= limit);
  if (mode === 'presence') {
    const who = opt.handles || [...new Set(evs.filter(e => e.type === 'move').map(e => e.who))];
    for (const h of who) { const tr = tripsOf(evs, h, from, limit, { lens: 'tape' });   // (positions only; the live cut is a trail's: a heat cell names nobody)
      for (const s of tr.stops) add(s.x, s.z, s.t1 - s.t0 + 1);
      for (const L of tr.legs) { const a = Math.max(L.t0, from), b = Math.min(L.t1, limit), steps = Math.max(1, Math.ceil(Math.hypot(L.x1 - L.x0, L.z1 - L.z0) / cell));
        if (L.taxi) continue; for (let k = 0; k <= steps; k++) { const f = k / steps; add(L.x0 + (L.x1 - L.x0) * f, L.z0 + (L.z1 - L.z0) * f, Math.max(.2, (b - a + 1) / (steps + 1))); } } }
  } else {
    const T = mode === 'crimes' ? CRIME_TYPES : DEAL_TYPES;
    for (const e of evs) { if (e.t < from || !T.has(e.type)) continue; if (mode === 'crimes' && (e.secret)) continue; const p = e.at ? opt.pos?.(e.at) : null; if (p) add(p.x, p.z, mode === 'crimes' && e.type === 'death' ? 3 : 1); }
  }
  // two soft passes (a 3 × 3 box), so a single event reads as a blob, not a pixel; then the 97th percentile is the top
  const tmp = new Float32Array(n * n);
  for (let pass = 0; pass < 2; pass++) { for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= n || y >= n) continue; s += v[y * n + x] * (a || b ? 1 : 2); c += a || b ? 1 : 2; } tmp[j * n + i] = s / c; } v.set(tmp); }
  const nz = []; for (const x of v) if (x > 1e-6) nz.push(x); nz.sort((a, b) => a - b);
  out.max = nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * .97))] : 0; out.upTo = limit;
  return out;
}
