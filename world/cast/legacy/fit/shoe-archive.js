// Earlier shoe study retained intact for the user’s final keep/kill review.
// Distinct IDs preserve decisions and avoid replacing the revised six-shoe set.
// Native shoes for the connected lower body. Every cell stays on its rigid foot.
// Local u grows outwards: u0 is x-2 on the left and x1 on the right. The inner
// two-voxel gap, heel z-3 and toe z5 are fixed; z6 is a raised toe spring only.
// Palette rows: [name, upper, accent, midsole/welt, outsole, lace/highlight].
export const ARCHIVE_SHOES = {
  early_plinth_court: { name: 'Plinth courts', tier: 'common', cw: [
    ['chalk / forest', 0xf6f3e9, 0x174d37, 0xd9d1be, 0x8b6a45, 0xeceee5],
    ['bone / claret', 0xefe9dc, 0x6b1526, 0xe5ddcf, 0x3e3030, 0xfaf7f0],
    ['washed navy', 0x2b3f66, 0xe6dfcd, 0xcec6b3, 0x3a3c42, 0xf6f2e8],
  ], why: 'A quiet court upper, a heavy cupsole and a single inset house patch.' },
  early_curb_skate: { name: 'Curb skates', tier: 'common', cw: [
    ['oxblood suede', 0x662b3f, 0x29242b, 0xded5c2, 0x7f5538, 0xe9e2d3],
    ['black / gum', 0x242428, 0x4d4b52, 0xece6d8, 0x9b6940, 0xe5e2d6],
    ['slate green', 0x6e7c70, 0x242b2a, 0xded5c2, 0x514942, 0xd8ddd7],
  ], why: 'A padded square toe and broad rubber sidewall under an oversized lace panel.' },
  early_relay_runner: { name: 'Relay runners', tier: 'common', cw: [
    ['silver / volt', 0xd2dadf, 0x68767d, 0xe9e7de, 0x353b41, 0xc6ff3a],
    ['chalk / cobalt', 0xe6e4d8, 0x2556a5, 0xe4dac4, 0x4b5357, 0xe4813d],
    ['graphite / ember', 0x25262a, 0x5d646a, 0x363b3f, 0x111316, 0xd14635],
  ], why: 'A tapered forefoot, clipped heel and staggered sole blocks with a sharp color insert.' },
  early_welt_derby: { name: 'Welt derbies', tier: 'common', cw: [
    ['black patent', 0x17191d, 0x34373b, 0x4c443b, 0x181818, 0xa8aeb5],
    ['oxblood', 0x5b202b, 0x361720, 0x846a4c, 0x1b1b1e, 0xe4d6b8],
    ['bone leather', 0xddd4c2, 0xad9d84, 0x5e503f, 0x242322, 0xf2eadc],
  ], why: 'A glossy squared vamp, stitched welt and a real recessed arch above the ground.' },
  early_yard_moc: { name: 'Yard mocs', tier: 'common', cw: [
    ['wheat', 0xb7915b, 0x73573a, 0xcab287, 0x392f27, 0xe5d3ae],
    ['washed olive', 0x65705a, 0x363e32, 0xb8ad92, 0x30362f, 0xe0dccb],
    ['dark tobacco', 0x5a3c2b, 0x332c25, 0xb99c75, 0x282521, 0xd8c7a7],
  ], why: 'A blunt moc toe, a pale apron seam and a wedge sole cut for workwear.' },
  early_liquid_split: { name: 'Liquid split toes', tier: 'common', cw: [
    ['liquid silver', 0xcdd5dd, 0x6e7780, 0x292d33, 0x12161c, 0xf6f9fa],
    ['smoked mirror', 0x68717e, 0x272b34, 0xa7aeb7, 0x191c22, 0xe8edf2],
    ['champagne / ink', 0xc7b58c, 0x5f5645, 0x2b2a26, 0x151612, 0xf1e7c8],
  ], why: 'A divided metal toe on a slim dark sole; the split is carved into the shoe itself.' },
};

