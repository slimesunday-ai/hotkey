// BLACKPINE WOODS · what every woods hero shares (owner: the Blackpine Woods agent). Worker-safe.
// A hero block is a woods block first (floor, verge, trees, scatter, the one-offs) with its own piece built into a yard the plan keeps
// clear (plan.js YARDS). It builds through blockCtx with strict placement on, like the kit's own blocks, and meshes at the end.
import { blockCtx } from '../../engine.js';
import { GEN } from '../../gen.js';
import { REG } from '../../audit.js';
import { Vol } from '../../vox.js';
import { SIDE, CV } from '../../style.js';
import { woods } from './woods.js';

export function hero(bank, b, A, o, build) {
  const ctx = blockCtx(bank, b, A, GEN.kit); REG.strict = true;
  try { woods(ctx, o); build(ctx); ctx.finish(); } finally { REG.strict = false; }
  return ctx;
}
// a building volume on the forest floor: x0…x1, z0…z1 in metres (a margin `pad` all round for eaves and chimneys), h tall;
// registered as a mass (props keep clear, people could stand on its roof at roofY) — draw into V with cell coordinates (B = the body)
export function shed(ctx, x0, z0, x1, z1, h, o = {}) {
  const pad = o.pad ?? 6, nx = Math.round((x1 - x0) / CV) + 2 * pad, nz = Math.round((z1 - z0) / CV) + 2 * pad, ny = Math.round(h / CV) + (o.extra ?? 20);
  const V = new Vol(nx, ny, nz, { s: CV, org: [x0 - pad * CV, SIDE, z0 - pad * CV], ground: true });
  ctx.mass(V, [x0, z0, x1, z1], { top: SIDE + ny * CV, roofY: SIDE + (o.roofY ?? h) });
  return { V, B: { x0: pad, z0: pad, x1: nx - pad, z1: nz - pad }, pad, cell: (x, z) => [Math.round((x - x0) / CV) + pad, Math.round((z - z0) / CV) + pad] };
}
