// SIGNAGE · the ad catalogue (owner: the signage agent). Every billboard, wall ad, ghost sign, paste-up, transit ad, neon word and
// roof throw-up in the city is one DESIGN: a category's copy (brand, hook, small print, phone) × a character (chars.js) or a product
// icon × a tone × a layout. Categories generate designs; each family keeps a pool of hundreds, split into lattice classes
// (alloc.js), so combinations vastly outnumber placements and nothing repeats within ~3 blocks.
//
// The mix (STYLE.md §12): the bulk is everyday NYC and crime-world services; sneaker drops + fashion ≤ 15 %, collector culture
// ≤ 10 %, internet winks ≤ 10 % of every family's pool (capped per flavour below). A design's KEY is its biggest words: the thing a
// passer-by would call a repeat. Keys are unique across every family and never collide with a shop name (names.js).
import { rng } from '../style.js';
import { OWNERS, SURNAMES, STREETS, GHOSTS as GH0, NEON_WORDS, THROW_WORDS, NEON_SHORT, THROW_SHORT, TAGS, FLAVOURS, isNet, SHOPS, GROW_WORD, DELIS, SHORT_WORD } from './lexicon.js';
import { ALL_NAMES } from './names.js';
import { makePool, RESERVE } from './alloc.js';
import { RESERVE_CATS, NEON2, THROW2, HERITAGE2, MAKERS2 } from './reserve.js';
import { STREET_CAST } from './art.js';

const pk = (r, a) => a[(r() * a.length) | 0];
const S = r => pk(r, SURNAMES), O = r => pk(r, OWNERS), ST = r => pk(r, STREETS);
const tel = (r, toll) => (toll && r() < .6 ? '1-800-555-01' : '555-01') + String((r() * 100) | 0).padStart(2, '0');
const NICK = ['BULLDOG', 'SHARK', 'CLOSER', 'BIG GUN', 'WRECKING BALL', 'HEAVYWEIGHT', 'LION', 'TANK', 'PITBULL', 'FIXER'];
const FIRST = ['MARTY', 'VINNY', 'ROSA', 'DENISE', 'CARLA', 'LEON', 'BARRY', 'GLORIA', 'HECTOR', 'IRENE', 'MORRIS', 'NADINE', 'OTIS', 'PHIL', 'SONNY', 'TINA'];
const FIGHTER = ['KID LIGHTNING', 'BIG PAPI', 'IRON MIKE-O', 'THE BUTCHER', 'SWEET LOU', 'BABYFACE', 'EL TORO', 'THE PRIEST', 'HURRICANE', 'SLIM', 'KILLER K', 'THE LANDLORD', 'DYNAMITE', 'SMOKEY'];
const ARTIST = ['LIL VOUCHER', 'DJ PAYDAY', 'MC ALIBI', 'THE WITNESSES', 'LA DOLORES', 'YOUNG SUBPOENA', 'BIG PROBATION', 'DJ OVERTIME', 'LOS BANDIDOS', 'THE LINEUP', 'LADY LOOPHOLE', 'CASH MONEY CARL', 'TITO & THE TORCHES', 'DJ BAILOUT'];
const SHOW = ['PRECINCT 9', 'THE FENCE', 'HEAT CHECK', 'COLD CASE COUNTY', 'WAR ON THE CORNER', 'GRAILS', 'THE PLEA', 'HUSTLE', 'THE DROP', 'KINGPIN', 'INSIDE MAN', 'THE WIRE ROOM', 'NIGHT COURT 2', 'STAKEOUT'];
const CANDIDATE = ['DA MORALES', 'KOWALSKI', 'COUNCILMAN DIAZ', 'JUDGE HART', 'ROSA FLORES', 'AL ROMANO', 'DENISE OKAFOR', 'TOMMY GRECO', 'MAYOR PRICE', 'SHERIFF DUNN',
  'GLORIA NUNEZ', 'DA KESSLER', 'COMPTROLLER CHEN', 'MAYOR BRENNAN', 'LUPE CASTILLO', 'COUNCILWOMAN PARK', 'RAY OKONKWO', 'JUDGE PETRAKIS', 'EDDIE FALCONE', 'MARIA DELGADO'];
const ALIAS = ['SLIM', 'BIG LOU', 'THE GHOST', 'LEFTY', 'NINE FINGERS', 'THE ACCOUNTANT', 'SPEEDY', 'MISS KITTY', 'TWO TONE', 'BABY FACE', 'NO NAME', 'THE DENTIST', 'SNEAKY PETE', 'LUCKY'];
const MALT = ['BULL KING MALT', 'OLD HARBOR LAGER', 'BIG PAPA 40', 'SOUTHSIDE MALT', 'BLUE STALLION', 'HIGH TIDE ICE', 'OLD 55', 'KINGPIN LAGER', 'COUNTY LAGER', 'GOLDEN DRAFT', 'NIGHT SHIFT BREW', 'IRON HORSE BEER', 'MIDNIGHT MALT', 'TIDEWATER ICE', 'CORNER KING 40', 'SLOW HAND LAGER'];
const ENERGY = ['VOLT', 'RAMPAGE', 'NO SLEEP', '3AM ENERGY', 'OVERTIME', 'RED EYE', 'ALL NITER', 'LIVEWIRE', 'DOUBLE SHIFT', 'GRAVEYARD', 'HIGH NOON'];
const STATION = ['97.3 THE BLOCK', 'SALSA 101.9', 'WKNT TALK 880', 'HOT 95.5', 'LA RUMBA 92.1', 'SMOOTH 104', 'THE BEAT 99.1', 'OLD SCHOOL 107.5', 'POWER 98', 'WAVE 88.7', 'RADIO KENT 1010', 'EL SABOR 93.3'];
const LABEL = ['MAISON KENT', 'COUNTY LINE', 'NO REFUNDS STUDIO', 'GRAND JURY', 'PAROLE', 'EVIDENCE', 'MOTIVE', 'PLEA', 'COLD CASE', 'SMOKE & MIRRORS', 'LOW PROFILE', 'CHAIN OF CUSTODY', 'FIRST OFFENSE', 'HEARSAY'];
const SNEAKER = ['AIR COUNTY 1', 'PAROLE LOW', 'GRAIL ONE', 'CORNER RUNNER', 'NIGHT SHIFT HI', 'BAIL OUT 3', 'KENT ST LOW', 'LOOKOUT MID', 'ALIBI TRAINER', 'THE RECEIPT'];
const CONDO = ['THE GLASSWALL RESIDENCES', 'ONE KENT', 'THE SUMMIT', 'SKYHOUSE', 'THE MERIDIAN', 'PARK & CENTRAL', 'THE LANDMARK', 'HALCYON', 'THE AUREATE', 'GATEHILL TOWERS', 'MONARCH', 'THE OBSIDIAN'];

