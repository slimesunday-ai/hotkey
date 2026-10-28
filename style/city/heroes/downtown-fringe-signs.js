// GLASSWALL · THE DOWNTOWN FRINGE · block 3,−2 (Bishop Ave & 1st St; St. Mercy's ER bay across the avenue) · owner: the downtown fringe
// agent (batch 5).
//   CARUSO SIGN CO., the sign painter who lettered half the city. A white two-storey workshop, its avenue front a sampler: CARUSO in gold
//   leaf on black glass, and over it the boards he shows customers, every one in its own hand (GOLD LEAF · LETTERS · SIGNS ·
//   BANNERS). Its side wall over his yard is a job in progress: YOUR / NAME / HERE on a yellow ground, YOUR painted, NA painted, ME and
//   HERE still pencil outlines, and Caruso on a swing stage at the ME with his brush. On the roof a giant white pointing hand, the old
//   sign-painter's manicule, points out over the avenue at his door. In the yard: sawhorses with a board half lettered, paint cans, the helper. The
//   roll-up door on 1st St stands open on the easels. The rest of the block is the generator's.
// Ids read 3_-2·signs·kind·n for the workshop and 3_-2·L<k>·kind·n for the generated lots.
import { fillBlock, mk, framed } from '../districts/downtown/fill.js';   // (SPREAD: authored in today's metres, the block's frame)
import { brush, person, lit } from '../districts/downtown/lib.js';
import { blockCtx } from '../engine.js';
import { kitNow } from '../gen.js';
import { REG } from '../audit.js';
import { textMask } from '../vox.js';
import { AIR } from '../kit.js';
import { PAL, SIDE, hash } from '../style.js';
import { sandwich } from '../props.js';

const WORK = [111, -47, 122, -36], YARD = [104, -44, 111, -36], H = 7.6, WHITE = 0xf4f1ea, INK = PAL.ink, GOLD = PAL.gold, YEL = 0xffe23a, RED = 0xe8232a, PENCIL = 0x6d7fb3;

export function signPainter(bank, b, A) {
  fillBlock(bank, b, A, { seed: 53201,
    lots: [mk(100, -60, 108, -52, ['-z', '-x'], 'NW'), mk(115, -60, 122, -53, ['-z', '+x'], 'NE'), mk(108, -60, 115, -53, ['-z']), mk(115, -53, 122, -47, ['+x']),
      mk(100, -52, 106, -44, ['-x']), mk(100, -44, 104, -36, ['+z', '-x'], 'SW')],
    heroes: [{ rect: WORK, top: SIDE + 13.6, nh: 136, group: 'signs', faces: ['+x', '+z', '-x'] }, { rect: YARD, top: SIDE + 1.8, nh: 18, open: true, group: 'signs', faces: ['+z'], roofY: SIDE + .1 }],
    build() { const ctx = framed(blockCtx(bank, b, A, kitNow())); REG.group('signs'); REG.strict = true;
      try { workshop(ctx, A); yard(ctx, A); ctx.finish(); } finally { REG.strict = false; } } });
}

// letters as pencil outlines (the pounce pattern before the paint): the boundary pixels of each glyph at scale sc, on a frame
function outline(f, s, a0, ytop, d, c, sc = 2) {
  const M = textMask(s), on = (i, j) => i >= 0 && j >= 0 && i < M.w * sc && j < M.h * sc && M.at((i / sc) | 0, (j / sc) | 0);
  for (let j = 0; j < M.h * sc; j++) for (let i = 0; i < M.w * sc; i++) if (on(i, j) && (i + j) % 2 === 0) f.set(a0 + i, ytop - 1 - j, d, c);   // (dotted: the pounce pattern, before the paint)
}

