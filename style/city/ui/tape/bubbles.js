// HUMAN LAYER · SECTION 2a · THE SECRETS ON SCREEN (TAPE only: the tape is the one place private things show, a day late):
//   thoughts   a bubble over the agent's head: its `think` at that moment, short, fading out over the minutes after it
//   DMs        a dashed arc from sender to receiver + a small bubble on the arc (one end off screen or indoors: a bubble over the other)
//   deals      a small chip by the head: offer, tip, bribe, whisper … (a private deal in the last half hour)
// Readable in a crowd: the selected or followed agent always, then the nearest few to the camera, capped (CAP); bubbles that would
// overlap are pushed up. T (or the transport's Secrets button) hides them all. Only drawn agents get one (the walkers' own positions).
// A SAFE AREA: no bubble goes under the page's top bar, the transport, an open panel or any [data-safe-avoid] bar (2b's toolbars too):
// it is moved below / above / beside them, and an agent standing under the dossier gets none (re-measured 4× a second).
// DOM, moved with transforms; text is written only when it changes. Nothing runs while TAPE is closed.
import { h, set } from '../kit.js';

const CAP = { think: 4, dm: 2, deal: 5 }, NEAR = 140, HEAD = 2.05;
const DEAL = { offer: 'offer', loan_offer: 'loan', hire_offer: 'hire', whisper: 'whisper', tip: 'tip-off', bribe: 'bribe', scam: 'scam' };
const DEAL_ICON = '<path d="M2 7.2l2.6-2.4 2.2 1.1 2.4-1.4 4.8 3.6-2.2 2.4-1.6-1.2-2.6 2.5-3.2-2.3z" fill="currentColor"/>';
const short = (s, n = 110) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

