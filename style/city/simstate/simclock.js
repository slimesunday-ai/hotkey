// SIM CLOCK (2026-10-09) · the sim's clock as the page sees it, and the movement clock the cabs and legs run on (agents.js).
// The sim's GET /state carries `t` in WHOLE game minutes (sim2/game.mjs g.t, one tick a minute; tools/simreplay.mjs floors its clock
// the same way) and nothing about its pace. At the 60-min day t steps once every 2.5 s and the feed polls once a second, so a poll
// only proves t ≤ T < t + 1. The old clock took each poll's t as the time and the gap between two polls as the pace (0, 0, 1 game
// min/s …): it ran ahead, snapped back at the next poll, and the movement clock chasing it ran backward in 1 frame in 6 (buses and
// skaters surged, stopped and reversed). Now:
//   line     observe(t, pageT, running): a least-squares fit of t + ½ against page time (polls forgotten over TAU s; while the fit is
//            young it leans on the pace so far, PACE0 before any) → clock = { t, at, rate }, the line t + rate × (pageT − at). Each
//            poll then keeps the line inside what that poll proves. Snaps (clock.epoch + 1) only when the sim jumps: back in time (a
//            loop, a restart, a seek back) or more than JUMP min ahead of the line (a seek, a page that stopped drawing). A step that
//            doesn't come (the sim paused or stopped: running false) holds the line at most a minute past the last t, rate 0; the
//            next step carries on (a fresh fit at the old pace when the hold was long).
//   move     the movement clock: the line's rate, slewed by at most ±SLEW of it toward the line. Never backward, never a surge. It
//            jumps to the line only on the line's own jumps: a snap, the line moved more than LEAP min at once (the tape player's
//            seeks and its way back to live write the line directly), or more than SNAP min apart.
// The tape player (ui/tape/map.js) writes clock.t / at / rate / running itself every frame; both clocks read it the same way.
// Pure JS: no three, no DOM (node: tools/clockcheck.mjs).
// Shared conversion for movement, cabs, fleet and subway. The retired path never sets it.
export let GAME_MIN = 2.5;
export function setGameMinute(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('seconds per game minute must be positive');
  GAME_MIN = seconds;
}

export const CLOCK = {
  pace0: .4,     // game min per s before any fit: the sim's default 60-min day (sim2/server.mjs DEFAULT_CONFIG.day)
  tau: 30,       // s: the fit forgets a poll over this long
  prior: 10,     // the pace so far, weighed against a young fit (in poll·s²: a fit of ~5 polls over ~5 s weighs as much)
  jump: 4,       // game min ahead of the line: the sim jumped (a seek, or the page stopped drawing while the polls came in)
  leap: 1.5,     // game min the line moved at once that the movement clock follows outright (the tape's seeks)
  snap: 4,       // game min between the movement clock and the line that it closes outright
  gain: .5,      // 1/s: the movement clock closes this share of its distance to the line a second …
  slew: .3,      // … at most this share of the rate on or off
  capS: 3,       // s past the last poll the line runs on (more when the polls are slower: 2.5 poll gaps)
  minGap: .25,   // s: a poll this soon after the last (no frames drawn between: a hidden tab) is no fit sample
};

