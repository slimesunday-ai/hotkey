// SIGNAGE · LEXICON v2 (owner: the signage agent). The city's voice: a crime city mixed with NYC, bodegas, Hypebeast, Dazed and
// collector culture. Everything is invented: no real brands, people or trademarks. Phone numbers stay in the fictional 555-01xx range.
//
// Two kinds of data live here:
//  1. The generator's lists (core lexicon.js re-exports them): SHOPS, DELIS, CORPS, PLAQUES, TAGS, BOARDS, GHOSTS, ADS, BILLBOARDS.
//     gen.js deals them per block from its seeded rng, and a deck consumes one draw per entry, so EVERY LIST KEEPS ITS PASS-2 LENGTH
//     and its entries stay index-aligned (a lot that had the old 12th plaque gets the new 12th): the layout, the rng stream and the
//     location agents' id-based tuning are untouched; only the words change.
//  2. The copy the shared signage system composes ads from (designs.js): categories, names, slogans, the ghost-sign heritage.
//
// Shop and deli entries are TRADES (trade()): the lexicon names the trade, and the sign on the building gets one of its names,
// allocated per location so the same name never shows twice within ~3 blocks (names.js). A kit or an override that writes its own
// plain string gets exactly that string on the sign.
import { PAL } from '../style.js';
const G = PAL.green, R = PAL.red, Y = PAL.yellow, L = PAL.lime, C = PAL.cyan, K = PAL.pink, I = PAL.ink, B = 0x2f5bff, O = 0xff7a1a, V = 0x7a3cff, W = PAL.white;

// a default-lexicon trade (its sign name is allocated). w0 = the band width (voxels) of the pass-2 name at this index: gen.js decides which trade
// fits a lot by width (facade.js textW reads w0), so the generator deals exactly what it dealt in pass 2 — only the words on the sign change
export const trade = (s, w0) => Object.assign(new String(s), { trade: String(s), ...(w0 !== undefined ? { w0 } : {}) });
export const tradeOf = name => (name && typeof name === 'object' && name.trade) || null;

