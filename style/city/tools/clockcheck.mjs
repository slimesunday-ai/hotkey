// SIM CLOCK gate (2026-10-09) · simstate/simclock.js in node against a simulated sim: whole-minute t, polled the way feed.js polls
// (the next poll an interval after the last answer, a few ms of fetch), handed to the page at its next frame (60 fps, dt ≤ 0.1 s).
//   node style/city/tools/clockcheck.mjs [--old] [--only <scenario>] [--json]
// Per scenario: the movement clock's frames backward and its largest step back, its pace frame to frame (q05 / q50 / q95, game min
// per real s), how far it is from the sim's real time (|err| p50 / p95 / max, game min) and its snaps; --old runs the clock as it was
// before (agents.js @ 7b9cb3d) for the same numbers. Gate (new clock): no frame backward outside a jump the scenario makes, the steady
// pace within ±10 %, |err| p95 under a game minute.
// BROADCAST (2026-10-09, TV plan A1): the same clock behind simstate/broadcast.js's delay line (D = 15 s): each poll is pushed into the
// line as it arrives and observed when the line releases it, on a simulated page timer (hidden: Chrome's 1 s alignment, or once a
// minute after 5 min hidden; the arrivals keep coming, a worker's messages aren't throttled). Per delay scenario, besides the above:
// |err| against the sim's real time D s earlier (during the line's 0.8× ramp: the time the line is showing), `vs D=0`: the same
// scenario's clock without the line, D s earlier (what the line adds), and the most messages one release folded (a burst: > 1).
// Gate: no frame backward; |err| p95 ≤ 0.1 game min where the sim runs steadily (outside 3 s after a jump, and the clock's own settling
// after a pace change, a stop or a hidden stretch — those it shares with D = 0: `vs D=0` p95 ≤ 0.1 there); at most 1 message a release.
//   node style/city/tools/clockcheck.mjs [--old] [--only <scenario>] [--json] [--delay <s>]
import { createSimClock } from '../simstate/simclock.js';
import { createLine } from '../simstate/broadcast.js';
const has = k => process.argv.includes('--' + k), arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const OLD = has('old'), ONLY = arg('only', null), DELAY = +arg('delay', 15);
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); if (!a.length) return NaN; return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// the clock before this pass (agents.js @ 7b9cb3d: setClock, simNow, moveNow), for --old
function createOldClock() {
  const clock = { t: null, at: 0, rate: 0, running: false, pageT: 0 }, mc = { t: null };
  const simNow = () => clock.t === null ? null : clock.t + Math.min(clock.rate * (clock.pageT - clock.at), Math.max(3, clock.rate * 3));
  return { clock, now: simNow, get moveNow() { return mc.t; },
    move(dt) { const n = simNow(); if (n === null) return mc.t = null; if (mc.t === null || Math.abs(n - mc.t) > 4) mc.t = n; else { mc.t += clock.rate * dt; mc.t += (n - mc.t) * Math.min(1, dt * .8); } return mc.t; },
    observe(t, pageT, running) { if (typeof t !== 'number') { clock.t = null; return; } if (clock.t !== null && t < clock.t - 1) clock.rate = 0;
      else if (clock.t !== null && pageT - clock.at > .25) { const r = Math.max(0, (t - clock.t) / (pageT - clock.at)); clock.rate = clock.rate ? clock.rate * .6 + r * .4 : r; }
      if (clock.t === null || pageT - clock.at > .25 || t < clock.t) { clock.t = t; clock.at = pageT; } clock.running = !!running; if (running === false) clock.rate = 0; },
    stats: () => ({}) };
}
// a scenario: the sim's real clock (pace, and what happens to it), the polls, the frames
function run({ secs = 120, pace = .4, t0 = 540.3, poll = 1, events = [], hidden = [], hitches = [], warm = 15, exact = false, delay = 0, align = 1, settle = [], full = false }) {
  const C = OLD ? createOldClock() : createSimClock(); let T = t0, p = pace, running = true, s = 0, nextPoll = .2, inflight = null; const ev = events.slice().sort((a, b) => a.at - b.at);
  const F = []; let jumpsAt = [];
  const dtF = 1 / 60;
  // the delay line (delay > 0): the page's timers, throttled while hidden; every start of the line (the join, a flush) for the reference
  const timers = new Map(); let tid = 0, starts = [], flushes = 0; const H = { s: [], T: [] }, hidNow = () => hidden.some(([a, b]) => s >= a && s < b);
  const line = delay > 0 ? createLine({ release: m => C.observe(m.t, C.clock.pageT, m.running), tOf: m => m.t, delay: () => delay, now: () => s * 1000,
    timer: { set: (fn, ms) => { timers.set(++tid, { at: s * 1000 + ms, fn }); return tid; }, clear: id => timers.delete(id) } }) : null;
  const fireTimers = () => { const hid = hidNow(); for (const [id, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) { const due = hid ? Math.ceil(t.at / (align * 1000)) * align * 1000 : t.at; if (s * 1000 >= due) { timers.delete(id); t.fn(); } } };
  const Tat = x => { let lo = 0, hi = H.s.length - 1; if (hi < 0 || x <= H.s[0]) return H.T[0]; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (H.s[mid] <= x) lo = mid; else hi = mid - 1; } return H.T[lo]; };
  const shown = x => { const s0 = [...starts].reverse().find(v => v <= x) ?? 0; return s0 === -Infinity ? x - delay : Math.max(x - delay, s0 + .8 * (x - s0)); };   // (the real time the line shows: D behind, or on its 0.8× ramp)
  // full: the page has been running (or joined with GET /state?lag=): the line starts D behind — the polls of the last D s, pushed with
  // their age at the start (the sim's time then: t0 − pace × age)
  if (line && full) { starts.push(-Infinity); for (let ag = Math.ceil(delay / poll) * poll; ag >= poll; ag -= poll) { H.s.push(-ag); H.T.push(t0 - pace * ag); }
    for (let ag = Math.ceil(delay / poll) * poll; ag >= poll; ag -= poll) line.push({ t: exact ? t0 - pace * ag : Math.floor(t0 - pace * ag), running: true }, { ago: ag }); }
  while (s < secs) {
    H.s.push(s); H.T.push(T); if (line) fireTimers();
    // the sim
    while (ev.length && ev[0].at <= s) { const e = ev.shift(); if (e.pace !== undefined) p = e.pace; if (e.to !== undefined) { T = e.to; jumpsAt.push(s); } if (e.running !== undefined) running = e.running; }
    // the feed: a request reads the sim's whole minute a few ms after it is sent; its answer comes a few ms later
    if (!inflight && s >= nextPoll) inflight = { read: s + .002 + rnd() * .006, back: s + .006 + rnd() * .012, t: null };
    if (inflight && inflight.t === null && s >= inflight.read) inflight.t = { t: exact ? Math.round(T * 1000) / 1000 + 1e-6 : Math.floor(T), running };
    const hid = hidden.some(([a, b]) => s >= a && s < b), hitch = hitches.find(h => Math.abs(h - s) < dtF / 2);
    if (inflight && inflight.t && s >= inflight.back) { if (line) { if (!starts.length) starts.push(s); line.push(inflight.t); if (line.stats().flushes > flushes) { flushes++; starts.push(s); } }
      else C.observe(inflight.t.t, C.clock.pageT, inflight.t.running); nextPoll = s + poll; inflight = null; }
    const realDt = hitch ? .45 : dtF;
    if (!hid) { const dt = Math.min(.1, realDt); C.clock.pageT += dt; const m = C.move(dt); if (s >= warm && m !== null) F.push([s, m, line ? Tat(shown(s)) : T]); }
    s += realDt; if (running) T += p * realDt;
  }
  let back = 0, maxBack = 0, inJump = 0; const rates = [], err = [];
  const near = s => jumpsAt.some(j => s >= j && s < j + 3);   // (a jump the scenario makes: the clock follows it within a poll or two)
  for (let i = 1; i < F.length; i++) { const d = F[i][1] - F[i - 1][1], ds = F[i][0] - F[i - 1][0], nearJump = near(F[i][0]);
    if (d < 0) { if (nearJump) inJump++; else { back++; maxBack = Math.max(maxBack, -d); } } if (ds > 0 && ds < .05 && !nearJump) rates.push(d / ds); }
  for (const f of F) if (!near(f[0]) && f[1] !== null) err.push(Math.abs(f[1] - f[2]));
  const steadyErr = F.filter(f => !near(f[0]) && f[1] !== null && !settle.some(([a, b]) => f[0] >= a && f[0] < b)).map(f => Math.abs(f[1] - f[2]));
  return { frames: F.length, back, maxBack: +maxBack.toFixed(3), backInJumps: inJump, rate: [q(rates, .05), q(rates, .5), q(rates, .95)].map(v => +v.toFixed(3)), err: [q(err, .5), q(err, .95), Math.max(...err)].map(v => +v.toFixed(3)),
    steadyErr: steadyErr.length ? [q(steadyErr, .5), q(steadyErr, .95), Math.max(...steadyErr)].map(v => +v.toFixed(3)) : null, trace: F, starts, line: line?.stats() ?? null, ...C.stats() };
}
// pace windows for the gate: [scenario, from s, to s, the pace there]
const SC = {
  steady:     { secs: 180, warm: 15 },
  startup:    { secs: 20, warm: 0 },
  slowPolls:  { secs: 180, poll: 3 },
  fastPolls:  { secs: 120, poll: .25 },
  day240:     { secs: 240, pace: .1, warm: 40 },
  day12:      { secs: 120, pace: 2 },
  x10:        { secs: 120, pace: 4 },
  pause:      { secs: 120, events: [{ at: 40, pace: 0 }, { at: 55, pace: .4 }] },
  stopped:    { secs: 80, events: [{ at: 40, pace: 0, running: false }] },
  speedUp:    { secs: 150, events: [{ at: 40, pace: .8 }] },
  seekFwd:    { secs: 90, events: [{ at: 40, to: 700.5 }] },
  seekBack:   { secs: 90, events: [{ at: 40, to: 520.5 }] },
  loop:       { secs: 90, events: [{ at: 40, to: 480 }] },
  hidden6:    { secs: 90, hidden: [[40, 46]] },
  hidden30:   { secs: 120, hidden: [[40, 70]] },
  hitches:    { secs: 150, hitches: [30, 50, 50.5, 70, 90, 110, 111] },
  exact:      { secs: 120, exact: true },          // (a sim that sends its minute with the fraction: the clock takes it as exact)
  exactPause: { secs: 120, exact: true, events: [{ at: 40, pace: 0 }, { at: 55, pace: .4 }] },
};
// BROADCAST · the delay scenarios (D = --delay, 15 s). `full`: the line starts D behind (a page that has been running, or a join that
// backfilled with GET /state?lag=); join and joinLag start empty. settle: where the clock itself settles after a change in the sim (it
// does the same at D = 0, D s later: `vs D=0`); a ramp (the join, after a loop) is a pace change of its own (0.8× → 1×), gated like
// the clock's other pace changes (|err| p95 under a game minute). novs: where `vs D=0` means nothing (the frames stop at the same real
// time over other content; a ramp is slower on purpose)
const at = 60, RAMP = 5 * DELAY;
const DSC = {
  steady:    { secs: 180, full: true },
  join:      { secs: 240, warm: 0, settle: [[0, 240]], novs: [[0, 240]], ramp: true },                    // the page joins: 0.8× until D behind
  joinLag:   { secs: 120, full: true },                                                                  // … with a backfill (GET /state?lag=)
  loop:      { secs: at + 240, full: true, events: [{ at, to: 480 }], settle: [[at, at + 240]], novs: [[at, at + 240]], ramp: true },   // flushed, ramps again
  pause:     { secs: at + 90, full: true, events: [{ at, pace: 0 }, { at: at + 15, pace: .4 }], settle: [[at + DELAY, at + DELAY + 45]] },
  hidden6:   { secs: at + 90, full: true, hidden: [[at, at + 6]], settle: [[at, at + 30]], novs: [[at, at + 30]] },
  hidden30:  { secs: at + 90, full: true, hidden: [[at, at + 30]], settle: [[at, at + 60]], novs: [[at, at + 60]] },
  hiddenMin: { secs: at + 150, full: true, hidden: [[at, at + 90]], align: 60, settle: [[at, at + 120]], novs: [[at, at + 120]] },  // timers once a minute (5 min hidden)
  speedUp:   { secs: at + 120, full: true, events: [{ at, pace: .8 }], settle: [[at + DELAY, at + DELAY + 60]] },
};
const out = {}, dout = {};
for (const [k, o] of Object.entries(SC)) { if (ONLY && k !== ONLY) continue; seed = 7; out[k] = run(o); }
if (!OLD && DELAY > 0) for (const [k, o0] of Object.entries(DSC)) { if (ONLY && k !== 'D ' + k && ONLY !== 'D' && ONLY !== 'D' + k) continue;
  const o = { warm: 15, ...o0 }; seed = 7; const r = run({ ...o, delay: DELAY }); seed = 7; const b = run({ ...o, warm: 0, delay: 0 });
  // vs D = 0: this clock against the same scenario's clock without the line, D s earlier (not in the ramps: there the line is slower on purpose)
  const bt = b.trace, B0 = x => { let lo = 0, hi = bt.length - 1; if (hi < 0 || x < bt[0][0]) return null; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bt[mid][0] <= x) lo = mid; else hi = mid - 1; } return bt[lo][1]; };
  const skip = x => x < DELAY + 20 || (o.novs || []).some(([a, b]) => x >= a && x < b) || r.starts.some(s0 => x >= s0 && x < s0 + RAMP + 2), d = [];   // (both clocks warmed up; not in novs, nor in a ramp)
  for (const f of r.trace) { if (skip(f[0])) continue; const m0 = B0(f[0] - DELAY); if (m0 !== null && f[1] !== null) d.push(Math.abs(f[1] - m0)); }
  r.vs0 = d.length ? [q(d, .5), q(d, .95), Math.max(...d)].map(v => +v.toFixed(3)) : null; delete r.trace; dout[k] = r; }
