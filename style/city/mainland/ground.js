// MAINLAND v1 · the ground, rasterised from plots.json (worker-safe). One tile = one Vol: 0.1 m cells in the built zone (the arrival,
// Harbor Rd's lower end, both courts), 0.2 m on the frontier. Roads are one cell deep with their top at y 0; curbs, walks, lawns and
// lots rise to 0.2. Fields per cell: e (metres past the nearest street's asphalt edge), the street index, the plot index.
import { Vol, Bank, meshVol } from '../vox.js';
import { PAL, hash } from '../style.js';
import { STYLE } from './houses.js';
import { CARE, Painter, flat, vn, GRAVEL, STRAW, DIRT } from './lawn.js';

const HX = 12, ASPH = 0x5d5e6b, FRESH = 0x505160, CURB = PAL.curbTop, VERGE = 0x6cc453, WALK = 0xd6d0c4, WALKF = 0xe3ded3, JOINT = 0xbdb5a7,
  GRASS = [0x58b046, 0x55ac43], MOW = [0x68c650, 0x58b346], MOWF = [0x74cc58, 0x66be4d], MEAD = [0x6dbb4a, 0x7cc452, 0x62b044, 0x93c95a], CONC = 0xd8d1c3,
  PAVE = [0xe1cfb2, 0xd3bd9c], PLANK = [0xc79a64, 0xb98b57];
const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
const inQuad = (x, z, Q) => { let s = 0; for (let k = 0; k < 4; k++) { const [ax, az] = Q[k], [bx, bz] = Q[(k + 1) % 4], c = (bx - ax) * (z - az) - (bz - az) * (x - ax); if (c === 0) continue; if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } return true; };

