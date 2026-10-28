// SIM LIVE pass · STAND SPOTS: where the sim's agents stand at each sim place (agents.js), made OFFLINE from the blocks' own audit
// builds (jobs.js jobBlock with the audit on: every mass, facade part, prop voxel and standing person the block holds, and its walker
// lanes). A spot is kept when:
//   · a standing agent there touches nothing (audit.js walkBlockIn, with a standing person's discs: body .3, head .42 m)
//   · it is at least CLEAR m from every walker lane (a walker is ~0.6 m across and the lanes are its centre line: nobody walks into it)
//   · it is clear of the layer's own pieces there (a site's piles and spill heap, a corner's hotspot) and of the other spots (GAP)
//   · on the block's slab (not the road), inside the place's radius
// and each gets its ENTRY: the lane point it is walked to and from, with a straight, clear step between them (no prop, person, other
// spot or other lane on the way; at most STEP m). Spots nearest the place's focus win (a pile, the hotspot, the place's own point).
// Run it with node style/city/simstate/stands.mjs (headless Chrome: ?sim=live&simstands=1&shot=1) → simstate/stands.json. Re-run it when
// a kit changes the ground round a sim place (the stitching, the fringe or the water-side agents): a stale spot could stand in a new prop.
// W8 · CITY LIFE (2026-10-08): every spot gets a KIND, so simstate/life.js plays the right loop there — `wall` (lean_wall: a building's
// wall 0.2 m behind `lean`), `stoop` (sit_stoop: a 0.15–0.35 m ledge at `sit`, the seat over the walker's spot), `bench` (sit_bench: a seat
// of one of the city's benches, the spot raised 0.1 m), `corner` (near a corner's own crossing), `open` — and its room to move, all checked
// with a walker's discs, 0.8 m off every lane and clear of every other spot and path: `pace` (deal_pace's strip, 0.13 × 1.15 m ahead, the
// street on its +x side), `beat` (a cop's, or a worker's, short walk along the kerb or round the pile: one or two ends), `st` (the yaw
// that faces the street). A place that finds fewer than MIN spots looks again WIDER (Grand & 1st, the precinct, the court).
// THE KERB-WAIT ROWS (2026-10-09; slime at the Grand Ave & 1st robbery: "the dude getting robbed's head is intersecting with a
// pedestrian"). On DON'T WALK a crossing's walkers wait at the kerb in a row along the node's own sidewalk (pedsim.js KERB: 0.2 m from
// the curb, out to 4.2 m from the corner's line), and they walk out to it and up from the far kerb across the corner square. dialog.box's
// spot stood 0.81 m from one such row, strip.local2's 0.86 m: a waiter's big head sat in theirs whenever someone waited for the light.
// Every spot, and every path of its life (lean, sit, pace, beat, a bench seat), now keeps STAND.kerb m from each row (as long as that
// crossing's row can grow: pedsim.js kerbOf, the kerb strip clear of the build and the lane passing behind it) and from each zebra
// approach (the node to the kerb it steps off, to the second file's spot, and to the kerb the crossing coming in steps up at).
import { P, kindAt, urban, segX, segZ } from '../plan.js';
import { slab, hotspotBox } from '../ground.js';
import { SIDE } from '../style.js';
import { walkBlockIn, colsOf } from '../audit.js';
import { hotspotAt } from './layer.js';
import { buildsBlock, MODS } from '../modules.js';
import { RULES } from './adapter.js';
import { NODE, DETOUR_ROAD, STEP as KSTEP, FILES, KERB } from '../pedsim.js';
import { sdata } from '../../../world/city.js';