// ───────────────────────── shops: [trade, sign colour, window display kind, the giant shop object] · 73, index-aligned with pass 2
export const SHOPS = [
  [trade('PIZZA', 49), R, 'food', 'slice'], [trade('WOK', 55), R, 'food'], [trade('BAGELS', 63), Y, 'food'], [trade('HEROES', 63), G, 'food'], [trade('DINER', 75), C, 'food', 'cup'], [trade('TACOS', 45), O, 'food'],
  [trade('DUMPLINGS', 71), R, 'food'], [trade('DONUTS', 77), K, 'cakes', 'donut'], [trade('BURGERS', 65), Y, 'food', 'burger'], [trade('PHO', 45), G, 'food'], [trade('CHICKEN', 49), O, 'food'], [trade('BAKERY', 35), K, 'cakes'],
  [trade('NOODLES', 57), I, 'food'], [trade('HALAL', 57), Y, 'food'], [trade('JUICE', 33), L, 'food'], [trade('COFFEE', 35), I, 'food', 'cup'], [trade('GRILL', 41), R, 'food', 'burger'], [trade('CAFE', 73), V, 'food', 'cup'],
  [trade('BAIL BONDS', 55), R, 'office'], [trade('CHECKS CASHED', 75), G, 'office'], [trade('NOTARY', 64), B, 'office'], [trade('PHONE FIX', 49), B, 'phones'], [trade('PREPAID', 75), I, 'phones'], [trade('WIRELESS', 49), B, 'phones'],
  [trade('KEYS', 51), G, 'misc', 'key'], [trade('CLEANERS', 51), C, 'clothes'], [trade('LAUNDROMAT', 59), C, 'machines'], [trade('LAUNDRY', 63), G, 'machines'], [trade('PAWN', 58), Y, 'gold'], [trade('GOLD', 61), Y, 'gold'],
  [trade('NO QS', 55), O, 'gold'], [trade('TAX PREP', 45), B, 'office'], [trade('LAW', 51), I, 'office'], [trade('PRIVATE EYE', 61), V, 'office', 'eye'], [trade('LOCKSMITH', 51), Y, 'misc', 'key'], [trade('LOANS', 57), G, 'office'],
  [trade('PSYCHIC', 55), K, 'misc', 'eye'], [trade('COPIES', 62), B, 'office'], [trade('MONEY WIRE', 55), Y, 'office'], [trade('AUTO', 69), R, 'misc'], [trade('SNEAKERS', 35), I, 'shoes', 'sneaker'], [trade('STREETWEAR', 61), L, 'clothes'],
  [trade('RESTOCK', 53), I, 'shoes', 'sneaker'], [trade('FITS', 49), K, 'clothes'], [trade('RESALE', 61), O, 'shoes'], [trade('HATS', 43), R, 'clothes'], [trade('TEES', 69), V, 'clothes'], [trade('BIG SIZES', 63), B, 'shoes', 'sneaker'],
  [trade('OUTLET', 57), R, 'clothes'], [trade('GRILLZ', 57), Y, 'gold', 'tooth'], [trade('JEWELRY', 33), Y, 'gold'], [trade('THRIFT', 55), C, 'clothes'], [trade('SMOKE SHOP', 45), C, 'misc'], [trade('99¢', 57), O, 'misc'],
  [trade('RECORDS', 41), I, 'misc'], [trade('COMICS', 33), Y, 'misc'], [trade('SKATE', 57), L, 'shoes'], [trade('TATTOO', 35), I, 'misc'], [trade('NAILS', 47), K, 'misc'], [trade('BARBER', 35), G, 'barber'], [trade('CUTS', 63), B, 'barber'],
  [trade('LIQUORS', 39), V, 'bottles'], [trade('WINE', 73), R, 'bottles'], [trade('CARDS', 45), Y, 'misc'], [trade('PHARMACY', 47), G, 'misc'], [trade('OPTICAL', 39), B, 'misc', 'eye'], [trade('DENTIST', 39), C, 'misc', 'tooth'],
  [trade('SPY SHOP', 73), O, 'misc'], [trade('SURPLUS', 51), R, 'misc'], [trade('WE BUY', 55), G, 'gold'], [trade('CANTEEN', 63), C, 'food', 'cup'], [trade('OPTICS', 79), V, 'misc', 'eye'], [trade('STORAGE', 69), O, 'office'],
];
// the names each trade's sign can carry (hand-written first; names.js adds owner-name variants so every trade has 32+)
export const NAMES = {
  PIZZA: ["SAL'S SLICE", "NICO'S PIZZA", 'SLICE KING', "GINO'S", "PAPA TONY'S", 'PIZZA PALACE', 'PRIMO PIZZA', 'BELLA NAPOLI', "MAMA ROSA'S", '$1 SLICE', 'LATE SLICE', 'PIZZA TIME'],
  WOK: ['WOK N ROLL', 'GOLDEN WOK', 'LUCKY WOK', 'JADE PALACE', 'DRAGON EXPRESS', 'NO. 1 KITCHEN', 'EAST STAR', 'GOLDEN DRAGON', 'GREAT WALL', 'HAPPY GARDEN', 'NEW CHINA', 'WOK 24'],
  BAGELS: ['BAGEL NOSH', 'HOT BAGELS', 'BAGEL KING', 'EVERYTHING BAGEL', 'ACE BAGELS', 'LOX OF LUCK', 'BAGEL HUT', 'SMEAR CAMPAIGN', 'BAGEL BAR'],
  HEROES: ['CHOP CHEESE', 'HERO SHOP', 'THE HERO', 'BACON EGG CHEESE', 'SANDWICH KING', 'HEROES 24HR', 'SUBPOENA', 'CHOP SHOP'],
  DINER: ['NITE OWL DINER', 'STAR DINER', 'OLYMPIA DINER', 'SILVER MOON', 'COURTHOUSE DINER', 'PARTHENON', 'CORNER DINER', 'LUCKY DINER', 'ACROPOLIS', 'MIDNIGHT DINER', 'ALL NITE DINER'],
  TACOS: ['TACOS EL PRIMO', 'TAQUERIA LUPE', 'TACO LOCO', 'TACOS 24', 'EL TACO KING', 'DON PEPE', 'LA TAQUERIA', 'TACOS EL REY', 'TACO TRUCK'],
  DUMPLINGS: ['DUMPLING JAIL', 'DUMPLING HOUSE', 'NO. 1 DUMPLING', 'BAO & CO', 'DUMPLING BOSS', 'DUMPLING DEN'],
  DONUTS: ['COP STOP DONUTS', 'DONUT KING', 'HOLE LOTTA DONUTS', 'GLAZED & CONFUSED', 'SUGAR RUSH', 'DONUT DEN', 'THE DONUT HOLE', 'DIAL-UP DONUTS'],
  BURGERS: ['SMASH SHACK', 'BURGER BARN', 'JAILHOUSE BURGERS', 'THE GREASE TRAP', 'BURGER JOINT', 'COUNTY BURGER', 'DOUBLE DOWN', 'BURGER HUT'],
  PHO: ['PHO REAL', 'PHO 88', 'SAIGON PHO', 'PHO NUMBER 1', 'PHO 24', 'LITTLE SAIGON'],
  CHICKEN: ['COUNTY FRIED CHICKEN', 'KINGS FRIED CHICKEN', 'PLATINUM CHICKEN', 'GOLDEN CHICKEN', 'CHICKEN SPOT', 'CHICKEN & WAFFLES', 'HOT WINGS 24', 'WING IT', 'CLUCK CITY', 'THE COOP'],
  BAKERY: ['PANADERIA', 'SWEET TOOTH', 'SUGAR SHACK', 'LA ESPIGA', 'DULCERIA', 'CAKE WALK', 'BREAD & BUTTER', 'THE CRUMB'],
  NOODLES: ['NOODLE BAR', 'RAMEN 24', 'NOODLE KING', 'SLURP SHOP', 'HAND PULLED', 'NOODLE HOUSE'],
  HALAL: ['HALAL BROS', 'HALAL KING', 'MR. HALAL', 'HALAL 24HR', 'CHICKEN & RICE', 'HALAL CORNER', 'KEBAB KING'],
  JUICE: ['JUICE?', 'JUICE BAR', 'JUGOS NATURALES', 'GREEN MACHINE', 'FRESH SQUEEZE', 'SMOOTHIE SPOT', 'SUCOS'],
  COFFEE: ['COFFEE', 'CAFE CON LECHE', 'JAVA JOINT', 'BLACK COFFEE', 'DOUBLE SHOT', 'ESPRESSO BAR', 'COFFEE SHOP', 'CUP OF JOE'],
  GRILL: ['BURGER & GRILL', 'CHARCOAL GRILL', 'COUNTY GRILL', 'CORNER GRILL', 'FLAME GRILL', 'THE GRIDDLE'],
  CAFE: ['LATE FEE CAFE', 'CAFE MOKA', 'CAFE CUBANO', 'CAFE 24', 'CAFE LUNA', 'THE LAST CAFE'],
  'BAIL BONDS': ['BAIL BONDS', 'FREEDOM BAIL', 'OUT TODAY BAIL', 'A-1 BAIL BONDS', 'LIBERTY BAIL', 'BAIL 24HR', 'SECOND CHANCE', 'EZ BAIL'],
  'CHECKS CASHED': ['CHECKS CASHED', 'CHECK CASHING', 'CASH EXPRESS', 'PAYDAY CENTER', 'EZ CHECK', 'CHECK CITY', 'QUICK CASH'],
  NOTARY: ['NOTARY · FAX', 'TAX · NOTARY', 'MULTISERVICE', 'NOTARIO', 'COPIES · FAX', 'NOTARY PUBLIC'],
  'PHONE FIX': ['PHONE FIX', 'CELL REPAIR', 'SCREEN FIX', 'PHONE DOCTOR', 'CRACKED?', 'FIX IT FAST'],
  PREPAID: ['BURNER PHONES', 'PREPAID PHONES', 'NO CONTRACT', 'PHONE CARDS', 'CHEAP PHONES', 'PAY AS U GO'],
  WIRELESS: ['CELL CITY', 'UNLOCK ANY PHONE', 'WIRELESS 4 LESS', 'PHONE ZONE', 'MOBILE WORLD', 'CELL SPOT'],
  KEYS: ['KEYS MADE', 'KEY KING', 'LOCK & KEY', 'KEYS CUT', 'KEY SHOP'],
  CLEANERS: ['DRY CLEAN', 'SAME DAY CLEANERS', 'TAILOR', 'ALTERATIONS', 'PRESS & FOLD', 'SPOTLESS'],
  LAUNDROMAT: ['LAUNDROMAT', 'WASH & FOLD', 'LAVANDERIA', 'SUDS CITY', 'SPIN CYCLE', 'WASH WORLD'],
  LAUNDRY: ['CLEAN MONEY', 'LAUNDRY TRUST', 'CLEAN SLATE', 'WASH HOUSE', 'COIN LAUNDRY'],
  PAWN: ['PAWN SHOP', 'KING PAWN', 'PAWN · LOANS', 'CASH PAWN', 'GOLD & PAWN', 'PAWN 24'],
  GOLD: ['WE BUY GOLD', 'CASH 4 GOLD', 'GOLD EXCHANGE', 'GOLD BUYERS', 'TOP $ GOLD'],
  'NO QS': ['NO QS PAWN', 'ASK NO QS', 'NO RECEIPT PAWN', 'QUIET PAWN'],
  'TAX PREP': ['TAX PREP', 'REFUND FAST', 'INCOME TAX', 'MAX REFUND', 'TAX 911', 'EZ TAX'],
  LAW: ['LAWYER UP', 'INJURY LAW', 'ABOGADO', 'LAW OFFICE', 'DEFENSE LAW', 'TRAFFIC TICKETS'],
  'PRIVATE EYE': ['PRIVATE EYE', 'DISCREET INQUIRIES', 'THE GUMSHOE', 'TAIL & TRACE', 'SNOOP & CO'],
  LOCKSMITH: ['LOCKSMITH', '24HR LOCKSMITH', 'LOCKED OUT?', 'LOCK & SAFE', 'SAFE CRACKER'],
  LOANS: ['PAYDAY $$$', 'PAYDAY LOANS', 'CASH ADVANCE', 'EZ LOANS', 'FAST CASH', 'LOAN STAR'],
  PSYCHIC: ['PSYCHIC $5', 'PALM READER', 'TAROT', 'MADAME ZORA', 'FORTUNES', 'SEE THE FUTURE'],
  COPIES: ['COPY · PRINT', 'PRINT SHOP', 'COPY CENTER', 'ID PHOTOS', 'PASSPORT PHOTOS'],
  'MONEY WIRE': ['MONEY WIRE', 'SEND MONEY', 'ENVIOS', 'MONEY TRANSFER', 'WIRE HOME'],
  AUTO: ['GETAWAY AUTO', 'AUTO PARTS', 'TIRES', 'AUTO BODY', 'TOW 24HR', 'FAST LANE AUTO'],
  SNEAKERS: ['SNEAKS', 'KICKS', 'SNEAKER SPOT', 'SOLE CITY', 'LACE UP', 'KICK GAME'],
  STREETWEAR: ['DRIP SUPPLY', 'FRESH FITS', 'STREET KING', 'THE FIT'],
  RESTOCK: ['RESTOCK', 'GRAIL KICKS', 'SIZE RUN', 'DS ONLY'],
  FITS: ['FIT CHECK', 'FITTING ROOM', 'OUTFIT', 'LOOKBOOK'],
  RESALE: ['RESELL CITY', 'CONSIGNMENT', 'AUTHENTIC ONLY', 'LEGIT CHECK'],
  HATS: ['CAP CITY', 'FITTED', 'LID LIFE', 'HAT CITY'],
  TEES: ['BOOTLEG TEES', 'AIRBRUSH TEES', 'CUSTOM TEES', 'RIP TEES'],
  'BIG SIZES': ['SIZE 13 ONLY', 'BIG FOOT', 'SIZE 14+'],
  OUTLET: ['NO REFUNDS', 'FINAL SALE', 'IRREGULARS', 'CLOSEOUTS'],
  GRILLZ: ['GOLD TEETH', 'GRILLZ', 'GOLD GRILLS', 'SHINE BRIGHT'],
  JEWELRY: ['CHAINZ', 'ICE BOX', 'JEWELERS', 'GOLD RUSH', 'BLING KING'],
  THRIFT: ['THRIFT', 'VINTAGE', 'THRIFT CITY', 'SECOND HAND', 'USED FITS'],
  'SMOKE SHOP': ['SMOKE SHOP', 'VAPE · CBD', 'HOOKAH', 'SMOKE 24', 'VAPOR KING', 'VAPE CITY'],
  '99¢': ['99¢ DREAMS', '99¢ PLUS', 'DOLLAR SPOT', 'EVERYTHING $1', '$1 WORLD'],
  RECORDS: ['RECORDS', 'WAX CITY', 'CRATE DIGGERS', 'VINYL', 'BREAKBEAT'],
  COMICS: ['COMICS', 'COMIC VAULT', 'BACK ISSUES', 'MINT CONDITION'],
  SKATE: ['SKATE SHOP', 'GRIND', 'CURB CUT', 'DECK SHOP'],
  TATTOO: ['TATTOO', 'INK SPOT', 'TATTOO · PIERCING', 'NEEDLE & INK', 'FLASH TATTOO'],
  NAILS: ['NAILS 4 U', 'NAIL SPA', 'LUXE NAILS', 'MANI PEDI', 'NAIL QUEEN'],
  BARBER: ['BARBER', 'FRESH CUTZ', 'FADE KINGS', 'CLEAN CUTS', 'SHAPE UP', 'THE CHAIR'],
  CUTS: ['COUNTY CUTZ', 'LINE UP', 'SHARP EDGES', 'CUT CITY'],
  LIQUORS: ['LIQUORS', 'WINE & LIQUOR', 'LIQUOR 24', 'BOTTLE SHOP', 'LIQUOR KING'],
  WINE: ['WINE & SPIRITS', 'SPIRITS', 'VINO', 'CORK & BOTTLE'],
  CARDS: ['CARD SHOP', 'GRAILS', 'SLAB CITY', 'CARD KINGZ', 'PULL CITY', 'GRADED ONLY'],
  PHARMACY: ['PHARMACY', 'FARMACIA', 'RX 24', 'DRUGS'],
  OPTICAL: ['OPTICAL', 'EYES ON YOU', 'SPEC CITY', 'EYEGLASSES'],
  DENTIST: ['DENTIST', 'DR. SMILE', 'DENTAL 24', 'BRIGHT SMILE'],
  'SPY SHOP': ['SNITCH SUPPLY', 'SPY SHOP', 'WIRETAP', 'BUG SWEEP'],
  SURPLUS: ['HOT GOODS', 'NO RECEIPT', 'ARMY NAVY', 'SURPLUS'],
  'WE BUY': ['FENCE & CO', 'WE BUY ANYTHING', 'CASH 4 STUFF'],
  CANTEEN: ['PAROLE CAFE', 'THE BREAK ROOM', 'VISITING HOURS'],
  OPTICS: ['LOOKOUT OPTICS', 'BINOCULARS', 'SCOPE SHOP'],
  STORAGE: ['SELF STORAGE', 'NO QS STORAGE', 'STORE IT', 'LOCK BOX'],
};
// how names.js grows each trade past its hand-written names: 'own' = "{OWNER}'S TRADE", 'pre' = "{OWNER} TRADE", 'st' = "{STREET} TRADE"
export const GROW = { PIZZA: ['own', 'st'], WOK: ['pre'], BAGELS: ['st', 'own'], HEROES: ['own'], DINER: ['st', 'pre'], TACOS: ['own'], DUMPLINGS: ['pre'], DONUTS: ['own'], BURGERS: ['own', 'st'],
  PHO: ['pre'], CHICKEN: ['st', 'pre'], BAKERY: ['own'], NOODLES: ['pre'], HALAL: ['own'], JUICE: ['own'], COFFEE: ['st', 'own'], GRILL: ['own'], CAFE: ['pre'] };
