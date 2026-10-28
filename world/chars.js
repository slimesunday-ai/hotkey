// AI CITY character system (one skeleton, one head, every trait drawn once) + the walk rig.
// The single source for both the world viewer and the fit check (fitcheck/index.html imports this file).
import * as THREE from 'three';
import { installShoes2 } from './shoes2.js';   // the shoe pass: Drop 02's shoes redrawn + new pairs (behind NEW_TRAITS)
import { installJewelry } from './jewelry2.js';   // the jewellery pass: Drop 02's jewellery redrawn + new pieces (behind NEW_TRAITS)
import { installHead } from './fit/refit-head.js';   // refit · head (agent 4): eyewear, face extras, hat edges + ear flaps, ear items (world/fit/refit-head.js)
import { heldDraw, holdArm, holdSwing } from './held2.js';
import { bodyPart as fitBodyPart, fitOf, TOPFIT, installFit, sleeve as fitSleeve, shoulderCap } from './fit/body.js';   // the fitting body: which segment each garment voxel rides, caps, necklines (world/fit/body.js)
import * as LAY from './fit/layers.js';   // the fitting layers: head-grid slot tags, hat covers, ears, the necklace renderer (world/fit/layers.js)   // the held + grip pass: items in the hand, a hand per grip, the hold's arm pose
import { installTopsRefit } from './fit/refit-tops.js';   // refit 2: everyday tops + flat prints (world/fit/refit-tops.js)
import { installOuter } from './fit/refit-outer.js';   // refit 1: puffer, bubble, furcoat, chenille, varsity re-cut for walk v2 (world/fit/refit-outer.js)
import { installLower } from './fit/refit-lower.js';   // refit 3: bottoms, shoes, lower accessories cut for walk v2 (world/fit/refit-lower.js)
export const S = 1 / 20;
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
const DIRS = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const AOV = [0.55, 0.72, 0.87, 1];
function voxGeo(M, has, ao = true) {
  const P = [], N = [], Co = [], I = []; let v = 0; const col = new THREE.Color();
  for (const [k, hex] of M) { const [x, y, z] = dec(k); col.setHex(hex);
    for (const d of DIRS) { const [nx, ny, nz] = d.n; if (has(x + nx, y + ny, z + nz)) continue; const ax = x + nx, ay = y + ny, az = z + nz, a4 = [];
      for (const c of d.c) { if (!ao) { a4.push(3); continue; } const t = [nx ? 0 : (c[0] ? 1 : -1), ny ? 0 : (c[1] ? 1 : -1), nz ? 0 : (c[2] ? 1 : -1)], e = [];
        if (t[0]) e.push([t[0], 0, 0]); if (t[1]) e.push([0, t[1], 0]); if (t[2]) e.push([0, 0, t[2]]);
        const s1 = has(ax + e[0][0], ay + e[0][1], az + e[0][2]), s2 = has(ax + e[1][0], ay + e[1][1], az + e[1][2]), cr = has(ax + t[0], ay + t[1], az + t[2]);
        a4.push(s1 && s2 ? 0 : 3 - (s1 + s2 + cr)); }
      for (let q = 0; q < 4; q++) { const c = d.c[q]; P.push(x + c[0], y + c[1], z + c[2]); N.push(nx, ny, nz); const a = AOV[a4[q]]; Co.push(col.r * a, col.g * a, col.b * a); }
      if (a4[0] + a4[2] < a4[1] + a4[3]) I.push(v + 1, v + 2, v + 3, v + 1, v + 3, v); else I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(Co, 3)); g.setIndex(I); return g;
}
const MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .2, metalness: .15 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .85, envMapIntensity: 2.6 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];

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
  const sp = SPECIES[id] ?? {}, base = sp.c ?? SKIN[id] ?? SKIN.tan;
  const ch = (x, y, z) => (((x >> 1) + (y >> 1) + (z >> 1)) & 1);
  const c = sp.checker ? ((x, y, z) => ch(x, y, z) ? 0xff00ff : 0x121212) : (() => base);
  const sh = sp.checker ? ((x, y, z) => ch(x, y, z) ? 0xa300a3 : 0x000000) : (() => shade(base, .8));
  return { id, c, sh, layer: sp.layer ?? 0, ink: sp.ink ?? ((id === 'deep' || id === 'brown') ? 0x0d0d14 : 0x2a1a14), brow: sp.brow === null ? null : (sp.brow ?? 0x22160f),
    mouth: sp.mouth ?? 0x3e211a, lash: sp.lash ?? 0x160f0f, lip: sp.checker ? 0xff66ff : lerpHex(shade(base, .85), 0xd0505a, .35), noEars: !!sp.noEars, alienEyes: !!sp.alienEyes, screen: sp.screen, decorate: sp.decorate };
}

// ───────────────────────── the base: one skeleton, one head (the anchors)
// head x -8..7, y 19..33, z -7..7 (face z=7) · eyes 5 wide x -7..-3 / 2..6, rows 23-26 · brows 27-29 · nose 22 · mouth x -3..2, rows 19-21
function base(H, B, sk) {
  const c = sk.c, L = sk.layer;
  B.box(-4, 0, -1, -1, 10, 2, c, L); B.box(1, 0, -1, 4, 10, 2, c, L); B.box(-5, 10, -2, 5, 18, 3, c, L);
  B.box(-8, 10, -1, -5, 17, 1, c, L); B.box(5, 10, -1, 8, 17, 1, c, L); B.box(-1, 17, -1, 1, 19, 1, c, L);
  H.box(-8, 19, -7, 8, 34, 8, c, L);
  if (!sk.noEars) { H.box(-10, 23, -1, -8, 28, 2, c, L); H.box(8, 23, -1, 10, 28, 2, c, L); for (let y = 24; y < 27; y++) { H.set(-10, y, 1, sk.sh(-10, y, 1), L); H.set(9, y, 1, sk.sh(9, y, 1), L); } }
  if (sk.decorate) sk.decorate(H);
}
function hands(B, sk) { // mittens with a thumb, drawn last so nothing eats them
  const L = sk.layer;
  for (const [x0, tx] of [[-8, -6], [5, 5]]) { B.box(x0, 6, -2, x0 + 3, 10, 2, sk.c, L); B.set(tx, 7, 2, sk.c(tx, 7, 2), L); B.set(tx, 8, 2, sk.c(tx, 8, 2), L);
    for (let x = x0; x < x0 + 3; x++) B.set(x, 6, 1, sk.sh(x, 6, 1), L); }
}

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
const PRINTS = { heart: [['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'], 0xff3b6b], star: [['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'], 0xffd21f],
  bomb: [['...Y.', '..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'], 0x111111], cmd: [['XX.XX', 'XXXXX', '.X.X.', 'XXXXX', 'XX.XX'], 0xffffff] };
function hoodieBase(B, C) { const D = shade(C, .72);
  B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 10, -2, -5, 18, 2, C); B.box(5, 10, -2, 8, 18, 2, C);
  for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, D); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, D);
  B.box(-6, 17, -4, 6, 19, 2, D); }