for (const r of Object.values(out)) delete r.trace;
if (has('json')) console.log(JSON.stringify({ clock: out, delay: DELAY, broadcast: dout }, null, 1));
else { for (const [k, r] of Object.entries(out)) console.log(`${k.padEnd(10)} back ${String(r.back).padStart(4)} (max ${r.maxBack}${r.backInJumps ? `, ${r.backInJumps} at its jumps` : ''}) · pace q05/50/95 ${r.rate.join(' / ')} · |err| p50/p95/max ${r.err.join(' / ')}${r.snaps !== undefined ? ` · snaps ${r.snaps}, movement snaps ${r.moveSnaps}, holds ${r.holds}, pace ${r.pace}` : ''}`);
  if (Object.keys(dout).length) console.log(`BROADCAST · D = ${DELAY} s (simstate/broadcast.js): |err| against the sim's real time D s earlier (on the ramp: the time the line shows)`);
  for (const [k, r] of Object.entries(dout)) console.log(`D ${k.padEnd(9)} back ${String(r.back).padStart(3)}${r.backInJumps ? ` (${r.backInJumps} at its jumps)` : ''} · pace q05/50/95 ${r.rate.join(' / ')} · |err| p50/p95/max ${r.err.join(' / ')} · steady ${r.steadyErr ? r.steadyErr.join(' / ') : '—'} · vs D=0 ${r.vs0 ? r.vs0.join(' / ') : '—'} · fold max ${r.line.maxBatch}, flushes ${r.line.flushes} · snaps ${r.snaps}/${r.moveSnaps}`); }