const shade = (c, f) => {
  const s = n => Math.min(255, Math.max(0, Math.round(((c >> n) & 255) * f)));
  return (s(16) << 16) | (s(8) << 8) | s(0);
};

// Inclusive horizontal spans, one for each z from -3 through 5. The profile
// helpers author actual volume; detailing below only repaints existing cells.
function pair(B, colors, draw, collarLayer = 0) {
  const [, u, a, m, o, d] = colors, c = { u, a, m, o, d };
  for (const side of [-1, 1]) {
    const X = n => side < 0 ? -2 - n : 1 + n;
    const set = (n, y, z, color, layer = 0) => B.set(X(n), y, z, color, layer);
    const paint = (n, y, z, color, layer = 0) => { if (B.has(X(n), y, z)) set(n, y, z, color, layer); };
    const span = (y, z, lo, hi, color, layer = 0) => { for (let n = lo; n <= hi; n++) set(n, y, z, color, layer); };
    const row = (y, spans, color, layer = 0) => spans.forEach(([lo, hi], i) => span(y, i - 3, lo, hi, color, layer));
    draw({ set, paint, span, row }, c);
    // This collar is the complete leg attachment. Nothing projects beyond its
    // depth at y3; the shin never owns any part of it.
    for (let n = 0; n <= 2; n++) for (let z = -1; z <= 1; z++) {
      if (!B.has(X(n), 2, z)) set(n, 2, z, c.u, collarLayer);
      set(n, 3, z, z === -1 ? c.a : c.u, collarLayer);
    }
  }
}