function teeBase(B, C) { B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 14, -2, -5, 18, 2, C); B.box(5, 14, -2, 8, 18, 2, C); }
const TOPS = {
  hoodie(B, p) { const C = p.c ?? 0x151517, LC = p.lc ?? 0xd7141a; hoodieBase(B, C);
    if ((p.logo ?? 'box') === 'box') { B.box(-3, 10, 4, 3, 13, 5, LC); for (const x of [-2, -1, 1]) B.set(x, 11, 4, 0xffffff); for (const x of [-2, 0, 1]) B.set(x, 12, 4, 0xffffff); } else B.box(1, 14, 4, 4, 16, 5, 0xffffff); },
  desktop(B) { hoodieBase(B, 0x008080); B.box(-4, 10, 4, 3, 15, 5, 0xc0c0c0); for (let x = -4; x < 3; x++) B.set(x, 14, 4, lerpHex(0x000080, 0x1084d0, (x + 4) / 6)); B.set(2, 14, 4, 0xc0c0c0);
    B.box(-3, 11, 4, 2, 13, 5, 0xffffff); for (const x of [-2, -1, 0]) B.set(x, 12, 4, 0x0a0a0a); },
  puffer(B, p) { const C = p.c ?? 0xc9ced6, L = shade(C, 1.12), D = shade(C, .74), q = ly => ly % 3 === 0 ? D : (ly % 3 === 2 ? L : C);   // (fit refit 2026-09-30, world/fit/body.js)
    // (superseded by world/fit/refit-outer.js installOuter; kept drawable) the shell (chest): 2 proud from the chest down to y 12, a
    // banded waist 1 proud below it (y 9…11); quilt rows from the hem, every third a groove. No row at y 18: the head's collar slab stays skin.
    B.box(-7, 12, -4, 7, 18, 5, (x, y) => q(y - 9), 1); B.box(-6, 9, -4, 6, 12, 5, (x, y) => q(y - 9), 1);
    for (let y = 9; y < 18; y++) if ((y - 9) % 3 === 0) { const w = y < 12 ? 6 : 7; for (let x = -w; x < w; x++) { B.del(x, y, 4); B.del(x, y, -4); } for (let z = -4; z < 5; z++) { B.del(-w, y, z); B.del(w - 1, y, z); } }
    // one sleeve per arm (simple arms: the arm is one piece), quilted, the cuff at the wrist; a shoulder cap y 17…18 over the chest's side
    for (const s of 'LR') { fitSleeve(B, s, 'arm' + s, { x0: -10, x1: -8, y0: 9, y1: 16, z0: -3, z1: 2 }, (lx, ly) => ly % 3 === 0 ? D : ly % 3 === 2 ? L : C, 1);
      shoulderCap(B, s, (lx, ly) => ly === 9 ? L : C, { outer: -10, inner: -7, z0: -3, z1: 2, l: 1 }); }
    for (let y = 9; y < 18; y++) if ((y - 9) % 3) B.set(-1, y, 4, 0x55585f, 1); },
  jersey(B, p) { const C = p.c ?? 0xb3121b, N = p.n ?? 0xffffff, T = 0xf2f2f2;   // (fit refit 2026-09-30, world/fit/body.js)
    B.box(-6, 9, -3, 6, 18, 4, C); for (let y = 14; y < 18; y++) for (let z = -3; z < 4; z++) { B.set(-6, y, z, T); B.set(5, y, z, T); if (y === 17) { B.set(-5, y, z, T); B.set(4, y, z, T); } }   // the shell; white side panels + the yoke's end over each shoulder (chest)
    for (const s of 'LR') { fitSleeve(B, s, 'arm' + s, { x0: -8, x1: -7, y0: 15, y1: 16, z0: -2, z1: 1 }, T); shoulderCap(B, s, T); }   // white sleeves + the cap: the trim runs across the shoulder
    for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, T);
    B.text('56', -4, 14, 3, N); B.textBack('56K', 5, 14, -3, N); },
  tee(B, p) { const C = p.c ?? 0x151517, pr = p.print ?? 'heart', [rows, pc] = PRINTS[pr];   // (fit refit 2026-09-30: shell on the chest, sleeves + cap per segment, flat print)
    B.box(-6, 9, -3, 6, 18, 4, C); for (const s of 'LR') { fitSleeve(B, s, 'arm' + s, { x0: -8, x1: -7, y0: 14, y1: 16, z0: -2, z1: 1 }, C); shoulderCap(B, s, C); }
    B.bmp(rows, { X: pc, Y: 0xffb000 }, -3, 16, 3, 4);
    if (pr === 'heart') for (const [x, y] of [[-1, 16], [0, 15], [-1, 14], [0, 13]]) B.set(x, y, 3, C); if (pr === 'bomb') B.set(-2, 13, 3, 0xffffff); },
  bsodtee(B) { const C = 0x0000aa; teeBase(B, C); B.box(-2, 16, 3, 2, 17, 4, 0xaaaaaa); const r = mulberry32(3); for (const y of [14, 12, 10]) for (let x = -5; x < 5; x++) if (r() < .72) B.set(x, y, 3, 0xffffff); },
  varsity(B, p) { const C = p.c ?? 0x1b2a4a, Sl = p.s ?? 0xefe6d2;
    B.box(-6, 9, -3, 6, 18, 4, C); B.box(-9, 10, -2, -5, 18, 2, Sl); B.box(5, 10, -2, 9, 18, 2, Sl);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, (z & 1) ? Sl : C); for (const x0 of [-9, 5]) for (let x = x0; x < x0 + 4; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, C);
    for (const y of [11, 13, 15]) B.set(-1, y, 4, 0xe9e9e9, 1); B.box(1, 11, 4, 6, 18, 5, Sl); B.text('D', 2, 16, 4, C); },
  track(B) { const C = 0xefe9dc; B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 10, -2, -5, 18, 2, C); B.box(5, 10, -2, 8, 18, 2, C);
    RAINBOW.forEach((col, i) => { const y = 17 - i; for (let x = -6; x < 6; x++) B.set(x, y, 3, col); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) B.set(x, y, 1, col); });
    for (let y = 9; y < 18; y++) B.set(-1, y, 4, 0xbdbdbd, 2); },
  tank(B, p, sk) { const C = p.c ?? 0xf4f4f4, D = shade(C, .9); B.box(-5, 9, -2, 5, 18, 3, x => (x & 1) ? D : C); for (const x of [-2, -1, 0, 1]) B.set(x, 17, 2, sk.c(x, 17, 2), sk.layer); },
  jumpsuit(B) { const C = 0xff7a1a, D = shade(C, .78);   // county orange, whatever the palette says
    B.box(-6, 9, -3, 6, 18, 4, C); B.box(-8, 10, -2, -5, 18, 2, C); B.box(5, 10, -2, 8, 18, 2, C);
    for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, D);
    for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, D); B.box(1, 12, 4, 5, 15, 5, 0xf2f2f2); B.textBack('404', 4, 16, -3, D); },
  velour(B, p) { const C = p.c ?? 0x6e1f3a, L = shade(C, 1.2), Sv = 0xf2f2f2, nap = (x, y) => ((x + y * 2) % 5 === 0 ? L : C);
    B.box(-6, 9, -3, 6, 18, 4, nap); B.box(-8, 10, -2, -5, 18, 2, nap); B.box(5, 10, -2, 8, 18, 2, nap);
    for (let y = 10; y < 18; y++) { B.set(-8, y, 0, Sv); B.set(7, y, 0, Sv); } for (let y = 9; y < 18; y++) B.set(-1, y, 4, 0xc9ced4, 2); B.box(-6, 17, -4, 6, 19, 2, shade(C, .8)); },
  flannel(B, p) { const C = p.c ?? 0xb3121b, pl = (x, y) => ((x & 3) === 0 && (y & 3) === 0) ? 0x151515 : ((x & 3) === 0 || (y & 3) === 0) ? shade(C, .5) : C;
    B.box(-6, 9, -3, 6, 18, 4, pl); B.box(-8, 10, -2, -5, 18, 2, pl); B.box(5, 10, -2, 8, 18, 2, pl); B.box(-6, 17, -4, 6, 19, 2, pl);
    for (let y = 9; y < 16; y++) for (const x of [-2, -1, 0, 1]) B.set(x, y, 3, 0xf2f2f2); B.set(-1, 16, 4, 0xe9e2cf); },
  babytee(B, p) { const C = p.c ?? 0xf7b6d2; B.box(-5, 12, -2, 5, 18, 3, C); B.box(-8, 15, -2, -5, 17, 2, C); B.box(5, 15, -2, 8, 17, 2, C); B.bmp(PRINTS.star[0], { X: 0xffffff }, -3, 17, 2, 3); },
};
const BOTTOMS = {
  baggy(B, p) { const C = p.c ?? 0x4f79b5, L = shade(C, 1.16), D = shade(C, .78);
    B.box(-7, 2, -3, 0, 3, 4, D); B.box(0, 2, -3, 7, 3, 4, D); B.box(-6, 3, -2, 0, 11, 3, C); B.box(0, 3, -2, 6, 11, 3, C);
    for (let y = 2; y < 6; y++) for (let z = -3; z < 4; z++) { B.del(-1, y, z); B.del(0, y, z); }
    for (const x0 of [-6, 1]) for (let x = x0; x < x0 + 5; x++) for (const y of [6, 7]) B.set(x, y, 2, L);
    for (let x = -6; x < 6; x++) for (let z = -2; z < 3; z++) B.set(x, 10, z, 0x1a1a1a); B.set(-1, 10, 3, 0xd8d8d8, 2); B.set(0, 10, 3, 0xd8d8d8, 2); },
  cargo(B, p) { const C = p.c ?? 0x2a2a2c, D = shade(C, .72);
    B.box(-7, 2, -3, 0, 3, 4, D); B.box(0, 2, -3, 7, 3, 4, D); B.box(-6, 3, -2, 0, 11, 3, C); B.box(0, 3, -2, 6, 11, 3, C);
    for (let y = 2; y < 6; y++) for (let z = -3; z < 4; z++) { B.del(-1, y, z); B.del(0, y, z); }
    B.box(-7, 4, -1, -6, 7, 2, D); B.box(6, 4, -1, 7, 7, 2, D); },
  track(B, p) { const C = p.c ?? 0x111114, St = p.s ?? 0xf2f2f2;
    B.box(-5, 3, -2, 0, 11, 3, C); B.box(0, 3, -2, 5, 11, 3, C); for (let y = 3; y < 7; y++) for (let z = -2; z < 3; z++) { B.del(-1, y, z); B.del(0, y, z); }
    for (let y = 4; y < 11; y++) for (const z of [-1, 1]) { B.set(-5, y, z, St); B.set(4, y, z, St); } },
  shorts(B, p) { const C = p.c ?? 0x1a1a1a; B.box(-6, 6, -2, 0, 11, 3, C); B.box(0, 6, -2, 6, 11, 3, C); for (let z = -2; z < 3; z++) { B.del(-1, 6, z); B.del(0, 6, z); }
    B.box(-4, 2, -1, -1, 5, 2, 0xf4f4f4); B.box(1, 2, -1, 4, 5, 2, 0xf4f4f4); for (const x of [-4, -3, -2, 1, 2, 3]) B.set(x, 4, 1, 0xd7141a); },
  jumpsuit(B) { const C = 0xff7a1a; B.box(-6, 3, -2, 0, 11, 3, C); B.box(0, 3, -2, 6, 11, 3, C); for (let y = 3; y < 7; y++) for (let z = -2; z < 3; z++) { B.del(-1, y, z); B.del(0, y, z); }
    for (const x0 of [-6, 1]) for (let x = x0; x < x0 + 5; x++) for (let z = -2; z < 3; z++) B.set(x, 3, z, shade(C, .8)); },
  camo(B) { const cols = [0x4a5a3a, 0x6b6b45, 0x2f3a28, 0x8a7a55], cm = (x, y, z) => cols[((x >> 1) * 7 + (y >> 1) * 13 + (z >> 1) * 5 + ((x + y) >> 2)) & 3];
    B.box(-7, 2, -3, 0, 3, 4, cm); B.box(0, 2, -3, 7, 3, 4, cm); B.box(-6, 3, -2, 0, 11, 3, cm); B.box(0, 3, -2, 6, 11, 3, cm);
    for (let y = 2; y < 6; y++) for (let z = -3; z < 4; z++) { B.del(-1, y, z); B.del(0, y, z); } B.box(-7, 4, -1, -6, 7, 2, cm); B.box(6, 4, -1, 7, 7, 2, cm); },
  sweats(B, p) { const C = 0x9a9ca3, D = shade(C, .8);
    B.box(-6, 5, -2, 0, 11, 3, C); B.box(0, 5, -2, 6, 11, 3, C); B.box(-5, 2, -2, -1, 5, 3, D); B.box(1, 2, -2, 5, 5, 3, D);
    for (let y = 5; y < 7; y++) for (let z = -2; z < 3; z++) { B.del(-1, y, z); B.del(0, y, z); } for (const [x, y] of [[-1, 9], [0, 9], [-1, 8], [0, 7]]) B.set(x, y, 3, 0xf2f2f2); },
  flares(B, p) { const C = p.c ?? 0x7ea6d8;
    B.box(-5, 4, -2, 0, 10, 3, C); B.box(0, 4, -2, 5, 10, 3, C); B.box(-6, 1, -3, 0, 4, 4, C); B.box(0, 1, -3, 6, 4, 4, C);
    for (let y = 1; y < 8; y++) for (let z = -3; z < 4; z++) { B.del(-1, y, z); B.del(0, y, z); } for (let x = -5; x < 5; x++) B.set(x, 9, 2, 0x6b3f1d); },
};
const SHOES = {
  dad(B, p) { const U = p.u ?? 0xf6f6f6, A = p.a ?? 0xd7141a, A2 = p.a2 ?? 0x1d3a8a;
    for (const x0 of [-6, 1]) { B.box(x0, 0, -3, x0 + 5, 1, 6, 0xbdbdbd); B.box(x0, 1, -3, x0 + 5, 2, 6, 0xefe9dc); B.box(x0, 2, -2, x0 + 5, 5, 5, U);
      const o = x0 < 0 ? x0 : x0 + 4; for (let y = 2; y < 4; y++) for (let z = -1; z < 4; z++) B.set(o, y, z, A); for (let y = 2; y < 5; y++) B.set(x0 + 2, y, -2, A2);
      for (let x = x0 + 1; x < x0 + 4; x++) B.set(x, 5, 1, 0xd0d0d0); B.set(x0 + 2, 5, 2, 0xd0d0d0); } },
  hightop(B, p) { const Mc = p.m ?? 0xd7141a, K = p.k ?? 0x121212, W = 0xf7f7f7;
    for (const x0 of [-6, 1]) { B.box(x0, 0, -2, x0 + 5, 1, 6, W); B.box(x0, 1, -2, x0 + 5, 7, 5, (x, y, z) => y >= 6 ? K : (z >= 3 ? W : Mc));
      const o = x0 < 0 ? x0 : x0 + 4; ['X..', 'XX.', 'XXX', '.X.'].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === 'X') B.set(o, 5 - j, i, W); }); } },
  slides(B, p) { const K = p.k ?? 0x151515; for (const x0 of [-5, 1]) { B.box(x0, 1, -2, x0 + 4, 6, 4, 0xf6f6f6); B.box(x0 - 1, 0, -3, x0 + 5, 1, 5, K); B.box(x0 - 1, 2, 0, x0 + 5, 4, 4, K); B.set(x0 + 1, 3, 4, 0xffffff); B.set(x0 + 2, 3, 4, 0xffffff); } },
  foam(B, p) { const C = p.c ?? 0xe9e2cf, D = shade(C, .62); for (const x0 of [-6, 1]) { B.ell(x0 + 2.5, 2.3, 1.5, 3.1, 2.7, 4.7, C); for (const [y, z] of [[3, -1], [3, 2], [2, 4]]) { B.set(x0, y, z, D); B.set(x0 + 4, y, z, D); } } },
  checker(B) { for (const x0 of [-6, 1]) { B.box(x0, 0, -2, x0 + 5, 1, 6, 0xf4f4f4); B.box(x0, 1, -2, x0 + 5, 4, 5, (x, y, z) => ((x + y + z) & 1) ? 0x111111 : 0xf4f4f4); for (let x = x0; x < x0 + 5; x++) B.set(x, 1, 5, 0xf4f4f4); } },
  button(B) { for (const x0 of [-6, 1]) { B.box(x0, 0, -2, x0 + 5, 1, 6, 0xffffff); B.box(x0, 1, -2, x0 + 5, 5, 5, 0xc0c0c0);
    for (let x = x0; x < x0 + 5; x++) { B.set(x, 4, 4, 0xffffff); B.set(x, 1, 4, 0x5e5e5e); } for (let y = 1; y < 5; y++) { B.set(x0, y, 4, 0xffffff); B.set(x0 + 4, y, 4, 0x5e5e5e); }
    const o = x0 < 0 ? x0 : x0 + 4; for (let z = -2; z < 4; z++) B.set(o, 3, z, lerpHex(0x000080, 0x1084d0, (z + 2) / 5)); } },
  boots(B, p) { const C = p.bc ?? 0xc8964a, D = shade(C, .72);   // wheat nubuck work boots
    for (const x0 of [-6, 1]) { B.box(x0, 0, -3, x0 + 5, 1, 6, 0x4a3020); B.box(x0, 1, -2, x0 + 5, 7, 5, (x, y) => y >= 6 ? D : C); B.box(x0, 1, 5, x0 + 5, 3, 6, C);
      for (let y = 2; y < 6; y++) { B.set(x0 + 1, y, 5, 0x3a2616); B.set(x0 + 3, y, 5, 0x3a2616); } } },
  platinum(B) { for (const x0 of [-6, 1]) { B.box(x0, 0, -2, x0 + 5, 1, 6, 0xf4f4f4); B.box(x0, 1, -2, x0 + 5, 7, 5, (x, y) => y >= 6 ? 0x9a9a9a : 0xdcdcdc);
    const o = x0 < 0 ? x0 : x0 + 4; RAINBOW.forEach((c, i) => { B.set(o, 1 + i, 3 - Math.floor(i / 2), c); B.set(o, 1 + i, 2 - Math.floor(i / 2), c); }); } },
};
// (fit layers: a chain is a ring round the neck + a drop lying on the chest, world/fit/layers.js strand; the shapes as before)
function chainU(B, c, low = 15, thick = 1) { LAY.strand(B, { low, half: 3, rows: thick, col: () => [c, 2] }); }
function chainV(B, col, low = 15, half = 3, thick = 1, l = 2) { LAY.strand(B, { low, half, rows: thick, col: (t, k, x, y) => [col(x, y), l] }); }
const GOLD = (x, y) => ((x + y) & 1) ? 0xf2cc55 : 0xc8962c, ICE = x => (x & 1) ? 0xffffff : 0x9fd8ff;
const NECK = {
  rope(B) { chainV(B, GOLD, 12, 4, 2); },
  tennis(B) { chainV(B, ICE, 13, 4, 1, 1); },
  dollar(B) { chainV(B, () => 0xe7bd4a, 15, 3); ['..X..', '.XXXX', 'XX...', '.XXX.', '...XX', 'XXXX.', '..X..'].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') B.onFront(-3 + i, 15 - j, (i + j) % 3 ? 0xe7bd4a : 0xf6dc80, 2); }); },
  piece(B) { chainV(B, GOLD, 15, 3); for (let x = -4; x < 3; x++) for (let y = 8; y < 15; y++) { const d = Math.hypot(x + .5, y - 11); if (d > 3.3) continue; B.onFront(x, y, d > 2.4 ? 0xe7bd4a : ICE(x + y), d > 2.4 ? 2 : 1); } },
  stack(B) { chainU(B, 0xe7bd4a, 15, 2); chainV(B, ICE, 12, 4, 1, 1); },
  cursor(B) { chainU(B, 0xdfe6ee); const ice = { I: 0x9fd8ff, W: 0xffffff }; ['I..', 'II.', 'IWI', '.I.'].forEach((r, j) => { for (let i = 0; i < 3; i++) if (ice[r[i]] !== undefined) B.onFront(-2 + i, 14 - j, ice[r[i]], 1); }); },
  padlock(B) { chainU(B, 0xe0b440); for (const x of [-2, 0]) B.onFront(x, 14, 0xe0b440, 2); for (let x = -2; x < 1; x++) for (let y = 11; y < 14; y++) B.onFront(x, y, (y === 12 && x === -1) ? 0x6b4c10 : 0xe8c050, 2); },
  cuban(B) { chainU(B, 0xe7bd4a, 15, 2); },
  cmd(B) { chainU(B, 0xdfe6ee); PRINTS.cmd[0].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') B.onFront(-3 + i, 14 - j, (i + j) & 1 ? 0xffffff : 0x9fd8ff, 1); }); },
  floppy(B) { chainU(B, 0x222222); for (let x = -2; x < 1; x++) for (let y = 11; y < 15; y++) B.onFront(x, y, y >= 13 && x === -1 ? 0xc9ccd2 : (y === 11 ? 0xffffff : 0x2b50d6), 1); },
  beachball(B) { chainU(B, 0xdfe6ee); [[0, 1, 2], [5, -1, 3], [4, 5, 0]].forEach((r, j) => r.forEach((ci, i) => B.onFront(-2 + i, 14 - j, ci < 0 ? 0xffffff : PINWHEEL[ci], 1))); },
};
const HELD = {   // (held + grip pass: world/held2.js redraws every id here and in Drop 02 for its grip; these are the fallback for an id it doesn't know)
  flip(B) { B.box(8, 4, -1, 9, 11, 1, 0xc9ccd2, 1); B.box(9, 8, -1, 10, 10, 1, 0x3aa0ff, 3); },
  ipod(B, p, H) { B.box(8, 4, 0, 10, 8, 1, 0xf6f6f6, 1); B.set(8, 5, 1, 0xbdbdbd, 1); B.set(9, 5, 1, 0xbdbdbd, 1);
    for (const [x, y] of [[7, 9], [6, 10], [5, 12], [4, 14], [3, 16], [2, 17]]) B.onFront(x, y, 0xffffff, 1);
    strand(H, [[2, 19, 7], [6, 21, 5], [9, 23, 2]], 0xffffff, 1); H.box(9, 23, 1, 11, 25, 3, 0xffffff, 1);
    for (const [x, y] of [[1, 16], [0, 15], [-1, 14]]) B.onFront(x, y, 0xffffff, 1); B.onFront(-2, 13, 0xffffff, 1, 2); },
  camera(B) { B.box(5, 5, 2, 9, 8, 4, 0xf2c230, 1); B.box(6, 6, 4, 8, 8, 5, 0x111111, 1); B.set(8, 7, 4, 0xffffff, 1); },
  can(B) { B.box(5, 4, 2, 8, 10, 4, (x, y) => y === 9 ? 0xb8b8b8 : (y % 2 ? 0x6cf542 : 0x101010), 1); },
  mouse(B) { B.box(5, 4, 2, 8, 6, 6, 0xe2dccb, 1); B.set(6, 6, 4, 0x8a8472); B.set(6, 6, 5, 0x8a8472); strand(B, [[6, 4, 6], [6, 1, 8], [4, 0, 11], [1, 0, 12]], 0x555555, 1); },
  cash(B) { B.box(5, 5, 2, 9, 8, 5, (x, y) => y === 7 ? 0x8fd07a : 0x5fa84a); for (let y = 5; y < 8; y++) for (let z = 2; z < 5; z++) B.set(7, y, z, 0xf2e6b0); },
  duffel(B) { const K = 0x16161a; B.box(7, 0, -3, 11, 5, 5, K); for (let z = -3; z < 5; z++) B.set(10, 2, z, 0xf2f2f2); B.box(8, 5, 0, 9, 8, 1, K); B.box(8, 5, 2, 9, 8, 3, K); },
  spray(B, p) { const C = p.c ?? 0xff4fa3; B.box(5, 5, 2, 8, 11, 4, (x, y) => y >= 10 ? 0xf2f2f2 : y === 9 ? 0x9aa0a6 : C, 1); B.set(6, 11, 3, 0x111111); },
  crowbar(B) { strand(B, [[7, 9, 3], [7, 0, 6]], 0xc0392f, 1, 2); strand(B, [[7, 9, 3], [7, 11, 2], [7, 11, 1]], 0x2b2b2e, 1, 2); },
  floppydisk(B) { B.box(5, 4, 2, 10, 9, 3, 0x2b50d6, 1); B.box(6, 7, 3, 9, 9, 4, 0xc9ccd2, 2); B.box(6, 4, 3, 9, 6, 4, 0xffffff); },
};
const ACC = {   // accessories say which body part they ride on (as), so the walk cycle carries them
  watch(B, p, as) { as('armL'); B.box(-9, 10, -3, -5, 11, 3, p.c ?? 0xe7bd4a, 2); B.box(-10, 9, -1, -9, 12, 2, 0xa8e4ff, 1); B.set(-10, 10, 0, 0xffffff, 1); },
  monitor(B, p, as) { as('legR'); const K = 0x1d1d20; B.box(1, 4, -3, 7, 5, 4, K); B.box(6, 3, -1, 8, 6, 2, K); B.set(8, 5, 0, 0x39e07a, 3); },
  crossbody(B, p, as) { as('torso'); const K = p.c ?? 0x151517; for (let i = 0; i < 9; i++) B.onFront(4 - i, 17 - i, K, 1); B.box(-5, 8, 3, -1, 11, 6, K, 1); B.box(-5, 10, 6, -1, 11, 7, 0xc9ced4, 2); },
  bandana(B, p, as) { as('legR'); const C = p.c ?? 0xc0272d; ['XXXX', 'XXX.', '.XX.', '.X..', '.X..'].forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] === 'X') B.set(1 + i, 9 - j, -4, (i + j) % 3 ? C : 0xf4f4f4); }); },
};
const MARKS = {
  '404'(H, sk) { const D = { '4': 'X.XXXX..X', '0': 'XXXX.XXXX' }; let x = -5; for (const ch of '404') { for (let i = 0; i < 9; i++) if (D[ch][i] === 'X') H.set(x + (i % 3), 32 - ((i / 3) | 0), 7, sk.ink); x += 4; } },
  cmd(H, sk) { PRINTS.cmd[0].forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') H.set(-3 + i, 33 - j, 7, sk.ink); }); },
  tear(H, sk) { H.set(-6, 21, 7, sk.ink); H.set(-6, 20, 7, sk.ink); },
  cursor(H, sk) { ['X..', 'XX.', 'XXX', '.X.'].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === 'X') H.set(4 + i, 22 - j, 7, sk.ink); }); },
  ibeam(H, sk) { ['XXX', '.X.', '.X.', 'XXX'].forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === 'X') H.set(4 + i, 22 - j, 7, sk.ink); }); },
  bandaid(H) { H.box(-3, 22, 9, 3, 23, 10, 0xe8c9a0); H.set(-1, 22, 10, 0xd9b58a); H.set(0, 22, 10, 0xd9b58a); },
  scar(H, sk) { const c = lerpHex(sk.c(4, 21, 7), 0x8a2f35, .55); for (const [x, y] of [[3, 22], [4, 21], [5, 20], [6, 19]]) H.set(x, y, 7, c); for (const [x, y] of [[3, 20], [5, 22]]) H.set(x, y, 7, lerpHex(sk.c(4, 21, 7), 0xffffff, .35)); },
  barcode(H, sk) { [1, 0, 1, 1, 0, 1].forEach((b, i) => { if (b) for (let y = 20; y < 23; y++) H.set(2 + i, y, 7, sk.ink); }); },   // under the right eye
  blush(H) { H.box(-7, 21, 7, -5, 22, 8, 0xf59ab5); H.box(5, 21, 7, 7, 22, 8, 0xf59ab5); },
};

