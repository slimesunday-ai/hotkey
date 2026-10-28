// HUMAN LAYER · IN THE CITY: citizen pins, ground rings, the hover label and picking (section 1).
//   pins     a marker over each drawn sim agent's head + a ground ring at its feet; crowds whose markers overlap become one marker
//            with a count; the label shows on hover and on the one followed; P toggles them (kept in this browser)
//   rings    one InstancedMesh (a single draw call, depth-tested so walls hide them, no shadows, no fog): every pinned agent's ring,
//            and with pins off only the hovered and the selected one
//   picking  screen space, never a raycast against the batched walkers: each drawn agent is a capsule from its feet to its head
//            projected to the screen (at least 18 px round), the nearest within reach wins; plain walkers aren't pickable
// Positions come from the store only (sim.where), once per frame for the agents that are drawn; DOM is moved with transforms, and
// written only when a value changed. Labels and classes change at most 4× a second (the batch below).
import { h, set, attr, hoverLabel, token, onSkinChange, prefs } from './kit.js';
import { tape } from './tape/state.js';   // (section 2a: in TAPE the label tells the tape's story — the agent as of the tape time, not the live card)

const PINS_KEY = 'aicity.ui.pins', REACH = 18, CLUSTER = 20, HEAD = 1.78;
export function createCityLayer({ api, sim, root, onPick, onMiss = () => {}, onHover = () => {} }) {
  const { THREE, scene, camera, renderer } = api, el = renderer.domElement;
  const V = new THREE.Vector3(), M = new THREE.Matrix4(), Qt = new THREE.Quaternion(), S = new THREE.Vector3(), C = new THREE.Color();
  let pinsOn = prefs.get(PINS_KEY) !== '0';
  // ── rings
  const geo = new THREE.RingGeometry(.44, .56, 48, 1); geo.rotateX(-Math.PI / 2);
  const geoSq = new THREE.RingGeometry(.56, .74, 4, 1, Math.PI / 4); geoSq.rotateX(-Math.PI / 2);   // (zte, --k-ring-shape: square: a flat square frame on the street grid, a key's outline in colour)
  let ringGeo = geo;
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  let cap = 32, rings = null;
  const makeRings = n => { if (rings) { scene.remove(rings); rings.dispose(); } cap = n; rings = new THREE.InstancedMesh(ringGeo, mat, cap); rings.frustumCulled = false; rings.castShadow = rings.receiveShadow = false; rings.renderOrder = 5; rings.count = 0; rings.name = 'ui-rings';
    rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(rings); };
  makeRings(32);
  const col = { ring: new THREE.Color('#fff'), hot: new THREE.Color('#2a4fe0'), mine: new THREE.Color('#ff4fa3') };
  const readColours = () => { try { col.ring.set(token('--k-ring') || '#fff'); col.hot.set(token('--k-ring-hot') || '#2a4fe0'); col.mine.set(token('--k-ring-mine') || '#ff4fa3');
    ringGeo = token('--k-ring-shape') === 'square' ? geoSq : geo; if (rings && rings.geometry !== ringGeo) rings.geometry = ringGeo; } catch {} };
  readColours(); onSkinChange(() => requestAnimationFrame(readColours));
  // ── DOM: pins + the label
  const layer = h('div', { class: 'k-pins', 'aria-hidden': 'true' }); root.prepend(layer);
  const label = hoverLabel(), pool = [];
  const pinEl = k => { while (pool.length <= k) { const p = h('div', { class: 'k-pin is-off' }, h('i')); p._x = p._y = -1e4; p._cls = 'k-pin is-off'; p._txt = ''; layer.append(p); pool.push(p); } return pool[k]; };
  // ── state
  let hot = null, hotCluster = null, selected = null, followed = null, mouse = null, dragging = false, lastBatch = 0, frameMs = 0, frameMax = 0, n = 0;
  const pts = [];   // per frame: { h, card, x, y, fx, fy, d, mine, wanted, local }
  const W = () => el.clientWidth || innerWidth, Hh = () => el.clientHeight || innerHeight;
  const project = (x, y, z, out) => { V.set(x, y, z).project(camera); if (V.z > 1 || V.z < -1) return null; out.x = (V.x + 1) / 2 * W(); out.y = (1 - V.y) / 2 * Hh(); return out; };
  // ── pointer: hover from the last mouse position (agents move under a still cursor); none while a button is held
  el.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mouse = { x: e.clientX, y: e.clientY }; dragging = e.buttons !== 0; }, { passive: true });
  el.addEventListener('pointerleave', () => { mouse = null; }, { passive: true });
  let down = null;
  el.addEventListener('pointerdown', e => { down = e.isPrimary && e.button === 0 ? [e.clientX, e.clientY, performance.now()] : null; }, { passive: true });
  // a click (press and release within 6 px and 450 ms, the rig's own rule) on an agent: ours. capture on window → runs before the rig
  // (input.js) and the homes' handlers; the event still reaches them (MapControls and the rig must see the release), but `claim` makes
  // the rig's person picker and the homes' click step aside for this one release (ui/index.js wires both)
  let claimed = null;
  addEventListener('pointerup', e => { const d = down; down = null; if (!d || e.target !== el) return; if (Math.hypot(e.clientX - d[0], e.clientY - d[1]) >= 6 || performance.now() - d[2] >= 450) return;
    const t = pickAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 28 : REACH); if (!t) { onMiss(e); return; }
    claimed = e; setTimeout(() => { if (claimed === e) claimed = null; }, 0);
    if (t.cluster) onPick(null, { cluster: t.cluster, x: e.clientX, y: e.clientY }); else onPick(t.h, { x: e.clientX, y: e.clientY }); }, true);
  // the agent under a screen point: nearest capsule within reach; a crowd marker within reach → the crowd
  function pickAt(mx, my, reach = REACH) {
    let best = null, bd = 1e9;
    for (const p of pts) { const r = Math.max(reach, Math.abs(p.fy - p.y) * .32), dx = p.x - p.fx, dy = p.y - p.fy, L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((mx - p.fx) * dx + (my - p.fy) * dy) / L2));
      const d = Math.hypot(mx - (p.fx + dx * k), my - (p.fy + dy * k)); if (d > r) continue; const s = d / r + p.d / 400; if (s < bd) { bd = s; best = p; } }
    if (pinsOn) for (const c of clusters) { if (c.members.length < 2) continue; const d = Math.hypot(mx - c.x, my - (c.y - 10)); if (d < 16 && (!best || d < 10)) return { cluster: c.members.map(m => m.h) }; }
    return best ? { h: best.h } : null;
  }
  // ── per frame (main.js frame(), after the walkers and the camera moved, before the render)
  let clusters = [];
  function frame(dt, t) {
    const t0 = performance.now(); camera.updateMatrixWorld(); pts.length = 0;
    const cards = sim.agents(); let ni = 0;
    for (const c of cards) {
      if (c.retired || c.status === 'dead') continue;
      const w = sim.where(c.handle); if (!w || !w.drawn) continue;
      const head = project(w.x, w.y + HEAD, w.z, { x: 0, y: 0 }); if (!head) continue; const foot = project(w.x, w.y, w.z, { x: 0, y: 0 }); if (!foot) continue;
      if (head.x < -40 || head.x > W() + 40 || foot.y < -40 || head.y > Hh() + 40) continue;
      const d = Math.hypot(w.x - camera.position.x, w.y - camera.position.y, w.z - camera.position.z); if (d > 520) continue;
      const cc = tape.active ? (tape.agent(c.handle)?.live || c) : c;
      pts.push({ h: c.handle, card: cc, x: head.x, y: head.y, fx: foot.x, fy: foot.y, d, wx: w.x, wy: w.y, wz: w.z, mine: c.handle === sim.me, wanted: !!cc.wanted, local: !!c.npc });
    }
    // hover (not while dragging; not under a panel: the DOM has the pointer there)
    let h1 = null; if (mouse && !dragging) { const t1 = pickAt(mouse.x, mouse.y); h1 = t1?.h || null; hotCluster = t1?.cluster || null; } else hotCluster = null;
    if (h1 !== hot) { hot = h1; el.style.cursor = hot || hotCluster ? 'pointer' : ''; onHover(hot); }
    else if (!hot && hotCluster && el.style.cursor !== 'pointer') el.style.cursor = 'pointer'; else if (!hot && !hotCluster && el.style.cursor === 'pointer') el.style.cursor = '';
    // clusters (pins on): near first, a marker joins the first cluster within CLUSTER px
    clusters = [];
    if (pinsOn) { pts.sort((a, b) => a.d - b.d); for (const p of pts) { let c = null; for (const q of clusters) if (Math.abs(q.x - p.x) < CLUSTER && Math.abs(q.y - p.y) < CLUSTER) { c = q; break; }
      if (c) c.members.push(p); else clusters.push({ x: p.x, y: p.y, members: [p] }); } }
    // rings: pins on → all; off → the hovered and the selected
    const ringFor = p => pinsOn || p.h === hot || p.h === selected || (hotCluster && hotCluster.includes(p.h));
    for (const p of pts) { if (!ringFor(p)) continue; if (ni >= cap) makeRings(cap * 2);
      const isHot = p.h === hot || p.h === selected || (hotCluster && hotCluster.includes(p.h)), pulse = isHot ? 1.3 + Math.sin(t * 5) * .06 : p.local ? .78 : 1;
      M.compose(V.set(p.wx, p.wy + .045, p.wz), Qt.identity(), S.setScalar(pulse)); rings.setMatrixAt(ni, M);
      C.copy(isHot ? col.hot : p.mine ? col.mine : col.ring); if (!isHot && p.local) C.multiplyScalar(.7); rings.setColorAt(ni, C); ni++; }
    rings.count = ni; rings.visible = ni > 0; if (ni) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true; }
    // pins (DOM): positions every frame (transforms only), classes and counts in the ≤ 4 Hz batch
    const batch = t0 - lastBatch > 250; if (batch) lastBatch = t0;
    let k = 0;
    if (pinsOn) for (const c of clusters) { const p0 = c.members[0], el2 = pinEl(k++), many = c.members.length > 1, x = Math.round(c.x), y = Math.round(c.y - 8);
      if (x !== el2._x || y !== el2._y) { el2.style.transform = `translate3d(${x}px, ${y}px, 0)`; el2._x = x; el2._y = y; }
      const cls = 'k-pin' + (many ? ' is-cluster' : '') + (!many && p0.local ? ' is-local' : '') + (c.members.some(m => m.wanted) ? ' is-wanted' : '') + (c.members.some(m => m.mine) ? ' is-mine' : '') + (c.members.some(m => m.h === hot || m.h === selected) ? ' is-hot' : '');
      if (cls !== el2._cls && (batch || el2._cls.includes('is-off') || many !== el2._cls.includes('is-cluster'))) { el2.className = cls; el2._cls = cls; }
      const txt = many ? String(c.members.length) : ''; if (txt !== el2._txt) { el2.firstChild.textContent = txt; el2._txt = txt; } }
    for (; k < pool.length; k++) { const el2 = pool[k]; if (!el2._cls.includes('is-off')) { el2.className = 'k-pin is-off'; el2._cls = 'k-pin is-off'; } }
    // the label: the hovered agent, else the hovered crowd, else the one followed
    const lab = hot ? pts.find(p => p.h === hot) : null;
    if (lab) { label.move(lab.x, lab.y - (pinsOn ? 18 : 6)); if (batch || !label.on || label._h !== lab.h) { label._h = lab.h; label.show(lab.x, lab.y - (pinsOn ? 18 : 6), { name: '@' + lab.h, sub: subOf(lab.card), wanted: lab.wanted }); } }
    else if (hotCluster && pinsOn) { const c = clusters.find(q => q.members.length > 1 && q.members.some(m => hotCluster.includes(m.h))); if (c) { label._h = null; label.names(c.x, c.y - 22, c.members.map(m => '@' + m.h)); } else label.hide(); }
    else { const f = followed && pts.find(p => p.h === followed); if (f) { label.move(f.x, f.y - (pinsOn ? 18 : 6)); if (batch || label._h !== f.h) { label._h = f.h; label.show(f.x, f.y - (pinsOn ? 18 : 6), { name: '@' + f.h, sub: subOf(f.card), wanted: f.wanted }); } } else { label._h = null; label.hide(); } }
    const ms = performance.now() - t0; n++; frameMs += (ms - frameMs) * .05; frameMax = Math.max(frameMax * .995, ms);
  }
  const subOf = c => [c.cls, c.crew && !c.npc ? c.crew : null, c.now].filter(Boolean).join(' · ');
  return {
    frame, pickAt,
    get claimed() { return claimed; },
    get pins() { return pinsOn; },
    setPins(on) { pinsOn = !!on; prefs.set(PINS_KEY, pinsOn ? '1' : '0'); return pinsOn; },
    select(h) { selected = h; }, follow(h) { followed = h; },
    get hot() { return hot; },
    screenOf(hh) { const p = pts.find(q => q.h === hh); return p ? { x: p.x, y: p.y, fx: p.fx, fy: p.fy } : null; },
    visible: () => pts.map(p => p.h),
    clusters: () => clusters.filter(c => c.members.length > 1).map(c => ({ x: c.x, y: c.y, n: c.members.length, handles: c.members.map(m => m.h) })),
    stats: () => ({ frameMs: +frameMs.toFixed(4), frameMax: +frameMax.toFixed(3), frames: n, drawn: pts.length, rings: rings.count, pins: pinsOn }),
  };
}
