// GATEHILL · tower facades. A tower shaft is built in 0.2 cubes (STYLE §1: tower shafts); a floor is 15 of them (3.0 m). Each style
// draws one floor of one face on a kit.js frame (a along the wall, y up, d out; d = 0 is the wall's outer skin) and reports its
// windows, so the penthouse floors can hand them to the sim-state layer (lights, zzz cards, FOR RENT, cameras).
//   grid     the pencil: big square windows punched in a flush white grid (Billionaires' Row)
//   deco     piers and gold spandrels (the crowned supertall)
//   stone    pre-war limestone: punched pairs, sills, lintels, belt courses, quoins
//   curtain  a glass wall: mullions every metre, a spandrel band per floor in the tower's colour
//   ribbon   horizontal glass bands between bold spandrels
//   fins     vertical terracotta fins over glass (the feathered pencil)
//   brick    red brick, white lintels, black steel sash
//   diagrid  faceted glass under a diagonal lattice (the Solitaire)
//   loggia   deep recessed bays behind columns and balustrades
//   glassbox the penthouse: double-height glass, thin bronze frames
import { AIR } from '../../kit.js';
import { C, H, TOD } from './lib.js';

export const FL = 15;   // one floor in 0.2 cubes
// glass for a window: day = the tower's tint (dark → light up the pane, a diagonal glint); night = lit (warm) or dark
// the penthouse at night (lit = 'ph'): a hot white cove line along the top of every pane, a chandelier's sparkle under it, then a deep
// gold-amber room, warmer than the office floors' pale lit windows (STYLE §2 lit); every pane of a lit unit is on and the mullions between
// them glow too (PH_LIT.frame), so a lit penthouse reads as one box of light over the sparse office floors
export const PH_LIT = { cove: 0xfff6e0, hi: 0xffd27a, lo: 0xffa53a, chand: 0xffffff, frame: 0xffc45a };   // (office floors: STYLE's #FFC766 → #FFE3A0)
export function glassOf(T) { const tint = GLASS[T.glass || 'blue'] || GLASS.blue; return (w, h, lit) => (u, v) => {
  if (lit === 'ph') { if (v >= h - 2) return PH_LIT.cove; if (h > 12 && v >= h - 6 && v < h - 3 && Math.abs(u - (w - 1) / 2) <= 1) return PH_LIT.chand; return v > h * .45 ? PH_LIT.hi : PH_LIT.lo; }
  if (lit) return v > h * .55 ? C.litHi : C.litLo;
  if (!TOD.night && (u + v === h - 2 || u + v === h - 1) && u < w * .5) return C.glint;
  return v > h * .6 ? tint[1] : tint[0]; }; }
export const GLASS = { blue: [0x1b2a55, 0x3f6bc4], dark: [0x141a33, 0x2b3a66], green: [0x0f4a3c, 0x1f8a6a], bronze: [0x3a2a1c, 0x7a5a36], pink: [0x5a1a3a, 0xc2477f],
  teal: [0x0c4050, 0x1f8fa0], violet: [0x2a1a5a, 0x6a4ad0], sky: [0x1a4a7a, 0x4fa0e0], gold: [0x4a3a14, 0xb08a2a], rose: [0x4a1a28, 0xb04a66] };
// is this window lit tonight? regular floors: about a quarter (luxury towers are famously dark); the caller decides for penthouses
export const litAt = (seed, a, y) => TOD.night && H(seed, a * 7 + 3, y * 13 + 1) < .18;

// a pane: clear the recess (depth voxels, d = 1 − depth … 0), glass one voxel further in; returns the rect
function pane(f, a0, a1, y0, y1, gl, lit, depth = 1) {
  f.box(a0, y0, 1 - depth, a1, y1, 1, AIR); const g = gl(a1 - a0, y1 - y0, lit);
  f.box(a0, y0, -depth, a1, y1, 1 - depth, (a, y) => g(a - a0, y - y0), lit ? 3 : 1); return { a0, a1, y0, y1 }; }
// even bays: n of width bw centred on the face (like kit.js bays), or stretched to fill it exactly (fill = true)
export function bayList(len, bw, fill = false) { const n = Math.max(1, fill ? Math.round(len / bw) : Math.floor(len / bw)); if (fill) return Array.from({ length: n }, (_, k) => [Math.round(k * len / n), Math.round((k + 1) * len / n)]);
  const m = Math.floor((len - n * bw) / 2); return Array.from({ length: n }, (_, k) => [m + k * bw, m + (k + 1) * bw]); }