// ───────────────────────── the compositor: look → voxels → meshes (face carved, blink-ready)
function compose(L, o = {}) {   // o.torso: stop after the top (world/fit/body.js neckRing / chestFront read that)
  const H = new Grid(), B = new Grid(), sk = skinOf(L.skin), tag = new Map(), fit = fitOf(L); let cur = 'base'; B.fit = fit;   // (fit: the per-look routing context, world/fit/body.js)
  const set0 = B.set.bind(B); B.set = (x, y, z, c, l) => { set0(x, y, z, c, l); if (c !== undefined && c !== null) { const k = Vox.k(Math.round(x), Math.round(y), Math.round(z)); tag.set(k, cur); if (fit.seg) fit.force.set(k, fit.seg); else fit.force.delete(k); } };
  const HT = LAY.tagHead(H);   // (fit layers: every head-grid voxel carries its slot)
  base(H, B, sk);
  HT.slot('marks'); if (L.mark !== 'none' && !sk.screen) MARKS[L.mark](H, sk);
  cur = 'shoes'; SHOES[L.shoes.id](B, L.shoes); cur = 'bottom'; BOTTOMS[L.bottom.id](B, L.bottom); cur = 'top'; TOPS[L.top.id](B, L.top, sk);
  if (o.torso) return { B, tag, fit };
  cur = 'neck'; if (L.neck.id !== 'none') { LAY.beginNeck(L, B, H, tag); B.onFront = (x, y, c, l) => LAY.lay(B, x, y, [c, l]);   // (a necklace lies on the chest: ring + drop, no stacking)
    try { NECK[L.neck.id](B, L.neck, L); } finally { delete B.onFront; LAY.endNeck(); } }
  HT.slot('hair'); if (L.hair.id !== 'none') HAIR[L.hair.id](H, L.hair);
  HT.slot('hat'); if (L.hat.id !== 'none') { HATS[L.hat.id](H, L.hat, sk); LAY.clipHair(H, HT.tag, LAY.coverOf(L.hat.id, G => HATS[L.hat.id](G, L.hat, sk), Grid)); LAY.earFlaps(H, HT.tag, L.hat.id); }
  HT.slot('eyewear'); if (L.eyewear.id !== 'none') EYEWEAR[L.eyewear.id](H, L.eyewear);
  HT.slot('ears'); if (L.ears.id !== 'none' && !(L.ears.id === 'phones' && L.hat.id === 'bucket') && !(sk.noEars && L.ears.id === 'studs') && LAY.showEarItem(L)) EARS[L.ears.id](H, L.ears);
  if (L.acc && L.acc.id !== 'none') { cur = 'acc'; ACC[L.acc.id](B, L.acc, part => { cur = part; }); }
  HT.slot('held'); const HX = heldDraw(B, H, L, sk, { HELD, hands, cwOf, as: part => { cur = part; }, partAt: (x, y, z) => bodyPart(tag.get(Vox.k(x, y, z)) || 'base', x, y, z, fit) });   // (world/held2.js; HX: item voxels that sit in another limb at rest)
  LAY.shareCells(H, HT.tag, B, tag);   // (a cell in both grids: the later layer keeps it)
  const F = faceGrid(sk, L, false), Fc = faceGrid(sk, L, true);
  for (const k of new Set([...F.keys(), ...Fc.keys()])) { const [x, y, z] = dec(k);
    if (z <= 7) { const c = H.get(x, y, z); if (c === undefined || c === sk.c(x, y, z)) H.del(x, y, z); else { F.del(x, y, z); Fc.del(x, y, z); } }
    else if (H.has(x, y, z)) { F.del(x, y, z); Fc.del(x, y, z); } }
  for (const [A, Bv] of [[F, Fc], [Fc, F]]) for (const k of [...A.keys()]) { const [x, y, z] = dec(k); if (z <= 7 && !Bv.has(x, y, z)) Bv.set(x, y, z, sk.c(x, y, z), sk.layer); }
  return { H, B, F, Fc, tag, HX, fit };
}
function meshes(G, parent, off, extra) { const has = extra ? ((x, y, z) => G.has(x, y, z) || extra.has(x, y, z)) : ((x, y, z) => G.has(x, y, z)); const out = [];
  G.L.forEach((M, i) => { if (!M.size) return; const m = new THREE.Mesh(voxGeo(M, has, i !== 3), MATS[i]); m.castShadow = i !== 3; m.receiveShadow = true; m.position.y = off; parent.add(m); out.push(m); }); return out; }
