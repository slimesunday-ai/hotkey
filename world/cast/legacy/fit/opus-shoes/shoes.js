// Opus drop / shoes. Ten footwear TYPES, each its own silhouette and material,
// authored as whole rigid feet (no shared block, no panel paint over one last).
//
// Foot-local coordinates, mirrored per side exactly like the kept early studies:
//   u grows outwards from the fixed inner edge (u0 = x-2 left, x1 right), 0..5
//   y 0..3 (the leg's cloth starts at y4; nothing here may rise above y3)
//   z heel -> toe; ground cells stay inside z-3..5, z6 is a raised toe point only.
// Every shoe owns the 3x3 ankle socket (u0..2, y3, z-1..1) under the leg.
// Materials: 0 matte, 1 gloss, 2 metal. Palette rows: [name, ...colors].
// Ids are prefixed opus_. Invented names only; no real marks or designs.

const shade = (c, f) => {
  const s = n => Math.min(255, Math.max(0, Math.round(((c >> n) & 255) * f)));
  return (s(16) << 16) | (s(8) << 8) | s(0);
};
const SOCKET = (u, y, z) => y === 3 && u >= 0 && u <= 2 && z >= -1 && z <= 1;

// A tiny per-foot voxel pad. rows(y, z0, [[u0,u1], ...]) lays one span per z.
function pad() {
  const cells = new Map(), k = (u, y, z) => `${u},${y},${z}`;
  const F = {
    cells,
    set(u, y, z, c, l = 0) { cells.set(k(u, y, z), [u, y, z, c, l]); },
    del(u, y, z) { cells.delete(k(u, y, z)); },
    has(u, y, z) { return cells.has(k(u, y, z)); },
    get(u, y, z) { return cells.get(k(u, y, z)); },
    paint(u, y, z, c, l) { const q = cells.get(k(u, y, z)); if (q) cells.set(k(u, y, z), [u, y, z, c, l ?? q[4]]); },
    box(u0, u1, y0, y1, z0, z1, c, l = 0) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let u = u0; u <= u1; u++) F.set(u, y, z, c, l); },
    rows(y, z0, spans, c, l = 0) { spans.forEach((s, i) => { if (s) for (let u = s[0]; u <= s[1]; u++) F.set(u, y, z0 + i, c, l); }); },
    each(fn) { for (const q of [...cells.values()]) fn(...q); },
  };
  return F;
}