export function createSecrets({ api, root }) {
  const { THREE, camera, renderer } = api, el = renderer.domElement, V = new THREE.Vector3();
  const layer = h('div', { class: 'tp-secrets-layer', 'aria-hidden': 'true' }), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  layer.append(svg); root.prepend(layer);
  const pool = { think: [], deal: [], arc: [] };
  const thinkEl = k => { while (pool.think.length <= k) { const e = h('div', { class: 'tp-think' }, h('b'), h('span')); e._k = null; e._x = e._y = -1e4; layer.append(e); pool.think.push(e); } return pool.think[k]; };
  const dealEl = k => { while (pool.deal.length <= k) { const e = h('div', { class: 'tp-deal' }); e.innerHTML = `<svg viewBox="0 0 16 16">${DEAL_ICON}</svg><span></span>`; e._k = null; layer.append(e); pool.deal.push(e); } return pool.deal[k]; };
  const arcEl = k => { while (pool.arc.length <= k) { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('class', 'tp-arc'); const d = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); d.setAttribute('class', 'tp-arc-end'); d.setAttribute('r', '3.5'); svg.append(p, d); pool.arc.push({ p, d }); } return pool.arc[k]; };
  let on = true, S = { ms: 0, max: 0, n: 0 }, shown = { think: 0, deal: 0, arc: 0 }, avoid = [], avoidAt = -1e9;
  const AVOID = 'body > .ui, #k .tp-bar.is-on, #k .k-panel.is-open, #k .cl-bar, #k .ht-bar, #k .k-chooser, [data-safe-avoid]';
  function measure() { avoid = []; const hh = H(); for (const e of document.querySelectorAll(AVOID)) { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || getComputedStyle(e).visibility === 'hidden') continue;
    avoid.push({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12, side: r.height > hh * .5 }); } }
  const hit = (a, x, y, w, hh) => x < a.x + a.w && x + w > a.x && y < a.y + a.h && y + hh > a.y;
  // where a bubble of w × hh wanting (x, y) may go: null when its agent (ax) stands under a side panel
  function safe(x, y, w, hh, ax) {
    for (const a of avoid) if (a.side) { if (ax >= a.x && ax <= a.x + a.w) return null; if (hit(a, x, y, w, hh)) x = a.x + a.w / 2 > ax ? a.x - w : a.x + a.w; }
    for (let n = 0; n < 3; n++) { let moved = false; for (const a of avoid) { if (a.side || !hit(a, x, y, w, hh)) continue; y = a.y + a.h / 2 < H() / 2 ? a.y + a.h : a.y - hh; moved = true; } if (!moved) break; }
    return { x: Math.max(4, Math.min(W() - w - 4, x)), y: Math.max(4, Math.min(H() - hh - 4, y)) }; }
  const W = () => el.clientWidth || innerWidth, H = () => el.clientHeight || innerHeight;
  const walker = hh => window.__simlive?.agents?.map?.get(hh)?.w?.p || null;
  function head(hh) { const p = walker(hh); if (!p) return null; V.set(p[0], p[1] + HEAD, p[2]); const d = camera.position.distanceTo(V); V.project(camera); if (V.z > 1 || V.z < -1) return null;
    const x = (V.x + 1) / 2 * W(), y = (1 - V.y) / 2 * H(); if (x < -60 || x > W() + 60 || y < -40 || y > H() + 40) return null; return { x, y, d }; }
  const topSafe = () => { let y = 4; for (const a of avoid) if (!a.side && a.y + a.h / 2 < H() / 2) y = Math.max(y, a.y + a.h); return y; };
  const fade = (age, win) => age < win * .65 ? 1 : Math.max(.12, 1 - (age - win * .65) / (win * .35));
  function hideFrom(kind, k) { const P = pool[kind]; for (let i = k; i < P.length; i++) { if (kind === 'arc') { P[i].p.style.display = 'none'; P[i].d.style.display = 'none'; } else if (P[i].classList.contains('is-on')) P[i].classList.remove('is-on'); } shown[kind] = k; }
  // per frame: sec = the last tape frame's secrets ({ t, thinks, dms, deals }), t = the tape time, focus = the selected / followed handles
  function frame(sec, t, focus = [], win = { think: 90, focus: 360, dm: 24, deal: 30 }) {
    const t0 = performance.now();
    if (!on || !sec) { hideFrom('think', 0); hideFrom('deal', 0); hideFrom('arc', 0); return; }
    if (t0 - avoidAt > 250) { avoidAt = t0; measure(); }
    const F = new Set(focus.filter(Boolean)), placed = [];
    const box = (x, y, w, hh, ax) => { let p = safe(x, y, w, hh, ax); if (!p) return null; let up = true;
      for (let n = 0; n < 8; n++) { const o = placed.find(r => p.x < r.x + r.w && p.x + w > r.x && p.y < r.y + r.h && p.y + hh > r.y); if (!o) break;
        const q = safe(p.x, up ? o.y - hh - 6 : o.y + o.h + 6, w, hh, ax); if (!q) return null; if (up && q.y > o.y - hh - 6 + 1) up = false; p = q; }   // (stacked up; pushed back down by a top bar → stack downwards)
      placed.push({ x: p.x, y: p.y, w, h: hh }); return p; };
    // DMs first (the rarest, the most telling): arcs + a bubble on the arc
    let ka = 0, kt = 0;
    const dms = sec.dms.slice().sort((p, q) => q.t - p.t);
    for (const m of dms) { if (ka >= CAP.dm) break; const A = head(m.from), B = head(m.to); if (!A && !B) continue; const o = fade(t - m.t, win.dm);
      let bx, by, tail = null;
      if (A && B) { const mx = (A.x + B.x) / 2, my = Math.max(topSafe(), Math.min(A.y, B.y) - 30 - Math.hypot(A.x - B.x, A.y - B.y) * .18), a = arcEl(ka++);
        a.p.setAttribute('d', `M${A.x.toFixed(1)},${(A.y - 6).toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${B.x.toFixed(1)},${(B.y - 6).toFixed(1)}`); a.p.style.display = ''; a.p.style.opacity = o;
        a.d.setAttribute('cx', B.x.toFixed(1)); a.d.setAttribute('cy', (B.y - 6).toFixed(1)); a.d.style.display = ''; a.d.style.opacity = o; bx = mx; by = (my + Math.min(A.y, B.y)) / 2 - 4; }
      else { const P = A || B; bx = P.x; by = P.y - 8; tail = true; }
      const e = thinkEl(kt++), key = 'dm' + m.id; if (e._k !== key) { e._k = key; e.className = 'tp-think is-dm'; set(e.firstChild, A && B ? `DM @${m.from} → @${m.to}` : A ? `DM to @${m.to}` : `DM from @${m.from}`); set(e.lastChild, short(m.text, 90)); e._w = e.offsetWidth; e._h = e.offsetHeight; }
      const p = box(Math.round(bx - e._w / 2), by - e._h, e._w, e._h, bx); if (!p) { if (e.classList.contains('is-on')) e.classList.remove('is-on'); continue; }
      const x = Math.round(p.x), y = Math.round(p.y); if (x !== e._x || y !== e._y) { e.style.transform = `translate(${x}px, ${y}px)`; e._x = x; e._y = y; }
      e.style.setProperty('--o', o.toFixed(2)); if (!e.classList.contains('is-on')) e.classList.add('is-on'); void tail; }
    hideFrom('arc', ka);
    // thoughts: the focus first, then the nearest
    const cand = []; for (const th of sec.thinks) { const f = F.has(th.h), age = t - th.t; if (age > (f ? win.focus : win.think)) continue; const P = head(th.h); if (!P) continue; if (!f && P.d > NEAR) continue; cand.push({ th, P, f, age, s: f ? -1e6 + P.d : P.d }); }
    cand.sort((p, q) => p.s - q.s);
    for (const c of cand.slice(0, CAP.think)) { const e = thinkEl(kt++), ago = c.age >= 45 ? ` · ${c.age >= 90 ? Math.round(c.age / 60) + 'h' : Math.round(c.age) + ' min'} ago` : '', key = 'th' + c.th.id + (c.f ? 's' : '') + ago;
      if (e._k !== key) { e._k = key; e.className = 'tp-think' + (c.f ? ' is-sel' : ''); set(e.firstChild, '@' + c.th.h + ago); set(e.lastChild, short(c.th.text)); e._w = e.offsetWidth; e._h = e.offsetHeight; }
      const p = box(Math.round(c.P.x - e._w / 2), c.P.y - e._h - 12, e._w, e._h, c.P.x); if (!p) { if (e.classList.contains('is-on')) e.classList.remove('is-on'); continue; }
      const x = Math.round(p.x), y = Math.round(p.y); if (x !== e._x || y !== e._y) { e.style.transform = `translate(${x}px, ${y}px)`; e._x = x; e._y = y; }
      e.style.setProperty('--o', (c.f ? Math.max(.62, fade(c.age, win.focus)) : fade(c.age, win.think)).toFixed(2)); if (!e.classList.contains('is-on')) e.classList.add('is-on'); }
    hideFrom('think', kt);
    // deals: a chip at the right of each party's head
    let kd = 0; for (const d of sec.deals.slice().sort((p, q) => q.t - p.t)) { if (kd >= CAP.deal) break; for (const who of [d.who, d.to]) { if (!who || kd >= CAP.deal) continue; const P = head(who); if (!P || (!F.has(who) && P.d > NEAR)) continue;
      const e = dealEl(kd++), key = d.id + who; if (e._k !== key) { e._k = key; e.lastChild.textContent = DEAL[d.type] || (d.type || 'deal').replace(/_/g, ' '); }
      const sp = safe(P.x + 10, P.y + 4, e.offsetWidth || 60, 20, P.x); if (!sp) { if (e.classList.contains('is-on')) e.classList.remove('is-on'); continue; }
      const x = Math.round(sp.x), y = Math.round(sp.y); if (x !== e._x || y !== e._y) { e.style.transform = `translate(${x}px, ${y}px)`; e._x = x; e._y = y; }
      e.style.setProperty('--o', fade(t - d.t, win.deal).toFixed(2)); if (!e.classList.contains('is-on')) e.classList.add('is-on'); } }
    hideFrom('deal', kd);
    const ms = performance.now() - t0; S.n++; S.ms += (ms - S.ms) * .05; S.max = Math.max(S.max * .995, ms);
  }
  return { frame, get on() { return on; }, set(v) { on = !!v; if (!on) { hideFrom('think', 0); hideFrom('deal', 0); hideFrom('arc', 0); } return on; },
    clear() { hideFrom('think', 0); hideFrom('deal', 0); hideFrom('arc', 0); }, stats: () => ({ ms: +S.ms.toFixed(4), max: +S.max.toFixed(3), ...shown }) };
}
