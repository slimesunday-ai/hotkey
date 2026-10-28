// C1-10, the drawn half · THE BOARD, THE MORNING CARDS AND THE POLICE LEVELS, WATCHED: panelscenario's counterpart for C1-10. One
// headless-Chrome run of a seed's recorded season (?sim=record), driven with real input: the record player's minute box, the menu's
// Board and Cards buttons, the board's tabs, a card's Replay button.
//   node style/city/tools/boardscenario.mjs --port 5970 [--seed 404] [--out <dir>] [--no-shots]
// Steps; the first that fails stops the run:
//   1 moments   at a dawn with cards (a night with a Booked card when the seed has one), a dawn with a masked card (if any), mid-day, the show (the night's board held), its
//               close (C1-6's plan.end) and the next dawn: seek with the minute box, open the Board and walk its four tabs, open the
//               Cards. Every value the board and the cards show ([data-k], printed through ui/record/board-format.js) must equal
//               board-data.js's boardAt / cards.js's cardsAt for the same presented snapshot at that minute (computed here, in node, on a
//               fresh show player seeked there), every value with a source must be shown, the cards must be cardsAt's in rank order, a
//               card's faces only its typed subjects (a masked Took's subject never), a bounty only its allowed fields (never a poster),
//               no drug's name, and the 3D police signs boardAt's police and tonight, verbatim.
//   2 replay    press a card's Replay with a real click: a card with a scene of its own lands the player inside that scene (the show
//               plan's scene whose event is replay.eventId); one without lands on its night's show.
//   2b arrival  played across 06:00 at 60×, the new morning's cards open by themselves; a fresh load at that dawn leaves them closed.
//   3 controls  each property's violation planted in the page (DOM injections, a sign set wrong, one private-file request, a wide
//               panel) must be caught; each plant is removed again (the panels re-render) before the next.
//   4 layout    at 1280×720, 1440×900 and 1920×1080: People, the Board, the Cards, the ticker, the menu and the player's controls overlap
//               nowhere; a click on an agent closes the Board (the dossier takes the dock) and CH 9 closes the Cards (real input).
//   5 network   every request the page and its workers made: only GETs of this server's static files and the feed (recordscenario's rule).
//   6 frames    frame time p95 with the board and the cards open, the record playing at 60×, against the same view with no sim (reported;
//               two runs back to back).
//   7 shots     the board by day, the board during the show (held), the morning cards, a Replay landing, the police levels on the map by
//               day and at night: 2×2 sheets, each tile labelled with its moment and its step's pass/fail.
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, typeMinute, serve } from './recordscenario.mjs';
import { parseFeed } from '../simstate/record/adapter.js';
import { createShowPlayer, createShowPlanner } from '../simstate/record/show-plan.js';
import { boardAt } from '../simstate/record/board-data.js';
import { cardsAt } from '../simstate/record/cards.js';
import { CITY_PLACES } from '../simstate/record/places.js';
import { bfmt } from '../ui/record/board-format.js';
import { at, DRUGS } from '../ui/record/format.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), SEED = +arg('seed', 404), SHOTS = !process.argv.includes('--no-shots');
const OUT = path.resolve(arg('out', path.join(ROOT, `style/city/shots/c1-10/${SEED}`)));
const BASE = `http://127.0.0.1:${PORT}`, FEED = `/core/runs/${SEED}-A/feed.jsonl`;
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DRUG_RE = new RegExp(`\\b(${DRUGS.join('|')})\\b`, 'i');
const TABS = ['b-street', 'b-list', 'b-fits', 'b-vault'];
const BOUNTY_KEYS = new Set(['bounty', 'copy', 'trait', 'slot', 'tier', 'agent', 'amount']);

// ── the record, in node: the presented snapshot at a minute is a fresh show player seeked there, the scene plan stripped (record/page.js)
const frames = parseFeed(fss.existsSync(path.join(ROOT, FEED.slice(1))) ? fss.readFileSync(path.join(ROOT, FEED.slice(1)), 'utf8') : (() => {
  const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(SEED), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr); return fss.readFileSync(path.join(ROOT, FEED.slice(1)), 'utf8'); })());
const planner = createShowPlanner(frames);
function stateAt(minute) { const { show, ...s } = createShowPlayer(frames).seek(minute); return { s, show }; }