export const GROW_WORD = { PIZZA: 'PIZZA', WOK: 'KITCHEN', BAGELS: 'BAGELS', HEROES: 'HEROES', DINER: 'DINER', TACOS: 'TACOS', DUMPLINGS: 'DUMPLING', DONUTS: 'DONUTS', BURGERS: 'BURGERS', PHO: 'PHO',
  CHICKEN: 'CHICKEN', BAKERY: 'BAKERY', NOODLES: 'NOODLE', HALAL: 'HALAL', JUICE: 'JUICE', COFFEE: 'COFFEE', GRILL: 'GRILL', CAFE: 'CAFE', 'BAIL BONDS': 'BAIL BONDS', 'CHECKS CASHED': 'CHECK CASHING',
  NOTARY: 'MULTISERVICE', 'PHONE FIX': 'PHONE FIX', PREPAID: 'PHONES', WIRELESS: 'WIRELESS', KEYS: 'KEYS', CLEANERS: 'CLEANERS', LAUNDROMAT: 'LAUNDROMAT', LAUNDRY: 'LAUNDRY', PAWN: 'PAWN', GOLD: 'GOLD',
  'NO QS': 'PAWN', 'TAX PREP': 'TAX', LAW: 'LAW', 'PRIVATE EYE': 'INVESTIGATIONS', LOCKSMITH: 'LOCKSMITH', LOANS: 'LOANS', PSYCHIC: 'PSYCHIC', COPIES: 'COPIES', 'MONEY WIRE': 'ENVIOS', AUTO: 'AUTO BODY',
  SNEAKERS: 'KICKS', STREETWEAR: 'SUPPLY', RESTOCK: 'KICKS', FITS: 'FITS', RESALE: 'RESALE', HATS: 'HATS', TEES: 'TEES', 'BIG SIZES': 'BIG & TALL', OUTLET: 'OUTLET', GRILLZ: 'GRILLZ', JEWELRY: 'JEWELERS',
  THRIFT: 'THRIFT', 'SMOKE SHOP': 'SMOKE SHOP', '99¢': '99¢', RECORDS: 'RECORDS', COMICS: 'COMICS', SKATE: 'SKATE', TATTOO: 'TATTOO', NAILS: 'NAILS', BARBER: 'BARBERSHOP', CUTS: 'CUTS', LIQUORS: 'LIQUORS',
  WINE: 'WINE', CARDS: 'CARDS', PHARMACY: 'DRUGS', OPTICAL: 'OPTICAL', DENTIST: 'DENTAL', 'SPY SHOP': 'SPY SHOP', SURPLUS: 'SURPLUS', 'WE BUY': 'BUYERS', CANTEEN: 'CAFE', OPTICS: 'OPTICS', STORAGE: 'STORAGE' };
