// STORE OBJECTS · the shared drawing kit (owner: the store-objects agent; interiors/store/ only). Every object is authored ONCE in
// character voxels (0.05 m, FORMAT.md's grain) through a PAINTER that can also draw it at the city grain (0.1 m) for `far`:
// coordinates stay in 0.05 units and the painter snaps them to the Vol's own grain (a start floors, an end ceils, so nothing thin
// vanishes: a one-voxel detail becomes one 0.1 cube). A build reads `P.far` to drop the fine detail that turns to mush at 0.1
// (can rims, logo patches, price ticks, glints) and keep what reads from the street: colour runs, frames, lit panels, big letters.
import { textMask } from '../../vox.js';
import { TOD } from '../../kit.js';
import { hash } from '../../style.js';

export const G = 0.05, CELL = 5;                       // character grain; one 0.25 m cell = 5 voxels
export const LIT = () => (TOD.night ? 3 : 1);          // cooler / case / menu light boxes: gloss by day, lit at night (the city's rule)
export const GLOW = 3;                                 // screens, neon, tubes and bulbs: always lit (STYLE §3)
export const K = {
  ink: 0x17171b, iron: 0x1d1d24, char: 0x33333b, dark: 0x2a2d38, white: 0xf7f7f2, cream: 0xfff0d0, bone: 0xe9e5dc, lino: 0xd8d3c8,
  steel: 0xc9ced6, chrome: 0xdfe3e8, alu: 0xaab1bc, glint: 0xeaf6ff, glass: 0x9fd8ff, frost: 0xbfe6ff, plexi: 0xd6eef8,
  wood: 0xa4652f, woodD: 0x6e3e19, woodL: 0xc98a4b, kraft: 0xc49a6c, kraftD: 0xa77f52,
  red: 0xe8232a, green: 0x14a83b, yellow: 0xffe23a, lime: 0x6cff4a, cyan: 0x2de2e6, pink: 0xff4fa3, gold: 0xe7bd4a, goldHi: 0xffd84a,
  blue: 0x2f5bff, sky: 0x3fa9f5, orange: 0xff7a1a, purple: 0x7a3cff, teal: 0x12b3a0, brown: 0x8b4a24, amber: 0xc0661c, maroon: 0x8a1c2b,
  felt: 0x1f6b45, velvet: 0x2a1f4a, vinyl: 0xd7263d, skin: 0xe0b48f,
};
export const pick = (arr, v) => arr[((v % arr.length) + arr.length) % arr.length];
export const hh = (a, b = 0, c = 0) => hash(a * 7 + 13, b * 131 + 7, c * 977 + 3);   // 0..1

// ───────────────────────── the painter: 0.05-unit coordinates into a Vol of either grain
export function painter(V, far = false) {
  const k = far ? .5 : 1, a = v => Math.floor(v * k + 1e-6), b = v => Math.ceil(v * k - 1e-6);
  const P = {
    far, k, V,
    box(x0, y0, z0, x1, y1, z1, c, l = 0) {
      if (c === undefined || c === null || x1 <= x0 || y1 <= y0 || z1 <= z0) return;
      const X0 = a(x0), Y0 = a(y0), Z0 = a(z0), X1 = Math.max(X0 + 1, b(x1)), Y1 = Math.max(Y0 + 1, b(y1)), Z1 = Math.max(Z0 + 1, b(z1));
      V.box(X0, Y0, Z0, X1, Y1, Z1, typeof c === 'function' ? (x, y, z) => c(x / k, y / k, z / k) : c, l);
    },
    set(x, y, z, c, l = 0) { V.set(a(x), a(y), a(z), c, l); },
    clear(x0, y0, z0, x1, y1, z1) { P.box(x0, y0, z0, x1, y1, z1, -1); },
    // a disc / cylinder along y (centre cx, cz, radius r) — stools, tables, pies, cans seen from above
    cyl(cx, cz, r, y0, y1, c, l = 0) { for (let x = Math.floor(cx - r); x < cx + r; x++) for (let z = Math.floor(cz - r); z < cz + r; z++)
      if ((x + .5 - cx) ** 2 + (z + .5 - cz) ** 2 <= r * r) P.box(x, y0, z, x + 1, y1, z + 1, c, l); },
    // lettering one voxel proud on a face. dir: '+z' reads along +x · '-x' along +z · '+x' along −z (as seen from outside that face)
    text(s, x, ytop, z, c, l = 0, o = {}) { const M = o.font === 5 ? textMask(s) : mask3(s), d = o.dir || '+z';
      for (let j = 0; j < M.h; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) {
        if (d === '+z') P.set(x + i, ytop - j, z, c, l); else if (d === '-x') P.set(x, ytop - j, z + i, c, l); else P.set(x, ytop - j, z - i, c, l); }
      return M.w; },
    textC(s, cx, ytop, z, c, l = 0, o = {}) { const w = (o.font === 5 ? textMask(s) : mask3(s)).w; return P.text(s, Math.round(cx - w / 2), ytop, z, c, l, o); },
    // a toon glint: a short diagonal streak on glass (dropped at far, where it would be a 0.1 blob)
    glint(x, y, n, z, dx = 1) { if (far) return; for (let t = 0; t < n; t++) P.set(x + t * dx, y + t, z, K.glint, 1); },
  };
  return P;
}
export const textW = (s, font = 3) => (font === 5 ? textMask(s) : mask3(s)).w;

