// MOVEMENT W3b · THE SUBWAY'S NETWORK, as the carriage scene reads it: the lines from the export (world/export/transit.json, written by
// tools/export-world.mjs from transitnet.js) and a trip's underground legs turned into a RIDE PROGRAM, in real seconds.
//   loadNet() → Promise<net>                    net.lines: id → { id, name, bullet, colour, stops: [ids], m: [metres along], term: { fwd, rev },
//                                               speed (m/s), dwell (s): the line's own clock — SUBWAY PLAN 2026-10-09: the locals 8 m/s, 10 s }
//                                               net.stations: id → { id, name, x, z, lines: [ids] }
//   programOf(net, legs) → program | null       legs: MOVEMENT.md §3 (game minutes). The underground part: from the end of the
//                                               stairs down to the start of the stairs up (the platform waits, the rides, a change).
//     program: { t0 (game min: when it starts), dur (real s), segs: [...], from, to, lines }
//     seg: { kind: 'dwell', t0, t1, st, line, dir, board?, alight?, change? }   stopped at station st, doors open
//          { kind: 'run', t0, t1, a, b, line, dir, m }                          between stations a → b (m metres)
// Times inside a program are REAL seconds from its start (1 game min = 2.5 s, MOVEMENT.md §1).
import { sdata } from '../../../world/city.js';   // (SPREAD: the data this spread reads)
import { GAME_MIN } from '../simstate/simclock.js';
export { GAME_MIN } from '../simstate/simclock.js';
let netP = null;
export function loadNet() {
  return netP ??= fetch(new URL(sdata('../../../world/export/transit.json'), import.meta.url)).then(r => { if (!r.ok) throw new Error('subway: transit.json ' + r.status); return r.json(); }).then(T => {
    const stations = new Map(T.stations.map(s => [s.id, { ...s }])), lines = new Map();
    for (const l of T.lines) { if (l.kind !== 'subway') continue; const m = [0]; for (let k = 1; k < l.stops.length; k++) { const a = stations.get(l.stops[k - 1]), b = stations.get(l.stops[k]); m.push(m[k - 1] + Math.hypot(b.x - a.x, b.z - a.z)); }
      lines.set(l.id, { id: l.id, name: l.name, bullet: l.bullet, colour: l.colour, hex: parseInt(l.colour.slice(1), 16), stops: l.stops, m, term: { fwd: l.stops[l.stops.length - 1], rev: l.stops[0] }, speed: l.speed ?? 16, dwell: l.dwell ?? 8 }); }   // (an older transit.json without a line's clock: the express's 16 m/s, 8 s)
    return { stations, lines, nameOf: id => stations.get(id)?.name ?? String(id).replace(/^subway-/, '').toUpperCase() }; }).catch(e => { netP = null; throw e; });
}
// the other lines a station serves (the "change for" on the card)
export const changesAt = (net, st, line) => (net.stations.get(st)?.lines || []).filter(l => l !== line && net.lines.has(l));

