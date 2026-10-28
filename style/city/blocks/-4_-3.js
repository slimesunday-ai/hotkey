// Glasswall · the downtown fringe, block −4,−3 · west: tenements toward Sunny Acres and the mall, shading north. Owner: the downtown fringe agent (batch 5).
// The side's trades, gates and office names come from districts/downtown/fringe.js; this block's own hand tuning goes in the second argument.
import { fringeOverride } from '../districts/downtown/fringe.js';
// a dog the generator sat in a yard lands 6 voxels into the yard's deck (placeDogs tests props, not yard parts): left out here
export default fringeOverride(-4, -3, { remove: ['-4_-3·dogs·dog·0'] });