export const DESIGNS = [
  {
    id: 'opus_quarry_boot', name: 'Quarry 6-Eye', tier: 'common', wearer: 'dock & construction crews, the Yards, junkyard',
    why: 'A tall square work boot: lug sole and stitched welt, round bumper toe and a padded collar right up to the cuff.',
    cw: [['wheat / gum', 0xc8913e, 0x5c3a22, 0x2e241d, 0xf0c45a, 0x8d5a2b],
      ['blackout / safety', 0x2b2b30, 0x121215, 0x17171b, 0xffc21a, 0xff7a1a],
      ['brick / oat', 0x9b4f3a, 0x3a2620, 0x2a2422, 0xe6e1d6, 0xc49a6c]],
    // [upper, collar, lug, lace, toe bumper]
    build(F, [U, C, L, A, T]) {
      F.rows(0, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], L);
      F.rows(1, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], U);
      F.rows(2, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3], null], U);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], U);
      for (let z = -2; z <= 3; z++) F.paint(4, 1, z, z % 2 ? shade(T, 1.25) : T); // stitched welt line round the outer edge
      // padded collar ring and pull-on back
      for (const [u, z] of [[0, -3], [1, -3], [2, -3], [3, -3], [3, -2], [3, -1], [3, 0], [3, 1], [0, -2], [1, -2], [2, -2]]) F.paint(u, 3, z, C);
      // lugs: dark teeth stepping along the outer sole
      for (const z of [-3, -1, 1, 3, 5]) F.paint(z === -3 || z === 5 ? 3 : 4, 0, z, shade(L, 1.9));
      // rubber bumper round the toe
      for (const [u, y, z] of [[0, 1, 5], [1, 1, 5], [2, 1, 5], [3, 1, 5], [4, 1, 4], [3, 2, 4], [0, 2, 4], [1, 2, 4], [2, 2, 4]]) F.paint(u, y, z, T);
      // laces up the instep, tongue stub and metal speed hooks
      for (const [u, y, z] of [[1, 2, 3], [1, 3, 2], [0, 3, 2], [2, 3, 2]]) F.paint(u, y, z, A);
      F.paint(1, 2, 2, shade(U, .78));
      F.paint(3, 3, 1, 0xcfd3d8, 2); F.paint(3, 2, 2, 0xcfd3d8, 2);
    },
  },
  {
    id: 'opus_county_slip', name: 'County Issue', tier: 'common', wearer: 'inmates, the jail, release-day walks',
    why: 'Flattest closed shoe in the city: a two-row canvas slip-on with white foxing, stamped heel and a sock at the ankle.',
    cw: [['intake orange', 0xff7a1a, 0xf4f1ea, 0xd85d10, 0xf7f7f2, 0x17171b],
      ['county white', 0xeeebe2, 0xc9c6bd, 0xb9b5aa, 0xa7a9b1, 0x2f5bff],
      ['night-shift navy', 0x2b3a5c, 0xf4f1ea, 0x1b2640, 0xf7f7f2, 0xffc21a]],
    // [canvas, foxing, elastic gore, sock, stamp]
    build(F, [V, W, G, S, K]) {
      F.rows(0, -3, [[0, 2], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], W);
      F.rows(1, -3, [[0, 2], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], V);
      F.rows(2, -3, [[0, 2], [0, 3], [3, 3], [3, 3], [3, 3], [0, 3]], V);
      F.box(0, 2, 2, 2, -1, 1, S); F.box(0, 2, 3, 3, -1, 1, S);
      F.paint(3, 2, 0, G); F.paint(3, 2, -1, G); // elastic side gore
      for (const z of [4, 5]) for (let u = 0; u <= 3; u++) F.paint(u, 1, z, W); // white toe cap
      F.paint(3, 1, -3, W); F.paint(2, 1, -3, W);
      F.paint(3, 1, -1, K); F.paint(3, 1, 0, K); F.paint(3, 1, 1, K); // stencilled county number
    },
  },
  {
    id: 'opus_poolside_slide', name: 'Poolside Slides', tier: 'common', wearer: 'gym rats, hustlers on the corner, the beach and trailer park',
    why: 'A thick footbed and one puffy gloss strap over a white tube sock whose toes poke out the front.',
    cw: [['royal / tube white', 0x2f5bff, 0x17171b, 0x3a3b42, 0xf7f7f2, 0xe8232a],
      ['blackout / green stripe', 0x1d1d22, 0xd3d4d7, 0x2a2b30, 0xf7f7f2, 0x14a83b],
      ['hotel pink', 0xff4fa3, 0xf4f1ea, 0xe6e1d6, 0x17171b, 0xffe23a]],
    // [strap, bed, outsole, sock, sock stripe]
    build(F, [P, B, O, S, R]) {
      const bed = [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]];
      F.rows(0, -3, bed, O); F.rows(1, -3, bed, B);
      F.box(0, 2, 2, 2, -3, 0, S); F.box(0, 2, 2, 2, 5, 5, S); // the sock foot, toes past the strap
      F.box(0, 3, 2, 2, 1, 4, P, 1); F.box(0, 2, 3, 3, 2, 3, P, 1); // the strap: wide, two rows deep at its crown
      F.box(0, 2, 3, 3, -1, 0, R); // tube-sock stripe ring under the hem
      F.box(0, 2, 3, 3, 1, 1, P, 1); // the strap's crown reaches the front of the ankle
      for (const z of [-2, 0, 2, 4]) F.paint(4, 1, z, shade(B, .86)); // moulded bed edge
    },
  },
  {
    id: 'opus_puddle_clog', name: 'Puddle Clogs', tier: 'rare', wearer: 'nurses on the hospital block, suburban gardeners, beach',
    why: 'A bright foam clog: tall blunt toe dome punched with holes, open heel and a pivoting back strap.',
    cw: [['lime foam', 0x7bd94a, 0x1c6b33, 0xf4f1ea, 0x3d8f2a, 0xffffff],
      ['ward blue', 0x3fa9f5, 0x2f5bff, 0xf4f1ea, 0x1f6fb3, 0xffe23a],
      ['bubblegum', 0xff6fb5, 0x7a3cff, 0x17171b, 0xc23d82, 0xffe23a]],
    // [foam, strap, sock, hole shadow, rivet]
    build(F, [M, St, S, H, Rv]) {
      F.rows(0, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], shade(M, .8));
      F.rows(1, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], M);
      F.rows(2, -3, [[0, 3], [3, 3], [3, 4], [3, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], M);
      F.box(0, 2, 2, 2, -1, 0, S); F.box(0, 2, 3, 3, -1, 1, S); // open heel: real air behind the ankle, the sock shows
      F.rows(3, 2, [[0, 2], [0, 2], [0, 2]], M); // the tall toe dome (outer front corner left clear for the pockets-idle hand)
      for (let u = 0; u <= 3; u++) F.paint(u, 2, -3, St); F.paint(3, 2, -2, St); F.paint(4, 2, -1, Rv, 2);
      // ventilation holes: real cuts in the dome, dark floor beneath
      for (const [u, z] of [[1, 3]]) { F.del(u, 3, z); F.paint(u, 2, z, H); }
      for (const [u, y, z] of [[4, 1, 1], [4, 1, 3], [3, 2, 3], [4, 2, 2], [4, 2, 4]]) F.paint(u, y, z, H);
    },
  },
  {
    id: 'opus_counsel_bit', name: 'Counsel Bits', tier: 'epic', wearer: 'lawyers, bail bondsmen, downtown condo board',
    why: 'A long slim gloss loafer on a stacked heel with daylight under the arch, a gold horsebit bar and a dark dress sock.',
    cw: [['oxblood / gold', 0x6a1f2d, 0x1b1b1e, 0x8a5a3a, 0xe7bd4a, 0x17171b],
      ['black patent / gold', 0x141418, 0x0e0e10, 0x3a2d24, 0xe7bd4a, 0x2b3a5c],
      ['white / silver', 0xf4f1ea, 0xbdb6a8, 0xc49a6c, 0xdfe6ee, 0xff4fa3]],
    // [leather, sole, stacked heel, bit, dress sock]
    build(F, [Lt, So, Hl, Bt, S]) {
      F.rows(0, -3, [[0, 3], [0, 3], null, null, [0, 3], [0, 3], [0, 3], [0, 2], [1, 2]], So); // heel, open arch, sole
      F.paint(0, 0, -3, Hl); F.paint(1, 0, -3, Hl); F.paint(2, 0, -3, Hl); F.paint(3, 0, -3, Hl);
      F.paint(0, 0, -2, Hl); F.paint(1, 0, -2, Hl); F.paint(2, 0, -2, Hl); F.paint(3, 0, -2, Hl);
      F.rows(1, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], [1, 2]], Lt, 1); // long tapered toe
      F.rows(2, -3, [[0, 3], [0, 3], [3, 3], [3, 3], [3, 3], [0, 3], [0, 2]], Lt, 1);
      for (let u = 0; u <= 3; u++) { F.paint(u, 1, -1, So); F.paint(u, 1, 0, So); } // the waist's sole shank
      F.box(0, 2, 2, 2, -1, 1, S); F.box(0, 2, 3, 3, -1, 1, S);
      for (let u = 0; u <= 3; u++) F.paint(u, 2, 2, Bt, 2); // the bit
      F.paint(3, 1, 2, Bt, 2);
      F.paint(1, 2, 3, shade(Lt, 1.18), 1); // the apron seam's highlight
    },
  },
  {
    id: 'opus_rimshot_hi', name: 'Rimshot Hi', tier: 'rare', wearer: 'ballers at the courts, hustlers, mall kids',
    why: 'A strap high-top: white cupsole band, a collar wrapping the ankle, one fat strap across and a heel pull tab.',
    cw: [['royal / white', 0x2f5bff, 0xf7f7f2, 0x2a2a2e, 0xffc21a, 0xf7f7f2],
      ['black / fire', 0x1b1b20, 0xf7f7f2, 0xe8232a, 0xe8232a, 0x3a3b42],
      ['chalk / grape', 0xf1eee6, 0xf1eee6, 0x7a3cff, 0x7a3cff, 0x12b3a0]],
    // [upper, cupsole, outsole, strap, collar lining]
    build(F, [U, W, O, St, Cl]) {
      const sole = [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]];
      F.rows(0, -3, sole, O); F.rows(1, -3, sole, W);
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], null], U); // inset: the cupsole shows as a ledge
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], U);
      F.set(1, 3, -4, St); F.set(2, 3, -4, St); F.set(1, 2, -4, St); F.set(2, 2, -4, St); // heel pull tab
      F.set(1, 1, 6, W); F.set(2, 1, 6, W); // toe bumper springing off the cupsole
      for (let u = 0; u <= 2; u++) F.paint(u, 3, 2, St); F.paint(3, 2, 2, St); F.paint(3, 2, 1, St); // the strap
      for (const [u, z] of [[0, -3], [1, -3], [2, -3], [3, -3]]) F.paint(u, 3, z, Cl);
      F.paint(0, 2, 4, W); F.paint(1, 2, 4, W); F.paint(2, 2, 4, W); // toe cap
      for (const z of [-2, 0, 2, 4]) F.paint(4, 1, z, shade(W, .88)); // cupsole stitch marks
    },
  },
  {
    id: 'opus_curbfat_skate', name: 'Curbfat', tier: 'rare', wearer: 'skaters, the beach boardwalk, mall rats',
    why: 'A fat low skate shoe: a tall vulc sidewall on gum, a low suede heel and a pillow tongue lolling out over the toe.',
    cw: [['taxi / ink', 0xffc21a, 0xf4f1ea, 0x9b6940, 0x17171b, 0xe8232a],
      ['ink / bubble', 0x232530, 0xf4f1ea, 0x9b6940, 0xff6fb5, 0xf4f1ea],
      ['moss / tangerine', 0x5f7f3c, 0xece6d8, 0x9b6940, 0xff7a1a, 0xf4f1ea]],
    // [suede, sidewall, gum, tongue, lace]
    build(F, [Su, W, G, Tg, La]) {
      const foot = [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]];
      F.rows(0, -3, foot, G); F.rows(1, -3, foot, W);
      F.rows(2, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3], null], Su);
      F.box(0, 2, 3, 3, -1, 3, Tg); // pillow tongue lolling forward over the toe
      F.paint(2, 3, 3, shade(Tg, .82)); F.paint(0, 3, 3, shade(Tg, .9));
      F.paint(1, 2, 3, La); F.paint(2, 2, 3, La); F.paint(1, 2, 4, La); // fat laces
      for (let u = 0; u <= 3; u++) F.paint(u, 2, -3, shade(Su, .8));
      for (const z of [-2, 0, 2, 4]) F.paint(4, 1, z, shade(W, .9));
    },
  },
  {
    id: 'opus_velvet_rope', name: 'Velvet Rope', tier: 'epic', wearer: 'the strip, club doors, nightlife promoters',
    why: 'A patent platform bootie lifted on a clear forefoot block and a slim chrome heel, with open air under the arch.',
    cw: [['hot pink / ice', 0xff4fa3, 0xd8f3ff, 0xdfe6ee, 0xffffff, 0xc23d82],
      ['black patent / chrome', 0x141418, 0x3a3b46, 0xdfe6ee, 0xff4fa3, 0x2a2a2e],
      ['red patent / gold', 0xe8232a, 0xffe23a, 0xe7bd4a, 0xfff0d0, 0x9a1720]],
    // [patent, platform, heel metal, piping, platform edge]
    build(F, [Pt, Pl, Hm, Pp, Pe]) {
      F.rows(0, -3, [[1, 2], null, null, null, [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], Pl, 1);
      F.rows(1, -3, [[1, 2], null, null, [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], Pl, 1);
      F.paint(1, 0, -3, Hm, 2); F.paint(2, 0, -3, Hm, 2); F.paint(1, 1, -3, Hm, 2); F.paint(2, 1, -3, Hm, 2);
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], null], Pt, 1);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], Pt, 1);
      for (const z of [1, 3, 5]) F.paint(z === 5 ? 2 : 3, 0, z, Pe, 1); // stacked platform edge
      for (const z of [-3, -2, -1, 0, 1]) F.paint(3, 3, z, Pp, 1); // piped collar
      F.paint(0, 3, -3, Pp, 1); F.paint(1, 3, -3, Pp, 1); F.paint(2, 3, -3, Pp, 1);
    },
  },
  {
    id: 'opus_bondsman_boot', name: 'Bondsman', tier: 'epic', wearer: 'bail bondsmen, highway truckers, trailer-park landlords, estate money',
    why: 'A pointed western boot in exotic skin: underslung stacked heel, open arch and a silver toe tip.',
    cw: [['python', 0xe2cf9c, 0xa8834f, 0x2a2422, 0x8a5a3a, 0xdfe6ee],
      ['black caiman', 0x2c2c33, 0x141417, 0x17171b, 0x3a2d24, 0xe7bd4a],
      ['cherry ostrich', 0xc22a35, 0x95202b, 0x2a2422, 0x5c3a22, 0xdfe6ee]],
    // [skin, scale, sole, stacked heel, toe tip]
    build(F, [Sk, Sc, So, Hl, Tp]) {
      F.rows(0, -3, [[0, 3], [0, 3], null, null, [0, 3], [0, 3], [0, 3], [0, 2], [1, 2]], So);
      for (const z of [-3, -2]) for (let u = 0; u <= 3; u++) F.paint(u, 0, z, Hl);
      F.rows(1, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], [1, 2]], Sk);
      F.set(1, 1, 6, Tp, 2); F.paint(1, 1, 5, Tp, 2); F.paint(2, 1, 5, Tp, 2); // silver toe tip on the point
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], [1, 1], null], Sk);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], Sk);
      F.each((u, y, z, c) => { if (c === Sk && (u * 5 + y * 3 + z * 7 + 40) % 4 === 0) F.paint(u, y, z, Sc, 1); });
      F.paint(0, 1, -1, So); F.paint(1, 1, -1, So); F.paint(2, 1, -1, So); F.paint(3, 1, -1, So); // arch shank
      F.paint(0, 1, 0, So); F.paint(1, 1, 0, So); F.paint(2, 1, 0, So); F.paint(3, 1, 0, So);
      for (const z of [-3, -1, 1]) F.paint(3, 3, z, Hl); // pull-strap stitching
    },
  },
  {
    id: 'opus_penthouse_puffer', name: 'Penthouse Puffer', tier: 'grail', wearer: 'penthouse collectors, gallery openings, the estates in winter',
    why: 'A quilted gloss moon-boot: a pillow of nylon bulging over a small sole, the biggest mass on the street, cinched with a drawcord.',
    cw: [['ice / signal', 0xf4f1ea, 0xd9d4c8, 0xff7a1a, 0x17171b, 0xff7a1a],
      ['blackout / lime', 0x222228, 0x34343c, 0x6cff4a, 0x6cff4a, 0x17171b],
      ['silver / cobalt', 0xc9ced6, 0xa9b0ba, 0x2f5bff, 0x2f5bff, 0xf7f7f2]],
    // [nylon, quilt channel, sole, cord, cuff band]
    build(F, [N, Q, So, Cd, Cf]) {
      F.rows(0, -3, [[0, 2], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], So); // a small sole under the bulge
      F.rows(1, -3, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4]], N, 1);
      F.rows(2, -3, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3], null], N, 1); // the pillow rounds in: hands and ground clear it in every idle
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], [0, 2], [0, 1]], N, 1);
      F.set(1, 3, -4, Cf, 1); F.set(2, 3, -4, Cf, 1); F.set(1, 2, -4, N, 1); F.set(2, 2, -4, N, 1); // puffed heel roll
      F.each((u, y, z, c) => { if (c === N && y > 0 && (z + 3) % 2 === 1) F.paint(u, y, z, Q, 1); }); // quilt channels
      for (const [u, z] of [[0, -3], [1, -3], [2, -3], [3, -3], [3, -2], [3, -1], [3, 0], [3, 1], [2, 2]]) F.paint(u, 3, z, Cf, 1);
      F.paint(1, 3, 3, Cd); F.paint(4, 2, 2, Cd); F.paint(4, 2, 1, 0xdfe6ee, 2); // drawcord + toggle
      for (const z of [-2, 0, 2, 4]) F.paint(3, 0, z, shade(So, .78));
    },
  },
];