// the walk rig: shoes/pants ride the legs; hands, sleeves and held things ride the arms; the rest is torso (world/fit/body.js: a top's
// shell, flanks included, rides the chest; only what lies outside it is a sleeve)
function bodyPart(t, x, y, z, fit) { return fitBodyPart(t, x, y, z, fit); }
const PIVOT = { legL: [0, 10, .5], legR: [0, 10, .5], armL: [0, 16.5, 0], armR: [0, 16.5, 0] };
function build(L) {
  const { H, B, F, Fc, tag, HX, fit } = compose(L), root = new THREE.Group(), head = new THREE.Group(); head.position.set(0, 19, 0); root.add(head);
  const parts = { torso: new Grid(), legL: new Grid(), legR: new Grid(), armL: new Grid(), armR: new Grid() };
  B.L.forEach((M, li) => { for (const [k, c] of M) { const [x, y, z] = dec(k); parts[bodyPart(tag.get(k) || 'base', x, y, z, fit)].L[li].set(k, c); } });
  HX.L.forEach((M, li) => { for (const [k, c] of M) parts[dec(k)[0] < 0 ? 'armL' : 'armR'].L[li].set(k, c); });
  meshes(parts.torso, root, 0); const rig = { swing: holdSwing(L) };
  for (const n of ['legL', 'legR', 'armL', 'armR']) { const g = new THREE.Group(), pv = PIVOT[n]; g.position.set(...pv); if (!holdArm(THREE, L, n, g, parts[n], pv, meshes, Grid, dec)) for (const m of meshes(parts[n], g, 0)) m.position.set(-pv[0], -pv[1], -pv[2]); root.add(g); rig[n] = g; }
  meshes(H, head, -19, F); const open = new THREE.Group(), shut = new THREE.Group(); head.add(open, shut); shut.visible = false;
  meshes(F, open, -19, H); meshes(Fc, shut, -19, H);
  root.scale.setScalar(S); root.userData = { head, open, shut, L, rig }; return root;
}
// pose: gait is the stride phase (radians, advance ~6 per block walked), w blends from standing (0) to walking (1)
function pose(o, gait, w = 1) { const r = o.userData.rig; if (!r) return; const s = Math.sin(gait) * w;
  r.legL.rotation.x = s * .6; r.legR.rotation.x = -s * .6; r.armR.rotation.x = s * .45 * (r.swing ? r.swing[1] : 1); r.armL.rotation.x = -s * .45 * (r.swing ? r.swing[0] : 1); }
function dispose(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); }); }