const DRAW = {
  early_plinth_court(B, c) { pair(B, c, ({ row, span, paint }, p) => {
    const sole = [[1, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]];
    row(0, sole, p.o); row(1, sole, p.m);
    row(2, [[1, 2], [0, 3], [0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [1, 3], [1, 3]], p.u);
    span(2, -2, 0, 3, p.a); // heel counter
    for (const z of [0, 1, 2]) paint(z === 1 ? 2 : 1, 2, z, p.d);
    // The house mark is a short stepped block on the outer quarter.
    paint(3, 2, 0, p.a); paint(4, 2, 1, p.a); paint(4, 2, 2, p.a);
    for (const z of [-2, 0, 2, 4]) paint(4, 1, z, shade(p.m, .86));
    paint(2, 2, 4, shade(p.u, .88));
  }); },
  early_curb_skate(B, c) { pair(B, c, ({ row, span, paint }, p) => {
    const base = [[1, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]];
    row(0, base, p.o);
    row(1, [[0, 4], [0, 4], [0, 5], [0, 5], [0, 5], [0, 5], [0, 5], [0, 4], [1, 3]], p.m);
    span(1, 6, 1, 3, p.m);
    row(2, [[1, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]], p.u);
    for (const z of [-2, -1, 0]) paint(4, 2, z, p.a);
    for (const z of [1, 2, 3]) { paint(1, 2, z, p.a); paint(2, 2, z, p.d); paint(3, 2, z, p.a); }
    span(2, 4, 0, 4, shade(p.u, .82)); // broad suede toe cap
    paint(4, 2, 1, p.d); paint(4, 2, 2, p.d);
    for (const z of [-1, 0, 1, 2, 3]) paint(5, 1, z, z === 1 ? p.a : p.m);
  }); },
  early_relay_runner(B, c) { pair(B, c, ({ row, span, paint }, p) => {
    row(0, [[1, 3], [0, 4], [0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [1, 3], [1, 2]], p.o);
    row(1, [[0, 4], [0, 5], [0, 4], [0, 3], [0, 4], [0, 5], [0, 5], [0, 4], [1, 3]], p.m);
    span(1, 6, 1, 2, p.m);
    row(2, [[1, 2], [0, 3], [0, 3], [0, 3], [0, 3], [0, 4], [1, 3], [1, 3], [1, 2]], p.u);
    for (const [n, z] of [[3, -2], [3, -1], [3, 0], [3, 1], [4, 2], [3, 3], [1, 4]]) paint(n, 2, z, p.a, 1);
    for (const z of [0, 1, 2]) paint(1, 2, z, p.d);
    for (const [n, z] of [[5, -2], [4, -1], [4, 1], [5, 2], [5, 3]]) paint(n, 1, z, z === -2 || z === 2 ? p.d : p.a);
    paint(2, 2, 4, shade(p.u, .84)); paint(2, 2, -2, p.d);
  }); },
  early_welt_derby(B, c) { pair(B, c, ({ row, paint, span }, p) => {
    // The arch opens only below the continuous welt; heel and toe still plant.
    row(0, [[0, 3], [0, 3], [1, 2], [1, 2], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]], p.o);
    row(1, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]], p.m);
    row(2, [[1, 2], [0, 3], [0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]], p.u, 1);
    span(2, 3, 0, 4, p.a, 1); // squared vamp seam
    for (const z of [0, 1, 2]) paint(1, 2, z, p.a, 1);
    paint(2, 2, 1, p.d, 2); paint(2, 2, 2, p.a, 1);
    for (const z of [-2, 0, 2, 4]) paint(4, 1, z, p.d);
    paint(1, 2, 4, shade(p.u, 1.4), 1);
  }, 1); },
  early_yard_moc(B, c) { pair(B, c, ({ row, paint, span }, p) => {
    const wedge = [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]];
    row(0, wedge, p.o); row(1, wedge, p.m);
    row(2, [[1, 2], [0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [1, 3]], p.u);
    for (const z of [1, 2, 3, 4]) { paint(0, 2, z, p.d); paint(4, 2, z, p.d); }
    span(2, 4, 1, 3, p.d); // continuous U-shaped apron seam
    span(2, -2, 0, 3, p.a);
    for (const z of [0, 1]) { paint(1, 2, z, p.a); paint(2, 2, z, p.d); }
    for (const z of [-2, 0, 2, 4]) paint(4, 0, z, shade(p.o, 1.3));
    paint(3, 2, -1, p.d, 2);
  }); },
  early_liquid_split(B, c) { pair(B, c, ({ row, span, paint }, p) => {
    const sole = [[1, 3], [0, 3], [0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [0, 4]];
    row(0, sole, p.o); row(1, sole, p.m);
    for (const y of [0, 1]) { span(y, 5, 0, 1, y ? p.m : p.o); span(y, 5, 3, 4, y ? p.m : p.o); }
    row(2, [[1, 2], [0, 3], [0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [0, 4]], p.u, 2);
    span(2, 5, 0, 1, p.u, 2); span(2, 5, 3, 4, p.u, 2);
    for (const z of [-2, -1, 0]) paint(3, 2, z, p.a, 2);
    paint(2, 2, 4, p.a, 2); // the split travels back as a crease, not a deep cut
    for (const [n, z] of [[4, 1], [4, 2], [3, 3], [3, 4]]) paint(n, 2, z, p.d, 1);
    paint(0, 2, 5, p.d, 1); paint(4, 2, 5, p.a, 2);
  }, 2); },
};

// Install after installLower: these draws already obey the native shoe envelope
// and must not pass through the legacy height-compression adapter.
export function installArchivedShoes({ SHOES, NEWT, NEWI, NAMES }) {
  for (const [id, trait] of Object.entries(ARCHIVE_SHOES)) {
    const { name, tier, cw, why } = trait;
    NEWT.shoes[id] = [name, tier, cw, why];
    NEWI[id] = { id, slot: 'shoes', name, tier, cw, why, new: true, origin: 'lower' };
    NAMES.shoes[id] = name;
    SHOES[id] = (B, p = {}) => DRAW[id](B, cw[(((p.cw | 0) % cw.length) + cw.length) % cw.length]);
  }
}