// ───────────────────────── categories: mix (svc · fash · coll · net), flavour fit (0–5), family weights, make(r) → copy
// lay: bust (character panel + type) · figure (full character breaking the frame) · product (icon + type) · type (stacked words)
// · jackpot (lotto digits) · editorial (Dazed: flat colour, full character, a small wordmark) · notice (transit / civic sheet)
// · church (letter board) · bandit (yellow snipe, marker) · fight (two characters) · flyer (tear-off tabs) · wanted (face + REWARD)
// the internet winks (STYLE.md §12: a few, never more than 10 %): a crime-world trade with a dial-up pun, starring the cast's online
// kids. One of each, city-wide; the caps below keep them to a few per pool.
const NETPUN = [
  ['BSOD BANK', 'WE CRASH 4 U', 'NO PIN · NO PROBLEM', 'money', 'blue', 'type'], ['PING PHONE REPAIR', 'CAN U HEAR ME NOW', 'SCREENS · UNLOCKS · NO ID', 'phone', 'teal', 'product'],
  ['LAG LAGER', 'SLOW BREWED', 'BEST SERVED LATE', 'bottle', 'violet', 'product'], ['CURSOR COLA', 'CLICK TO DRINK', 'NOW IN CHERRY', 'can', 'pink', 'product'],
  ['STAY OFFLINE', 'THE CORNER HAS NO WIFI', 'TALK TO YOUR NEIGHBOR', null, 'ink', 'type'], ['MODEM MOTEL', 'ROOMS BY THE HOUR', 'NO QUESTIONS · CASH', 'star', 'red', 'type'],
  ['FIREWALL LOCKS', 'NOBODY GETS IN', 'DEADBOLTS · SAFES · GATES', 'key', 'orange', 'product'], ['PROXY BAIL', 'WE SHOW UP 4 U', 'ANY COURT · ANY TIME', 'cuffs', 'yellow', 'bust'],
  ['CACHE 4 GOLD', 'NO RECEIPTS', 'CHAINS · RINGS · GRILLS', 'chain', 'ink', 'product'], ['404 LAW', 'YOUR CASE: NOT FOUND', 'WE MAKE IT DISAPPEAR', 'gavel', 'blue', 'bust'],
  ['OFFLINE TAX', 'NO RECORDS KEPT', 'CASH ONLY · ASK 4 RAY', 'money', 'green', 'type'], ['REBOOT BARBERS', 'TURN IT OFF & ON', 'FADES · SHAPE-UPS', 'scissors', 'red', 'bust'],
  ['SAFE MODE STORAGE', 'NOTHING GETS OUT', 'NO QUESTIONS · 24HR', 'box', 'yellow', 'product'], ['BUFFER BAR', 'HAPPY HOUR 4-7', 'THE WAIT IS WORTH IT', 'bottle', 'violet', 'type'],
  ['DIAL-UP DELI', 'HEROES · CONNECTING', 'OPEN 24 HRS', 'drumstick', 'yellow', 'product'], ['COOKIE JAR PAWN', 'WE REMEMBER YOU', 'GOLD · PHONES · TOOLS', 'dice', 'red', 'product'],
  ['LOGIN LOANS', 'PASSWORD: CASH', 'NO CREDIT CHECK', 'cash', 'green', 'product'], ['MAINFRAME GYM', 'GET PROCESSED', 'OPEN 5AM', 'glove', 'ink', 'figure']];
