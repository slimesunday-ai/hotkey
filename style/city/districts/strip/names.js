// NEON ROW · the sign voice, dealt per block (owner: the Neon Row agent). A real NYC night strip in a crime world: bars and clubs,
// karaoke, the arcade, pawn and cash for gold, OTB and the sports book, liquor, the 24-hour diner, chicken spots, hookah, check
// cashing, bail bonds, car service. Invented names only, no real brands, internet nostalgia at most a rare wink.
// EVERY NAME APPEARS ONCE IN THE DISTRICT: each block draws only from its own list (fill.js assigns them in lot order, never twice),
// and the hero signs (HERO) and the market stalls (STALLS) are listed here too so the check below covers them. One giant shop object
// per block, each a different kind (tooth, cup, key, eye).
// [name, sign colour, window display, giant object?]
const G = 0x14a83b, R = 0xe8232a, Y = 0xffe23a, L = 0x6cff4a, C = 0x2de2e6, K = 0xff4fa3, I = 0x17171b, B = 0x2f5bff, O = 0xff7a1a, V = 0x7a3cff;

export const NAMES = {
  // Jay St west, Washington, Ivy, Lincoln: the market side — late food, dive bars, the psychic upstairs
  '-2_1': {
    shops: [['LAST CALL', V, 'bottles'], ['HOT BOX CHICKEN', R, 'food'], ['PATTY SHACK', Y, 'food'], ['THE DRUNK TANK', B, 'bottles'], ['GOLD GRILLZ', Y, 'gold', 'tooth'],
      ['CHECK CASHING', G, 'office'], ['CAR SERVICE', Y, 'office'], ['RAMEN 24', C, 'food'], ['SMOKE SPOT', L, 'misc'], ['NIGHTCAP', K, 'bottles'], ['EMPANADAS', O, 'food'],
      ['WASH 24', C, 'machines'], ['JERK HUT', G, 'food'], ['BAR 13', R, 'bottles'], ['PHONE REPAIR', B, 'phones'], ['INK & NEEDLE', I, 'misc'], ['PHO 99', G, 'food'], ['GYRO', O, 'food'],
      ['SIDE DOOR', V, 'bottles'], ['$1 DUMPLING', Y, 'food']],
    delis: ['MOONLIGHT DELI'],
    plaques: ['THE DELPHINE', 'ORCHARD ARMS', 'THE MARLOWE', 'VESPER HALL'],
  },
  // Jay St east, Washington, Main, Lincoln: the club side — the corner deli, liquor, bail, hookah, the arcade
  '-1_1': {
    shops: [['BACK ROOM', V, 'bottles'], ['THE STING', R, 'bottles'], ['WING SPOT', O, 'food'], ['LIQUOR 24', V, 'bottles'], ['FREEDOM BAIL', B, 'office'],
      ['CLOUD 9 HOOKAH', C, 'misc'], ['TOKEN ARCADE', C, 'misc'], ['TAQUERIA', G, 'food'], ['JOLT CAFE', I, 'food', 'cup'], ['BURNERS', I, 'phones'], ['BBQ 24', R, 'food'],
      ['VAPE', L, 'misc'], ['DIVE', K, 'bottles'], ['PREPAID PLUS', B, 'phones'], ['LOTTO', Y, 'misc'], ['LATE NAILS', K, 'misc'], ['BOOKED', R, 'bottles'], ['CURRY', O, 'food'],
      ['HAPPY HOUR', Y, 'bottles'], ['POUR HOUSE', G, 'bottles']],
    delis: ['24 HR DELI & GRILL'],
    plaques: ['THE LORRAINE', 'MONARCH ARMS', 'THE FAIRMOUNT', 'THE ESTELLA'],
  },
  // Maple, Washington, Bishop, Lincoln: the diner corner — the sports book, the pool hall, the social club
  '3_1': {
    shops: [['OTB · RACES', G, 'office'], ['SPORTS BOOK', R, 'office'], ['POOL HALL', G, 'misc'], ['LIQUOR & WINE', R, 'bottles'], ['HALAL NITE', Y, 'food'],
      ['CHICKEN & RICE', O, 'food'], ['LOCKSMITH 24', Y, 'misc', 'key'], ['CASH ADVANCE', G, 'office'], ['SOCIAL CLUB', I, 'misc'], ['NUMBERS', Y, 'misc'], ['THE STAKEOUT', V, 'bottles'],
      ['TEQUILA', L, 'bottles'], ['LUCKY WOK', R, 'food'], ['BEEPERS', C, 'phones'], ['WIG SHOP', K, 'clothes'], ['FADE CITY', G, 'barber'], ['SPIRITS', V, 'bottles'], ['TACOS 24', O, 'food'],
      ['RAP SHEET', R, 'bottles'], ['KEYS CUT', Y, 'misc']],
    delis: ['NITE & DAY DELI'],
    plaques: ['THE CARMINE', 'HALSEY COURT', 'THE ROSALIND', 'BRIGHTON ARMS'],
  },
  // Elm, 2nd, Grand, 1st: the pawn corner — the bondsman, money orders, the palm reader, the rum shop
  '-5_-2': {
    shops: [['SHOT & A BEER', Y, 'bottles'], ['THE GETAWAY', R, 'bottles'], ['KATI ROLL', O, 'food'], ['HERO SHOP', R, 'food'], ['MONEY ORDERS', G, 'office'], ['BONDSMAN', B, 'office'],
      ['PIERCING', I, 'misc'], ['FRIED FISH', Y, 'food'], ['ROTI', G, 'food'], ['SPEAKEASY', V, 'bottles'], ['WINGS & THINGS', O, 'food'], ['PALM READER', K, 'misc', 'eye'],
      ['CALLING CARDS', B, 'phones'], ['CIGARS', I, 'misc'], ['RUM SHOP', Y, 'bottles'], ['BODEGA CATS', G, 'misc'], ['THE TAB', V, 'bottles'], ['SUBS', R, 'food'],
      ['DOMINOES', K, 'misc'], ['WASH & FOLD', C, 'machines']],
    delis: ['GRAND DELI'],
    plaques: ['THE WINSLOW', 'CLINTON ARMS', 'THE BERNADETTE', 'LENORE HALL'],
  },
};
// the hand-made signs (heroes/strip-*.js)
export const HERO = ['JAY ST NIGHT MARKET', 'SING SING', 'KARAOKE', 'NO WITNESS', 'VIP', 'DJ', 'GRAVEYARD SHIFT', 'OPEN 24 HRS', 'DINER', 'HONEST PAWN', 'CASH 4 GOLD', 'LOANS · GOLD', 'HOT DOGS', 'TAROT', 'HOTEL'];
// the night market's stalls (one sign each, never twice)
export const STALLS = ['BAO', 'SKEWERS', 'MANGO', 'BOBA', 'DVDS', 'REPLICA', 'SHADES', 'CHAINS'];   // (half-grain boards: ≤ 7 letters fit a 2.4 m tarp)