export const STAND = {
  radius: { site: 8, corner: 14, hangout: 10, plaza: 12, park: 12, fit: 9, jail: 18, motel: 12, police: 7, court: 9 },   // metres round the place; kinds not listed: indoors only (a corner's own square is the walkers': its crew stands off it)
  wide: { corner: 26, police: 18, court: 18, site: 12, hangout: 14, fit: 14, motel: 16, plaza: 16, park: 16 },   // W8: the second look, when the first finds fewer than MIN
  count: { site: 10, corner: 10, hangout: 12, plaza: 8, park: 10, fit: 8, jail: 10, motel: 6, police: 6, court: 4 },
  // C1-7: places that hold more people than their kind's count (night 2's fourteen at the docks, three of them cuffed): the same rules, more spots
  place: { docks: 24 },
  grid: .5, CLEAR: .95, GAP: 1.3, STEP: 6, STEP2: 14, body: .3, head: .42, walker: [.26, .39],   // STEP2: the longest walk-up where no short one exists
  MIN: 5, seats: 4,   // W8: fewer spots than this → look wider · bench seats per place (on top of count)
  kerb: 1.35,   // m from every kerb-wait row and zebra approach (centre to its line): two of the big heads (1.0 × 0.85 m) clear at any yaw
  life: { lane: .8, pace: 1.15, beat: [4.5, 3, 2], keep: .85, corner: 9 },   // m: a path's clearance from every lane · deal_pace's strip · a beat's arm lengths tried · a path's from every other spot · a `corner` spot's reach from the crossing
};
const d2 = (a, b, x, z) => Math.hypot(a - x, b - z), WAIT = 1;   // (WAIT: agents.js waits this far up the step from the lane point)
export async function makeStands({ places, flags = {}, cornerKits = new Set(), log = () => {} }) {
  const J = await import('../jobs.js'), out = { generated: new Date().toISOString(), note: 'SIM LIVE pass: where the sim\'s agents stand at each place (simstate/stands.js). Re-run node style/city/simstate/stands.mjs after a kit changes the ground round a sim place.', places: {}, skipped: {} };
  const built = new Map(), t0 = performance.now();
  const block = (i, j) => { const k = i + ',' + j; if (built.has(k)) return built.get(k); let r = null;
    if (urban(kindAt(i, j)) || buildsBlock(i, j)) { try { const res = J.jobBlock({ i, j, night: false, audit: true, chars: false, flags }); r = { i, j, lanes: res.lanes, snap: res.lanes?.snap || null, people: res.lanes?.people || [], errors: res.errors || [] }; } catch (e) { r = { i, j, error: String(e && e.message || e) }; } }
    built.set(k, r); return r; };
  // where walkers walk on a block, as world points { x, z, y, side, u, i, j, du }: its lanes (with pedsim.js's ramps round a detour
  // corner) and, at every corner, the node and the crossings' first metres (side: null — never an entry)
  const laneCache = new Map(), ENDS = { N: ['NW', 'NE'], S: ['SW', 'SE'], W: ['NW', 'SW'], E: ['NE', 'SE'] };
  function lanePts(i, j) { const k = i + ',' + j; if (laneCache.has(k)) return laneCache.get(k); const b = block(i, j), pts = [];
    const L = b?.lanes?.sides, det = b?.lanes?.detour || []; if (L) { const s = slab(i, j);
      for (const [side, v] of Object.entries(L)) { const ns = side === 'N' || side === 'S', step = v.step || .1, uEnd = v.u0 + (v.c.length - 1) * step;
        for (let q = 0; q < v.c.length; q++) { const u = v.u0 + q * step; let c = v.c[q];
          for (const cn of ENDS[side]) { const d = det.find(e => e.c === cn); if (!d) continue; const e = ns ? (cn[1] === 'W' ? u - s.x0 : s.x1 - u) : (cn[0] === 'N' ? u - s.z0 : s.z1 - u);
            if (e <= d.r0) c = -DETOUR_ROAD; else if (e < d.r1) c = -DETOUR_ROAD + (c + DETOUR_ROAD) * (e - d.r0) / (d.r1 - d.r0); }
          let x, z; if (ns) { x = u; z = side === 'N' ? s.z0 + c : s.z1 - c; } else { z = u; x = side === 'W' ? s.x0 + c : s.x1 - c; }
          pts.push({ x, z, y: c < -.05 ? 0 : SIDE, side, u, i, j, c, du: Math.min(u - v.u0, uEnd - u) }); } }
      for (const cn of ['NW', 'NE', 'SW', 'SE']) { const w = cn[1] === 'W', n = cn[0] === 'N', nx = w ? s.x0 + NODE : s.x1 - NODE, nz = n ? s.z0 + NODE : s.z1 - NODE;
        for (let t = 0; t <= NODE + .5; t += .1) { pts.push({ x: nx, z: n ? nz - t : nz + t, y: SIDE, side: null, i, j, du: 0 }); pts.push({ x: w ? nx - t : nx + t, z: nz, y: SIDE, side: null, i, j, du: 0 }); } } }
    laneCache.set(k, pts); return pts; }
  // THE KERB-WAIT ROWS and the zebra approaches of a block's four corner nodes, as segments [ax, az, bx, bz] (see the header). Each node
  // steps off across its OWN side's curb (NW: the N side, NE: E, SE: S, SW: W — pedsim.js, anticlockwise round the junction) and its row
  // runs along that side, KERB.c from its curb, the way the side's walkers go; the crossing coming in steps up across the other side's curb
  const kerbCache = new Map(), OUTS = { NW: 'N', NE: 'E', SE: 'S', SW: 'W' }, INS = { NW: 'W', NE: 'N', SE: 'E', SW: 'S' };
  const NRM = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }, RUN = { N: [1, 0], E: [0, 1], S: [-1, 0], W: [0, -1] };   // (a side's outward normal · the way its walkers go)
  const hasSide = (i, j, side) => urban(kindAt(i, j)) && (side === 'N' ? segZ(j, i) : side === 'S' ? segZ(j + 1, i) : side === 'W' ? segX(i, j) : segX(i + 1, j));
  function kerbSegs(i, j) { const k = i + ',' + j; if (kerbCache.has(k)) return kerbCache.get(k); const b = block(i, j), segs = [], L = b?.lanes?.sides;
    if (L && urban(kindAt(i, j))) { const s = slab(i, j), det = b.lanes.detour || [];
      const crosses = { NW: [segZ(j, i) && hasSide(i, j - 1, 'W') && hasSide(i, j, 'W'), segX(i, j) && hasSide(i - 1, j, 'N') && hasSide(i, j, 'N')],   // [out, in]
        NE: [segX(i + 1, j) && hasSide(i, j, 'N') && hasSide(i + 1, j, 'N'), segZ(j, i) && hasSide(i, j - 1, 'E') && hasSide(i, j, 'E')],
        SE: [segZ(j + 1, i) && hasSide(i, j, 'E') && hasSide(i, j + 1, 'E'), segX(i + 1, j) && hasSide(i, j, 'S') && hasSide(i + 1, j, 'S')],
        SW: [segX(i, j) && hasSide(i - 1, j, 'S') && hasSide(i, j, 'S'), segZ(j + 1, i) && hasSide(i, j, 'W') && hasSide(i, j + 1, 'W')] };
      for (const cn of ['NW', 'NE', 'SE', 'SW']) { const nx = cn[1] === 'W' ? s.x0 + NODE : s.x1 - NODE, nz = cn[0] === 'N' ? s.z0 + NODE : s.z1 - NODE, [out, inn] = crosses[cn];
        if (inn) { const n = NRM[INS[cn]]; segs.push([nx, nz, nx + n[0] * NODE, nz + n[1] * NODE]); }   // (up from the far kerb, to the node)
        const O = OUTS[cn], v = L[O]; if (!out || !v) continue; const u = NRM[O], aw = RUN[O], kx = nx + u[0] * KSTEP, kz = nz + u[1] * KSTEP;
        segs.push([nx, nz, kx, kz]);   // (file 0 out to the kerb)
        // the row's length as pedsim.js kerbOf grows it: the kerb strip's clear length (engine.js lanesOf kz) and the lane behind it
        const D = det.some(d => d.c === cn) ? -1 : Array.isArray(v.kz) ? v.kz[O === 'N' || O === 'E' ? 0 : 1] : null, ns = O === 'N' || O === 'S', uN = ns ? nx : nz, sg = ns ? aw[0] : aw[1], st = v.step || .1;
        const laneC = uu => { const q = (uu - v.u0) / st, a = Math.max(0, Math.min(v.c.length - 1, Math.floor(q))), b2 = Math.min(v.c.length - 1, a + 1), f = Math.max(0, Math.min(1, q - a)); return v.c[a] * (1 - f) + v.c[b2] * f; };
        const laneOK = x => { for (let y = Math.max(0, x - .95); y <= x + .95 + 1e-6; y += .1) if (laneC(uN + sg * y) < KERB.c + KERB.pass) return false; return true; };
        const f1 = D === null ? true : D >= FILES[1] - 1e-6 && laneOK(FILES[1]); let m = 0;
        if (D !== null && f1) while (m < 3 && FILES[1] + (m + 1) * KERB.d <= D + 1e-6 && laneOK(FILES[1] + (m + 1) * KERB.d)) m++;
        const len = f1 ? FILES[1] + m * KERB.d : 0;
        if (f1) segs.push([nx, nz, kx + aw[0] * FILES[1], kz + aw[1] * FILES[1]]);   // (the second file out to its spot)
        if (len > 0) segs.push([kx, kz, kx + aw[0] * len, kz + aw[1] * len]); } }   // (the row)
    kerbCache.set(k, segs); return segs; }
  const onSlab =(x, z) => { const i = Math.floor(x / P), j = Math.floor(z / P); if (!urban(kindAt(i, j))) return buildsBlock(i, j) ? { i, j, y: 0 } : null;   // (a kit's open land, the woods: its ground)
    const s = slab(i, j); return x > s.x0 + .05 && x < s.x1 - .05 && z > s.z0 + .05 && z < s.z1 - .05 ? { i, j, y: SIDE } : null; };
  const blockedAt = (x, z, rb, rh, y = SIDE) => { const i = Math.floor(x / P), j = Math.floor(z / P), b = block(i, j); if (!b?.snap) return 'no build'; return walkBlockIn(b.snap, x, z, b.people, rb, rh, y); };
  const taken = [];   // every spot so far, of every place (two places' spots keep apart too)
  // the block a kit says a place is in (a hero slot's `place`): a place on a block's edge (Iron Island's jail is the yard's gate) keeps
  // its people on that side — in the yard, not in the corridor outside it
  const home = new Map(); for (const k of MODS.kits.values()) for (const h of k.heroes || []) if (h.place && Array.isArray(h.block)) home.set(h.place, h.block);
  // ── W8 · CITY LIFE: each spot's kind and room to move (see the header). `busy`: what a new path keeps clear of — every spot so far
  // (of every place) and every path already given out, [x, z, r]
  const L8 = STAND.life, busy = [], r2 = v => +v.toFixed(2), r3 = v => +v.toFixed(3);
  function life(p, spots, lanes, obst, focus, entryFor, dKerb) {
    const dLane = (x, z) => { let d = 1e9; for (const l of lanes) { const e = (l.x - x) ** 2 + (l.z - z) ** 2; if (e < d) d = e; } return Math.sqrt(d); };
    const others = (sp, x, z) => { for (const t of taken) if (d2(t.x, t.z, x, z) < L8.keep) return true; for (const t of spots) if (t !== sp && d2(t.x, t.z, x, z) < L8.keep) return true;
      for (const [bx, bz, br, own] of busy) if (own !== sp && d2(bx, bz, x, z) < br) return true; return false; };
    const freeAt = (sp, x, z, rb = .28, rh = .4) => { const on = onSlab(x, z); if (!on || Math.abs(on.y - sp.y) > .06) return false; if (inObst(obst, x, z, .1) || dKerb(x, z) < STAND.kerb) return false;
      if (dLane(x, z) < L8.lane || others(sp, x, z)) return false; return !blockedAt(x, z, rb, rh, sp.y); };
    const segFree = (sp, ax, az, bx, bz, rb, rh) => { const L = d2(ax, az, bx, bz), n = Math.max(1, Math.ceil(L / .15)); for (let k = 0; k <= n; k++) if (!freeAt(sp, ax + (bx - ax) * k / n, az + (bz - az) * k / n, rb, rh)) return false; return true; };
    const claim = (sp, ax, az, bx, bz, r = .7) => { const L = d2(ax, az, bx, bz), n = Math.max(1, Math.ceil(L / .3)); for (let k = 0; k <= n; k++) busy.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n, r, sp]); };
    // the street: the nearest kerb of the spot's own block → its outward normal (null on a kit's open land: no kerb)
    const streetOf = sp => { const i = Math.floor(sp.x / P), j = Math.floor(sp.z / P); if (!urban(kindAt(i, j))) return null; const s = slab(i, j);
      const e = [[sp.x - s.x0, -1, 0], [s.x1 - sp.x, 1, 0], [sp.z - s.z0, 0, -1], [s.z1 - sp.z, 0, 1]].sort((a, b) => a[0] - b[0])[0]; return { n: [e[1], e[2]], d: e[0] }; };
    const cpt = p.kind === 'corner' ? [p.x, p.z] : null;
    for (const sp of spots) {
      const st = streetOf(sp); sp.st = st ? r3(Math.atan2(st.n[0], st.n[1])) : null;
      // lean_wall: a building's flat wall 0.3–1 m away (the same mass 0.3 m to either side): the walker steps back to 0.2 m off it
      let wall = null;
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, ux = Math.sin(a), uz = Math.cos(a);
        for (let d = .3; d <= 1.0001; d += .05) { const h = blockedAt(sp.x + ux * d, sp.z + uz * d, .03, .03, sp.y); if (!h) continue; if (!/^mass /.test(h)) break;
          const flat = [-.3, .3].every(o => { const h2 = blockedAt(sp.x + ux * (d + .06) - uz * o, sp.z + uz * (d + .06) + ux * o, .03, .03, sp.y); return h2 && /^mass /.test(h2); });
          if (flat && (!wall || d < wall.d)) wall = { d, ux, uz }; break; } }
      if (wall) { const k = wall.d - .2, x = sp.x + wall.ux * k, z = sp.z + wall.uz * k, fx = x - wall.ux * .3, fz = z - wall.uz * .3;
        if (!blockedAt(x, z, .14, .14, sp.y) && !blockedAt(fx, fz, .22, .3, sp.y) && dLane(x, z) >= L8.lane && dKerb(x, z) >= STAND.kerb && !others(sp, x, z) && (k < .1 || segFree(sp, sp.x, sp.z, sp.x + wall.ux * Math.max(0, k - .15), sp.z + wall.uz * Math.max(0, k - .15), .22, .3)))
          { sp.lean = [r2(x), r2(z), r3(Math.atan2(-wall.ux, -wall.uz))]; claim(sp, sp.x, sp.z, x, z, .6); } }
      // sit_stoop: a ledge 0.15–0.35 m high (a step, a planter's lip, a low wall) 0.25–0.7 m away, nothing over it: sat on its edge
      if (!sp.lean) for (let k = 0; k < 16 && !sp.sit; k++) { const a = k * Math.PI / 8, ux = Math.sin(a), uz = Math.cos(a);
        for (let d = .25; d <= .7001; d += .05) { const x = sp.x + ux * d, z = sp.z + uz * d, h = blockedAt(x, z, .03, .03, sp.y); if (!h || /^person /.test(h)) continue;
          if (blockedAt(x, z, .03, .03, sp.y + .25) || !blockedAt(x, z, .03, .03, sp.y + .05)) break;   // (taller than 0.35 m: a wall · lower than 0.15: a kerb stone)
          const ox = sp.x + ux * (d - .03), oz = sp.z + uz * (d - .03), feet = [ox - ux * .35, oz - uz * .35];
          if (!blockedAt(feet[0], feet[1], .2, .3, sp.y) && !blockedAt(ox + ux * .12, oz + uz * .12, .2, .3, sp.y + .25) && dLane(ox, oz) >= L8.lane && dLane(feet[0], feet[1]) >= .7 && dKerb(ox, oz) >= STAND.kerb && dKerb(feet[0], feet[1]) >= STAND.kerb && !others(sp, ox, oz))
            { sp.sit = [r2(ox), r2(oz), r3(Math.atan2(-ux, -uz))]; claim(sp, sp.x, sp.z, ox, oz, .6); }
          break; } }
      // deal_pace: a strip 1.15 m ahead with the street on the walker's +x (from the spot, or ending at it); on open land any way round
      const yaws = st ? [Math.atan2(-st.n[1], st.n[0])] : [0, 1, 2, 3, 4, 5, 6, 7].map(k => k * Math.PI / 4);
      outer: for (const ry of yaws) { const fx = Math.sin(ry), fz = Math.cos(ry);
        for (const back of [0, .55, L8.pace]) { const ox = sp.x - fx * back, oz = sp.z - fz * back; if (segFree(sp, ox, oz, ox + fx * L8.pace, oz + fz * L8.pace, .28, .4)) { sp.pace = [r2(ox), r2(oz), r3(ry)]; claim(sp, ox, oz, ox + fx * L8.pace, oz + fz * L8.pace, .75); break outer; } } }
      // the beat: along the kerb (a cop's), or round the pile (a worker's): out to one end, back, out to the other
      { const f = focus.length ? focus.reduce((b, q) => d2(q[0], q[1], sp.x, sp.z) < d2(b[0], b[1], sp.x, sp.z) ? q : b) : [p.x, p.z];
        let ux, uz; if (st && p.kind !== 'site') { ux = -st.n[1]; uz = st.n[0]; } else { const dx = f[0] - sp.x, dz = f[1] - sp.z, L = Math.hypot(dx, dz) || 1; ux = -dz / L; uz = dx / L; }
        const ends = []; for (const sg of [1, -1]) for (const len of L8.beat) { const x = sp.x + ux * sg * len, z = sp.z + uz * sg * len; if (segFree(sp, sp.x + ux * sg * .4, sp.z + uz * sg * .4, x, z, .28, .4)) { ends.push([r2(x), r2(z)]); claim(sp, sp.x, sp.z, x, z, .7); break; } }
        if (ends.length) sp.beat = ends; }
      sp.kind = sp.lean ? 'wall' : sp.sit ? 'stoop' : cpt && d2(cpt[0], cpt[1], sp.x, sp.z) < L8.corner ? 'corner' : 'open';
    }
    // bench seats (sit_bench): the city's benches inside the place's radius — a seat at each end of the front edge, facing away from the
    // backrest, the spot raised 0.1 m (the clip perches on a 0.5 m seat's edge); walked up to from a lane point, the bench itself ignored
    // for the last steps. On top of the place's count
    const R = Math.max(STAND.radius[p.kind] || 0, 6), seats = [];
    for (let i = Math.floor((p.x - R) / P); i <= Math.floor((p.x + R) / P); i++) for (let j = Math.floor((p.z - R) / P); j <= Math.floor((p.z + R) / P); j++) { const b = block(i, j); if (!b?.snap) continue;
      for (const pl of b.snap.pls || []) { if (pl.kind !== 'bench' || seats.length >= STAND.seats * 2) continue; const bx = pl.box, cx = (bx[0] + bx[3]) / 2, cz = (bx[2] + bx[5]) / 2; if (d2(cx, cz, p.x, p.z) > R) continue;
        const C = colsOf(pl), y0 = bx[1], along = bx[3] - bx[0] >= bx[5] - bx[2] ? [1, 0] : [0, 1], across = [along[1], along[0]]; let tall = [0, 0, 0], all = [0, 0, 0], seatTop = [];
        for (const [key, [, yb]] of C) { const q = Math.round(key / 65536), r = key - q * 65536, x = (q + .5) * .1, z = (r + .5) * .1; all[0] += x; all[1] += z; all[2]++; if (yb > y0 + .65) { tall[0] += x; tall[1] += z; tall[2]++; } else seatTop.push(yb - y0); }
        if (!tall[2] || !all[2] || !seatTop.length) continue; const sTop = seatTop.sort((a, b) => a - b)[Math.floor(seatTop.length / 2)]; if (sTop < .4 || sTop > .6) continue;   // (not a 0.5 m seat)
        const sg = Math.sign((all[0] / all[2] - tall[0] / tall[2]) * across[0] + (all[1] / all[2] - tall[1] / tall[2]) * across[1]) || 1, fx = across[0] * sg, fz = across[1] * sg;
        let front = -1e9; for (const [key] of C) { const q = Math.round(key / 65536), r = key - q * 65536, v = ((q + .5) * .1 - cx) * fx + ((r + .5) * .1 - cz) * fz; if (v > front) front = v; }
        const len = along[0] ? bx[3] - bx[0] : bx[5] - bx[2], ry = Math.atan2(fx, fz);
        for (const o of len > 1.4 ? [-.42, .42] : [0]) { const x = cx + along[0] * o + fx * (front - .02), z = cz + along[1] * o + fz * (front - .02), y = y0 + .1, ax = x + fx * .45, az = z + fz * .45;
          const sp = { x: r2(x), y: r2(y), z: r2(z), ry: r3(ry) };
          if (dLane(x, z) < L8.lane || dLane(ax, az) < .6 || dKerb(x, z) < STAND.kerb || blockedAt(ax, az, .26, .38, y0) || (b.people || []).some(q => d2(q.x, q.z, x, z) < .7)) continue;
          if (taken.some(t => d2(t.x, t.z, x, z) < 1) || spots.some(t => d2(t.x, t.z, x, z) < 1) || seats.some(t => d2(t.x, t.z, x, z) < .8) || busy.some(([bx2, bz2, br, own]) => d2(bx2, bz2, x, z) < br - .2)) continue;
          const e = entryFor({ x, z, y: y0 }, STAND.STEP, pl.id); seats.push({ ...sp, entry: e ? { i: e.i, j: e.j, side: e.side, u: e.u, x: e.x, z: e.z } : null, kind: 'bench', st: null }); } } }
    for (const s2 of seats.slice(0, STAND.seats)) spots.push(s2);
  }
  for (const p of places.places || []) {
    const R = STAND.radius[p.kind], N = STAND.place[p.id] ?? STAND.count[p.kind]; if (!R) continue;
    // the layer's own pieces here, and what the agents face
    const obst = [], focus = [];
    if (p.kind === 'site') { const ks = RULES.YIELDS[p.id] || [p.yields]; ks.forEach((k, n) => { const x = p.x + (ks.length > 1 ? (n ? 2.7 : -2.7) : 0); obst.push([x, p.z, 1.6 + .35]); focus.push([x, p.z]); }); obst.push([p.x + 4.6, p.z + 2.2, 1.6 + .35]); }
    else if (p.kind === 'corner') { const [cx, cz, rot, , , compact] = hotspotAt(p, cornerKits.has(p.id)), B = hotspotBox(compact);   // (the compact set, 2026-10-09: its own 3.2 × 2.6 m box)
      obst.push(compact ? (rot & 1 ? [cx, cz, B[3] + .35, B[2] + .35] : [cx, cz, B[2] + .35, B[3] + .35]) : [cx, cz, 1.6 + .35]); focus.push([cx, cz]); }
    else focus.push([p.x, p.z]);
    const face = (x, z) => { let best = focus[0], bd = 1e9; for (const f of focus) { const d = d2(f[0], f[1], x, z); if (d < bd) { bd = d; best = f; } } return best; };
    const RW = Math.max(R, STAND.wide[p.kind] || R), i0 = Math.floor((p.x - RW - 3) / P), i1 = Math.floor((p.x + RW + 3) / P), j0 = Math.floor((p.z - RW - 3) / P), j1 = Math.floor((p.z + RW + 3) / P), lanes = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (urban(kindAt(i, j))) lanes.push(...lanePts(i, j));
    const kerbs = []; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) kerbs.push(...kerbSegs(i, j));   // (the kerb-wait rows and zebra approaches round it)
    const dKerb = (x, z) => { let d = 1e9; for (const g of kerbs) { const e = segD(g, x, z); if (e < d) d = e; } return d; };
    const why = {}, bump = k => { why[k] = (why[k] || 0) + 1; };
    const scan = (R, R0 = -1) => { const cands = [];
    for (let x = p.x - R; x <= p.x + R + 1e-6; x += STAND.grid) for (let z = p.z - R; z <= p.z + R + 1e-6; z += STAND.grid) {
      const dc = d2(x, z, p.x, p.z); if (dc > R || dc <= R0) continue; const on = onSlab(x, z); if (!on) { bump('off the slab'); continue; }
      const hb = p.kind !== 'corner' && home.get(p.id); if (hb && (Math.floor(x / P) !== hb[0] || Math.floor(z / P) !== hb[1])) { bump('outside its block'); continue; }   // (a corner is four blocks' by nature)
      if (inObst(obst, x, z, 0)) { bump('a piece'); continue; }
      let dl = 1e9; for (const l of lanes) { const d = d2(l.x, l.z, x, z); if (d < dl) dl = d; } if (dl < STAND.CLEAR) { bump('a lane'); continue; }
      if (dKerb(x, z) < STAND.kerb) { bump('a kerb row'); continue; }
      if (taken.some(t => d2(t.x, t.z, x, z) < STAND.GAP || (t.entry && segNear(t.entry, t, x, z) < .8))) { bump('another place'); continue; }
      const hit = blockedAt(x, z, STAND.body, STAND.head, on.y); if (hit) { bump('blocked'); continue; }
      const f = face(x, z), jit = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1) * .5;   // (each turned a little its own way: not a ring of stares)
      cands.push({ x: +x.toFixed(2), z: +z.toFixed(2), y: on.y, d: d2(x, z, f[0], f[1]) + .35 * d2(x, z, p.x, p.z), ry: +(Math.atan2(f[0] - x, f[1] - z) + jit).toFixed(3), dl }); }
    return cands.sort((a, b) => a.d - b.d); };
    let cands = scan(R);
    // pick: spaced, each with a clear straight step to a lane point (preferred), else standing only (reached by nobody walking up)
    const spots = [], entryFor = (sp, STEP, ignore = null) => { let best = null;
      for (const l of lanes) { if (!l.side || l.y < SIDE - .01 || l.du < 2.5 || Math.abs(l.y - sp.y) > .05) continue; const L = d2(l.x, l.z, sp.x, sp.z); if (L > STEP || L < .9 || (best && L >= best.L)) continue;
        let ok = true; for (let t = .15; t < L && ok; t += .15) { const k = t / L, x = l.x + (sp.x - l.x) * k, z = l.z + (sp.z - l.z) * k;
          if (t > .45) { const h = blockedAt(x, z, STAND.walker[0], STAND.walker[1], sp.y); if (h && !(ignore && h === ignore && L - t < .7)) ok = false; }
          else if (t > .6) { for (const o of lanes) if (((o.side !== l.side || o.i !== l.i || o.j !== l.j) && d2(o.x, o.z, x, z) < .6) || (t >= WAIT && d2(o.x, o.z, x, z) < .75)) { ok = false; break; } }   // (from WAIT m on, off every lane: an agent waits there for a gap)
          if (ok) for (const s2 of spots.concat(taken)) if (d2(s2.x, s2.z, x, z) < .8) { ok = false; break; }
          if (ok && inObst(obst, x, z, .2)) ok = false; }
        if (ok) best = { L, i: l.i, j: l.j, side: l.side, u: +l.u.toFixed(2), x: +l.x.toFixed(2), z: +l.z.toFixed(2) }; }
      return best; };
    const pick = () => { for (const pass of [true, false]) for (const c of cands) { if (spots.length >= N) break; if (spots.some(s => d2(s.x, s.z, c.x, c.z) < STAND.GAP)) continue;
      if (spots.some(s => s.entry && segNear(s.entry, s, c.x, c.z) < .8)) continue;   // (not on another spot's step)
      const e = entryFor(c, STAND.STEP) || (pass ? null : entryFor(c, STAND.STEP2)); if (pass && !e) continue; spots.push({ x: c.x, y: c.y, z: c.z, ry: c.ry, entry: e ? { i: e.i, j: e.j, side: e.side, u: e.u, x: e.x, z: e.z } : null }); } };
    pick(); let wide = false;
    if (spots.length < Math.min(N, STAND.MIN) && RW > R) { wide = true; cands = scan(RW, R); pick(); }   // (W8: too few: a second, wider look — further along the sidewalks)
    // W8 · the life of each spot: its kind and its room to move (life.js)
    life(p, spots, lanes, obst, focus, entryFor, dKerb);
    taken.push(...spots);
    const errs = [...new Set(lanes.length ? [] : ['no lanes'])];
    if (spots.length) out.places[p.id] = { name: p.name, kind: p.kind, x: p.x, z: p.z, spots }; else out.skipped[p.id] = { name: p.name, kind: p.kind, why };
    const kinds = {}; for (const s of spots) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
    log(`stands: ${p.id.padEnd(14)} ${String(spots.length).padStart(2)} spots (${spots.filter(s => s.entry).length} walked to${wide ? ', looked wider' : ''}) · ${JSON.stringify(kinds)} · pace ${spots.filter(s => s.pace).length} beat ${spots.filter(s => s.beat).length} · ${cands.length} clear of ${Object.values(why).reduce((a, b) => a + b, 0) + cands.length} · refused ${JSON.stringify(why)}${errs.length ? ' · ' + errs.join(', ') : ''}`); }
  // THE KERB CHECK: every spot and every point of its paths against the kerb-wait rows and zebra approaches of the blocks round it, the
  // new spots and the file they replace (stands.mjs prints both; a new spot or path nearer than STAND.kerb is an error)
  const kerbNear = (x, z) => { let d = 1e9; const i0 = Math.floor(x / P), j0 = Math.floor(z / P); for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (const g of kerbSegs(i, j)) { const e = segD(g, x, z); if (e < d) d = e; } return d; };
  const kerbOf = places => { const r = { spots: 0, near: 0, paths: 0, pathsNear: 0, min: 99, worst: [] };
    for (const [id, pl] of Object.entries(places || {})) for (const sp of pl.spots || []) { const d = kerbNear(sp.x, sp.z); r.spots++; r.min = Math.min(r.min, +d.toFixed(2)); if (d < STAND.kerb) { r.near++; r.worst.push([id, sp.x, sp.z, +d.toFixed(2)]); }
      const pts = [sp.lean, sp.sit, ...(sp.beat || [])].filter(Boolean).map(q => [q[0], q[1]]); if (sp.pace) { const [px, pz, ry] = sp.pace; for (let f = 0; f <= 1.0001; f += .25) pts.push([px + Math.sin(ry) * STAND.life.pace * f, pz + Math.cos(ry) * STAND.life.pace * f]); }
      for (const [x, z] of pts) { r.paths++; if (kerbNear(x, z) < STAND.kerb) r.pathsNear++; } }
    r.worst.sort((a, b) => a[3] - b[3]); r.worst = r.worst.slice(0, 12); return r; };
  out.kerbCheck = { clear: STAND.kerb, now: kerbOf(out.places) };
  try { const old = await (await fetch(new URL(sdata('stands.json'), import.meta.url).href)).json(); out.kerbCheck.before = kerbOf(old.places); } catch (e) { out.kerbCheck.before = String(e && e.message || e); }
  const errors = [...built.values()].filter(Boolean).flatMap(b => (b.errors || []).map(e => `${b.i}_${b.j}: ${e.path} ${e.error}`)).slice(0, 20);
  out.blocks = built.size; out.ms = Math.round(performance.now() - t0); if (errors.length) out.errors = errors; return out;
}
// inside one of the layer's pieces (obst: [x, z, r] a square of half-side r, or [x, z, rx, rz] a box), m metres in from its edge
function inObst(obst, x, z, m) { for (const [ox, oz, rx, rz = rx] of obst) if (Math.abs(x - ox) < rx - m && Math.abs(z - oz) < rz - m) return true; return false; }
// distance from a point to the segment between a spot's entry and the spot
function segNear(e, s, x, z) { const ax = e.x, az = e.z, bx = s.x, bz = s.z, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); return Math.hypot(ax + dx * t - x, az + dz * t - z); }
// distance from a point to a segment [ax, az, bx, bz]
function segD(g, x, z) { const [ax, az, bx, bz] = g, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); return Math.hypot(ax + dx * t - x, az + dz * t - z); }
