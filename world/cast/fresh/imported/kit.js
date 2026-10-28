// IMPORTED TRAITS · the adapters (README § Imported traits). Each turns one OLD trait (the old Trait Studio's final draw, kept as
// isolated legacy construction in world/legacy/) into a fresh registry entry: the fresh construction calls `draw` / `fx` / the skin's
// colours exactly as it calls a fresh trait's, and the adapter runs the old code on the fresh grids. One colour scheme per trait: the
// old page's base colours (colourway 0 for a trait with colourways, the draw's defaults otherwise), fixed here, never a parameter.
// An imported file (world/fresh/imported/<slot>.js) imports only this kit, like a fresh file imports only ../kit.js. Nothing fresh
// imports this file or world/legacy/.
import * as LEG from '../../legacy/head.js';
import { MOUTH } from '../kit.js';   // (the mouth zone: never debris)
// the fresh layers (read only: the worn hat's cover, to tell its voxels from hair), loaded lazily: a static import would close a cycle
// through the audit's lib into the registry that is loading this file (index.js has a top-level await)
import * as LAYERS_NS from '../../fit/layers.js'; const LAYERS = LAYERS_NS;   // (sync-cast.mjs: static in the city; the source loads it dynamically)

// the old page's look value for a trait: { id, cw: 0 } with colourways, { id } without (old studio.js baseOf)
const P = id => LEG.NEWI[id] && LEG.NEWI[id].cw ? { id, cw: 0 } : { id };
// the old Grid had text() / textBack() (the trucker's WWW letters); the fresh one doesn't: a view of the same grid with them added
// (every write still goes through the fresh grid's own set, so slot tags, fine detail and the ear-flap rule all apply)
const view = G => { const V = Object.create(G); if (!G.text) { V.text = LEG.Grid.prototype.text; V.textBack = LEG.Grid.prototype.textBack; } return V; };   // (always a view: the passes below override its set / del, never the grid's)
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const copy = (G, F) => G.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = dec(k); F.set(x, y, z, c, li); } });

// ── the face (eyes, rows mouths): the old faceGrid is run on its own grid with only this trait in it (a blank partner for the other
// half), the old face extras chain included (refit-head's laser flare and flat bubble / lollipop, the jewellery grills' stones, the
// Opus and Opus 2 eye and mouth fx), and its cells are copied onto the fresh face grid. The face ctx carries no look, so the old
// "under eyewear the lids lie flat" step never runs: lids and brows meet a frame the fresh way (the frame wins its cells).
const BLANK = '__import_blank';
LEG.EYE[BLANK] = { e: ['.....', '.....', '.....', '.....'], b: ['.....', '.....', '.....'] };
LEG.MOUTH[BLANK] = ['......', '......', '......'];
const oldFace = (sk, eyes, mouth, closed) => LEG.faceGrid(sk, { eyes, mouth, mark: 'none', eyewear: { id: 'none' } }, closed);
// the old eye letters the fresh face grid doesn't know (old chars.js eyeVox), as fresh palette cells [colour, layer, z]
const EYE_PAL = { Q: 0xf2cfcf, R: [0xe0182d, 1], H: [0xffffff, 1], C: [0x2b6cff, 1], G: [0x2ecc40, 1], Y: [0xffd21f, 1], M: [0x8a3cff, 1], O: [0xff8c1a, 1], X: [0xff2424, 3] };
export function eyes(id) { const st = LEG.EYE[id], r = st.r;
  return { rows: st.e, brow: st.b, ...(st.xorder ? { mirror: false } : {}), ...(r ? { right: { rows: r.e, brow: r.b } } : {}), palette: EYE_PAL,
    // the eyes are the first thing on the face grid: clear it and lay the old face's cells (the rows above, plus the old extras)
    fx(F, ctx) { for (const k of [...F.keys()]) F.del(...dec(k)); copy(oldFace(ctx.sk, id, BLANK, ctx.closed), F); } }; }
// a rows mouth (the old 6-wide grid, x −3…2, y 21…19): the fresh letters (K, W, L) draw as before; every other old cell (grills'
// metal and stones, the tongue, the bubble, the lollipop, the septum ring) is laid by fx from the old face. The nose is the fresh one.
export function mouth(id) { const rows = LEG.MOUTH[id];
  return { rows: rows.map(r => r.replace(/[^KWL]/g, '.')),
    fx(F, ctx) { const G = oldFace(ctx.sk, BLANK, id, ctx.closed); G.del(-1, 22, 8); G.del(0, 22, 8); copy(G, F); } }; }