// ───────────────────────── 3×5 small print (the city's px3 shapes, signage/art.js; kept here so this set loads on its own)
const G3 = { A: '.X.|X.X|XXX|X.X|X.X', B: 'XX.|X.X|XX.|X.X|XX.', C: '.XX|X..|X..|X..|.XX', D: 'XX.|X.X|X.X|X.X|XX.', E: 'XXX|X..|XX.|X..|XXX', F: 'XXX|X..|XX.|X..|X..',
  G: '.XX|X..|X.X|X.X|.XX', H: 'X.X|X.X|XXX|X.X|X.X', I: 'XXX|.X.|.X.|.X.|XXX', J: '..X|..X|..X|X.X|.X.', K: 'X.X|X.X|XX.|X.X|X.X', L: 'X..|X..|X..|X..|XXX',
  M: 'X...X|XX.XX|X.X.X|X...X|X...X', N: 'X..X|XX.X|X.XX|X..X|X..X', O: '.X.|X.X|X.X|X.X|.X.', P: 'XX.|X.X|XX.|X..|X..', Q: '.X.|X.X|X.X|XX.|.XX', R: 'XX.|X.X|XX.|X.X|X.X',
  S: '.XX|X..|.X.|..X|XX.', T: 'XXX|.X.|.X.|.X.|.X.', U: 'X.X|X.X|X.X|X.X|XXX', V: 'X.X|X.X|X.X|X.X|.X.', W: 'X...X|X...X|X.X.X|XX.XX|X...X', X: 'X.X|X.X|.X.|X.X|X.X',
  Y: 'X.X|X.X|.X.|.X.|.X.', Z: 'XXX|..X|.X.|X..|XXX', 0: 'XXX|X.X|X.X|X.X|XXX', 1: '.X.|XX.|.X.|.X.|XXX', 2: 'XX.|..X|.X.|X..|XXX', 3: 'XX.|..X|.X.|..X|XX.',
  4: 'X.X|X.X|XXX|..X|..X', 5: 'XXX|X..|XX.|..X|XX.', 6: '.XX|X..|XXX|X.X|XXX', 7: 'XXX|..X|.X.|.X.|.X.', 8: 'XXX|X.X|XXX|X.X|XXX', 9: 'XXX|X.X|XXX|..X|XX.',
  '.': '.|.|.|.|X', '-': '...|...|XXX|...|...', '/': '..X|..X|.X.|X..|X..', $: '.XX|XX.|.X.|.XX|XX.', '#': 'X.X|XXX|X.X|XXX|X.X', '&': '.X.|X.X|.X.|X.X|.XX',
  '?': 'XX.|..X|.X.|...|.X.', '!': 'X|X|X|.|X', "'": 'X|X|.|.|.', ':': '.|X|.|X|.', '+': '...|.X.|XXX|.X.|...', '%': 'X.X|..X|.X.|X..|X.X', '@': '.X.|X.X|XXX|X..|.XX',
  '¢': '.X.|XXX|X..|XXX|.X.', '·': '.|.|X|.|.', ' ': '..|..|..|..|..', ',': '.|.|.|X|X', '*': '...|X.X|.X.|X.X|...', '=': '...|XXX|...|XXX|...', '(': '.X|X.|X.|X.|.X', ')': 'X.|.X|.X|.X|X.' };
