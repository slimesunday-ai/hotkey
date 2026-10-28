// HUMAN LAYER · SECTION 2b · THE TOYS' ANTI-CHEAT CHECK (node, no browser, no server): what section 2b derives from private data
// never shows more than its lens allows. Over every game hour of a recorded run, with the director's delay (default one game day):
//   diary    diaryOf (ui/diary-data.js) handed the WHOLE run's events (every private one, past the horizon too) must return no line newer
//            than the horizon on TAPE (a day not behind it: `pending`), none newer than now for YOURS; ARCHIVE is open. Every line is
//            the agent's own thought or its own `say` (never another agent's).
//   heat     heatOf (ui/tape/heat-data.js) in `deals` mode: refused with no horizon in a live season; never counts an event past it
//   trails   tripsOf (ui/tape/trails-data.js): legs come from `move` events only (planted private events with positions are ignored);
//            the LIVE cuts: no burglar's live trail shows the stay at the lot it burgled (the city's rule 2), no robber's live trail the
//            stay at the place of a robbery nobody saw (`seen: false`, rule 3: from the PUBLIC rob events, `who` stripped), while the tape
//            shows both; a seen robbery and the victim's own stay are not cut
// Self-tests first: a planted violation of each must be caught (else a clean result means nothing).
//   node style/city/ui/tools/diarycheck.mjs [run] [--delay 1440] [--step 60]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diaryOf, DAY } from '../diary-data.js';
import { heatOf } from '../tape/heat-data.js';
import { tripsOf, robsOf, TRAIL_TYPES } from '../tape/trails-data.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const RUN = args.find((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--'))) || '2026-09-29T23-18-20-641Z-mixed', DELAY = +opt('delay', 1440), STEP = +opt('step', 60);
const SIM2 = process.env.SIM2 || path.join(os.homedir(), 'Desktop/deadnet/sim2'), DIR = path.join(SIM2, 'runs', RUN);
const EV = fs.readFileSync(path.join(DIR, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const places = JSON.parse(fs.readFileSync(path.join(SIM2, 'places.json'), 'utf8')), book = new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p])), pos = id => book.get(id) || null;
const fails = [], fail = (w, x) => { if (fails.length < 50) fails.push(`${w}: ${x}`); fails.n = (fails.n || 0) + 1; };
const byId = new Map(EV.map(e => [e.id, e]));
// ── the checks (each returns the number of violations it found)
function checkDiary(where, d, { limit, handle }) { let n = 0;
  for (const l of d.lines) { if (l.t > limit) { n++; fail(where, `line #${l.id} at ${l.t} is past the limit ${limit}`); } const e = byId.get(l.id) || l._e; if (e && e.who !== handle) { n++; fail(where, `line #${l.id} is @${e.who}'s, not @${handle}'s`); } }
  if (limit < d.t0 && d.state !== 'pending') { n++; fail(where, `day ${d.day} is not on tape yet but the diary is ${d.state}`); } return n; }
function checkHeat(where, H, { horizon, events }) { let n = 0;
  if (horizon == null && H.lens !== 'archive' && !H.refused) { n++; fail(where, 'deals heat built with no horizon'); }
  if (H.upTo != null && horizon != null && H.upTo > horizon) { n++; fail(where, `deals heat up to ${H.upTo}, past the horizon ${horizon}`); }
  if (events) { const want = events.filter(e => e.t <= horizon && e.t >= H.from && H.T.has(e.type) && e.at && pos(e.at)).length; if (H.count > want) { n++; fail(where, `deals heat counted ${H.count} events, only ${want} are on tape`); } } return n; }
function checkTrail(where, tr, events) { let n = 0; for (const L of tr.legs) { const e = events.find(x => x.id === L.id); if (!e || !TRAIL_TYPES.has(e.type)) { n++; fail(where, `leg #${L.id} is not from a move (${e?.type})`); } } return n; }

