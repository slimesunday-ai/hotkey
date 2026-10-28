// C1-9, the drawn half · THE TAPE ON THE RECORD PATH (?sim=record; GAME.md §20 "Replay and rewind"; TV plan A4). ui/record/index.js
// mounts it; ?sim=live keeps its own tape (ui/tape/), untouched.
//   scrubber  one bar over the season so far, folded into the record player's bar (#record-player: its old range input steps aside;
//             play, speed, the minute box and the night jumps stay as they were). It spans the first feed minute to the furthest
//             minute this viewer has reached (the horizon, ?tapeHorizon= through the day / night reload); a press or a drag on it seeks,
//             never past the horizon; "Now" goes back to it. Night bands and day ticks under it
//   markers   createTapeReader(frames).markersAt(sim.record()): the presented snapshot only, so a marker shows only once its event is
//             published at the playhead (each show, fights and arrests, corners changing hands, the dawn's sales, the ferry). Markers a
//             few pixels apart fold into one pip; a pip of several opens a list. A click goes there and plays it, as the live tape's
//             goToEvent does: the playhead to marker.replayStart, the director (camera/director.js visit) frames its place, then its
//             subject, and the record plays on (at 10× at most)
//   missed    a fight or an arrest published while its place was never on screen during its scene, TV mode off: the paper card
//             (ui/record/missed.js). The card's Replay, and the morning cards' Replay (ui/record/replay.js), are a REPLAY: from the moment it
//             happened, at 10×, framed on the victim (tape-data's paper.framing: the victim's place, then the victim), with a lower
//             third; once it is over the playhead and the camera go back where the viewer was. The viewer's "now" is kept while the
//             replay plays (the retained snapshot): a replay more than 24 hours old names the hooded attackers from the disclosed
//             record only (recordSideAt), and the dossier's 24-hour side gets the replay (dossier.setReplay)
// A seek, a jump or a drag by the viewer ends a visit where it is. A visit that crosses into the other half of the island's day rides
// the URL (?tapeVisit=) through record/page.js's reload. Nothing here reads a frame after the presented minute, decides a fact, or reads
// event text: words are the typed fields' (tv.js's action and place words, the board's names).
import { h, button } from '../kit.js';
import { TOD } from '../../kit.js';
import { createTapeReader, recordSideAt } from '../../simstate/record/tape-data.js';
import { createShowPlayer } from '../../simstate/record/show-plan.js';
import { islandClock } from '../../simstate/record/adapter.js';
import { placeXZ } from '../../camera/director.js';
import { actionOf, placeOf } from './tv.js';
import { sceneOf } from './replay.js';
import { createMissed } from './missed.js';

export const TAPE = { replaySpeed: 10, clusterPx: 14, settleMs: 250, landMs: 9000, holdMs: 4000, reach: 30, seenMs: 400, seenM: 170 };
const DAY = 1440;
const KIND = { show: 'The show', fight: 'Fight', arrest: 'Arrest', turf: 'Corner', sale: 'Dawn sale', ferry: 'Ferry' };
const clockOf = m => { const c = islandClock(m); return `day ${c.day} ${c.hhmm}`; };

