// AI CITY world v2 — tiles, blocks, and the pixel sign font.
// Every block face samples one 16×16 canvas-painted tile from a texture array. Tiles stay flat and toy-like
// (one base colour, low noise, a 1-px bevel) so the city and the fit-check characters read as one universe.
// Alpha channel is a mask: 255 = normal · 201 = warm window glow at night · 179 = cool office glow · 161 = self-colour glow · 0 = cutout.
import * as THREE from 'three';
import { c as pc } from './palettes.js';

export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hx = s => parseInt(s.slice(1), 16);
export const tint = (c, f) => { const v = hx(c), m = s => Math.max(0, Math.min(255, Math.round(((v >> s) & 255) * f))); return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1); };
export const mixC = (a, b, t) => { const pa = hx(a), pb = hx(b), m = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1); };
function R(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function specks(g, r, cols, n, x0 = 0, y0 = 0, w = 16, h = 16) { for (let i = 0; i < n; i++) R(g, cols[r() * cols.length | 0], x0 + (r() * w | 0), y0 + (r() * h | 0), 1, 1); }
function bevel(g, c, k = 1) { R(g, tint(c, 1 + .10 * k), 0, 0, 16, 1); R(g, tint(c, 1 + .06 * k), 0, 1, 1, 15); R(g, tint(c, 1 - .13 * k), 0, 15, 16, 1); R(g, tint(c, 1 - .08 * k), 15, 0, 1, 15); }
function flat(g, r, c, n = 10, k = 1, v = .05) { R(g, c, 0, 0, 16, 16); specks(g, r, [tint(c, 1 - v), tint(c, 1 + v)], n); if (k) bevel(g, c, k); }

// ───────────────────────── tiles
export const TILES = {}; const LIST = [];
function tile(name, fn) { TILES[name] = LIST.length; LIST.push([name, fn]); }
const glowRects = [];   // filled per tile while painting: [x,y,w,h,alpha]
const glow = (x, y, w, h, a = 201) => glowRects.push([x, y, w, h, a]);
const cutRects = [];
const cut = (x, y, w, h) => cutRects.push([x, y, w, h]);

// ground
tile('grass', (g, r) => { flat(g, r, pc('#7cb65a'), 14, .6, .06); });
tile('grassSide', (g, r) => { flat(g, r, pc('#9c6d48'), 12, .6); R(g, pc('#7cb65a'), 0, 0, 16, 3); for (let x = 0; x < 16; x++) if (r() < .45) R(g, pc('#7cb65a'), x, 3, 1, 1); R(g, pc('#8fc66b'), 0, 0, 16, 1); });
tile('dirt', (g, r) => flat(g, r, pc('#9c6d48'), 16, .6, .07));
tile('mud', (g, r) => flat(g, r, pc('#7a5a40'), 16, .5, .08));
tile('gravel', (g, r) => { R(g, pc('#a8a296'), 0, 0, 16, 16); specks(g, r, [pc('#938d82'), pc('#bab4a8'), pc('#857f75'), pc('#c4beb2')], 70); bevel(g, pc('#a8a296'), .5); });
tile('sand', (g, r) => flat(g, r, pc('#e4d09c'), 14, .5, .05));
tile('rock', (g, r) => { flat(g, r, pc('#8f9195'), 14, 1, .07); R(g, pc('#7d7f84'), 3, 9, 5, 1); R(g, pc('#7d7f84'), 9, 4, 4, 1); });
tile('snowless', (g, r) => flat(g, r, pc('#b9b39f'), 8));
const ASPH = pc('#46474d');
function asph(g, r) { R(g, ASPH, 0, 0, 16, 16); specks(g, r, [pc('#4f5057'), pc('#3f4046'), pc('#55565c')], 26); }
tile('asph', asph);
tile('asphYR', (g, r) => { asph(g, r); R(g, pc('#e7c24a'), 14, 0, 2, 16); });
tile('asphYL', (g, r) => { asph(g, r); R(g, pc('#e7c24a'), 0, 0, 2, 16); });
tile('asphYT', (g, r) => { asph(g, r); R(g, pc('#e7c24a'), 0, 0, 16, 2); });
tile('asphYB', (g, r) => { asph(g, r); R(g, pc('#e7c24a'), 0, 14, 16, 2); });
tile('asphWR', (g, r) => { asph(g, r); R(g, pc('#e6e4dc'), 15, 0, 1, 16); });
tile('asphWL', (g, r) => { asph(g, r); R(g, pc('#e6e4dc'), 0, 0, 1, 16); });
tile('asphWT', (g, r) => { asph(g, r); R(g, pc('#e6e4dc'), 0, 0, 16, 1); });
tile('asphWB', (g, r) => { asph(g, r); R(g, pc('#e6e4dc'), 0, 15, 16, 1); });
tile('zebraZ', (g, r) => { asph(g, r); R(g, pc('#e9e7e0'), 2, 0, 4, 16); R(g, pc('#e9e7e0'), 10, 0, 4, 16); });
tile('zebraX', (g, r) => { asph(g, r); R(g, pc('#e9e7e0'), 0, 2, 16, 4); R(g, pc('#e9e7e0'), 0, 10, 16, 4); });
tile('asphOld', (g, r) => { R(g, pc('#5a5a5c'), 0, 0, 16, 16); specks(g, r, [pc('#666668'), pc('#4d4d50'), pc('#707072')], 40); R(g, pc('#3e3e41'), 3, 7, 6, 1); R(g, pc('#3e3e41'), 8, 8, 1, 4); });
tile('walk', (g, r) => { R(g, pc('#cfcac0'), 0, 0, 16, 16); specks(g, r, [pc('#c6c1b6'), pc('#d8d3c9')], 12); R(g, pc('#b7b2a7'), 0, 0, 16, 1); R(g, pc('#b7b2a7'), 0, 0, 1, 16); R(g, pc('#dcd7ce'), 1, 1, 15, 1); });
tile('paver', (g, r) => { R(g, pc('#d9c7a8'), 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { R(g, pc('#bfae90'), 0, y, 16, 1); for (let x = (y / 4 % 2) * 4; x < 16; x += 8) R(g, pc('#bfae90'), x, y, 1, 4); } specks(g, r, [pc('#e2d2b6'), pc('#cdbb9c')], 10); });
tile('paverRed', (g, r) => { R(g, pc('#b86b50'), 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) { R(g, pc('#9a5540'), 0, y, 16, 1); for (let x = (y / 4 % 2) * 4; x < 16; x += 8) R(g, pc('#9a5540'), x, y, 1, 4); } });
tile('concrete', (g, r) => flat(g, r, pc('#bdb9b0'), 10, .7, .04));
tile('concreteDk', (g, r) => flat(g, r, pc('#8f8c86'), 12, .7, .05));
tile('stain', (g, r) => { flat(g, r, pc('#aaa69d'), 10, .6); for (let i = 0; i < 5; i++) R(g, pc('#8e8a82'), r() * 12 | 0, r() * 12 | 0, 3 + (r() * 3 | 0), 2); });
tile('court', (g, r) => { flat(g, r, pc('#5f7f6a'), 6, 0, .03); });
tile('courtLine', (g, r) => { flat(g, r, pc('#5f7f6a'), 6, 0, .03); R(g, pc('#f1efe8'), 0, 0, 16, 1); });
tile('track', (g, r) => flat(g, r, pc('#b9674a'), 16, 0, .06));
tile('mulch', (g, r) => { R(g, pc('#6e4a33'), 0, 0, 16, 16); specks(g, r, [pc('#5b3c29'), pc('#83583c'), pc('#4d3222')], 60); });

// walls
function bricks(g, r, c, mortar = pc('#d8ccbc')) { R(g, mortar, 0, 0, 16, 16);
  for (let row = 0; row < 4; row++) { const off = row % 2 ? 4 : 0; for (let bx = -8; bx < 16; bx += 8) { const x = bx + off, cc = tint(c, .92 + r() * .16); R(g, cc, Math.max(0, x), row * 4, Math.min(x + 7, 16) - Math.max(0, x), 3); } }
  R(g, 'rgba(255,255,255,.07)', 0, 0, 16, 1); R(g, 'rgba(0,0,0,.10)', 0, 15, 16, 1); }
tile('brickRed', (g, r) => bricks(g, r, pc('#b04e37')));
tile('brickBrown', (g, r) => bricks(g, r, pc('#7f503b'), pc('#c9b9a5')));
tile('brickTan', (g, r) => bricks(g, r, pc('#c89c69'), pc('#e5d8c2')));
tile('brickWhite', (g, r) => bricks(g, r, pc('#e7e2d8'), pc('#cfc8bb')));
tile('brickDark', (g, r) => bricks(g, r, pc('#5c3b34'), pc('#8c7a6e')));
tile('brickYellow', (g, r) => bricks(g, r, pc('#d8b456'), pc('#ece0bf')));
function siding(g, r, c) { for (let y = 0; y < 16; y += 4) { R(g, c, 0, y, 16, 4); R(g, tint(c, 1.06), 0, y, 16, 1); R(g, tint(c, .84), 0, y + 3, 16, 1); } R(g, tint(c, .9), 15, 0, 1, 16); }
const SIDING = { sidW: pc('#efebe1'), sidB: pc('#8fb2d2'), sidY: pc('#e8d48c'), sidG: pc('#a6cfad'), sidP: pc('#e7abb3'), sidV: pc('#d8caa6'), sidS: pc('#a8adb4'), sidR: pc('#b8574a'), sidT: pc('#6fa3a0') };
for (const [k, c] of Object.entries(SIDING)) tile(k, (g, r) => siding(g, r, c));
tile('trimW', (g, r) => { flat(g, r, pc('#f4f1ea'), 4, 1, .02); });
tile('stucco', (g, r) => flat(g, r, pc('#e8dcc3'), 22, .6, .04));
tile('stuccoPink', (g, r) => flat(g, r, pc('#e8b8a3'), 22, .6, .04));
tile('stuccoMint', (g, r) => flat(g, r, pc('#b8dcc8'), 22, .6, .04));
tile('ashlar', (g, r) => { R(g, pc('#d8d1c2'), 0, 0, 16, 16); specks(g, r, [pc('#cfc7b6'), pc('#e0d9cb')], 14); R(g, pc('#b9b09e'), 0, 7, 16, 1); R(g, pc('#b9b09e'), 0, 15, 16, 1); R(g, pc('#b9b09e'), 11, 0, 1, 7); R(g, pc('#b9b09e'), 4, 8, 1, 7); });
tile('marble', (g, r) => { flat(g, r, pc('#f2f0ea'), 6, .7, .02); let x = r() * 16; for (let y = 0; y < 16; y++) { x += (r() - .5) * 2; R(g, pc('#dcd7cc'), x | 0, y, 1, 1); } });
tile('gold', (g, r) => { R(g, pc('#d7a735'), 0, 0, 16, 16); R(g, pc('#f1cf6a'), 0, 0, 16, 2); R(g, pc('#a77b1c'), 0, 14, 16, 2); specks(g, r, [pc('#e8bd4c')], 10); });
tile('cwall', (g, r) => { flat(g, r, pc('#c7c3ba'), 8, .6, .03); for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) R(g, pc('#a9a59c'), x, y, 1, 1); });
tile('jailWall', (g, r) => { flat(g, r, pc('#a9a59b'), 12, .6, .05); R(g, 'rgba(70,60,50,.18)', 0, 11, 16, 5); for (let i = 0; i < 3; i++) R(g, 'rgba(60,50,40,.22)', r() * 16 | 0, 6 + (r() * 10 | 0), 1, 4); });
tile('jailStripe', (g, r) => { flat(g, r, pc('#a9a59b'), 10, .6, .05); R(g, pc('#d9c24a'), 0, 6, 16, 4); });
function ribs(g, r, c, horiz = false) { R(g, c, 0, 0, 16, 16); for (let k = 0; k < 16; k += 3) horiz ? (R(g, tint(c, 1.12), 0, k, 16, 1), R(g, tint(c, .82), 0, k + 2, 16, 1)) : (R(g, tint(c, 1.12), k, 0, 1, 16), R(g, tint(c, .82), k + 2, 0, 1, 16)); }
tile('metal', (g, r) => ribs(g, r, pc('#a8acb2')));
tile('metalBlue', (g, r) => ribs(g, r, pc('#5b7fa4')));
tile('metalGreen', (g, r) => ribs(g, r, pc('#6b8d6b')));
tile('metalCream', (g, r) => ribs(g, r, pc('#ddd4bd')));
tile('metalRust', (g, r) => { ribs(g, r, pc('#9a5a35')); for (let i = 0; i < 6; i++) R(g, r() < .5 ? pc('#7b3f22') : pc('#b87444'), r() * 15 | 0, r() * 15 | 0, 2, 2); });
tile('trailerW', (g, r) => ribs(g, r, pc('#e4e1d8'), true));
tile('trailerY', (g, r) => ribs(g, r, pc('#e2cf8f'), true));
tile('trailerB', (g, r) => ribs(g, r, pc('#9fb9cf'), true));
tile('trailerG', (g, r) => ribs(g, r, pc('#b3c7a0'), true));
tile('trailerTan', (g, r) => { ribs(g, r, pc('#d8c3a0'), true); R(g, pc('#8a5a3a'), 0, 12, 16, 2); });
for (const [k, c] of Object.entries({ contR: pc('#b53b2e'), contB: pc('#2f5f8e'), contG: pc('#3f7b4b'), contO: pc('#d4782b'), contY: pc('#d9b43a'), contW: pc('#d9dad6') })) tile(k, (g, r) => { ribs(g, r, c); R(g, tint(c, .7), 0, 0, 16, 1); R(g, tint(c, .7), 0, 15, 16, 1); });
tile('rollDoor', (g, r) => { for (let y = 0; y < 16; y += 2) { R(g, pc('#b9bdc2'), 0, y, 16, 1); R(g, pc('#9ea2a8'), 0, y + 1, 16, 1); } R(g, pc('#6d7176'), 0, 0, 1, 16); R(g, pc('#6d7176'), 15, 0, 1, 16); });
tile('hazard', g => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) R(g, ((x + y) >> 2) & 1 ? pc('#1d1d1f') : pc('#f0c330'), x, y, 1, 1); });
tile('steelY', (g, r) => { flat(g, r, pc('#e2b53a'), 4, 1.2, .03); });
tile('steelR', (g, r) => { flat(g, r, pc('#b93b2f'), 4, 1.2, .03); });
tile('steelG', (g, r) => { flat(g, r, pc('#6c7178'), 4, 1.2, .03); });
tile('steelB', (g, r) => { flat(g, r, pc('#34598a'), 4, 1.2, .03); });

