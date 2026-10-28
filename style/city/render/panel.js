// Render pipeline pass · THE RENDER PANEL. The RENDER button in the top bar or the \ key opens it (never in shot=1 pages). Everything in
// it is generated from settings.sections(): one box per section, grouped (post, light, anything else), collapsible, with its on/off
// switch in the header and sliders, toggles, choices and colours from the field specs (double-click a row: back to its default).
// Post boxes are listed in stack order and move with ↑ ↓. Sections that register later (the lighting agent's) appear on their own.
// Looks: built-ins (render/presets/index.json) and looks saved in this browser; Save as…, Export and Import JSON, Reset (= Current,
// today's look). Choosing a look writes ?preset=<name> into the URL (not ?look=, which is the camera's look-at point), and this tab keeps unsaved tweaks across reloads (Day/Night).
// Cost: frame time (rAF) and GPU ms; per pass with EXT_disjoint_timer_query_webgl2, otherwise the frame-time change after a toggle.
import * as S from './settings.js';
import * as L from './looks.js';

const store = (area, k, v) => { try { const s = area === 'local' ? localStorage : sessionStorage; if (v === undefined) return JSON.parse(s.getItem(k) || 'null'); s.setItem(k, JSON.stringify(v)); } catch { return null; } };
const WORK = 'city.render.working', OPEN = 'city.render.open', EXP = 'city.render.expanded';
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const norm = v => JSON.stringify(Object.keys(v || {}).sort().map(s => [s, Object.keys(v[s]).sort().map(k => [k, v[s][k]])]));
const fmt = (x, spec) => { const st = spec.step ?? .01; return st >= 1 ? String(Math.round(x)) : (+x).toFixed(Math.min(3, Math.max(0, Math.ceil(-Math.log10(st))))); };

