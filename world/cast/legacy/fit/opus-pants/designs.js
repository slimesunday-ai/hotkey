// Opus pants drop. Paint-only on the approved fuller ROOMY profile: no voxel is added
// or cut, so the thickness, clearance cuts, knee/ankle interface and walk are astra's.
// Diversity comes from what paint can build on that profile — hems, cuffs, stacks,
// knee construction, pockets, piping — plus material (0 matte, 1 coated, 2 metal).
// Colors are [cloth, shadow, accent, trim]. The y4 hem also dresses the foot-owned
// ankle row, so a hem treatment reaches the shoe. Under most tops only y4..y7 shows,
// so every type carries its identity below mid-thigh; waist details are a bonus.
//
// ROOMY cells: y4 w5 z-1..1 (hem) · y5..y8 w4 z-2..3 (u3 front cut away) · y9 w4 z-1..1.
const front = q => q.z >= 1;                 // the forward half of the leg
const face = q => q.z === q.z1;              // the front-most face of a row
const outer = q => q.u === q.width - 1;      // outseam column
const back = q => q.z <= -1;
// Chunky deterministic value noise (no Math.random): one value per s-voxel block.
const hash = (a, b, c, seed) => {
  let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const blob = (q, s, seed, dx = 0, dy = 0, dz = 0) => hash(Math.floor((q.x + dx + 64) / s), Math.floor((q.y + dy) / s), Math.floor((q.z + dz + 64) / s), seed);

export const DESIGNS = [
  {
    id: 'opus_selvedge_cuff', name: 'Selvedge Cuff', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Downtown denim heads, collectors, corner hustlers',
    why: 'Deep raw denim turned up into a tall two-row cuff; the pale reverse and a red selvedge line on the outseam read from across the street.',
    cw: [
      ['Raw Indigo', 0x1f3263, 0x111b3a, 0x9bb8de, 0xe0353a],
      ['Black Raw', 0x24262d, 0x111318, 0xbfc5ce, 0xe0353a],
      ['Ecru Inside-Out', 0xe8ddc4, 0xb3a385, 0x34559c, 0xe0353a],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y <= 5) return [outer(q) && q.z <= 0 && q.z >= -1 ? T : A, 0];
      if (back(q) && q.u === 0) return [D, 0];
      if (q.y === 9 && face(q) && q.u <= 1) return [D, 0];
      return [C, 0];
    },
  },
  {
    id: 'opus_acid_stack', name: 'Acid Stack', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Skaters, trailer-park kids, beach-lot loiterers',
    why: 'Bleached acid-wash in big clouded patches, a blown-out knee on one leg, and light-and-dark stack folds bunched over the shoe.',
    cw: [
      ['Acid Blue', 0x5b84c4, 0x233f70, 0xc3d6ee, 0xf7f7f1],
      ['Acid Coal', 0x4b4e57, 0x1f2126, 0xadb2bb, 0xf4f2ec],
      ['Acid Berry', 0xa8458f, 0x4e1c47, 0xeeaad6, 0xfbf3f7],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [D, 0];
      if (q.y === 5) return [front(q) ? A : C, 0];
      if (q.y === 6 && !front(q)) return [D, 0];
      if (q.side < 0 && front(q) && q.y === 7 && q.u <= 1) return [T, 0];
      return [.6 * blob(q, 2, 7, q.y, 1) + .4 * hash(q.x, q.y, q.z, 9) < .5 ? A : C, 0];
    },
  },
  {
    id: 'opus_wale_cord', name: 'Wale Cord', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Record-store clerks, art teachers, suburban dads',
    why: 'Wide-wale corduroy: alternating ribs run unbroken down every face in warm earth colors, finished with a plain dark hem and a leather back tab.',
    cw: [
      ['Tobacco', 0x95562a, 0x55301a, 0xbb7a3e, 0xe9d1a0],
      ['Mustard', 0xcc8f17, 0x7e5208, 0xeab23d, 0x3b2918],
      ['Bottle', 0x2c6642, 0x173a26, 0x45895a, 0xe3cf9c],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [D, 0];
      if (q.y === 9 && back(q) && q.u === 1) return [T, 0];
      return [(q.u + q.z) % 2 === 0 ? C : A, 0];
    },
  },
  {
    id: 'opus_night_leather', name: 'Night Leather', category: 'pants', form: 'roomy', tier: 'epic',
    wears: 'Club promoters on the strip, penthouse collectors',
    why: 'Coated leather with toon shine streaks down each front, quilted moto grooves over the knee, and a metal zip opening each hem at the outside front.',
    cw: [
      ['Oxblood', 0x6a1626, 0x2c070f, 0xc04a5a, 0xe0c27a],
      ['Black Gloss', 0x2b2b34, 0x0b0b0f, 0x8a8d9c, 0xd6dce4],
      ['Bone', 0xe2dccd, 0x8f8572, 0xfbf8f1, 0xc29a52],
    ],
    paint(q, [C, D, A, T]) {
      if ((q.y === 4 && q.u === 3 && q.z === 1) || (q.y === 5 && q.u === 2 && face(q))) return [T, 2];
      if (front(q) && q.u <= 2 && (q.y === 5 || q.y === 7)) return [D, 1];
      if (face(q) && q.u === 1 && q.y !== 4) return [A, 1];
      return [C, 1];
    },
  },
  {
    id: 'opus_swish_shell', name: 'Swish Shell', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Corner hustlers, bail bondsmen off the clock, gym rats',
    why: 'Shiny nylon with a contrast lower-leg block, a white piped seam across the knee and a matte elastic cuff gathered on the shoe.',
    cw: [
      ['Teal / Grape', 0x17a196, 0x15151b, 0x6a2bd6, 0xf4f4ef],
      ['Red / Navy', 0xd62a35, 0x15151b, 0x1d3275, 0xf4f4ef],
      ['Coal / Volt', 0x23252c, 0x0f1013, 0xb7f02a, 0xf4f4ef],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [D, 0];
      if (q.y === 5) return [A, 1];
      if (q.y === 6) return [T, 1];
      return [C, 1];
    },
  },
  {
    id: 'opus_yard_camo', name: 'Yard Camo', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Junkyard crews, forest-edge hunters, trailer-park hustlers',
    why: 'Chunky four-tone camouflage over the whole leg, with a solid flapped cargo pocket riding mid-thigh on one side.',
    cw: [
      ['Woodland', 0x9a925a, 0x6a4a2b, 0x4a6b33, 0x24221c],
      ['Concrete', 0xa9abb2, 0x5e616b, 0xd6d4cc, 0x2a2c32],
      ['Hot Camo', 0xff4fa3, 0x2b1240, 0x7a3cff, 0xffc21a],
    ],
    paint(q, [C, D, A, T]) {
      if (q.side > 0 && outer(q) && q.y >= 6 && q.y <= 7 && q.z >= -1) return [q.y === 7 ? T : D, 0];
      const a = blob(q, 2, 11, 1, 0, 1), b = blob(q, 2, 23), c = blob(q, 1, 5);
      if (c < .08) return [T, 0];
      if (a < .3) return [A, 0];
      if (b < .3) return [D, 0];
      return [C, 0];
    },
  },
  {
    id: 'opus_ward_scrubs', name: 'Ward Scrubs', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Hospital nurses, orderlies, night-shift EMTs',
    why: 'Clean matte scrub cloth in medical colors, a white drawstring at the waist and a utility pocket on one shin with a pen clipped in.',
    cw: [
      ['Ceil Blue', 0x7db6ea, 0x4677b0, 0x5b95d2, 0xf4f6f8],
      ['Surgical Teal', 0x2fa68c, 0x1a6553, 0x24896f, 0xf4f6f8],
      ['Night Berry', 0xc0376f, 0x751a43, 0x9c2858, 0xf4f6f8],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 9 && face(q) && q.u === 0) return [T, 0];
      if (q.y === 8 && face(q) && q.u === 0 && q.side < 0) return [T, 0];
      if (q.side < 0 && face(q) && q.u >= 1 && q.y >= 5 && q.y <= 6) return [q.y === 6 && q.u === 2 ? T : A, 0];
      if (back(q) && q.u === 0) return [D, 0];
      return [C, 0];
    },
  },
  {
    id: 'opus_county_issue', name: 'County Issue', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Inmates at county, work-release crews on the highway',
    why: 'Solid jail-issue color with a black stenciled block on one shin and a white ID strip across the other thigh; unmistakable from the end of the block.',
    cw: [
      ['County Orange', 0xff6a13, 0x1c1a19, 0xd9530a, 0xf4f1ea],
      ['Holding Yellow', 0xffc21a, 0x1c1a19, 0xd59c0c, 0xf4f1ea],
      ['Max Red', 0xd9262f, 0x1c1a19, 0xa91b23, 0xf4f1ea],
    ],
    paint(q, [C, D, A, T]) {
      if (q.side < 0 && face(q) && q.u <= 2 && q.y >= 5 && q.y <= 6) return [q.u === 1 && q.y === 5 ? C : D, 0];
      if (q.side > 0 && face(q) && q.y === 7 && q.u >= 1) return [T, 0];
      if (back(q) && q.u === 0) return [A, 0];
      return [C, 0];
    },
  },
  {
    id: 'opus_night_shift', name: 'Night Shift', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Dock crews, highway flaggers, construction labor',
    why: 'Workwear thighs over fluorescent shins wrapped by two coated reflective bands, the safety-spec look of every crew on the docks.',
    cw: [
      ['Navy / Lime', 0x1e2b4b, 0x101828, 0xc6f425, 0xdfe3e8],
      ['Coal / Signal', 0x2a2d35, 0x15171b, 0xff6a13, 0xdfe3e8],
      ['Lime / Navy', 0xc6f425, 0x6a8a10, 0x1e2b4b, 0xdfe3e8],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 5 || q.y === 7) return [T, 1];
      if (q.y <= 6) return [A, 0];
      if (back(q) && q.u === 0) return [D, 0];
      return [C, 0];
    },
  },
  {
    id: 'opus_counsel_stripe', name: 'Counsel Stripe', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Lawyers, bail bondsmen, the mayor\'s people',
    why: 'Chalk-stripe suiting with one stripe per face, a plain turned-up cuff where the stripes stop, a sewn pleat and a brass buckle.',
    cw: [
      ['Charcoal Chalk', 0x4a4d57, 0x25272d, 0xa6abb6, 0xd2ad5c],
      ['Navy Chalk', 0x1f2a4f, 0x101731, 0x93a3cc, 0xd2ad5c],
      ['Brown Glen', 0x6a4931, 0x3a2717, 0xd0b087, 0xd2ad5c],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [C, 0];
      if (q.y === 9 && face(q) && q.u === 0 && q.side > 0) return [T, 2];
      if (q.y === 9 && face(q) && q.u === 1) return [D, 0];
      const stripe = (face(q) && q.u === 1) || (outer(q) && q.z === -1) || (q.z === q.z0 && q.u === 1);
      return [stripe ? A : C, 0];
    },
  },
  {
    id: 'opus_stoop_sweats', name: 'Stoop Sweats', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Gym rats, stoop hustlers, suburban dads on a store run',
    why: 'Heathered fleece with a ribbed elastic cuff gathered over the shoe and a white drawstring hanging at the waist.',
    cw: [
      ['Heather Grey', 0x9da1a8, 0x5f636b, 0xb1b5ba, 0xf4f4f0],
      ['Coal Heather', 0x3b3d44, 0x1f2024, 0x4d5059, 0xf4f4f0],
      ['Varsity Red', 0xc5303a, 0x7d1a22, 0xd44a53, 0xf4f4f0],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [(q.u + q.z) % 2 === 0 ? D : C, 0];
      if (face(q) && q.u === 0 && q.y >= 8) return [T, 0];
      return [hash(q.x, q.y, q.z, 3) < .14 ? A : C, 0];
    },
  },
];
