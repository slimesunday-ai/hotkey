// AI City · C2-indoors (2026-10-31) · A RECORD HOME'S ROOM, WALKED. slime (GAME.md §41, 10-30): "if the agent goes into a house, we
// should watch them enter the house, then be inside the house with the agent"; 10-31: "One room is fine as long as there is variety".
// From a home's layout and its lot's frame alone (nothing built, no three), so its agent is drawn inside the same way whether or not
// the room is open on screen, and a seek gives the picture playing gives:
//   lotEntry(id, l, block)   a lot anchor → the home's frame (centre, heading, width, depth, floor): index.js's, moved here
//   homePlan(h, A, door)     the room's frame in the lot as index.js builds it (room.js: the layout against the back and right walls, the
//                            side room of a wide house), its walking grid (the homes check's own solids, the side room's pieces and its
//                            partition, every floor slot), the activity spots (life.js spotsOf: the bed, the stove, a seat, the table,
//                            the fridge …), the way in (the agent's own spot on the step → the city's door → the doorway → a free node
//                            inside) and ACT: the clear patch of floor where a daytime errand at home (dress, stash) plays
//   stayOf(plan, o)          one stay at home on the island's clock (seconds): handed over at tIn (its arrival) where its trip ended,
//                            onto its step and in, the hour's activity, a walk between activities when the hour changes
//   exitAt(stay, tx)         out from wherever it is at tx (a departure or a scene already published), onto its step
//   poseAt(stay, T)          → { x, y, z, yaw, v, clip, clipT, door (0 shut … 1 open), inside } at island second T: a pure function
// Units: metres; room space as room.js (origin the floor's back-left corner, +x across, +z toward the street); island seconds.
import * as HO from '../home/index.js';
import { makeRules, C4 } from '../home/rules.js';
import { sideRoom } from './room.js';
import { lotEntry, homeSeed } from './frame.js';
export { lotEntry, homeSeed };
import { spotsOf, gridCells, snap, astar, nodeXZ } from './spots.js';

const RULES = makeRules(HO);
// a layout fits a lot when the room it builds stays inside the house's walls
export const fits = (h, A) => A.room.w * C4 <= h.fw + .01 && A.room.d * C4 <= h.fd + .01;

// ── the room's frame in the lot: exactly index.js build()'s (a lot's room stands inside its walls' band)
export const BAND = .28;
export function roomFrame(h, A) {
  const band = h.kind === 'lot' ? BAND : 0, SW = h.fw - 2 * band, SD = h.fd - band, Wr = A.room.w * C4, Dr = A.room.d * C4, W = Math.max(SW, Wr), D = Math.max(SD, Dr), ox = W - Wr;
  const over = W > SW + .01 || D > SD + .01, zo = over ? 0 : band / 2, xa = [Math.cos(h.th), -Math.sin(h.th)], za = [Math.sin(h.th), Math.cos(h.th)];
  const o = [h.cx - xa[0] * W / 2 + za[0] * (zo - D / 2), h.floorY, h.cz - xa[1] * W / 2 + za[1] * (zo - D / 2)];
  const toWorld = (x, z) => [o[0] + xa[0] * x + za[0] * z, o[2] + xa[1] * x + za[1] * z];
  const toRoom = (X, Z) => { const dx = X - o[0], dz = Z - o[2]; return [dx * xa[0] + dz * xa[1], dx * za[0] + dz * za[1]]; };
  return { W, D, ox, Wr, Dr, SW, SD, over, zo, band, origin: o, th: h.th, xa, za, toWorld, toRoom };
}

