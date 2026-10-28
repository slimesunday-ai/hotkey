// LEGACY · THE OLD HEAD (imported 2026-10-02 from deadnet-style-wardrobe, branch opus/wardrobe-diversity @ 4fc5c22, world/chars.js).
// ISOLATED CONSTRUCTION for the imported traits only (world/fresh/imported/, README § Imported traits). Nothing in the fresh
// construction (world/chars.js, world/fit/, world/base-kit.js) or any fresh trait file imports world/legacy/.
//
// What this is: the old chars.js head tables, copied VERBATIM (line ranges below, unedited), then the old install passes run in the
// old order, so every table holds the final draw the old Trait Studio rendered (refit-head's eyewear / hat edges / phones band, the
// jewellery grills, the Opus and Opus 2 faces, the Opus hair and skins). The import adapters (world/fresh/imported/kit.js) call these
// draws on the fresh grids. No three.js, no body, no compose: only what a head trait draws with.
//   chars.js 24–50    helpers, Vox, the old Grid (scratch grids for the install passes; text() for the trucker's letters)
//   chars.js 73–103   SKIN, SPECIES, SCREENS, skinOf
//   chars.js 120–177  the face: EYE, ALIEN_EYE, CLOSED, MOUTH, eyeVox, faceGrid
//   chars.js 178–272  strand, RAINBOW, PINWHEEL, HAIR, HATS, EYEWEAR, EARS
//   chars.js 476–491  NAMES · 497 TIER
//   chars.js 548–632  hash3, cwOf, ICE2, NEWT, NEWI (Drop 02's registry: colourways)
//   chars.js 634–717  Drop 02's hair, hats, eyewear, ears and grills
// Then (chars.js 891–907, the head ones, same order): installJewelry · installOpusFace · installOpus2Face · installHead ·
// installOpusHair · installOpusSkins · installOpus2Skins. (installOpus2Ears is left out: no imported ear trait comes from it.)
import { installJewelry } from './jewelry2.js';
import { installHead } from './fit/refit-head.js';
import { installOpusFace } from './fit/opus-face/face.js';
import { installOpus2Face } from './fit/opus-face-2/face.js';
import { installOpusHair } from './fit/opus-hair/hair.js';
import { installOpusSkins } from './fit/opus-skins/skins.js';
import { installOpus2Skins } from './fit/opus-skins-2/skins.js';
import { EARS_COVERED } from './fit/contract.js';
const S = 1 / 20;
// ───────────────── chars.js 24–50
// ───────────────────────── helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lerpHex = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
const FONT = { D: '110101101101110', K: '101101110101101', W: '101101111111101', '5': '111100111001111', '6': '111100111101111', '0': '111101101101111', '4': '101101111001001' };
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];

