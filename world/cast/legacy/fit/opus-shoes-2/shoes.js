// Opus 2 / shoes. Twelve more footwear TYPES, each its own silhouette and material, authored as
// whole rigid feet on the same construction as world/fit/opus-shoes/shoes.js (no shared last).
//
// Foot-local coordinates, mirrored per side:
//   u grows outwards from the fixed inner edge (u0 = x-2 left, x1 right), 0..4 (u5 meets the pockets-idle hand)
//   y 0..3 (the leg's cloth starts at y4; nothing here may rise above y3)
//   z heel -> toe; ground cells stay inside z-3..5; z-4 and z6 are raised overhangs only.
// Every shoe owns the 3x3 ankle socket (u0..2, y3, z-1..1) under the leg. At y3 the toe half stays
// within u0..2 (the outer front corner is the hands-in-pockets hand's room).
// Materials: 0 matte, 1 gloss, 2 metal. Palette rows: [name, ...colors].
// Ids are prefixed opus2_. Invented names only; no real marks or designs.

const shade = (c, f) => {
  const s = n => Math.min(255, Math.max(0, Math.round(((c >> n) & 255) * f)));
  return (s(16) << 16) | (s(8) << 8) | s(0);
};
const SOCKET = (u, y, z) => y === 3 && u >= 0 && u <= 2 && z >= -1 && z <= 1;
const FOOT = [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]];   // z-3..5, rounded heel and toe
const SLIM = [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3]];   // z-3..5, four wide

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
    id: 'opus2_rink_rat', name: 'Rink Rat', tier: 'epic', wearer: 'boardwalk skaters at the beach, roller-disco club kids, carhops at the highway diner',
    why: 'A quad roller skate: four fat candy wheels splayed under a chrome plate, daylight under the arch, a rubber toe stop and a padded cuff.',
    cw: [['vanilla / bubblegum', 0xf4f1ea, 0xff4fa3, 0xdfe6ee, 0xff6fb5, 0xe8232a, 0xff4fa3],
      ['ink / lime', 0x1d1d22, 0x6cff4a, 0xc9ced6, 0x6cff4a, 0xf7f7f2, 0x6cff4a],
      ['tangerine / sky', 0xff7a1a, 0xf7f7f2, 0xdfe6ee, 0x3fa9f5, 0x17171b, 0xf7f7f2]],
    // [boot, cuff, plate, wheel, toe stop, lace]
    build(F, [B, Cf, Pl, Wh, Ts, La]) {
      F.box(1, 3, 1, 1, -3, 4, Pl, 2);                                   // the chrome plate
      for (const u of [0, 4]) for (const z0 of [-3, 3]) for (const y of [0, 1]) for (const z of [z0, z0 + 1])
        F.set(u, y, z, y ? Wh : shade(Wh, .78), 1);                       // 2x2 wheels on both edges, front and back trucks
      F.box(1, 2, 0, 1, 5, 5, Ts); F.set(1, 1, 6, Ts); F.set(2, 1, 6, Ts); // toe stop plug
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], B, 1);   // boot z-3..4
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], B, 1);
      for (const [u, z] of [[0, -3], [1, -3], [2, -3], [3, -3], [3, -2], [3, -1], [3, 0], [3, 1]]) F.paint(u, 3, z, Cf, 0);   // padded cuff
      for (const z of [2, 3, 4]) F.paint(1, 2, z, La, 0); F.paint(0, 3, 2, La, 0); F.paint(2, 3, 2, La, 0);   // laces to the toe
      F.paint(3, 2, -3, Cf, 0); F.paint(3, 2, 4, shade(B, .86));           // heel stripe, toe bump
    },
  },
  {
    id: 'opus2_chomp_slipper', name: 'Chomp', tier: 'rare', wearer: 'trailer-park mornings, hospital patients on the ward, collectors who buy the joke',
    why: 'A plush shark slipper: the toe is an open jaw of white teeth, eyes on the cheeks, a fin on top and a tail flicking out the back.',
    cw: [['reef blue', 0x3fa9f5, 0xf4f1ea, 0xffffff, 0x17171b, 0xe8232a],
      ['great white', 0x9aa4b1, 0xf7f7f2, 0xffffff, 0x17171b, 0xff4fa3],
      ['hot pink', 0xff4fa3, 0xfff0d0, 0xffffff, 0x17171b, 0x7a3cff]],
    // [plush, belly, teeth, eye, mouth]
    build(F, [P, Be, Te, Ey, Mo]) {
      F.rows(0, -3, FOOT, Be);                                            // white belly underneath
      F.rows(1, -3, FOOT, P); F.rows(2, -3, FOOT, P);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], P);         // plush back up to the ankle
      F.set(2, 2, 6, P); F.set(1, 2, 6, P);                               // snout overbite
      for (const u of [0, 2]) F.paint(u, 1, 5, Te);                       // the bite: teeth with dark gaps cut between them
      for (const u of [1, 3]) { F.del(u, 1, 5); F.paint(u, 1, 4, Mo); }
      for (const [z, c] of [[2, Te], [3, Mo], [4, Te]]) F.paint(4, 1, z, c);   // the grin runs back along the cheek
      F.set(1, 3, 3, shade(P, .72)); F.set(1, 3, 4, shade(P, .72));       // dorsal fin
      F.set(1, 2, -4, P); F.set(2, 2, -4, P); F.set(1, 3, -4, shade(P, .72)); // tail
      F.paint(4, 2, 3, Ey, 1); F.paint(4, 2, 2, Te); F.paint(0, 2, 3, Ey, 1); F.paint(0, 2, 2, Te);   // eyes
      for (const z of [-1, 0]) F.paint(4, 2, z, shade(P, .7));            // gills
      F.paint(0, 3, -3, shade(P, .86)); F.paint(1, 3, -3, shade(P, .86)); F.paint(2, 3, -3, shade(P, .86)); F.paint(3, 3, -3, shade(P, .86));
    },
  },
  {
    id: 'opus2_jelly_cage', name: 'Jelly Cage', tier: 'common', wearer: 'the beach, mall kids, suburban moms on the school run',
    why: 'A glossy jelly fisherman sandal: a cage of candy straps with real gaps, a loud tube sock showing through and a chrome buckle.',
    cw: [['grape / tube sock', 0x8c52ff, 0x5a2bd6, 0xf7f7f2, 0xffe23a, 0xdfe6ee],
      ['bubblegum / white sock', 0xff4fa3, 0xc23d82, 0xf7f7f2, 0x2f5bff, 0xdfe6ee],
      ['lime / black sock', 0x6cff4a, 0x25b84c, 0x1d1d22, 0xffe23a, 0xdfe6ee]],
    // [jelly, sole jelly, sock, sock stripe, buckle]
    build(F, [J, Sj, Sk, St, Bk]) {
      F.rows(0, -3, FOOT, Sj, 1);
      F.box(0, 3, 1, 2, -3, 4, Sk); F.box(0, 2, 3, 3, -2, 1, Sk);         // the socked foot inside the cage
      for (let u = 0; u <= 2; u++) for (let z = -1; z <= 1; z++) F.paint(u, 3, z, St);   // tube-sock stripe at the ankle
      for (const z of [-2, 0, 2, 4]) for (const y of [1, 2]) F.set(4, y, z, J, 1);   // outer bars, sock in the gaps
      for (const u of [0, 2]) for (const y of [1, 2]) F.set(u, y, 5, J, 1); // front bars over the toes
      F.set(3, 1, 5, J, 1);
      for (const y of [1, 2]) for (let u = 0; u <= 3; u++) F.paint(u, y, -3, J, 1);   // closed heel cup
      for (const z of [2, 4]) for (let u = 0; u <= 3; u++) F.paint(u, 2, z, J, 1);    // cross straps on top
      for (const z of [1, 2, 3, 4]) F.paint(1, 2, z, J, 1);               // the fisherman's centre strap
      for (const z of [-2, 0, 2, 4]) F.paint(0, 1, z, J, 1);              // inner bars
      for (const [u, z] of [[0, -3], [1, -3], [2, -3], [3, -3], [3, -2], [3, -1]]) F.set(u, 3, z, J, 1);   // ankle strap
      F.set(3, 3, 0, Bk, 2);
    },
  },
  {
    id: 'opus2_pop_pods', name: 'Pop Pods', tier: 'rare', wearer: 'ballers at the courts, gym rats, mall kids',
    why: 'A court sneaker floating on a sole of separate glossy air pods, daylight between every bubble.',
    cw: [['blackout / volt pods', 0x17171b, 0xd8f3ff, 0x6cff4a, 0xf7f7f2, 0x6cff4a, 0xf7f7f2],
      ['grape soda', 0x7a3cff, 0xffd2f0, 0xff4fa3, 0xf4f1ea, 0xffe23a, 0xf4f1ea],
      ['court white / fire', 0xf4f1ea, 0xffe3d6, 0xe8232a, 0xd3d4d7, 0x2f5bff, 0xe8232a]],
    // [upper, pod skin, pod core, midsole, accent, lace]
    build(F, [U, Pd, Pc, Ms, Ac, La]) {
      for (const z of [-3, -1, 1, 3, 5]) for (const u of [0, 1, 3, 4]) if (u < 4 || (z > -3 && z < 5)) F.set(u, 0, z, u === 0 || u === 4 ? Pd : Pc, 1);   // the pods
      F.rows(1, -3, FOOT, Ms);
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], U);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], U);
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, Ac);                 // heel collar
      for (const [u, y, z] of [[3, 2, -1], [3, 2, 0], [3, 2, 1], [3, 3, -1], [3, 3, 0]]) F.paint(u, y, z, Ac);   // the pod mark
      F.paint(0, 3, 2, La); F.paint(1, 3, 2, La); F.paint(2, 3, 2, La); F.paint(1, 2, 3, La); F.paint(1, 2, 4, La);
      for (const z of [-2, 0, 2, 4]) F.paint(4, 1, z, shade(Ms, .88));
    },
  },
  {
    id: 'opus2_culdesac_runner', name: 'Cul-de-Sac', tier: 'common', wearer: 'suburban dads, weekend hikers in the forest, downtown hypebeasts wearing it ironically',
    why: 'A chunky dad runner: a fat white midsole that climbs the heel, a glossy heel stabiliser jutting out the back and an upturned toe.',
    cw: [['white / royal / red', 0xf7f7f2, 0xe8232a, 0xe6e1d6, 0x2f5bff, 0xe8232a, 0x2f5bff],
      ['triple black / volt', 0x2a2b30, 0x6cff4a, 0x17171b, 0x3a3b42, 0x6cff4a, 0x17171b],
      ['sunset', 0xfff0d0, 0xff7a1a, 0x7a3cff, 0xffc21a, 0x12b3a0, 0x7a3cff]],
    // [midsole, midsole wave, mesh, overlay, accent, outsole]
    build(F, [Ms, Wv, U, Ov, Ac, Os]) {
      F.rows(0, -3, [[0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], Os);   // the toe lifts off: no ground at z5
      F.rows(1, -4, [[0, 3], [0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], Ms);   // heel stabiliser at z-4
      F.rows(2, -4, [[1, 2], [0, 3], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3], [0, 3], [0, 3], [0, 3], [1, 2]], U);   // the toe spring tip at z6
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], U);
      for (const z of [-2, -1, 0, 1]) F.paint(4, 2, z, Ms);               // the midsole climbs the heel
      for (let u = 0; u <= 3; u++) F.paint(u, 1, -4, Wv, 1); F.paint(1, 2, -4, Wv, 1); F.paint(2, 2, -4, Wv, 1);   // the heel stabiliser
      for (const z of [-3, -2]) F.paint(4, 1, z, Wv, 1);
      for (const [u, y, z] of [[3, 2, -3], [3, 2, 2], [3, 2, 3], [3, 2, 4], [2, 2, 5], [1, 2, 6], [2, 2, 6]]) F.paint(u, y, z, Ov);   // suede overlays
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, Ov);
      for (const z of [-2, -1, 0, 1]) F.paint(3, 3, z, Ac);               // the side stripe
      F.paint(1, 3, 2, Ac); F.paint(1, 2, 3, shade(U, .82)); F.paint(1, 2, 4, shade(U, .82));
    },
  },
  {
    id: 'opus2_second_skin', name: 'Second Skin', tier: 'common', wearer: 'gym rats, bike couriers downtown, nurses on the hospital block',
    why: 'A knit sock trainer: a skinny striped sock foot, no wider than the leg, plunged into a slab of a sole twice its width.',
    cw: [['ward teal / white slab', 0x12b3a0, 0xf7f7f2, 0xf4f1ea, 0xc9c6bd, 0xffc21a],
      ['volt knit / black slab', 0x6cff4a, 0x17171b, 0x1d1d22, 0x3a3b42, 0xff4fa3],
      ['fire red / cream slab', 0xe8232a, 0xfff0d0, 0xfff0d0, 0xe6e1d6, 0x17171b]],
    // [knit, knit stripe, slab, slab ridge, pull loop]
    build(F, [K, Ks, So, Sr, Lp]) {
      const slab = [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4]];
      F.rows(0, -3, slab, shade(So, .82)); F.rows(1, -3, slab, So);
      for (let z = -3; z <= 5; z++) { if (z % 2) F.paint(4, 1, z, Sr); else F.paint(4, 0, z, Sr); }   // the ridged sidewall
      for (let z = -2; z <= 5; z += 2) { F.paint(3, 1, z, Sr); }        // grooves across the slab's ledge
      F.box(0, 2, 2, 2, -3, 4, K); F.box(0, 2, 3, 3, -3, 2, Ks);          // the sock foot, its ribbed cuff band
      for (let z = -3; z <= 4; z++) if (z % 2 === 0) for (let u = 0; u <= 2; u++) F.paint(u, 2, z, shade(K, .8));   // knit rib
      F.paint(1, 3, 2, K); F.paint(1, 3, -3, K);
      F.set(1, 3, -4, Lp); F.set(1, 2, -4, Lp);                           // the pull loop
    },
  },
  {
    id: 'opus2_shag_mule', name: 'Shag Mule', tier: 'epic', wearer: 'penthouse towers, the strip at 4am, hustlers off duty',
    why: 'A backless mule in loud shaggy fur on a chunky lug: tufts break the outline and the heel sits open on a furry bed.',
    cw: [['snow leopard', 0xf4f1ea, 0x17171b, 0x2a2b30, 0x6d707a, 0xdfe6ee],
      ['electric pink', 0xff4fa3, 0xffb3d9, 0x17171b, 0x3a3b42, 0xe7bd4a],
      ['sasquatch', 0x8d5a2b, 0xc49a6c, 0xf4f1ea, 0xd3d4d7, 0x17171b]],
    // [fur, fur tip, lug, midsole, bar]
    build(F, [Fu, Ft, Lg, Md, Br]) {
      F.rows(0, -3, FOOT, Lg);
      for (const z of [-3, -1, 1, 3, 5]) F.paint(z === -3 || z === 5 ? 3 : 4, 0, z, shade(Lg, 1.6));   // lugs
      F.rows(1, -3, FOOT, Md);
      F.rows(2, -3, [[0, 3], [0, 4], [0, 3], [0, 4], [0, 4], [0, 3], [0, 4], [0, 3], [0, 3]], Fu);   // the shag, its edge jagged
      F.rows(3, -1, [[0, 3], [0, 3], [0, 3], [0, 2], [0, 0], [1, 1]], Fu);  // the fur bursts round the ankle, tufts on the toe
      F.set(2, 3, 3, Fu);
      for (const z of [-2, 0, 1, 3]) F.paint(4, 1, z, Fu);                 // a fringe hanging over the sole
      for (const u of [0, 1, 2, 3]) F.del(u, 2, -3); F.set(1, 2, -3, Fu); F.set(2, 2, -3, Fu);   // the open heel: just a furry bed
      F.paint(0, 2, -2, shade(Fu, .8)); F.paint(1, 2, -2, shade(Fu, .8)); F.paint(2, 2, -2, shade(Fu, .8));
      F.set(1, 2, -4, Fu);                                                  // a tuft escaping out the back
      F.each((u, y, z, c) => { if (c !== Fu) return; const h = (u * 7 + y * 5 + z * 3 + 99) % 3; if (h === 0) F.paint(u, y, z, Ft); else if (h === 1) F.paint(u, y, z, shade(Fu, .78)); });   // fur: tip, base, shadow
      F.paint(3, 1, 4, Br, 2);                                              // a little metal plate on the welt
    },
  },
  {
    id: 'opus2_porcupine_hi', name: 'Porcupine', tier: 'epic', wearer: 'club kids, junkyard punks, the strip',
    why: 'A patent high-top bristling with metal spikes down the outside, round the heel and over the toe: a jagged outline from any distance.',
    cw: [['black / silver', 0x17171b, 0xeef2f6, 0xf7f7f2, 0xe8232a, 0xf7f7f2],
      ['hot pink / gold', 0xff4fa3, 0xffd23a, 0x17171b, 0x17171b, 0x17171b],
      ['cobalt / silver', 0x2f5bff, 0xeef2f6, 0xf7f7f2, 0xffe23a, 0xffe23a]],
    // [patent, spike, sole, collar, lace]
    build(F, [Lt, Sp, So, Cl, La]) {
      F.rows(0, -3, SLIM, So);
      F.rows(1, -3, SLIM, Lt, 1);
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], Lt, 1);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], Lt, 1);
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, Cl, 0); for (const z of [-2, -1, 0, 1]) F.paint(3, 3, z, Cl, 0);
      F.paint(1, 3, 2, La, 0); F.paint(1, 2, 3, La, 0); F.paint(1, 2, 4, La, 0);
      for (const z of [-3, -1, 1, 3]) F.set(4, 2, z, Sp, 1);                // one row of outer spikes (polished gloss: city-light metal reads dark)
      for (const z of [-2, 0, 2, 4]) F.paint(3, 1, z, shade(Lt, 1.6), 1);  // their rivets down the quarter
      for (const [u, y] of [[1, 1], [3, 1], [0, 2], [2, 2], [1, 3], [3, 3]]) F.set(u, y, -4, Sp, 1);   // heel spikes
      for (const [u, y, z] of [[1, 1, 6], [3, 1, 6], [0, 2, 5], [2, 2, 5], [0, 3, 3], [2, 3, 4]]) F.set(u, y, z, Sp, 1);   // toe spikes
    },
  },
  {
    id: 'opus2_treadhead', name: 'Treadhead', tier: 'rare', wearer: 'industrial yards, junkyard scrappers, dock crews',
    why: 'A work boot on a tank track: a metal tread loop wrapping round the heel and toe, road wheels showing down the side.',
    cw: [['hazard yellow', 0xffc21a, 0x3a3b42, 0x6d707a, 0xe8232a, 0x17171b],
      ['army / steel', 0x5f7f3c, 0x3a3b42, 0x7a7d88, 0xffc21a, 0xffc21a],
      ['fire red / steel', 0xe8232a, 0x5d5e6b, 0xa7a9b1, 0xf7f7f2, 0xf7f7f2]],
    // [boot, track, track link, road wheel hub, lace]
    build(F, [Bt, Tr, Tl, Hb, La]) {
      F.rows(0, -3, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4]], Tr);   // the bottom run
      F.box(0, 4, 1, 1, -4, -4, Tr); F.box(0, 4, 1, 1, 6, 6, Tr);         // the loop turning round heel and toe
      F.rows(1, -3, SLIM, Bt);
      for (let z = -3; z <= 5; z++) F.set(4, 1, z, (z + 5) % 3 === 0 ? Hb : shade(Tr, .55), (z + 5) % 3 === 0 ? 1 : 0);   // three road wheels inside the loop
      F.rows(2, -3, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3], [0, 3]], Bt);
      for (let z = -3; z <= 3; z++) F.paint(4, 2, z, Tr);                  // the top run
      for (let z = -3; z <= 5; z += 2) for (let u = 0; u <= 4; u++) F.paint(u, 0, z, Tl);   // links on the ground run
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], Bt);
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, shade(Bt, .7)); for (const z of [-2, -1, 0, 1]) F.paint(3, 3, z, shade(Bt, .7));
      F.paint(1, 3, 2, La); F.paint(1, 2, 3, La); F.paint(1, 2, 4, La); F.paint(3, 2, 2, 0xcfd3d8, 2); F.paint(3, 3, 1, 0xcfd3d8, 2);
      for (let u = 0; u <= 3; u++) F.paint(u, 2, 5, shade(Bt, .78));     // a scuffed toe
    },
  },
  {
    id: 'opus2_bankroll', name: 'Bankroll', tier: 'grail', wearer: 'hustlers, bail bondsmen, high rollers on the strip',
    why: 'A velvet slipper perched on a messy stack of banknotes: three bundles shoved out of line, paper edges, a gold band round the middle.',
    cw: [['greenbacks', 0x2e8b3e, 0x4fae4c, 0x25b84c, 0xeef5dc, 0xffd23a, 0x7a3cff, 0xffd23a],
      ['play money', 0xff8a1f, 0xff4fa3, 0xffe23a, 0xfff0d0, 0x2de2e6, 0x17171b, 0xf7f7f2],
      ['funny money', 0x7a3cff, 0x2de2e6, 0x8c52ff, 0xf7f7f2, 0xffd23a, 0xe8232a, 0xffe23a]],
    // [bottom bundle, middle bundle, top bundle, paper edge, band, velvet, piping]
    build(F, [G0, G1, G2, Ed, Bd, Vl, Pp]) {
      F.rows(0, -3, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4]], G0);   // squared bundles, not a last
      F.rows(1, -4, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], G1);   // shoved back and in
      F.rows(2, -3, [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 4], [0, 3]], G2);   // shoved forward
      for (const [u, y, z] of [[4, 0, -3], [4, 0, 4], [3, 1, -4], [3, 1, 3], [4, 2, -2], [4, 2, 5], [3, 2, 6], [0, 2, 6], [4, 0, 2]]) F.paint(u, y, z, Ed);   // loose sheets' paper edges
      for (const z of [0, 1]) { F.paint(4, 0, z, Bd, 1); F.paint(3, 1, z, Bd, 1); F.paint(4, 2, z, Bd, 1); F.paint(0, 0, z, Bd, 1); F.paint(0, 1, z, Bd, 1); F.paint(0, 2, z, Bd, 1); }   // the band
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], Vl);   // velvet slipper on top
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, Pp, 1); for (const z of [-2, -1, 0, 1]) F.paint(3, 3, z, Pp, 1); F.paint(1, 3, 2, Pp, 1);
    },
  },
  {
    id: 'opus2_pit_lane', name: 'Rear Wing', tier: 'rare', wearer: 'street racers on the highway, car-meet crowds, mall kids',
    why: 'A slim, low racing trainer with a long nose, a carbon heel and a rear wing on struts: you can see through under the spoiler.',
    cw: [['rosso', 0xe8232a, 0x17171b, 0xffe23a, 0xf7f7f2, 0x17171b],
      ['papaya', 0xff7a1a, 0x2a2b30, 0x2f5bff, 0xf7f7f2, 0xf7f7f2],
      ['racing teal', 0x12b3a0, 0x17171b, 0xff4fa3, 0xf7f7f2, 0x2a2b30]],
    // [upper, carbon, wing, checker, sole]
    build(F, [U, Cb, Wg, Ck, So]) {
      F.rows(0, -3, SLIM, So);
      F.rows(1, -3, SLIM, U, 1); F.set(1, 1, 6, U, 1); F.set(2, 1, 6, U, 1);   // the long nose
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [1, 2]], U, 1);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 2]], U, 1);         // cut low: the collar stops at the ankle
      for (const y of [1, 2]) for (let u = 0; u <= 3; u++) F.paint(u, y, -3, (u + y) % 2 ? Cb : shade(Cb, 1.9), 1);   // carbon heel
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, Cb, 1);
      F.set(0, 2, -4, Cb, 1); F.set(3, 2, -4, Cb, 1);                       // wing struts
      for (let u = 0; u <= 3; u++) F.set(u, 3, -4, Wg, 1);                  // the wing
      for (let z = -1; z <= 3; z++) for (const y of [1, 2]) if ((z + y) % 2 === 0) F.paint(3, y, z, Ck, 0);   // checker flag panel
      F.paint(1, 2, 4, Wg, 1); F.paint(2, 2, 4, Wg, 1);                     // nose stripe
    },
  },
  {
    id: 'opus2_house_arrest', name: 'House Arrest', tier: 'rare', wearer: 'parolees, the jail release gate, the trailer park',
    why: 'A padded leather high-top with an ankle monitor strapped on: a black box on the outer ankle and a green light that never goes off.',
    cw: [['intake orange', 0xff7a1a, 0xf7f7f2, 0x17171b, 0x6cff4a, 0xf7f7f2],
      ['county white', 0xf4f1ea, 0x2f5bff, 0x17171b, 0xe8232a, 0x2f5bff],
      ['yard black', 0x232530, 0xffc21a, 0x6d707a, 0x6cff4a, 0xffc21a]],
    // [leather, cupsole, monitor, light, laces + perforations]
    build(F, [Lt, So, Mb, Ld, Pf]) {
      F.rows(0, -3, SLIM, So); F.rows(1, -3, SLIM, Lt);
      for (const z of [-3, -1, 1, 3, 5]) F.paint(3, 0, z, shade(So, .86));
      F.rows(2, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 3]], Lt);
      F.rows(3, -3, [[0, 3], [0, 3], [0, 3], [0, 3], [0, 3], [0, 2], [0, 2]], Lt);   // laced high up the instep
      for (const [u, y, z] of [[0, 2, 4], [2, 2, 4], [1, 1, 5], [3, 1, 4], [3, 2, 3]]) F.paint(u, y, z, Pf);   // perforated toe
      F.paint(1, 3, 2, Pf); F.paint(1, 3, 3, Pf); F.paint(1, 2, 4, shade(Lt, .8));
      for (let u = 0; u <= 3; u++) F.paint(u, 3, -3, Mb); for (const z of [-2, -1, 0, 1]) F.paint(3, 3, z, Mb);   // the strap
      F.box(4, 4, 1, 2, -1, 0, Mb); F.paint(4, 2, 0, Ld, 1);               // the box and its light
    },
  },
];