const NET_CAST = ['bluescreen.bucket', 'www.girl', 'rawr_means_404', 'dealwithit.mp3', '56kballer'];
const cast = (r, share = .4) => r() < share ? { handle: pk(r, STREET_CAST) } : { roll: (r() * 0xffffff) | 0 };
const C = [
  // ── legal & money
  { id: 'injury', mix: 'svc', flav: { downtown: 3, civic: 4, suburbs: 2, docks: 2, strip: 1 }, fam: { roof: 3, wall: 3, transit: 3, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} & ${S(r)}`, () => `THE ${pk(r, NICK)}`, () => `${S(r)} LAW`, () => `CALL ${pk(r, FIRST)}`])(), top: pk(r, ['HURT?', 'INJURED?', 'IN A WRECK?', 'SLIP & FALL?', 'HIT BY A CAB?', 'HURT ON THE JOB?', 'DOG BITE?', 'BAD LANDLORD?']),
      sub: pk(r, ['NO WIN · NO FEE', 'WE COME TO YOU', 'HABLAMOS ESPANOL', 'FREE CONSULT 24/7', 'WE FIGHT DIRTY', 'GET WHAT YOU DESERVE', 'CASH FOR YOUR PAIN']), tel: tel(r, true), look: cast(r), pose: 'point', icon: pk(r, ['gavel', 'cone', 'money']), tone: pk(r, ['blue', 'red', 'yellow', 'ink']), lay: pk(r, ['bust', 'bust', 'type', 'figure']) }) },
  { id: 'bail', mix: 'svc', flav: { downtown: 3, civic: 5, strip: 2, docks: 1, suburbs: 1 }, fam: { roof: 3, wall: 3, transit: 1, paste: 2 },
    make: r => ({ big: pk(r, [() => `${O(r)} BAIL BONDS`, () => `${S(r)} BONDING`, () => `${ST(r)} BAIL`, () => `${S(r)} & SON BAIL`])(), top: pk(r, ['LOCKED UP?', 'GET OUT TODAY', 'OUT BY LUNCH', 'WE POST FAST', 'BAIL 24HR', 'CALLING FROM JAIL?']),
      sub: pk(r, ['ANY JAIL · ANY TIME', 'EZ PAY · LOW DOWN', 'COLLECT CALLS OK', 'MAMA WANTS YOU HOME', 'COSIGNERS WELCOME', 'WE KNOW THE WAY OUT']), tel: tel(r, true), look: cast(r, .5), pose: pk(r, ['up', 'point']), icon: pk(r, ['cuffs', 'key', 'cash']), tone: pk(r, ['blue', 'yellow', 'red', 'green']), lay: pk(r, ['bust', 'figure', 'type', 'product']) }) },
  { id: 'tax', mix: 'svc', flav: { downtown: 2, suburbs: 3, strip: 1, docks: 1 }, fam: { roof: 2, wall: 3, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} TAX SERVICE`, () => `${O(r)} MULTISERVICE`, () => `${ST(r)} TAX`])(), top: pk(r, ['REFUND FAST', 'TAX REFUND', 'MAX REFUND', 'INCOME TAX', 'REFUND IN 1 DAY']),
      sub: pk(r, ['ITIN · NOTARY · VISAS', 'WALK-INS WELCOME', 'SE HABLA ESPANOL', 'NO REFUND · NO FEE', 'CASH ADVANCE TODAY']), tel: tel(r), icon: pk(r, ['cash', 'money']), tone: pk(r, ['green', 'yellow', 'blue', 'white']), lay: pk(r, ['type', 'product']) }) },
  { id: 'cheque', mix: 'svc', flav: { downtown: 2, strip: 3, suburbs: 2, docks: 2 }, fam: { roof: 2, wall: 4, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)} CHECK CASHING`, () => `${ST(r)} CHECK CASHING`, () => `${O(r)}'S EZ MONEY`, () => `${S(r)} FINANCIAL`])(), top: pk(r, ['CHECKS CASHED', 'NO BANK? NO PROBLEM', 'PAYDAY TODAY', 'NEED CASH BY FRIDAY?', 'BAD CREDIT OK', 'CASH IN 5 MIN']),
      sub: pk(r, ['BILL PAY · MONEY ORDERS', 'LOANS $100 TO $1000', 'NO CREDIT CHECK', 'OPEN 7 DAYS']), tel: tel(r), icon: pk(r, ['cash', 'money']), tone: pk(r, ['green', 'yellow', 'white']), lay: pk(r, ['type', 'product', 'type']) }) },
  { id: 'gold', mix: 'svc', flav: { downtown: 2, strip: 4, suburbs: 2, docks: 1 }, fam: { roof: 3, wall: 3, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)} PAWN`, () => `${O(r)} JEWELERS`, () => `${ST(r)} GOLD EXCHANGE`, () => `${S(r)} & SON JEWELERS`])(), top: pk(r, ['WE BUY GOLD', 'CASH FOR GOLD', 'TOP $ PAID', 'SELL YOUR GOLD', 'GOLD · SILVER · WATCHES']),
      sub: pk(r, ['BROKEN CHAINS OK', 'NO QUESTIONS', 'LOANS ON ANYTHING', 'INSTANT CASH']), tel: tel(r), look: cast(r, .6), pose: 'stand', icon: pk(r, ['chain', 'diamond', 'crown']), tone: pk(r, ['gold', 'yellow', 'ink']), lay: pk(r, ['product', 'bust', 'type']) }) },
  { id: 'houses', mix: 'svc', flav: { suburbs: 5, docks: 2, downtown: 1, strip: 1 }, fam: { roof: 1, wall: 2, paste: 4 },
    make: r => ({ big: pk(r, ['WE BUY HOUSES', 'SELL YOUR HOUSE TODAY', 'CASH FOR HOUSES', 'UGLY HOUSES OK', 'WE BUY ANY HOUSE', 'SELL IT AS IS', 'HOUSE FOR CASH?', 'BEHIND ON RENT?']),
      sub: pk(r, ['CASH · ANY CONDITION', 'CLOSE IN 7 DAYS', 'NO FEES · NO REPAIRS', 'FACING FORECLOSURE?']), tel: tel(r), icon: 'house', tone: 'yellow', lay: 'bandit' }) },
  { id: 'wire', mix: 'svc', flav: { downtown: 1, strip: 2, suburbs: 2, docks: 1 }, fam: { roof: 1, wall: 2, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)} ENVIOS`, () => `${ST(r)} MONEY TRANSFER`, () => `${O(r)} EXPRESS`])(), top: pk(r, ['SEND MONEY HOME', 'ENVIOS DE DINERO', 'MONEY TRANSFER']),
      sub: pk(r, ['LOW FEES · FAST', 'TO 90 COUNTRIES', 'PICK UP IN MINUTES']), tel: tel(r), icon: pk(r, ['money', 'cash']), tone: pk(r, ['yellow', 'green', 'red']), lay: pk(r, ['type', 'product']) }) },
  // ── luck and vice
  { id: 'lotto', mix: 'svc', flav: { strip: 4, downtown: 2, suburbs: 2, docks: 2 }, fam: { roof: 3, wall: 2, transit: 2, paste: 1 },
    make: r => { const g = pk(r, ['LOTTO', 'MEGA POT', 'POWER PICK', 'WIN 4', 'CASH 5', 'LUCKY 7S', 'PICK 3', 'BIG GAME', 'SUPER LOTTO', 'MONEY BALL', 'GOLD RUSH', 'TAKE 5']), a = pk(r, ['$212', '$97', '$350', '$48', '$1.2B', '$64', '$180', '$23']);
      return { big: a + (a.endsWith('B') ? '' : 'M'), brand: g, key: g + ' ' + a, top: g, sub: pk(r, ['PLAY TONIGHT', 'QUICK PICK $2', 'SOMEBODY HAS TO WIN', 'DRAWING 11PM', 'JACKPOT']), icon: 'ball', tone: pk(r, ['red', 'green', 'violet', 'blue']), lay: 'jackpot' }; } },
  { id: 'otb', mix: 'svc', flav: { strip: 5, docks: 2, downtown: 1, suburbs: 1 }, fam: { roof: 2, wall: 3, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, [() => `${ST(r)} OTB`, () => `${S(r)} SPORTS BOOK`, () => `${O(r)}'S PARLAY PALACE`, () => `${ST(r)} RACEBOOK`])(), top: pk(r, ['BET THE PONIES', 'POST TIME 1PM', 'EVERY RACE LIVE', 'BIG GAME TONITE', 'FEELING LUCKY?', 'OFF TRACK BETTING']),
      sub: pk(r, ['LIVE ODDS · 12 SCREENS', 'CASH OUT ANYTIME', 'BAR · GRILL · BETS']), icon: pk(r, ['horse', 'dice']), tone: pk(r, ['green', 'red', 'ink']), lay: pk(r, ['product', 'type']) }) },
  { id: 'malt', mix: 'svc', flav: { strip: 4, docks: 3, suburbs: 2, downtown: 1 }, fam: { roof: 4, wall: 3, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, MALT), top: pk(r, ['COLD 40S', 'ICE COLD', 'THE BIG ONE', 'SMOOTH', 'BUILT FOR THE CORNER', 'EASY DOES IT', 'STAY COLD']), sub: pk(r, ['40 OZ', '24 OZ CAN', 'BREWED TOUGH', 'SINCE 1961']),
      look: r() < .5 ? cast(r) : null, pose: 'up', icon: pk(r, ['bottle', 'can']), tone: pk(r, ['red', 'blue', 'gold', 'ink', 'white']), lay: pk(r, ['product', 'product', 'bust']) }) },
  { id: 'energy', mix: 'svc', flav: { strip: 3, docks: 3, downtown: 1, suburbs: 1 }, fam: { roof: 3, wall: 2, transit: 2, paste: 1 },
    make: r => ({ big: pk(r, ENERGY), top: pk(r, ['STAY UP', 'NO SLEEP TIL MONDAY', 'MAXIMUM VOLTAGE', 'DOUBLE SHIFT READY', 'WAKE UP']), sub: pk(r, ['ZERO SUGAR', '16 OZ', 'TWICE THE KICK']),
      look: cast(r), pose: 'up', icon: pk(r, ['can', 'bolt']), tone: pk(r, ['lime', 'ink', 'cyan', 'red']), lay: pk(r, ['figure', 'product', 'bust']) }) },
  { id: 'vape', mix: 'svc', flav: { strip: 3, suburbs: 2, downtown: 1 }, fam: { roof: 1, wall: 2, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)} SMOKE SHOP`, () => `${ST(r)} SMOKE & VAPE`, () => `${O(r)}'S HOOKAH LOUNGE`])(), top: pk(r, ['VAPE · CBD · HOOKAH', 'GLASS · PAPERS · LIGHTERS', 'OPEN LATE']), sub: 'ID REQUIRED', icon: 'flame', tone: pk(r, ['violet', 'ink', 'cyan']), lay: 'type' }) },
  // ── everyday city
  { id: 'locksmith', mix: 'svc', flav: { downtown: 2, suburbs: 2, strip: 1, docks: 1 }, fam: { roof: 2, wall: 3, paste: 2 },
    make: r => ({ big: pk(r, [() => `${O(r)} LOCK & KEY`, () => `${ST(r)} LOCKSMITH`, () => `${S(r)} LOCK & SAFE`])(), top: pk(r, ['LOCKED OUT?', '24HR LOCKSMITH', 'LOST YOUR KEYS?']),
      sub: pk(r, ['HERE IN 20 MIN', 'CARS · HOMES · SAFES', 'NO QUESTIONS ASKED']), tel: tel(r), icon: 'key', tone: pk(r, ['yellow', 'red', 'blue']), lay: pk(r, ['product', 'type']) }) },
  { id: 'pest', mix: 'svc', flav: { downtown: 2, suburbs: 3, docks: 2, strip: 1 }, fam: { roof: 2, wall: 3, paste: 2 },
    make: r => ({ big: pk(r, [() => `${S(r)} PEST CONTROL`, () => `${ST(r)} EXTERMINATING`, () => `${O(r)} THE RAT MAN`])(), top: pk(r, ['BUGS? RATS?', 'ROACHES?', 'RAT PROBLEM?', 'WE KILL']),
      sub: pk(r, ['SAME DAY', 'GUARANTEED DEAD', 'DISCREET TRUCKS']), tel: tel(r), icon: 'rat', tone: pk(r, ['yellow', 'green', 'white']), lay: pk(r, ['product', 'type']) }) },
  { id: 'storage', mix: 'svc', flav: { docks: 3, suburbs: 3, downtown: 1 }, fam: { roof: 2, wall: 3 },
    make: r => ({ big: pk(r, [() => `${ST(r)} SELF STORAGE`, () => `${S(r)} STORAGE`, () => `${O(r)}'S LOCK BOX`])(), top: pk(r, ['1ST MONTH $1', 'STORE YOUR STUFF', 'MORE STUFF THAN SPACE?']),
      sub: pk(r, ['NO QUESTIONS ASKED', '24HR ACCESS', 'CLIMATE CONTROL']), tel: tel(r), icon: 'box', tone: pk(r, ['orange', 'yellow', 'blue']), lay: pk(r, ['product', 'type']) }) },
  { id: 'movers', mix: 'svc', flav: { suburbs: 3, downtown: 1, docks: 2 }, fam: { roof: 1, wall: 3, paste: 2 },
    make: r => ({ big: pk(r, [() => `${S(r)} BROS MOVERS`, () => `${O(r)} MOVING`, () => `2 ${pk(r, ['GUYS', 'COUSINS', 'BROTHERS'])} & A VAN`])(), top: pk(r, ['WE MOVE NIGHTS', 'CHEAP MOVERS', 'MOVING?']),
      sub: pk(r, ['LOCAL · LONG DISTANCE', 'NO JOB TOO SMALL', 'CASH ONLY']), tel: tel(r), icon: 'box', tone: pk(r, ['orange', 'blue', 'white']), lay: pk(r, ['product', 'type']) }) },
  { id: 'urgent', mix: 'svc', flav: { civic: 5, downtown: 1, suburbs: 2 }, fam: { roof: 2, wall: 2, transit: 2 },
    make: r => ({ big: pk(r, [() => `${ST(r)} URGENT CARE`, () => `ST. MERCY ${pk(r, ['WALK-IN', 'EXPRESS', 'CLINIC'])}`, () => `${S(r)} MEDICAL`])(), top: pk(r, ['URGENT CARE', 'WALK-INS', 'X-RAY · LAB · SHOTS', 'OPEN 24HR']),
      sub: pk(r, ['NO APPOINTMENT', 'ALL INSURANCE', 'STITCHES WHILE U WAIT']), icon: 'cross', tone: pk(r, ['white', 'red', 'blue']), lay: pk(r, ['product', 'type']) }) },
  { id: 'dental', mix: 'svc', flav: { suburbs: 2, downtown: 1, strip: 1, civic: 2 }, fam: { roof: 2, wall: 2, transit: 2 },
    make: r => ({ big: pk(r, [() => `DR. ${S(r)} DDS`, () => `${ST(r)} DENTAL`, () => `DR. ${O(r)}'S SMILES`])(), top: pk(r, ['TEETH WHITENING $99', 'GOLD CROWNS', 'SMILE!', 'EMERGENCIES']),
      sub: pk(r, ['GRILLS · CROWNS · CLEANINGS', 'SE HABLA ESPANOL']), look: cast(r), pose: 'stand', icon: pk(r, ['tooth', 'grill']), tone: pk(r, ['cyan', 'white', 'blue']), lay: pk(r, ['bust', 'product']) }) },
  { id: 'gym', mix: 'svc', flav: { strip: 2, downtown: 1, docks: 1, suburbs: 1 }, fam: { roof: 2, wall: 3, transit: 2 },
    make: r => ({ big: pk(r, [() => `${ST(r)} BOXING CLUB`, () => `${S(r)} GYM`, () => `IRON ${pk(r, ['TEMPLE', 'HOUSE', 'PIT'])}`])(), top: pk(r, ['GET STRONG', 'BOXING · MMA', 'TRAIN LIKE A CHAMP', 'NO EXCUSES']),
      sub: pk(r, ['$10 A MONTH', 'OPEN 24HR', 'KIDS CLASSES']), look: cast(r), pose: pk(r, ['up', 'both']), icon: 'glove', tone: pk(r, ['red', 'ink', 'yellow']), lay: pk(r, ['figure', 'bust']) }) },
  { id: 'phone', mix: 'svc', flav: { downtown: 2, strip: 2, suburbs: 1 }, fam: { roof: 2, wall: 3, transit: 2 },
    make: r => ({ big: pk(r, [() => `${O(r)} WIRELESS`, () => `${ST(r)} CELL`, () => `${O(r)}'S PHONE REPAIR`])(), top: pk(r, ['UNLOCK ANY PHONE', 'CRACKED SCREEN?', 'REPAIR IN 30 MIN', 'NO CONTRACT']),
      sub: pk(r, ['WE BUY USED PHONES', 'PREPAID · $25 A MONTH']), look: cast(r), pose: 'point', icon: 'phone', tone: pk(r, ['blue', 'cyan', 'pink']), lay: pk(r, ['bust', 'product']) }) },
  { id: 'driving', mix: 'svc', flav: { suburbs: 3, downtown: 1 }, fam: { roof: 1, wall: 2, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} DRIVING SCHOOL`, () => `${ST(r)} DRIVING`])(), top: pk(r, ['PASS 1ST TIME', 'GET YOUR LICENSE', 'ROAD TEST READY']), sub: pk(r, ['LESSONS $40', 'PICK UP AT HOME']), tel: tel(r), icon: pk(r, ['cone', 'tire']), tone: pk(r, ['yellow', 'blue']), lay: 'product' }) },
  { id: 'tow', mix: 'svc', flav: { docks: 4, suburbs: 3, downtown: 1 }, fam: { roof: 3, wall: 3, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} TOWING`, () => `${O(r)} AUTO BODY`, () => `${ST(r)} COLLISION`, () => `${S(r)} & SONS AUTO`])(), top: pk(r, ['24HR TOWING', 'WE TOW ANYTHING', 'CASH FOR JUNK CARS', 'COLLISION?']),
      sub: pk(r, ['FLATBED · WRECKER', 'INSURANCE WORK', 'PAINT · DENTS · GLASS']), tel: tel(r), icon: pk(r, ['hook', 'tire']), tone: pk(r, ['yellow', 'red', 'orange']), lay: pk(r, ['product', 'type']) }) },
  { id: 'laundry', mix: 'svc', flav: { suburbs: 1, downtown: 1, strip: 1 }, fam: { wall: 2, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)}'S WASH & FOLD`, () => `${ST(r)} WASH HOUSE`])(), top: pk(r, ['WASH · DRY · FOLD', 'LAVANDERIA', 'DROP OFF $1/LB']), icon: 'star', tone: pk(r, ['cyan', 'blue']), lay: 'type' }) },
  { id: 'barber', mix: 'svc', flav: { downtown: 1, strip: 2, suburbs: 1 }, fam: { wall: 3, transit: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)}'S CUTS`, () => `${ST(r)} FADES`, () => `${O(r)} THE BARBER`])(), top: pk(r, ['FRESH CUTS', 'FADES $15', 'LINE UPS', 'WALK-INS']), look: cast(r, .2), pose: 'stand', icon: 'scissors', tone: pk(r, ['red', 'blue', 'white']), lay: 'bust' }) },
  { id: 'nails', mix: 'svc', flav: { downtown: 1, strip: 2, suburbs: 2 }, fam: { wall: 3, transit: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)} NAILS`, () => `${ST(r)} NAIL SPA`, () => `NAILS BY ${O(r)}`])(), top: pk(r, ['MANI PEDI $25', 'NAILS · SPA', 'GEL · ACRYLIC']), look: cast(r, .2), pose: 'stand', icon: 'heart', tone: pk(r, ['pink', 'violet']), lay: 'bust' }) },
  { id: 'tattoo', mix: 'svc', flav: { strip: 3, docks: 2, downtown: 1 }, fam: { wall: 2, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)}'S INK`, () => `${ST(r)} TATTOO`])(), top: pk(r, ['TATTOOS', 'WALK-INS', 'INK & PIERCING', 'COVER-UPS']), icon: pk(r, ['heart', 'star']), tone: pk(r, ['ink', 'red']), lay: 'type' }) },
  { id: 'chicken', mix: 'svc', flav: { downtown: 1, strip: 2, suburbs: 2, docks: 2 }, fam: { roof: 3, wall: 3, transit: 1 },
    make: r => ({ big: pk(r, [() => `${ST(r)} FRIED CHICKEN`, () => `${O(r)}'S CHICKEN`, () => `${pk(r, ['PLATINUM', 'DIAMOND', 'EMPIRE', 'ROYAL', 'SUPREME'])} WINGS`])(), top: pk(r, ['2 PC + FRIES $5', 'HOT WINGS', 'CRISPY!', 'FAMILY BUCKET $19']),
      icon: 'drumstick', tone: pk(r, ['red', 'yellow', 'orange']), lay: 'product' }) },
  { id: 'pizza', mix: 'svc', flav: { downtown: 2, suburbs: 2, strip: 1 }, fam: { roof: 2, wall: 3 },
    make: r => ({ big: pk(r, [() => `${O(r)}'S FAMOUS`, () => `${ST(r)} PIZZA CO`, () => `${O(r)}'S PIZZERIA`])(), top: pk(r, ['$1 SLICE', 'HOT SLICE', 'PIZZA 24HR', 'BEST SLICE IN TOWN']), icon: 'slice', tone: pk(r, ['red', 'white', 'green']), lay: 'product' }) },
  { id: 'halal', mix: 'svc', flav: { downtown: 2, strip: 2, civic: 1 }, fam: { wall: 2, paste: 1 },
    make: r => ({ big: pk(r, [() => `${O(r)}'S HALAL`, () => `${ST(r)} HALAL`])(), top: pk(r, ['CHICKEN OVER RICE', 'WHITE SAUCE', 'HALAL 24HR']), icon: 'star', tone: pk(r, ['yellow', 'red']), lay: 'type' }) },
  // ── culture
  { id: 'radio', mix: 'svc', flav: { downtown: 2, strip: 3, suburbs: 1, docks: 1 }, fam: { roof: 3, wall: 3, transit: 2, paste: 1 },
    make: r => ({ big: pk(r, STATION), top: pk(r, ['#1 FOR HIP-HOP', 'TODA LA SALSA', 'YOUR CITY · YOUR VOICE', 'THE MORNING MESS', 'ALL REQUESTS', 'NO COMMERCIALS AFTER DARK']),
      look: cast(r, .5), pose: pk(r, ['stand', 'up']), icon: pk(r, ['mic', 'record']), tone: pk(r, ['pink', 'cyan', 'ink', 'violet']), lay: pk(r, ['bust', 'figure']) }) },
  { id: 'boxing', mix: 'svc', flav: { strip: 3, docks: 2, downtown: 1 }, fam: { roof: 1, wall: 3, paste: 4 },
    make: r => { const a = pk(r, FIGHTER); let b = pk(r, FIGHTER); if (b === a) b = FIGHTER[(FIGHTER.indexOf(a) + 3) % FIGHTER.length];
      return { big: `${a} VS ${b}`, top: pk(r, ['FRIDAY NIGHT FIGHTS', 'MAIN EVENT', 'FIGHT NIGHT']), sub: pk(r, ['COUNTY ARENA · 8PM', 'TICKETS AT THE DOOR', 'LIVE ON PAY-PER-VIEW']), look: cast(r), look2: cast(r), icon: 'glove', tone: pk(r, ['red', 'yellow', 'ink']), lay: 'fight' }; } },
  { id: 'concert', mix: 'svc', flav: { strip: 4, downtown: 1, docks: 1 }, fam: { roof: 1, wall: 2, paste: 4, transit: 1 },
    make: r => ({ big: pk(r, ARTIST), top: pk(r, ['LIVE TONIGHT', 'SUMMER JAM', 'SALSA NIGHTS', 'BLOCK PARTY', 'ONE NIGHT ONLY']), sub: pk(r, ['PIER 9 · SAT', 'THE GRAND · 10PM', 'COUNTY ARENA', 'FREE B4 11']),
      look: cast(r, .5), pose: pk(r, ['up', 'both', 'stand']), icon: pk(r, ['mic', 'record', 'star']), tone: pk(r, ['violet', 'pink', 'ink', 'orange']), lay: pk(r, ['figure', 'bust']) }) },
  { id: 'tv', mix: 'svc', flav: { downtown: 3, strip: 2, suburbs: 1 }, fam: { roof: 3, wall: 2, transit: 3 },
    make: r => ({ big: pk(r, SHOW), top: pk(r, ['NEW SEASON', 'THURSDAYS 10/9C', 'NOW PLAYING', 'IN THEATERS FRIDAY', 'EVERYBODY TALKS', 'SEASON FINALE']), look: cast(r, .5), pose: 'stand', icon: 'tv', tone: pk(r, ['ink', 'red', 'violet']), lay: pk(r, ['figure', 'editorial']) }) },
  { id: 'church', mix: 'svc', flav: { suburbs: 4, docks: 1, downtown: 1, civic: 1 }, fam: { roof: 1, wall: 3, paste: 2 },
    make: r => ({ big: pk(r, ['JESUS SAVES', 'GOD IS NOT DONE WITH YOU', 'REVIVAL THIS WEEK', 'ALL ARE WELCOME', 'PRAY FOR THIS CITY', 'COME AS YOU ARE', 'YOU ARE LOVED', 'CONFESS SUNDAYS']),
      brand: pk(r, [() => `${ST(r)} BAPTIST`, () => `GREATER ${pk(r, ['HOPE', 'MT. ZION', 'BETHEL', 'GRACE'])}`, () => `IGLESIA ${pk(r, ['PENTECOSTAL', 'DE DIOS', 'EL CAMINO'])}`])(), sub: pk(r, ['SUNDAY 10AM', 'ALL WELCOME', 'BIBLE STUDY WED']), icon: 'cross', tone: 'white', lay: 'church' }) },
  // ── civic and crime
  { id: 'campaign', mix: 'svc', flav: { downtown: 5, suburbs: 2, civic: 3, strip: 1 }, fam: { roof: 3, wall: 3, transit: 1, paste: 3 },
    make: r => ({ big: pk(r, CANDIDATE), top: pk(r, ['TOUGH ON CRIME', 'RE-ELECT', 'VOTE', 'SAFE STREETS NOW', 'CLEAN STREETS', 'GETS IT DONE', 'NO MORE EXCUSES', 'FOR THE PEOPLE']), grp: 'big',
      sub: pk(r, ['VOTE NOV 5', 'PRIMARY DAY SEPT 12', 'PAID FOR BY FRIENDS OF THE CAMPAIGN']), look: cast(r, .3), pose: pk(r, ['stand', 'point']), icon: 'star', tone: pk(r, ['red', 'blue', 'white']), lay: pk(r, ['bust', 'type']) }) },
  { id: 'police', mix: 'svc', flav: { downtown: 3, civic: 4, suburbs: 1, strip: 1 }, fam: { roof: 3, wall: 2, transit: 3, paste: 2 },
    make: r => ({ big: pk(r, ['THE BADGE IS HIRING', 'JOIN PRECINCT 9', 'BE THE HERO', 'NOW HIRING OFFICERS', 'WEAR THE BADGE', 'SERVE · PROTECT · OVERTIME']), sub: pk(r, ['APPLY TODAY', 'STARTING $58K', 'NO EXPERIENCE NEEDED', 'PENSION · DENTAL · OVERTIME']),
      look: cast(r), pose: pk(r, ['stand', 'point']), icon: 'badge', tone: pk(r, ['blue', 'white', 'ink']), lay: pk(r, ['bust', 'bust', 'figure']) }) },
  { id: 'stoppers', mix: 'svc', flav: { downtown: 2, strip: 2, docks: 1, civic: 3 }, fam: { roof: 2, wall: 2, transit: 2, paste: 2 },
    make: r => ({ big: pk(r, ['CRIME STOPPERS', 'REWARD $5000', 'SNITCHES GET REWARDS', 'SEEN SOMETHING? SAY IT', 'WE PAY FOR TIPS', 'ANONYMOUS TIPS PAY']), sub: pk(r, ['CALL 555-0147 · ANONYMOUS', 'TEXT TIPS 555-0172', 'NO NAMES · JUST CASH']),
      icon: pk(r, ['badge', 'eye', 'money']), tone: pk(r, ['yellow', 'ink', 'red']), lay: pk(r, ['product', 'type']) }) },
  { id: 'wanted', mix: 'svc', flav: { downtown: 2, strip: 2, docks: 2, civic: 2, suburbs: 1 }, fam: { paste: 4, transit: 1 },
    make: r => ({ big: 'WANTED', key: 'WANTED ' + pk(r, ALIAS) + ' ' + ((r() * 90) | 0), brand: pk(r, ALIAS), sub: pk(r, ['REWARD $5000', 'ARMED & STYLISH', 'LAST SEEN IN A GREEN PUFFER', 'DO NOT APPROACH', 'REWARD · NO QS']), look: cast(r, .3), icon: 'badge', tone: 'cream', lay: 'wanted' }) },
  { id: 'missing', mix: 'svc', flav: { suburbs: 2, downtown: 1, strip: 1, docks: 1 }, fam: { paste: 3 },
    make: r => { const dog = r() < .4; return dog ? { big: pk(r, ['LOST DOG', 'LOST CAT', 'FOUND DOG']), key: 'LOST ' + pk(r, ['MONEY', 'BAIL', 'LUCKY', 'BISCUIT', 'CAPONE', 'NACHO', 'PRINCESS', 'TYSON']) + ' ' + ((r() * 90) | 0), brand: 'ANSWERS TO ' + pk(r, ['MONEY', 'BAIL', 'LUCKY', 'BISCUIT', 'CAPONE', 'NACHO']), sub: 'REWARD · ' + tel(r), icon: 'dog', tone: 'white', lay: 'wanted' }
      : { big: 'MISSING', key: 'MISSING ' + pk(r, FIRST) + ' ' + ((r() * 90) | 0), brand: pk(r, FIRST), sub: pk(r, ['HAVE YOU SEEN ME?', 'LAST SEEN KENT & 1ST', 'CALL ' + tel(r)]), look: cast(r, 0), tone: 'white', lay: 'wanted' }; } },
  { id: 'loanshark', mix: 'svc', flav: { strip: 3, docks: 2, downtown: 1, suburbs: 1 }, fam: { paste: 4 },
    make: r => ({ big: pk(r, ['NEED CA$H?', 'LOANS NO CREDIT', 'FAST MONEY', 'CASH TODAY', 'LOANS · NO QS', 'BEHIND ON BILLS?']), key: 'FLYER ' + pk(r, FIRST) + ' ' + ((r() * 90) | 0), sub: 'ASK FOR ' + pk(r, FIRST), tel: tel(r), tone: pk(r, ['white', 'yellow', 'pink']), lay: 'flyer' }) },
  { id: 'transitnote', mix: 'svc', flav: { downtown: 2, civic: 2, strip: 1, suburbs: 1, docks: 1 }, fam: { transit: 3, paste: 2 },
    make: r => ({ big: pk(r, ['SERVICE CHANGE', 'NO 9 TRAINS', 'NIGHT BUS N9', 'FARE HIKE JAN 1', 'STAND CLEAR', 'SHUTTLE BUSES', 'NO A TRAINS', 'EXPRESS SKIPS 1ST ST']), sub: pk(r, ['THIS WEEKEND · USE THE A', '11PM TO 5AM', 'COUNTY TRANSIT', 'SORRY FOR THE TROUBLE']),
      icon: 'bus', tone: 'white', lay: 'notice' }) },
  { id: 'condo', mix: 'svc', flav: { uptown: 5, downtown: 3 }, fam: { roof: 4, wall: 3, transit: 2 },
    make: r => ({ big: pk(r, [() => pk(r, CONDO), () => `ONE ${ST(r)}`, () => `${pk(r, [100, 220, 450, 550, 888, 1010])} ${ST(r)}`, () => `THE ${S(r)}`])(), top: pk(r, ['FROM THE LOW $2M', 'LIVE ABOVE IT ALL', 'NOW LEASING', 'LUXURY LOFTS', 'PENTHOUSES AVAILABLE', 'YOUR VIEW · YOUR CITY', 'DOORMAN · GYM · ROOF POOL']),
      look: r() < .4 ? cast(r) : null, pose: 'stand', icon: 'tower', tone: pk(r, ['ink', 'white', 'gold', 'cream']), lay: pk(r, ['editorial', 'product', 'type']) }) },
  { id: 'closing', mix: 'svc', flav: { suburbs: 3, downtown: 1, strip: 1, docks: 1 }, fam: { roof: 1, wall: 3, paste: 2 },
    make: r => ({ big: pk(r, ['GOING OUT OF BUSINESS', 'EVERYTHING MUST GO', 'LAST DAYS', 'ALL SALES FINAL', 'FOR LEASE', 'SPACE AVAILABLE', 'STORE CLOSING', 'LOST OUR LEASE']), sub: pk(r, ['UP TO 80% OFF', 'CASH ONLY', 'CALL ' + tel(r)]), tone: pk(r, ['red', 'yellow']), lay: 'type' }) },
  // ── the docks and the yards
  { id: 'union', mix: 'svc', flav: { docks: 5, downtown: 1 }, fam: { roof: 3, wall: 3, paste: 1 },
    make: r => ({ big: pk(r, ['LOCAL 12 LONGSHOREMEN', 'LOCAL 88 HARBOR WORKERS', 'IRONWORKERS LOCAL 40', 'CARPENTERS LOCAL 3', 'DOCKWORKERS UNITED', 'LOCAL 9 TEAMS', 'PIPEFITTERS LOCAL 21', 'LOCAL 57 CRANE OPS']),
      top: pk(r, ['UNION STRONG', 'WE BUILT THIS CITY', 'SAFETY FIRST', "A FAIR DAY'S PAY"]), look: cast(r), pose: 'stand', icon: pk(r, ['hardhat', 'wrench', 'anchor']), tone: pk(r, ['blue', 'red', 'yellow']), lay: pk(r, ['bust', 'product']) }) },
  { id: 'marine', mix: 'svc', flav: { docks: 5 }, fam: { roof: 2, wall: 3, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} MARINE SUPPLY`, () => `${O(r)}'S BAIT & TACKLE`, () => `HARBOR ${pk(r, ['FISH MARKET', 'HARDWARE', 'DIESEL', 'CHANDLERY'])}`, () => `${S(r)} ROPE & CHAIN`])(),
      top: pk(r, ['ROPE · CHAIN · PAINT', 'LIVE BAIT', 'WHOLESALE', 'FUEL DOCK 24HR']), icon: pk(r, ['anchor', 'fish']), tone: pk(r, ['blue', 'white', 'teal']), lay: 'product' }) },
  { id: 'scrap', mix: 'svc', flav: { docks: 4, suburbs: 1 }, fam: { roof: 2, wall: 3, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} SALVAGE`, () => `${ST(r)} SCRAP METAL`, () => `COPPER ${pk(r, ['KING', 'CITY', 'CASH'])}`])(), top: pk(r, ['WE PAY CASH', 'COPPER · BRASS · STEEL', 'CARS · APPLIANCES']), icon: pk(r, ['wrench', 'cash']), tone: pk(r, ['yellow', 'orange']), lay: pk(r, ['product', 'type']) }) },
  // ── the suburbs and the trailer park
  { id: 'propane', mix: 'svc', flav: { suburbs: 5 }, fam: { roof: 3, wall: 3, paste: 2 },
    make: r => ({ big: pk(r, [() => 'PROPANE EXCHANGE', () => `${S(r)} TIRES`, () => `${S(r)} RENT TO OWN`, () => `${ST(r)} DISCOUNT FURNITURE`, () => `${S(r)} LAWN CARE`, () => `${S(r)} PLUMBING`, () => `${ST(r)} DOLLAR BARN`, () => `${O(r)}'S FIREWORKS`])(),
      top: pk(r, ['EXCHANGE $19', 'NEW & USED', 'NO CREDIT NEEDED', 'BINGO THURSDAYS', 'FIREWOOD $5', 'SAME DAY']), icon: pk(r, ['flame', 'tire', 'house', 'star']), tone: pk(r, ['orange', 'yellow', 'red', 'green']), lay: pk(r, ['product', 'type']) }) },
  // ── uptown: money that does not want to be looked at
  { id: 'luxury', mix: 'svc', flav: { uptown: 5, downtown: 1 }, fam: { roof: 3, wall: 3, transit: 3, paste: 1 },
    make: r => ({ big: pk(r, [() => `${S(r)} PRIVATE BANK`, () => `GALLERY ${S(r)}`, () => `${S(r)} & ${S(r)} WEALTH`, () => `DR. ${S(r)} AESTHETICS`, () => `${S(r)} PRIVATE SECURITY`, () => `CHEZ ${O(r)}`, () => `${ST(r)} YACHT CLUB`, () => `${S(r)} ART ADVISORY`])(),
      top: pk(r, ['DISCREET', 'BY APPOINTMENT', 'MEMBERS ONLY', 'YOUR MONEY · OUR SILENCE', 'SINCE 1894', 'OFFSHORE · ONSHORE', 'NO QUESTIONS · ONLY ANSWERS']), look: r() < .3 ? cast(r) : null, pose: 'stand',
      icon: pk(r, ['diamond', 'crown', 'tower', 'star']), tone: pk(r, ['ink', 'gold', 'white', 'cream']), lay: pk(r, ['type', 'editorial', 'product']) }) },
  // ── sneaker drops and fashion (≤ 15 %)
  { id: 'fashion', mix: 'fash', flav: { uptown: 4, downtown: 2, strip: 2 }, fam: { roof: 3, wall: 4, transit: 3 },
    make: r => ({ big: pk(r, LABEL), top: pk(r, ['SS27', 'FW26', 'ISSUE 09', 'THE CORNER ISSUE', 'OUT NOW', 'THE LINEUP']), grp: 'big', look: cast(r, .6), pose: pk(r, ['stand', 'stand', 'up']), tone: pk(r, ['pink', 'lime', 'cyan', 'orange', 'violet', 'yellow']), lay: 'editorial' }) },
  { id: 'drops', mix: 'fash', flav: { downtown: 2, strip: 2, uptown: 1 }, fam: { roof: 2, wall: 3, transit: 2, paste: 2 },
    make: r => ({ big: pk(r, SNEAKER), top: pk(r, ['DROP 09.28', 'RESTOCK SAT', 'RAFFLE OPEN', 'SIZE RUN LIMITED', 'LINE STARTS 6AM']), grp: 'big', icon: 'sneaker', look: r() < .4 ? cast(r) : null, pose: 'stand', tone: pk(r, ['ink', 'white', 'red', 'lime']), lay: 'product' }) },
  // ── collector culture (≤ 10 %)
  { id: 'collect', mix: 'coll', flav: { downtown: 2, uptown: 3, strip: 1 }, fam: { roof: 2, wall: 3, transit: 1, paste: 1 },
    make: r => ({ big: pk(r, [() => `${ST(r)} AUCTIONS`, () => `${pk(r, ['GRAILS', 'SLAB CITY', 'THE VAULT', 'MINT & GRADED', 'TOY VAULT', 'HOBBY SHOP'])} ${pk(r, ['CARDS', 'COLLECTIBLES', 'EXCHANGE', ''])}`, () => `${S(r)} FINE WATCHES`])(),
      top: pk(r, ['BUY · SELL · TRADE', 'GRADED CARDS', 'AUTHENTICATED', 'FIGURES · TOYS · GRAILS', 'RARE WATCHES WANTED', 'CARD SHOW SUNDAY']), icon: pk(r, ['slab', 'record', 'crown', 'star']), tone: pk(r, ['ink', 'gold', 'white', 'blue']), lay: pk(r, ['product', 'type']) }) },
  // ── internet winks (≤ 10 %): the few that land
  { id: 'net', mix: 'net', flav: { downtown: 2, strip: 2, suburbs: 1, docks: 1, uptown: 1, civic: 1 }, fam: { roof: 2, wall: 2, transit: 1, paste: 1 },
    make: r => { const [big, top, sub, icon, tone, lay] = pk(r, NETPUN); return { big, top, sub, icon, tone, lay, look: lay === 'bust' || lay === 'figure' ? { handle: pk(r, NET_CAST) } : undefined, pose: 'point' }; } },
];
export const CATEGORIES = C;

