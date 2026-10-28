// Original AI City pants drop. Colors are [cloth, shadow, accent, highlight].
// Every design paints only the accepted roomy cells; the foot-owned hem samples y=4.
const front = q => q.z >= 1;
const outer = q => q.u >= q.width - 2;

export const DESIGNS = [
  {
    id: 'drop_p_rinse_signal', name: 'Rinse Signal', category: 'pants', form: 'roomy', tier: 'common',
    why: 'A recognizable deep-rinse jean with broad worn front columns and dark continuous side seams.',
    cw: [
      ['Blue Hour', 0x24437e, 0x101f42, 0x456bb5, 0x8bb9ec],
      ['Black Ice', 0x292f3b, 0x111722, 0x555f72, 0xa1b2c8],
      ['Plum Rinse', 0x593863, 0x281d35, 0x9558a3, 0xdba9de]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.u === q.width - 1 || (q.u === 0 && q.z <= 0)) return [D, 0];
      if (front(q) && q.u <= 2 && q.y >= 5 && q.y <= 8) {
        return [q.u === 1 && q.y >= 6 && q.y <= 7 ? T : A, 0];
      }
      return [C, 0];
    }
  },
  {
    id: 'drop_p_rivet_yard', name: 'Rivet Yard', category: 'pants', form: 'roomy', tier: 'common',
    why: 'Oversized double-knee work panels occupy the readable front of both legs, with one restrained rivet per panel.',
    cw: [
      ['Signal Worker', 0x242b36, 0x111720, 0xff721e, 0xc6d1df],
      ['Blue Union', 0x1c3876, 0x0d1d43, 0x6da4f3, 0xe7ecf2],
      ['Red Shop', 0x75252d, 0x33181f, 0xef3d4d, 0xe4cfd0]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (front(q) && q.u >= 1 && q.y >= 5 && q.y <= 7) {
        if (q.u === 2 && q.y === 7 && q.z === q.z1) return [T, 2];
        return [A, 0];
      }
      if (front(q) && q.y === 8 && q.u >= 1) return [D, 0];
      return [q.u === 0 && q.z <= 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_lockbox_cargo', name: 'Lockbox Cargo', category: 'pants', form: 'roomy', tier: 'common',
    why: 'Large cargo pockets wrap the outside of each leg at deliberately offset heights, making the utility construction legible.',
    cw: [
      ['Courier Lime', 0x252d39, 0x111823, 0xa9e51b, 0xefffa9],
      ['Metro Purple', 0x343070, 0x171638, 0xa576f5, 0xd9c2ff],
      ['Paint Crew', 0xdddfe3, 0x727d90, 0xff412e, 0x7c2024]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const pocketTop = q.side < 0 ? 8 : 7;
      if (outer(q) && q.y >= pocketTop - 2 && q.y <= pocketTop && q.z >= 0) {
        return [q.y === pocketTop ? T : A, 0];
      }
      if (outer(q) && q.y === pocketTop - 3 && q.z >= 0) return [D, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_aircut_track', name: 'Aircut Track', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'A broad aerodynamic wedge sweeps from the outer thigh toward the inner ankle, finished with one clear speed line.',
    cw: [
      ['Electric Track', 0x152243, 0x080e22, 0x1673ff, 0x9df5ff],
      ['Pit Orange', 0x232a32, 0x101418, 0xff611c, 0xf9f1df],
      ['Lemon Sprint', 0x402167, 0x211136, 0xe3f51b, 0xfcffd0]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const sweep = q.y - q.u;
      if (q.z >= 0 && sweep <= 5) return [A, 0];
      if (q.z >= 0 && sweep === 6) return [T, 0];
      return [q.z < 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_rain_delay', name: 'Rain Delay', category: 'pants', form: 'roomy', tier: 'common',
    why: 'Heavy dipped lower legs form a waterproof trouser treatment; the staggered upper boundary is the accent, never a pale ankle band.',
    cw: [
      ['Storm Orange', 0xf06525, 0x172432, 0xffb82f, 0x45556c],
      ['Night Ferry', 0x2177c1, 0x111b35, 0x62d9f0, 0x394878],
      ['Purple Squall', 0x9c58d6, 0x28213c, 0xff6db5, 0x4e4169]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const level = q.side < 0 ? 6 : 5;
      if (q.y <= level) return [front(q) && q.u === 2 ? T : D, front(q) && q.u === 2 ? 1 : 0];
      if (q.y === level + 1) return [A, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_apex_paddock', name: 'Apex Paddock', category: 'pants', form: 'roomy', tier: 'epic',
    why: 'Motocross-style thigh guards, a dark knee hinge and an outer shin guard create three large structural zones.',
    cw: [
      ['Redline Armor', 0xf0f1f4, 0x1d222c, 0xf43837, 0x737e92],
      ['Acid Paddock', 0xced91a, 0x162126, 0x0fb6b4, 0xf0f5df],
      ['Royal Pit', 0x4e30b7, 0x161632, 0xff8730, 0xcab5ff]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.y === 6) return [D, 0];
      if (q.y >= 7 && front(q)) return [q.u === 0 ? T : A, 0];
      if (q.y <= 5 && q.u >= 2) return [A, 0];
      if (q.z < 0 && q.u <= 1) return [D, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_cut_class', name: 'Cut Class', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'Four oversized fabric blocks meet at unequal seam heights, giving the pair an intentional reconstructed art-school silhouette.',
    cw: [
      ['Primary Seminar', 0x2f56b5, 0x152247, 0xf65039, 0xf1d832],
      ['Studio Violet', 0x8a48c0, 0x241831, 0x27c9a9, 0xf5a5d4],
      ['Darkroom Pop', 0xdadfe6, 0x252b36, 0xfa5424, 0x3b64de]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.side < 0) return [q.y >= 7 ? C : A, 0];
      if (q.y >= 6) return [q.z < 0 ? C : T, 0];
      return [D, 0];
    }
  },
  {
    id: 'drop_p_velvet_queue', name: 'Velvet Queue', category: 'pants', form: 'roomy', tier: 'common',
    why: 'A club trouser with a single full-height outer satin ribbon and a quiet dark body; value contrast carries the tailored shape.',
    cw: [
      ['Midnight Door', 0x171c2a, 0x090d17, 0x665ce8, 0xb5a5ff],
      ['Oxblood Room', 0x441d30, 0x200f1a, 0xd9335e, 0xff8eae],
      ['Bottle Service', 0x153d42, 0x092025, 0x13c6b3, 0x89efda]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.u === q.width - 1) return [q.z === 0 ? T : A, q.z === 0 ? 1 : 0];
      if (q.u === 0 || q.z < 0) return [D, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_hammer_shift', name: 'Hammer Shift', category: 'pants', form: 'roomy', tier: 'common',
    why: 'A carpenter trouser uses a bold L-shaped tool reinforcement on one leg and a broad rear utility pocket on the other.',
    cw: [
      ['Night Carpenter', 0x425273, 0x182337, 0xf6a820, 0x8fa5c9],
      ['Concrete Shift', 0xc8ced8, 0x343f52, 0x285ed1, 0xf2f4f7],
      ['Red Workshop', 0xa53640, 0x471c2b, 0xeebc31, 0xec7d86]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.side < 0 && q.z >= 0 && ((q.u === 2 && q.y >= 5 && q.y <= 8) || (q.y === 5 && q.u >= 2))) return [A, 0];
      if (q.side > 0 && q.z <= 0 && q.y >= 7 && q.u >= 1) return [q.y === 8 ? T : D, 0];
      return [q.u === 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_spill_studio', name: 'Spill Studio', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'One connected paint spill descends in two broad irregular fingers; it reads as a graphic treatment instead of scattered speckles.',
    cw: [
      ['Cobalt Spill', 0xdce1e9, 0x303c54, 0x2857ed, 0x7ca8ff],
      ['Pink Spill', 0x29223a, 0x12101f, 0xfa4d9a, 0xffbad8],
      ['Hot Spill', 0x24373b, 0x102025, 0xff6c25, 0xffbb44]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const bottoms = q.side < 0 ? [7, 4, 5, 7, 7] : [8, 7, 6, 7, 7];
      if (q.z >= 0 && q.y >= bottoms[q.u]) return [q.side < 0 && q.u === 1 && q.y >= 7 ? T : A, 0];
      return [q.z < 0 && q.u === 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_window_seat', name: 'Window Seat', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'A single oversized windowpane cross on each leg makes four calm fabric windows, with one blocked lower window as the editorial accent.',
    cw: [
      ['Blue Window', 0xd1dded, 0x223457, 0x3474e7, 0x759ded],
      ['Pink Window', 0xeab6dc, 0x4f2456, 0xb731be, 0xf584d6],
      ['Lime Window', 0xd4e542, 0x24392a, 0x268b70, 0x93c74f]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.u === 1 || q.y === 6) return [D, 0];
      if (q.side > 0 && q.y < 6 && q.u >= 2) return [A, 0];
      if (q.side < 0 && q.y > 6 && q.u >= 2 && q.z < 0) return [T, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_spiral_ramp', name: 'Spiral Ramp', category: 'pants', form: 'roomy', tier: 'epic',
    why: 'A wide colored construction tape turns from the thigh front to the outer knee and around the lower back, creating a readable wrapped seam.',
    cw: [
      ['Ramp Violet', 0x2a2c43, 0x121627, 0xac55ff, 0xe8b5ff],
      ['Ramp Vermilion', 0xced5df, 0x344151, 0xf34b2e, 0xffad75],
      ['Ramp Cyan', 0x233d63, 0x0c1c37, 0x10d2db, 0xb4faf2]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const wrap = (q.y >= 7 && front(q)) || (q.y >= 5 && q.y <= 7 && outer(q)) || (q.y <= 5 && q.z <= 0);
      if (wrap) return [q.y === 7 && outer(q) ? T : A, 0];
      return [q.u === 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_benchside', name: 'Benchside', category: 'pants', form: 'roomy', tier: 'common',
    why: 'A full-height contrast tearaway placket puts three large, widely spaced snaps along each outside leg.',
    cw: [
      ['Home Blue', 0x2155bd, 0x0b2459, 0xf0f3f6, 0x77869e],
      ['Away Red', 0xcd303d, 0x5b1223, 0xf9d83c, 0xdddfe7],
      ['Night Warmup', 0x262b3b, 0x101523, 0xff6c27, 0xc1cbdb]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.u === q.width - 1) {
        if (q.z === 0 && (q.y === 4 || q.y === 6 || q.y === 8)) return [T, 2];
        return [A, 0];
      }
      if (q.u === q.width - 2 && q.z <= 0) return [D, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_seam_split', name: 'Seam Split', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'Two different denim legs are joined by an exposed, bright inner seam that continues down to the shoe; a turned-out upper pocket completes the reconstruction.',
    cw: [
      ['Two Blue', 0x6d98d0, 0x203b75, 0xef552f, 0xc1d8f0],
      ['Ink and Coal', 0x7b8497, 0x25283a, 0xbae52c, 0xd9e1eb],
      ['Violet Twin', 0xa775c8, 0x482664, 0x38d9c3, 0xe5bcef]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.u === 0 && q.z >= 0) return [A, 0];
      if (q.side > 0 && q.y >= 8 && front(q) && q.u >= 1) return [T, 0];
      return [q.side < 0 ? C : D, 0];
    }
  },
  {
    id: 'drop_p_hotfoot', name: 'Hotfoot', category: 'pants', form: 'roomy', tier: 'epic',
    why: 'One giant connected flame on each lower leg grows into uneven pointed tongues, preserving a clean dark upper trouser.',
    cw: [
      ['Street Furnace', 0x211d2b, 0x0d0c17, 0xff5125, 0xffc72c],
      ['Cold Burn', 0x13233b, 0x091220, 0x1b78f0, 0x62e7f4],
      ['Purple Heat', 0x2e163f, 0x160b23, 0xc839e7, 0xff71b0]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const tips = q.side < 0 ? [5, 7, 6, 8, 5] : [6, 8, 6, 7, 5];
      if (q.z >= 0 && q.y <= tips[q.u]) {
        return [q.y <= 5 && q.u >= 1 && q.u <= 2 ? T : A, 0];
      }
      return [q.z < 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_alloy_shift', name: 'Alloy Shift', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'A single coated inspection plate and a broad opposing-leg safety chevron give industrial workwear a clean future-city edge.',
    cw: [
      ['Inspection Silver', 0x343f51, 0x131f31, 0xc5d4e7, 0xff6528],
      ['Inspection Iris', 0x3d2d62, 0x1b1531, 0xb3a6f0, 0x56e0d0],
      ['Inspection Glacier', 0xc5d8df, 0x2d475b, 0x718ca6, 0xf03651]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.side < 0 && front(q) && q.y >= 6 && q.y <= 8 && q.u <= 2) return [q.y === 6 ? D : A, q.y === 6 ? 0 : 1];
      if (q.side > 0 && q.z >= 0 && q.y === 7 - Math.min(q.u, 2)) return [T, 0];
      if (q.u === 0 && q.z <= 0) return [D, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_receipt_roll', name: 'Receipt Roll', category: 'pants', form: 'roomy', tier: 'rare',
    why: 'An oversized receipt graphic runs down one leg as a single paper strip with two bold ink bars; the opposite pocket is a saturated price-tab block.',
    cw: [
      ['Corner Receipt', 0x222a35, 0x080e17, 0xeaf0f3, 0xff8a26],
      ['Night Till', 0x3b285f, 0x180f2d, 0xf0d5ef, 0x57dfbd],
      ['Blue Docket', 0x173a69, 0x0a1b37, 0xc9eff2, 0xf84862]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.side < 0 && front(q) && q.u >= 1 && q.u <= 2 && q.y >= 5) {
        return [(q.y === 6 && q.u === 1) || q.y === 8 ? D : A, 0];
      }
      if (q.side > 0 && outer(q) && q.y >= 7 && q.z >= 0) return [T, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_disco_archive', name: 'Disco Archive', category: 'pants', form: 'roomy', tier: 'epic',
    why: 'One oversized record roundel dominates a clean front leg; the second leg uses a solid sleeve-color block, like a collectible twelve-inch jacket.',
    cw: [
      ['First Press', 0xc5cfdd, 0x141e2e, 0xf34763, 0x4374d8],
      ['Purple Press', 0xa487da, 0x291742, 0xf8d73a, 0x583a8d],
      ['Orange Press', 0xe76d32, 0x30213b, 0x67e0db, 0xb43c32]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.side < 0 && front(q)) {
        const radius = Math.abs(q.y - 6) + Math.abs(q.u - 1);
        if (radius <= 2) return [radius === 0 ? A : D, radius === 0 ? 1 : 0];
      }
      if (q.side > 0 && q.u >= 1) return [T, 0];
      return [C, 0];
    }
  },
  {
    id: 'drop_p_circuit_royal', name: 'Circuit Royal', category: 'pants', form: 'roomy', tier: 'G',
    why: 'A single oversized gilded circuit takes a squared U-turn across each front leg; restrained coated highlights make the collector mark readable at distance.',
    cw: [
      ['Royal Current', 0x25123f, 0x10091e, 0xf3c13c, 0xffe7a0],
      ['Glacier Current', 0x122a42, 0x081627, 0x77e1f0, 0xe4fbff],
      ['Rose Current', 0x3e162b, 0x1c0917, 0xee7faa, 0xffd3e6]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      const trace = q.z >= 0 && ((q.u === 0 && q.y >= 6) || (q.y === 6 && q.u <= 2) || (q.u === 2 && q.y <= 6));
      if (trace) return [q.y === 6 && q.u === 1 ? T : A, q.y === 6 && q.u === 1 ? 1 : 0];
      return [q.z < 0 ? D : C, 0];
    }
  },
  {
    id: 'drop_p_supernova_chaps', name: 'Supernova Chaps', category: 'pants', form: 'roomy', tier: 'G',
    why: 'Brilliant full-length chaps wrap both outside legs beneath a dark saddle, with a sharp high-waisted saddle inset and uninterrupted cloth at the shoes.',
    cw: [
      ['Solar Chaps', 0xff591f, 0x281b31, 0xffbd25, 0xf6e4c5],
      ['Ion Chaps', 0x2066ed, 0x111d40, 0x45d6ec, 0xc8f5fc],
      ['Stardust Chaps', 0xb32fd3, 0x2c143e, 0xfa69b1, 0xf4c5ee]
    ],
    paint(q, colors, index) {
      if (!q.covered) return [q.c, q.l];
      const [C, D, A, T] = colors;
      if (q.y >= 8) return [q.u <= 1 ? T : D, 0];
      if (q.u === 0) return [D, 0];
      if (q.u >= 2) return [A, q.z === 0 && q.y >= 6 ? 1 : 0];
      return [C, 0];
    }
  }
];
