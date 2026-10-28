// HUMAN LAYER · SECTION 3a · THE NEWS AND THE BOARDS' ANTI-CHEAT CHECK (node, no browser, no server). Over every game hour of a recorded
// run, the city's state is rebuilt (simstate/timeline.js), cut to the public view (simstate/lens.js publicOf, the store's own lens) and to
// the director's cut (directorOf, now − delay), and 3a's derivations are run on exactly what the page would hold:
//   news     newsOf (ui/city-info/feed.js) on the PUBLIC log: no private or secret event, no `think`, every story's text and names exactly
//            the public event's (no burglar, no unseen robber); yesterdayOf (City TV's "Yesterday, on tape") never past the horizon,
//            even when handed the whole run
//   boards   ladders, turf, economy, crime, dead (ui/city-info/board-data.js) on the LIVE input: no private field anywhere in the live
//            boards; Richest only from the director's cut (TAPE, as of ≤ the horizon; `pending` before the city is a day old); the
//            secret counts only from statsCut (≤ the horizon); the city's money (pool, tax) only from the cut; Most Wanted never by heat
// Self-tests first: a planted violation of each must be caught (else a clean result means nothing).
//   node style/city/ui/tools/infocheck.mjs [run] [--delay 1440] [--step 60]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTimeline } from '../../simstate/timeline.js';
import { publicOf, directorOf, publicEvent, cityEvents, leaks, SECRET_STATS } from '../../simstate/lens.js';
import { newsOf, yesterdayOf } from '../city-info/feed.js';
import { ladders, turf, economy, crime, dead, richest } from '../city-info/board-data.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const RUN = args.find((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--'))) || '2026-09-29T23-18-20-641Z-mixed', DELAY = +opt('delay', 1440), STEP = +opt('step', 60);
const SIM2 = process.env.SIM2 || path.join(os.homedir(), 'Desktop/deadnet/sim2'), DIR = path.join(SIM2, 'runs', RUN);
const EV = fs.readFileSync(path.join(DIR, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const SNAPS = fs.readFileSync(path.join(DIR, 'snapshots.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).sort((a, b) => a.t - b.t);
const places = JSON.parse(fs.readFileSync(path.join(SIM2, 'places.json'), 'utf8'));
const TL = createTimeline({ snaps: SNAPS, events: EV, places });
const fails = [], fail = (w, x) => { fails.n = (fails.n || 0) + 1; if (fails.length < 40) fails.push(`${w}: ${x}`); };

// what the page holds at minute `now`: the public log (the store's lens) and the LIVE board input, with the director's cut
function pageAt(now) {
  const evs = EV.filter(e => e.t <= now), full = TL.advance(now), cut = directorOf(SNAPS, EV, now, DELAY), hz = cut.pending ? null : cut.t;
  const pub = publicOf(full, { events: evs.slice(-150), news: evs.filter(e => e.news).slice(-30), cut: cut.pending ? null : cut, delay: DELAY });
  const log = cityEvents(evs.map(publicEvent).filter(Boolean));   // (the public log as /events serves it, under the city's rules)
  const lots = new Map((cut.lots || []).map(l => [l.id, l]));
  const C = cut.pending ? 'pending' : { lens: 'tape', asOf: cut.t, ts: cut.ts, rows: cut.agents.map(a => ({ handle: a.handle, cash: a.cash, stash: a.home ? lots.get(a.home)?.stash ?? null : null })), pool: cut.pool, money: cut.money };
  const city = { lens: 'live', t: now, agents: pub.agents, crews: pub.crews, loans: pub.loans, stats: pub.stats, statsCut: pub.statsCut, mostWanted: pub.mostWanted, cityEv: pub.cityEv, events: log,
    econ: { trend: pub.trend, drop: pub.drop, inSlot: pub.inSlot, corners: pub.corners }, cut: C };
  return { now, evs, log, city, hz, cut };
}
// ── the checks (each returns the number of violations found)
function checkNews(where, stories, log) { let n = 0; const P = new Map(log.map(e => [e.id, e]));
  for (const s of stories) { const p = P.get(s.id); if (!p) { n++; fail(where, `story #${s.id} (${s.type}) is not a public event`); continue; }
    if (s.who !== (p.who ?? null) || s.to !== (p.to ?? null)) { n++; fail(where, `story #${s.id} names ${s.who}/${s.to}, the public event ${p.who}/${p.to}`); }
    if (!s.text.endsWith(String(p.text).trim().replace(/^FIT STREET DROP/, 'Fit Street drop').replace(/,? (\d+) made\)/g, ')')) && !s.text.includes(String(p.text).slice(0, 40))) { n++; fail(where, `story #${s.id}'s text differs from the public event's`); }
    if (s.tape) { n++; fail(where, `story #${s.id} is flagged tape in LIVE`); } }
  const L = leaks(stories); if (L.length) { n += L.length; fail(where, 'private field in the news: ' + L.slice(0, 3).join(', ')); } return n; }
function checkYesterday(where, list, hz) { let n = 0; for (const s of list) if (hz === null || s.t > hz) { n++; fail(where, `story #${s.id} at ${s.t} is past the horizon ${hz}`); } return n; }
function checkBoards(where, city, hz) { let n = 0; const L = ladders(city), T = turf(city), E = economy(city), C = crime(city), D = dead(city);
  const live = { drip: L.drip, wanted: L.wanted, marks: L.marks, survivor: L.survivor, untouched: L.untouched, turf: T, econ: { ...E, cut: null, demand: null }, crime: { ...C, secret: null }, dead: D };
  const lk = leaks(live); if (lk.length) { n += lk.length; fail(where, 'private field on a LIVE board: ' + lk.slice(0, 4).join(', ')); }
  const R = L.richest; if (city.cut === 'pending') { if (!R.pending || R.rows.length) { n++; fail(where, 'Richest shows rows before the tape has a cut'); } }
  else if (!city.cut || typeof city.cut !== 'object') { if (R.rows.length) { n++; fail(where, 'Richest has rows without a director’s cut'); } }
  else { if (R.lens !== 'tape') { n++; fail(where, `Richest wears ${R.lens}, not TAPE`); } if (hz === null || R.asOf > hz) { n++; fail(where, `Richest is as of ${R.asOf}, past the horizon ${hz}`); } }
  if (C.secret && !C.secret.pending) { if (C.secret.lens !== 'tape' || hz === null || C.secret.asOf > hz) { n++; fail(where, `secret counts as of ${C.secret.asOf} (${C.secret.lens}) past the horizon ${hz}`); }
    for (const [k, v] of Object.entries(C.secret.counts)) if (city.statsCut?.[k] !== v) { n++; fail(where, `secret count ${k} = ${v} isn't yesterday's (${city.statsCut?.[k]})`); } }
  else if (city.statsCut) { n++; fail(where, 'the secret counts are pending though statsCut is there'); }
  if (city.stats) for (const k of SECRET_STATS) if (k in city.stats) { n++; fail(where, `live stats carry the secret count ${k}`); }
  if (E.cut && typeof E.cut === 'object' && (hz === null || E.cut.asOf > hz)) { n++; fail(where, `the city's money is as of ${E.cut.asOf}, past the horizon ${hz}`); }
  if (city.cut === 'pending' && E.cut && typeof E.cut === 'object') { n++; fail(where, 'the city’s money shows before the tape has a cut'); }
  const wantedNow = new Set(city.agents.filter(a => a.wanted).map(a => a.handle)); for (const r of L.wanted) if (r.why.includes('wanted') && !wantedNow.has(r.handle)) { n++; fail(where, `@${r.handle} listed wanted without the public flag`); }
  return n; }

// ── self-tests: each planted violation must be caught
const t0 = 3 * 1440 + 12 * 60, base = pageAt(t0); let st = 0;
const expect = (name, got) => { if (got > 0) st++; else { console.log(`SELF-TEST FAILED: ${name} was not caught`); process.exitCode = 1; } };
{ const sec = { ...EV.find(e => e.secret && e.t <= t0) }, news = newsOf([...base.log, { ...sec, news: true }]);   // a secret event in the public log: the second lock drops it
  if (news.some(s => s.id === sec.id)) expect('a secret event reaching the news', 0); else st++;
  const burg = EV.find(e => e.type === 'burgle' && e.who && e.t <= t0), forged = [...newsOf(base.log), ...newsOf([burg])];   // the raw break-in (burglar named) beside the public log
  const nf = fails.n || 0; expect('a named burglar in the news', checkNews('self', forged, base.log)); fails.length = 0; fails.n = nf;
  const nf2 = fails.n || 0; expect('a story past the horizon', checkYesterday('self', yesterdayOf(EV, Infinity), base.hz)); fails.length = 0; fails.n = nf2; }
{ const nf = fails.n || 0, c1 = { ...base.city, cut: null, agents: base.city.agents.map(a => ({ ...a, cash: 9999 })) };   // cash on the live cards, no cut: Richest must stay empty
  const R = richest(c1); expect('Richest built from live cash', R.rows.length ? 0 : 1);
  expect('a private field on a live board', leaks({ drip: ladders({ ...base.city, agents: base.city.agents.map(a => ({ ...a, heat: 90 })) }).drip.map(r => ({ ...r, heat: 90 })) }).length);
  const c2 = { ...base.city, statsCut: null, stats: { ...base.city.stats, bribes: 7 } }; expect('secret counts from the live stats', checkBoards('self', c2, base.hz));
  const c3 = { ...base.city, cut: { ...base.city.cut, asOf: t0 } }; expect('Richest as of now', checkBoards('self', c3, base.hz));
  const c4 = { ...base.city, agents: base.city.agents.map((a, k) => k === 0 ? { ...a, wanted: false, heat: 99 } : a), mostWanted: null }; const w = ladders(c4).wanted.some(r => r.handle === c4.agents[0].handle && r.why.includes('wanted'));
  expect('Most Wanted by heat in LIVE', w ? 0 : 1);
  fails.length = 0; fails.n = nf; }
console.log(`self-tests: ${st} of 8 planted violations caught`);

// ── every game hour of the run
const T1 = SNAPS[SNAPS.length - 1].t; let hours = 0, stories = 0, yd = 0;
for (let now = SNAPS[0].t; now <= T1; now += STEP) {
  const P = pageAt(now), where = `${RUN} @ ${now}`, news = newsOf(P.log); stories += news.length; hours++;
  checkNews(where + ' news', news, P.log);
  const y = yesterdayOf(EV, P.hz); yd += y.length; checkYesterday(where + ' yesterday', y, P.hz);
  checkBoards(where + ' boards', P.city, P.hz);
}
console.log(`${hours} game hours of ${RUN} · ${stories} live stories checked · ${yd} tape stories (yesterday) · delay ${DELAY}`);
if (fails.n) { console.log(`FAIL: ${fails.n} violation(s)`); for (const f of fails) console.log('  ' + f); process.exitCode = 1; } else console.log('CLEAN');
