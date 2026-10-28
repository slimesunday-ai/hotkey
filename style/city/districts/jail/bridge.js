// THE LONG BRIDGE + the quay (jail kit, adopted sea blocks 6…8,−9) · owner: the water-side agent (batch 5). Worker-safe.
// Route 9 crosses the bay on a steel VERTICAL-LIFT bridge (it is 34 m long; the city calls it the Long Bridge anyway): the deck is low,
// flush like the docks' quays (the road at 0.1, the sidewalks at 0.2, so the core's shelter and corner lamp stand on it), two green
// lattice towers carry the lift span between them, a through truss on the road's edges. The span is down, so the counterweights hang
// at the top of the legs. Name boards on the towers' girders: THE LONG BRIDGE (south face, what the city reads), CHECKPOINT AHEAD
// (the north tower's south face), SEE YOU SOON (its north face: what you read on the way out). At the island end, a median island with
// the checkpoint booth and its two boom gates; the island road's south half and its sidewalk run east along the island on a seawall.
import { C, CV, SIDE, TOD, REG, H, lit, mix, shade, wv, later, board, wboard, signOn, letters, px, mini, logSign, inBlock, bridgeLamp, bollard, plate, stopFlag, gull, person, stamp, stampA, pv, prop, memo, keep, mp } from './lib.js';
import { R9, IR, DECK, TOWERS, LEG, LEG_Y, GIRDER, HOUSE, SPAN, BOOTH, WALKN } from './plan.js';
import { car, taxi, copCar } from '../../props.js';
import { P0 as PITCH } from '../../../../world/city.js';   // (SPREAD: today's pitch — the kit authors in today's metres; lib.js JAIL_MAP carries them)

const G = C.green, GD = C.greenD;
// ── the deck: 0.1 m volumes, 0.4 m deep (the part under the water is hidden), every block its own square (6,−9 also takes the T's
// north-west corner over the water: z −292 … −288, x < 224, which no block builds)
function deck(ctx) {
  const bx0 = ctx.i * PITCH, own = (x, z) => inBlock(ctx, x, z) || (ctx.i === 6 && ctx.j === -9 && x >= R9.w0 - .5 && x < 224 && z >= WALKN && z < -288);
  const grow = ctx.i === 6 ? 4.1 : 0;
  // Route 9's asphalt (x 217 … 231) up to the T; on 7,−9 also the island road's south half (z −288 … −286) east to the quay's end
  const W = wv(ctx, [R9.a0, Math.max(-290, bx0 === 192 ? -292 : -288), ctx.i === 6 ? 224 : IR.x1, R9.z1], -.3, DECK.road, { s: CV, out: grow }); if (W) { const V = W.V;
    for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k); if (!own(x, z)) continue;
      const road9 = x >= R9.a0 && x < R9.a1 && z >= -290, roadI = x >= R9.a1 && z >= IR.a0 && z < IR.a1; if (!road9 && !roadI) continue;
      V.box(i, 0, k, i + 1, V.ny - 1, k + 1, C.asphD); V.set(i, V.ny - 1, k, paint(x, z)); } later(ctx, W, { walk: true }); }
  // the sidewalks: Route 9's (2 m, both sides), the T's north-west corner, the quay's (z −286 … −284)
  const S = wv(ctx, [R9.w0, WALKN, ctx.i === 6 ? 224 : IR.x1, R9.z1], -.3, DECK.walk, { s: CV, out: grow }); if (S) { const V = S.V;
    for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = S.wx(i), z = S.wz(k); if (!own(x, z)) continue;
      const west = x >= R9.w0 && x < R9.a0 && z >= -290, nw = x >= R9.w0 && x < 224 && z >= WALKN && z < -290, east = x >= R9.a1 && x < R9.w1 && z >= IR.a1, quay = x >= R9.w1 && z >= IR.a1 && z < IR.s1;
      if (!west && !nw && !east && !quay) continue;
      const curb = (west && x > R9.a0 - .2 && z > -286) || (east && x < R9.a1 + .2 && z > -284) || (quay && z < IR.a1 + .2) || (nw && z > -290.2);
      const joint = (Math.abs((((x - .5) % 1.5) + 1.5) % 1.5) < .1) || (Math.abs((((z - .5) % 1.5) + 1.5) % 1.5) < .1);
      V.box(i, 0, k, i + 1, V.ny, k + 1, curb ? C.curb : joint ? 0xb9b0a2 : 0xcdc5b8); } later(ctx, S, { walk: true }); }
}
// the road paint at (x, z): Route 9's double yellow and white lines (solid north of z 0, as the city paints them), the crossing and the stop
// line south of the T, the island road's dashed centre line and its crossing (both halves: the K blocks paint theirs)
function paint(x, z) {
  if (x < R9.a1) {
    if (z > -286 && z < -284 && x > R9.a0 + .15 && ((x - R9.a0 - .15) % .9) < .5) return C.lineW;       // the crossing over Route 9
    if (z > -283.9 && z < -283.55) return C.lineW;                                                        // its stop line
    if (z >= -283.55) { if ((x > 223.7 && x < 223.9) || (x > 224.1 && x < 224.3)) return C.lineY; if ((x > 221.9 && x < 222.1) || (x > 225.9 && x < 226.1)) return C.lineW; }
    if (z > -256.3) return C.steelL;                                                                      // the expansion joint at the mainland
    return H(Math.floor(x * 3), Math.floor(z * 3), 62) > .985 ? C.asphD : C.asph; }
  if (x > 231.1 && x < 232.9 && z < -286 && ((z + 289.85) % .9 + .9) % .9 < .5) return C.lineW;
  if (x > 233.1 && x < 233.45) return C.lineW;
  if (z < -287.9 && x > 233.2 && (x % 3) < 1.5) return C.lineY;
  return H(Math.floor(x * 3), Math.floor(z * 3), 63) > .985 ? C.asphD : C.asph;
}