// SHORT names: every trade needs a name in each of the 16 lattice classes that fits its narrowest band (the width of its pass-2 name,
// which fit it). Narrow trades get one-word names (hand-written); the rest grow SHORT_OWNER + SHORT_WORD (ACE BAIL, KIM KEYS). names.js
// puts one short name first in every class, so a narrow shop always has a name of its own and never needs a forced blade.
export const SHORT = {
  BAKERY: ['PAN', 'DULCE', 'CRUMB', 'SUGAR', 'FLOUR', 'OVEN', 'RISE', 'KNEAD', 'LOAF', 'BUNS', 'TARTS', 'SWEET', 'BREAD', 'PASTEL', 'CAKES', 'CHURRO'],
  JUICE: ['JUGO', 'LIMA', 'MANGO', 'BERRY', 'PULP', 'FRUTA', 'SIP', 'PRESS', 'BLEND', 'KALE', 'GUAVA', 'LIME', 'AGUA', 'COCO', 'BEET', 'ACAI'],
  COFFEE: ['JAVA', 'BREW', 'ROAST', 'BEANS', 'MOKA', 'PERK', 'CUPPA', 'LATTE', 'MUD', 'CREMA', 'DARK', 'CAFFE', 'TINTO', 'JOE', 'STEAM', 'DRIPS'],
  GRILL: ['SEAR', 'FLAME', 'CHAR', 'EMBER', 'PIT', 'BBQ', 'SIZZLE', 'FIRE', 'COALS', 'BROIL', 'SMASH', 'PATTY', 'BURNT', 'SKEWER', 'SPIT', 'BRISKET'],
  TACOS: ['EL TACO', 'TAQUITO', 'LA LUPE', 'CARNITA', 'ASADA', 'BIRRIA', 'PASTOR', 'ELOTE', 'GUERO', 'TORTA', 'SOPES', 'TACO REY', 'CHILE', 'MOLE', 'LIMON', 'CARNE'],
  PHO: ['SAIGON', 'HANOI', 'BANH MI', 'BROTH', 'PHO BAC', 'PHO 1', 'PHO 99', 'PHO VIET', 'BASIL', 'LOTUS', 'BAMBOO', 'JASMINE', 'MEKONG', 'PHO LA', 'PHO 4U', 'HUE'],
  SNEAKERS: ['SOLES', 'LACES', 'KIX', 'HEAT', 'TREADS', 'SPIKES', 'CLEATS', 'KICKZ', 'STEPS', 'STRIDE', 'SOLE', 'WALK', 'KIKS', 'PAIRS', 'SIZES', 'TONGUE'],
  JEWELRY: ['BLING', 'KARAT', 'CARAT', 'GEMS', 'ROCKS', 'CHAIN', 'LINKS', 'CUBAN', 'ROPE', 'SHINE', 'GLEAM', 'JEWEL', 'RINGS', '14K', '24K', 'FROST'],
  RECORDS: ['WAX', 'CRATES', 'GROOVE', 'SPINS', 'DISCS', '45S', 'LPS', 'BEATS', 'DUBS', 'BREAKS', 'SAMPLE', 'B-SIDE', 'TRAX', 'GROOVY', 'SPIN', 'HI-FI'],
  COMICS: ['COMIX', 'POW!', 'KAPOW', 'SPLAT', 'PULPS', 'ISSUE', 'PANEL', 'CAPES', 'MINT', 'NERDS', 'GEEKS', 'ZINES', 'BAM!', 'WHAM!', 'HERO!', 'TOONS'],
  TATTOO: ['INK', 'INKED', 'NEEDLE', 'FLASH', 'SKIN', 'TATS', 'LINES', 'SHADE', 'DAGGER', 'ROSES', 'SAILOR', 'TRIBAL', 'SKULL', 'TAT', 'BLOOD', 'MARKS'],
  BARBER: ['FADES', 'SHAPE', 'CLIPS', 'TRIMS', 'EDGES', 'BLADE', 'RAZOR', 'CHOP', 'SHAVE', 'TAPER', 'BUZZ', 'CURLS', 'CHAIR', 'POLE', 'COMBS', 'SHEARS'],
  LIQUORS: ['LIQ', 'BOOZE', 'SAUCE', 'PINTS', 'FIFTHS', 'RYE', 'MALT', 'GIN', 'RUM', 'HOOCH', 'TIPSY', 'SHOTS', 'NIPS', 'CASE', 'DRAM', 'KEGS'],
  OPTICAL: ['EYES', 'SPECS', 'LENS', 'FOCUS', 'SIGHT', 'FRAMES', 'VISION', 'CLEAR', 'IRIS', 'PUPIL', '20/20', 'SHADES', 'LOOK', 'SEE', 'OPTIX', 'GLINT'],
  DENTIST: ['SMILE', 'TEETH', 'GRIN', 'FLOSS', 'MOLAR', 'ENAMEL', 'BRACES', 'CAVITY', 'DDS', 'ORAL', 'BITE', 'CHOMP', 'GUMS', 'PEARLY', 'FILLING', 'ROOTS'],
  HATS: ['CAPS', 'LIDS', 'BRIMS', 'DOMES', 'BEANIE', 'BUCKET', 'SNAPS', 'TOPPER', 'HEADS', 'VISOR', 'STRAPS', 'DURAG', 'BERET', 'NEWSBOY', 'COVERS', 'LIDZ'],
  'SMOKE SHOP': ['VAPOR', 'PUFF', 'HAZE', 'SMOKE', 'BLAZE', 'ASH', 'MIST', 'GLASS', 'PAPERS', 'FUMES', 'SMOG', 'PIPES', 'EXHALE', 'WISP', 'SPARK', 'CIGS'],
  CARDS: ['SLABS', 'PACKS', 'PULLS', 'HOBBY', 'TRADES', 'ROOKIE', 'HOLO', 'BOXES', 'BINDER', 'SLEEVES', 'CARDZ', 'DECKS', 'SETS', 'CHASE', 'INSERT', 'RIPS'],
  'TAX PREP': ['REFUND', 'FILE IT', 'W-2', '1040', 'TAXMAN', 'RETURNS', 'AUDIT', 'FORMS', 'CPA', 'TAXES', 'DEDUCT', 'ITIN', 'E-FILE', 'TAX PRO', 'TAX 1', 'CREDITS'],
  PIZZA: ['SLICE', 'SLICES', 'PIE', 'PIES', 'PIZZERIA', 'NAPOLI', 'ROMA', 'SICILY', 'CALZONE', 'FORNO', 'CRUST', 'NONNA', 'MAMMA', 'PAISANO', 'VESUVIO', '2 SLICES'],
  CHICKEN: ['WINGS', 'CLUCK', 'BIRD', 'FRYER', 'CRISPY', 'DRUMS', 'TENDERS', 'NUGGETS', 'ROOSTER', 'POLLO', 'HEN', 'HOT BIRD', 'THIGHS', 'WISHBONE', 'CHIX', 'FEATHERS'],
  'PHONE FIX': ['FIXIT', 'SCREENS', 'REPAIR', 'CELL FIX', 'BATTERY', 'CHARGE', 'PATCH', 'SPARE', 'SOLDER', 'CIRCUIT', 'CHIPS', 'WIRED', 'MEND', 'VOLTS', 'PLUG', 'CASES'],
  WIRELESS: ['CELLS', 'MOBILE', '5 BARS', 'TALK', 'CALL ME', 'UNLOCK', 'FLIP', 'CELL 1', 'RING', 'TEXT', 'MINUTES', 'SIMS', 'CARRIER', 'HELLO', 'DIGITS', 'DIAL 1'],
  FITS: ['THREADS', 'GEAR', 'GARMS', 'STYLE', 'DRESS', 'KITS', 'TOGS', 'WEAR', 'FLEX', 'SWAG', 'RAGS', 'WARDROBE', 'FABRIC', 'SUITED', 'LAYERS', 'CUT & SEW'],
  NAILS: ['TIPS', 'POLISH', 'GLOSS', 'LACQUER', 'GEL', 'CLAWS', 'TALONS', 'MANI', 'PEDI', 'BUFF', 'CUTICLE', 'GLAM', 'SPARKLE', 'CHROME', 'ACRYLIC', 'NAIL BAR'],
  PHARMACY: ['RX', 'PILLS', 'CURE', 'REMEDY', 'CHEMIST', 'SCRIPTS', 'DOSE', 'MEDS', 'HEALTH', 'VITAMIN', 'FARMA', 'BOTICA', 'RELIEF', 'ELIXIR', 'BALM', 'RX PLUS'],
};
export const SHORT_OWNER = ['SAL', 'RAY', 'JOE', 'KIM', 'LEE', 'ALI', 'GUS', 'DOC', 'ACE', 'TIA', 'LOU', 'MAX', 'MEL', 'NED', 'PAT', 'ROY', 'SID', 'TED', 'VIC', 'BEA', 'CAL', 'DEE', 'HAL', 'GIL',
  'IZZY', 'NINO', 'RICO', 'TITO', 'DUKE', 'NENE', 'OLGA', 'IVAN', 'OMAR', 'KOFI', 'LUPE', 'ROSA', 'PAPI', 'MAMA'];   // (three letters first: the combos fit the narrow bands)
