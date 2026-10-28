// Glasswall · the downtown fringe, block 4,−3 · east: medical offices round St. Mercy, shading north. Owner: the downtown fringe agent (batch 5).
// The side's trades, gates and office names come from districts/downtown/fringe.js; this block's own hand tuning goes in the second argument.
import { fringeOverride } from '../districts/downtown/fringe.js';
// the corner shop (L1): its Nash St display is carved 1.1 m in through the corner and cut the edge off the 3rd St window's card (the
// audit's text-overhang, a core corner collision): a new seed puts that shop's card and door elsewhere
export default fringeOverride(4, -3, { lots: { L1: s => { s.seed += 7; } } });
