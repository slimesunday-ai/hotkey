// HUMAN LAYER · SECTION 2a · THE TAPE PLAYER (the controller). LIVE ↔ TAPE: a watcher scrubs back through the director's cut and watches
// the city replay with its secrets visible: thoughts, DMs, private deals, cash — never past the horizon (now − delay; ARCHIVE: all of it).
//   in        the dossier's Watch tape (TAPE at that agent: selected and followed) · the Tape chip bottom left (TAPE where the camera is)
//   out       Back to live / Esc (with the dossier closed): camera, selection, pins, dossier — exactly as they were
//   the city  ui/tape/map.js: the sim layer and the walkers driven by the tape at the scrub time (a seek snaps them, play walks them)
//   on screen ui/tape/transport.js (the bottom bar) · ui/tape/bubbles.js (thoughts, DM arcs, deal icons) · the TAPE frame round the screen
//   an event  a marker clicked on the timeline: the camera goes where it happens and the tape plays it (goToEvent below)
//   data      simstate/tapeworker.js → tapeplay.js (a worker: opening never stalls the page), extended every 10 s as the horizon moves on
// API for every other screen (2b): ui/tape/state.js, TAPE.md. Nothing here runs per frame while TAPE is closed, after the camera is back.
import { h, button, toast, prefs, lens as lensBadge } from '../kit.js';
import { tape } from './state.js';
import { createTransport, kindLabel } from './transport.js';
import { resolve, placesNow } from '../goto.js';
import { shotsFor } from '../../camera/shots.js';
import { createSecrets } from './bubbles.js';
import { createTapeMap } from './map.js';
import { TOD } from '../../kit.js';
import { sdata } from '../../../../world/city.js';   // (SPREAD: the data this spread reads)