// ── the plan. door: the lot anchor's { door: [x, y, z] (the stoop, 0.55 m in front of the wall), face: [fx, fz] }
export function homePlan(h, A, door) {
  const F = roomFrame(h, A), seed = homeSeed(h.id), RW0 = A.room.w, RD0 = A.room.d;
  const SR = sideRoom(A, { tier: h.tier, seed, scars: [], bare: false }, F.D, F.ox);
  // the grid over the whole room: the layout's cells shifted right by k cells (x0, the sliver left of the first cell, is not walked)
  const k = Math.floor(F.ox / C4 + 1e-6), x0 = F.ox - k * C4, RW = k + RW0, RD = Math.max(RD0, Math.floor(F.D / C4 + 1e-6));
  const blocked = new Uint8Array(RW * RD), built = new Uint8Array(RW * RD), set = (x, z, b) => { if (x >= 0 && z >= 0 && x < RW && z < RD) { blocked[x + z * RW] = 1; if (b) built[x + z * RW] = 1; } };
  const g = RULES.geometry(A);
  for (const p of g.solid) for (const [x, z, over] of p.cells) if (!over) set(k + x, z, p.built);
  for (const q of g.floorSlots) for (let x = q.rc[0]; x < q.rc[0] + q.rc[2]; x++) for (let z = q.rc[1]; z < q.rc[1] + q.rc[3]; z++) set(k + x, z, false);   // (every floor slot, filled or not: the way never changes with what is in it)
  const rectM = (X0, Z0, X1, Z1, b) => { for (let x = Math.floor((X0 - x0) / C4 + 1e-6); x < Math.ceil((X1 - x0) / C4 - 1e-6); x++) for (let z = Math.floor(Z0 / C4 + 1e-6); z < Math.ceil(Z1 / C4 - 1e-6); z++) set(x, z, b); };
  const sideItems = [];
  if (SR) { rectM(SR.px - .05, 0, F.ox + .05, SR.gap[0], true); rectM(SR.px - .05, SR.gap[1], F.ox + .05, F.D, true);
    for (const q of SR.pieces) { const o = HO.byId.get(q.id), [w, d] = (q.r & 1) ? [o.foot[1] * C4, o.foot[0] * C4] : [o.foot[0] * C4, o.foot[1] * C4]; rectM(q.X, q.Z, q.X + w, q.Z + d, false);
      sideItems.push({ id: q.id, x: (q.X - F.ox) / C4, z: q.Z / C4, rot: q.r * 90, on: 'floor' }); } }
  const G = gridCells(RW, RD, blocked, built);
  // grid metres ⇄ room metres
  const gx = x => x - x0, rx = x => x + x0, node = kk => { const [x, z] = nodeXZ(kk, RW); return [rx(x), z]; };
  // ── the activity spots (life.js spotsOf, on the layout and the side room's pieces; no fills: the same spots whatever a slot holds)
  const raw = spotsOf({ ...A, items: [...A.items, ...sideItems] }, null, { W: F.W, ox: F.ox }), spots = [];
  for (const sp of raw) { const to = sp.seat ? [sp.seat.x, sp.seat.z] : sp.face, own = sp.own ? [gx(sp.own[0]), sp.own[1], gx(sp.own[2]), sp.own[3]] : null;
    // (as life.js plans its resident: the spot's own point, then its alternatives; a wider look round the bed last)
    const see = { to: [gx(to[0]), to[1]], own, any: !!(sp.seat || sp.bed) };
    let n = snap(G, gx(sp.at[0]), sp.at[1], sp.pose === 'lie' ? .45 : .7, G.main, see);
    for (const a of sp.alt ?? []) { if (n >= 0) break; n = snap(G, gx(a[0]), a[1], .45, G.main, see); }
    for (const a of [sp.at, ...(sp.alt ?? [])]) { if (n >= 0) break; n = snap(G, gx(a[0]), a[1], 1.1, G.main, see); }
    if (n < 0) continue;
    spots.push({ ...sp, node: n, stand: node(n) }); }
  // ── the way in: the agent's own spot (given per stay) → the stoop (the anchor's door) → the doorway (the room's front at the door) →
  // the first free node behind it
  const yF = h.floorY, d = door?.door ?? null, f = door?.face ?? [Math.sin(h.th), Math.cos(h.th)];
  const stoop = d ? [d[0], d[2]] : F.toWorld(F.W / 2, F.D + .55), [sx, sz] = F.toRoom(stoop[0], stoop[1]), dxr = Math.max(.3, Math.min(F.W - .3, sx));
  const sill = F.toWorld(dxr, F.D - .02);
  let inN = snap(G, gx(dxr), F.D - .65, 1.2, G.main); if (inN < 0) inN = snap(G, gx(dxr), F.D - 1, 2.5, G.main);
  const inside = inN >= 0 ? node(inN) : [dxr, F.D - .6];
  // (just inside the door, 2–3 m in: where a home errand with no time to reach the room plays, slime 10-31 on C2-acts' options)
  let nearN = snap(G, gx(dxr), F.D - 2.5, 1, G.main); if (nearN < 0) nearN = snap(G, gx(dxr), F.D - 2, 1.5, G.main); if (nearN < 0) nearN = inN;
  const near = nearN >= 0 ? node(nearN) : inside;
  // ── ACT: the clear patch of floor nearest the room's middle (the most free nodes round it), where an errand at home plays (dress, stash)
  let act = null, best = -1e9;
  for (let kk = 0; kk < G.free.length; kk++) { if (!G.free[kk] || G.comp[kk] !== G.main) continue; let n = 0; const x = kk % RW, z = (kk / RW) | 0;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const X = x + a, Z = z + b; if (X >= 0 && Z >= 0 && X < RW && Z < RD && G.free[X + Z * RW]) n++; }
    const [px, pz] = node(kk), v = n - .6 * Math.hypot(px - F.W / 2, pz - F.D * .55); if (v > best) { best = v; act = { node: kk, x: px, z: pz, clear: n }; } }
  const ACTS = ['sleep', 'cook', 'eat', 'tv', 'chill', 'game', 'fridge', 'read', 'admire', 'trophy', 'dress', 'stash', 'wash'];
  const byAct = new Map(); for (const a of ACTS) { const L = spots.filter(s => s.act === a); if (L.length) byAct.set(a, L.sort((p, q) => p.key < q.key ? -1 : 1)); }
  // a way between two room points (A* on the grid, string-pulled), else the straight line
  const ways = new Map();
  function way(a, b) { const na = typeof a === 'number' ? a : snap(G, gx(a[0]), a[1], 1.5, G.main), nb = typeof b === 'number' ? b : snap(G, gx(b[0]), b[1], 1.5, G.main), key = na + '>' + nb;
    if (ways.has(key)) return ways.get(key); let p = na >= 0 && nb >= 0 ? astar(G, na, nb) : null; p = p ? p.map(([x, z]) => [rx(x), z]) : null; ways.set(key, p); return p; }
  const w3 = (x, z, y = yF) => { const [X, Z] = F.toWorld(x, z); return [X, y, Z]; };
  return { h, F, A, SR, G, x0, k, spots, byAct, act: act && { ...act, world: w3(act.x, act.z), ry: F.th }, door: { stoop, sill, face: f, inside, inN, near, nearN, dx: dxr, y: d ? d[1] : .2 }, way, w3, yF, seed };
}

