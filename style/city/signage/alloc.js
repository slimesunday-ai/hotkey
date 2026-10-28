// SIGNAGE · the variety allocator (owner: the signage agent). HARD RULE (STYLE.md §12): the same sign design never shows twice
// within ~3 blocks, and never twice in one block; names on shops never repeat inside a block.
//
// How, without any global state (blocks are built in parallel workers, cached one by one, in any order):
//   · every family of designs (roof billboards, wall ads, ghost signs, paste-ups, transit ads, neon words, throw-ups, shop names)
//     is one pool, split into n × n disjoint CLASSES; block (i, j) draws only from class (i mod n, j mod n). Two blocks closer than
//     n blocks in both axes are in different classes, so they can never share a design: n = 4 → nothing repeats within 3 blocks
//     (≥ 96 m apart); roof billboards, which read from far off, use n = 6 (≥ 160 m).
//   · inside a block, draws are without replacement (REG.blk carries the block's used set), so no design shows twice in a block.
//   · blocks of the same class (n apart) walk their class in a different, tile-seeded order, so the city does not tile visibly.
//   · each design scores by the block's district FLAVOUR (downtown · strip · docks · suburbs · uptown · civic), so Neon Row leans to
//     vice and nightlife, the docks to unions and tow, the suburbs to propane and discount, downtown to lawyers, condos, campaigns.
//   · every placed sign is logged (REG.blk.signs → the audit report) and tools/audit.mjs counts repeats as issues (sign-repeat).
//
// THE SWAP (signage pass 4): the lattice keeps a DESIGN from repeating, but the island is big enough that a GAG (a design category:
// every lottery board, whatever its jackpot) came round every few blocks. The census (census.mjs) walks out from the city centre and
// finds every second copy of a gag within its family's view distance (gags.js: roof boards 250 m, the rest 100 m; section 1 keeps
// all of its own). tools/signswap.mjs gives each of those repeats a new gag from the RESERVE (designs.js: new categories the lattice
// never draws) and writes the table to swaps.js, keyed by the sign's identity: block | family | lot | the allocator's own pick.
//   · pick() draws exactly as before, then looks its pick up in the table: a repeat is replaced by a design of its new gag (the first
//     that fits the box and is free in the block); both keys are marked used, so every later draw in the block is what it was.
//     Everything that is not a repeat comes out as it did: same picks, same pixels. Stateless at build time (a static table), so
//     parallel workers in any order get the same city.
//   · ?signswap=0 on the page switches the table off where blocks build on the main thread (report / hash runs): the before of the census.
//   · regenerate after kit changes: census, then the tool, then the census again (SIGNAGE.md, "The swap").
import { REG } from '../audit.js';
import { SWAPS } from './swaps.js';
import { kindAt, distOf, P as PITCH } from '../plan.js';
import { hash } from '../style.js';
import { FLAVOUR } from './lexicon.js';

export const P = PITCH;                                             // block pitch (plan.js P)
export const LAT = { roof: 6, wall: 4, ghost: 4, paste: 4, transit: 4, neon: 4, throw: 4, name: 4 };
export const RADIUS = { roof: 160, wall: 96, ghost: 96, paste: 96, transit: 96, neon: 96, throw: 96, name: 96 };
const mod = (a, n) => ((a % n) + n) % n;
export const blockOf = (x, z) => [Math.floor(x / P), Math.floor(z / P)];
export const flavourAt = (i, j) => { try { return FLAVOUR[distOf(kindAt(i, j))] || 'downtown'; } catch { return 'downtown'; } };
export const classOf = (fam, i, j) => { const n = LAT[fam] || 4; return mod(i, n) + n * mod(j, n); };
export const tileOf = (fam, i, j) => { const n = LAT[fam] || 4; return [Math.floor(i / n), Math.floor(j / n)]; };

// ── per-block state: the block being built (REG.blk) or, outside a build (preview, census), a local table keyed by block
const LOCAL = new Map();
export function state(i, j) {
  const b = REG.blk; if (b && b.i === i && b.j === j) return b.signage ??= { used: new Set() };
  const k = i + ',' + j; let s = LOCAL.get(k); if (!s) LOCAL.set(k, s = { used: new Set() }); return s;
}
export const resetLocal = () => LOCAL.clear();
// the sign log: one record per placed sign (the audit's repeat check and the census read it). r = the family's radius (0: block only)
export const LOG = { out: null };                                // tools may collect here outside a build
export function logSign(fam, key, x, z, extra = {}) {
  const rec = { fam, key: String(key), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r: extra.r ?? RADIUS[fam] ?? 96, group: REG.blk?.group, ...extra };
  if (rec.was === undefined) { const w = REG.blk?.signage?.from?.[rec.key]; if (w !== undefined) rec.was = w; else delete rec.was; }   // (a swapped design logged by any caller: the allocator's own pick)
  const b = REG.blk; if (b) (b.signs ??= []).push(rec); if (LOG.out) LOG.out.push(rec); return rec;
}

