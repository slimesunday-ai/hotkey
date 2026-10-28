// C1-4, the drawn half · THE DAY'S LOOPS ON THE RECORD PATH. life.js runs every standing walker's plan; this file is the record
// path's plans, picked by the role its routine row names (routines.js LOOP_ROLES: deal, work, patrol, hang, cook, bench, meet), with
// the clips the city has (anim/cast/clips, by name: a clip that isn't in the registry is skipped, never a stall).
//   deal     deal_pace on its pace strip, deal_lookout, a lean at a wall, a smoke, a drink
//   work     dig_pick / dig_shovel (gathering at a drop), pick_up, a short carry_box, sweep, stock_shelf
//   patrol   patrol_walk out and back on its beat (kept short: below), deal_lookout, guard_post
//   hang     lean_wall, sit_stoop, sit_bench (a bench seat stays sat), deal_lookout, a drink, a smoke, a short stroll
//   cook     cook_stir, cook_fan, a smoke, deal_lookout (the lab's bench and burner are C1-7's set: none is drawn by day yet)
//   bench    bench_clamp, bench_file, bench_fit, bench_hammer, bench_assemble (the Gunrunner's bench loops; no bench drawn yet)
//   meet     the sit-down: the pair face each other, one talks (talk_gesture*) while the other nods (listen_nod), turn by turn (talkOf)
// The board's public `walk` (a visible high: wired, spaced, guarded) adds its standing loop to every plan and walks every step in its
// walking overlay (WALKS); agents.js plays the overlay on trips too.
// DETERMINISTIC: no Math.random. Each agent's choices come from its row's loopSeed (routines.js), a sit-down's turns from its event id.
// C1-9b: and on the island's clock (life.js `at`): a plan is laid out from its row's start (loopAnchor), so what a walker does at a
// minute is a function of that minute and its row, never of the page's frame times; a sit-down's turns likewise (talkAt).
// RANGE: every step stays within RANGE m of the spot's anchor (life.js `range`), so placecheck's checkDrawn (1.5 m from a measured
// stand spot) holds while they loop: the beat and stroll ends in stands.json reach 4–5 m, and those are pulled back to it.
import { idHash } from './addresses.js';