// ───────────────────────── the ghost signs: faded heritage ads (a trade and a line, sometimes a family name)
const HERITAGE = [['FURS', 'STORED'], ['PIANOS', 'TUNED'], ['SELTZER', '5¢ · ICE COLD'], ['SHOES', 'REPAIRED'], ['HATS', 'CLEANED & BLOCKED'], ['COAL & ICE', 'DELIVERED'], ['STORAGE', 'MOVING'],
  ['SILK HOSIERY', 'WHOLESALE'], ['OYSTERS', 'CLAMS · CHOWDER'], ['LAGER BEER', 'ON DRAUGHT'], ['BILLIARDS', 'PARLOR'], ['CIGARS', 'TOBACCO'], ['TAILOR', 'ALTERATIONS'], ['HOTEL', 'ROOMS $2 A NITE'],
  ['PAWNBROKER', 'LOANS'], ['BAKERY', 'BREAD 5¢'], ['DRY GOODS', 'NOTIONS'], ['SEEDS & FEED', 'HARDWARE'], ['PAINT', 'VARNISH · GLASS'], ['LUMBER', 'MILLWORK'], ['PHOTOGRAPHS', 'PORTRAITS'],
  ['TONIC', '10¢ A BOTTLE'], ['DANCE HALL', 'FRI · SAT'], ['LAUNDRY', 'WET WASH'], ['BATHS', 'RUSSIAN · TURKISH'], ['UNDERTAKER', 'OPEN DAY & NIGHT'], ['CORSETS', 'MADE TO ORDER'], ['STABLES', 'LIVERY'],
  ['ROPE & TWINE', 'SHIP CHANDLER'], ['TELEGRAM', '& CABLE CO'], ['ICE CREAM', 'SODA FOUNTAIN'], ['SARSAPARILLA', 'COLD'], ['BOXING', 'GYMNASIUM'], ['FIREPROOF', 'WAREHOUSE'], ['MOTHBALLS', 'CAMPHOR'],
  ['PICKLES', 'BY THE BARREL'], ['BRASS BEDS', 'FACTORY'], ['GARAGE', 'CARS STORED'], ['RADIO', 'REPAIRS'], ['WATCHES', 'REPAIRED'], ['UMBRELLAS', 'RECOVERED'], ['KNIVES', 'SHARPENED'], ['TRUNKS', 'LUGGAGE'], ['CANDY', 'PENNY SWEETS'],
  ['SAUSAGES', 'SMOKED DAILY'], ['CARPETS', 'BEATEN'], ['TYPEWRITERS', 'SOLD · RENTED'], ['GYMNASIUM', 'WRESTLING'], ['PRINTING', 'HANDBILLS'], ['CHOP SUEY', 'OPEN TILL 2'], ['BICYCLES', 'REPAIRED'], ['POOL ROOM', 'UPSTAIRS']];
