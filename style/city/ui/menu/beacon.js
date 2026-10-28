// HUMAN LAYER · SECTION 4 · BEACONS: "that one, there" in the city for a list of agents: People's hovered (or ↑↓-chosen) row, the agents
// of the action card. On screen: a ring over the head and a tag; off screen or behind a panel: the tag pinned to the edge of the free
// view with an arrow pointing the way and the distance. Inside a building: over the building ("inside"); rule 5 (coarse): over the
// district's middle, dashed, "somewhere in …" — never a precise spot the street couldn't see. Out of sight (a coarse trip): no beacon.
// Cost: nothing while the list is empty (frame() returns at once); with a list, one projection and one transform per agent per frame.
import { h, set } from '../kit.js';
import { placesNow } from '../goto.js';

const HEAD = 1.78;
export function createBeacons({ api, sim, root }) {
  const { THREE, camera } = api, V = new THREE.Vector3();
  const layer = h('div', { class: 'bc-layer', 'aria-hidden': 'true' }); root.append(layer);
  const pool = []; let want = [], B = null, bAt = 0;
  const el = k => { while (pool.length <= k) { const name = h('b'), sub = h('small'), b = h('div', { class: 'bc' }, h('i', { class: 'bc-ring' }), h('i', { class: 'bc-arrow' }), h('span', { class: 'bc-tag' }, name, sub));
    b._n = name; b._s = sub; b._x = b._y = -1e4; b._c = ''; b.hidden = true; layer.append(b); pool.push(b); } return pool[k]; };
  // the free view: the screen minus the menu bar, the bottom row and any open side panel (read 4× a second, not per frame)
  function bounds() { const W = innerWidth, H = innerHeight; let l = 18, r = W - 18;
    for (const p of root.querySelectorAll('.k-panel.is-open')) { const q = p.getBoundingClientRect(); if (q.width < 40 || q.height < 40) continue; if (p.classList.contains('dock-left')) l = Math.max(l, q.right + 18); else if (p.classList.contains('dock-right')) r = Math.min(r, q.left - 18); }
    if (r - l < 120) { l = 18; r = W - 18; } return { l, r, t: 76, b: H - 92 }; }
  function show(list) { want = (list || []).filter(Boolean).slice(0, 6); B = null; for (let k = want.length; k < pool.length; k++) if (!pool[k].hidden) pool[k].hidden = true; }
  const dist = (w) => { const T = api.controls?.target; if (!T) return ''; const d = Math.hypot(w.x - T.x, w.z - T.z); return d < 15 ? 'here' : d < 1000 ? `${Math.round(d / 5) * 5} m` : `${(d / 1000).toFixed(1)} km`; };
  function frame() {
    if (!want.length) return;
    const now = performance.now(); if (!B || now - bAt > 250) { B = bounds(); bAt = now; }
    const W = innerWidth, H = innerHeight;
    want.forEach((it, k) => {
      const b = el(k), w = sim.where(it.handle);
      if (!w) { if (!b.hidden) b.hidden = true; return; }
      V.set(w.x, (w.y || 0) + (w.drawn ? HEAD : 3), w.z).project(camera);
      const behind = V.z > 1; let x = (V.x + 1) / 2 * W, y = (1 - V.y) / 2 * H; if (behind) { x = W - x; y = H - y; }
      const inside = !behind && x >= B.l && x <= B.r && y >= B.t && y <= B.b; let a = 0;
      if (!inside) { const cx = (B.l + B.r) / 2, cy = (B.t + B.b) / 2; let dx = x - cx, dy = y - cy; if (!dx && !dy) dy = 1;
        const s = Math.min(dx ? Math.abs(((dx > 0 ? B.r : B.l) - cx) / dx) : Infinity, dy ? Math.abs(((dy > 0 ? B.b : B.t) - cy) / dy) : Infinity); x = cx + dx * s; y = cy + dy * s; a = Math.atan2(dy, dx); }
      const X = Math.round(x), Y = Math.round(y); if (X !== b._x || Y !== b._y) { b.style.transform = `translate3d(${X}px, ${Y}px, 0)`; b._x = X; b._y = Y; }
      if (!inside) b.style.setProperty('--a', a.toFixed(2) + 'rad');
      const kind = w.coarse ? 'is-coarse' : w.drawn ? '' : 'is-in', cls = 'bc' + (inside ? '' : ' is-edge') + (kind ? ' ' + kind : '') + (it.hot ? ' is-hot' : '');
      if (cls !== b._c) { b.className = cls; b._c = cls; }
      set(b._n, '@' + it.handle);
      const card = it.card || null, P = placesNow();
      set(b._s, w.coarse ? `somewhere in ${card?.district ? P?.distName(card.district) || card.district : 'the city'}` : !w.drawn ? `inside${card?.placeName ? ' · ' + card.placeName : ''}` : inside ? (it.sub || '') : dist(w));
      if (b.hidden) b.hidden = false;
    });
  }
  return { show, frame, get on() { return want.length > 0; }, clear: () => show([]) };
}