// ── the edges: a green fascia girder under the sidewalk's outer edge, a rail (posts every 1.2 m, a top rail and a mid rail); the quay's
// seawall face; guard rails where the road ends (the T's dead end over the water, the island road at x 288)
function edges(ctx) {
  const rails = [];   // [axis, rail x0, x1, z0, z1, outward (−1/+1), fascia colour]
  if (ctx.i === 6) rails.push(['x', R9.w0, R9.w0 + .1, WALKN + .1, R9.z1, -1, G], ['z', R9.w0, 224, WALKN, WALKN + .1, -1, G]);
  if (ctx.i === 7) rails.push(['x', R9.w1 - .1, R9.w1, IR.s1, R9.z1, 1, G]);
  if (ctx.i >= 7) rails.push(['z', ctx.i === 7 ? R9.w1 + .2 : 256, ctx.i === 7 ? 256 : IR.x1 - .6, IR.s1 - .1, IR.s1, 1, C.concD]);
  for (const [ax, x0, x1, z0, z1, out, fc] of rails) { const W = wv(ctx, [x0 - (ax === 'x' && out < 0 ? .2 : 0), z0 - (ax === 'z' && out < 0 ? .2 : 0), x1 + (ax === 'x' && out > 0 ? .2 : 0), z1 + (ax === 'z' && out > 0 ? .2 : 0)], -.5, 1.3, { s: CV, out: 4.1 }); if (!W) continue; const V = W.V;
    const onDeck = (x, z) => inBlock(ctx, x, z) || (ctx.i === 6 && z < -288);
    for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k); if (!onDeck(x, z)) continue; const u = ax === 'x' ? z : x, rail = ax === 'x' ? (x >= x0 && x < x1) : (z >= z0 && z < z1);
      if (!rail) { V.box(i, 0, k, i + 1, W.Y(.45), k + 1, (ii, y) => y < W.Y(.02) ? shade(fc, .8) : fc); continue; }   // the fascia (or the seawall's face), outside the rail
      const post = (((u % 1.2) + 1.2) % 1.2) < .1; for (let y = 0; y < W.Y(1.25); y++) { const wy = W.wy(y); if (wy < .2) continue; if (post || (wy > 1.1 && wy < 1.25) || (wy > .6 && wy < .7)) V.set(i, y, k, GD); } }
    later(ctx, W, { keep: [ax === 'x' ? x0 : x0, 0, z0, x1, 1.3, z1], tag: 'rail' }); }
  // the island road's end at x 288: a guard rail across it with chevrons, then rocks and surf where the quay stops
  if (ctx.i === 8) { const W = wv(ctx, [287.4, -292.4, 292.2, -281.4], -.5, 1.3, { s: .2, out: 6 }); if (W) { const V = W.V;
      for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k);
        if (x < 287.8) { if (z > -290 && z < -284) for (let y = W.Y(.1); y < W.Y(1.0); y++) { const wy = W.wy(y), post = (((z + 290) % 1.2) + 1.2) % 1.2 < .2; if (post || (wy > .5 && wy < .9)) V.set(i, y, k, post ? C.steelD : ((((z * 2.5) | 0) & 1) ? C.red : C.chalk)); } continue; }
        if (x < 288) continue; const d = Math.hypot(Math.max(0, x - 288), Math.max(0, z + 284) * .6), n = H(Math.floor(x * 1.3), Math.floor(z * 1.3), 71);
        if (d < 2.4 + n * .8) { const h = Math.round((1.4 - d * .45 + n * .4 + .5) / .2); for (let y = 0; y < Math.max(1, Math.min(V.ny, h)); y++) V.set(i, y, k, y < 3 ? C.wet : C.rock[(n * 5) | 0]); }
        else if (d < 3.4 + n && n > .3) V.set(i, 2, k, n > .6 ? C.foam : C.foam2); }
      later(ctx, W, { keep: [287.4, 0, -290, 287.8, 1, -284], tag: 'rail' }); } }
}