// ── the head slots: the old draw on the fresh head grid
// ── the bridges. The old head drew items straight over whatever was there; the fresh construction keeps the head whole under a hat's
// cover and checks every combination for debris. Four small passes keep the old look and fit the fresh rules (each named in the
// import audit; reference/import/MANIFEST.md lists them):
//   HAIR over the scalp · the old cuts replaced head cells (the head's top row; the afro's whole inside) and ear cells. A hat's cover
//     deletes hair, so that left the head hollow and the ear gone or hanging by a corner under a hat (hat/stick_up_knit's top floated,
//     hat/old_silkrag stood 14 proud of a hollow head, silk_durag × space buns left the ear on a diagonal, bodega_bonnet × y2k straight
//     left door_knockers floating where the ear had been). A hair voxel that would replace a head cell is held back and laid only if
//     you can see it (an open face) and only from y 30 up (the hairline, under every hat's crown; lower it would be a pit under a hat:
//     the afro's lowest edge on the sides and back, 22 cells, and two under y2k straight's jaw stay skin). Ear cells: below.
//   HAT crumbs · a covering hat's cover cuts hair at its rim; where that leaves a bit of hair of 3 voxels or fewer below the rim (fresh
//     cornrows' nape ends under the old beanie, fuzzy bucket and skully: their ear flaps put the rim at y 22) the hat clears it first,
//     unless it is tucked right under the hat's edge (as the compat check counts crumbs).
//   EYEWEAR inlays · a frame or band inlaid in the head (it replaces head cells) is laid only where it shows: hidden under a hat's back
//     panel it changed nothing you see but opened the head (the cat-burglar mask's back band under the durags and the bonnet).
//   EYEWEAR / EAR debris · the old frames lift hair off themselves and the goggles' strap and the headphones' cups overwrite hair; the
//     bits of hair that leaves (3 voxels or fewer, or a loose piece touching nothing) are cleared (old swoop's fringe under the old
//     shutters, the razor fade and the afro's ear-side bits under the goggles' strap). The headphones' cups yield their edge rows (below).
const inHead = (x, y, z) => x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7;
const inEarBox = (x, y, z) => (x === -10 || x === -9 || x === 8 || x === 9) && y >= 23 && y <= 27 && z >= -1 && z <= 1;
const KEY = (x, y, z) => ((x + 256) << 18) | ((y + 256) << 9) | (z + 256), N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// a view that holds back writes over protected cells (`hold(x, y, z)`) and records what the draw wrote and deleted
function recorder(H, hold) { const V = view(H), held = new Map(), own = new Set(), gone = new Set();
  V.set = (x, y, z, c, l) => { if (c === undefined || c === null) return; const X = Math.round(x), Y = Math.round(y), Z = Math.round(z), k = KEY(X, Y, Z);
    if (held.has(k) || (hold && hold(X, Y, Z) && H.has(X, Y, Z))) { held.set(k, [X, Y, Z, c, l]); return; } H.set(x, y, z, c, l); own.add(k); gone.delete(k); };
  V.del = (x, y, z) => { const k = KEY(x, y, z); if (held.has(k)) { held.delete(k); return; } if (H.has(x, y, z)) gone.add(k); H.del(x, y, z); own.delete(k); };
  const open = (x, y, z) => N6.some(([a, b, d]) => !H.has(x + a, y + b, z + d) && !held.has(KEY(x + a, y + b, z + d)));
  return { V, held, own, gone, open, lay: ok => { for (const [x, y, z, c, l] of held.values()) if (ok(x, y, z) && open(x, y, z)) { H.set(x, y, z, c, l); own.add(KEY(x, y, z)); } } }; }