if (!OLD && !ONLY) { const bad = [];   // the gate: never backward; the steady pace within ±10 %; within a game minute of the sim wherever the sim doesn't jump or stall
  for (const [k, r] of Object.entries(out)) { if (r.back) bad.push(`${k}: ${r.back} frames backward`); if (!['pause', 'speedUp', 'hidden6', 'hidden30', 'stopped', 'exactPause'].includes(k) && !(r.err[1] < 1)) bad.push(`${k}: |err| p95 ${r.err[1]}`); }
  const st = out.steady; if (!(st.rate[0] >= .36 && st.rate[2] <= .44)) bad.push(`steady: pace q05/q95 ${st.rate[0]} / ${st.rate[2]}`);
  // BROADCAST: never backward, |err| p95 ≤ 0.1 game min where the sim runs steadily, the line adds ≤ 0.1 where the clock settles, no burst
  for (const [k, r] of Object.entries(dout)) { if (r.back) bad.push(`D ${k}: ${r.back} frames backward`); if (r.steadyErr && !(r.steadyErr[1] <= .1)) bad.push(`D ${k}: |err| p95 ${r.steadyErr[1]} where steady`);
    if (r.vs0 && !(r.vs0[1] <= .1)) bad.push(`D ${k}: ${r.vs0[1]} p95 from D = 0`); if (r.line.maxBatch > 1) bad.push(`D ${k}: ${r.line.maxBatch} messages in one release`);
    if (DSC[k].ramp && !(r.err[1] < 1)) bad.push(`D ${k}: |err| p95 ${r.err[1]} (its ramp included)`); }
  console.log(bad.length ? 'GATE FAIL\n  ' + bad.join('\n  ') : 'GATE PASS'); if (bad.length) process.exitCode = 1; }