const M3 = new Map();
export function mask3(s) { s = String(s).toUpperCase(); let m = M3.get(s); if (m) return m;
  const gs = [...s].map(ch => (G3[ch] ?? G3['?']).split('|')), w = gs.reduce((t, g) => t + g[0].length + 1, -1), rows = [];
  for (let r = 0; r < 5; r++) rows.push(gs.map(g => g[r]).join('.'));
  M3.set(s, m = { w: Math.max(0, w), h: 5, at: (i, j) => rows[j][i] === 'X', s }); return m; }

// ───────────────────────── invented stock (no real brands: colours + marks only; the names are for the lore and the signs)
// chips [bag, band, mark]: CRUNCHO · FUEGO RINGS · SALTY DOG · DUSTY'S BBQ · LIMON LOCO · CHEEZ BOMB · PLATANO KING · SOUR PUSS · MIDNITE
export const CHIPS = [[K.red, K.yellow, K.white], [K.orange, K.red, K.ink], [K.blue, K.white, K.yellow], [K.brown, K.orange, K.yellow], [K.green, K.white, K.lime],
  [0xffc21a, K.blue, K.red], [0x25b84c, K.yellow, K.ink], [K.purple, K.lime, K.white], [K.ink, K.pink, K.yellow]];
// cans and 20s [body, band]: BRRR COLA · LUCKY LIME · NITRO · PAPI POP · GINGR · BLUE ICE · MANGO MAMI · ROOTS · TAMARINDO
export const SODA = [[K.red, K.white], [K.green, K.yellow], [K.ink, K.lime], [K.purple, K.orange], [0xefe6c8, K.green], [K.blue, K.white], [K.orange, K.pink], [K.brown, K.cream], [0xb5542a, K.yellow]];
// malt 40s [glass, label]: OLD GOLD 40 · BIG DOG · STEEL DRUM · KING'S RANSOM
export const MALT = [[0x7a3a12, K.goldHi], [0x5a2a0c, K.red], [0x7a3a12, K.white], [0x3d6b2a, K.gold]];
// cereal [box, band, mascot]: CRUNCH KING · LOOPZ · CHOCO BITS · MARSHMALLOW MOB · FROSTY FLAKES · BRAN MAN
export const CEREAL = [[K.yellow, K.red, K.blue], [K.pink, K.purple, K.yellow], [K.brown, K.orange, K.white], [K.blue, K.yellow, K.pink], [K.sky, K.white, K.orange], [K.orange, K.brown, K.green]];
// tins and jars [label, lid]: beans, tomato, corn, tuna, soup, peas
export const TINS = [[K.red, K.steel], [K.orange, K.steel], [K.yellow, K.steel], [K.blue, K.steel], [K.green, K.steel], [K.white, K.red]];
// spirits [glass, label, cap, shape: 0 square · 1 tall · 2 round]: RIVER BOURBON · NINE LIVES VODKA · PAPA'S RUM · GIN ROYALE · COGNAC XO …
export const SPIRITS = [[0xa4521a, K.cream, K.ink, 0], [0xd8eef5, K.blue, K.white, 1], [0x5a2a0c, K.gold, K.gold, 2], [0x2f7a3a, K.white, K.red, 1], [0x8a3a14, K.ink, K.gold, 2],
  [0xe9e0c0, K.red, K.ink, 1], [0x3a1d0c, K.goldHi, K.ink, 0], [0x2c4a9a, K.white, K.chrome, 1], [0xc07a20, K.green, K.gold, 0]];

