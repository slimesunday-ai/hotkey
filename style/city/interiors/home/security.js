// Home objects · security and stash (sim pieces). The safes speak the simassets language (security.js safe): a forest-green body with a
// lighter lid edge, a gold pinstripe door, a gold dial with ink ticks, a chrome spoked handle, chrome hinges, the OAK maker's plate.
// Locks use its gold deadbolts and steel. Sim pieces take a `state` beside { variant, seed }: 'closed' | 'open' (safes and stashes),
// 'armed' | 'off' (the keypad). The first entry of `states` is the default.
import { def, K, SAFE, pick, cyl, line, glow, LIT, shade, mix, rng, hash, txt, M3, cash } from './lib.js';
import { picture, framed } from './walls.js';

// a safe door hinged at x = hx (its left edge when shut) on the front plane z1, dw wide, rows y0..y1. Open, it has swung 90° out:
// the slab runs along +z at x = hx − 1, its outer face (dial, handle) toward −x, its bolts on the inner face toward the room.
function safeDoor(V, hx, z1, dw, y0, y1, open, big) {
  const at = (u, y, out) => open ? [hx - 1 - out, y, z1 + u] : [hx + u, y, z1 + out], set = (u, y, out, c, l = 0) => { const [x, yy, z] = at(u, y, out); V.set(x, yy, z, c, l); };
  for (let u = 0; u < dw; u++) for (let y = y0; y < y1; y++) { const e = u === 0 || u === dw - 1 || y === y0 || y === y1 - 1; set(u, y, 0, e ? K.gold : SAFE.body, e ? 2 : 0); }
  const dr = big ? 2.6 : 1.6, du = big ? dw - 5.5 : dw - 3.5, dy = big ? y0 + (y1 - y0) * .62 : y0 + (y1 - y0) * .6;
  for (let u = 0; u < dw; u++) for (let y = y0; y < y1; y++) { const d = Math.hypot(u + .5 - du, y + .5 - dy); if (d <= dr) set(u, y, 1, ((u + y) % 2 === 0 && d > dr - .9) ? K.ink : K.gold, 2); }   // the dial
  set(Math.floor(du), Math.floor(dy), 2, K.ink);
  const hu = big ? du : dw - 3, hy = big ? y0 + (y1 - y0) * .36 : y0 + 2, sp = big ? 3 : 1;                                    // the spoked handle
  set(Math.floor(hu), Math.floor(hy), 1, K.chrome, 2); for (let k = 0; k < (big ? 5 : 3); k++) { const a = k / (big ? 5 : 3) * Math.PI * 2 + .3; for (let t = 1; t <= sp; t++) set(Math.round(hu - .5 + Math.cos(a) * t), Math.round(hy - .5 + Math.sin(a) * t), 1, K.chrome, 2); }
  if (big) { const M = M3('OAK'), pu = Math.round((dw - M.w) / 2); for (let u = pu - 1; u < pu + M.w + 1; u++) for (let y = y1 - 8; y < y1 - 1; y++) set(u, y, 1, K.gold, 2);   // the maker's plate
    for (let j = 0; j < 5; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) set(pu + i, y1 - 3 - j, 2, K.ink); }
  for (const y of [y0 + 1, y1 - 3]) { const [x, , z] = open ? [hx - 1, y, z1] : [hx - 1, y, z1]; V.box(x, y, z, x + 1, y + 2, z + 1, K.chrome, 2); }   // hinges
  if (open) for (let y = y0 + 2; y < y1 - 1; y += big ? 4 : 3) V.set(hx, y, z1 + dw - 2, K.chrome, 2);                            // bolts on the inner face
}
function safeBody(V, x0, x1, y1, z1, open, fill) {
  for (const x of [x0 + 1, x1 - 3]) for (const z of [1, z1 - 3]) V.box(x, 0, z, x + 2, 1, z + 2, K.ink);   // stubby feet
  V.box(x0, 1, 0, x1, y1, z1, SAFE.body); V.box(x0, y1 - 1, 0, x1, y1, z1, SAFE.lid);
  if (open) { V.box(x0 + 1, 2, 1, x1 - 1, y1 - 1, z1, -1); V.box(x0 + 1, 2, 0, x1 - 1, y1 - 1, 1, 0x2a2d33); V.box(x0 + 1, 1, 1, x1 - 1, 2, z1, 0x3a3c44); fill(); }   // the cavity and what's in it
}