// ── the hour at home: what an agent at home does (asleep at night; the stove, the table, a seat or the free floor by day). Seeded by the
// agent, so neighbours never change activity on the same minute; deterministic in (agent, island minute)
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function activityAt(plan, agent, minute) {
  const off = (hashS(agent) % 41) - 20, m = (((minute + off) % 1440) + 1440) % 1440, has = a => plan.byAct.has(a), day = Math.floor((minute + off) / 1440);
  const pick = (...L) => L.find(has) ?? 'idle';
  if (m >= 23 * 60 || m < 6 * 60 + 30) return pick('sleep', 'chill', 'tv');
  if (m < 8 * 60) return pick('cook', 'fridge', 'eat');
  if (m < 9 * 60) return pick('eat', 'chill');
  if (m >= 17 * 60 && m < 18 * 60 + 30) return pick('cook', 'fridge');
  if (m >= 18 * 60 + 30 && m < 19 * 60 + 30) return pick('eat', 'chill');
  if (m >= 19 * 60 + 30) return pick('tv', 'game', 'chill');
  // the day: an hour each, from what the room has
  const opts = ['chill', 'tv', 'idle', 'read', 'admire', 'fridge', 'eat'].filter(a => a === 'idle' || has(a)), hr = Math.floor(m / 60);
  return opts[hashS(agent + '|' + day + '|' + hr) % opts.length];
}
// an activity's spot and pose: { stand (room [x, z] where it walks to), at (room [x, z] where it ends), y, yaw, clip }
export const CLIPS = { lie: 'sleep', sit: 'sit_bench', work: 'cook_stir' }, BED_IN = [.3, 0];
function spotPose(plan, act, agent) {
  if (act === 'idle' || !plan.byAct.has(act)) { const a = plan.act; return a ? { act: 'idle', stand: [a.x, a.z], at: [a.x, a.z], y: plan.yF, yaw: plan.F.th, clip: null, node: a.node } : null; }
  const L = plan.byAct.get(act), sp = L[hashS(agent + act) % L.length], F = plan.F;
  const face = sp.face ? Math.atan2(...dirW(F, sp.face[0] - sp.stand[0], sp.face[1] - sp.stand[1])) : F.th;
  // (sleep, the studio's (anim/cast/clips/acts.js): on the back under its duvet, the walker's ground point on the mattress at the
  // sleeper's feet, facing the bed's foot, the body lying back along the bed to the pillow, 1.7 m; the feet set in by BED_IN along the
  // bed from its foot spot, on its middle line)
  if (sp.bed) { const b = sp.bed.yaw, [fx, fz] = [Math.sin(b), Math.cos(b)], cl = (v, hi) => Math.max(.2, Math.min(hi - .2, v));
    const at = [cl(sp.bed.x + fx * BED_IN[0] + fz * BED_IN[1], F.W), cl(sp.bed.z + fz * BED_IN[0] - fx * BED_IN[1], F.D)];
    return { act, stand: sp.stand, at, y: plan.yF + sp.bed.y - .12, yaw: F.th + b, clip: CLIPS.lie, node: sp.node, bed: true }; }
  if (sp.seat) return { act, stand: sp.stand, at: [sp.seat.x, sp.seat.z], y: plan.yF + Math.max(0, sp.seat.y - .42), yaw: F.th + sp.seat.yaw, clip: CLIPS.sit, node: sp.node };
  return { act, stand: sp.stand, at: sp.stand, y: plan.yF, yaw: face, clip: sp.pose === 'work' && act === 'cook' ? CLIPS.work : null, node: sp.node };
}
// a room direction → a world direction ([dx, dz] for atan2(dx, dz): yaw 0 faces +z)
function dirW(F, dx, dz) { return [F.xa[0] * dx + F.za[0] * dz, F.xa[1] * dx + F.za[1] * dz]; }

