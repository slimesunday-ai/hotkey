// C2-GORE (2026-11-04) · WRECKCHECK: a car that hits someone in the road is a wreck only when the accidents take the hit, and a wreck
// stops in its own lane. slime, 11-04: "the car that hits the agent just stops in the middle of the road, does nothing, and other cars
// start driving through the stopped car" · "the taxi hasent moved since the accident and cars are driving through it". In node: the
// real traffic sim (seed 404, populated round FIT ST), no page, no accidents module — the hazards and onHit are set here as
// traffic/accident.js sets them. Exit 1 when any case fails.
//   node style/city/tools/wreckcheck.mjs [--json out.json]
//   gone      a car committed to hitting a walker (it can't stop: c.haz) whose walker leaves the road first (its hazard dropped, the
//             list empty — a near miss back to the kerb) is no wreck, and drives on
//   untaken   a hit the accidents don't take (onHit → false: no live case behind the hazard) makes no wreck, and the car drives on
//   lane      a hit taken 1.5 m ahead of a car within 3–7 m of its lane's end, on the green at speed: the wreck comes to rest in that lane,
//             never in the junction's box
//   release   that wreck, let go (c.wreck.go, as accident.js does after its stay), drives on
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'three' || s.startsWith('three/')) return { url: 'data:text/javascript,export class Matrix4{}; export class Quaternion{}; export class Vector3{}; export class Frustum{}; export default {};', shortCircuit: true }; return n(s, c); }`));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
globalThis.performance ??= { now: () => Date.now() };
const { createTrafficSim, CAR } = await imp('style/city/traffic/sim.js');
const FOCUS = { x: -69.3, z: -7.3 }, H = .1;
let time = 0; const TS = createTrafficSim({ seed: 404, clock: () => time }); TS.MODELS.size = () => [4.4, 1.8, .34];
// (the population round FOCUS every 2 s, as the page's; the cases take cars within 60 m of it, so none is dropped under them)
let ticks = 0; const step = s => { for (let k = 0; k < Math.round(s / H); k++) { time += H; TS.tick(H); if (++ticks % 20 === 0) TS.populate(FOCUS, false, { seen: () => false }); } };
TS.populate(FOCUS, true, { seen: () => false }); step(30);
const plain = c => c.kind === 'car' && !c.route && !c.stage && !c.asCar && !c.kin && !c.wreck && !c.gone && c.L.kind === 'lane' && Math.hypot(c.x - FOCUS.x, c.z - FOCUS.z) < 60;
const find = (f, s = 240) => { for (let t = 0; t < s; t += H) { const c = TS.cars.find(f); if (c) return c; step(H); } return null; };
const hazardAhead = (c, d) => { const L = c.L, a = c.s + d, h = { x: L.x0 + L.ux * a, z: L.z0 + L.uz * a, r: .32, hit: false, soft: false, case: {} }; TS.hazards.push(h); return h; };
const drop = h => { const i = TS.hazards.indexOf(h); if (i >= 0) TS.hazards.splice(i, 1); };
const out = {}; let bad = 0; const res = (k, ok, o) => { out[k] = { ok, ...o }; if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${k}`, JSON.stringify(o)); };

// gone: committed (it can't stop for them), then the walker is back on the kerb before its nose gets there
{ TS.onHit = () => true; const c = find(q => plain(q) && q.v > 7 && q.L.len - q.s > q.v * q.v / (2 * CAR.bMax) + 8);
  if (!c) res('gone', false, { why: 'no car at speed with room to stop in its lane' }); else {
    const h = hazardAhead(c, Math.max(2, c.v * c.v / (2 * CAR.bMax) * .6)); let k = 0; while (c.haz !== h && k++ < 10) step(H); const committed = c.haz === h; drop(h);
    step(8); res('gone', committed && !c.gone && !c.wreck && c.v > 1, { car: c.id, committed, wreck: !!c.wreck, v: +c.v.toFixed(2), hit: h.hit, gone: c.gone }); } }
// untaken: the hazard stays, the hit happens, the accidents don't take it
{ TS.onHit = () => false; const c = find(q => plain(q) && q.v > 7 && q.L.len - q.s > q.v * q.v / (2 * CAR.bMax) + 8);
  if (!c) res('untaken', false, { why: 'no car at speed with room to stop in its lane' }); else {
    const h = hazardAhead(c, Math.max(2, c.v * c.v / (2 * CAR.bMax) * .6)); let k = 0; while (!h.hit && k++ < 40) step(H); const hit = h.hit; drop(h);
    step(8); res('untaken', hit && !c.gone && !c.wreck && c.v > 1, { car: c.id, hit, wreck: !!c.wreck, v: +c.v.toFixed(2), gone: c.gone }); } }
// lane, release: a hit taken near the lane's end at speed
{ TS.onHit = () => true; const c = find(q => plain(q) && q.v > 8 && q.go && q.L.len - q.s > 3 && q.L.len - q.s < 7, 600);
  if (!c) { res('lane', false, { why: 'no car at speed near its lane end on the green' }); res('release', false, { why: 'no wreck' }); } else {
    const L0 = c.L, h = hazardAhead(c, 1.5); let k = 0; while (!h.hit && k++ < 20) step(H); const hit = h.hit; drop(h);
    step(5); const inLane = c.L === L0 && c.s <= L0.len + 1e-6;
    res('lane', hit && !!c.wreck && c.v === 0 && inLane, { car: c.id, hit, wreck: !!c.wreck, v: +c.v.toFixed(2), link: c.L.kind, s: +c.s.toFixed(2), laneLen: +L0.len.toFixed(2), inBox: !!c.box });
    const s0 = c.s, L1 = c.L; if (c.wreck) c.wreck.go = true; step(12); res('release', !c.wreck && (c.L !== L1 || c.s > s0 + 1 || c.gone), { car: c.id, wreck: !!c.wreck, moved: c.L !== L1 || c.s > s0 + 1, gone: c.gone }); } }
if (arg('json', null)) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
console.log(bad ? `wreckcheck: ${bad} failing` : 'wreckcheck: PASS'); process.exit(bad ? 1 : 0);
