// IRON ISLAND + THE LONG BRIDGE · the block builder (owner: the water-side agent, batch 5). Every block of the kit comes through here:
// the island's six (the compound: shore, wall, towers, buildings, floors) and the three sea blocks the bridge and the quay cross.
// A hero (heroes/jail-*.js) passes its own content, drawn after the shared parts and before the block is meshed.
import { blockCtx } from '../../engine.js';
import { REG, fin, gull, stamp, stampA, inBlock, H, SIDE, CV, JAIL_MAP, put, stampAAt } from './lib.js';
import { shore, ground, walls, guardTowers, cellBlock, intake, gatehouse, roadDeck, onRocks } from './island.js';
import { bridgeBlock, bridgeLife } from './bridge.js';
import { ISLAND, GTOWERS } from './plan.js';
import { P0 } from '../../../../world/city.js';
export { jailFar } from './far.js';

export function buildJail(ctx, hero = null) {
  ctx.J = {}; ctx.map = JAIL_MAP; const island = ctx.j <= -10;   // (SPREAD: today's metres → the spread world, lib.js JAIL_MAP)
  if (island) { ctx.group('shore'); shore(ctx); walls(ctx); guardTowers(ctx); cellBlock(ctx); intake(ctx); gatehouse(ctx); if (ctx.j === -10) roadDeck(ctx); ctx.group('ground'); ground(ctx); }
  else bridgeBlock(ctx);
  if (hero) { ctx.group('hero'); hero(ctx); }
  if (!island) bridgeLife(ctx);
  gulls(ctx);
  fin(ctx);
}
// gulls: a few on the riprap's high points (standing), one or two over the water (in flight: stamped at an angle, no support needed)
function gulls(ctx) {
  ctx.group('gulls'); const n = ctx.J.rockT ? 3 : 1;
  const F = [ctx.i * P0, ctx.j * P0];   // (SPREAD: today's corner; lib.js maps every placement)
  for (let k = 0; k < n; k++) { const x = F[0] + 4 + H(ctx.i, ctx.j, 90 + k) * 24, z = F[1] + 4 + H(ctx.i, ctx.j, 95 + k) * 24;
    const spot = ctx.J.rockT ? onRocks(ctx, ctx.i === 7 ? ISLAND.x0 + (k - 1) * .6 : ISLAND.x1 + (k - 1) * .6, z) || onRocks(ctx, x, ISLAND.z0) : null;
    if (spot && inBlock(ctx, spot[0], spot[2])) put(ctx, gull(k), spot[0], spot[2], { rot: (k * 3 + ctx.i) & 3, y: spot[1], reach: .4 }); }
  const fx = F[0] + 6 + H(ctx.i, ctx.j, 99) * 20, fz = F[1] + 6 + H(ctx.j, ctx.i, 98) * 20;
  if (!ctx.J.cells) stampAAt(ctx, gull(ctx.i + ctx.j, true), H(ctx.i, ctx.j, 97) * 6.28, fx, 9 + H(ctx.i, ctx.j, 96) * 7, fz);
}
// a hero module's entry: the engine's guarded context, strict placement, the shared parts, the hero's own content
export function heroBlock(bank, b, A, kit, content) {
  const ctx = blockCtx(bank, b, A, kit); REG.strict = true;
  try { buildJail(ctx, content); } finally { REG.strict = false; }
}
