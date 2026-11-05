// C2 · THE DAY'S ERRANDS, WATCHABLE (GAME.md §41; slime 10-30: "every action the agent preforms, weather cooking, dealing, etc...
// needs to be watchable", "Watch the action live, details a day late"; 10-31: "Who and where show"). Every live act the routine planner
// stages (routines.js planner.day(n).acts: who, kind, counterpart, place, minute, minimum, participants, visit) is played here on the
// agents' own walkers, at the place routines.js put them, for at least the cue's minimum. Node-safe: the drawing (draw.js, through
// withActs) and tools/actcheck.mjs read the same decision. Nothing here decides a game fact or reads event text.
//   who      the walkers are the cue's participants and nobody else: a hand-over (give, pay) is its pair face to face; a call, a
//            message, an order, a stash, a fence or a bribe is its actor alone (a remote counterpart is never drawn as a second
//            figure). The counterpart is named on the actor's tag (stage/act-marks.js), never the words, the item or the reason
//   where    the walker's place is the timeline's (continuity.js, from routines.js): this file only picks the clips and the walker's
//            mark within its spot's reach (loops.js RANGE), so placecheck's checkDrawn holds
//   when     the act's clips are laid out from the cue's minute (the act row's loopAnchor) on the island's clock (life.js stepAt),
//            covering cue.minimum: a function of the cue and the minute, so a seek inside an act stages it as playing there does
//   details  a day late: the props are neutral (a plain parcel for every hand-over, the bribe's envelope with its bills hidden; the
//            phone; the dose's packet, one look for every drug); no tag shows an amount, an item, a drug, a target or a reason
//   home     HOME_ACTS: 'door' until the record viewer draws the rooms (lane C2-indoors), then 'inside' (the act at the room's act spot)
// The clips are the studio's (anim/cast/clips/acts.js, acts.md: lane C2-clips's first pass, 11-01) from stage/acts-clips.md; count_cash
// is never staged live (§19).

import { errandsGeometry } from '../anim/cast/clips/errands-props.js';

// THE SWITCH: 'inside' plays an act at the agent's own home in its room (lane C2-indoors draws it inside: draw.js indoors; the room's
// dress or stash spot, else its clear floor, stage/act-marks.js); 'door' plays it on the doorstep, as before the rooms were drawn. An act
// at another's home (a stash at its keeper's) plays at that door either way: only its owner is drawn inside
export const HOME_ACTS = 'inside';
// (the island seconds a hand-over's pair is given to walk to its marks before the pass, so both begin the pass on one clock)
export const PASS_AT = 6;
// (the walk to a mark: life.js's own pace)
const V = 1.0;

