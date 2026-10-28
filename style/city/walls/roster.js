// WALLS · the roster and the words (owner: the walls agent). Everything is invented: no real writers, brands, people or places.
// Writers are people, never crews: no crew names, no "CREW", no crossed-out tags, no territory markers (turf visuals are deferred,
// STYLE §11). Nothing here may match the sim's crews or the cast's handles (chars.js LOOKS).
const C = { red: 0xe8232a, pink: 0xff4fa3, yellow: 0xffe23a, lime: 0x6cff4a, cyan: 0x2de2e6, blue: 0x2f5bff, violet: 0x7a3cff, orange: 0xff7a1a,
  green: 0x14a83b, white: 0xf7f7f2, ink: 0x17171b, chrome: 0xc9ced6, gold: 0xe7bd4a, cream: 0xfff0d0, teal: 0x12b3a0, sky: 0x3fa9f5, maroon: 0x8a1a2a };
export const COL = C;

// ── the writers: whose name keeps turning up. A writer has a hand (the tag colour), a throw-up (fill · outline · shadow), a home
// (the districts they bomb most: tags cluster the way a real writer's do) and a weight (how often they turn up). `heaven`: climbs.
export const WRITERS = [
  { name: 'DUSKO', tag: C.ink, fill: C.chrome, out: C.ink, shadow: C.blue, home: ['industrial', 'docks'], w: 3, heaven: true },
  { name: 'PLUMZ', tag: C.violet, fill: C.violet, out: C.ink, shadow: C.pink, home: ['strip', 'downtown'], w: 3 },
  { name: 'ZOOT', tag: C.red, fill: C.yellow, out: C.red, shadow: C.ink, home: ['junkyard', 'trailer'], w: 3 },
  { name: 'KRAYL', tag: C.ink, fill: C.lime, out: C.ink, shadow: C.violet, home: ['industrial'], w: 2 },
  { name: 'BOGS', tag: C.blue, fill: C.orange, out: C.ink, shadow: C.blue, home: ['docks'], w: 2 },
  { name: 'NERV', tag: C.cyan, fill: C.cyan, out: C.blue, shadow: C.ink, home: ['strip'], w: 2, heaven: true },
  { name: 'OKRA', tag: C.green, fill: C.green, out: C.ink, shadow: C.yellow, home: ['trailer', 'mall'], w: 2 },
  { name: 'WAXO', tag: C.pink, fill: C.pink, out: C.ink, shadow: C.cyan, home: ['strip', 'mall'], w: 2 },
  { name: 'SLOE', tag: C.maroon, fill: C.white, out: C.red, shadow: C.ink, home: ['downtown', 'hospital'], w: 2 },
  { name: 'YENZ', tag: C.red, fill: C.red, out: C.ink, shadow: C.yellow, home: ['junkyard'], w: 2 },
  { name: 'FUMO', tag: C.ink, fill: C.chrome, out: C.red, shadow: C.ink, home: ['docks', 'industrial'], w: 2, heaven: true },
  { name: 'VEXO', tag: C.violet, fill: C.yellow, out: C.violet, shadow: C.ink, home: ['mall'], w: 2 },
  { name: 'KILN', tag: C.orange, fill: C.orange, out: C.blue, shadow: C.ink, home: ['industrial'], w: 2 },
  { name: 'DREG', tag: C.ink, fill: C.lime, out: C.violet, shadow: C.ink, home: ['junkyard'], w: 2 },
  { name: 'RUMBO', tag: C.blue, fill: C.pink, out: C.blue, shadow: C.ink, home: ['trailer'], w: 2 },
  { name: 'TOFU', tag: C.ink, fill: C.white, out: C.ink, shadow: C.pink, home: ['downtown', 'strip'], w: 2 },
  { name: 'BLINKO', tag: C.cyan, fill: C.cyan, out: C.ink, shadow: C.pink, home: ['strip'], w: 1 },
  { name: 'GRITS', tag: C.ink, fill: C.gold, out: C.ink, shadow: C.red, home: ['docks'], w: 2 },
  { name: 'MOTH', tag: C.violet, fill: C.white, out: C.violet, shadow: C.ink, home: ['highway', 'trailer'], w: 2, heaven: true },
  { name: 'JUMBO', tag: C.blue, fill: C.yellow, out: C.blue, shadow: C.ink, home: ['mall', 'junkyard'], w: 2 },
  { name: 'SNOB', tag: C.ink, fill: C.chrome, out: C.pink, shadow: C.ink, home: ['downtown'], w: 2, heaven: true },
  { name: 'PESTO', tag: C.green, fill: C.green, out: C.yellow, shadow: C.ink, home: ['industrial', 'docks'], w: 2 },
  { name: 'KOI', tag: C.orange, fill: C.orange, out: C.ink, shadow: C.white, home: ['strip', 'docks'], w: 1 },
  { name: 'AFK', tag: C.white, fill: C.white, out: C.ink, shadow: C.cyan, home: [], w: .4, heaven: true },   // the one wink: always away, always on a roof
];
// full-piece colourways: [fill bands top → bottom], 3D block, outline, cloud behind
export const WAYS = [
  { key: 'SUNSET', fill: [C.yellow, C.orange, C.red], d3: C.violet, out: C.ink, bg: [C.cyan, C.white] },
  { key: 'TOXIC', fill: [C.lime, C.green, C.teal], d3: C.ink, out: C.violet, bg: [C.pink, C.white] },
  { key: 'ICE', fill: [C.white, C.cyan, C.blue], d3: C.violet, out: C.ink, bg: [C.pink, C.yellow] },
  { key: 'CANDY', fill: [C.pink, C.white, C.pink], d3: C.red, out: C.ink, bg: [C.yellow, C.lime] },
  { key: 'FIRE', fill: [C.yellow, C.red, C.maroon], d3: C.ink, out: C.ink, bg: [C.orange, C.yellow] },
  { key: 'CHROME', fill: [C.white, C.chrome, 0x9aa0aa], d3: C.ink, out: C.ink, bg: [C.blue, C.cyan] },
  { key: 'GRAPE', fill: [C.pink, C.violet, C.blue], d3: C.ink, out: C.ink, bg: [C.lime, C.yellow] },
  { key: 'GOLD', fill: [C.yellow, C.gold, C.orange], d3: C.maroon, out: C.ink, bg: [C.teal, C.cyan] },
];

