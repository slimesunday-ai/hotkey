// Home objects · electronics, gaming, music. Every screen, LED and fan ring is on the lit layer (STYLE §3). The consoles are invented
// shapes and names (TOASTR, YOLK, ZIGG): no real console design, logo or trademark.
import { def, K, pick, cyl, cylZ, line, glow, LIT, shade, mix, rng, hash, txt, M3 } from './lib.js';

// ── shared parts
// a screen (lit) filling x0..x1 × y0..y1 at depth z; kinds: bars · cartoon · fight · news · game · terminal · sports · video
export function screen(V, x0, y0, x1, y1, z, kind, seed = 1) {
  const w = x1 - x0, h = y1 - y0, r = rng(seed * 97 + 5);
  const col = (i, j) => { const u = i / Math.max(1, w - 1), v = j / Math.max(1, h - 1);
    switch (kind) {
      case 'bars': return v < .18 ? pick([K.ink, K.white, K.cobalt, K.ink], i >> 1) : pick([K.white, K.yellow, K.cyan, K.lime, K.pink, K.red, K.cobalt], Math.floor(u * 6.99));
      case 'cartoon': { const sun = Math.hypot(i - w * .72, j - h * .72) < h * .18; return sun ? K.yellow : v < .3 ? K.grass : (v < .38 && (i % 4 === 1) ? K.white : K.sky); }
      case 'fight': return (j === Math.round(h * .55) || j === Math.round(h * .72)) ? K.red : v < .3 ? K.bone : (i === Math.round(w * .35) && v < .62 ? K.red : i === Math.round(w * .65) && v < .62 ? K.cobalt : 0x2a2a31);
      case 'news': return v < .22 ? (v < .1 ? K.ink : (i % 3 ? K.white : K.red)) : v < .3 ? K.red : (Math.abs(i - w * .5) < w * .18 && v > .35 && v < .8 ? (v > .62 ? K.ink : K.skin[2]) : K.navy);
      case 'game': return v < .25 ? (((i >> 1) + (j >> 1)) & 1 ? K.purple : K.pink) : v < .5 ? (i % 5 === 0 ? K.cyan : 0x2a1a55) : (Math.abs(i - w * .5) < (v - .5) * w * .7 ? K.orange : 0x1a1040);
      case 'terminal': return (j % 2 === 0 && j > 0 && i > 0 && i < (h - j + i * 3) % (w - 1) + 2) ? 0x6cff4a : (j === 1 && i === 2 ? 0x6cff4a : 0x0e1a10);
      case 'sports': return (i === (w >> 1) || j === 0 || j === h - 1) ? K.white : v > .85 ? K.ink : (hash(i, j, seed) > .97 ? (i < w / 2 ? K.red : K.yellow) : (j & 1 ? 0x25a748 : 0x2fbf55));
      case 'video': { const d = Math.hypot(i - w * .5, (j - h * .45) * 1.1); return d < h * .28 ? (j > h * .52 ? K.ink : K.skin[3]) : (v < .2 ? K.ink : ((i + j) % 6 < 3 ? K.pink : K.purple)); }
      default: return K.glassHi; } };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) V.set(x0 + i, y0 + j, z, col(i, j), LIT);
  V.set(x0 + 1, y1 - 2, z, K.glint, LIT); V.set(x0 + 2, y1 - 2, z, K.glint, LIT);
}
const SHOWS = ['cartoon', 'fight', 'news', 'bars', 'game'];
// a CRT: body w × h, the tube's back tapering behind; screen on the +z face at z0 + d
function crt(V, x0, y0, z0, w, h, d, c, show, seed) {
  V.box(x0, y0, z0 + 3, x0 + w, y0 + h, z0 + d, c); V.box(x0 + 2, y0 + 1, z0, x0 + w - 2, y0 + h - 2, z0 + 3, shade(c, .85));
  const sx1 = x0 + w - 4; V.box(x0 + 1, y0 + 1, z0 + d - 1, sx1 + 1, y0 + h - 1, z0 + d, shade(c, .7));
  screen(V, x0 + 2, y0 + 2, sx1, y0 + h - 2, z0 + d, show, seed);
  for (const y of [y0 + h - 4, y0 + h - 7]) V.box(x0 + w - 3, y, z0 + d, x0 + w - 1, y + 2, z0 + d + 1, K.ink);   // knobs
  V.box(x0 + w - 3, y0 + 2, z0 + d - 1, x0 + w - 1, y0 + 3, z0 + d, K.red, LIT);                                     // power LED
}
function ears(V, x, y, z, reach, up) { V.box(x - 1, y, z, x + 2, y + 1, z + 2, K.ink); line(V, x, y + 1, z, x - reach, y + up, z, K.chrome, 2); line(V, x + 1, y + 1, z + 1, x + 1 + reach, y + up, z + 1, K.chrome, 2); }
// a wired controller lying on the floor or a table: body, d-pad, two buttons, a cable back to (cx, cz)
function pad(V, x, y, z, c, cx, cz, btn = [K.red, K.yellow]) {
  V.box(x, y, z, x + 5, y + 1, z + 3, c); V.box(x, y, z + 3, x + 1, y + 1, z + 4, c); V.box(x + 4, y, z + 3, x + 5, y + 1, z + 4, c);
  V.set(x + 1, y + 1, z + 1, K.ink); V.set(x + 3, y + 1, z + 1, btn[0]); V.set(x + 4, y + 1, z + 2, btn[1]);
  if (cx !== undefined) line(V, x + 2, y, z, cx, y, cz, K.ink);
}
function toastr(V, x0, y0, z0, c, l) {   // TOASTR: a toaster-shaped console, cartridges popped up in its slots like toast
  V.box(x0, y0, z0, x0 + 8, y0 + 5, z0 + 6, c, l); for (const x of [x0, x0 + 7]) for (const z of [z0, z0 + 5]) V.del(x, y0 + 4, z);
  V.box(x0 + 1, y0 + 4, z0 + 1, x0 + 7, y0 + 5, z0 + 2, K.ink); V.box(x0 + 1, y0 + 4, z0 + 4, x0 + 7, y0 + 5, z0 + 5, K.ink);   // two slots
  V.box(x0 + 2, y0 + 4, z0 + 1, x0 + 6, y0 + 7, z0 + 2, K.yellow); V.box(x0 + 3, y0 + 5, z0 + 1, x0 + 5, y0 + 6, z0 + 2, K.white);   // a cartridge up, its label
  V.box(x0 + 2, y0 + 4, z0 + 4, x0 + 6, y0 + 6, z0 + 5, K.cobalt);                                                 // one half in
  V.box(x0 + 8, y0 + 2, z0 + 2, x0 + 9, y0 + 3, z0 + 4, K.ink); V.box(x0 + 1, y0 + 1, z0 + 5, x0 + 7, y0 + 2, z0 + 6, shade(c, .8), l);   // the lever, a trim band
  V.set(x0 + 6, y0 + 3, z0 + 5, K.red, LIT);
}
function zigg(V, x0, y0, z0, c, edge) {   // ZIGG: a stepped pyramid, lit edges
  [[0, 10, 0, 6], [1, 9, 1, 5], [2, 8, 2, 4], [3, 7, 2, 4]].forEach(([a, b, e, f], k) => { V.box(x0 + a, y0 + k * 2, z0 + e, x0 + b, y0 + k * 2 + (k === 3 ? 1 : 2), z0 + f, c, 1);
    if (k < 3) V.box(x0 + a, y0 + k * 2 + 1, z0 + f - 1, x0 + b, y0 + k * 2 + 2, z0 + f, edge, LIT); });
  V.box(x0 + 3, y0, z0 + 5, x0 + 7, y0 + 1, z0 + 6, K.ink);   // the disc slot
}
// a milk crate (open front toward +z), 7 cubes on a side, lattice sides
export function crate(V, x0, y0, z0, c) {
  V.box(x0, y0, z0, x0 + 7, y0 + 7, z0 + 7, (x, y, z) => { const lx = x - x0, ly = y - y0, lz = z - z0, n = (lx === 0 || lx === 6) + (ly === 0 || ly === 6) + (lz === 0 || lz === 6);
    if (n === 0) return; if (n === 1) { if (lz === 6) return; const [a, b] = lx === 0 || lx === 6 ? [ly, lz] : ly === 0 || ly === 6 ? [lx, lz] : [lx, ly]; return (a & 1) && (b & 1) ? undefined : c; } return c; });   // grid holes: the bars stay joined
}