// ── 0 · self-tests: planted violations must be caught
{ const n0 = fails.length;
  const bad = { day: 2, t0: DAY, lines: [{ id: -1, t: DAY + 900, _e: { who: 'a' } }, { id: -2, t: DAY + 10, _e: { who: 'b' } }], state: 'ok' };
  const c1 = checkDiary('planted diary', bad, { limit: DAY + 600, handle: 'a' });
  const c2 = checkDiary('planted pending', { day: 3, t0: 2 * DAY, lines: [], state: 'partial' }, { limit: DAY + 600, handle: 'a' });
  const c3 = checkHeat('planted heat', { lens: 'tape', refused: null, upTo: 900, count: 0 }, { horizon: 600 }) + checkHeat('planted heat 2', { lens: 'tape', refused: null, upTo: null, count: 0 }, { horizon: null });
  const planted = [{ id: -10, type: 'whisper', who: 'a', t: 5, x0: 0, z0: 0, x1: 9, z1: 9 }, { id: -11, type: 'move', who: 'a', t: 6, dep: 6, arr: 8, x0: 0, z0: 0, x1: 9, z1: 9 }];
  const c4 = checkTrail('planted trail', { legs: [{ id: -10 }] }, planted);
  fails.splice(n0); fails.n = fails.length;
  if (c1 < 2 || c2 < 1 || c3 < 2 || c4 < 1) fail('self-test', `planted violations caught: diary ${c1}/2, pending ${c2}/1, heat ${c3}/2, trail ${c4}/1`);
  else console.log(`0 · self-test: planted diary line past the horizon + another agent's line, a pending day shown, deals heat past/without a horizon, a trail leg from a whisper → all caught`);
  // and the real functions on the plants: tripsOf ignores the whisper; diaryOf drops the late line
  const tr = tripsOf(planted, 'a', 0, 100, { lens: 'tape' }); if (tr.legs.length !== 1 || tr.legs[0].id !== -11) fail('self-test', 'tripsOf took a leg from a private event');
  const d = diaryOf([{ id: -20, type: 'say', who: 'a', t: DAY + 5, text: 'early' }, { id: -21, type: 'say', who: 'a', t: DAY + 900, text: 'late' }, { id: -22, type: 'say', who: 'b', t: DAY + 6, text: 'not mine' }], 'a', 2, { lens: 'tape', horizon: DAY + 600 });
  if (d.lines.length !== 1 || d.lines[0].id !== -20 || d.state !== 'partial') fail('self-test', `diaryOf on the plants: ${JSON.stringify(d.lines.map(l => l.id))} ${d.state}`); }

// ── 1 · every game hour of the run
const T0 = Math.min(...EV.map(e => e.t)), T1 = Math.max(...EV.map(e => e.t)), handles = [...new Set(EV.filter(e => e.type === 'move').map(e => e.who))];
const counts = { hours: 0, diaries: 0, pending: 0, partial: 0, full: 0, lines: 0, yours: 0, heats: 0, refused: 0, trails: 0, legs: 0 };
for (let t = T0, k = 0; t <= T1 + DAY; t += STEP, k++) { counts.hours++; const horizon = t - DELAY >= T0 ? t - DELAY : null, h = handles[k % handles.length];
  for (let day = 1; day <= Math.floor(t / DAY) + 1; day++) {
    const d = diaryOf(EV, h, day, { lens: 'tape', horizon }); counts.diaries++; counts[d.state === 'ok' ? 'full' : d.state]++; counts.lines += d.lines.length;
    checkDiary(`tape diary @${h} day ${day} at ${t}`, d, { limit: horizon ?? -Infinity, handle: h });
    const y = diaryOf(EV, h, day, { lens: 'yours', now: t }); counts.yours++; checkDiary(`yours diary @${h} day ${day} at ${t}`, y, { limit: t, handle: h }); }
  const H = heatOf(EV, { mode: 'deals', from: Math.max(0, (horizon ?? t) - DAY), to: t, lens: 'tape', horizon, pos }); counts.heats++; if (H.refused) counts.refused++;
  checkHeat(`deals heat at ${t}`, { ...H, from: Math.max(0, (horizon ?? t) - DAY), T: new Set(['offer', 'contract', 'sale', 'loan_offer', 'hire_offer', 'hire', 'front', 'fill', 'fence', 'list', 'bid', 'market', 'buy', 'bribe', 'scam', 'loan', 'repay']) }, { horizon, events: horizon == null ? null : EV });
  const tr = tripsOf(EV, h, Math.max(0, t - DAY), t, { lens: 'tape' }); counts.trails++; counts.legs += tr.legs.length; checkTrail(`trail @${h} at ${t}`, tr, EV); }
// ── 2 · the live cut: a burglar's live trail never shows the stay at the lot it burgled; the tape does
let burgles = 0, cutLive = 0, shownTape = 0;
const publicBurgles = EV.filter(e => e.type === 'burgle').map(e => ({ at: e.at, t: e.t }));
for (const b of EV.filter(e => e.type === 'burgle' && e.who)) { burgles++; const home = EV.find(e => e.type === 'move' && e.who === b.who && e.to?.startsWith?.('lot:') && false);
  const live = tripsOf(EV, b.who, b.t - 180, b.t + 180, { lens: 'live', burgles: publicBurgles, home }), tape = tripsOf(EV, b.who, b.t - 180, b.t + 180, { lens: 'tape' });
  const at = tr => tr.stops.some(s => s.place === b.at && b.t >= s.t0 - 1 && b.t <= s.t1 + 1) || tr.legs.some(L => L.to === b.at && Math.abs(L.t1 - b.t) < 30);
  if (at(live)) fail('live cut', `@${b.who}'s live trail shows the stay at ${b.at}, burgled at ${b.t}`); else cutLive++;
  if (at(tape)) shownTape++; }