// the moments: the first dawn whose cards include a Booked one (a card with a scene of its own) and at least 4 cards, else the first
// dawn with cards; mid-day; that day's show and its close; the next dawn
function moments() {
  const dawnOf = d => frames.find(f => f.step.kind === 'dawn' && f.day === d)?.minute;
  const nights = frames.filter(f => f.step.kind === 'night').map(f => f.day);
  const cardsOf = n => { const m = dawnOf(n + 1); return m == null ? [] : cardsAt(stateAt(m + 1).s, undefined, m + 1); };
  const pick = nights.find(n => { const c = cardsOf(n); return c.length >= 4 && c.some(x => x.kind === 'Booked'); }) ?? nights.find(n => cardsOf(n).length);
  const day = pick + 1, plan = planner.night(day), mShow = plan.start + Math.min(4, (plan.end - plan.start) / 2);
  // (and the first dawn with a masked card, when the seed has one: its picture must show the ski mask and name no one)
  const masked = nights.find(n => cardsOf(n).some(c => c.masked));
  return [...(masked != null ? [{ key: 'masked', label: `Day ${masked + 1} dawn (a masked card)`, minute: dawnOf(masked + 1) + 1, tod: 'day' }] : []),
    { key: 'dawn', label: `Day ${day} dawn (night ${pick}'s cards)`, minute: dawnOf(day) + 1, tod: 'day' },
    { key: 'midday', label: `Day ${day} mid-day`, minute: day * 1440 + 720, tod: 'day' },
    { key: 'show', label: `Night ${day} show (held)`, minute: +mShow.toFixed(2), tod: 'night' },
    { key: 'close', label: `Night ${day} close (plan.end ${plan.end})`, minute: plan.end + 0.5, tod: 'night' },
    { key: 'nextdawn', label: `Day ${day + 1} dawn`, minute: dawnOf(day + 1) + 1, tod: 'day' },
  ];
}

// ── the page's DOM, as data
const DUMP = `(() => {
  const vis = n => !!n && !n.hidden && n.getAttribute('aria-hidden') !== 'true' && getComputedStyle(n).display !== 'none';
  const U = window.__recordUI, R = window.__record, b = document.getElementById('r-board'), c = document.getElementById('r-cards');
  const ks = box => [...box.querySelectorAll('[data-k]')].map(n => ({ k: n.dataset.k, text: n.textContent, card: n.closest('[data-row=cards]')?.dataset.i ?? null, row: n.closest('[data-row]')?.dataset.row ?? null }));
  const names = box => [...box.querySelectorAll('[data-name]')].map(n => [n.dataset.name, n.textContent]);
  return { minute: R.player.minute, frame: U.sim.record().frame?.i ?? null, held: U.sim.record().reveal?.end > R.player.minute ? U.sim.record().reveal.end : null,
    board: vis(b) ? { tab: U.board.tab, ks: ks(b), names: names(b), text: b.textContent } : null,
    cards: vis(c) ? { list: [...c.querySelectorAll('[data-row=cards]')].map(n => ({ i: +n.dataset.i, ev: +n.dataset.ev, kind: n.dataset.kind,
      faces: [...n.querySelectorAll('figure[data-agent]')].map(f => f.dataset.agent), masks: n.querySelectorAll('figure.is-masked').length })), ks: ks(c), names: names(c), text: c.textContent } : null,
    police: U.police.stats().shown };
})()`;