class Vox { constructor() { this.m = new Map(); } static k(x, y, z) { return ((x + 256) << 18) | ((y + 256) << 9) | (z + 256); } }
// layers: 0 matte · 1 gloss · 2 metal · 3 lit (screens, lasers). A later write always wins.
class Grid {
  constructor() { this.L = [new Map(), new Map(), new Map(), new Map()]; }
  set(x, y, z, c, l = 0) { if (c === undefined || c === null) return; const k = Vox.k(Math.round(x), Math.round(y), Math.round(z)), li = l === true ? 1 : (l || 0); for (let i = 0; i < 4; i++) if (i !== li) this.L[i].delete(k); this.L[li].set(k, c); }
  del(x, y, z) { const k = Vox.k(x, y, z); for (const M of this.L) M.delete(k); }
  has(x, y, z) { const k = Vox.k(x, y, z); return this.L.some(M => M.has(k)); }
  get(x, y, z) { const k = Vox.k(x, y, z); for (const M of this.L) if (M.has(k)) return M.get(k); }
  *keys() { for (const M of this.L) yield* M.keys(); }
  box(x0, y0, z0, x1, y1, z1, c, l) { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  ell(cx, cy, cz, rx, ry, rz, c, l) { for (let x = Math.floor(cx - rx); x <= cx + rx; x++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - rz); z <= cz + rz; z++)
    if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2 <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, l); }
  bmp(rows, pal, x0, top, z0, z1, l) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c !== undefined) for (let z = z0; z < z1; z++) this.set(x0 + i, top - j, z, c, l); } }); }
  text(s, x, top, z, c, l) { for (const ch of s) { const g = FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') this.set(x + (i % 3), top - ((i / 3) | 0), z, c, l); x += 4; } }
  textBack(s, xr, top, z, c) { let k = 0; for (const ch of s) { const g = FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') this.set(xr - (k * 4 + (i % 3)), top - ((i / 3) | 0), z, c); k++; } }
  frontZ(x, y) { for (let z = 24; z >= -24; z--) if (this.has(x, y, z)) return z; return null; }
  onFront(x, y, c, l, depth = 1) { const z = this.frontZ(x, y); if (z !== null) for (let d = 1; d <= depth; d++) this.set(x, y, z + d, c, l); }
  clip(pred) { for (const M of this.L) for (const k of [...M.keys()]) { const [x, y, z] = dec(k); if (pred(x, y, z)) M.delete(k); } }
  maxY(pred) { let m = -1e9; for (const k of this.keys()) { const [x, y, z] = dec(k); if (pred(x, y, z) && y > m) m = y; } return m; }
}
// ───────────────── chars.js 73–103
// ───────────────────────── skins + rare species (surface and face only; the skeleton never moves)
const SKIN = { pale: 0xf1c9aa, tan: 0xd9a06b, terracotta: 0xc8744a, brown: 0x8a5534, deep: 0x573321 };
const SPECIES = {
  emoji: { c: 0xf5c518, brow: 0x3a2410 },
  noob: { c: 0x9c9ca4 },
  alien: { c: 0x7ed957, noEars: true, alienEyes: true, brow: null, mouth: 0x1d3a12 },
  bsod: { c: 0x0000aa, ink: 0xffffff, brow: 0xffffff, mouth: 0xffffff, lash: 0x000055,
    decorate(H) { const r = mulberry32(14); for (let y = 21; y < 33; y += 2) for (let z = -6; z < 6; z++) { if (r() < .55) H.set(-8, y, z, r() < .3 ? 0xffffff : 0xaaaaaa); if (r() < .55) H.set(7, y, z, r() < .3 ? 0xffffff : 0xaaaaaa); }
      for (let y = 21; y < 33; y += 2) for (let x = -7; x < 7; x++) if (r() < .5) H.set(x, y, -7, 0xaaaaaa); } },
  dialog: { c: 0xc0c0c0, ink: 0x000080, brow: 0x0a0a0a, mouth: 0x0a0a0a,
    decorate(H) { for (let x = -8; x < 8; x++) H.set(x, 33, 7, 0xffffff); for (let y = 22; y < 34; y++) { H.set(-8, y, 7, 0xffffff); H.set(7, y, 7, 0x5e5e5e); }
      for (let x = -7; x < 7; x++) for (const y of [31, 32]) H.set(x, y, 7, lerpHex(0x000080, 0x1084d0, (x + 7) / 13)); for (const x of [2, 4]) H.set(x, 32, 8, 0xc0c0c0); H.set(6, 32, 8, 0xc0c0c0); H.set(6, 31, 8, 0x0a0a0a); } },
  chrome: { c: 0xeef2f7, layer: 2, brow: 0x1a1a1a },
  happymac: { c: 0xdcd3bd, noEars: true, screen: 'happy', decorate(H) { for (let x = 1; x < 6; x++) H.set(x, 20, 7, 0x4a4a4a); H.set(-6, 20, 7, 0x8a8472); } },
  sadmac: { c: 0xcfc6ae, noEars: true, screen: 'sad', decorate(H) { for (let x = 1; x < 6; x++) H.set(x, 20, 7, 0x4a4a4a); } },
  missing: { checker: true, ink: 0xffffff, brow: 0xffffff, mouth: 0xffffff },
};
const SCREENS = {
  happy: { bg: 0xeef2ea, fg: 0x111111, rows: ['............', '...X....X...', '...X....X...', '......X.....', '......X.....', '.....XX.....', '............', '..X......X..', '...XXXXXX...'] },
  sad: { bg: 0x111111, fg: 0xeeeeee, rows: ['............', '..X.X..X.X..', '...X....X...', '..X.X..X.X..', '............', '............', '...XXXXXX...', '..X......X..', '............'] },
};
function skinOf(id) {
  if (SPECIES[id]?.make) return SPECIES[id].make(id);   // (opus skins: a species that paints per voxel builds its own skin; world/fit/opus-skins/)
  const sp = SPECIES[id] ?? {}, base = sp.c ?? SKIN[id] ?? SKIN.tan;
  const ch = (x, y, z) => (((x >> 1) + (y >> 1) + (z >> 1)) & 1);
  const c = sp.checker ? ((x, y, z) => ch(x, y, z) ? 0xff00ff : 0x121212) : (() => base);
  const sh = sp.checker ? ((x, y, z) => ch(x, y, z) ? 0xa300a3 : 0x000000) : (() => shade(base, .8));
  return { id, c, sh, layer: sp.layer ?? 0, ink: sp.ink ?? ((id === 'deep' || id === 'brown') ? 0x0d0d14 : 0x2a1a14), brow: sp.brow === null ? null : (sp.brow ?? 0x22160f),
    mouth: sp.mouth ?? 0x3e211a, lash: sp.lash ?? 0x160f0f, lip: sp.checker ? 0xff66ff : lerpHex(shade(base, .85), 0xd0505a, .35), noEars: !!sp.noEars, alienEyes: !!sp.alienEyes, screen: sp.screen, decorate: sp.decorate };
}

// ───────────────── chars.js 120–177
// ───────────────────────── the face: eyes (5-wide grid, brows per style) + mouth (6-wide grid)
// rows y26→y23; cols outer→inner for the left eye, mirrored for the right unless xorder
const EYE = {
  bored: { e: ['LLLLL', 'WWPPW', 'WWPPW', '.....'], b: ['.....', 'BBBBB', '.....'] },
  sleepy: { e: ['LLLLL', 'LLLLL', 'QQPPQ', '.....'], b: ['.....', 'BBBBB', '.....'] },
  side: { xorder: true, e: ['LLLLL', 'PPWWW', 'PPWWW', '.....'], b: ['.....', 'BBBBB', '.....'], r: { e: ['LLLLL', 'PPWWW', 'PPWWW', '.....'], b: ['BBBBB', '.....', '.....'] } },
  mean: { e: ['LLLLL', 'WWLLL', 'WPPLL', '.....'], b: ['.....', 'BB...', '..BBB'] },
  shook: { e: ['WWWWW', 'WWPPW', 'WWPPW', 'WWWWW'], b: ['BBBBB', '.....', '.....'] },
  crying: { e: ['LLLLL', 'WWPPW', 'WWPPW', '.....'], b: ['.....', '..BBB', 'BB...'], tears: true },
  wink: { e: ['LLLLL', 'WWPPW', 'WWPPW', '.....'], b: ['.....', 'BBBBB', '.....'], r: { e: ['.....', '.KKK.', 'K...K', '.....'], b: ['.....', 'BBBBB', '.....'] } },
  happy: { e: ['.....', '.KKK.', 'K...K', '.....'], b: ['BBBBB', '.....', '.....'] },
  heart: { e: ['.R.R.', 'RHRRR', '.RRR.', '..R..'], b: ['BBBBB', '.....', '.....'] },
  sparkle: { e: ['KKKKK', 'KHKKK', 'KKKHK', '.KKK.'], b: ['.....', '.....', '.....'] },
  cursor: { xorder: true, e: ['WWWWW', 'WKWWW', 'WKKWW', 'WKWWW'], b: ['.....', 'BBBBB', '.....'] },
  beachball: { e: ['WWWWW', 'WCGYW', 'WMORW', 'WWWWW'], b: ['.....', 'BBBBB', '.....'] },
  laser: { e: ['LLLLL', 'XXXXX', 'XXXXX', '.....'], b: ['.....', 'BB...', '..BBB'], laser: true },
};
const ALIEN_EYE = { e: ['KKK..', 'KHKK.', '.KKKK', '...KK'], b: ['.....', '.....', '.....'] };
const CLOSED = ['LLLLL', 'LLLLL', 'KKKKK', '.....'];
const MOUTH = {
  flat: ['......', '.KKKK.', '......'], smirk: ['....K.', '.KKK..', '......'], pout: ['.LLLL.', '.LKKL.', '..LL..'], frown: ['.KKKK.', 'K....K', '......'],
  smile: ['K....K', '.KKKK.', '......'], o: ['..KK..', '..KK..', '......'], tongue: ['.KKKK.', '..TT..', '..TT..'], grimace: ['.KKKK.', 'KWWWWK', '.KKKK.'],
  gum: ['......', '..KK..', '......'], lolli: ['......', '.KKKK.', '......'], grill: ['K....K', '.SSSS.', '......'], gold: ['K....K', '.GGGG.', '......'], iced: ['K....K', '.IIII.', '......'],
};
function eyeVox(F, ch, x, y, sk) {
  const g = sk.alienEyes ? 1 : 0;
  switch (ch) {
    case 'L': F.set(x, y, 8, sk.sh(x, y, 8), sk.layer); F.set(x, y, 7, sk.lash); break;
    case 'W': F.set(x, y, 7, 0xf6f4ef); break; case 'P': F.set(x, y, 7, 0x141013, 1); break; case 'Q': F.set(x, y, 7, 0xf2cfcf); break;
    case 'K': F.set(x, y, 7, 0x141013, g); break; case 'R': F.set(x, y, 7, 0xe0182d, 1); break; case 'H': F.set(x, y, 7, 0xffffff, 1); break;
    case 'C': F.set(x, y, 7, 0x2b6cff, 1); break; case 'G': F.set(x, y, 7, 0x2ecc40, 1); break; case 'Y': F.set(x, y, 7, 0xffd21f, 1); break;
    case 'M': F.set(x, y, 7, 0x8a3cff, 1); break; case 'O': F.set(x, y, 7, 0xff8c1a, 1); break; case 'X': F.set(x, y, 7, 0xff2424, 3); break;
  }
}
function faceGrid(sk, L, closed) {
  const F = new Grid();
  if (sk.screen) { const s = SCREENS[sk.screen]; s.rows.forEach((r, j) => { for (let i = 0; i < 12; i++) F.set(-6 + i, 31 - j, 7, r[i] === 'X' ? s.fg : s.bg, 3); }); return F; }
  const st = sk.alienEyes ? ALIEN_EYE : (EYE[L.eyes] ?? EYE.bored);
  for (const side of [0, 1]) {
    const spec = side === 1 && st.r ? st.r : st, rows = closed ? CLOSED : spec.e, X = i => st.xorder ? (side ? 2 + i : -7 + i) : (side ? 6 - i : -7 + i);
    rows.forEach((r, j) => { for (let i = 0; i < 5; i++) eyeVox(F, r[i], X(i), 26 - j, sk); });
    if (sk.brow !== null) spec.b.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'B') F.set(X(i), 29 - j, 8, sk.brow); });
  }
  if (st.tears) for (const x of [-5, 4]) for (let y = 20; y < 23; y++) F.set(x, y, 8, 0x7fd4ff, 1);
  if (st.laser && !closed) for (const x of [-6, 3]) for (let z = 8; z < 30; z++) { const c = (z & 2) ? 0xff2424 : 0xff8080; F.set(x, 24, z, c, 3); F.set(x + 1, 24, z, c, 3); F.set(x, 25, z, c, 3); F.set(x + 1, 25, z, c, 3); }
  F.set(-1, 22, 8, sk.sh(-1, 22, 8), sk.layer); F.set(0, 22, 8, sk.sh(0, 22, 8), sk.layer);
  const mo = MOUTH[L.mouth] ?? MOUTH.flat;
  mo.forEach((r, j) => { for (let i = 0; i < 6; i++) { const x = -3 + i, y = 21 - j;
    switch (r[i]) { case 'K': F.set(x, y, 7, sk.mouth); break; case 'W': F.set(x, y, 7, 0xf6f4ef); break; case 'T': F.set(x, y, 7, sk.mouth); F.set(x, y, 8, 0xff6b8a, 1); break;
      case 'L': F.set(x, y, 8, sk.lip, 1); if (j === 1) F.set(x, y, 9, sk.lip, 1); break; case 'S': F.set(x, y, 7, 0xe6e9f0, 2); break; case 'G': F.set(x, y, 7, 0xe7bd4a, 2); break; case 'I': F.set(x, y, 7, (x & 1) ? 0xffffff : 0xa8e4ff, 1); break; } } });
  if (mo.fx) mo.fx(F, sk);   // (drop 02: the stones a grill's letters can't paint)
  if (L.mouth === 'pout') { F.set(-1, 20, 8, 0x3a1414); F.set(0, 20, 8, 0x3a1414); }
  if (L.mouth === 'gum') F.ell(-0.5, 20, 10.5, 2.6, 2.6, 2.6, 0xff7ab6, 1);
  if (L.mouth === 'lolli') { for (let x = 2; x < 6; x++) F.set(x, 20, 8, 0xf2f2f2); F.ell(7, 20.5, 8.5, 1.8, 2.3, 1.2, (x, y) => ((x + y) & 1) ? 0xff3b6b : 0xffffff, 1); }
  if (faceGrid.fx) faceGrid.fx(F, sk, L, closed);   // (refit · head: the face's extras under the contract)
  return F;
}