// ── one stay (C2-indoors2: a pure function of what is published at the presented minute, so a seek gives the picture playing gives
// and no later frame changes it): handed over at `from` (world [x, y, z]: where its trip ended, else its step) at tIn (island seconds:
// its arrival, or the end of a scene of the show), it walks to its step `spot` (world [x, y, z]), through the door, to what the hour
// has it doing, and on through the hours (three days at most). It stays in until something already published takes it out: exitAt.
export const WALK = 1.1, DOOR = { r: 1.9, ease: .7 };
// lead: (playing) where its walker really is when its trip ends, its trip drawn a little off its booked end: it walks from there to its
// step in the time a seek takes from the trip's end (no faster than VMAX: later by as much), and from its step on it is the same stay
export const VMAX = 2.6;
// acts: the home errands it plays in this stay (stage/acts.js cues: { t0, t1 (island s), set, cue }): from its start, it walks to the act's
// spot in the room (the dress or stash spot, else the clear floor) and plays it there until its minimum is over (stage/act-marks.js
// plays its clips), then on to what the hour has it doing. One it could not reach the room for within PASS_AT s of its start (arrived
// for it) plays just inside the door (plan.door.near), at its real time, the walk there taken from its start (slime 10-31)
export const PASS_AT = 6, ERRAND_WALK = 2;
export function stayOf(plan, { agent, from, spot = from, tIn, lead = null, acts = [] }) {
  const F = plan.F, D = plan.door, out = { plan, agent, from, spot, tIn, legs: [], exit: null };
  const roomPts = pts => pts.map(([x, z]) => plan.w3(x, z));
  // the way in, outside → the first node inside (world points): where it was handed over, its step, the stoop, the doorway, inside
  const doorIn = [from, spot, [D.stoop[0], D.y ?? spot[1], D.stoop[1]], plan.w3(...F.toRoom(...D.sill)), plan.w3(...D.inside)];
  out.doorOut = doorIn.slice(1, 4).reverse(); out.inAt = lenOf(doorIn);
  const toward = (a, b) => { const p = plan.way(a.node ?? a.stand, b.node ?? b.stand); return p ? roomPts(p) : roomPts([a.stand, b.stand]); };
  const withEnd = (P, pose) => sat(pose) ? [...P, plan.w3(pose.at[0], pose.at[1], pose.y)] : P;
  const insidePose = { stand: D.inside, at: D.inside, node: D.inN >= 0 ? D.inN : undefined }; out.insidePose = insidePose; out.toward = toward;
  // the hours' activities over the stay (a change on each minute the activity changes)
  const m0 = tIn / 60, sched = [];
  let a = activityAt(plan, agent, m0); sched.push({ t: tIn, act: a });
  for (let m = Math.floor(m0) + 1, mEnd = m0 + 3 * 1440; m < mEnd; m++) { const b = activityAt(plan, agent, m); if (b !== a) { sched.push({ t: m * 60, act: b }); a = b; } }
  let pose = spotPose(plan, sched[0].act, agent);
  const entry = pose ? withEnd([...doorIn, ...toward(insidePose, pose).slice(1)], pose) : doorIn;
  const leg = (t0, P, hold, v = WALK) => { const L = lenOf(P); return { t0, t1: t0 + L / v, P, L, hold, v }; };
  const e0 = leg(tIn, entry, pose);
  if (lead) { const D0 = Math.hypot(spot[0] - from[0], spot[2] - from[2]) / WALK, d = Math.hypot(spot[0] - lead[0], spot[2] - lead[2]), Dl = Math.max(D0, d / VMAX); e0.lead = { p: lead, D0, Dl, v: Dl > 0 ? d / Dl : 0 }; e0.t1 += Dl - D0; }
  out.legs.push(e0);
  if (!pose) return out;
  out.entryIn = doorIn.slice(1);
  // the hours and the acts in time order (an hour's change during an act waits for its end)
  const evs = [...sched.slice(1).map(e => ({ t: e.t, act: e.act })), ...acts.filter(a => a.t0 >= tIn - 1).map(a => ({ t: Math.max(a.t0, tIn), errand: a }))].sort((a, b) => a.t - b.t);
  let want = pose, busy = -Infinity, back = null;
  for (const ev of evs) {
    if (ev.act) { const next = spotPose(plan, ev.act, agent); if (!next) continue; want = next;
      // (the hour changed during an act: the walk back after it goes to the new hour's spot)
      if (ev.t < busy) { const B = withEnd([...toward(back.from, next)], next), L2 = lenOf(B); Object.assign(back.leg, { P: B, L: L2, t1: back.leg.t0 + L2 / WALK, hold: next }); pose = next; continue; }
      const P = [...(sat(pose) ? [plan.w3(pose.at[0], pose.at[1], pose.y)] : []), ...toward(pose, next)];
      out.legs.push(leg(Math.max(ev.t, out.legs.at(-1).t1), withEnd(P, next), next)); pose = next; continue; }
    const E = ev.errand, t = Math.max(ev.t, out.legs.at(-1).t0 + 1e-6), room = errandPose(plan, E.set), nearP = { stand: D.near, at: D.near, node: D.nearN >= 0 ? D.nearN : undefined };
    // (the room's spot, walked to briskly (ERRAND_WALK), when it is in or can be there within PASS_AT s of the act's start; else, still
    // on its way in for it, just inside the door)
    const toRoom = room && wayFrom(out, t, room), entryDone = out.legs[0].t1 <= t, fits = toRoom && (entryDone || t + lenOf(toRoom) / ERRAND_WALK <= E.t0 + PASS_AT);
    const target = fits ? room : nearP, P = fits ? toRoom : wayFrom(out, t, nearP), yaw = fits ? room.yaw : Math.atan2(...dirW(plan.F, 0, -1));
    const l = leg(t, P, { ...target, act: 'errand', y: plan.yF, yaw, clip: null, cue: E.cue, set: E.set, tight: !fits }, ERRAND_WALK); out.legs.push(l);
    const Te = Math.max(E.t1, l.t1); busy = Te;
    // (then on to what the hour has it doing)
    const B = [...toward(target, want)], rl = leg(Te, withEnd(B, want), want); out.legs.push(rl); back = { leg: rl, from: target }; pose = want; }
  return out;
}
const lenOf = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][2] - P[i - 1][2]); return L; };
const sat = pose => pose.at[0] !== pose.stand[0] || pose.at[1] !== pose.stand[1];
// the room's spot for a home errand: the dress or stash spot for those, else the clear floor (plan.act), standing
const ERRAND_SPOT = { dress: 'dress', stash: 'stash' };
function errandPose(plan, set) {
  const k = ERRAND_SPOT[set], L = k ? plan.byAct.get(k) : null;
  if (L?.length) { const sp = L[0], face = sp.face ? Math.atan2(...dirW(plan.F, sp.face[0] - sp.stand[0], sp.face[1] - sp.stand[1])) : plan.F.th; return { stand: sp.stand, at: sp.stand, node: sp.node, yaw: face }; }
  const a = plan.act; return a ? { stand: [a.x, a.z], at: [a.x, a.z], node: a.node, yaw: a.ry } : null;
}
// a way (world points) from where the stay has it at island second T to room pose `to`: on through the door first while it is still on
// its way in; across the room from where it walks or stands
function wayFrom(stay, T, to) {
  const plan = stay.plan, L = stay.legs; let i = -1; for (let j = 0; j < L.length; j++) if (L[j].t0 <= T) i = j;
  const across = (P, a) => { const r = plan.F.toRoom(P[0], P[2]), w = plan.way(r, to.node ?? to.stand); return [P, ...(w ? w.map(([x, z]) => plan.w3(x, z)) : [plan.w3(...to.stand)])]; };
  if (i < 0) return [stay.from, ...stay.entryIn, ...stay.toward(stay.insidePose, to).slice(1)];
  const l = L[i];
  if (T < l.t1) { const o = onLeg(stay, l, T), P = [o.p[0], o.p[1], o.p[2]];
    if (i === 0 && (o.s === null || o.s < stay.inAt)) { const fwd = [P]; let c = 0;
      for (let k = 1; k < l.P.length && k <= 4; k++) { c += Math.hypot(l.P[k][0] - l.P[k - 1][0], l.P[k][2] - l.P[k - 1][2]); if (o.s === null ? k >= 1 : c > o.s) fwd.push(l.P[k]); }
      return [...fwd, ...stay.toward(stay.insidePose, to).slice(1)]; }
    return across(P, o); }
  const e = l.P[l.P.length - 1], h = l.hold;
  if (!h) return across(e);
  return [...(sat(h) ? [plan.w3(h.at[0], h.at[1], h.y)] : [e]), ...stay.toward(h, to)];
}
// where along leg l at island second T (it is moving): [x, y, z, yaw | null], its speed, and how far along l.P (null on a lead stretch)
function onLeg(stay, l, T) {
  const k = l.lead, t = T - l.t0;
  if (k && t < k.Dl) { const f = k.Dl > 0 ? t / k.Dl : 1, a = k.p, b = stay.spot, mv = Math.hypot(b[0] - a[0], b[2] - a[2]) > 1e-6;
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, mv ? Math.atan2(b[0] - a[0], b[2] - a[2]) : null], v: k.v, s: null }; }
  const v = l.v ?? WALK, s = (k ? t - k.Dl + k.D0 : t) * v; return { p: along(l.P, s), v, s };
}
// ── the way out from wherever the stay has it at island second tx (world points, ending on its step): back along the way in while it
// is still outside or in the doorway; else across the room (from its seat or bed to where it stands first) to the first node inside,
// the doorway, the stoop, its step
export function exitPath(stay, tx) {
  const plan = stay.plan, L = stay.legs; let i = -1; for (let j = 0; j < L.length; j++) if (L[j].t0 <= tx) i = j;
  if (i < 0) return [stay.from, stay.spot];
  const l = L[i];
  if (tx < l.t1) { const o = onLeg(stay, l, tx), s = o.s, p = o.p, P = [p[0], p[1], p[2]];
    // (still walking up to its step from where its trip ended: back onto its step)
    if (s === null) return [P, stay.spot];
    // (still on its way in, short of the first node inside: back the way it came, the points it passed, as far back as its step)
    if (i === 0 && s < stay.inAt) { const back = []; let c = 0;
      for (let k = 1; k < l.P.length; k++) { c += Math.hypot(l.P[k][0] - l.P[k - 1][0], l.P[k][2] - l.P[k - 1][2]); if (c >= s) break; back.push(l.P[k]); }
      return [P, ...back.reverse(), ...(back.length ? [] : [stay.spot])]; }
    const r = plan.F.toRoom(P[0], P[2]), way = plan.way(r, stay.insidePose.node ?? stay.insidePose.stand);
    return [P, ...(way ? way.map(([x, z]) => plan.w3(x, z)) : [plan.w3(...stay.insidePose.stand)]), ...stay.doorOut]; }
  const e = l.P[l.P.length - 1], pose = l.hold;
  if (!pose) return [e, ...stay.doorOut];
  return [...(sat(pose) ? [plan.w3(pose.at[0], pose.at[1], pose.y)] : [e]), ...stay.toward(pose, stay.insidePose), ...stay.doorOut];
}
// the stay's exit, starting at island second tx (something published by then: the departure of its next trip, or a scene of the show
// it is in): it walks out at WALK and stands on its step after
export function exitAt(stay, tx) {
  if (!Number.isFinite(tx)) { stay.exit = null; return null; }
  if (stay.exit?.t0 === tx) return stay.exit;
  const P = exitPath(stay, tx), L = lenOf(P); stay.exit = { t0: tx, t1: tx + L / WALK, P, L }; return stay.exit;
}
// where along a polyline at distance s → [x, y, z, yaw]
function along(P, s) { for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (s <= L || i === P.length - 1) { const t = L > 1e-9 ? Math.max(0, Math.min(1, s / L)) : 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, L > 1e-9 ? Math.atan2(b[0] - a[0], b[2] - a[2]) : null]; }
    s -= L; }
  const e = P[P.length - 1]; return [e[0], e[1], e[2], null]; }