// ── the comparison: the DOM against boardAt / cardsAt at the same minute
const keyOf = p => /^(police|tonight)\./.test(p) ? 'level' : /\.others\.\d+$/.test(p) ? 'agent' : p.split('.').at(-1);
// every value with a source that a tab (or the header, or the cards) must show
function required(B, C, tab) {
  const out = [], need = (p, v) => { if (v !== null && v !== undefined && v !== false) out.push(p); };
  if (tab === 'header') { need('countdowns.lock.minutes', B.countdowns.lock?.minutes); need('countdowns.ferry.nightsLeft', B.countdowns.ferry.nightsLeft); need('nextShipment.night', B.nextShipment?.night); }
  if (tab === 'b-street') {
    for (const d of Object.keys(B.police ?? {})) need(`police.${d}`, B.police[d]);
    for (const d of Object.keys(B.tonight ?? {})) need(`tonight.${d}`, B.tonight[d]);
    B.wanted.forEach((w, i) => ['agent', 'heat', 'wanted'].forEach(k => need(`wanted.${i}.${k}`, w[k])));
    B.bounties.forEach((b, i) => ['agent', 'trait', 'amount'].forEach(k => need(`bounties.${i}.${k}`, b[k])));
    B.corners.forEach((c, i) => ['corner', 'place', 'holder', 'hot'].forEach(k => need(`corners.${i}.${k}`, c[k])));
  }
  if (tab === 'b-list') {
    B.list.forEach((t, i) => ['name', 'slot', 'tier', 'ability', 'opens', 'price', 'floor', 'last', 'left'].forEach(k => need(`list.${i}.${k}`, t[k])));
    B.grails.forEach((g, i) => { ['name', 'price', 'left'].forEach(k => need(`grails.${i}.${k}`, g[k]));
      g.wearers.forEach((w, j) => need(`grails.${i}.wearers.${j}.agent`, w.agent)); g.buyers.forEach((x, j) => ['agent', 'price'].forEach(k => need(`grails.${i}.buyers.${j}.${k}`, x[k]))); });
    B.sales.forEach((x, i) => ['night', 'agent', 'trait', 'price'].forEach(k => need(`sales.${i}.${k}`, x[k])));
  }
  if (tab === 'b-fits') B.fits.forEach((f, i) => { need(`fits.${i}.agent`, f.agent); need(f.fitHidden ? `fits.${i}.fitHidden` : `fits.${i}.fit`, f.fitHidden || f.fit); });
  if (tab === 'b-vault') { if (B.vault) { need('vault.cash', B.vault.cash); B.vault.pieces.forEach((p, i) => need(`vault.pieces.${i}.trait`, p.trait)); }
    if (B.crate) { need('crate.cash', B.crate.cash); need('crate.goods', B.crate.goods); } }
  if (tab === 'cards') C.forEach((c, i) => { need(`cards.${i}.kind`, c.kind); need(`cards.${i}.subjects.agent`, c.subjects.agent); c.subjects.others.forEach((o, j) => need(`cards.${i}.subjects.others.${j}`, o));
    c.pieces.forEach((p, j) => need(`cards.${i}.pieces.${j}.trait`, p.trait)); need(`cards.${i}.value`, c.value); });
  return out;
}
function compare(dumps, minute) {
  const errors = [], err = (property, detail) => errors.push({ property, ...detail });
  const { s } = stateAt(minute), B = boardAt(s, minute), C = cardsAt(s, undefined, minute), CB = { cards: C };
  const name = id => s.board?.agents?.find(a => a.id === id)?.name;
  let values = 0;
  for (const d of dumps) {
    if (d.frame !== (s.frame?.i ?? null)) err('later frame', { what: 'presented frame', page: d.frame, record: s.frame?.i ?? null });
    const panel = d.board ? 'board' : 'cards', box = d.board ?? d.cards; if (!box) continue;
    const src = panel === 'cards' ? CB : B;
    for (const x of box.ks) {
      values++;
      if (/^bounties\.\d+\.[^.]+$/.test(x.k) && !BOUNTY_KEYS.has(x.k.split('.').at(-1))) { err('bounty poster', { k: x.k, shown: x.text }); continue; }
      const want = bfmt(keyOf(x.k), at(src, x.k), B);
      if (want === null) err('no source', { panel, k: x.k, shown: x.text });
      else if (want !== x.text) err('value', { panel, k: x.k, shown: x.text, want });
    }
    for (const [id, text] of box.names) if (name(id) !== text) err('value', { panel, what: 'name', agent: id, shown: text, want: name(id) });
    const shown = new Set(box.ks.map(x => x.k));
    const tabs = panel === 'cards' ? ['cards'] : ['header', d.board.tab];
    for (const t of tabs) for (const p of required(B, C, t)) if (!shown.has(p)) err('missing', { panel, tab: t, k: p });
    if (DRUG_RE.test(box.text)) err('drug live', { panel, text: box.text.match(DRUG_RE)[0] });
    if (panel === 'cards') {
      const ids = d.cards.list.map(c => c.ev), want = C.map(c => c.source.eventId);
      if (JSON.stringify(ids) !== JSON.stringify(want)) err('later frame', { panel, what: 'cards are not cardsAt\'s', shown: ids, want });
      for (const c of d.cards.list) { const w = C.find(x => x.source.eventId === c.ev); if (!w) continue;
        const faces = [w.subjects.agent, ...w.subjects.others].filter(Boolean);
        if (JSON.stringify(c.faces) !== JSON.stringify(faces)) err('card picture', { ev: c.ev, shown: c.faces, want: faces });
        if (w.masked && c.masks !== 1) err('card picture', { ev: c.ev, what: 'a masked card without its ski mask' });
        if (c.kind !== w.kind) err('value', { panel, ev: c.ev, what: 'kind', shown: c.kind, want: w.kind }); }
    }
  }
  // the 3D signs: the board's police and tonight, verbatim, per district
  const signs = dumps[0]?.police ?? {};
  const wantSigns = Object.fromEntries(Object.entries(B.police ?? {}).map(([k, v]) => [k, { level: v, tonight: B.tonight ? B.tonight[k] ?? null : null }]));
  if (JSON.stringify(signs) !== JSON.stringify(wantSigns)) err('police 3d', { shown: signs, want: wantSigns });
  return { errors, values, B, C, s };
}

