// ST. MERCY · THE SMOKERS' CORNER (4,−1): the garden on Bishop Ave, the forecourt's west half — the smokers (a wheelchair, an IV pole) under the plate that says not to, the vending machines, the saint with a traffic cone on her head — the tower's south-west quarter and the neon cross.
// Owner: the St. Mercy / Route 9 agent. The compound is authored once in world metres (districts/hospital/build.js); this block builds
// its own slice of every part that reaches it — the four slices of the tower and the helipad meet exactly on the block lines.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { campus } from '../districts/hospital/build.js';

export function smokers(bank, b, A) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { campus(ctx); } finally { REG.strict = false; }
}