// ── the towers: two legs (lattice, 0.2 m), the counterweights up in them, a pier cap in the water under each, the portal girder with
// its boards, the machinery house, the sheaves (yellow wheels), cables to the span, red lights on top
function tower(ctx, key) {
  const T = TOWERS[key], z0 = T.z0, z1 = T.z1, bx0 = ctx.i * PITCH; ctx.group('tower-' + key);
  const W = wv(ctx, [LEG.W[0] - .6, z0 - .8, LEG.E[1] + .6, z1 + .8], -.4, HOUSE[1] + 1.2, { s: .2 }); if (!W) return; const V = W.V, B = W.box, N = TOD.night;
  for (const [a0, a1] of [LEG.W, LEG.E]) { if (a1 < bx0 || a0 > bx0 + PITCH) continue;
    B(a0 - .2, -.4, z0 - .4, a1 + .2, 1.0, z1 + .4, (i, y, k) => { const x = W.wx(i), z = W.wz(k), cx = Math.min(x - a0 + .2, a1 + .2 - x), cz = Math.min(z - z0 + .4, z1 + .4 - z); return cx < .25 && cz < .25 ? undefined : y < 3 ? C.wet : C.concL; });   // the pier cap, corners cut
    const posts = [[a0, z0], [a1 - .4, z0], [a0, z1 - .4], [a1 - .4, z1 - .4]];
    for (const [px0, pz0] of posts) B(px0, LEG_Y[0], pz0, px0 + .4, LEG_Y[1], pz0 + .4, G);
    for (let y = LEG_Y[0]; y < LEG_Y[1] - .1; y += 2.4) { B(a0, y, z0, a1, y + .2, z0 + .2, GD); B(a0, y, z1 - .2, a1, y + .2, z1, GD); B(a0, y, z0, a0 + .2, y + .2, z1, GD); B(a1 - .2, y, z0, a1, y + .2, z1, GD);
      // X bracing on the faces: two diagonals per panel, sampled every 0.1 m so each is one unbroken line of cells
      const h = 2.4, ln = (x0_, y0_, z0_, x1_, y1_, z1_) => { const n = Math.ceil(Math.max(Math.abs(x1_ - x0_), Math.abs(y1_ - y0_), Math.abs(z1_ - z0_)) / .1); for (let q = 0; q <= n; q++) { const t = q / n; W.set(x0_ + (x1_ - x0_) * t, y0_ + (y1_ - y0_) * t, z0_ + (z1_ - z0_) * t, G); } };
      if (y + h < LEG_Y[1] + .01) for (const zf of [z0 + .1, z1 - .1]) { ln(a0 + .3, y + .2, zf, a1 - .3, y + h - .1, zf); ln(a1 - .3, y + .2, zf, a0 + .3, y + h - .1, zf); }
      if (y + h < LEG_Y[1] + .01) for (const xf of [a0 + .1, a1 - .1]) { ln(xf, y + .2, z0 + .3, xf, y + h - .1, z1 - .3); ln(xf, y + .2, z1 - .3, xf, y + h - .1, z0 + .3); } }
    // the counterweight, up in the leg (the span is down): concrete, a hazard band at its foot
    B(a0 + .6, 13.2, z0 + .6, a1 - .6, GIRDER[0], z1 - .6, (i, y) => y < W.Y(13.8) ? ((((i + y) >> 1) & 1) ? C.hazard : C.ink) : C.concD);
    // the sheave on top of the leg: a yellow wheel standing in the y–z plane, its axle across
    const cx = (a0 + a1) / 2, cy = GIRDER[1] + 1.1, cz = (z0 + z1) / 2; B(cx - .6, GIRDER[1], cz - .4, cx + .6, cy + .2, cz + .4, C.steelD); for (let y = cy - 1.2; y < cy + 1.2; y += .2) for (let z = cz - 1.2; z < cz + 1.2; z += .2) { const r = Math.hypot(y + .1 - cy, z + .1 - cz); if (r < 1.1) B(cx - .4, y, z, cx + .4, y + .2, z + .2, r > .8 ? C.yellow : r < .3 ? C.steelD : ((Math.round((Math.atan2(y - cy, z - cz) + 3.2) * 2)) & 1) ? C.yellow : 0xd99a12); }
  }
  // the portal girder across the road (clipped by the block), its boards, the machinery house, the red lights
  B(LEG.W[0], GIRDER[0], z0, LEG.E[1], GIRDER[1], z1, (i, y) => y === W.Y(GIRDER[0]) || y === W.Y(GIRDER[1]) - 1 ? GD : G);
  B(LEG.W[0] + 5, GIRDER[0] - 1.2, z0 + .6, LEG.E[1] - 5, GIRDER[0], z1 - .6, (i, y, k) => (Math.abs(W.wx(i) - 224) % 2.2) < .4 ? GD : undefined);   // knee struts under it
  const boards = key === 'S' ? [['+z', 'THE LONG BRIDGE']] : [['+z', 'CHECKPOINT AHEAD'], ['-z', 'SEE YOU SOON']];
  for (const [f, text] of boards) { const plane = f === '+z' ? z1 : z0; wboard(W, f, 213.8, 234.2, GIRDER[0] + .4, GIRDER[1] - .4, plane, N ? 0xfffbe8 : C.chalk, px(text), C.ink, { sc: 1, bl: N ? 3 : 0 });
    logSign(ctx, text, 224 - .1, f === '+z' ? z1 : z0, 96); }
  B(219.4, HOUSE[0], z0 + .2, 228.6, HOUSE[1], z1 - .2, (i, y, k) => y === W.Y(HOUSE[1]) - 1 ? C.slate : (Math.abs(W.wx(i) - 224) < .5 && y < W.Y(HOUSE[0] + 1.6)) ? C.steelD : (y === W.Y(HOUSE[0] + 1.0) && (i % 4) < 2) ? (N ? C.litLo : C.glass) : C.pale, N ? 3 : 0);
  for (const x of [219.6, 228.2]) B(x, HOUSE[1], z0 + .4, x + .2, HOUSE[1] + .2, z0 + .6, 0xff2a2a, lit(1));
  for (const x of [218.4, 222.2, 225.8, 229.6]) B(x, GIRDER[0] - .2, (z0 + z1) / 2 - .2, x + .4, GIRDER[0], (z0 + z1) / 2 + .2, N ? C.litHi : 0xe9eef2, lit(1));   // lamps under the girder, over the road
  later(ctx, W); for (const [a0, a1] of [LEG.W, LEG.E]) if (a1 > bx0 && a0 < bx0 + PITCH) keep(ctx, [a0 - .2, -.4, z0 - .4, a1 + .2, GIRDER[1], z1 + .4], 'tower');
  // cables: from each sheave's span side down to the span's top chord ends (the lift span hangs on them); the volume starts at the chord's top
  const pw = (SPAN.z1 - SPAN.z0) / 6, zs = key === 'S' ? z0 - .3 : z1 + .3, zc = key === 'S' ? SPAN.z1 - pw : SPAN.z0 + pw;
  const Wc = wv(ctx, [LEG.W[0], Math.min(zs, zc) - .4, LEG.E[1], Math.max(zs, zc) + .4], SPAN.top, GIRDER[1] + 2.4, { s: .2 });
  if (Wc) { let any = false; for (const [lx, sx] of [[(LEG.W[0] + LEG.W[1]) / 2, SPAN.W[0] + .2], [(LEG.E[0] + LEG.E[1]) / 2, SPAN.E[1] - .2]]) { if (!inBlock(ctx, (lx + sx) / 2, zs)) continue; any = true; const n = 200;
      const [ax, az] = mp(ctx, lx, zs), [bx, bz] = mp(ctx, sx, zc);   // (SPREAD: a straight cable between its two ends in the spread world)
      for (let q = 0; q <= n; q++) { const t = q / n, x = ax + (bx - ax) * t, y = GIRDER[1] + .9 - (GIRDER[1] + .9 - SPAN.top - .1) * t, z = az + (bz - az) * t; Wc.V.set(Math.floor((x - Wc.x0) / Wc.s), Math.floor((y - Wc.y0) / Wc.s), Math.floor((z - Wc.z0) / Wc.s), C.ink); } }
    if (any) later(ctx, Wc); }
}