// ───────────────────────── stock painters: one product at (x, y) on a shelf spanning z0..z1 (front face at z1 − 1)
export function bag(P, x, y, z0, z1, b, tall = 0) {   // chip bag 4 × 5(+1): crimped top, logo patch
  const h = 5 + tall; P.box(x, y, z0, x + 4, y + h, z1, b[0]); if (P.far) return;
  P.box(x, y + h - 1, z1 - 1, x + 4, y + h, z1, b[1]); P.box(x + 1, y + 1, z1 - 1, x + 3, y + 3, z1, b[2]); P.set(x + 3, y + h - 1, z1 - 1, -1);
}
export function can(P, x, y, z0, z1, b) { P.box(x, y, z0, x + 2, y + 3, z1, b[0], 1); if (!P.far) { P.box(x, y + 1, z1 - 1, x + 2, y + 2, z1, b[1], 1); P.box(x, y + 3, z0, x + 2, y + 4, z1 - 1, K.steel, 2); } }
export function bottle(P, x, y, z0, z1, b) {   // 20 oz: body, band, neck + cap
  P.box(x, y, z0, x + 2, y + 4, z1, b[0], 1); if (P.far) return;
  P.box(x, y + 1, z1 - 1, x + 2, y + 2, z1, b[1], 1); P.box(x, y + 4, z0 + 1, x + 1, y + 5, z1 - 1, b[0], 1); P.set(x, y + 5, z1 - 2, b[1]);
}
export function forty(P, x, y, z0, z1, b) {   // malt 40: tall brown glass, big label
  P.box(x, y, z0, x + 2, y + 6, z1, b[0], 1); if (P.far) return; P.box(x, y + 2, z1 - 1, x + 2, y + 4, z1, b[1]); P.box(x, y + 6, z0 + 1, x + 1, y + 8, z1 - 1, b[0], 1); P.set(x, y + 8, z1 - 2, K.gold, 2);
}
export function cereal(P, x, y, z0, z1, b) {   // cereal box 4 × 7: title band, bowl, mascot dot
  P.box(x, y, z0, x + 4, y + 7, z1, b[0]); if (P.far) { P.box(x, y + 5, z1 - 1, x + 4, y + 7, z1, b[1]); return; }
  P.box(x, y + 5, z1 - 1, x + 4, y + 6, z1, b[1]); P.box(x + 1, y + 1, z1 - 1, x + 3, y + 3, z1, K.white); P.set(x + 2, y + 3, z1 - 1, b[2]);
}
export function tin(P, x, y, z0, z1, b) { P.box(x, y, z0, x + 2, y + 2, z1, b[0]); if (!P.far) P.box(x, y + 2, z0, x + 2, y + 3, z1, b[1], 2); else P.box(x, y + 2, z0, x + 2, y + 3, z1, b[0]); }
export function spirit(P, x, y, z0, z1, b) {   // liquor bottle: three shapes, a label, a neck and cap
  const w = b[3] === 1 ? 2 : 3, hb = b[3] === 1 ? 6 : 5; P.box(x, y, z0, x + w, y + hb, z1, b[0], 1); if (P.far) return;
  P.box(x, y + 1, z1 - 1, x + w, y + 3, z1, b[1]); const nx = x + (w === 3 ? 1 : 0); P.box(nx, y + hb, z0 + 1, nx + 1, y + hb + 2, z1 - 1, b[0], 1); P.set(nx, y + hb + 2, z1 - 2, b[2], b[2] === K.gold ? 2 : 0);
}
export const WIDTH = { bag: 4, can: 2, bottle: 2, forty: 2, cereal: 4, tin: 2, spirit: 3 };
const DRAW = { bag, can, bottle, forty, cereal, tin, spirit };
// a shelf row of facings (runs of 2–4 of one product, a 1-voxel gap between runs, now and then one missing: stock that gets bought)
export function stockRow(P, kind, x0, x1, y, z0, z1, brands, seed, o = {}) {
  if (P.far) return farRow(P, kind, x0, x1, y, z0, z1, brands, seed, o);
  const w = kind === 'spirit' ? 3 : WIDTH[kind], gap = o.gap ?? 1; let x = x0, n = 0;
  while (x + w <= x1) { const bi = (hh(seed, n, 7) * brands.length) | 0, run = 2 + ((hh(seed, n, 3) * 3) | 0);
    for (let r = 0; r < run && x + w <= x1; r++, x += w) { if (!o.full && hh(seed, n * 7 + r, 11) < (o.sold ?? .07)) continue; DRAW[kind](P, x, y, z0, z1, brands[bi], (hh(seed, r, n) < .3) ? 1 : 0); }
    x += gap; n++; }
}
// ── the FAR shelf (wave 2 review: "a colourful blur"): at 0.1 m every product is a column pattern on whole cubes, and a row is two or three
// brands in long runs, so each shelf reads by silhouette (scalloped bag tops, can rims, bottle necks with gaps, boxes with title bands,
// short tins) and by a few big colour blocks, not by noise. Columns run bottom → top; null = air. Clipped to the rows the shelf has.
const FARCOLS = {
  bag: b => [[b[0], b[1], b[0]], [b[0], b[1], null]],
  can: b => [[b[0], K.steel, b[0]]],
  tin: b => [[b[0], K.steel]],
  bottle: b => [[b[0], b[0], b[1]], [null]],
  cereal: b => [[b[0], b[0], b[1]], [shadeK(b[0], .82), shadeK(b[0], .82), b[1]]],   // boxes shoulder to shoulder, alternate tones
  forty: b => [[b[0], b[0], b[1], K.gold], [null]],
  spirit: b => b[3] === 1 ? [[b[0], b[1], b[0], b[2]], [null]] : [[b[0], b[1], b[2]], [null]],
};
export const evenUp = v => v + (v & 1);
function farRow(P, kind, x0, x1, y, z0, z1, brands, seed, o) {
  const ex0 = evenUp(x0), ex1 = x1 - (x1 & 1), ey = evenUp(y), room = o.room ?? 8, rows = Math.max(1, (evenUp(y + room) - 2 - ey) >> 1);
  const pal = [0, 1, 2].map(k => brands[(hh(seed, k, 31) * brands.length) | 0]); let x = ex0, n = 0;
  while (x < ex1) { const cols = FARCOLS[kind](pal[n % 3]), run = 3 + ((hh(seed, n, 3) * 3) | 0);
    for (let r = 0; r < run; r++) { if (x + cols.length * 2 > ex1) { x = ex1; break; }
      cols.forEach((col, i) => col.forEach((c, j) => { if (c !== null && j < rows) P.box(x + i * 2, ey + j * 2, z0, x + i * 2 + 2, ey + j * 2 + 2, z1, c, kind === 'bottle' || kind === 'spirit' || kind === 'forty' ? 1 : 0); })); x += cols.length * 2; }
    x += 2; n++; }
}