// ── memorial walls: a nickname, a full name, the years
export const RIP_NICK = ['MANNY', 'TITO', 'KEISHA', 'JUNIOR', 'BIG LOU', 'NENA', 'RICKY', 'SHAWNA', 'PAPO', 'LIL RAY', 'MARISOL', 'TYRELL', 'CHINO',
  'YOLI', 'DARNELL', 'BEBE', 'NANDO', 'TASHA', 'KIKI', 'MOOKIE', 'DOLORES', 'ANGEL', 'PRECIOUS', 'CURTIS', 'LUZ', 'OMAR', 'GINA', 'DUKE', 'SONNY', 'PEACHES'];
export const RIP_LAST = ['RAMOS', 'OKAFOR', 'DELGADO', 'CRUZ', 'PARK', 'SANTIAGO', 'NGUYEN', 'BROOKS', 'VARGAS', 'MORETTI', 'FIGUEROA', 'BAPTISTE', 'RIVERA', 'OYELARAN', 'KOWALSKI', 'LAMONT'];
export const RIP_LINE = ['GONE NOT FORGOTTEN', 'LOVE YOU ALWAYS', 'THE BLOCK MISSES YOU', 'REST EASY', 'FLY HIGH', 'ALWAYS WITH US', 'SAY HI TO MOM', 'ONE LOVE'];