export const safeSmall = def({ id: 'safe-small', name: 'Small safe', cat: 'security', place: 'floor', foot: [2, 3], h: 0.55, sim: 'safe', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['safe', 'closet', 'cash'], variants: 1, vnames: ['OAK green'],
  build(V, { state = 'closed' } = {}) {
    const open = state === 'open';   // the front cells are the door's swing
    safeBody(V, 1, 10, 11, 7, open, () => { cash(V, 2, 2, 2, 3, 3, 2); cash(V, 5, 2, 2, 3, 3, 2); cash(V, 2, 4, 2, 3, 3, 1); V.box(6, 4, 3, 8, 5, 5, K.gold, 2); });
    safeDoor(V, 2, 7, 7, 2, 10, open, false);
  } });

export const safeBig = def({ id: 'safe-big', name: 'Big safe', cat: 'security', place: 'floor', foot: [4, 5], h: 1.6, sim: 'safe', states: ['closed', 'open'],
  tiers: ['house', 'penthouse'], tags: ['safe', 'vault', 'cash'], variants: 1, vnames: ['OAK green'], far: true,
  build(V, { state = 'closed', seed = 1 } = {}) {
    const open = state === 'open', r = rng(seed * 3 + 1);
    safeBody(V, 2, 18, 32, 11, open, () => {
      for (let x = 3; x < 14; x += 4) for (let y = 2; y < 8; y += 2) cash(V, x, y, 2, 4, 5, 2);                           // bricks of cash
      V.box(3, 15, 1, 17, 16, 10, 0x3a3c44); for (let x = 4; x < 15; x += 3) V.box(x, 16, 3, x + 2, 17, 7, K.gold, 2); V.box(5, 17, 4, 12, 18, 6, K.gold, 2);   // a shelf, gold bars
      V.box(3, 22, 1, 17, 23, 10, 0x3a3c44); V.box(4, 23, 2, 14, 28, 9, 0x2a2a31); V.box(8, 28, 3, 10, 29, 8, 0x2a2a31); V.box(4, 25, 9, 14, 26, 10, K.gold, 2);   // a second shelf, a duffel on it
    });
    safeDoor(V, 3, 11, 14, 2, 31, open, true);
  } });