// the blade word (gen.js hangs a vertical blade with a name's first word, cut to five letters): a shop gets a blade only where
// that word reads whole and no other shop in the district would hang the same word
export const bladeWord = name => (name.split(' ').find(w => w.length > 1 && w !== 'THE') || name);
export const BLADES = (() => { const seen = new Set(), ok = new Set(); for (const v of Object.values(NAMES)) for (const [n] of v.shops) { const w = bladeWord(n); if (w.length <= 5 && !seen.has(w)) ok.add(n); seen.add(w); } return ok; })();
// every sign of the district, once: throws on a repeat (fill.js runs it when the module loads, so a repeat is a module error, not a
// silent duplicate on the street)
export function checkUnique() {
  const seen = new Map(), dup = [];
  const add = (s, where) => { const k = s.toUpperCase(); if (seen.has(k)) dup.push(`${s} (${seen.get(k)} and ${where})`); else seen.set(k, where); };
  for (const [k, v] of Object.entries(NAMES)) { v.shops.forEach(s => add(s[0], k)); v.delis.forEach(s => add(s, k)); v.plaques.forEach(s => add(s, k)); }
  HERO.forEach(s => add(s, 'hero')); STALLS.forEach(s => add(s, 'stall'));
  const objs = Object.entries(NAMES).map(([k, v]) => v.shops.filter(s => s[3]).map(s => s[3])); const flat = objs.flat();
  if (new Set(flat).size !== flat.length) dup.push('giant objects repeat: ' + flat.join(', '));
  if (dup.length) throw new Error('Neon Row signs repeat: ' + dup.join('; '));
  return seen.size;
}
