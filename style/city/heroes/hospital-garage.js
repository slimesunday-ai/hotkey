// ST. MERCY · THE GARAGE BLOCK (5,−2): the parking garage on Orchard St (a colour for every level, cars on every deck, the blue P), the 1889 wing (pathology, the morgue, the hearse at its steel doors), the loading dock, the tower's north-east quarter — the sim's hospital (161, −33) is here.
// Owner: the St. Mercy / Route 9 agent. The compound is authored once in world metres (districts/hospital/build.js); this block builds
// its own slice of every part that reaches it — the four slices of the tower and the helipad meet exactly on the block lines.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { campus } from '../districts/hospital/build.js';

export function garage(bank, b, A) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { campus(ctx); } finally { REG.strict = false; }
}