// glass + windows (the lit variants look the same by day; the alpha mask makes them glow at night)
function curtain(g, r, c, spandrel) { for (let y = 0; y < 16; y++) R(g, mixC(tint(c, 1.22), c, y / 15), 0, y, 16, 1); for (let k = 0; k < 4; k++) R(g, 'rgba(255,255,255,.16)', 10 - k, 2 + k * 3, 2, 1);
  R(g, tint(c, .6), 0, 0, 1, 16); if (spandrel) { R(g, tint(c, .5), 0, 9, 16, 7); R(g, tint(c, .62), 0, 9, 16, 1); R(g, tint(c, .42), 0, 15, 16, 1); } }
for (const [k, c, gl] of [['glassB', pc('#5a86ae'), 179], ['glassT', pc('#4f8f8a'), 179], ['glassK', pc('#34404f'), 179], ['glassG', pc('#8fa2b3'), 201]]) {
  tile(k, (g, r) => curtain(g, r, c)); tile(k + 'L', (g, r) => { curtain(g, r, c); glow(1, 0, 15, 16, gl); }); tile(k + 'S', (g, r) => curtain(g, r, c, true)); }
function win(g, frame = pc('#f4f1ea'), glass = pc('#6f98bf'), sill = true) { R(g, frame, 0, 0, 16, 16); for (let y = 2; y < 14; y++) R(g, mixC(tint(glass, 1.3), glass, (y - 2) / 11), 2, y, 12, 1);
  R(g, 'rgba(255,255,255,.35)', 9, 3, 2, 1); R(g, 'rgba(255,255,255,.35)', 8, 4, 2, 1); R(g, 'rgba(255,255,255,.25)', 5, 9, 2, 1); R(g, frame, 7, 2, 2, 12); R(g, frame, 2, 7, 12, 1); R(g, tint(frame, .8), 1, 14, 14, 1); if (sill) R(g, tint(frame, .7), 0, 15, 16, 1); }