// The kinds, by the set that stages them. The core names each act's kind and place kind (routine-places.js ACT_PLACES); this table
// owns only how it looks
export const ACT_SETS = Object.freeze({
  call: ['tip', 'lookout', 'ask', 'answer', 'decline', 'say', 'close', 'crew_invite', 'attempt'],
  listen: ['listen'],
  message: ['chat', 'write', 'plan', 'orders', 'note', 'creed'],
  order: ['offer', 'shop', 'sell'],
  dress: ['dress'],
  dose: ['take'],
  stash: ['stash_put', 'stash_take'],
  fence: ['fence_list', 'fence_unlist', 'fence_buy', 'fence_swap', 'fence_accept', 'bounty'],
  precinct: ['bribe', 'bail'],
  handover: ['give', 'pay'],
});
export const setOf = kind => Object.keys(ACT_SETS).find(k => ACT_SETS[k].includes(kind)) ?? null;
// The neutral hand-over: bribe_pass / bribe_take's track and timing, its envelope with the bills hidden (a plain parcel). Registered by
// act-marks.js in the page under these names (the clips' own files are the studio's: never edited here)
export const PASS = 'act_pass', TAKE = 'act_take';
export const ALIASES = Object.freeze({ [PASS]: 'bribe_pass', [TAKE]: 'bribe_take' });
// the parcel's colours: kraft paper, the flap a shade darker, the envelope's bills end the paper's own (nothing reads as money)
export const PARCEL = Object.freeze({ paper: 0xb38b5d, flap: 0x8f6b42, bills: 0xb38b5d, billsD: 0x9a774c });
// (into the clip registry the walkers play from, by name: the same entry, its id and so its track, with the parcel for its prop)
// The studio's clips that hold the plain parcel (its kraft envelope, the model act_pass / act_take draw): their prop is the city's
// neutral parcel, so it goes under that id
export const PARCEL_CLIPS = Object.freeze(['parcel_tuck', 'floorboard_lift', 'floorboard_rummage', 'floorboard_close']);
// HELD BACK: change_clothes's garment (a plain grey tee) is neutral, but tools/actcheck.mjs's list of neutral props (phone, the parcel,
// the dose's packet) doesn't know it, and a check's list is slime's to change. Until it does, the city plays the clip without drawing it
export const HELD_BACK = Object.freeze({ change_clothes: 'garment' });
export function registerAliases(reg) {
  if (!reg) return;
  for (const [name, of] of Object.entries(ALIASES)) {
    if (reg[name] || !reg[of]) continue;
    const c = reg[of], p = c.prop;
    reg[name] = { ...c, name, prop: p ? { ...p, id: 'act-parcel', geometry: T => errandsGeometry(T, 'envelope', PARCEL) } : p };
  }
  for (const name of PARCEL_CLIPS) { const c = reg[name]; if (c?.prop && c.prop.id !== 'act-parcel') reg[name] = { ...c, prop: { ...c.prop, id: 'act-parcel', geometry: T => errandsGeometry(T, 'envelope', PARCEL) } }; }
  for (const [name, id] of Object.entries(HELD_BACK)) { const c = reg[name]; if (c?.prop?.id === id) reg[name] = { ...c, prop: undefined }; }
}
// Each set's beats: [clip, loops] in order, the fill repeated until the minimum is covered; `first` plays once at the start, `last` once
// at the end (it starts on a fill's wrap and ends at or past the minimum: the phone down, the floorboard shut).
// face: which way the actor turns ('spot': its spot's own way; 'door': back to its door; 'booth': the Heap's fence booth; 'partner')
export const ACT_STAGING = Object.freeze({
  // (the call: the phone up to the ear, the call held, the phone down at the end: acts-clips.md's phone_up / phone_call / phone_down)
  call: { face: 'spot', first: [['phone_up', 1]], fill: [['phone_call', 1]], last: [['phone_down', 1]] },
  // (listening on the earpiece: the hand at the ear, the head down)
  listen: { face: 'spot', fill: [['earpiece_listen', 1]] },
  // (a message or a note: the phone in both hands, thumbed)
  message: { face: 'spot', fill: [['phone_type', 1]] },
  // (an order or a bid at home: the phone, thumbed)
  order: { face: 'spot', fill: [['phone_type', 1]] },
  // (changing: the top off and the new one on once, then the hands over the clothes)
  dress: { face: 'spot', first: [['change_clothes', 1]], fill: [['pat_pockets', 2], ['deal_lookout', 1]] },
  // (a dose: dose_take once, its neutral packet; then a look round while it lands)
  dose: { face: 'spot', first: [['dose_take', 1]], fill: [['deal_lookout', 1]] },
  // (a stash: crouched at a loose floorboard, pried up, a hand in at the plain parcel, the board back down; the floorboard is the act's
  // own (act-marks.js), its open state neutral: the gap and the plain parcel, nothing else)
  stash: { face: 'door', first: [['floorboard_lift', 1]], fill: [['floorboard_rummage', 1]], last: [['floorboard_close', 1]], floor: true },
  // (at the fence's booth: the parcel over, then haggling at a counter: act-marks.js draws the stand-in counter while it plays)
  fence: { face: 'spot', first: [[PASS, 1]], fill: [['haggle_counter', 1]] },
  // (at the precinct: the envelope at the desk's side, then a look round)
  precinct: { face: 'spot', first: [[PASS, 1]], fill: [['deal_lookout', 1]] },
  // (the pair: both walk up face to face, the parcel passes on one clock, the taker tucks it away, then they talk it over; count_cash
  // never plays live: it tells "cash" and "how much", §19)
  handover: { face: 'partner', pair: true, first: [[PASS, 1]], partnerFirst: [[TAKE, 1], ['parcel_tuck', 1]], fill: [['talk_gesture', 1]], partnerFill: [['listen_nod', 1]] },
});
// every clip a set may play (the check's "staged": the walker plays one of these inside its act)
export const clipsOf = (set, partner = false) => { const S = ACT_STAGING[set]; if (!S) return [];
  return [...new Set([...(partner ? S.partnerFirst ?? [] : S.first ?? []), ...(partner ? S.partnerFill ?? S.fill : S.fill), ...(S.last ?? [])].map(([c]) => c))]; };
