// W8 · CITY LIFE (2026-10-08): the sim's agents look busy at their places, never statues (MOVEMENT.md §6). Each agent standing at a
// stand spot (agents.js mode 'stand': not stepping, not on a trip leg, not held by the stage) runs a small plan of loops and short walks
// from the authored clips (anim/cast/clips, by NAME: a clip that isn't synced yet falls back, and lights up the moment it is):
//   deal     deal_pace on its strip (the spot's `pace`: started at t 0, stopped only at a wrap) and deal_lookout, mixed; a lean at a wall
//   patrol   walks a short beat along the kerb (the spot's `beat`; patrol_walk once it exists), stops to look, back past the spot
//   gather · craft · work   shuttles along the pile (its `beat`, else its pace strip) and works at each end: dig_pick / dig_shovel,
//            stock_shelf, sweep, carry_box once they exist; until then a busy stop facing the pile
//   wait, hanging out, the yard   sit_bench on a bench seat, sit_stoop on a ledge, lean_wall at a wall, deal_lookout, the walkers'
//            own idles, now and then a stroll along the beat
// Loops switch only at their wraps (clip → clip there; out of a loop it blends to the stand first), and every agent starts its first
// one after its own random wait, so a corner never moves in sync (desynced by start TIME). A public `say` at a place turns the speaker
// and the one it talks to (the last other speaker there, else the nearest) to face each other: talk_gesture / listen_nod when they
// exist, until then the turn and the idles. TRAVEL WINS: the moment the walker isn't standing (a trip leg, a step on, the stage's
// hold) life lets go of it and forgets its plan; it picks up from wherever the walker is when it stands again.
// The clips play through the movement's gait hook (w.mv = { clip, clipT, stand }: movement.js), on a clock life keeps. PRIVACY: life
// only moves walkers the map already draws at their spot (a coarse place is never drawn), and a `say` at a coarse place is ignored.
import { sim as store } from './store.js';
import * as CLIPREG from '../anim/cast/clips/index.js';   // (the authored clips, by name: anim/cast/clips/CLIPS.md)

export const LIFE = { walk: 1.0, settle: .45, start: 5, aim: .2, talk: [6, 9], talkR: 7, gap: 1.25, pair: 30, stroll: .25 };   // m/s · s out of a loop before walking · s max first wait · rad facing before a clip starts · s of a talk · m apart at most · m apart at least (talk-patrol.js: ≥ 1.2) · s a speaker stays "in the exchange" · chance of a stroll
export const NAMES = { pace: 'deal_pace', look: 'deal_lookout', lean: 'lean_wall', stoop: 'sit_stoop', bench: 'sit_bench', talk: ['talk_gesture', 'talk_gesture_b', 'talk_gesture_c', 'talk_gesture_2', 'talk_gesture_3'], nod: 'listen_nod',
  patrol: 'patrol_walk', dig: ['dig_pick', 'dig_shovel'], carry: 'carry_box', stock: 'stock_shelf', sweep: 'sweep' };
const ROLE = { deal: 'deal', patrol: 'patrol', gather: 'work', craft: 'work', work: 'work' };
export const roleOf = act => ROLE[act] || 'hang';
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const pickW = (opts, rn = Math.random) => { const tot = opts.reduce((s, o) => s + o[0], 0); let r = rn() * tot; for (const o of opts) { r -= o[0]; if (r <= 0) return o[1]; } return opts[opts.length - 1][1]; };

