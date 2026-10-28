// Block interiors (pass 1b, calmed in 1c: neutral fences and sheds, more trees, fewer bright items — a rest from above): nothing stays empty. The core behind the lots is split into backyards (each owned by its nearest lot),
// fenced in varied planks, paved / grassed / dirt, and furnished by size: hoop courts, parked cars, sheds, tables, pools, gardens.
import { Vol, meshVol, stamp } from './vox.js';
import { REG, bankBox } from './audit.js';
import { PAL, CV, SIDE, hash, shade } from './style.js';
import { YARD, CALM } from './lexicon.js';
import { shed, hoop, picnic, grill, lawnChair, kiddiePool, couch, tires, trashCan, dumpster, bike, planterBed, potPlant, tree, car, carOnBlocks, laundry, bags, milkCrate } from './props.js';
import { unshift } from '../../world/city.js';   // (SPREAD pins: a person's look seed reads today's position)
const G = .5;
export function yards(bank, b, lots, r, A, opt = {}) {
  const R = b.R, gx = Math.round((R.x1 - R.x0) / G), gz = Math.round((R.z1 - R.z0) / G), own = new Int16Array(gx * gz).fill(-1);
  const built = lots.filter(l => l.spec && l.spec.type !== 'alley');
  // footprints (+ a margin for back-wall sills and fire escapes) are taken
  built.forEach(l => { const m = l.spec.type === 'parking' || l.spec.type === 'calm' ? 0 : .5, i0 = Math.max(0, Math.floor((l.x0 - m - R.x0) / G)), i1 = Math.min(gx, Math.ceil((l.x1 + m - R.x0) / G)), k0 = Math.max(0, Math.floor((l.z0 - m - R.z0) / G)), k1 = Math.min(gz, Math.ceil((l.z1 + m - R.z0) / G));
    for (let i = i0; i < i1; i++) for (let k = k0; k < k1; k++) own[i + k * gx] = -2; });
  const alleys = lots.filter(l => l.spec?.type === 'alley');
  const cellOf = (x, z) => [Math.floor((x - R.x0) / G), Math.floor((z - R.z0) / G)];
  const dist = (l, x, z) => Math.hypot(Math.max(l.x0 - x, 0, x - l.x1), Math.max(l.z0 - z, 0, z - l.z1));
  const owners = built.filter(l => l.spec.type !== 'parking' && l.spec.type !== 'calm');
  for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) { const n = i + k * gx; if (own[n] === -2) continue; const x = R.x0 + (i + .5) * G, z = R.z0 + (k + .5) * G;
    let best = -1, bd = 1e9; owners.forEach((l, q) => { const d = dist(l, x, z); if (d < bd) { bd = d; best = q; } }); own[n] = best; }
  // alley corridors: carry the alley lot straight through to the core
  for (const a of alleys) for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) { const x = R.x0 + (i + .5) * G, z = R.z0 + (k + .5) * G; if (own[i + k * gx] === -2) continue;
    if (a.main[1] === 'z' ? (x > a.x0 && x < a.x1) : (z > a.z0 && z < a.z1)) own[i + k * gx] = 900; }
  const V = new Vol(Math.round((R.x1 - R.x0) / CV), 16, Math.round((R.z1 - R.z0) / CV), { s: CV, org: [R.x0, SIDE, R.z0] }), c5 = Math.round(G / CV);
  // ground: each yard its own surface
  const surf = q => ['grass', 'paved', 'dirt', 'grass', 'deck', 'paved'][(owners[q]?.spec.seed ?? q) % 6];
  const SURF = { grass: (x, z) => ((x * 7 + z * 3) % 13 === 0) ? 0x46b04a : 0x5cc24a, paved: (x, z) => ((x % 15 === 0) || (z % 15 === 0)) ? 0xc9c2b4 : 0xdcd5c7, dirt: (x, z) => ((x * 5 + z * 11) % 9 === 0) ? 0xa87a4a : 0xb98a58,
    deck: (x, z) => (z % 4 === 0) ? 0x9a5a2a : 0xc98a4b, alley: (x, z) => ((x * 3 + z * 5) % 17 === 0) ? 0x52535f : 0x6a6b78 };
  for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) { const o = own[i + k * gx]; if (o === -2) continue; const S = SURF[o === 900 ? 'alley' : surf(o)];
    V.box(i * c5, 0, k * c5, (i + 1) * c5, 1, (k + 1) * c5, (x, y, z) => S(x, z)); }
  // fences on owner boundaries (planks in the owner's colour, chain-link on alleys)
  const fcol = q => q === 900 ? PAL.iron : CALM[((owners[q]?.spec.seed ?? q) >>> 2) % 4];
  for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) { const o = own[i + k * gx]; if (o < 0) continue;
    if (i + 1 < gx) { const p = own[i + 1 + k * gx]; if (p >= 0 && p !== o) { const x = (i + 1) * c5, c = fcol(Math.min(o, p)), chain = o === 900 || p === 900; V.box(x, 1, k * c5, x + 1, 12, (k + 1) * c5, (xx, y, z) => chain ? ((y + z) % 2 ? PAL.iron : undefined) : (z % 5 === 0 ? shade(c, .8) : c)); } }
    if (k + 1 < gz) { const p = own[i + (k + 1) * gx]; if (p >= 0 && p !== o) { const z = (k + 1) * c5, c = fcol(Math.min(o, p)), chain = o === 900 || p === 900; V.box(i * c5, 1, z, (i + 1) * c5, 12, z + 1, (x, y) => chain ? ((y + x) % 2 ? PAL.iron : undefined) : (x % 5 === 0 ? shade(c, .8) : c)); } } }
  REG.surface(V); meshVol(V, bank);   // pass 1d: the yard floor is a walkable surface (props and people stand on top of it)
  let camCell = null;
  { let n = 0, sx = 0, sz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) if (own[i + k * gx] >= 0) { const x = R.x0 + (i + .5) * G, z = R.z0 + (k + .5) * G; n++; sx += x; sz += z; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    // the most open free cell (farthest from any building) and the free cell farthest from it: a camera line across the yards
    const built2 = [], free = []; for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) (own[i + k * gx] === -2 ? built2 : (own[i + k * gx] >= 0 && own[i + k * gx] !== 900) ? free : []).push([i, k]);
    let od = -1, oi = 0, ok = 0; for (const [i, k] of free) { let d = 1e9; for (const [a, c] of built2) { const q = (a - i) ** 2 + (c - k) ** 2; if (q < d) d = q; } if (d > od) { od = d; oi = i; ok = k; } }
    let fd = -1, fi = 0, fk = 0; for (const [i, k] of free) { const q = (i - oi) ** 2 + (k - ok) ** 2; if (q > fd) { fd = q; fi = i; fk = k; } }
    camCell = [oi, ok];
    (A.cores ??= []).push({ b: b.i + ',' + b.j, area: n * G * G, open: Math.sqrt(od) * G, ox: R.x0 + (oi + .5) * G, oz: R.z0 + (ok + .5) * G, fx: R.x0 + (fi + .5) * G, fz: R.z0 + (fk + .5) * G }); }
  // furnish each yard by its size; an alley gets dumpsters + bags
  const cells = new Map(); for (let i = 0; i < gx; i++) for (let k = 0; k < gz; k++) { const o = own[i + k * gx]; if (o < 0) continue; if (!cells.has(o)) cells.set(o, []); cells.get(o).push([i, k]); }
  const used = new Uint8Array(gx * gz); let hoopDone = false, carDone = 0, people = 0;
  if (camCell) for (let i = camCell[0] - 3; i <= camCell[0] + 3; i++) for (let k = camCell[1] - 3; k <= camCell[1] + 3; k++) if (i >= 0 && k >= 0 && i < gx && k < gz) used[i + k * gx] = 1;   // keep the view spot clear
  const place = (o, w, d, fn, ok2) => { const list = cells.get(o); if (!list) return null; for (let t = 0; t < 24; t++) { const [i, k] = list[(r() * list.length) | 0], rot = (r() * 4) | 0, cw = Math.ceil((rot & 1 ? d : w) / G), cd = Math.ceil((rot & 1 ? w : d) / G);
    let ok = true; for (let a = 0; a < cw && ok; a++) for (let c = 0; c < cd && ok; c++) { const ii = i + a, kk = k + c; if (ii >= gx || kk >= gz || own[ii + kk * gx] !== o || used[ii + kk * gx]) ok = false; }
    if (!ok) continue; const x = R.x0 + (i + cw / 2) * G, z = R.z0 + (k + cd / 2) * G; if (ok2 && !ok2(x, z, rot)) continue;
    for (let a = 0; a < cw; a++) for (let c = 0; c < cd; c++) used[i + a + (k + c) * gx] = 1; fn(x, z, rot); return { x, z, rot }; } return null; };
  // pass 1d: footprints come from the prop itself (hand-typed sizes let couches run into dumpsters); tall things (trees, hoops, laundry)
  // also need their crown / board / line clear of buildings, back-wall fire escapes and each other
  const sz = bk => { const b = bankBox(bk); return [Math.max(.5, b[3] - b[0]), Math.max(.5, b[5] - b[2])]; };
  const clear = bk => (x, z, rot) => REG.fits(REG.boxOf(bk, rot, x, SIDE, z), { doors: false });
  // no prop straddles a fence: the yard volume must be empty (above its floor) under the prop's footprint
  const fenceFree = bk => (x, z, rot) => { const e = REG.boxOf(bk, rot, x, SIDE, z), i0 = Math.max(0, Math.floor((e[0] + .02 - R.x0) / CV)), i1 = Math.min(V.nx, Math.ceil((e[3] - .02 - R.x0) / CV)), k0 = Math.max(0, Math.floor((e[2] + .02 - R.z0) / CV)), k1 = Math.min(V.nz, Math.ceil((e[5] - .02 - R.z0) / CV));
    for (let y = 1; y < 12; y++) for (let k = k0; k < k1; k++) for (let i = i0; i < i1; i++) if (V.d[i + k * V.nx + y * V.sxz]) return false; return true; };
  const put = (o, bk, tall = false) => { const ff = fenceFree(bk), cl = tall ? clear(bk) : null; return place(o, ...sz(bk), (x, z, rot) => stamp(bk, bank, rot, x, SIDE, z), (x, z, rot) => ff(x, z, rot) && (!cl || cl(x, z, rot))); };
  const putTree = (o, bk) => { const cl = clear(bk); return place(o, 1, 1, (x, z, rot) => stamp(bk, bank, rot, x, SIDE, z), cl); };   // trunk cell + a clear crown
  const life = (x, z, ry, act, extra = {}) => { const [ux, uz] = unshift(x, z); A.life.push({ x, y: SIDE, z, ry, act, seed: (ux * 131 + uz * 17) | 0, ...extra }); people++; };   // (SPREAD pin: the look seed reads today's place)
  const order = [...cells.keys()].sort((p, q) => cells.get(q).length - cells.get(p).length);
  for (const o of order) { const n = cells.get(o).length * G * G, sd = o === 900 ? 0 : owners[o].spec.seed, h = hash(sd, 77);
    if (o === 900) { for (let k = 0; k < 2; k++) put(o, dumpster([0x25b84c, 0x2f5bff, 0xe8232a][(sd + k) % 3])); put(o, bags(sd + 3)); put(o, tires());
      for (let k = 0; k < 3; k++) put(o, milkCrate([0xe8232a, 0x2f5bff, 0xffe23a][k])); put(o, couch(0x7a3cff));
      const p = place(o, .8, .8, () => {}); if (p) life(p.x, p.z, hash(sd, 4) * 6.28, 'lean'); continue; }
    if (n >= 10 && !hoopDone && h < .5) { const p = place(o, 3.2, 4.2, (x, z, rot) => { stamp(hoop(), bank, rot, x, SIDE, z); }, clear(hoop())); if (p) { hoopDone = true; const [dx, dz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][p.rot]; life(p.x + dx * 2.4, p.z + dz * 2.4, Math.atan2(-dx, -dz), 'shoot'); life(p.x + dx * 2.6 + dz * .9, p.z + dz * 2.6 - dx * .9, Math.atan2(-dx, -dz) + .6, 'stand'); continue; } }
    if (n >= 9 && carDone < 2 && h < .75) { const p = put(o, carDone === 0 && opt.carBlocks ? carOnBlocks(sd) : car(sd + 5)); if (p) { carDone++; if (carDone === 1 && opt.carBlocks) life(p.x + 1.4, p.z + .4, 1.8, 'arms'); continue; } }
    if (n >= 6) { const k = (h * 5) | 0;
      if (k === 0) put(o, shed(CALM[(sd >>> 0) % CALM.length], sd));
      else if (k === 1) { const p = put(o, picnic(0xa4652f)); put(o, grill()); if (p && people < 4) { const [c, sn] = [[1, 0], [0, 1], [-1, 0], [0, -1]][p.rot]; life(p.x + .65 * sn, p.z + .65 * c, Math.PI + p.rot * Math.PI / 2, 'sit', { seatY: .4 }); } }   // pass 1d: on the bench, facing the table
      else if (k === 2) { putTree(o, tree(sd + 2)); const c = put(o, lawnChair(YARD[sd % 8])); if (c && people < 4) life(c.x, c.z, c.rot * Math.PI / 2 + Math.PI, 'lounge'); }
      else if (k === 3) { const c = put(o, couch(YARD[(sd >> 2) % 8])); put(o, tires()); if (c && people < 4) life(c.x, c.z, [0, Math.PI / 2, Math.PI, -Math.PI / 2][c.rot], 'sit', { seatY: .5 }); }
      else { put(o, planterBed(sd)); put(o, planterBed(sd + 1)); }
      if (r() < .16) put(o, laundry(sd), true);
      if (r() < .75) putTree(o, tree(sd)); }
    put(o, trashCan([0x25b84c, 0x2f5bff, 0x17171b][sd % 3]));
    if (n >= 3 && r() < .5) put(o, bike(YARD[(sd >> 3) % 8]));
    if (n >= 2 && r() < .5) put(o, potPlant(sd));
  }
  // cleanup pass · a dog in about one yard in three, on a free cell (chosen by hash, not the block's rng, so nothing else moves); it is
  // stamped after the cast is made (jobs.js placeDogs), where it is clear of people and props
  // (its cell and the eight round it free and in the same yard: clear of fences, back walls and whatever the yard holds)
  for (const o of order) { if (o === 900) continue; const sd = owners[o].spec.seed, list = cells.get(o); if (hash(sd, 91) > .33) continue;
    for (let t = 0; t < 12; t++) { const [i, k] = list[(hash(sd, 92 + t) * list.length) | 0]; let ok = true;
      for (let a = -1; a <= 1 && ok; a++) for (let c = -1; c <= 1 && ok; c++) { const ii = i + a, kk = k + c; if (ii < 0 || kk < 0 || ii >= gx || kk >= gz || own[ii + kk * gx] !== o || used[ii + kk * gx]) ok = false; }
      if (ok) { (A.dogs ??= []).push({ x: R.x0 + (i + .5) * G, z: R.z0 + (k + .5) * G, rot: (hash(sd, 93) * 4) | 0, seed: sd }); break; } } }
  return people;
}