// a trip's legs → the ride program (null: no subway in it)
export function programOf(net, legs) {
  if (!legs?.length) return null; const i0 = legs.findIndex(l => l.kind === 'subway'); if (i0 < 0) return null;
  let a = i0; while (a > 0 && legs[a - 1].kind === 'wait') a--;   // the platform waits before the first ride
  let b = i0; for (let k = i0 + 1; k < legs.length; k++) { if (legs[k].kind === 'subway' || legs[k].kind === 'wait') b = k; else break; }
  while (b > i0 && legs[b].kind === 'wait') b--;   // (a trailing wait never ends a ride)
  const span = legs.slice(a, b + 1), t0 = span[0].dep, R = t => (t - t0) * GAME_MIN, segs = [], used = [];
  for (let k = 0; k < span.length; k++) { const L = span[k];
    if (L.kind === 'wait') {   // stopped at the platform (a run of waits = one dwell: the change, then the timetable)
      let e = k; while (e + 1 < span.length && span[e + 1].kind === 'wait') e++; const next = span.slice(e + 1).find(x => x.kind === 'subway'), line = next?.line ?? L.line;
      const change = span.slice(k, e + 1).some(x => x.transfer) || (segs.length > 0); segs.push({ kind: 'dwell', t0: R(L.dep), t1: R(span[e].arr), st: L.from, line, dir: next?.dir ?? 'fwd', board: true, change }); k = e; continue; }
    if (L.kind !== 'subway') continue; const ln = net.lines.get(L.line); if (!ln) return null; used.push(L.line);
    const st = L.dir === 'rev' ? ln.stops.slice().reverse() : ln.stops, mm = L.dir === 'rev' ? ln.m.map(x => ln.m[ln.m.length - 1] - x).reverse() : ln.m, i = st.indexOf(L.from), j = st.indexOf(L.to);
    if (i < 0 || j <= i) return null;
    // the ride's own time split: runs at the line's own pace, its dwell at each station in between (SUBWAY PLAN 2026-10-09: the express 16 m/s
    // and 8 s, the locals 8 m/s and 10 s), stretched to the leg's real span exactly
    const DW = ln.dwell, nom = []; for (let s = i; s < j; s++) { nom.push({ kind: 'run', a: st[s], b: st[s + 1], m: mm[s + 1] - mm[s], d: Math.max(4, (mm[s + 1] - mm[s]) / ln.speed + 3) }); if (s + 1 < j) nom.push({ kind: 'dwell', st: st[s + 1], d: DW }); }
    const tot = nom.reduce((x, n) => x + n.d, 0), T0 = R(L.dep), T1 = R(L.arr), f = (T1 - T0) / tot; let t = T0;
    if (!segs.length || segs[segs.length - 1].kind !== 'dwell') segs.push({ kind: 'dwell', t0: T0, t1: T0, st: L.from, line: L.line, dir: L.dir, board: true });   // (no wait leg: boards as it leaves)
    for (const n of nom) { const s = { ...n, t0: t, t1: t + n.d * f, line: L.line, dir: L.dir }; delete s.d; segs.push(s); t = s.t1; }
    segs[segs.length - 1].t1 = T1; }
  const last = segs[segs.length - 1]; if (!last || last.kind !== 'run') return null;
  return { t0, dur: last.t1, segs, from: segs[0].st, to: last.b, lines: [...new Set(used)] };
}
// where a program is at real second t: the segment, the station it stands at or the stretch it runs, the speed (m/s), the acceleration,
// and dx = metres from the car's middle to the nearest station's platform middle (+ ahead), or null deep in the tunnel
export function stateAt(P, t) {
  const S = P.segs; let k = 0; while (k < S.length - 1 && t >= S[k].t1) k++; const s = S[k];
  if (s.kind === 'dwell') return { seg: s, k, v: 0, acc: 0, dx: 0, st: s.st, line: s.line, dir: s.dir, at: true };
  // a trapezoid: speed up at A, run, brake at A — A at least what covers m in T as a triangle (a short run on a fast line: 1.3 m/s² can't, and
  // the two halves of the old formula met 36 m apart in the middle of the tunnel)
  const T = Math.max(.1, s.t1 - s.t0), u = Math.max(0, Math.min(T, t - s.t0)), m = s.m, A = Math.max(1.3, 4 * m / (T * T) * 1.0001);
  let vc = (A * T - Math.sqrt(Math.max(0, A * A * T * T - 4 * A * m))) / 2; if (!(vc > 0)) vc = 2 * m / T;   // (too short to cruise: a triangle)
  const ta = Math.min(T / 2, vc / A), x = u < ta ? A * u * u / 2 : u > T - ta ? m - A * (T - u) ** 2 / 2 : A * ta * ta / 2 + vc * (u - ta);
  const v = u < ta ? A * u : u > T - ta ? A * (T - u) : vc, acc = u < ta ? A : u > T - ta ? -A : 0;
  const near = x < m / 2 ? { st: s.a, dx: -x } : { st: s.b, dx: m - x };
  return { seg: s, k, v, acc, dx: near.dx, st: near.st, line: s.line, dir: s.dir, at: false, x, next: s.b };
}