export const SHORT_WORD = { WOK: 'WOK', BAGELS: 'BAGEL', HEROES: 'HERO', DINER: 'DINER', DUMPLINGS: 'BAO', DONUTS: 'DONUT', BURGERS: 'BURGER', NOODLES: 'RAMEN', HALAL: 'HALAL', CAFE: 'CAFE',
  'BAIL BONDS': 'BAIL', 'CHECKS CASHED': 'CHECKS', NOTARY: 'NOTARY', PREPAID: 'CELLS', KEYS: 'KEYS', CLEANERS: 'PRESS', LAUNDROMAT: 'WASH', LAUNDRY: 'SUDS', PAWN: 'PAWN', GOLD: 'GOLD', 'NO QS': 'LOANS',
  LAW: 'LAW', 'PRIVATE EYE': 'TAILS', LOCKSMITH: 'LOCKS', LOANS: 'CASH', PSYCHIC: 'TAROT', COPIES: 'PRINT', 'MONEY WIRE': 'WIRE', AUTO: 'AUTO', STREETWEAR: 'WEAR', RESTOCK: 'KICKS', RESALE: 'RESELL',
  'BIG SIZES': 'XXL', OUTLET: 'OUTLET', GRILLZ: 'GRILLZ', THRIFT: 'THRIFT', '99¢': '99¢', SKATE: 'SKATE', CUTS: 'CUTS', WINE: 'VINO', 'SPY SHOP': 'SPY', SURPLUS: 'ARMY', 'WE BUY': 'BUYS', CANTEEN: 'BREAK',
  OPTICS: 'SCOPE', STORAGE: 'STORE' };
