// C1-11, the drawn half · THE PANELS READ THE RECORD, WATCHED: the record path's counterpart of ui/tools/infocheck.mjs. One headless-Chrome
// run of a seed's recorded season (?sim=record), driven with real input: the record player's minute box, a click on an agent's walker,
// the menu's buttons.
//   node style/city/tools/panelscenario.mjs --port 5970 [--seed 404] [--out <dir>] [--no-shots]
// Steps; the first that fails stops the run:
//   1 moments   at dawn, a day errand, a sit-down, the show, the show's close (C1-6's actual plan.end), the next dawn and a live high: seek
//               with the minute box, click the walker of an agent active then (its dossier opens), open People and CH 9. Every value the
//               panels' DOM shows ([data-k] values, [data-row] stories and receipts with their parts) must equal panel-data.js's
//               panelsAt / peopleAt / leadersAt / mapAt / newsAt for the same presented snapshot at that minute (computed here, in node,
//               on a fresh show player seeked there), printed through ui/record/format.js. It fails on any value from a later frame (a
//               receipt published after the minute), a value drawn with no source, a missing value, a hooded attacker named (in a live
//               fight, show or masked card row, or pickable in the city), a click on a hooded stand-in that opens a dossier, a drug's name
//               in a live row, a disclosed row without its record badge. The map is checked at one moment.
//   2 controls  each property's violation planted in the page (DOM injections, and one private-file request) must be caught; each plant
//               is removed again (the panels re-render) before the next.
//   3 layout    at 1280×720, 1440×900 and 1920×1080: no open panel overlaps another or the record player's controls (People, the dossier,
//               CH 9, the ticker, the menu; then the map alone).
//   4 network   every request the page and its workers made: only GETs of this server's static files and the feed (and the import map's
//               pinned three.js); anything else fails (recordscenario's rule).
//   5 frames    frame time p95 with the panels open, the record playing at 60×, against the same view with no sim (reported; rerun once).
//   6 shots     a dossier by day, a dossier during the show, People, the paper map, the ticker with a record story, CH 9: 2×2 sheets,
//               each tile labelled with its moment and its step's pass/fail.
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, click, typeMinute, serve } from './recordscenario.mjs';
import { parseFeed } from '../simstate/record/adapter.js';
import { createShowPlayer } from '../simstate/record/show-plan.js';
import { panelsAt, peopleAt, leadersAt, mapAt, newsAt } from '../simstate/record/panel-data.js';
import { fmt, has, at, DRUGS } from '../ui/record/format.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), SEED = +arg('seed', 404), SHOTS = !process.argv.includes('--no-shots');
const OUT = path.resolve(arg('out', path.join(ROOT, `style/city/shots/c1-11/${SEED}`)));
const BASE = `http://127.0.0.1:${PORT}`, FEED = `/core/runs/${SEED}-A/feed.jsonl`;
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LISTS = { 'rap': p => p.rap, 'tape.events': p => p.tape.events, 'tape.holdings': p => p.tape.holdings ? [p.tape.holdings] : [],
  'news.live': p => p.news.live, 'news.record': p => p.news.record };
const CARD_KEYS = ['trade', 'driver', 'heat', 'wanted', 'jailed', 'bail', 'evicted', 'tab', 'boarded', 'walk', 'crew', 'lastSay'];
const DRUG_RE = new RegExp(`\\b(${DRUGS.join('|')})\\b`, 'i');

// ── the record, in node: the presented snapshot at a minute is a fresh show player seeked there, the scene plan stripped (record/page.js)
const frames = parseFeed(fss.existsSync(path.join(ROOT, FEED.slice(1))) ? fss.readFileSync(path.join(ROOT, FEED.slice(1)), 'utf8') : (() => {
  const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(SEED), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr); return fss.readFileSync(path.join(ROOT, FEED.slice(1)), 'utf8'); })());
const firstPub = new Map();
for (const f of frames) for (const e of f.events) if (!firstPub.has(e.id)) firstPub.set(e.id, e.minute);
function stateAt(minute) { const { show, ...s } = createShowPlayer(frames).seek(minute); return { s, show }; }