// ── electronics
export const tvCrt = def({ id: 'tv-crt', name: 'CRT TV', cat: 'electronics', place: 'surface', foot: [3, 2], h: 0.75,
  tiers: ['trailer', 'apartment', 'house'], tags: ['tv', 'rabbit ears', '90s'], variants: 3, vnames: ['grey', 'woodgrain', 'black'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([0x8d8f98, K.wood, 0x2a2a31], variant);
    crt(V, 0, 0, 0, 15, 11, 9, c, pick(SHOWS, seed), seed);
    if (variant === 1) for (let x = 0; x < 15; x++) for (const y of [3, 7]) if (hash(x, y) > .4) V.set(x, y, 3, K.woodD);   // woodgrain streaks
    ears(V, 7, 11, 4, 5, 3);
  } });

export const tvConsole = def({ id: 'tv-console', name: 'Console TV', cat: 'electronics', place: 'floor', foot: [4, 2], h: 1.15,
  tiers: ['trailer', 'house'], tags: ['classic', 'family', 'wood', 'rabbit ears'], variants: 2, vnames: ['walnut', 'oak'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.walnut, K.oak], variant);
    for (const [x, z, dx, dz] of [[1, 1, 1, 1], [18, 1, -1, 1], [1, 8, 1, -1], [18, 8, -1, -1]]) line(V, x, 0, z, x + dx, 4, z + dz, K.woodD);   // splayed legs
    V.box(0, 4, 0, 20, 18, 9, c); V.box(0, 17, 0, 20, 18, 9, shade(c, 1.1));
    V.box(1, 5, 8, 14, 17, 9, K.gold, 2); screen(V, 2, 6, 13, 16, 9, pick(SHOWS, seed + 2), seed); for (const [x, y] of [[2, 6], [12, 6], [2, 15], [12, 15]]) V.del(x, y, 9);   // brass bezel, rounded screen
    V.box(14, 6, 8, 19, 16, 9, (x, y) => ((x + y) & 1) ? 0x6b4a2a : 0x8a6440);                                  // the speaker cloth
    for (const x of [15, 17]) V.box(x, 16, 9, x + 1, 17, 10, K.gold, 2);
    ears(V, 10, 18, 4, 6, 4);
  } });

