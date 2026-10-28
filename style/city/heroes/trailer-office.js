// SUNNY ACRES · THE PARK OFFICE (block −6,−2) · owner: the Sunny Acres / Millennium Mall agent. The gate: lane 2's mouth on Elm St,
// where every new agent walks in. North of the mouth the park's letter sign faces the street — SUNNY ACRES under a big voxel sun, a
// changeable-letter board with the week's lines. South of it the office: a yellow single-wide end-on to the lane with its long side to
// the street (OFFICE fascia, RENTALS in the window, the park rules board), its porch on the lane, the propane exchange cage, bagged
// ice, a soda machine and the cluster mailboxes. The six pads of the block are built as everywhere else.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { frame, win, AIR, TOD } from '../kit.js';
import { Vol } from '../vox.js';
import { PAL, CV, SIDE, hash, shade } from '../style.js';
import { padsIn, IN, LANES, SX, SZ } from '../districts/trailer/plan.js';   // (SPREAD: the park's metres + its shift [SX, SZ])
import { buildPad } from '../districts/trailer/pads.js';
import { lanes, poles, perimeter } from '../districts/trailer/park.js';
import { M, pv, done, txt, txtX, tw, cyl, ring, board } from '../districts/trailer/brush.js';
import * as TP from '../districts/trailer/props.js';

const INK = PAL.ink, WHITE = PAL.white, YEL = 0xffc21a, SUN = 0xffe23a, RED = 0xe8232a, BLUE = 0x2f5bff, GALV = 0xb9bcc4;
const lit = (day = 1) => TOD.night ? 3 : day;
// ── small pieces (0.05 grain): the propane exchange cage, the ice chest, the soda machine, the cluster mailbox
const S = .05, P = (nx, ny, nz) => pv(nx, ny, nz, nx / 2, nz / 2, S);
const propaneCage = () => M('propcage', 'cage', () => { const W = 52, V = P(W + 2, 50, 20);
  V.box(1, 0, 1, W + 1, 2, 19, 0x8f9096); for (let x = 1; x < W + 1; x++) for (let y = 2; y < 36; y++) for (const z of [1, 18]) if (x % 3 === 1 || y === 2 || y === 35) V.set(x, y, z, GALV, 2);
  for (const x of [1, W]) for (let z = 1; z < 19; z++) for (let y = 2; y < 36; y++) if (z % 3 === 1 || y === 35) V.set(x, y, z, GALV, 2); V.box(1, 35, 1, W + 1, 36, 19, GALV, 2); V.box(1, 18, 1, W + 1, 19, 19, GALV, 2);
  for (const [x, y] of [[4, 2], [12, 2], [20, 2], [28, 2], [36, 2], [44, 2], [10, 19], [26, 19], [40, 19]]) { cyl(V, x + 3, 9.5, 3.2, y, y + 13, WHITE); cyl(V, x + 3, 9.5, 2, y + 13, y + 15, 0xd3d4d7); }
  V.box(1, 36, 17, W + 1, 50, 19, RED); const c = (W + 2) >> 1; txt(V, 'PROPANE', c - (tw('PROPANE') >> 1), 48, 19, WHITE); txt(V, 'EXCHANGE', c - (tw('EXCHANGE') >> 1), 40, 19, WHITE);
  return done(V, 'cage'); });
const iceChest = () => M('icechest', 'freezer', () => { const V = P(30, 26, 16); V.box(0, 0, 0, 30, 22, 16, WHITE); V.box(0, 22, 0, 30, 24, 16, 0xdfe2e8); V.box(0, 0, 0, 30, 2, 16, 0x9a9ca4);
  V.box(3, 6, 16, 27, 20, 17, 0x2de2e6); txt(V, 'BAGGED', 15 - (tw('BAGGED') >> 1), 18, 17, BLUE); txt(V, 'ICE', 15 - (tw('ICE') >> 1), 10, 17, BLUE); return done(V, 'freezer'); });
const sodaMachine = () => M('soda', 'vending', () => { const V = P(20, 38, 16); V.box(0, 0, 0, 20, 36, 16, RED); V.box(0, 36, 0, 20, 38, 16, shade(RED, .8));
  V.box(2, 8, 16, 13, 33, 17, 0x3b3f4a, 1); for (let y = 11; y < 32; y += 5) for (let x = 3; x < 12; x += 3) V.box(x, y, 16, x + 2, y + 3, 17, [0xffe23a, 0x2de2e6, 0x6cff4a, 0xff4fa3][(x + y) % 4], 1);
  V.box(2, 33, 16, 18, 35, 17, WHITE, lit()); V.box(14, 14, 16, 18, 22, 17, 0x9a9ca4, 2); V.box(4, 3, 16, 16, 6, 17, INK); return done(V, 'vending'); });
