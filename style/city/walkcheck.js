// Cleanup pass · THE WALK CHECK: an audit that runs the walkers (pedsim.js, the same code the page runs) for 60 s over a district's built
// blocks and counts overlaps — walker with walker (two bodies closer than 2 × PED.body at the same height) and walker with anything
// on the sidewalk (the voxels and standing people each block's build recorded: engine.js lanesOf grid, the lanes' own walker size).
// A few agents walk too, so generic walkers yielding to them is checked. It runs only in the audit (main.js ?audit=1&report=1&district=),
// never in the game. Both counts must be 0, like every other check (tools/audit.mjs types walker-overlap, walker-furniture).
import { createPedSim, PED } from './pedsim.js';
import { walkBlockIn } from './audit.js';
import { P } from './plan.js';
import { slab } from './ground.js';
import { SIDE } from './style.js';

export function walkCheck({ blocks, night = false, seconds = 60, dt = 1 / 30, densityOf = () => 1, agents = 6, seed = 0x5eed }) {
  const own = new Map(blocks.map(b => [b.i + ',' + b.j, b]));
  const foci = []; for (const b of blocks) { const x = (b.i + .5) * P, z = (b.j + .5) * P; if (!foci.some(f => Math.hypot(f.x - x, f.z - z) < 90)) foci.push({ x, z }); }
  const res = { foci: foci.length, walkers: 0, agents: 0, dogs: 0, steps: 0, ww: 0, wf: 0, wa: 0, wd: 0, ms: 0, msMax: 0, events: [] }, DP = [0, 0, 0, 0];
  // a walker on a sidewalk of one of these blocks, tested exactly where it is against what that block's build left there (the same test
  // the lanes are carved with, at the walker's own size: REG.walkBlock .24 / .37; lanes keep 4 cm more)
  const blockedAt = (x, y, z) => { const i = Math.floor(x / P), j = Math.floor(z / P), L = own.get(i + ',' + j)?.lanes; if (!L?.snap) return null; const s = slab(i, j), road = y < SIDE - .05;
    if (road ? (x < s.x0 - 1.5 || x > s.x1 + 1.5 || z < s.z0 - 1.5 || z > s.z1 + 1.5) : (x < s.x0 - .01 || x > s.x1 + .01 || z < s.z0 - .01 || z > s.z1 + .01)) return null;   // (out in the road: its parked cars)
    const w = walkBlockIn(L.snap, x, z, road ? [] : L.people, .24, .37, road ? 0 : SIDE); if (!w) return null; const c = Math.min(x - s.x0, s.x1 - x, z - s.z0, s.z1 - z), k = c === x - s.x0 ? 'W' : c === s.x1 - x ? 'E' : c === z - s.z0 ? 'N' : 'S';
    return [`${i}_${j}`, w, k, c]; };
  foci.forEach((f, fi) => {
    const sim = createPedSim({ night, seed: seed + fi * 7919, densityOf }); sim.looks = 24; for (const b of blocks) if (b.lanes) sim.addLanes(b.i + ',' + b.j, b.lanes);
    sim.populate(f, true);
    const corners = [...sim.nodes.values()].filter(n => n.out.length && own.has(n.i + ',' + n.j)), rnd = (() => { let s = (seed + fi) >>> 0; return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return s / 4294967296; }; })();
    for (let k = 0; k < agents && corners.length > 1; k++) { const a = corners[(rnd() * corners.length) | 0], b = corners[(rnd() * corners.length) | 0]; sim.addAgent({ id: 'check-' + k, from: [a.x, a.z], to: [b.x, b.z] }); }
    const pairs = new Set(), stuck = new Set(), cell = new Map(), steps = Math.round(seconds / dt);
    for (let n = 0; n < steps; n++) {
      if (n % 60 === 59) sim.populate(f, false);
      for (const w of sim.agents) if (w.arrived && corners.length) { const b = corners[(rnd() * corners.length) | 0]; sim.setAgentTarget(w.aid, [b.x, b.z]); }
      sim.step(dt); res.ms += sim.stat.ms; res.msMax = Math.max(res.msMax, sim.stat.ms); res.steps++;
      cell.clear(); for (const w of sim.walkers) { sim.where(w); const key = Math.floor(w.p[0] / .6) + ',' + Math.floor(w.p[2] / .6); let L = cell.get(key); if (!L) cell.set(key, L = []); L.push(w); }
      const now = new Set(), nowF = new Set();
      for (const w of sim.walkers) { const [x, y, z] = w.p, blk = own.has(Math.floor(x / P) + ',' + Math.floor(z / P)); if (!blk) continue;
        const cx = Math.floor(x / .6), cz = Math.floor(z / .6);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of cell.get((cx + a) + ',' + (cz + b)) || []) { if (o.id <= w.id) continue;
          if (Math.hypot(o.p[0] - x, o.p[2] - z) < 2 * PED.body && Math.abs(o.p[1] - y) < .5) { const key = w.id + '-' + o.id; now.add(key);
            if (!pairs.has(key)) { const kind = w.agent || o.agent ? 'wa' : 'ww', ed = v => `${v.E.cross ? 'crossing' : v.E.side || 'joint'} ${v.E.i},${v.E.j} s ${v.s.toFixed(2)}/${v.E.len.toFixed(1)} v ${v.vc.toFixed(2)}`;
              res[kind]++; res.events.push({ type: 'walker-overlap', block: `${Math.floor(x / P)}_${Math.floor(z / P)}`, x, z, note: `${w.agent || o.agent ? 'a walker and an agent' : 'two walkers'} ${Math.hypot(o.p[0] - x, o.p[2] - z).toFixed(2)} m apart (${ed(w)} · ${ed(o)})` }); } } }
        // a walker's dog (peds.js draws it on the lane PED.dogLead m ahead): nobody else's body within 0.5 m of it
        if (w.dog >= 0) { sim.ahead(w, PED.dogLead, DP); const dx0 = Math.floor(DP[0] / .6), dz0 = Math.floor(DP[2] / .6);
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of cell.get((dx0 + a) + ',' + (dz0 + b)) || []) { if (o === w || Math.hypot(o.p[0] - DP[0], o.p[2] - DP[2]) >= PED.body + .2 || Math.abs(o.p[1] - DP[1]) > .5) continue;
            const key = 'd' + w.id + '-' + o.id; now.add(key); if (!pairs.has(key)) { res.wd++; res.events.push({ type: 'walker-overlap', block: `${Math.floor(DP[0] / P)}_${Math.floor(DP[2] / P)}`, x: DP[0], z: DP[2], note: `a walker's dog and another walker ${Math.hypot(o.p[0] - DP[0], o.p[2] - DP[2]).toFixed(2)} m apart` }); } } }
        const hitB = blockedAt(x, y, z); if (hitB) { nowF.add(w.id); if (!stuck.has(w.id)) { res.wf++; res.events.push({ type: 'walker-furniture', block: hitB[0], x, z, other: hitB[1], note: `a walker on the ${w.E.cross ? 'crossing' : (w.E.side || 'joint') + ' sidewalk'} (${w.E.i},${w.E.j}) at s ${w.s.toFixed(1)} of ${w.E.len.toFixed(1)} runs into ${hitB[1]} (${hitB[2]} side, ${hitB[3].toFixed(2)} m from the curb)${w.agent ? ' (an agent)' : ''}` }); } } }
      pairs.clear(); for (const k of now) pairs.add(k); stuck.clear(); for (const k of nowF) stuck.add(k);
    }
    res.walkers += sim.walkers.length - sim.agents.length; res.agents += sim.agents.length; res.dogs += sim.walkers.filter(w => w.dog >= 0).length;
  });
  res.msAvg = res.steps ? res.ms / res.steps : 0; return res;
}
