// ST. MERCY · THE MAIN ENTRANCE (5,−1): the glass lobby and the MAIN ENTRANCE canopy on Central Ave, the flower cart, a cab at the curb, the Medical Arts building (MERCY RX and its green cross, GET WELL, the injury doctor upstairs, a billboard on the roof), the garage's pay booth, the tower's south-east quarter.
// Owner: the St. Mercy / Route 9 agent. The compound is authored once in world metres (districts/hospital/build.js); this block builds
// its own slice of every part that reaches it — the four slices of the tower and the helipad meet exactly on the block lines.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { campus } from '../districts/hospital/build.js';

export function entrance(bank, b, A) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { campus(ctx); } finally { REG.strict = false; }
}