const MAKERS = ['KESSLER', 'BUFFINGTON', 'MARKOWITZ', 'OBRIEN', 'SCHAEFFER', 'DELVECCHIO', 'GOLDFARB', 'MCALLISTER', 'VOGEL', 'LINDQVIST', 'PETRAKIS', 'ADLER', 'BRENNAN', 'KRAMER', 'ROSENBAUM', 'FALCONE'];
// (gag: the heritage trade, what the census calls the same ghost sign; the kit list's old names map onto their trades)
const GH0_GAG = { 'KESSLER FURS': 'FURS', BUFFINGTON: 'PIANOS', 'EAGLE SHOE': 'SHOES', 'GRAMPA JOE': 'TONIC', 'HOTEL ROOMS': 'HOTEL' };
function ghostDesigns(r) { const out = []; for (const [a, b] of HERITAGE) { out.push({ big: a, sub: b, lay: 'ghost', cat: 'ghost', mix: 'svc', flav: { any: 1 }, gag: a });
  out.push({ big: `${pk(r, MAKERS)} & SONS`, top: a, sub: b, lay: 'ghost', cat: 'ghost', mix: 'svc', flav: { any: 1 }, gag: a }); } for (const [a, b] of GH0) out.push({ big: a, sub: b, lay: 'ghost', cat: 'ghost', mix: 'svc', flav: { any: 1 }, gag: GH0_GAG[a] || a }); return out; }