// ── the styles: (f, y0, fl, o) → [{ a0, a1, y0, y1 }]   o = { T, tier, wall, trim, accent, gl, seed, lit(a, y), top, ph }
export const STYLES = {
  grid(f, y0, fl, o) { const out = [], h = (o.phH || FL) > FL ? o.phH - 4 : 11; for (const [b0, b1] of bayList(f.len, 15, true)) { const w = Math.min(11, b1 - b0 - 3), a = b0 + ((b1 - b0 - w) >> 1); out.push(pane(f, a, a + w, y0 + 2, y0 + 2 + h, o.gl, o.lit(a, y0))); } return out; },
  deco(f, y0, fl, o) { const out = [], L = f.len;
    for (const [b0, b1] of bayList(L, 8, true)) { f.box(b0, y0, 0, b0 + 2, y0 + FL, 2, o.trim); const a0 = b0 + 2, a1 = b1;
      f.box(a0, y0, 0, a1, y0 + 2, 1, o.accent); f.box(a0, y0 + 13, 0, a1, y0 + FL, 1, o.accent); out.push(pane(f, a0, a1, y0 + 2, y0 + 13, o.gl, o.lit(a0, y0))); }
    f.box(L - 2, y0, 0, L, y0 + FL, 2, o.trim); return out; },
  stone(f, y0, fl, o) { const out = [], L = f.len;
    if (fl % 4 === 0) f.box(-1, y0, 0, L + 1, y0 + 1, 2, o.trim);                                                   // belt course
    for (const [b0, b1] of bayList(L - 6, 12)) { const a = 3 + b0 + 3, w = 6; f.box(a - 1, y0 + 2, 0, a + w + 1, y0 + 3, 2, o.trim); f.box(a - 1, y0 + 12, 0, a + w + 1, y0 + 14, 2, o.trim);
      out.push(pane(f, a, a + w, y0 + 3, y0 + 12, o.gl, o.lit(a, y0))); }
    for (let y = y0; y < y0 + FL; y += 3) { const k = ((y / 3) | 0) % 2, w = k ? 2 : 4; f.box(0, y, 0, w, y + 2, 2, o.trim); f.box(L - w, y, 0, L, y + 2, 2, o.trim); }   // quoins
    return out; },
  curtain(f, y0, fl, o) { const out = [], L = f.len; f.box(0, y0, 0, L, y0 + 2, 1, o.wall);
    out.push(pane(f, 0, L, y0 + 2, y0 + FL, o.gl, false)); for (const [b0] of bayList(L, 5, true)) f.box(b0, y0 + 2, 0, b0 + 1, y0 + FL, 2, o.accent);
    // lit bays: some of the metre panes glow at night
    if (TOD.night) for (const [b0, b1] of bayList(L, 5, true)) if (o.lit(b0, y0)) f.box(b0 + 1, y0 + 2, -1, b1, y0 + FL, 0, (a, y) => y > y0 + 9 ? C.litHi : C.litLo, 3);
    f.box(0, y0 + 2, 0, 1, y0 + FL, 2, o.accent); f.box(L - 1, y0 + 2, 0, L, y0 + FL, 2, o.accent); return out; },
  ribbon(f, y0, fl, o) { const out = [], L = f.len; f.box(-1, y0 + 4, 0, L + 1, y0 + 5, 2, o.trim);
    for (const [b0, b1] of bayList(L - 2, 10, true)) { const a0 = b0 + 1, a1 = b1 + 1; out.push(pane(f, a0, a1 - 1, y0 + 5, y0 + 12, o.gl, o.lit(a0, y0))); f.box(a1 - 1, y0 + 5, -1, a1, y0 + 12, 1, C.ink); }
    return out; },
  fins(f, y0, fl, o) { const out = [], L = f.len; f.box(0, y0, 0, L, y0 + 1, 1, o.wall); out.push(pane(f, 0, L, y0 + 1, y0 + FL, o.gl, false));
    if (TOD.night) for (const [b0, b1] of bayList(L, 4, true)) if (o.lit(b0, y0)) f.box(b0 + 1, y0 + 1, -1, b1, y0 + FL, 0, (a, y) => y > y0 + 9 ? C.litHi : C.litLo, 3);
    for (const [b0] of bayList(L, 4, true)) f.box(b0, y0, 0, b0 + 1, y0 + FL, 3, o.accent); f.box(L - 1, y0, 0, L, y0 + FL, 3, o.accent); return out; },
  brick(f, y0, fl, o) { const out = [], L = f.len;
    for (const [b0, b1] of bayList(L - 4, 10)) { const a = 2 + b0 + 2, w = 6; f.box(a - 1, y0 + 12, 0, a + w + 1, y0 + 13, 2, o.trim); f.box(a - 1, y0 + 2, 0, a + w + 1, y0 + 3, 2, o.trim);
      out.push(pane(f, a, a + w, y0 + 3, y0 + 12, o.gl, o.lit(a, y0))); f.box(a, y0 + 7, -1, a + w, y0 + 8, 0, C.ink); f.box(a + 3, y0 + 3, -1, a + 4, y0 + 12, 0, C.ink); }
    if (fl % 5 === 4) f.box(-1, y0 + 14, 0, L + 1, y0 + FL, 2, o.trim); return out; },
  diagrid(f, y0, fl, o) { const out = [], L = f.len; out.push(pane(f, 0, L, y0, y0 + FL, o.gl, false));
    if (TOD.night) for (const [b0, b1] of bayList(L, 5, true)) if (o.lit(b0, y0)) f.box(b0, y0 + 1, -1, b1, y0 + FL - 1, 0, (a, y) => y > y0 + 9 ? C.litHi : C.litLo, 3);
    const P = 20, yb = o.yBase ?? 0; for (let y = y0; y < y0 + FL; y++) for (let a = 0; a < L; a++) { const Y = y - yb; if (((a + Y) % P + P) % P === 0 || ((a - Y) % P + P) % P === 0) f.box(a, y, 0, a + 1, y + 1, 1, o.trim); }
    f.box(0, y0, 0, L, y0 + 1, 1, o.accent); f.box(0, y0, 0, 1, y0 + FL, 1, o.trim); f.box(L - 1, y0, 0, L, y0 + FL, 1, o.trim); return out; },
  loggia(f, y0, fl, o) { const out = [], L = f.len;
    for (const [b0, b1] of bayList(L - 2, 10, true)) { const a0 = b0 + 3, a1 = b1 - 1; out.push(pane(f, a0, a1, y0 + 1, y0 + FL - 1, o.gl, o.lit(a0, y0), 3));
      f.box(a0, y0 + 1, 0, a1, y0 + 2, 1, o.trim); for (let a = a0 + 1; a < a1 - 1; a += 2) f.box(a, y0 + 2, 0, a + 1, y0 + 5, 1, o.trim); f.box(a0, y0 + 5, 0, a1, y0 + 6, 1, o.trim); }
    return out; },
  // the penthouse: double-height glass (two floors = 30), a bronze frame every 4, a transom line; `lit` is the unit's own answer
  glassbox(f, y0, fl, o) { const out = [], L = f.len, h = o.phH || 2 * FL; f.box(0, y0, 0, L, y0 + 2, 2, o.trim);
    let first = null; for (const [b0, b1] of bayList(L - 2, 7, true)) { const a0 = b0 + 1, a1 = b1, on = o.lit(a0, y0); first ??= on; out.push(pane(f, a0, a1, y0 + 2, y0 + h - 1, o.gl, on, 1));
      f.box(a1, y0 + 2, 0, a1 + 1, y0 + h - 1, 1, on === 'ph' ? PH_LIT.frame : o.accent, on === 'ph' ? 3 : 0); }   // (panes 1.2 m: a FOR RENT window card fits)
    f.box(0, y0 + 2, 0, 1, y0 + h - 1, 1, first === 'ph' ? PH_LIT.frame : o.accent, first === 'ph' ? 3 : 0); f.box(0, y0 + h - 1, 0, L, y0 + h, 2, o.trim); return out; },
};
// the far tier's pattern per style (0.5 cubes, 6 rows a floor): (a, r) → 'g' glass · 't' trim · 'x' accent · 0 wall
export const FAR = {
  grid: (a, r) => r >= 1 && r <= 4 && a % 3 !== 2 ? 'g' : 0, deco: (a, r) => a % 3 === 0 ? 't' : (r >= 1 && r <= 4 ? 'g' : 'x'), stone: (a, r) => r >= 2 && r <= 4 && a % 3 === 1 ? 'g' : r === 0 && a % 2 ? 't' : 0,
  curtain: (a, r) => r === 0 ? 0 : a % 2 === 0 ? 'x' : 'g', ribbon: (a, r) => r >= 2 && r <= 4 ? 'g' : r === 1 ? 't' : 0, fins: (a, r) => a % 2 === 0 ? 'x' : 'g', brick: (a, r) => r >= 1 && r <= 4 && a % 2 === 1 ? 'g' : r === 5 && a % 2 ? 't' : 0,
  diagrid: (a, r, y) => ((a + y) % 8 === 0 || ((a - y) % 8 + 8) % 8 === 0) ? 't' : 'g', loggia: (a, r) => a % 2 === 0 ? 't' : (r >= 1 && r <= 4 ? 'g' : 't'), glassbox: (a, r) => a % 2 === 0 ? 'x' : 'g',
};