tile('win', g => win(g));
tile('winL', g => { win(g); glow(2, 2, 5, 5); glow(9, 2, 5, 5); glow(2, 8, 5, 6); glow(9, 8, 5, 6); });
tile('winD', g => win(g, pc('#3b3f46'), pc('#3d5268')));
tile('copper', (g, r) => flat(g, r, pc('#6fa58f'), 12, .8, .05));
tile('winDL', g => { win(g, pc('#3b3f46'), pc('#3d5268')); glow(2, 2, 12, 12); });
tile('winS', g => win(g, pc('#cdbfa8'), pc('#6a90b3')));
tile('winSL', g => { win(g, pc('#cdbfa8'), pc('#6a90b3')); glow(2, 2, 5, 5); glow(9, 2, 5, 5); glow(2, 8, 5, 6); glow(9, 8, 5, 6); });
tile('winBoard', (g, r) => { R(g, pc('#f4f1ea'), 0, 0, 16, 16); R(g, pc('#9b7b55'), 2, 2, 12, 12); for (let y = 2; y < 14; y += 3) R(g, pc('#7f6243'), 2, y, 12, 1); R(g, pc('#6b5238'), 2, 6, 12, 2); });
tile('winFoil', (g, r) => { win(g, pc('#e4e1d8'), pc('#c9ccd1')); for (let i = 0; i < 16; i++) R(g, r() < .5 ? pc('#e8eaee') : pc('#a9adb3'), 2 + (r() * 12 | 0), 2 + (r() * 12 | 0), 2, 1); });
function band(g, c = pc('#b9b5ac'), glass = pc('#4d6f93')) { R(g, c, 0, 0, 16, 16); for (let y = 4; y < 13; y++) R(g, mixC(tint(glass, 1.3), glass, (y - 4) / 8), 0, y, 16, 1); R(g, tint(c, .75), 0, 13, 16, 1); R(g, 'rgba(255,255,255,.3)', 6, 5, 3, 1); }
tile('band', g => band(g));
tile('bandL', g => { band(g); glow(0, 4, 16, 9, 179); });
tile('bandW', g => band(g, pc('#eceae4'), pc('#5886b0')));
tile('bandWL', g => { band(g, pc('#eceae4'), pc('#5886b0')); glow(0, 4, 16, 9, 179); });
function slit(g, r) { flat(g, r, pc('#a9a59b'), 10, .6, .05); R(g, pc('#262a30'), 5, 2, 6, 12); R(g, pc('#9aa0a6'), 7, 2, 1, 12); R(g, pc('#9aa0a6'), 9, 2, 1, 12); R(g, pc('#8a8680'), 4, 14, 8, 1); }
tile('slit', slit);
tile('slitL', (g, r) => { slit(g, r); glow(5, 2, 2, 12, 179); glow(8, 2, 1, 12, 179); glow(10, 2, 1, 12, 179); });
function shop(g, frame = pc('#2d2f34')) { R(g, frame, 0, 0, 16, 16); for (let y = 1; y < 16; y++) R(g, mixC(pc('#a8c6dc'), pc('#6d93b5'), y / 15), 1, y, 14, 1); R(g, 'rgba(255,255,255,.35)', 10, 3, 2, 1); R(g, 'rgba(255,255,255,.35)', 9, 4, 2, 1); R(g, frame, 0, 0, 16, 1); }
tile('shop', g => shop(g));
tile('shopL', g => { shop(g); glow(1, 1, 14, 15); });
tile('shopW', g => shop(g, pc('#e9e5dc')));
tile('shopWL', g => { shop(g, pc('#e9e5dc')); glow(1, 1, 14, 15); });
function door(g, top, c = pc('#8a5a3a')) { R(g, pc('#f4f1ea'), 0, 0, 16, 16); R(g, c, 2, top ? 2 : 0, 12, top ? 14 : 16); R(g, tint(c, .8), 4, top ? 4 : 0, 8, top ? 4 : 0); if (top) { R(g, pc('#9ec0dc'), 5, 5, 6, 4); } else { R(g, tint(c, .8), 4, 3, 8, 9); R(g, pc('#e8c24a'), 11, 1, 2, 2); } }
tile('doorLo', g => door(g, false)); tile('doorHi', g => door(g, true));
tile('doorLoR', g => door(g, false, pc('#9c3b33'))); tile('doorHiR', g => door(g, true, pc('#9c3b33')));
tile('doorLoB', g => door(g, false, pc('#35557a'))); tile('doorHiB', g => door(g, true, pc('#35557a')));
function gdoor(g, top) { R(g, pc('#2b2d32'), 0, 0, 16, 16); for (let y = 1; y < 16; y++) R(g, mixC(pc('#b5cbe0'), pc('#7093b3'), y / 15), 2, y, 12, 1); R(g, pc('#2b2d32'), 7, 0, 2, 16); if (!top) R(g, pc('#c0c4c9'), 5, 6, 2, 1); }
tile('gdoorLo', g => gdoor(g, false)); tile('gdoorHi', g => gdoor(g, true));
tile('gdoorLoL', g => { gdoor(g, false); glow(2, 1, 5, 15); glow(9, 1, 5, 15); }); tile('gdoorHiL', g => { gdoor(g, true); glow(2, 1, 5, 15); glow(9, 1, 5, 15); });
tile('garage', (g, r) => { R(g, pc('#eeeae1'), 0, 0, 16, 16); for (let y = 3; y < 16; y += 4) R(g, pc('#cfc9bc'), 0, y, 16, 1); R(g, pc('#d9d3c6'), 7, 0, 1, 16); });
tile('vault', (g, r) => { flat(g, r, pc('#8b8f95'), 4, 1); R(g, pc('#b9bdc2'), 3, 3, 10, 10); R(g, pc('#6f7379'), 7, 7, 2, 2); });