// ───────────────────────── fixtures shared by many objects
// gondola / wall shelving: kick plate, uprights, a back panel, shelf boards with a price channel (and its tags) at the front
export function shelving(P, o) {
  const { x0, x1, z0, z1, levels, top } = o, fr = o.frame ?? K.bone, kick = o.kick ?? K.char, back = o.back ?? shadeK(fr, .92), strip = o.strip ?? K.white;
  P.box(x0, 0, z0, x1, levels[0], z1, kick); P.box(x0, levels[0] - 1, z0, x1, levels[0], z1, fr);
  if (o.backPanel !== false) P.box(x0, levels[0], z0, x1, top, z0 + 1, back);
  for (const x of [x0, x1 - 1]) P.box(x, 0, z0, x + 1, top, z0 + 2, fr);
  levels.slice(1).forEach(y => { if (P.far) { const e = evenUp(y); P.box(x0, e - 2, z0, x1, e, z1 - 1, fr); P.box(x0, e - 2, z1 - 1, x1, e, z1, strip); return; }   // far: one clean strip row
    P.box(x0, y - 1, z0, x1, y, z1 - 1, fr); P.box(x0, y - 2, z1 - 1, x1, y, z1, strip); for (let x = x0 + 2; x < x1 - 2; x += 5) if (hh(x, y, o.seed ?? 0) < .6) P.set(x, y - 2, z1 - 1, pick([K.yellow, K.orange, K.red], x + y)); });
  if (o.cap !== false) P.box(x0, top - 1, z0, x1, top, z0 + 3, fr);
}
export const shadeK = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
// a glass display case: base cabinet, a frame of thin rails (the glass itself is air: a toon glint says it is there), lit deck
export function glassCase(P, o) {
  const { x0, x1, z0, z1, base, top } = o, fr = o.frame ?? K.chrome, cab = o.cab ?? K.woodD, deck = o.deck ?? K.velvet;
  P.box(x0, 0, z0, x1, base, z1, cab); if (o.kick !== false) P.box(x0 + 1, 0, z1 - 1, x1 - 1, 2, z1, K.ink);
  P.box(x0, base, z0, x1, base + 1, z1, deck, o.deckLayer ?? 0);
  for (const x of [x0, x1 - 1]) for (const z of [z0, z1 - 1]) P.box(x, base, z, x + 1, top, z + 1, fr, 2);
  P.box(x0, top - 1, z0, x1, top, z0 + 1, fr, 2); P.box(x0, top - 1, z1 - 1, x1, top, z1, fr, 2); P.box(x0, top - 1, z0, x0 + 1, top, z1, fr, 2); P.box(x1 - 1, top - 1, z0, x1, top, z1, fr, 2);
  if (o.lightBar) P.box(x0 + 1, top - 2, z0 + 1, x1 - 1, top - 1, z0 + 2, K.cream, GLOW);
  P.glint(x0 + 2, base + 2, 3, z1 - 1); P.glint(x1 - 6, base + 3, 2, z1 - 1);
}
// a sign board with a one-row trim and lettering (3×5 small print or the 5×7), centred; returns the board width
export function sign(P, x0, y0, z, w, h, bg, fg, lines, o = {}) {
  P.box(x0, y0, z, x0 + w, y0 + h, z + (o.t ?? 1), bg, o.bgL ?? 0); if (o.trim) { P.box(x0, y0, z, x0 + w, y0 + 1, z + (o.t ?? 1), o.trim); P.box(x0, y0 + h - 1, z, x0 + w, y0 + h, z + (o.t ?? 1), o.trim); }
  const lh = o.font === 5 ? 8 : 6, tot = lines.length * lh - 1; let yt = y0 + Math.round((h + tot) / 2) - 1;
  for (const s of lines) { P.textC(s, x0 + w / 2, yt, z + (o.t ?? 1), fg, o.fgL ?? 0, o); yt -= lh; }
  return w;
}