// The Heap's fence booth (districts/junkyard.js fenceBooth(ctx, -22.4, -199.6, 0): 12.2 m along x, 2.4 m deep, its service window and
// shelf on its +z side, x -24.5 … -20.3): a fence act stands at the shelf, facing the window (-z). Three marks side by side, by the act's
// slot. In the district's own (today's) frame: the drawing moves it into the spread city (world/city.js remap, stage/record.js)
export const FENCE_BOOTH = Object.freeze({ x: -22.4, z: -196.9, ry: Math.PI, step: 1.2 });

// ── the cues by agent: each participant's acts, in minute order (blocked ones are never staged: routines.js leaves them unplaced)
export function actIndex(routines, days) {
  const by = new Map(), all = [];
  for (const d of days) for (const c of routines.day(d).acts ?? []) {
    if (c.blocked || !setOf(c.kind)) continue;
    all.push(c);
    for (const id of c.participants ?? [c.agent]) (by.get(id) || by.set(id, []).get(id)).push(c);
  }
  for (const list of by.values()) list.sort((a, b) => a.minute - b.minute || a.eventId - b.eventId);
  all.sort((a, b) => a.minute - b.minute || a.eventId - b.eventId);
  return { by, all };
}
// the act agent id is in at island minute m, or null: [cue.minute, cue.minute + cue.minimum)
export function actAt(index, id, m) {
  const list = index.by.get(id); if (!list) return null;
  let lo = 0, hi = list.length - 1, k = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (list[mid].minute <= m) { k = mid; lo = mid + 1; } else hi = mid - 1; }
  for (let i = k; i >= 0 && i > k - 4; i--) { const c = list[i]; if (m < c.minute + c.minimum) return c; }
  return null;
}
// the act whose row this is: its event id (rec.errand), else its kind and its start, the row's loopAnchor (routines.js puts each
// participant's act row at cue.minute)
export function actOfRow(index, id, rec) {
  if (!rec || !setOf(rec.act)) return null;
  const list = index.by.get(id); if (!list) return null;
  // (the row's own cue, draw.js rowOf: rec.errand / rec.live; the row's kind and start for a row without them)
  if (rec.errand != null) return list.find(c => c.eventId === rec.errand) ?? null;
  return list.find(c => c.kind === rec.act && Math.abs(c.minute - (rec.loopAnchor ?? -1)) < 1e-6) ?? null;
}
export const roleOf = (cue, id) => cue.agent === id ? 'lead' : 'partner';
export const partnerOf = (cue, id) => (cue.participants ?? []).find(p => p !== id) ?? null;