// roofs
function shingles(g, r, c) { R(g, c, 0, 0, 16, 16); for (let row = 0; row < 4; row++) { const y = row * 4, off = row % 2 ? 2 : 0; R(g, tint(c, .78), 0, y + 3, 16, 1); for (let x = off; x < 16; x += 4) R(g, tint(c, .85), x, y, 1, 3); for (let x = 0; x < 16; x++) if (r() < .12) R(g, tint(c, 1.12), x, y + 1, 1, 1); } }
for (const [k, c] of Object.entries({ shD: pc('#4c4f58'), shB: pc('#6d4b3b'), shR: pc('#99403a'), shG: pc('#50695a'), shU: pc('#4a6080'), shT: pc('#b8733f') })) tile(k, (g, r) => shingles(g, r, c));
tile('tar', (g, r) => { R(g, pc('#5d5d61'), 0, 0, 16, 16); specks(g, r, [pc('#6c6c70'), pc('#505054'), pc('#7a7a7e')], 40); bevel(g, pc('#5d5d61'), .4); });
tile('membrane', (g, r) => { flat(g, r, pc('#dcdcd6'), 8, .5, .03); R(g, pc('#c9c9c2'), 0, 7, 16, 1); });
tile('tinRoof', (g, r) => ribs(g, r, pc('#9aa1a7')));
tile('cap', (g, r) => { flat(g, r, pc('#d8d2c4'), 4, 1, .02); });  // parapet cap / cornice