// ── the ring and the court
export const FIGHTERS = ['KID CASSETTE', 'SUGAR DEE', 'BIG TONE', 'LIL HAMMER', 'MAMI FUEGO', 'IRON LUNG', 'DOC SLAPS', 'BABY BULL', 'SWEET POTATO', 'KID NICKELS', 'LADY LEFTY', 'TOMMY TEETH', 'NO NECK NUNEZ', 'SLIM PICKENS JR', 'DOLLAR BILL'];
export const RING = ['CHAMP', 'HOMETOWN HERO', 'UNDISPUTED', 'NEVER DOWN', 'OUR CHAMP', 'MAIN EVENT', 'STILL STANDING'];
export const COURTS = ['THE PIT', 'SKY COURT', 'CAGE 9', 'THE KITCHEN', 'CHAIN NETS', 'BLACKTOP', "HEAVEN'S CAGE", 'THE SLAB', 'DOUBLE RIMS'];
export const HOOP = ['WINNERS STAY', 'NEXT!', 'RUN IT BACK', 'NO BLOOD NO FOUL', 'CALL YOUR OWN', 'KING OF THE COURT', 'LIGHTS OUT'];

// ── collector culture (a small share, like the signage caps): grails in slabs
export const COLLECT = ['GRAIL SEASON', 'MINT CONDITION', 'SLABBED', '1 OF 1', 'CHASE CARD', 'HOLO RARE', 'PULL OR PASS', 'SEALED ONLY', 'NO LOWBALLS', 'GEM MINT'];

// ── the art scene: invented painters' signatures
export const ARTISTS = ['M. OKAFOR', 'NINA VELEZ', 'TOMI K.', 'JULES ARDEN', 'OSCAR MBALA', 'PIA LUND', 'DEV SARIN', 'HANNA ROOK', 'LOLA QUINN', 'REX DUARTE'];

// ── neighbourhood murals: what the block says about itself (district kit name → lines)
export const HOOD = {
  junkyard: ['THE HEAP', 'NOTHING WASTED', 'SALVAGE SAINTS', 'HEAP LIFE', 'EVERYTHING HAS A PRICE'],
  industrial: ['THE YARDS', 'FOUNDRY PROUD', 'SHIFT CHANGE', 'IRON & STEAM', 'BUILT BY HAND'],
  docks: ['LOW TIDE', 'HARBOR STRONG', 'SALT & DIESEL', 'THE TIDE WAITS', 'DOCK SHIFT'],
  strip: ['NEON ROW', 'AFTER HOURS', 'OPEN TIL DAWN', 'NIGHT SHIFT', 'LIGHTS ON'],
  trailer: ['SUNNY ACRES', 'HOME ON WHEELS', 'ACRES FOREVER', 'SWAP MEET SUNDAYS', 'PAD 54 & PROUD'],
  downtown: ['GLASSWALL', 'STAY LUCKY', 'EAST OF CENTRAL', 'CITY OF HUSTLE', 'KENT ST FOREVER'],
  mall: ['MILLENNIUM', 'FOOD COURT FOREVER', 'LAST SALE', 'ESCALATOR TO NOWHERE', 'FREE PARKING'],
  hospital: ['ST. MERCY', 'GET WELL', 'HEAL THE BLOCK', 'NIGHT NURSES'],
  highway: ['ROUTE 9', 'NEXT EXIT', 'DRIVE SAFE', 'LAST GAS'],
  suburbs: ['READ DREAM GROW', 'PLAY LEARN SHINE', 'P.S. 280 ROCKS'],
  estates: ['GATEHILL'],
};
// the hand-painted ad trade: who painted the wall (the credit in the corner)
export const PAINTERS = ['CARUSO SIGN CO.', 'ACME WALLDOGS', 'HI-LINE ADS', 'SKYWALL PAINTERS', 'BROS. SIGNS', 'DUTCH & SON'];