const built = new Map();
export function footCells(id, cw = 0) {
  const t = DESIGNS.find(d => d.id === id); if (!t) return null;
  const i = ((cw | 0) % t.cw.length + t.cw.length) % t.cw.length, key = `${id}#${i}`;
  if (!built.has(key)) { const F = pad(); t.build(F, t.cw[i].slice(1)); built.set(key, Object.freeze([...F.cells.values()].map(q => Object.freeze(q)))); }
  return built.get(key);
}
export const OPUS2_SOCKET = SOCKET;

// Catalog view (plain data). collection 'opus2' drives the studio's "opus 2" origin.
export const OPUS2_SHOES = Object.fromEntries(DESIGNS.map(({ build, ...t }) => [t.id, { ...t, category: 'shoes', collection: 'opus2' }]));

// Install after the legacy adapter: native rigid feet, like the first Opus drop.
export function installOpus2Shoes({ SHOES, NEWT, NEWI, NAMES }) {
  for (const t of Object.values(OPUS2_SHOES)) {
    const { id, name, tier, cw, why } = t;
    NEWT.shoes[id] = [name, tier, cw, why];
    NEWI[id] = { id, slot: 'shoes', name, tier, cw, why, new: true, origin: 'lower', collection: 'opus2' };
    NAMES.shoes[id] = name;
    SHOES[id] = (grid, p = {}) => {
      for (const side of [-1, 1]) for (const [u, y, z, c, l] of footCells(id, p.cw)) grid.set(side < 0 ? -2 - u : 1 + u, y, z, c, l);
    };
  }
}