// nature
tile('leaves', (g, r) => { R(g, pc('#5ea347'), 0, 0, 16, 16); for (let i = 0; i < 9; i++) { const x = r() * 13 | 0, y = r() * 13 | 0; R(g, pc('#6cb453'), x, y, 3, 2); R(g, pc('#4d8c3b'), x, y + 2, 3, 1); } bevel(g, pc('#5ea347'), .8); });
tile('leavesY', (g, r) => { R(g, pc('#9cb84a'), 0, 0, 16, 16); for (let i = 0; i < 9; i++) { const x = r() * 13 | 0, y = r() * 13 | 0; R(g, pc('#b0c95a'), x, y, 3, 2); R(g, pc('#86a03d'), x, y + 2, 3, 1); } bevel(g, pc('#9cb84a'), .8); });
tile('leavesO', (g, r) => { R(g, pc('#d98f3a'), 0, 0, 16, 16); for (let i = 0; i < 9; i++) { const x = r() * 13 | 0, y = r() * 13 | 0; R(g, pc('#e6a54c'), x, y, 3, 2); R(g, pc('#b8722c'), x, y + 2, 3, 1); } bevel(g, pc('#d98f3a'), .8); });
tile('pine', (g, r) => { R(g, pc('#3d6e45'), 0, 0, 16, 16); for (let i = 0; i < 10; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; R(g, pc('#4a8052'), x, y, 2, 1); R(g, pc('#305a38'), x, y + 1, 2, 1); } bevel(g, pc('#3d6e45'), .8); });
tile('hedge', (g, r) => { R(g, pc('#4f8f40'), 0, 0, 16, 16); specks(g, r, [pc('#5ea04c'), pc('#437a36'), pc('#67ad53')], 60); bevel(g, pc('#4f8f40'), .6); });
tile('bark', (g, r) => { R(g, pc('#6e4c31'), 0, 0, 16, 16); for (let x = 0; x < 16; x++) if (r() < .45) R(g, r() < .6 ? pc('#573b25') : pc('#82603f'), x, 0, 1, 16); });
tile('logEnd', (g, r) => { R(g, pc('#6e4c31'), 0, 0, 16, 16); R(g, pc('#c9a877'), 2, 2, 12, 12); R(g, pc('#a8875a'), 5, 5, 6, 6); R(g, pc('#c9a877'), 7, 7, 2, 2); });
tile('water', (g, r) => { R(g, pc('#4e9fd0'), 0, 0, 16, 16); for (let i = 0; i < 6; i++) R(g, pc('#7cc0e6'), r() * 12 | 0, r() * 16 | 0, 3 + (r() * 3 | 0), 1); });
tile('pool', (g, r) => { R(g, pc('#5fc6e0'), 0, 0, 16, 16); for (let i = 0; i < 6; i++) R(g, pc('#9ee3f2'), r() * 12 | 0, r() * 16 | 0, 3 + (r() * 3 | 0), 1); });
tile('poolTile', (g, r) => { R(g, pc('#e8f3f5'), 0, 0, 16, 16); for (let k = 0; k < 16; k += 4) { R(g, pc('#c2dce2'), k, 0, 1, 16); R(g, pc('#c2dce2'), 0, k, 16, 1); } });

