// HUMAN LAYER · SECTION 2b · THE HEAT MAP: a ground overlay over a time window — presence · crimes · deals (one toggle). Off by default.
//   the look     a 128 × 128 field (≈ 6.4 m a cell) on one plane just above the sidewalks, cel-shaded: the field is cut into five flat
//                bands (tokens --k-heat-0…4) with an ink contour between bands, the coldest band left clear. ?heat=pixel shows the cells as
//                flat squares instead (a taste call for slime). It fades out as the camera comes down to the street (it is a map).
//                A second, faint pass of the same plane draws through the buildings (x-ray): people spend their time inside lots, under
//                roofs, so without it most of the presence map hides under the city from the usual oblique views.
//   the lens     presence and crimes are public (positions, public crimes): LIVE, the store's public log, the last 24 game hours. Deals are
//                private: on the TAPE only (sim.tape.get, clamped to the horizon by the server and again in heat-data.js); in LIVE the
//                Deals button says so and shows yesterday's deals from the tape, stamped "as of".  ARCHIVE: everything.
//   the bar      top left: Heat · Presence · Crimes · Deals, and the ramp; M cycles off → presence → crimes → deals → off
// Off: no mesh in the scene, no texture, no listener. On: two draw calls; the field is rebuilt in a few ms when the window moves on
// (live: every 10 game minutes; tape: on seek), never per frame.
import { h, attr, lens as lensBadge, toast, getRoot, onSkinChange } from '../kit.js';
import { heatOf, HEAT_MODES, HEAT_LIVE, GRID } from './heat-data.js';
import { placesBook } from './trails.js';
import { stampOf, DAY } from './trails-data.js';

const SIDE = 0.2;
const css = () => { if (!document.querySelector('link[data-trails-css]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./trails.css', import.meta.url).href, 'data-trails-css': '' })); };