export const safePainting = def({ id: 'safe-painting', name: 'Safe behind a painting', cat: 'security', place: 'wall', foot: [3, 3], h: 0.8, mount: 1.1, sim: 'safe', states: ['closed', 'open'],
  tiers: ['house', 'penthouse'], tags: ['safe', 'hidden', 'art'], variants: 2, vnames: ['colour field', 'boat'],
  build(V, { variant = 0, seed = 1, state = 'closed' } = {}) {
    const img = picture(variant ? 'boat' : 'field', seed);   // open: the painting has swung out 90° on its left hinge (it needs 0.8 m clear)
    V.box(2, 2, 0, 13, 13, 1, K.steelD, 2); V.box(3, 3, 0, 12, 12, 1, SAFE.body);                                        // the wall safe, flush
    V.box(3, 3, 1, 12, 4, 2, K.gold, 2); V.box(3, 11, 1, 12, 12, 2, K.gold, 2); V.box(3, 3, 1, 4, 12, 2, K.gold, 2); V.box(11, 3, 1, 12, 12, 2, K.gold, 2);   // pinstripe
    for (let x = 5; x < 9; x++) for (let y = 6; y < 10; y++) if (Math.hypot(x + .5 - 7, y + .5 - 8) < 1.9) V.set(x, y, 1, (x + y) % 2 ? K.ink : K.gold, 2);   // dial
    V.box(9, 5, 1, 10, 7, 2, K.chrome, 2); V.box(8, 5, 1, 11, 6, 2, K.chrome, 2);                                          // handle
    if (state !== 'open') { framed(V, 15, 15, img, K.gold, 2, 2); V.box(0, 2, 4, 1, 4, 5, K.chrome, 2); V.box(0, 11, 4, 1, 13, 5, K.chrome, 2); return; }   // shut: the picture over it
    for (let u = 0; u < 15; u++) for (let y = 0; y < 15; y++) { const e = u === 0 || u === 14 || y === 0 || y === 14;             // swung open: we see its back
      V.set(0, y, 1 + u, e ? K.gold : img(Math.min(12, Math.max(0, u - 1)), Math.min(12, Math.max(0, y - 1)), 13, 13), e ? 2 : 0); V.set(1, y, 1 + u, e || y === 7 || u === 7 ? K.ply : K.cream); }
    V.box(0, 2, 0, 2, 4, 1, K.chrome, 2); V.box(0, 11, 0, 2, 13, 1, K.chrome, 2);                                          // hinges
  } });

export const stashFloorboard = def({ id: 'stash-floorboard', name: 'Loose floorboard', cat: 'stash', place: 'floor', foot: [2, 3], h: 0.1, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house'], tags: ['stash', 'hidden', 'floor'], variants: 3, vnames: ['oak', 'walnut', 'grey paint'],
  build(V, { variant = 0, seed = 1, state = 'closed' } = {}) {
    const c = pick([K.oak, K.walnut, 0x8d8f98], variant), r = rng(seed * 7 + 2);
    for (let p = 0; p < 5; p++) { const j = 3 + ((r() * 9) | 0), tone = p % 2 ? c : shade(c, .92);
      for (let x = p * 2; x < p * 2 + 2; x++) for (let z = 0; z < 15; z++) V.set(x, 0, z, z === j ? shade(c, .7) : tone);
      V.set(p * 2, 0, 1, K.gun); V.set(p * 2, 0, 13, K.gun); }                                                             // nails
    if (state !== 'open') { V.box(4, 1, 11, 6, 2, 14, shade(c, .92)); V.set(4, 0, 13, shade(c, .7)); return; }             // the tell: one board proud, a nail gone
    V.box(4, 0, 2, 6, 1, 13, K.ink); V.box(4, 0, 3, 6, 1, 6, K.cash); V.box(4, 0, 4, 6, 1, 5, K.white); V.box(4, 0, 7, 6, 1, 10, K.cash); V.box(4, 0, 8, 6, 1, 9, K.white); V.set(5, 0, 11, K.gold, 2);   // cash in the gap
    V.box(6, 1, 1, 8, 2, 12, shade(c, .92)); V.box(8, 1, 12, 10, 2, 13, K.red); V.box(9, 1, 3, 10, 2, 12, K.steelD, 2);           // the board, pulled up; a pry bar
  } });

