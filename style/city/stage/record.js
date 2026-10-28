// C1-6, the drawn half · THE 9:05 SHOW ON THE RECORD PATH (GAME.md §20: "Each night at 9:05 p.m. the city stages every play"). The
// running order is show-plan.js's: scenes {id, kind, variant?, beat, place, start, end, publicActors, hoodedCount}. This file stages
// each scene at its place, inside its window, by its kind; it decides no game fact and reads no event text.
//   ambient   a named play: the agent's own walker plays it at its place (loops.js SHOW_LOOPS, picked by draw.js inside the window);
//             here only what it needs round it: the clerk held up at the 24/7 Store, the drunk mugged outside the club, the camper
//             in the woods, the buyer of a brush pass, crates on the dock, the bench at home, the lab light in a cook's windows (a
//             shack in the woods for a lab), the cruiser parked on a patrol's beat; lay low draws the curtains and puts the lights out
//             (the agent steps in at its door and stays in until the show closes)
//   hooded    the anonymous remainder of a district's attackers (show.hooded less the fights' hooded sides): prowlers in one generic
//             look, creeping about the district's spots, gone on foot at the scene's end. Never named, never in an agent's own look
//   fight     hit (the lunge, punches, the haymaker; the target staggers or cowers), break-in (the lock pick at the door, the creep
//             in, the torch in the window), grab (the crate on the dock, shoves), collar (officers square up, the scuffle). The OUTCOME
//             plays only once the scene pays off (its end: the fight's public result reaches the store then); the hooded go on foot at
//             once (run_getaway with the haul, flee_run without), the other stand-ins 4 s later (a won grab's lead with the crate), so
//             none is still in view when the show closes and the next one starts; the scene itself stays on until the close
//   arrest    a cruiser at the kerb, the arrested steps to clear ground and the officer (the arresting Cop's own walker when it is
//             there, else an officer stand-in) walks up behind it and cuffs (cuff_apply); the arrested stands cuffed (cuffed_idle)
//             until the close, when the jail takes them and the cruiser goes with its officer in it
//   ground    every figure stands on free ground (freeGround below): no two big heads meet, nobody stands in a bystander
//   results   the closing beat: the board (show-plan.js holds it until here)
// C1-7, night 14 and day 15 (SHOW.md "Finale and day 15"):
//   walk      a named walker is its own: draw.js walks it on foot from its home in Pleasantview to the row's place on its route (the
//             city's own trip, cut to the arrival at the arrive beat), where it arrives with everything it owns (loops.js
//             SHOW_LOOPS.walk); an unnamed one (absent from show.seen) is a hooded stand-in walking the lanes in from the Pleasantview
//             side, never from an address, standing on free ground for the arrive beat and gone on foot at the scene's end
//   ferry     the SECOND CHANCE, live (second-chance.js): alongside the quay with her gangway down from day 14's dawn, sailing out past her
//             bay mark in the leave beat (draw.js poses her), waved off by a dockhand at the empty berth
//   board     C1-7d · the boarding line (below): the queue on the quay's edge, up the gangway with everything it owns, below in her cabin
//             until she leaves, when placement's departed takes the walker; an unseen boarder a hooded stand-in
//   missed    at the empty berth looking after her, or where it stands on Iron Island; then placement sends it home (or keeps it in jail)
//   arrest    a dock arrest on night 14 is taken aside to the quay's edge past her stern, out of the finale's crowd and the line
//   mint      day 15's dawn, a three-minute tail (planner.stagingAt): one blank card of light per typed mint receipt rising off the
//             quay in turn, its contents never drawn (the cards are C1-10's)
// C1-7, the new sets (SHOW.md "C1-7: new-set data": each set's beats, in island minutes; the clip groups' notes say what the city stages):
//   build     the Gunrunner's bench (bench-props.js) with the vise ported from slime's crafter game (setprops.js) and the lamp lit; the
//             agent plays each beat's loop (loops.js BEAT_LOOPS: clamp, hammer, file, fit, assemble) and every hammer strike sparks off the
//             anvil (bench_hammer's strikes, setfx.js)
//   cook      the cook's bench and burner, its pot, paddle, bottle and vial posed by the playing cook clip (cook-props.js partMatrices;
//             at rest between clips); the lab light in the windows at home and steam off the pot; in the woods the shack, a bare bulb
//             and thick steam out of its roof and door
//   run       by its drop: the woods' dug earth, the buried package that comes up at the unearth beat, dust at each strike; the docks'
//             container with its doors open, a box lifted off its stack; the heap to search at the Mall (bags) and the Heap (scrap)
//   vault     Precinct 9's vault door in its wall. The public jobbers, unhooded, keep the street door (lookout_wave); the crew's other
//             members are unhooded stand-ins, never named. shove: vault_shove ⇄ guard_bowled for each guard (the guard's own walker when
//             it is a public guard, else the precinct's officer), the guard down (shove_fall → lie_hurt); drill: vault_drill at the
//             drill spot, its sparks and the flicker on the door; heave: vault_heave at the heave spot, the door swung by the clip's
//             own door.open(t); carry: every stand-in out of the open vault with a sack (loot_carry), so no carrier is singled out.
//             A lost job: the shove squares up and the struggle is a scuffle, then the crew stands cuffed (no season measured one: the
//             losing frame is constructed, tmp/c17c-lost-vault)
//   venue     the day's sit-downs, by the meeting's venue (routines.js meetings, routine-places.js): a booth by the diner, the two sat
//             facing over its table; the garage's roof (SKYLOT), the two up there on its deck; a parked car by the park, one sat in its
//             open doorway and one at the door. The pair talks there as before (life.js: turn by turn, sat at a seat). venue(cue) gives
//             draw.js the pair's two spots (its own place key, 'venue:<event id>'); a seat is the booth's or the car's, by its slot of the
//             day (the k-th sit-down of the day at that venue, three of each side by side)
//   grab      the crate on the quay as grab.md's set piece; the scramble round it; tug: crate_tug ⇄ crate_tug_lose (two stand-ins,
//             the winner the lead); ram: the loser back for it, crate_ram ⇄ crate_rammed, down he goes; carry: crate_run off the docks.
//             The sides stay anonymous: the tug, the ram and the carry are stand-ins', whichever side won; a public grabber scrambles
//             and then watches. A lost grab: the crew and the officers scuffle and the crate stays
// Stand-ins are keyed by the scene's hash, never by an agent id. What was staged is logged per scene (log()) for the scenario
// (tools/showscenario.mjs): its actors, stand-ins, their looks and the clips they played, and the minutes it was seen.
// drawn() reports, for placecheck's checkDrawn, the fights whose result is public at the minute, sides named as the record names them.
import * as THREE from 'three';
import { fightsAt } from '../simstate/record/placement.js';
import { HOUSE_LOTS, CITY_PLACES, DISTRICTS } from '../simstate/record/places.js';
import { MEETING_PLACES } from '../simstate/record/routine-places.js';
import { idHash } from '../simstate/record/addresses.js';
import { clipsFor } from './show-clips.js';
import { VIGNETTES, leaveOnFoot, _arrestDbg } from './vignettes.js';
import { crateGeometry, groundPose, crateMatrix } from '../anim/cast/clips/grab-props.js';
import { benchSetGeometry } from '../anim/cast/clips/bench-props.js';
import { CLIP } from '../anim/cast/clips/index.js';
import { liveMesh, STEAM, LAMP as COOK_LAMP } from '../anim/cast/clips/cook-props.js';
import { createSetFx, hash, hashOf } from './setfx.js';
import { viseGeometry, lampGeometry, vaultGeometry, vaultDoorGeometry, containerGeometry, moundGeometry, packageGeometry, pileGeometry, boothGeometry, carGeometry, VAULT, BOOTH, CAR } from './setprops.js';
import { GAME_MIN } from '../simstate/simclock.js';
import { GANGWAY, QUAY, below, poseAt } from '../second-chance.js';

export const SCENE_FROM = 0;
const SIDE = .2;
export function createScenes({ stage, scene, agents, layer, looks, player, planner, frames, wide, meetings = new Map(), night: NIGHT = true, log = () => {} }) {
  const C = stage.ctx, live = new Map(), taken = new Set(), staged = new Map(), queued = new Map();
  const lookOf = kind => looks ? looks.of({ id: 'standin:' + kind, outfit: kind === 'civ' ? undefined : kind }) : 0;
  const frameOf = n => frames.find(f => f.step.kind === 'night' && f.day === n);
  // a night's fights, for the payoff (SHOW.md: the stager keeps the typed public event by id): the planner's own inputs
  const fightRows = new Map();
  function fightsOf(n) {
    if (fightRows.has(n)) return fightRows.get(n);
    const f = frameOf(n), plan = planner.night(n); let board = null;
    for (const g of frames) { if (g === f) break; if (g.board !== undefined) board = g.board; }
    const show = f.events.find(e => e.type === 'show' && e.night === n);
    const snap = { board, events: [show, ...f.events.filter(e => ['fight', 'arrest'].includes(e.type) && e.night === n)], minute: plan.start, day: n, frame: null, reveal: { night: n } };
    const rows = new Map(fightsAt(snap, n).map(r => [r.eventId, { ...r, won: f.events.find(e => e.id === r.eventId)?.won === true }]));
    const arrests = new Map(f.events.filter(e => e.type === 'arrest' && e.night === n).map(e => [e.id, e]));
    const out = { rows, arrests, show }; fightRows.set(n, out); return out;
  }
  // ── meshes: crates, the bench, cruisers, window panes, the woods shack (pooled, hidden when a scene ends)
  const pool = new Map();
  function mesh(kind, make) { const list = pool.get(kind) || pool.set(kind, []).get(kind); let m = list.find(x => !x.visible && !x.userData.busy);
    if (!m) { m = make(); if (!m) return null; m.matrixAutoUpdate = true; list.push(m); scene.add(m); }
    m.userData.busy = true; m.visible = true; return m; }
  const release = m => { if (m) { m.visible = false; m.userData.busy = false; } };
  const crateM = () => new THREE.Mesh(crateGeometry(THREE), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }));
  const benchM = () => new THREE.Mesh(benchSetGeometry(THREE), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }));
  const paneM = hex => () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: hex, toneMapped: false, transparent: true, opacity: .92 }));
  const shackM = () => { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.1, 2.2), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: .95 }));
    body.position.y = 1.05; const roof = new THREE.Mesh(new THREE.BoxGeometry(2.9, .12, 2.5), new THREE.MeshStandardMaterial({ color: 0x2c2620 })); roof.position.y = 2.16;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(.7, .45), new THREE.MeshBasicMaterial({ color: 0x7dff9a, toneMapped: false })); win.position.set(0, 1.3, 1.105);
    g.add(body, roof, win); g.userData.win = win; return g; };
  const cruiserM = () => layer.pieceMesh?.('patrolCar', [{ lights: NIGHT }]) ?? null;
  // a cruiser at the kerb by (x, z), else 4 m off on the stand's side; → mesh
  function cruiserAt(x, z) {
    const st = (() => { try { return _arrestDbg.curbStop(C, x, z); } catch { return null; } })(), m = mesh('cruiser', cruiserM); if (!m) return null;
    if (st) { m.position.set(st.x, 0, st.z); m.rotation.set(0, Math.atan2(st.ux, st.uz), 0); } else { m.position.set(x + 4, 0, z); m.rotation.set(0, 0, 0); }
    return m; }
  function windowsOf(lot) { const h = layer.homeAt(lot); return h?.windows?.length ? h : null; }
  function panes(lot, hex, opacity = .92) { const h = windowsOf(lot); if (!h) return [];
    return h.windows.map(win => { const m = mesh('pane:' + hex, paneM(hex)); if (!m) return null; C.props.windowAt(m, win, h.rot); m.position.y = win[1]; m.material.opacity = opacity; return m; }).filter(Boolean); }
  // ── where: the named agent's spot (its walker stands there), else a measured stand spot of the place, else the place
  function spotOf(id) { const a = id ? agents.map.get(id) : null; return a?.spot ? { x: a.spot.x, z: a.spot.z, ry: a.spot.st ?? a.spot.ry ?? 0, y: a.spot.y ?? SIDE } : null; }
  function placeSpot(place, salt) {
    if (place.lot) { const h = layer.homeAt(place.cityPlace), lot = HOUSE_LOTS.find(l => l.id === place.cityPlace);
      if (h?.door) return { x: h.door[0] + h.face[0] * 1.6, z: h.door[2] + h.face[1] * 1.6, ry: Math.atan2(-h.face[0], -h.face[1]), door: h, out: [h.face[0], h.face[1]] };
      const sp = agents.spots.get('home:' + place.cityPlace)?.[0]; return sp ? { x: sp.x, z: sp.z, ry: sp.ry + Math.PI } : { x: lot.x, z: lot.z, ry: 0 }; }
    const at = place.standPlace ?? place.cityPlace, spots = (wide.places[at]?.spots || []).filter(s => !s.over);
    const sp = spots[idHash(String(salt)) % Math.max(1, spots.length)] || CITY_PLACES[at] || CITY_PLACES[place.cityPlace];
    return { x: sp.x, z: sp.z, ry: sp.ry ?? 0 }; }
  const ahead = (p, d, side = 0) => ({ x: p.x + Math.sin(p.ry) * d + Math.cos(p.ry) * side, z: p.z + Math.cos(p.ry) * d - Math.sin(p.ry) * side });
  // ── FREE GROUND: where a scene's figures stand. Each figure gets a mark ROOM m clear of every walker drawn round it (agents and the
  // crowd), of every taken stand spot there and the step from its lane to it, and of every other scene's marks: the place's measured
  // stand spots first (stands.json), then standing ground round the anchor on the stage's height map (C.occ, read as vignettes.js
  // outdoors() reads it), off the walkers' lanes. Agents that arrive later keep off the marks (agents.js keepOff). ROOM: two big heads
  // (1.0 × 0.8 m) never meet from 1.3 m at any yaw (crowd.js ROOM.r). When the ground runs out the figure is drawn anyway, at the
  // candidate farthest from everyone, and the scene is logged `short` (the place can't hold it)
