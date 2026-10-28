// ROUTE 9 · LAST CHANCE (block 7,4): the gas canopy on Route 9 and its pump island, the food mart (FOOD BEER ICE LOTTO, a billboard on its roof facing the highway), the price pylon, and a semi on the shoulder with its back doors open on a load of shoe boxes.
// Owner: the St. Mercy / Route 9 agent. The block is authored in world metres in districts/highway/build.js.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { gasBlock } from '../districts/highway/build.js';

export function gasStation(bank, b, A) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { gasBlock(ctx); } finally { REG.strict = false; }
}
