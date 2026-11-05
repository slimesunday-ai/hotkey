// C2 · THE CAST PLAN (docs/redesign/stage-20261031.md, design A): who stands in each show scene, and where. Node-safe, as continuity.js
// is: a pure function of the night's plan (show-plan.js), the record up to the night's frame, the measured stand spots (stands.json) and
// the stage's ground (an injected height map and lane test; none in node). Nothing here reads page state: which walkers exist yet, which
// spot agents.js found free, the order of a seek's re-placement, frame counts or the crowd. A seek and a play read the same plan.
//   figures    each scene's figures in slot order: { id, key, role, look, mark }. id: a roster agent drawn as itself (a fight's public
//              target; a masked agent in its own fight or prowl, continuity.js maskedCast: show.masked[id].fight, typed facts only); null:
//              an anonymous stand-in, keyed by the scene's hash and its slot (key), never by an agent id
//   marks      each figure's mark {x, z, ry}: on the scene's ground round its anchor, ROOM clear of every other figure of every scene on
//              at once, and of every measured stand spot of the place (any agent may stand on one; the plan never asks which), except
//              the spot it gives a cast agent. The crowd is no input: it gives way to the figures (pedsim yields), never the reverse
//   purity     a night's plan reads only frames up to and including its own night frame (tools/castcheck.mjs: the same plan from a
//              record cut there; same inputs, same output), and is read only from that frame's publication (published, revealAt): at an
//              earlier minute there is no plan. A plan built while the injected ground had no map (the renderer not up yet) is not kept:
//              the next ask builds it again, so it never freezes ground sampled before there was any
import { fightsAt } from './placement.js';
import { maskedCast } from './continuity.js';
import { HOUSE_LOTS, CITY_PLACES, DISTRICTS } from './places.js';
import { idHash } from './addresses.js';
import { revealAt } from './player.js';
import { departureOf } from './back-plan.js';

export const ROOM = 1.3, LANE = 1.35;

// a night's fight rows, as stage/record.js fightsOf reads them: the night frame's typed events over the board before it
export function fightRows(frames, n) {
  const i = frames.findIndex(f => f.step.kind === 'night' && f.day === n); if (i < 0) return new Map();
  const f = frames[i]; let board = null; for (let k = 0; k < i; k++) if (frames[k].board !== undefined) board = frames[k].board;
  const show = f.events.find(e => e.type === 'show' && e.night === n); if (!show) return new Map();
  const snap = { board, events: [show, ...f.events.filter(e => ['fight', 'arrest'].includes(e.type) && e.night === n)], minute: Math.max(f.minute, n * 1440 + 1265), day: n, frame: null, reveal: { night: n } };
  return new Map(fightsAt(snap, n).map(r => [r.eventId, { ...r, won: f.events.find(e => e.id === r.eventId)?.won === true }]));
}