export function createHeat({ api, sim, tape = null, Q = new URLSearchParams(location.search) }) {
  css();
  const { THREE, scene, camera } = api, root = getRoot(), PIXEL = Q.get('heat') === 'pixel';
  let mode = null, mesh = null, tex = null, data = null, unsubs = [], gen = 0, book = null, lastT = 0;
  const stat = { builds: 0, buildMs: 0, cells: GRID.n * GRID.n, events: 0 };
  // ── the bar
  const btns = new Map(), ramp = h('div', { class: 'ht-ramp' }, h('span', null, 'less'), h('i'), h('span', null, 'more')), badge = lensBadge('live'), note = h('span', { class: 'ht-note k-muted' });
  const bar = h('div', { class: 'ht-bar', role: 'toolbar', 'aria-label': 'Heat map' }, h('span', { class: 'k-h' }, 'Heat'));
  for (const m of HEAT_MODES) { const b = h('button', { type: 'button', class: 'k-btn', 'aria-pressed': 'false', 'data-tip': tipOf(m), onclick: () => set(mode === m ? null : m) }, m[0].toUpperCase() + m.slice(1)); btns.set(m, b); bar.append(b); }
  bar.append(ramp, badge); badge.hidden = true; root.append(bar);
  function tipOf(m) { return m === 'presence' ? 'Where people spent their time (public: live)' : m === 'crimes' ? 'Robberies, burglaries, arrests, searches, deaths (public: live)' : 'Where deals were made: private, so on tape only (a game day late)'; }
  const lensNow = () => sim.lens === 'archive' ? 'archive' : tape?.active ? 'tape' : 'live';
  function windowNow() {
    const L = lensNow();
    if (L === 'tape') { const t = tape.time(), w = tape.window(); return { from: Math.max(w.start ?? 0, t - DAY), to: t }; }   // (the game day up to the tape's time)
    if (mode === 'deals' && L === 'live') { const hz = sim.tape.horizon; return hz == null ? null : { from: Math.max(0, hz - DAY), to: hz }; }   // (yesterday, from the tape)
    const now = sim.clock()?.t ?? 0; return { from: Math.max(0, now - DAY), to: now };
  }
  // ── the field → a texture → the plane
  async function rebuild() {
    if (!mode) return; const my = ++gen, t0 = performance.now(), L = lensNow(), w = windowNow();
    book ??= await placesBook();
    if (!w) { data = null; showMesh(null); syncBar('on tape tomorrow'); return; }
    let evs, lensFor = L, horizon = null;
    const te = L === 'tape' ? tape.events({ from: Math.max(0, w.from - (mode === 'presence' ? DAY : 0)), to: w.to }) : null;
    if (te?.length) { evs = te; horizon = tape.window().horizon; lensFor = tape.lens === 'archive' ? 'archive' : 'tape'; }
    else if (mode === 'deals' || L !== 'live') { const r = await sim.tape.get(Math.max(0, w.from - (mode === 'presence' ? DAY : 0)), w.to, { snaps: false }).catch(e => ({ error: e }));
      if (r.error || r.pending) { if (my === gen) { data = null; showMesh(null); syncBar(r.pending ? 'on tape tomorrow' : 'no tape here'); } return; }
      evs = r.events; horizon = r.horizon; lensFor = L === 'archive' || r.archive ? 'archive' : 'tape'; }
    else evs = sim.events({ types: mode === 'presence' ? ['move'] : ['rob', 'burgle', 'arrest', 'search', 'death', 'bounty'] });
    if (my !== gen) return;
    const pos = id => { const p = book.get(id); return p ? { x: p.x, z: p.z } : null; };
    data = heatOf(evs, { mode, from: w.from, to: w.to, lens: lensFor, horizon, pos }); stat.events = evs.length;
    upload(data); showMesh(data); stat.builds++; stat.buildMs = +(performance.now() - t0).toFixed(1);
    syncBar(data.refused || (lensFor === 'live' ? '' : `${stampOf(w.from)} → ${stampOf(data.upTo)}`), lensFor);
  }
  function upload(d) {
    const n = d.n, px = new Uint8Array(n * n); const k = d.max > 0 ? 1 / d.max : 0;
    for (let i = 0; i < n * n; i++) px[i] = Math.round(Math.min(1, Math.sqrt(d.values[i] * k)) * 255);
    if (!tex) { tex = new THREE.DataTexture(px, n, n, THREE.RedFormat, THREE.UnsignedByteType); tex.magFilter = tex.minFilter = PIXEL ? THREE.NearestFilter : THREE.LinearFilter; tex.generateMipmaps = false; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; }
    else tex.image.data.set(px); tex.needsUpdate = true;
  }
  const FS = `uniform sampler2D uMap; uniform vec3 uC0, uC1, uC2, uC3, uC4, uInk; uniform float uOp, uFade, uTexel, uPixel, uShade; varying vec2 vUv;
    float band(float v) { return v < .12 ? 0. : v < .3 ? 1. : v < .5 ? 2. : v < .72 ? 3. : 4.; }
    void main() { float v = texture2D(uMap, vUv).r, b = band(v); if (b < .5) discard;
      vec3 c = b < 1.5 ? uC0 : b < 2.5 ? uC1 : b < 3.5 ? uC2 : b < 4.5 ? uC3 : uC4; if (v > .9) c = uC4;
      float e = 0.; if (uPixel < .5) { vec2 d = vec2(uTexel * .55, 0.); float n1 = band(texture2D(uMap, vUv + d.xy).r), n2 = band(texture2D(uMap, vUv - d.xy).r), n3 = band(texture2D(uMap, vUv + d.yx).r), n4 = band(texture2D(uMap, vUv - d.yx).r);
        e = (n1 < b || n2 < b || n3 < b || n4 < b) ? 1. : 0.; }
      gl_FragColor = vec4(mix(c, uShade > .5 ? c * .6 : uInk, e * .85), uOp * uFade * (b < 1.5 ? .55 : 1.)); }`;
  const VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
  const colours = () => { const cs = getComputedStyle(root), c = k => new THREE.Color(cs.getPropertyValue(k).trim() || '#f0f'); return { c: [0, 1, 2, 3, 4].map(k => c('--k-heat-' + k)), ink: c('--k-heat-ink'), shade: cs.getPropertyValue('--k-heat-edge').trim() === 'shade' ? 1 : 0, op: +cs.getPropertyValue('--k-heat-op') || .62 }; };
  function paint() { if (!mesh) return; const C = colours(), u = mesh.material.uniforms; C.c.forEach((c, k) => u['uC' + k].value.copy(c)); u.uInk.value.copy(C.ink); u.uShade.value = C.shade; u.uOp.value = C.op; }
  onSkinChange(() => requestAnimationFrame(paint));
  function showMesh(d) {
    if (!d || !d.max) { if (mesh) { scene.remove(mesh); } return; }
    if (!mesh) { const g = new THREE.PlaneGeometry(GRID.size, GRID.size); g.rotateX(-Math.PI / 2);
      const u = { uMap: { value: tex }, uInk: { value: new THREE.Color() }, uShade: { value: 0 }, uOp: { value: .6 }, uFade: { value: 1 }, uTexel: { value: 1 / GRID.n }, uPixel: { value: PIXEL ? 1 : 0 } }; for (let k = 0; k < 5; k++) u['uC' + k] = { value: new THREE.Color() };
      // (the plane's uv runs x0 → x0+size along +x, and z0 → z0+size along +z: PlaneGeometry rotated −90° about x puts v = 1 at −z, so flip)
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u, transparent: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      mesh.position.set(GRID.x0 + GRID.size / 2, SIDE + .03, GRID.z0 + GRID.size / 2); mesh.renderOrder = 4; mesh.frustumCulled = false; mesh.name = 'ui-heat'; mesh.castShadow = mesh.receiveShadow = false;
      mesh.onBeforeRender = () => { const y = camera.position.y; mesh.material.uniforms.uFade.value = Math.max(0, Math.min(1, (y - 14) / 30)); };
      // the x-ray pass: the same plane again, through the buildings, faint (presence pools inside lots, under the roofs)
      const xr = new THREE.Mesh(g, mesh.material.clone()); xr.material.depthTest = false; xr.material.uniforms = u; xr.renderOrder = 4.5; xr.frustumCulled = false; xr.name = 'ui-heat-xray'; xr.userData.xray = true;
      xr.onBeforeRender = () => { u.uFade.value = Math.max(0, Math.min(1, (camera.position.y - 14) / 30)); xr.material.opacity = 1; };
      xr.material.fragmentShader = FS.replace('uOp * uFade', 'uOp * uFade * XRAY'); xr.material.defines = { XRAY: '0.38' }; mesh.add(xr); xr.position.set(0, 0, 0);
      paint(); }
    mesh.material.uniforms.uMap.value = tex; if (!mesh.parent) scene.add(mesh);
  }
  function syncBar(msg = '', L = lensNow()) {
    for (const [m, b] of btns) { attr(b, 'aria-pressed', String(m === mode)); b.classList.toggle('is-locked', !HEAT_LIVE[m] && lensNow() === 'live'); }
    bar.classList.toggle('is-on', !!mode); badge.hidden = !mode; if (mode) badge.update(L === 'live' && mode === 'deals' ? 'tape' : L, msg);
  }
  // ── on / off
  function set(m) {
    if (m && !HEAT_MODES.includes(m)) m = null; mode = m;
    if (!m) { gen++; for (const u of unsubs) u(); unsubs = []; if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.traverse(o => o.material?.dispose()); mesh = null; } tex?.dispose(); tex = null; data = null; syncBar(); return null; }
    if (!unsubs.length) { lastT = sim.clock()?.t ?? 0; unsubs.push(sim.on('tick', e => { if (lensNow() === 'live' && e.t - lastT >= 10) { lastT = e.t; rebuild(); } }));
      if (tape?.on) for (const ev of ['seek', 'mode', 'data']) { let tm = 0; const u = tape.on(ev, () => { clearTimeout(tm); tm = setTimeout(rebuild, 300); }); if (typeof u === 'function') unsubs.push(u); } }
    syncBar(); rebuild(); if (m === 'deals' && lensNow() === 'live') toast('Deals are private: this is yesterday, from the tape'); return m;
  }
  const cycle = () => set(mode === null ? 'presence' : HEAT_MODES[HEAT_MODES.indexOf(mode) + 1] ?? null);
  return { set, cycle, get mode() { return mode; }, get data() { return data; }, el: bar, stats: () => ({ mode, on: !!mesh?.parent, ...stat }) };
}