// ───────────────────────── the pools
// designs per flavour per family (a block draws ≤ 1 roof board, ≤ ~6 wall pieces, ≤ 3 ghosts, ≤ ~8 paste-ups, ≤ 2 transit ads)
const COUNT = { roof: { downtown: 72, strip: 48, docks: 48, suburbs: 48, uptown: 36, civic: 36 }, wall: { downtown: 128, strip: 80, docks: 80, suburbs: 64, uptown: 48, civic: 48 },
  paste: { downtown: 64, strip: 64, docks: 48, suburbs: 48, uptown: 16, civic: 32 }, transit: { downtown: 40, strip: 24, docks: 16, suburbs: 16, uptown: 16, civic: 16 } };
export const CAP = { fash: .12, coll: .08, net: .06 };             // share of each (family, flavour) pool, under STYLE's 15 / 10 / 10 %
const KEYS = new Set();
const keyOf = d => String(d.key || d.big).toUpperCase().replace(/\s+/g, ' ').trim();
function generate(fam, fl, n, seed) {
  const r = rng(seed), out = [], mix = { fash: 0, coll: 0, net: 0 };
  const cats = C.filter(c => (c.fam[fam] || 0) > 0 && ((c.flav[fl] || 0) > 0 || c.mix === 'net')).map(c => [c, (c.fam[fam] || 0) * ((c.flav[fl] || 0) + (c.mix === 'net' ? .6 : 0))]);
  const total = cats.reduce((s, [, w]) => s + w, 0);
  for (let t = 0; out.length < n && t < n * 40; t++) {
    let x = r() * total, cat = cats[0][0]; for (const [c, w] of cats) { if ((x -= w) < 0) { cat = c; break; } }
    if (cat.mix !== 'svc' && mix[cat.mix] + 1 > CAP[cat.mix] * n) continue;
    const d = cat.make(r); if (d.grp === 'big') { d.grp = keyOf({ big: d.big }); d.key = d.grp + ' · ' + String(d.top || '').toUpperCase(); } d.key = keyOf(d); if (!d.key || KEYS.has(d.key) || ALL_NAMES.has(d.key)) continue;
    KEYS.add(d.key); Object.assign(d, { cat: cat.id, mix: cat.mix, flav: cat.flav, home: fl, fam, id: `${fam}:${cat.id}:${out.length}:${fl}` }); if (cat.mix !== 'svc') mix[cat.mix]++; d.net = cat.mix === 'net' || isNet(d.big) || isNet(d.top);
    out.push(d); }
  return out;
}
export const POOLS = {};
for (const fam of ['roof', 'wall', 'transit', 'paste']) { const all = []; FLAVOURS.forEach((fl, k) => all.push(...generate(fam, fl, COUNT[fam][fl], 7919 * (k + 1) + fam.length * 104729))); POOLS[fam] = makePool(fam, all, 17 + fam.length); }
{ const r = rng(4242), gs = ghostDesigns(r).map((d, k) => ({ ...d, key: keyOf(d), fam: 'ghost', home: 'any', id: 'ghost:' + k })).filter(d => { if (KEYS.has(d.key)) return false; KEYS.add(d.key); return true; }); POOLS.ghost = makePool('ghost', gs, 31); }
POOLS.neon = makePool('neon', NEON_WORDS.map((w, k) => ({ key: w, big: w, flav: { any: 1 }, home: 'any', fam: 'neon', id: 'neon:' + k, net: isNet(w) })), 41);
POOLS.throw = makePool('throw', THROW_WORDS.map((w, k) => ({ key: w, big: w, flav: { any: 1 }, home: 'any', fam: 'throw', id: 'throw:' + k, net: isNet(w) })), 43);