// the moments: dawn, a day errand, a sit-down, the show, its close, the next dawn, a live high (seed-independent picks)
function moments() {
  const player = createShowPlayer(frames), out = [], ev = frames.flatMap(f => f.events);
  const dawn = d => frames.find(f => f.step.kind === 'dawn' && f.minute >= d * 1440)?.minute ?? d * 1440 + 360;
  out.push({ key: 'dawn', label: 'Day 2 dawn', minute: dawn(2) + 1, tod: 'day' });
  const errand = frames.find(f => f.step.kind === 'errand' && f.minute >= 2 * 1440 + 360);
  out.push({ key: 'errand', label: 'Day 2 errand', minute: errand.minute + 1, tod: 'day' });
  const meet = ev.find(e => e.type === 'meet' && e.minute > errand.minute);
  out.push({ key: 'sitdown', label: `Sit-down ${meet.a} & ${meet.b}`, minute: meet.minute + 1, tod: 'day', prefer: [meet.a, meet.b] });
  // the first night with hooded attackers
  const hoodedNight = ev.find(e => e.type === 'show' && Object.values(e.hooded).some(Boolean))?.night ?? 2;
  // (the minute: a scene with hooded figures on, else 2 minutes in)
  const night = player.shows().find(s => s.night === hoodedNight), show = player.seek(night.minute + 2).show;
  let mShow = show.start + 2;
  for (let m = show.start; m < show.end; m += .25) if (player.seek(m).show?.active.some(a => a.hoodedCount > 0)) { mShow = +(m + .3).toFixed(2); break; }
  out.push({ key: 'show', label: `Night ${hoodedNight} show`, minute: mShow, tod: 'night', prefer: player.seek(mShow).show.active.flatMap(a => a.publicActors) });
  out.push({ key: 'close', label: `Night ${hoodedNight} close (plan.end ${show.end})`, minute: show.end + 0.5, tod: 'night' });
  out.push({ key: 'nextdawn', label: `Day ${hoodedNight + 1} dawn`, minute: dawn(hoodedNight + 1) + 1, tod: 'day' });
  const high = ev.find(e => e.type === 'high');
  if (high) { const m = high.minute + 1, night = (m % 1440) >= 1200 || (m % 1440) < 360; out.push({ key: 'high', label: `Live high ${high.agent}`, minute: m, tod: night ? 'night' : 'day', prefer: [high.agent] }); }
  return out;
}

// ── the page's DOM, as data: every value element and every story/receipt row, per panel
const DUMP = `(() => {
  const vis = n => !!n && !n.hidden && n.getAttribute('aria-hidden') !== 'true' && getComputedStyle(n).visibility !== 'hidden';
  const rowOf = n => n.closest('[data-row]');
  const one = sel => { const box = document.querySelector(sel); if (!vis(box)) return null;
    const ks = [...box.querySelectorAll('[data-k]')].map(n => { const r = rowOf(n); return { k: n.dataset.k, text: n.textContent, row: r?.dataset.row ?? null, agent: r?.dataset.agent ?? null }; });
    const rows = [...box.querySelectorAll('[data-row][data-ev]')].map(n => { const w = n.querySelector('[data-words]');
      return { list: n.dataset.row, scope: n.dataset.scope, ev: +n.dataset.ev, type: n.dataset.type, text: w?.textContent ?? '', badge: !!n.querySelector('[data-badge=record]'),
        parts: [...(w?.querySelectorAll('[data-path]') ?? [])].map(p => ({ ev: +p.dataset.ev, path: p.dataset.path, text: p.textContent, free: p.hasAttribute('data-free') })) }; });
    return { ks, rows, text: box.textContent }; };
  const U = window.__recordUI, R = window.__record;
  return { minute: R.player.minute, frame: U.sim.record().frame?.i ?? null, dossier: U.dossier.current,
    panels: { dossier: one('#r-dossier'), people: one('#r-people'), map: one('#r-map'), ticker: one('#r-ticker'), ch9: one('#r-ch9') },
    pickable: U.pickable(), peopleTab: document.querySelector('#r-people [aria-selected=true]')?.id ?? null };
})()`;