export function createSimClock(opt = {}) {
  const C = { ...CLOCK, ...opt };
  // the line (shared: agents.js hands this object out as agents.clock)
  const clock = { t: null, at: 0, rate: 0, running: false, pageT: 0, epoch: 0 };
  // the fit: sums over the polls (x = page time − ref), forgotten over tau · the last poll's proof (T < ct at page time cp) · the steps
  const F = { on: false, ref: 0, w: 0, x: 0, y: 0, xx: 0, xy: 0, lastP: 0, lastT: null, q: 1, ct: 0, cp: 0, at: null, edgeP: 0, E: [], gap: 1,
    held: false, blind: false, pace: null, edgePace: null, missN: 0, missDir: 0, stale: 0, snaps: 0, holds: 0 };
  const cap = () => Math.max(C.capS, F.gap * 2.5), lineAt = p => clock.t + clock.rate * Math.min(p - clock.at, cap());
  const setLine = (t, p, rate) => { clock.t = t; clock.at = p; clock.rate = rate; F.at = p; };
  const proof = (t, q, p) => { F.q = q; F.ct = t + q; F.cp = p; };
  function add(p, y) { const x = p - F.ref, k = F.w ? Math.exp(-Math.max(0, p - F.lastP) / C.tau) : 1;
    F.w = F.w * k + 1; F.x = F.x * k + x; F.y = F.y * k + y; F.xx = F.xx * k + x * x; F.xy = F.xy * k + x * y; }
  function fit(p) { const b0 = F.pace ?? C.pace0, L = C.prior, det = F.w * (F.xx + L) - F.x * F.x;
    const b = Math.max(0, det > 1e-9 ? (F.w * (F.xy + L * b0) - F.x * F.y) / det : b0), a = (F.y - b * F.x) / F.w;
    return { b, y: a + b * (p - F.ref) }; }
  // a fresh fit from this poll (snap: the movement clock jumps to it)
  function start(t, q, p, run, snap) {
    Object.assign(F, { on: true, blind: false, held: false, missN: 0, ref: p, w: 0, x: 0, y: 0, xx: 0, xy: 0, lastP: p, lastT: t, edgeP: p }); if (snap) F.E.length = 0;
    add(p, t + q / 2); proof(t, q, p); setLine(t + q / 2, p, F.pace ?? C.pace0);
    if (snap) { clock.epoch++; F.snaps++; }
    if (run === false) hold(t, q, p); }
  // the sim stands: the line stops where it is, inside what the last poll proves
  function hold(t, q, p) { setLine(Math.min(t + q, Math.max(t, lineAt(p))), p, 0); proof(t, q, p);
    if (!F.held) { F.held = true; F.holds++; F.pace = F.edgePace ?? F.pace; } }
  // one poll: t (game minutes: whole, or exact if the sim ever sends a fraction), the page time it arrived at, running (false: stopped)
  function observe(t, p, running) {
    clock.running = !!running;
    if (typeof t !== 'number' || !Number.isFinite(t)) { clock.t = null; F.on = false; return; }
    const q = Number.isInteger(t) ? 1 : 0, y = t + q / 2;
    if (!F.on || clock.t === null || t < F.lastT || y - lineAt(p) > C.jump) return start(t, q, p, running, true);
    const dp = p - F.lastP;
    if (dp < C.minGap) { if (t - F.lastT > 1) F.blind = true; return; }
    if (F.blind) return start(t, q, p, running, false);
    F.gap += (Math.min(dp, 5) - F.gap) * .3;
    if (running === false) { hold(t, q, p); F.lastP = p; F.lastT = t; return; }
    if (F.held) { if (t !== F.lastT) return start(t, q, p, running, false); F.lastP = p; proof(t, q, p); return; }
    if (t !== F.lastT) { F.edgeP = dp > 3 ? p : (F.lastP + p) / 2; F.edgePace = F.pace; F.E.push([t, F.edgeP]); if (F.E.length > 6) F.E.shift(); }
    add(p, y); F.lastP = p; F.lastT = t; proof(t, q, p);
    const f = fit(p), miss = f.y < t - .1 ? -1 : f.y > t + q + .12 ? 1 : 0;
    F.missN = miss && miss === F.missDir ? F.missN + 1 : miss ? 1 : 0; F.missDir = miss;
    if (F.missN >= 3 && F.E.length >= 3) { const e0 = F.E[0], e1 = F.E[F.E.length - 1], eP = F.edgeP;
      if (e1[1] > e0[1]) F.pace = (e1[0] - e0[0]) / (e1[1] - e0[1]);
      F.stale++; start(t, q, p, running, false); F.edgeP = eP; return; }
    if (f.b > 0 && F.w >= 3) F.pace = f.b;
    setLine(Math.min(t + q + .02, Math.max(t, f.y)), p, f.b);
    if (p - F.edgeP > (q ? 1.5 / Math.max(f.b, .01) : 0) + 1.5 * F.gap) hold(t, q, p);
  }
  // the movement clock: follows the line, never backward, never past what the last poll proves
  const M = { t: null, epoch: -1, pt: null, snaps: 0 };
  function move(dt) {
    if (clock.t === null) { M.pt = null; return M.t = null; }
    const p = clock.pageT, n = lineAt(p), r = p - clock.at > cap() ? 0 : clock.rate, expect = M.pt === null ? n : M.pt + r * dt; M.pt = n;
    if (M.t === null || M.epoch !== clock.epoch || Math.abs(n - expect) > C.leap || Math.abs(n - M.t) > C.snap) { M.epoch = clock.epoch; M.snaps++; return M.t = n; }
    const e = n - M.t;
    let v = r > 0 ? Math.min(r * (1 + C.slew), Math.max(r * (1 - C.slew), r + C.gain * e)) : Math.min(F.pace ?? C.pace0, C.gain * e);
    if (clock.at === F.at) { const ceil = F.ct + .1 + r * Math.min(p - F.cp, cap()); if (M.t > ceil + .4) v = 0; else if (M.t > ceil) v = Math.min(v, r * (1 - C.slew)); }   // (past the proof: slowest, then stop)
    if (v > 0) M.t += v * dt;
    return M.t;
  }
  return { clock, observe, move, now: () => clock.t === null ? null : lineAt(clock.pageT), get moveNow() { return M.t; },
    stats: () => ({ pace: F.pace === null ? null : +F.pace.toFixed(4), held: F.held, holds: F.holds, stale: F.stale, snaps: F.snaps, moveSnaps: M.snaps, gap: +F.gap.toFixed(3) }) };
}