export function createRecordTape({ api, page, sim, Q, root, director = null, dossier = null, uiBusy = () => false }) {
  const P = page.player, frames = page.frames, reader = createTapeReader(frames), from = P.bounds.from, to = P.bounds.to;
  const missed = createMissed({ root, onReplay: paper => replayPaper(paper) });
  const log = { visits: [], missed: [], seeks: 0 };
  let horizon = Math.max(P.minute, Math.min(to, +(Q.get('tapeHorizon') || 0) || 0)), markers = [], byId = new Map(), known = null;
  let visit = null, retained = null, own = 0, seen = new Set(), lastSeen = 0, popFor = null, lastUrl = 0;

  // ── the bar: inserted into the record player's own bar, above its controls
  const bar = document.getElementById('record-player');
  const inner = h('div', { class: 'r-tape-in' }), head = h('div', { class: 'r-tape-head' }), pips = h('div', { class: 'r-tape-pips' });
  const track = h('div', { class: 'r-tape-track', role: 'slider', tabindex: '0', 'aria-label': 'The season so far', 'aria-valuemin': String(from) }, inner, pips, head);
  const now = button('Now', { tip: 'Back to the furthest moment you reached', cls: 'r-tape-now', onclick: () => { seek(horizon, 'now'); } });
  const span = h('span', { class: 'r-tape-span' });
  const row = h('div', { id: 'r-tape', class: 'r-tape', 'data-safe-avoid': '' }, track, span, now);
  const pop = h('div', { id: 'r-tape-pop', class: 'r-tape-pop', role: 'menu', hidden: true });
  if (bar) { bar.classList.add('has-tape'); bar.prepend(row); bar.append(pop); }
  const speedBox = bar?.querySelector('select[aria-label="Playback speed"]') ?? null;
  // the night bands and the midnight ticks, once, in season coordinates (the inner strip is the whole season; the track shows its start
  // to the horizon)
  const pct = m => ((m - from) / (to - from) * 100).toFixed(4) + '%';
  for (let d = Math.floor(from / DAY); d * DAY < to; d++) {
    const a = Math.max(from, d * DAY + 1200), b = Math.min(to, (d + 1) * DAY + 360);
    if (b > a) inner.append(h('i', { class: 'r-tape-night', style: `left:${pct(a)};width:${((b - a) / (to - from) * 100).toFixed(4)}%` }));
    const mid = (d + 1) * DAY; if (mid > from && mid < to) inner.append(h('i', { class: 'r-tape-day', style: `left:${pct(mid)}` }, h('span', null, `D${d + 1}`)));
  }
  // the lower third while a replay plays (where the director's caption sits: TV mode is off for the replay)
  const capWho = h('div', { class: 'r-tv-who' }), capWhat = h('div', { class: 'r-tv-what' });
  const cap = h('div', { id: 'r-tape-cap', class: 'r-tv-cap r-tape-cap', role: 'status', 'aria-live': 'polite', hidden: true }, h('span', { class: 'r-badge r-tv-bug' }, 'REPLAY'), capWho, capWhat);
  root.append(cap);

  // ── words, from typed fields only
  const board = () => (retained ?? sim.record())?.board;
  const nameOf = id => id ? board()?.agents?.find(a => a.id === id)?.name ?? id : null;
  function words(m, ev = byId.get(m.id)) {
    const who = nameOf(m.subjects?.agent), place = m.place ? placeOf(m.place.corePlace ?? m.place.cityPlace) : null;
    let what = KIND[m.kind] ?? m.kind;
    if (m.kind === 'show') what = `The show · night ${ev?.night ?? ''}`.trim();
    else if (m.kind === 'fight') what = actionOf({ kind: ev?.kind ?? 'fight' });
    else if (m.kind === 'arrest') what = 'an arrest';
    else if (m.kind === 'turf') what = 'a corner changes hands';
    else if (m.kind === 'sale') what = 'a sale at dawn';
    else if (m.kind === 'ferry') what = ev?.type === 'board' ? 'boards the ferry' : 'the ferry drops everyone at the docks';
    what = what.charAt(0).toUpperCase() + what.slice(1);
    return { what, who, place, line: [who, place, clockOf(m.minute)].filter(Boolean).join(' · ') };
  }

  // ── the markers: the presented snapshot's (sim.record()), at the playhead, a replay's too (C1-9b: nothing after the playhead is on
  // the bar, a replay's playhead included). A missed card or an open marker list whose event the playhead hasn't published goes
  function refresh() {
    const s = sim.record();
    if (!s?.frame) { markers = []; byId = new Map(); } else { markers = reader.markersAt(s); byId = new Map(s.events.map(e => [e.id, e])); }
    const have = new Set(markers.map(m => m.id)); missed.retain(id => have.has(id));
    if (popFor && popIds.some(id => !have.has(id))) closePop();
    layout(true);
  }
  let scale = 0, laid = '', tw = 1, lastH = null;
  function layout(force = false) {
    const H = Math.max(horizon, from + 60), k = tw / (H - from);
    if (force || lastH === null || Math.abs(H - lastH) * k > .25) { lastH = H; inner.style.width = pips.style.width = ((to - from) / (H - from) * 100).toFixed(4) + '%'; }
    if (!force && Math.abs(k - scale) / (scale || 1) < .08) return;
    scale = k;
    const groups = [];
    for (const m of [...markers].sort((a, b) => a.minute - b.minute || a.id - b.id)) {
      const g = groups.at(-1);
      if (g && (m.minute - g.first) * k <= TAPE.clusterPx) { g.list.push(m); g.last = m.minute; } else groups.push({ first: m.minute, last: m.minute, list: [m] });
    }
    const sig = groups.map(g => g.list.map(m => m.id).join(',')).join('|') + '@' + Math.round(k * 1e4);
    if (sig === laid) return; laid = sig;
    pips.replaceChildren(...groups.map(g => {
      const lead = g.list.find(m => m.kind === 'fight') ?? g.list.find(m => m.kind === 'arrest') ?? g.list[0], at = (g.first + g.last) / 2;
      const b = h('button', { type: 'button', class: `r-tape-mk is-${lead.kind}`, style: `left:${pct(at)}`, 'data-ids': g.list.map(m => m.id).join(','),
        'data-minute': String(+at.toFixed(3)), 'aria-label': g.list.length > 1 ? `${clockOf(g.first)}: ${g.list.length} moments` : `${words(lead).what}, ${clockOf(lead.minute)}` }, g.list.length > 1 ? String(g.list.length) : '');
      b.addEventListener('click', e => { e.stopPropagation(); if (g.list.length === 1) { closePop(); goMarker(g.list[0]); } else openPop(g.list, b); });
      b.addEventListener('pointerdown', e => e.stopPropagation());
      return b;
    }));
    if (popFor && !groups.some(g => g.list.some(m => m.id === popFor))) closePop();
  }
  let popIds = [];
  function openPop(list, at) {
    popFor = list[0].id; popIds = list.map(m => m.id);
    pop.replaceChildren(h('div', { class: 'r-tape-pop-h' }, `${clockOf(list[0].minute)} – ${islandClock(list.at(-1).minute).hhmm}`),
      ...list.map(m => { const w = words(m);
        return h('button', { type: 'button', role: 'menuitem', class: `r-tape-item is-${m.kind}`, 'data-marker': String(m.id), onclick: () => { closePop(); goMarker(m); } },
          h('b', null, w.what), h('span', null, w.line)); }));
    pop.hidden = false;
    const r = at.getBoundingClientRect(), B = bar.getBoundingClientRect(), pw = pop.offsetWidth;
    pop.style.left = Math.round(Math.max(8, Math.min(B.width - pw - 8, r.left + r.width / 2 - B.left - pw / 2))) + 'px';
  }
  function closePop() { popFor = null; popIds = []; pop.hidden = true; pop.replaceChildren(); }
  addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest?.('.r-tape-mk')) closePop(); }, true);

  // ── the track: a press or a drag seeks (never past the horizon)
  const minuteAt = x => { const r = track.getBoundingClientRect(), H = Math.max(horizon, from + 60); return Math.max(from, Math.min(horizon, from + (x - r.left) / r.width * (H - from))); };
  let drag = null;
  track.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = e.pointerId; track.setPointerCapture?.(e.pointerId); seek(minuteAt(e.clientX), 'scrub'); });
  track.addEventListener('pointermove', e => { if (drag === e.pointerId) { drag_x = e.clientX; } });
  let drag_x = null;
  const endDrag = e => { if (drag === e.pointerId) { if (drag_x !== null) seek(minuteAt(drag_x), 'scrub'); drag = null; drag_x = null; } };
  track.addEventListener('pointerup', endDrag); track.addEventListener('pointercancel', endDrag);
  track.addEventListener('keydown', e => { const d = e.code === 'ArrowLeft' ? -60 : e.code === 'ArrowRight' ? 60 : 0; if (!d) return; e.preventDefault(); e.stopPropagation(); seek(Math.min(horizon, P.minute + d), 'key'); });
  function seek(m, by) { log.seeks++; if (visit) cancel('viewer'); own++; try { P.seek(Math.max(from, Math.min(horizon, m))); } finally { own--; } log.lastSeek = { by, minute: P.minute }; }

  // ── the player: a published change refreshes the markers; a viewer's seek ends a visit; a new fight or arrest nobody saw is missed
  P.on((state, meta) => {
    if (meta.reset && !own && visit && visit.phase !== 'reload') cancel('viewer');
    if (retained) { refresh(); return; }
    const before = known; refresh(); known = new Set(markers.map(m => m.id));
    if (meta.reset || !before || visit || P.minute < horizon - .01) return;
    for (const m of markers) if (!before.has(m.id) && (m.kind === 'fight' || m.kind === 'arrest')) noteMissed(m);
  });
  function noteMissed(m) {
    const why = seen.has(m.id) ? 'seen' : director && director.mode !== 'off' ? 'tv' : uiBusy() ? 'busy' : !m.place ? 'noplace' : null;
    log.missed.push({ id: m.id, kind: m.kind, minute: m.minute, why: why ?? 'missed' });
    if (why) return;
    const paper = reader.paperCardAt(sim.record(), m.id);
    if (!paper) return;
    const w = words(m);
    missed.push({ paper, what: w.what, line: w.line });
  }
  // (sampled while a show plays: a fight's or an arrest's place on screen at some moment of its scene counts it seen)
  const V = new api.THREE.Vector3();
  function onScreen(p) {
    if (!p) return false;
    const c = api.camera; if (Math.hypot(c.position.x - p.x, c.position.z - p.z) > TAPE.seenM) return false;
    V.set(p.x, 1, p.z).project(c); return V.z < 1 && Math.abs(V.x) < 1 && Math.abs(V.y) < 1;
  }
  function sample(t) {
    if (t - lastSeen < TAPE.seenMs) return; lastSeen = t;
    const show = P.snapshot().show; if (!show) return;
    for (const sc of show.active) {
      if (sc.beat !== 'fight' && sc.beat !== 'arrest') continue;
      const figs = (sc.publicActors ?? []).map(walkerOf).filter(Boolean);
      if (onScreen(placeXZ(sc.place)) || figs.some(onScreen)) { seen.add(sc.eventId); for (const id of sc.revealIds ?? []) seen.add(id); }
    }
  }

  // ── visits: a marker (go there, play on) or a replay (play it, then back)
  const walkerOf = id => { const a = id ? page.draw?.agents?.map.get(id) : null; return a?.w && !a.w.gone ? { x: a.w.p[0], y: a.w.p[1], z: a.w.p[2], h: id } : null; };
  // (record/page.js reloads the page when the playhead crosses into the other half of the island's day)
  const reloads = m => Q.get('simtod') !== '0' && islandClock(m).night !== !!TOD.night;
  function goMarker(m) {
    const w = words(m);
    return begin({ kind: 'marker', id: m.id, start: m.replayStart, end: null, framing: { agent: m.subjects?.agent ?? null, place: m.place }, label: [w.what, w.place].filter(Boolean).join(' · '), back: null });
  }
  function replayPaper(paper) {
    const m = byId.get(paper.id) ? markers.find(x => x.id === paper.id) : null, w = m ? words(m) : { what: KIND[paper.kind] ?? paper.kind, place: null };
    return begin({ kind: 'missed', id: paper.id, start: paper.replayStart, end: Math.max(paper.minute, paper.replayStart + 1) + .25, framing: paper.framing,
      label: [w.what, w.place].filter(Boolean).join(' · '), night: paper.night, back: true });
  }
  // a morning card's Replay (ui/record/replay.js): its scene, from the scene's start (a card with no scene of its own: its night's show,
  // from the opening), framed on the card's victim
  function replayCard(r) {
    const scene = sceneOf(page, r), plan = page.draw?.planner?.night(r.night) ?? null, paper = reader.paperCardAt(sim.record(), r.eventId);
    const start = scene ? scene.start : plan?.start ?? null;
    if (start === null) return null;
    const end = scene ? scene.end : Math.min(plan.end, plan.start + 1.5), place = paper?.framing.place ?? scene?.place ?? null;
    begin({ kind: 'card', id: r.eventId, start, end, framing: { agent: paper?.framing.agent ?? null, place }, night: r.night,
      label: [scene ? actionOf({ kind: scene.kind }) : 'The show', place ? placeOf(place.corePlace ?? place.cityPlace) : null].filter(Boolean).join(' · '), back: true });
    return { night: r.night, eventId: r.eventId, scene: scene?.id ?? null, place: scene?.place.cityPlace ?? null, minute: P.minute };
  }
  function begin(v) {
    closePop();
    const keep = visit?.back ? { back: visit.back, retained } : null;
    if (visit) cancel('new', !!v.back);
    if (v.back) {
      v.back = keep?.back ?? [P.minute, P.speed, P.running];
      retained = keep?.retained ?? { ...sim.record(), minute: P.minute };
    }
    P.pause();
    const speed = v.back ? TAPE.replaySpeed : Math.min(P.speed, TAPE.replaySpeed); if (P.speed !== speed) P.setSpeed(speed);
    own++; try { P.seek(v.start); } finally { own--; }
    director?.visit({ start: v.start, end: v.end ?? v.start, id: v.id, back: !!v.back });
    visit = { ...v, phase: 'frame', t: performance.now(), handle: null, spec: null };
    // (the reload into the other half of the day: the camera goes to the place now, keeping the viewer's angle and zoom, so the reload
    // carries it there; the shot is made after it)
    if (reloads(v.start)) { const at = placeXZ(v.framing.place); if (at) shift(at); visit.phase = 'reload'; }
    log.visits.push({ kind: v.kind, id: v.id, start: v.start, end: v.end, clicked: v.back ? v.back[0] : null, sought: P.minute, at: visit.t });
    keepUrl(true); caption();
    return visit;
  }
  function shift(at) {
    const T = api.controls.target, c = api.camera, dx = at.x - T.x, dz = at.z - T.z;
    if (api.cam?.blending || (api.cam && api.cam.mode !== 'orbit')) api.cam.toOrbit({ instant: true });
    T.x += dx; T.z += dz; c.position.x += dx; c.position.z += dz; api.controls.update?.();
  }
  function specFor(v, close) {
    const at = placeXZ(v.framing.place), w = walkerOf(v.framing.agent), near = w && (!at || Math.hypot(w.x - at.x, w.z - at.z) < TAPE.reach);
    const base = { scene: 'tape:' + v.kind + ':' + v.id, sceneT: v.start, label: v.label };
    if (close) return near ? { ...base, kind: 'two', at: w, actors: [w] } : null;
    if (at) return { ...base, kind: 'establishing', at, actors: [] };
    return w ? { ...base, kind: 'two', at: w, actors: [w] } : null;
  }
  function stepVisit(t) {
    const v = visit;
    if (v.phase === 'reload') { if (t - v.t > 4000) { v.phase = 'frame'; v.t = t; } return; }
    if (v.phase === 'frame') {
      if (t - v.t < TAPE.settleMs || !page.draw) return;
      v.spec = specFor(v, false);
      v.handle = v.spec && director ? director.visit({ spec: v.spec, start: v.start, end: v.end ?? v.start, id: v.id, back: !!v.back }) : null;
      v.phase = 'fly'; v.t = t; return;
    }
    if (v.phase === 'fly') {
      if (!P.running && v.handle && !v.handle.over && t - v.t < TAPE.landMs) return;
      const T = api.controls.target, at = placeXZ(v.framing.place);
      v.landed = { x: +T.x.toFixed(2), z: +T.z.toFixed(2), minute: P.minute, ms: Math.round(t - v.t), off: at ? +Math.hypot(T.x - at.x, T.z - at.z).toFixed(2) : null, how: v.spec?.kind ?? null };
      Object.assign(log.visits.at(-1) ?? {}, { landed: v.landed });
      if (!P.running) P.play();
      v.phase = 'play'; v.t = t; v.closeAt = v.spec?.kind === 'establishing' && v.framing.agent ? t + TAPE.holdMs : null;
      keepUrl(true); caption(); return;
    }
    if (v.closeAt && t >= v.closeAt && (!v.handle || v.handle.over)) {
      v.closeAt = null; const spec = specFor(v, true);
      if (spec && director) { v.handle = director.visit({ spec, start: v.start, end: v.end ?? v.start, id: v.id, back: !!v.back }); Object.assign(log.visits.at(-1) ?? {}, { close: { minute: P.minute, victim: v.framing.agent } }); }
    }
    if (v.back) { if (P.minute >= v.end) finish(); else if (Math.floor(P.minute * 4) !== v.capAt) { v.capAt = Math.floor(P.minute * 4); caption(); } }
    else if (!v.closeAt && (!v.handle || v.handle.over)) { visit = null; keepUrl(true); }
  }
  function finish() {
    const v = visit, [m, speed, running] = v.back, home = director?.home;
    visit = null; dossier?.setReplay?.(null);
    // (back into the other half of the day: the camera is put home at once, so the reload carries it there)
    if (reloads(m) && home) { if (api.cam?.blending || (api.cam && api.cam.mode !== 'orbit')) api.cam.toOrbit({ instant: true });
      api.camera.position.fromArray(home.pos); api.controls.target.fromArray(home.tgt); api.controls.update?.(); }
    retained = null;
    own++; try { P.seek(m); } finally { own--; }
    if (P.speed !== speed) P.setSpeed(speed);
    if (running) P.play(); else P.pause();
    Object.assign(log.visits.at(-1) ?? {}, { back: P.minute, endedAt: performance.now() });
    refresh(); known = new Set(markers.map(x => x.id)); keepUrl(true); caption();
  }
  // a viewer's own seek (or a new visit) ends the visit where it is: no return; the director lets the camera go
  function cancel(why, next = false) {
    const v = visit; if (!v) return;
    visit = null; v.handle?.cancel?.();
    if (!next) { retained = null; dossier?.setReplay?.(null); director?.visit({ back: false }); refresh(); }
    Object.assign(log.visits.at(-1) ?? {}, { cancelled: why });
    keepUrl(true); caption();
  }
  // the replay's lower third: what, where, when; the victim; a hooded side named only from the disclosed record past 24 hours
  function caption() {
    const v = visit;
    if (!v?.back || v.phase === 'reload') { cap.hidden = true; return; }
    const snap = P.snapshot(), disclosed = retainedSnap();
    let names = [];
    try { names = recordSideAt(snap, disclosed).names.filter(n => !v.framing.agent || n.victim === v.framing.agent); } catch { names = []; }
    const who = [nameOf(v.framing.agent), names.length ? `hood off: ${names.map(n => n.name ?? n.agent).join(', ')}` : null].filter(Boolean);
    capWho.textContent = who.join(' · ') || ' ';
    capWhat.textContent = [v.label, clockOf(v.start)].filter(Boolean).join(' · ');
    cap.dataset.names = names.map(n => n.agent).join(',');
    cap.hidden = false;
    if (dossier?.current) dossier.setReplay?.({ replay: snap, disclosed });
  }
  function retainedSnap() {
    if (!retained && visit?.back) { const { show, ...s } = createShowPlayer(frames).seek(visit.back[0]); retained = s; }
    return retained;
  }
  function keepUrl(force = false) {
    const t = performance.now(); if (!force && t - lastUrl < 1000) return; lastUrl = t;
    const u = new URL(location.href); u.searchParams.set('tapeHorizon', String(+horizon.toFixed(3)));
    const v = visit;
    if (v && (v.back || v.phase !== 'play')) u.searchParams.set('tapeVisit', JSON.stringify({ k: v.kind, id: v.id, s: v.start, e: v.end, b: v.back, f: v.framing, l: v.label, n: v.night ?? null }));
    else u.searchParams.delete('tapeVisit');
    if (u.href !== location.href) history.replaceState(history.state, '', u);
  }
  // (after the reload: the visit comes back from the URL, its camera already at the place)
  if (Q.has('tapeVisit')) {
    try { const o = JSON.parse(Q.get('tapeVisit'));
      visit = { kind: o.k, id: o.id, start: o.s, end: o.e, back: o.b, framing: o.f, label: o.l, night: o.n, phase: 'frame', t: performance.now(), handle: null, spec: null, restored: true };
      if (visit.back) retainedSnap();
      log.visits.push({ kind: visit.kind, id: visit.id, start: visit.start, end: visit.end, clicked: visit.back?.[0] ?? null, sought: P.minute, restored: true, at: visit.t });
    } catch { visit = null; }
  }
  refresh(); known = new Set(markers.map(m => m.id)); keepUrl(true);

  // ── per frame (ui/record/index.js)
  function frame() {
    const t = performance.now();
    if (!visit?.back && P.minute > horizon) horizon = P.minute;
    const H = Math.max(horizon, from + 60);
    const left = ((P.minute - from) / (H - from) * 100).toFixed(3) + '%'; if (head.style.left !== left) head.style.left = left;
    track.setAttribute('aria-valuemax', String(Math.round(horizon))); track.setAttribute('aria-valuenow', String(Math.round(P.minute)));
    now.hidden = !(P.minute < horizon - .5) && !visit?.back;
    span.textContent = visit?.back ? 'replay' : P.minute < horizon - .5 ? `${clockOf(P.minute)} of ${clockOf(horizon)}` : 'now';
    layout();
    // (the player's speed box shows the replay's 10× and the speed it goes back to)
    if (speedBox && document.activeElement !== speedBox && speedBox.value !== String(P.speed)) speedBox.value = String(P.speed);
    if (drag !== null && drag_x !== null) { const x = drag_x; drag_x = null; seek(minuteAt(x), 'scrub'); }
    if (visit) stepVisit(t);
    if (!visit && P.running) sample(t);
    missed.frame(t);
    keepUrl();
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { tw = track.clientWidth || 1; layout(true); }).observe(track);
  else addEventListener('resize', () => { tw = track.clientWidth || 1; layout(true); });
  tw = track.clientWidth || 1;
  const tape = {
    frame, goMarker, replayPaper, replayCard, refresh, missed, el: row, pop, cap, log,
    markers: () => markers.map(m => ({ ...m })),
    get horizon() { return horizon; },
    get visit() { return visit ? { kind: visit.kind, id: visit.id, phase: visit.phase, start: visit.start, end: visit.end, back: visit.back, framing: visit.framing, landed: visit.landed ?? null } : null; },
    get seen() { return [...seen]; },
    stats: () => ({ markers: markers.length, horizon, minute: P.minute, visit: tape.visit, missed: missed.stats(), visits: log.visits.length, seeks: log.seeks }),
  };
  return tape;
}