const dk = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
// loose bits next to `seeds`: hair-like cells (not the head, an ear, the mouth zone or the item's own) in pieces of ≤ 3 (`below`: only
// cells under a hat's rim count), and whole pieces of ≤ 24 cells touching nothing else
function clearDebris(H, seeds, own, { below = Infinity, tucked = null, sk = null, hat = null } = {}) {   // (sk: an ear-box cell is the ear only in the skin's colours; hair can lie there · hat: the worn hat's cover)
  const ear = (x, y, z) => inEarBox(x, y, z) && (!sk || [sk.c(x, y, z), sk.sh(x, y, z)].includes(H.get(x, y, z)));
  const other = (x, y, z) => H.has(x, y, z) && !own.has(KEY(x, y, z)) && !inHead(x, y, z) && !ear(x, y, z) && !MOUTH.has(x, y, z) && y < below && !(hat && hat(x, y, z)), done = new Set();
  for (const s of seeds) { const [sx, sy, sz] = dk(s);
    for (const [a, b, d] of [[0, 0, 0], ...N6]) { const x0 = sx + a, y0 = sy + b, z0 = sz + d, k0 = KEY(x0, y0, z0); if (done.has(k0) || !other(x0, y0, z0)) continue;
      const cc = [k0], q = [[x0, y0, z0]], seen = new Set([k0]); let big = false;
      while (q.length && !big) { const [x, y, z] = q.pop(); for (const [e, f, g] of N6) { const k = KEY(x + e, y + f, z + g); if (seen.has(k) || !other(x + e, y + f, z + g)) continue; seen.add(k); cc.push(k); q.push([x + e, y + f, z + g]); if (cc.length > 3) { big = true; break; } } }
      for (const k of seen) done.add(k);
      if (!big && !(tucked && cc.some(k => tucked(...dk(k))))) for (const k of cc) H.del(...dk(k)); } }
  // loose pieces: anything next to a cell the item deleted that no longer reaches the head, an ear or the item
  for (const s of seeds) { const [sx, sy, sz] = dk(s);
    for (const [a, b, d] of N6) { const x0 = sx + a, y0 = sy + b, z0 = sz + d; if (!H.has(x0, y0, z0) || own.has(KEY(x0, y0, z0))) continue;
      const q = [[x0, y0, z0]], seen = new Set([KEY(x0, y0, z0)]); let anchored = false;
      while (q.length && !anchored) { const [x, y, z] = q.pop(); if (inHead(x, y, z) || inEarBox(x, y, z) || own.has(KEY(x, y, z)) || seen.size > 24) { anchored = true; break; }
        for (const [e, f, g] of N6) { const k = KEY(x + e, y + f, z + g); if (!seen.has(k) && H.has(x + e, y + f, z + g)) { seen.add(k); q.push([x + e, y + f, z + g]); } } }
      if (!anchored) for (const k of seen) H.del(...dk(k)); } } }
// the worn hat's cover (world/fit/layers.js, cached by compose before eyewear and ears draw): hair inside it is already gone, so what is
// there is the hat's own voxels, never debris
const hatOf = L => { const id = L && L.hat && L.hat.id; if (!LAYERS || !id || id === 'none') return null; const f = LAYERS.HAT_COVER.get('hat/' + id); return f === 'all' ? () => true : f === 'none' ? null : LAYERS.COVER[id] || null; };
const realHead = H => H.has(0, 26, 0);   // (a hat is also drawn on an empty grid, for its cover: no head, nothing to clean)

// ── the head slots: the old draw on the fresh head grid
// fix(V, ctx): an import fix drawn after the old cut (the hair file says why, per trait)
export const hair = (id, fix) => ({ draw: (H, ctx) => { const R = recorder(H, (x, y, z) => inHead(x, y, z) || inEarBox(x, y, z)); LEG.HAIR[id](R.V, P(id)); if (fix) fix(R.V, ctx);
  // THE EAR stays the ear (a hat's cover deletes hair, and an ear item finds its place on the ear): where a cut took more of an ear than
  // its top row (y2k straight, skate mop and the afro cover it, space buns' sideburns fill its inner column), the ear's cells stay skin
  // and any you could see from the side get the hair one voxel further out instead (the ear under the hair, as fresh cuts do it); a cut
  // that only reaches the ear's top row (a sideburn's last row: buzz, leopard, dreads …) keeps it, so its own row stays whole
  const inner = { [-9]: 0, 8: 0 }; for (const [x, y, z] of R.held.values()) if ((x === -9 || x === 8) && inEarBox(x, y, z)) inner[x]++;
  for (const [x, y, z, c, l] of [...R.held.values()]) { if (!inEarBox(x, y, z)) continue; R.held.delete(KEY(x, y, z));
    if (inner[x < 0 ? -9 : 8] <= 3) { H.set(x, y, z, c, l); continue; }
    const ox = x === -10 ? -11 : x === 9 ? 10 : null; if (ox !== null && !H.has(ox, y, z)) H.set(ox, y, z, c, l); }
  R.lay((x, y, z) => y >= 30); }, ...(LEG.EARS_COVERED.includes(id) ? { coversEars: true } : {}) });