const clusterBox = () => M('cbu', 'mailbox', () => { const V = P(28, 34, 12); V.box(2, 0, 2, 26, 4, 10, 0x8f9096); V.box(0, 4, 0, 28, 32, 12, 0xc9ced6, 2); V.box(0, 32, 0, 28, 34, 12, 0x9a9ca4, 2);
  for (let x = 1; x < 27; x += 5) for (let y = 6; y < 31; y += 5) { V.box(x, y, 12, x + 4, y + 4, 12, 0xdfe3ea, 2); V.set(x + 3, y + 2, 11, INK); } return done(V, 'mailbox'); });

export function parkOffice(bank, b, A) {
  const kit = GEN.kit, ctx = blockCtx(bank, b, A, kit), q = LANES[1], xS = IN.x1 - .1; REG.strict = true;
  try {
    lanes(ctx); poles(ctx);
    // the east fence stops short: the office and the sign face the street across an open verge
    perimeter(ctx, [{ ax: 'z', x: xS, a: -63.4 + SZ, b: -33.0 + SZ }]);
    ctx.finish();
    ctx.group('office');
    // ── THE LETTER SIGN (x −165.4, z −62.2 … −53.4, facing Elm St): posts, the SUNNY ACRES panel, the sun, the letter board
    { const z0 = -62.2 + SZ, z1 = -53.2 + SZ, x0 = -165.9 + SX, V = ctx.volume(x0, SIDE, z0, x0 + .6, SIDE + 7.2, z1, { ground: true }), nz = V.nz, X = 3;
      for (const z of [12, nz - 16]) { V.box(1, 0, z, 5, 41, z + 4, 0x6d707a); V.box(0, 0, z - 1, 6, 3, z + 5, 0x9a9ca4); }                       // two steel posts on footings
      // the letter board's frame (the board itself, with its 0.05 letters, is bolted into it below)
      V.box(X - 1, 11, 7, X + 1, 28, nz - 7, INK);
      // the name panel: red, SUNNY ACRES in yellow letters, lit at night
      V.box(X - 1, 30, 2, X + 2, 42, nz - 2, RED); V.box(X - 1, 30, 2, X + 2, 31, nz - 2, WHITE); V.box(X - 1, 41, 2, X + 2, 42, nz - 2, WHITE);
      txtX(V, 'SUNNY ACRES', (nz >> 1) - (tw('SUNNY ACRES') >> 1), 39, X + 2, SUN, lit(0), 1);
      // the sun: a half disc with rays over the panel
      const cz = nz >> 1, cy = 42; for (let z = 0; z < nz; z++) for (let y = cy; y < 72; y++) { const d = Math.hypot(z + .5 - cz, y + .5 - cy); if (d < 17) V.box(X - 1, y, z, X + 2, y + 1, z + 1, d > 14.5 ? 0xff7a1a : SUN, lit(0));
        else if (d < 27) { const a = Math.atan2(y + .5 - cy, z + .5 - cz), r = Math.abs(((a / Math.PI * 9) % 1 + 1) % 1 - .5); if (r < .16 && d < 25) V.box(X - 1, y, z, X + 2, y + 1, z + 1, 0xff7a1a, lit(0)); } }
      REG.keep([x0, SIDE, z0, x0 + .6, SIDE + 7.2, z1], 'sign'); }
    ctx.finish();
    // the letter board's lines, bolted on (0.05 lettering: three lines, changed by hand every week)
    ctx.put(board('PADS 2 A DAY/NO CREDIT CHECK/WELCOME HOME', { kind: 'sign', posts: 0, bg: 0xf7f7f2, fg: INK, clean: true, pad: 2, lit: true }), -165.5 + SX, -57.7 + SZ, { rot: 1, y: SIDE + 1.2, reach: 0, ignore: 'sign' });
    // ── THE OFFICE: a yellow single-wide, x −167.8…−164.4, z −46.6…−38.2; its long side to the street, its door on the lane end
    const ox0 = -167.8 + SX, ox1 = -164.4 + SX, oz0 = -46.6 + SZ, oz1 = -38.2 + SZ, pad = 14, H = 29, nx = Math.round((ox1 - ox0) / CV), nz = Math.round((oz1 - oz0) / CV);
    const V = new Vol(nx + 2 * pad, H + 14, nz + 2 * pad, { s: CV, org: [ox0 - pad * CV, SIDE, oz0 - pad * CV] }), B = { x0: pad, z0: pad, x1: pad + nx, z1: pad + nz };
    ctx.mass(V, [ox0, oz0, ox1, oz1], { top: SIDE + (H + 2) * CV, roofY: SIDE + (H + 2) * CV });
    V.box(B.x0, 3, B.z0, B.x1, H, B.z1, YEL); V.box(B.x0, H, B.z0, B.x1, H + 1, B.z1, 0xefeee9); V.box(B.x0 + 1, H + 1, B.z0 + 1, B.x1 - 1, H + 2, B.z1 - 1, 0xe6e2d8);
    V.box(B.x0 + 1, 0, B.z0 + 1, B.x1 - 1, 3, B.z1 - 1, 0x2a2a30); for (const f of ['+x', '-x', '+z', '-z'].map(sd => frame(V, B, sd))) { f.box(0, 0, 0, f.len, 3, 1, (a, y) => ((a + y) % 3 === 0 || (a - y + 30) % 3 === 0) ? WHITE : 0x8f9096); f.box(0, 17, 0, f.len, 19, 1, WHITE); }
    const E = frame(V, B, '+x'), N = frame(V, B, '-z'), W2 = frame(V, B, '-x');
    // street side: a wide window with RENTALS lit in it, the OFFICE fascia, a small window
    win(E, 4, 11, 46, 12, WHITE, { lit: TOD.night }); E.text('RENTALS', 27, 21, -2, -1, 0xff4fa3, lit(0), 1, 1);
    win(E, E.len - 20, 12, 12, 10, WHITE, {}); E.box(6, 23, 0, 48, 29, 2, WHITE); E.text('OFFICE', 27, 28, 2, 3, BLUE, 0, 1, 1);
    // the lane end: the door (the sim's size), a window, the porch light
    N.box(4, 3, 0, 18, 28, 1, WHITE); N.box(5, 3, -1, 17, 27, 1, AIR); N.box(5, 3, -2, 17, 27, -1, (a, y) => (y > 18 && y < 24 && a > 7 && a < 14) ? 0x9fd8ff : BLUE, 1); N.set(14, 14, -1, PAL.gold, 2);
    win(N, 22, 12, 9, 10, WHITE, {}); N.box(19, 22, 1, 21, 25, 2, TOD.night ? 0xfff0b0 : 0xeae6da, lit());
    win(W2, 10, 12, 12, 10, WHITE, {}); win(W2, W2.len - 22, 12, 12, 10, WHITE, {});
    // a striped awning over the street window
    for (let d = 1; d < 12; d++) E.box(2, 27 - (d >> 2) - 4, d, 52, 28 - (d >> 2) - 4, d + 1, (a) => ((a >> 2) & 1) ? BLUE : WHITE);
    ctx.finish();
    // the porch on the lane end: a wood deck with one step, the bench and a plant on it
    { const d0 = oz0 - 1.3, V2 = ctx.volume(-167.6 + SX, SIDE, d0, -164.6 + SX, SIDE + .3, oz0, { walk: true });
      V2.box(0, 0, 0, V2.nx, 3, V2.nz, (x, y, z) => y === 2 ? ((x >> 1) & 1 ? PAL.wood : shade(PAL.wood, .88)) : PAL.woodD); V2.clear(0, 2, 0, 8, 3, 3); V2.clear(22, 2, 0, V2.nx, 3, 3); }
    ctx.finish();
    REG.door(-165.5 + SX, oz0 - .5, 2);
    // ── by the street: the rules board on the wall, the propane cage, bagged ice, the soda machine, the mailboxes, planters
    // the rules board on two stakes at the lane's north edge, facing everyone who drives in
    ctx.put(board('PARK RULES/NO FIRES/QUIET 10PM', { kind: 'yard-sign', posts: 2, h: .5, bg: 0x14a83b, fg: WHITE, frame: WHITE, pad: 3 }), -171.2 + SX, q.z0 + .35, { rot: 0, slide: [1, 0], reach: 1.5 });
    const put = (bk, x, z, rot, ax = 0, reach = 1) => ctx.put(bk, x + SX, z + SZ, { rot, slide: [ax, 1 - ax], reach });   // (the park's metres)
    put(sodaMachine(), -165.4, -37.2, 1, 0, .2); put(propaneCage(), -165.3, -35.15, 1, 0, .2); put(iceChest(), -165.5, -32.95, 1, 0, .2);
    put(clusterBox(), -165.9, -63.1, 1, 0, .4);
    // ── the pads
    for (const p of padsIn(b.i, b.j)) buildPad(ctx, p);
  } finally { REG.strict = false; }
  ctx.finish();
}
