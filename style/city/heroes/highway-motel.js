// ROUTE 9 · MOTEL 9 (block 7,5): a pink two-storey wing of twelve rooms, its walkway and stair, the googie office, the pole sign with the big neon 9, the pool behind its fence, the ice machine — and room 9 upstairs, where the loan shark works.
// Owner: the St. Mercy / Route 9 agent. The block is authored in world metres in districts/highway/build.js.
import { blockCtx } from '../engine.js';
import { GEN } from '../gen.js';
import { REG } from '../audit.js';
import { motelBlock } from '../districts/highway/build.js';

export function motel9(bank, b, A) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { motelBlock(ctx); } finally { REG.strict = false; }
}
