// STORE OBJECTS · the set (owner: the store-objects agent). Exports OBJECTS in FORMAT.md's shape, the Vol convention (shared with the
// home set: interiors/home/lib.js volFor), and the map a later store-interiors pass needs: which objects furnish which shop, keyed by
// the city's own shop kinds (signage/lexicon.js SHOPS → disp) and trades.
import { Vol } from '../../vox.js';
import bodega from './bodega.js';
import pawn from './pawn.js';
import wear from './wear.js';
import food from './food.js';
import cash from './cash.js';
import extra from './extra.js';

export const OBJECTS = [...bodega, ...pawn, ...wear, ...food, ...cash, ...extra];

// the Vol an object draws into: origin = the footprint's back-left corner (floor or surface), the bottom-left of its face on the wall,
// or its back-left on the ceiling plane (hanging down to −h). near 0.05 m, far 0.1 m; the far Vol rounds odd footprints UP (a 3-cell
// piece is 0.8 m at 0.1: its far version may reach 0.05 m past its footprint on the +x/+z side).
export function volFor(o, far = false) {
  const k = far ? 2 : 1, s = .05 * k, [a, b] = o.foot, n = c => Math.ceil(c * 5 / k), ny = Math.max(1, Math.ceil(o.h / s - 1e-6));
  if (o.place === 'wall') return new Vol(n(a), n(b), ny, { s, org: [0, 0, 0], ground: false });
  if (o.place === 'ceiling') return new Vol(n(a), ny, n(b), { s, org: [0, -ny * s, 0], ground: false });
  return new Vol(n(a), ny, n(b), { s, org: [0, 0, 0], ground: true });
}
export const byId = id => OBJECTS.find(o => o.id === id);
// FORMAT's convention (wave 2, same as the home set): an object or its id; state defaults to the first of `states`; null when there is no far
export function buildObject(o, { variant = 0, seed = 1, state, far = false } = {}) {
  if (typeof o === 'string') o = byId(o); if (far && !o.far) return null;
  const V = volFor(o, far); (far ? o.far : o.build).call(o, V, { variant, seed, state: state ?? o.states?.[0] }); V.kind = o.id; return V;
}

// ───────────────────────── the shop kinds (an object's `tiers`): the city's window-display kinds (signage/lexicon.js SHOPS[k][2],
// gen.js `disp`) plus 'bodega' for the bodega lot type (gen.js: type 'bodega', disp 'food', a DELIS name)
export const SHOP_KINDS = ['bodega', 'food', 'cakes', 'phones', 'clothes', 'shoes', 'gold', 'bottles', 'machines', 'office', 'misc', 'barber'];