// ── the lift span: a through truss on each edge of the road (bottom chord, top chord, verticals, Pratt diagonals, inclined end posts),
// lateral bracing across the top, a string of bulbs along each top chord (lit at night: the bridge reads across the bay)
function span(ctx) {
  ctx.group('span'); const S = SPAN, W = wv(ctx, [S.W[0], S.z0, S.E[1], S.z1], DECK.road, S.top + .4, { s: .2 }); if (!W) return; const V = W.V, B = W.box, N = TOD.night;
  const panels = 6, L = S.z1 - S.z0, pw = L / panels, zAt = p => S.z0 + p * pw, yT = S.top - S.chord, yB = DECK.road + S.chord;
  for (const [a0, a1] of [S.W, S.E]) {
    B(a0, DECK.road, S.z0 + pw, a1, yB, S.z1 - pw, G); B(a0, DECK.road, S.z0, a1, DECK.road + .2, S.z1, GD);   // the bottom chord (the end panels are open under the end posts)
    B(a0, yT, S.z0 + pw, a1, S.top, S.z1 - pw, G);                                                           // the top chord
    for (let p = 1; p < panels; p++) B(a0, yB, zAt(p) - .1, a1, yT, zAt(p) + .1, GD);                        // verticals
    const diag = (za, ya, zb, yb) => { const n = Math.ceil(Math.hypot(zb - za, yb - ya) / .15); for (let s = 0; s <= n; s++) { const t = s / n; B(a0, ya + (yb - ya) * t, za + (zb - za) * t - .1, a1, ya + (yb - ya) * t + .2, za + (zb - za) * t + .1, G); } };
    diag(S.z0, DECK.road, zAt(1), yT); diag(S.z1, DECK.road, zAt(panels - 1), yT);                            // the inclined end posts
    for (let p = 1; p < panels - 1; p++) { const mid = panels / 2; if (p < mid) diag(zAt(p), yT, zAt(p + 1), yB); else diag(zAt(p + 1), yT, zAt(p), yB); }   // Pratt diagonals, toward the middle
    for (let z = S.z0 + pw + .5; z < S.z1 - pw; z += 1.0) for (const x of [a0 - .2, a1]) B(x, S.top - .6, z, x + .2, S.top - .2, z + .2, N ? 0xfff1c4 : 0xf4efe0, lit(1));   // the bulbs, both faces
  }
  for (let p = 1; p < panels; p++) B(S.W[1], S.top - .4, zAt(p) - .1, S.E[0], S.top - .2, zAt(p) + .1, GD);   // top struts
  for (let p = 1; p < panels - 1; p++) { const n = 140; for (let s = 0; s <= n; s++) { const t = s / n, x = S.W[1] + (S.E[0] - S.W[1]) * t; B(x, S.top - .4, zAt(p) + pw * t - .1, x + .2, S.top - .2, zAt(p) + pw * t + .1, G); B(x, S.top - .4, zAt(p + 1) - pw * t - .1, x + .2, S.top - .2, zAt(p + 1) - pw * t + .1, G); } }
  // the portal bars the builder's plates hang from (the plates themselves: after this volume, below)
  for (const zp of [S.z1 - pw * .5, S.z0 + pw * .5]) { B(S.W[1], yT - .2, zp - .1, S.E[0], yT, zp + .1, GD); }
  later(ctx, W);
  // the builder's plate on each portal, IRON WORKS 1931: its own 0.1 m board hung under the portal bar (the span is 0.2 m cubes, where
  // the 3×5 face came out twice its size and ran off its board), 0.5 m letters, clear of the end posts and cables from both road views
  for (const [f, zp] of [['+z', S.z1 - pw * .5], ['-z', S.z0 + pw * .5]]) signOn(ctx, f, 220.3, 227.7, yT - .8, yT - .1, zp, GD, mini('IRON WORKS 1931'), C.chalk);
  for (const [a0, a1] of [S.W, S.E]) if (a1 > ctx.i * PITCH && a0 < ctx.i * PITCH + PITCH) keep(ctx, [a0, 0, S.z0, a1, S.top, S.z1], 'truss');
}