// ───────────────────────── names, library, looks
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
const NEW = new Set(['fitted', 'bandana', 'iced', 'scar', 'barcode', 'hoops', 'jumpsuit', 'velour', 'flannel', 'rope', 'tennis', 'dollar', 'piece', 'stack', 'camo', 'sweats', 'boots', 'cash', 'duffel', 'spray', 'crowbar', 'watch', 'monitor', 'crossbody']);
const SLOTS = ['skin', 'hair', 'hat', 'eyes', 'eyewear', 'mouth', 'mark', 'ears', 'top', 'neck', 'bottom', 'shoes', 'held', 'acc'];
const SLOTLAB = { skin: 'skin/species', hat: 'head', mark: 'face ink', acc: 'accessory' };
const PARAM = new Set(['hair', 'hat', 'eyewear', 'ears', 'top', 'neck', 'bottom', 'shoes', 'held', 'acc']);
const RARE = new Set(['emoji', 'noob', 'alien', 'bsod', 'dialog', 'chrome', 'happymac', 'sadmac', 'missing']);
const TIER = { emoji: 'rare', noob: 'rare', alien: 'rare', bsod: 'rare', dialog: 'epic', chrome: 'epic', happymac: 'epic', sadmac: '1 of 1', missing: '1 of 1' };
const look = o => ({ mark: 'none', mouth: 'flat', eyes: 'bored', hat: { id: 'none' }, eyewear: { id: 'none' }, ears: { id: 'none' }, neck: { id: 'none' }, held: { id: 'none' }, acc: { id: 'none' }, hair: { id: 'none' }, ...o });
const LOOKS = [
  look({ handle: 'xXbadvibesXx', skin: 'terracotta', hair: { id: 'dreads' }, eyes: 'bored', mouth: 'pout', mark: '404', top: { id: 'hoodie' }, bottom: { id: 'baggy' }, shoes: { id: 'dad' }, neck: { id: 'cursor' }, ears: { id: 'studs' }, bg: '#ff4fa3' }),
  look({ handle: 'rawr_means_404', skin: 'pale', hair: { id: 'swoop' }, eyes: 'crying', mouth: 'frown', top: { id: 'tee', c: 0x151517, print: 'heart' }, bottom: { id: 'track' }, shoes: { id: 'checker' }, held: { id: 'ipod' }, bg: '#2f5bff' }),
  look({ handle: '56kballer', skin: 'tan', hair: { id: 'spikes' }, eyewear: { id: 'wrap' }, mouth: 'gold', top: { id: 'jersey' }, bottom: { id: 'shorts' }, shoes: { id: 'hightop' }, neck: { id: 'cuban' }, bg: '#ff7a1a' }),
  look({ handle: 'anon_inc', skin: 'brown', hat: { id: 'balaclava' }, eyes: 'mean', top: { id: 'puffer', c: 0xc9ced6 }, bottom: { id: 'cargo' }, shoes: { id: 'foam' }, held: { id: 'flip' }, bg: '#6cff4a' }),
  look({ handle: 'bluescreen.bucket', skin: 'deep', hat: { id: 'bucket' }, eyewear: { id: 'shutter' }, mouth: 'grill', top: { id: 'varsity' }, bottom: { id: 'track', c: 0x1b2a4a }, shoes: { id: 'slides' }, neck: { id: 'padlock' }, bg: '#ffe23a' }),
  look({ handle: 'dealwithit.mp3', skin: 'emoji', hair: { id: 'buzz', c: 0x2a1c14 }, eyewear: { id: 'dwi' }, mouth: 'smirk', ears: { id: 'phones' }, top: { id: 'hoodie', c: 0xd7261e, logo: 'small' }, bottom: { id: 'shorts' }, shoes: { id: 'dad', a: 0x2ecc40, a2: 0xd7261e }, bg: '#7cc3ff' }),
  look({ handle: 'missing_texture', skin: 'missing', hair: { id: 'buzz' }, eyes: 'sleepy', mouth: 'tongue', top: { id: 'tank' }, neck: { id: 'cursor' }, bottom: { id: 'cargo', c: 0x7c7a52 }, shoes: { id: 'foam', c: 0x6cf542 }, bg: '#161616' }),
  look({ handle: 'www.girl', skin: 'pale', hair: { id: 'long' }, hat: { id: 'trucker' }, eyes: 'wink', mouth: 'gum', mark: 'blush', top: { id: 'babytee' }, bottom: { id: 'flares' }, shoes: { id: 'checker' }, held: { id: 'camera' }, bg: '#c89bf5' }),
  look({ handle: 'macpaint.artist', skin: 'happymac', hat: { id: 'beret' }, top: { id: 'track' }, neck: { id: 'cmd' }, bottom: { id: 'cargo', c: 0x151517 }, shoes: { id: 'platinum' }, held: { id: 'floppydisk' }, bg: '#ededed' }),
  look({ handle: 'fatal.exception', skin: 'bsod', eyes: 'side', mouth: 'flat', eyewear: { id: 'cursorshades' }, top: { id: 'desktop' }, bottom: { id: 'track' }, shoes: { id: 'button' }, held: { id: 'mouse' }, bg: '#ff3b30' }),
  look({ handle: 'cmd_q', skin: 'chrome', hat: { id: 'halo' }, eyes: 'sparkle', mouth: 'o', top: { id: 'tee', c: 0x151517, print: 'cmd' }, neck: { id: 'beachball' }, bottom: { id: 'baggy', c: 0x1a1a1a }, shoes: { id: 'platinum' }, bg: '#2f5bff' }),
  look({ handle: 'dialog.box', skin: 'dialog', hat: { id: 'cursorclip' }, eyes: 'shook', mouth: 'grimace', eyewear: { id: 'anaglyph' }, top: { id: 'tee', c: 0xf2f2f2, print: 'bomb' }, bottom: { id: 'cargo', c: 0x7c7a52 }, shoes: { id: 'button' }, held: { id: 'floppydisk' }, bg: '#008080' }),
  look({ handle: 'bail.money', skin: 'deep', hat: { id: 'fitted', c: 0x151517 }, eyes: 'mean', mouth: 'iced', top: { id: 'velour', c: 0x6e1f3a }, neck: { id: 'rope' }, bottom: { id: 'track', c: 0x3a0d1d }, shoes: { id: 'boots' }, acc: { id: 'watch' }, held: { id: 'cash' }, bg: '#ffe23a' }),
  look({ handle: 'county.blues', skin: 'tan', hair: { id: 'buzz', c: 0x2a1c14 }, eyes: 'bored', mouth: 'flat', mark: 'barcode', top: { id: 'jumpsuit' }, bottom: { id: 'jumpsuit' }, shoes: { id: 'slides' }, acc: { id: 'monitor' }, bg: '#7cc3ff' }),
  look({ handle: 'tag.crew', skin: 'pale', hat: { id: 'bandana' }, eyes: 'side', mouth: 'smirk', mark: 'scar', top: { id: 'flannel', c: 0x1d3a8a }, neck: { id: 'tennis' }, bottom: { id: 'camo' }, shoes: { id: 'hightop' }, held: { id: 'spray', c: 0x6cf542 }, acc: { id: 'bandana' }, bg: '#161616' }),
  look({ handle: 'late.night', skin: 'brown', hat: { id: 'fitted', c: 0xf4f4f4, m: 0xdfe6ee }, eyes: 'sleepy', mouth: 'gold', ears: { id: 'hoops' }, top: { id: 'puffer', c: 0x151517 }, neck: { id: 'piece' }, bottom: { id: 'sweats' }, shoes: { id: 'foam', c: 0x151517 }, acc: { id: 'crossbody' }, held: { id: 'duffel' }, bg: '#ff4fa3' }),
];
const PAL = { hoodie: [0x151517, 0xd7141a, 0x1d4ed8, 0x6cf542, 0xf2f2f2, 0xff7ab6], logo: [0xd7141a, 0x111111, 0x2de2e6], puffer: [0xc9ced6, 0x0a8a8a, 0xff6a00, 0x151517, 0x5a2bd6],
  jersey: [0xb3121b, 0x1d3a8a, 0x111111, 0x0a8a8a, 0xf2c230], tee: [0x151517, 0xf2f2f2, 0x6f6f6f], varsity: [0x1b2a4a, 0x3a0d0d, 0x111111, 0x0a5a3a], denim: [0x4f79b5, 0x2b3f66, 0x9bb8dd, 0x1a1a1a],
  cargo: [0x2a2a2c, 0x7c7a52, 0x4a5a3a, 0xb8b0a0], dye: [0xe9c14d, 0x151214, 0xd8262e, 0x2de2e6, 0xff7ab6, 0xf3f3f3, 0x6cf542, 0x2b6cff, 0x3a2616], hat: [0x151517, 0xf4f4f4, 0x0a8a8a, 0xe8742a, 0xd7141a, 0x6cf542],
  accent: [0xd7141a, 0x1d3a8a, 0x6cf542, 0xff7a1a, 0x5a2bd6, 0x2de2e6], bg: ['#ff4fa3', '#2f5bff', '#ff7a1a', '#6cff4a', '#ffe23a', '#7cc3ff', '#161616', '#c89bf5', '#ededed', '#ff3b30', '#008080'] };
function rollLook(seed, o = {}) {   // drop 02's new traits only with NEW_TRAITS on (or o.newTraits): off, the roll is the same as before, draw for draw
  const nt = o.newTraits ?? NEW_TRAITS, r = mulberry32(seed), pick = a => a[Math.floor(r() * a.length)], keys = s => Object.keys(NAMES[s]).filter(k => nt || !isNewTrait(s, k)), non = s => keys(s).filter(k => k !== 'none');
  const u = r(), skin = u < .005 ? 'missing' : u < .015 ? 'sadmac' : u < .035 ? 'happymac' : u < .055 ? 'chrome' : u < .075 ? 'dialog' : u < .105 ? 'bsod' : u < .135 ? 'alien' : u < .165 ? 'noob' : u < .205 ? 'emoji' : pick(Object.keys(SKIN));
  const top = pick(keys('top')), eyes = r() < .03 ? 'laser' : pick(keys('eyes').filter(k => k !== 'laser'));
  const L = look({ handle: 'roll_' + seed.toString(16).padStart(4, '0'), skin, eyes, mouth: pick(keys('mouth')), mark: r() < .45 ? pick(non('mark')) : 'none',
    hair: { id: pick(non('hair')), a: pick(PAL.dye), b: pick(PAL.dye), c: pick(PAL.dye), s: pick(PAL.dye) }, hat: { id: r() < .45 ? pick(non('hat')) : 'none', c: pick(PAL.hat), m: pick(PAL.accent) },
    eyewear: { id: r() < .4 ? pick(non('eyewear')) : 'none' }, ears: { id: r() < .35 ? pick(nt ? ['phones', 'studs', ...Object.keys(NEWT.ears)] : ['phones', 'studs']) : 'none', c: pick(PAL.accent) },
    top: { id: top, c: pick(PAL[{ puffer: 'puffer', jersey: 'jersey', tee: 'tee', varsity: 'varsity' }[top] ?? 'hoodie']), lc: pick(PAL.logo), print: pick(Object.keys(PRINTS)), logo: r() < .7 ? 'box' : 'small' },
    neck: { id: r() < .5 ? pick(non('neck')) : 'none' }, bottom: { id: pick(keys('bottom')), c: pick(PAL.denim.concat(PAL.cargo)) },
    shoes: { id: pick(keys('shoes')), a: pick(PAL.accent), a2: pick(PAL.accent), m: pick(PAL.accent), c: pick([0xe9e2cf, 0x6cf542, 0x151517, 0xff7ab6]) },
    held: { id: r() < .35 ? pick(non('held')) : 'none', c: pick(PAL.accent) }, acc: { id: r() < .3 ? pick(non('acc')) : 'none', c: pick([0xe7bd4a, 0xdfe6ee, 0x151517]) }, bg: pick(PAL.bg) });
  if (nt) { const r2 = mulberry32(seed ^ 0x2545f491); for (const s of PARAM) { const e = L[s] && NEWI[L[s].id]; if (e && e.cw) L[s].cw = Math.floor(r2() * e.cw.length); } }   // (its own stream: the main roll never moves)
  return L;
}
const credits = L => [NAMES.eyes[L.eyes] + ' eyes', NAMES.mouth[L.mouth], NAMES.hair[L.hair.id], NAMES.hat[L.hat.id], NAMES.eyewear[L.eyewear.id], NAMES.top[L.top.id], NAMES.neck[L.neck.id],
  NAMES.bottom[L.bottom.id], NAMES.shoes[L.shoes.id], NAMES.held[L.held.id], NAMES.acc[(L.acc || {}).id || 'none'], NAMES.ears[L.ears.id], L.mark !== 'none' ? NAMES.mark[L.mark] : null].filter(x => x && x !== 'none').join(' · ');


// ───────────────────────── FIT STREET DROP 02 (the traits pass, 2026-09-29): 60 new traits. Additive only: every trait above is untouched.
// Streetwear, jewellery and collector pieces for Fit Street's drop and the Drip Ladder. Every brand, logo and silhouette is invented.
// NEWT is the registry: slot → id → [name, tier (the sim's: common · rare · epic · grail), colourways ([name, colours…]), why (grails)].
// Each is marked new, and rollLook skips them unless NEW_TRAITS is on (or rollLook(seed, { newTraits: true })), so the city's walkers
// don't change until slime keeps or kills each one (world/TRAITS-NEW.md). A look picks a colourway with { id, cw: 0…n-1 }.
// Rigging (the segment bake): head pieces draw on H (they ride the head); neck pieces sit on the chest with onFront inside x −5…4;
// tops stay at y ≥ 9, bottoms and shoes keep the legs' x split; held things stay at y < 12 on x ≥ 0 (the right hand); acc says `as`.
export let NEW_TRAITS = false;
export function setNewTraits(on) { NEW_TRAITS = !!on; }
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
// ── neck (B, on the chest's front with onFront; x −5…4, so nothing crosses into the arms)
function chainBand(B, low, half, rows, col) { let py = null;   // a chain `rows` thick along chainV's curve; col(x, y, k) → [colour, layer], k: 0 bottom · 1 middle · 2 top
  for (let x = -half; x < half; x++) { const y = Math.round(17 - (17 - low) * (1 - ((x + .5) / half) ** 2)), top = py === null ? y : Math.max(y, py), bot = Math.min(y, py ?? y) - rows + 1;
    for (let yy = bot; yy <= top; yy++) { const [c, l] = col(x, yy, yy === bot ? 0 : yy === top ? 2 : 1); B.onFront(x, yy, c, l, 2); } py = y; } }