// ── the comparison: the DOM against panel-data.js at the same minute
function compare(dump, { agent, show }) {
  const errors = [], minute = dump.minute, { s } = stateAt(minute), P = agent ? panelsAt(s, agent, minute) : null;
  const err = (property, detail) => errors.push({ property, ...detail });
  if (dump.frame !== (s.frame?.i ?? null)) err('later frame', { what: 'presented frame', page: dump.frame, record: s.frame?.i });
  const news = newsAt(s, minute), roster = peopleAt(s, null, minute), leaders = leadersAt(s, minute), map = mapAt(s, minute);
  const named = id => { const a = s.board.agents.find(a => a.id === id); return a ? `${a.name} (@${a.id})` : `@${id}`; };
  // (a night's results carry the lock's minute but are held until their scene pays off: "later" is anything the presented snapshot lacks)
  const present = new Set(s.events.map(e => e.id)), late = id => !present.has(id) || (firstPub.get(id) ?? Infinity) > minute;
  // one value element
  const value = (panel, x, source) => {
    const key = x.k.split('.').at(-1), v = x.k.includes('.') ? at(source, x.k) : at(roster.find(c => c.id === x.agent) ?? {}, x.k);
    const want = fmt(key, v);
    if (want === null) err('no source', { panel, k: x.k, agent: x.agent, shown: x.text });
    else if (want !== x.text) err('value', { panel, k: x.k, agent: x.agent, shown: x.text, want });
  };
  // one story / receipt row: it exists in its list at this minute, with the same words and parts; a record row wears its badge
  const row = (panel, r, listOf) => {
    if (late(r.ev)) return err('later frame', { panel, ev: r.ev, published: firstPub.get(r.ev), minute });
    const want = listOf(r.list)?.find(x => x.id === r.ev);
    if (!want) return err('value', { panel, list: r.list, ev: r.ev, what: 'row not in its list at this minute' });
    if (want.text !== r.text) err('value', { panel, list: r.list, ev: r.ev, shown: r.text, want: want.text });
    const parts = want.parts.filter(p => typeof p !== 'string').map(p => ({ path: p.source.path, text: p.text }));
    if (JSON.stringify(parts) !== JSON.stringify(r.parts.map(p => ({ path: p.path, text: p.text })))) err('value', { panel, ev: r.ev, what: 'parts differ' });
    if (r.scope !== want.scope) err('value', { panel, ev: r.ev, what: 'scope', shown: r.scope, want: want.scope });
    if (want.scope === 'record' && !r.badge) err('badge', { panel, ev: r.ev });
    if (want.scope !== 'record' && r.badge) err('badge', { panel, ev: r.ev, what: 'a live row wears the record badge' });
  };
  // a live row naming a drug (by its typed field, or by its words outside free text)
  const drug = (panel, r) => {
    if (r.scope === 'record') return;
    for (const p of r.parts) if (/(^|\.)drug$/.test(p.path) || DRUGS.some(d => p.path === 'goods.' + d)) err('drug live', { panel, ev: r.ev, path: p.path, text: p.text });
    const fixed = r.parts.filter(p => p.free).reduce((t, p) => t.replace(p.text, ''), r.text);
    if (DRUG_RE.test(fixed)) err('drug live', { panel, ev: r.ev, text: r.text });
  };
  // the show: an agent absent from show.seen and not in jail is hooded; no live fight / show / masked card row of tonight names one, none
  // is pickable
  const night = show ? show.night : null, showEv = night != null ? s.events.find(e => e.type === 'show' && e.night === night) : null;
  const hooded = showEv ? s.board.agents.filter(a => !a.jailed && !Object.hasOwn(showEv.seen, a.id)).map(a => a.id) : [];
  // a live fight / show / card row of night n names nobody absent from night n's show.seen, but as its typed target (any minute)
  const absent = n => { const e = s.events.find(e => e.type === 'show' && e.night === n); return e ? s.board.agents.map(a => a.id).filter(id => !Object.hasOwn(e.seen, id)) : []; };
  const hood = (panel, r) => {
    if (r.scope === 'record' || !['fight', 'show', 'card'].includes(r.type)) return;
    const want = news.live.find(x => x.id === r.ev), n = want?.fields.night ?? want?.fields.card?.night; if (n == null) return;
    const names = absent(n).map(named), plain = r.parts.filter(p => p.path === 'target').reduce((t, p) => t.replace(p.text, ''), r.text);
    for (const p of r.parts) if (names.includes(p.text) && p.path !== 'target') err('hooded name', { panel, ev: r.ev, path: p.path, text: p.text });
    for (const nm of names) if (plain.includes(nm)) err('hooded name', { panel, ev: r.ev, text: r.text });
  };
  for (const id of dump.pickable) if (hooded.includes(id)) err('hooded name', { panel: 'city', what: 'a hooded agent is pickable', agent: id });
  const D = dump.panels;
  // the dossier
  if (agent) {
    if (!D.dossier || dump.dossier !== agent) err('value', { panel: 'dossier', what: 'not open on ' + agent, open: dump.dossier });
    else {
      for (const x of D.dossier.ks) value('dossier', x, P);
      const shown = new Set(D.dossier.ks.map(x => x.k));
      for (const k of CARD_KEYS) { const v = P.card[k], el = k === 'crew' && P.people.crew ? 'people.crew.name' : 'card.' + k;
        if (has(v) && !shown.has(el) && !(k === 'wanted' || k === 'jailed') ) err('missing', { panel: 'dossier', k: el });
        if (has(v) && (k === 'wanted' || k === 'jailed') && !shown.has('card.' + k)) err('missing', { panel: 'dossier', k: 'card.' + k }); }
      if (!shown.has(P.card.fitHidden ? 'card.fitHidden' : 'card.fit')) err('missing', { panel: 'dossier', k: 'card.fit' });
      if (P.home?.address && !shown.has('home.address.name')) err('missing', { panel: 'dossier', k: 'home.address.name' });
      for (const r of D.dossier.rows) { row('dossier', r, l => LISTS[l]?.(P)); drug('dossier', r); }
      const ids = l => D.dossier.rows.filter(r => r.list === l).map(r => r.ev);
      if (JSON.stringify(ids('rap')) !== JSON.stringify(P.rap.slice(0, 40).map(r => r.id))) err('value', { panel: 'dossier', what: 'rap rows', shown: ids('rap').length, want: Math.min(40, P.rap.length) });
      if (JSON.stringify(ids('tape.events')) !== JSON.stringify([...P.tape.events].reverse().slice(0, 40).map(r => r.id))) err('value', { panel: 'dossier', what: 'tape rows', shown: ids('tape.events').length, want: Math.min(40, P.tape.events.length) });
      if (!P.tape.pending && !/RECORD/.test(D.dossier.text)) err('badge', { panel: 'dossier', what: 'the 24-hour side has no record badge' });
      if (DRUG_RE.test(D.dossier.ks.filter(x => x.k.startsWith('card.') && x.k !== 'card.lastSay').map(x => x.text).join(' '))) err('drug live', { panel: 'dossier', what: 'card' });
    }
  }
  // People, its leaderboards, the map
  const L = { leaders, map };
  if (D.people) { for (const x of D.people.ks) value('people', x, L); }
  if (D.map) { for (const x of D.map.ks) value('map', x, L);
    for (const [k, list] of [['map.places', map.places], ['map.districts', map.districts], ['map.corners', map.corners], ['map.wanted', map.wanted]])
      if (D.map.ks.filter(x => x.row === k).length === 0 && list.length) err('missing', { panel: 'map', k }); }
  // the ticker and CH 9
  const newsList = l => l === 'news.live' ? news.live : l === 'news.record' ? news.record : null;
  for (const panel of ['ticker', 'ch9']) if (D[panel]) for (const r of D[panel].rows) { row(panel, r, newsList); drug(panel, r); hood(panel, r); }
  if (agent && D.dossier) for (const r of D.dossier.rows) hood('dossier', r);
  if (D.ticker) {
    const ids = l => D.ticker.rows.filter(r => r.list === l).map(r => r.ev);
    if (JSON.stringify(ids('news.live')) !== JSON.stringify(news.live.slice(-12).reverse().map(r => r.id))) err('value', { panel: 'ticker', what: 'live stories' });
    if (JSON.stringify(ids('news.record')) !== JSON.stringify(news.record.slice(-5).reverse().map(r => r.id))) err('value', { panel: 'ticker', what: 'record stories' });
  }
  // live areas: no drug name in the card values, People or the map
  for (const panel of ['people', 'map']) if (D[panel] && DRUG_RE.test(D[panel].ks.map(x => x.text).join(' '))) err('drug live', { panel });
  return { errors, hooded, rows: Object.values(D).reduce((n, d) => n + (d?.rows.length ?? 0), 0), values: Object.values(D).reduce((n, d) => n + (d?.ks.length ?? 0), 0) };
}