// ───────────────────────── fit-outs: what furnishes one shop, by where it goes. back = the back wall · side = along a side wall ·
// floor = the middle of the room · counter = by the door, clerk behind · wall = wall pieces · top = surface pieces (on counter and
// shelf tops) · ceiling · backroom (bodega: the stockroom, wave 2). A fill pass picks per slot, varies the variant per shop, and puts `far` behind the glass.
const LIGHTS = ['store-fluoro-light'], SEC = ['store-security-camera', 'store-sign-on-camera'];
export const FITOUTS = {
  bodega: { back: ['store-cooler'], side: ['store-shelf-chips', 'store-shelf-cereal', 'store-shelf-cans', 'store-coffee-station', 'store-deli-case'], floor: ['store-gondola', 'store-ice-cream-chest', 'store-case-stack', 'store-news-rack', 'store-atm'],
    counter: ['store-counter-bodega'], backroom: ['store-stockroom-shelf', 'store-case-stack'], wall: ['store-backbar', 'store-sign-no-loitering', 'store-sign-cash-only', 'store-menu-board', ...SEC], top: ['store-cat-loaf', 'store-slicer', 'store-cctv-monitor'], ceiling: LIGHTS },
  pizza: { back: ['store-pizza-oven', 'store-pizza-boxes'], side: ['store-cooler', 'store-counter-stool'], floor: ['store-diner-booth', 'store-claw-machine'], counter: ['store-slice-counter'], wall: ['store-menu-board', 'store-sign-cash-only'], top: [], ceiling: ['store-ceiling-fan', ...LIGHTS] },
  diner: { back: ['store-diner-counter'], side: ['store-diner-booth'], floor: ['store-counter-stool'], counter: ['store-register-counter'], wall: ['store-menu-board'], top: ['store-pie-case', 'store-register'], ceiling: ['store-ceiling-fan'] },
  takeout: { back: ['store-diner-counter', 'store-cooler'], side: ['store-waiting-chairs'], floor: ['store-counter-stool'], counter: ['store-register-counter'], wall: ['store-menu-board', 'store-sign-cash-only'], top: ['store-register'], ceiling: LIGHTS },
  bakery: { back: ['store-diner-counter', 'store-coffee-station'], side: ['store-counter-stool'], floor: [], counter: ['store-register-counter'], wall: ['store-menu-board'], top: ['store-pie-case', 'store-register'], ceiling: LIGHTS },
  pawn: { back: ['store-cage-counter'], side: ['store-gold-case', 'store-pawn-shelf', 'store-tv-stack'], floor: ['store-gold-case', 'store-shoebox-stack'], counter: ['store-cage-counter'], wall: ['store-guitar-wall', 'store-sign-we-buy-gold', ...SEC], top: ['store-cctv-monitor'], ceiling: LIGHTS },
  sneakers: { back: ['store-register-counter'], side: [], floor: ['store-tryon-bench', 'store-shoe-mirror', 'store-grail-case', 'store-shoebox-stack'], counter: ['store-register-counter'], wall: ['store-shoe-wall'], top: [], ceiling: LIGHTS },
  streetwear: { back: ['store-fitting-room', 'store-register-counter'], side: ['store-clothes-rack'], floor: ['store-mannequin', 'store-display-table', 'store-clothes-rack'], counter: ['store-register-counter'], wall: [], top: [], ceiling: LIGHTS },
  cards: { back: ['store-grading-counter'], side: ['store-binder-shelf', 'store-slab-case'], floor: ['store-play-table', 'store-slab-case'], counter: ['store-slab-case'], wall: ['store-sign-cash-only', ...SEC], top: ['store-register'], ceiling: LIGHTS },
  laundromat: { back: ['store-dryer-stack', 'store-change-machine'], side: ['store-washer-pair', 'store-dryer-stack', 'store-vending-machine'], floor: ['store-folding-table', 'store-laundry-cart', 'store-waiting-chairs', 'store-claw-machine'], counter: [], wall: ['store-sign-no-loitering', 'store-security-camera'], top: [], ceiling: ['store-ceiling-fan', ...LIGHTS] },
  barber: { back: ['store-waiting-chairs'], side: ['store-barber-chair', 'store-clipper-cart'], floor: [], counter: ['store-register-counter'], wall: ['store-barber-station', 'store-barber-poster', 'store-barber-pole'], top: [], ceiling: ['store-ceiling-fan', ...LIGHTS] },
  liquor: { back: ['store-liquor-wall', 'store-stockroom-shelf'], side: ['store-liquor-wall'], floor: ['store-case-stack'], counter: ['store-liquor-window'], wall: ['store-sign-cash-only', ...SEC], top: ['store-scratch-rack', 'store-lotto-terminal'], ceiling: LIGHTS },
  checks: { back: ['store-plexi-window'], side: ['store-waiting-chairs', 'store-atm', 'store-vending-machine'], floor: ['store-form-desk'], counter: ['store-plexi-window'], wall: ['store-sign-no-loitering', 'store-sign-cash-only', ...SEC], top: ['store-lotto-terminal'], ceiling: LIGHTS },
  office: { back: ['store-register-counter'], side: ['store-waiting-chairs'], floor: ['store-form-desk'], counter: ['store-register-counter'], wall: ['store-sign-cash-only', 'store-security-camera'], top: [], ceiling: ['store-ceiling-fan', ...LIGHTS] },
  pharmacy: { back: ['store-register-counter'], side: ['store-pharmacy-shelf'], floor: ['store-aisle-99'], counter: ['store-register-counter'], wall: ['store-security-camera'], top: ['store-register'], ceiling: LIGHTS },
  dollar: { back: ['store-shelf-cans', 'store-stockroom-shelf'], side: ['store-shelf-cans', 'store-pharmacy-shelf'], floor: ['store-aisle-99'], counter: ['store-register-counter'], wall: ['store-sign-no-loitering', 'store-security-camera'], top: ['store-register'], ceiling: LIGHTS },
  phones: { back: ['store-register-counter'], side: ['store-phone-case'], floor: ['store-phone-case'], counter: ['store-phone-case'], wall: ['store-sign-cash-only', 'store-security-camera'], top: ['store-register'], ceiling: LIGHTS },
  // hardening (2026-10-05) · Gatehill's shops (fill.js nicheRoom): a florist's glass coolers, a jeweller's cases, a wine cellar, a gallery
  florist: { back: ['store-cooler'], side: ['store-display-table', 'store-case-stack'], floor: ['store-display-table', 'store-case-stack'], counter: ['store-register-counter'], wall: [], top: ['store-register'], ceiling: LIGHTS },
  jeweler: { back: ['store-gold-case'], side: ['store-gold-case', 'store-grail-case'], floor: ['store-grail-case', 'store-gold-case'], counter: ['store-gold-case'], wall: ['store-security-camera'], top: [], ceiling: LIGHTS },
  cellar: { back: ['store-liquor-wall'], side: ['store-liquor-wall', 'store-stockroom-shelf'], floor: ['store-case-stack', 'store-display-table'], counter: ['store-register-counter'], wall: [], top: ['store-register'], ceiling: LIGHTS },
  gallery: { back: ['store-display-table'], side: ['store-grail-case'], floor: ['store-display-table', 'store-grail-case'], counter: ['store-register-counter'], wall: [], top: [], ceiling: LIGHTS },
  general: { back: ['store-register-counter'], side: ['store-waiting-chairs', 'store-vending-machine', 'store-claw-machine'], floor: [], counter: ['store-register-counter'], wall: ['store-sign-cash-only', 'store-security-camera'], top: ['store-register'], ceiling: ['store-ceiling-fan', ...LIGHTS] },
};
// the lexicon's trades (signage/lexicon.js SHOPS, tradeOf(name)) → a fit-out; anything unlisted falls back on its disp kind
export const TRADE_FITOUT = { PIZZA: 'pizza', DINER: 'diner', CANTEEN: 'diner', CAFE: 'diner', COFFEE: 'diner', BAGELS: 'bodega', HEROES: 'bodega', 'SMOKE SHOP': 'bodega',
  DONUTS: 'bakery', BAKERY: 'bakery', PAWN: 'pawn', GOLD: 'pawn', 'NO QS': 'pawn', GRILLZ: 'pawn', JEWELRY: 'pawn', 'WE BUY': 'pawn', SURPLUS: 'pawn', 'SPY SHOP': 'pawn',
  SNEAKERS: 'sneakers', RESTOCK: 'sneakers', RESALE: 'sneakers', 'BIG SIZES': 'sneakers', SKATE: 'sneakers', STREETWEAR: 'streetwear', FITS: 'streetwear', HATS: 'streetwear', TEES: 'streetwear',
  OUTLET: 'streetwear', THRIFT: 'streetwear', CLEANERS: 'streetwear', CARDS: 'cards', COMICS: 'cards', LAUNDROMAT: 'laundromat', LAUNDRY: 'laundromat', BARBER: 'barber', CUTS: 'barber',
  NAILS: 'barber', TATTOO: 'barber', LIQUORS: 'liquor', WINE: 'liquor', 'CHECKS CASHED': 'checks', 'MONEY WIRE': 'checks', LOANS: 'checks', 'BAIL BONDS': 'checks',
  LAW: 'office', 'TAX PREP': 'office', NOTARY: 'office', 'PRIVATE EYE': 'office', COPIES: 'office', STORAGE: 'office', PHARMACY: 'pharmacy', '99¢': 'dollar',
  'PHONE FIX': 'phones', PREPAID: 'phones', WIRELESS: 'phones' };
export const DISP_FITOUT = { food: 'takeout', cakes: 'bakery', phones: 'phones', clothes: 'streetwear', shoes: 'sneakers', gold: 'pawn', bottles: 'liquor', machines: 'laundromat', office: 'office', misc: 'general', barber: 'barber' };
// a shop's fit-out from what gen.js knows about it: the lot type, the shop's disp and its trade (lexicon.js tradeOf(sh.name))
export const fitoutFor = ({ type, disp, trade } = {}) => type === 'bodega' ? 'bodega' : TRADE_FITOUT[trade] || DISP_FITOUT[disp] || 'general';