// ───────────────────────── THE RESERVE (signage pass 4; reserve.js): new categories, heritage trades and words the lattice never draws. The swap
// table (swaps.js) hands them to the signs that repeated a gag (alloc.js swapped). Generated here, after the live pools and from seeds of its
// own, so every live pool is exactly what it was. Keys stay unique across everything (designs, shop names, neon and throw-up words).
const WORDS = new Set([...NEON_WORDS, ...THROW_WORDS, ...NEON_SHORT, ...THROW_SHORT, ...TAGS, ...SHOPS.map(x => String(x[0])), ...Object.values(GROW_WORD), ...DELIS.map(String), ...Object.values(SHORT_WORD)]);
const clash = k => !k || KEYS.has(k) || ALL_NAMES.has(k) || WORDS.has(k) || isNet(k);
// a reserve brand that already has a key (the same hospital on a roof and on a wall): the key takes its line too, so it stays one of a kind
const freeKey = d => { const k = keyOf(d); if (!clash(k)) return k; if (!d.top) return null; const k2 = keyOf({ big: d.big + ' · ' + d.top }); return clash(k2) ? null : k2; };
const RES_N = { roof: 6, wall: 8, transit: 5, paste: 6 };
export const RESERVE_INFO = {};                                                // fam → [{ gag, mix, flav, n }] (tools/signswap.mjs)
for (const fam of ['roof', 'wall', 'transit', 'paste']) { RESERVE.gag[fam] = {}; RESERVE_INFO[fam] = [];
  RESERVE_CATS.forEach((cat, ci) => { if (!(cat.fam[fam] > 0)) return; const r = rng(90001 + ci * 7919 + fam.length * 131), out = [];
    for (let t = 0; out.length < RES_N[fam] && t < RES_N[fam] * 30; t++) { const d = cat.make(r); d.key = freeKey(d); if (!d.key || isNet(d.top) || isNet(d.sub)) continue; KEYS.add(d.key);
      Object.assign(d, { cat: cat.id, gag: cat.id, mix: cat.mix, flav: cat.flav, home: 'any', fam, id: `res:${fam}:${cat.id}:${out.length}`, net: false }); out.push(d); }
    if (out.length) { RESERVE.gag[fam][cat.id] = out; RESERVE_INFO[fam].push({ gag: cat.id, mix: cat.mix, flav: cat.flav, n: out.length, w: cat.fam[fam], looks: out.filter(d => d.look).length }); } }); }
{ const r = rng(90907); RESERVE.gag.ghost = {}; RESERVE_INFO.ghost = [];
  for (const [a, b] of HERITAGE2) { const L = []; for (const d of [{ big: a, sub: b }, { big: `${pk(r, MAKERS2)} & SONS`, top: a, sub: b }]) { const k = d.top ? keyOf({ big: d.big + ' · ' + d.top }) : keyOf(d); if (clash(k)) continue; KEYS.add(k);
      L.push({ ...d, key: k, lay: 'ghost', cat: 'ghost', gag: a, mix: 'svc', flav: { any: 1 }, home: 'any', fam: 'ghost', id: 'res:ghost:' + k }); }
    if (L.length) { RESERVE.gag.ghost[a] = L; RESERVE_INFO.ghost.push({ gag: a, mix: 'svc', flav: { any: 1 }, n: L.length, w: 1 }); } } }
for (const [fam, list] of [['neon', NEON2], ['throw', THROW2]]) { RESERVE.word[fam] = {}; RESERVE_INFO[fam] = [];
  for (const w of list) { if (clash(w)) continue; RESERVE.word[fam][w] = { key: w, big: w, flav: { any: 1 }, home: 'any', fam, id: `res:${fam}:${w}`, net: false }; RESERVE_INFO[fam].push({ gag: w, mix: 'svc', flav: { any: 1 }, n: 1, w: 1 }); WORDS.add(w); } }
export const byKey = key => { for (const P of Object.values(POOLS)) for (const S of P.part) for (const d of S) if (d.key === key) return d;
  for (const G of Object.values(RESERVE.gag)) for (const L of Object.values(G)) for (const d of L) if (d.key === key) return d; for (const W of Object.values(RESERVE.word)) if (W[key]) return W[key]; return null; };
