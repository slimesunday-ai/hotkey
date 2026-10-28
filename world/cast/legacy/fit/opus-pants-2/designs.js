// Opus 2 pants: a culture drop (hypebeast grails, Dazed/art-world, crime flex, NYC).
// Paint-only on astra's approved fuller ROOMY profile, like the first Opus pants: no
// voxel is added or cut, so the thickness, clearance cuts, knee/ankle interface and the
// walk stay approved. Each design builds its own silhouette features in paint (rolls,
// fur warmers, straps, tapes, cuffs, monitors) plus material (0 matte, 1 coated, 2 metal).
// Colors are [cloth, shadow, accent, trim]. The y4 hem also dresses the foot-owned
// ankle row. Under most tops only y4..y7 shows, so identity lives below mid-thigh.
// Invented brands only; every crime reference is fictional.
//
// ROOMY cells: y4 w5 z-1..1 (hem) · y5..y8 w4 z-2..3 (u3 front cut away) · y9 w4 z-1..1.
const front = q => q.z >= 1;                 // the forward half of the leg
const face = q => q.z === q.z1;              // the front-most face of a row
const outer = q => q.u === q.width - 1;      // outseam column
const back = q => q.z <= -1;
const L = q => q.side < 0, R = q => q.side > 0;
// Chunky deterministic value noise (no Math.random).
const hash = (a, b, c, seed) => {
  let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
// A walk around the leg's surface: inner face → front → outer side → back, so a
// pattern can wrap continuously (front u0..2 = 0..2, outer side z 2..-2 = 3..7, back 8+).
const around = q => (q.z >= 2 && q.u <= 2 ? q.u : q.u >= q.width - 1 || (q.y === 4 && q.u >= 3) ? 3 + (3 - q.z) : q.z <= -2 ? 9 + (3 - q.u) : q.u + 4 - q.z);

export const DESIGNS = [
  {
    id: 'opus2_whole_car', name: 'Whole Car', category: 'pants', form: 'roomy', tier: 'grail',
    wears: 'Writers who bench the yard at 4am, gallery-flipped graffiti legends',
    vibe: 'NYC subway whole-car burner',
    why: 'Brushed stainless subway-car steel with a wildstyle burner across the left leg and spilling over the right shin: hot fill, a hard dark outline stepping up like letters, and a shine on each letter.',
    cw: [
      ['Lexington Steel', 0xbcc3cc, 0x2a2533, 0xff4fa3, 0xfff36b],
      ['Night Yard', 0x6d727c, 0x101015, 0x2de2e6, 0xb7f02a],
      ['Gold Line', 0xd9b45a, 0x2b1b12, 0x2f5bff, 0xff7a1a],
    ],
    paint(q, [C, D, A, T]) {
      const top = (L(q) ? [7, 6, 7, 6, 4] : [6, 5, 4, 4, 4])[q.u];   // the piece's letter heights per column
      if ((q.z >= 0 || outer(q)) && q.y >= 5) {           // it wraps the front and outside
        if (q.y === top + 1) return [D, 0];               // stepped outline above
        if (q.y <= top) return [(q.y === top && q.u % 2 === 0) || (q.y === 5 && q.u === 1 && face(q)) ? T : A, 0];
        if (q.y === 5) return [D, 0];                     // underline
      }
      return [q.z === q.z0 && q.u === 1 ? D : C, 2];          // brushed steel, one car-body seam at the back
    },
  },
  {
    id: 'opus2_one_leg_up', name: 'One Leg Up', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Block-party MCs, stoop DJs, kids who saw the video once',
    vibe: '90s NYC hip-hop, one leg rolled',
    why: 'Baggy rinse denim with the left leg shoved up into a fat inside-out roll at the knee over a striped tube sock; the right leg stays long and stacks on the shoe.',
    cw: [
      ['Mid Rinse', 0x3c5f99, 0x1d2f52, 0x9cb6db, 0xf4f3ee],
      ['Black Wash', 0x2e3036, 0x15161a, 0x8d9099, 0xf4f3ee],
      ['Timber Wheat', 0xb88a4a, 0x6e4e24, 0xe3c99a, 0xf4f3ee],
    ],
    paint(q, [C, D, A, T]) {
      if (L(q)) {
        if (q.y <= 5) return [T, 0];                                         // tube sock
        if (q.y === 6) return [A, 0];                                         // the fat roll
        if (q.y === 7) return [front(q) ? D : C, 0];                          // bunched fold above it
      } else if (q.y === 4) return [D, 0];                                    // stacked hem
      else if (q.y === 5 && face(q) && q.u % 2 === 0) return [A, 0];        // honeycomb stack
      return [back(q) && q.u === 0 ? D : C, 0];
    },
  },
  {
    id: 'opus2_thank_you', name: 'Thank You Bag', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Bodega night-shift, art kids, anyone with a chopped cheese',
    vibe: 'NYC bodega plastic bag, gallery-shop edition',
    why: 'Crinkled coated plastic in bag white with stacked red lettering bands wrapping the leg and a big round smiley stamp on one shin.',
    cw: [
      ['Corner Classic', 0xf3f1ea, 0xc9c6bd, 0xd9232e, 0xffd21f],
      ['Black Bag', 0x26272c, 0x111215, 0xf3f1ea, 0xff4fa3],
      ['Deli Yellow', 0xffd84a, 0xd6a817, 0xd9232e, 0x17171b],
    ],
    paint(q, [C, D, A, T]) {
      if (R(q) && face(q) && q.y === 7 && q.u <= 1) return [T, 1];   // smiley stamp at the knee
      const s = around(q);
      if ((q.y === 5 || q.y === 8) && s % 3 !== 2) return [A, 1];   // "THANK YOU" letter runs
      if ((q.y === 6 || q.y === 9) && s % 3 === 0) return [A, 1];   // their ascenders
      return [hash(q.x, q.y, q.z, 41) < .16 ? D : C, 1];          // crinkles
    },
  },
  {
    id: 'opus2_club_fluff', name: 'Club Fluff', category: 'pants', form: 'roomy', tier: 'epic',
    wears: 'Club kids queueing on 14th at 2am, door girls, party monsters',
    vibe: 'NYC club kids',
    why: 'High-gloss vinyl thighs over giant shaggy neon faux-fur warmers from the knee down, the fur edge breaking up unevenly over the vinyl.',
    cw: [
      ['Pink Riot', 0x1b1a20, 0x0a0a0d, 0xff4fa3, 0xffc0e0],
      ['Toxic', 0xe9e7f2, 0x9c99a8, 0x8cff2a, 0xfff36b],
      ['Ultra', 0x5a1fd1, 0x2a0b6b, 0x2de2e6, 0xf4f4ff],
    ],
    paint(q, [C, D, A, T]) {
      const edge = 6 + (hash(q.x, 0, q.z, 13) < .5 ? 1 : 0);
      if (q.y <= edge) return [hash(q.x, q.y, q.z, 7) < .3 ? T : A, 0];   // fur
      if (face(q) && q.u === 1) return [D, 1];                            // vinyl seam crease
      return [back(q) ? D : C, 1];
    },
  },
  {
    id: 'opus2_maison_mono', name: 'Maison Mono', category: 'pants', form: 'roomy', tier: 'grail',
    wears: 'Resale kings, kingpins\' girlfriends, the guy with the receipts',
    vibe: 'hypebeast luxury monogram grail (invented house)',
    why: 'Coated canvas covered edge to edge in a staggered two-tone monogram (the invented house of Maison Mono) and finished in a tan leather cuff and waist, like the trunk it was cut from.',
    cw: [
      ['Trunk Brown', 0x5a3a24, 0x3a2416, 0xc9a26a, 0xd8b07a],
      ['Noir Canvas', 0x1d1d22, 0x0d0d10, 0x8a8d96, 0xc8a24a],
      ['Rose Canvas', 0xe58fb4, 0xb85b86, 0xfff1f6, 0xf3e6c8],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4) return [T, 1];                          // leather cuff
      if (q.y === 9 && face(q) && q.u === 1) return [T, 2];  // a brass lock plate
      const s = around(q), row = q.y % 2;
      if ((s + row * 2) % 4 === 0) return [A, 1];            // monogram flower
      if ((s + row * 2) % 4 === 2 && q.y % 2 === 1) return [D, 1];
      return [C, 1];
    },
  },
  {
    id: 'opus2_drop_tape', name: 'Drop Tape', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Line-sitters, resellers, the kid who got the Friday drop',
    vibe: 'hypebeast drop-day logo tape (invented label)',
    why: 'Black nylon with a wide jacquard logo tape wrapping the front-outer edge of each leg in alternating box-logo blocks, and one box-logo patch on the right shin.',
    cw: [
      ['Drop Red', 0x1c1c21, 0x0c0c0f, 0xe0262f, 0xf6f6f2],
      ['Royal Drop', 0x22356e, 0x111a3b, 0xffd21f, 0x17171b],
      ['Bone Drop', 0xe8e3d6, 0xb6af9d, 0x17171b, 0xff6a13],
    ],
    paint(q, [C, D, A, T]) {
      if (outer(q) || (face(q) && q.u === 2) || (q.y === 4 && q.u >= 3)) return [(q.y + q.z) % 2 === 0 ? A : T, 0];   // logo tape
      if (R(q) && face(q) && q.y >= 5 && q.y <= 6 && q.u >= 1) return [A, 0];                           // box logo patch
      if (q.y === 4) return [D, 1];
      return [back(q) && q.u === 0 ? D : C, 1];
    },
  },
  {
    id: 'opus2_bondage_tartan', name: 'Bondage Tartan', category: 'pants', form: 'roomy', tier: 'epic',
    wears: 'Gallery-opening punks, Dazed cover kids, bouncers who read',
    vibe: 'Dazed punk revival bondage trouser',
    why: 'Loud red tartan with black bondage straps buckled across both knees, each strap held by a silver D-ring at the front, and the check running straight onto the shoe.',
    cw: [
      ['Riot Red', 0xc8202c, 0x17171b, 0xffd21f, 0xdfe6ee],
      ['Black Watch', 0x1f4a3a, 0x0e1a2c, 0x3fa9f5, 0xdfe6ee],
      ['Acid Plaid', 0xb7f02a, 0x17171b, 0xff4fa3, 0xdfe6ee],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 6) return [face(q) && q.u === 1 ? T : D, face(q) && q.u === 1 ? 2 : 1];   // knee strap + D-ring
      const s = around(q);
      if (s % 4 === 0 || q.y === 8) return [D, 0];   // tartan bars (the y8 bar doubles as the thigh strap)
      if (q.y === 7 && s % 4 === 2) return [A, 0];   // the overcheck
      return [C, 0];
    },
  },
  {
    id: 'opus2_fitting_toile', name: 'Fitting Toile', category: 'pants', form: 'roomy', tier: 'epic',
    wears: 'Fashion students, gallery assistants, conceptual tailors',
    vibe: 'Dazed / art-world unfinished toile',
    why: 'An unfinished muslin fitting toile worn as the final piece: a yellow tape measure hangs down the left leg, basting stitches run the seams and a chalk slash marks the right shin for a cut.',
    cw: [
      ['Calico', 0xe9e0c8, 0x3a3631, 0xffcc1a, 0xd9232e],
      ['Pattern Paper', 0xd8d2bd, 0x2f5bff, 0xffcc1a, 0x17171b],
      ['Black Toile', 0x2a2a2e, 0xf4f1ea, 0xffcc1a, 0xff4fa3],
    ],
    paint(q, [C, D, A, T]) {
      if (L(q) && face(q) && q.u === 1) return [q.y % 2 === 0 ? T : A, 0];   // tape measure hung down the front, ticked
      if (R(q) && face(q) && q.y >= 5 && q.y <= 7) return [q.u === q.y - 5 ? D : C, 0];   // a chalk slash across the right shin
      if (outer(q) && q.z === 0 && q.y % 2 === 1) return [D, 0];      // basting down the outseam
      if (q.y === 4) return [(q.u + q.z + 3) % 3 === 0 && face(q) ? T : C, 0];   // pins at the raw hem
      return [C, 0];
    },
  },
  {
    id: 'opus2_dye_pack', name: 'Dye Pack', category: 'pants', form: 'roomy', tier: 'epic',
    wears: 'Getaway drivers, bank-job crews, people who need new pants',
    vibe: 'fictional heist gone wrong: money print + exploded dye pack',
    why: 'An all-over banknote print (stacked bills with pale portrait windows) blasted by an exploded dye pack: a red burst on the right thigh and spatter running down both legs.',
    cw: [
      ['Greenback', 0x5f8a55, 0x2f4a2b, 0xe8eccf, 0xe4182b],
      ['Euro Pink', 0xd88aa6, 0x8b3c5a, 0xf7ecd9, 0x2f5bff],
      ['Gold Note', 0xc9a64a, 0x6c5221, 0xf4eacc, 0x7a3cff],
    ],
    paint(q, [C, D, A, T]) {
      const dx = q.u - 1, dy = q.y - 6, burst = R(q) && q.z >= 2 && dx * dx + dy * dy <= 1;
      if (burst || (R(q) && face(q) && q.u === 0 && q.y === 4) || hash(q.x, q.y, q.z, 77) < (R(q) ? .14 : .09)) return [T, 0];
      const s = around(q), bx = (s + (q.y % 4 < 2 ? 0 : 2)) % 4;   // bills: 4 wide, 2 tall, brick-stacked
      if (q.y % 2 === 0 && bx === 1) return [A, 0];                 // portrait window
      if (bx === 3) return [D, 0];                                  // bill edge
      return [C, 0];
    },
  },
  {
    id: 'opus2_gator_don', name: 'Gator Don', category: 'pants', form: 'roomy', tier: 'rare',
    wears: 'Kingpins, loan sharks, the uncle with the boat',
    vibe: 'fictional crime boss exotic skin',
    why: 'Glossy croc-embossed skin, dark grooves streaking between low lit scales, and polished gold tips capping both hems like the boots he wears with it.',
    cw: [
      ['Oxblood Don', 0x6a1626, 0x2a070e, 0x82243a, 0xe7bd4a],
      ['Swamp Don', 0x2e4a2a, 0x141f12, 0x3d5c34, 0xe7bd4a],
      ['Bone Don', 0xe6dccb, 0xa8987f, 0xf6efe2, 0xc0c6cf],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y === 4 && q.z >= 0) return [T, 2];                     // gold tips
      const g = hash(q.x, (q.y + (q.x & 1)) >> 1, q.z, 5), k = hash(q.x, q.y, q.z, 6);   // grooves run in 2-row streaks
      return [g < .3 ? D : k < .3 ? A : C, 1];                       // dark grooves, slightly lit scale crowns
    },
  },
  {
    id: 'opus2_iced_out', name: 'Iced Out', category: 'pants', form: 'roomy', tier: 'grail',
    wears: 'Kingpins at the listening party, rappers on their second album',
    vibe: 'hip-hop / kingpin bling',
    why: 'Deep black velvet with rhinestone pinstripes dotted down every face and a tall iced cuff of stones in gold settings throwing light over the shoe; a gold chain loop hangs at the right hip.',
    cw: [
      ['Black Ice', 0x16161b, 0x08080a, 0xe8f3ff, 0xe7bd4a],
      ['Royal Ice', 0x1c2a78, 0x0c1440, 0xe8f3ff, 0xe7bd4a],
      ['Pink Ice', 0xe0578f, 0x8d2353, 0xf8fbff, 0xe7bd4a],
    ],
    paint(q, [C, D, A, T]) {
      if (q.y <= 5) return ((q.u + q.z + q.y) & 1) === 0 ? [A, 1] : [T, 2];                     // iced cuff: stones in gold settings
      const stripe = (face(q) && q.u === 1) || (outer(q) && q.z === -1) || (q.z === q.z0 && q.u === 0);
      if (stripe) return q.y % 2 === 1 ? [A, 1] : [D, 0];                                        // dotted stone pinstripe
      if (R(q) && outer(q) && q.y >= 7 && q.y <= 8 && q.z === 0) return [T, 2];                   // chain loop
      return [C, 0];
    },
  },
  {
    id: 'opus2_grill_check', name: 'Grill Check', category: 'pants', form: 'roomy', tier: 'common',
    wears: 'Bodega grill men, deli counter crews, line cooks on a smoke break',
    vibe: 'NYC bodega grill cook',
    why: 'Salt-and-pepper chef check over the whole leg, a plain dark hem, and a white grill rag tucked into the right hip pocket hanging down the outseam.',
    cw: [
      ['Salt & Pepper', 0x1d1d22, 0x101014, 0xf4f1ea, 0x2f5bff],
      ['Blue Check', 0x22356e, 0x111a3b, 0xf4f1ea, 0xd9232e],
      ['Red Check', 0xc8202c, 0x5c0d13, 0xf4f1ea, 0x17171b],
    ],
    paint(q, [C, D, A, T]) {
      if (R(q) && outer(q) && q.y >= 6 && q.y <= 8 && q.z <= 0 && q.z >= -1) return [T, 0];   // grill rag (a blue shop towel in the classic colorway)
      if (q.y === 4) return [D, 0];
      return [((q.x + q.y + q.z) & 1) === 0 ? C : A, 0];   // chef check
    },
  },
];