// fix(H, ctx): an import fix drawn after the old hat (the hats file says why, per trait)
const BOX = (x, z) => x >= -9 && x <= 8 && z >= -8 && z <= 8;
export const hat = (id, fix) => ({ draw: (H, ctx) => { const R = recorder(H); LEG.HATS[id](R.V, P(id), ctx.sk); if (fix) fix(R.V, ctx);
    if (!realHead(H) || LEG.OLD_FIXED_COVER[id]) return;
    // the rim the cover will cut at (world/fit/layers.js coverOf: the lowest voxel of the hat's side walls in the head box)
    let rim = Infinity; for (const k of R.own) { const [x, y, z] = dk(k); if (BOX(x, z) && (x === -9 || x === 8 || z === -8 || z === 8)) rim = Math.min(rim, y); }
    if (rim === Infinity) return; const seeds = []; for (const k of H.keys()) { const [x, y, z] = dk(k); if (y === rim - 1 && !R.own.has(k)) seeds.push(k); }
    clearDebris(H, seeds, R.own, { below: rim, tucked: (x, y, z) => R.own.has(KEY(x, y + 1, z)), sk: ctx.sk }); },
  ...(LEG.EARS_COVERED.includes(id) ? { coversEars: true } : {}), ...(LEG.OLD_FIXED_COVER[id] ? { cover: LEG.OLD_FIXED_COVER[id] } : {}), ...(LEG.OLD_FIXED_COVER[id] === 'none' ? { floats: true } : {}) });
export const eyewear = id => ({ draw: (H, ctx) => { const R = recorder(H, inHead); LEG.EYEWEAR[id](R.V, P(id)); R.lay(() => true);
  clearDebris(H, [...R.own, ...R.gone], R.own, { sk: ctx.sk, hat: hatOf(ctx.look) }); } });
// ear items: the old phones were drawn over hats, hair and the no-ear skins (old layers.js showEarItem): fresh `overHat`
// the headphones' cups (x −13…−11 / 10…12, y 21…29) yield their top and bottom rows to hair or a hat already there: cutting through
// those rows left bits of hair at the cups' edges (box braids above and below them; blowout at a bucket's brim, joined only through
// the cup's top row). Everything else is the old draw.
const cupEdge = (x, y) => (y === 21 || y === 29) && (x <= -11 || x >= 10);
export const ears = id => ({ draw: (H, ctx) => { const R = recorder(H, id === 'phones' ? cupEdge : null); LEG.EARS[id](R.V, P(id));
    clearDebris(H, [...R.own, ...R.gone], R.own, { sk: ctx.sk, hat: hatOf(ctx.look) }); },
  ...(id === 'phones' ? { overHat: true } : {}) });

// ── skin: the old skin record (old chars.js skinOf, the Opus skins' per-voxel paints included) as fresh skin fields
// recolour: { old colour: new colour } for the per-voxel colour (an import fix; the skins file says why)
export function skin(id, { recolour } = {}) { const s = LEG.skinOf(id), c = recolour ? ((x, y, z) => { const v = s.c(x, y, z); return recolour[v] ?? v; }) : s.c;
  return { c, sh: s.sh, layer: s.layer, ink: s.ink, brow: s.brow, mouth: s.mouth, lash: s.lash, lip: s.lip, ...(s.noEars ? { noEars: true } : {}),
    ...(s.decorate ? { decorate: (H, ctx) => s.decorate(view(H)) } : {}) }; }

// ── tops: the old top's draw on the fresh body grid, flank and neckline from the old TOPFIT, and the per-trait sleeve fixes
// (imported/tops-kit.js, the tops import’s own module; imported/tops.js says why per trait)
export { top } from './tops-kit.js';