// ── the page
async function uiReady(B, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await B.ev('!!window.__recordUI?.board && !!window.__record?.draw', false).catch(() => false)) return; await sleep(200); }
  throw new Error('the record UI did not mount');
}
async function goTo(B, m, extra = '') {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=${m.tod}&recordAt=${m.minute - 0.5}${extra}` });
  await ready(B); await uiReady(B);
  await typeMinute(B, m.minute); await ready(B); await uiReady(B);
}
const press = async (B, p) => { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await B.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(250); };
const centre = (B, js) => B.ev(`(() => { const n = ${js}; if (!n) return null; n.scrollIntoView?.({ block: 'nearest' }); const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
async function clickSel(B, js) { const p = await centre(B, js); if (!p) throw new Error('nothing to click: ' + js); await press(B, p); }
const clickMenu = (B, label) => clickSel(B, `[...document.querySelectorAll('#r-menu button')].find(b => b.textContent.startsWith(${JSON.stringify(label)}))`);
const isOpen = (B, what) => B.ev(`window.__recordUI.${what}.isOpen`);
async function openBoard(B) { if (!(await isOpen(B, 'board'))) await clickMenu(B, 'Board'); if (!(await isOpen(B, 'board'))) throw new Error('the Board button did not open the board'); }
async function openCards(B) { if (!(await isOpen(B, 'cards'))) await clickMenu(B, 'Cards'); if (!(await isOpen(B, 'cards'))) throw new Error('the Cards button did not open the cards'); }
async function tab(B, id) { await clickSel(B, `document.getElementById('k-tab-${id}')`); if (await B.ev('window.__recordUI.board.tab') !== id) throw new Error('the tab did not open: ' + id); }
// every tab of the board, then the cards: one dump each
async function dumpAll(B) {
  const out = [];
  await openBoard(B);
  for (const id of TABS) { await tab(B, id); out.push(await B.ev(DUMP)); }
  await openCards(B);
  const d = await B.ev(DUMP); out.push({ ...d, board: null });
  return out;
}
const stamp = m => `day ${Math.floor(m / 1440)} ${String(Math.floor(m % 1440 / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
async function shot(B, file, clip = null) { const r = await B.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
const RECTS = `(() => { const out = {}; const vis = n => !!n && !n.hidden && n.getAttribute('aria-hidden') !== 'true' && getComputedStyle(n).visibility !== 'hidden' && getComputedStyle(n).display !== 'none';
  for (const id of ['r-board', 'r-cards', 'r-dossier', 'r-people', 'r-ch9', 'r-ticker', 'r-menu', 'r-map', 'record-player']) { const n = document.getElementById(id); if (!vis(n)) continue; const b = n.getBoundingClientRect(); if (b.width && b.height) out[id] = [b.left, b.top, b.right, b.bottom]; }
  return out; })()`;
function overlaps(rects) {
  const ids = Object.keys(rects), bad = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = rects[ids[i]], b = rects[ids[j]];
    const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (w > .5 && h > .5) bad.push([ids[i], ids[j], Math.round(w), Math.round(h)]); }
  return bad;
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

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/boardscenario.mjs --port <port> [--seed 404]'); process.exit(2); }
  await fs.mkdir(OUT, { recursive: true });
  const server = await serve(), B = await chrome(), result = { seed: SEED, steps: [], moments: [] }, tiles = [];
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail).slice(0, 1500) : ''}`); if (!ok) throw Object.assign(new Error(name + ' failed'), { step: true }); };
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const list = moments();
  try {
    // 1 · the moments
    for (const m of list) {
      await goTo(B, m);
      const dumps = await dumpAll(B), minute = dumps[0].minute;
      if (dumps.some(d => d.minute !== minute)) throw new Error('the playhead moved while paused');
      const c = compare(dumps, minute);
      // the show: the night's board is held until plan.end (the presented frame is not the night's frame)
      let held = null;
      // (STORE.md: .frame advances at 21:05, .board stays the previous frame's until plan.end; the board shown is boardAt's, compared above)
      if (m.key === 'show') { const night = frames.find(f => f.step.kind === 'night' && f.day === Math.floor(minute / 1440));
        const before = frames.slice(0, night.i).findLast(f => f.board !== undefined).board, differs = JSON.stringify(night.board) !== JSON.stringify(before);
        held = { nightFrame: night.i, until: dumps[0].held, nightBoardDiffers: differs, presentedIsBefore: JSON.stringify(c.s.board) === JSON.stringify(before) };
        if (!held.presentedIsBefore || !dumps[0].held) c.errors.push({ property: 'later frame', what: 'the night\'s board is not held during the show', ...held }); }
      if (SHOTS && m.key === 'midday') { await tab(B, 'b-street'); await B.ev('window.__recordUI.cards.close()');
        tiles.push({ file: await shot(B, path.join(OUT, 'board-day.png')), label: `The board by day · ${m.label} · ${stamp(minute)}`, step: 'moments' }); }
      if (SHOTS && m.key === 'show') { await B.ev('window.__recordUI.cards.close()'); await tab(B, 'b-list');
        tiles.push({ file: await shot(B, path.join(OUT, 'board-show.png')), label: `The board during the show, held · ${m.label} · ${stamp(minute)}`, step: 'moments' }); }
      if (SHOTS && m.key === 'masked') { await B.ev('window.__recordUI.board.close()'); await sleep(800);
        tiles.push({ file: await shot(B, path.join(OUT, 'cards-masked.png')), label: `A masked card · ${m.label} · ${stamp(minute)}`, step: 'moments' }); }
      if (SHOTS && m.key === 'dawn') { await B.ev('window.__recordUI.board.close()'); await sleep(800);
        tiles.push({ file: await shot(B, path.join(OUT, 'cards.png')), label: `The morning cards · ${m.label} · ${stamp(minute)}`, step: 'moments' }); }
      const rec = { moment: m.key, label: m.label, minute, frame: dumps[0].frame, values: c.values, cards: c.C.length, held, errors: c.errors.slice(0, 12), nErrors: c.errors.length };
      result.moments.push(rec);
      console.log(`  ${m.key} @${minute} frame ${dumps[0].frame} · ${c.values} values · ${c.C.length} cards${held ? ` · board held until ${held.until} (night frame ${held.nightFrame}'s board differs: ${held.nightBoardDiffers})` : ''} · ${c.errors.length ? 'FAIL ' + JSON.stringify(c.errors.slice(0, 3)) : 'ok'}`);
    }
    const failed = result.moments.filter(r => r.nErrors);
    step('moments', !failed.length, { checked: result.moments.length, values: result.moments.reduce((n, r) => n + r.values, 0), failed: failed.map(r => ({ moment: r.moment, errors: r.errors.slice(0, 4) })) });
    await replay(B, step, result, tiles);
    await arrival(B, step);
    await controls(B, step, result);
    await layout(B, step);
    network(B, step);
    await frameTimes(B, step, result);
    if (SHOTS) await policeShots(B, tiles);
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
    const ok = !result.error && result.steps.length >= 7 && result.steps.every(s => s.ok);
    console.log(`${ok ? 'BOARDSCENARIO PASS' : 'BOARDSCENARIO FAIL'} · seed ${SEED} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
    process.exitCode = ok ? 0 : 1;
  }

  // ── 2 · replay: a real click on a card's Replay
  async function replay(B, step, result, tiles) {
    const m = list.find(x => x.key === 'dawn'), out = [];
    const C = cardsAt(stateAt(m.minute).s, undefined, m.minute);
    const withScene = C.find(c => planner.night(c.replay.night).scenes.some(s => s.eventId === c.replay.eventId));
    const without = C.find(c => !planner.night(c.replay.night).scenes.some(s => s.eventId === c.replay.eventId));
    for (const c of [withScene, without].filter(Boolean)) {
      await goTo(B, m); await openCards(B);
      const plan = planner.night(c.replay.night), scene = plan.scenes.find(s => s.eventId === c.replay.eventId) ?? null;
      await clickSel(B, `document.querySelector('#r-cards [data-row=cards][data-ev="${c.source.eventId}"] .m-replay')`);
      // (the seek crosses into the night: the page reloads at the new playhead)
      for (let t = 0; t < 40 && (await B.ev(`new URLSearchParams(location.search).get('tod')`, false).catch(() => null)) !== 'night'; t++) await sleep(250);
      await sleep(500); await ready(B); await uiReady(B); await sleep(500);
      const page = await B.ev(`(() => { const R = window.__record, sh = R.player.snapshot().show, t = window.__city.controls.target; return { minute: R.player.minute, running: R.player.running, tod: new URLSearchParams(location.search).get('tod'), target: [t.x, t.z], active: sh ? sh.active.map(a => ({ id: a.id, eventId: a.eventId })) : [] }; })()`);
      // (a scene's own card also brings the camera's target to the scene's place)
      const place = scene && CITY_PLACES[scene.place.cityPlace], off = place ? +Math.hypot(page.target[0] - place.x, page.target[1] - place.z).toFixed(2) : null;
      // a scene's own card lands inside its scene; a card without one on its night's show (start .. a minute in, at live pace)
      const ok = scene ? page.minute >= scene.start && page.minute < scene.end && page.active.some(a => a.id === scene.id)
        && off < 1 : page.minute >= plan.start && page.minute < plan.start + 1;
      out.push({ ev: c.source.eventId, kind: c.kind, scene: scene?.id ?? null, sceneAt: scene ? [scene.start, scene.end] : null, showStart: plan.start, landed: page.minute, playing: page.running, cameraOff: off, ok });
      if (SHOTS && scene) { await B.ev(`(() => { const U = window.__recordUI; U.board.close(); U.cards.close(); })()`); await sleep(1200);
        tiles.push({ file: await shot(B, path.join(OUT, 'replay.png')), label: `Replay landing: ${c.kind} card ${c.source.eventId} → ${scene.id} · ${stamp(page.minute)}`, step: 'replay' }); }
    }
    step('replay', out.length > 0 && out.every(o => o.ok) && out.some(o => o.scene), { presses: out });
  }

  // ── 2b · the cards arrive: played across 06:00 at 60× (the page reloads into the day), they open by themselves on the new morning;
  // a fresh load (or a seek) never opens them
  async function arrival(B, step) {
    const m = list.find(x => x.key === 'dawn'), want = cardsAt(stateAt(m.minute).s, undefined, m.minute)[0]?.night ?? null;
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&tod=night&recordAt=${m.minute - 4}&recordSpeed=60` });
    await ready(B); await uiReady(B);
    const before = await B.ev(`({ open: window.__recordUI.cards.isOpen, minute: window.__record.player.minute })`);
    for (let t = 0; t < 120 && (await B.ev(`new URLSearchParams(location.search).get('tod')`, false).catch(() => null)) !== 'day'; t++) await sleep(250);
    await sleep(500); await ready(B); await uiReady(B); await sleep(800);
    const after = await B.ev(`({ open: window.__recordUI.cards.isOpen, night: window.__recordUI.cards.night, minute: window.__record.player.minute })`);
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=day&recordAt=${m.minute}` });
    await ready(B); await uiReady(B); await sleep(500);
    const fresh = await B.ev(`window.__recordUI.cards.isOpen`);
    step('arrival', !before.open && after.open && after.night === want && !fresh, { before, after, want, freshLoadOpens: fresh });
  }

  // ── 3 · controls: each property's violation, planted in the page, must be caught; then removed (the panels re-render)
  async function controls(B, step, result) {
    const m = list.find(x => x.key === 'dawn'); await goTo(B, m);
    const minute = await B.ev('window.__record.player.minute');
    // (a card from a later morning: the first dawn after this one with cards)
    const later = frames.filter(f => f.step.kind === 'dawn' && f.minute > minute).map(f => cardsAt(stateAt(f.minute + 1).s)).find(c => c.length) ?? [];
    const clean = compare(await dumpAll(B), minute);
    const rerender = `(() => { const U = window.__recordUI; U.board.update(true); U.cards.update(true); const s = U.sim.record(); return true; })()`;
    const PLANTS = {
      'value': { tab: 'b-street', js: `(() => { const n = document.querySelector('#r-board [data-k="police.downtown"]'); n.textContent = n.textContent === 'HEAVY' ? 'NORMAL' : 'HEAVY'; })()` },
      'no source': { tab: 'b-list', js: `(() => { const n = document.querySelector('#r-board [data-k="list.0.price"]'); const c = n.cloneNode(true); c.dataset.k = 'list.0.predicted'; c.textContent = '$1'; n.after(c); })()` },
      'missing': { tab: 'b-list', js: `(() => { document.querySelector('#r-board [data-k="list.0.left"]').remove(); })()` },
      'bounty poster': { tab: 'b-street', js: `(() => { const s = document.querySelector('#r-board [data-sec="Bounties"]'); const li = document.createElement('li'); li.dataset.row = 'bounties'; const b = document.createElement('b'); b.dataset.k = 'bounties.0.from'; b.textContent = '@a01'; li.append('posted by ', b); s.append(li); })()` },
      'drug live': { tab: 'b-vault', js: `(() => { document.querySelector('#r-board [data-sec="The crate"]').append(' sudo 4'); })()` },
      'later frame': { tab: null, js: later.length ? `(() => { const n = document.querySelector('#r-cards [data-row=cards]'); const c = n.cloneNode(true); c.dataset.ev = '${later[0].source.eventId}'; n.parentNode.append(c); })()` : null },
      'card picture': { tab: null, js: `(() => { const f = document.querySelector('#r-cards [data-row=cards] figure[data-agent]'); const c = f.cloneNode(true); c.dataset.agent = 'zz-nobody'; f.after(c); })()` },
      'police 3d': { tab: null, js: `(() => { window.__recordUI.police.set({ downtown: 'normal' }, null); })()` },
    };
    const caught = {};
    for (const [property, p] of Object.entries(PLANTS)) {
      if (!p.js) { caught[property] = 'no site in this seed'; continue; }
      await openBoard(B); if (p.tab) await tab(B, p.tab);
      if (!p.tab) await openCards(B);
      await B.ev(p.js);
      const d = await B.ev(DUMP), dumps = p.tab ? [{ ...d, cards: null }] : [{ ...d, board: null }];
      const c = compare(dumps, minute);
      caught[property] = c.errors.some(e => e.property === property);
      await B.ev(rerender); await B.ev(`(() => { const U = window.__recordUI, s = U.sim.record(); U.police.set(null, null); return true; })()`);
      // (the signs come back from the store's next published change: ask for one)
      await B.ev(`(() => { const R = window.__record; R.player.seek(R.player.minute); return true; })()`); await sleep(400);
    }
    const after = compare(await dumpAll(B), minute);
    await B.ev(`fetch('/core/runs/${SEED}-A/events.jsonl?plant=1').then(r => r.status).catch(() => 0)`, true);
    await sleep(300);
    caught.request = badRequests(B.requests).some(r => r.url.includes('plant=1'));
    await openBoard(B); await openCards(B);
    await B.ev(`document.getElementById('r-cards').style.width = '100vw'`);
    caught.overlap = overlaps(await B.ev(RECTS)).length > 0;
    await B.ev(`document.getElementById('r-cards').style.width = ''`);
    const missed = Object.entries(caught).filter(([, v]) => v === false).map(([k]) => k);
    step('controls', !clean.errors.length && !after.errors.length && !missed.length, { minute, caught, cleanBefore: clean.errors.slice(0, 3), cleanAfter: after.errors.slice(0, 3) });
  }
}

// ── 4 · layout
async function layout(B, step) {
  const sizes = [[1280, 720], [1440, 900], [1920, 1080]], out = [];
  for (const [width, height] of sizes) {
    await B.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await sleep(600);
    if (!(await isOpen(B, 'people'))) await clickMenu(B, 'People');
    await openBoard(B); await openCards(B); await sleep(300);
    const all = await B.ev(RECTS), a = overlaps(all);
    // the dossier takes the board's dock (a People row opens it); CH 9 takes the cards' column
    await clickSel(B, `document.querySelector('#r-people [data-row=people]')`);
    const dossierTook = await B.ev(`!!window.__recordUI.dossier.current && !window.__recordUI.board.isOpen`);
    await clickMenu(B, 'CH 9');
    const ch9Took = await B.ev(`window.__recordUI.ch9.isOpen && !window.__recordUI.cards.isOpen`);
    const second = await B.ev(RECTS), b = overlaps(second);
    await B.ev(`(() => { const U = window.__recordUI; U.dossier.close(); U.ch9.close(); })()`);
    out.push({ size: `${width}×${height}`, panels: Object.keys(all), overlaps: a, dossierTakesDock: dossierTook, ch9TakesColumn: ch9Took, second: Object.keys(second), secondOverlaps: b });
  }
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  step('layout', out.every(o => !o.overlaps.length && !o.secondOverlaps.length && ['r-board', 'r-cards', 'r-people', 'r-ticker', 'r-menu', 'record-player'].every(k => o.panels.includes(k)) && o.dossierTakesDock && o.ch9TakesColumn), { sizes: out });
}
function network(B, step) {
  const bad = badRequests(B.requests).filter(r => !r.url.includes('plant=1'));
  step('network', bad.length === 0, { requests: B.requests.length, fromWorkers: B.requests.filter(r => r.from === 'worker').length, feedLoads: B.requests.filter(r => r.url.endsWith(FEED)).length,
    cdn: B.requests.filter(r => r.url.startsWith(THREE_CDN)).length, bad: bad.slice(0, 8) });
}
async function frameTimes(B, step, result) {
  const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`, true, 30000);
  const view = 'cam=108,24,-236&look=88,0.6,-262&tod=night&simtod=0';
  const night2 = createShowPlayer(frames).shows().find(s => s.night === 2);
  const runs = [];
  for (let k = 0; k < 2; k++) {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordAt=${night2.minute - 20}&recordSpeed=60&panels=board,cards&${view}` });
    await ready(B); await uiReady(B); await sleep(5000);
    const open = await B.ev(`(() => { const U = window.__recordUI; return { board: U.board.isOpen, cards: U.cards.isOpen, ticker: U.ticker.on }; })()`);
    const rec = await measure();
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}` });
    for (let t = 0; t < 240 && !(await B.ev('document.title', false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
    await sleep(5000);
    const none = await measure();
    runs.push({ record: rec, noSim: none, open });
  }
  result.frames = runs;
  step('frames', runs.every(r => r.open.board), { runs, bar: 16.8 });
}
// ── 7 · the police levels on the 3D map at the overview zoom, by day (mid-day) and at night (the show)
// (the overview view, then the same height over the south of the island: the overview frames its middle, downtown's and the strip's signs)
async function policeShots(B, tiles) {
  for (const [view, what] of [['view=overview', 'overview'], ['cam=-10,170,-40&look=20,0,-200', 'overview height, south']]) for (const key of ['midday', 'show']) {
    const m = list0().find(x => x.key === key);
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=${m.tod}&recordAt=${m.minute}&${view}&simtod=0` });
    await ready(B); await uiReady(B); await B.ev('window.__recordUI.cards.close()'); await sleep(2500);
    const st = await B.ev('window.__recordUI.police.stats()'), seen = Object.values(st.opacity).filter(a => a > .5).length;
    tiles.push({ file: await shot(B, path.join(OUT, `police-${m.tod}-${what.replace(' ', '-')}.png`)), label: `Police levels, ${what}, ${m.tod === 'day' ? 'by day' : 'at night'} · ${stamp(m.minute)} · ${Object.keys(st.shown).length} signs`, step: 'moments' });
  }
}
let MOMENTS = null; const list0 = () => MOMENTS ??= moments();
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 540, 12, 44
cols = 2 if len(tiles) > 1 else 1; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * (th + bar) + (rows + 1) * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 10), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