if (!burgles) fail('live cut', 'no burglary with a burglar in the run: the cut was not exercised');
// ── 3 · the unseen robber's cut: a robber's live trail never shows the stay at the place of a robbery nobody saw; the tape does. The live
// side is handed the PUBLIC rob events only (`who` stripped, as sim.events() has them), so the cut can't depend on knowing the robber
let robs = 0, robCut = 0, robTape = 0, robSeen = 0, victimKept = 0, victimStays = 0;
const publicRobs = robsOf(EV.filter(e => e.type === 'rob').map(({ who, ...e }) => e));
{ // self-test: a planted unseen robbery at a corner cuts the robber's and a bystander's stay there, not the victim's; a seen one cuts none
  const mv = (id, who, t, from, to) => ({ id, type: 'move', who, t, dep: t, arr: t + 4, from, to, x0: 0, z0: 0, x1: 9, z1: 9 });
  const ev = [mv(-30, 'r', 100, 'home', 'corner-x'), mv(-31, 'r', 200, 'corner-x', 'home'), mv(-32, 'v', 100, 'home', 'corner-x'), mv(-33, 'v', 200, 'corner-x', 'home')];
  const atX = tr => tr.stops.some(s => s.place === 'corner-x');
  const unseen = robsOf([{ type: 'rob', to: 'v', at: 'corner-x', t: 150, seen: false }]), seen = robsOf([{ type: 'rob', to: 'v', at: 'corner-x', t: 150, seen: true }]);
  const rLive = tripsOf(ev, 'r', 0, 300, { lens: 'live', robs: unseen }), vLive = tripsOf(ev, 'v', 0, 300, { lens: 'live', robs: unseen }), rSeen = tripsOf(ev, 'r', 0, 300, { lens: 'live', robs: seen }), rTape = tripsOf(ev, 'r', 0, 300, { lens: 'tape', robs: unseen });
  if (atX(rLive) || rLive.legs.some(L => L.to === 'corner-x') || !atX(vLive) || !atX(rSeen) || !atX(rTape)) fail('self-test', `unseen-robbery cut on the plants: robber live ${atX(rLive)}, victim live ${atX(vLive)}, seen ${atX(rSeen)}, tape ${atX(rTape)}`);
  else console.log('3 · self-test: a planted unseen robbery cuts the robber\'s live stay (and the trip in), keeps the victim\'s, a seen robbery cuts nothing, the tape shows all'); }
for (const r of EV.filter(e => e.type === 'rob' && e.who)) {
  // (shown there: a stay over the robbery's minute, or the trip that arrived for it, or the trip out of it from its start; a trip back
  // there after the robbery is a later visit, not the robbery)
  const at = tr => tr.stops.some(s => s.place === r.at && r.t >= s.t0 - 1 && r.t <= s.t1 + 1) || tr.legs.some(L => (L.to === r.at && L.t1 <= r.t + 1 && L.t1 >= r.t - 30) || (L.from === r.at && !L.hideStart && L.t0 >= r.t - 1 && L.t0 <= r.t + 30));
  const live = tripsOf(EV, r.who, r.t - 180, r.t + 180, { lens: 'live', burgles: publicBurgles, robs: publicRobs }), tape = tripsOf(EV, r.who, r.t - 180, r.t + 180, { lens: 'tape' });
  if (r.seen !== false) { robSeen++; continue; }
  robs++; if (at(live)) fail('live cut', `@${r.who}'s live trail shows the stay at ${r.at} at ${r.t}: an unseen robbery`); else robCut++;
  if (at(tape)) robTape++;
  if (r.to) { const v = tripsOf(EV, r.to, r.t - 180, r.t + 180, { lens: 'live', burgles: publicBurgles, robs: publicRobs }), vt = tripsOf(EV, r.to, r.t - 180, r.t + 180, { lens: 'tape' }); if (at(vt)) { victimStays++; if (at(v)) victimKept++; } } }
if (!robs) fail('live cut', 'no unseen robbery with a robber in the run: the robber\'s cut was not exercised');
console.log(`1 · ${counts.hours} game hours (delay ${DELAY}): ${counts.diaries} tape diaries (${counts.pending} pending, ${counts.partial} partial, ${counts.full} full, ${counts.lines} lines), ${counts.yours} YOURS diaries, ${counts.heats} deals heat maps (${counts.refused} refused: pending), ${counts.trails} trails (${counts.legs} legs)`);
console.log(`2 · the live cut: ${burgles} burglaries · the burglar's stay hidden on the live trail ${cutLive}/${burgles} · shown on the tape trail ${shownTape}/${burgles}`);
console.log(`3 · the unseen robber's cut: ${robs} unseen robberies (${robSeen} seen, not cut) · the robber's stay hidden on the live trail ${robCut}/${robs} · on the tape trail ${robTape}/${robs} · the victim's own stay kept live ${victimKept}/${victimStays}`);
if (fails.length) { console.log(`\nVIOLATIONS: ${fails.n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }
console.log('\ntoys anti-cheat: CLEAN — no diary line past its lens\'s limit, no deals heat past the horizon, trails from public moves only, no burglar\'s or unseen robber\'s stay on a live trail');