export const tvFlat = def({ id: 'tv-flat', name: 'Flat TV', cat: 'electronics', place: 'wall', foot: [7, 4], h: 0.1, mount: 1.0,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['tv', 'wall-mounted'], variants: 2, vnames: ['black', 'silver'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const b = pick([0x1f1f24, K.steelL], variant);
    V.box(0, 0, 0, 35, 20, 1, b, variant ? 2 : 1); V.box(0, 0, 1, 35, 1, 2, b); V.box(0, 19, 1, 35, 20, 2, b); V.box(0, 0, 1, 1, 20, 2, b); V.box(34, 0, 1, 35, 20, 2, b);
    screen(V, 1, 1, 34, 19, 1, pick(['sports', 'video', 'news', 'game'], seed), seed); V.set(32, 0, 1, K.red, LIT);
  } });

export const pcBeige = def({ id: 'computer-beige', name: 'Beige PC', cat: 'electronics', place: 'surface', foot: [5, 3], h: 0.55,
  tiers: ['trailer', 'apartment', 'house'], tags: ['computer', '90s', 'crt'], variants: 2, vnames: ['beige', 'yellowed'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.beige, 0xcdb67c], variant), d = shade(c, .82);
    V.box(7, 0, 3, 14, 1, 8, d); V.box(4, 1, 0, 17, 11, 9, c); V.box(5, 2, 0, 16, 10, 1, d);                  // stand, the deep monitor
    V.box(4, 1, 8, 17, 11, 9, shade(c, .92)); screen(V, 5, 3, 15, 10, 9, 'terminal', seed); V.box(14, 9, 9, 16, 11, 10, K.yellow);   // screen, a sticky note
    V.box(3, 0, 10, 17, 1, 14, c); for (let x = 4; x < 16; x++) for (let z = 10; z < 13; z++) if ((x + z) & 1) V.set(x, 1, z, d);   // keyboard
    V.box(19, 0, 11, 21, 1, 13, c); line(V, 19, 0, 11, 17, 0, 9, K.ink);                                      // mouse, cord
    V.box(18, 0, 0, 25, 11, 10, c); V.box(19, 8, 10, 24, 9, 11, K.ink); V.box(19, 6, 10, 24, 7, 11, d); V.set(20, 3, 10, K.lime, LIT); V.box(22, 2, 10, 24, 4, 11, d);   // tower: floppy slot, bay, turbo LED, power
    V.box(1, 0, 11, 3, 1, 13, K.cobalt); V.set(2, 1, 11, K.steelL);                                           // a floppy
  } });