export const stashBook = def({ id: 'stash-book', name: 'Hollow book', cat: 'stash', place: 'surface', foot: [2, 1], h: 0.2, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['stash', 'hidden', 'shelf'], variants: 3, vnames: ['red', 'cobalt', 'green'],
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.red, K.cobalt, 0x1f6a3a], variant), book = (x0, y0, w, cov) => { V.box(x0, y0, 0, x0 + w, y0 + 2, 5, K.cream); V.box(x0, y0 + 1, 0, x0 + w, y0 + 2, 5, cov); V.box(x0, y0, 0, x0 + 1, y0 + 2, 5, cov); };
    if (state !== 'open') { book(1, 0, 8, K.navy); book(2, 2, 7, c); V.set(5, 3, 2, K.gold); return; }
    V.box(0, 0, 0, 5, 1, 5, c); V.box(0, 1, 0, 5, 2, 5, K.cream); V.box(0, 0, 0, 1, 2, 5, c); V.box(1, 1, 1, 4, 2, 4, -1); V.box(1, 0, 1, 4, 1, 4, K.ink); V.box(1, 1, 1, 4, 2, 3, K.cash); V.box(2, 1, 1, 3, 2, 3, K.white); V.box(1, 1, 3, 3, 2, 4, K.gold, 2);   // the cut-out: cash, a key
    V.box(5, 0, 0, 10, 1, 5, K.cream); V.box(9, 0, 0, 10, 1, 5, c);                                                       // the cover, flipped open
  } });

export const stashVent = def({ id: 'stash-vent', name: 'Vent stash', cat: 'stash', place: 'wall', foot: [2, 1], h: 0.3, mount: 0.25, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'hidden', 'vent'], variants: 2, vnames: ['white', 'brass'],
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.white, K.gold], variant), l = variant ? 2 : 0;
    V.box(0, 0, 0, 10, 5, 1, c, l); V.box(1, 1, 0, 9, 4, 1, K.ink);                                                     // frame, the duct behind
    if (state !== 'open') { for (const y of [1, 2, 3]) V.box(1, y, 1, 9, y + 1, 2, y === 2 ? shade(c, .8) : c, l); V.set(1, 1, 2, K.steelD, 2); V.set(8, 3, 2, K.steelD, 2); return; }
    V.box(2, 1, 1, 6, 4, 2, K.buff); V.box(6, 1, 1, 8, 2, 2, K.cash); V.set(7, 1, 1, K.white);                             // a paper bag, cash, pulled forward
    for (let z = 1; z < 6; z++) V.box(0, 0, z, 10, 1, z + 1, (z & 1) ? c : shade(c, .8), l);                                // the grille, flapped down
  } });

export const stashShoebox = def({ id: 'stash-shoebox', name: 'Shoebox of cash', cat: 'stash', place: 'floor', foot: [2, 1], h: 0.25, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house'], tags: ['stash', 'sneakers', 'cash'], variants: 3, vnames: ['orange + white', 'black + red', 'cobalt + white'],
  build(V, { variant = 0, state = 'closed' } = {}) {
    const [b, l] = pick([[K.orange, K.white], [K.ink, K.red], [K.cobalt, K.white]], variant);
    V.box(0, 0, 0, 10, 3, 5, b); V.box(6, 1, 4, 9, 2, 5, K.white);
    if (state !== 'open') { V.box(0, 3, 0, 10, 4, 5, l); return; }
    V.box(1, 1, 1, 9, 3, 4, -1); V.box(1, 1, 1, 5, 2, 4, K.white); for (const x of [1, 3]) { V.box(x, 2, 1, x + 2, 3, 4, K.cash); V.set(x + 1, 2, 2, K.white); }   // tissue, bricks of cash
    V.box(5, 3, 0, 10, 4, 5, l); V.box(4, 4, 0, 6, 5, 5, l);                                                             // the lid, pushed half off
  } });