function workshop(ctx, A) {
  const [x0, z0, x1, z1] = WORK, W = ctx.building(x0, z0, x1, z1, { h: H, wall: WHITE, trim: INK, faces: ['+x', '+z', '-x'], parapet: 5, extra: 58 }), V = W.V, B = W.B, P = brush(V), TOP = W.top;
  // ── the avenue front (Bishop Ave): black glass with CARUSO in gold leaf, the door, and over it the sampler
  const E = W.F('+x'), L = E.len;   // a 0 at the 1st St end
  E.box(0, 0, 0, L, 40, 2, INK); E.box(4, 4, -2, 84, 34, 2, AIR);   // (the band's outer layer is cut away in front of the glass too) E.box(4, 4, -3, 84, 34, -2, (a, y) => y > 31 ? 0xfff0c8 : 0x10141f, 0);
  E.text('CARUSO', 44, 30, -2, -1, GOLD, 2, 2, 1); E.text('SIGN CO', 44, 13, -2, -1, GOLD, 2, 1, 1);
  E.box(90, 0, -3, 104, 30, 1, AIR); E.box(90, 0, -4, 104, 30, -3, (a, y) => y > 25 || a === 97 ? 0xfff0c8 : 0x3a2a1f, 1); E.box(88, 30, 0, 106, 33, 3, GOLD, 2);
  const door = (() => { const [x, z] = E.xz(97, 0); return [V.org[0] + (x + .5) * .1 + .5, V.org[2] + (z + .5) * .1]; })(); REG.door(door[0], door[1], 1);
  // the sampler: six boards in six hands on the upper floor (gold on black, white on red, ink on yellow, a drop shadow, an outline, a stripe)
  const board = (a0, a1, y0, y1, bg, t, fg, o = {}) => { E.box(a0, y0, 0, a1, y1, 2, o.rim ?? bg); if (o.rim) E.box(a0 + 1, y0 + 1, 1, a1 - 1, y1 - 1, 2, bg);
    const m = (a0 + a1) >> 1; if (o.shadow) E.text(t, m + 1, y1 - 3, 2, 3, o.shadow, 0, 1, 1); E.text(t, m, y1 - 2, 2, 3, fg, o.lit ?? 0, 1, 1); };
  board(2, 58, 42, 53, INK, 'GOLD LEAF', GOLD, { lit: 2 }); board(60, 108, 42, 53, RED, 'LETTERS', WHITE, { rim: WHITE });
  board(2, 40, 57, 68, YEL, 'SIGNS', INK, { shadow: RED }); board(44, 108, 57, 68, 0x2f5bff, 'BANNERS', WHITE, { rim: YEL }); E.box(2, 70, 0, 108, 71, 2, INK);
  // ── the 1st St side: the band with the name, the roll-up door open on the easels
  const S = W.F('+z'), SL = S.len;   // a 0 at the west end
  S.box(0, 0, 0, SL, 4, 2, INK); S.box(8, 0, -30, 58, 30, 1, AIR); S.box(8, 0, -31, 58, 30, -30, 0xfff0c8, lit(1)); S.box(6, 30, 0, 60, 34, 2, INK);
  for (const [a, c] of [[16, RED], [34, 0x2f5bff], [50, YEL]]) { S.box(a, 0, -22, a + 1, 20, -21, 0x7a4a22); S.box(a - 5, 10, -21, a + 6, 22, -20, c); }   // easels with boards on them
  S.box(62, 44, 0, 106, 68, 2, INK); S.text('SINCE', 84, 65, 2, 3, GOLD, 2, 1, 1); S.text('1961', 84, 55, 2, 3, GOLD, 2, 1, 1);
  // ── the side wall over the yard: YOUR / NAME / HERE on yellow, half done
  const Wf = W.F('-x'), WL = Wf.len;   // a 0 at the north end (the yard is a 30…110)
  Wf.box(0, 0, 1, WL, 4, 2, AIR);                                                                                                   // no plinth lip on this side: the yard and the lots' gardens run up to the wall
  Wf.box(20, 12, 0, 104, 74, 1, YEL); Wf.box(18, 10, 0, 106, 12, 1, RED); Wf.box(18, 74, 0, 106, 76, 1, RED);
  const line = (t, ytop, done) => { const M = textMask(t), a0 = 62 - M.w; if (done >= t.length) { Wf.text(t, a0, ytop, 1, 2, RED, 0, 2, 0); return; }
    const head = t.slice(0, done), wh = head ? textMask(head).w + 1 : 0; if (head) Wf.text(head, a0, ytop, 1, 2, RED, 0, 2, 0); outline(Wf, t.slice(done), a0 + wh * 2, ytop, 1, PENCIL); };
  line('YOUR', 70, 4); line('NAME', 50, 2); line('HERE', 30, 0);
  // the swing stage at the ME: a plank on two ropes from outriggers over the parapet, cans on it, the painter at work
  const sy = 34, sa0 = 60, sa1 = 92; Wf.box(sa0, sy, 4, sa1, sy + 1, 10, 0xa4652f); Wf.box(sa0, sy + 1, 9, sa1, sy + 9, 10, (a, y) => y === sy + 8 || a === sa0 || a === sa1 - 1 ? 0x9aa0a8 : undefined, 2);
  for (const a of [sa0 + 2, sa1 - 3]) { Wf.box(a, sy + 1, 6, a + 1, H * 10 + 7, 7, 0xd9c7a0); Wf.box(a - 1, H * 10 + 5, -8, a + 2, H * 10 + 7, 8, PAL.iron); }
  for (const [a, c] of [[66, RED], [70, YEL], [86, 0x2f5bff]]) Wf.box(a, sy + 1, 5, a + 2, sy + 4, 7, c);
  const [px, pz] = (() => { const [x, z] = Wf.xz(78, 7); return [P.wx(x), P.wz(z)]; })();   // (the brush's frame metres: person() carries them)
  person(A, px, pz, Math.PI / 2, 'reach', 3201, SIDE + (sy + 1) * .1);   // (facing the wall, +x)
  // ── the roof (dark tar, so the glove reads from above): the pointing hand, white glove and red cuff, 6 m from cuff to fingertip,
  // pointing out over Bishop Ave at the door, on a steel stand
  V.box(B.x0 + 1, W.h - 1, B.z0 + 1, B.x1 - 1, W.h, B.z1 - 1, 0x4a4b55);
  const k = 1.6, hx = x1 - 7.4, hy = TOP + 1.6, hz = (z0 + z1) / 2 - 1.5 * k, hb = (u0, v0, w0, u1, v1, w1, c) => P.box(hx + u0 * k, hy + v0 * k, hz + w0 * k, hx + u1 * k, hy + v1 * k, hz + w1 * k, c);
  // the stand: two steel posts on base plates, a tie between them, each post running 0.4 m up into the glove (under the cuff, under the
  // palm) so the glove sits on both (the palm's post used to stop a voxel short of it)
  for (const u of [-.6, 1.4]) { const px = hx + u * k, pz = hz + 1.3 * k;
    P.box(px - .05, TOP, pz - .05, px + .35, hy + .4, pz + .35, PAL.iron); P.box(px - .35, TOP, pz - .35, px + .65, TOP + .15, pz + .65, 0x6d707a); }
  P.box(hx - .6 * k, TOP, hz + 1.3 * k, hx + 1.4 * k + .3, TOP + .3, hz + 1.3 * k + .3, PAL.iron);
  P.box(hx - .6 * k + .35, TOP + .8, hz + 1.3 * k + .05, hx + 1.4 * k - .05, TOP + .95, hz + 1.3 * k + .25, PAL.iron);
  hb(-1.4, 0, -.1, -.2, 2.0, 3.1, RED); hb(-.2, .1, 0, 2.2, 1.9, 3.0, WHITE);                                                          // cuff, palm
  for (let q = 0; q < 3; q++) hb(2.2, .15 + q * .55, .2, 2.9, .6 + q * .55, 2.4, WHITE);                                                  // three curled fingers
  hb(1.0, 1.9, .8, 2.0, 2.5, 2.2, WHITE); hb(2.2, 1.5, .9, 5.2, 2.1, 2.1, WHITE); hb(5.0, 1.2, .9, 5.4, 2.1, 2.1, WHITE);               // thumb, index finger, its tip
  for (const [a, c] of [[.5, 1.2], [1.4, 2.1]]) hb(2.3, 1.45, a, 2.5, 1.5, c, 0xd3d4d7);                                                  // knuckle lines
  hb(-.3, .1, -.12, -.2, 1.9, 3.12, 0xd3d4d7);
}