export const pcRig = def({ id: 'computer-rig', name: 'Gaming rig', cat: 'electronics', place: 'surface', foot: [6, 3], h: 0.65,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['computer', 'gaming', 'rgb'], variants: 3, vnames: ['rainbow', 'cyan + pink', 'red'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const rgb = t => variant === 0 ? pick([K.red, K.orange, K.yellow, K.lime, K.cyan, K.cobalt, K.purple, K.pink], Math.floor(t * 7.99)) : variant === 1 ? (t < .5 ? K.cyan : K.pink) : (t < .5 ? K.red : 0xff6a3a);
    V.box(7, 0, 0, 15, 1, 5, 0x2a2a31); V.box(10, 1, 1, 12, 4, 3, K.gun, 2);                                   // stand
    V.box(1, 3, 2, 22, 13, 3, 0x1f1f24); screen(V, 2, 4, 21, 12, 3, 'game', seed);                           // the ultrawide
    V.box(1, 0, 7, 22, 1, 15, 0x1f1f24); V.box(3, 1, 9, 17, 2, 13, 0x2a2a31); for (let x = 3; x < 17; x++) for (let z = 9; z < 13; z++) if ((x + z) & 1) V.set(x, 1, z, rgb((x - 3) / 14), LIT);   // mat, keyboard
    V.box(19, 1, 10, 21, 2, 13, 0x2a2a31); V.set(19, 1, 12, rgb(.7), LIT);                                      // mouse
    V.box(23, 0, 1, 30, 13, 14, 0x1f1f24);                                                                       // tower
    for (const cy of [3, 6.5, 10]) for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; V.set(Math.floor(26.5 + Math.cos(t) * 1.8), Math.floor(cy + .5 + Math.sin(t) * 1.8), 14, rgb(cy / 12), LIT); }
    V.box(23, 12, 13, 30, 13, 14, rgb(.2), LIT);
  } });

// ── gaming (invented consoles)
export const consoleToastr = def({ id: 'console-toastr', name: 'TOASTR console', cat: 'gaming', place: 'surface', foot: [2, 2], h: 0.35,
  tiers: ['trailer', 'apartment', 'house'], tags: ['console', 'retro', 'cartridge'], variants: 3, vnames: ['chrome', 'cream', 'red'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.chrome, K.cream, K.red], variant), l = variant === 0 ? 2 : 1;
    toastr(V, 1, 0, 0, c, l); pad(V, 2, 0, 6, variant === 1 ? K.red : K.ink);
  } });

