// AI City · HOMES pass (2026-09-28) · ONE HOME'S ROOM, built on demand from its preset layout (interiors/home/assemblies/*.json) and its
// sim state. Worker-safe (no three, no DOM): vox.js banks out, the page meshes them (interiors/city/index.js).
//   buildRoom(A, S) → { bank, bed, dogAt, zzz, W, D, H, glass }
//     A  the assembly JSON (FORMAT.md "Assemblies"): room { w, d, h, walls { N, E }, floor }, items, slots
//     S  { W, D, H,             the shell in metres (≥ the layout's room; the layout sits against the back and right walls)
//          ceiling,             a stacked unit's lid (a walk-up storey is looked into from the street, under the floor above)
//          night, lightsOn,     lamps lit only at night with someone home and awake
//          sec: [lock | door | alarm | dog | safe], scars: [crime | boarded | burned | foreclosed | memorial],
//          fills: [{ id, variant } | null] per slot (the owner's gear, collectibles, trophies), bare (vacant: the fixed kit only),
//          forRent, asleep, seed,
//          car }                (MAINLAND) a vehicle Bank for the garage's car bay (room.built kind 'car'), drawn nose to the open front
// MAINLAND (2026-10-06): a layout's room may also carry `zones` (floor finishes over cell rects: a garage's concrete, a bathroom's tile)
// and `built` (the house's built-ins: partition walls, the car bay; solid in home/rules.js, drawn here, never items)
// Room space: origin at the back-left corner of the floor top, +x across (to the right seen from the street), +z toward the street
// (the open, cut-away side), +y up. The layout's N wall is the back wall (z = 0) and its E wall the right wall (x = W).
import { Vol, Bank, meshVol, stamp, stampA, boxInto } from '../../vox.js';
import { PAL, hash } from '../../style.js';
import { TOD } from '../../kit.js';
import * as HO from '../home/index.js';
import { dog } from '../../props.js';