// the bodegas' short forms: SHORT_BODEGA owners × this suffix, when the full owner + trade does not fit the band
export const DELI_SHORT = ['GROCERY', 'DELI', 'GROC', 'MINI MKT', 'GRILL', 'FOODS', 'CANDY', '24', 'MKT'];
export const SHORT_BODEGA = ['PAPI', 'ACE', 'ALI', 'JOSE', 'OMAR', 'STAR', 'ROYAL', 'BRAVO', 'OASIS', 'CEDAR', 'MECCA', 'HAPPY', 'TONY', 'PRIMO', 'MAMI', 'KINGS', 'PLAZA', 'SANTO', 'EL REY', 'LA ROSA'];
// bodegas: the deli trade is its suffix, the owner comes from BODEGA_OWNERS (names.js): LUCKY STAR DELI, EL PRIMO GROCERY …
export const DELIS = [trade('DELI & GROCERY'), trade('DELI'), trade('GROCERY'), trade('MINI MARKET'), trade('DELI & GRILL'), trade('FOOD MARKET'), trade('CANDY & DELI'), trade('DELI 24'), trade('MARKET')];
export const BODEGA_OWNERS = ['LUCKY STAR', 'EL PRIMO', 'LA ROSA', 'PAPI', 'NEW STAR', 'GOLDEN', 'DOS AMIGOS', 'KINGS', 'MI BARRIO', 'SUNRISE', 'PLAZA', 'NUMERO 1', 'LA FAMILIA', 'CORNER STAR', 'BIG APPLE', 'ACE',
  'JOSE', 'NEW WAVE', 'ROYAL', 'ALI', 'BLUE MOON', 'LIBERTY', 'EMPIRE', 'LA ESQUINA', 'MOM & POP', 'BRAVO', 'TROPICAL', 'ISLAND', 'SANTO', 'EL REY', 'OMAR', 'SAHARA', 'OASIS', 'CEDAR', 'MECCA', 'HAPPY',
  'JUNIOR', 'TONY', 'PRIMO', 'CARIBE', 'QUISQUEYA', 'LA ESTRELLA', 'SUPREMO', 'UNITED', 'STAR', 'BROTHERS', 'MAMI'];
export const OWNERS = ['SAL', 'TONY', 'NICO', 'GINO', 'RAY', 'JOE', 'FRANKIE', 'VINNY', 'PAULIE', 'ROSA', 'MARIA', 'LUPE', 'PEDRO', 'PAPI', 'MAMA', 'TIA', 'KIM', 'LEE', 'CHEN', 'PATEL', 'ALI', 'OMAR',
  'HASSAN', 'YUSUF', 'MOSHE', 'IZZY', 'DMITRI', 'OLGA', 'KOFI', 'AMARA', 'JUNIOR', 'DOC', 'SARGE', 'ACE', 'LUCKY', 'SUNNY', 'ANGIE', 'TERRY', 'DELROY', 'MARCUS', 'JAMAL', 'KEISHA', 'NENE', 'CHINO', 'FLACO',
  'NINO', 'BIG MIKE', 'LIL MO', 'DUKE', 'MICKEY', 'BENNY', 'CARMEN', 'DOLLY', 'EDDIE', 'FAT TONY', 'GUS', 'HECTOR', 'IVAN', 'JIMMY', 'LENNY', 'MANNY', 'OSCAR', 'RICO', 'SAMMY', 'TITO', 'WILLIE'];
export const SURNAMES = ['DIMARCO', 'RIVERA', 'KATZ', 'OKAFOR', 'KOWALSKI', 'MORALES', 'FINE', 'GOLDBERG', 'CHEN', 'PATEL', 'ROMANO', 'SANTOS', 'OBRIEN', 'WASHINGTON', 'DELGADO', 'NAKAMURA', 'PETROV',
  'HART', 'FLORES', 'MENDEZ', 'SHAPIRO', 'BELL', 'CRUZ', 'ESPOSITO', 'FITZGERALD', 'GRECO', 'HAYES', 'IBRAHIM', 'JAMES', 'KLEIN', 'LOPEZ', 'MARINO', 'NGUYEN', 'ORTIZ', 'PRICE', 'QUINN', 'RUSSO',
  'SILVA', 'TORRES', 'VARGAS', 'WOLFE', 'YOUNG', 'ZELLER', 'BARONE', 'CASTILLO', 'DUNN', 'FERRARA', 'GARZA', 'KAPLAN', 'LEVINE', 'MCBRIDE', 'NOVAK', 'PACE', 'REYES', 'STONE', 'VOSS'];
export const STREETS = ['KENT ST', 'JAY ST', 'IVY ST', 'MAIN ST', 'LINDEN', 'HAZEL', 'GRAND AVE', 'CENTRAL', 'WASHINGTON', 'MAPLE', 'ELM ST', 'CEDAR', 'BIRCH', 'MILL ST', 'MARKET', 'HARBOR', 'DOCK ST', 'OAK ST', 'PINE ST', 'UNION'];

// ───────────────────────── the rest of the generator's lists (index-aligned with pass 2)
export const CORPS = ['WIRE TAP INC', 'BLIND TRUST', 'VAULT & CO', 'QUIET PARTNERS', 'GRAFT & CO', 'KENT MUTUAL', 'SLUSH FUND LLC', 'SKIM CAPITAL', 'COLD STORAGE CO', 'ALIBI CAPITAL', 'SHELL CO',
  'OFFSHORE LLC', 'HUSH MONEY INC', 'FRONT CORP', 'PONZI & SONS', 'LOOPHOLE LAW'];
