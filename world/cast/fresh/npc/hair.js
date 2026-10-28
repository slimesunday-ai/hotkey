// NPC POOL · hair (slot 'hair'). Ordinary cuts in natural, muted colours: side parts, crew cuts, a receding line, a bald crown with
// a fringe of grey, a bob, a bun, a ponytail, shoulder length, grey set curls. No dye, no sculpting, no beads, no shine (all matte).
// Built with hair.js's own construction (copied into kit.js: grown off the head, only what touches the scalp kept, clear of the
// face, the eyewear arms, the ears unless the style covers them, and the neck). README § The NPC pool and § Hair. Only import: './kit.js'.
import { hair, hairline, hairShell, at, shade, hash3 } from './kit.js';
const sym = x => x < 0 ? -1 - x : x, rnd = (x, y, z, s = 0) => hash3(sym(x) + s * 131, y, z) / 4294967296;
const two = (c, k = .94) => (x, y, z) => rnd(x, y, z, 3) < .3 ? shade(c, k) : c;   // a quiet two-shade texture (reads as hair, not as a print)

export default {
  // ── male-reading
  npc_hair_side_part: { name: 'Civilian · side part', tier: 'common', why: 'a short side part, combed wet in the morning: office',
    draw(H) { const A = hair(H), C = 0x3b2e25;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(23)), (px, py, pz, ox, oy, oz) => oy > 0 ? (px <= -4 ? 1 : 2) : 1), two(C)); A.commit(); } },
  npc_hair_crew: { name: 'Civilian · crew cut', tier: 'common', why: 'clippered short and even: the super, the cab driver, the dad',
    draw(H) { const A = hair(H); A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(23))), two(0x24211f)); A.commit(); } },
  npc_hair_receding: { name: 'Civilian · receding', tier: 'common', why: 'going at the temples, pepper going to salt',
    draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(px => Math.abs(px + .5) > 2.5 ? 33 : 32, pz => pz >= 1 ? 29 : 27, at(23))), two(0x77736d, .86)); A.commit(); } },
  npc_hair_horseshoe: { name: 'Civilian · bald crown', tier: 'common', why: 'bald on top, a grey horseshoe round the back: the deli owner, the retiree',
    draw(H) { const A = hair(H);
      A.grow((px, py, pz, ox, oy, oz) => oy > 0 || oz > 0 ? 0 : py >= 22 && py <= 28 ? 1 : 0, two(0xa9a7a2, .88)); A.commit(); } },
  npc_hair_short_brown: { name: 'Civilian · short and plain', tier: 'common', why: 'needs a cut, will get one next week: the student',
    draw(H) { const A = hair(H), C = 0x5a4433;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(22)), (px, py, pz, ox, oy, oz) => oy > 0 ? 2 : 1), two(C));
      A.box(-6, 31, 8, 3, 31, 8, C); A.box(-5, 32, 8, 1, 32, 8, C);   // a short fringe resting on the forehead
      A.commit(); } },

  // ── female-reading
  npc_hair_bob: { name: 'Civilian · bob', tier: 'common', coversEars: true, why: 'a chin-length bob, centre part: the paralegal',
    draw(H) { const A = hair(H, { ears: true }), C = 0x4a372b;
      A.grow(hairShell(hairline(at(31), pz => pz >= 4 ? 28 : 20, at(20)), (px, py, pz, ox, oy, oz) => oy > 0 ? 2 : ox !== 0 ? 2 : 1), two(C)); A.commit(); } },
  npc_hair_bun: { name: 'Civilian · low bun', tier: 'common', why: 'pulled back tight into a low bun: the nurse, the teller',
    draw(H) { const A = hair(H), C = 0x24201e;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(22))), C);
      A.ball(-.0, 25.5, -9.2, 2.6, 2.4, 2, two(C, .86)); A.commit(); } },
  npc_hair_ponytail: { name: 'Civilian · ponytail', tier: 'common', why: 'a plain ponytail for the run before work',
    draw(H) { const A = hair(H), C = 0x6e4a36;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(22))), C);
      A.ball(0, 29.5, -9, 1.7, 1.7, 1.5, C); A.box(-2, 20, -10, 1, 28, -9, two(C, .86)); A.commit(); } },
  npc_hair_shoulder: { name: 'Civilian · shoulder length', tier: 'common', coversEars: true, why: 'straight to the jaw, tucked behind nothing: the commuter',
    draw(H) { const A = hair(H, { ears: true }), C = 0x8a7352;
      A.grow(hairShell(hairline(px => Math.abs(px + .5) < 1 ? 32 : 31, pz => pz >= 5 ? 27 : 19, at(19)), (px, py, pz, ox, oy, oz) => oy > 0 ? 2 : 1), two(C)); A.commit(); } },
  npc_hair_grey_set: { name: 'Civilian · grey set curls', tier: 'common', why: 'a weekly set at the salon on Pine St: the grandmother',
    draw(H) { const A = hair(H), C = 0xc2c0bb;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 26, at(23)), (px, py, pz) => 1 + (rnd(px, py, pz, 5) < .55 ? 1 : 0)), two(C, .9)); A.commit(); } },
};
