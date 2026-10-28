// Glasswall · the downtown fringe, block 5,0 (a parking block) · east: medical offices round St. Mercy. Owner: the downtown fringe agent (batch 5).
// The side's trades, gates and office names come from districts/downtown/fringe.js; this block's own hand tuning goes in the second argument.
//   L0, the one-storey corner across Central Ave from St. Mercy, is the east side's diner, CODE BLUE (the night shift's, the cops', the
//   waiting room's): its name on the blue board over the parapet, DINER in cyan neon over a steel front on both streets, the counter in
//   the window (no blade: on one storey the core's blade is cut off at the roof). (Fix round: the side's deck had the diner trade but no lot ever drew it.)
import { fringeOverride } from '../districts/downtown/fringe.js';
export default fringeOverride(5, 0, { lots: { L0: s => {
  if (s.type !== 'shop2' || s.ground !== 'shop') return;
  s.shops = [{ name: 'DINER', sign: 0x2de2e6, disp: 'food', kind: 'neon', gate: false, blade: false, band: 0xb9bec6 }];
  Object.assign(s, { cornice: 'sign', plaque: 'CODE BLUE', accent: 0x2f5bff });
  s.seed += 5;   // (the Central Ave window then says OPEN 24HR and the board HOT: the plain seed gave HOT FOOD, the pho shop's pitch across the street)
} } });