// tile: { x0, z0, x1, z1, s, skip: [x0, z0, x1, z1] | null } → Bank, with bank.lawn = { tex, mask, nx, nz } (MAINLAND LAWNS, lawn.js):
// every top cell's colour painted (lawns in full; walks, curbs and aprons with their wear) and the lot mask (1 = a lot's lawn, where the
// lot patches go). The voxels' own colours only show on the curbs' road faces now, so the lawn cells share one colour and mesh in big quads.
const VOLG = 0x55ad45;
export function buildGround(plan, tile) {
  const { x0, z0, x1, z1, s } = tile, nx = Math.round((x1 - x0) / s), nz = Math.round((z1 - z0) / s), N = nx * nz;
  const E = new Float32Array(N).fill(99), SI = new Int16Array(N).fill(-1), LI = new Int16Array(N).fill(-1), DRV = new Uint8Array(N), TX = new Uint8Array(N * 4), LM = new Uint8Array(N);
  const cx = i => x0 + (i + .5) * s, cz = k => z0 + (k + .5) * s, I = x => Math.floor((x - x0) / s), K = z => Math.floor((z - z0) / s);
  const box = (ax0, az0, ax1, az1, f) => { const i0 = Math.max(0, I(ax0)), i1 = Math.min(nx - 1, I(ax1)), k0 = Math.max(0, K(az0)), k1 = Math.min(nz - 1, K(az1));
    for (let k = k0; k <= k1; k++) { const z = cz(k); for (let i = i0; i <= i1; i++) f(k * nx + i, cx(i), z); } };
  const ST = plan.streets;
  ST.forEach((S, si) => {
    if (S.bulb) { const [bx, bz] = S.bulb, R = S.r + 9; box(bx - R, bz - R, bx + R, bz + R, (n, x, z) => { const e = Math.hypot(x - bx, z - bz) - S.r; if (e < E[n]) { E[n] = e; SI[n] = si; } }); return; }
    for (let k = 1; k < S.pts.length; k++) { const [ax, az] = S.pts[k - 1], [bx, bz] = S.pts[k], M = S.hw + 9;
      box(Math.min(ax, bx) - M, Math.min(az, bz) - M, Math.max(ax, bx) + M, Math.max(az, bz) + M, (n, x, z) => { const e = segD(x, z, ax, az, bx, bz) - S.hw; if (e < E[n]) { E[n] = e; SI[n] = si; } }); } });
  plan.plots.forEach((P, pi) => { const Q = P.corners, xs = Q.map(q => q[0]), zs = Q.map(q => q[1]);
    box(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), (n, x, z) => { if (inQuad(x, z, Q)) LI[n] = pi; }); });
  // driveway aprons across the verge and walk (built plots): the style's drive, in the lot's frame, from the lot line to the curb
  for (const P of plan.plots) { if (P.status !== 'built') continue; const st = STYLE[P.style], { x: fx, z: fz, rot } = P.rect, c = Math.cos(rot), sn = Math.sin(rot), a = st.drive[0] + st.dx, b = st.drive[1] + st.dx;
    box(fx - 14, fz - 14, fx + 14, fz + 14, (n, x, z) => { const dx = x - fx, dz = z - fz, lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (lx > a && lx < b && lz > -.3 && lz < 3.2) DRV[n] = 1; }); }
  const islands = ST.filter(S => S.bulb && S.island > 0), loops = ST.filter(S => S.loop);
  const G = new Vol(nx, s > .15 ? 2 : 3, nz, { s, org: [x0, -s, z0], ground: true }), sxz = G.sxz, top = s > .15 ? 2 : 3, cache = new Map();
  const ci = c => { let v = cache.get(c); if (v === undefined) cache.set(c, v = G.ci(c, 0)); return v; };
  const sk = tile.skip;
  const PT = new Painter(nx, s > .15 ? 2 : 1), lawnPx = (T, o, x, z, s_, P, lx, lz, dAdd) => { const n_ = o >> 2; PT.px(T, o, n_ % nx, (n_ / nx) | 0, x, z, s_, P, lx, lz, dAdd); };   // (the lawn: lawn.js, fields per 2×2 block)
  const care = (P, pi) => P.status === 'built' ? CARE.tidy : P.prime ? CARE.mown : hash(pi, 5) > .45 ? CARE.mown : CARE.meadow, rough = s > .15 ? CARE.rough : CARE.park;
  for (let k = 0; k < nz; k++) { const z = cz(k); for (let i = 0; i < nx; i++) { const x = cx(i), n = k * nx + i, o = n * 4;
    if (sk && x > sk[0] && x < sk[2] && z > sk[1] && z < sk[3]) { flat(TX, o, VOLG); continue; }
    let h = top, c, vc = null;                                                                                    // vc: the voxel's colour when it differs from the painted top
    const qx = Math.floor(x / s + 1e-6), qz = Math.floor(z / s + 1e-6);
    if (z > -.5) { c = 0xece8df; flat(TX, o, c); }                                                                  // the seawall coping
    else if (z > -7.5) { c = (x > -18 && x < 6) ? PLANK[Math.floor(x / .45) & 1] : PAVE[(Math.floor(x / .6) + Math.floor(z / .3)) & 1]; flat(TX, o, c); }   // the promenade
    else if (x > -34 && x < HX - 6.8 && z > -30) { c = PAVE[(Math.floor(x / .6) + Math.floor(z / .3)) & 1]; flat(TX, o, c); }   // the ferry plaza
    else {
      const e = E[n], S = ST[SI[n]], built = S && S.built;
      let isl = null; for (const B of islands) { const r = Math.hypot(x - B.bulb[0], z - B.bulb[1]); if (r < B.island + .01) { isl = [B, r]; break; } }
      let green = null; if (!isl && e > 0) for (const Lp of loops) { const { c: [lx, lz], rx, rz } = Lp.loop; if (((x - lx) / rx) ** 2 + ((z - lz) / rz) ** 2 < 1) { green = Lp; break; } }
      if (isl) { const [B, r] = isl; if (r > B.island - .3) { c = CURB; flat(TX, o, c); } else { c = VOLG; if (B.built && hash(Math.floor(x * 2), Math.floor(z * 2)) > .8) flat(TX, o, 0xff7ab6); else lawnPx(TX, o, x, z, s, CARE.green, x, z); } }
      else if (green) { const { c: [lx, lz], rx, rz } = green.loop, q = Math.hypot((x - lx) / rx, (z - lz) / rz);
        if (e < .3) { c = CURB; flat(TX, o, c); } else if (Math.abs(q - .52) < .035) { c = 0xe4d6b8; const G_ = GRAVEL[(hash(qx, qz, 61) * 3) | 0]; flat(TX, o, (G_[0] << 16) | (G_[1] << 8) | G_[2]); }
        else { c = VOLG; lawnPx(TX, o, x, z, s, CARE.green, x + 400, z + 400, Math.abs(q - .52) < .07 ? 60 : 0); } }
      else if (e <= 0) { h = 1; c = built ? ASPH : FRESH;
        if (S.line && Math.abs(x - HX) < Math.max(.08, s / 2) && (Math.floor(z / 1.5) & 1) && z < -9 && e < -1) c = PAL.lineY;
        if (S.line && z > -12 && z < -9.4 && (Math.floor(x / .6) & 1)) c = 0xf4f3ee;
        if (!built && hash(Math.floor(x / 3), Math.floor(z / 3)) > .985) c = 0x474853;                              // the odd tar patch on the fresh asphalt
        flat(TX, o, c); }
      else if (DRV[n] && e > .3) { c = CONC; let t = e <= 1.3 ? shadeC(CONC, .96) : CONC;                           // the apron: oil where the cars stop, a crack or two
        const oil = vn(x * 1.4, z * 1.4, 51); if (oil > .74 && e > 1.3) t = shadeC(t, oil > .8 ? .82 : .9);
        if (hash(Math.floor(x * 1.3), 0, 52) > .93 && Math.abs(((z * 10) | 0) % 9) < 1 + (hash(qx, qz, 53) > .5)) t = 0xb7b0a3;
        flat(TX, o, t); }
      else if (e <= .3) { c = CURB; let t = CURB;                                                                 // the kerb: tyre scuffs at the drives, a chip here and there
        if (DRV[n] && hash(qx, qz, 54) < .45) t = hash(qx, qz, 55) > .5 ? 0xc6c0b4 : 0xd2cbbf; else if (hash(Math.floor(x * 2), Math.floor(z * 2), 56) > .985) t = 0xd2cbbf;
        flat(TX, o, t); }
      else if (e <= 1.3) { c = VOLG; lawnPx(TX, o, x, z, s, CARE.verge, NaN, NaN, e < .55 ? 70 : e > 1.1 ? 40 : 0);   // the verge: drier, long at both edges, trodden in places
        const w = vn(x * .35, z * .35, 57); if (w > .8) { const t = (w - .8) * 4 * vn(x * 3, z * 3, 58); if (t > .3) { const C_ = t > .7 && hash(qx, qz, 59) > .4 ? DIRT : STRAW; TX[o] += (C_[0] - TX[o]) * .7; TX[o + 1] += (C_[1] - TX[o + 1]) * .7; TX[o + 2] += (C_[2] - TX[o + 2]) * .7; TX[o + 3] *= .3; } } }
      else if (e <= 2.8) { const j = (((x + 400) % 1.5) < .1 || ((z + 400) % 1.5) < .1); c = j ? JOINT : (built ? WALK : WALKF);   // the walk: the odd replaced slab
        let t = c; if (!j && hash(Math.floor((x + 400) / 1.5), Math.floor((z + 400) / 1.5), 60) > .93) t = built ? 0xe0dbd0 : 0xd8d2c6; flat(TX, o, t); }
      else if (LI[n] >= 0) { const P = plan.plots[LI[n]], { x: fx, z: fz, rot } = P.rect, cr = Math.cos(rot), sr = Math.sin(rot), lx = (x - fx) * cr - (z - fz) * sr, lz = (x - fx) * sr + (z - fz) * cr;
        c = VOLG; LM[n] = 1; if (P.status === 'built') { flat(TX, o, VOLG); } else { let C_ = care(P, LI[n]);
        if (P.status !== 'built' && lz > -2.2) C_ = CARE.mown;                                                    // the frontage kept trimmed, even on a wild plot
        lawnPx(TX, o, x, z, s, C_, lx, lz, P.prime && lz < -2.2 && (lz < -P.rect.d + 1.4 || Math.abs(lx) > P.rect.w / 2 - 1.4) ? 120 : 0); } }   // (a built lot: its own job paints it)
      else { c = VOLG; lawnPx(TX, o, x, z, s, z > -12.5 ? CARE.shore : rough); }
    }
    const v = ci(vc ?? (h === top && c !== CURB && c !== 0xece8df && c !== CONC ? (c === WALK || c === WALKF || c === JOINT ? WALK : (c === VOLG ? VOLG : c)) : c)); for (let y = 0; y < h; y++) G.d[i + k * nx + y * sxz] = v; } }
  const bank = new Bank(true); meshVol(G, bank); bank.lawn = { tex: TX, mask: LM, nx, nz }; return bank;
}
const shadeC = (c, f) => { const m = k => Math.max(0, Math.min(255, Math.round(((c >> k) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); };
