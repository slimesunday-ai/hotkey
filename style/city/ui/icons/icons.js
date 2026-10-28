// HUMAN LAYER · ITEM ICONS · the runtime: a CSS sprite per item from the baked atlas (atlas/icons.png 1× · icons@2x.png 2×, 64 / 128 px
// cells; tools/bake-icons.mjs makes them from models.js). Nothing renders here: an icon is one <span> with a background position.
//   iconFor(key, { size, label })  → <span class="k-ico"> (size in CSS px, default 32; unknown keys get the neutral box)
//   keyOf(item)                    → the atlas key of a sim stack / mark / trait / security id ('mark:founder', 'cash', 'temp' …)
//   info(key)                      → { name, group, what, slot?, tier? } or null (after the atlas JSON has loaded: ready)
//   slot(item, o) · slots(items, o) → the inventory slot (icon, count badge, quality marker, flags, hover name) and a grid of them
//   groupStacks(stacks)            → the sim's stacks merged per item (one slot per thing, not per quality)
// The JSON loads once, at import; an icon made before it lands gets its position when it does. Colours come from the kit's tokens
// (icons.css); the art is in the atlas.
const BASE = new URL('./atlas/', import.meta.url), CSS = new URL('./icons.css', import.meta.url);
let atlas = null; const pend = new Set();
export const ready = fetch(new URL('icons.json', BASE)).then(r => r.ok ? r.json() : null).catch(() => null).then(j => { atlas = j; for (const el of pend) place(el); pend.clear(); return j; });
if (typeof document !== 'undefined' && !document.querySelector('link[data-k-icons]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS.href; l.setAttribute('data-k-icons', ''); document.head.append(l); }

const ALIAS = { cr: 'cash', credits: 'cash', money: 'cash', cctv: 'camera', 'test kit': 'kit', scrap: 'pipe' };
export const info = key => atlas?.icons?.[key] || null;
export const known = key => !!info(key);
export function keyOf(x) {
  if (x == null) return 'unknown'; if (typeof x === 'string') return ALIAS[x] || x;
  if (x.mark) return 'mark:' + x.mark; if (x.id && !x.k) return 'mark:' + x.id;   // a mark record { id, why, t }
  return ALIAS[x.k] || x.k || ALIAS[x.label] || x.label || 'unknown';
}
function place(el) {
  const k = el.dataset.icon, e = info(k) || info('unknown'); if (!e || !atlas) return;
  el.style.setProperty('--ix', e.x / atlas.cell); el.style.setProperty('--iy', e.y / atlas.cell); el.style.setProperty('--cols', atlas.cols); el.style.setProperty('--rows', atlas.rows);
  el.dataset.known = info(k) ? '1' : '0'; if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', info(k)?.name || k);
}
export function iconFor(key, { size = 32, label = null } = {}) {
  const el = document.createElement('span'); el.className = 'k-ico'; el.dataset.icon = keyOf(key); el.setAttribute('role', 'img'); if (label) el.setAttribute('aria-label', label);
  el.style.setProperty('--s', size + 'px'); if (atlas) place(el); else pend.add(el); return el;
}
// the name a person reads: the atlas name, else the sim's own word
export const nameOf = (key, fallback = key) => info(keyOf(key))?.name || fallback;

// ── stacks → slots. The sim keeps one stack per (item, label, quality, fake, origin…): a cook carries 17 stacks of truth. One slot per thing
// a person would see as one: the same item under the same label, fake or not, evidence or not, fronted or not.
export function groupStacks(stacks = []) {
  const by = new Map();
  for (const s of stacks) { if (!s) continue; const k = keyOf(s), label = s.label || s.k || k, id = [k, label, !!s.fake, !!s.evidence, !!s.hire, !!s.cut].join('|');
    let g = by.get(id); if (!g) by.set(id, g = { key: k, k: s.k ?? k, label, n: 0, fake: !!s.fake, evidence: !!s.evidence, fronted: !!s.hire, cut: !!s.cut, qs: [], stacks: 0 });
    g.n += s.n ?? 1; g.stacks++; if (typeof s.q === 'number' && !s.fake) g.qs.push([s.q, s.n ?? 1]); }
  for (const g of by.values()) { if (g.qs.length) { const w = g.qs.reduce((a, [, n]) => a + n, 0); g.q = Math.round(g.qs.reduce((a, [q, n]) => a + q * n, 0) / w); g.qlo = Math.min(...g.qs.map(x => x[0])); g.qhi = Math.max(...g.qs.map(x => x[0])); } delete g.qs; }
  const order = atlas?.groups || [], gi = g => { const i = order.indexOf(info(g.key)?.group); return i < 0 ? 99 : i; };
  return [...by.values()].sort((a, b) => gi(a) - gi(b) || b.n - a.n);
}
// one slot: { key, label, n, q, qlo, qhi, fake, evidence, fronted, cut, stacks } (a groupStacks row) or a bare key
export function slot(g, { size = 36, tip = null, count = true } = {}) {
  if (typeof g === 'string') g = { key: keyOf(g), n: 1 };
  const I = info(g.key), name = g.label && g.label !== g.k && I ? `${cap(g.label)} (really ${I.name.toLowerCase()})` : (g.label && !I ? cap(g.label) : I?.name || cap(g.label || g.key));
  const el = document.createElement('div'); el.className = 'k-slot'; el.dataset.group = I?.group || 'unknown';
  el.append(iconFor(g.key, { size, label: name }));
  const num = n => n > 999 ? Math.round(n / 100) / 10 + 'k' : String(n);
  if (count && (g.n > 1 || g.cash)) el.append(Object.assign(document.createElement('b'), { className: 'k-slot-n', textContent: g.cash ? '$' + num(g.n) : num(g.n) }));
  if (typeof g.q === 'number') { const q = document.createElement('i'); q.className = 'k-slot-q'; q.textContent = 'q' + g.q; q.style.setProperty('--q', Math.max(0, Math.min(1, g.q / 100))); el.append(q); }
  const flag = g.fake ? 'fake' : g.evidence ? 'evidence' : g.fronted ? 'fronted' : g.cut ? 'cut' : null;
  if (flag) { el.append(Object.assign(document.createElement('i'), { className: 'k-slot-flag', textContent: flag })); el.dataset.flag = flag; }
  const bits = [g.cash ? `${name} · $${g.n}` : name + (g.n > 1 ? ' ×' + g.n : ''), I?.group === 'trait' ? I.what : '', typeof g.q === 'number' ? (g.qlo !== g.qhi ? `quality ${g.qlo}–${g.qhi} (avg ${g.q})` : `quality ${g.q}`) : '', g.stacks > 1 ? `${g.stacks} stacks` : '',
    g.fake ? 'FAKE' : '', g.evidence ? 'evidence (seized)' : '', g.fronted ? 'fronted: the boss’s, street only' : '', g.cut ? 'cut' : ''].filter(Boolean);
  el.setAttribute('data-tip', g.tip || tip || bits.join(' · ')); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', bits.join(', '));
  return el;
}
export function slots(rows, o = {}) { const el = document.createElement('div'); el.className = 'k-slots' + (o.cls ? ' ' + o.cls : ''); el.setAttribute('role', 'list');
  for (const r of rows) { const s = slot(r, o); s.setAttribute('role', 'listitem'); el.append(s); } return el; }
const cap = s => s ? String(s)[0].toUpperCase() + String(s).slice(1) : s;