// building name plaques in the parapet (tenement style) · one crime wink (THE SAFE HOUSE)
export const PLAQUES = ['THE DOLORES', 'LENOX ARMS', 'CARLTON HOUSE', 'THE BELMONT', 'PALERMO COURT', 'MAJESTIC', 'ROSALIND ARMS', 'KESTREL HALL', 'THE BRADFORD', 'FAIRVIEW', 'THE PRESCOTT', 'THE ESTELLE',
  'LAUREL MANOR', 'THE ROSA', 'PARK TOWERS', 'THE SAFE HOUSE', 'THE REGENT', 'CORONA HALL'];
// gate and wall graffiti: words, never crew names (turf visuals are deferred, DISTRICTS.md §4)
export const TAGS = ['WILD', 'NOVA', 'DRIP', 'RUSH', 'KING', 'BOOM', 'OOF', 'DOPE', 'HYPE', 'ZAP', 'SK8', 'WAVY', 'TOXIC', 'GHOST'];
// sandwich boards: ≤ 6 characters
export const BOARDS = ['OPEN', 'CASH', 'SALE!', 'NEW!', 'ATM', 'LOTTO', 'BEER', 'HOT', 'FIX IT', 'EBT OK', 'DEALS', 'NO ID?', '$1', 'BAIL?', 'EAT', '2 4 1'];   // (each the width of its pass-2 word: the clutter lands where it did)
// faded painted ads (two lines) and bright wall ads: the fallbacks a kit gets when it passes these lists itself. The shared system
// allocates its own designs for walls whose words come from here (designs.js GHOST_COPY / the wall family).
export const GHOSTS = [['KESSLER FURS', 'STORAGE · MOVING'], ['SELTZER', '5¢ · ICE COLD'], ['BUFFINGTON', 'PIANOS'], ['EAGLE SHOE', 'REPAIRED'], ['GRAMPA JOE', 'TONIC'], ['HOTEL ROOMS', '$2 A NITE'],
  ['HATS', 'CLEANED'], ['TELEGRAM', '& CABLE CO'], ['BILLIARDS', 'PARLOR'], ['COAL & ICE', 'DELIVERED'], ['CIGARS', 'TOBACCO'], ['FURS', 'STORED']];
export const ADS = [['WE BUY', 'GOLD'], ['CASH 4', 'CARS'], ['BAIL', '24/7'], ['HURT?', 'CALL SAL'], ['LAWYER?', '555-0148'], ['CHECKS', 'CASHED'], ['NO CREDIT', 'NO PROBLEM'], ['FAST', 'CASH'],
  ['1-800', 'GET-OUT'], ['OPEN', 'LATE'], ['ALL NITE', 'EVERY NITE'], ['COLD', 'BEER'], ['LOW', 'PRICES'], ['LOTTO', 'TONITE']];
// rooftop billboard COLOURWAYS (headline, line 2, small print, face, ink): far.js paints a far billboard in the face colour
// (seed % length), so the near board keeps that face colour and the design (copy, character, icon) is allocated per block
export const BILLBOARDS = [['', '', '', 0x2f5bff, 0xffe23a], ['', '', '', 0xe8232a, 0xf7f7f2], ['', '', '', 0x17171b, 0x6cff4a], ['', '', '', 0xffe23a, 0x17171b], ['', '', '', 0xff4fa3, 0xf7f7f2],
  ['', '', '', 0x14a83b, 0xf7f7f2], ['', '', '', 0xff7a1a, 0x17171b], ['', '', '', 0x7a3cff, 0xffe23a], ['', '', '', 0x2de2e6, 0x17171b], ['', '', '', 0xf7f7f2, 0xe8232a], ['', '', '', 0x17171b, 0xe7bd4a],
  ['', '', '', 0x12b3a0, 0xf7f7f2]];
// rooftop neon frames and painted roof throw-ups (setpieces.js): allocated like every other design (no repeat within ~3 blocks)
export const NEON_WORDS = ['CASH', 'LIVE', 'OPEN', 'HOT', 'BAIL', 'LOTTO', 'PAWN', 'GOLD', 'BEER', '24HR', 'NAILS', 'VIP', 'OTB', 'BAR', 'KINGS', 'LUCKY', 'TATTOO', 'WINGS', 'SALSA', 'LIQUOR', 'CLUB', 'MOTEL',
  'DINER', 'ICE', 'BINGO', 'OYSTERS', 'KARAOKE', 'PSYCHIC', 'WIFI'];
export const NEON_SHORT = ['HOT', 'BAR', 'OTB', 'VIP', 'ICE', 'EAT'];
export const THROW_WORDS = ['WILD', 'ZAP', 'SK8', 'WAVY', 'DOPE', 'HYPE', 'BOOM', 'RUSH', 'KING', 'NOVA', 'FRESH', 'OOF', 'YO', 'LUX', 'GLOW', 'BLAM', 'POW', 'WHOA', 'SLAY', 'BANG', 'FLY', 'RICH',
  'LAG', 'PING', 'BSOD'];   // (the last three: writers with dial-up names, the rooftop's internet winks)
export const THROW_SHORT = ['ZAP', 'SK8', 'OOF', 'YO', 'POW', 'FLY'];
// window vinyl on the display glass, by window display kind (a trade can have its own: VINYL_TRADE)
export const VINYL = { food: ['HOT FOOD', 'WE DELIVER', 'OPEN 24HR'], cakes: ['FRESH DAILY', 'CAKES TO ORDER'], phones: ['UNLOCK · REPAIR', 'PREPAID · NO CONTRACT', 'SCREENS $49'],
  clothes: ['NEW ARRIVALS', 'SALE 50% OFF', 'SIZES S-4XL'], shoes: ['RESTOCK SAT', 'SIZE RUN', 'NEW ARRIVALS'], gold: ['WE BUY GOLD', 'CASH LOANS', 'TOP $ PAID'], bottles: ['COLD BEER', 'LOTTO · ICE'],
  machines: ['WASH · DRY · FOLD', 'DROP OFF $1/LB'], office: ['WALK-INS WELCOME', 'SE HABLA ESPANOL', 'NOTARY · FAX'], misc: ['OPEN 7 DAYS', 'CASH ONLY'], barber: ['WALK-INS WELCOME', 'FADES $15'] };