const SECRETS_KEY = 'aicity.ui.tape.secrets', EXTEND_MS = 10000, OPEN_BACK = 120;   // (TAPE opens two game hours before the horizon)
export function mountTape(api, ui) {
  const { sim, dossier, city, root } = ui, rig = api.cam;
  if (!document.querySelector('link[data-tp-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./tape.css', import.meta.url).href, 'data-tp-css': '' }));
  const live = window.__simlive, map = live?.layer ? createTapeMap({ api, live }) : null;
  const frameEl = h('div', { class: 'tp-frame', 'aria-hidden': 'true' }); root.prepend(frameEl);
  const inChip = h('div', { class: 'tp-in' }, lensBadge('live'), button('Tape', { icon: 'tape', tip: 'Watch the tape: the city a day ago, secrets and all', onclick: () => open({}) })); root.append(inChip);
  let transport = null, secrets = null, worker = null, saved = null, restore = null, pendingOpen = null, last = null, agentsAt = new Map(), cards = new Map(), markers = [], evChunks = [], evAll = null, todGuard = null, todAt = 0, todRelease = false;
  let req = { busy: false, pending: null, id: 0, snap: new Map() }, lastReqMin = null, lastReqAt = 0, extendTimer = 0, followWant = null, followTries = 0, secretsOn = prefs.get(SECRETS_KEY) !== '0', stateWait = new Map(), sid = 0;
  const B = { frames: 0, ms: 0, max: 0, rtt: 0 };
  const liveRate = () => { const c = sim.clock(); return c && c.speed > 0 ? c.speed : 1.6; };
  const focus = () => [dossier.isOpen ? dossier.current : null, rig?.mode === 'follow' && rig.subject?.agent ? rig.subject.aid : null, tape.handle];
  // ── the worker: data in the background
  function startWorker() {
    if (worker) { worker.postMessage({ type: 'open' }); return; }
    worker = new Worker(new URL('../../simstate/tapeworker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => onMsg(e.data); worker.onerror = e => { tape._set({ loading: false, error: String(e.message || 'the tape worker failed') }); transport?.setLoading(false, 'The tape could not load.', 'No tape'); };
    fetch(new URL(sdata('../../../../sim2/places.json'), import.meta.url)).then(r => r.json()).then(pj => worker.postMessage({ type: 'open', url: sim.info.url, places: pj, night: !!TOD.night })).catch(err => onMsg({ type: 'error', error: String(err) }));   // (the page is built for day or night: home lights draw only at night)
  }
  function onMsg(m) {
    if (m.type === 'data') { onData(m); return; }
    if (m.type === 'frame') { onFrame(m); return; }
    if (m.type === 'state') { stateWait.get(m.id)?.(m.state); stateWait.delete(m.id); return; }
    if (m.type === 'error') { console.warn('[tape]', m.error); if (tape.loading) { tape._set({ loading: false, error: m.error }); transport?.setLoading(false, /HTTP 404/.test(m.error) ? 'This sim serves no tape yet.' : `The tape could not load (${m.error}): trying again every ${EXTEND_MS / 1000} s`, 'No tape'); } }
  }
  function onData(m) {
    if (m.reset) { evChunks = []; evAll = null; if (tape.active && !pendingOpen) back(); }   // (a new epoch the worker saw first: the whole tape follows)
    if (m.markers) { markers = m.markers; transport?.setMarkers(markers); }
    if (m.events) evChunks.push(m.events);   // (new events only: events() appends them to what it already holds)
    win = m.window || {};
    if (!applyWindow()) return;
    if (pendingOpen && tape.active) { const p = pendingOpen, w = tape.window(); pendingOpen = null; const model = map.enter(); worker.postMessage({ type: 'seed', model });
      const t0 = p.at ?? Math.max(w.start, w.horizon - OPEN_BACK); tape.seek(t0, 'open'); if (p.handle) { followWant = p.handle; followTries = 0; } }
  }
  // THE HORIZON THE BROADCAST ALLOWS (review 10-09 #5): the tape's window is the worker's (GET /tape: the server's now − delay), never
  // past the store's own horizon (sim.tape.horizon: the director's cut of the states the delay line has released, so the tape runs one
  // game day behind the LIVE on screen, not behind the sim D s ahead of it), and moves with it every tick. A finished season (ARCHIVE)
  // is open end to end; a server without the director's view (no store horizon) leaves the worker's. Nothing left (pending, or the
  // cap before the tape's start): no tape yet. → true when the tape has a window
  let win = null;
  const capOf = hz => hz === null || hz === undefined ? null : tape.lens === 'archive' || win?.archive ? hz : sim.tape.pending ? null : typeof sim.tape.horizon === 'number' ? Math.min(hz, sim.tape.horizon) : hz;
  function applyWindow() {
    const w = win || {}, hz = w.pending ? null : capOf(w.horizon), cur = tape.window();
    if (hz === null || w.start === null || w.start === undefined || hz < w.start) {
      if (cur.horizon !== null || tape.loading) { tape._set({ loading: false, start: null, horizon: null, loadedTo: null, ...(tape.time() !== null ? { t: null, playing: false } : {}) }); transport?.setLoading(false, 'The tape starts a game day into the city.', 'No tape yet'); }
      return false; }
    const next = { start: w.start, horizon: hz, loadedTo: w.loadedTo === null ? null : Math.min(w.loadedTo, hz), delay: w.delay, lens: w.archive ? 'archive' : tape.lens };
    if (tape.loading || cur.horizon === null || next.start !== cur.start || next.horizon !== cur.horizon || next.loadedTo !== cur.loadedTo) { const was = tape.loading || cur.horizon === null; tape._set({ ...next, loading: false }); if (was) transport?.setLoading(false); }
    return true;
  }
  // THE SIM'S CLOCK WENT BACK (the store's epoch: broadcast.js's test, at the moment the delay line flushed; review 10-09 #5: the tape kept
  // its horizon and could be scrubbed 1229 game min past the allowed one): TAPE closes, the worker starts an empty player, and the page
  // drops its copy of the tape's events and markers; the next open fetches the new timeline's tape whole
  const BACK = 'The sim’s clock went back (a restart or a loop): the tape starts over';
  function back() { close(); toast(BACK); }
  sim.on('epoch', () => { const was = tape.active; if (was) close(); evChunks = []; evAll = null; markers = []; transport?.setMarkers(markers); win = null; worker?.postMessage({ type: 'reset' });
    tape._set({ start: null, horizon: null, loadedTo: null }); if (was) toast(BACK); });   // (the old window goes too: nothing reads the left timeline's horizon)
  sim.on('tick', () => { if (tape.active && win) applyWindow(); });
  // ── frames: one in flight; the newest asked for waits (a drag sends many seeks, the worker answers the latest)
  const rank = s => s === 'all' ? 2 : s === 'changed' ? 1 : 0;
  function request(t, snap = false) { const p = req.pending; req.pending = { t, snap: rank(p?.snap) > rank(snap) ? p.snap : snap }; pump(); }
  function pump() { if (req.busy || !req.pending || !worker || !map?.on) return; const p = req.pending; req.pending = null; req.busy = true; lastReqMin = Math.floor(p.t); lastReqAt = performance.now();
    const id = ++req.id; req.snap.set(id, p.snap); worker.postMessage({ type: 'frame', id, t: p.t, agents: [...new Set(focus().filter(Boolean))], snap: p.snap === 'all' }); }
  function onFrame(m) {
    req.busy = false; const snap = req.snap.get(m.id) || false; req.snap.delete(m.id); B.rtt = performance.now() - lastReqAt;
    if (m.f && tape.active && map?.on) { const t0 = performance.now(); last = m.f; map.apply(m.f.diff, snap || false); for (const [k, v] of Object.entries(m.f.agents || {})) agentsAt.set(k, v); cards = new Map(Object.entries(m.f.cards || {}));
      dossier.refresh?.(); const ms = performance.now() - t0; B.frames++; B.ms += (ms - B.ms) * .1; B.max = Math.max(B.max, ms); }
    pump();
  }
  // ── the dossier's source in TAPE: the agent as of the tape time (asked of the worker with every frame)
  const source = {
    get lens() { return tape.lens === 'archive' ? 'archive' : 'tape'; },
    get(hh) { const a = agentsAt.get(hh); if (!a || (last && a.asOf !== Math.floor(last.t))) { if (tape.time() !== null && !req.busy) request(tape.time()); } return a || null; },
    stamp() { const c = tape.clock(); return c ? c.label : ''; },
    back: () => close(),
  };
  // ── open / close
  function saveLive() { const cam = api.camera, ctl = api.controls;
    return { mode: rig?.mode ?? 'orbit', aid: rig && (rig.mode === 'follow' || (rig.mode === 'photo' && rig.photoSub === 'follow')) && rig.subject?.agent ? rig.subject.aid : null,
      pos: cam.position.toArray(), tgt: ctl.target.toArray(), fov: cam.fov, dossier: dossier.isOpen ? dossier.current : null, pins: city.pins }; }
  function ensureUI() { if (transport) return;
    transport = createTransport({ root, liveNow: () => tape.lens === 'archive' ? null : sim.clock()?.t ?? null, onLive: () => close(), onSecrets: () => toggleSecrets(), onEvent: m => goToEvent(m) }); transport.setSecrets(secretsOn);
    secrets = createSecrets({ api, root }); secrets.set(secretsOn); }
  function open({ handle = null, at = null } = {}) {
    if (tape.active) { if (handle) { dossier.open(handle); followWant = handle; followTries = 0; } if (at !== null) tape.seek(at, 'open'); return true; }
    if (!map) { toast('The tape needs the live city (?sim=live)'); return false; }
    if (!sim.info?.url) { toast('No sim connected: nothing on tape'); return false; }
    saved = saveLive(); restore = null; ensureUI(); agentsAt.clear(); cards.clear(); last = null;
    tape._set({ active: true, handle, lens: sim.lens === 'archive' ? 'archive' : 'tape', loading: true, error: null, base: liveRate(), t: null, playing: false });
    transport.show(true); transport.setMarkers(markers); transport.setLoading(true); frameEl.setAttribute('data-lens', tape.lens); frameEl.classList.add('is-on'); inChip.hidden = true;
    dossier.setSource?.(source); if (handle) dossier.open(handle); else dossier.refresh?.();
    pendingOpen = { handle, at }; startWorker();
    clearInterval(extendTimer); extendTimer = setInterval(() => { if (tape.active && worker && !tape.loading) worker.postMessage({ type: 'extend' }); }, EXTEND_MS);
    return true;
  }
  function close() {
    if (!tape.active) return false;
    clearInterval(extendTimer); extendTimer = 0; pendingOpen = null; followWant = null; req.pending = null; visit?.go?.cancel(); visit = null; pre = null;
    map?.exit(); secrets?.clear(); transport?.show(false); frameEl.classList.remove('is-on'); inChip.hidden = false;
    dossier.setSource?.(null); tape._set({ active: false, handle: null });
    const s = saved; saved = null; last = null; agentsAt.clear(); cards.clear(); todRelease = true;   // (the held day/night reload: once the camera is back)
    if (s) { city.setPins(s.pins); if (s.dossier) dossier.open(s.dossier); else if (dossier.isOpen) dossier.close(); restore = { ...s, tries: 0 }; }
    return true;
  }
  // the camera back where it was: after the live walkers are placed again (a frame or two), so a follow finds its person
  function restoreCamera() { const s = restore; if (!s) return; s.tries++;
    if (!rig) { api.camera.position.fromArray(s.pos); api.controls.target.fromArray(s.tgt); api.camera.fov = s.fov; api.camera.updateProjectionMatrix(); api.controls.update(); restore = null; return; }
    if (s.mode === 'follow' && s.aid) { const w = rig.people.byAid(s.aid); if (w) { rig.setMode('follow', { subject: w }); city.follow(s.aid); restore = null; return; } if (s.tries < 30) return; }
    rig.setMode('orbit', { view: { pos: s.pos, tgt: s.tgt, fov: s.fov } }); restore = null; }
  // DAY / NIGHT: the page is built for one or the other, and simstate/live.js reloads it into the live sim's when they differ. While TAPE is
  // open that reload would close the tape, so it is held off: live.js skips a reload within 15 s of the last one (its own loop guard,
  // sessionStorage 'simlive-reload'), so TAPE keeps that stamp fresh. Back to LIVE puts the real stamp back: a reload that came due
  // meanwhile happens then (on the next live poll), and live.js's own loop guard is as it was.
  const TOD_KEY = 'simlive-reload';
  function holdTod() { const now = Date.now(); if (now - todAt < 2000) return; todAt = now; try { if (todGuard === null) todGuard = sessionStorage.getItem(TOD_KEY) ?? ''; sessionStorage.setItem(TOD_KEY, String(now)); } catch {} }
  function releaseTod() { if (todGuard === null) return; try { if (todGuard === '') sessionStorage.removeItem(TOD_KEY); else sessionStorage.setItem(TOD_KEY, todGuard); } catch {} todGuard = null; todAt = 0; }
  function toggleSecrets() { secretsOn = !secretsOn; prefs.set(SECRETS_KEY, secretsOn ? '1' : '0'); secrets?.set(secretsOn); transport?.setSecrets(secretsOn); toast(secretsOn ? 'Secrets on: thoughts, DMs, deals' : 'Secrets hidden'); }
  // ── GO TO AN EVENT: a marker clicked on the timeline (slime 10-09: "the timeline doesn't take us to events when we click it and play
  // it back"). The tape goes a beat before the event (VISIT.leadS real seconds of play at the speed it will play at), the camera to the
  // event's shot (camera/shots.js: who is in it, framed; eventSpec), and once the camera is there the tape plays. The stage
  // (stage/index.js) plays the event out as the tape crosses its minute, culprits and all (the tape lens), but only in view and below
  // 16x (else the aftermath only): hence the wait for the camera and the 4x cap. All of it runs on the tape's own clock and data; the sim
  // is never asked to seek (a live sim can't).
  const VISIT = { leadS: 2.5, frameMs: 3000, flyMs: 17000 }, shots = shotsFor(api);
  let visit = null;
  function goToEvent(m) {
    if (!tape.active || !m || tape.loading || !map?.on) return false;
    tape.pause(); if (tape.speed > 4) tape.setSpeed(4);
    // the camera is the event's from the click: a follow (Watch tape's, a person clicked) lets go now, not at the flight — it chased the
    // walker the seek moved for the visit's first frames (a cut to wherever the tape had them), and a follow still wanted re-took the
    // camera from the shot
    followWant = null; if (rig?.mode === 'follow') rig.toOrbit({ instant: true });
    const t0 = tape.seek(m.t - Math.max(1, tape.rate * VISIT.leadS), 'event'); if (t0 === null) return false;
    visit?.go?.cancel(); const v = visit = { m, t0, phase: 'frame', at: performance.now(), pt: null, go: null, state: null };
    stateAt(m.t - .5).then(st => { if (visit === v) v.state = st || false; });   // (the city just before it: where its agents stood)
    const c = tape.clock(m.t); toast(`${kindLabel(m)}${c ? ' · ' + c.label : ''}: going there`);
    return true;
  }
  // THE SHOT (TV plan A2: camera/shots.js; eventShot lived here) of a marked event: who is in it (both: the tape lens names the culprit),
  // where they will be when it happens. That is the place the tape has them at just before it (S; or where the trip they are on ends by
  // then): the stand spot they have claimed there, their walker once it stands there (within 12 m), else the place (a corner's stand
  // spot, a house's door, the Heap). Not the walker as the seek drew it: a minute before a robbery the victim is often still walking in,
  // 100 m off (that walker is where they come from: the line, and the way in the shot keeps in frame). The action is the one it happens
  // to (the victim, the one arrested), else its place. A mark: who earned it; the Director's: a district, wide. The scene is the place
  // and the pair, so the payback two minutes later is shot from the same side of them (the 180° rule).
  function eventSpec(m, S, now = false) {
    const ctx = live?.stage?.ctx, M = live?.agents?.map;
    const place = id => { if (typeof id !== 'string' || !id) return null; const p = ctx?.placePos?.(id) || resolve({ place: id });
      return p ? { x: p.x, z: p.z, label: placesNow()?.name(id) || '', coarse: !!p.coarse } : null; };
    const drawn = hh => { const w = hh ? M?.get(hh)?.w : null; return w?.p && !w.gone ? { x: w.p[0], y: w.p[1], z: w.p[2], h: hh, label: '@' + hh } : null; };
    const agent = hh => { if (!hh) return null; const a = S?.agents?.find(x => x.handle === hh), w = drawn(hh), rec = M?.get(hh), sp = rec?.spot;
      const id = a ? (a.trip ? (a.trip.arr <= m.t + 1 ? a.trip.to : null) : a.at) : cards.get(hh)?.at, p = place(id);
      const at = sp && sp.place === id ? (w && Math.hypot(w.x - sp.x, w.z - sp.z) <= 1.5 ? w : { x: sp.x, y: sp.y, z: sp.z, h: hh, label: '@' + hh, from: w })   // (the stand spot simstate/agents.js has claimed for them there)
        : p && w && Math.hypot(w.x - p.x, w.z - p.z) <= 12 ? w : p ? { ...p, h: hh, from: w } : w;   // (from: where they are walking in from — it sets the line the camera keeps to one side of)
      return now && w && at && rec?.mode === 'stand' && Math.hypot(w.x - at.x, w.z - at.z) <= 6 ? w : at; };   // (the pre-roll: standing there now, a few steps off the guess)
    const scene = 'tape:' + (m.at || '') + ':' + [m.who, m.to].filter(Boolean).sort().join('+');
    if (m.kind === 'director') { const at = m.to ? agent(m.to) : m.at ? resolve({ dist: m.at }) : null; return at ? { at, coarse: !!at.coarse || !m.to, label: at.label } : null; }
    if (m.kind === 'mark') { const at = agent(m.who); return at ? { at, actors: [at], scene, sceneT: m.t, label: at.label } : null; }
    // A BREAK-IN is shot at the house (slime 10-10: "doesnt even take us to his house"). It happens to someone who is mostly out (that is
    // when a burglar comes), so the order below (the one it happens to first) flew to wherever the victim was: the Heap, 250 m off, while
    // the burglar went in. The house is the shot (establishing: the place, about 26 m out, from the lowest pitch that sees its door;
    // the 8–14 m two-shot of the burglar at the door put a tree's crown between the camera and the door on Pad 1), and in it whoever
    // the tape has there: the burglar walking up to it (the tape names them), the owner if home
    if (m.type === 'burgle') { const house = place(m.at); if (house && !house.coarse) { const there = a => a && !a.coarse && Math.hypot(a.x - house.x, a.z - house.z) <= 14;
      return { kind: 'establishing', at: house, actors: [agent(m.who), agent(m.to)].filter(there), scene, sceneT: m.t, label: house.label }; } }
    const at = m.kind === 'arrest' ? agent(m.to) || agent(m.who) : agent(m.to) || place(m.at) || agent(m.who);
    if (!at) return null; const actors = [agent(m.who), agent(m.to)].filter(a => a && !a.coarse);
    return { at, actors, coarse: !!at.coarse, scene, sceneT: m.t, label: at.label || '' };
  }
  const photoMode = () => !!rig && (rig.mode === 'photo' || document.body.classList.contains('cam-photo'));   // (photo mode keeps its frame)
  // per frame while a visit is on: the seek's frame drawn (the walkers where the tape has them) → the shot (near: a flight; far: the
  // cut behind the load-in, then the settle) → play. THE PRE-ROLL (pre): 1.1 s into the play, before the event's minute, the actors
  // stand where the tape has them now; if the camera can't see one of them from where it is, shots.reframe moves it (0.6 s), else nothing
  let pre = null;
  function stepVisit() {
    const v = visit, now = performance.now();
    if (!tape.active || tape.playing) { v.go?.cancel(); visit = null; return; }   // (closed, or the watcher pressed play: theirs now)
    if (v.phase === 'frame') {
      if (!(last && last.t === v.t0 && v.state !== null) && now - v.at < VISIT.frameMs) return;
      const spec = eventSpec(v.m, v.state); v.pt = spec?.at || null; v.phase = 'fly'; v.at = now;
      if (spec && !photoMode()) { v.go = shots.go(spec); return; }
      v.phase = 'play'; }
    if (v.phase === 'fly') {
      if (v.go && !v.go.over && now - v.at < VISIT.flyMs) return;
      const p = v.go?.plan; v.shot = p ? { kind: p.kind, d: p.d, pitch: +p.pitch.toFixed(3), hd: +p.hd.toFixed(2), side: p.side, vis: p.vis, how: p.how, far: v.go.far } : null; }
    visit = null; tape.play(); pre = v.go?.plan && v.go.plan.kind !== 'wide' ? { m: v.m, state: v.state, at: performance.now() + 1100 } : null;
  }
  function stepPre() { const p = pre; if (performance.now() < p.at) return; pre = null; const t = tape.time();
    if (!tape.active || !tape.playing || t === null || t >= p.m.t || photoMode()) return; const sp = eventSpec(p.m, p.state, true); if (sp && !sp.coarse) shots.reframe(sp); }
  // ── the tape's events, read by every screen (lazily parsed: the worker sends them as text)
  // F19 (audit 2026-10-08) · the chunks were flattened with push(...chunk), one argument per event: a long season's chunk (150 000 events
  // in node) threw RangeError, and every new chunk re-parsed the whole history (and re-stringified it). Now each chunk is parsed once,
  // appended event by event to the events already held, and dropped.
  function events(opt = {}) { if (!evAll || evChunks.length) { evAll ??= []; for (const c of evChunks) { const a = JSON.parse(c); for (let k = 0; k < a.length; k++) evAll.push(a[k]); } evChunks = []; }
    const { from = null, to = null, handle = null, types = null, limit = 0 } = opt, T = types ? new Set(types) : null, hz = tape.window().horizon ?? -Infinity;
    let out = evAll.filter(e => e.t <= hz && (from === null || e.t >= from) && (to === null || e.t <= to) && (!handle || e.who === handle || e.to === handle) && (!T || T.has(e.type)));
    return limit > 0 ? out.slice(-limit) : out; }
  function stateAt(t) { if (!worker) return Promise.resolve(null); const id = ++sid; return new Promise(res => { stateWait.set(id, res); worker.postMessage({ type: 'state', id, t }); }); }
  // tape.agent(h): the full view for the agents the dossier and the camera focus on; for anyone else, the card only ({ live, partial: true })
  const agentView = hh => agentsAt.get(hh) || (cards.has(hh) ? { handle: hh, live: cards.get(hh), partial: true, asOf: last ? Math.floor(last.t) : null } : null);
  tape._bind({ open, close, events, markers: () => markers, stateAt, agent: agentView });
  tape.on('seek', ({ t, by }) => { if (by !== 'event') { visit?.go?.cancel(); visit = null; pre = null; } request(t, 'all'); });   // (any other seek: the watcher took over from goToEvent)
  // ── keys (capture; added BEFORE ui/index.js's, which closes the crowd chooser and the dossier: so Esc waits while either is open, and
  // is back to LIVE once nothing else is). ← → stay with a focused control that walks with them: the menu bar, Settings' segmented
  // controls, a tab row, a chooser (review 10-09 #11: the tape took them, so the focus never moved); the tape's own track is the tape's
  const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
  const OWN_ARROWS = '[role="toolbar"], [role="radiogroup"], [role="tablist"], [role="menu"], [role="listbox"]';
  addEventListener('keydown', e => {
    if (!tape.active || e.defaultPrevented || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; if (e.target?.closest?.('.k-tabs, .k-chooser')) return;
    const k = e.code;
    if (k === 'Space') tape.toggle();
    else if ((k === 'ArrowLeft' || k === 'ArrowRight') && !e.target?.closest?.(OWN_ARROWS)) { const d = k === 'ArrowLeft' ? -1 : 1; if (e.shiftKey) tape.jump(60 * d); else tape.step(d); }
    else if (k === 'Escape') { if (dossier.isOpen || root.querySelector('.k-chooser')) return; close(); }
    else if (k === 'KeyT') toggleSecrets();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  // ── per frame (ui/index.js frame, after the walkers moved, before the render)
  function frame(dt) {
    if (restore) restoreCamera(); else if (todRelease && !tape.active && !rig?.blending) { todRelease = false; releaseTod(); }
    if (!tape.active) return;
    todRelease = false; holdTod(); tape._advance(dt); transport.frame(); if (visit) stepVisit(); else if (pre) stepPre();
    const t = tape.time(); if (t === null || !map?.on) return;
    map.clock(t, tape.playing ? tape.rate : 0, tape.playing);
    if (tape.playing && Math.floor(t) !== lastReqMin && performance.now() - lastReqAt > 80) request(t, tape.speed >= 16 ? 'changed' : false);
    if (followWant && last) { const w = rig?.people?.byAid(followWant); if (w) { rig.setMode('follow', { subject: w }); city.follow(followWant); followWant = null; }
      else if (++followTries > 40) { const a = agentsAt.get(followWant); toast(`@${followWant} is ${a?.live?.now || 'off the street'} at this moment`); followWant = null; } }
    secrets.frame(last?.secrets, t, focus());
  }
  // ?tape=1 opens TAPE once the live city is up (&tapeat=<minutes | D3 14:00>, &tapeplay=<1|4|16|60> starts playing): a link straight into the tape
  { const Q = new URLSearchParams(location.search); if (Q.get('tape') === '1' || Q.get('tape') === 'open') { const at = Q.get('tapeat'), m = at && /^D?(\d+)\s+(\d{1,2}):(\d{2})$/i.exec(at), sp = +Q.get('tapeplay');
    const go = () => { open({ handle: Q.get('tapeagent') || null, at: m ? (+m[1] - 1) * 1440 + +m[2] * 60 + +m[3] : at !== null && Number.isFinite(+at) ? +at : null });
      if (sp) { const off = tape.on('seek', () => { off(); tape.setSpeed(sp); tape.play(); }); } };
    sim.ready.then(() => setTimeout(go, 600)); } }
  const api2 = { open, close, frame, toggleSecrets, goToEvent, get visit() { return visit ? { kind: visit.m.kind, t: visit.m.t, phase: visit.phase, pt: visit.pt, shot: visit.shot ?? null } : null; }, get transport() { return transport; }, get secrets() { return last?.secrets ?? null; }, get active() { return tape.active; }, source,
    stats: () => ({ active: tape.active, t: tape.time(), playing: tape.playing, speed: tape.speed, window: tape.window(), frames: B.frames, applyMs: +B.ms.toFixed(3), applyMax: +B.max.toFixed(2), rttMs: +B.rtt.toFixed(1), map: map?.stats(), secrets: secrets?.stats(), transport: transport?.stats() }) };
  return api2;
}