// fences, bars and junk (panes are thin planes; transparent pixels are cut out)
tile('chain', g => { R(g, pc('#9ba1a8'), 0, 0, 16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + y) % 4) && ((x - y + 64) % 4)) cut(x, y, 1, 1); R(g, pc('#7d838a'), 0, 0, 16, 1); });
tile('chainTop', g => { R(g, pc('#9ba1a8'), 0, 0, 16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x + y) % 4) && ((x - y + 64) % 4)) cut(x, y, 1, 1); R(g, pc('#7d838a'), 0, 0, 16, 2); });
tile('razor', (g, r) => { cut(0, 0, 16, 16); for (let k = 0; k < 3; k++) { const cx = 2 + k * 6; for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2, x = Math.round(cx + Math.cos(t) * 3), y = Math.round(9 + Math.sin(t) * 4); if (x >= 0 && x < 16) { cutRects.push([x, y, 1, 1, 'keep']); R(g, pc('#c6cbd1'), x, y, 1, 1); } } } R(g, pc('#80868d'), 0, 15, 16, 1); cutRects.push([0, 15, 16, 1, 'keep']); });
tile('picket', g => { R(g, pc('#f3f0e8'), 0, 0, 16, 16); cut(0, 0, 16, 16); for (let x = 1; x < 16; x += 4) { cutRects.push([x, 3, 2, 13, 'keep']); cutRects.push([x, 2, 2, 1, 'keep']); } cutRects.push([0, 6, 16, 1, 'keep'], [0, 12, 16, 1, 'keep']); R(g, pc('#d9d4c8'), 0, 12, 16, 1); });
tile('woodFence', (g, r) => { R(g, pc('#9a7049'), 0, 0, 16, 16); for (let x = 0; x < 16; x += 4) { R(g, pc('#86603d'), x + 3, 0, 1, 16); R(g, pc('#a97c52'), x, 0, 1, 16); } R(g, pc('#7a5535'), 0, 5, 16, 1); });
tile('slats', (g, r) => { R(g, pc('#3d6a4a'), 0, 0, 16, 16); for (let x = 0; x < 16; x += 2) R(g, pc('#335a3f'), x, 0, 1, 16); R(g, pc('#9ba1a8'), 0, 0, 16, 1); });
tile('bars', g => { cut(0, 0, 16, 16); R(g, pc('#3e4248'), 0, 0, 16, 16); for (let x = 1; x < 16; x += 4) cutRects.push([x, 0, 2, 16, 'keep']); cutRects.push([0, 0, 16, 2, 'keep'], [0, 14, 16, 2, 'keep']); });
tile('rail', g => { cut(0, 0, 16, 16); R(g, pc('#b9bec4'), 0, 0, 16, 16); cutRects.push([0, 5, 16, 4, 'keep'], [7, 9, 2, 7, 'keep']); R(g, pc('#8f959c'), 0, 8, 16, 1); });
tile('scrap', (g, r) => { R(g, pc('#6b6158'), 0, 0, 16, 16); const C = [pc('#9a5a35'), pc('#7d8288'), pc('#b9bdc2'), pc('#3d5f86'), pc('#a33a2f'), pc('#5b5f63'), pc('#c9a33a'), pc('#2d2f33'), pc('#6e8a5c')]; for (let i = 0; i < 14; i++) R(g, C[r() * C.length | 0], r() * 14 | 0, r() * 14 | 0, 2 + (r() * 4 | 0), 1 + (r() * 3 | 0)); bevel(g, pc('#6b6158'), .5); });
tile('tires', (g, r) => { R(g, pc('#2a2a2d'), 0, 0, 16, 16); for (const [x, y] of [[4, 4], [12, 4], [4, 12], [12, 12]]) { R(g, pc('#141416'), x - 3, y - 3, 6, 6); R(g, pc('#3a3a3e'), x - 1, y - 1, 2, 2); } });
tile('crate', (g, r) => { R(g, pc('#b58a55'), 0, 0, 16, 16); for (let y = 0; y < 16; y += 5) R(g, pc('#9a7244'), 0, y, 16, 1); R(g, pc('#8a6438'), 0, 0, 2, 16); R(g, pc('#8a6438'), 14, 0, 2, 16); bevel(g, pc('#b58a55'), 1); });
tile('planks', (g, r) => { R(g, pc('#8f6d4b'), 0, 0, 16, 16); for (let x = 0; x < 16; x += 4) { R(g, pc('#6d5238'), x, 0, 1, 16); R(g, pc('#a07c58'), x + 1, 0, 1, 16); } for (let i = 0; i < 4; i++) R(g, pc('#5b4430'), (r() * 4 | 0) * 4 + 2, r() * 16 | 0, 1, 1); });
tile('barrier', (g, r) => { flat(g, r, pc('#cbc8bf'), 8, .8, .03); R(g, pc('#b3afa5'), 0, 11, 16, 1); });
tile('bollardY', (g, r) => flat(g, r, pc('#e9bd3a'), 4, 1));
tile('felt', (g, r) => flat(g, r, pc('#39404a'), 6, .5, .03));
tile('rubber', (g, r) => flat(g, r, pc('#2e3136'), 6, .5, .03));
tile('carpetR', (g, r) => flat(g, r, pc('#8e2f33'), 8, .4, .04));

// plain colours for props (their colour comes from vertex colours) and a few solid paints
// scars: fire, boards, police tape
tile('char', (g, r) => { R(g, pc('#2b2524'), 0, 0, 16, 16); specks(g, r, [pc('#3a302c'), pc('#1d1918'), pc('#4a3a32')], 60); for (let i = 0; i < 3; i++) R(g, pc('#e0642a'), r() * 16 | 0, r() * 16 | 0, 1, 1); });
tile('charWin', (g, r) => { R(g, pc('#2b2524'), 0, 0, 16, 16); R(g, pc('#0d0b0b'), 2, 2, 12, 12); R(g, pc('#3a302c'), 2, 2, 12, 2); for (let i = 0; i < 5; i++) R(g, pc('#1d1918'), 2 + (r() * 12 | 0), 0, 1, 3); });
tile('ash', (g, r) => { R(g, pc('#57504c'), 0, 0, 16, 16); specks(g, r, [pc('#403a37'), pc('#6d6560'), pc('#2f2a28')], 70); });
tile('tape', g => { cut(0, 0, 16, 16); R(g, pc('#f0c330'), 0, 0, 16, 16); for (let x = 0; x < 16; x += 6) R(g, pc('#1d1d1f'), x, 7, 3, 2); cutRects.push([0, 6, 16, 4, 'keep']); });
tile('white', g => R(g, pc('#ffffff'), 0, 0, 16, 16));
tile('whiteGlow', g => { R(g, pc('#ffffff'), 0, 0, 16, 16); glow(0, 0, 16, 16, 161); });
tile('black', (g, r) => flat(g, r, pc('#1c1d21'), 4, .6, .05));
tile('neonBlk', (g, r) => flat(g, r, pc('#16151c'), 4, .4, .05));
tile('paintBlue', (g, r) => flat(g, r, pc('#2f5b9a'), 4, .8, .03));
tile('paintRed', (g, r) => flat(g, r, pc('#c0392f'), 4, .8, .03));
tile('paintWhite', (g, r) => flat(g, r, pc('#f1efe9'), 4, .8, .02));
tile('paintGreen', (g, r) => flat(g, r, pc('#2f7a4a'), 4, .8, .03));
tile('lampGlow', g => { R(g, pc('#fff4cf'), 0, 0, 16, 16); glow(0, 0, 16, 16, 161); });