const LOOP = { sleep: 4, lie_still: 2, sit_bench: 8, cook_stir: 3.6 };
// (C2-indoors2: one clock for a seek and for playing: the stay starts at its hand-over, the trip's end, either way; no catch-up)
export function poseAt(stay, T) {
  const yaw0 = stay.plan.F.th + Math.PI, out = o => ({ ...o, door: doorOf(stay, o), inside: insideAt(stay, [o.x, o.y, o.z]) });
  const X = stay.exit;
  if (X && T >= X.t0) { if (T < X.t1) { const p = along(X.P, (T - X.t0) * WALK); return out({ x: p[0], y: p[1], z: p[2], yaw: p[3] ?? yaw0, v: WALK, clip: null, clipT: 0, out: true }); }
    const e = X.P[X.P.length - 1]; return out({ x: e[0], y: e[1], z: e[2], yaw: yawEnd(X.P) ?? yaw0, v: 0, clip: null, clipT: 0, out: true }); }
  const L = stay.legs; let i = -1; for (let j = 0; j < L.length; j++) if (L[j].t0 <= T) i = j;
  if (i < 0) { const f = stay.from; return out({ x: f[0], y: f[1], z: f[2], yaw: yaw0, v: 0, clip: null, clipT: 0 }); }
  const l = L[i];
  if (T < l.t1) { const o = onLeg(stay, l, T), p = o.p; return out({ x: p[0], y: p[1], z: p[2], yaw: p[3] ?? yaw0, v: o.v, clip: null, clipT: 0 }); }
  const e = l.P[l.P.length - 1];
  if (!l.hold) return out({ x: e[0], y: e[1], z: e[2], yaw: yawEnd(l.P) ?? yaw0, v: 0, clip: null, clipT: 0 });
  const c = l.hold.clip; return out({ x: e[0], y: l.hold.y ?? e[1], z: e[2], yaw: l.hold.yaw, v: 0, clip: c, clipT: c ? T % (LOOP[c] ?? 4) : 0, act: l.hold.act,
    ...(l.hold.cue ? { cue: l.hold.cue, cueFrom: l.t1, tight: !!l.hold.tight } : {}) });
}
const yawEnd = P => { for (let i = P.length - 1; i > 0; i--) { const a = P[i - 1], b = P[i]; if (Math.hypot(b[0] - a[0], b[2] - a[2]) > 1e-6) return Math.atan2(b[0] - a[0], b[2] - a[2]); } return null; };
// the door: open while the agent walks through it (within DOOR.r m of the doorway, eased over DOOR.ease m), else shut
function doorOf(stay, o) { if (!o.v) return 0; const s = stay.plan.door.sill, d = Math.hypot(o.x - s[0], o.z - s[1]); return Math.max(0, Math.min(1, (DOOR.r - d) / DOOR.ease)); }
// inside: behind the house's front wall, within its walls (the lot's frame)
export function insideOf(plan, x, z) { const h = plan.h, c = Math.cos(h.th), s = Math.sin(h.th), dx = x - h.cx, dz = z - h.cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < h.fw / 2 - .05 && lz < h.fd / 2 - .05 && lz > -h.fd / 2 + .05; }
const insideAt = (stay, p) => insideOf(stay.plan, p[0], p[2]);