export const consoleYolk = def({ id: 'console-yolk', name: 'YOLK console', cat: 'gaming', place: 'surface', foot: [2, 2], h: 0.4,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['console', 'y2k', 'glow'], variants: 2, vnames: ['white + yolk', 'black + pink'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.white, 0x26262c], variant), ring = pick([K.amber, K.pink], variant);
    cyl(V, 5, 4, 2.6, 0, 1, K.ink); V.ell(5, 4.4, 4, 3.4, 3.8, 3.2, c, 1);                                       // stand, the egg
    for (let x = 0; x < 10; x++) for (let z = 0; z < 8; z++) if (V.has(x, 4, z) && !(V.has(x + 1, 4, z) && V.has(x - 1, 4, z) && V.has(x, 4, z + 1) && V.has(x, 4, z - 1))) V.set(x, 4, z, ring, LIT);   // the yolk ring
    V.ell(5, .6, 8.5, 2.4, 1, 1.3, c, 1); V.set(4, 1, 8, ring, LIT); V.set(6, 1, 8, ring, LIT);                     // an egg-shaped pad
  } });

export const consoleZigg = def({ id: 'console-zigg', name: 'ZIGG console', cat: 'gaming', place: 'surface', foot: [2, 2], h: 0.35,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['console', 'next-gen', 'glow'], variants: 2, vnames: ['black + cyan', 'white + red'],
  build(V, { variant = 0 } = {}) {
    const c = pick([0x1f1f24, K.white], variant), e = pick([K.cyan, K.red], variant);
    zigg(V, 0, 0, 0, c, e); pad(V, 2, 0, 6, c, undefined, undefined, [e, e]); V.set(4, 1, 7, e, LIT);
  } });

export const gamingSetup = def({ id: 'gaming-setup', name: 'Gaming setup', cat: 'gaming', place: 'floor', foot: [6, 3], h: 1.0,
  tiers: ['apartment', 'house'], tags: ['console', 'tv', 'crates', 'couch co-op'], variants: 2, vnames: ['CRT on crates + TOASTR', 'flat on a bench + ZIGG'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    if (variant === 0) { crate(V, 8, 0, 1, K.red); crate(V, 15, 0, 1, K.cobalt);
      crt(V, 7, 7, 0, 16, 11, 8, 0x8d8f98, 'game', seed); ears(V, 15, 18, 3, 4, 1);
      toastr(V, 0, 0, 9, K.chrome, 2); for (let k = 0; k < 4; k++) V.box(16 + k, 1, 3, 17 + k, 6, 7, pick([K.yellow, K.pink, K.ink, K.lime], k));   // TOASTR on the floor, cartridges in a crate
      for (let k = 0; k < 3; k++) V.box(9, 1 + k, 2, 13, 2 + k, 7, pick([K.orange, K.cobalt, K.white], k));
      pad(V, 11, 0, 10, K.ink, 5, 12); pad(V, 20, 0, 10, K.red, 7, 13); return; }
    V.box(1, 0, 2, 29, 5, 10, 0x2a2a31); V.box(2, 1, 9, 28, 4, 10, 0x3a3c44); V.box(1, 5, 2, 29, 6, 10, K.walnut);   // a low bench
    V.box(13, 6, 2, 17, 7, 4, K.gun, 2); V.box(14, 7, 2, 16, 10, 3, K.gun, 2); V.box(2, 10, 2, 28, 20, 3, 0x1f1f24); screen(V, 3, 11, 27, 19, 3, 'game', seed);   // flat TV on its foot
    zigg(V, 18, 6, 3, 0x1f1f24, K.cyan); pad(V, 8, 0, 11, 0x1f1f24, undefined, undefined, [K.cyan, K.cyan]); pad(V, 19, 0, 11, K.white, undefined, undefined, [K.red, K.red]);
  } });