const C4 = .25, T = .15;   // a cell (m) · the shell's wall thickness
const shade2 = (c, k) => { const f = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))); return (f(16) << 16) | (f(8) << 8) | f(0); };
const mixHex = (a, b, t) => { const f = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
// floors and wall finishes: the same words the layouts use (interiors/home/preview.js, which draws them the same way)
const FLOORS = { linoleum: (x, z) => ((x / 5 | 0) + (z / 5 | 0)) & 1 ? 0xd9a93a : 0x8a5a33, planks: (x, z) => { const p = (z / 3) | 0, j = (x + p * 17) % 40 === 0; return j ? 0x7a4a24 : p & 1 ? 0xb07a45 : 0xa06a3a; },
  oak: (x, z) => { const p = (x / 3) | 0, j = (z + p * 23) % 44 === 0; return j ? 0x6e3e19 : p & 1 ? 0xa86a35 : 0x9a5f2e; }, stone: (x, z) => ((x / 20 | 0) + (z / 20 | 0)) & 1 ? 0x3a3c44 : 0x44464f,
  checker: (x, z) => ((x / 6 | 0) + (z / 6 | 0)) & 1 ? 0x8fb39a : 0xf1e9d6,   // (interior art pass: the kitchen's lino)
  concrete: (x, z) => (x % 40 === 0 || z % 40 === 0) ? 0x9c988f : hash(x >> 2, z >> 2, 9) > .86 ? 0xaaa69d : 0xb7b3aa, tile: (x, z) => (x % 6 === 0 || z % 6 === 0) ? 0xd9dde0 : ((x / 6 | 0) + (z / 6 | 0)) & 1 ? 0x7fd4c9 : 0xf4f6f6 };
const floorFn = m => { if (m?.startsWith('carpet:')) { const c = parseInt(m.slice(8), 16); return (x, z) => hash(x, z, 5) > .8 ? shade2(c, .92) : c; } return FLOORS[m] ?? FLOORS.planks; };
const plain = (c, base = 0xf7f7f2) => (a, y) => y < 3 ? base : c;
function wallFn(m = '') { if (m.startsWith('paint:')) return plain(parseInt(m.slice(7), 16));
  if (m === 'brick') return (a, y) => ((y % 4 === 3) || ((a + ((y >> 2) & 1) * 3) % 6 === 5)) ? 0xc9b8a8 : 0x9b4f3a;
  if (m === 'rose') return (a, y) => y < 3 ? 0xf7f7f2 : y === 18 ? 0xf7f7f2 : y < 18 ? 0xc0506e : 0xe07a94;
  if (m === 'glass') return (a, y) => (a % 26 < 2 || y < 2 || y > 53) ? 0x1d1d24 : (a + y) % 40 < 2 && a % 26 < 12 ? PAL.glint : y > 34 ? PAL.glassHi : PAL.glassLo;
  if (m.startsWith('panelling')) { const c = m.endsWith('dark') ? 0x8b5a2b : 0xc98a4b; return (a, y) => a % 5 === 0 ? shade2(c, .74) : c; } return plain(0xe6e1d6); }
// a burned room: soot climbing from the floor, charcoal everywhere, a few embers
const charred = (fn, k = 0) => (a, y, t) => { const h = hash(a >> 3, y >> 3, 31 + k); return hash(a, y, 5 + k) > .996 ? 0xff6a1a : mixHex(0x16130f, shade2(fn(a, y, t), .35), Math.min(1, ((h * 4) | 0) * .15 + (y < 20 ? 0 : .1))); };   // (8-voxel patches: the greedy mesher merges them)
const charBank = (b, keep = .18) => { for (const O of b.L) for (let k = 0; k < O.C.n; k += 3) { const g = (O.C.a[k] + O.C.a[k + 1] + O.C.a[k + 2]) / 3; O.C.a[k] = g * keep + .012; O.C.a[k + 1] = g * keep * .85 + .008; O.C.a[k + 2] = g * keep * .7 + .006; } return b; };

export function buildRoom(A, S) {
  const ART = S.art || null;   // (interior art pass, 2026-10-06: the Mainland's cutaway shell; city homes leave it off and draw as before)
  const t0 = Date.now(), bank = new Bank(true), Wr = A.room.w * C4, Dr = A.room.d * C4, W = Math.max(S.W, Wr), D = Math.max(S.D, Dr), H = S.H ?? A.room.h ?? 2.8;
  const ox = W - Wr, scars = new Set(S.scars || []), sec = new Set(S.sec || []), burned = scars.has('burned'), foreclosed = scars.has('foreclosed');
  const nightWas = TOD.night; TOD.night = !!(S.night && S.lightsOn);   // lamps and screens carry the lit flag only when they are on
  const seedOf = k => (S.seed ?? 1) * 31 + k;
  // ── the shell: floor, back wall (the layout's N), right wall (E), left wall, and a lid for a stacked storey
  const fN = wallFn(A.room.walls?.N), fE = wallFn(A.room.walls?.E), fL = A.room.walls?.N === 'glass' ? fE : wallFn(A.room.walls?.W ?? A.room.walls?.E);
  const W20 = Math.round(W * 20), D20 = Math.round(D * 20), H20 = Math.round(H * 20);
  { let ff = floorFn(A.room.floor); if (burned) { const f0 = ff; ff = (x, z) => charred((a, y) => f0(a, y))(x, z, 0); } else if (foreclosed) { const f0 = ff; ff = (x, z) => shade2(f0(x, z), .82); }
    const ox20 = Math.round((W - Wr) * 20), Z = (A.room.zones ?? []).map(q => [ox20 + q.x * 5, q.z * 5, ox20 + (q.x + q.w) * 5, (q.z + q.d) * 5, floorFn(q.floor)]);   // (MAINLAND: floor zones)
    if (ART) { const K = A.items.filter(it => (!it.on || it.on === 'floor') && HO.byId.get(it.id)?.cat === 'kitchen').map(it => { const o = HO.byId.get(it.id), [w, d] = ((it.rot ?? 0) / 90) & 1 ? [o.foot[1], o.foot[0]] : o.foot; return [it.x, it.z, it.x + w, it.z + d]; });   // (interior art pass: lino under the kitchen run)
      if (K.length) { const x0 = Math.min(...K.map(k => k[0])) - 1, x1 = Math.max(...K.map(k => k[2])) + 1, z1 = Math.min(A.room.d, Math.max(...K.map(k => k[3])) + 5); Z.push([ox20 + x0 * 5, 0, ox20 + x1 * 5, z1 * 5, FLOORS.checker]); } }
    const V = new Vol(W20, 1, D20, { s: .05, org: [0, -.05, 0], ground: false }); for (let x = 0; x < W20; x++) for (let z = 0; z < D20; z++) { const q = Z.find(q => x >= q[0] && x < q[2] && z >= q[1] && z < q[3]); V.set(x, 0, z, q ? (burned ? 0x2a2622 : q[4](x, z)) : ff(x, z)); } meshVol(V, bank);
    boxInto(bank, 0, -T, -.35, -T, W + T, -.05, D + (ART ? T : 0), ART ? 0xb9b3a8 : 0x6b6258); }   // the slab under the floor (the cut shows its edge; art: the house's foundation)
  const wall = (side, fn) => { const n = side === 'back' ? W20 : D20, V = side === 'back' ? new Vol(n, H20, 3, { s: .05, org: [0, 0, -T], ground: false })
      : new Vol(3, H20, n, { s: .05, org: [side === 'right' ? W : -T, 0, 0], ground: false }), f = burned ? charred(fn, side.length) : fn;
    for (let a = 0; a < n; a++) for (let y = 0; y < H20; y++) for (let t = 0; t < 3; t++) { const c = f(a, y, t); if (side === 'back') V.set(a, y, t, c); else V.set(t, y, side === 'left' ? n - 1 - a : a, c); }
    meshVol(V, bank); };
  const art = ART ? artShell() : null; if (!ART) { wall('back', fN); wall('right', fE); wall('left', fL); }
  const B = Math.max(T, S.band ?? T);   // wall caps out to the home's own walls (the cut reads as a section)
  boxInto(bank, 0, -B, H, -B, W + B, H + .06, 0, 0xf7f7f2); boxInto(bank, 0, W, H, 0, W + B, H + .06, D, 0xf7f7f2); boxInto(bank, 0, -B, H, 0, 0, H + .06, D, 0xf7f7f2);
  if (S.ceiling) boxInto(bank, 0, -T, H, -T, W + T, H + .3, D, burned ? 0x1a1714 : 0xece8df);
  // ── MAINLAND: the built-ins. A partition is a wall over its cells (skirting, a white cap like the cut walls); the car bay gets its
  // parking lines, a wheel stop and the house's car (S.car), nose to the open front
  for (const b of A.room.built ?? []) { const x0 = ox + b.x * C4, z0 = b.z * C4, x1 = x0 + b.w * C4, z1 = z0 + b.d * C4;
    if (b.kind === 'wall') { const pc0 = b.paint ? parseInt(b.paint.slice(1), 16) : (A.room.walls?.E || '').startsWith('paint:') ? parseInt(A.room.walls.E.slice(7), 16) : 0xe6e1d6, pc = ART ? mixHex(art.P0, pc0, .5) : pc0, thin = b.w <= b.d ? [x0 + .04, x1 - .04, z0, z1] : [x0, x1, z0 + .04, z1 - .04];
      boxInto(bank, 0, thin[0], 0, thin[2], thin[1], H, thin[3], burned ? 0x1a1714 : pc); boxInto(bank, 0, thin[0] - .01, 0, thin[2] - .01, thin[1] + .01, .12, thin[3] + .01, burned ? 0x1a1714 : 0xf7f7f2);
      boxInto(bank, 0, thin[0] - .02, H, thin[2], thin[1] + .02, H + .06, thin[3], 0xf7f7f2); }
    else if (b.kind === 'car') { for (const x of [x0 + .05, x1 - .15]) boxInto(bank, 0, x, 0, z0 + .1, x + .1, .012, z1 - .1, 0xf7f7f2);
      boxInto(bank, 0, (x0 + x1) / 2 - .5, 0, z0 + .35, (x0 + x1) / 2 + .5, .12, z0 + .55, 0xffc21a); boxInto(bank, 0, (x0 + x1) / 2 - .45, 0, (z0 + z1) / 2 - .5, (x0 + x1) / 2 + .35, .006, (z0 + z1) / 2 + .2, 0x5d5a55);   // lines, the wheel stop, an oil stain
      if (S.car && !burned) stampA(S.car, bank, 0, (x0 + x1) / 2, .02, (z0 + z1) / 2 + .1); } }
  // ── INTERIOR ART PASS (2026-10-06) · the Mainland cutaway's shell, Sims-style: two-sided walls (the room's finish inside, the house's
  // lap siding, corner boards and colour outside), a finish per room along the back wall (the bathroom tiled to 1.3 m, the kitchen's
  // subway-tile splashback, bedroom wallpaper stripes, a living-room wainscot with a chair rail, painted block in the garage), proud
  // skirting and a crown line, windows punched where the wall is clear (frames, sills and a mullion cross; open, so the yard shows
  // through), and the front wall cut down to a capped stub with the garage's opening. ART: { siding (hex), stub (m) }.
  function artShell() {
    const SK = 0xf7f7f2, TRIM = 0xfffaf0, P0 = (A.room.walls?.N || '').startsWith('paint:') ? parseInt(A.room.walls.N.slice(7), 16) : 0xeee8dc;
    const HC = ART.siding ?? ((A.room.walls?.E || '').startsWith('paint:') ? parseInt(A.room.walls.E.slice(7), 16) : 0xe6e1d6), tint = k => mixHex(P0, HC, k), lap = shade2(HC, .9);
    const zoneAt = (x, z) => (A.room.zones ?? []).find(q => x >= ox + q.x * C4 && x < ox + (q.x + q.w) * C4 && z >= q.z * C4 && z < (q.z + q.d) * C4)?.floor ?? null;
    // the rooms along the back wall: split by the partitions that meet it, each read by its floor and its furniture
    const parts = (A.room.built ?? []).filter(b => b.kind === 'wall' && b.z === 0 && b.w <= b.d).map(b => [ox + b.x * C4, ox + (b.x + b.w) * C4]).sort((p, q) => p[0] - q[0]);
    const segs = []; let x = 0; for (const [a, b] of parts) { if (a - x > .2) segs.push({ x0: x, x1: a }); x = b; } if (W - x > .2) segs.push({ x0: x, x1: W });
    const catsIn = (x0, x1) => new Set(A.items.filter(it => !it.on?.wall).map(it => { const o = HO.byId.get(it.id); if (!o) return null; const cx = ox + (it.x + o.foot[0] / 2) * C4; return cx > x0 && cx < x1 ? o.cat : null; }).filter(Boolean));
    let liv = 0; for (const g of segs) { const f = zoneAt((g.x0 + g.x1) / 2, .3), c = catsIn(g.x0, g.x1);
      g.kind = f === 'tile' ? 'bath' : f === 'concrete' || (A.room.built ?? []).some(b => b.kind === 'car' && ox + (b.x + b.w / 2) * C4 > g.x0 && ox + (b.x + b.w / 2) * C4 < g.x1) ? 'garage'
        : c.has('kitchen') ? 'kitchen' : c.has('beds') ? 'bed' : (c.has('seating') || c.has('electronics') || c.has('music')) ? (liv++ ? 'den' : 'living') : 'hall'; }
    const crown = y => y >= H20 - 2;
    const PAT = {
      bath: (a, y) => y < 3 ? SK : y < 26 ? (a % 3 === 0 || y % 3 === 2 ? 0xd3dbdb : y >= 23 ? 0x7fd4c9 : 0xf4f6f6) : crown(y) ? SK : tint(.06),
      kitchen: (a, y) => y < 3 ? SK : y >= 19 && y < 31 ? (y % 2 === 0 || (a + ((y >> 1) & 1) * 2) % 5 === 0 ? 0xd6d3cb : 0xf8f6f0) : crown(y) ? SK : tint(.12),
      bed: (a, y) => y < 3 ? SK : crown(y) ? SK : a % 8 < 2 ? shade2(tint(.32), 1.07) : (a % 8 === 4 && y % 6 === 3) ? shade2(tint(.32), .93) : tint(.32),
      living: (a, y) => y < 3 ? SK : y < 18 ? (a % 12 === 0 ? shade2(HC, .7) : shade2(HC, .82)) : y < 20 ? SK : crown(y) ? SK : tint(.16),
      den: (a, y) => y < 3 ? SK : crown(y) ? SK : tint(.42),
      garage: (a, y) => y < 2 ? 0x8f8b83 : (y % 4 === 0 || (a + ((y >> 2) & 1) * 4) % 8 === 0) ? 0xbab5ab : 0xd2cec5,
      hall: (a, y) => y < 3 ? SK : crown(y) ? SK : P0 };
    const segAt = m => segs.find(g => m >= g.x0 - 1e-6 && m < g.x1 + 1e-6) ?? (m < (segs[0]?.x0 ?? 0) ? segs[0] : segs[segs.length - 1]) ?? { kind: 'hall' };
    const siding = (a, y, n) => a < 3 || a >= n - 3 ? TRIM : y % 3 === 0 ? lap : HC;
    // windows: the widest clear span in each room (nothing hung there, nothing tall against the wall), one per room and per side wall
    const topOf2 = it => { const o = HO.byId.get(it.id); if (!o) return 0; const base = it.on && it.on.top !== undefined ? (HO.byId.get(A.items[it.on.top]?.id)?.tops?.[0] ?? .5) : 0; return base + o.h; };
    const blocks = { N: [], E: [], W: [] };
    for (const it of A.items) { const o = HO.byId.get(it.id); if (!o) continue; const r = ((it.rot ?? 0) / 90) & 1, w = (r ? o.foot[1] : o.foot[0]) * C4, d = (r ? o.foot[0] : o.foot[1]) * C4;
      if (it.on?.wall) { const y0 = it.y ?? o.mount ?? 0, y1 = y0 + o.foot[1] * C4; if (y1 > 1.0 && y0 < 2.3) blocks[it.on.wall === 'N' ? 'N' : 'E'].push([(it.on.wall === 'N' ? ox : 0) + it.x * C4 - .12, (it.on.wall === 'N' ? ox : 0) + it.x * C4 + o.foot[0] * C4 + .12]); continue; }
      if (it.on === 'ceiling' || o.place === 'ceiling') continue; const X = ox + it.x * C4, Zm = (it.z ?? 0) * C4, top = topOf2(it); if (top < 1.08) continue;
      if (Zm < .45) blocks.N.push([X - .1, X + w + .1]); if (X < .45) blocks.W.push([Zm - .1, Zm + d + .1]); if (X + w > W - .45) blocks.E.push([Zm - .1, Zm + d + .1]); }
    for (const b of A.room.built ?? []) { if (b.kind !== 'wall') continue; const x0 = ox + b.x * C4, z0 = b.z * C4; if (x0 < .3) blocks.W.push([z0 - .2, z0 + b.d * C4 + .2]); if (x0 + b.w * C4 > W - .3) blocks.E.push([z0 - .2, z0 + b.d * C4 + .2]); }
    const pick = (lo, hi, bl, want, pref) => { let iv = [[lo, hi]]; for (const [a, b] of bl) iv = iv.flatMap(([p, q]) => b <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]].filter(([u, v]) => v - u > .05));
      iv = iv.filter(([p, q]) => q - p >= want); if (!iv.length) return null; iv.sort((u, v) => Math.abs((u[0] + u[1]) / 2 - pref) - Math.abs((v[0] + v[1]) / 2 - pref)); const [p, q] = iv[0], c = Math.max(p + want / 2, Math.min(q - want / 2, pref)); return [c - want / 2, c + want / 2]; };
    const SIZE = { bath: [.7, 30, 42], garage: [1.0, 30, 40], kitchen: [1.2, 22, 43], bed: [1.2, 21, 44], living: [1.5, 20, 45], den: [1.3, 20, 45], hall: [.9, 21, 44] }, wins = [];
    for (const g of segs) { const [w, y0, y1] = SIZE[g.kind], s = pick(g.x0 + .35, g.x1 - .35, blocks.N, w, (g.x0 + g.x1) / 2); if (s) wins.push({ side: 'N', a0: s[0], a1: s[1], y0, y1, kind: g.kind }); }
    for (const [side, g] of [['W', segs[0]], ['E', segs[segs.length - 1]]]) { if (!g) continue; const [w, y0, y1] = SIZE[g.kind], s = pick(.4, D - .5, blocks[side], Math.min(w, D - 1), D * .45); if (s) wins.push({ side, a0: s[0], a1: s[1], y0, y1, kind: g.kind }); }
    // the walls: voxel slabs 3 thick, the finish on the room side, the siding outside, holes where the windows go
    const slab = (side, inner) => { const n = side === 'N' ? W20 : D20, V = side === 'N' ? new Vol(n, H20, 3, { s: .05, org: [0, 0, -T], ground: false }) : new Vol(3, H20, n, { s: .05, org: [side === 'E' ? W : -T, 0, 0], ground: false });
      const ws = wins.filter(w => w.side === side);
      for (let a = 0; a < n; a++) { const m = (a + .5) * .05, hole = ws.find(w => m > w.a0 && m < w.a1), fin = inner(a, m);
        for (let y = 0; y < H20; y++) { if (hole && y >= hole.y0 && y < hole.y1) continue; const ci = fin(a, y), co = siding(side === 'W' ? n - 1 - a : a, y, n);
          for (let t = 0; t < 3; t++) { const out = side === 'E' ? t === 2 : t === 0, c = out ? co : ci; if (side === 'N') V.set(a, y, t, c); else V.set(t, y, a, c); } } }
      meshVol(V, bank); };
    slab('N', (a, m) => PAT[segAt(m).kind]); slab('W', () => PAT[segs[0]?.kind ?? 'hall']); slab('E', () => PAT[segs[segs.length - 1]?.kind ?? 'hall']);
    // frames, sills and mullions (white trim through the wall, a deeper sill both sides)
    for (const w of wins) { const y0 = w.y0 * .05, y1 = w.y1 * .05, am = (w.a0 + w.a1) / 2, ym = y0 + (y1 - y0) * .58;
      const put = (a0, b0, a1, b1, dz0, dz1, c = TRIM) => { if (w.side === 'N') boxInto(bank, 0, a0, b0, -T + dz0, a1, b1, dz1, c); else if (w.side === 'E') boxInto(bank, 0, W - dz1, b0, a0, W + T - dz0, b1, a1, c); else boxInto(bank, 0, -T + dz0, b0, a0, dz1, b1, a1, c); };
      const e = .035; put(w.a0 - .07, y0 - .02, w.a0, y1 + .07, -e, e); put(w.a1, y0 - .02, w.a1 + .07, y1 + .07, -e, e); put(w.a0 - .07, y1, w.a1 + .07, y1 + .07, -e, e);
      put(w.a0 - .11, y0 - .06, w.a1 + .11, y0, -.07, .09); put(am - .02, y0, am + .02, y1, .05, .1 - .05); put(w.a0, ym - .02, w.a1, ym + .02, .05, .1 - .05); }
    // proud skirting and the crown line on the room side (not in the garage)
    for (const g of segs) { if (g.kind === 'garage') continue; boxInto(bank, 0, g.x0, 0, 0, g.x1, .13, .022, SK); boxInto(bank, 0, g.x0, H - .1, 0, g.x1, H - .02, .03, SK); }
    for (const [side, g] of [['W', segs[0]], ['E', segs[segs.length - 1]]]) { if (!g || g.kind === 'garage') continue; const [x0, x1] = side === 'W' ? [0, .022] : [W - .022, W], [c0, c1] = side === 'W' ? [0, .03] : [W - .03, W];
      boxInto(bank, 0, x0, 0, 0, x1, .13, D, SK); boxInto(bank, 0, c0, H - .1, 0, c1, H - .02, D, SK); }
    // the front wall, cut down to a capped stub (Sims' walls-down), open at the garage bay
    const stubN = Math.max(4, Math.round((ART.stub ?? .45) * 20)), gaps = (A.room.built ?? []).filter(b => b.kind === 'car').map(b => [ox + b.x * C4 - .35, ox + (b.x + b.w) * C4 + .35]);
    const n = W20 + 6, V = new Vol(n, stubN, 3, { s: .05, org: [-T, 0, D], ground: false }), runs = []; let run0 = null;
    for (let a = 0; a < n; a++) { const m = -T + (a + .5) * .05, gap = gaps.some(([p, q]) => m > p && m < q); if (gap) { if (run0 !== null) { runs.push([run0, a]); run0 = null; } continue; } if (run0 === null) run0 = a;
      const fin = PAT[segAt(Math.max(0, Math.min(W - .01, m))).kind]; for (let y = 0; y < stubN; y++) { V.set(a, y, 0, fin(a, y)); V.set(a, y, 1, fin(a, y)); V.set(a, y, 2, siding(a, y, n)); } }
    if (run0 !== null) runs.push([run0, n]); meshVol(V, bank);
    for (const [a0, a1] of runs) boxInto(bank, 0, -T + a0 * .05 - .02, stubN * .05, D - .025, -T + a1 * .05 + .02, stubN * .05 + .06, D + T + .025, SK);
    return { P0, HC, segs, windows: wins, stub: stubN * .05, gaps };
  }
  // ── placing a piece (FORMAT.md space: the footprint's back-left corner, front toward +z; stamp's quarter turns)
  const occ = new Set(), items = [], wallsUsed = [];
  const meshOf = (o, opt, char) => { const V = HO.buildObject(o, opt), b = new Bank(true); meshVol(V, b); return char ? charBank(b) : b; };
  const occupy = (x0, z0, w, d) => { for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) occ.add(x + ',' + z); };
  for (const b of A.room.built ?? []) occupy(b.x, b.z, b.w, b.d);   // (MAINLAND: the safe and the dog never land in a wall or the car bay)
  function place(o, opt, X, Z, r = 0, y = 0, char) { const w = o.foot[0] * C4, d = o.foot[1] * C4, Tt = [[X, Z], [X, Z + w], [X + w, Z + d], [X + d, Z]][r & 3];
    stamp(meshOf(o, opt, char), bank, r, Tt[0], y, Tt[1]); }
  function onWall(o, opt, side, along, y, char) { const m = y ?? o.mount;   // back wall z = 0 · right wall x = W · left wall x = 0
    if (side === 'N') stamp(meshOf(o, opt, char), bank, 0, ox + along, m, 0); else if (side === 'E') stamp(meshOf(o, opt, char), bank, 3, W, m, along);
    else stamp(meshOf(o, opt, char), bank, 1, 0, m, along + o.foot[0] * C4); wallsUsed.push([side, along, along + o.foot[0] * C4, m, m + o.foot[1] * C4]); }
  const topOf = k => { const P = A.items[k]; return P ? HO.byId.get(P.id)?.tops?.[0] ?? .5 : .5; };
  function put(it, id, opt, char) { const o = HO.byId.get(id); if (!o) return null; const r = ((it.rot ?? 0) / 90) & 3;
    const on = it.on; if (on && on.wall) { onWall(o, opt, on.wall, it.x * C4, it.y, char); items.push({ it, o, r, y: it.y ?? o.mount, wall: on.wall, a: it.x * C4, x: ox + it.x * C4, z: 0 }); return o; }
    if (on === 'ceiling' || o.place === 'ceiling') { place(o, opt, ox + it.x * C4, it.z * C4, r, H, char); items.push({ it, o, r, y: H, ceil: true, x: ox + it.x * C4, z: it.z * C4 }); return o; }   // (home builder: turned about its footprint like a floor piece)
    const y = on && on.top !== undefined ? topOf(on.top) : 0; place(o, opt, ox + it.x * C4, it.z * C4, r, y, char);
    if (y === 0 && o.cat !== 'rugs') { const [w, d] = r & 1 ? [o.foot[1], o.foot[0]] : o.foot; occupy(it.x, it.z, w, d); }
    items.push({ it, o, r, y, x: ox + it.x * C4, z: it.z * C4 }); return o; };
  // a free floor spot in layout cells (w × d), near a wall, clear of every floor piece and floor slot; null when the room is full
  const slotRect = s => { const [w, d] = (s.rot / 90) & 1 ? [s.foot[1], s.foot[0]] : s.foot; return [s.x, s.z, w, d]; };
  const reserved = A.slots.filter(s => s.place === 'floor').map(slotRect);
  function spot(w, d, prefer = 'back') { const cand = [], mw = A.room.w, md = A.room.d;
    for (let z = 0; z + d <= md - 1; z++) for (let x = 0; x + w <= mw; x++) { let ok = true;
      for (let a = 0; a < w && ok; a++) for (let b = 0; b < d && ok; b++) if (occ.has((x + a) + ',' + (z + b))) ok = false;
      if (!ok || reserved.some(([sx, sz, sw, sd]) => x < sx + sw && x + w > sx && z < sz + sd && z + d > sz)) continue;
      const wallD = Math.min(z, x, mw - x - w), score = wallD * 3 + (prefer === 'front' ? (md - z - d) : z) + hash(x, z, seedOf(7)) * .5; cand.push([score, x, z]); }
    if (!cand.length) return null; cand.sort((p, q) => p[0] - q[0]); return [cand[0][1], cand[0][2]]; }
  // ── which layout pieces stay: a vacant home keeps its fixed kit; burned keeps a few husks; foreclosed is bare
  const FIXED = new Set(['kitchen', 'bath', 'storage']), BIG = new Set(['beds', 'seating', 'tables']);
  const keep = it => { const o = HO.byId.get(it.id); if (!o) return false; if (it.id === 'door-front' || it.id === 'window' || it.id === 'ac-window' || it.id === 'radiator') return true;
    if (burned) return BIG.has(o.cat) && hash(it.x, it.z, 3) < .6; if (foreclosed) return false; if (S.bare) return FIXED.has(o.cat); return true; };
  // (hardening 2026-10-05) a clean vacancy, nobody home and no scars, builds the layout's own `vacant` set instead (home/assemblies, check.mjs):
  // the shell and kitchen, a bare mattress, moving boxes, the FOR RENT board — the same pieces across a tier
  const vac = S.bare && !scars.size && Array.isArray(A.vacant) ? A.vacant : null, LIST = vac ?? A.items;
  const rugs = LIST.filter(it => HO.byId.get(it.id)?.cat === 'rugs');
  const doorIt = LIST.find(it => it.id === 'door-front');
  for (const it of [...rugs, ...LIST.filter(it => !rugs.includes(it))]) { if (!vac && !keep(it)) continue;
    const variant = it === doorIt && sec.has('door') ? 1 : it.variant ?? 0, st = it.state;
    put(it, it.id, { variant, seed: it.seed ?? seedOf(it.x ?? 0), state: st }, burned && it.id !== 'door-front'); }   // (it.seed: the home builder keeps a moved piece's look)
  // ── a home wider than its layout: a partition wall (a doorway at the front) and a side room with the bed (when the layout has none)
  // and the bath, from the tier's own pieces, so a long trailer or a wide house isn't half empty
  if (ox >= 1.4) { const pc = (A.room.walls?.E || '').startsWith('paint:') ? parseInt(A.room.walls.E.slice(7), 16) : 0xe6e1d6, px = ox - .1, gap = [Math.max(.2, D - 1.7), D - .7];
    boxInto(bank, 0, px, 0, 0, ox, H, gap[0], burned ? 0x1a1714 : pc); boxInto(bank, 0, px, 0, gap[1], ox, H, D, burned ? 0x1a1714 : pc); boxInto(bank, 0, px, 2.2, gap[0], ox, H, gap[1], burned ? 0x1a1714 : pc);
    boxInto(bank, 0, px - .02, H, 0, ox + .02, H + .06, D, 0xf7f7f2);
    const side = (id, X, Z, r = 0, opt = {}) => { const o = HO.byId.get(id); if (!o) return; place(o, { variant: 0, seed: seedOf(X * 10 | 0), ...opt }, X, Z, r, 0, burned); items.push({ it: { x: -1, z: -1 }, o, r, y: 0, x: X, z: Z }); };
    let z0 = .1; const tierBed = S.tier === 'penthouse' || S.tier === 'mainland' ? 'bed-platform' : S.tier === 'trailer' ? 'mattress-floor' : 'bed-double';
    if (!foreclosed && !(burned && hash(S.seed, 4, 4) < .5) && !S.bare && !A.items.some(it => HO.byId.get(it.id)?.cat === 'beds')) { const o = HO.byId.get(tierBed), w = o.foot[0] * C4; if (px - .2 >= w) { side(tierBed, (px - w) / 2, z0, 0, { variant: seedOf(1) % o.variants }); z0 += o.foot[1] * C4 + .3; } }
    if (!foreclosed && !burned && D - z0 >= 1.2 && px >= 1.2) { side('toilet', .1, D - 1.1 - .75 > z0 ? D - 1.9 : z0, 1); if (px >= 1.9) side('sink-bath', px - .6, Math.max(z0, D - 1.9)); } }
  // ── the owner's slots: their gear, collectibles and trophies (fills), else empty; a slot built for a sim piece takes that piece
  const slotPieces = [];
  A.slots.forEach((s, i) => { const f = S.fills?.[i]; if (!f || burned || foreclosed) return; const o = HO.byId.get(f.id); if (!o) return;
    const [sw, sd] = s.foot, [ow, od] = o.foot, dx = s.place === 'wall' || s.place === 'floor' || s.place === 'surface' ? Math.max(0, Math.floor((sw - ow) / 2)) : 0, dz = s.place === 'floor' || s.place === 'surface' ? Math.max(0, Math.floor((sd - od) / 2)) : 0;
    const it = { x: s.x + dx, z: s.z + dz, rot: s.rot, y: s.y, on: s.place === 'wall' ? { wall: s.wall } : s.place === 'surface' ? { top: s.on } : s.place === 'ceiling' ? 'ceiling' : 'floor' };
    put(it, f.id, { variant: f.variant ?? 0, seed: seedOf(40 + i), state: f.state }); slotPieces.push({ i, id: f.id }); });
  // ── security (the sim's sec): chain + locks and the keypad beside the door, the dog in its bed, the safe
  const doorSide = doorIt?.on?.wall ?? 'E', doorA = (doorIt?.x ?? 8) * C4, wallLen = side => side === 'N' ? Wr : D;
  const besideDoor = (w, off) => { const a1 = doorA + 1 + off, a0 = doorA - off - w; return a1 + w <= wallLen(doorSide) ? a1 : Math.max(.1, a0); };
  if (!burned && !foreclosed) {
    if (sec.has('lock')) onWall(HO.byId.get('door-locks'), { variant: sec.has('door') ? 2 : 1, seed: 3 }, doorSide, besideDoor(.25, .06), .9);
    if (sec.has('alarm')) onWall(HO.byId.get('alarm-keypad'), { variant: 1, seed: 3, state: 'armed' }, doorSide, besideDoor(.5, sec.has('lock') ? .45 : .1), 1.3);
    if (sec.has('door') && S.tier === 'apartment') onWall(HO.byId.get('gate-scissor'), { variant: 0, seed: 3, state: 'open' }, doorSide, Math.max(0, doorA - 1.3), 0);
    if (sec.has('dog') && !slotPieces.some(p => p.id === 'dog-bed')) { const p = spot(4, 3, 'front'); if (p) { put({ x: p[0], z: p[1], rot: 0, on: 'floor' }, 'dog-bed', { variant: hash(S.seed, 2, 3) * 3 | 0, seed: 5 }); } }
    const bed = items.find(p => p.o.id === 'dog-bed'); if (bed && (sec.has('dog') || slotPieces.some(p => p.id === 'dog-bed'))) stamp(dog(S.seed & 3, (S.seed >> 2) % 5, 'sit'), bank, 0, bed.x + .38, .1, bed.z + .3);
    if (sec.has('safe') && !items.some(p => p.o.sim === 'safe')) { const id = S.tier === 'penthouse' || S.tier === 'house' || S.tier === 'mainland' ? 'safe-floor' : 'safe-small', o = HO.byId.get(id), p = spot(o.foot[0], o.foot[1]);
      if (p) put({ x: p[0], z: p[1], rot: 0, on: 'floor' }, id, { variant: 0, seed: 6, state: scars.has('crime') ? 'open' : 'closed' }); } }
  // ── scars
  const rnd = k => hash(S.seed ?? 1, k, 77);
  if (scars.has('crime')) {   // crime tape strung across the room (two runs, sagging), evidence tents on the floor
    const tape = (x0, y0, z0, x1, y1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / .1); for (let k = 0; k < n; k++) { const t = k / n, sag = Math.sin(t * Math.PI) * .12, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t - sag;
      boxInto(bank, 0, x - .055, y, z - .055, x + .055, y + .07, z + .055, k % 6 === 5 ? 0x17171b : 0xffd21a); } };
    tape(.05, 1.15, D - .5, W - .05, 1.0, D * .35); tape(.05, .95, D * .3, W - .05, 1.2, D - .35); tape(.05, 1.35, D * .62, W - .05, 1.35, D * .58);
    for (let k = 0; k < 4; k++) { const p = spot(1, 1, 'front'); if (!p) break; const x = ox + p[0] * C4 + .06, z = p[1] * C4 + .06; occupy(p[0], p[1], 1, 1);
      boxInto(bank, 0, x, 0, z, x + .12, .14, z + .1, 0xffd21a); boxInto(bank, 0, x + .03, .05, z + .1, x + .09, .1, z + .102, 0x17171b); }
    for (let k = 0; k < 3; k++) { const p = spot(3, 3, 'front'); if (!p) break; put({ x: p[0], z: p[1], rot: 0, on: 'floor' }, k === 1 ? 'pizza-boxes' : 'laundry-pile', { variant: (rnd(k) * 3) | 0, seed: 9 + k }); } }
  if (scars.has('boarded')) {   // planks over every window from inside (a penthouse's glass wall gets them across the glass)
    const planks = (side, a0, a1, y0, y1) => { for (let k = 0; k < 3; k++) { const y = y0 + (y1 - y0) * (.2 + k * .3), c = [0xb58a55, 0xa0784a, 0xc49a62][k];
      if (side === 'N') boxInto(bank, 0, ox + a0 - .12, y, .12, ox + a1 + .12, y + .18, .17, c); else if (side === 'E') boxInto(bank, 0, W - .17, y, a0 - .12, W - .12, y + .18, a1 + .12, c); } };
    for (const p of items) if (p.o.id === 'window' || p.o.id === 'ac-window') { const side = p.it.on?.wall ?? 'N', a = p.it.x * C4; planks(side, a, a + p.o.foot[0] * C4, p.it.y ?? p.o.mount, (p.it.y ?? p.o.mount) + p.o.foot[1] * C4); }
    if (A.room.walls?.N === 'glass') for (let a = .4; a < Wr - 1; a += 1.6) planks('N', a, a + 1.2, .4, 2.4); }
  if (scars.has('boarded') && S.bare) for (let k = 0; k < 4; k++) { const id = ['mattress-floor', 'pizza-boxes', 'laundry-pile', 'pizza-boxes'][k], o = HO.byId.get(id), p = spot(o.foot[0], o.foot[1], k ? 'front' : 'back');   // left behind
    if (p) put({ x: p[0], z: p[1], rot: 0, on: 'floor' }, id, { variant: k === 1 ? 2 : (rnd(k) * 2) | 0, seed: 20 + k }); }
  if (burned) for (let k = 0; k < 6; k++) { const x = rnd(k) * (W - .8) + .2, z = rnd(k + 9) * (D - .8) + .2, w = .3 + rnd(k + 3) * .5; boxInto(bank, 0, x, 0, z, x + w, .04 + rnd(k + 5) * .08, z + w * .7, k & 1 ? 0x3a3632 : 0x55504a); }
  if (foreclosed) {   // the notice on the back wall (a red header, typed lines), a couple of moving boxes, one chair left behind
    const nx = ox + Wr / 2 - .3; boxInto(bank, 0, nx, 1.2, .02, nx + .6, 2.0, .04, 0xf7f7f2); boxInto(bank, 0, nx + .04, 1.82, .04, nx + .56, 1.95, .045, 0xe8232a);
    for (let k = 0; k < 6; k++) boxInto(bank, 0, nx + .06, 1.7 - k * .08, .04, nx + .5 - (k % 3) * .08, 1.73 - k * .08, .045, 0x3a3a44);
    for (let k = 0; k < 2; k++) { const x = .4 + k * .55, z = D - 1.2 - k * .2; boxInto(bank, 0, x, 0, z, x + .5, .38, z + .4, 0xc49a62); boxInto(bank, 0, x, .38, z + .17, x + .5, .39, z + .23, 0xd9c29a); } }
  if (scars.has('memorial')) {   // candles, flowers and the photo, against the back wall
    const mx = ox + Wr / 2 - .6; boxInto(bank, 0, mx + .35, 0, .05, mx + .85, .6, .1, 0x17171b); boxInto(bank, 0, mx + .4, .08, .1, mx + .8, .55, .11, 0xd6c7b0);
    for (let k = 0; k < 7; k++) { const x = mx + k * .18, z = .25 + (k & 1) * .14, h = .1 + rnd(k) * .12; boxInto(bank, 0, x, 0, z, x + .06, h, z + .06, 0xf7f1e0); boxInto(bank, S.night ? 3 : 0, x + .02, h, z + .02, x + .04, h + .04, z + .04, 0xffb347); }
    for (let k = 0; k < 5; k++) { const x = mx + .1 + k * .24, z = .5; boxInto(bank, 0, x + .02, 0, z, x + .04, .3, z + .02, 0x2f8a3a); boxInto(bank, 0, x - .03, .3, z - .03, x + .09, .38, z + .07, [0xff4fa3, 0xffffff, 0xffd21a, 0xe8232a, 0xffffff][k]); } }
  if (S.forRent && !burned && !vac) { const p = spot(2, 1, 'front'), x = p ? ox + p[0] * C4 : W / 2, z = p ? p[1] * C4 : D - .8; boxInto(bank, 0, x, 0, z, x + .5, .36, z + .03, 0xe8232a); boxInto(bank, 0, x + .05, .08, z + .03, x + .45, .3, z + .035, 0xf7f7f2); }
  // ── who's home: where a sleeper lies (a bed, else the longest seat)
  const sleepOn = items.find(p => p.o.cat === 'beds') ?? items.filter(p => p.o.cat === 'seating' && p.y === 0).sort((p, q) => q.o.foot[0] - p.o.foot[0])[0] ?? null;
  const bed = sleepOn && !burned && !foreclosed ? { x: sleepOn.x, z: sleepOn.z, r: sleepOn.r, w: sleepOn.o.foot[0] * C4, d: sleepOn.o.foot[1] * C4, top: sleepOn.o.cat === 'beds' ? (sleepOn.o.seat ?? Math.min(.55, sleepOn.o.h * .55)) : (sleepOn.o.seat ?? .45), kind: sleepOn.o.cat } : null;
  TOD.night = nightWas;
  // (home builder) every placed piece's box in room metres [x0, y0, z0, x1, y1, z1]: the visit view's lock badges and showcase brackets
  const pieces = items.map(p => { const o = p.o, w = o.foot[0] * C4, d = o.foot[1] * C4, t = Math.max(.04, o.h);
    if (p.wall) { const y0 = p.y, y1 = y0 + d; return { id: o.id, box: p.wall === 'N' ? [ox + p.a, y0, 0, ox + p.a + w, y1, t] : [W - t, y0, p.a, W, y1, p.a + w] }; }
    const [rw, rd] = p.r & 1 ? [d, w] : [w, d], y0 = p.ceil ? H - o.h : p.y; return { id: o.id, box: [p.x, y0, p.z, p.x + rw, y0 + o.h, p.z + rd] }; });
  return { bank, bed, W, D, H, ox, glass: A.room.walls?.N === 'glass', ms: Date.now() - t0, slots: slotPieces, pieces, art };
}