export const doorLocks = def({ id: 'door-locks', name: 'Door chain and locks', cat: 'security', place: 'wall', foot: [1, 3], h: 0.1, mount: 0.9, sim: 'lock',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['lock', 'door', 'chain'], variants: 3, vnames: ['chain + deadbolt', 'chain + three deadbolts', 'chain + keypad bolt'],
  build(V, { variant = 0 } = {}) {
    const bolt = y => { V.box(0, y - 1, 0, 5, y + 3, 1, 0x8d929c, 2); for (let x = 1; x < 4; x++) for (let yy = y; yy < y + 2; yy++) V.set(x, yy, 1, K.gold, 2); V.set(2, y, 1, K.ink); V.set(2, y + 1, 1, K.ink); };
    if (variant === 1) [1, 5, 9].forEach(bolt); else if (variant === 0) bolt(4);
    else { V.box(0, 2, 0, 5, 9, 1, 0x1f1f24); for (const x of [1, 3]) for (const y of [3, 5, 7]) V.set(x, y, 1, K.cyan, LIT); V.set(2, 8, 1, K.lime, LIT); }
    V.box(0, 13, 0, 5, 14, 1, K.steelL, 2); V.set(4, 13, 1, K.gold, 2);                                                      // the chain's track
    for (const [x, y] of [[0, 12], [0, 11], [1, 11], [1, 10], [2, 10], [3, 10], [3, 11], [3, 12]]) V.set(x, y, 0, (x + y) & 1 ? K.steelL : K.steelD, 2);   // the chain, hanging in a loop against the door
  } });

export const alarmKeypad = def({ id: 'alarm-keypad', name: 'Alarm keypad', cat: 'security', place: 'wall', foot: [2, 2], h: 0.1, mount: 1.3, sim: 'alarm', states: ['armed', 'off'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['alarm', 'keypad', 'door'], variants: 2, vnames: ['beige', 'black'],
  build(V, { variant = 0, state = 'armed' } = {}) {
    const p = pick([K.beige, 0x1f1f24], variant), armed = state !== 'off';
    V.box(1, 0, 0, 9, 10, 1, p); V.box(2, 7, 1, 8, 9, 2, armed ? 0x6a1a1a : 0x7a9a6a, LIT); for (const x of [3, 5]) V.set(x, 8, 1, armed ? K.red : 0x2a3a2a, LIT);   // the LCD
    V.set(3, 5, 1, armed ? K.red : 0x5a1a1a, armed ? LIT : 0); V.set(6, 5, 1, armed ? 0x1a4a1a : K.lime, armed ? 0 : LIT);                             // armed / ready LEDs
    for (const x of [3, 5, 7]) for (const y of [1, 2, 3]) V.set(x, y, 1, variant ? K.steelL : K.bone);
  } });

export const dogBed = def({ id: 'dog-bed', name: 'Dog bed and bowls', cat: 'security', place: 'floor', foot: [4, 3], h: 0.25, sim: 'dog',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['dog', 'guard dog', 'pet'], variants: 3, vnames: ['red plaid', 'cobalt', 'leopard'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const rim = (x, z) => variant === 0 ? ((((x >> 1) + (z >> 1)) & 1) ? K.red : K.oxblood) : variant === 1 ? K.cobalt : (hash(x, z, 7) > .8 ? 0x4a2a14 : K.buff);
    for (let x = 0; x < 15; x++) for (let z = 0; z < 15; z++) { const e = Math.hypot((x + .5 - 7.5) / 7.4, (z + .5 - 7.5) / 7.2); if (e > 1) continue;
      if (e > .7) V.box(x, 0, z, x + 1, z > 10 ? 3 : 4, z + 1, rim(x, z)); else V.box(x, 0, z, x + 1, 2, z + 1, K.cream); }
    V.box(5, 2, 5, 9, 3, 6, K.white); for (const x of [4, 9]) V.box(x, 2, 4, x + 1, 3, 7, K.white);                          // a chew bone
    for (const [cz, fill] of [[3.5, 0x6e3e19], [10.5, K.water]]) { cyl(V, 17.5, cz, 2.4, 0, 2, K.steelL, 2); cyl(V, 17.5, cz, 1.5, 1, 2, fill, fill === K.water ? 1 : 0); }   // food, water
    V.box(16, 0, 13, 18, 2, 15, K.red);                                                                                     // a ball
  } });

export const SECURITY = [safeSmall, safeBig, safePainting, stashFloorboard, stashBook, stashVent, stashShoebox, doorLocks, alarmKeypad, dogBed];
