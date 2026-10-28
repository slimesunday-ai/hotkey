// HUMAN LAYER · SECTION 2b · TRAILS: where an agent went, drawn on the ground. Up to 5 agents at once, a colour each, to compare.
//   the ribbon   one mesh per agent (one draw call): a flat strip a little above the ground, its own ink outline in the shader (toon),
//                chevrons drifting the way it walked; it widens with the camera's distance so it reads from the usual heights. Walked
//                trips follow the sidewalk graph (pedsim.js wayTo: the same one-way graph the walkers use), corners rounded; a taxi ride
//                or a trip with no sidewalk is a dashed arc over the roofs. depthWrite off + polygon offset: no z-fighting.
//   the stops    a disc at every place it stayed (one instanced mesh for every trail), a time tag on each (DOM, ≤ 40, hidden far out)
//   the legend   bottom left: who is trailed, the window (6 h · 24 h · a day · the tape's window), × to drop one
//   tape         with the tape player on (ui/tape/state.js, section 2a), the window is the tape's and the part after the tape's time
//                is faded, with a dot where the agent is at that time
// Data: ui/tape/trails-data.js (PUBLIC `move` events only). LIVE: the store's public log (sim.events). TAPE: sim.tape.get (the server
// clamps it to the horizon). Off, it costs nothing: no mesh in the scene, no listener, no per-frame work. Per frame while on: a few
// uniforms and the tags' projection, from the meshes' onBeforeRender.
import { h, set, attr, button, lens as lensBadge, toast, getRoot, onSkinChange } from '../kit.js';
import { tripsOf, robsOf, posAt, hhmm, durOf, stampOf, dayOf, DAY } from './trails-data.js';
import { sdata } from '../../../../world/city.js';   // (SPREAD: the data this spread reads)

const SIDE = 0.2, LIFT = .07, MAX = 5, NODE = 1.2, TAGS = 40;
const css = () => { if (!document.querySelector('link[data-trails-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./trails.css', import.meta.url).href, 'data-trails-css': '' })); };
let PLACES = null;
export const placesBook = () => PLACES ??= fetch(new URL(sdata('../../../../sim2/places.json'), import.meta.url)).then(r => r.json()).then(p => { const m = new Map([...(p.places || []), ...(p.lots || [])].map(q => [q.id, q])); return { get: id => m.get(id) || null, name: id => (m.get(id)?.name || (String(id || '').startsWith('lot:') ? 'a house' : id || '?')).replace(/\s*\(DROP\)$/, '') }; }).catch(() => ({ get: () => null, name: id => id }));