function yard(ctx, A) {
  const [x0, z0, , z1] = YARD, x1 = YARD[2] - .2, G = ctx.volume(x0, SIDE, z0, x1, SIDE + 1.8, z1, { walk: true }), P = brush(G);   // (0.2 m short of the wall: its cornice and stage hang there)
  P.box(x0, SIDE, z0, x1, SIDE + .1, z1, (x, y, z) => hash(Math.round(x * 10), Math.round(z * 10), 7) < .12 ? 0x8f8b84 : 0xb9b3a8);   // gravel
  for (let x = x0; x < x1 - .05; x += .1) { const post = Math.abs(((x - x0 + .05) % 2.3) - .05) < .06, gate = x > x1 - 3.2 && x < x1 - .6;   // chain-link along 1st St, the gate open
    if (gate) continue; P.box(x, SIDE + .1, z1 - .1, x + .1, SIDE + 1.8, z1, (xx, y) => post || y > SIDE + 1.7 ? 0x6d707a : ((((xx * 10) | 0) + ((y * 10) | 0)) % 2 ? 0xa7a9b1 : undefined)); }
  P.box(x1 - .6, SIDE + .1, z1 - .12, x1 - .5, SIDE + 1.8, z1, 0x6d707a);
  // two sawhorses with a board half lettered (EAT painted, the S in pencil), cans, a ladder against the wall
  for (const x of [105.4, 108.2]) { P.box(x, SIDE + .1, -41.2, x + .1, SIDE + .8, -41.1, 0x7a4a22); P.box(x, SIDE + .1, -39.9, x + .1, SIDE + .8, -39.8, 0x7a4a22); P.box(x - .05, SIDE + .8, -41.3, x + .15, SIDE + .9, -39.7, 0x7a4a22); }
  P.box(104.9, SIDE + .9, -41.4, 109.1, SIDE + 1.0, -39.6, RED);
  // (the board lies flat: its lettering is stripes of paint on top)
  for (const [x, c] of [[105.2, WHITE], [105.8, WHITE], [106.4, WHITE]]) P.box(x, SIDE + 1.0, -40.9, x + .45, SIDE + 1.01, -40.1, c);
  P.box(107.1, SIDE + 1.0, -40.9, 107.55, SIDE + 1.01, -40.1, (x, y, z) => (Math.abs(x - 107.1) < .06 || Math.abs(x - 107.5) < .06 || Math.abs(z + 40.9) < .06 || Math.abs(z + 40.1) < .06) ? PENCIL : undefined);
  for (const [x, z, c] of [[105.0, -38.2, RED], [105.5, -38.4, YEL], [106.0, -38.1, 0x2f5bff], [109.6, -42.8, WHITE]]) P.cyl(x, z, .16, SIDE + .1, SIDE + .45, c);
  for (let k = 0; k < 9; k++) P.box(109.9 + k * .1, SIDE + .1 + k * .2, -43.2, 110.0 + k * .1, SIDE + .3 + k * .2, -42.8, 0x9aa0a8);   // the ladder, leaning in to the wall
  person(A, 107.0, -38.6, -.6, 'carry', 3202, SIDE + .1);
}