// ── the checkpoint at the island end: a median island (curbs with hazard paint), the booth (steel, a glass band, the guard inside),
// CHECKPOINT on its fascia, a STOP plate, the boom gates (inbound down across the east lanes, outbound up)
function checkpoint(ctx) {
  const b = BOOTH; ctx.group('checkpoint'); const N = TOD.night;
  const W = wv(ctx, [222.0, b.z0, 230.6, b.z1], DECK.road, 6.4, { s: CV }); if (!W) return; const V = W.V, B = W.box;
  B(b.x0, DECK.road, b.z0, b.x1, .3, b.z1, (i, y, k) => { const x = W.wx(i), z = W.wz(k), e = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z); return e < .2 ? ((((i + k) >> 1) & 1) ? C.hazard : C.ink) : C.concL; });
  const x0 = 223.1, x1 = 224.9, z0 = -282.9, z1 = -280.3, y0 = .3, yw = 1.1, yh = 2.1, yr = 2.7;
  B(x0, y0, z0, x1, yr, z1, (i, y, k) => { const x = W.wx(i), z = W.wz(k), edge = x < x0 + .1 || x > x1 - .1 || z < z0 + .1 || z > z1 - .1; if (!edge) return undefined; const wy = W.wy(y);
    if (wy < yw) return C.pale; if (wy < yh) return (Math.abs(x - 224) < .08 || Math.abs(z + 281.6) < .08) ? C.steelD : N ? C.litLo : C.glassHi; return C.cobalt; }, N ? 3 : 1);
  B(x0 - .2, yr, z0 - .2, x1 + .2, yr + .2, z1 + .2, C.slate);
  // the sign on the roof: CHECK / POINT on a board both ways, on two posts
  const sx0 = 222.9, sx1 = 225.1, sz = -281.7; B(223.2, yr + .2, sz - .05, 223.3, yr + .6, sz + .05, C.steelD); B(224.7, yr + .2, sz - .05, 224.8, yr + .6, sz + .05, C.steelD);
  B(sx0, yr + .6, sz - .1, sx1, yr + 1.9, sz + .1, C.cobalt, N ? 3 : 0);
  for (const [f, pl] of [['+z', sz + .1], ['-z', sz - .1]]) { W.V.recNext(); const L1 = mini('CHECK'), L2 = mini('POINT');
    const d = f === '+z' ? W.Z(pl) : W.Z(pl) - 1, u0 = u => f === '+z' ? W.X(224) - (u.w >> 1) : V.nx - W.X(224) - (u.w >> 1);
    letters(V, L1, f, u0(L1), W.Y(yr + 1.75), d, C.chalk, { l: N ? 3 : 0 }); letters(V, L2, f, u0(L2), W.Y(yr + 1.15), d, C.chalk, { l: N ? 3 : 0 }); }
  // the boom gates: the inbound arm down across the east lanes, the outbound arm up (both on the median)
  B(225.1, .3, -280.4, 225.4, 1.1, -280.0, C.steelD); B(225.4, .95, -280.3, 230.4, 1.15, -280.1, (i) => ((i >> 2) & 1) ? C.red : C.chalk);
  B(222.6, .3, -283.8, 222.9, 1.1, -283.4, C.steelD); B(222.65, 1.1, -283.7, 222.85, 6.0, -283.5, (i, y) => ((y >> 2) & 1) ? C.red : C.chalk);
  later(ctx, W, { keep: [b.x0, 0, b.z0, b.x1, 3, b.z1], tag: 'booth' }); keep(ctx, [225.1, 0, -280.4, 230.4, 1.2, -280.0], 'gate');
  person(ctx, 224.2, y0, -281.4, Math.PI, 'stand', 1313); logSign(ctx, 'CHECKPOINT', 224.1, sz, 96);   // (the seed rolls the guard a dark jacket)
}