const goldLink = G => (x, y) => [((x + y) & 1) ? G : shade(G, .8), 2];
Object.assign(NECK, {
  pearls(B, p) { const [, P] = cwOf('pearls', p); chainBand(B, 13, 4, 1, (x, y) => [((x + y) & 1) ? P : shade(P, .84), 1]); B.onFront(-1, 12, P, 1); B.onFront(0, 12, shade(P, .84), 1); },
  choker(B, p) { const [, v] = cwOf('choker', p); chainBand(B, 16, 3, 2, (x, y, k) => v ? [k === 2 ? 0x1a1a1e : 0xe7bd4a, k === 2 ? 1 : 2] : [ICE2(x, y), 1]); B.onFront(-1, 14, v ? 0xe7bd4a : 0xffffff, v ? 2 : 1); },
  catpiece(B, p) { const [, G, E] = cwOf('catpiece', p); chainBand(B, 14, 4, 1, goldLink(G)); B.onFront(-1, 13, G, 2);
    ['X.....X', 'XX...XX', 'XXXXXXX', 'XEXXXEX', 'XXXNXXX', '.XXXXX.'].forEach((r, j) => { for (let i = 0; i < 7; i++) { const ch = r[i]; if (ch === '.') continue;
      B.onFront(-4 + i, 13 - j, ch === 'E' ? E : ch === 'N' ? 0xff7ab6 : ((i + j) % 3 ? G : shade(G, 1.15)), ch === 'X' ? 2 : 1); } }); },
  icecuban(B, p) { const [, G] = cwOf('icecuban', p); chainBand(B, 12, 4, 3, (x, y, k) => k === 1 ? [ICE2(x, y), 1] : [((x & 1) ? G : shade(G, .82)), 2]); },
  cuffs(B, p) { const [, R, G] = cwOf('cuffs', p), ice = R === 'ice'; chainBand(B, 15, 3, 2, goldLink(G));
    ['...GGGG...', '.RRG..GRR.', 'R..R..R..R', 'R..R..R..R', 'R..R..R..R', '.RR....RR.'].forEach((r, j) => { for (let i = 0; i < 10; i++) { const ch = r[i]; if (ch === '.') continue;
      B.onFront(-5 + i, 13 - j, ch === 'G' ? G : (ice ? ICE2(i, j) : R), ch === 'G' || !ice ? 2 : 1); } }); },
});
// ── tops (B; y ≥ 9 so nothing rides the legs)
const shirt = (B, c, long = true, l = 0) => { B.box(-6, 9, -3, 6, 18, 4, c, l); if (long) { B.box(-8, 10, -2, -5, 18, 2, c, l); B.box(5, 10, -2, 8, 18, 2, c, l); } else { B.box(-8, 14, -2, -5, 18, 2, c, l); B.box(5, 14, -2, 8, 18, 2, c, l); } };
const art = (B, rows, pal, x0, top, z = 3) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = typeof pal[r[i]] === 'function' ? pal[r[i]](i, j) : pal[r[i]]; if (c !== undefined) B.set(x0 + i, top - j, z, c); } });
Object.assign(TOPS, {
  catee(B, p) { const [, C] = cwOf('catee', p); shirt(B, C, false);
    art(B, ['O......O', 'OO....OO', 'ODDDDDDO', 'OGKOOGKO', 'OOOOOOOO', 'KOOPPOOK', '.OOOOOO.'], { O: 0xf08a24, D: 0xb85a10, G: 0x2ecc40, K: 0x151515, P: 0xff7ab6 }, -4, 16); },
  tapetee(B, p) { const [, C] = cwOf('tapetee', p); shirt(B, C, false);
    for (const [z, sx] of [[3, 1], [-3, -1]]) for (let x = -6; x < 6; x++) for (let y = 9; y < 18; y++) { const d = (((sx * x - y) % 12) + 12) % 12; if (d <= 2) B.set(x, y, z, d === 1 && ((x + y) & 3) < 2 ? 0x151515 : 0xffd21f); }
    for (const x of [-8, 7]) for (let y = 14; y < 18; y++) for (let z = -2; z < 2; z++) if ((((z - y) % 12) + 12) % 12 <= 2) B.set(x, y, z, 0xffd21f); },
  dyehoodie(B, p) { const [, A, Bc, Cc] = cwOf('dyehoodie', p), cs = [A, Bc, Cc], dye = (x, y, z) => { const a = Math.atan2(y - 13, x + .5 + (z < 0 ? 3 : 0)), r = Math.hypot(y - 13, x + .5); return cs[((Math.floor(a / (Math.PI * 2) * 6 + r * .45) % 3) + 3) % 3]; };
    B.box(-6, 9, -3, 6, 18, 4, dye); B.box(-8, 10, -2, -5, 18, 2, dye); B.box(5, 10, -2, 8, 18, 2, dye);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, shade(dye(x, 9, z), .75)); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, shade(dye(x, 10, z), .75));
    B.box(-6, 17, -4, 6, 19, 2, (x, y, z) => shade(dye(x, y, z), .85)); B.box(-4, 10, 4, 4, 13, 5, (x, y, z) => shade(dye(x, y, z), .9));
    for (const x of [-2, 1]) for (let y = 13; y < 17; y++) B.set(x, y, 4, 0xf4f4f4); },
  trackjkt(B, p) { const [, C, S2, Pp] = cwOf('trackjkt', p); shirt(B, C, true);
    for (let x = -6; x < 6; x++) { for (const y of [15, 16, 17]) { B.set(x, y, 3, S2); B.set(x, y, -3, S2); } B.set(x, 14, 3, Pp); B.set(x, 14, -3, Pp); }
    for (let y = 10; y < 18; y++) { for (const z of [-1, 0]) { B.set(-8, y, z, S2); B.set(7, y, z, S2); } B.set(-8, y, 1, Pp); B.set(7, y, 1, Pp); }   // one stripe and a piping down each sleeve
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, shade(C, .75)); for (const x0 of [-8, 5]) for (let x = x0; x < x0 + 3; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, shade(C, .75));
    B.box(-4, 17, -3, 4, 19, 3, S2); for (let y = 9; y < 19; y++) B.set(-1, y, y > 16 ? 3 : 4, 0xbdbdbd, 2); },
  bball(B, p, sk) { const [, C, N] = cwOf('bball', p), M = shade(C, .9); B.box(-5, 9, -3, 5, 18, 4, (x, y, z) => ((x + y + z) & 1) ? C : M); B.box(-6, 9, -3, 6, 12, 4, (x, y, z) => y === 9 ? N : (((x + y + z) & 1) ? C : M));
    for (const y of [16, 17]) for (const x of [-5, -4, 3, 4]) for (let z = -3; z < 4; z++) { if (z < -2 || z > 2) B.del(x, y, z); else B.set(x, y, z, sk.c(x, y, z), sk.layer); }
    for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, sk.c(x, y, 3), sk.layer);
    for (const [x, y] of [[-3, 17], [2, 17], [-2, 16], [1, 16], [-1, 15], [0, 15]]) B.set(x, y, 3, N); for (const x of [-3, 2]) for (let y = 9; y < 16; y++) { B.set(x === -3 ? -5 : 4, y, 0, N); }
    B.text('04', -4, 14, 3, N); B.textBack('04', 2, 14, -3, N); },
  buffalo(B, p) { const [, C] = cwOf('buffalo', p), D = shade(C, .55), chk = (a, b) => { const i = (a >> 1) & 1, j = (b >> 1) & 1; return i && j ? 0x141414 : (i || j ? D : C); }, pl = (x, y, z) => chk(x + z + 8, y);
    shirt(B, pl, true); B.box(-6, 17, -4, 6, 19, 2, pl);
    for (let y = 9; y < 17; y++) for (const x of [-2, -1, 0, 1]) B.set(x, y, 3, 0x151517);
    for (const x of [-3, 2]) for (let y = 9; y < 17; y++) B.set(x, y, 4, pl(x, y, 4)); for (const [x, y] of [[-3, 17], [-4, 17], [2, 17], [3, 17]]) B.set(x, y, 4, pl(x, y, 4)); },
  bootleg(B, p) { const [, C] = cwOf('bootleg', p); shirt(B, C, false);
    art(B, ['Y.YYY.YY.Y', 'PPPKKKKPPP', 'PZPSSSSPZP', 'PPZKKKKZPP', 'PZPSSSSPZP', 'PPPSGGSPPP', 'W.WW.WWW.W'], { Y: 0xffd21f, K: 0x151515, S: 0xc8744a, Z: 0xffd21f, G: 0xe7bd4a, W: 0xf2f2f2, P: (i, j) => lerpHex(0xff4fa3, 0x5a2bd6, j / 6) }, -5, 16);
    for (const y of [15, 13, 11]) for (let x = -4; x < 4; x++) if ((x + y) % 5) B.set(x, y, -3, 0xf2f2f2); },
  slabtee(B, p) { const [, C] = cwOf('slabtee', p); shirt(B, C, false);
    art(B, ['RRWRWWRR', 'LLLLLLLL', 'LHHHHHHL', 'LHSSSSHL', 'LHKSSKHL', 'LHSSSSHL', 'LHHHHHHL', 'LLLLLLLL'], { R: 0xd7141a, W: 0xffffff, L: 0xd9dde3, S: 0xf5c518, K: 0x151515, H: (i, j) => [0xc8f0ff, 0xffc8f0, 0xfff4b0, 0xc8ffd8][(i + j) & 3] }, -4, 16); },
  chenille(B, p) { const [, W, Sl, Pt] = cwOf('chenille', p);
    B.box(-6, 9, -3, 6, 18, 4, W); B.box(-9, 10, -2, -5, 18, 2, Sl, 1); B.box(5, 10, -2, 9, 18, 2, Sl, 1);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, (z & 1) ? Pt : W); for (const x0 of [-9, 5]) for (let x = x0; x < x0 + 4; x++) for (let z = -2; z < 2; z++) B.set(x, 10, z, (x & 1) ? Pt : W);
    B.box(-5, 17, -4, 5, 19, 2, x => (x & 1) ? Pt : W); for (const y of [11, 13, 15]) B.set(-1, y, 4, 0xe9e9e9, 2);
    art(B, ['..XX', '.XX.', 'XXXX', '.XX.', 'XX..'], { X: (i, j) => ((i + j) & 1) ? Pt : shade(Pt, .85) }, 0, 16, 4);
    for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) B.set(-9, 14 + dy, -1 + dz, Pt); },
  bubble(B, p) { const [, C, l] = cwOf('bubble', p), Lt = shade(C, 1.14), D = shade(C, .7), q = (x, y) => y % 3 === 0 ? D : (y % 3 === 2 ? Lt : C);
    B.box(-7, 9, -5, 7, 19, 6, q, l);
    for (let y = 9; y < 19; y++) if (y % 3 === 0) { for (let x = -7; x < 7; x++) { B.del(x, y, 5); B.del(x, y, -5); } for (let z = -5; z < 6; z++) { B.del(-7, y, z); B.del(6, y, z); } }
    B.box(-11, 9, -4, -7, 18, 4, q, l); B.box(7, 9, -4, 11, 18, 4, q, l);
    for (let y = 9; y < 18; y++) if (y % 3 === 0) for (let z = -4; z < 4; z++) { B.del(-11, y, z); B.del(10, y, z); }
    B.box(-4, 18, -4, 4, 19, 4, D, l); for (let y = 9; y < 18; y++) if (y % 3) B.set(-1, y, 5, 0x3a3d44, 2); },
  leather(B, p) { const [, C, Hw] = cwOf('leather', p), D = shade(C, .7), Lt = shade(C, 1.6);
    shirt(B, (x, y, z) => ((x * 3 + y * 7 + z * 5) % 11 === 0) ? Lt : C, true, 1); B.box(-6, 17, -4, 6, 19, 2, C, 1);
    for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, D, 1); B.box(3, 9, 4, 5, 10, 5, Hw, 2);
    for (const [x, y] of [[-5, 17], [-4, 17], [-4, 16], [-3, 16], [-3, 15], [-2, 15], [3, 17], [4, 17], [2, 16], [3, 16], [1, 15], [2, 15]]) B.set(x, y, 4, D, 1);
    for (let y = 9; y < 17; y++) B.set(Math.round(-2 + (y - 9) * 5 / 7), y, 4, Hw, 2);
    B.set(-5, 16, 4, Hw, 2); B.set(4, 16, 4, Hw, 2); for (const x of [-8, 7]) for (const y of [10, 11]) B.set(x, y, 0, Hw, 2); },
  furcoat(B, p) { const [, C, C2, K] = cwOf('furcoat', p), fur = (x, y, z) => { const h = hash3(x, y, z); if (K !== undefined && h % 6 === 0) return K; return (h & 3) === 0 ? C2 : (h & 3) === 1 ? shade(C, .85) : C; };
    B.box(-7, 9, -5, 7, 19, 6, fur); B.box(-10, 9, -4, -7, 18, 4, fur); B.box(7, 9, -4, 10, 18, 4, fur); B.box(-6, 16, -6, 6, 19, 7, fur);
    for (let y = 9; y < 16; y++) for (let k = -7; k < 7; k++) { if (hash3(k, y, 7) % 3 === 0) B.set(k, y, 6, fur(k, y, 6)); if (hash3(k, y, 8) % 3 === 0) B.set(k, y, -6, fur(k, y, -6)); }
    for (let y = 9; y < 18; y++) for (let z = -4; z < 4; z++) { if (hash3(y, z, 9) % 3 === 0) B.set(-11, y, z, fur(-11, y, z)); if (hash3(y, z, 10) % 3 === 0) B.set(10, y, z, fur(10, y, z)); }
    for (let y = 9; y < 16; y++) { B.set(-1, y, 5, shade(C, .55)); B.del(-1, y, 6); } },
});
// ── bottoms (B; legs split at x −1 | 0 below the crotch, waistband y 10)
const belt = (B, x0, x1, z0, z1, c = 0x1a1a1a) => { for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) B.set(x, 10, z, c); };
const crotch = (B, y1, z0, z1) => { for (let y = 0; y < y1; y++) for (let z = z0; z < z1; z++) { B.del(-1, y, z); B.del(0, y, z); } };
Object.assign(BOTTOMS, {
  bigjeans(B, p) { const [, C, Sp] = cwOf('bigjeans', p), L = shade(C, 1.22), D = shade(C, .74);
    for (const [x0, x1, wl, wr] of [[-7, 0, 1, 0], [0, 7, 0, 1]]) { B.box(x0, 4, -3, x1, 10, 4, C); for (let y = 1; y < 4; y++) { const w = y & 1; B.box(x0 - w * wl, y, -3 - w, x1 + w * wr, y + 1, 4, w ? D : C); } }
    crotch(B, 7, -4, 5);
    for (const x0 of [-7, 1]) for (let x = x0; x < x0 + 5; x++) for (const y of [6, 7, 8]) B.set(x, y, 3, y === 7 ? L : shade(L, .92));
    belt(B, -6, 6, -2, 3); B.set(-1, 10, 3, 0xd8d8d8, 2); B.set(0, 10, 3, 0xd8d8d8, 2);
    if (Sp) for (let x = -8; x < 8; x++) for (let y = 1; y < 10; y++) if (B.has(x, y, 3) && hash3(x, y, 3) % 7 === 0) B.set(x, y, 3, Sp[hash3(y, x, 5) % Sp.length]); },
  parachute(B, p) { const [, C, T] = cwOf('parachute', p), D = shade(C, .78), Lt = shade(C, 1.25), cr = (x, y, z) => (((y * 2 + x + z) % 5 + 5) % 5 === 0) ? Lt : ((((y + z) % 4) + 4) % 4 === 0 ? D : C);
    B.box(-7, 2, -3, 0, 10, 4, cr, 1); B.box(0, 2, -3, 7, 10, 4, cr, 1); crotch(B, 7, -3, 4);
    for (const x of [-8, 7]) { B.box(x, 4, -2, x + 1, 8, 3, D, 1); for (let z = -2; z < 3; z++) B.set(x, 8, z, shade(C, .6), 1); }
    for (const x of [-4, 3]) { B.set(x, 2, 4, T, 1); B.set(x, 1, 4, T, 1); } belt(B, -6, 6, -2, 3); },
  snaps(B, p) { const [, C, S2] = cwOf('snaps', p);
    B.box(-6, 2, -3, 0, 11, 3, C); B.box(0, 2, -3, 6, 11, 3, C); crotch(B, 7, -3, 3);
    for (let y = 2; y < 10; y++) for (const [x, xo] of [[-6, -7], [5, 6]]) { for (const z of [-1, 0]) B.set(x, y, z, S2); if (y % 2 === 0) B.set(xo, y, -1, 0xdfe6ee, 2); }
    for (let x = -6; x < 6; x++) for (let z = -3; z < 3; z++) B.set(x, 2, z, shade(C, .75)); belt(B, -6, 6, -3, 3, shade(C, .8)); B.set(-1, 9, 3, 0xf2f2f2); B.set(0, 9, 3, 0xf2f2f2); },
  meshshorts(B, p) { const [, C, St, Sk] = cwOf('meshshorts', p), M = shade(C, .88);
    for (const x0 of [-5, 1]) { B.box(x0, 2, -2, x0 + 4, 7, 2, Sk); for (let x = x0; x < x0 + 4; x++) for (let z = -2; z < 2; z++) { B.set(x, 6, z, St); B.set(x, 4, z, St); } }
    B.box(-6, 7, -3, 0, 11, 3, (x, y, z) => ((x + y + z) & 1) ? C : M); B.box(0, 7, -3, 6, 11, 3, (x, y, z) => ((x + y + z) & 1) ? C : M); crotch(B, 9, -3, 3);
    for (let y = 7; y < 11; y++) for (const z of [-1, 0, 1]) { B.set(-6, y, z, St); B.set(5, y, z, St); } belt(B, -6, 6, -3, 3, St); },
  digicamo(B, p) { const [, cols] = cwOf('digicamo', p), cm = (x, y, z) => cols[hash3(x >> 1, y >> 1, z >> 1) % 4];
    B.box(-7, 2, -3, 0, 3, 4, cm); B.box(0, 2, -3, 7, 3, 4, cm); B.box(-6, 3, -2, 0, 11, 3, cm); B.box(0, 3, -2, 6, 11, 3, cm); crotch(B, 6, -3, 4);
    B.box(-7, 4, -1, -6, 8, 2, cm); B.box(6, 4, -1, 7, 8, 2, cm); for (let z = -1; z < 2; z++) { B.set(-7, 8, z, cols[2]); B.set(6, 8, z, cols[2]); } belt(B, -6, 6, -2, 3); },
  doubleknee(B, p) { const [, C] = cwOf('doubleknee', p), D = shade(C, .82), K = shade(C, .62);
    B.box(-7, 2, -3, 0, 10, 3, C); B.box(0, 2, -3, 7, 10, 3, C); crotch(B, 6, -3, 3);
    B.box(-6, 4, 3, -2, 9, 4, D); B.box(1, 4, 3, 5, 9, 4, D); for (const x0 of [-6, 1]) for (let x = x0; x < x0 + 4; x++) B.set(x, 8, 3, K);
    B.box(-8, 6, 0, -7, 9, 1, K); B.box(7, 5, -1, 8, 9, 2, D); belt(B, -6, 6, -2, 3, 0x3a2616); B.set(-1, 10, 3, 0xc0c0c0, 2); B.set(0, 10, 3, 0xc0c0c0, 2); },
});
// ── shoes (B; left x −6…−2, right 1…5 (slides reach 0), toes at +z)
const pairs = fn => { for (const x0 of [-6, 1]) fn(x0, x0 < 0 ? x0 : x0 + 4); };   // (x0, the outer face's x)
Object.assign(SHOES, {
  courtlow(B, p) { const [, A, U] = cwOf('courtlow', p), W = U ?? 0xf6f6f6; pairs((x0, o) => {
    B.box(x0, 0, -3, x0 + 5, 1, 6, U ? 0x222222 : 0xe9e2cf); B.box(x0, 1, -3, x0 + 5, 4, 5, W); B.box(x0 + 1, 4, 0, x0 + 4, 6, 3, W);
    B.box(x0 + 1, 1, -4, x0 + 4, 4, -3, A); B.set(x0 + 2, 5, 2, A); for (let x = x0 + 1; x < x0 + 4; x++) B.set(x, 3, 5, shade(W, .9));
    for (const [y, z] of [[2, 1], [3, 1], [1, 1], [2, 0], [2, 2]]) B.set(o, y, z, A); }); },
  lugboot(B, p) { const [, C, S2] = cwOf('lugboot', p), D = shade(C, .72); pairs((x0, o) => {
    B.box(x0, 0, -3, x0 + 5, 1, 6, (x, y, z) => (z & 1) ? 0x161616 : 0x2a2a2a); B.box(x0, 1, -3, x0 + 5, 2, 6, 0x2e2e2e);
    B.box(x0, 2, -2, x0 + 5, 6, 5, (x, y) => y >= 5 ? D : C, 1); B.box(x0, 2, 5, x0 + 5, 4, 6, C, 1);
    for (let z = -3; z < 6; z += 2) { B.set(o, 1, z, S2); } for (let y = 3; y < 6; y++) { B.set(x0 + 1 + (y & 1) * 2, y, 5, S2); B.set(o, y, 4, 0xc0c0c0, 2); } }); },
  chunky(B, p) { const [, U, A, M] = cwOf('chunky', p); pairs((x0, o) => {
    B.box(x0, 0, -4, x0 + 5, 1, 7, shade(M, .6)); B.box(x0, 1, -4, x0 + 5, 3, 7, (x, y, z) => (y === 2 && ((z + 8) % 3 === 0)) ? shade(M, .82) : M);
    B.box(x0, 3, -3, x0 + 5, 6, 6, U); for (let x = x0; x < x0 + 5; x++) for (let z = 3; z < 6; z++) B.set(x, 3, z, A);
    for (let z = -3; z < 5; z++) B.set(o, 4 + ((z + 4) >> 1 & 1), z, A); for (let y = 3; y < 6; y++) B.set(x0 + 2, y, -3, A);
    for (let z = 0; z < 4; z++) B.set(x0 + 2, 5, z, (z & 1) ? 0xffffff : shade(U, .9)); }); },
  furslide(B, p) { const [, F, So, K] = cwOf('furslide', p), fz = (x, y, z) => { const h = hash3(x, y, z); if (K !== undefined && h % 5 === 0) return K; return (h & 1) ? F : shade(F, .88); };
    for (const x0 of [-5, 1]) { B.box(x0, 1, -2, x0 + 4, 6, 4, So); B.box(x0 - 1, 0, -3, x0 + 5, 1, 5, 0x1a1a1a); B.box(x0 - 1, 1, -1, x0 + 5, 4, 5, fz);
      for (let x = x0 - 1; x < x0 + 5; x++) { for (let z = -1; z < 5; z++) if (hash3(x, z, 5) % 3 === 0) B.set(x, 4, z, fz(x, 4, z)); for (let y = 1; y < 4; y++) if (hash3(x, y, 6) % 3 === 0) B.set(x, y, 5, fz(x, y, 5)); } } },
  courtking(B, p) { const [, A, Bc] = cwOf('courtking', p), W = 0xf7f7f7; pairs((x0, o) => { const i = x0 < 0 ? x0 + 4 : x0;
    B.box(x0, 0, -2, x0 + 5, 1, 6, 0xefe9dc); B.box(x0, 1, -2, x0 + 5, 2, 6, W);
    B.box(x0, 2, -2, x0 + 5, 6, 5, (x, y, z) => y >= 5 ? A : ((z >= 3 && y <= 2) || z <= -2) ? A : W);
    for (let z = -2; z < 5; z++) { B.set(o, 4, z, Bc); B.set(i, 4, z, Bc); } B.set(o, 4, 1, 0xdfe6ee, 2);
    for (const [y, z] of [[3, 2], [2, 2], [3, 3], [3, 1]]) B.set(o, y, z, Bc); for (const x of [x0 + 1, x0 + 3]) B.set(x, 2, 5, shade(A, .6)); }); },
  clogs(B, p) { const [, C] = cwOf('clogs', p), D = shade(C, .82), cork = 0xcfb58a; pairs((x0, o) => {
    B.box(x0, 0, -3, x0 + 5, 1, 6, 0x2a2016); B.box(x0, 1, -3, x0 + 5, 3, 6, (x, y) => y === 2 ? shade(cork, .88) : cork);
    B.box(x0, 3, -1, x0 + 5, 5, 6, (x, y, z) => ((x + y + z) & 1) ? C : D); B.box(x0 + 1, 5, 0, x0 + 4, 6, 5, C); B.del(x0, 4, 5); B.del(x0 + 4, 4, 5);
    B.box(x0 + 1, 3, -3, x0 + 4, 5, -1, 0xf4f4f4); B.set(o, 4, 1, 0xe7bd4a, 2); B.set(o, 4, 2, 0xe7bd4a, 2); B.set(o, 3, 1, 0xe7bd4a, 2); }); },
  chromes(B, p) { const [, C] = cwOf('chromes', p), col = (x, y, z) => Array.isArray(C) ? C[((y + z) % C.length + C.length) % C.length] : (y >= 5 ? shade(C, .8) : C); pairs((x0, o) => {
    B.box(x0, 0, -2, x0 + 5, 1, 6, 0x151515); B.box(x0, 1, -2, x0 + 5, 6, 5, col, 2); B.box(x0, 1, 5, x0 + 5, 3, 6, col, 2);
    for (let y = 3; y < 6; y++) B.set(x0 + 2, y, 5, 0xf4f4f4, 1); B.set(o, 4, 1, 0x151515); B.set(o, 5, 1, 0x151515);
    for (let k = 0; k < 4; k++) B.set(o, 1 + k, 3 - k, 0xffffff, 1); }); },   // a highlight streak: it reads as chrome at pfp size
});
// ── accessories (as: the body part each rides)
Object.assign(ACC, {
  digital(B, p, as) { as('armR'); const [, C, Lc] = cwOf('digital', p); B.box(5, 10, -3, 9, 12, 3, C, 1); B.box(9, 9, -2, 10, 12, 2, C, 1); B.box(10, 10, -1, 11, 12, 1, Lc, 3); B.set(9, 10, 2, 0x9a9aa0, 2); },
  rings(B, p, as) { const [, G, St] = cwOf('rings', p);
    for (const [part, x0, xo] of [['armL', -8, -9], ['armR', 5, 8]]) { as(part); for (let x = x0; x < x0 + 3; x++) B.set(x, 7, 2, G, 2); for (let z = -2; z < 2; z++) B.set(xo, 7, z, G, 2);
      for (let z = -2; z < 1; z++) B.set(xo, 6, z, G, 2); B.set(xo, 6, 0, St, 1); } },
  sling(B, p, as) { as('torso'); const [, C, Hw, Pt] = cwOf('sling', p), pat = (x, y) => Pt !== undefined && ((x + y) % 3 === 0 || (x - y) % 3 === 0) ? Pt : C;
    for (let i = 0; i < 10; i++) B.onFront(4 - i, 17 - i, C, 1); const fz = B.frontZ(-1, 12) ?? 3;
    B.box(-4, 11, fz + 1, 2, 15, fz + 4, pat, 1); for (let x = -4; x < 2; x++) B.set(x, 14, fz + 3, Hw, 2); B.set(3, 16, (B.frontZ(3, 16) ?? 3) + 1, Hw, 2); },
  pinky(B, p, as) { const [, G] = cwOf('pinky', p); as('armR'); for (let z = -2; z < 1; z++) B.set(8, 6, z, G, 2); B.box(9, 6, -2, 10, 8, 0, (x, y, z) => ICE2(x, y, z), 1);
    as('armL'); B.box(-9, 10, -3, -5, 11, 3, (x, y, z) => ((x + z) & 1) ? G : shade(G, .8), 2); },
  bustdown(B, p, as) { const [, G] = cwOf('bustdown', p); as('armL'); B.box(-9, 10, -3, -5, 12, 3, (x, y, z) => ICE2(x, y, z), 1); B.box(-10, 9, -2, -9, 12, 2, G, 2); B.box(-11, 10, -1, -10, 12, 1, (x, y, z) => ICE2(x, y, z), 1);
    as('armR'); B.box(5, 10, -3, 9, 11, 3, (x, y, z) => ICE2(x, y, z), 1); },
});
// ── held (right hand; everything below y 12: it rides the arm, one piece from the shoulder)
Object.assign(HELD, {
  phonecase(B, p) { const [n, C, l, K] = cwOf('phonecase', p); B.box(5, 4, 2, 9, 11, 3, 0x111111, 1); B.box(5, 4, 3, 9, 11, 4, (x, y) => K !== undefined && hash3(x, y, 3) % 3 === 0 ? K : C, l);
    B.box(5, 8, 4, 7, 10, 5, 0x222222, 1); if (n === 'pink bear') { B.set(5, 11, 3, C, l); B.set(8, 11, 3, C, l); } },
  bodegabag(B, p) { const [, C, T] = cwOf('bodegabag', p);
    B.box(8, 1, -2, 13, 7, 3, (x, y) => y === 1 ? shade(C, .85) : C, 1); for (let x = 9; x < 12; x++) B.set(x, 5, 2, T, 1); for (const [x, y] of [[9, 3], [11, 3], [9, 2], [10, 2], [11, 2]]) B.set(x, y, 2, T, 1);
    B.box(9, 7, -1, 11, 8, 1, 0x6cf542, 1); B.box(11, 7, 0, 13, 9, 2, 0xff8c1a, 1); strand(B, [[9, 7, 0], [7, 9, 0]], C, 1, 1); strand(B, [[12, 7, 0], [7, 9, 0]], C, 1, 1); },
  kicksbox(B, p) { const [, C, Lid, Lg] = cwOf('kicksbox', p);
    B.box(8, 3, -4, 12, 9, 5, (x, y) => y >= 7 ? Lid : C); for (let z = -4; z < 5; z++) B.set(11, 7, z, shade(Lid, .7));
    B.box(11, 4, 1, 12, 6, 4, 0xf4f4f4); B.set(11, 5, 2, 0x151515); for (const [y, z] of [[5, -2], [4, -2], [6, -2], [5, -1], [5, -3]]) B.set(11, y, z, Lg); },
  bricks(B, p) { const [, Band] = cwOf('bricks', p), bill = (x, y, z) => y === 7 ? 0xcfe8b8 : (((y + z) & 1) ? 0x5fa84a : 0x6fbf58);
    B.box(5, 4, 2, 10, 10, 6, bill); for (let y = 4; y < 10; y++) { B.set(7, y, 5, Band); B.set(7, y, 2, Band); } for (let z = 2; z < 6; z++) { B.set(7, 9, z, Band); B.set(7, 4, z, Band); } },
  vinyl(B, p) { const [, C, l, E] = cwOf('vinyl', p);
    B.box(5, 4, 2, 8, 7, 5, C, l); B.box(4, 7, 1, 9, 12, 6, C, l); for (let x = 4; x < 9; x++) B.set(x, 9, 5, E, 1); B.set(5, 10, 5, E, 1); B.set(7, 10, 5, E, 1); B.set(6, 8, 5, shade(C, .6), l === 3 ? 3 : 1); },
});

