// MOVEMENT W2 · THE TRANSIT LAYER on the paper map (ui/map): the subway lines, the stations and the taxi stands in
// their colours (style/city/transitnet.js → world/export/transit.json, written by tools/export-world.mjs), plus a Transit toggle and a
// small line key in the legend. Self-contained: it reads the map's public view (mountMap's returned object: isOpen, view) and draws on
// its own canvas over the sheet; nothing runs while the map is closed or the layer is off. ui/index.js mounts it after the map.
//   window.__mapTransit = { on, set(on) }   (shots: tools in ui/map/tools turn it on)
// Drawn: a subway line runs station to station (the tunnels aren't modelled). A station on two lines is a double ring; a PROPOSED station
// (not built yet) is dashed. The bullets stand over each line's two termini (side by side where two lines end at one station).
// (BUSES OUT, 2026-10-09: no bus routes; the old shelters are street furniture now, not on the transit map)
import { sdata } from '../../../../world/city.js';   // (SPREAD: the data this spread reads)
const KEY = 'aicity.ui.map.transit';
const DATA_URL = new URL(sdata('../../../../world/export/transit.json'), import.meta.url);

export function mountTransitLayer(map, root) {
  let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch {}
  let el = null, cv = null, btn = null, keyBox = null, data = null, loading = null, raf = 0, last = '';
  const css = k => el ? getComputedStyle(el).getPropertyValue(k).trim() : '';
  function load() { if (data || loading) return loading; loading = fetch(DATA_URL, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { data = j; last = ''; buildKey(); kick(); return j; }).catch(() => null); return loading; }
  // ── the DOM: the canvas goes over the sheet, the toggle into the legend's layer group (the map builds both on its first open)
  function attach() {
    if (cv || !(el = root.querySelector('section.mp'))) return false; const sheet = el.querySelector('.mp-sheet'), group = el.querySelector('.mp-layers'); if (!sheet || !group) return false;
    cv = document.createElement('canvas'); cv.className = 'mp-transit'; cv.setAttribute('aria-hidden', 'true'); Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' }); sheet.append(cv);
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'k-btn mp-layer'; btn.dataset.layer = 'transit'; btn.dataset.tip = 'Subway lines, stations and taxi stands (dashed = proposed)';
    const sw = document.createElement('i'); sw.className = 'mp-sw'; sw.dataset.layer = 'transit'; Object.assign(sw.style, { borderRadius: '2px', width: '12px', background: 'linear-gradient(90deg, #2F5BFF 0 25%, #FF4FA3 25% 50%, #FF7A1A 50% 75%, #25B84C 75%)' });
    btn.append(sw, 'Transit'); btn.onclick = () => set(!on); group.append(btn);
    keyBox = document.createElement('div'); keyBox.className = 'mp-transit-key'; Object.assign(keyBox.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 6px', alignItems: 'center', fontSize: '11px', margin: '6px 0 2px' });
    group.after(keyBox); buildKey(); sync(); return true; }
  function buildKey() { if (!keyBox) return; keyBox.textContent = ''; if (!data) return;
    for (const l of data.lines) { if (l.kind !== 'subway') continue; const b = document.createElement('b'); b.textContent = l.bullet; Object.assign(b.style, { background: l.colour, color: '#fff', font: '700 10px/16px system-ui, sans-serif', minWidth: '16px', height: '16px', padding: '0 3px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 0 0 1px rgba(0,0,0,.35)' });
      const s = document.createElement('span'); s.textContent = l.name + ' · every ' + l.headwayMin + ' min'; keyBox.append(b, s); } }
  function sync() { if (btn) btn.setAttribute('aria-pressed', String(on)); if (keyBox) keyBox.hidden = !on; if (cv) cv.hidden = !on; }
  function set(v) { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} sync(); if (on) load(); last = ''; kick(); }
  // ── drawing: only while the map is open and the layer on; a redraw when the view, the size or the data changed
  function kick() { if (!raf && map.isOpen && on) raf = requestAnimationFrame(frame); }
  function frame() { raf = 0; if (!map.isOpen || !on || !cv) return; const v = map.view; if (!v) { kick(); return; }
    const W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight, dpr = Math.min(2, devicePixelRatio || 1), sig = [v.cx.toFixed(2), v.cz.toFixed(2), v.s.toFixed(4), W, H, dpr, !!data].join();
    if (sig !== last) { last = sig; draw(v, W, H, dpr); } kick(); }
  function draw(v, W, H, dpr) {
    const w = Math.round(W * dpr), hh = Math.round(H * dpr); if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, hh); if (!data) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = (x, z) => [(x - v.cx) * v.s + W / 2, (z - v.cz) * v.s + H / 2], s = v.s, ink = css('--k-map-ink') || '#17171b', halo = css('--k-map-halo') || '#fffdf6', font = css('--k-map-font') || 'system-ui, sans-serif';
    const poly = pts => { ctx.beginPath(); pts.forEach(([x, z], k) => { const [a, b] = P(x, z); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // subway lines: an ink casing, the colour inside; station to station
    const sw = Math.max(3.5, Math.min(8, s * 3.6)), stn = new Map(data.stations.map(q => [q.id, q]));
    for (const l of data.lines) if (l.kind === 'subway') { poly(l.stops.map(id => [stn.get(id).x, stn.get(id).z])); ctx.strokeStyle = ink; ctx.lineWidth = sw + 3; ctx.stroke(); ctx.strokeStyle = l.colour; ctx.lineWidth = sw; ctx.stroke(); }
    // taxi stands: a yellow T (the old bus shelters aren't transit any more: not drawn)
    const q = Math.max(3, Math.min(6, s * 2.6));
    for (const st of data.stops) { if (st.kind !== 'taxi') continue; const [x, y] = P(st.x, st.z), r = q + 1.5; ctx.fillStyle = '#FFE23A'; ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - r, y - r, 2 * r, 2 * r, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = `800 ${Math.round(r * 1.5)}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('T', x, y + .5); }
    // stations: white disc, ink ring (a double ring where lines meet), dashed when proposed; names beside them
    const r = Math.max(4, Math.min(9, s * 4));
    for (const st of data.stations) { const [x, y] = P(st.x, st.z), two = st.lines.length > 1;
      ctx.setLineDash(st.built ? [] : [3, 2.5]); ctx.beginPath(); ctx.arc(x, y, two ? r + 2 : r, 0, 7); ctx.fillStyle = halo; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.stroke();
      if (two) { ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, 7); ctx.lineWidth = 1.4; ctx.stroke(); } ctx.setLineDash([]);
      const fs = Math.round(Math.max(9, Math.min(13, 7 + s * 2.5))); ctx.font = `800 ${fs}px ${font}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const tx = x + r + 5, label = st.name + (st.built ? '' : ' ·'); ctx.lineWidth = 3.5; ctx.strokeStyle = halo; ctx.strokeText(label, tx, y); ctx.fillStyle = ink; ctx.fillText(label, tx, y); }
    // bullets at the termini, over the station; where two lines end at one station (LOW TIDE: TIDE and HARBOR) side by side
    const ends = new Map(); for (const l of data.lines) if (l.kind === 'subway') for (const id of [l.stops[0], l.stops.at(-1)]) { if (!ends.has(id)) ends.set(id, []); if (!ends.get(id).includes(l)) ends.get(id).push(l); }
    const br = Math.max(6, Math.min(10, 5 + s * 2));
    for (const [id, ls] of ends) { const o = stn.get(id), [x0, y0] = P(o.x, o.z), y = y0 - (br + r + 3);
      ls.forEach((l, k) => { const x = x0 + (k - (ls.length - 1) / 2) * (2 * br + 2);
        ctx.beginPath(); ctx.arc(x, y, br, 0, 7); ctx.fillStyle = l.colour; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(br * 1.05)}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.bullet, x, y + .5); }); }
  }
  // the map builds its DOM on the first open: watch the root for it, then its open state (no polling while closed)
  const watchOpen = new MutationObserver(() => { if (map.isOpen) { if (on) load(); kick(); } });
  const watchBuild = new MutationObserver(() => { if (attach()) { watchBuild.disconnect(); watchOpen.observe(el, { attributes: true, attributeFilter: ['aria-hidden', 'class'] }); if (map.isOpen) { if (on) load(); kick(); } } });
  if (!attach()) watchBuild.observe(root, { childList: true, subtree: false }); else watchOpen.observe(el, { attributes: true, attributeFilter: ['aria-hidden', 'class'] });
  const api = { get on() { return on; }, set }; if (typeof window !== 'undefined') window.__mapTransit = api; return api;
}