// ── the block builders
export function bridgeBlock(ctx) {
  deck(ctx); edges(ctx);
  // a deck has no tree pits: the kerb strips of the bridge's and the quay's sidewalks are reserved before the street furniture comes, so the
  // core's trees and bags slide off them or stay out. (Tagged 'plinth': the one reservation tag that keeps furniture out while walkers, the
  // lanes, standing people and the bus shelter's re-check all pass through it — audit.js WALK_FREE, transit.js transitAfter.)
  for (const r of [[R9.a1, IR.a1, R9.a1 + .85, R9.z1], [R9.a0 - .85, WALKN, R9.a0, R9.z1], [R9.w1, IR.a1, IR.x1, IR.a1 + .85]]) keep(ctx, [r[0], DECK.walk, r[1], r[2], DECK.walk + 7, r[3]], 'plinth');
  if (ctx.i <= 7 && ctx.j === -9) { tower(ctx, 'S'); tower(ctx, 'N'); span(ctx); checkpoint(ctx); }
  foamAround(ctx);
}
// surf round the towers' pier caps and along the seawall
function foamAround(ctx) {
  const W = wv(ctx, [ctx.i * PITCH, -290, ctx.i * PITCH + PITCH, -256], -.1, .1, { s: .2 }); if (!W) return; const V = W.V; let any = false;
  const onDeck = (x, z) => (x >= R9.w0 - .3 && x < R9.w1 + .3 && z > -292) || (x >= R9.w1 - .3 && z >= IR.a0 && z < IR.s1 + .3);
  for (let k = 0; k < V.nz; k++) for (let i = 0; i < V.nx; i++) { const x = W.wx(i), z = W.wz(k); if (onDeck(x, z)) continue; let near = 9;
    for (const T of Object.values(TOWERS)) for (const [a0, a1] of [LEG.W, LEG.E]) { const d = Math.hypot(Math.max(a0 - .4 - x, 0, x - a1 - .4), Math.max(T.z0 - .4 - z, 0, z - T.z1 - .4)); near = Math.min(near, d); }
    if (x > R9.w1 && z > IR.s1 && z < IR.s1 + 1.6) near = Math.min(near, z - IR.s1);
    const n = H(Math.floor(x * 2.5), Math.floor(z * 2.5), 81); if (near > 0 && ((near < .5 && n > .2) || (near < 1.1 && n > .7))) { V.set(i, 0, k, n > .6 ? C.foam : C.foam2); any = true; } }
  if (any) later(ctx, W);
}
// what stands and drives on it (strict: every one asks the registry first)
export function bridgeLife(ctx) {
  const put = (bk, x, z, o) => inBlock(ctx, x, z) ? ctx.put(bk, ...mp(ctx, x, z), { reach: .6, ...o }) : null;
  // (a lamp's arm hangs over the sidewalk: ctx.put checks its walker slice, the strict re-check its whole box — PASS-suburbs request 1;
  // so the lamps go down with the strict re-check off, after ctx.put's own check)
  const lamp = (x, z, rot) => { if (!inBlock(ctx, x, z)) return; const st = REG.strict; REG.strict = false; try { ctx.put(bridgeLamp(), ...mp(ctx, x, z), { rot, y: DECK.walk, reach: .6, slide: rot & 1 ? [1, 0] : [0, 1], ignore: 'plinth' }); } finally { REG.strict = st; } };
  ctx.group('bridge-traffic');
  put(car(9), 227.6, -277.2, { rot: 2, y: DECK.road, slide: [0, 1] });                  // stopped at the inbound gate
  put(taxi(), 221.2, -266.8, { rot: 0, y: DECK.road, slide: [0, 1] });                  // leaving the island
  put(copCar(), 219.7, -288.6, { rot: 1, y: DECK.road, slide: [1, 0] });               // parked in the T's dead end, nose to the rail
  ctx.group('bridge-street');
  if (ctx.i === 6) { lamp(215.35, -259.6, 0); lamp(215.35, -282.2, 0); put(plate(['NO STOPPING', 'ON BRIDGE'], C.chalk, C.red, { s: .05, post: 14 }), 215.5, -261.0, { rot: 1, y: DECK.walk, slide: [0, 1] }); }   // (lamps: the arm over the sidewalk, toward the road)
  if (ctx.i === 8) { for (const x of [262.5, 278.5]) lamp(x, -284.35, 1); put(plate(['RESTRICTED AREA', 'NO SWIMMING', 'NO FISHING'], C.chalk, C.red, { s: .05, post: 14 }), 270.4, -284.4, { rot: 0, y: DECK.walk, slide: [1, 0] }); }
  if (ctx.i === 7) { put(plate(['SHOW ID', 'AT THE BOOTH'], C.hazard, C.ink, { s: .05, post: 14 }), 232.7, -276.2, { rot: 3, y: DECK.walk, slide: [0, 1] });
    // the LONG BRIDGE stop's pole, at the shelter's south end (+z: the city side), its flag facing the bus coming up Route 9 (the shelter's
    // own board faces the road, edge-on from the bridge's approach, where only its ad panel shows)
    const stop = (ctx.A.transit || []).find(t => t.t.id === 'bus-long-bridge');
    // (its single bounding box meets the walkers' corner line at the bridge's south end, which the registry keeps clear up to 2.4 m; the
    // flag is 2.55 m up and the pole stands in the kerb strip, outside the line, so that one reservation is ignored — the lanes and the walk
    // check still test the pole's own walker-height slice)
    if (stop) { const st = REG.strict; REG.strict = false; try { ctx.put(stopFlag('9X', ['LONG', 'BRIDGE']), stop.x - .1, stop.z + 2.25, { rot: 0, y: DECK.walk, reach: .4, slide: [0, 1], ignore: ['plinth', 'walkway'] }); } finally { REG.strict = st; } } }
}