// ── music
export const boombox = def({ id: 'boombox', name: 'Boombox', cat: 'music', place: 'surface', foot: [3, 1], h: 0.45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['90s', 'music', 'block party'], variants: 3, vnames: ['silver', 'black', 'red'],
  build(V, { variant = 0 } = {}) {
    const c = pick([K.steelL, 0x2a2a31, K.red], variant), l = variant === 0 ? 2 : 1, d = shade(c, .7);
    V.box(0, 0, 0, 15, 7, 4, c, l); V.box(0, 6, 0, 15, 7, 4, d, l);
    for (const cx of [3.5, 11.5]) { cylZ(V, cx, 3.5, 3, 4, 5, 0x55555f); cylZ(V, cx, 3.5, 2.1, 4, 5, K.ink); V.set(Math.floor(cx), 3, 4, K.chrome, 2); }   // speakers
    V.box(6, 2, 4, 9, 6, 5, K.ink); V.box(7, 3, 4, 8, 5, 5, K.cream);                                           // tape deck, a cassette
    for (let x = 5; x < 10; x++) V.set(x, 7, 2, pick([K.white, K.red, K.white, K.yellow, K.white], x));          // piano keys
    V.box(2, 7, 1, 3, 9, 3, K.chrome, 2); V.box(12, 7, 1, 13, 9, 3, K.chrome, 2); V.box(2, 8, 1, 13, 9, 3, K.chrome, 2);   // the handle
    V.box(0, 7, 0, 12, 8, 1, K.chrome, 2);                                                                       // antenna, folded
  } });

export const turntables = def({ id: 'turntables', name: 'Turntables', cat: 'music', place: 'surface', foot: [6, 2], h: 0.2,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['dj', 'vinyl', 'music'], variants: 2, vnames: ['silver', 'black'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.steelL, 0x2a2a31], variant), l = variant ? 1 : 2;
    for (const x0 of [0, 18]) { V.box(x0, 0, 0, x0 + 12, 2, 10, c, l);
      cyl(V, x0 + 5.5, 5, 4.3, 2, 3, K.chrome, 2); cyl(V, x0 + 5.5, 5, 3.8, 2, 4, K.ink, 1); cyl(V, x0 + 5.5, 5, 1.3, 3, 4, pick([K.red, K.yellow, K.cyan, K.pink], seed + x0), 0); V.set(x0 + 5, 3, 4, K.chrome, 2);
      line(V, x0 + 11, 2, 8, x0 + 8, 3, 3, K.chrome, 2); V.box(x0 + 10, 2, 7, x0 + 12, 3, 9, K.ink);           // tonearm
      V.box(x0 + 10, 2, 1, x0 + 11, 3, 5, K.ink); V.set(x0 + 10, 2, 3, K.white); V.set(x0 + 1, 2, 8, K.ink); }  // pitch slider, start
    V.box(12, 0, 1, 18, 3, 9, 0x1f1f24);                                                                       // the mixer
    for (const x of [13, 16]) { V.box(x, 2, 3, x + 1, 3, 7, K.ink); V.set(x, 3, 5, K.white); }                   // up-faders
    V.box(13, 2, 7, 17, 3, 8, K.ink); V.set(15, 3, 7, K.white); for (let z = 2; z < 6; z++) V.set(14, 2, z, z < 3 ? K.red : K.lime, LIT);   // crossfader, meter
    for (const x of [13, 16]) V.set(x, 3, 1, pick([K.red, K.cyan], x));
  } });

export const speaker = def({ id: 'speaker', name: 'Speaker', cat: 'music', place: 'floor', foot: [2, 2], h: 1.0,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['music', 'loud', 'pair'], variants: 3, vnames: ['wood', 'black', 'white'], far: true,
  build(V, { variant = 0 } = {}) {
    const c = pick([K.wood, 0x2a2a31, K.white], variant);
    V.box(1, 0, 1, 9, 1, 8, K.ink); V.box(0, 1, 0, 10, 20, 9, c);
    for (const [cy, r] of [[6, 3.8], [13, 2.3], [17.5, 1.3]]) { cylZ(V, 5, cy, r, 9, 10, 0x55555f); cylZ(V, 5, cy, r - .8, 9, 10, K.ink); if (r > 2) cylZ(V, 5, cy, 1, 9, 10, K.gun, 2); }
  } });

export const MEDIA = [tvCrt, tvConsole, tvFlat, pcBeige, pcRig, consoleToastr, consoleYolk, consoleZigg, gamingSetup, boombox, turntables, speaker];