// ground: { occ(x, z, half) → { at(x, z) } | null, laneNear(x, z, r) → { d } | null, door(lot) → { door: [x, y, z], face: [fx, fz] } | null }
export function createCastPlan({ frames, planner, book, stands, ground = null }) {
  const nights = new Map(), G = ground ?? {};
  const spotsAt = id => (stands?.places?.[id]?.spots ?? []).filter(s => !s.over);
  // the scene's anchor: a lot's doorstep, else a measured stand spot of its place by the scene's hash, else the place
  function anchorOf(place, salt) {
    if (place.lot) { const h = G.door?.(place.cityPlace), lot = HOUSE_LOTS.find(l => l.id === place.cityPlace);
      if (h?.door) return { x: h.door[0] + h.face[0] * 1.6, z: h.door[2] + h.face[1] * 1.6, ry: Math.atan2(-h.face[0], -h.face[1]), door: h };
      return { x: lot?.x ?? 0, z: lot?.z ?? 0, ry: 0 }; }
    const at = place.standPlace ?? place.cityPlace, list = spotsAt(at), sp = list[idHash(String(salt)) % Math.max(1, list.length)] ?? CITY_PLACES[at] ?? CITY_PLACES[place.cityPlace];
    return { x: sp.x, z: sp.z, ry: sp.ry ?? 0 }; }
  // n marks round a: rings from near to far (or the given radii), the anchor's facing first; ROOM clear of `taken` (every figure of the
  // night's other scenes on at once, and this scene's own) and of the place's measured stand spots; on the anchor's floor, off the lanes
  function marksFor(a, n, at, taken, { near = 0, far = 5, rings = null, lane = LANE, centre = false } = {}) {
    const R = rings ? Math.max(...rings) : far, out = [], spots = spotsAt(at);
    let O = null; try { O = G.occ?.(a.x, a.z, R + 1.5) ?? null; } catch { O = null; }
    if (G.occ && !O) building.noGround = true;
    const y0 = O ? floorOf(O, a, R + 1) : null;
    const floor = (x, z) => !O || y0 === null || [[0, 0], [.35, 0], [-.35, 0], [0, .35], [0, -.35]].every(([ox, oz]) => { const h = O.at(x + ox, z + oz); return h !== null && Math.abs(h - y0) < .12; });
    const offLane = (x, z) => !G.laneNear || !((G.laneNear(x, z, lane)?.d ?? 99) < lane);
    const roomAt = (x, z) => { let d = 99;
      for (const s of spots) if (!(centre && Math.hypot(s.x - a.x, s.z - a.z) < .3)) d = Math.min(d, Math.hypot(s.x - x, s.z - z));
      for (const m of taken) if (!(centre && Math.hypot(m.x - a.x, m.z - a.z) < .3)) d = Math.min(d, Math.hypot(m.x - x, m.z - z));
      for (const m of out) d = Math.min(d, Math.hypot(m.x - x, m.z - z)); return d; };
    const cands = [];
    for (const r of rings ?? Array.from({ length: Math.round((far - near) / .5) + 1 }, (_, k) => near + k * .5)) {
      const steps = r < .1 ? 1 : Math.max(6, Math.ceil(2 * Math.PI * r / .9));
      for (let k = 0; k < steps; k++) { const ang = (a.ry ?? 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2 * Math.PI / steps; cands.push({ x: a.x + Math.sin(ang) * r, z: a.z + Math.cos(ang) * r }); } }
    const ok = cands.filter(q => floor(q.x, q.z) && offLane(q.x, q.z));
    for (let k = 0; k < n; k++) {
      let pick = ok.find(q => roomAt(q.x, q.z) >= ROOM), short = false;
      if (!pick) { short = true; let bd = -1; for (const q of ok.length ? ok : cands) { const d = roomAt(q.x, q.z); if (d > bd) { bd = d; pick = q; } } }
      if (!pick) break; out.push({ x: +pick.x.toFixed(3), z: +pick.z.toFixed(3), short }); }
    return out;
  }
  // the grab's set piece (stage/record.js grabSet): the crate on free ground of the quay, its lead on the lift's spot 0.48 m short of
  // it and, when the grab is won, the rival 1.45 m on facing him; the rest of the crew and the officers round the crate; the public
  // grabbers as themselves round it too. Crew: two at least when won (the tug's pair), one else; officers only when lost
  function grabPlan(P, sc, f, at, taken) {
    const a = anchorOf(f, f.eventId), won = f.won, M = marksFor({ ...a, ry: a.ry ?? 0 }, 6, at, taken, { near: 0, far: 7 });
    const q0 = M[0] ?? a, ry = a.ry ?? 0, dx = Math.sin(ry), dz = Math.cos(ry), c0 = { x: q0.x, z: q0.z, ry };
    const W = { x: c0.x - dx * .48, z: c0.z - dz * .48, ry }, Lr = { x: W.x + dx * 1.45, z: W.z + dz * 1.45, ry: ry + Math.PI };
    const named = sc.publicActors.filter(id => book[id]), total = f.sides.reduce((n, s) => n + s.count, 0), nCrew = Math.max(won ? 2 : 1, total - named.length);
    const nCops = won ? 0 : Math.max(1, f.cops || 0);
    const set = [c0, W, Lr, { x: Lr.x + dx * 1.2, z: Lr.z + dz * 1.2 }];
    const others = marksFor(c0, Math.max(0, nCrew - 2) + nCops + named.length, at, [...taken, ...set], { near: 1.7, far: 6 });
    const face = o => ({ x: o.x, z: o.z, ry: Math.atan2(c0.x - o.x, c0.z - o.z), short: o.short });
    P.anchor = c0; P.set = { crate: c0, W, Lr };
    for (let k = 0; k < nCrew; k++) { const side = k % Math.max(1, f.sides.length), m = k === 0 ? W : k === 1 && won ? Lr : face(others.shift() ?? c0);
      P.figures.push({ id: null, key: 'c' + k, role: k === 0 ? 'lead' : k === 1 && won ? 'rival' : 'crew', side, look: f.sides[side]?.hooded ? 'hooded' : 'crew:' + (k % 4), mark: m }); }
    for (let k = 0; k < nCops; k++) P.figures.push({ id: null, key: 'k' + k, role: 'cop', look: 'officer', mark: face(others.shift() ?? c0) });
    for (const id of named) P.figures.push({ id, key: null, role: 'grabber', look: null, mark: face(others.shift() ?? c0) });
  }
  const building = { noGround: false };
  // the minute night n's plan is published: its night frame's reveal (null: no such night)
  // (C2-seek: looked up once, when the plan is made, as the drawing's timeline is: a later night's frame is never scanned again to learn
  // that tonight's isn't out yet — tools/standcheck.mjs causal)
  const pubs = new Map(); for (const f of frames) if (f.step.kind === 'night' && !pubs.has(f.day)) pubs.set(f.day, revealAt(f));
  const published = n => pubs.has(n) ? pubs.get(n) : null;
  function night(n) {
    if (nights.has(n)) return nights.get(n); building.noGround = false;
    const frame = frames.find(f => f.step.kind === 'night' && f.day === n); if (!frame) return null;
    const plan = planner.night(n), cast = maskedCast(frame, plan, book, DISTRICTS), rows = fightRows(frames, n), out = new Map();
    const castOf = sc => cast.byScene.get(sc.id) ?? [];
    // (the marks of the scenes on at once: each scene keeps ROOM from the figures of every scene before it in the running order whose
    // window overlaps its own — fights, arrests and lay low stay on to the close)
    const onTill = sc => sc.beat === 'fight' || sc.beat === 'arrest' || sc.kind === 'laylow' ? plan.end : sc.end;
    const takenFor = sc => [...out.values()].filter(P => P.start < sc.end && onTill(P.sc) > sc.start).flatMap(P => P.figures.map(f => f.mark).filter(Boolean));
    for (const sc of plan.scenes) {
      const at = sc.place.standPlace ?? sc.place.cityPlace, P = { sc, id: sc.id, kind: sc.kind, beat: sc.beat, start: sc.start, end: sc.end, key: sc.place.lot ? 'home:' + sc.place.cityPlace : at, figures: [], anchor: null, short: 0 };
      if (sc.kind === 'hooded' && sc.beat === 'ambient') {
        // a prowl: the district's hooded count, its cast in the first slots, a stand-in for the rest; each between two marks of its own
        const a = anchorOf(sc.place, sc.id), c = castOf(sc), M = marksFor(a, sc.hoodedCount, at, takenFor(sc), { near: 1.5, far: 6 });
        P.anchor = a;
        for (let k = 0; k < sc.hoodedCount; k++) { const m = M[k] ?? { x: a.x, z: a.z, short: true };
          P.figures.push({ id: c[k] ?? null, key: c[k] ? null : String(k), role: 'prowl', look: 'hooded', mark: { x: m.x, z: m.z, ry: Math.atan2(a.x - m.x, a.z - m.z), short: m.short } }); }
        // (each creeps between its mark and a second one 1.5–4 m off it, clear of every other mark)
        for (const g of P.figures) { const [m2] = marksFor({ ...g.mark, ry: g.mark.ry }, 1, at, [...takenFor(sc), ...P.figures.filter(h => h !== g).flatMap(h => [h.mark, h.mark2].filter(Boolean))], { near: 1.5, far: 4 });
          g.mark2 = m2 && !m2.short ? { x: m2.x, z: m2.z } : { x: g.mark.x, z: g.mark.z }; }
      } else if (sc.beat === 'fight') {
        const f = rows.get(sc.eventId); if (!f) { out.set(sc.id, P); continue; }
        if (f.kind === 'grab' && sc.beats?.length) { grabPlan(P, sc, f, at, takenFor(sc)); out.set(sc.id, P); continue; }
        // a public target (not a break-in's, indoors) is drawn as itself, standing at the fight's anchor; its attackers round it
        // (slime, 10-31, GAME.md §41: a hooded attacker who is also its own fight's target is drawn in that fight "As the hooded target":
        // show.masked[target].fight is this fight, so it stands as the target, as itself in its hood, never in an attacker's slot)
        const maskedTarget = !!f.target && cast.masked?.[f.target]?.fight === f.eventId;
        const tgt = f.target && (sc.publicActors.includes(f.target) || maskedTarget) && f.kind !== 'breakin' ? f.target : null;
        let a = anchorOf(f, f.eventId); P.anchor = a;
        const want = f.sides.map(s => s.count - s.ids.length), total = want.reduce((x, y) => x + y, 0);
        const taken = takenFor(sc);
        let M = [];
        if (f.kind === 'breakin') M = [];
        else if (tgt) { const [t0] = marksFor(a, 1, at, taken, { near: 0, far: 3, lane: 1.8 }); if (t0) a = P.anchor = { ...a, x: t0.x, z: t0.z };
          P.figures.push({ id: tgt, key: null, role: 'target', look: null, mark: { x: a.x, z: a.z, ry: a.ry } });
          M = marksFor(a, total, at, [...taken, { x: a.x, z: a.z }], { rings: [1.15, 1.6, 2.1, 2.6], lane: 1.8, centre: true }); }
        else { M = marksFor(a, total, at, taken, { near: .7, far: 6, lane: 1.8 });
          if (M.length) { const cx = M.reduce((x, m) => x + m.x, 0) / M.length, cz = M.reduce((x, m) => x + m.z, 0) / M.length, ax = Math.sin(a.ry), az = Math.cos(a.ry);
            M.sort((p, q) => ((p.x - cx) * ax + (p.z - cz) * az) - ((q.x - cx) * ax + (q.z - cz) * az)); a = P.anchor = { ...a, x: cx, z: cz }; } }
        const fan = (g, r0) => { const r = g ? 2 : r0, ang = a.ry + (g ? (g - 1 - (total - 2) / 2) * .9 : 0); return { x: a.x + Math.sin(ang) * r, z: a.z + Math.cos(ang) * r, ry: a.ry }; };
        const cs = f.kind === 'hit' || f.kind === 'breakin' ? castOf(sc).filter(id => id !== f.target) : [];
        const look = f.kind === 'collar' ? 'officer' : 'hooded';
        let used = 0;
        f.sides.forEach((s, i) => { for (let k = 0; k < want[i]; k++) {
          const g = f.kind === 'breakin' ? used : 0, m = f.kind === 'breakin' ? fan(g, .62) : (q => ({ x: q.x, z: q.z, ry: Math.atan2(a.x - q.x, a.z - q.z) }))(M[used] ?? a); used++;
          const id = s.hooded && cs.length ? cs.shift() : null;
          P.figures.push({ id, key: id ? null : `${i}:${k}`, role: 'side' + i, side: i, g, look: f.kind === 'corner' && !s.hooded ? 'crew:' + (k % 4) : look, mark: { x: +m.x.toFixed(3), z: +m.z.toFixed(3), ry: m.ry } }); } });
      }
      P.short = P.figures.filter(f => f.mark?.short).length;
      out.set(sc.id, P);
    }
    // THE PLAYERS' OWN SPOTS: each agent with a named play tonight (an ambient scene's agent, at a place with measured stand spots)
    // stands on one spot of its play's place for the whole show, the same on a seek and on play: in order of its first play's start (then
    // id), the lowest of the place's spots no earlier one has (a dealer's pace strip and a patrol's beat first, never a bench); none when
    // the place has run out. → spots: Map(place → Map(id → spot index in the place's list))
    const spots = new Map(), firsts = new Map(), from = new Map();
    for (const sc of plan.scenes) { if (sc.beat !== 'ambient' || sc.kind === 'hooded' || sc.publicActors.length !== 1 || sc.place.lot) continue;
      const id = sc.publicActors[0], at = sc.place.standPlace ?? sc.place.cityPlace; if (!spotsAt(at).length) continue;
      const k = `${at}|${id}`; if (!firsts.has(k)) firsts.set(k, { at, id, start: sc.start, kind: sc.kind, from: plan.start }); }
    // (and every agent the plan draws as itself in a fight, a grab or a prowl at a place with stand spots: its own spot there from its
    // scene's end to the close, so it walks back to it after, the same on a seek and on play. Before its scene it claims as it arrives:
    // a spot planned from the show's start made a late arrival walk the lanes round to it, 20 m off when its prowl began, seed 404 n10)
    for (const P of out.values()) for (const g of P.figures) { if (!g.id || P.sc.place.lot || !spotsAt(P.key).length) continue;
      const k = `${P.key}|${g.id}`; if (!firsts.has(k)) firsts.set(k, { at: P.key, id: g.id, start: P.start, kind: P.kind, from: P.end }); }
    // (a play with a partner — a stick-up's clerk, a mugging's drunk, a camper, a deal's buyer — takes the first spot whose partner's
    // ring has clear ground, else the first spot)
    const sorted = [...firsts.values()].sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const firstScene = new Map(); for (const sc of plan.scenes) if (sc.beat === 'ambient' && sc.kind !== 'hooded' && sc.publicActors.length === 1) { const k = `${sc.place.standPlace ?? sc.place.cityPlace}|${sc.publicActors[0]}`; if (!firstScene.has(k)) firstScene.set(k, sc); }
    for (const r of sorted) {
      const list = stands?.places?.[r.at]?.spots ?? [], have = spots.get(r.at) ?? spots.set(r.at, new Map()).get(r.at), used = new Set(have.values());
      const cands = []; list.forEach((sp, k) => { if (sp.over || used.has(k) || sp.kind === 'bench') return;
        cands.push([k - (r.kind === 'deal' && sp.pace ? 4 : 0) - (r.kind === 'patrol' && sp.beat ? 4 : 0), k]); });
      cands.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const want = partnerOf(firstScene.get(`${r.at}|${r.id}`));
      let best = cands[0]?.[1] ?? null;
      if (want) for (const [, k] of cands) { const others = [...have.values()].map(j => list[j]); if (partnerMark(list[k], want, r.at, others, [])) { best = k; break; } }
      if (best !== null) { have.set(r.id, best); from.set(`${r.at}|${r.id}`, r.from); } }
    // (each such play's partner, a stand-in on its ring round the player's spot: a figure of the plan's)
    for (const sc of plan.scenes) { const want = partnerOf(sc); if (!want) continue; const at = sc.place.standPlace ?? sc.place.cityPlace, k = spots.get(at)?.get(sc.publicActors[0]);
      const P = out.get(sc.id); if (k == null || !P) continue; const list = stands.places[at].spots, sp = list[k];
      const q = partnerMark(sp, want, at, [...spots.get(at).values()].filter(j => j !== k).map(j => list[j]), takenFor(sc).filter(m => !P.figures.some(f => f.mark === m)));
      P.spot = { x: sp.x, z: sp.z, ry: sp.st ?? sp.ry ?? 0 };
      if (q) P.figures.push({ id: null, key: 'p', role: 'partner', look: want.look, mark: { x: q.x, z: q.z, ry: Math.atan2(sp.x - q.x, sp.z - q.z) } }); }
    // (from: the minute each own spot holds from — the show's start for a player, its scene's end for a figure)
    const N = { night: n, plan, cast, scenes: out, spots, from, ready: !building.noGround }; if (!building.noGround) nights.set(n, N); return N;
  }
  // a named play's partner: its distance from the agent, its look, and whether it stands at the agent's +x hand (a deal's buyer, out of
  // its pace strip) rather than in front of it (stage/record.js MAKERS.ambient)
  function partnerOf(sc) { if (!sc || sc.beat !== 'ambient' || sc.kind === 'hooded' || sc.publicActors.length !== 1 || sc.place.lot) return null;
    const k = sc.variant ? `hustle:${sc.variant}` : sc.kind;
    return k === 'hustle:stickup' ? { d: 2.2, look: 'civ' } : k === 'hustle:mugging' || k === 'hustle:campers' ? { d: 1.15, look: 'civ' } : k === 'deal' ? { d: 1.02, look: 'civ', side: true } : null; }
  // its mark round the agent's spot sp: ROOM clear of the other players' spots there and of `taken`; a side partner only at the agent's
  // side, never in front of or behind it. null: no clear ground (the place can't hold the pair)
  function partnerMark(sp, want, at, others, taken) { const ry = sp.st ?? sp.ry ?? 0, a = { x: sp.x, z: sp.z, ry: want.side ? ry + Math.PI / 2 : ry };
    const [q] = marksFor(a, 1, '\u0000', [...others.map(o => ({ x: o.x, z: o.z })), ...taken], { rings: [want.d], centre: true });
    if (!q || q.short) return null; if (want.side && Math.abs(Math.cos(Math.atan2(q.x - sp.x, q.z - sp.z) - ry)) > .5) return null; return q; }
  // the scene's plan, by the scene
  const scene = sc => night(sc.night)?.scenes.get(sc.id) ?? null;
  // every planned mark on at minute m (its scene's window: a fight, an arrest and lay low to the close), for the claims and the loops to
  // keep off: the same at a minute however the page got there
  function marksAt(m) { const n = Math.floor(m / 1440), at = published(n), N = at !== null && m >= at ? night(n) : null; if (!N) return [];
    const out = []; for (const P of N.scenes.values()) if (m >= P.start && m < (P.beat === 'fight' || P.beat === 'arrest' || P.kind === 'laylow' ? N.plan.end : P.end)) for (const f of P.figures) if (f.mark) out.push(f.mark);
    return out; }
  // a mark at distance d round a (a named play's partner: the ring [d], in front of a first), clear of the place's other stand spots
  // and of every planned mark of the scenes on with sc; null when that ring has no clear ground (the place can't hold the pair)
  function ringMark(sc, a, d) { const N = night(sc.night); if (!N) return null; const at = sc.place.standPlace ?? sc.place.cityPlace;
    const taken = [...N.scenes.values()].filter(P => P.id !== sc.id && P.start < sc.end && (P.beat === 'fight' || P.beat === 'arrest' || P.kind === 'laylow' ? N.plan.end : P.end) > sc.start).flatMap(P => P.figures.map(f => f.mark).filter(Boolean));
    const [q] = marksFor(a, 1, at, taken, { rings: [d], centre: true }); return q && !q.short ? { x: q.x, z: q.z } : null; }
  return { night, scene, marksAt, ringMark, published };
}

function floorOf(O, a, r) { const Hm = new Map(); let best = null, bn = 0;
  for (let x = -r; x <= r; x += .5) for (let z = -r; z <= r; z += .5) { const h = O.at(a.x + x, a.z + z); if (h === null) continue; const k = Math.round(h * 20), n = (Hm.get(k) || 0) + 1; Hm.set(k, n); if (n > bn) { bn = n; best = k / 20; } }
  return best; }

// C2-seek · WHAT THE CAST PLAN SAYS OF THE STAND SPOTS AT MINUTE m (moved from stage/record.js, which reads it at the playhead; the stand
// plan, stand-plan.js, reads it at any minute and gets the answer playing there gets). Each is a function of the plan and the minute:
//   keptAt(sp, id, m)       'reserved' when the plan gives the spot to another player of tonight's show from now on; true when a planned
//                           mark on at m stands in its room (ROOM from it, or across its step from the lane); else false
//   planSpotAt(id, place, m) the spot the plan gives this agent here now: its mark in a fight or a prowl (a spot object of its own, `plan`),
//                           or its own measured spot for tonight's show; null: none
//   planBounds(n)           every minute of night n at which either may change its answer
// spotsOf(place) → the place's spot list as the drawing has it (stands.json widened, a home's doorstep spots); timing: the stage's
// TARGET_GO / SET_GO (s), read when first needed
export function createStandInputs({ cplan, spotsOf, side = .2, targetGo = () => 3, setGo = () => 5.5, room = ROOM, stepW = .8 }) {
  const segD = (x, z, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1, k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)); return Math.hypot(a.x + dx * k - x, a.z + dz * k - z); };
  // (a spot's walks: the step from its lane, a cop's or a worker's beat, a dealer's pace strip — stands.js)
  const walksOf = sp => [...(sp.entry ? [sp.entry] : []), ...(sp.beat || []).map(([x, z]) => ({ x, z })), ...(sp.pace ? [{ x: sp.pace[0], z: sp.pace[1] }] : [])];
  const pathD = (x, z, sp) => { let d = Math.hypot(sp.x - x, sp.z - z) + room - stepW; for (const q of walksOf(sp)) d = Math.min(d, segD(x, z, q, sp)); return d; };
  const atL = new Map();
  const planMarks = m => { const n = Math.floor(m / 1440), at = cplan.published(n), N = at !== null && m >= at ? cplan.night(n) : null, old = atL.get(m); if (old?.N === N) return old.L; let L = []; try { L = cplan.marksAt(m); } catch {} atL.set(m, { N, L }); if (atL.size > 64) atL.delete(atL.keys().next().value); return L; };
  const nearMark = (L, sp) => { for (const m of L) if (Math.hypot(m.x - sp.x, m.z - sp.z) < room || pathD(m.x, m.z, sp) < stepW) return true; return false; };
  // (a night's plan only from its frame's publication, published(n): before it the record has no tonight)
  const tonight = m => { const n = Math.floor(m / 1440), at = cplan.published(n); return at !== null && m >= at ? n : null; };
  const nightOf = n => { try { return cplan.night(n); } catch { return null; } };
  const showOf = m => { const n = tonight(m); if (n === null) return null; const N = nightOf(n); return N && m >= N.plan.start && m < N.plan.end ? N : null; };
  // (a spot the plan gives a player of tonight's show for the whole show is kept for it: 'reserved', agents.js steps anyone else off it)
  const holderOf = (sp, m) => { if (sp?.k == null || typeof sp.k !== 'number') return null; const N = showOf(m); if (!N) return null; const have = N.spots.get(sp.place); if (!have) return null; for (const [id, k] of have) if (k === sp.k && m >= (N.from.get(`${sp.place}|${id}`) ?? N.plan.start)) return id; return null; };
  const keptAt = (sp, id, m) => { const h = holderOf(sp, m); if (h && h !== id) return 'reserved'; return nearMark(planMarks(m), sp); };
  // (a figure of the plan's stands on its planned mark from its scene's start until it is out of it, on game time: a prowl's 60%, a
  // fight's payoff; a target until it is let go, a public grabber until the set clears)
  const untilOf = (P, g) => g.role === 'target' ? P.end + targetGo() / 60 : g.role === 'grabber' ? P.end + setGo() / 60 : departureOf(P, g);
  const planSpots = new WeakMap();
  function planSpotAt(id, place, m) { const n = tonight(m); if (n === null) return null; const N = nightOf(n); if (!N) return null;
    // (a break-in's crew waits on its marks at the door from the show's start: on the house's own spots it left its owner no room to come
    // home to on play, while a seek put the crew on its marks and the owner on the spot, seed 404 night 5)
    for (const P of N.scenes.values()) { if (m < (P.kind === 'breakin' ? N.plan.start : P.start) || P.key !== place) continue;
      const g = P.figures.find(g => g.id === id); if (!g?.mark) continue;
      if (m >= untilOf(P, g)) continue;
      if (!planSpots.has(g)) { const list = spotsOf(place) ?? [], near = list.filter(s => s.entry).reduce((b, s) => !b || Math.hypot(s.x - g.mark.x, s.z - g.mark.z) < Math.hypot(b.x - g.mark.x, b.z - g.mark.z) ? s : b, null);
        planSpots.set(g, { x: g.mark.x, z: g.mark.z, y: near?.y ?? side, ry: g.mark.ry ?? 0, st: g.mark.ry ?? 0, k: 'plan:' + P.id, place, taken: null, kind: 'open', plan: true, entry: near?.entry, ax: g.mark.x, az: g.mark.z }); }
      return planSpots.get(g); }
    // (a player of tonight's show: its own spot of its play's place for the whole show, cast-plan.js spots)
    if (m >= N.plan.start && m < N.plan.end && m >= (N.from.get(`${place}|${id}`) ?? N.plan.start)) { const k = N.spots.get(place)?.get(id); if (k != null) { const sp = spotsOf(place)?.[k]; if (sp) return sp; } }
    return null; }
  // (the minutes: its publication, the show's start and end, each planned figure's window, each own spot's hold, each scene's marks)
  const bounds = new WeakMap();
  function planBounds(n) { const at = cplan.published(n); if (at === null) return []; const N = nightOf(n); if (!N) return [at]; if (bounds.has(N)) return bounds.get(N);
    const out = new Set([at, N.plan.start, N.plan.end]);
    for (const P of N.scenes.values()) { out.add(P.start); out.add(P.end); if (P.kind === 'breakin') out.add(N.plan.start); out.add(P.beat === 'fight' || P.beat === 'arrest' || P.kind === 'laylow' ? N.plan.end : P.end);
      for (const g of P.figures) if (g.id && g.mark) out.add(untilOf(P, g)); }
    for (const v of N.from.values()) out.add(v);
    const L = [...out].filter(Number.isFinite).sort((a, b) => a - b); bounds.set(N, L); return L; }
  return { keptAt, planSpotAt, planBounds, planMarks, nearMark };
}