// ── the plan: the act's steps (life.js's plan language), laid out from the plan's own state G (life.js plot/grow: G.end, G.x, G.z, G.ry)
// so that its first clip starts at the cue's minute (a pair's pass at PASS_AT, both on one clock) and the clips cover the minimum
//   spot: the walker's spot { x, z, ry, st, ax?, az? }; other: the partner's spot (a pair); range: loops.js RANGE
export function actSteps({ cue, id, G, spot, other = null, door = null, range = 1.2, has = () => true, dur = () => 1, settle = .45 }) {
  const set = setOf(cue.kind), S = ACT_STAGING[set]; if (!S) return null;
  const partner = roleOf(cue, id) === 'partner', T0 = cue.minute * 60, T1 = (cue.minute + cue.minimum) * 60, q = [];
  const ax = spot.ax ?? spot.x, az = spot.az ?? spot.z, clamp = (x, z) => { const dx = x - ax, dz = z - az, d = Math.hypot(dx, dz); return d <= range - .02 ? [x, z] : [ax + dx / d * (range - .02), az + dz / d * (range - .02)]; };
  let mark = [spot.x, spot.z], face = spot.st ?? spot.ry ?? 0;
  if (S.pair && other) {
    // (face to face across the middle of their two spots, the pass's gap apart: 1.02 m, bribe_pass's pair)
    const ox = other.x, oz = other.z, mx = (spot.x + ox) / 2, mz = (spot.z + oz) / 2, d = Math.hypot(ox - spot.x, oz - spot.z) || 1, ux = (ox - spot.x) / d, uz = (oz - spot.z) / d;
    mark = clamp(mx - ux * .51, mz - uz * .51); face = Math.atan2(ox - mark[0], oz - mark[1]);
  } else if (S.face === 'door' && door) face = Math.atan2(door[0] - spot.x, door[1] - spot.z);
  let t = G.end;
  // (from before the row's start: wait for it, facing its way)
  if (T0 - t > 1e-6) { q.push({ k: 'idle', secs: T0 - t, ry: G.ry }); t = T0; }
  const d = Math.hypot(mark[0] - G.x, mark[1] - G.z);
  if (d > .03) { q.push({ k: 'go', to: mark, v: V }); t += d / V; }
  // (a pair: both stand facing until the pass, on one clock; one alone starts at once)
  const start = S.pair ? Math.max(t, T0 + PASS_AT) : t;
  q.push({ k: 'idle', secs: Math.max(.05, start - t), ry: face }); t = Math.max(t + .05, start);
  const loop = (clip, n) => ({ k: 'loop', clip, at: [mark[0], mark[1], face], n });
  for (const [clip, n] of (partner ? S.partnerFirst ?? S.first : S.first) ?? []) if (has(clip)) { q.push(loop(clip, n)); t += dur(clip) * n; }
  const fill = (partner ? S.partnerFill ?? S.fill : S.fill).filter(([c]) => has(c)), last = (S.last ?? []).filter(([c]) => has(c)), dl = last.reduce((a, [c, n]) => a + dur(c) * n, 0);
  // (whole fills until the last beats would end past the minimum, then the last beats: they start on a fill's wrap, so the chain is exact)
  for (let k = 0; fill.length && t + dl < T1 && k < 400; k++) { const [clip, n] = fill[k % fill.length]; q.push(loop(clip, n)); t += dur(clip) * n; }
  for (const [clip, n] of last) { q.push(loop(clip, n)); t += dur(clip) * n; }
  return { steps: q, mark, face, until: t + settle, set, role: partner ? 'partner' : 'lead' };
}

// ── the hook (draw.js): the loops' plan with the acts first. A walker whose row is an act row plays the act's steps; past the act's
// minimum (or any other row) the loops' own plan, unchanged. Also records who stages which act (figures), for the marks and the check
const REGISTRY = new WeakMap();
// the acts behind a walker map (stage/record.js reaches the hook's acts this way: draw.js passes it nothing new)
export const actsFor = map => REGISTRY.get(map) ?? null;
export function withActs(loops, { routines, days, layer = null, indoors = null }) {
  const index = actIndex(routines, days), figures = new Map();
  let A = null;
  const doorOf = (id, rec) => { const lot = rec?.at?.startsWith?.('home:') ? rec.at.slice(5) : null, h = lot ? layer?.homeAt?.(lot) : null; return h?.door ? [h.door[0], h.door[2]] : null; };
  function plan(a, L, H) {
    if (H.REG?.CLIP && (!H.REG.CLIP[PASS] || H.REG.CLIP.parcel_tuck?.prop?.id === 'parcel')) registerAliases(H.REG.CLIP);
    const cue = actOfRow(index, a.id, a.rec), now = H.now;
    if (cue && a.spot && now !== null && now < cue.minute + cue.minimum) {
      const other = cue.participants?.length > 1 ? A?.get(partnerOf(cue, a.id))?.spot ?? null : null;
      const has = c => !!H.REG?.CLIP?.[c] || H.has(c), dur = c => H.REG?.CLIP?.[c]?.dur ?? 1;
      const p = actSteps({ cue, id: a.id, G: L, spot: a.spot, other, door: doorOf(a.id, a.rec), range: loops.range ?? 1.2, has, dur, settle: H.LIFE?.settle ?? .45 });
      if (p?.steps.length) { figures.set(a.id, { eventId: cue.eventId, kind: cue.kind, set: p.set, role: p.role, from: cue.minute, to: cue.minute + cue.minimum, mark: p.mark });
        (L.trace ||= []).length < 4 && L.trace.push(`act:${cue.kind}`); return p.steps; }
    }
    return loops.plan(a, L, H);
  }
  const acts = { index, figures, actAt: (id, m) => actAt(index, id, m), indoors, get map() { return A; } };
  return { ...loops, plan, bind(m) { A = m; loops.bind(m); REGISTRY.set(m, acts); }, acts };
}