// Build every colorway once, as per-foot cell lists.
const built = new Map();
export function footCells(id, cw = 0) {
  const t = DESIGNS.find(d => d.id === id); if (!t) return null;
  const i = ((cw | 0) % t.cw.length + t.cw.length) % t.cw.length, key = `${id}#${i}`;
  if (!built.has(key)) { const F = pad(); t.build(F, t.cw[i].slice(1)); built.set(key, Object.freeze([...F.cells.values()].map(q => Object.freeze(q)))); }
  return built.get(key);
}
export const OPUS_SOCKET = SOCKET;

// Catalog view (plain data). collection 'opus' drives the gallery's Opus drop filter.
export const OPUS_SHOES = Object.fromEntries(DESIGNS.map(({ build, ...t }) => [t.id, { ...t, category: 'shoes', collection: 'opus' }]));

// Install after the legacy adapter: these are native rigid feet, like the early studies.
export function installOpusShoes({ SHOES, NEWT, NEWI, NAMES }) {
  for (const t of Object.values(OPUS_SHOES)) {
    const { id, name, tier, cw, why } = t;
    NEWT.shoes[id] = [name, tier, cw, why];
    NEWI[id] = { id, slot: 'shoes', name, tier, cw, why, new: true, origin: 'lower', collection: 'opus' };
    NAMES.shoes[id] = name;
    SHOES[id] = (grid, p = {}) => {
      for (const side of [-1, 1]) for (const [u, y, z, c, l] of footCells(id, p.cw)) grid.set(side < 0 ? -2 - u : 1 + u, y, z, c, l);
    };
  }
}
