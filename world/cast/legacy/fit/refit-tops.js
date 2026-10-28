// REFIT · EVERYDAY TOPS + FLAT PRINTS (refit agent 2, 2026-09-30). Every top that isn't padded or structured outerwear, redrawn
// over chars.js TOPS (installTopsRefit, one line in chars.js). Ids and colourways are kept; only the geometry and where the paint
// lies change. Rules (world/fit/contract.js, world/fit/body.js):
//   · prints, logos, letters, zips and pockets recolour the shell (z 3 front, z −3 back): nothing on the panel stands proud (budget 0)
//   · the shell is x −6…5 (flank 1), y 9…17, z −3…3 and rides the chest; nothing of it at y 18 (the head's collar slab stays skin)
//   · ONE sleeve per arm (simple arms, 2026-09-30: the arm is one piece, no elbow; body.js sleeve): short = y 14…16 with a hem row;
//     long = y 10…16 with a cuff row that meets the hand; both with the shoulder cap (arm, y 17…18). The paints still name two zones
//     of the one sleeve ('fore' y 10…11 = the cuff end, ly from 9; 'up' y 12…16, ly from 12) so every design keeps its rows
//   · the rows next to the shoulder are plain, so nothing is cut at the shoulder
//   · hoods and collars: one row at y 17, at most one voxel proud (the back)
import { sleeve, shoulderCap } from './body.js';

