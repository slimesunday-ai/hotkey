// C1-8, the drawn half · THE DIRECTOR ON THE RECORD PATH (?sim=record; GAME.md §20 "The show", "Replay and rewind"; slime's TV calls,
// 10-10). The camera that tells the season: it reads the logic half's two seams and frames what they pick with the camera's own shot
// code (camera/shots.js: the shot grammar, the 180° rule, the occlusion plan, its flights and far cuts behind the load-in).
//   NIGHT  createCutPlanner(frames).at(minute) (simstate/record/cut-plan.js): the show's cut, each row a scene of C1-6's plan. Framed on
//          the scene's place and on its figures as the stage draws them (stage/record.js `live`: borrowed walkers and stand-ins), with
//          the row's captionFields as a lower third (ui/record/tv.js): the public actors' names and drivers, a hooded side as a count
//   DAY    createDayDirector (simstate/record/day-director.js), ticked once a real second on the presented snapshot: its cut is
//          framed wide on the moment's place first (the public setup), then close on its subjects at routineCloseup (the staged
//          payoff, 30 s of island time later at live pace)
//   SIGHT  every shot lands with shots.js's plan (the stage's height map and the collision world's rays to each figure's chest and
//          head); then, once a second while it holds, the figures are tested from where the camera is (in frame, clear of the UI,
//          the collision world's STATIC rays: trunks, fences, walls); a blocked shot is moved (shots.reframe, then a fresh plan from
//          the other side of the line)
// THE TV CALLS:
//   on        the first visit (a page opened without a camera of its own: no cam / look / view, not paused), ?tv=1, the 0 key, the
//             menu's TV button. A link that names a camera or pauses the record is the viewer's own setup and opens with the viewer
//             in control (?tv=1 overrides)
//   attract   60 s with no input, the tab visible, nothing open (panels, the map, a text field), not in fly / photo / walk
//   hand-back any key, pointer, wheel, touch or gamepad input ends TV mode in the event itself (capture phase, before the page's
//             own handlers): the shot in flight is cancelled and MapControls has the camera that same event; the camera stays where
//             it is (the viewer owns the angle and the zoom). "TV off · 0"
//   return    after a scene (the show over, nothing left to cut to) and after a replay, the camera eases back to where the viewer
//             had it when TV mode (or the replay) took it
// The state rides the URL (?tv=1 on · ?tv=idle armed · ?tv=0 off; ?tvHome= the pose to return to), so the day / night reload keeps it.
// Nothing here reads a frame after the presented minute, decides a fact, or names anyone the cut does not name.
import * as THREE from 'three';
import { shotsFor } from './shots.js';
import { STATIC } from './world.js';
import { createCutPlanner } from '../simstate/record/cut-plan.js';
import { createDayDirector } from '../simstate/record/day-director.js';
import { CITY_PLACES, HOUSE_LOTS } from '../simstate/record/places.js';

export const TV = { idleS: 60, tickMs: 1000, sightMs: 1000, reach: 30, closeAfter: .5, padMove: .25 };
const INPUTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
const V = new THREE.Vector3();
const num = s => (s || '').split(',').map(Number);
const typing = () => /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;

// a scene's place → its anchor in the city (a home lot, else the measured stand set, else the place)
export function placeXZ(place) {
  if (!place) return null;
  const lot = HOUSE_LOTS.find(l => l.id === place.cityPlace), q = lot ?? CITY_PLACES[place.standPlace] ?? CITY_PLACES[place.cityPlace];
  return q ? { x: q.x, z: q.z } : null;
}