// ───────────────── chars.js 178–272
// ───────────────────────── trait library (each drawn once, against the anchors)
function strand(H, pts, c, t = 3, l = 0) { for (let i = 1; i < pts.length; i++) { const [a, b] = [pts[i - 1], pts[i]], n = Math.max(1, ...[0, 1, 2].map(k => Math.abs(b[k] - a[k])));
  for (let s = 0; s <= n; s++) { const p = a.map((v, k) => Math.round(v + (b[k] - v) * s / n)); H.box(p[0], p[1], p[2], p[0] + t, p[1] + t, p[2] + t, c, l); } } }
const RAINBOW = [0x61bb46, 0xfdb827, 0xf5821f, 0xe03a3e, 0x963d97, 0x009ddc];
const PINWHEEL = [0x2b6cff, 0x2ecc40, 0xffd21f, 0xff8c1a, 0xe0182d, 0x8a3cff];
const HAIR = {
  dreads(H, p) { const A = p.a ?? 0xe9c14d, K = p.b ?? 0x1f1a1a, col = x => x < -0.5 ? A : K, loc = (pts, c) => strand(H, pts, c, 2);
    H.box(-9, 33, -8, 9, 35, 9, x => col(x)); H.box(-9, 27, -8, -8, 33, 6, col(-1)); H.box(8, 27, -8, 9, 33, 6, col(1)); H.box(-9, 22, -8, 9, 33, -7, x => col(x));
    [-8, -5, -2, 1, 4, 6].forEach((x, i) => loc([[x, 35, 3], [x, 36, 6], [x, 34, 9], [x, 31 + (i % 2), 9]], col(x + 1)));
    [-7, -4, -1, 2].forEach((z, j) => { loc([[-10, 34, z], [-12, 29, z], [-13, 22 - (j % 2) * 2, z]], A); loc([[8, 34, z], [10, 29, z], [11, 22 - ((j + 1) % 2) * 2, z]], K); });
    [-8, -5, -2, 1, 4, 6].forEach(x => loc([[x, 34, -9], [x, 28, -11], [x, 21 + (x & 1) * 2, -11]], col(x + 1)));
    loc([[-4, 35, -1], [-5, 40, -4], [-6, 43, -7]], A); loc([[-1, 35, 0], [-1, 41, -2], [0, 44, -5]], K); loc([[2, 35, 1], [4, 40, -1], [5, 42, -3]], K); loc([[-7, 35, 1], [-9, 39, -1]], A); },
  swoop(H, p) { const C = p.c ?? 0x121014, St = p.s ?? 0x2de2e6;
    H.box(-9, 33, -8, 9, 36, 9, C); H.box(-9, 25, -8, -8, 33, 6, C); H.box(8, 25, -8, 9, 33, 6, C); H.box(-9, 21, -9, 9, 34, -7, C);
    for (let x = -9; x <= 3; x++) { const bot = Math.round(24 + (x + 9) * 0.62); for (let y = bot; y < 35; y++) for (const z of [8, 9]) H.set(x, y, z, (x === -5 || x === -4) ? St : C); }
    [[-7, -6], [-3, -7], [1, -6], [4, -5]].forEach(([x, z]) => { for (let k = 0; k < 4; k++) H.box(x, 36 + k, z - k, x + 3, 37 + k, z - k + 3, C); }); },
  spikes(H, p) { const C = p.c ?? 0x3a2616, T = p.t ?? 0xf3e3a0; let i = 0;
    H.box(-9, 33, -8, 9, 35, 8, C); H.box(-9, 28, -8, -8, 33, 4, C); H.box(8, 28, -8, 9, 33, 4, C); H.box(-9, 25, -8, 9, 33, -7, C); H.box(-8, 32, 8, 8, 33, 9, C);
    for (const z of [-6, -2, 2, 5]) for (const x of [-8, -5, -2, 1, 4, 6]) { const h = 3 + ((x * 7 + z * 13 + i++) & 3), ln = z > 3 ? 1 : 0;
      for (let k = 0; k < h; k++) H.box(x, 35 + k, z + Math.round(k * ln * .6), x + 2, 36 + k, z + 2 + Math.round(k * ln * .6), k >= h - 2 ? T : C); } },
  buzz(H, p) { const C = p.c ?? 0xeedb98;
    H.box(-9, 33, -8, 9, 35, 8, C); H.box(-9, 27, -8, -8, 33, 5, C); H.box(8, 27, -8, 9, 33, 5, C); H.box(-9, 24, -8, 9, 33, -7, C); H.box(-8, 32, 8, 8, 33, 9, C);
    for (let z = -6; z < 3; z++) H.del(-9, 30, z); },
  buns(H, p) { const C = p.c ?? 0x151214, A = p.a ?? 0xd8262e;
    H.box(-9, 33, -8, 9, 36, 9, C); H.box(-9, 22, -8, -8, 33, 7, C); H.box(8, 22, -8, 9, 33, 7, C); H.box(-9, 20, -9, 9, 34, -7, C); H.box(-8, 30, 8, 8, 34, 9, C);
    H.ell(-5, 37.5, -1, 3.7, 3.7, 3.7, A); H.ell(5, 37.5, -1, 3.7, 3.7, 3.7, C); },
  afro(H, p) { const C = p.c ?? 0x2a1a12; H.ell(0, 32, -1, 12.5, 9.5, 11.5, (x, y, z) => ((z > 5 && y < 32) || y < 23) ? undefined : C); H.box(-8, 32, 7, 8, 34, 9, C); },
  long(H, p) { const C = p.c ?? 0xc98f3e, D = shade(C, .72);
    H.box(-9, 33, -8, 9, 36, 8, C); for (let z = -7; z < 8; z++) { H.set(-1, 35, z, D); H.set(0, 35, z, D); }
    H.box(-10, 13, -8, -8, 34, 5, C); H.box(8, 13, -8, 10, 34, 5, C); H.box(-10, 13, -10, 10, 34, -7, C);
    H.box(-9, 19, 6, -7, 33, 9, C); H.box(7, 19, 6, 9, 33, 9, C); H.box(-7, 31, 8, 7, 34, 9, C); },
};
const HATS = {
  trucker(H, p) { const F = p.f ?? 0xf4f4f4, M = p.m ?? 0x1d3a8a;
    H.clip((x, y) => y >= 31 && x > -11 && x < 10);
    H.box(-9, 31, -8, 9, 39, 9, (x, y, z) => z === 8 ? F : (((x + y + z) & 1) ? M : shade(M, .55)));
    for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) { H.del(x, 38, z); H.del(x, 37, z); }
    H.box(-8, 31, 9, 8, 32, 16, M); H.box(-1, 39, -1, 1, 40, 1, M); H.text('WWW', -5, 37, 8, M); },
  bucket(H, p) { const C = p.c ?? 0x0a8a8a, Bd = 0x000080;
    H.clip((x, y, z) => y >= 30 && Math.abs(x + .5) <= 11 && Math.abs(z + .5) <= 11);
    H.box(-9, 30, -8, 9, 37, 9, C); for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) H.del(x, 36, z);
    for (let x = -9; x < 9; x++) for (const y of [31, 32]) { H.set(x, y, 8, lerpHex(0x000080, 0x1084d0, (x + 9) / 17)); H.set(x, y, -8, Bd); }
    for (let z = -8; z < 9; z++) for (const y of [31, 32]) { H.set(-9, y, z, Bd); H.set(8, y, z, Bd); }
    for (const x of [4, 6]) H.set(x, 32, 9, 0xc0c0c0); H.set(7, 32, 9, 0xff4040);
    for (let x = -12; x < 12; x++) for (let z = -11; z < 12; z++) { const e = Math.max(Math.abs(x + .5), Math.abs(z + .5)) / 11.5; if (e > .72 && e <= 1) { H.set(x, 29, z, C); if (e > .92) H.set(x, 28, z, C); } } },   // (the brim's edge turns down a row, face-joined)
  balaclava(H, p) { const C = p.c ?? 0x18181b, R = shade(C, 1.35), inside = (x, y, z) => x >= -8 && x < 8 && y >= 19 && y < 34 && z >= -7 && z < 8;
    H.clip((x, y, z) => !inside(x, y, z));
    H.box(-9, 18, -8, 9, 35, 9, (x, y, z) => inside(x, y, z) ? undefined : ((x & 1) ? R : C));
    for (let x = -7; x < 7; x++) for (let y = 23; y < 27; y++) H.del(x, y, 8);
    H.bmp(['.XX.', 'X.XX', 'X.X.', '.XXX'], { X: 0xf2f2f2 }, -7, 33, 8, 9); },
  durag(H, p) { const C = p.c ?? 0x16161a, Sh = shade(C, 1.9), sh = (x, y, z) => ((x * 3 + y * 5 + z * 7) % 9 === 0) ? Sh : C;
    H.clip((x, y) => y >= 30);
    H.box(-9, 33, -8, 9, 35, 8, sh, 1); H.box(-9, 28, -8, -8, 33, 6, sh, 1); H.box(8, 28, -8, 9, 33, 6, sh, 1); H.box(-9, 24, -8, 9, 33, -7, sh, 1); H.box(-8, 30, 8, 8, 33, 9, sh, 1);
    H.box(-3, 27, -10, 3, 30, -8, C, 1); for (let y = 11; y < 27; y++) { const w = Math.round(Math.sin(y * .45)); H.box(-2 + w, y, -10, 2 + w, y + 1, -9, C, 1); } },
  beanie(H, p) { const C = p.c ?? 0xe8742a, D = shade(C, .8);
    H.clip((x, y) => y >= 31); H.box(-9, 31, -8, 9, 34, 9, x => (x & 1) ? D : C); H.box(-8, 34, -7, 8, 37, 8, C); H.box(-6, 37, -5, 6, 38, 6, C); },
  halo(H) { const top = H.maxY((x, y, z) => Math.abs(x + .5) < 9 && Math.abs(z + .5) < 9) + 4;
    for (let a = 0; a < Math.PI * 2; a += .025) { const c = PINWHEEL[Math.floor(((a / (Math.PI * 2)) * 6) % 6)], x = Math.round(-0.5 + 7.5 * Math.cos(a)), z = Math.round(-0.5 + 7.5 * Math.sin(a)); H.set(x, top, z, c, 1); H.set(x, top + 1, z, c, 1); } },
  cursorclip(H) { const top = H.maxY((x, y, z) => Math.abs(x + .5) < 9 && Math.abs(z + .5) < 9);
    H.bmp(['B......', 'BB.....', 'BWB....', 'BWWB...', 'BWWWB..', 'BWWWWB.', 'BWWWWWB', 'BWWBBBB', 'BWB.BWB', 'BB..BWB', 'B....BB'], { B: 0x0a0a0a, W: 0xffffff }, 1, top + 10, -1, 1, 1); },
  fitted(H, p) { const C = p.c ?? 0x151517, St = p.m ?? 0xe7bd4a;
    H.clip((x, y) => y >= 31 && x > -11 && x < 10);
    H.box(-9, 31, -8, 9, 38, 9, C); for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) H.del(x, 37, z); H.box(-8, 38, -7, 8, 39, 8, C); H.box(-1, 39, -1, 1, 40, 1, C);
    H.box(-9, 31, 9, 9, 32, 17, C); H.box(3, 32, 12, 6, 33, 15, St, 2); H.bmp(['.X.', 'X.X', '.X.'], { X: 0xf4f4f4 }, -1, 36, 9, 10); },
  bandana(H, p) { const C = p.c ?? 0xc0272d, pat = (x, y, z) => ((x * 3 + y * 5 + z * 7) % 6 === 0) ? 0xf4f4f4 : C;
    H.clip((x, y) => y >= 30);
    H.box(-9, 30, -8, 9, 35, 9, pat); for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) H.del(x, 34, z); H.box(-8, 35, -7, 8, 36, 8, pat);
    H.box(-2, 29, -10, 2, 32, -8, pat); H.box(-3, 25, -10, -1, 29, -9, pat); H.box(1, 24, -10, 3, 29, -9, pat); },
  beret(H) { H.clip((x, y) => y >= 33);
    H.ell(-1, 34.5, 0, 10.2, 2.6, 9.6, (x, y) => (y - 34.5 - (x + .5) * .14) < 3 ? 0x151515 : undefined); H.box(-1, 37, -1, 1, 39, 1, 0x151515);
    strand(H, [[3, 35, 2], [6, 39, 1], [9, 43, 0]], 0xe0b050, 1); H.box(9, 43, -1, 11, 46, 1, 0x3a2616); H.box(10, 46, -1, 12, 48, 1, 0xd7141a); },
};
const EYEWEAR = {
  shutter(H, p) { const C = p.c ?? 0xf7f7f7;
    for (const x0 of [-7, 1]) { for (let x = x0; x < x0 + 6; x++) for (const y of [23, 25, 27]) H.set(x, y, 8, C, 1); for (let y = 23; y < 28; y++) { H.set(x0, y, 8, C, 1); H.set(x0 + 5, y, 8, C, 1); } }
    H.set(-1, 26, 8, C, 1); H.set(0, 26, 8, C, 1); for (let z = 0; z < 8; z++) { H.set(-9, 26, z, C, 1); H.set(8, 26, z, C, 1); } },
  wrap(H) { const cs = [0x2b6cff, 0x8a3cff, 0xff5ea8, 0xffb03a];
    for (let x = -8; x < 8; x++) { const t = (x + 8) / 15, i = Math.min(2, Math.floor(t * 3)), c = lerpHex(cs[i], cs[i + 1], t * 3 - i); for (let y = 24; y < 27; y++) H.set(x, y, 8, c, 1); H.set(x, 27, 8, 0x111111, 1); }
    for (let z = 2; z < 8; z++) for (let y = 25; y < 27; y++) { H.set(-9, y, z, 0x111111, 1); H.set(8, y, z, 0x111111, 1); } },
  ovals(H) { const K = 0x0c0c0e; H.box(-7, 24, 8, -2, 26, 9, K, 1); H.box(2, 24, 8, 7, 26, 9, K, 1); H.box(-2, 25, 8, 2, 26, 9, K, 1); for (let z = 1; z < 8; z++) { H.set(-9, 25, z, K, 1); H.set(8, 25, z, K, 1); } },
  dwi(H) { const K = 0x0a0a0a; ['XXXXXXXXXXXXXXXX', '.XXXXXX..XXXXXX.', '..XXXX....XXXX..', '...XX......XX...'].forEach((r, j) => { for (let i = 0; i < 16; i++) if (r[i] === 'X') for (const z of [8, 9]) H.set(-8 + i, 27 - j, z, K, 1); });
    for (const [x, y] of [[-6, 26], [2, 26], [-5, 25], [3, 25]]) H.set(x, y, 9, 0xffffff, 1); },
  cursorshades(H) { const K = 0x0a0a0a, rows = ['K....', 'KK...', 'KKK..', 'KKKK.', 'KKKKK'];
    for (const x0 of [-7, 2]) rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'K') H.set(x0 + i, 27 - j, 8, K, 1); });
    H.set(-6, 25, 8, 0xffffff, 1); H.set(3, 25, 8, 0xffffff, 1); H.box(-2, 25, 8, 2, 26, 9, K, 1); for (let z = 1; z < 8; z++) { H.set(-9, 26, z, K, 1); H.set(8, 26, z, K, 1); } },
  anaglyph(H) { const W = 0xf4f4f4; for (let x = -8; x < 8; x++) { H.set(x, 27, 8, W); H.set(x, 23, 8, W); } for (let y = 23; y < 28; y++) for (const x of [-8, -2, 1, 7]) H.set(x, y, 8, W);
    H.box(-7, 24, 8, -2, 27, 9, 0xe0182d, 1); H.box(2, 24, 8, 7, 27, 9, 0x16c8e8, 1); H.box(-1, 24, 8, 1, 27, 9, W); for (let z = 1; z < 8; z++) { H.set(-9, 26, z, W); H.set(8, 26, z, W); } },
};
const EARS = {
  phones(H, p) { const C = p.c ?? 0xd32f2f, K = 0x151515, top = H.maxY((x, y, z) => Math.abs(x + .5) < 4 && z > -6 && z < 6) + 1;
    H.box(-13, 21, -3, -10, 30, 4, C, 1); H.box(10, 21, -3, 13, 30, 4, C, 1); H.box(-10, 22, -2, -9, 29, 3, K); H.box(9, 22, -2, 10, 29, 3, K);
    for (let a = 0; a <= Math.PI; a += 0.02) { const x = -0.5 + 11.5 * Math.cos(a), y = 29 + (top - 29) * Math.sin(a); for (const z of [0, 1]) H.set(Math.floor(x), Math.round(y), z, K, 1); } },
  hoops(H) { for (const x of [-11, 10]) for (const [y, z] of [[23, 1], [22, 0], [22, 1], [22, 2], [21, 2], [20, 2], [20, 1], [20, 0], [21, 0]]) H.set(x, y, z, 0xe7bd4a, 2); },   // (fit layers: a face-connected hoop, hung from the lobe)
  studs(H) { H.set(-11, 23, 1, 0xdff6ff, 1); H.set(10, 23, 1, 0xdff6ff, 1); },
};
// (MARKS: face ink is not imported; the install passes only assign into it)
const MARKS = {};
// ───────────────── chars.js 476–491, 497
const NAMES = {
  skin: { pale: 'pale', tan: 'tan', terracotta: 'terracotta', brown: 'brown', deep: 'deep', emoji: 'emoji yellow', noob: 'noob gray', alien: 'alien', bsod: 'bsod', dialog: 'dialog', chrome: 'chrome', happymac: 'happy mac', sadmac: 'sad mac', missing: 'missing texture' },
  hair: { none: 'none', dreads: 'two-tone dreads', swoop: 'scene swoop', spikes: 'frosted tips', buzz: 'bleached buzz', buns: 'space buns', afro: 'afro', long: 'y2k straight' },
  hat: { none: 'none', trucker: 'WWW trucker', bucket: 'title-bar bucket', balaclava: 'balaclava', durag: 'durag', beanie: 'fisherman beanie', halo: 'beachball halo', cursorclip: 'cursor clip', beret: 'paint beret', fitted: 'flat-brim fitted', bandana: 'bandana' },
  eyes: { bored: 'bored', sleepy: 'sleepy', side: 'side-eye', mean: 'mean', shook: 'shook', crying: 'crying', wink: 'wink', happy: 'happy', heart: 'heart', sparkle: 'sparkle', cursor: 'cursor pupils', beachball: 'beachball pupils', laser: 'laser' },
  eyewear: { none: 'none', shutter: 'shutter shades', wrap: 'wraparounds', ovals: 'matrix ovals', dwi: 'deal with it', cursorshades: 'cursor shades', anaglyph: '3D glasses' },
  mouth: { flat: 'flat', smirk: 'smirk', pout: 'duck-face pout', frown: 'frown', smile: 'smile', o: 'o', tongue: 'tongue', grimace: 'grimace', gum: 'bubblegum', lolli: 'lollipop', grill: 'silver grill', gold: 'gold grill', iced: 'iced grill' },
  mark: { none: 'none', '404': '404 forehead', cmd: 'command-key forehead', tear: 'teardrop', cursor: 'cursor tat', ibeam: 'i-beam tat', bandaid: 'band-aid', blush: 'blush', scar: 'stitched scar', barcode: 'barcode tat' },
  ears: { none: 'none', phones: 'headphones', studs: 'ice studs', hoops: 'gold hoops' },
  top: { hoodie: 'box-logo hoodie', desktop: 'desktop hoodie', puffer: 'puffer', jersey: '56K jersey', tee: 'graphic tee', bsodtee: 'bsod tee', varsity: 'varsity', track: 'rainbow track top', tank: 'ribbed tank', babytee: 'baby tee', jumpsuit: 'county jumpsuit', velour: 'velour tracksuit', flannel: 'flannel over tee' },
  neck: { none: 'none', cursor: 'iced cursor chain', cmd: 'iced command key', padlock: 'https padlock', cuban: 'cuban link', floppy: 'floppy pendant', beachball: 'beachball pendant', rope: 'gold rope', tennis: 'tennis chain', dollar: '$ piece', piece: 'iced medallion', stack: 'stacked chains' },
  bottom: { baggy: 'baggy denim', cargo: 'cargos', track: 'track pants', shorts: 'shorts + tube socks', flares: 'low-rise flares', jumpsuit: 'county pants', camo: 'camo cargos', sweats: 'grey sweats' },
  shoes: { dad: 'dad shoes', hightop: 'cursor high-tops', button: 'button kicks', platinum: 'platinum high-tops', slides: 'slides + socks', foam: 'foam runners', checker: 'checker slip-ons', boots: 'work boots' },
  held: { none: 'none', flip: 'flip phone', ipod: 'mp3 + earbuds', camera: 'disposable camera', can: 'energy drink', mouse: 'ball mouse', floppydisk: 'floppy disk', cash: 'cash stack', duffel: 'duffel bag', spray: 'spray can', crowbar: 'crowbar' },
  acc: { none: 'none', watch: 'iced watch', monitor: 'ankle monitor', crossbody: 'crossbody bag', bandana: 'back-pocket bandana' },
};
const TIER = { emoji: 'rare', noob: 'rare', alien: 'rare', bsod: 'rare', dialog: 'epic', chrome: 'epic', happymac: 'epic', sadmac: '1 of 1', missing: '1 of 1' };
// ───────────────── chars.js 548–632 (NEW_TRAITS, 546–547, is the city roll switch: not needed here)
const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const cwOf = (id, p) => { const l = NEWI[id].cw; return l[((((p && p.cw) | 0) % l.length) + l.length) % l.length]; };
const ICE2 = (x, y, z = 0) => ((x + y + z) & 1) ? 0xffffff : 0xa8e4ff;
const NEWT = {
  hair: {
    braids: ['box braids', 'rare', [['jet / gold cuffs', 0x141214, 0xe7bd4a], ['honey / silver', 0xc9892e, 0xdfe6ee], ['burgundy', 0x5a1420, 0xe7bd4a], ['slime', 0x3fbf3a, 0x151515]]],
    mohawk: ['liberty mohawk', 'common', [['cyan', 0x2de2e6], ['blood', 0xd7141a], ['bleach', 0xf3e3a0], ['toxic', 0x6cf542]]],
    twists: ['two-strand twists', 'common', [['honey tips', 0x1f1714, 0xe0a340], ['natural', 0x1f1714, 0x3a2616], ['bleached tips', 0x1f1714, 0xf3e3a0], ['blue tips', 0x1f1714, 0x2b6cff]]],
    leopard: ['leopard buzz', 'rare', [['bleach', 0xeedb98, 0x2a1c14], ['pink', 0xff9ccb, 0x2a1016], ['lime', 0xc6ff3a, 0x1a2a10]]],
  },
  hat: {
    silkrag: ['silk durag', 'common', [['champagne', 0xe8d3a8], ['royal', 0x2a3fd6], ['blood', 0x9e1020], ['money', 0x1f7a3a]]],
    fuzzbucket: ['fuzzy bucket', 'rare', [['cream sherpa', 0xefe6d2], ['cheetah', 0xd9a441, 0x2a1c14], ['baby pink', 0xf7b6d2], ['lime', 0xb5f542]]],
    holofitted: ['holo-sticker fitted', 'rare', [['bodega green', 0x1f5c3a, 0x9a9aa0, 0xf4f4f4], ['night', 0x151517, 0xd7141a, 0xe7bd4a], ['royal', 0x1d3a8a, 0xff7ab6, 0xf4f4f4], ['cream', 0xefe6d2, 0x3a2616, 0x3a2616]]],
    skully: ['high skully', 'common', [['duck brown', 0x8a5a2b, 0xf4f4f4], ['safety orange', 0xff6a00, 0x151515], ['heather', 0x8e8e94, 0xd7141a], ['black', 0x18181b, 0xe7bd4a]]],
    tiedana: ['knotted bandana', 'common', [['red', 0xc0272d], ['navy', 0x1d3a8a], ['black', 0x151517], ['olive', 0x4a5a3a]]],
  },
  eyewear: {
    shield: ['shield shades', 'rare', [['fire mirror', 0xffd21f, 0xff4d00], ['ice mirror', 0x2de2e6, 0x8a3cff], ['smoke', 0x6a6a74, 0x1a1a1e], ['silver', 0xf4f7fb, 0x8a9099]]],
    tinies: ['tiny ovals', 'common', [['green / gold', 0x1f5c3a, 0xe7bd4a], ['rose / gold', 0xff7ab6, 0xe7bd4a], ['black / silver', 0x0c0c0e, 0xdfe6ee], ['yellow / silver', 0xffd21f, 0xdfe6ee]]],
    goggles: ['ski goggles', 'epic', [['orange mirror', 0xff8c1a, 0x151517, 0x151517], ['blue mirror', 0x2b6cff, 0xf4f4f4, 0xd7141a], ['gold mirror', 0xe7bd4a, 0x151517, 0xf4f4f4], ['pink mirror', 0xff5ea8, 0xf4f4f4, 0x151517]]],
  },
  mouth: { diamond: ['diamond tooth', 'rare'], openface: ['open-face gold', 'rare'], fangs: ['gold fangs', 'epic'], perms: ['gold perms', 'epic'],
    gems: ['sherbet gem grill', 'grail', null, 'Every tooth a different stone: the one grill you can read from across the street.'] },
  ears: {
    earstack: ['ear stack', 'common', [['gold / ice', 0xe7bd4a, 0xa8e4ff], ['silver / ice', 0xdfe6ee, 0xa8e4ff], ['gold / ruby', 0xe7bd4a, 0xe0182d]]],
    cross: ['cross drop', 'common', [['gold', 0xe7bd4a, 2], ['silver', 0xdfe6ee, 2], ['iced', 0xa8e4ff, 1]]],
    icestud: ['princess-cut studs', 'rare', [['yellow gold', 0xe7bd4a], ['white gold', 0xdfe6ee], ['rose gold', 0xe8a0a0]]],
  },
  neck: {
    pearls: ['pearl strand', 'rare', [['white', 0xf4efe4], ['black pearl', 0x3a3a46], ['pink', 0xf7c9d8]]],
    choker: ['iced choker', 'rare', [['ice', 0], ['onyx / gold', 1]]],
    catpiece: ['bodega-cat piece', 'epic', [['gold / emerald', 0xe7bd4a, 0x2ecc40], ['white gold / sapphire', 0xdfe6ee, 0x2b6cff], ['rose / ruby', 0xe8a0a0, 0xe0182d]]],
    icecuban: ['iced cuban', 'grail', [['yellow gold', 0xe7bd4a], ['white gold', 0xdfe6ee], ['rose gold', 0xe8a0a0]], 'Thick enough that the whole block clocks it: the chain robbers look for first.'],
    cuffs: ['iced handcuffs', 'grail', [['ice / gold', 'ice', 0xe7bd4a], ['all gold', 0xe7bd4a, 0xe7bd4a], ['blacked out', 0x1e1e22, 0x9aa0a6]], 'Crime-world humour you have to be rich to wear: iced cuffs hanging off a Cuban.'],
  },
  top: {
    catee: ['bodega-cat tee', 'common', [['white', 0xf2f2f2], ['heather', 0xb8b8bc], ['deli yellow', 0xffe23a]]],
    tapetee: ['caution-tape tee', 'common', [['black', 0x151517], ['white', 0xf2f2f2], ['grey', 0x6f6f74]]],
    dyehoodie: ['tie-dye hoodie', 'common', [['cotton candy', 0xff7ab6, 0x7cc3ff, 0xfff1a8], ['toxic', 0x6cf542, 0x151517, 0x2de2e6], ['sunset', 0xff7a1a, 0xd7141a, 0xffd21f], ['ice dye', 0xdfe6ee, 0x8e8e94, 0xffffff]]],
    trackjkt: ['track jacket', 'common', [['navy / white', 0x1b2a4a, 0xf2f2f2, 0xd7141a], ['green / gold', 0x0a5a3a, 0xe7bd4a, 0xf2f2f2], ['black / pink', 0x151517, 0xff7ab6, 0xf2f2f2], ['burgundy / sky', 0x6e1f3a, 0x7cc3ff, 0xf2f2f2]]],
    bball: ['04 mesh jersey', 'common', [['home white', 0xf2f2f2, 0x1d3a8a], ['away green', 0x0a5a3a, 0xf2f2f2], ['city black', 0x151517, 0xe7bd4a], ['pink', 0xff7ab6, 0x151517]]],
    buffalo: ['buffalo-check overshirt', 'common', [['red', 0xc0272d], ['blue', 0x1d4ed8], ['green', 0x0a5a3a], ['pink', 0xff7ab6]]],
    bootleg: ['bootleg rap tee', 'rare', [['black', 0x151517], ['vintage wash', 0x3a3a40], ['white', 0xf2f2f2]]],
    slabtee: ['graded-slab tee', 'rare', [['white', 0xf2f2f2], ['black', 0x151517], ['cream', 0xefe6d2]]],
    chenille: ['chenille varsity', 'rare', [['forest / cream', 0x0a5a3a, 0xefe6d2, 0xe7bd4a], ['black / black', 0x151517, 0x1e1e22, 0xd7141a], ['royal / white', 0x1d3a8a, 0xf2f2f2, 0xf2f2f2], ['pink / cream', 0xff7ab6, 0xefe6d2, 0x151517]]],
    bubble: ['bubble puffer', 'epic', [['chrome', 0xdfe6ee, 2], ['wet black', 0x151517, 1], ['safety orange', 0xff6a00, 1], ['slime', 0x9cff3a, 1]]],
    leather: ['moto leather', 'epic', [['black', 0x121214, 0xd8d8d8], ['oxblood', 0x4a0d14, 0xe7bd4a], ['brown', 0x5a3520, 0xe7bd4a], ['white', 0xe9e6de, 0x9aa0a6]]],
    furcoat: ['fur coat', 'grail', [['mink', 0x5a3a26, 0x7a5236], ['white fox', 0xf1ede4, 0xd8d2c4], ['leopard', 0xd9a441, 0xc28a2e, 0x2a1c14], ['hot pink', 0xff5ea8, 0xff9ccb]], 'The boss coat: you only wear fur on this street if nobody can take it off you.'],
  },
  bottom: {
    bigjeans: ['stacked jeans', 'common', [['raw indigo', 0x23355e], ['light wash', 0x9bb8dd], ['black wash', 0x2c2c30], ['painter', 0x9bb8dd, [0xff4fa3, 0xffd21f, 0x2de2e6, 0xf2f2f2]]]],
    parachute: ['parachute cargos', 'common', [['black', 0x151517, 0xf2f2f2], ['olive', 0x4a5a3a, 0xff6a00], ['silver', 0xbfc3c9, 0x151517], ['orange', 0xff6a00, 0x151517]]],
    snaps: ['snap pants', 'common', [['black / white', 0x151517, 0xf2f2f2], ['royal / white', 0x1d3a8a, 0xf2f2f2], ['red / white', 0xc0272d, 0xf2f2f2], ['green / gold', 0x0a5a3a, 0xe7bd4a]]],
    meshshorts: ['mesh shorts + long socks', 'common', [['black / red', 0x151517, 0xd7141a, 0xf4f4f4], ['royal / white', 0x1d3a8a, 0xf2f2f2, 0xf4f4f4], ['mint / green', 0x9fe3c7, 0x0a5a3a, 0xf4f4f4], ['purple / gold', 0x5a2bd6, 0xe7bd4a, 0x151515]]],
    digicamo: ['digi camo cargos', 'rare', [['urban', [0x8e8e94, 0x5e5e64, 0x2e2e33, 0xc9ced4]], ['desert', [0xc8b58a, 0x9a8456, 0x6b5a3a, 0xe0d2ac]], ['pink', [0xff9ccb, 0xff5ea8, 0xc2185b, 0xffd1e3]], ['night', [0x1b2a4a, 0x2e3f6b, 0x0d1424, 0x4a5f8a]]]],
    doubleknee: ['double-knee carpenters', 'rare', [['duck brown', 0x8a5a2b], ['black', 0x1e1e20], ['washed moss', 0x5a6b4a], ['stone', 0xb8b0a0]]],
  },
  shoes: {
    courtlow: ['court lows', 'common', [['white / green', 0x0a5a3a], ['white / red', 0xd7141a], ['white / navy', 0x1d3a8a], ['triple black', 0x151517, 0x151517]]],
    lugboot: ['lug-sole boots', 'common', [['black / yellow stitch', 0x141414, 0xffd21f], ['brown', 0x4a2e1a, 0xe7bd4a], ['cherry', 0x5a0d18, 0xefe6d2]]],
    chunky: ['chunky runners', 'rare', [['triple white', 0xf4f4f4, 0xdcdcdc, 0xefe9dc], ['sail / volt', 0xefe9dc, 0xc6ff3a, 0x9aa0a6], ['black ice', 0x1a1a1e, 0x7cc3ff, 0x2a2a2e], ['bodega', 0xefe6d2, 0xd7141a, 0x0a5a3a]]],
    furslide: ['fur slides + socks', 'rare', [['cream', 0xefe6d2, 0xf6f6f6], ['pink', 0xff9ccb, 0xf6f6f6], ['brown', 0x6b4a2e, 0x151515], ['leopard', 0xd9a441, 0xf6f6f6, 0x2a1c14]]],
    courtking: ['court kings', 'epic', [['night shift', 0x151517, 0xd7141a], ['cop car', 0x151517, 0x1d4ed8], ['money', 0x0a5a3a, 0xe7bd4a], ['royal', 0x1d4ed8, 0x151517]]],
    clogs: ['platform clogs', 'epic', [['taupe suede', 0x8a7a66], ['black', 0x1a1a1a], ['lilac', 0xb9a3e3], ['mustard', 0xd9a441]]],
    chromes: ['liquid chromes', 'grail', [['liquid silver', 0xdfe6ee], ['24k', 0xe7bd4a], ['oil slick', [0x8a3cff, 0x2b6cff, 0x2de2e6, 0x6cf542, 0xffd21f, 0xff5ea8]], ['gunmetal', 0x5a5e68]], 'Liquid-chrome high-tops: the sneaker the drop only ever sells one of.'],
  },
  acc: {
    digital: ['digital watch', 'common', [['black / green lcd', 0x151517, 0x9cff7a], ['white / blue lcd', 0xf2f2f2, 0x7cc3ff], ['olive / orange lcd', 0x4a5a3a, 0xff8c1a], ['jelly', 0xbfe8ff, 0xff7ab6]]],
    rings: ['ring stack', 'rare', [['gold', 0xe7bd4a, 0xe0182d], ['silver', 0xdfe6ee, 0x2b6cff], ['gold / ice', 0xe7bd4a, 0xa8e4ff]]],
    sling: ['chest sling', 'rare', [['black nylon', 0x151517, 0xd8d8d8], ['monogram', 0x6b4a2e, 0xe7bd4a, 0xd9b27a], ['reflective', 0xbfc3c9, 0x151517], ['orange', 0xff6a00, 0x151517]]],
    pinky: ['iced pinky ring', 'epic', [['gold', 0xe7bd4a], ['white gold', 0xdfe6ee], ['rose gold', 0xe8a0a0]]],
    bustdown: ['bust-down watch', 'grail', [['yellow gold', 0xe7bd4a], ['white gold', 0xdfe6ee], ['rose gold', 0xe8a0a0]], 'Fully iced watch and tennis bracelet: the wrist that says you already won.'],
  },
  held: {
    phonecase: ['phone in a case', 'common', [['chrome', 0xdfe6ee, 2], ['pink bear', 0xff9ccb, 1], ['cheetah', 0xd9a441, 1, 0x2a1c14], ['cash clear', 0xbfe8ff, 1, 0x5fa84a]]],
    bodegabag: ['bodega bag', 'common', [['thank-you white', 0xf4f4f4, 0xd7141a], ['black', 0x151517, 0xf4f4f4], ['deli yellow', 0xffe23a, 0xd7141a]]],
    kicksbox: ['sneaker box', 'rare', [['orange', 0xff7a1a, 0xff7a1a, 0x151517], ['black / gold', 0x151517, 0x151517, 0xe7bd4a], ['teal', 0x0a8a8a, 0xf2f2f2, 0x151517]]],
    bricks: ['cash bricks', 'epic', [['red bands', 0xd7141a], ['mustard straps', 0xd9a441], ['purple straps', 0x5a2bd6]]],
    vinyl: ['1/1 chase vinyl', 'grail', [['chase chrome', 0xdfe6ee, 2, 0x111111], ['bubblegum', 0xff7ab6, 1, 0x111111], ['glow', 0x9cff7a, 3, 0x1a3a12], ['black / gold', 0x151517, 1, 0xe7bd4a]], 'The 1/1 chase figure of a big-head: collector culture\'s grail, carried like a trophy.'],
  },
};
const NEWI = {};   // id → { id, slot, name, tier, cw, why, new: true } (the new ids are unique across every slot, old and new)
for (const [s, o] of Object.entries(NEWT)) for (const [k, [name, tier, cw, why]] of Object.entries(o)) { NEWI[k] = { id: k, slot: s, name, tier, cw: cw || null, why: why || null, new: true }; NAMES[s][k] = name; }
const isNewTrait = (s, k) => !!(NEWT[s] && NEWT[s][k]);
// ───────────────── chars.js 634–717
// ── hair (H; clipped by hats above y 30/31 like the rest)
Object.assign(HAIR, {
  braids(H, p) { const [, C, Bd] = cwOf('braids', p), D = shade(C, .62), row = (x, y, z) => ((x + 9) % 3 === 0 || (z + 8) % 4 === 0) ? D : C;
    H.box(-9, 33, -8, 9, 35, 9, row); H.box(-9, 27, -8, -8, 33, 6, C); H.box(8, 27, -8, 9, 33, 6, C); H.box(-9, 22, -8, 9, 33, -7, C); H.box(-8, 32, 8, 8, 33, 9, row);
    const braid = (x, z, y0) => { for (let y = y0; y < 33; y++) { const cuff = y === y0 + 1 || y === y0 + 6; H.box(x, y, z, x + 2, y + 1, z + 2, cuff ? Bd : ((y & 1) ? C : D), cuff ? 2 : 0); } };
    for (const z of [-7, -4, 2]) { braid(-11, z, 18 + (z & 1)); braid(9, z, 19 - (z & 1)); }
    for (let x = -8; x < 8; x += 3) braid(x, -10, 10 + ((x + 8) % 2) * 2); },
  mohawk(H, p) { const [, C] = cwOf('mohawk', p), R = shade(C, .5);
    H.box(-3, 33, -8, 3, 35, 9, R);
    for (let z = -8; z < 9; z++) { const h = 3 + Math.round(4 * Math.sin((z + 9) / 18 * Math.PI)) + ((z & 1) ? 0 : 1);
      for (let k = 0; k < h; k++) { const zz = z + (k > 2 ? 1 : 0); H.box(-2, 35 + k, zz, 2, 36 + k, zz + 1, k < 1 ? R : C); } } },
  twists(H, p) { const [, C, T] = cwOf('twists', p), D = shade(C, .8);
    H.box(-9, 33, -8, 9, 35, 9, C); H.box(-9, 26, -8, -8, 33, 6, C); H.box(8, 26, -8, 9, 33, 6, C); H.box(-9, 22, -8, 9, 33, -7, C); H.box(-8, 31, 8, 8, 33, 9, C);
    const tw = (x, y0, y1, z0, z1, tipLow) => H.box(x, y0, z0, x + 2, y1, z1, (xx, y) => (tipLow ? y === y0 : y === y1 - 1) ? T : ((y & 1) ? C : D));
    for (let z = -7; z < 8; z += 3) for (let x = -8; x < 8; x += 3) tw(x, 35, 37 + ((x * 5 + z * 3) & 1), z, z + 2, false);
    for (let z = -7; z < 6; z += 3) { tw(-11, 25, 33, z, z + 2, true); tw(9, 25, 33, z, z + 2, true); }
    for (let x = -8; x < 8; x += 3) { tw(x, 21, 33, -10, -8, true); tw(x, 30, 33, 9, 11, true); } },
  leopard(H, p) { const [, C, K] = cwOf('leopard', p), M = shade(C, .78), spot = (x, y, z) => { const h = hash3(x >> 2, y >> 2, z >> 2), cx = (x >> 2) * 4 + (h & 3), cy = (y >> 2) * 4 + ((h >> 2) & 3), cz = (z >> 2) * 4 + ((h >> 4) & 3), d = Math.abs(x - cx) + Math.abs(y - cy) + Math.abs(z - cz);
      return d === 0 ? M : d <= 1 ? K : C; };
    H.box(-9, 33, -8, 9, 35, 8, spot); H.box(-9, 27, -8, -8, 33, 5, spot); H.box(8, 27, -8, 9, 33, 5, spot); H.box(-9, 24, -8, 9, 33, -7, spot); H.box(-8, 32, 8, 8, 33, 9, spot); },
});
// ── hats (H; each clips the hair where it sits, like the hats above)
Object.assign(HATS, {
  silkrag(H, p) { const [, C] = cwOf('silkrag', p), Lt = shade(C, 1.5), D = shade(C, .66), sh = (x, y, z) => ((x + y * 2 + z) % 7 === 0) ? Lt : (((x * 2 + y + z) % 9 === 0) ? D : C);
    H.clip((x, y) => y >= 30);
    H.box(-9, 33, -8, 9, 35, 9, sh, 1); H.box(-9, 27, -8, -8, 33, 7, sh, 1); H.box(8, 27, -8, 9, 33, 7, sh, 1); H.box(-9, 23, -8, 9, 33, -7, sh, 1); H.box(-8, 30, 8, 8, 33, 9, sh, 1);
    for (let z = -8; z < 9; z++) { H.set(-1, 35, z, D, 1); H.set(0, 35, z, D, 1); }
    H.box(-4, 25, -10, 4, 30, -8, sh, 1);
    for (let y = 7; y < 25; y++) { const w = Math.round(Math.sin(y * .38) * 1.4); H.box(-5 + w, y, -10, -1 + w, y + 1, -9, sh(0, y, 0), 1); if (y > 9) H.box(1 - w, y, -10, 5 - w, y + 1, -9, sh(1, y, 1), 1); } },
  fuzzbucket(H, p) { const [, C, K] = cwOf('fuzzbucket', p), fz = (x, y, z) => { const h = hash3(x, y, z); if (K !== undefined && h % 7 < 2) return K; return (h & 4) ? C : shade(C, .88); };
    H.clip((x, y, z) => y >= 30 && Math.abs(x + .5) <= 11 && Math.abs(z + .5) <= 11);
    H.box(-9, 30, -8, 9, 37, 9, fz); for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) H.del(x, 36, z); H.box(-8, 37, -7, 8, 38, 8, fz);
    for (let y = 31; y < 36; y++) for (let k = -8; k < 9; k++) { if (hash3(k, y, 1) % 4 === 0) H.set(-10, y, k, fz(-10, y, k)); if (hash3(k, y, 2) % 4 === 0) H.set(9, y, k, fz(9, y, k));
      if (hash3(y, k, 3) % 4 === 0) H.set(k, y, 9, fz(k, y, 9)); if (hash3(y, k, 4) % 4 === 0) H.set(k, y, -9, fz(k, y, -9)); }
    for (let x = -12; x < 12; x++) for (let z = -11; z < 12; z++) { const e = Math.max(Math.abs(x + .5), Math.abs(z + .5)) / 11.5; if (e > .72 && e <= 1) { H.set(x, 29, z, fz(x, 29, z)); if (e > .92) H.set(x, 28, z, fz(x, 28, z)); } }
    H.box(9, 31, 2, 10, 33, 5, 0xf4f4f4); H.set(9, 32, 3, 0x151515); },
  holofitted(H, p) { const [, C, U, Lg] = cwOf('holofitted', p);
    H.clip((x, y) => y >= 31 && x > -11 && x < 10);
    H.box(-9, 31, -8, 9, 38, 9, C); for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) H.del(x, 37, z); H.box(-8, 38, -7, 8, 39, 8, C); H.box(-1, 39, -1, 1, 40, 1, C);
    H.box(-9, 31, 9, 9, 32, 17, C); H.box(-8, 30, 9, 8, 31, 16, U);
    for (let x = 1; x < 6; x++) for (let z = 11; z < 16; z++) { if ((x === 1 || x === 5) && (z === 11 || z === 15)) continue; H.set(x, 32, z, [0xc8f0ff, 0xffc8f0, 0xfff4b0, 0xc8ffd8][(x + z) & 3], 1); }
    H.bmp(['X...X', 'XX.XX', 'XXXXX', 'X.X.X', 'XXXXX', '.XXX.'], { X: Lg }, -3, 37, 9, 10);
    for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) H.set(-10, 34 + dy, dz, 0xe7bd4a, 2); },
  skully(H, p) { const [, C, Tg] = cwOf('skully', p), D = shade(C, .76);
    H.clip((x, y) => y >= 32);
    H.box(-9, 32, -8, 9, 35, 9, x => (x & 1) ? D : C); H.box(-9, 35, -8, 9, 36, 9, shade(C, .66)); H.box(-8, 36, -7, 8, 37, 8, x => (x & 1) ? D : C); H.box(-6, 37, -5, 6, 38, 6, D);
    H.box(-2, 33, 9, 2, 35, 10, Tg); H.set(-1, 34, 9, 0x151515); H.set(0, 34, 9, 0x151515); },
  tiedana(H, p) { const [, C] = cwOf('tiedana', p), pat = (x, y, z) => { const m = ((x * 5 + y * 3 + z * 7) % 13 + 13) % 13; return m === 0 || m === 6 ? 0xf4f4f4 : m === 3 ? 0x151515 : C; };
    H.clip((x, y) => y >= 30);
    H.box(-9, 30, -8, 9, 35, 9, pat); for (const [x, z] of [[-9, -8], [8, -8], [-9, 8], [8, 8]]) H.del(x, 34, z); H.box(-8, 35, -7, 8, 36, 8, pat);
    H.box(-2, 31, 9, 2, 34, 11, pat); H.box(-4, 33, 9, -2, 35, 10, pat); H.box(2, 33, 9, 4, 35, 10, pat); H.set(-5, 35, 9, C); H.set(4, 35, 9, C); },
});
// ── eyewear (H, over the face at z 8)
Object.assign(EYEWEAR, {
  shield(H, p) { const [, A, Bc] = cwOf('shield', p);
    for (let x = -9; x < 9; x++) for (let y = 23; y < 28; y++) { if (y === 23 && x > -3 && x < 2) continue; H.set(x, y, 8, lerpHex(Bc, A, (y - 23) / 4), 2); }
    for (let x = -8; x < 8; x++) H.set(x, 28, 8, 0x111111, 1);
    for (let z = 2; z < 8; z++) for (const y of [26, 27]) { H.set(-9, y, z, 0x111111, 1); H.set(8, y, z, 0x111111, 1); } },
  tinies(H, p) { const [, Ln, F] = cwOf('tinies', p);
    for (const x0 of [-6, 3]) { H.box(x0, 24, 8, x0 + 3, 26, 9, Ln, 1);
      for (const y of [24, 25]) { H.set(x0 - 1, y, 8, F, 2); H.set(x0 + 3, y, 8, F, 2); } for (let x = x0; x < x0 + 3; x++) { H.set(x, 26, 8, F, 2); H.set(x, 23, 8, F, 2); } }
    for (let x = -2; x < 2; x++) H.set(x, 25, 8, F, 2);
    for (let z = 1; z < 9; z++) { H.set(-9, 25, z, F, 2); H.set(8, 25, z, F, 2); } H.set(-8, 25, 8, F, 2); H.set(7, 25, 8, F, 2); },
  goggles(H, p) { const [, A, Fr, St] = cwOf('goggles', p);
    for (let x = -9; x < 9; x++) for (let y = 22; y < 29; y++) H.set(x, y, 8, Fr, 1);
    H.del(-1, 22, 8); H.del(0, 22, 8);
    for (let x = -8; x < 8; x++) for (let y = 23; y < 28; y++) if (!(y === 23 && x > -3 && x < 2)) H.set(x, y, 9, lerpHex(shade(A, .55), A, (y - 23) / 4), 2);
    for (let y = 24; y < 28; y++) { const c = (y === 25 || y === 26) ? St : shade(St, .7); for (let z = -8; z < 9; z++) { H.set(-9, y, z, c); H.set(8, y, z, c); } for (let x = -9; x < 9; x++) H.set(x, y, -8, c); } },   // flush on the head (the hair's own shell)
});
// ── ears (H; skipped where there is no ear to hang from: the no-ear species, a balaclava)
Object.assign(EARS, {
  earstack(H, p) { const [, A, Bc] = cwOf('earstack', p);
    for (const [x, e] of [[-11, -10], [10, 9]]) { if (!H.has(e, 24, 0)) continue; H.set(x, 22, 1, A, 2); H.set(x, 23, 1, A, 2); H.set(x, 25, 1, Bc, 1); H.set(x, 27, 0, A, 2); } },
  cross(H, p) { const [, G, l] = cwOf('cross', p), c = (y, z) => l === 1 ? ICE2(0, y, z) : G;
    if (H.has(-10, 24, 0)) { for (let y = 18; y < 24; y++) H.set(-11, y, 0, c(y, 0), l); H.set(-11, 21, -1, c(21, -1), l); H.set(-11, 21, 1, c(21, 1), l); }
    if (H.has(9, 24, 0)) H.set(10, 23, 1, 0xdff6ff, 1); },
  icestud(H, p) { const [, G] = cwOf('icestud', p);
    for (const [x, e] of [[-11, -10], [10, 9]]) { if (!H.has(e, 24, 0)) continue; H.box(x, 23, 0, x + 1, 25, 2, (xx, y, z) => ICE2(0, y, z), 1); for (const y of [23, 24]) { H.set(x, y, -1, G, 2); H.set(x, y, 2, G, 2); } } },
});
// ── grills (the 6-wide mouth grid; .fx paints the stones the letters can't)
const GEMS = ['K....K', '.1234.', '......'], DIAMOND = ['K....K', '.WWIW.', '......'];
GEMS.fx = F => [0xff3b6b, 0x2de2e6, 0x6cf542, 0xffd21f].forEach((c, i) => F.set(-2 + i, 20, 7, c, 1));
DIAMOND.fx = F => F.set(0, 20, 8, 0xffffff, 3);
Object.assign(MOUTH, { fangs: ['K....K', '.GWWG.', '.G..G.'], perms: ['K....K', 'GGGGGG', '.GGGG.'], openface: ['K....K', '.GWWG.', '.GWWG.'], diamond: DIAMOND, gems: GEMS });
// ───────────────── the install passes (chars.js 891–907, head ones only, in the old order; the neck / acc tables are stand-ins)
installJewelry({ NECK: {}, MOUTH, EARS, ACC: {}, NEWT, NEWI, NAMES });
installOpusFace({ EYE, MOUTH, EYEWEAR, EARS, MARKS, HATS, faceGrid, Grid, NEWT, NEWI, NAMES });
installOpus2Face({ EYE, MOUTH, faceGrid, NEWT, NEWI, NAMES });
installHead({ EYE, MOUTH, EYEWEAR, HATS, EARS, MARKS, faceGrid, cwOf, Grid });
installOpusHair({ HAIR, NEWT, NEWI, NAMES });
installOpusSkins({ SPECIES, NAMES, TIER, NEWT, NEWI, shade, lerpHex, hash3 });
installOpus2Skins({ SPECIES, NAMES, TIER, NEWT, NEWI, shade, lerpHex, hash3 });

// the old hat covers that weren't read off the hat (old world/fit/layers.js FIXED): the balaclava covers all hair, the halo floats
export const OLD_FIXED_COVER = { balaclava: 'all', halo: 'none', cursorclip: 'none' };
export { Grid, FONT, skinOf, faceGrid, EYE, MOUTH, HAIR, HATS, EYEWEAR, EARS, SPECIES, NAMES, NEWT, NEWI, EARS_COVERED, S };