// LANE: a mark, a measured spot too unless an agent's own, keeps 1.35 m off a walkers' lane (C1-7): the crowd passes 1.31 m round a staged
// figure (crowd.js FOOT.up), so a passer-by's head never meets its
  const ROOM = 1.3, LANE = 1.35, STEP_W = .8, marks = new Map();
  const segD = (x, z, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1, k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L)); return Math.hypot(a.x + dx * k - x, a.z + dz * k - z); };
  const markedNear = (x, z, r) => { for (const L of marks.values()) for (const m of L) if (Math.hypot(m.x - x, m.z - z) < r) return true; return false; };
  // (a spot's walks: the step from its lane, a cop's or a worker's beat, a dealer's pace strip — stands.js)
  const walksOf = sp => [...(sp.entry ? [sp.entry] : []), ...(sp.beat || []).map(([x, z]) => ({ x, z })), ...(sp.pace ? [{ x: sp.pace[0], z: sp.pace[1] }] : [])];
  const pathD = (x, z, sp) => { let d = Math.hypot(sp.x - x, sp.z - z) + ROOM - STEP_W; for (const q of walksOf(sp)) d = Math.min(d, segD(x, z, q, sp)); return d; };
  agents.keepOff = sp => { if (!marks.size) return false; if (markedNear(sp.x, sp.z, ROOM)) return true;
    for (const L of marks.values()) for (const m of L) if (pathD(m.x, m.z, sp) < STEP_W) return true; return false; };
  // n marks for scene sc round a = {x, z, ry}: rings from `near` to `far` m (`rings`: these radii only, a partner at its distance), the
  // nearest the anchor's facing first; skip: actors whose own walkers don't count (the borrowed target the marks stand round)
  // from: a walker that walks to the mark: the straight way there passes nobody (it would stall in them, stage steer)
  // agent: the mark is a named agent's, so it stays where the city draws that place: within 1.4 m of one of its measured stand spots
  // (C1-3's placecheck reads an agent's drawn place there)
  // stay: a figure already on its mark that would step aside: no ground with room, and it stays where it is
  function freeGround(sc, a, n, { near = 0, far = 5, rings = null, skip = [], spots = true, from = null, agent = false, stay = false, lane = LANE } = {}) {
    const mine = marks.get(sc.id) || marks.set(sc.id, []).get(sc.id), out = [], psim = C.psim, at = sc.place.standPlace ?? sc.place.cityPlace;
    const gone = stage.leavingWalkers?.() ?? null, people = C.walkersNear(a.x, a.z, (rings ? Math.max(...rings) : far) + ROOM + 1, skip).filter(([, , w]) => !gone?.has(w)).map(([x, z]) => ({ x, z }));
    const list = agents.spots?.get(at) || [], taken = list.filter(s => s.taken && !skip.some(A => A.h === s.taken));
    let O = null; try { O = C.occ(a.x, a.z, (rings ? Math.max(...rings) : far) + 1.5); } catch {}
    // (the floor's height: the commonest on the map round the anchor, to 5 cm; the map has whoever stands there in it too)
    const y0 = floorOf(O, a, (rings ? Math.max(...rings) : far) + 1);
    const ground = (x, z) => !O || y0 === null || [[0, 0], [.35, 0], [-.35, 0], [0, .35], [0, -.35]].every(([ox, oz]) => { const h = O.at(x + ox, z + oz); return h !== null && Math.abs(h - y0) < .12; });
    // (round a centre — a partner at its distance, the target of a fight — the centre itself is not in the way)
    const centre = p => rings && Math.hypot(p.x - a.x, p.z - a.z) < .3;
    const roomAt = (x, z) => { let d = 99; for (const p of people) if (!centre(p)) d = Math.min(d, Math.hypot(p.x - x, p.z - z)); for (const s of taken) d = Math.min(d, Math.hypot(s.x - x, s.z - z), Math.hypot((s.ax ?? s.x) - x, (s.az ?? s.z) - z), pathD(x, z, s) + ROOM - STEP_W);
      for (const [k, L] of marks) for (const m of L) if (!centre(m)) d = Math.min(d, Math.hypot(m.x - x, m.z - z)); for (const m of out) d = Math.min(d, Math.hypot(m.x - x, m.z - z)); return d; };
    const cands = [];
    if (spots && !rings) for (const s of list) if (!s.taken && !s.over && Math.hypot(s.x - a.x, s.z - a.z) <= far) cands.push({ x: s.x, z: s.z, spot: true });
    for (const r of rings ?? Array.from({ length: Math.round((far - near) / .5) + 1 }, (_, k) => near + k * .5)) {
      const steps = r < .1 ? 1 : Math.max(6, Math.ceil(2 * Math.PI * r / .9));
      for (let k = 0; k < steps; k++) { const ang = (a.ry ?? 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2 * Math.PI / steps; cands.push({ x: a.x + Math.sin(ang) * r, z: a.z + Math.cos(ang) * r }); } }
    // (nobody passed nearer than ROOM, or nearer than it stands now when that is less: a walker may step away from a neighbour. At
    // 0.9 m a12 walked into the grab past a01 waiting for its arrest, heads 1.0 m apart, seed 404 night 2)
    const clearWay = q => !from || !people.some(p => { const d0 = Math.hypot(p.x - from.x, p.z - from.z); return d0 > .3 && segD(p.x, p.z, from, q) < Math.min(ROOM, d0 - .05); });
    // (and every step of its walk there, from where it stands, every 0.25 m: a stand's spots are 1.5 m apart, so five samples on a 5 m
    // walk stepped over the gaps between them, and placecheck reads the agent where it is at that moment)
    const measured = (wide.places[at]?.spots || []).filter(s => !s.over), onPlace = (x, z) => measured.some(s => Math.hypot(s.x - x, s.z - z) <= 1.4);
    const placed = q => { if (!agent || !measured.length) return true; if (!from) return onPlace(q.x, q.z);
      const steps = Math.max(1, Math.ceil(Math.hypot(q.x - from.x, q.z - from.z) / .25));
      for (let k = 0; k <= steps; k++) if (!onPlace(from.x + (q.x - from.x) * k / steps, from.z + (q.z - from.z) * k / steps)) return false; return true; };
    const ok = cands.filter(q => ground(q.x, q.z) && !(psim?.laneNear && (!q.spot || !agent) && (psim.laneNear(q.x, q.z, lane)?.d ?? 99) < lane) && clearWay(q) && placed(q));
    for (let k = 0; k < n; k++) {
      let pick = ok.find(q => roomAt(q.x, q.z) >= ROOM);
      // (no clear ground for a named agent: it stays where it stands. The roomiest of the rest walked it through whoever stood in its
      // way and off its place's ground: a16 at the docks, seed 404 night 2, 5 m east through a01's arrest)
      if (!pick && stay) break;
      if (!pick) { S_short(sc, n - k); let bd = -1; for (const q of ok.length ? ok : agent ? [] : cands.filter(placed)) { const d = roomAt(q.x, q.z); if (d > bd) { bd = d; pick = q; } } }
      if (!pick) break; out.push({ x: pick.x, z: pick.z }); }
    mine.push(...out); return out;
  }
  function floorOf(O, a, r) { if (!O) return null; const H = new Map(); let best = null, bn = 0;
    for (let x = -r; x <= r; x += .5) for (let z = -r; z <= r; z += .5) { const h = O.at(a.x + x, a.z + z); if (h === null) continue; const k = Math.round(h * 20), n = (H.get(k) || 0) + 1; H.set(k, n); if (n > bn) { bn = n; best = k / 20; } }
    return best; }
  const shortBy = new Map(), S_short = (sc, k) => shortBy.set(sc.id, Math.max(shortBy.get(sc.id) ?? 0, k));
  const facing = (p, q) => Math.atan2(q.x - p.x, q.z - p.z);
  // a borrowed walker standing in someone's room steps to clear ground first (vignettes.js placeFor's rule: P steps clear of them)
  function clearStep(S, A) { if (!A) return; const [m] = freeGround(S.sc, { x: A.x, z: A.z, ry: A.ry }, 1, { near: 0, far: 6, skip: [A], from: { x: A.x, z: A.z }, agent: true }); if (m && Math.hypot(m.x - A.x, m.z - A.z) > .1) { A.tx = m.x; A.tz = m.z; A.v = 1.2; } return m ?? { x: A.x, z: A.z }; }
  // a named agent's facing in its scene (the partner's mark): the row carries it (draw.js rowOf show.face); its loops start over now
  const faces = new Map();
  function faceTo(sc, id, q) { faces.set(sc.id, [q.x, q.z]); const a = agents.map.get(id); if (a?.rec?.show?.sceneId === sc.id) { a.rec.show.face = [q.x, q.z]; if (a.life) { a.life.q = []; a.life.cur = null; a.life.wait = 0; } } }
  const keyOf = (sc, k) => `rec:s${idHash(sc.id)}:${k}`;
  // ── C1-7: the sets' effects (setfx.js, pure in the clip clock and the scene's hash) and their props, in a walker's body frame
  const fx = createSetFx(scene), seedOf = sc => hashOf(String(sc.id));
  const yawOf = w => w.yawS ?? w.p[3];
  // (body frame → world, on walker w or a frame { x, y, z, ry }; the stage's own convention: +x the walker's left, +z ahead)
  const toW = (f, b) => { const x = f.p ? f.p[0] : f.x, y = f.p ? f.p[1] : f.y ?? SIDE, z = f.p ? f.p[2] : f.z, r = f.p ? yawOf(f) : f.ry ?? 0, c = Math.cos(r), s = Math.sin(r);
    return [x + b[0] * c + b[2] * s, y + b[1], z - b[0] * s + b[2] * c]; };
  const dirW = (f, d) => { const r = f.p ? yawOf(f) : f.ry ?? 0, c = Math.cos(r), s = Math.sin(r); return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]; };
  const clipOf = w => { const c = w?.g?.clip; return c && !c.out ? c : null; };
  const vc = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  const geoM = geo => () => new THREE.Mesh(geo(THREE), vc());
  const place = (m, f, dy = 0) => { m.position.set(f.x, (f.y ?? SIDE) + dy, f.z); m.rotation.set(0, f.ry ?? 0, 0); m.scale.set(1, 1, 1); return m; };
  const putMesh = (S, kind, make, f, dy) => { const m = mesh(kind, make); if (m) { place(m, f, dy); S.meshes.push(m); } return m; };
  // (the cook's parts as one live mesh each, re-posed from the playing clip: cook-props.js liveMesh; the list in partMatrices order)
  const COOK_PARTS = (() => { try { const L = []; for (const [id] of CLIP.cook_stir.prop.partMatrices(THREE, 0)) { if (L.at(-1)?.[0] === id) L.at(-1)[1]++; else L.push([id, 1]); } return L; } catch { return null; } })();
  const cookM = () => COOK_PARTS ? new THREE.Mesh(liveMesh(THREE, COOK_PARTS, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, emissive: 0x000000 })) : null;
  const poolM = (hex, r, o) => () => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: o, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); m.rotation.x = -Math.PI / 2; return m; };
  function standIn(sc, k, p, kind) { const A = C.actor(keyOf(sc, k), { standIn: { x: p.x, z: p.z, ry: p.ry ?? 0, look: lookOf(kind) } }); if (A) { A.look = lookOf(kind); A.standKind = kind; } return A; }
  // ── the log: what each scene drew, minute by minute
  function note(sc, minute, { actor = null, clip = null, standIn: S = null, x = null, z = null } = {}) {
    let L = staged.get(sc.id);
    if (!L) staged.set(sc.id, L = { id: sc.id, night: sc.night, kind: sc.kind, variant: sc.variant ?? null, beat: sc.beat, start: sc.start, end: sc.end, place: sc.place.standPlace ?? sc.place.cityPlace,
      first: minute, last: minute, actors: [], standIns: [], looks: [], clips: [], x, z });
    L.first = Math.min(L.first, minute); L.last = Math.max(L.last, minute);
    if (actor && !L.actors.includes(actor)) L.actors.push(actor);
    if (S && !L.standIns.includes(S.h)) { L.standIns.push(S.h); if (!L.looks.includes(S.look)) L.looks.push(S.look); }
    if (clip && !L.clips.includes(clip)) L.clips.push(clip);
    if (x !== null && L.x === null) { L.x = +x.toFixed(2); L.z = +z.toFixed(2); }
  }
  // ── a scene's staging: { sc, actors, meshes, step(m, t, dt), end(abort) } run on the stage like a vignette
  function begin(sc, minute) {
    const S = { sc, actors: [], meshes: [], held: [], alive: true, t0: C.clock, out: false };
    const make = MAKERS[sc.beat === 'ambient' && sc.kind !== 'hooded' ? 'ambient' : sc.kind] ?? null;
    if (!make) return null;
    // (a maker that fails leaves no marks behind: the scene is queued again and marks afresh)
    try { make(S, minute); } catch (e) { marks.delete(sc.id); for (const A of S.actors) C.free(A, { remove: A.kind === 'standin', now: true }); for (const m of S.meshes) release(m); throw e; }
    // (way: every figure standing in the scene is a point of an arrest's way to the crowd (crowd.js WAY): a passer-by whose next steps
    // would take it within 1.35 m stops short and waits. The body map alone let them squeeze past at 1.0 m where a set fills a
    // sidewalk: the vault at Precinct 9, its lane 3.3 m out from the wall, seed 415 night 5)
    const way = () => S.actors.filter(A => !A.freed && !A.leaving && !(A.moving > .05)).map(A => [A.x, A.z, A.x, A.z]);
    S.run = stage.run({ actors: S.actors, ev: { who: null }, way, step: (t, dt) => step(S, t, dt), end: abort => end(S, abort) }, 'record:' + sc.kind);
    live.set(sc.id, S); return S;
  }
  function step(S, t, dt) {
    if (!S.alive) return false;
    const m = player.minute, sc = S.sc, p = (m - sc.start) / Math.max(1e-6, sc.end - sc.start);
    // (an agent this scene borrowed whose own play's window opens: handed back to play it; a fight or an arrest takes it again after)
    for (const A of [...S.actors]) if (A.kind === 'held' && !A.freed && sc.beat !== 'ambient' && agents.map.get(A.h)?.rec?.show) {
      C.free(A); S.actors.splice(S.actors.indexOf(A), 1); if (S.V === A) { S.V = null; S.want = A.h; } }
    try { S.tick?.(m, p, t, dt); } catch (e) { log('record scene ' + sc.id + ': ' + (e && e.stack || e)); }
    const at = !S.noteAt || S.noteAt();
    for (const A of S.actors) if (!A.freed && A.w) note(sc, m, { standIn: A.kind === 'standin' ? A : null, actor: A.kind === 'held' ? A.h : null, clip: A.now ?? A.clip ?? null, x: at ? A.x : null, z: at ? A.z : null });
    const L = staged.get(sc.id) ?? (note(sc, m, {}), staged.get(sc.id)); L.props = Math.max(L.props ?? 0, S.meshes.filter(x => x.visible).length);
    return true;
  }
  function end(S, abort) {
    for (const A of S.actors) { if (A.freed) continue; if (A.kind === 'standin') { if (S.byCar) A.inCar = true; else if (!abort) leave(A, { v: 1.6, clip: S.flee ?? null }); C.free(A, { remove: true, now: abort }); } else C.free(A, { now: abort }); }
    for (const m of S.meshes) release(m); S.meshes.length = 0;
    for (const v of S.subs || []) stage.stop(v);
    live.delete(S.sc.id); marks.delete(S.sc.id); faces.delete(S.sc.id);
  }
  // (C1-9b · the payoff's moment on a scene's own clock t (the drawing's seconds since it began, GAME_MIN an island minute: the stage
  // runs while the record plays and stands still while it is paused, draw.js): a scene begun after its payoff, a seek there, paid that
  // long ago, so its after-payoff timers read the island minute, not when the page happened to begin it)
  // (a set's beats due at minute m, in order, with their starts: [name, start minute]; 'end' once it has paid off)
  const dueBeats = (sc, m, p) => [...(sc.beats || []).filter(x => x.start <= m && x.start < sc.end).map(x => [x.name, x.start]), ...(p >= 1 ? [['end', sc.end]] : [])];
  const LATE = 1, paid0 = (sc, m, t) => t - Math.max(0, (m - sc.end) * GAME_MIN);
  // clip by elapsed seconds: [[clip, secs], …] (the last holds)
  const seqAt = (seq, s) => { for (const [c, d] of seq) { if (s < d) return c; s -= d; } return seq.at(-1)[0]; };
  const lead = id => agents.map.get(id)?.w?.g?.clip?.name ?? null;
  // an agent's walker for a fight or an arrest, never while it plays its own play (its window: draw.js gives its row a show)
  const borrow = id => agents.map.get(id)?.rec?.show ? null : C.actor(id);

  const MAKERS = {
    // a named play: the agent plays it (draw.js / loops.js); its partner and its props here
    ambient(S, minute) {
      const sc = S.sc, id = sc.publicActors[0], sp = spotOf(id) ?? placeSpot(sc.place, sc.id), k = sc.variant ? `hustle:${sc.variant}` : sc.kind;
      S.where = sp;
      // (the partner at its distance from the agent, in front of it when that ground is free, else the nearest free way round)
      // (and the agent turns to it: the row's face, loops.js, so the pair stands face to face at its gap — off that line their heads meet.
      // side: a deal's buyer stands at the dealer's +x hand instead, out of its pace strip (deal_pace walks 1.15 m ahead), turned to it.
      // No free ground at the gap (the place can't hold the pair): no partner, rather than one drawn into somebody)
      const partner = (d, kind, side = false) => { const was = shortBy.has(sc.id), [q] = freeGround(sc, side ? { ...sp, ry: sp.ry + Math.PI / 2 } : sp, 1, { rings: [d] });
        const off = q && side && Math.abs(Math.cos(facing(sp, q) - sp.ry)) > .5;
        if (!q || off || (!was && shortBy.has(sc.id))) { marks.get(sc.id)?.pop(); if (q) shortBy.set(sc.id, 1); return null; }
        const A = standIn(sc, 'p', { ...q, ry: facing(q, sp) }, kind); if (A) { A.faceTo = [sp.x, sp.z]; S.actors.push(A); if (!side) faceTo(sc, id, q); } return A; };
      if (k === 'hustle:stickup') { const A = partner(2.2, 'civ'); S.tick = (m, p) => { if (A) A.clip = lead(id) === 'aim_hold' || lead(id) === 'aim_draw' ? (A.now === 'cower' ? 'cower' : 'hands_up_point') : A.now === 'hands_up_point' || A.now === 'cower' ? 'cower' : 'deal_lookout'; }; }
      else if (k === 'hustle:mugging' || k === 'hustle:campers') {
        // (the lunge's pair: hit_stumble_back 0.34 s after it starts, then a cower; before it, a drunk's sway or a camper's smoke)
        const A = partner(1.15, 'civ'), idle = k === 'hustle:mugging' ? 'spaced_drift' : 'smoke'; let hit = -1;
        S.tick = (m, p, t) => { if (!A) return; if (lead(id) === 'rob_lunge_grab' && hit < 0) hit = t;
          A.clip = hit < 0 || t - hit < .34 ? idle : seqAt([['hit_stumble_back', .8], ['cower', 1e9]], t - hit - .34); }; }
      else if (k === 'deal') { const A = partner(1.02, 'civ', true); let pass = -1;
        S.tick = (m, p, t) => { if (!A) return; const w = agents.map.get(id)?.w; if (w) A.faceTo = [w.p[0], w.p[2]];
          if (lead(id) === 'brush_pass' && pass < 0) pass = t; if (lead(id) !== 'brush_pass' && pass >= 0 && t - pass > 1) pass = -1; A.clip = pass >= 0 && t - pass < .6 ? 'brush_pass' : 'deal_lookout'; }; }
      else if (k === 'hustle:crates' || k === 'hustle:boats') for (const [d, s] of [[.9, 1.1], [.9, -1.2], [1.3, 1.2]]) { const c = mesh('crate', crateM), q = ahead(sp, d, s); if (c) { c.matrixAutoUpdate = false; crateMatrix(THREE, groundPose(q.x, q.z, sp.ry + s), c.matrix); c.matrixWorldNeedsUpdate = true; S.meshes.push(c); } }
      else if (k === 'build') buildSet(S, sp, id);
      else if (k === 'patrol') { const c = cruiserAt(sp.x, sp.z); if (c) S.meshes.push(c); }
      else if (k === 'cook') cookSet(S, sp, id);
      else if (k === 'run' && sc.beats?.length) runSet(S, sp, id);
      else if (k === 'laylow') {
        // in at the door: the walker steps inside and stays in; the curtains drawn, the lights out (the windows dark)
        const goIn = () => { const A = C.actor(id); if (!A) return null; S.actors.push(A); const h = layer.homeAt(sc.place.cityPlace); if (h?.door) { A.tx = h.door[0] - h.face[0] * .6; A.tz = h.door[2] - h.face[1] * .6; A.v = 1.2; } return A; };
        let A = goIn(); S.tick = () => { if (!A) A = goIn(); };
        S.meshes.push(...panes(sc.place.cityPlace, 0x07090f, .97));
        const h = windowsOf(sc.place.cityPlace), w = h?.windows[0]; if (w) { const c = mesh('curtain', paneM(0x8a2f3a)); if (c) { C.props.windowAt(c, w, h.rot); c.scale.x *= .5; c.position.y = w[1]; S.meshes.push(c); } }
        S.keep = true;
      }
      note(sc, minute, {});
    },
    hooded(S) {
      // (every one of the district's count: a hooded count is public; each creeps between two marks of its own on free ground)
      // (its second mark one it has a clear way to from the first: creeping across to any free mark it passed the agents standing
      // between, seed 404 night 6)
      const sc = S.sc, n = sc.hoodedCount, a = placeSpot(sc.place, sc.id), M = freeGround(sc, a, n, { near: 1.5, far: 6 }); S.where = a; S.flee = 'run_getaway';
      for (let k = 0; k < n; k++) { const p = M[k] ?? a, A = standIn(sc, k, { ...p, ry: facing(p, a) }, 'hooded'); if (A) { A.marks = [p, freeGround(sc, p, 1, { near: 1.5, far: 4, skip: [A], from: p, stay: true })[0] ?? p]; A.at = 0; S.actors.push(A); } }
      // (they slip away on foot from 60% of the window, so none is still walking off in view when it ends: a next show's jump takes no one)
      S.tick = (m, p, t) => p >= .6 ? S.actors.forEach(A => { if (A.freed || A.leaving) return; leave(A, { v: 1.8, clip: 'run_getaway' }); C.free(A, { remove: true }); }) : S.actors.forEach((A, k) => { const ph = (t + k * 1.7) % 9; if (ph < 4 && A.tx === null && !A.walked) { A.at = 1 - A.at; const q = A.marks[A.at]; A.tx = q.x; A.tz = q.z; A.v = .7; A.walked = true; }
        A.clip = A.tx !== null ? 'creep_walk' : ph < 6 ? 'deal_lookout' : 'lookout_wave'; if (ph >= 6) A.walked = false; });
    },
    // (C1-7: a corner fight, a dealer's corner taken by force: seed 406 night 13's; staged as a hit on the corner's holder, its unnamed
    // attackers unhooded stand-ins when their side is)
    hit(S) { fight(S); }, breakin(S) { fight(S); }, collar(S) { fight(S); }, corner(S) { fight(S); },
    grab(S) { if (S.sc.beats?.length) grabSet(S); else fight(S); }, vault(S) { if (S.sc.beats?.length) vaultSet(S); else fight(S); },
    arrest(S) {
      const sc = S.sc, F = fightsOf(sc.night), e = F.arrests.get(sc.eventId), who = e && sc.publicActors.includes(e.agent) ? e.agent : null;
      // (a collar's target, still held by its fight: handed over to the arrest)
      if (who && C.busy(who)) for (const T of live.values()) for (const B of T.actors) if (B.h === who && !B.freed) { C.free(B); T.actors.splice(T.actors.indexOf(B), 1); if (T.V === B) T.V = null; }
      // (the arrested one: its own walker once it is not playing its own play; until then the arrest waits)
      if (!who) { arrestNow(S, e, null); return; }
      S.where = spotOf(who) ?? placeSpot(sc.place, sc.id); S.keep = true;
      const wait = () => { const A = borrow(who); if (A) arrestNow(S, e, A); };
      S.tick = wait; wait();
    },
    results(S) { S.where = placeSpot(S.sc.place, S.sc.id); },
    // night 14's walk: a named walker is draw.js's (its show trip, then its arrival loops); an unnamed one a hooded stand-in walking in
    walk(S, minute) {
      const sc = S.sc, a = placeSpot(sc.place, sc.id); S.where = a; S.keepTill = sc.end; if (sc.publicActors.length || !sc.hoodedCount) return;
      // (C1-7d: it walks in only the last few metres, from free ground with a clear way to its mark, just in time for the arrive beat:
      // walked in along the lanes from 15 m out it went through the crowd on them and stood in a named walker that had come to its spot
      // meanwhile, seed 406 night 14. Its mark is picked when it comes, round whoever stands there then)
      const arrive = sc.beats?.find(b => b.name === 'arrive')?.start ?? sc.end, IN = 4, V = 1.2, lead = IN / V / GAME_MIN;
      let A = null, to = null; S.flee = 'flee_run'; note(sc, minute, {});
      // (2.2 m off the walkers' lanes: standing 1.35 m off one, a passer-by's head came within 1.11 m of it)
      const come = m => { const [q] = freeGround(sc, a, 1, { near: 1, far: 7, lane: 2.2 }); to = q ?? a;
        const [p0] = m < arrive ? freeGround(sc, to, 1, { near: IN - 1, far: IN + 1, from: to, lane: 2.2 }) : [null], p = p0 ?? to;
        A = standIn(sc, 'w', { x: p.x, z: p.z, ry: facing(p, to) }, 'hooded'); if (!A) return; S.actors.push(A); if (p !== to) { A.tx = to.x; A.tz = to.z; A.v = V; } };
      // (still walking at the arrive beat: it cuts to its mark, as a late trip does; it is logged where it stands once there)
      S.tick = m => { if (!A && m >= arrive - lead) come(m); if (!A || A.freed) return; if (m >= arrive && A.tx !== null) { A.tx = null; A.x = to.x; A.z = to.z; }
        const there = A.tx === null; A.clip = there ? 'deal_lookout' : null; if (there) { A.faceTo = [a.x, a.z]; note(sc, m, { x: A.x, z: A.z }); } };
      S.noteAt = () => !!A && A.tx === null;
    },
    // the ferry leaves: a dockhand on the quay waves the SECOND CHANCE off
    // (C1-7d: on the quay by the gangway's foot, the berth she has just left; turned to her as she goes, second-chance.js poseAt)
    ferry(S) {
      const sc = S.sc, leave = sc.beats?.find(b => b.name === 'leave') ?? sc, a = { x: GANGWAY.foot.x + QUAY.dx * -1.6, z: GANGWAY.foot.z + .3, ry: Math.PI };
      const [m] = freeGround(sc, a, 1, { near: 0, far: 3 }), q = m ?? a, her = mn => (poseAt(mn, leave, -Infinity)?.pose ?? { x: q.x, z: q.z - 20 });
      S.where = q; const f = her(player.minute), A = standIn(sc, 'd', { ...q, ry: facing(q, f) }, 'civ'); if (!A) return;
      S.actors.push(A); S.tick = mn => { const p = her(mn); A.faceTo = [p.x, p.z]; A.clip = 'lookout_wave'; };
    },
    // C1-7d · a boarding (each board scene's queue and gangway beats): its boarder is the line's (boardLine below: the queue on the quay,
    // the gangway, below); here it is logged as the scene's, where it stands and what it plays
    board(S, minute) {
      const sc = S.sc; S.where = { x: GANGWAY.foot.x, z: GANGWAY.foot.z, ry: 0 };
      S.tick = m => { const B = line?.by.get(sc.id), A = B?.A; if (!A || A.freed || B.state === 'below') return;
        note(sc, m, { actor: A.kind === 'held' ? A.h : null, standIn: A.kind === 'standin' ? A : null, clip: A.now ?? A.clip ?? null, x: A.x, z: A.z }); };
      note(sc, minute, {});
    },
    // C1-7d · missed the boat (GAME.md §15): at the empty berth, the agent at the gangway's foot looking out after her; on Iron Island
    // (arrested at the dock) where it stands. Its own walker; afterwards placement sends it home (or keeps it in jail)
    missed(S) {
      const sc = S.sc, id = sc.publicActors[0] ?? null, jail = sc.place.cityPlace === 'jail', berth = { x: GANGWAY.foot.x + QUAY.dx * 2.2, z: GANGWAY.foot.z, ry: Math.PI };
      S.where = jail ? (spotOf(id) ?? placeSpot(sc.place, sc.id)) : berth; S.keepTill = sc.end;
      // (still cuffed by its dock arrest, which stays until the close: handed over, so the jail takes it and it is drawn there)
      let A = null; const take = () => { if (A || !id) return;
        if (C.busy(id)) { for (const T of live.values()) if (T !== S) for (const B of [...T.actors]) if (B.h === id && !B.freed) { C.free(B); T.actors.splice(T.actors.indexOf(B), 1); } return; }
        A = borrow(id); if (!A) return; S.actors.push(A);
        if (!jail) { const [q] = freeGround(sc, berth, 1, { near: 0, far: 3, skip: [A] }); const to = q ?? berth; A.tx = to.x; A.tz = to.z; A.v = 1.2; } };
      if (!id && sc.hoodedCount) { const [q] = freeGround(sc, berth, 1, { near: 0, far: 3 }); A = standIn(sc, 'm', { ...(q ?? berth), ry: Math.PI }, 'hooded'); if (A) S.actors.push(A); }
      take(); S.tick = () => { take(); if (!A || A.freed) return; if (A.tx === null) { A.faceTo = jail ? null : [GANGWAY.top.x, GANGWAY.top.z - 30]; A.clip = 'deal_lookout'; } };
    },
    // day 15's mint: one blank card of light per receipt, rising off the quay in the record's order, nothing on it
    mint(S, minute) {
      const sc = S.sc, plan = planner.day(15), n = plan.scenes.length, k = Math.max(0, plan.scenes.findIndex(x => x.id === sc.id));
      const spots = (wide.places[sc.place.standPlace ?? sc.place.cityPlace]?.spots || []).filter(s => !s.over), sp = spots[k % Math.max(1, spots.length)] ?? placeSpot(sc.place, sc.id);
      S.where = { x: sp.x, z: sp.z, ry: sp.ry ?? 0 };
      const c = mesh('mintcard', mintM); if (!c) return; S.meshes.push(c); c.position.set(sp.x, 0, sp.z);
      // (its turn in the window: the k-th of n, each rising for a fifth of the window)
      const t0 = sc.start + (sc.end - sc.start) * .8 * k / Math.max(1, n), t1 = t0 + (sc.end - sc.start) * .2;
      S.tick = m => { const u = (m - t0) / (t1 - t0); c.visible = u >= 0 && u < 1; if (!c.visible) return; c.position.y = .6 + u * 4.5; c.rotation.y = u * Math.PI * 2;
        for (const x of c.children) x.material.opacity = Math.min(1, u * 5, (1 - u) * 4) * x.userData.o; };
      note(sc, minute, {});
    },
  };
  const mintM = () => { const g = new THREE.Group(), card = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.3), new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshBasicMaterial({ color: 0xffc94a, toneMapped: false, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    card.userData.o = .95; glow.userData.o = .55; glow.position.z = -.01; g.add(glow, card); return g; };
  // ── C1-7 · THE SIT-DOWN VENUES (the header above). Ground: the stage's height map round the venue's anchor (C.occ), the footprint
  // all on the anchor's floor and off the walkers' lanes; the roof: the commonest height on the map round the garage's anchor
  const venues = new Map(), venueMesh = new Map(), tries = new Map();
  const venueSlot = cue => { const day = Math.floor(cue.minute / 1440), same = [...meetings.values()].filter(c => c.venue === cue.venue && Math.floor(c.minute / 1440) === day).sort((a, b) => a.minute - b.minute || a.eventId - b.eventId); return Math.max(0, same.findIndex(c => c.eventId === cue.eventId)) % 3; };
  function groundFor(a, foot, taken, r = 9) {
    let O = null; try { O = C.occ(a.x, a.z, r + 3); } catch {} if (!O) return null; const y0 = floorOf(O, a, 3); if (y0 === null) return null; const P = C.psim;
    for (let d = 0; d <= r; d += .75) for (let k = 0, n = d ? Math.ceil(2 * Math.PI * d / .9) : 1; k < n; k++) { const ang = k / n * 2 * Math.PI, x = a.x + Math.sin(ang) * d, z = a.z + Math.cos(ang) * d;
      for (const ry of [a.ry ?? 0, (a.ry ?? 0) + Math.PI / 2]) { const F = { x, z, ry };
        if (taken.some(t => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
        if (!foot.every(([fx, fz]) => { const q = toW(F, [fx, 0, fz]), h = O.at(q[0], q[2]); return h !== null && Math.abs(h - y0) < .12 && !((P?.laneNear?.(q[0], q[2], .9)?.d ?? 9) < .9); })) continue;
        return { x, z, ry, y: y0 }; } }
    return null;
  }
  function venue(cue) {
    if (!cue?.venue) return null; if (venues.has(cue.eventId)) return venues.get(cue.eventId)?.key ?? null;
    let v = null; try { v = makeVenue(cue); } catch (e) { log('record venue ' + cue.eventId + ': ' + (e && e.message || e)); }
    // (no ground yet, the stage's map not drawn: asked again on later updates, three times at most)
    if (!v && (tries.set(cue.eventId, (tries.get(cue.eventId) ?? 0) + 1).get(cue.eventId)) < 3) return null;
    venues.set(cue.eventId, v); if (!v) return null; agents.spots.set(v.key, v.spots); return v.key;
  }
  function makeVenue(cue) {
    const key = 'venue:' + cue.eventId, k = venueSlot(cue), same = [...venues.values()].filter(v => v && v.venue === cue.venue && v.day === Math.floor(cue.minute / 1440)).map(v => v.at);
    const seat = (x, z, ry, y, kind) => ({ x, z, y, ry, st: ry, k: 0, place: key, taken: null, kind: kind ? 'seat' : 'open', seat: kind || undefined, venue: key });
    if (cue.venue === 'diner') {
      const sp = (wide.places[MEETING_PLACES.diner.standPlace ?? MEETING_PLACES.diner.cityPlace]?.spots || []).filter(s => !s.over)[0] ?? CITY_PLACES[MEETING_PLACES.diner.cityPlace];
      const at = groundFor({ x: sp.x, z: sp.z, ry: sp.ry ?? 0 }, [[-.7, -1.3], [.7, -1.3], [-.7, 1.3], [.7, 1.3], [0, 0]], same); if (!at) return null;
      const y = at.y, a = toW({ ...at, y }, [0, 0, BOOTH.seat]), b = toW({ ...at, y }, [0, 0, -BOOTH.seat]);
      return { key, venue: 'diner', day: Math.floor(cue.minute / 1440), at, prop: 'booth', spots: [seat(a[0], a[2], at.ry + Math.PI, y, 'sit_bench'), seat(b[0], b[2], at.ry, y, 'sit_bench')] };
    }
    if (cue.venue === 'car') {
      const pk = DISTRICTS.suburbs ? CITY_PLACES[DISTRICTS.suburbs.standPlace ?? DISTRICTS.suburbs.cityPlace] ?? DISTRICTS.suburbs : null; if (!pk || !Number.isFinite(pk.x)) return null;
      const at = groundFor({ x: pk.x, z: pk.z, ry: 0 }, [[-2.3, -1], [2.3, -1], [-2.3, 1], [2.3, 1], [.5, 2.6], [0, 0]], same, 14); if (!at) return null;
      // (the car along its frame's x: the doorway's sitter faces out of it (+z), the other 1.35 m out, facing it)
      const F = { ...at }, y = at.y, d = toW(F, [CAR.door[0], 0, CAR.door[1]]), o = toW(F, [CAR.door[0], 0, CAR.door[1] + 1.35]), out = at.ry;
      return { key, venue: 'car', day: Math.floor(cue.minute / 1440), at, prop: 'car', spots: [seat(d[0], d[2], out, y, 'sit_bench'), seat(o[0], o[2], out + Math.PI, y, null)] };
    }
    if (cue.venue === 'rooftop') {
      const R = CITY_PLACES[MEETING_PLACES.rooftop.cityPlace]; if (!R) return null; let O = null; try { O = C.occ(R.x, R.z, 14); } catch {} if (!O) return null;
      const top = floorOf(O, R, 10); if (top === null || top < 3) return null;
      const at = groundFor({ x: R.x, z: R.z, ry: 0, y: top }, [[-1.2, 0], [1.2, 0], [0, .9], [0, -.9]], same, 10); if (!at) return null;
      const a = toW(at, [-.75, 0, 0]), b = toW(at, [.75, 0, 0]);
      return { key, venue: 'rooftop', day: Math.floor(cue.minute / 1440), at, prop: null, spots: [seat(a[0], a[2], at.ry + Math.PI / 2, at.y, null), seat(b[0], b[2], at.ry - Math.PI / 2, at.y, null)] };
    }
    return null;
  }
  // the props of the venues in use now (someone stands at one of its spots): the booth, the car; released when nobody does
  function venueProps() {
    const on = new Set(); for (const a of agents.map.values()) if (a.spot?.venue && a.w && a.mode === 'stand') on.add(a.spot.venue);
    for (const [key, m] of venueMesh) if (!on.has(key)) { release(m); venueMesh.delete(key); }
    for (const key of on) { if (venueMesh.has(key)) continue; const v = [...venues.values()].find(v => v?.key === key); if (!v?.prop) continue;
      const m = mesh(v.prop, geoM(v.prop === 'booth' ? boothGeometry : carGeometry)); if (m) { place(m, v.at); venueMesh.set(key, m); } }
  }
  // ── C1-7 · THE SETS (the header above; SHOW.md's beats, in island minutes)
  // the open side round anchor a: of its facing, the reverse and the two sides, the first whose body-frame points pts ([x, z]) all stand
  // on the anchor's floor on the stage's height map (C.occ: walls, kerbs, water and the rest not), at least 80% of them (a passer-by
  // stands in the map too); else the reverse of its facing
  function openSide(a, pts, r = 7) {
    let O = null; try { O = C.occ(a.x, a.z, r); } catch {} if (!O) return a.ry + Math.PI; const y0 = floorOf(O, a, 2.5); if (y0 === null) return a.ry + Math.PI;
    for (const ry of [a.ry + Math.PI, a.ry, a.ry + Math.PI / 2, a.ry - Math.PI / 2]) { const F = { x: a.x, z: a.z, ry };
      const ok = pts.filter(([x, z]) => { const q = toW(F, [x, 0, z]), h = O.at(q[0], q[2]); return h !== null && Math.abs(h - y0) < .15; }).length; if (ok >= pts.length * .8) return ry; }
    return a.ry + Math.PI;
  }
  const beatIn = (sc, m) => sc.beats.find(b => b.start <= m && m < b.end)?.name ?? (m >= sc.end ? 'end' : sc.beats[0].name);
  // (a stand-in's clip, from a clip's own clock, into its sparks/dust bursts: every burst whose age is under `life` now, keyed by its loop)
  const loopAge = (c, at) => { const D = c.c.dur, t = c.t % D, L = Math.floor(c.t / D); let age = t - at, k = L; if (age < 0) { age += D; k--; } return [age, k]; };
  function buildSet(S, sp, id) {
    // the bench at the Gunrunner's spot (bench-props.js BENCH, its body frame: the walker on its spot facing it), the vise, the lamp
    const sc = S.sc, f = { ...sp, y: sp.y ?? SIDE }, seed = seedOf(sc);
    putMesh(S, 'bench', benchM, f); putMesh(S, 'vise', geoM(viseGeometry), f); putMesh(S, 'lamp', geoM(lampGeometry), f);
    const pool = mesh('lamppool', poolM(0xffd890, .4, .2)); if (pool) { const q = toW(f, [-.05, .438, .55]); pool.position.set(q[0], q[1], q[2]); pool.rotation.set(-Math.PI / 2, 0, 0); pool.visible = NIGHT; S.meshes.push(pool); }
    const bulb = toW(f, [-.42, .87, .70]);
    S.tick = () => { if (NIGHT) fx.glow(bulb, .3, 0xffe2a8, .9, C.camera);
      // (bench_hammer's three strikes: sparks up off the anvil from the hammer's face, along −n, for 0.22 s)
      const w = agents.map.get(id)?.w, c = clipOf(w); if (!c || c.name !== 'bench_hammer' || c.w < .6) return;
      (c.c.strikes ?? [.6, 1.2, 1.8]).forEach((st, k) => { const [age, L] = loopAge(c, st); if (age >= .25) return; const face = c.c.prop.face?.(st) ?? { p: [.204, .5, .67], n: [0, -1, 0] };
        fx.sparks(hash(seed, L, k), toW(w, face.p), dirW(w, face.n.map(v => -v)), age, { n: 24, speed: 3.2, cone: 1.8, size: .035, grav: 9, life: .22 }); }); };
  }
  function cookSet(S, sp, id) {
    // the cook's bench and burner with its parts (cook-props.js, the walker's body frame), the lab light, and the steam (cook.md)
    const sc = S.sc, f = { ...sp, y: sp.y ?? SIDE }, home = !!sc.place.lot, seed = seedOf(sc);
    const set = putMesh(S, 'cookset', cookM, f), ps = home ? panes(sc.place.cityPlace, 0x7dff9a) : []; S.meshes.push(...ps);
    let roof = null, door = null;
    if (!home) { const q = ahead(sp, -3.2), sh = mesh('shack', shackM); if (sh) { sh.position.set(q.x, 0, q.z); sh.rotation.set(0, sp.ry, 0); S.meshes.push(sh); }
      const F = { x: q.x, z: q.z, ry: sp.ry, y: 0 }; roof = toW(F, [.6, 2.2, -.4]); door = toW(F, [0, 1.7, 1.2]); }
    const rest = (() => { try { return CLIP.cook_stir.prop.partMatrices(THREE, 0); } catch { return null; } })();
    S.tick = (m, p, t) => {
      // (C1-9b: the lab light's flicker and the steam on the island's clock since the scene's start, in island seconds: the same at
      // every speed and on a seek, rather than GAME_MIN's drawing seconds, 60 / speed)
      const tt = (m - sc.start) * 60;
      for (const [i, q] of ps.entries()) q.material.opacity = .55 + .35 * Math.abs(Math.sin(tt * 3.1 + i));
      const w = agents.map.get(id)?.w, c = clipOf(w), on = c && c.c.group === 'cook' && c.w >= .6;
      if (set && (on || rest)) set.geometry.userData.pose(on ? c.c.prop.partMatrices(THREE, c.t) : rest);
      // (the steam: the island's clock since the scene's start, in a game minute's seconds, as the sparks follow the clip's: a seek
      // lands mid-plume, not on its first puff; thin off the pot at home, thick out of the shack's roof and door in the woods)
      fx.steam(seed, toW(f, STEAM.at), tt, home ? { k: .2, life: 1.5, period: .22, rise: .45, spread: .05, wind: [.06, .03] } : { k: .28, life: 1.8, period: .2, rise: .55, spread: .07, wind: [.1, .05] });
      if (roof) { fx.steam(seed ^ 1, roof, tt, { k: 1.4, life: 5, period: .28, spread: .5 }); fx.steam(seed ^ 2, door, tt, { k: .7, life: 3, period: .45, spread: .3, rise: .45 }); }
      if (!home && NIGHT) fx.glow(toW(f, COOK_LAMP.at), .35, 0xfff1c8, .85, C.camera); };
  }
  function runSet(S, sp, id) {
    const sc = S.sc, f = { ...sp, y: sp.y ?? SIDE }, seed = seedOf(sc), names = sc.beats.map(b => b.name), at = d => { const q = toW(f, [0, 0, d]); return { x: q[0], y: f.y, z: q[2], ry: f.ry }; };
    if (names.includes('dig')) {
      // the woods: the dug earth where the pick lands (0.65 m ahead), the buried package that comes up at the unearth beat
      putMesh(S, 'mound', geoM(moundGeometry), at(.75), -.02); const pk = putMesh(S, 'package', geoM(packageGeometry), at(.7), -.05); if (pk) pk.visible = false;
      S.tick = m => { const b = beatIn(sc, m); if (pk) pk.visible = b === 'unearth';
        const w = agents.map.get(id)?.w, c = clipOf(w); if (!c || c.w < .6) return;
        if (c.name === 'dig_pick') { const [age, L] = loopAge(c, .97); if (age < .8) fx.dust(hash(seed, 1, L), toW(w, [0, 0, .65]), age, { n: 9 }); }
        if (c.name === 'dig_shovel') { let [age, L] = loopAge(c, .3); if (age < .8) fx.dust(hash(seed, 2, L), toW(w, [0, 0, .5]), age, { n: 6 });
          [age, L] = loopAge(c, 1.5); if (age < 1.2) fx.debris(hash(seed, 3, L), toW(w, [.45, .55, .35]), age, { n: 8, speed: 1.5, size: .05, ground: w.p[1] }); } };
    } else if (names.includes('container')) {
      // the docks: a container's mouth 1 m ahead of the runner, its doors open, and a box at the lift's spot (grab.md: 0.48 m ahead)
      // (turned to the open side of the quay, the runner facing its mouth)
      const ry = openSide(f, [[0, 1], [0, 2.5], [0, 4], [0, 5.5], [1.2, 1.2], [-1.2, 1.2], [1.2, 4], [-1.2, 4], [1.2, 6.8], [-1.2, 6.8]], 9);
      Object.assign(f, { ry }); const mouth = toW(f, [0, 0, 1]); faceTo(sc, id, { x: mouth[0], z: mouth[2] });
      const q = toW(f, [0, 0, 4.15]), box = mesh('container', geoM(containerGeometry)); if (box) { box.position.set(q[0], f.y - .2, q[2]); box.rotation.set(0, f.ry + Math.PI / 2, 0); S.meshes.push(box); }
      const cr = mesh('crate', crateM), cp = at(.48); if (cr) { cr.matrixAutoUpdate = false; crateMatrix(THREE, groundPose(cp.x, cp.z, f.ry), cr.matrix); cr.matrixWorldNeedsUpdate = true; S.meshes.push(cr); }
      S.tick = m => { const b = beatIn(sc, m), c = clipOf(agents.map.get(id)?.w); if (cr) cr.visible = b === 'container' || (b === 'lift' && !(c?.name?.startsWith('crate_') && c.w >= .6)); };
    } else {
      // the Mall's bags and boxes, the Heap's scrap: a heap to search 0.85 m ahead
      putMesh(S, 'pile:' + (sc.place.cityPlace === 'mall' ? 'bags' : 'scrap'), geoM(T => pileGeometry(T, sc.place.cityPlace === 'mall' ? 'bags' : 'scrap')), at(.85), -.02);
    }
  }
  // the crew's stand-ins: unhooded (a vault's or a grab's side is public with no names), never in an agent's look; hooded when the side is
  const crewLook = (s, k) => s?.hooded ? 'hooded' : 'crew:' + (k % 4);
  // after a set's payoff (its result public): the downed get up (lie_hurt → get_up at its 2 s wrap, falls.js), then 5.5 s on every
  // stand-in still there goes on foot and the borrowed are handed back, so none is in view when the show closes and the next one jumps in
  function clearOut(S, t0, t, { cuffed = [] } = {}) {
    if (t - t0 > 1.5 && !S.up) { S.up = true; for (const A of S.actors) if (!A.freed && !A.leaving && /lie_hurt|shove_fall|guard_bowled|crate_rammed/.test(A.w?.g?.clip?.name ?? '')) { A.clip = 'get_up'; A.seam = { from: 'lie_hurt', P: 2 }; } }
    if (t - t0 > 5.5 && !S.gone) { S.gone = true; for (const A of [...S.actors]) { if (A.freed || A.leaving) continue;
        if (A.kind === 'held') { C.free(A); S.actors.splice(S.actors.indexOf(A), 1); continue; }
        leave(A, { v: 1.6, clip: cuffed.includes(A) ? 'cuffed_walk' : null, late: t - t0 - 5.5 }); C.free(A, { remove: true }); } }
  }
  // ── LEAVING ON FOOT: vignettes.js leaveOnFoot (to the nearest lane, then along the lanes away from the camera), its first leg round
  // everyone: the shortest way on the ground (a 0.5 m grid, 14 m round it, on its floor) to a lane, ROOM clear of every walker there
  // (the agents at their stand spots don't step aside), never back across `away`. The straight leg to the nearest lane walked seed 404
  // night 2's grab crew through the agents on the docks' front row. No such way: the straight leg, as before
  // (C1-9b · o.late: island seconds since it should have gone, on a seek past that moment. Over LATE it went before the minute the
  // viewer landed on: not drawn, as playing there would have it gone from the scene; under it, it sets off now)
  function leave(A, o = {}) {
    if (o.late > LATE) { C.free(A, { remove: true, now: true }); return null; }
    const P = C.psim, R = 14, h = .5, N = Math.round(2 * R / h) + 1, x0 = A.x - R, z0 = A.z - R;
    const people = C.walkersNear(A.x, A.z, R + ROOM, [A]).map(([x, z]) => ({ x, z }));
    let O = null; try { O = C.occ(A.x, A.z, R + 1); } catch {} const y0 = floorOf(O, A, 1.5);
    // (0 blocked, 1 open, 2 a lane: the goal; its own first metre stays open, whoever stands in its room)
    const G = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + i * h, z = z0 + j * h, d0 = Math.hypot(x - A.x, z - A.z); if (d0 > R) continue;
      if (O && y0 !== null) { const y = O.at(x, z); if (y === null || Math.abs(y - y0) > .2) continue; }
      if (d0 > 1 && people.some(q => Math.hypot(q.x - x, q.z - z) < ROOM)) continue;
      if (o.away && Math.hypot(x - o.away[0], z - o.away[1]) < 1.5) continue;
      G[j * N + i] = d0 > 1 && (P.laneNear?.(x, z, .5)) ? 2 : 1; }
    const start = Math.round(R / h) * N + Math.round(R / h), prev = new Int32Array(N * N).fill(-1); prev[start] = start;
    let goal = -1; for (let Q = [start], k = 0; k < Q.length && goal < 0; k++) { const c = Q[k], ci = c % N, cj = (c - ci) / N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const n = j * N + i; if (prev[n] >= 0 || !G[n]) continue; prev[n] = c; if (G[n] === 2) { goal = n; break; } Q.push(n); } }
    if (goal < 0) return leaveOnFoot(C, A, o);
    const way = []; for (let c = goal; c !== start; c = prev[c]) way.unshift([x0 + (c % N) * h, z0 + Math.floor(c / N) * h]);
    // (its corners only: a point is kept where the straight line from the last kept one would leave the open cells)
    const open = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / .25); for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n, i = Math.round((x - x0) / h), j = Math.round((z - z0) / h); if (!G[j * N + i]) return false; } return true; };
    const legs = []; let last = [A.x, A.z]; for (let k = 0; k < way.length; k++) if (k === way.length - 1 || !open(last, way[k + 1])) { legs.push(way[k]); last = way[k]; }
    const end = legs[legs.length - 1], x = A.x, z = A.z; A.x = end[0]; A.z = end[1]; const path = leaveOnFoot(C, A, o); A.x = x; A.z = z;
    A.path = [...legs, ...path]; return A.path; }
  // a set's idle stand-in that someone has come to stand in the room of (an agent arriving after the set began): it steps to free ground
  // round where it stands, at most once in 2 s (the probe's insides and crowd heads)
  function dodge(S, list, t) {
    for (const A of list) { if (!A || A.freed || A.leaving || A.tx !== null || A.path?.length || (A.dodgeT ?? -9) > t - 2) continue;
      if (!C.walkersNear(A.x, A.z, ROOM, S.actors).length) continue; A.dodgeT = t;
      // (stay: no ground with room, it stays. The roomiest step left walked it into the agents round it: seed 404 night 2's grab crew
      // stepped onto the docks' free stand spots beside the agents standing there, 0.6 m off)
      const [q] = freeGround(S.sc, { x: A.x, z: A.z, ry: A.ry }, 1, { near: .8, far: 4, skip: [A], from: { x: A.x, z: A.z }, stay: true }); if (q) { A.tx = q.x; A.tz = q.z; A.v = 1.2; } }
  }
  // (the crew's side: open ground in front of the door, for the guards, the shovers, the crew and the lookouts' marks below)
  const VAULT_FOOT = [[0, 1], [0, 2.4], [0, 3.6], [1.45, 2.4], [1.45, 3.6], [-1.75, 2.6], [-3.05, 2.6], [-1.75, 3.9], [2.7, 3.6], [0, 5]];
  function vaultFrame(sc) { const f = fightsOf(sc.night).rows.get(sc.eventId); if (!f) return null; const a = placeSpot(f, sc.eventId);
    return { f, a, V: { x: a.x, z: a.z, ry: openSide({ ...a, ry: a.ry ?? 0 }, VAULT_FOOT), y: SIDE } }; }
  // (the set begins once no passer-by stands on its ground, 4 s at most: its figures appeared inside the crowd walkers there, and a
  // walker already in a figure's room walks on through it, crowd.js WAY; seed 415 night 5)
  const vaultClear = sc => { const F = vaultFrame(sc); if (!F) return true; const pts = VAULT_FOOT.map(([x, z]) => toW(F.V, [x, 0, z]));
    return !C.psim.walkers.some(w => !w.agent && !w.gone && w.p && pts.some(q => Math.hypot(w.p[0] - q[0], w.p[2] - q[2]) < ROOM + .5)); };
  function vaultSet(S) {
    const sc = S.sc, VF = vaultFrame(sc); if (!VF) return; const { f, a, V } = VF; S.f = f; S.keep = true;
    const won = f.won, seed = seedOf(sc);
    const jobbers = (sc.roles?.jobbers ?? []).filter(id => sc.publicActors.includes(id)), guardIds = (sc.roles?.guards ?? []).filter(id => sc.publicActors.includes(id));
    const P = (x, z, back = false) => { const q = toW(V, [x, 0, z]); return { x: q[0], z: q[2], ry: V.ry + (back ? Math.PI : 0) }; };
    S.where = V; marks.set(sc.id, []);
    // the set: the wall and its round opening at the anchor, the crew's side toward the street; the door on its hinge (heist.md: the
    // hinge on the heaver's −x side, so on this frame's +x, 0.95 m out); the light inside, seen once the door opens
    const wall = putMesh(S, 'vault', geoM(vaultGeometry), V);
    const hinge = mesh('vaultHinge', () => { const g = new THREE.Group(), d = new THREE.Mesh(vaultDoorGeometry(THREE), vc()); d.scale.x = -1; g.add(d); return g; });
    if (hinge) { const q = toW(V, [-VAULT.hinge, 0, 0]); hinge.position.set(q[0], V.y, q[2]); hinge.rotation.set(0, V.ry, 0); S.meshes.push(hinge); }
    const glowIn = mesh('vaultGlow', () => new THREE.Mesh(new THREE.CircleGeometry(VAULT.r * .95, 24), new THREE.MeshBasicMaterial({ color: 0xffc56a, transparent: true, opacity: .0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })));
    if (glowIn) { const q = toW(V, [0, VAULT.cy, -.3]); glowIn.position.set(q[0], q[1], q[2]); glowIn.rotation.set(0, V.ry, 0); S.meshes.push(glowIn); }
    // (at night the crew's work light: a warm pool on the ground before the door and a wash on the wall round it, so the door, the drill
    // and its sparks read against the dark precinct; no light source, the pools are additive like the bench lamp's)
    if (NIGHT) { const g = mesh('vaultPool', poolM(0xffd8a0, 2.4, .16)); if (g) { const q = toW(V, [0, .02, 1.6]); g.position.set(q[0], q[1], q[2]); g.rotation.set(-Math.PI / 2, 0, 0); S.meshes.push(g); }
      const w = mesh('vaultWash', poolM(0xffe2b0, 1.9, .12)); if (w) { const q = toW(V, [0, VAULT.cy, VAULT.thick / 2 + .06]); w.position.set(q[0], q[1], q[2]); w.rotation.set(0, V.ry, 0); S.meshes.push(w); } }
    // the guards (the public guards' own walkers, else the precinct's officer) with their backs to the door; each with its shover 1.2 m
    // in front (vault_shove's pair); the rest of the crew to the −x side, 1.75 m and more off the carriers' way out; the public jobbers
    // wave from where they stand, unhooded, facing the street (sent to a street door 4.8 m out, a04 walked through the crew and stood
    // on the sidewalk's lane, seed 415 night 5)
    const total = f.sides.reduce((n, s) => n + s.count, 0), nCrew = Math.max(1, total - jobbers.length), G = guardIds.length ? guardIds : [null];
    S.sides = f.sides.map(s => ({ made: [], count: s.count, hooded: s.hooded, ids: s.ids, strength: s.strength }));
    const guards = G.map((gid, i) => { const p = P(1.45 + i * 1.25, 2.4); let A = gid ? borrow(gid) : null; if (A) { A.tx = p.x; A.tz = p.z; A.v = 1.3; A.faceTo = null; A.endRy = p.ry; } else A = standIn(sc, 'g' + i, p, 'officer'); if (A) { S.actors.push(A); A.mark = p; } return A; }).filter(Boolean);
    const crew = []; for (let k = 0; k < nCrew; k++) { const p = k < guards.length ? P(1.45 + k * 1.25, 3.6, true) : P(-1.75 - (k % 2) * 1.3, 2.6 + Math.floor(k / 2) * 1.3, true);
      const A = standIn(sc, 'c' + k, p, crewLook(S.sides[0], k)); if (A) { A.mark = p; crew.push(A); S.actors.push(A); S.sides[0]?.made.push(A); } }
    const look = jobbers.map(id => ({ id, A: null })), street = P(0, 9);
    const take = () => { for (const L of look) if (!L.A && !L.done) { L.A = borrow(L.id); if (L.A) { S.actors.push(L.A); L.A.faceTo = [street.x, street.z]; } } };
    take();
    for (const A of S.actors) marks.get(sc.id).push({ x: A.mark?.x ?? A.x, z: A.mark?.z ?? A.z });
    const spotsAt = (wide.places[f.standPlace ?? f.cityPlace]?.spots || []).filter(s => !s.over);
    S.at = spotsAt.length ? spotsAt.reduce((b, s) => Math.hypot(s.x - a.x, s.z - a.z) < Math.hypot(b.x - a.x, b.z - a.z) ? s : b) : null;
    const driller = crew[0], heaver = crew[1] ?? crew[0], drill = P(-.18, 1.01, true), heave = P(0, .52, true), mouth = P(0, 1.1, true), clear = P(0, 6.2);
    let done = new Set(), theta = 0, heaved = false, carryT = -1, out = 0;
    const go = (A, p) => { A.tx = p.x; A.tz = p.z; A.v = 1.3; A.faceTo = null; A.endRy = p.ry; A.clip = null; };
    const settle = A => { if (A.tx === null && A.endRy !== undefined && !A.path?.length) { A.ry = A.endRy; A.snap = true; A.endRy = undefined; return true; } return A.tx === null && A.endRy === undefined; };
    const carryB = sc.beats.find(x => x.name === 'carry');
    S.tick = (m, p, t) => {
      take(); const b = p >= 1 ? 'end' : beatIn(sc, m);
      // (C1-9b: begun after the carry began, a seek there: the crew is out with the sacks one at a time over the beat, and a seek can't
      // say which are still in the mouth, so the carriers are gone as at its end; the door stands open as far as the carry has it)
      if (!S.sought) { S.sought = true; if (carryB && (m - carryB.start) * GAME_MIN > LATE) { for (const A of [...new Set([heaver, driller, ...crew])]) if (A && !A.freed && A.kind === 'standin') C.free(A, { remove: true, now: true });
        carryT = t - (m - carryB.start) * GAME_MIN; heaved = true; done.add('carry'); } }
      for (const A of S.actors) if (!A.freed && !A.leaving) settle(A);
      for (const L of look) if (L.A && !L.A.freed && L.A.tx === null) L.A.clip = 'lookout_wave';
      if (!done.has(b)) { done.add(b);
        if (b === 'shove') guards.forEach((Gd, i) => { const A = crew[i]; if (!A) { Gd.clip = 'guard_post'; return; } if (won) { A.clip = 'vault_shove'; Gd.clip = 'guard_bowled'; } else { A.clip = 'deal_lookout'; Gd.clip = 'guard_post'; } });
        if (b === 'struggle') guards.forEach((Gd, i) => { const A = crew[i]; if (A) { A.clip = 'scuffle_pair'; Gd.clip = 'scuffle_partner'; } });
        if (b === 'drill' && driller) S.drillWait = true;
        // (the driller steps aside to ground with room first, and the heaver walks in once it has: the drill's and the heave's spots are
        // 0.52 m apart, and the two stood head in head)
        // (C1-7d: to its own side of the door, the guards' side, 1.5 m off the heave's spot and 1.6 m off the downed guard: stepped to free
        // ground on the crew's side it stood where the heaver walks in from the crew, 0.71 m, seed 406 night 14)
        if (b === 'heave' && heaver) { S.drillWait = false; if (heaver !== driller && driller) go(driller, P(1.5, .8, true)); S.heaveWait = true; }
        if (b === 'carry') carryT = t;
        // (C1-7d: the public jobbers are handed back at the payoff: on night 14 the jobber runs for the boat through Glasswall then, its walk)
        if (b === 'end') { S.paidAt = paid0(sc, m, t); if (!won) for (const A of crew) if (!A.freed) A.clip = 'cuffed_idle';
          if (sc.night === 14) for (const L of look) if (L.A && !L.A.freed) { C.free(L.A); S.actors.splice(S.actors.indexOf(L.A), 1); L.A = null; L.done = true; } } }
      if (S.paidAt !== undefined) clearOut(S, S.paidAt, t, { cuffed: won ? [] : crew });
      for (const [k, A] of crew.entries()) if (!A.freed && !A.leaving && A.tx === null && A.clip == null && b === 'shove' && k >= guards.length) A.clip = 'deal_lookout';
      // (C1-7d: the shover goes in to drill once its guard is down: on a short beat guard_bowled still stands when the drill begins, and
      // the shover walking past it to the drill came within 1.09 m, seed 406 night 14)
      if (S.drillWait && driller && !guards.some(Gd => !Gd.freed && Gd.now === 'guard_bowled')) { S.drillWait = false; go(driller, drill); }
      if (b === 'drill' && driller && !S.drillWait && !driller.freed && driller.tx === null && driller.clip !== 'vault_drill') driller.clip = 'vault_drill';
      // (the drill's sparks: every 1/24 s of the bit being in over the last 0.25 s, each a burst along vault_drill.sparks's spray; the door flickers)
      if (driller?.now === 'vault_drill' && driller.w.g?.clip?.w >= .6) { const tc = driller.nowT, D = CLIP.vault_drill.dur, sp = CLIP.vault_drill.sparks;
        for (let j = Math.ceil((tc - .25) * 24); j <= Math.floor(tc * 24); j++) { const tj = j / 24, s = sp(((tj % D) + D) % D); if (!s.on) continue;
          fx.sparks(hash(seed, 7, j), toW(driller.w, s.p), dirW(driller.w, s.d), tc - tj, { n: 6, speed: 4.5, cone: .9, size: .032, life: .25, grav: 7 }); }
        const s = sp(tc % D); if (s.on) fx.glow(toW(driller.w, s.p), .55 + .35 * (hash(seed, 9, Math.floor(tc * 30)) / 4294967296), 0xfff0c0, .9, C.camera); }
      if (S.heaveWait && (heaver === driller || !driller || driller.freed || driller.tx === null)) { S.heaveWait = false; go(heaver, heave); }
      if (b === 'heave' && heaver && !heaver.freed && !S.heaveWait && heaver.tx === null && heaver.clip !== 'vault_heave' && !heaved) { heaver.clip = 'vault_heave'; heaved = true; }
      if (heaver?.now === 'vault_heave') theta = CLIP.vault_heave.door.open(heaver.nowT); else if (heaved) theta = Math.max(theta, .55);
      // (wider only once the heaver has walked off its end spot, heist.md, and the crew goes in: 0.55 → 1.45 rad over 3 s)
      if (carryT >= 0) theta = Math.min(1.45, Math.max(theta, .55 + (t - carryT) / 3 * .9));
      if (hinge) hinge.children[0].rotation.y = theta; if (glowIn) glowIn.material.opacity = Math.min(.55, theta * .7);
      // carry: each stand-in in turn to the vault's mouth, then out with a sack (loot_carry) into the night
      // (one at a time: the next goes in once the last one out is clear of the crew and off along the lanes, so two never pass head to head)
      // (the heaver first: it stands in the door; the driller next)
      if (carryT >= 0) [...new Set([heaver, driller, ...crew])].filter(Boolean).forEach(A => { if (A.freed || A.leaving) return;
        if (!A.inVault) { if (S.inMouth || (S.lastOut && !S.lastOut.freed && !S.lastOut.leaving)) return; A.inVault = true; S.inMouth = A; go(A, mouth); return; }
        // (out of the mouth straight away from the door, between the guards and the crew, then off along the lanes)
        if (A.tx === null && S.inMouth === A && !A.outward) { A.outward = true; A.tx = clear.x; A.tz = clear.z; A.v = CLIP.loot_carry.speed; A.clip = 'loot_carry'; A.faceTo = null; S.inMouth = null; S.lastOut = A; return; }
        if (A.outward && A.tx === null) { leave(A, { clip: 'loot_carry', away: [V.x, V.z] }); C.free(A, { remove: true }); out++; } });
      dodge(S, crew.filter(A => !A.inVault && A !== driller && A !== heaver), t);
    };
  }
  function grabSet(S) {
    const sc = S.sc, F = fightsOf(sc.night), f = F.rows.get(sc.eventId); if (!f) return; S.f = f; S.keep = true;
    const won = f.won, seed = seedOf(sc), a = placeSpot(f, sc.eventId);
    // the crate on free ground of the quay, its long faces across the tug's line; the winner on the lift's spot (0.48 m short of its
    // middle), the loser 1.45 m on, facing him (grab.md "The docks")
    // (the line through it, the tug's two and the ram's fall beyond the loser, ROOM clear of everyone standing round: the first such turn of
    // the first such free spot; else the free spot as it is)
    const M = freeGround(sc, { ...a, ry: a.ry ?? 0 }, 6, { near: 0, far: 7 }); marks.set(sc.id, []);
    const lineAt = (q, ry) => { const dx = Math.sin(ry), dz = Math.cos(ry), W = { x: q.x - dx * .48, z: q.z - dz * .48, ry }, Lr = { x: W.x + dx * 1.45, z: W.z + dz * 1.45, ry: ry + Math.PI };
      const ok = [W, Lr, { x: Lr.x + dx * 1.2, z: Lr.z + dz * 1.2 }].every(p => !C.walkersNear(p.x, p.z, ROOM, []).length); return ok ? { c0: { x: q.x, z: q.z, ry }, W, Lr } : null; };
    let L0 = null; for (const q of M) { for (let k = 0; k < 4 && !L0; k++) L0 = lineAt(q, (a.ry ?? 0) + k * Math.PI / 2); if (L0) break; }
    const q0 = M[0] ?? a, { c0, W, Lr } = L0 ?? (() => { const ry = a.ry ?? 0, dx = Math.sin(ry), dz = Math.cos(ry), W = { x: q0.x - dx * .48, z: q0.z - dz * .48, ry }; return { c0: { x: q0.x, z: q0.z, ry }, W, Lr: { x: W.x + dx * 1.45, z: W.z + dz * 1.45, ry: ry + Math.PI } }; })();
    marks.get(sc.id).push({ x: c0.x, z: c0.z });
    S.where = c0; marks.get(sc.id).push(W, Lr, { x: Lr.x + Math.sin(c0.ry) * 1.2, z: Lr.z + Math.cos(c0.ry) * 1.2 });
    const crate = mesh('crate', crateM); if (crate) { crate.matrixAutoUpdate = false; crateMatrix(THREE, groundPose(c0.x, c0.z, c0.ry), crate.matrix); crate.matrixWorldNeedsUpdate = true; S.meshes.push(crate); }
    S.sides = f.sides.map(s => ({ made: [], count: s.count, hooded: s.hooded, ids: s.ids, strength: s.strength }));
    const named = sc.publicActors.filter(id => agents.map.has(id)), total = f.sides.reduce((n, s) => n + s.count, 0), nCrew = Math.max(won ? 2 : 1, total - named.length);
    const nCops = won ? 0 : Math.max(1, f.cops || 0), others = freeGround(sc, c0, Math.max(0, nCrew - 2) + nCops + named.length, { near: 1.7, far: 6 });
    const crew = []; for (let k = 0; k < nCrew; k++) { const side = S.sides[Math.min(S.sides.length - 1, k % Math.max(1, S.sides.length))], p = k === 0 ? W : k === 1 && won ? Lr : (o => ({ ...o, ry: facing(o, c0) }))(others.shift() ?? c0);
      const A = standIn(sc, 'c' + k, p, crewLook(side, k)); if (A) { A.faceTo = k < 2 && won ? null : [c0.x, c0.z]; A.ry = p.ry; A.snap = true; crew.push(A); S.actors.push(A); side?.made.push(A); } }
    const cops = []; for (let k = 0; k < nCops; k++) { const o = others.shift() ?? c0, A = standIn(sc, 'k' + k, { ...o, ry: facing(o, c0) }, 'officer'); if (A) { A.faceTo = [c0.x, c0.z]; cops.push(A); S.actors.push(A); } }
    const pub = named.map(id => ({ id, p: others.shift() ?? null, A: null }));
    // (a public grabber walks in once it is free: to a mark it has a clear way to from where it stands then, or it stays there. Sent
    // to the mark picked at the start, its straight walk passed the lead with the crate at 1.1 m, seed 404 night 2)
    const take = () => { for (const q of pub) if (!q.A && q.p) { q.A = borrow(q.id); if (q.A) { S.actors.push(q.A); const A = q.A;
      const [m] = freeGround(sc, c0, 1, { near: 1.7, far: 6, skip: [A], from: { x: A.x, z: A.z }, agent: true }); if (m) { A.tx = m.x; A.tz = m.z; A.v = 1.3; } A.faceTo = [c0.x, c0.z]; } } };
    take();
    const spotsAt = (wide.places[f.standPlace ?? f.cityPlace]?.spots || []).filter(s => !s.over);
    S.at = spotsAt.length ? spotsAt.reduce((b, s) => Math.hypot(s.x - c0.x, s.z - c0.z) < Math.hypot(b.x - c0.x, b.z - c0.z) ? s : b) : null;
    const lead = crew[0], rival = won ? crew[1] : null, rest = crew.slice(won ? 2 : 0), done = new Set();
    let punchAt = -1, ramFrom = null, carried = false, paidAt = null;
    S.tick = (m, p, t) => {
      take(); const b = p >= 1 ? 'end' : beatIn(sc, m);
      // (the scramble's fists, every 3.2 s: punches and wound-up haymakers round the crate, each turned to it)
      const brawl = [...rest, ...cops, ...pub.map(q => q.A).filter(A => A && !A.freed && A.tx === null)];
      if ((b === 'scramble' || b === 'struggle' || (won && (b === 'tug' || b === 'ram'))) && (punchAt < 0 || t - punchAt > 3.2)) { punchAt = t;
        brawl.forEach((A, k) => { if (A.freed || A.leaving) return; A.clip = b === 'struggle' ? (cops.includes(A) ? 'scuffle_partner' : 'scuffle_pair') : pub.some(q => q.A === A) && b !== 'scramble' ? 'deal_lookout' : k % 2 ? 'punch' : 'haymaker_wind'; });
        if (b === 'scramble' && won) { lead.clip = 'punch'; if (rival) rival.clip = 'haymaker_wind'; } }
      // (C1-9b: every beat due by the minute, in order: a seek past a beat still does what it did — the lead gone with the crate)
      for (const [b, b0] of dueBeats(sc, m, p)) if (!done.has(b)) { done.add(b);
        if (b === 'tug' && lead && rival) { lead.faceTo = null; rival.faceTo = null; lead.ry = W.ry; rival.ry = Lr.ry; lead.snap = rival.snap = true; lead.clip = 'crate_tug'; rival.clip = 'crate_tug_lose'; }
        if (b === 'ram' && lead && rival) { const hx = lead.x + Math.sin(lead.ry) * 1.15, hz = lead.z + Math.cos(lead.ry) * 1.15; ramFrom = { x: hx, z: hz }; rival.tx = hx; rival.tz = hz; rival.v = 1.6; rival.clip = null; rival.faceTo = null; rival.endRy = lead.ry + Math.PI; }
        if (b === 'carry' && lead) { carried = true; leave(lead, { clip: 'crate_run', away: [rival?.x ?? c0.x, rival?.z ?? c0.z], late: (m - b0) * GAME_MIN }); C.free(lead, { remove: true }); }
        if (b === 'end') { paidAt = paid0(sc, m, t); if (!won) for (const A of cops) A.clip = 'guard_post'; } }
      // (the ram: the rival back in front of the holder, both started on the same frame; he goes down, shove_fall → lie_hurt)
      if (b === 'ram' && rival && !rival.freed && rival.endRy !== undefined && rival.tx === null) { rival.ry = rival.endRy; rival.snap = true; rival.endRy = undefined; rival.clip = 'crate_rammed'; lead.clip = 'crate_ram'; }
      dodge(S, [...rest, ...cops], t);
      if (crate) crate.visible = !(lead?.now?.startsWith('crate_') && lead.w.g?.clip?.w >= .6) && !carried;
      // (the dust where the rival lands)
      if (rival?.now === 'shove_fall') { const age = rival.nowT - .7; if (age >= 0 && age < .9) fx.dust(hash(seed, 5), toW(rival.w, [0, 0, -.9]), age, { n: 10, size: .14 }); }
      // after the scene: the crew goes on foot (a lost one flees the officers), the public grabbers are handed back 3 s on
      if (paidAt !== null && t - paidAt > 3 && !S.fled) { S.fled = true; for (const A of [...rest, ...(won ? [] : crew)]) if (!A.freed && !A.leaving) { leave(A, { v: 1.8, clip: won ? null : 'flee_run', late: t - paidAt - 3 }); C.free(A, { remove: true }); } }
      if (paidAt !== null) clearOut(S, paidAt, t);
    };
  }
  function arrestNow(S, e, held) {
      const sc = S.sc;
      let A = held;
      // (the arrested on clear ground, facing so the officer's way up from behind is clear too)
      const measured = (wide.places[sc.place.standPlace ?? sc.place.cityPlace]?.spots || []).filter(s => !s.over);
      let a = A ? { x: A.x, z: A.z, ry: A.ry } : placeSpot(sc.place, sc.id);
      // (C1-7d: night 14's dock arrest is taken aside onto the quay's edge past her stern, clear of the boarding line and of the docks' stand spots where the whole
      // finale stands, a cut: cuffed at its own spot it stood 0.9 m from its neighbours, seed 406 night 14)
      const dockMark = sc.night === 14 && sc.place.cityPlace === 'docks' ? { x: GANGWAY.foot.x - QUAY.dx * 3.2, z: GANGWAY.foot.z + .3 } : null;
      const toMark = B => { B.x = dockMark.x; B.z = dockMark.z; B.tx = null; B.path = []; B.snap = true; B.ry = Math.PI; };
      if (A && dockMark) { toMark(A); a = { ...a, ...dockMark, ry: Math.PI }; }
      else if (A) { const c = clearStep(S, A); a = { ...a, x: c.x, z: c.z }; }
      else { const [q] = freeGround(sc, a, 1, { near: 0, far: 5 }); if (q) a = { ...a, ...q }; A = standIn(sc, 's', a, 'hooded'); }
      if (!A) return; S.actors.push(A); S.where = a;
      const [kb] = freeGround(sc, { ...a, ry: a.ry + Math.PI }, 1, { rings: [1.22], skip: [A] }), ry = kb ? facing(kb, a) : a.ry;
      A.faceTo = [a.x + Math.sin(ry) * 3, a.z + Math.cos(ry) * 3];
      // (the arresting Cop's own walker when it is near and not inside its own play's window; it is handed back once the cuffs are on)
      const cop = e?.by && sc.publicActors.includes(e.by) ? agents.map.get(e.by) : null, near = cop?.w && !cop.rec?.show && Math.hypot(cop.w.p[0] - a.x, cop.w.p[2] - a.z) < 30;
      const back = kb ?? ahead({ x: a.x, z: a.z, ry }, -1.22);
      let K = near ? C.actor(e.by) : null;
      // (an officer stand-in walks up the suspect's back axis from farther out on it, its way in ROOM clear of everyone else; with no
      // such ground it starts behind the suspect. From free ground off the axis its walk in passed beside the suspect, heads 1.02 m
      // apart: a16's and a12's arrests, seed 404 night 2)
      if (!K) { let O = null; try { O = C.occ(a.x, a.z, 6); } catch {} const y0 = floorOf(O, a, 2), others = C.walkersNear(a.x, a.z, 6 + ROOM, [A]).map(([x, z]) => ({ x, z }));
        const floor = q => !O || y0 === null || [[0, 0], [.35, 0], [-.35, 0], [0, .35], [0, -.35]].every(([ox, oz]) => { const y = O.at(q.x + ox, q.z + oz); return y !== null && Math.abs(y - y0) < .12; });
        const from = [3.2, 2.6, 3.8, 2].map(d => ahead({ x: a.x, z: a.z, ry }, -d)).find(q => floor(q) && !markedNear(q.x, q.z, ROOM) && others.every(o => segD(o.x, o.z, q, back) >= ROOM)) ?? back;
        K = standIn(sc, 'k', { ...from, ry }, 'officer'); }
      // (it walks up once the arrested stands on its mark: never into it while it steps clear)
      if (K) S.actors.push(K); let sent = false;
      // (at the close the cruiser takes them: the jail's cut, draw.js; its stand-ins go with it, in the car, as the cruiser goes)
      const car = cruiserAt(a.x, a.z); if (car) S.meshes.push(car); S.keep = true; S.byCar = true;
      let cuff = -1;
      S.tick = (m, p, t) => {
        // (C1-7d: taken back after its walker was placed anew — the cut of its walk to the docks — it is put on the quay's mark again)
        if (A.freed && A.kind === 'held') { if (dockMark && m >= sc.end) return; const B = borrow(A.h); if (!B) return; S.actors.splice(S.actors.indexOf(A), 1); A = B; S.actors.push(B); if (dockMark) toMark(B); }
        if (K?.freed) K = null;
        if (!K) { A.clip = 'cuffed_idle'; return; }
        // (still not there after 6 s: the officer comes up behind it where it stands; one stopped off its place's ground, away from its
        // measured stand spots, is put on its mark outright instead, as a late trip cuts to its arrival)
        if (!sent) { S.t1 ??= t; if (A.tx !== null && t - S.t1 < 6) { A.clip = 'deal_lookout'; return; }
          // (and turned away: two head boxes clear 1.22 m apart only in line; with the suspect still turning, the officer walking in met
          // it at 1.21 m, a22's arrest, seed 404 night 8. 2 s at most, then it is put facing away)
          const off = A.w ? Math.abs(Math.atan2(Math.sin(yawOf(A.w) - ry), Math.cos(yawOf(A.w) - ry))) : 0;
          if (off > .15 && t - S.t1 < 2) { A.clip = 'deal_lookout'; return; } A.ry = ry; A.snap = true; sent = true;
          if (A.tx !== null && measured.length && !measured.some(s => Math.hypot(s.x - A.x, s.z - A.z) <= 1.4)) { A.x = A.tx; A.z = A.tz; }
          // (it comes in along the suspect's back axis: first 0.9 m farther out on it, then straight in, so its head never passes the suspect's;
          // straight in when someone stands there)
          const b = { x: A.x + back.x - a.x, z: A.z + back.z - a.z }, ux = b.x - A.x, uz = b.z - A.z, ul = Math.hypot(ux, uz) || 1, pre = { x: b.x + ux / ul * .9, z: b.z + uz / ul * .9 };
          const clear = !C.walkersNear(pre.x, pre.z, ROOM, [A, K]).length;
          A.tx = null; A.tz = null; if (clear) { K.tx = pre.x; K.tz = pre.z; K.path = [[b.x, b.z]]; } else { K.tx = b.x; K.tz = b.z; } K.v = 1.8; }
        if (cuff < 0 && K.tx === null && !K.path?.length) { cuff = t; K.faceTo = null; K.ry = ry; A.ry = ry; K.snap = true; }
        if (cuff < 0) { A.clip = 'deal_lookout'; K.clip = null; return; }
        K.clip = t - cuff < 2.61 ? 'cuff_apply' : 'guard_post'; A.clip = t - cuff < .45 ? 'deal_lookout' : 'cuffed_idle';
        if (K.kind === 'held' && t - cuff > 4 && !K.freed) { C.free(K); S.actors.splice(S.actors.indexOf(K), 1); K = null; } };
  }
  // a fight: the anonymous sides as stand-ins round its place, the public target (when drawn) borrowed; the outcome after its payoff
  function fight(S) {
    const sc = S.sc, F = fightsOf(sc.night), f = F.rows.get(sc.eventId); if (!f) return;
    S.f = f; S.keep = true;
    // (at the fight's own place, placement.js fightsAt's; its public target joins it only when it stands within 6 m of it)
    let a = placeSpot(f, sc.eventId); const tw = f.target ? agents.map.get(f.target)?.w : null, close = !!tw && Math.hypot(tw.p[0] - a.x, tw.p[2] - a.z) < 6;
    const V = close && sc.publicActors.includes(f.target) && f.kind !== 'breakin' ? borrow(f.target) : null;
    // (a target that steps to clear ground: its attackers stand beyond it, the way it walks, never across its way there)
    S.where = a; if (V) { S.actors.push(V); const o = { x: V.x, z: V.z }, c = clearStep(S, V); if (c) S.where = a = { ...a, x: c.x, z: c.z, ry: Math.hypot(c.x - o.x, c.z - o.z) > .1 ? facing(o, c) : V.ry }; } S.V = V;
    S.want = close && sc.publicActors.includes(f.target) && f.kind !== 'breakin' && !V ? f.target : null;
    const kind = f.kind === 'hit' || f.kind === 'breakin' ? 'hooded' : f.kind === 'collar' ? 'officer' : 'hooded';
    // (the stand-ins on free ground: round the target at arm's length when it is drawn, else round the fight's place, its two sides
    // facing each other across it; a break-in's at the door as before)
    const want = f.sides.map(s => s.count - s.ids.length), total = want.reduce((x, y) => x + y, 0);
    // (C1-7d: the lunge and the punches reach: 1.8 m off the walkers' lanes, not 1.35, where there is the ground — seed 406 night 14's
    // route fight lunged at a passer-by 1.1 m off)
    const M = f.kind === 'breakin' ? [] : V ? freeGround(sc, a, total, { rings: [1.15, 1.6, 2.1, 2.6], skip: [V], lane: 1.8 }) : freeGround(sc, a, total, { near: .7, far: 6, lane: 1.8 });
    if (!V && M.length) { const cx = M.reduce((x, m) => x + m.x, 0) / M.length, cz = M.reduce((x, m) => x + m.z, 0) / M.length, ax = Math.sin(a.ry), az = Math.cos(a.ry);
      M.sort((p, q) => ((p.x - cx) * ax + (p.z - cz) * az) - ((q.x - cx) * ax + (q.z - cz) * az)); S.where = a = { ...a, x: cx, z: cz }; }
    // (the measured stand spot it stands at, the nearest the figures' middle: what drawn() reports for placecheck; a lot reports its centre)
    const spotsAt = (wide.places[f.standPlace ?? f.cityPlace]?.spots || []).filter(s => !s.over);
    S.at = f.lot || !spotsAt.length ? null : spotsAt.reduce((b, s) => Math.hypot(s.x - a.x, s.z - a.z) < Math.hypot(b.x - a.x, b.z - a.z) ? s : b);
    let used = 0;
    // (a break-in's figures fan out from the door by their place among every side's, so two sides never share a mark: the first at the
    // door, r0 m out, the rest 2 m out, 0.9 rad apart — 1.37 m from the first and 1.74 m from each other at the least. At 1.6 m and
    // fanned by the place in its own side the door's walk-up put two sides' figures 0.71 m apart, seed 415 night 5)
    const fan = (g, r0) => { const r = g ? 2 : r0, ang = a.ry + (g ? (g - 1 - (total - 2) / 2) * .9 : 0); return { x: a.x + Math.sin(ang) * r, z: a.z + Math.cos(ang) * r, ry: a.ry }; };
    S.sides = f.sides.map((s, i) => { const n = want[i], made = [];
      for (let k = 0; k < n; k++) { const g = f.kind === 'breakin' ? used++ : 0, p = f.kind === 'breakin' ? fan(g, .7)
          : (q => ({ ...q, ry: facing(q, a) }))(M[used++] ?? a);
        const A = standIn(sc, `${i}:${k}`, p, f.kind === 'corner' && !s.hooded ? 'crew:' + (k % 4) : kind); if (A) { A.faceTo = [a.x, a.z]; A.g = g; made.push(A); S.actors.push(A); } }
      return { made, count: s.ids.length + made.length, hooded: s.hooded ? made.length : 0, ids: s.ids, strength: s.strength }; });
    if (f.kind === 'grab') { const c = mesh('crate', crateM); if (c) { c.matrixAutoUpdate = false; crateMatrix(THREE, groundPose(a.x, a.z, a.ry), c.matrix); c.matrixWorldNeedsUpdate = true; S.meshes.push(c); S.crate = c; } }
    if (f.kind === 'breakin' && a.door) { const h = a.door, made = S.sides[0]?.made || [];
      made.forEach(A => { const q = fan(A.g, .62); A.tx = q.x; A.tz = q.z; A.v = 1.2; A.faceTo = null; S.faceAfter = [h.door[0], h.door[2]]; }); }
    let paid = false, paidAt = 0, beatAt = -1;
    S.tick = (m, p, t) => {
      // (the target not standing yet when the scene began: it joins where it stands)
      if (S.want && !S.V && !paid) { const B = borrow(S.want); if (B) { S.V = B; S.actors.push(B); S.want = null; } }
      // (after the payoff the target is handed back to its place and its own loops, 3 s on)
      if (paid && S.V && t - paidAt > 3 && !S.V.freed) { C.free(S.V); S.actors.splice(S.actors.indexOf(S.V), 1); S.V = null; }
      const att = S.sides[0]?.made || [], other = S.sides[1]?.made || [], won = f.won, V = S.V;
      if (S.faceAfter && S.actors.every(A => A.tx === null)) { for (const A of S.actors) if (A !== V) A.faceTo = S.faceAfter; S.faceAfter = null; }
      if (p < 1) {
        // the fight, before its payoff: no outcome shown
        if (f.kind === 'breakin') { att.forEach((A, k) => { A.clip = k ? 'lookout_wave' : p < .55 ? 'pick_lock' : 'flashlight_search'; });
          if (p >= .55 && !S.torch && a.door) { const v = VIGNETTES.burglary.start(C, { type: 'burgle', at: f.cityPlace, ok: true, who: null }, { x: a.door.door[0], z: a.door.door[2], home: a.door }); if (v) { S.subs = [stage.run(v, 'burglary')]; } S.torch = true; } return; }
        if (beatAt < 0 || t - beatAt > 3.2) { beatAt = t;
          if (f.kind === 'grab') { att.forEach((A, k) => { A.clip = k % 2 ? 'punch' : 'haymaker_wind'; }); other.forEach((A, k) => { A.clip = k % 2 ? 'haymaker_wind' : 'punch'; }); }
          else if (f.kind === 'collar') { att.forEach(A => { A.clip = 'scuffle_pair'; if (V) A.faceTo = [V.x, V.z]; }); if (V) V.clip = 'scuffle_partner'; }
          else { att.forEach((A, k) => { A.clip = beatAt === t && t < 1 ? 'rob_lunge_grab' : k % 2 ? 'punch' : 'haymaker_wind'; if (V) A.faceTo = [V.x, V.z]; }); if (V) { V.faceTo = att[0] ? [att[0].x, att[0].z] : null; V.clip = 'stagger'; } } }
        return; }
      // (4 s after the payoff the stand-ins still there go on foot, the haul with the winners: out of view before the show closes, so
      // a jump to the next show — shows back to back — never takes them away in view)
      if (paid) { if (!S.gone && t - paidAt > 4) { S.gone = true; const win = f.kind === 'grab' ? (won ? att : other) : [];
          for (const A of [...att, ...other]) { if (A.freed) continue; leave(A, { v: 1.8, clip: A === win[0] ? 'crate_run' : win.includes(A) ? 'run_getaway' : null, late: t - paidAt - 4 }); C.free(A, { remove: true }); } }
        return; }
      paid = true; paidAt = paid0(sc, m, t);
      // the payoff: the scene's result is public now (show-plan.js releases it at this scene's end)
      if (f.kind === 'grab') { const win = won ? att : other, lose = won ? other : att; win.forEach((A, k) => { A.clip = k ? 'lookout_wave' : 'crate_lift'; }); lose.forEach(A => { A.clip = 'winded_rest'; }); if (S.crate && win.length) S.crate.visible = false; }
      else if (f.kind === 'collar') { att.forEach(A => { A.clip = won ? 'patrol_walk' : 'winded_rest'; }); if (V) V.clip = won ? 'cower' : 'winded_rest'; }
      else { if (V) V.clip = won ? 'cower' : 'winded_rest'; S.flee = won ? 'run_getaway' : 'flee_run';
        // the hooded leave on foot with (or without) the haul, out of view first; the scene stays as its aftermath until the close
        for (const A of att) { leave(A, { v: 2.2, clip: S.flee, late: t - paidAt }); C.free(A, { remove: true }); } }
    };
  }
  // ── C1-7d · THE BOARDING LINE (night 14, SHOW.md "Finale and day 15": boarding 10–13, the ferry's leave 13.25–14). Every board scene's
  // boarder in board order: from boarding's start the next QMAX in line stand in a queue along the quay's edge from the gangway's foot
  // (second-chance.js GANGWAY, QUAY), each one slot on as the one ahead starts up; the rest wait where placement has them (the docks'
  // stand spots). In its gangway beat a boarder goes up the gangway with everything it owns (evicted_carry), over the deck to the cabin's
  // door, a function of the beat's clock (a seek lands it on the same step), and goes below: held out of sight under her deck until her
  // leave beat, when placement's `departed` takes its walker (draw.js). An unseen boarder is a hooded stand-in, never named (D9 (c)),
  // gone on foot below once aboard. A named boarder still on its trip to the docks joins when it stands there; at its gangway beat a late
  // one cuts to the gangway (GAME.md §20)
  const QMAX = 12, slotAt = i => ({ x: GANGWAY.foot.x + QUAY.dx * (1.3 + 1.4 * i), z: GANGWAY.foot.z + QUAY.dz * (1.3 + 1.4 * i), y: SIDE });
  let line = null;
  function lineOf(plan) {
    const list = plan.scenes.filter(sc => sc.kind === 'board' && sc.beat === 'finale').sort((a, b) => a.start - b.start), ferry = plan.scenes.find(sc => sc.kind === 'ferry');
    const leave = ferry?.beats?.find(b => b.name === 'leave') ?? ferry ?? null; if (!list.length || !leave) return null;
    return { night: plan.night, start: list[0].start, leave, rows: list.map((sc, k) => ({ sc, k, id: sc.publicActors[0] ?? null, g0: sc.beats?.find(b => b.name === 'gangway')?.start ?? sc.start, A: null })), by: new Map(), run: null, actors: [] };
  }
  const climb = (B, u) => { const P = [slotAt(0), GANGWAY.foot, GANGWAY.top, GANGWAY.door], D = [0]; for (let i = 1; i < P.length; i++) D.push(D[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z, (P[i].y ?? SIDE) - (P[i - 1].y ?? SIDE)));
    const d = D.at(-1) * Math.max(0, Math.min(1, u)); let i = 1; while (i < D.length - 1 && D[i] < d) i++; const f = (d - D[i - 1]) / Math.max(1e-6, D[i] - D[i - 1]), a = P[i - 1], b = P[i];
    return { x: a.x + (b.x - a.x) * f, y: (a.y ?? SIDE) + ((b.y ?? SIDE) - (a.y ?? SIDE)) * f, z: a.z + (b.z - a.z) * f, ry: Math.atan2(b.x - a.x, b.z - a.z) }; };
  function lineStep(m, reset) {
    const L = line; if (!L) return;
    const over = m < L.start || m >= L.leave.start;
    // (her leave beat: everyone below goes with her — removed there, out of sight in her hull (inCar: stage/index.js seen(), the arrest's
    // cruiser's rule), so the walker is gone as placement's departed says, draw.js; a seek back before boarding hands them back)
    if (over) { if (m >= L.leave.start) for (const B of L.rows) if (B.A && !B.A.freed) { B.A.inCar = true; C.free(B.A, { remove: true, now: true }); } endLine(false); return; }
    const going = L.rows.filter(B => m >= B.g0).length;
    for (const B of L.rows) {
      const done = m >= B.sc.end, up = !done && m >= B.g0, qi = B.k - going;
      if (!B.A && (done || up || qi < QMAX)) {
        // (into the line only with room round it: the docks' stand spots and the spots 1 m beside them hold the whole finale, and a borrowed
        // walker is a figure the probe holds to ROOM — a07 taken beside a26 on its side spot, 0.78 m, seed 404 night 14. Its gangway beat
        // takes it all the same, straight onto the gangway)
        if (B.id) { const a = agents.map.get(B.id), roomy = a?.w && (up || done || !C.walkersNear(a.w.p[0], a.w.p[2], ROOM, []).some(([, , w]) => w !== a.w));
          if (roomy && a.mode === 'stand' && !a.step && !a.rec?.trip && !C.busy(B.id)) { B.A = C.actor(B.id); if (B.A) { L.actors.push(B.A); B.snap = reset || up || done; } } }
        else if (!done && !(qi >= 0 && L.actors.some(O => !O.freed && Math.hypot(O.x - slotAt(Math.min(QMAX - 1, qi)).x, O.z - slotAt(Math.min(QMAX - 1, qi)).z) < ROOM))) { const p = slotAt(Math.max(0, Math.min(QMAX - 1, qi))); B.A = standIn(B.sc, 'b', { ...p, ry: facing(p, GANGWAY.foot) }, 'hooded'); if (B.A) { L.actors.push(B.A); B.A.look = lookOf('hooded'); } }
        if (B.A) L.by.set(B.sc.id, B);
      }
      const A = B.A; if (!A || A.freed) continue;
      if (done) { if (B.state !== 'below') { B.state = 'below'; const q = below(B.k); A.x = q.x; A.z = q.z; A.y = q.y; A.tx = null; A.path = []; A.faceTo = null; A.clip = 'deal_lookout'; A.snap = true;
          if (A.kind === 'standin') { A.inCar = true; C.free(A, { remove: true, now: true }); } } continue; }
      if (up) { const q = climb(B, (m - B.g0) / Math.max(1e-6, B.sc.end - B.g0)); B.state = 'up'; A.tx = null; A.path = []; A.x = q.x; A.y = q.y; A.z = q.z; A.ry = q.ry; A.faceTo = null; A.snap = true; A.clip = 'evicted_carry'; continue; }
      const p = slotAt(Math.max(0, qi));
      if (B.snap || B.state === undefined && Math.hypot(A.x - p.x, A.z - p.z) < .1) { A.x = p.x; A.z = p.z; A.tx = null; B.snap = false; }
      // (into the line by its gangway beat, on the clock as it runs: a walker's pace, a hurry when it must, else a cut to its place in the
      // line, as a late trip cuts to its arrival, GAME.md §20)
      // (only into an empty place in the line: cut in beside the one still stepping out of it, a18 stood in a17, seed 404 night 14; a step
      // up the line is a walk)
      else if (B.slot !== qi) { const first = B.slot === undefined, w = first ? wayAround(A, p, line.actors) : null, len = w?.length ? w.reduce((d, q, k) => d + Math.hypot(q[0] - (k ? w[k - 1][0] : A.x), q[1] - (k ? w[k - 1][1] : A.z)), 0) : Math.hypot(p.x - A.x, p.z - A.z);
        const v = first ? Math.max(1.3, len / Math.max(.01, (B.g0 - m) * GAME_MIN)) : 1.3, free = !L.actors.some(O => O !== A && !O.freed && Math.hypot(O.x - p.x, O.z - p.z) < ROOM);
        if (v > 2.4 && free) { A.x = p.x; A.z = p.z; A.tx = null; A.path = []; A.snap = true; } else if (w?.length) { A.tx = null; A.path = w; A.v = Math.min(2.4, v); } else { A.path = []; A.tx = p.x; A.tz = p.z; A.v = Math.min(2.4, v); } A.clip = null; A.faceTo = null; }
      B.slot = qi; B.state = 'queue';
      if (A.tx === null && !A.path?.length) { A.faceTo = [GANGWAY.foot.x, GANGWAY.foot.z]; A.clip = 'deal_lookout'; }
    }
  }
  // (the walk into the line: the shortest way on the quay's floor, a 0.5 m grid round it, ROOM clear of everyone standing there (the agents
  // on the docks' stand spots: walked straight, a07 passed a26 heads 0.76 m apart, seed 404 night 14), the line's own movers aside;
  // its corners only. No such way: straight)
  function wayAround(A, to, skip) {
    const R = Math.min(30, Math.hypot(to.x - A.x, to.z - A.z) + 5), h = .5, N = Math.round(2 * R / h) + 1, x0 = A.x - R, z0 = A.z - R;
    const people = C.walkersNear(A.x, A.z, R + ROOM, skip).filter(([, , w]) => !(w.vc > .1)).map(([x, z]) => ({ x, z }));
    let O = null; try { O = C.occ(A.x, A.z, Math.min(14, R + 1)); } catch {} const y0 = floorOf(O, A, 1.5);
    const G = new Uint8Array(N * N), cell = (x, z) => [Math.round((x - x0) / h), Math.round((z - z0) / h)];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + i * h, z = z0 + j * h, d0 = Math.hypot(x - A.x, z - A.z); if (d0 > R) continue;
      if (O && y0 !== null) { const y = O.at(x, z); if (y !== null && Math.abs(y - y0) > .2) continue; }
      if (d0 > 1 && people.some(q => Math.hypot(q.x - x, q.z - z) < ROOM)) continue; G[j * N + i] = 1; }
    const [si, sj] = cell(A.x, A.z), [gi, gj] = cell(to.x, to.z), start = sj * N + si, goal = gj * N + gi; if (gi < 0 || gj < 0 || gi >= N || gj >= N) return null; G[goal] = 1;
    const prev = new Int32Array(N * N).fill(-1); prev[start] = start; let hit = false;
    for (let Q = [start], k = 0; k < Q.length && !hit; k++) { const c = Q[k], ci = c % N, cj = (c - ci) / N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const n = j * N + i; if (prev[n] >= 0 || !G[n]) continue; prev[n] = c; if (n === goal) { hit = true; break; } Q.push(n); } }
    if (!hit) return null;
    const way = []; for (let c = goal; c !== start; c = prev[c]) way.unshift([x0 + (c % N) * h, z0 + Math.floor(c / N) * h]); way[way.length - 1] = [to.x, to.z];
    const open = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / .25); for (let k = 0; k <= n; k++) { const [i, j] = cell(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); if (!G[j * N + i]) return false; } return true; };
    const legs = []; let last = [A.x, A.z]; for (let k = 0; k < way.length; k++) if (k === way.length - 1 || !open(last, way[k + 1])) { legs.push(way[k]); last = way[k]; }
    return legs;
  }
  function endLine(abort) { const L = line; if (!L?.run) return; L.run.alive = false; }
  function lineRun() {
    const L = line; if (!L || L.run) return;
    const v = { alive: true, actors: L.actors, ev: { who: null }, step: () => v.alive, end: abort => { for (const A of L.actors) if (!A.freed) C.free(A, { remove: A.kind === 'standin', now: abort }); L.actors.length = 0; for (const B of L.rows) { B.A = null; B.state = undefined; B.slot = undefined; } L.by.clear(); if (L.run === v) L.run = null; } };
    L.run = stage.run(v, 'record:boarding');
  }
  // per update: the scenes of the show on now (a seek starts them over); a fight, an arrest and lay low stay until the close
  // (C1-9b: a queued scene waits for its agent to be placed on the page's own seconds: the stage's clock, island seconds, stands
  // still while the record is paused, and a seek there would never begin it)
  const pageS = () => performance.now() / 1000;
  let cur = null, lastM = null;
  function update(minute, reset) {
    // (C1-7d: the per-scene shortage goes with the marks: kept over a seek, a scene's partner() read the last staging's shortage and drew
    // no partner, or another one, on the next — two seeks to one minute staged different figures, seed 404 at 2706.29)
    // (C1-9b: a stand-in already leaving keeps walking off across a seek forward; a seek back is to before it left: it goes)
    const back = lastM !== null && minute < lastM; lastM = minute;
    if (reset) { stage.abortAll({ keepLeaving: !back }); live.clear(); queued.clear(); taken.clear(); marks.clear(); shortBy.clear(); faces.clear(); for (const list of pool.values()) list.forEach(release); fx.clear(); }
    const show = player.snapshot().show ?? null; cur = show;
    // (C1-7: day 15's mint, planner.stagingAt's: its three-minute tail after the dawn frame)
    const mint = show ? null : (() => { try { return planner.stagingAt?.(minute)?.day === 15 ? planner.day(15) : null; } catch { return null; } })();
    const plan = show ? planner.night(show.night) : mint, want = new Set();
    // (C1-7d: night 14's boarding line, from boarding's start to her leave beat)
    const L0 = show?.night === 14 ? (line?.night === 14 ? line : (line = lineOf(plan))) : line;
    if (L0 && minute >= L0.start && minute < L0.leave.start) { if (reset || !L0.run) lineRun(); } else if (L0?.run) lineStep(minute, false);
    if (plan) for (const sc of plan.scenes) if (sc.start <= minute && (minute < sc.end || ((sc.beat === 'fight' || sc.beat === 'arrest' || sc.kind === 'laylow') && minute < plan.end))) want.add(sc.id);
    for (const [id, S] of live) if (!want.has(id)) { S.alive = false; }
    for (const id of queued.keys()) if (!want.has(id)) queued.delete(id);
    if (plan) for (const sc of plan.scenes) if (want.has(sc.id) && !live.has(sc.id) && !queued.has(sc.id)) queued.set(sc.id, { sc, minute, at: pageS() });
    start();
  }
  // a queued scene begins once its named agent stands at its place (a cut trip places it on the next frames), 1.5 s at most
  function start() {
    for (const [id, q] of queued) {
      const who = q.sc.beat === 'ambient' ? q.sc.publicActors[0] : q.sc.beat === 'fight' ? fightsOf(q.sc.night).rows.get(q.sc.eventId)?.target : null, a = who && q.sc.publicActors.includes(who) ? agents.map.get(who) : null;
      if (a && !(a.w && a.mode === 'stand' && a.spot && !a.step) && pageS() - q.at < 1.5) continue;
      if (q.sc.kind === 'vault' && q.sc.beats?.length && pageS() - q.at < 4 && !vaultClear(q.sc)) continue;
      queued.delete(id);
      try { begin(q.sc, player.minute); } catch (e) { log('record scene ' + id + ': ' + (e && e.stack || e)); }
    }
  }
  // per frame: the scenes' log for the named plays the loops play (the agent's walker, its clip, while its row names the scene)
  function frame() {
    fx.commit(); venueProps();
    if (line?.run?.alive) lineStep(player.minute, false);
    if (queued.size) start();
    if (!cur) return false;
    const m = player.minute;
    for (const s of cur.active) {
      if (!((s.beat === 'ambient' && s.kind !== 'hooded') || s.kind === 'walk') || !s.publicActors.length) { if (s.kind === 'results') note(s, m, {}); continue; }
      const id = s.publicActors[0], a = agents.map.get(id); if (!a?.w) continue;
      const clip = a.w.g?.clip?.name ?? a.w.mv?.clip ?? a.life?.cur?.clip ?? null, mine = a.rec?.show?.sceneId === s.id || (s.kind === 'laylow' && a.held);
      // (placed outright by a cut trip, life would wait up to its first-wait, 5 s, before the first loop: the scene starts at once)
      if (mine && a.life && a.life.wait > 0 && a.life.showFor !== s.id) { a.life.wait = 0; a.life.showFor = s.id; }
      const there = a.mode === 'stand' && !a.step;
      if (mine) note(s, m, { actor: id, clip: clip && clipsFor(s).includes(clip) ? clip : null, x: there ? a.w.p[0] : null, z: there ? a.w.p[2] : null });
    }
    return false;
  }
  // the fights whose result is public now, as placecheck's checkDrawn reads them ({ eventId, kind, cityPlace, lot, sides, defence, x, z })
  function drawn() {
    const snap = player.snapshot(), night = snap.reveal?.night; if (night == null) return [];
    const pub = new Map(fightsAt(snap, night).map(f => [f.eventId, f]));
    return [...live.values()].filter(S => S.alive && S.f && pub.has(S.f.eventId)).map(S => { const f = pub.get(S.f.eventId);
      // (where it is staged: a lot's own id, else the measured exterior it stands at, as C1-3's scenes reported it)
      return { eventId: f.eventId, kind: f.kind, cityPlace: f.lot ? f.cityPlace : f.standPlace ?? f.cityPlace, lot: f.lot ?? null,
        sides: S.sides.map((s, i) => ({ ids: f.sides[i]?.ids ?? [], count: s.count, hooded: s.hooded, strength: s.strength })),
        defence: { ids: f.target && agents.map.has(f.target) ? [f.target] : [], strength: f.defence.strength },
        x: +(S.at ?? S.where).x.toFixed(2), z: +(S.at ?? S.where).z.toFixed(2), out: S.where.out ?? null, standIns: S.actors.filter(A => !A.freed && A.kind === 'standin').length }; });
  }
  function log_() { return [...staged.values()]; }
  // (x, z) inside a figure's room: the agents' loops keep out (life.js keepOut)
  const keepOut = (x, z) => marks.size > 0 && markedNear(x, z, ROOM);
  // (C1-7d: an agent the boarding line holds — in the queue, on the gangway or below: on its way aboard, not at a stand spot; draw.js)
  const boarding = id => !!line?.run && line.rows.some(B => B.id === id && B.A && !B.A.freed);
  return { update, frame, drawn, taken, keepOut, venue, boarding, fxStats: () => fx.stats(), venueOf: key => [...venues.values()].find(v => v?.key === key) ?? null, faceOf: id => faces.get(id) ?? null, log: log_, clearLog: () => staged.clear(), get live() { return live; }, get queued() { return queued; }, get short() { return Object.fromEntries(shortBy); }, get marks() { return marks; } };
}