export const VINYL_TRADE = { 'BAIL BONDS': ['24HR · ANY JAIL'], 'CHECKS CASHED': ['BILL PAY · MONEY ORDERS'], LOANS: ['NO CREDIT CHECK'], 'TAX PREP': ['MAX REFUND FAST'], LAW: ['FREE CONSULT'], PAWN: ['LOANS ON ANYTHING'],
  NAILS: ['MANI · PEDI · WAX'], TATTOO: ['WALK-INS · PIERCING'], 'SMOKE SHOP': ['VAPE · CBD · HOOKAH'], CARDS: ['BUY · SELL · TRADE'], RECORDS: ['WE BUY RECORDS'], COMICS: ['NEW ISSUES WED'],
  PHARMACY: ['FLU SHOTS'], DENTIST: ['EMERGENCIES'], WIRELESS: ['UNLOCK ANY PHONE'], PREPAID: ['NO CONTRACT'], LIQUORS: ['COLD BEER · ICE'], WINE: ['TASTING FRI'], HALAL: ['CHICKEN OVER RICE'] };
// a trade's window card (the lit card in the corner of the glass)
export const CARD_WORD = { food: 'OPEN', cakes: 'OPEN', phones: 'OPEN', clothes: 'SALE', shoes: 'SALE', gold: 'CASH', bottles: 'COLD', machines: 'OPEN', office: 'OPEN', misc: 'OPEN', barber: 'OPEN' };

// names a hero or a block override writes itself: the allocators never hand them out (so they stay one of a kind)
export const RESERVED = new Set(['ALIBI BURGER', 'NITE OWL DELI', 'PAWN · GOLD', 'DEADSTOCK', 'DEAD AIR', '24/7 STORE', 'GLASSWALL SAVINGS', 'BAIL BONDS', 'FRESH CUTZ', 'HOT SLICE', 'LUCKY 7 DELI']);
// the corner bodega's side band (gen.js) and the parking lot's price sign (gen.js): the pass-2 words stay on the copy nearest the city
// centre; the rest take real-world variants from these lists (the swap table, swaps.js). Bands: no wider than the pass-2 words (93 px);
// parking: two lines of up to four characters
export const BODEGA_BAND = 'ATM · LOTTO · BEER', PARK_SIGN = 'PARK $404';
export const BODEGA_BANDS = ['BEER · SODA · ICE', 'HOT FOOD · COFFEE', 'EBT · WIC · ATM', 'COLD BEER · ICE', 'HEROES · COFFEE', 'CIGS · LOTTO · ATM', 'OPEN 24 HOURS', 'WE ACCEPT EBT',
  'PHONE CARDS · ATM', 'FRUIT · FLOWERS', 'LOTTO · BILL PAY', 'COFFEE · BAGELS', 'ICE COLD BEER', 'CHOPPED CHEESE', 'HOT COFFEE 24HR', 'ICE · PROPANE', 'EGG SANDWICH $3', 'OPEN 7 DAYS',
  'SODA · SNACKS', 'DELI · GROCERY'];
export const PARK_SIGNS = ['PARK $12', 'LOT $10', 'PARK FULL', 'AUTO $3/H', 'PARK $9', 'OPEN 24HR', 'PARK $20', 'LOT FULL', 'PARK CASH', 'PARK $15', 'LOT $14', 'PARK $8', 'PARK 24HR',
  'PARK $25', 'LOT $7', 'PARK $18', 'PARK $30', 'LOT $3/H'];
// utility words on a shop band (the bodega's side band): signs of use, not names; the audit never counts them (the census does: gags.js)
export const UTIL = new Set([BODEGA_BAND, 'GROCERY · ATM', ...BODEGA_BANDS]);
// regulatory and utility plates (a kit's fence plates, gate stencils): the street's furniture, repeated in any real city like a stop
// sign, so the audit's repeat check (tools/audit.mjs) skips them. Only exact phrases: an ad that starts with NO is still checked.
export const REGULATORY = new Set(['BEWARE OF DOG', 'NO DUMPING', 'NO TRESPASSING', 'NO TRESPASSING VIOLATORS TOWED', 'PRIVATE PROPERTY', 'KEEP OUT',
  'NO PARKING', 'NO PARKING ANYTIME', 'NO PARKING · TOWED', 'TOW AWAY ZONE', 'VIOLATORS TOWED', 'DRIVEWAY 24 HRS', 'KEEP CLEAR', 'LOADING ZONE',
  'HARD HAT AREA', 'AUTHORIZED ONLY', 'AUTHORIZED PERSONNEL ONLY', 'KEEP GATE CLOSED', 'SHUT THE GATE', 'TRUCK ENTRANCE', 'HIGH VOLTAGE', 'DANGER',
  'NO SMOKING', 'NO ENTRY', 'DEAD END', 'ONE WAY', 'STOP', 'EXIT', 'ENTRANCE', 'SIDEWALK CLOSED', 'WATCH YOUR STEP', 'SPEED LIMIT 5', 'NO LOITERING',
  'OPEN', 'CLOSED', 'PUSH', 'PULL', 'ATM', ...UTIL]);

// ───────────────────────── internet nostalgia: the few winks STYLE.md allows (≤ 10 % of lettered surfaces) are counted with this
export const NET = /(\b404\b|\.EXE|\bBSOD\b|\bPING\b|\bCLICK\b|\bWWW\b|\.COM\b|\bCURSOR\b|\bLOADING\b|\bPIXELS?\b|\bBYTES?\b|\bMODEM\b|DIAL-?UP|\b56K\b|\bLAG\b|WI-?FI|\bCACHE\b|\bBUFFER\b|\bPROXY\b|\bROUTER\b|\bKERNEL\b|\bFIREWALL\b|\bLOGIN\b|\bMAINFRAME\b|\bREBOOT\b|\bCOOKIE\b|SAFE MODE|\bOFFLINE\b|NO SIGNAL|HI-RES|\bCLOUD\b|CAN U HEAR|NOT FOUND|WE CRASH|\bOOF\b|\bKEK\b|\bRAWR\b|\bNULL\b(?! & VOID)|TRASH BIN|HOME\.EXE)/;
export const isNet = s => NET.test(String(s || '').toUpperCase());
// the district flavours (plan.js distOf): whose ads a block leans toward
export const FLAVOUR = { downtown: 'downtown', strip: 'strip', docks: 'docks', industrial: 'docks', junkyard: 'docks', suburbs: 'suburbs', trailer: 'suburbs', highway: 'suburbs', mall: 'suburbs',
  forest: 'suburbs', estates: 'uptown', jail: 'civic', hospital: 'civic', bridge: 'civic', sea: 'docks' };
export const FLAVOURS = ['downtown', 'strip', 'docks', 'suburbs', 'uptown', 'civic'];