export function createDirector({ api, page, Q, ui = null, frames }) {
  const rig = api.cam, camera = api.camera, controls = api.controls, player = page.player, shots = shotsFor(api);
  const cuts = createCutPlanner(frames), day = page.draw?.routines ? createDayDirector({ routines: page.draw.routines }) : null;
  // (C1-9b: a seek starts the day director over: its choices at a minute follow the record to that minute, not the cuts made before)
  page.player?.on?.((_, meta) => { if (meta?.reset) { day?.reset(); dayCut = null; } });
  const deep = (Q.get('camBy') !== 'reload' && ['cam', 'look', 'view'].some(k => Q.has(k))) || Q.get('recordPaused') === '1';
  let visited = false; try { visited = localStorage.getItem('aicity.tv.visited') === '1'; localStorage.setItem('aicity.tv.visited', '1'); } catch {}
  const param = Q.get('tv');
  let mode = 'off', reason = null, armed = param !== '0' && (param === '1' || param === 'idle' || !deep);
  let cur = null, handle = null, home = Q.has('tvHome') ? pose(num(Q.get('tvHome'))) : null, homing = false, replay = null;
  let px = null, shot = false, lastInput = performance.now(), lastTick = -1e9, lastSight = -1e9, frameN = 0, dayCut = null, pads = false, padRest = null;
  const log = { cuts: [], captions: [], stops: [], returns: [], reframes: 0, moves: 0, blocked: 0 };
  function pose(a) { return a.length >= 6 && a.every(Number.isFinite) ? { pos: a.slice(0, 3), tgt: a.slice(3, 6), fov: a[6] || camera.fov } : null; }
  const poseNow = () => ({ pos: camera.position.toArray(), tgt: controls.target.toArray(), fov: camera.fov });
  // the URL carries the state through the day / night reload (record/page.js keeps every other parameter)
  function keepUrl() {
    const u = new URL(location.href); u.searchParams.set('tv', mode !== 'off' ? '1' : armed ? 'idle' : '0');
    if (home && (mode !== 'off' || replay)) u.searchParams.set('tvHome', [...home.pos, ...home.tgt, home.fov].map(v => +v.toFixed(2)).join(','));
    else u.searchParams.delete('tvHome');
    if (replay) u.searchParams.set('tvReplay', `${replay.start},${replay.end}`); else u.searchParams.delete('tvReplay');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  }

  // ── on and off
  function start(why = 'viewer') {
    if (mode !== 'off') return false;
    mode = 'tv'; reason = why; armed = true; cur = null; dayCut = null; homing = false; lastTick = -1e9; day?.reset();
    if (!home) home = poseNow();
    ui?.on(why); keepUrl(); return true;
  }
  function stop(why = 'input', e = null) {
    if (mode === 'off') return false;
    const t = performance.now();
    handle?.cancel(); handle = null; cur = null; dayCut = null; homing = false;
    // (an eased return under way stops where it is: the instant hand-off into the map keeps the pose of this moment)
    if (rig?.blending && rig.mode === 'orbit') rig.toOrbit({ instant: true });
    // (the shot's flight held MapControls: the viewer's drag that ended TV mode reaches it in this same event)
    // (not while the load-in holds the view: the shot's end leaves MapControls off then, and a press it saw without its release
    // would stay in its pointer list)
    if (rig && rig.mode === 'orbit' && !rig.blending && !api.loading) controls.enabled = true;
    mode = 'off'; reason = null; home = null; replay = null; ui?.off(why); keepUrl();
    log.stops.push({ why, type: e?.type ?? null, t, frame: frameN, minute: player.minute });
    if (why === 'input') rig?.hud?.toast?.('TV off · 0');
    return true;
  }
  // any input: TV mode ends in the event itself; the idle clock starts over
  function onInput(e) {
    lastInput = performance.now();
    if (e.type === 'pointerdown') px = [e.clientX, e.clientY];
    if (e.type === 'keydown' && e.code === 'Digit0' && !typing() && !e.metaKey && !e.ctrlKey && !e.altKey && mode === 'off') { e.__tvStart = true; start('viewer'); return; }
    // (the menu's TV button toggles on its own click)
    if (e.target?.closest?.('[data-tv-button]')) return;
    stop('input', e);
  }
  for (const type of INPUTS) addEventListener(type, onInput, { capture: true, passive: true });
  // (a pointer move counts once it has moved 2 px from where it was last seen; the first one the page sees counts at once)
  addEventListener('pointermove', e => { const moved = !px || Math.abs(e.clientX - px[0]) + Math.abs(e.clientY - px[1]) >= 2; if (moved) px = [e.clientX, e.clientY]; if (moved || e.pointerType === 'touch') onInput(e); }, { capture: true, passive: true });
  addEventListener('gamepadconnected', () => { pads = true; });
  function pollPads() {
    if (!pads || !navigator.getGamepads) return;
    let sig = '';
    for (const g of navigator.getGamepads()) if (g?.connected) sig += g.buttons.map(b => b.pressed ? 1 : 0).join('') + g.axes.map(a => Math.abs(a) > TV.padMove ? 1 : 0).join('');
    if (padRest !== null && sig !== padRest && /1/.test(sig)) onInput({ type: 'gamepad' });
    padRest = sig;
  }

  // ── what to frame
  const walkerOf = id => { const a = page.draw?.agents?.map.get(id); return a?.w ? { x: a.w.p[0], y: a.w.p[1], z: a.w.p[2], h: id } : null; };
  // a night scene's figures as the stage draws them now (its borrowed walkers and stand-ins), else the cut's public actors' walkers
  // near the place (walking in to it)
  function figuresOf(sceneId, subjects, at) {
    const S = page.draw?.scenes?.live?.get(sceneId), out = [];
    if (S) for (const A of S.actors) if (!A.freed && A.w && !A.w.gone) out.push({ x: A.w.p[0], y: A.w.p[1], z: A.w.p[2], h: A.h });
    for (const id of subjects) { if (out.some(o => o.h === id)) continue; const w = walkerOf(id); if (w && (!at || Math.hypot(w.x - at.x, w.z - at.z) < TV.reach)) out.push(w); }
    return out;
  }
  function nightSpec(cut, minute) {
    const scene = page.draw?.planner?.night(Math.floor(minute / 1440))?.scenes.find(s => s.id === cut.sceneId) ?? null;
    const at = placeXZ(scene?.place), actors = figuresOf(cut.sceneId, cut.subjects, at);
    if (!at && !actors.length) return null;
    return { kind: actors.length ? 'auto' : 'establishing', at: at ?? actors[0], actors, scene: 'tv:' + cut.sceneId, sceneT: minute, label: cut.captionFields.place };
  }
  function daySpec(cut, minute, close) {
    const at = placeXZ(cut.place), actors = cut.subjects.map(walkerOf).filter(w => w && (!at || Math.hypot(w.x - at.x, w.z - at.z) < TV.reach));
    if (!at && !actors.length) return null;
    return { kind: close && actors.length ? 'auto' : 'establishing', at: close && actors.length ? actors[0] : at ?? actors[0], actors: close ? actors : [], scene: 'tv:' + cut.momentId, sceneT: minute, label: cut.captionFields.place };
  }
  function shoot(id, spec, cut, kind, phase) {
    handle?.cancel(); homing = false; shot = true;
    cur = { id, spec, cut, kind, phase, t: performance.now(), minute: player.minute, retries: 0 };
    if (phase !== 'close') { log.cuts.push({ id, kind, minute: player.minute, t: cur.t, subjects: [...cut.subjects], sceneId: cut.sceneId });
      const text = ui?.caption(cut.captionFields, kind) ?? null; log.captions.push({ id, minute: player.minute, text }); }
    log.moves++; handle = spec ? shots.go(spec, { label: spec.label }) : null;
  }
  // the shot holds: once a second, are its figures seen from where the camera is? A blocked one moves
  function sight(now) {
    if (!cur?.spec || (handle && !handle.over) || now - lastSight < TV.sightMs) return;
    lastSight = now;
    const spec = cur.kind === 'night' ? nightSpec(cur.cut, player.minute) : daySpec(cur.cut, player.minute, cur.phase === 'close');
    if (!spec) return;
    cur.spec = spec;
    const v = visible(spec.actors.length ? spec.actors : [{ ...spec.at, y: 0 }]);
    if (v.seen >= Math.max(1, Math.ceil(v.n / 2))) return;
    log.blocked++;
    if (cur.retries++ > 3) return;
    // (first the pre-roll's short move on the scene's side; then a fresh plan, either side of the line)
    handle = cur.retries === 1 ? shots.reframe(spec) : null;
    if (!handle) { shots.endScene(spec.scene); handle = shots.go(spec, { label: spec.label }); }
    log.reframes++;
  }
  // figures seen from the camera now: in frame, above the lower third and the bars, nothing STATIC between (the collision world)
  function visible(figs) {
    const W = rig?.world, el = api.renderer.domElement, r = el.getBoundingClientRect(), floor = ui?.floorPx?.() ?? r.bottom;
    let seen = 0;
    for (const f of figs) {
      let ok = false;
      for (const dy of [1.1, 1.6]) {
        V.set(f.x, (f.y || 0) + dy, f.z).project(camera);
        if (V.z > 1 || Math.abs(V.x) > .96 || Math.abs(V.y) > .96) continue;
        const py = r.top + (1 - V.y) / 2 * r.height; if (py > floor) continue;
        if (W?.ready?.(f.x, f.z) && W.ray(camera.position, { x: f.x, y: (f.y || 0) + dy, z: f.z }, STATIC)) continue;
        ok = true; break;
      }
      if (ok) seen++;
    }
    return { n: figs.length, seen };
  }
  // back where the viewer had it: the rig's own eased hand-off into the map at that pose
  function goHome(why) {
    if (!home || homing) return;
    handle?.cancel(); handle = null; cur = null; homing = true; shot = false; ui?.caption(null);
    log.returns.push({ why, minute: player.minute, t: performance.now(), to: home });
    rig?.toOrbit({ view: { pos: home.pos, tgt: home.tgt, fov: home.fov } });
  }

  // ── per frame (ui/record/index.js's frame)
  function frame() {
    frameN++; pollPads();
    const now = performance.now(), minute = player.minute;
    if (replay) { if (minute >= replay.end || minute < replay.start - .01) { const h = home; replay = null; if (h) { home = h; goHome('replay'); home = null; } keepUrl(); } return; }
    if (mode === 'off') {
      if (armed && now - lastInput > TV.idleS * 1000 && attractOk()) start('attract');
      return;
    }
    let cut = null; try { cut = cuts.at(minute); } catch { cut = null; }
    if (cut) {
      dayCut = null;
      if (cur?.id !== cut.sceneId) shoot(cut.sceneId, nightSpec(cut, minute), cut, 'night', 'est');
      else sight(now);
      return;
    }
    // (the show is over: back where the viewer was, once)
    if (cur?.kind === 'night') { cur = null; if (!day) goHome('scene'); }
    if (day && now - lastTick >= TV.tickMs) {
      lastTick = now;
      let d = null;
      try { d = day.tick(player.snapshot()); } catch { day.reset(); try { d = day.tick(player.snapshot()); } catch { d = null; } }
      if (d?.action === 'cut' && d.cut) { dayCut = d.cut; shoot(d.cut.sceneId, daySpec(d.cut, minute, false), d.cut, 'day', 'est'); }
      else if (!d || d.action === 'idle') { dayCut = null; if (shot) goHome('scene'); }
    }
    if (cur?.kind === 'day' && cur.phase === 'est') {
      const at = cur.cut.routineCloseup ?? cur.cut.start + TV.closeAfter;
      if (minute >= at && cur.cut.subjects.length) { const spec = daySpec(cur.cut, minute, true); if (spec?.actors.length) shoot(cur.id, spec, cur.cut, 'day', 'close'); else cur.phase = 'close'; }
    } else if (cur) sight(now);
  }
  function attractOk() {
    if (document.visibilityState !== 'visible' || typing()) return false;
    if (rig && ['fly', 'photo', 'walk'].includes(rig.mode)) return false;
    const s = window.__recordUI?.stats?.();
    return !(s && (s.dossier || s.people || s.map || s.ch9 || s.board || s.cards));
  }
  // a morning card's Replay (ui/record/replay.js): the camera goes back where it was once the replayed scene is over
  function replayed(r, scene) {
    if (!scene) return;
    if (mode !== 'off') stop('replay');
    home = poseNow(); replay = { start: scene.start, end: scene.end, scene: scene.id };
    keepUrl();
  }
  // C1-9 · THE TAPE'S VISIT (ui/record/tape.js): a marker clicked (go there and play on: back false) or a replay (a missed card, a
  // morning card: back true, the camera goes back where the viewer had it once [start, end) is over). TV mode steps aside; the shot
  // frames exactly the spec the tape hands over (the victim, the place it happened). Called again with a spec on the same visit, it
  // only moves the shot (the home and the window stay)
  function visit({ spec = null, start = player.minute, end = null, id = null, back = false } = {}) {
    if (mode !== 'off') stop('replay');
    handle?.cancel(); handle = null; cur = null; homing = false;
    if (back) { if (!home) home = poseNow(); replay = { start, end: end ?? start, scene: id }; }
    else { home = null; replay = null; }
    keepUrl();
    if (!spec) return null;
    log.moves++; shot = true; handle = shots.go(spec, { label: spec.label });
    return handle;
  }
  // (after the reload into the replayed scene's night: ?tvHome= and the replay's window come back from the URL)
  if (Q.has('tvReplay') && home) { const [s, e] = num(Q.get('tvReplay')); if (Number.isFinite(e)) replay = { start: s, end: e, scene: null }; }

  // first visit, or the URL's state after a reload
  if (param === '1' || (param === null && !deep && !visited)) start(param === '1' ? 'url' : 'first');
  else keepUrl();
  const director = {
    frame, start, stop, replayed, visit,
    get mode() { return mode; }, get reason() { return reason; }, get armed() { return armed; }, set armed(v) { armed = !!v; keepUrl(); },
    get framing() { return mode !== 'off' || !!replay; }, get current() { return cur ? { id: cur.id, kind: cur.kind, phase: cur.phase, minute: cur.minute, subjects: [...cur.cut.subjects], place: cur.cut.place ?? null, sceneId: cur.cut.sceneId, routineCloseup: cur.cut.routineCloseup ?? null, moving: !!handle && !handle.over } : null; },
    get log() { return log; }, get frameN() { return frameN; }, get home() { return home; }, get replay() { return replay; },
    stats: () => ({ mode, reason, armed, cuts: log.cuts.length, moves: log.moves, reframes: log.reframes, blocked: log.blocked, stops: log.stops.length, returns: log.returns.length, current: director.current, idle: +((performance.now() - lastInput) / 1000).toFixed(1) }),
  };
  return director;
}