export function mountPanel({ post, dyn }) {
  let look = post.lookName || 'current', lookValues = S.snapshot(), note = '';   // (the look main.js applied: ?preset's, or the default when there was none or it was not found)
  const w = store('session', WORK);   // this tab's unsaved tweaks on this look (a Day/Night switch reloads the page)
  if (w && (w.look || 'current') === look && w.values && norm(w.values) !== norm(lookValues)) { S.load(w.values, { reset: true }); post.ready(); note = 'unsaved tweaks restored · Reset for today’s look'; }
  let saveT = 0; S.on(() => { clearTimeout(saveT); saveT = setTimeout(() => store('session', WORK, { look, values: S.snapshot() }), 250); });

  let el = null, open = false, raf = 0, known = 0, costEl, noteEl, sel, groupsEl;
  const ctl = new Map(), boxes = new Map(), expanded = new Set(store('local', EXP) || []), marks = new Map(), deltas = {};
  const btn = document.querySelector('[data-render]');
  const toggle = (want = !open) => { open = want; if (open && !el) build(); if (el) el.hidden = !open; btn?.classList.toggle('on', open); btn?.setAttribute('aria-expanded', String(open));
    post.profile(open); store('session', OPEN, open); cancelAnimationFrame(raf); if (open) { refresh(); raf = requestAnimationFrame(tick); } };
  if (btn) btn.onclick = () => toggle();
  addEventListener('keydown', e => { if (!(e.key === '\\' || e.code === 'Backslash') || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '')) return; e.preventDefault(); toggle(); });
  S.on((sec, key) => { if (!el) return; if (sec === 'stack') reorder(); else if (sec && key) sync(sec, key); else refresh(); status(); });

  function build() {
    el = h('div'); el.id = 'rpanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Render settings');
    const top = h('div', 'rp-top'); top.append(h('b', null, 'Render'), costEl = h('span', 'rp-cost', '…'));
    const x = h('button', 'rp-x', '✕'); x.title = 'close (\\)'; x.onclick = () => toggle(false); top.append(x);
    const looks = h('div', 'rp-looks'); sel = h('select', 'rp-look'); sel.setAttribute('aria-label', 'Look'); looks.append(sel);
    const file = h('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    const act = (label, fn, title) => { const b = h('button', null, label); b.onclick = fn; if (title) b.title = title; looks.append(b); return b; };
    act('Save as…', saveAs, 'save the current settings as a look in this browser');
    act('Export', exportLook, 'download the current settings as a look JSON');
    act('Import', () => file.click(), 'load a look JSON');
    act('Reset', () => choose('current'), 'Current: today’s look (every setting at its default)');
    const del = act('Delete', () => { const c = sel.value.startsWith('custom:') && sel.value.slice(7); if (c && confirm(`Delete the saved look “${c}”?`)) { L.deleteCustom(c); fillLooks(); } }, 'delete this saved look');
    del.className = 'rp-del';
    looks.append(file); file.onchange = async () => { const f = file.files[0]; file.value = ''; if (!f) return;
      try { const v = L.parseLook(await f.text()); S.load(v, { reset: true }); await post.ready(); look = f.name.replace(/\.json$/i, ''); lookValues = S.snapshot(); note = `imported ${f.name} · Save as… to keep it`; setURL(null); fillLooks(); }
      catch (e) { note = 'import failed: ' + e.message; } status(); };
    sel.onchange = () => { const v = sel.value; if (v.startsWith('custom:')) { const c = L.customs()[v.slice(7)]; if (c) { S.load(c, { reset: true }); post.ready(); look = v.slice(7); lookValues = S.snapshot(); note = ''; setURL(look); } } else choose(v); };
    noteEl = h('div', 'rp-note'); groupsEl = h('div', 'rp-groups');
    el.append(top, looks, noteEl, groupsEl); document.body.append(el); fillLooks();
  }
  async function choose(name) { await post.look(name); look = name; lookValues = S.snapshot(); note = ''; setURL(name); fillLooks(); status(); }
  // (the default look needs no ?preset; every other look, Current included, is written into the URL so a reload keeps it)
  function setURL(name) { const u = new URL(location.href); if (name && name !== post.defaultLook) u.searchParams.set('preset', name); else u.searchParams.delete('preset'); history.replaceState(history.state, '', u); }
  async function fillLooks() {
    const b = await L.builtins(), c = L.customs(); sel.textContent = '';
    const g1 = h('optgroup'); g1.label = 'Built-in'; if (!b.some(p => p.name === 'current')) b.unshift({ name: 'current', label: 'Current' });
    for (const p of b) { const o = h('option', null, p.label || p.name); o.value = p.name; g1.append(o); } sel.append(g1);
    const names = Object.keys(c).sort(); if (names.length) { const g2 = h('optgroup'); g2.label = 'Saved in this browser'; for (const n of names) { const o = h('option', null, '★ ' + n); o.value = 'custom:' + n; g2.append(o); } sel.append(g2); }
    if (![...sel.options].some(o => o.value === look || o.value === 'custom:' + look)) { const o = h('option', null, look); o.value = look; sel.prepend(o); }
    sel.value = b.some(p => p.name === look) ? look : c[look] ? 'custom:' + look : look; status();
  }
  function saveAs() { const name = (prompt('Save this look as…', look === 'current' ? 'my-look' : look) || '').trim().replace(/[^\w\- ]+/g, '').slice(0, 40); if (!name) return;
    if (!L.saveCustom(name, S.snapshot())) { note = 'could not save (browser storage unavailable)'; status(); return; }
    look = name; lookValues = S.snapshot(); note = `saved “${name}” in this browser · Export to share it`; setURL(name); fillLooks(); }
  function exportLook() { const a = h('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.snapshot(), null, 2) + '\n'], { type: 'application/json' }));
    a.download = `${look || 'look'}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function status() { if (!el) return; const mod = norm(S.snapshot()) !== norm(lookValues); noteEl.textContent = [mod ? `${look} · modified` : '', note].filter(Boolean).join(' · ');
    el.querySelector('.rp-del').hidden = !sel.value.startsWith('custom:'); }

  // ── the sections
  const keyOf = s => s.meta?.group === 'post' ? (s.meta?.fixed ? -1000 + (s.meta.order ?? 0) : post.order.indexOf(s.name)) : (s.meta?.order ?? 0);
  function refresh() {
    const all = S.sections().filter(s => !s.meta?.hidden); if (all.length !== known) return render(all);
    for (const s of all) for (const k of Object.keys(s.fields)) sync(s.name, k); reorder();
  }
  function render(all) {
    known = all.length; groupsEl.textContent = ''; ctl.clear(); boxes.clear();
    const groups = new Map(); for (const s of all) { const g = s.meta?.group || 'other'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(s); }
    for (const g of ['post', 'film', 'light', ...[...groups.keys()].filter(g => g !== 'post' && g !== 'film' && g !== 'light')]) { const list = groups.get(g); if (!list) continue;
      groupsEl.append(h('div', 'rp-group', g === 'post' ? 'Post · the stack runs top to bottom' : g === 'film' ? 'Film · one pass (Film emulation), one film frame at a time' : g === 'light' ? 'Light' : g));
      const box = h('div', 'rp-list'); box.dataset.group = g; groupsEl.append(box); list.sort((a, b) => keyOf(a) - keyOf(b)).forEach(s => box.append(section(s)));
    }
  }
  function reorder() { const box = groupsEl?.querySelector('[data-group="post"]'); if (!box) return;
    [...boxes.entries()].filter(([, b]) => b.parentNode === box).map(([n]) => S.sections().find(s => s.name === n)).sort((a, b) => keyOf(a) - keyOf(b)).forEach(s => box.append(boxes.get(s.name))); }
  function section(s) {
    const f = s.fields, box = h('section', 'rp-sec'), head = h('div', 'rp-head'), body = h('div', 'rp-body'); box.dataset.name = s.name; boxes.set(s.name, box);
    const tw = h('button', 'rp-tw'), title = h('span', 'rp-title', s.meta?.title || s.name); if (s.meta?.hint) title.title = s.meta.hint;
    const ms = h('span', 'rp-ms'); ms.dataset.ms = s.name; head.append(tw, title, ms);
    if ('on' in f) { const cb = h('input'); cb.type = 'checkbox'; cb.title = 'on / off'; cb.setAttribute('aria-label', (s.meta?.title || s.name) + ' on');
      cb.checked = !!s.values.on; cb.onchange = () => { markDelta(s.name); S.set(s.name, 'on', cb.checked); }; ctl.set(s.name + '.on', { input: cb, spec: f.on }); head.append(cb); }
    if (s.meta?.group === 'post' && !s.meta?.fixed) for (const [t, d] of [['↑', -1], ['↓', 1]]) { const b = h('button', 'rp-mv', t); b.title = d < 0 ? 'run earlier' : 'run later'; b.onclick = () => post.move(s.name, d); head.append(b); }
    const setOpen = v => { body.hidden = !v; tw.textContent = v ? '▾' : '▸'; tw.setAttribute('aria-expanded', String(v)); if (v) expanded.add(s.name); else expanded.delete(s.name); store('local', EXP, [...expanded]); };
    tw.onclick = title.onclick = () => setOpen(body.hidden); setOpen(expanded.has(s.name));
    for (const [k, spec] of Object.entries(f)) if (k !== 'on' && !spec.hidden) body.append(row(s.name, k, spec, s.values[k]));
    if (!body.children.length) tw.style.visibility = 'hidden';
    box.append(head, body); box.classList.toggle('off', 'on' in f && !s.values.on); return box;
  }
  function row(sec, key, spec, v) {
    const r = h('label', 'rp-row'); if (spec.hint) r.title = spec.hint; r.append(h('span', 'rp-k', spec.label || key)); let input, out = null;
    if (typeof spec.v === 'boolean') { input = h('input'); input.type = 'checkbox'; input.onchange = () => S.set(sec, key, input.checked); }
    else if (spec.options) { input = h('select'); for (const o of spec.options) { const e = h('option', null, String(o)); e.value = String(o); input.append(e); } input.onchange = () => S.set(sec, key, typeof spec.v === 'number' ? +input.value : input.value); }
    else if (spec.color) { input = h('input'); input.type = 'color'; input.oninput = () => S.set(sec, key, input.value); }
    else if (typeof spec.v === 'number') { input = h('input'); input.type = 'range'; input.min = spec.min ?? 0; input.max = spec.max ?? 1; input.step = spec.step ?? ((input.max - input.min) / 100);
      out = h('span', 'rp-v'); input.oninput = () => S.set(sec, key, +input.value); }
    else { input = h('input'); input.type = 'text'; input.onchange = () => S.set(sec, key, input.value); }
    r.append(input); if (out) r.append(out); else input.classList.add('rp-wide');
    r.ondblclick = e => { if (e.target !== input || input.type === 'range') S.set(sec, key, spec.v); };
    ctl.set(sec + '.' + key, { input, out, spec, row: r }); sync(sec, key, v); return r;
  }
  function sync(sec, key, v = S.get(sec)?.[key]) {
    const c = ctl.get(sec + '.' + key); if (!c) return; const { input, out, spec, row } = c;
    if (input.type === 'checkbox') input.checked = !!v; else if (String(input.value) !== String(v)) input.value = v;
    if (out) out.textContent = fmt(v, spec); row?.classList.toggle('mod', v !== spec.v);
    if (key === 'on') boxes.get(sec)?.classList.toggle('off', !v);
  }

  // ── cost: frame time, GPU ms (per pass when the timer extension exists), else the frame-time change after a toggle
  function markDelta(name) { if (!post.timer) marks.set(name, { before: ema, frames: 0 }); }
  let last = 0, ema = 0, n = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick); if (last) { const dt = now - last; if (dt < 250) ema = ema ? ema * .93 + dt * .07 : dt; } last = now;
    for (const [name, m] of marks) if (++m.frames === 90) { const d = ema - m.before; deltas[name] = `Δ${d >= 0 ? '+' : ''}${d.toFixed(1)} ms`; marks.delete(name); }
    if (++n % 12) return;
    const c = post.costs(), per = post.timer && post.active; let t = `frame ${ema.toFixed(1)} ms`;
    if (per) { let tot = c.scene ?? 0; for (const k of post.order) if (post.live(k) && c[k] != null) tot += c[k]; t += ` · gpu ${tot.toFixed(2)} (scene ${(c.scene ?? 0).toFixed(2)})`; }
    else if (dyn?.gpu != null) t += ` · gpu ${dyn.gpu.toFixed(2)}`;
    costEl.textContent = t + (post.active ? ` · ${post.passes} pass${post.passes === 1 ? '' : 'es'}` : ' · post off');
    for (const e of groupsEl.querySelectorAll('[data-ms]')) { const k = e.dataset.ms; e.textContent = per ? (post.live(k) && c[k] != null ? c[k].toFixed(2) + ' ms' : '') : (deltas[k] || ''); }
    if (S.sections().filter(s => !s.meta?.hidden).length !== known) refresh();
  }
  if (store('session', OPEN)) toggle(true);   // (open again after a reload in this tab)
}