export function installTopsRefit({ TOPS, PRINTS, cwOf, shade, lerpHex, mulberry32, RAINBOW }) {
  const shell = (B, paint, l, y0 = 9) => B.box(-6, y0, -3, 6, 18, 4, paint, l);
  // both sleeves, one piece each. paint(part, lx, ly, z) → colour; part: 'up' · 'fore' · 'cap' (lx: 0 the inner column, 1 the outer;
  // ly: y − 9 in the cuff zone 'fore', y − 12 in 'up', y − 12 on the cap: the rows every design was drawn with)
  const sleeves = (B, long, paint, l) => { for (const s of 'LR') {
    sleeve(B, s, 'arm' + s, { x0: -8, x1: -7, y0: long ? 10 : 14, y1: 16, z0: -2, z1: 1 }, (lx, ly, z, X, y) => y < 12 ? paint('fore', lx, y - 9, z) : paint('up', lx, y - 12, z), l);
    shoulderCap(B, s, (lx, ly, z, X, y) => paint('cap', lx - 1, y - 12, z), { l }); } };   // (the cap's lx: −1 over the chest's side, 1 the outer column, as on the sleeve)
  const art = (B, rows, pal, x0, top, z = 3) => rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = typeof pal[r[i]] === 'function' ? pal[r[i]](i, j) : pal[r[i]]; if (c !== undefined) B.set(x0 + i, top - j, z, c); } });   // flat art on the shell
  const shortHem = (C, H) => (part, lx, ly) => part === 'up' && ly === 2 ? H : C;
  // a hood (or a soft collar) rolled round the neck: one row at y 17 inside the shoulders, one voxel proud at the back
  const hood = (B, c, l, x0 = -4, x1 = 3, zf = 1) => { for (let x = x0; x <= x1; x++) for (let z = -4; z <= zf; z++) B.set(x, 17, z, typeof c === 'function' ? c(x, 17, z) : c, l); };
  // the hoodie base: shell, a ribbed hem (y 9), long sleeves with ribbed cuffs, the hood
  const hoodieBase = (B, C, paint = C) => { const D = shade(C, .72);
    shell(B, paint); for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, D);
    sleeves(B, true, (part, lx, ly) => part === 'fore' && ly === 1 ? D : C); hood(B, D); return D; };

  Object.assign(TOPS, {
    hoodie(B, p) { const C = p.c ?? 0x151517, LC = p.lc ?? 0xd7141a; hoodieBase(B, C);
      if ((p.logo ?? 'box') === 'box') { B.box(-3, 10, 3, 3, 13, 4, LC); for (const x of [-2, -1, 1]) B.set(x, 11, 3, 0xffffff); for (const x of [-2, 0, 1]) B.set(x, 12, 3, 0xffffff); }   // the box logo, flat
      else B.box(1, 14, 3, 4, 16, 4, 0xffffff); },
    desktop(B) { hoodieBase(B, 0x008080); B.box(-4, 10, 3, 3, 15, 4, 0xc0c0c0); for (let x = -4; x < 3; x++) B.set(x, 14, 3, lerpHex(0x000080, 0x1084d0, (x + 4) / 6)); B.set(2, 14, 3, 0xc0c0c0);
      B.box(-3, 11, 3, 2, 13, 4, 0xffffff); for (const x of [-2, -1, 0]) B.set(x, 12, 3, 0x0a0a0a); },   // the window, flat on the chest
    bsodtee(B) { const C = 0x0000aa; shell(B, C); sleeves(B, false, shortHem(C, shade(C, .8)));
      B.box(-2, 16, 3, 2, 17, 4, 0xaaaaaa); const r = mulberry32(3); for (const y of [14, 12, 10]) for (let x = -5; x < 5; x++) if (r() < .72) B.set(x, y, 3, 0xffffff); },
    track(B) { const C = 0xefe9dc; shell(B, C); sleeves(B, true, (part, lx, ly, z) => { const i = 5 - ly;
        return (part === 'up' || part === 'cap') && z === 1 && lx >= 0 && i >= 0 && i < 6 ? RAINBOW[i] : part === 'fore' && ly === 1 ? shade(C, .88) : C; });   // the stripes cross the sleeve's front, lined up with the chest's at rest
      RAINBOW.forEach((col, i) => { const y = 17 - i; for (let x = -6; x < 6; x++) B.set(x, y, 3, col); });
      for (let y = 9; y < 18; y++) B.set(-1, y, 3, 0xbdbdbd, 2); },   // the zip, flat
    jumpsuit(B) { const C = 0xff7a1a, D = shade(C, .78); shell(B, C); sleeves(B, true, (part, lx, ly) => part === 'fore' && ly === 1 ? D : C);
      for (const [x, y] of [[-2, 17], [-1, 17], [0, 17], [1, 17], [-1, 16], [0, 16]]) B.set(x, y, 3, D); B.box(1, 12, 3, 5, 15, 4, 0xf2f2f2); B.textBack('404', 4, 16, -3, D); },
    velour(B, p) { const C = p.c ?? 0x6e1f3a, L = shade(C, 1.2), Sv = 0xf2f2f2, nap = (u, v) => ((u + v * 2) % 5 === 0 ? L : C);
      shell(B, (x, y) => nap(x + 6, y - 9)); for (let y = 9; y < 18; y++) B.set(-1, y, 3, 0xc9ced4, 2); hood(B, shade(C, .8));
      sleeves(B, true, (part, lx, ly, z) => lx === 1 && z === 0 ? Sv : (part === 'up' && ly > 0) || (part === 'cap') ? nap(z + 2, ly) : C); },   // the stripe down the sleeve's outer side; the nap per segment
    flannel(B, p) { const C = p.c ?? 0xb3121b, K = 0x151515, M = shade(C, .5), pl = (u, v) => ((u & 3) === 0 && (v & 3) === 0) ? K : ((u & 3) === 0 || (v & 3) === 0) ? M : C;
      shell(B, (x, y) => pl(x + 4, y - 9)); hood(B, (x, y, z) => pl(x + 4, z + 4), 0, -5, 4, 0);   // the collar (the check's lines kept off the side seams x −6 / 5)
      for (let y = 9; y < 16; y++) for (const x of [-2, -1, 0, 1]) B.set(x, y, 3, 0xf2f2f2); B.set(-1, 16, 3, 0xe9e2cf);   // the tee under the open shirt, a button
      // sleeves: the check lines up with the shell's at rest (lines at y 13 and 17); the cuff end is plain
      sleeves(B, true, (part, lx, ly, z) => part === 'fore' ? (ly === 1 ? M : C) : (part === 'up' && ly === 0) ? C : lx < 0 ? (ly === 5 ? M : C) : pl(z + 2, ly + 3)); },
    babytee(B, p) { const C = p.c ?? 0xf7b6d2; B.box(-5, 12, -2, 5, 18, 3, C); for (const s of 'LR') { sleeve(B, s, 'arm' + s, { x0: -8, x1: -6, y0: 15, y1: 16, z0: -2, z1: 1 }, (lx, ly, z, X, y) => y === 15 ? shade(C, .88) : C); }
      B.bmp(PRINTS.star[0], { X: 0xffffff }, -3, 17, 2, 3); },
    catee(B, p) { const [, C] = cwOf('catee', p); shell(B, C); sleeves(B, false, shortHem(C, shade(C, .82)));
      art(B, ['O......O', 'OO....OO', 'ODDDDDDO', 'OGKOOGKO', 'OOOOOOOO', 'KOOPPOOK', '.OOOOOO.'], { O: 0xf08a24, D: 0xb85a10, G: 0x2ecc40, K: 0x151515, P: 0xff7ab6 }, -4, 16); },
    tapetee(B, p) { const [, C] = cwOf('tapetee', p); shell(B, C);
      for (const [z, sx] of [[3, 1], [-3, -1]]) for (let x = -6; x < 6; x++) for (let y = 9; y < 18; y++) { const d = (((sx * x - y) % 12) + 12) % 12; if (d <= 2) B.set(x, y, z, d === 1 && ((x + y) & 3) < 2 ? 0x151515 : 0xffd21f); }
      sleeves(B, false, (part, lx, ly, z) => { if (part === 'cap') return C; const d = (((z - ly) % 6) + 6) % 6; return lx === 1 && d <= 1 ? 0xffd21f : ly === 2 ? shade(C, .82) : C; }); },   // a band of tape round the sleeve, laid on the sleeve itself
    dyehoodie(B, p) { const [, A, Bc, Cc] = cwOf('dyehoodie', p), cs = [A, Bc, Cc], dye = (x, y, z) => { const a = Math.atan2(y - 13, x + .5 + (z < 0 ? 3 : 0)), r = Math.hypot(y - 13, x + .5); return cs[((Math.floor(a / (Math.PI * 2) * 6 + r * .45) % 3) + 3) % 3]; };
      const sdye = (ly, z) => cs[(((Math.floor((ly + z + 9) / 2)) % 3) + 3) % 3];   // the sleeves: bands of dye laid per segment
      shell(B, dye); for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, shade(dye(x, 9, z), .75));
      sleeves(B, true, (part, lx, ly, z) => part === 'fore' ? (ly === 1 ? shade(A, .75) : A) : (part === 'up' && ly === 0) ? A : sdye(ly, z));
      hood(B, (x, y, z) => shade(dye(x, y, z), .85)); B.box(-4, 10, 3, 4, 13, 4, (x, y, z) => shade(dye(x, y, z), .9));   // the pocket, flat
      for (const x of [-2, 1]) for (let y = 13; y < 17; y++) B.set(x, y, 3, 0xf4f4f4); },   // the strings, flat
    trackjkt(B, p) { const [, C, S2, Pp] = cwOf('trackjkt', p); shell(B, C);
      for (let x = -6; x < 6; x++) { for (const y of [15, 16, 17]) { B.set(x, y, 3, S2); B.set(x, y, -3, S2); } B.set(x, 14, 3, Pp); B.set(x, 14, -3, Pp); }
      for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, shade(C, .75));
      sleeves(B, true, (part, lx, ly, z) => part === 'fore' && ly === 1 ? shade(C, .75) : part === 'cap' ? S2 : lx === 1 && (z === -1 || z === 0) ? S2 : lx === 1 && z === 1 ? Pp : C);   // one stripe and a piping down each sleeve, per segment
      hood(B, S2, 0, -5, 4, 2); for (let y = 9; y < 18; y++) B.set(-1, y, 3, 0xbdbdbd, 2); },   // the collar at the back; the zip, flat
    buffalo(B, p) { const [, C] = cwOf('buffalo', p), D = shade(C, .55), chk = (a, b) => { const i = (a >> 1) & 1, j = (b >> 1) & 1; return i && j ? 0x141414 : (i || j ? D : C); }, pl = (x, y, z) => chk(x + z + 8, y);
      shell(B, pl); hood(B, (x, y, z) => pl(x, y, z), 0, -5, 4, 0);
      for (let y = 9; y < 17; y++) for (const x of [-2, -1, 0, 1]) B.set(x, y, 3, 0x151517);   // the tee under the open shirt
      sleeves(B, true, (part, lx, ly, z) => part === 'fore' ? (ly === 1 ? D : C) : (part === 'up' && ly === 0) ? C : chk(z + 2 + 2 * lx, ly + 1)); },
    bootleg(B, p) { const [, C] = cwOf('bootleg', p); shell(B, C); sleeves(B, false, shortHem(C, shade(C, .82)));
      art(B, ['Y.YYY.YY.Y', 'PPPKKKKPPP', 'PZPSSSSPZP', 'PPZKKKKZPP', 'PZPSSSSPZP', 'PPPSGGSPPP', 'W.WW.WWW.W'], { Y: 0xffd21f, K: 0x151515, S: 0xc8744a, Z: 0xffd21f, G: 0xe7bd4a, W: 0xf2f2f2, P: (i, j) => lerpHex(0xff4fa3, 0x5a2bd6, j / 6) }, -5, 16);
      for (const y of [15, 13, 11]) for (let x = -4; x < 4; x++) if ((x + y) % 5) B.set(x, y, -3, 0xf2f2f2); },
    slabtee(B, p) { const [, C] = cwOf('slabtee', p); shell(B, C); sleeves(B, false, shortHem(C, shade(C, .82)));
      art(B, ['RRWRWWRR', 'LLLLLLLL', 'LHHHHHHL', 'LHSSSSHL', 'LHKSSKHL', 'LHSSSSHL', 'LHHHHHHL', 'LLLLLLLL'], { R: 0xd7141a, W: 0xffffff, L: 0xd9dde3, S: 0xf5c518, K: 0x151515, H: (i, j) => [0xc8f0ff, 0xffc8f0, 0xfff4b0, 0xc8ffd8][(i + j) & 3] }, -4, 16); },
    leather(B, p) { const [, C, Hw] = cwOf('leather', p), D = shade(C, .7), Lt = shade(C, 1.6), grain = (x, y, z) => ((x * 3 + y * 7 + z * 5) % 11 === 0) ? Lt : C;
      shell(B, grain, 1); for (let x = -6; x < 6; x++) for (let z = -3; z < 4; z++) B.set(x, 9, z, D, 1);
      sleeves(B, true, (part, lx, ly, z) => part === 'fore' && ly === 1 ? D : C, 1); hood(B, C, 1, -5, 4, 0);   // the collar
      for (const [x, y] of [[-5, 17], [-4, 17], [-4, 16], [-3, 16], [-3, 15], [-2, 15], [3, 17], [4, 17], [2, 16], [3, 16], [1, 15], [2, 15]]) B.set(x, y, 3, D, 1);   // the lapels, flat
      for (let y = 9; y < 17; y++) B.set(Math.round(-2 + (y - 9) * 5 / 7), y, 3, Hw, 2); B.box(3, 9, 3, 5, 10, 4, Hw, 2);   // the zip and the belt buckle, flat
      B.set(-5, 16, 3, Hw, 2); B.set(4, 16, 3, Hw, 2);
      for (const s of 'LR') sleeve(B, s, 'arm' + s, { x0: -8, x1: -8, y0: 10, y1: 11, z0: 0, z1: 0 }, Hw, 2); },   // the cuff zips, on the sleeve
  });
}