export const NT = LIST.length;
export function buildTileArray() {
  const data = new Uint8Array(16 * 16 * 4 * NT), c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d', { willReadFrequently: true });
  LIST.forEach(([, fn], i) => { g.clearRect(0, 0, 16, 16); glowRects.length = 0; cutRects.length = 0; fn(g, mulberry32(101 + i * 31));
    const d = g.getImageData(0, 0, 16, 16).data;
    if (cutRects.length) { const keep = new Uint8Array(256); let any = false; for (const [x, y, w, h, k] of cutRects) if (k === 'keep') { any = true; for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && xx < 16 && yy >= 0 && yy < 16) keep[yy * 16 + xx] = 1; }
      for (const [x, y, w, h, k] of cutRects) if (k !== 'keep') for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!keep[yy * 16 + xx] || !any) d[(yy * 16 + xx) * 4 + 3] = 0; }
    for (const [x, y, w, h, a] of glowRects) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (d[(yy * 16 + xx) * 4 + 3]) d[(yy * 16 + xx) * 4 + 3] = a;
    for (let y = 0; y < 16; y++) data.set(d.subarray((15 - y) * 64, (16 - y) * 64), i * 1024 + y * 64); });   // flip: canvas top = face top / north
  const t = new THREE.DataArrayTexture(data, 16, 16, NT); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.premultiplyAlpha = false; t.needsUpdate = true; return t;
}

// ───────────────────────── blocks: {top, side, bottom} tiles + flags
const T = TILES;
export const BLOCKS = [null], CUT = new Uint8Array(512), PANE = new Uint8Array(512), LIQ = new Uint8Array(512);
function block(t, s = t, b = s, o = {}) { BLOCKS.push({ t, s, b }); const id = BLOCKS.length - 1; if (o.cut) CUT[id] = 1; if (o.pane) PANE[id] = o.pane; if (o.liq) LIQ[id] = 1; return id; }
const pane = (t, axis) => block(t, t, t, { cut: 1, pane: axis });   // axis 1: plane runs along x · 2: along z
export const B = {};
const def = (name, ...a) => { B[name] = block(...a); };
def('GRASS', T.grass, T.grassSide, T.dirt); def('DIRT', T.dirt); def('MUD', T.mud); def('GRAVEL', T.gravel); def('SAND', T.sand); def('ROCK', T.rock);
def('ASPH', T.asph); def('ASPHOLD', T.asphOld);
for (const k of ['asphYR', 'asphYL', 'asphYT', 'asphYB', 'asphWR', 'asphWL', 'asphWT', 'asphWB', 'zebraZ', 'zebraX']) def(k.toUpperCase(), T[k], T.asph);
def('WALK', T.walk, T.concrete); def('PAVER', T.paver, T.concrete); def('PAVERRED', T.paverRed, T.concrete); def('CONC', T.concrete); def('CONCDK', T.concreteDk); def('STAIN', T.stain, T.concreteDk);
def('COURT', T.court, T.concrete); def('COURTLINE', T.courtLine, T.concrete); def('TRACK', T.track, T.dirt); def('MULCH', T.mulch, T.dirt);
for (const k of ['brickRed', 'brickBrown', 'brickTan', 'brickWhite', 'brickDark', 'brickYellow', 'sidW', 'sidB', 'sidY', 'sidG', 'sidP', 'sidV', 'sidS', 'sidR', 'sidT', 'trimW', 'stucco', 'stuccoPink', 'stuccoMint', 'ashlar', 'marble', 'gold', 'cwall', 'jailWall', 'jailStripe',
  'metal', 'metalBlue', 'metalGreen', 'metalCream', 'metalRust', 'trailerW', 'trailerY', 'trailerB', 'trailerG', 'trailerTan', 'contR', 'contB', 'contG', 'contO', 'contY', 'contW', 'rollDoor', 'hazard', 'steelY', 'steelR', 'steelG', 'steelB',
  'copper', 'glassB', 'glassBL', 'glassBS', 'glassT', 'glassTL', 'glassTS', 'glassK', 'glassKL', 'glassKS', 'glassG', 'glassGL', 'glassGS', 'band', 'bandL', 'bandW', 'bandWL', 'slit', 'slitL', 'garage', 'vault', 'scrap', 'tires', 'crate', 'barrier', 'bollardY', 'hedge', 'black', 'neonBlk', 'paintBlue', 'paintRed', 'paintWhite', 'paintGreen', 'cap', 'felt', 'rubber', 'carpetR'])
  def(k.toUpperCase(), T[k]);