// ───────────────────────── painter proxies: shifted (a sub-object drawn inside a bigger one) and mirrored in z (the back of a gondola)
export function off(P, dx, dy, dz) {
  return { far: P.far, k: P.k, V: P.V,
    box: (x0, y0, z0, x1, y1, z1, c, l) => P.box(x0 + dx, y0 + dy, z0 + dz, x1 + dx, y1 + dy, z1 + dz, typeof c === 'function' ? (x, y, z) => c(x - dx, y - dy, z - dz) : c, l),
    set: (x, y, z, c, l) => P.set(x + dx, y + dy, z + dz, c, l), clear: (x0, y0, z0, x1, y1, z1) => P.clear(x0 + dx, y0 + dy, z0 + dz, x1 + dx, y1 + dy, z1 + dz),
    cyl: (cx, cz, r, y0, y1, c, l) => P.cyl(cx + dx, cz + dz, r, y0 + dy, y1 + dy, c, l), glint: (x, y, n, z, d) => P.glint(x + dx, y + dy, n, z + dz, d),
    text: (s, x, yt, z, c, l, o) => P.text(s, x + dx, yt + dy, z + dz, c, l, o), textC: (s, cx, yt, z, c, l, o) => P.textC(s, cx + dx, yt + dy, z + dz, c, l, o) };
}
export function mirrorZ(P, D) {   // z → D − 1 − z: whatever faced +z now faces −z (no lettering: it would read backwards)
  return { far: P.far, k: P.k, V: P.V,
    box: (x0, y0, z0, x1, y1, z1, c, l) => P.box(x0, y0, D - z1, x1, y1, D - z0, typeof c === 'function' ? (x, y, z) => c(x, y, D - 1 - z) : c, l),
    set: (x, y, z, c, l) => P.set(x, y, D - 1 - z, c, l), clear: (x0, y0, z0, x1, y1, z1) => P.clear(x0, y0, D - z1, x1, y1, D - z0),
    cyl: (cx, cz, r, y0, y1, c, l) => P.cyl(cx, D - cz, r, y0, y1, c, l), glint: () => {}, text: () => 0, textC: () => 0 };
}

// ───────────────────────── the object record (FORMAT.md): every field, then build (0.05) and far (0.1) from ONE draw function.
// draw(P, o) gets o = { v (variant, wrapped), seed, W, D, H } in 0.05 units: floor/surface/ceiling W × H × D = foot × h; a wall piece's
// W × H is its face on the wall and D how far it sticks out (h).
export function obj(o, draw) {
  const wall = o.place === 'wall', W = o.foot[0] * CELL, D = wall ? Math.round(o.h / G) : o.foot[1] * CELL, H = wall ? o.foot[1] * CELL : Math.round(o.h / G), n = o.variants ?? 1;
  const run = (P, opt = {}) => draw(P, { seed: 0, ...opt, state: opt.state ?? o.states?.[0], v: (((opt.variant ?? 0) % n) + n) % n, W, D, H });
  const rec = { id: o.id, name: o.name, set: 'store', cat: o.cat, place: o.place ?? 'floor', foot: o.foot, h: o.h, mount: o.mount ?? null, rot: o.rot ?? 90,
    tops: o.tops ?? [], tiers: o.tiers, tags: o.tags ?? [], variants: n, sim: o.sim ?? null,
    build(V, opt) { run(painter(V), opt); }, far(V, opt) { run(painter(V, true), opt); } };
  for (const k of ['vnames', 'seat', 'states']) if (o[k] !== undefined) rec[k] = o[k];   // FORMAT's optional fields (wave 2)
  return rec;
}