// ── the page
async function goTo(B, m) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=${m.tod}&recordAt=${m.minute - 0.5}` });
  await ready(B); await uiReady(B);
  await typeMinute(B, m.minute); await ready(B); await uiReady(B);
}
async function uiReady(B, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await B.ev('!!window.__recordUI && !!window.__record?.draw', false).catch(() => false)) return; await sleep(200); }
  throw new Error('the record UI did not mount');
}
// the camera onto a walker, then a real click on it (between its feet and its head); → the dossier's agent
async function clickAgent(B, id) {
  const p = await B.ev(`(() => { const a = window.__record.draw.agents?.map.get(${JSON.stringify(id)}); return a?.w ? [a.w.p[0], a.w.p[2]] : null; })()`);
  if (!p) return null;
  await B.ev(`(() => { const c = window.__city; c.controls.target.set(${p[0]}, 0.6, ${p[1]}); c.camera.position.set(${p[0] + 7}, 9, ${p[1] + 11}); c.controls.update?.(); return true; })()`);
  for (let k = 0; k < 20; k++) { await sleep(150); const sp = await B.ev(`window.__recordUI.city.screenOf(${JSON.stringify(id)})`); if (sp) {
    const x = sp.x + (sp.fx - sp.x) * .5, y = sp.y + (sp.fy - sp.y) * .5;
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    await sleep(300); return B.ev('window.__recordUI.dossier.current'); } }
  return null;
}
const clickMenu = (B, label) => B.ev(`(() => { const b = [...document.querySelectorAll('#r-menu button')].find(b => b.textContent.startsWith(${JSON.stringify(label)})); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`)
  .then(async p => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(250); });
const isOpen = (B, what) => B.ev(`window.__recordUI.${what}.isOpen`);
async function openPanels(B, { people = true, ch9 = true } = {}) {
  if (people && !(await isOpen(B, 'people'))) await clickMenu(B, 'People');
  if (ch9 && !(await isOpen(B, 'ch9'))) await clickMenu(B, 'CH 9');
}
const stamp = m => `day ${Math.floor(m / 1440)} ${String(Math.floor(m % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
// the tiles for slime: a dossier by day (the sit-down), one during the show, CH 9 and the ticker at the show's close, People's heat ladder
async function shotsAt(B, m, minute, agent, tiles) {
  const at = `${m.label} · ${stamp(minute)}`;
  if (m.key === 'sitdown') tiles.push({ file: await shot(B, path.join(OUT, 'dossier-day.png')), label: `Dossier by day (@${agent}) · ${at}`, step: 'moments' });
  if (m.key === 'show') tiles.push({ file: await shot(B, path.join(OUT, 'dossier-show.png')), label: `Dossier during the show (@${agent}) · ${at}`, step: 'moments' });
  if (m.key === 'close') {
    const r = await B.ev(`(() => { const b = document.getElementById('r-ch9').getBoundingClientRect(); return { x: b.x - 10, y: b.y - 10, width: b.width + 20, height: b.height + 20 }; })()`);
    tiles.push({ file: await shot(B, path.join(OUT, 'ch9.png'), r), label: `CH 9 · ${at}`, step: 'moments' });
    // (the track held still with its first record story in view: it scrolls on the page)
    const t = await B.ev(`(() => { const tr = document.querySelector('#r-ticker .r-track'), sep = tr.querySelector('.r-tick-sep'); tr.style.animation = 'none'; tr.style.transform = sep ? 'translateX(' + (-(sep.offsetLeft - 60)) + 'px)' : ''; const b = document.getElementById('r-ticker').getBoundingClientRect(); return { x: 0, y: Math.max(0, b.y - 200), width: innerWidth, height: innerHeight - Math.max(0, b.y - 200) }; })()`);
    tiles.push({ file: await shot(B, path.join(OUT, 'ticker.png'), t), label: `The ticker with a disclosed-record story · ${at}`, step: 'moments' });
    await B.ev(`(() => { const tr = document.querySelector('#r-ticker .r-track'); tr.style.animation = ''; tr.style.transform = ''; })()`);
  }
  if (m.key === 'nextdawn') {
    const p = await B.ev(`(() => { const b = document.getElementById('k-tab-heat').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await sleep(300);
    tiles.push({ file: await shot(B, path.join(OUT, 'people.png')), label: `People · the heat ladder · ${at}`, step: 'moments' });
  }
}
async function shot(B, file, clip = null) { const r = await B.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
const RECTS = `(() => { const out = {}; const vis = n => !!n && !n.hidden && n.getAttribute('aria-hidden') !== 'true' && getComputedStyle(n).visibility !== 'hidden' && getComputedStyle(n).display !== 'none';
  for (const id of ['r-dossier', 'r-people', 'r-ch9', 'r-ticker', 'r-menu', 'r-map', 'record-player']) { const n = document.getElementById(id); if (!vis(n)) continue; const b = n.getBoundingClientRect(); if (b.width && b.height) out[id] = [b.left, b.top, b.right, b.bottom]; }
  return out; })()`;
function overlaps(rects) {
  const ids = Object.keys(rects), bad = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = rects[ids[i]], b = rects[ids[j]];
    const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (w > .5 && h > .5) bad.push([ids[i], ids[j], Math.round(w), Math.round(h)]); }
  return bad;
}

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/panelscenario.mjs --port <port> [--seed 404]'); process.exit(2); }
  await fs.mkdir(OUT, { recursive: true });
  const server = await serve(), B = await chrome(), result = { seed: SEED, steps: [], moments: [] }, tiles = [];
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail).slice(0, 1500) : ''}`); if (!ok) throw Object.assign(new Error(name + ' failed'), { step: true }); };
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  try {
    // 1 · the moments
    const list = moments(); let showDump = null, show = null;
    for (const m of list) {
      await goTo(B, m);
      const minute = await B.ev('window.__record.player.minute'), st = stateAt(minute);
      const seen = st.show ? st.s.events.find(e => e.type === 'show' && e.night === st.show.night)?.seen ?? {} : null;
      // an agent active now: the moment's own (a sit-down's pair, a scene's actors, the high's), else any drawn walker; never a hooded one
      const drawn = await B.ev(`[...window.__record.draw.agents.map].filter(([, a]) => a.w).map(([id]) => id)`);
      const cand = [...(m.prefer ?? []), ...drawn].filter((id, i, a) => a.indexOf(id) === i && drawn.includes(id) && (!seen || Object.hasOwn(seen, id)));
      let agent = null;
      for (const id of cand.slice(0, 6)) { if ((agent = await clickAgent(B, id)) === id) break; agent = null; }
      if (!agent) { step('moments', false, { moment: m.key, minute, what: 'no active agent could be clicked', tried: cand.slice(0, 6) }); }
      await openPanels(B);
      if (m.key === 'errand') { await clickMenu(B, 'Map'); }
      const dump = await B.ev(DUMP);
      // the map closes the others: check it alone, then reopen
      let c = compare(dump, { agent: m.key === 'errand' ? null : agent, show: st.show });
      if (m.key === 'errand') { if (SHOTS) tiles.push({ file: await shot(B, path.join(OUT, 'map.png')), label: `The paper map · ${m.label} · ${stamp(minute)}`, step: 'moments' });
        await clickMenu(B, 'Map'); await clickAgent(B, agent); await openPanels(B); const d2 = await B.ev(DUMP), c2 = compare(d2, { agent, show: st.show });
        c = { errors: [...c.errors, ...c2.errors], hooded: c2.hooded, rows: c.rows + c2.rows, values: c.values + c2.values }; }
      if (SHOTS) await shotsAt(B, m, minute, agent, tiles);
      // a hooded stand-in at the show: a real click on each one opens no dossier
      let standIns = null;
      if (st.show && c.hooded.length) {
        await B.ev('window.__recordUI.dossier.close()');
        const pos = await B.ev(`(window.__city.peds?.sim?.agents ?? []).filter(w => String(w.aid).startsWith('stage:') && w.p).map(w => [w.aid, w.p[0], w.p[1], w.p[2]]).slice(0, 8)`);
        let opened = 0;
        for (const [, x, y, z] of pos) { const sp = await B.ev(`(() => { const c = window.__city; c.controls.target.set(${x}, .6, ${z}); c.camera.position.set(${x + 6}, 8, ${z + 9}); c.controls.update?.(); c.camera.updateMatrixWorld(); const v = new c.THREE.Vector3(${x}, ${y} + 0.9, ${z}).project(c.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; })()`);
          await sleep(250); for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: sp.x, y: sp.y, button: 'left', clickCount: 1 }); await sleep(200);
          const cur = await B.ev('window.__recordUI.dossier.current'); if (cur) { opened++; c.errors.push({ property: 'hooded name', panel: 'city', what: 'a click on a hooded stand-in opened a dossier', agent: cur }); await B.ev('window.__recordUI.dossier.close()'); } }
        standIns = { clicked: pos.length, opened };
        await clickAgent(B, agent);
      }
      const rec = { moment: m.key, label: m.label, minute, frame: dump.frame, agent, hooded: c.hooded.length, standIns, values: c.values, rows: c.rows, errors: c.errors.slice(0, 12), nErrors: c.errors.length };
      result.moments.push(rec);
      console.log(`  ${m.key} @${minute} frame ${dump.frame} · ${agent ?? '-'} · ${c.values} values, ${c.rows} rows · hooded ${c.hooded.length}${standIns ? ` (stand-ins clicked ${standIns.clicked}, opened ${standIns.opened})` : ''} · ${c.errors.length ? 'FAIL ' + JSON.stringify(c.errors.slice(0, 3)) : 'ok'}`);
      if (m.key === 'show') { showDump = dump; show = st.show; }
    }
    const failed = result.moments.filter(r => r.nErrors);
    step('moments', !failed.length, { checked: result.moments.length, values: result.moments.reduce((n, r) => n + r.values, 0), rows: result.moments.reduce((n, r) => n + r.rows, 0), failed: failed.map(r => ({ moment: r.moment, errors: r.errors.slice(0, 4) })) });
    await controls(B, list.find(m => m.key === 'show'), step, result);
    await layout(B, step);
    network(B, step);
    await frameTimes(B, step, result);
  } catch (e) { result.error = String(e.message || e); if (!e.step) console.log('FAIL ' + result.error + '\n' + e.stack); }
  finally {
    result.pageErrors = B.errors.slice(0, 5);
    const passed = n => result.steps.find(s => s.name === n)?.ok;
    const shown = tiles.map(s => ({ file: s.file, label: `${s.label} · ${s.step} ${passed(s.step) ? 'PASS' : 'FAIL'}` })), sheets = [];
    for (let k = 0; k < shown.length; k += 4) { const sheet = path.join(OUT, `sheet-${k / 4 + 1}.jpg`), py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(shown.slice(k, k + 4))], { encoding: 'utf8' });
      if (py.status) console.log('sheet: ' + py.stderr); else sheets.push(sheet); }
    result.shots = shown; result.sheets = sheets;
    await fs.writeFile(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
    await B.close(); server?.kill();
    const ok = !result.error && result.steps.length >= 5 && result.steps.every(s => s.ok);
    console.log(`${ok ? 'PANELSCENARIO PASS' : 'PANELSCENARIO FAIL'} · seed ${SEED} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
    process.exitCode = ok ? 0 : 1;
  }

  // ── 2 · controls: each property's violation, planted in the page, must be caught; then removed (the panels re-render)
  async function controls(B, m, step, result) {
    await goTo(B, m);
    const minute = await B.ev('window.__record.player.minute'), st = stateAt(minute), seen = st.s.events.find(e => e.type === 'show' && e.night === st.show.night)?.seen ?? {};
    const drawn = await B.ev(`[...window.__record.draw.agents.map].filter(([, a]) => a.w).map(([id]) => id)`);
    let agent = null;
    for (const id of [...m.prefer, ...drawn].filter(id => drawn.includes(id) && Object.hasOwn(seen, id)).slice(0, 6)) if ((agent = await clickAgent(B, id)) === id) break; else agent = null;
    if (!agent) throw new Error('controls: no agent could be clicked');
    await openPanels(B);
    const clean = compare(await B.ev(DUMP), { agent, show: st.show });
    const hooded = clean.hooded[0], board = st.s.board, named = id => `${board.agents.find(a => a.id === id)?.name} (@${id})`;
    const later = newsAt(stateAt(frames.find(f => f.minute > minute + 60).minute).s).live.at(-1);
    const nullKey = ['bail', 'walk'].find(k => !has(panelsAt(st.s, agent, minute).card[k]));
    const PLANTS = {
      'later frame': `(() => { const t = document.querySelector('#r-ticker [data-row="news.live"]'); const c = t.cloneNode(true); c.dataset.ev = '${later.id}'; c.querySelector('[data-words]').textContent = ${JSON.stringify(later.text)}; t.before(c); })()`,
      'hooded name': hooded ? `(() => { const r = document.querySelector('#r-ticker [data-row="news.live"]'); r.dataset.ev = '${st.s.events.find(e => e.type === 'show' && e.night === st.show.night).id}'; r.dataset.type = 'show'; const w = r.querySelector('[data-words]'); const s = document.createElement('span'); s.dataset.path = 'leader'; s.dataset.ev = r.dataset.ev; s.textContent = ${JSON.stringify(named(hooded))}; w.append(' led by ', s); })()` : null,
      'drug live': `(() => { const r = document.querySelector('#r-ticker [data-row="news.live"]'); const w = r.querySelector('[data-words]'); const s = document.createElement('span'); s.dataset.path = 'drug'; s.dataset.ev = r.dataset.ev; s.textContent = 'temp'; w.append(' on ', s); })()`,
      'badge': `(() => { document.querySelector('[data-scope="record"] [data-badge="record"]').remove(); })()`,
      'no source': nullKey ? `(() => { const s = document.querySelector('#r-dossier [data-k="card.heat"]').closest('.r-stat'); const c = s.cloneNode(true); c.querySelector('[data-k]').dataset.k = 'card.${nullKey}'; c.querySelector('[data-k]').textContent = '${nullKey === 'bail' ? '$0' : '0'}'; s.after(c); })()` : null,
      'value': `(() => { const n = document.querySelector('#r-people [data-k="heat"]'); n.textContent = String(+n.textContent + 1); })()`,
    };
    const caught = {};
    for (const [property, js] of Object.entries(PLANTS)) {
      if (!js) { caught[property] = 'no site in this seed'; continue; }
      await B.ev(js);
      const c = compare(await B.ev(DUMP), { agent, show: st.show });
      caught[property] = c.errors.some(e => e.property === property);
      // removed: every panel re-renders from the record
      await B.ev(`(() => { const U = window.__recordUI; U.dossier.update(true); U.people.update(true); U.ticker.update(true); U.ch9.update(true); })()`);
    }
    const after = compare(await B.ev(DUMP), { agent, show: st.show });
    // a private file asked for: the network rule catches it (the plant's request is then set aside from step 4)
    await B.ev(`fetch('/core/runs/${SEED}-A/events.jsonl?plant=1').then(r => r.status).catch(() => 0)`, true);
    await sleep(300);
    caught.request = badRequests(B.requests).some(r => r.url.includes('plant=1'));
    // the overlap rule catches a CH 9 as wide as the screen
    await B.ev(`document.getElementById('r-ch9').style.width = '100vw'`);
    caught.overlap = overlaps(await B.ev(RECTS)).length > 0;
    await B.ev(`document.getElementById('r-ch9').style.width = ''`);
    const missed = Object.entries(caught).filter(([, v]) => v === false).map(([k]) => k);
    step('controls', !clean.errors.length && !after.errors.length && !missed.length, { minute, caught, cleanBefore: clean.errors.length, cleanAfter: after.errors.length });
  }
}

function badRequests(requests) {
  return requests.filter(r => {
    if (r.url.startsWith('data:') || r.url.startsWith('blob:')) return false;
    if (r.url.startsWith(THREE_CDN) && r.method === 'GET') return false;
    const u = new URL(r.url);
    if (u.origin !== BASE || r.method !== 'GET') return true;
    if (u.pathname.startsWith('/core/')) return u.pathname !== FEED;
    return /^\/(state|tape|events|api|__bake)\b/.test(u.pathname) || u.search.includes('since=');
  });
}
function network(B, step) {
  const bad = badRequests(B.requests).filter(r => !r.url.includes('plant=1'));
  step('network', bad.length === 0, { requests: B.requests.length, fromWorkers: B.requests.filter(r => r.from === 'worker').length, feedLoads: B.requests.filter(r => r.url.endsWith(FEED)).length,
    cdn: B.requests.filter(r => r.url.startsWith(THREE_CDN)).length, fonts: B.requests.filter(r => /fonts\.(googleapis|gstatic)/.test(r.url)).length, bad: bad.slice(0, 8) });
}
async function layout(B, step) {
  const sizes = [[1280, 720], [1440, 900], [1920, 1080]], out = [], agent = await B.ev('window.__recordUI.dossier.current');
  for (const [width, height] of sizes) {
    await B.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await sleep(600);
    if (!(await isOpen(B, 'dossier'))) throw new Error('layout needs the dossier open');
    await openPanels(B); await sleep(300);
    const all = await B.ev(RECTS), a = overlaps(all);
    await clickMenu(B, 'Map'); await sleep(500);
    const mapRects = await B.ev(RECTS), b = overlaps(mapRects);
    await clickMenu(B, 'Map'); if (!(await clickAgent(B, agent))) await B.ev(`window.__recordUI.dossier.open(${JSON.stringify(agent)})`);
    out.push({ size: `${width}×${height}`, panels: Object.keys(all), overlaps: a, map: Object.keys(mapRects), mapOverlaps: b });
  }
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  step('layout', out.every(o => !o.overlaps.length && !o.mapOverlaps.length && o.panels.length >= 6 && o.map.includes('r-map')), { sizes: out });
}
async function frameTimes(B, step, result) {
  const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`, true, 30000);
  const view = 'cam=108,24,-236&look=88,0.6,-262&tod=night&simtod=0';
  const night2 = createShowPlayer(frames).shows().find(s => s.night === 2);
  const runs = [];
  for (let k = 0; k < 2; k++) {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordAt=${night2.minute - 20}&recordSpeed=60&panels=people,ch9&dossier=a01&${view}` });
    await ready(B); await uiReady(B); await sleep(5000);
    const open = await B.ev(`(() => { const U = window.__recordUI; return { dossier: U.dossier.current, people: U.people.isOpen, ch9: U.ch9.isOpen, ticker: U.ticker.on }; })()`);
    const rec = await measure();
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}` });
    for (let t = 0; t < 240 && !(await B.ev('document.title', false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
    await sleep(5000);
    const none = await measure();
    runs.push({ record: rec, noSim: none, open });
  }
  result.frames = runs;
  step('frames', true, { runs, bar: 16.8 });
}
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 540, 12, 44
cols = 2 if len(tiles) > 1 else 1; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * (th + bar) + (rows + 1) * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
