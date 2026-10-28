// ST. MERCY · THE ER BAY (block 4,−2): the ambulance court off Bishop Ave under the EMERGENCY canopy, the cobalt ER wing (WAIT 6 HRS over the doors, ER on a blade, a red cross on its roof), the oxygen yard, the tower's north-west quarter.
// Owner: the St. Mercy / Route 9 agent. The compound is authored once in world metres (districts/hospital/build.js); this block builds
// its own slice of every part that reaches it — the four slices of the tower and the helipad meet exactly on the block lines.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { campus } from '../districts/hospital/build.js';

export function erBay(bank, b, A) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { campus(ctx); } finally { REG.strict = false; }
}
