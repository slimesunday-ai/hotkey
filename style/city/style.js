// Springfield Street style constants — the single source STYLE.md describes.
export const CV = 0.1;                  // city voxel = 2 × S
export const SIDE = 0.2;                // curb / sidewalk height
export const STOREY = 3.0, SHOP = 3.6;  // floor-to-floor, shop ground floor
export const PAL = {
  sky: 0x2f9bff, horizon: 0x9fdcff, nightTop: 0x0b1240, nightHor: 0x3b2a7a,
  asphalt: 0x5d5e6b, patch: 0x52535f, lineW: 0xf4f3ee, lineY: 0xffc41f, walk: 0xcdc5b8, joint: 0xb9b0a2, curbTop: 0xece8df, curbFace: 0xb7b0a3, lot: 0xa99f90, yard: 0x7fae5a,
  cream: 0xfff0d0, white: 0xf7f7f2, ink: 0x17171b, iron: 0x1d1d24, roof: 0xa9a7ad, roofB: 0x9c9aa2,
  glassLo: 0x1b2a55, glassHi: 0x3f6bc4, glint: 0xeaf6ff, litLo: 0xffc766, litHi: 0xffe3a0, wood: 0xa4652f, woodD: 0x6e3e19,
  green: 0x14a83b, red: 0xe8232a, yellow: 0xffe23a, lime: 0x6cff4a, cyan: 0x2de2e6, pink: 0xff4fa3, gold: 0xe7bd4a, lamp: 0x1f5c4a,
};
// wall colours: one per building, never repeated on neighbours
export const WALLS = [0xffc21a, 0xef4a2a, 0xff4fa3, 0x7a3cff, 0xff7a1a, 0x25b84c, 0x3fa9f5, 0x2f5bff, 0x12b3a0, 0x8c52ff, 0xe83b5b, 0xff8a1f];
export const SIGNS = [0x14a83b, 0xe8232a, 0xffe23a, 0x6cff4a, 0x2de2e6, 0xff4fa3, 0x17171b, 0x2f5bff];
export const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const shade = (c, f) => { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
export const rng = seed => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
// invented shop names (the game's voice) + their sign colours
export const SHOPS = [['NAILS 4 U', 0xff4fa3], ['WOK N ROLL', 0xe8232a], ['PAWN · GOLD', 0xffe23a], ['LAUNDROMAT', 0x2de2e6], ['PHONE FIX', 0x2f5bff], ['BARBER', 0x14a83b],
  ['99¢ DREAMS', 0xff7a1a], ['TATTOO', 0x17171b], ['BAGELS', 0xffe23a], ['CHECKS CASHED', 0x14a83b], ['LIQUORS', 0x7a3cff], ['VAPE 404', 0x2de2e6], ['DIAL-UP CAFE', 0xff4fa3],
  ['SNEAKS', 0x17171b], ['GOLD TEETH', 0xffe23a], ['BAIL BONDS', 0xe8232a], ['DRY CLEAN', 0x2de2e6], ['PIZZA 2GO', 0xe8232a], ['CELL CITY', 0x2f5bff], ['KEYS MADE', 0x14a83b],
  ['DONUTS', 0xff4fa3], ['OPTICAL', 0x2f5bff], ['DENTIST', 0x2de2e6], ['COFFEE', 0x17171b], ['BURGERS', 0xe8232a]];
export const CORPS = ['56K TELECOM', 'BSOD BANK', 'NULL & VOID', 'DIALUP TRUST', 'CURSOR CO', 'GLASSWALL', 'MODEM MUTUAL', 'PING GROUP', 'BYTE CAPITAL', 'TRASH BIN INC'];
export const DELIS = ['404 DELI & GROCERY', 'NITE OWL DELI', 'LUCKY 56 DELI', 'CHOP CHEESE DELI', 'PAPI 404 DELI', 'CORNER 24 DELI', 'BYTE DELI & GRILL'];
