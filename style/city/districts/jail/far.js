// IRON ISLAND + THE LONG BRIDGE · the far tier (0.5 m cubes, a few ms a block): the same plan as flat boxes — the ground by zone, the
// riprap, the wall ring, the towers, the cell block with its roof letters, the court, the lighthouse's bands, the bridge's green towers
// and truss. Walls lean toward the haze (air); the ground keeps its colour. At night the lit things glow (the lantern, the windows'
// share, the bulbs on the span, the boards), so the island and the bridge read across the bay.
import { C, SIDE, TOD, H, air, px, JAIL_MAP, mrect } from './lib.js';
import { ISLAND, WALL, GTOWERS, LIGHT, NE_CUT, CELLS, INTAKE, VISIT, GATEHOUSE, SALLY, COURT, R9, IR, TOWERS, LEG, GIRDER, HOUSE, SPAN, WALKN } from './plan.js';
import { floorColour, rockTop, WALLS } from './island.js';
import { P0 as PITCH, SPREAD } from '../../../../world/city.js';   // (SPREAD: today's pitch — the plan is today's metres, mapped into the spread world box by box)

export function jailFar(ctx) {
  ctx.map = JAIL_MAP; const N = TOD.night, x0 = ctx.i * PITCH, z0 = ctx.j * PITCH, L = N ? 3 : 0;
  // (SPREAD: every box goes through lib.js's map; the ground loop runs 4 m past today's square, so the new cell is covered where a
  // compound's block spills over its line, and the far volume clips the rest)
  const b = SPREAD ? (a0, y0, c0, a1, y1, c1, c, l) => { const r = mrect(ctx, [a0, c0, a1, c1]); ctx.box(r[0], y0, r[1], r[2], y1, r[3], c, l); } : ctx.box, g = SPREAD ? 4 : 0;
  const onIsland = ctx.j <= -10;
  if (onIsland) {
    // the ground, 1 m at a time (the slab's paint shows where nothing is drawn); rocks where the riprap is
    for (let x = x0 - g; x < x0 + PITCH + g; x += 1) for (let z = z0 - g; z < Math.min(z0 + PITCH + g, WALKN); z += 1) { const cx = x + .5, cz = z + .5, t = rockTop(cx, cz);
      if (t > .2) { b(x, SIDE, z, x + 1, SIDE + Math.max(.5, t), z + 1, air(C.rock[(H(x, z, 3) * 5) | 0], .15)); continue; }
      const c = floorColour(cx, cz); if (c !== null) b(x, SIDE, z, x + 1, SIDE + .5, z + 1, c); }
    b(x0, SIDE, WALKN, x0 + PITCH, SIDE + .5, WALKN + 2, 0xcdc5b8);
    const top = SIDE + WALL.h + .4;
    for (const r of WALLS) b(r[0], SIDE, r[1], r[2], top, r[3], air(C.bone));
    for (let s = 0; s < NE_CUT; s += .5) b(WALL.x1 - NE_CUT + s - .5, SIDE, WALL.z0 + s - .5, WALL.x1 - NE_CUT + s + .5, top, WALL.z0 + s + .5, air(C.bone));
    for (const t of GTOWERS) { const cy = SIDE + t.h - 3.2; b(t.x - 1.3, SIDE, t.z - 1.3, t.x + 1.3, cy, t.z + 1.3, air(C.pale)); b(t.x - 2, cy, t.z - 2, t.x + 2, cy + 1, t.z + 2, air(t.trim, .2));
      b(t.x - 2, cy + 1, t.z - 2, t.x + 2, cy + 2.5, t.z + 2, N ? C.litLo : air(C.glass, .2), L); b(t.x - 2.5, cy + 2.5, t.z - 2.5, t.x + 2.5, cy + 3, t.z + 2.5, air(C.slate, .2));
      if (t.roof === 'cone') b(t.x - 1, cy + 3, t.z - 1, t.x + 1, cy + 5.5, t.z + 1, air(t.trim, .2)); else if (t.roof === 'hip') b(t.x - 1.5, cy + 3, t.z - 1.5, t.x + 1.5, cy + 4, t.z + 1.5, air(C.slate, .2)); }
    // the cell block: its mass, windows as darker rows (lit ones at night), the roof with IRON ISLAND in yellow
    { const [a0, c0, a1, c1] = CELLS.r, h = SIDE + CELLS.h; b(a0, SIDE, c0, a1, h, c1, air(C.bone));
      for (const y of [1.3, 4.3, 7.3, 10.3]) for (let x = a0 + 1; x < a1 - 1; x += 1.5) { const on = N && H(x * 2, y, 7) > .6; b(x, SIDE + y, c1 - .5, x + .5, SIDE + y + 1.4, c1, on ? C.litHi : air(C.navy, .2), on ? 3 : 0); b(x, SIDE + y, c0, x + .5, SIDE + y + 1.4, c0 + .5, air(C.navy, .2)); }
      b(a0 + .5, h, c0 + .5, a1 - .5, h + .5, c1 - .5, 0x777a84);
      const M = px('IRON ISLAND'), sx = .6, w = M.w * sx, ux = (a0 + a1) / 2 - w / 2, uz = c0 + 5.9;
      for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) b(ux + i * sx, h, uz + j * sx, ux + i * sx + .5, h + .5, uz + j * sx + .5, C.yellow); }
    for (const [r, h, c] of [[INTAKE.r, INTAKE.h, C.pale], [VISIT.r, VISIT.h, C.cobalt], [GATEHOUSE.r, GATEHOUSE.h, C.bone]]) b(r[0], SIDE, r[1], r[2], SIDE + h, r[3], air(c));
    b(VISIT.r[0], SIDE + VISIT.h - 1, VISIT.r[3] - .5, VISIT.r[2], SIDE + VISIT.h, VISIT.r[3], N ? C.litHi : C.chalk, L);   // the name band
    b(SALLY.x0, SIDE, WALL.z1 - .25, SALLY.x1, SIDE + 6, WALL.z1 + .25, air(C.orange, .2));
    // the court: blue, the orange keys, the white centre line
    { const [a0, c0, a1, c1] = COURT.r; b(a0, SIDE, c0, a1, SIDE + .5, c1, C.court); b(a0 + 5, SIDE, c0, a1 - 5, SIDE + .5, c0 + 5.5, C.courtKey); b(a0 + 5, SIDE, c1 - 5.5, a1 - 5, SIDE + .5, c1, C.courtKey); b(a0, SIDE, (c0 + c1) / 2 - .25, a1, SIDE + .5, (c0 + c1) / 2 + .25, C.lineW); }
    // the bus on the apron, white with the orange stripe
    b(264.2, SIDE + .3, -297.2, 275, SIDE + 3.2, -294.6, air(C.chalk, .15)); b(264.2, SIDE + 1.2, -294.8, 275, SIDE + 1.7, -294.5, C.orange);
    // the lighthouse: bands of red and white, the gallery, the lantern, the red cap
    { const { x, z, h } = LIGHT; b(x - 2, SIDE, z - 2, x + 2, SIDE + 1.2, z + 2, air(C.bone, .15)); for (let y = SIDE + 1.2, n = 0; y < SIDE + h - 4; y += 2, n++) b(x - 1.25, y, z - 1.25, x + 1.25, Math.min(y + 2, SIDE + h - 4), z + 1.25, n & 1 ? C.chalk : C.red);
      b(x - 1.75, SIDE + h - 4, z - 1.75, x + 1.75, SIDE + h - 3.5, z + 1.75, C.ink); b(x - 1, SIDE + h - 3.5, z - 1, x + 1, SIDE + h - 1.5, z + 1, N ? C.litHi : C.glassHi, N ? 3 : 1); b(x - 1.25, SIDE + h - 1.5, z - 1.25, x + 1.25, SIDE + h - .5, z + 1.25, C.red); }
  }
  // ── the road over the water and the island road: asphalt and sidewalks at the slab's height (the far tier's floor is 0.5 m)
  if (ctx.j === -9 || ctx.j === -10) {
    if (ctx.j === -9) { b(R9.a0, SIDE, -288, R9.a1, SIDE + .5, R9.z1, C.asph); b(R9.w0, SIDE, -288, R9.a0, SIDE, R9.z1, 0xcdc5b8); b(R9.a1, SIDE, IR.a1, R9.w1, SIDE, R9.z1, 0xcdc5b8);
      b(R9.a1, SIDE, -288, IR.x1, SIDE, IR.a1, C.asph); b(R9.w1, SIDE, IR.a1, IR.x1, SIDE, IR.s1, 0xcdc5b8);
      b(223.5, SIDE, -284, 224.5, SIDE + .05, -256, C.lineY); }
    else b(224, SIDE, IR.a0, IR.x1, SIDE, -288, C.asph);
    if (ctx.j === -9 && ctx.i <= 7) { for (const [k, T] of Object.entries(TOWERS)) { for (const [a0, a1] of [LEG.W, LEG.E]) b(a0, SIDE, T.z0, a1, GIRDER[0], T.z1, air(C.green, .2));
        b(LEG.W[0], GIRDER[0], T.z0, LEG.E[1], GIRDER[1], T.z1, air(C.green, .2)); b(219.5, GIRDER[1], T.z0 + .5, 228.5, HOUSE[1], T.z1 - .5, air(C.pale, .2));
        b(214, GIRDER[0] + .5, k === 'S' ? T.z1 - .5 : T.z0, 234, GIRDER[1] - .5, k === 'S' ? T.z1 : T.z0 + .5, N ? C.litHi : C.chalk, L); }
      for (const [a0, a1] of [SPAN.W, SPAN.E]) { b(a0, SIDE, SPAN.z0, a1 + .1, SIDE + .5, SPAN.z1, air(C.green, .2)); b(a0, SPAN.top - .5, SPAN.z0 + 2, a1 + .1, SPAN.top, SPAN.z1 - 2, N ? 0xfff1c4 : air(C.green, .2), L);
        for (let z = SPAN.z0 + 2; z <= SPAN.z1 - 2; z += 1.93) b(a0, SIDE, z, a1 + .1, SPAN.top, z + .5, air(C.greenD, .2)); }
      b(R9.w0 - .5, SIDE, -288, R9.w0, SIDE + 1, R9.z1, air(C.greenD, .2)); b(R9.w1, SIDE, IR.s1, R9.w1 + .5, SIDE + 1, R9.z1, air(C.greenD, .2)); }
    if (ctx.j === -9 && ctx.i >= 7) b(Math.max(R9.w1, x0), SIDE, IR.s1 - .5, IR.x1, SIDE + 1, IR.s1, air(C.greenD, .2));
  }
}