export const RANGE = 1.2;
export const WALKS = Object.freeze({ wired: ['wired_walk', 'wired_bounce'], spaced: ['spaced_walk', 'spaced_drift'], guarded: ['guarded_walk', 'guarded_stance'] });
export const walkClipOf = walk => WALKS[walk]?.[0] ?? null;
// C1-6 · THE SHOW'S PLAYS, on the player's own walker (each [clip, loops, 'out' = walked out to its beat and back]). The partners, the
// props and the lights are the stage's (stage/record.js); these are only what the named agent itself does at its place, by the
// scene's kind and, for a hustle, the receipt's district variant (show-plan.js `variant`: never a second table of districts)
export const SHOW_LOOPS = Object.freeze({
  'hustle:stickup': [['aim_draw', 1], ['aim_hold', 3], ['aim_lower', 1], ['pat_pockets', 1]],
  'hustle:mugging': [['rob_lunge_grab', 1], ['pat_pockets', 2], ['deal_lookout', 1]],
  'hustle:crates': [['pick_up', 1], ['carry_box', 1, 'out'], ['crate_lift', 1]],
  'hustle:cars': [['pick_lock', 1], ['rummage', 1], ['deal_lookout', 1]],
  'hustle:boats': [['pick_up', 1], ['gangway_up', 1, 'out'], ['carry_box', 1, 'out']],
  'hustle:scrap': [['pick_up', 1], ['bench_hammer', 2], ['carry_box', 1, 'out']],
  'hustle:shoplift': [['pick_up', 1], ['pat_pockets', 1], ['deal_lookout', 1], ['creep_walk', 1, 'out']],
  'hustle:campers': [['flashlight_search', 1], ['rob_lunge_grab', 1], ['pat_pockets', 1], ['creep_walk', 1, 'out']],
  run: [['dig_pick', 2], ['dig_shovel', 2], ['carry_box', 1, 'out']],
  cook: [['cook_stir', 2], ['cook_check', 1], ['cook_fan', 1]],
  deal: [['deal_pace', 1], ['deal_lookout', 1], ['brush_pass', 1], ['deal_lookout', 1]],
  build: [['bench_hammer', 2], ['bench_stamp', 1], ['bench_assemble', 1], ['bench_file', 2]],
  patrol: [['patrol_walk', 1, 'out'], ['deal_lookout', 1], ['guard_post', 1]],
  guard: [['guard_post', 2], ['deal_lookout', 1]],
  back: [['guard_post', 1], ['lookout_wave', 1], ['deal_lookout', 1]],
  grab: [['lookout_wave', 1], ['deal_lookout', 1]],
  vault: [['lookout_wave', 1], ['deal_lookout', 1]],
  collar: [['patrol_walk', 1, 'out'], ['guard_post', 1]],
  board: [['evicted_carry', 1, 'out'], ['deal_lookout', 1]],
  // (C1-7: a back's walk to the dock, kind walk, arrives as a boarder's does)
  walk: [['evicted_carry', 1, 'out'], ['deal_lookout', 1]],
  laylow: [['lean_wall', 2]],
  default: [['deal_lookout', 2]],
});
// C1-7 · THE NEW SETS' BEATS (SHOW.md "C1-7: new-set data"): a scene with beats plays, inside each beat's window, that beat's clips, one
// pass at a time (the plan is asked again when it runs out, and picks the beat it is in then). The props, the sparks and the steam round
// them are the stage's (stage/record.js); the build's vise loops, the cook's batch (cook.md: stir, pour, stir or fan, check), the runs'
// dig, unearth and carry in the woods, the container and the lift at the docks, the search and the pick-up at the Mall and the Heap
export const BEAT_LOOPS = Object.freeze({
  'build:clamp': [['bench_clamp', 3]], 'build:hammer': [['bench_hammer', 1]], 'build:file': [['bench_file', 4]], 'build:fit': [['bench_fit', 2]], 'build:assemble': [['bench_assemble', 1]],
  'cook:stir': [['cook_stir', 1]], 'cook:pour': [['cook_pour', 1]], 'cook:fan': [['cook_fan', 1]], 'cook:check': [['cook_check', 1]],
  'run:dig': [['dig_shovel', 1], ['dig_pick', 1]], 'run:unearth': [['dig_pick', 1], ['pick_up', 1]], 'run:carry': [['carry_box', 1, 'out']],
  'run:container': [['rummage', 1]], 'run:lift': [['crate_lift', 1]], 'run:search': [['rummage', 1]], 'run:pick_up': [['pick_up', 2]],
});
export const beatOf = (beats, m) => beats?.find(b => b.start <= m && m < b.end) ?? (beats?.length && m >= beats.at(-1).end ? beats.at(-1) : null);
// (mulberry32: a small seeded generator, the same numbers on every machine)
export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// meetings: Map(eventId → { eventId, a, b }) from the planner's cues; A: agents.js's map (id → agent)
// now: the player's island minute (a beat's window is in island minutes)
export function createLoops({ meetings = new Map(), A: map = null, now = null } = {}) {
  let A = map;
  const talks = new Map(), stats = { plans: {}, talks: 0 };
  const rand = a => seeded(a.rec?.loopSeed ?? idHash(String(a.id)));
  function plan(a, L, H) {
    const role = a.rec?.loopRole; if (!role || !a.spot) return null;
    const { has, NAMES, REG, LIFE } = H, rn = L.rnd || rand(a), sp = a.spot, st = sp.st ?? sp.ry, q = [];
    const n = (lo, hi) => lo + Math.floor(rn() * (hi - lo + 1));
    const here = (dy = 0) => [sp.x, sp.z, st + dy];
    const loop = (clip, at, k = 1) => has(clip) ? { k: 'loop', clip, at, n: k } : null;
    const mood = WALKS[a.rec?.walk] ?? null, overlay = mood && has(mood[0]) ? mood[0] : null;
    const go = (to, v = LIFE.walk * .85, clip = null) => ({ k: 'go', to, v: overlay && !clip ? v : clip && REG.CLIP[clip]?.speed ? REG.CLIP[clip].speed : v, clip: overlay && !clip ? overlay : clip });
    // a short walk out to a point (its beat's end, else a step along its facing) and back
    const out = (clip = null) => { const e = sp.beat?.[L.beatK++ % sp.beat.length] ?? (sp.pace ? [sp.pace[0] + Math.sin(sp.pace[2]) * 1.1, sp.pace[1] + Math.cos(sp.pace[2]) * 1.1] : [sp.x + Math.sin(st) * 1.1, sp.z + Math.cos(st) * 1.1]);
      return [go(e, LIFE.walk * .85, clip), loop(NAMES.look, [e[0], e[1], st + (rn() - .5)], 1), go([sp.x, sp.z], LIFE.walk * .85, clip)]; };
    // the options: [weight, () => steps]; the last pick is not picked again at once unless it is the only one
    const opts = [];
    const add = (w, key, make) => { const s = make(); if (s && (Array.isArray(s) ? s.every(Boolean) : true)) opts.push([w, key, Array.isArray(s) ? s : [s]]); };
    // C1-6: the show. An agent inside its own scene's window plays its play (rec.show: the scene's kind and variant), facing the
    // scene's mark (rec.show.face: the clerk, the buyer, the bench; else its spot's way). The whole sequence, then again
    if (role === 'show') {
      const S = a.rec.show, t = H.now ?? (now ? now() : null), b = S.beats && t !== null ? beatOf(S.beats, t) : null, beat = b && BEAT_LOOPS[`${S.kind}:${b.name}`];
      const seq = beat ?? SHOW_LOOPS[S.variant ? `hustle:${S.variant}` : S.kind] ?? SHOW_LOOPS.default;
      const ry = S.face && a.w ? Math.atan2(S.face[0] - sp.x, S.face[1] - sp.z) : st;
      for (const [clip, k, how] of seq) {
        if (!has(clip)) continue;
        // (out to the beat's end and back, both ways in the clip: no look round between, that is the day's)
        if (how === 'out') { const o = out(clip); q.push(o[0], o[2]); }
        else q.push({ k: 'loop', clip, at: [sp.x, sp.z, ry], n: k });
      }
      if ((L.trace ||= []).length < 4) L.trace.push(`show:${S.variant ?? S.kind}${b ? ':' + b.name : ''}`);
      stats.plans.show = (stats.plans.show || 0) + 1;
      return q.length ? q : null;
    }
    if (mood) add(2.5, 'mood', () => loop(mood[1], here((rn() - .5) * .6), n(2, 4)));
    if (sp.kind === 'bench' && role !== 'meet' && has(NAMES.bench)) add(20, 'bench', () => loop(NAMES.bench, [sp.x, sp.z, sp.ry], 2));
    else if (role === 'deal') {
      if (sp.pace) add(4, 'pace', () => [loop(NAMES.pace, sp.pace, n(1, 2)), loop(NAMES.look, [sp.pace[0], sp.pace[1], st], 1)]);
      add(3, 'look', () => loop(NAMES.look, here((rn() - .5) * .6), n(1, 2)));
      if (sp.lean) add(1.5, 'lean', () => loop(NAMES.lean, sp.lean, n(1, 2)));
      add(1.2, 'smoke', () => loop('smoke', here(), n(1, 3)));
      add(.6, 'drink', () => loop('drink', here(), n(1, 2)));
    } else if (role === 'work') {
      const gather = a.rec?.act === 'gather';
      if (gather) add(4, 'dig', () => loop(rn() < .5 ? 'dig_pick' : 'dig_shovel', here(), n(2, 4)));
      add(2, 'pick', () => [loop('pick_up', here((rn() - .5) * 1.2), 1), loop('pick_up', here((rn() - .5) * 1.2), 1)]);
      add(2, 'carry', () => out(has('carry_box') ? 'carry_box' : null));
      add(gather ? 1 : 3, 'sweep', () => loop('sweep', here(), n(2, 4)));
      add(gather ? 1 : 2.5, 'stock', () => loop('stock_shelf', here(), n(1, 3)));
    } else if (role === 'patrol') {
      add(3, 'beat', () => out(has(NAMES.patrol) ? NAMES.patrol : null));
      add(3, 'look', () => loop(NAMES.look, here((rn() - .5) * 1.2), n(1, 2)));
      add(2, 'post', () => loop('guard_post', here(), 1));
    } else if (role === 'cook') {
      add(4, 'stir', () => loop('cook_stir', here(), n(2, 4)));
      add(2, 'fan', () => loop('cook_fan', here(), n(1, 3)));
      add(1, 'smoke', () => loop('smoke', here(), n(1, 2)));
      add(1, 'look', () => loop(NAMES.look, here((rn() - .5) * .8), 1));
    } else if (role === 'bench') {
      add(3, 'clamp', () => loop('bench_clamp', here(), n(3, 6)));
      add(3, 'file', () => loop('bench_file', here(), n(4, 8)));
      add(2, 'fit', () => loop('bench_fit', here(), n(2, 4)));
      add(2, 'hammer', () => loop('bench_hammer', here(), n(2, 3)));
      add(1, 'assemble', () => loop('bench_assemble', here(), 1));
    } else if (role === 'meet') {
      // (between turns, or before the other one is there: a nod toward the partner, else a look round)
      const o = A?.get(partnerOf(a))?.w, ry = o && a.w ? Math.atan2(o.p[0] - a.w.p[0], o.p[2] - a.w.p[2]) : st;
      // (C1-7: sat at a booth or in a car's doorway, stage/record.js venues: it stays sat between turns)
      if (sp.seat) add(9, 'seat', () => loop(sp.seat, [sp.x, sp.z, sp.ry], 1)); else
      add(3, 'nod', () => loop(NAMES.nod, [sp.x, sp.z, ry], 1));
      if (!sp.seat) add(1, 'look', () => loop(NAMES.look, [sp.x, sp.z, ry], 1));
    } else {
      // hang: the yard, the diner's doorstep, home, a familiar district
      if (sp.sit) add(4, 'stoop', () => loop(NAMES.stoop, sp.sit, n(2, 3)));
      if (sp.lean) add(3.5, 'lean', () => loop(NAMES.lean, sp.lean, n(1, 2)));
      add(2.2, 'look', () => loop(NAMES.look, here((rn() - .5) * .8), 1));
      add(1.4, 'smoke', () => loop('smoke', here(), n(1, 3)));
      add(1.2, 'drink', () => loop('drink', here(), n(1, 2)));
      add(1, 'stroll', () => out());
    }
    if (!opts.length) return null;
    const pool = opts.length > 1 ? opts.filter(o => o[1] !== L.prev) : opts, tot = pool.reduce((s, o) => s + o[0], 0);
    let r = rn() * tot, pick = pool.at(-1); for (const o of pool) { r -= o[0]; if (r <= 0) { pick = o; break; } }
    L.prev = pick[1]; stats.plans[role] = (stats.plans[role] || 0) + 1;
    // (the first picks, for the scenario's seeded check)
    if ((L.trace ||= []).length < 4) L.trace.push(`${role}:${pick[1]}`);
    q.push(...pick[2]);
    return q;
  }
  function partnerOf(a) { const m = meetings.get(a.rec?.meet); return m ? (m.a === a.id ? m.b : m.a) : null; }
  // the sit-down's turns: one shared clock per meeting, so both of the pair agree who talks (the speaker by its seeded turn order)
  function talkOf(a, clock) {
    if (a.rec?.loopRole !== 'meet' || a.rec.meet == null || !a.w || a.mode !== 'stand') return null;
    const cue = meetings.get(a.rec.meet), other = partnerOf(a), o = other && A?.get(other);
    if (!cue || !o?.w || o.mode !== 'stand' || o.rec?.meet !== a.rec.meet) return null;
    if (Math.hypot(a.w.p[0] - o.w.p[0], a.w.p[2] - o.w.p[2]) > 4) return null;
    let M = talks.get(cue.eventId);
    if (!M) talks.set(cue.eventId, M = { k: -1, until: -Infinity, rn: seeded(idHash(`meet|${cue.eventId}`)), speaker: null, v: 0 });
    if (clock >= M.until) {
      M.k++; const swap = M.k === 0 ? M.rn() < .5 : M.rn() < .75;
      M.speaker = M.k === 0 ? (swap ? cue.a : cue.b) : swap ? (M.speaker === cue.a ? cue.b : cue.a) : M.speaker;
      M.until = clock + 5 + 4 * M.rn(); M.v = Math.floor(M.rn() * 3); stats.talks++;
    }
    return { with: other, until: M.until, role: a.id === M.speaker ? 'speak' : 'listen', v: M.v, meet: cue.eventId };
  }
  // C1-9b · the sit-down's turns on the island's clock: from the later of the pair's row starts, one after another (5–9 s each, the
  // speaker by the meeting's seeded order), so both of the pair agree, and a seek lands on the same turn. Together: both standing at
  // the meeting's spots within 4 m (their spots, not where a loop has them)
  const turns = new Map();
  function talkAt(a, T) {
    if (a.rec?.loopRole !== 'meet' || a.rec.meet == null || !a.w || a.mode !== 'stand' || !a.spot) return null;
    const cue = meetings.get(a.rec.meet), other = partnerOf(a), o = other && A?.get(other);
    if (!cue || !o?.w || o.mode !== 'stand' || !o.spot || o.rec?.meet !== a.rec.meet || Math.hypot(a.spot.x - o.spot.x, a.spot.z - o.spot.z) > 4) return null;
    const t0 = Math.max(a.rec.loopAnchor ?? 0, o.rec.loopAnchor ?? 0) * 60; if (T < t0) return null;
    let M = turns.get(cue.eventId); if (!M || M.t0 !== t0) turns.set(cue.eventId, M = { t0, rn: seeded(idHash(`meet|${cue.eventId}`)), list: [] });
    while (!M.list.length || M.list.at(-1).t1 <= T) { const k = M.list.length, prev = M.list.at(-1), swap = k === 0 ? M.rn() < .5 : M.rn() < .75;
      const speaker = k === 0 ? (swap ? cue.a : cue.b) : swap ? (prev.speaker === cue.a ? cue.b : cue.a) : prev.speaker, from = prev ? prev.t1 : t0;
      M.list.push({ speaker, t0: from, t1: from + 5 + 4 * M.rn(), v: Math.floor(M.rn() * 3) }); if (k === 0) stats.talks++; }
    let lo = 0, hi = M.list.length - 1, k = 0; while (lo <= hi) { const mid = (lo + hi) >> 1; if (M.list[mid].t0 <= T) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    const u = M.list[k]; return { with: other, from: u.t0, until: u.t1, role: a.id === u.speaker ? 'speak' : 'listen', v: u.v, meet: cue.eventId };
  }
  return { rand, plan, talkOf, talkAt, range: RANGE, listen: false, bind(m) { A = m; }, stats: () => ({ ...stats, plans: { ...stats.plans }, meetings: talks.size }) };
}