export function createTrails({ api, sim, tape = null }) {
  css();
  const { THREE, scene, camera } = api, root = getRoot();
  const trails = [];   // { handle, slot, data, mesh, tags: [{ el, x, y, z }], nowEl }
  let win = { kind: 'last', hours: 24 }, legend = null, stopsMesh = null, dirty = 0, lastFrame = 0, unsubs = [], book = null, busy = 0;
  const stat = { builds: 0, buildMs: 0, frameMs: 0, verts: 0, legs: 0, routed: 0, arcs: 0, cut: 0 };
  // ── colours (tokens: --k-trail-1 … 5, --k-trail-ink; per skin in trails.css)
  const cols = [], ink = new THREE.Color(); let shade = 0;
  const readCols = () => { const cs = getComputedStyle(root); for (let k = 0; k < MAX; k++) cols[k] = new THREE.Color(cs.getPropertyValue('--k-trail-' + (k + 1)).trim() || '#ff3d6e'); ink.set(cs.getPropertyValue('--k-trail-ink').trim() || '#17171b'); shade = cs.getPropertyValue('--k-trail-edge').trim() === 'shade' ? 1 : 0;   // (zte: the edge is the trail's own colour, darker: corner shading, never an ink line, STYLE.md §8)
    for (const T of trails) if (T.mesh) { T.mesh.material.uniforms.uCol.value.copy(cols[T.slot]); T.mesh.material.uniforms.uInk.value.copy(ink); T.mesh.material.uniforms.uShade.value = shade; } if (stopsMesh) paintStops(); if (legend) drawLegend(); };
  onSkinChange(() => requestAnimationFrame(readCols));
  // ── the lens: archive (a finished season) · tape (the tape player is on) · live
  const lensNow = () => sim.lens === 'archive' ? 'archive' : tape?.active ? 'tape' : 'live';
  // the window: LIVE ends now; on TAPE it is the same choice around the tape's time (6 h · 24 h back from it, or its whole day, the part
  // after the tape's time faded), clamped to what is on tape
  function windowNow() {
    const L = lensNow(), tt = L === 'tape' ? tape.time() : null, now = tt ?? sim.clock()?.t ?? 0, tw = L === 'tape' ? tape.window() : null;
    const clampW = (a, b) => tw ? { from: Math.max(tw.start ?? 0, a), to: Math.min(tw.horizon ?? b, b) } : { from: a, to: b };
    if (win.kind === 'day') return { ...clampW((win.day - 1) * DAY, Math.min(win.day * DAY - 1, L === 'tape' ? Infinity : now)), label: `Day ${win.day}` };
    return { ...clampW(Math.max(0, now - win.hours * 60), now), label: `last ${win.hours} h` };
  }
  // ── data
  async function load(handle) {
    const w = windowNow(), L = lensNow(), card = sim.agent(handle)?.live;
    if (L === 'live') { const dist = at => book?.get(at)?.dist ?? null;   // (a stay shown only by its district is cut by a burglary in that district: trails-data)
      const pos = at => { const p = book?.get(at); return p && typeof p.x === 'number' ? { x: p.x, z: p.z } : null; };   // (a district stay ends at the next public arrive: trails-data)
      const evs = sim.events({ handle, types: ['move', 'arrive'] }), burgles = sim.events({ types: ['burgle'] }).map(e => ({ at: e.at, t: e.t, dist: dist(e.at) })), robs = robsOf(sim.events({ types: ['rob'] })).map(r => ({ ...r, dist: dist(r.at) }));
      return tripsOf(evs, handle, w.from, w.to, { lens: 'live', burgles, robs, home: card?.home, pos }); }
    const te = L === 'tape' ? tape.events({ from: Math.max(0, w.from - DAY), to: w.to, handle, types: ['move'] }) : null;
    if (te?.length) return tripsOf(te, handle, w.from, w.to, { lens: L, home: card?.home });
    const r = await sim.tape.get(Math.max(0, w.from - DAY), w.to, { handle, snaps: false });
    const to = r.horizon != null ? Math.min(w.to, r.horizon) : w.to; if (r.pending) return { handle, from: w.from, to: w.from, legs: [], stops: [], cut: 0, pending: true };
    return tripsOf(r.events, handle, w.from, to, { lens: L, home: card?.home });
  }
  // ── geometry: the routed polyline of a leg, else an arc
  const atE = (E, s, y) => [E.from.x + (E.to.x - E.from.x) * s / E.len, y, E.from.z + (E.to.z - E.from.z) * s / E.len];
  function routeLeg(L) {
    const S = api.peds?.sim; if (!S || L.taxi) return null;
    const a = S.laneNear(L.x0, L.z0, 70), b = S.laneNear(L.x1, L.z1, 70); if (!a || !b) return null;
    const way = S.wayTo(a.E, a.s, { E: b.E, s: b.s }); if (!way) return null;
    const P = [[L.x0, SIDE, L.z0], atE(a.E, a.s, SIDE)];
    const walk = (E, s0, s1) => { if (!E.cross) { P.push(atE(E, s1, SIDE)); return; }
      for (const s of [NODE - .05, NODE + .2, E.len - NODE - .2, E.len - NODE + .05]) if (s > s0 && s < s1) P.push(atE(E, s, s > NODE && s < E.len - NODE ? 0 : SIDE)); P.push(atE(E, s1, SIDE)); };
    if (!way.length) walk(a.E, a.s, b.s);
    else { walk(a.E, a.s, a.E.len); for (let k = 0; k < way.length; k++) { const E = way[k]; walk(E, 0, k === way.length - 1 ? b.s : E.len); } }
    P.push([L.x1, SIDE, L.z1]); return P;
  }
  function arcLeg(L) { const d = Math.hypot(L.x1 - L.x0, L.z1 - L.z0), hgt = Math.min(36, 4 + d * .12), P = [];
    for (let k = 0; k <= 24; k++) { const f = k / 24; P.push([L.x0 + (L.x1 - L.x0) * f, SIDE + Math.sin(f * Math.PI) * hgt, L.z0 + (L.z1 - L.z0) * f]); } return P; }
  const chaikin = (P, n = 2) => { for (let it = 0; it < n; it++) { if (P.length < 3) return P; const Q = [P[0]]; for (let k = 0; k < P.length - 1; k++) { const a = P[k], b = P[k + 1]; if (Math.hypot(b[0] - a[0], b[2] - a[2]) < .3) { Q.push(b); continue; }
    Q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25, a[2] * .75 + b[2] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75, a[2] * .25 + b[2] * .75]); } Q.push(P[P.length - 1]); P = Q; } return P; };
  // the ribbon of a trail: 2 vertices per point (centre + side ±1); the shader widens it and draws the ink edge, the chevrons, the dashes
  function ribbon(data) {
    const pos = [], nrm = [], side = [], dist = [], time = [], kind = [], idx = []; let D = 0;
    for (const L of data.legs) {
      let P = routeLeg(L), ride = 0; if (P) stat.routed++; else { P = arcLeg(L); ride = 1; stat.arcs++; }
      if (!ride) P = chaikin(P); if (L.hideStart) P = P.slice(Math.floor(P.length * .5));
      let len = 0; const cum = [0]; for (let k = 1; k < P.length; k++) { len += Math.hypot(P[k][0] - P[k - 1][0], P[k][2] - P[k - 1][2]) || 0; cum.push(len); }
      const base = pos.length / 3;
      for (let k = 0; k < P.length; k++) { const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)]; let tx = b[0] - a[0], tz = b[2] - a[2]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const t = L.t0 + (L.t1 - L.t0) * (len ? cum[k] / len : 1);
        for (const s of [-1, 1]) { pos.push(P[k][0], P[k][1] + LIFT, P[k][2]); nrm.push(-tz, tx); side.push(s); dist.push(D + cum[k]); time.push(t); kind.push(ride); } }
      for (let k = 0; k < P.length - 1; k++) { const i = base + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      D += len + 6;
    }
    stat.legs = data.legs.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 2)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(dist, 1)); g.setAttribute('aT', new THREE.Float32BufferAttribute(time, 1)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1)); g.setIndex(idx);
    return g;
  }
  const VS = `attribute vec2 aN; attribute float aSide, aD, aT, aKind; uniform float uW; varying float vSide, vD, vT, vKind;
    void main() { vec3 p = position + vec3(aN.x, 0., aN.y) * aSide * uW * .5; vSide = aSide; vD = aD; vT = aT; vKind = aKind; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`;
  const FS = `uniform vec3 uCol, uInk; uniform float uTime, uNow, uW, uOp, uShade; varying float vSide, vD, vT, vKind;
    void main() { float s = abs(vSide), edge = .66; vec3 c = s > edge ? (uShade > .5 ? uCol * .6 : uInk) : uCol;
      if (vKind > .5) { if (fract(vD / (uW * 3.2)) > .55) discard; }
      else { float ch = fract((vD - s * uW * .7) / (uW * 3.4) - uTime * .3); if (s <= edge && ch < .14) c = mix(c, vec3(1.), .32); }
      float fut = vT > uNow ? .28 : 1.; gl_FragColor = vec4(c, uOp * fut); }`;
  function material(slot) { return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { uCol: { value: cols[slot].clone() }, uInk: { value: ink.clone() }, uShade: { value: shade }, uTime: { value: 0 }, uNow: { value: 1e9 }, uW: { value: 1.2 }, uOp: { value: .95 } } }); }
  // stops: one instanced disc for every trail (ink disc under a colour disc: two instances per stop)
  const disc = new THREE.CircleGeometry(1, 24); disc.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: .96, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  function paintStops() {
    const all = trails.flatMap(T => (T.data?.stops || []).map(s => ({ s, T }))), n = all.length * 2;
    if (stopsMesh) { scene.remove(stopsMesh); stopsMesh.dispose(); stopsMesh = null; } if (!n) return;
    stopsMesh = new THREE.InstancedMesh(disc, discMat, n); stopsMesh.frustumCulled = false; stopsMesh.renderOrder = 6; stopsMesh.name = 'ui-trail-stops'; stopsMesh.castShadow = stopsMesh.receiveShadow = false;
    stopsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); stopsMesh.userData.list = all;
    all.forEach(({ T }, k) => { stopsMesh.setColorAt(k * 2, shade ? cols[T.slot].clone().multiplyScalar(.6) : ink); stopsMesh.setColorAt(k * 2 + 1, cols[T.slot]); });
    placeStops(1.2); scene.add(stopsMesh); stopsMesh.onBeforeRender = perFrame;
  }
  const M4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3();
  function placeStops(w) { if (!stopsMesh) return; stopsMesh.userData.list.forEach(({ s }, k) => { const big = Math.min(2.2, 1 + (s.t1 - s.t0) / 240);
    M4.compose(V3.set(s.x, SIDE + LIFT + .01, s.z), Q0, S3.setScalar(w * .95 * big)); stopsMesh.setMatrixAt(k * 2, M4); M4.compose(V3.set(s.x, SIDE + LIFT + .02, s.z), Q0, S3.setScalar(w * .62 * big)); stopsMesh.setMatrixAt(k * 2 + 1, M4); });
    stopsMesh.instanceMatrix.needsUpdate = true; stopsMesh.instanceColor.needsUpdate = true; }
  // ── the tags (time at each stop) and the "now" dot (tape)
  const tagLayer = h('div', { class: 'tr-tags', 'aria-hidden': 'true' }); root.prepend(tagLayer);
  function makeTags(T) { for (const t of T.tags) t.el.remove(); T.tags = [];
    const stops = T.data.stops.filter(s => s.t1 - s.t0 >= 4 || T.data.stops.length < 8).slice(-Math.max(4, Math.floor(TAGS / Math.max(1, trails.length))));
    for (const s of stops) { const el = h('div', { class: 'tr-tag', 'data-slot': T.slot + 1, 'data-burn': '' }, h('b', null, hhmm(s.t0)), s.t1 - s.t0 >= 20 ? h('span', null, durOf(s.t1 - s.t0)) : ''); el._x = el._y = -1e4; tagLayer.append(el); T.tags.push({ el, x: s.x, y: SIDE + .4, z: s.z }); }
    T.nowEl?.remove(); T.nowEl = h('div', { class: 'tr-now', 'data-slot': T.slot + 1, hidden: true }, h('i'), h('span', null, '@' + T.handle)); tagLayer.append(T.nowEl); }
  const W = () => api.renderer.domElement.clientWidth || innerWidth, H = () => api.renderer.domElement.clientHeight || innerHeight;
  function perFrame() {
    const t0 = performance.now(); if (t0 - lastFrame < 4) return; lastFrame = t0;
    const d = camera.position.distanceTo(api.controls.target), w = Math.max(.9, Math.min(4.2, d * .016)), now = tape?.active && tape.time ? tape.time() : 1e9, tt = t0 / 1000;
    for (const T of trails) if (T.mesh) { const u = T.mesh.material.uniforms; u.uW.value = w; u.uTime.value = tt; u.uNow.value = now; }
    if (Math.abs(w - (placeStops.w || 0)) > .05) { placeStops(w); placeStops.w = w; }
    const far = d > 320;
    for (const T of trails) { for (const g of T.tags) { V3.set(g.x, g.y, g.z).project(camera); const on = !far && V3.z < 1 && V3.z > -1 && Math.abs(V3.x) < 1.05 && Math.abs(V3.y) < 1.05;
        if (!on) { if (g.el._x !== -1e4) { g.el.style.transform = 'translate3d(-9999px,0,0)'; g.el._x = -1e4; } continue; }
        const x = Math.round((V3.x + 1) / 2 * W()), y = Math.round((1 - V3.y) / 2 * H()); if (x !== g.el._x || y !== g.el._y) { g.el.style.transform = `translate3d(${x}px, ${y}px, 0)`; g.el._x = x; g.el._y = y; } }
      if (T.nowEl) { const p = now < 1e9 ? posAt(T.data, now) : null; if (!p) { if (!T.nowEl.hidden) T.nowEl.hidden = true; continue; }
        V3.set(p.x, SIDE + .2, p.z).project(camera); if (V3.z > 1) { T.nowEl.hidden = true; continue; } T.nowEl.hidden = false; T.nowEl.style.transform = `translate3d(${Math.round((V3.x + 1) / 2 * W())}px, ${Math.round((1 - V3.y) / 2 * H())}px, 0)`; } }
    stat.frameMs += (performance.now() - t0 - stat.frameMs) * .05;
  }
  // ── build one trail (async: the tape fetch), then its mesh
  async function build(T) {
    const my = ++T.gen, t0 = performance.now(); busy++; drawLegend();
    try { book ??= await placesBook(); const data = await load(T.handle); if (my !== T.gen || !trails.includes(T)) return; T.data = data; stat.cut += data.cut || 0;
      if (T.mesh) { scene.remove(T.mesh); T.mesh.geometry.dispose(); T.mesh.material.dispose(); T.mesh = null; }
      if (data.legs.length) { T.mesh = new THREE.Mesh(ribbon(data), material(T.slot)); T.mesh.frustumCulled = false; T.mesh.renderOrder = 5 + T.slot * .01; T.mesh.name = 'ui-trail-' + T.handle; T.mesh.castShadow = T.mesh.receiveShadow = false; T.mesh.onBeforeRender = perFrame; scene.add(T.mesh); }
      makeTags(T); paintStops(); stat.builds++; stat.buildMs = +(performance.now() - t0).toFixed(1);
    } catch (e) { console.warn('[trails]', e); T.data = { legs: [], stops: [], error: String(e.message || e) }; }
    finally { busy--; drawLegend(); }
  }
  function rebuildAll() { for (const T of trails) build(T); }
  // ── the legend (bottom left)
  function drawLegend() {
    if (!trails.length) { legend?.remove(); legend = null; return; }
    if (!legend) { legend = h('section', { class: 'tr-legend', role: 'region', 'aria-label': 'Trails' }); (root.querySelector('.s2-bar') || root).prepend(legend); }
    const L = lensNow(), w = windowNow(), now = (L === 'tape' ? tape.time() : null) ?? sim.clock()?.t ?? 0, today = dayOf(now);
    const chips = [
      ...[6, 24].map(n => h('button', { type: 'button', class: 'k-btn tr-win', 'aria-pressed': String(win.kind === 'last' && win.hours === n), onclick: () => setWindow({ kind: 'last', hours: n }) }, `${n} h`)),
      ...[today - 1, today].filter(d => d >= 1).map(d => h('button', { type: 'button', class: 'k-btn tr-win', 'aria-pressed': String(win.kind === 'day' && win.day === d), onclick: () => setWindow({ kind: 'day', day: d }) }, d === today && L !== 'tape' ? 'Today' : `Day ${d}`))];
    const badge = lensBadge(L, L === 'tape' ? 'up to ' + stampOf(w.to) : '');
    legend.replaceChildren(
      h('div', { class: 'tr-head' }, h('h3', { class: 'k-h' }, 'Where they went'), badge, button('', { icon: 'close', tip: 'Clear the trails', cls: 'tr-x', onclick: () => clear() })),
      h('div', { class: 'tr-wins' }, ...chips),
      h('ul', { class: 'tr-rows' }, ...trails.map(T => { const d = T.data, km = d ? d.legs.reduce((s, x) => s + Math.hypot(x.x1 - x.x0, x.z1 - x.z0), 0) / 1000 : 0, places = d ? new Set(d.stops.map(s => s.place)).size : 0;
        const last = d?.stops?.[d.stops.length - 1];
        return h('li', { 'data-slot': T.slot + 1 }, h('i', { class: 'tr-sw' }), h('span', { class: 'tr-name' }, '@' + T.handle),
          h('span', { class: 'tr-sum' }, !d ? 'loading…' : d.pending ? 'on tape tomorrow' : d.error ? 'no trail' : !d.legs.length ? (last ? `stayed at ${book?.name(last.place) ?? 'one place'}` : 'no moves in the window') : `${places} place${places === 1 ? '' : 's'} · ${km.toFixed(1)} km${d.cut ? ' · 1 stop off the record' : ''}`),
          button('', { icon: 'close', tip: `Drop @${T.handle}'s trail`, cls: 'tr-drop', onclick: () => remove(T.handle) })); })),
      busy ? h('div', { class: 'tr-busy k-muted' }, 'routing…') : '');
  }
  function setWindow(w2) { win = w2; rebuildAll(); drawLegend(); }
  // ── the public API
  function add(handle) {
    if (has(handle)) return true; if (trails.length >= MAX) { toast(`${MAX} trails at most: drop one first`); return false; }
    if (!cols.length) readCols();
    const used = new Set(trails.map(T => T.slot)); let slot = 0; while (used.has(slot)) slot++;
    const T = { handle, slot, data: null, mesh: null, tags: [], nowEl: null, gen: 0 }; trails.push(T); if (trails.length === 1) listen(true); build(T); return true;
  }
  function remove(handle) { const k = trails.findIndex(T => T.handle === handle); if (k < 0) return; const T = trails[k]; trails.splice(k, 1);
    if (T.mesh) { scene.remove(T.mesh); T.mesh.geometry.dispose(); T.mesh.material.dispose(); } for (const g of T.tags) g.el.remove(); T.nowEl?.remove(); paintStops(); drawLegend(); if (!trails.length) listen(false); onChange(); }
  function clear() { for (const T of [...trails]) remove(T.handle); }
  const has = handle => trails.some(T => T.handle === handle);
  function toggle(handle) { if (has(handle)) { remove(handle); return false; } const ok = add(handle); onChange(); return ok; }
  let onChange = () => {};
  // while on: rebuild when the window moves on (live: every 5 game minutes) or the tape seeks / switches mode
  function listen(on) { for (const u of unsubs) u(); unsubs = []; if (!on) return;
    let lastT = sim.clock()?.t ?? 0; unsubs.push(sim.on('tick', e => { if (lensNow() !== 'live' || win.kind === 'day' && dayOf(e.t) > win.day) return; if (e.t - lastT >= 5) { lastT = e.t; rebuildAll(); } }));
    if (tape?.on) for (const ev of ['seek', 'mode', 'data']) { const u = tape.on(ev, e => { if (ev === 'mode' && e?.active) win = { kind: 'day', day: dayOf(tape.time() ?? 0) }; if (ev === 'mode' && e && !e.active) win = { kind: 'last', hours: 24 };
      clearTimeout(dirty); dirty = setTimeout(() => { rebuildAll(); drawLegend(); }, ev === 'mode' ? 0 : 300); }); if (typeof u === 'function') unsubs.push(u); } }
  return { _route: routeLeg, add, remove, toggle, has, clear, setWindow, get handles() { return trails.map(T => T.handle); }, get window() { return windowNow(); }, get lens() { return lensNow(); },
    set onChange(f) { onChange = f; }, data: handle => trails.find(T => T.handle === handle)?.data || null, colourOf: handle => { const T = trails.find(x => x.handle === handle); return T ? '#' + cols[T.slot].getHexString() : null; },
    stats: () => ({ on: trails.length, ...stat, verts: trails.reduce((n, T) => n + (T.mesh ? T.mesh.geometry.attributes.position.count : 0), 0), stops: stopsMesh ? stopsMesh.count / 2 : 0, inScene: scene.children.filter(o => /^ui-trail/.test(o.name)).length, frameMs: +stat.frameMs.toFixed(4) }) };
}