installShoes2({ SHOES, NEWT, NEWI, NAMES });
installTopsRefit({ TOPS, PRINTS, cwOf, shade, lerpHex, mulberry32, RAINBOW });   // (before the necklines are stamped on TOPS)
installOuter({ TOPS, cwOf, shade, hash3 });   // refit 1: puffy + structured tops (world/fit/refit-outer.js)
// every top declares its neckline (contract NECKLINES; world/fit/body.js TOPFIT) and the fitting body reads the drawn torso
for (const id in TOPS) TOPS[id].neckline = TOPFIT[id]?.neckline ?? 'crew';
installFit({ draw: L => compose(L, { torso: true }) });
installJewelry({ NECK, MOUTH, EARS, ACC, NEWT, NEWI, NAMES });
installHead({ EYE, MOUTH, EYEWEAR, HATS, EARS, MARKS, faceGrid, cwOf, Grid });
installLower({ BOTTOMS, SHOES, ACC });   // (after the shoe and jewellery passes: it wraps their final draws)
// the drop by tier (common → grail), for the fit check and the trait board
const TIER_ORDER = ['common', 'rare', 'epic', 'grail'];
const newTraitList = () => Object.values(NEWI);

export { Grid, voxGeo, MATS, skinOf, compose, build, pose, dispose, look, LOOKS, rollLook, NAMES, mulberry32, lerpHex, shade, RAINBOW, PINWHEEL, SLOTS, SLOTLAB, PARAM, NEW, RARE, TIER, credits };
export { NEWT, NEWI, isNewTrait, TIER_ORDER, newTraitList };