// windows and doors carry the wall's cap tile on top/bottom so they sit flush in any wall
for (const k of ['win', 'winL', 'winD', 'winDL', 'winS', 'winSL', 'winBoard', 'winFoil', 'shop', 'shopL', 'shopW', 'shopWL', 'doorLo', 'doorHi', 'doorLoR', 'doorHiR', 'doorLoB', 'doorHiB', 'gdoorLo', 'gdoorHi', 'gdoorLoL', 'gdoorHiL']) def(k.toUpperCase(), T.cap, T[k], T.cap);
for (const k of ['shD', 'shB', 'shR', 'shG', 'shU', 'shT']) def(k.toUpperCase(), T[k], T[k], T.planks);
def('TAR', T.tar, T.cap, T.cap); def('MEMBRANE', T.membrane, T.cap, T.cap); def('TINROOF', T.tinRoof);
def('LEAVES', T.leaves); def('LEAVESY', T.leavesY); def('LEAVESO', T.leavesO); def('PINE', T.pine); def('BARK', T.logEnd, T.bark, T.logEnd);
def('WATER', T.water, T.water, T.water, { liq: 1 }); def('POOL', T.pool, T.poolTile, T.poolTile, { liq: 1 }); def('POOLTILE', T.poolTile);
def('PLANKS', T.planks); def('WOODFENCE', T.woodFence, T.woodFence, T.woodFence);
def('WHITE', T.white); def('WHITEGLOW', T.whiteGlow); def('LAMPGLOW', T.lampGlow);
for (const [k, t] of [['CHAIN', T.chain], ['CHAINTOP', T.chainTop], ['RAZOR', T.razor], ['PICKET', T.picket], ['BARS', T.bars], ['RAIL', T.rail], ['SLATS', T.slats], ['WFENCE', T.woodFence], ['TAPE', T.tape]]) { B[k + 'X'] = pane(t, 1); B[k + 'Z'] = pane(t, 2); }
def('CHAR', T.char); def('CHARWIN', T.char, T.charWin, T.char); def('ASH', T.ash, T.dirt);
export const PROP_LAYER = T.white, PROP_GLOW = T.whiteGlow;

// ───────────────────────── wall materials (what blueprints name)
export const MAT = {
  vinyl: { wall: B.SIDV, trim: B.TRIMW, win: [B.WIN, B.WINL] }, wood: { wall: B.SIDW, trim: B.TRIMW, win: [B.WIN, B.WINL] },
  blue: { wall: B.SIDB, trim: B.TRIMW, win: [B.WIN, B.WINL] }, yellow: { wall: B.SIDY, trim: B.TRIMW, win: [B.WIN, B.WINL] },
  mint: { wall: B.SIDG, trim: B.TRIMW, win: [B.WIN, B.WINL] }, pink: { wall: B.SIDP, trim: B.TRIMW, win: [B.WIN, B.WINL] },
  slate: { wall: B.SIDS, trim: B.TRIMW, win: [B.WIN, B.WINL] }, barn: { wall: B.SIDR, trim: B.TRIMW, win: [B.WIN, B.WINL] }, teal: { wall: B.SIDT, trim: B.TRIMW, win: [B.WIN, B.WINL] },
  brick: { wall: B.BRICKRED, trim: B.CAP, win: [B.WINS, B.WINSL] }, brownbrick: { wall: B.BRICKBROWN, trim: B.CAP, win: [B.WINS, B.WINSL] },
  tanbrick: { wall: B.BRICKTAN, trim: B.CAP, win: [B.WINS, B.WINSL] }, whitebrick: { wall: B.BRICKWHITE, trim: B.CAP, win: [B.WIN, B.WINL] },
  stucco: { wall: B.STUCCO, trim: B.TRIMW, win: [B.WIN, B.WINL] }, pinkstucco: { wall: B.STUCCOPINK, trim: B.TRIMW, win: [B.WIN, B.WINL] },
  stone: { wall: B.ASHLAR, trim: B.CAP, win: [B.WINS, B.WINSL] }, glass: { wall: B.GLASSK, trim: B.CONC, win: [B.GLASSK, B.GLASSKL], modern: true },
  marble: { wall: B.MARBLE, trim: B.GOLD, win: [B.WIND, B.WINDL] }, concrete: { wall: B.CWALL, trim: B.CONC, win: [B.WIN, B.WINL] },
};
// the v1 sim's material names (value ladder 1·1·2·5·12·40) mapped onto real ones with the same ladder
export const LEGACY_MAT = { dialog: 'vinyl', white: 'wood', teal: 'brick', bsod: 'stone', chrome: 'glass', gold: 'marble' };

// ───────────────────────── 5×7 pixel font for signs (rows as 5-bit hex pairs)
const GLYPH = { A: '0E11111F111111', B: '1E11111E11111E', C: '0E11101010110E', D: '1E11111111111E', E: '1F10101E10101F', F: '1F10101E101010', G: '0E11101711110F', H: '1111111F111111', I: '0E04040404040E', J: '0702020202120C',
  K: '11121418141211', L: '1010101010101F', M: '111B1515111111', N: '11111915131111', O: '0E11111111110E', P: '1E11111E101010', Q: '0E11111115120D', R: '1E11111E141211', S: '0F10100E01011E', T: '1F040404040404',
  U: '1111111111110E', V: '11111111110A04', W: '1111111515150A', X: '11110A040A1111', Y: '11110A04040404', Z: '1F01020408101F',
  0: '0E11131519110E', 1: '040C040404040E', 2: '0E11010204081F', 3: '1F02040201110E', 4: '02060A121F0202', 5: '1F101E0101110E', 6: '0608101E11110E', 7: '1F010204080808', 8: '0E11110E11110E', 9: '0E11110F01020C',
  ' ': '00000000000000', '.': '00000000000C0C', ',': '000000000C0408', '!': '04040404040004', '?': '0E110102040004', '-': '0000001F000000', '/': '01010204081010', '&': '0C12140815120D', '$': '040F140E051E04',
  "'": '04040800000000', ':': '000C0C000C0C00', '#': '0A0A1F0A1F0A0A', '+': '0004041F040400', '@': '0E11171517100F', '*': '0004150E150400', '%': '18190204081303' };
export function textWidth(s) { return s.length * 6 - 1; }
export function drawText(g, s, x, y, col, scale = 1) { g.fillStyle = col; for (const ch of s.toUpperCase()) { const gl = GLYPH[ch] || GLYPH['?']; for (let row = 0; row < 7; row++) { const bits = parseInt(gl.substr(row * 2, 2), 16); for (let b = 0; b < 5; b++) if (bits & (16 >> b)) g.fillRect(x + b * scale, y + row * scale, scale, scale); } x += 6 * scale; } }