// Options for another page mode (C1-4, the record path: simstate/record/loops.js); each default leaves the live/demo life exactly as before:
//   rand(a) → () => [0, 1)   the agent's own seeded random (else Math.random), made again whenever its row's loopSeed changes
//   plan(a, L, H) → [steps] | null   the plan for its role instead of the one below (null: the one below)
//   range   m: every walk, loop and talk step stays within this of the spot's anchor (spot.ax/az, else the spot)
//   listen  false: no talks from the store's public `say` events · talkOf(a, clock) → a talk ({ with, until, role, v }) or null
//   at() → island seconds (C1-9b, the record path): the loops on the island's clock (below), talkAt(a, T) → a sit-down's turn or null
export function createLife({ A, REG = null, log = () => {}, rand = null, plan: planOf = null, range = null, listen = true, talkOf = null, keepOut = null, at: onClock = null, talkAt = null }) {
  REG = REG && REG.CLIP ? REG : CLIPREG;
  const has = n => !!(n && REG?.CLIP?.[n]), first = list => (Array.isArray(list) ? list : [list]).filter(has);
  const S = { plays: {}, walks: 0, talks: 0, faced: 0, wraps: 0, ms: [], maxMs: 0 };
  let clock = 0;
  // ── the plan: a queue of steps, made from the agent's act and its spot whenever the queue runs dry
  //   { k: 'go', to: [x, z], ry, clip? }   walk there (a moving clip over the walk, else the walk itself)
  //   { k: 'loop', clip, at: [x, z, ry], n }   n whole loops of a clip at a point (it walks there first)
  //   { k: 'idle', secs, ry? }   the walkers' own idles (pedsim), facing ry
  function plan(a, L) {
    const rn = L.rnd || Math.random, sp = a.spot, r = roleOf(a.rec?.act), here = [sp.x, sp.z], st = sp.st ?? sp.ry, q = [];
    const look = n => has(NAMES.look) ? { k: 'loop', clip: NAMES.look, at: [...(L.last && L.lastOk ? L.last : here), st], n } : { k: 'idle', secs: 4 + 3 * rn(), ry: st };
    if (sp.kind === 'bench' && has(NAMES.bench)) { q.push({ k: 'loop', clip: NAMES.bench, at: [sp.x, sp.z, sp.ry], n: 3 }); return q; }   // (a bench sitter stays sat: the loop again is seamless)
    if (r === 'deal') {
      const opts = [[3, 'look']]; if (sp.pace && has(NAMES.pace)) opts.push([4, 'pace']); if (sp.lean && has(NAMES.lean)) opts.push([1.2, 'lean']); opts.push([1, 'idle']);
      let o = pickW(opts.filter(x => x[1] !== L.prev || opts.length === 1), rn); L.prev = o;
      if (o === 'pace') { q.push({ k: 'loop', clip: NAMES.pace, at: sp.pace, n: 1 + (rn() < .4 ? 1 : 0) }); if (has(NAMES.look)) q.push({ k: 'loop', clip: NAMES.look, at: [sp.pace[0], sp.pace[1], st], n: 1 }); }
      else if (o === 'lean') q.push({ k: 'loop', clip: NAMES.lean, at: sp.lean, n: 1 + Math.floor(rn() * 2) });
      else if (o === 'look') q.push({ ...look(1 + (rn() < .3 ? 1 : 0)), at: [sp.x, sp.z, st + (rn() - .5) * .6] });
      else q.push({ k: 'idle', secs: 2 + 3 * rn(), ry: st });
      return q; }
    if (r === 'patrol') {
      const ends = sp.beat || (sp.pace ? [[sp.pace[0] + Math.sin(sp.pace[2]) * 1.15, sp.pace[1] + Math.cos(sp.pace[2]) * 1.15]] : null);
      if (ends) { const e = ends[L.beatK++ % ends.length], walk = first(NAMES.patrol)[0] || null;
        q.push({ k: 'go', to: e, clip: walk, v: walk ? REG.CLIP[walk].speed || LIFE.walk : LIFE.walk * .95 }, { k: 'idle', secs: 1.5 + 2.5 * rn(), ry: st + (rn() - .5) * 1.2 },
          { k: 'go', to: here, clip: walk, v: walk ? REG.CLIP[walk].speed || LIFE.walk : LIFE.walk * .95 }); }
      q.push(rn() < .5 ? look(1) : { k: 'idle', secs: 2 + 2 * rn(), ry: st }); return q; }
    if (r === 'work') {
      const ends = sp.beat || (sp.pace ? [[sp.pace[0] + Math.sin(sp.pace[2]) * 1.15, sp.pace[1] + Math.cos(sp.pace[2]) * 1.15]] : null), act = a.rec?.act;
      const tool = act === 'gather' ? first(NAMES.dig) : act === 'craft' ? first([NAMES.stock, ...NAMES.dig]) : first([NAMES.sweep, NAMES.stock]);
      const carry = first(NAMES.carry)[0] || null, work = at => tool.length ? { k: 'loop', clip: tool[Math.floor(rn() * tool.length)], at, n: 1 + Math.floor(rn() * 2) } : { k: 'idle', secs: 2.5 + 3 * rn(), ry: at[2] };
      if (ends) { const e = ends[L.beatK++ % ends.length], face = sp.ry;   // (the spot faces the pile)
        // (the carry back walks at carry_box's own speed, 0.85 m/s: its arms and the box's bob are keyed to that pace)
        q.push({ k: 'go', to: e, v: LIFE.walk * .9 }, work([e[0], e[1], face]), { k: 'go', to: here, v: carry && REG.CLIP[carry].moving ? REG.CLIP[carry].speed || LIFE.walk * .9 : LIFE.walk * .9, clip: carry && !REG.CLIP[carry].moving ? null : carry }, work([sp.x, sp.z, face])); }
      else q.push(work([sp.x, sp.z, sp.ry]), { k: 'idle', secs: 1.5 + 2 * rn(), ry: st });
      return q; }
    // hang: wait, nothing to do, the yard
    const opts = [[2.2, 'look'], [1.5, 'idle']];
    if (sp.sit && has(NAMES.stoop)) opts.push([4, 'stoop']); if (sp.lean && has(NAMES.lean)) opts.push([3.5, 'lean']); if (sp.beat) opts.push([LIFE.stroll * 4, 'stroll']);
    const o = pickW(opts.filter(x => x[1] !== L.prev || x[1] === 'stoop' || x[1] === 'lean'), rn); L.prev = o;
    if (o === 'stoop') q.push({ k: 'loop', clip: NAMES.stoop, at: sp.sit, n: 2 + Math.floor(rn() * 2) });
    else if (o === 'lean') q.push({ k: 'loop', clip: NAMES.lean, at: sp.lean, n: 1 + Math.floor(rn() * 2) });
    else if (o === 'stroll') { const e = sp.beat[L.beatK++ % sp.beat.length]; q.push({ k: 'go', to: e, v: LIFE.walk * .85 }, { k: 'idle', secs: 2 + 3 * rn(), ry: st }, { k: 'go', to: here, v: LIFE.walk * .85 }); }
    else if (o === 'look') q.push({ ...look(1), at: [sp.x, sp.z, st + (rn() - .5) * .8] });
    else q.push({ k: 'idle', secs: 3 + 4 * rn(), ry: (rn() < .5 ? st : sp.ry) + (rn() - .5) * .8 });
    return q; }
  // ── the walker: where it is, what plays
  const at = (w, x, z, ry) => { w.fix = [x, w.fix ? w.fix[1] : w.p[1], z, ry]; };
  function setClip(L, w, clip, t) { const m = L.mv && w.mv === L.mv ? L.mv : (L.mv = { stand: true, life: true }); m.clip = clip; m.clipT = t; w.mv = m; }
  function clearClip(L, w) { if (L.mv && w.mv === L.mv) w.mv = null; L.mv = null; }
  const playing = w => !!(w.g?.clip && !w.g.clip.out);
  const H = { has, first, NAMES, REG, LIFE, now: null }, nextPlan = (a, L) => (planOf && planOf(a, L, H)) || plan(a, L);
  // (range: a target point pulled back to within `range` m of the spot's anchor)
  // (keepOut (C1-6, the record's show only): (x, z) → true inside a staged scene's figure's room; a step that would end there ends at the
  // spot's anchor instead, or where the walker stands. Null: as ever)
  const keep = (a, x, z) => { if (!range || !a.spot) return [x, z]; const ax = a.spot.ax ?? a.spot.x, az = a.spot.az ?? a.spot.z, dx = x - ax, dz = z - az, d = Math.hypot(dx, dz);
    const p = d <= range ? [x, z] : [ax + dx / d * range, az + dz / d * range];
    return !keepOut?.(p[0], p[1]) ? p : !keepOut(ax, az) ? [ax, az] : a.w?.fix ? [a.w.fix[0], a.w.fix[2]] : p; };
  // drop: the walker isn't life's any more (it left, the stage took it): let go of the clip only if it is still ours
  function drop(a) { const L = a.life; if (!L) return; if (a.w && L.mv && a.w.mv === L.mv) a.w.mv = null; a.life = null; }
  function step(a, dt) {
    const w = a.w; if (!w || a.mode !== 'stand' || a.step || a.held || a.run || !a.spot || a.d?.kind !== 'stand') { if (a.life) drop(a); return; }
    let L = a.life; if (!L) { const rn = rand ? rand(a) : Math.random; L = a.life = { q: [], cur: null, t: 0, mv: null, beatK: Math.floor(rn() * 2), prev: null, last: null, lastOk: false, wait: a.first || !a.lifeSeen ? rn() * LIFE.start : .3 + rn() * 1.2, rnd: rand ? rn : null, seed: a.rec?.loopSeed }; a.lifeSeen = true; }
    // (a new row: its own seed)
    if (rand && L.seed !== a.rec?.loopSeed) { L.rnd = rand(a); L.seed = a.rec?.loopSeed; }
    if (talkOf && !a.talk) a.talk = talkOf(a, clock) || null;
    if (!w.fix) w.fix = [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]];
    if (L.wait > 0) { L.wait -= dt; return; }   // (its own start time: nobody moves in step)
    // a talk: turn to the other one (at a clean point: a pace runs to its wrap; anything else blends out); a sitter stays sat and only listens
    const T = a.talk && a.talk.until > clock ? a.talk : null; if (a.talk && !T) a.talk = null;
    // (C1-7: a sit-down's seat, stage/record.js venues: the pair talks sat, so a seat is no bar to a talk)
    if (T && !T.on && (a.spot.seat || (a.spot.kind !== 'bench' && !(L.cur?.k === 'loop' && (L.cur.clip === NAMES.stoop || L.cur.clip === NAMES.bench))))) { const c = L.cur;
      if (!c || c.k !== 'loop' || c.clip !== NAMES.pace) { T.on = true; L.q = []; L.cur = null; clearClip(L, w); L.settle = playing(w) ? LIFE.settle : 0; } }
    if (T?.on) { const oa = A.get(T.with), o = oa?.w; if (!o) { a.talk = null; return; } if (L.settle > 0) { L.settle -= dt; return; }
      // the gap: two talkers closer than LIFE.gap (the big heads meet below ~1.1 m: talk-patrol.js) step apart first, half the shortfall
      // each, all of it when the other one stays sat; then turn to face
      // (C1-7: at a venue the pair's spots are already apart, stage/record.js venues: each talks from its own spot, its seat. A talk
      // begun before its venue was made (the stage's map not drawn yet) kept the old spot's step and walked the pair 3 m apart)
      if (a.spot.venue && (!T.to || T.to[0] !== a.spot.x || T.to[1] !== a.spot.z)) T.to = [a.spot.x, a.spot.z];
      if (!T.to) { const dx = w.fix[0] - o.p[0], dz = w.fix[2] - o.p[2], d = Math.hypot(dx, dz), need = LIFE.gap - d, sat = oa.spot?.kind === 'bench' || (oa.life?.cur?.k === 'loop' && (oa.life.cur.clip === NAMES.stoop || oa.life.cur.clip === NAMES.bench));
        const ux = d > 1e-3 ? dx / d : Math.cos(w.fix[3]), uz = d > 1e-3 ? dz / d : -Math.sin(w.fix[3]), k = need > 0 ? need * (sat ? 1 : .5) : 0; T.to = keep(a, w.fix[0] + ux * k, w.fix[2] + uz * k); }
      { const dx = T.to[0] - w.fix[0], dz = T.to[1] - w.fix[2], d = Math.hypot(dx, dz);
        if (d > .02) { const s = Math.min(d, LIFE.walk * .8 * dt); at(w, w.fix[0] + dx / d * s, w.fix[2] + dz / d * s, Math.atan2(dx, dz)); w.vc = LIFE.walk * .8; w.ph = (w.ph || 0) + w.vc * dt * 3.1; return; } }
      const ry = Math.atan2(o.p[0] - w.p[0], o.p[2] - w.p[2]); at(w, w.fix[0], w.fix[2], ry); w.vc = 0;
      // (sat: the seat's clip for both turns; the speech bubble says who talks)
      const clip = a.spot.seat ? first([a.spot.seat])[0] : T.role === 'speak' ? first(NAMES.talk)[T.v % Math.max(1, first(NAMES.talk).length)] : first(NAMES.nod)[0];
      if (clip && Math.abs(wrap((w.yawS ?? ry) - ry)) < LIFE.aim * 2) { T.ct = (T.ct ?? 0) + dt; setClip(L, w, clip, T.ct); } else if (!clip) clearClip(L, w);
      if (clock + dt >= T.until) { a.talk = null; clearClip(L, w); L.settle = clip ? LIFE.settle : 0; L.wait = .4 + (L.rnd || Math.random)(); }
      return; }
    if (L.settle > 0) { L.settle -= dt; return; }
    if (!L.cur) { if (!L.q.length) L.q = nextPlan(a, L); L.cur = L.q.shift() || null; L.t = 0; if (!L.cur) return; }
    const c = L.cur; L.t += dt;
    if (c.k === 'idle') { at(w, w.fix[0], w.fix[2], c.ry ?? w.fix[3]); w.vc = 0; if (L.t >= c.secs) L.cur = null; return; }
    const [tx, tz] = keep(a, c.k === 'go' ? c.to[0] : c.at[0], c.k === 'go' ? c.to[1] : c.at[1]), dx = tx - w.fix[0], dz = tz - w.fix[2], d = Math.hypot(dx, dz);
    if (d > .03) {   // walk there first (out of a clip: it blends to the stand first)
      if (playing(w) && L.mv && !(c.k === 'go' && c.clip && w.g.clip.name === c.clip)) { clearClip(L, w); L.settle = LIFE.settle; return; }   // (not the walk's own moving clip, patrol_walk / carry_box: that one plays on)
      const v = c.v || LIFE.walk, s = Math.min(d, v * dt), ry = Math.atan2(dx, dz);
      if (c.k === 'go' && c.clip && has(c.clip)) setClip(L, w, c.clip, (L.wt = (L.wt || 0) + dt)); else if (L.mv) clearClip(L, w);
      at(w, w.fix[0] + dx / d * s, w.fix[2] + dz / d * s, ry); w.vc = v; w.ph = (w.ph || 0) + v * dt * 3.1; if (L.t < dt * 1.5) S.walks++; return; }
    w.vc = 0; L.wt = 0;
    if (c.k === 'go') { at(w, tx, tz, w.fix[3]); if (L.mv) { clearClip(L, w); L.settle = .2; } L.cur = null; L.last = [tx, tz]; L.lastOk = false; return; }
    // a loop: face its way, then whole loops on life's clock; it ends exactly at a wrap (the next loop starts there, else it blends out)
    at(w, tx, tz, c.at[2]); L.last = [tx, tz]; L.lastOk = true;
    if (!has(c.clip)) { L.cur = { k: 'idle', secs: 3, ry: c.at[2] }; L.t = 0; return; }
    if (c.ct === undefined) { if (Math.abs(wrap((w.yawS ?? c.at[2]) - c.at[2])) > LIFE.aim) return; c.ct = 0; S.plays[c.clip] = (S.plays[c.clip] || 0) + 1; }
    const D = REG.CLIP[c.clip].dur, end = D * c.n; c.ct = Math.min(end, c.ct + dt); setClip(L, w, c.clip, c.ct);
    if (c.ct >= end) { S.wraps++; L.cur = null; if (!L.q.length) L.q = nextPlan(a, L); const nx = L.q[0];
      const same = nx && nx.k === 'loop' && Math.hypot(nx.at[0] - tx, nx.at[1] - tz) < .03 && Math.abs(wrap(nx.at[2] - c.at[2])) < LIFE.aim && has(nx.clip);   // (the next loop here, this way: clip → clip at the wrap)
      if (!same) { clearClip(L, w); L.settle = LIFE.settle; } }
  }
  // ── social: a public `say` at a place
  const spoke = new Map();   // place → [{ h, t }] (page seconds)
  function heard(e) {
    if (!e || e.type !== 'say' || !e.who || !e.at || String(e.at).startsWith('dist:') || (e.to && e.to !== 'here') || e.dm) return;   // (public lines only, never a coarse place)
    const a = A.get(e.who); if (!ok(a, e.at)) return;
    const recent = (spoke.get(e.at) || []).filter(s => clock - s.t < LIFE.pair && s.h !== e.who); spoke.set(e.at, [...recent, { h: e.who, t: clock }].slice(-6));
    let b = null; for (let k = recent.length - 1; k >= 0 && !b; k--) { const o = A.get(recent[k].h); if (ok(o, e.at) && dist(a, o) < LIFE.talkR) b = o; }
    if (!b) { let bd = LIFE.talkR; for (const o of A.values()) { if (o === a || !ok(o, e.at)) continue; const dd = dist(a, o); if (dd < bd) { bd = dd; b = o; } } }
    if (!b) return; const secs = LIFE.talk[0] + Math.random() * (LIFE.talk[1] - LIFE.talk[0]); S.talks++;
    a.talk = { with: b.id, until: clock + secs, role: 'speak', v: Math.floor(Math.random() * 3) }; if (!b.talk || b.talk.with !== a.id || b.talk.role !== 'speak') b.talk = { with: a.id, until: clock + secs, role: 'listen', v: 0 }; }
  const ok = (a, place) => !!(a && a.w && a.mode === 'stand' && a.spot?.place === place && !a.held && !a.run);
  const dist = (a, b) => Math.hypot(a.w.p[0] - b.w.p[0], a.w.p[2] - b.w.p[2]);
  const off = listen ? store.on('event', heard) : null;
  // ── C1-9b · ON THE ISLAND'S CLOCK (the record path only: `at` → island seconds; null on live and demo, which run step() above).
  // A standing walker's loops are a function of the island minute and its row: the row's seed (loopSeed) and its start (loopAnchor,
  // island minutes) make one plan, laid out from that start as timed pieces (a wait, a walk, a turn, a clip, a settle), each as long as
  // step() would take, with no page dt in it. The walker is then posed from the piece at the minute, so seeking there equals playing
  // there at any frame rate and any speed, and a paused record stands still. A new row, spot or scene starts a new plan; going back
  // to an earlier row starts its own plan again (no later loop's clip survives a seek back). A walker life takes over off a walk or a
  // stage hold eases into the plan's pose over EASE island seconds; one the driver placed outright (a seek) is posed at once
  const EASE = .6, TURN = 4;
  const lkey = a => { const r = a.rec || {}, sp = a.spot; return `${r.loopSeed}|${r.loopAnchor}|${r.loopRole}|${r.act}|${r.walk}|${r.show?.sceneId ?? ''}|${r.show?.face ?? ''}|${r.meet ?? ''}|${sp?.place}#${sp?.k}|${sp?.x},${sp?.z}`; };
  function plot(a) {
    const sp = a.spot, rn = rand ? rand(a) : Math.random, t0 = (a.rec?.loopAnchor ?? 0) * 60;
    const G = { key: lkey(a), q: [], segs: [], end: t0, x: sp.x, z: sp.z, ry: sp.ry ?? 0, clip: null, beatK: Math.floor(rn() * 2), prev: null, last: null, lastOk: false, rnd: rn, seed: a.rec?.loopSeed, trace: [] };
    // (its own start: the plan is laid out from up to LIFE.start s before the row's start, so a corner never moves in step, and the row
    // opens mid-loop rather than on a wait that a paused record would hold; a show's play starts on its scene's start)
    const lead = rn() * LIFE.start; if (a.rec?.loopRole !== 'show') G.end -= lead; return G; }
  function seg(G, k, d, o) { if (!(d > 0)) return; const s = { k, t0: G.end, t1: G.end + d, x0: G.x, z0: G.z, x1: o.x ?? G.x, z1: o.z ?? G.z, ry: o.ry ?? G.ry, clip: o.clip ?? null, v: o.v ?? 0, cur: o.cur ?? null };
    G.segs.push(s); G.end = s.t1; G.x = s.x1; G.z = s.z1; G.ry = s.ry; }
  function planAt(a, G, t) { H.now = t / 60; try { return nextPlan(a, G) || []; } finally { H.now = null; } }
  // one more piece of the plan: what step() does with its next step, timed
  function grow(a, G) {
    if (!G.q.length) G.q = planAt(a, G, G.end);
    const c = G.q.shift(); if (!c) { seg(G, 'idle', 1, { cur: { k: 'idle' } }); return; }
    const cur = { k: c.k, clip: c.clip ?? null };
    if (c.k === 'idle') { seg(G, 'idle', c.secs, { ry: c.ry ?? G.ry, cur }); return; }
    const [tx, tz] = keep(a, c.k === 'go' ? c.to[0] : c.at[0], c.k === 'go' ? c.to[1] : c.at[1]), d = Math.hypot(tx - G.x, tz - G.z);
    if (d > .03) { const walk = c.k === 'go' && c.clip && has(c.clip) ? c.clip : null;
      if (G.clip && !(walk && G.clip === walk)) { seg(G, 'settle', LIFE.settle, { cur }); G.clip = null; }
      const v = c.v || LIFE.walk; seg(G, 'walk', d / v, { x: tx, z: tz, ry: Math.atan2(tx - G.x, tz - G.z), v, clip: walk, cur }); G.clip = walk; }
    if (c.k === 'go') { if (G.clip) { seg(G, 'settle', .2, { cur }); G.clip = null; } G.last = [tx, tz]; G.lastOk = false; return; }
    G.last = [tx, tz]; G.lastOk = true;
    if (!has(c.clip)) { seg(G, 'idle', 3, { ry: c.at[2], cur: { k: 'idle' } }); return; }
    seg(G, 'turn', Math.max(0, Math.abs(wrap(G.ry - c.at[2])) - LIFE.aim) / TURN, { ry: c.at[2], cur });
    G.ry = c.at[2]; seg(G, 'clip', REG.CLIP[c.clip].dur * c.n, { clip: c.clip, cur }); G.clip = c.clip; S.plays[c.clip] = (S.plays[c.clip] || 0) + 1;
    if (!G.q.length) G.q = planAt(a, G, G.end);
    const nx = G.q[0], same = nx && nx.k === 'loop' && Math.hypot(nx.at[0] - tx, nx.at[1] - tz) < .03 && Math.abs(wrap(nx.at[2] - c.at[2])) < LIFE.aim && has(nx.clip);
    if (!same) { seg(G, 'settle', LIFE.settle, { cur }); G.clip = null; } }
  // the piece at island second T (laid out up to T on the way), binary-searched: a seek back inside the row reads an earlier piece
  function pieceAt(a, G, T) {
    for (let n = 0; G.end <= T && n < 200000; n++) grow(a, G);
    const L = G.segs; let lo = 0, hi = L.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (L[mid].t0 <= T) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    return k < 0 ? null : L[k]; }
  function stepAt(a, T, dtPage) {
    const w = a.w; if (!w || a.mode !== 'stand' || a.step || a.held || a.run || !a.spot || a.d?.kind !== 'stand') { if (a.life) drop(a); return; }
    let G = a.lifeG; if (!G || G.key !== lkey(a)) G = a.lifeG = plot(a);
    if (!w.fix) w.fix = [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]];
    // (taken over: from where the walker is; placed outright by the driver: at once)
    let L = a.life; if (!L) { L = a.life = { mv: null, ease: a.placed ? null : { x: w.fix[0], z: w.fix[2], T }, cur: null, wait: 0, settle: 0, trace: G.trace, seed: G.seed }; }
    if (a.placed) { L.ease = null; a.placed = false; }
    L.trace = G.trace; L.seed = G.seed;
    const T0 = (a.rec?.loopAnchor ?? 0) * 60, tk = T >= T0 && talkAt ? talkAt(a, T) : null;
    let x, z, ry, clip = null, ct = 0, v = 0, ph = null;
    if (tk) {
      // (a sit-down's turn: at its own spot, facing the other one's; sat at a seat, else talking or nodding)
      const o = A.get(tk.with), os = o?.spot; x = a.spot.x; z = a.spot.z; ry = os ? Math.atan2(os.x - x, os.z - z) : G.ry;
      clip = a.spot.seat ? first([a.spot.seat])[0] : tk.role === 'speak' ? first(NAMES.talk)[tk.v % Math.max(1, first(NAMES.talk).length)] : first(NAMES.nod)[0]; ct = T - tk.from;
      a.talk = { with: tk.with, until: tk.until, role: tk.role, v: tk.v, on: true }; L.cur = { k: 'talk' }; L.wait = 0; L.settle = 0;
    } else {
      if (a.talk?.on) a.talk = null;
      const s = T < T0 ? null : pieceAt(a, G, T);
      if (!s) { x = a.spot.x; z = a.spot.z; ry = a.spot.ry ?? 0; L.cur = null; L.wait = 1; L.settle = 0; }
      else { const u = s.t1 > s.t0 ? Math.min(1, (T - s.t0) / (s.t1 - s.t0)) : 1; x = s.x0 + (s.x1 - s.x0) * u; z = s.z0 + (s.z1 - s.z0) * u; ry = s.ry;
        if (s.k === 'walk') { v = s.v; ph = v * (T - s.t0) * 3.1; if (s.clip) { clip = s.clip; ct = T - s.t0; } }
        else if (s.k === 'clip') { clip = s.clip; ct = T - s.t0; }
        L.cur = s.cur; L.wait = s.k === 'wait' ? s.t1 - T : 0; L.settle = s.k === 'settle' ? s.t1 - T : 0; }
    }
    if (L.ease) { const e = L.ease, k = Math.min(1, Math.max(0, (T - e.T) / EASE)); if (k >= 1 || Math.hypot(x - e.x, z - e.z) < .03) L.ease = null; else { x = e.x + (x - e.x) * k; z = e.z + (z - e.z) * k; } }
    at(w, x, z, ry); w.vc = v; if (ph !== null) w.ph = ph;
    if (clip && has(clip)) setClip(L, w, clip, ct); else clearClip(L, w);
  }
  function frameAt(dt) { const t0 = performance.now(), T = onClock(); clock += dt; for (const a of A.values()) { try { stepAt(a, T, dt); } catch (e) { log(`life ${a.id}: ${e && e.message || e}`); drop(a); } }
    const ms = performance.now() - t0; S.ms.push(ms); if (S.ms.length > 600) S.ms.shift(); S.maxMs = Math.max(S.maxMs, ms); }
  function frame(dt) { if (onClock) { frameAt(dt); return; } const t0 = performance.now(); clock += dt; for (const a of A.values()) { try { step(a, dt); } catch (e) { log(`life ${a.id}: ${e && e.message || e}`); drop(a); } }
    const ms = performance.now() - t0; S.ms.push(ms); if (S.ms.length > 600) S.ms.shift(); S.maxMs = Math.max(S.maxMs, ms); }
  const q = (v, p) => { if (!v.length) return 0; const s = v.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(3); };
  return { frame, heard, drop, stats: () => ({ ...S, ms: undefined, p50: q(S.ms, .5), p95: q(S.ms, .95), maxMs: +S.maxMs.toFixed(3), live: [...A.values()].filter(a => a.life).length,
      now: Object.fromEntries([...A.values()].filter(a => a.life).map(a => [a.id, a.talk?.on ? 'talk:' + a.talk.role : a.life.cur ? (a.life.cur.k === 'loop' ? a.life.cur.clip : a.life.cur.k) : a.life.wait > 0 ? 'wait' : '-'])) }),
    stop() { off?.(); } };
}