// ── a pool: designs → n² disjoint classes. Designs of one flavour are dealt round the classes, so every class holds a share of
// every flavour; a design's `flav` weights say how well it suits each flavour.
export function makePool(fam, designs, seed = 1) {
  const n = LAT[fam] || 4, N = n * n, part = Array.from({ length: N }, () => []), byFl = new Map();
  for (const d of designs) { const f = d.home || 'any'; if (!byFl.has(f)) byFl.set(f, []); byFl.get(f).push(d); }
  // a group (one candidate's posters, one label's campaigns) shares a class, so its designs stay ~3 blocks apart like one design
  const grp = new Map(); let off = 0; for (const list of byFl.values()) { list.forEach((d, k) => { const g = d.grp ? grp.get(d.grp) : undefined; d.cls = g ?? (k + off) % N; if (d.grp && g === undefined) grp.set(d.grp, d.cls); part[d.cls].push(d); }); off += 5; }
  return { fam, n, part, seed, size: designs.length, keys: new Set(designs.map(d => d.key)) };
}
// draw one design for block (i, j): its class only, never one already used in the block, best flavour first (tile-seeded order)
export function pick(pool, i, j, o = {}) {
  const st = state(i, j), c = classOf(pool.fam, i, j), [ti, tj] = tileOf(pool.fam, i, j), fl = o.flavour || flavourAt(i, j), S = pool.part[c];
  if (!S || !S.length) return null;
  // weighted random order without replacement (Efraimidis–Spirakis: key = u^(1/w)), seeded by the tile: the district's flavour leads,
  // yet every category gets its turn, and blocks of the same class in different tiles show different designs
  const score = (d, k) => { const w = Math.max(.08, (d.flav?.[fl] ?? 0) + (d.flav?.any ?? 0)) * (o.boost ? o.boost(d) : 1), u = Math.max(1e-9, hash(ti * 7919 + k * 31 + c, tj * 104729 + 7 + k, pool.seed)); return -Math.pow(u, 1 / w); };
  const order = S.map((d, k) => [d, score(d, k)]).sort((a, b) => a[1] - b[1]);
  for (const [d] of order) { if (st.used.has(d.key) || (d.grp && st.used.has('grp:' + d.grp))) continue; if (o.ok && !o.ok(d)) continue; st.used.add(d.key); if (d.grp) st.used.add('grp:' + d.grp); return swapped(pool.fam, i, j, d, o, st); }
  return null;
}
// o.fit (swap only; the draw above never reads it): the box's words-fit test, given by call sites whose own draw has no fit gate (a last-resort
// tier, a giant roof board), so a swapped-in design is never one whose words the box cannot hold
// ── the swap table (swaps.js): a sign's identity → its new gag (a reserve category id) or, for words (neon, throw-ups, shop names, the
// bodega band, the parking sign), its candidate words in order. RESERVE (filled by designs.js): fam → gag → designs; fam → word → design.
const OFF = (() => { try { return /[?&]signswap=0(&|$)/.test(globalThis.location?.search || ''); } catch { return false; } })();
export const RESERVE = { gag: {}, word: {} };
export const signId = (fam, i, j, orig) => { const b = REG.blk; return b ? `${b.i}_${b.j}|${fam}|${b.group ?? '-'}|${orig}` : `${i}_${j}|${fam}|-|${orig}`; };
export const swapOf = (fam, i, j, orig) => OFF ? undefined : SWAPS[signId(fam, i, j, orig)];
const strHash = s => { let h = 7; for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) | 0; return h; };
function swapped(fam, i, j, d, o, st) {
  const g = swapOf(fam, i, j, d.key); if (!g) return d;
  const L = Array.isArray(g) ? g.map(w => RESERVE.word[fam]?.[w]).filter(Boolean) : RESERVE.gag[fam]?.[g] || [], k0 = Array.isArray(g) ? 0 : Math.floor(hash(i * 131 + j, j * 71 - i, strHash(d.key)) * L.length);
  for (let t = 0; t < L.length; t++) { const r = L[(k0 + t) % L.length]; if (st.used.has(r.key)) continue; if (o.ok && !o.ok(r)) continue; if (o.fit && !o.fit(r)) continue; st.used.add(r.key); (st.from ??= {})[r.key] = d.key; return { ...r, was: d.key }; }
  return d;   // (nothing of its new gag fits here: the census still lists it as a repeat)
}
// a word placed outside a pool (a shop name, a fallback word, the bodega band, the parking sign): its first candidate that fits and is free
export function swapWord(fam, i, j, orig, fits = () => true) { const g = swapOf(fam, i, j, orig); if (!Array.isArray(g)) return null; const st = state(i, j);
  for (const w of g) if (!st.used.has(w) && fits(w)) { st.used.add(w); (st.from ??= {})[w] = orig; return w; } return null; }
// the lot being built (REG.blk.group, 'L<k>'): a shop's name is allocated once per lot (a corner shop shows it on both faces)
export const lotOf = () => REG.blk ? REG.blk.group : null;
// mark a key as used in this block (names placed outside the allocator: override names, hero names)
export const claim = (i, j, key) => state(i, j).used.add(String(key));
export const usedIn = (i, j, key) => state(i, j).used.has(String(key));
