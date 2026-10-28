// RULE 5 · DERIVED WHEREABOUTS gate (audit F05, 2026-10-08) · node, no browser, no port, no sim.
//   node style/city/tools/wherecheck.mjs [--old] [--draw] [--json]
// Audit F05: the lens hid a trip's lot id but not what the movement contract derives from it. A taxi or bike leg to someone else's lot
// kept the export's kerb id ('kerb:lot:-284,134'), the ride's whole path to the door and its metres, and leaks() found nothing.
// Trips come from the city's own export (world/export/travel.mjs on world.json, as the sim plans them), every mode, to and from a
// spread of foreign lots. They go through simstate/lens.js publicOf as an agent's `trip` and as a `move` event, as served live.
//   1 the audit's repro    plaza → lots[0] by taxi and by bike (scripts/ui-privacy-probes.mjs 'kerb-foreign-lot-privacy')
//   2 every derived form   no public trip or move names the lot in any form, or its name in the text. A leg at the lot (any id in it
//                          standing for the lot) keeps no metres and no path point or wait spot in the lot's zone (within 60 m, or the
//                          lot's district by the nearest place: an independent copy of lens.js cutLeg's zone). No trip `metres`
//   3 public stays public  legs not at the lot are byte for byte the sim's; a trip between public places, or to the agent's own lot, is
//                          unchanged
//   4 the director's warn  "@X got word that @Y is heading to their house" is not public live; the warned owner has it (myEvents)
//   5 the arrival minute   (ui-review 2026-10-09 #1, slime: "a coarse trip to someone else's place drops its arrival time") a trip TO a
//                          foreign lot, as trip and move: no `arr`, no `fare`, no leg ending at the arrival (the clock stops where the
//                          public path does), no "(27m …)" or fare in the text, and its `arrive` there not public. A trip FROM the lot
//                          (the mirror, 2026-10-09 follow-up): its move not public, the trip starting no earlier than its public path,
//                          no fare; it keeps its arrival at a public place and that arrive event. The card changes at neither minute
//   6 the Most Wanted      (ux-critique privacy note 1) the sim names a burglar with 23 unseen break-ins; live names the most crimes on
//                          the public record (a seen robbery, a warrant, an arrest; ≥ 3), the store's second pass keeps it, an older
//                          server's own is dropped; the archive and the director's cut keep the sim's own
//   --draw                 what the city DRAWS (simstate/movement.js, the cabs, the traffic; three.js stubbed): taxi and bike to and
//                          from lots[0], frame by frame. The rider and the cab are never drawn in the lot's zone
// --old runs the lens as it was before the F05 fix (lens.js @ 00d55e7), --at <rev> any committed lens (5 and 6: --at 861dbcd, before
// them): the gate must fail there. Exit code 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const has = k => process.argv.includes('--' + k), DRAW = has('draw'), JSONOUT = has('json');
const OLD_AT = has('old') ? '00d55e7' : has('at') ? process.argv[process.argv.indexOf('--at') + 1] : null, OLD = !!OLD_AT;
const L = OLD ? await import('data:text/javascript;base64,' + execFileSync('git', ['-C', ROOT, 'show', `${OLD_AT}:style/city/simstate/lens.js`]).toString('base64'))
  : await import('../simstate/lens.js');
const { publicOf, ownerOf, leaks, directorOf } = L, MW_FROM = L.MW_FROM ?? 'public record';
const W = JSON.parse(fs.readFileSync(path.join(ROOT, 'world/export/world.json'), 'utf8'));
const { createTravel, MODES } = await import(pathToFileURL(path.join(ROOT, 'world/export/travel.mjs')));
const T = createTravel(W), places = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim2/places.json'), 'utf8'));
const PTS = [...places.places, ...places.lots].filter(p => p.dist && typeof p.x === 'number');
const distAt = (x, z) => { let b = null, bd = Infinity; for (const p of PTS) { const q = (p.x - x) ** 2 + (p.z - z) ** 2; if (q < bd) { bd = q; b = p.dist; } } return b; };
const zoneOf = lot => pt => Array.isArray(pt) && (Math.hypot(pt[0] - lot.x, pt[1] - lot.z) < 60 || distAt(pt[0], pt[1]) === lot.dist);

const fails = [], counts = { trips: 0, moves: 0, legsAtLot: 0, legsKept: 0, publicTrips: 0, ownLot: 0, noTrip: 0, arrivals: 0, departures: 0, wanted: 0, tripShown: 0, noStretch: 0 };
const fail = (sec, what) => { fails.push(`${sec}: ${what}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the served view of one trip: as the agent's card (a FULL state, as the replay's view=full or the demo) and as its move event
function served(raw, lots, { owner = 'bob', t = 600 } = {}) {   // (t: the answer's minute — a trip FROM a lot shows only once its public clock starts)
  const lotRows = lots.map(l => ({ id: l.id, owner, sec: {}, scars: [] })), dest = places.lots.find(l => l.id === raw.to) || places.places.find(p => p.id === raw.to);
  const move = { id: 7, t: 600, type: 'move', who: 'alice', from: raw.from, to: raw.to, dep: raw.dep, arr: raw.arr, mode: raw.mode, fare: raw.fare, legs: raw.legs, taxi: raw.mode === 'taxi',
    text: `heads to ${dest?.name ?? raw.to} (${Math.round(raw.arr - raw.dep)}m ${raw.mode}${raw.fare ? `, ${raw.fare}cr` : ''})` };
  const s = publicOf({ t, ts: 'D1 10:00', agents: [{ handle: 'alice', cls: 'cook', cash: 100, heat: 0, inv: [], status: 'busy', at: null, trip: raw }], lots: lotRows, crews: [], loans: [], events: [move], news: [] }, { places });
  return { s, trip: s.agents[0].trip, move: s.events.find(e => e.id === 7) };
}
// section 2's checks on one served trip or move (pub) against the sim's own (raw) for one foreign lot
function checkAt(sec, label, raw, pub, lot) {
  if (!pub) return fail(sec, `${label}: gone`);
  const S = JSON.stringify(pub), inZone = zoneOf(lot);
  if (S.includes(lot.id)) fail(sec, `${label}: names ${lot.id} (${(S.match(new RegExp(`"[^"]*${lot.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"`)) || [])[0]})`);
  if (lot.name && String(pub.text || '').includes(lot.name)) fail(sec, `${label}: its text names ${lot.name}`);
  if ('metres' in pub) fail(sec, `${label}: keeps the trip's metres (${pub.metres})`);
  if (!Array.isArray(pub.legs) || pub.legs.length !== raw.legs.length) return fail(sec, `${label}: ${raw.legs.length} legs became ${pub.legs?.length}`);
  raw.legs.forEach((R, i) => { const P = pub.legs[i], at = [R.from, R.to, R.at].some(v => typeof v === 'string' && v.includes(lot.id));
    if (!at) { if (same(P, R)) counts.legsKept++; else fail(sec, `${label}: leg ${i} (${R.kind} ${R.from}→${R.to}, not at the lot) was changed`); return; }
    counts.legsAtLot++;
    if ('m' in P) fail(sec, `${label}: leg ${i} (${R.kind} ${R.from}→${R.to}) keeps its metres ${P.m}`);
    if (P.coarse !== true) fail(sec, `${label}: leg ${i} (${R.kind}) is not marked coarse`);
    const k = (P.path || []).findIndex(inZone); if (k >= 0) fail(sec, `${label}: leg ${i} (${R.kind} ${R.from}→${R.to}) path point ${k} [${P.path[k]}] is in ${lot.id}'s zone`);
    if (inZone(P.at)) fail(sec, `${label}: leg ${i} (${R.kind}) waits at [${P.at}], in ${lot.id}'s zone`); });
}

// ── 1 · the audit's repro: plaza → lots[0] (lot:-284,134, Gatehill) by taxi and by bike, the probe's own state
const L0 = places.lots[0];
for (const mode of ['taxi', 'bike']) {
  const raw = T.trip('plaza', L0.id, mode, { dep: 600 }); if (!raw) { fail('1 repro', `no ${mode} trip plaza → ${L0.id}`); continue; }
  const actor = { handle: 'alice', cls: 'cook', cash: 100, heat: 0, inv: [], status: 'busy', at: null, x: L0.x, z: L0.z, home: null, act: null, lastSay: null, trip: raw };
  const s = publicOf({ t: 100, ts: 'D1 01:40', stats: { scams: 1, robberies: 2 }, agents: [actor], lots: [{ id: L0.id, owner: 'bob', sec: {}, scars: [] }], crews: [], loans: [], events: [], news: [] }, { places });
  const t = s.agents[0].trip, named = (t.legs || []).filter(l => JSON.stringify(l).includes(L0.id));
  const line = { mode, to: t.to, legsNamingTheLot: named.map(l => ({ kind: l.kind, from: l.from, to: l.to, pathPoints: l.path?.length, pathEnd: l.path?.at(-1), m: l.m })), leaks: leaks(s) };
  if (!JSONOUT) console.log(`1 · ${mode} plaza → ${L0.id}: to ${t.to}, legs naming the lot ${JSON.stringify(line.legsNamingTheLot)}`);
  if (t.to !== 'dist:' + L0.dist) fail('1 repro', `${mode}: the trip's to is ${t.to}`);
  if (named.length) fail('1 repro', `${mode}: ${named.length} leg(s) still name ${L0.id}: ${named.map(l => `${l.kind} ${l.from}→${l.to}`).join(', ')}`);
  if (leaks(s).length) fail('1 repro', `${mode}: leaks ${leaks(s).join(' ')}`);
  checkAt('1 repro', `${mode} plaza→${L0.id}`, raw, t, L0);
}

// ── 2 · every derived form: every mode, to and from a spread of foreign lots (every 12th lot: all three lot districts), from plaza
const LOTS = places.lots.filter((l, k) => k % 12 === 0);
for (const lot of LOTS) for (const mode of MODES) for (const [from, to] of [['plaza', lot.id], [lot.id, 'plaza']]) {
  const raw = T.trip(from, to, mode, { dep: 600 }); if (!raw) { counts.noTrip++; continue; }
  const away = from === lot.id, { s, trip, move } = served(raw, [lot], { t: away ? raw.arr - .01 : 600 }), label = `${mode} ${from}→${to}`; counts.trips++;
  for (const p of leaks(s)) fail('2 derived', `${label}: leaks ${p}`);
  if (away && move) fail('2 derived', `${label} (move): a move FROM the lot is public (its minute is the departure)`); else if (!away) { counts.moves++; checkAt('2 derived', label + ' (move)', raw, move, lot); }
  if (trip || !String(s.agents[0].at).startsWith('dist:')) checkAt('2 derived', label + ' (trip)', raw, trip, lot); else counts.noStretch++;   // (none of it public: shown there to its end)
}

// ── 3 · public places still show: public → public in every mode, and a trip to the agent's own lot, unchanged (trip and move)
for (const mode of MODES) for (const [from, to] of [['plaza', 'store'], ['store', 'docks'], ['motel', 'plaza']]) {
  const raw = T.trip(from, to, mode, { dep: 600 }); if (!raw) continue; const { trip, move } = served(raw, [L0]); counts.publicTrips++;
  if (!same(trip, raw)) fail('3 public', `${mode} ${from}→${to}: the trip changed`);
  if (!move || !same(move.legs, raw.legs) || move.to !== to || move.from !== from) fail('3 public', `${mode} ${from}→${to}: the move event changed`); }
for (const lot of LOTS.slice(0, 6)) for (const mode of ['taxi', 'bike', 'walk']) {
  const raw = T.trip('plaza', lot.id, mode, { dep: 600 }); if (!raw) continue; const { trip, move } = served(raw, [lot], { owner: 'alice' }); counts.ownLot++;
  if (!same(trip, raw)) fail('3 public', `${mode} plaza→${lot.id} (alice's own lot): the trip changed`);
  if (!move || !same(move.legs, raw.legs) || move.to !== lot.id) fail('3 public', `${mode} plaza→${lot.id} (alice's own lot): the move event changed`); }

// ── 4 · the director's warn: not public; the warned owner has it
{ const warn = { id: 8, t: 600, type: 'warn', who: 'alice', to: 'bob', text: '@bob got word that @alice is heading to their house' };
  const full = { t: 600, ts: 'D1 10:00', agents: [{ handle: 'alice', cash: 1, heat: 0, inv: [], status: 'busy', at: null }, { handle: 'bob', cash: 1, heat: 0, inv: [], status: 'active', at: 'plaza', home: L0.id }],
    lots: [{ id: L0.id, owner: 'bob', sec: {}, scars: [] }], crews: [], loans: [], events: [warn], news: [warn] };
  const s = publicOf(full, { places });
  if (s.events.some(e => e.type === 'warn') || s.news.some(e => e.type === 'warn')) fail('4 warn', `public: "${warn.text}"`);
  const o = ownerOf(full, 'bob', [warn], {}, { places }); if (!o?.myEvents?.some(e => e.id === 8)) fail('4 warn', "the warned owner (bob's myEvents) lost it"); }

// ── 5 · the arrival minute: every mode, plaza → each foreign lot of section 2 (and back), as the agent's trip and as its move + arrive
// events. The minute a burglar arrives is the minute of the burglary (ui-review 2026-10-09 #1): no public field may carry it
for (const lot of LOTS) for (const mode of MODES) for (const [from, to] of [['plaza', lot.id], [lot.id, 'plaza']]) {
  const raw = T.trip(from, to, mode, { dep: 600 }); if (!raw) continue; const into = to === lot.id, label = `5 ${mode} ${from}→${to}`, dur = Math.round(raw.arr - raw.dep);
  const dest = places.lots.find(l => l.id === to) || places.places.find(p => p.id === to), name = dest?.name ?? to;
  const move = { id: 7, t: 600, type: 'move', who: 'alice', from, to, dep: raw.dep, arr: raw.arr, mode, fare: raw.fare, legs: raw.legs, taxi: mode === 'taxi', text: `heads to ${name} (${dur}m ${mode}${raw.fare ? `, ${raw.fare}cr` : ''})` };
  const arrive = { id: 8, t: Math.ceil(raw.arr), type: 'arrive', who: 'alice', at: to, text: `arrived at ${name}` };
  const s = publicOf({ t: raw.dep, ts: 'D1 10:00', agents: [{ handle: 'alice', cls: 'cook', cash: 100, heat: 0, inv: [], status: 'busy', at: null, trip: raw }], lots: [{ id: lot.id, owner: 'bob', sec: {}, scars: [] }], crews: [], loans: [], events: [move, arrive], news: [] }, { places });
  const trip = s.agents[0].trip, mv = s.events.find(e => e.id === 7), ar = s.events.find(e => e.id === 8);
  if (!into) { counts.departures++;   // (the mirror, 2026-10-09 follow-up: from the lot, the departure goes; the arrival at a public place stays)
    if (mv) fail('5 arrival', `${label}: the move FROM the lot is public (t ${mv.t}: the departure, in a short stay the arrival)`);
    if (!ar) fail('5 arrival', `${label}: the arrival at ${to}, a public place, is gone`);
    const late = publicOf({ t: raw.arr - .01, ts: 'D1', agents: [{ handle: 'alice', cls: 'cook', cash: 100, heat: 0, inv: [], status: 'busy', at: null, trip: raw }], lots: [{ id: lot.id, owner: 'bob', sec: {}, scars: [] }], crews: [], loans: [], events: [], news: [] }, { places }).agents[0].trip;
    if (late) { if (late.arr !== raw.arr) fail('5 arrival', `${label}: a trip FROM the lot lost its arrival at ${to} (${late.arr})`); if (raw.fare && 'fare' in late) fail('5 arrival', `${label}: keeps its fare`);
      if (raw.arr - raw.dep >= 1) { if (typeof late.dep === 'number' && late.dep < raw.dep + .5) fail('5 arrival', `${label}: starts at ${late.dep}, the departure (${raw.dep})`); (late.legs || []).forEach((l, i) => { if (typeof l.dep === 'number' && l.dep < raw.dep + .5) fail('5 arrival', `${label}: leg ${i} (${l.kind}) starts at ${l.dep}, the departure`); }); } }
    const leave = (t, gone) => publicOf({ t, ts: 'D1', agents: [{ handle: 'alice', cls: 'cook', cash: 100, heat: 0, inv: [], ...(gone ? { status: 'busy', at: null, trip: raw, act: null } : { status: 'active', at: from, trip: null, act: 'wait', x: lot.x, z: lot.z }) }],
      lots: [{ id: lot.id, owner: 'bob', sec: {}, scars: [] }], crews: [], loans: [], events: [], news: [] }, { places }).agents[0], kk = a => JSON.stringify({ at: a.at, trip: a.trip ?? null, status: a.status, act: a.act ?? null, x: a.x ?? null, z: a.z ?? null });
    const d0 = kk(leave(raw.dep - .5, false)), d1 = kk(leave(raw.dep + .5, true)); if (d0 !== d1) fail('5 arrival', `${label}: the card changes at the departure: ${d0} → ${d1}`); continue; }
  counts.arrivals++;
  if (ar) fail('5 arrival', `${label}: the arrive event at the lot is public (at ${ar.at}, t ${ar.t}: "${ar.text}")`);
  for (const [k, pub] of [['trip', trip], ['move', mv]]) { if (!pub) { if (k !== 'trip' || !String(s.agents[0].at).startsWith('dist:')) fail('5 arrival', `${label} (${k}): gone`); continue; }   // (a card shown there already: no public stretch)
    if ('arr' in pub) fail('5 arrival', `${label} (${k}): keeps arr ${pub.arr} (the arrival is ${raw.arr})`);
    if ('seconds' in pub) fail('5 arrival', `${label} (${k}): keeps the trip's seconds (${pub.seconds}: its duration)`);
    if ('fare' in pub && raw.fare) fail('5 arrival', `${label} (${k}): keeps the fare ${pub.fare}cr (a cab's fare is its length)`);
    if (dur >= 1) (pub.legs || []).forEach((l, i) => { if (typeof l.arr === 'number' && l.arr >= raw.arr - .5) fail('5 arrival', `${label} (${k}): leg ${i} (${l.kind}) ends at ${l.arr}, the arrival (${raw.arr})`);
      if (typeof l.dep === 'number' && typeof l.arr === 'number' && l.arr < l.dep) fail('5 arrival', `${label} (${k}): leg ${i} (${l.kind}) ends before it starts`); }); }
  if (mv && (new RegExp(`\\b${dur}m\\b`).test(mv.text) || (raw.fare && mv.text.includes(`${raw.fare}cr`)))) fail('5 arrival', `${label}: the move's text times the trip: "${mv.text}"`);
  // the card: nothing on it changes at the arrival (half a game minute before, on the trip, against arrived); before its public clock
  // stops it still shows the trip (the street part is public)
  const card = (t, arrived) => publicOf({ t, ts: 'D1', agents: [{ handle: 'alice', cls: 'cook', cash: 100, heat: 0, inv: [], ...(arrived ? { status: 'active', at: to, trip: null, act: 'wait', x: lot.x, z: lot.z } : { status: 'busy', at: null, trip: raw, act: null }) }],
    lots: [{ id: lot.id, owner: 'bob', sec: {}, scars: [] }], crews: [], loans: [], events: [], news: [] }, { places }).agents[0], k = a => JSON.stringify({ at: a.at, trip: a.trip ?? null, status: a.status, act: a.act ?? null, x: a.x ?? null, z: a.z ?? null });
  const c0 = k(card(raw.arr - .5, false)), c1 = k(card(Math.ceil(raw.arr), true)); if (c0 !== c1) fail('5 arrival', `${label}: the card changes at the arrival: ${c0} → ${c1}`);
  const stop = trip?.legs?.at(-1)?.arr; if (typeof stop === 'number' && stop > raw.dep + .5) { counts.tripShown++; if (!card(raw.dep, false).trip) fail('5 arrival', `${label}: the card hides the trip before its public clock stops (${raw.dep} < ${stop})`); }
}

// ── 6 · the Most Wanted (rule 6): the sim's own names @burglar (23 unseen break-ins + an unseen robbery); @robber has 2 seen robberies, a
// warrant for one of them, an arrest and a warrant for selling fakes (3 crimes on the public record, COUNTED ONCE: 5 records); @mugger 2
// seen robberies (under the floor of 3) and a payback (not a crime). 2026-10-10: one robbery seen, reported and arrested is one crime;
// a Most Wanted bounty is public only marked as the public record's; the WANTED flag on a card comes from the public record, not heat
{ const ev = []; let id = 100; const E = o => ev.push({ id: id++, ts: 'D1', ...o }), A = (h, x = {}) => ({ handle: h, cls: 'cook', cash: 50, heat: 10, inv: [], status: 'active', at: 'plaza', ...x });
  for (let k = 0; k < 23; k++) E({ t: 400 + k, type: 'burgle', who: 'burglar', to: 'bob', at: L0.id, ok: true, text: `@burglar burgled @bob's house: 3cr` });
  E({ t: 430, type: 'rob', who: 'burglar', to: 'bob', at: 'plaza', seen: false, ok: true, text: '@burglar robbed @bob at The Plaza: 5cr' });
  E({ t: 440, type: 'rob', who: 'robber', to: 'bob', at: 'plaza', seen: true, ok: true, text: '@robber robbed @bob at The Plaza: 5cr' }); E({ t: 441, type: 'warrant', who: 'robber', text: 'a warrant is out for @robber (robbery, reported by the victim)' });
  E({ t: 450, type: 'rob', who: 'mugger', to: 'bob', at: 'plaza', seen: true, ok: false, text: '@mugger tried to rob @bob at The Plaza and failed' }); E({ t: 451, type: 'rob', who: 'mugger', to: 'bob', at: 'plaza', seen: true, ok: true, text: '@mugger robbed @bob at The Plaza: 2cr' });
  E({ t: 460, type: 'rob', who: 'robber', to: 'mugger', at: 'plaza', seen: true, ok: true, text: '@robber robbed @mugger at The Plaza: 1cr' }); E({ t: 470, type: 'arrest', who: 'cop', to: 'robber', at: 'plaza', text: '@cop ARRESTED @robber: 4h on Iron Island' });
  E({ t: 475, type: 'warrant', who: 'robber', text: 'a warrant is out for @robber (selling fakes, reported by the victim)' });
  E({ t: 480, type: 'rob', who: 'mugger', to: 'robber', at: 'plaza', seen: true, ok: true, text: '@mugger got payback on @robber at The Plaza: 1cr' });
  const full = { t: 600, ts: 'D1 10:00', mostWanted: 'burglar', agents: [A('burglar', { n: { crimes: 24 }, heat: 95 }), A('robber', { status: 'jail', at: 'jail' }), A('mugger'), A('bob', { home: L0.id }), A('cop', { cls: 'cop' })],
    lots: [{ id: L0.id, owner: 'bob', sec: {}, scars: [], stash: { cash: 9 } }], crews: [], loans: [], events: ev, news: [] };
  const want = (label, got, exp) => { counts.wanted++; if (got !== exp) fail('6 wanted', `${label}: Most Wanted is ${got === null || got === undefined ? 'none' : '@' + got}, should be ${exp === null ? 'none' : '@' + exp}`); };
  const pub = publicOf(full, { places }); want('live (/state)', pub.mostWanted, 'robber');
  if (pub.mostWantedFrom !== MW_FROM) fail('6 wanted', `the public state doesn't say it counts the public record (mostWantedFrom ${pub.mostWantedFrom})`);
  want("the store's second pass (an already public state)", publicOf(pub, { places }).mostWanted, 'robber');
  want("an older server's public state (the sim's own, unmarked)", publicOf({ ...pub, mostWanted: 'burglar', mostWantedFrom: undefined }, { places }).mostWanted, null);
  want('the owner view (bob)', ownerOf(full, 'bob', ev, {}, { places })?.mostWanted, 'robber');
  want('under the floor (no warrant, no arrest)', publicOf({ ...full, events: ev.filter(e => e.type !== 'warrant' && e.type !== 'arrest') }, { places }).mostWanted, null);
  want('the robber dead', publicOf({ ...full, agents: full.agents.map(a => a.handle === 'robber' ? { ...a, status: 'dead' } : a) }, { places }).mostWanted, null);
  want('the archive (a finished season: the sim\'s own)', publicOf({ ...full, archive: true }, { places }).mostWanted, 'burglar');
  want("the director's cut (the tape: the sim's own)", directorOf([full], ev, 600 + 1440, 1440).mostWanted, 'burglar');
  // COUNTED ONCE (the 10-09 leftover #4): @dup's one robbery, seen, reported and arrested — three records, one crime: nobody (it was @dup)
  const dup = [{ id: 900, t: 500, type: 'rob', who: 'dup', to: 'bob', at: 'plaza', seen: true, ok: true, text: '@dup robbed @bob at The Plaza: 4cr' }, { id: 901, t: 510, type: 'warrant', who: 'dup', text: 'a warrant is out for @dup (robbery, reported by the victim)' },
    { id: 902, t: 520, type: 'arrest', who: 'cop', to: 'dup', at: 'plaza', text: '@cop ARRESTED @dup: 4h on Iron Island' }];
  want('one robbery seen, reported and arrested (counted once)', publicOf({ ...full, agents: [...full.agents, A('dup')], events: dup }, { places }).mostWanted, null);
  { const R = L.publicRecord?.(ev); if (R?.get('robber')?.n !== 3) fail('6 wanted', `@robber's public record counts ${R?.get('robber')?.n} crimes, should be 3 (5 records)`); }
  // THE BOUNTY (the 10-09 leftover #2): whom the sim paid on is public only marked as the public record's pick
  const mwb = { id: 950, t: 590, type: 'bounty', who: 'cop', to: 'burglar', text: '@cop collected the 20cr bounty on the Most Wanted, @burglar', news: true, card: true };
  want('an unmarked Most Wanted bounty (the sim\'s own pick) is not public live', (L.cityEvents([mwb])[0]?.to) ?? null, null);
  want('a marked one (the public record\'s pick) is', (L.cityEvents([{ ...mwb, to: 'robber', text: '@cop collected the 20cr bounty on the Most Wanted, @robber', mostWantedFrom: MW_FROM }])[0]?.to) ?? null, 'robber');
  // THE WANTED FLAG (the planner's leak): @burglar's heat is 95 (the sim's WANTED) on nothing the street saw: not wanted live; @robber's
  // fakes warrant (475) is newer than the arrest (470): wanted; the owner (me) keeps the heat
  const wf = h => publicOf(full, { places }).agents.find(a => a.handle === h)?.wanted;
  want('WANTED live on heat alone (@burglar: 0 on the public record)', wf('burglar') ? 'burglar' : null, null);
  want('WANTED live on a warrant newer than the arrest (@robber)', wf('robber') ? 'robber' : null, 'robber');
  want('WANTED a day after the warrant (expired)', publicOf({ ...full, t: 475 + 1440 }, { places }).agents.find(a => a.handle === 'robber')?.wanted ? 'robber' : null, null);
  want('the owner keeps the heat (me)', ownerOf(full, 'burglar', ev, {}, { places })?.me?.heat === 95 ? 'burglar' : null, 'burglar'); }

// ── --draw · what the city draws: the real movement in node (the audit's harness, evidence/taxi-sync.mjs), three.js stubbed
const drawn = [];
if (DRAW) {
  register('data:text/javascript,' + encodeURIComponent("export async function resolve(s, c, n) { if (s === 'three' || s.startsWith('three/')) return { url: 'data:text/javascript,export class Matrix4{} export class Quaternion{} export class Vector3{} export class Euler{}', shortCircuit: true }; return n(s, c); }"));
  const imp = p => import(pathToFileURL(path.join(ROOT, p)));
  const { createTrafficSim } = await imp('style/city/traffic/sim.js'), { CLOCK } = await imp('style/city/traffic/rules.js'), { createMovement } = await imp('style/city/simstate/movement.js'), { agentsOf, placeIndex } = await imp('style/city/simstate/adapter.js');
  globalThis.fetch = async () => ({ ok: true, json: async () => structuredClone(W) });
  const PI = placeIndex(places), inZone = zoneOf(L0), near = (x, z) => Math.hypot(x - L0.x, z - L0.z);
  for (const [mode, from, to] of [['taxi', 'plaza', L0.id], ['taxi', L0.id, 'plaza'], ['bike', 'plaza', L0.id], ['bike', L0.id, 'plaza']]) {
    const raw = T.trip(from, to, mode, { dep: 600 }), { trip } = served(raw, [L0], { t: from === L0.id ? raw.arr - .01 : 600 }), ag = agentsOf({ agents: [{ handle: 'alice', status: 'busy', at: null, trip }] }, PI)[0];
    let time = 0; const TS = createTrafficSim({ seed: 404, clock: () => time }); TS.MODELS.size = k => k === 0 ? [11, 2, .5] : [4.4, 1.8, .34];
    globalThis.window = { __city: { traffic: { sim: TS, MODELS: [{ name: 'bus' }, { name: 'taxi' }] } } };
    const mv = createMovement({ peds: { sim: { nodes: new Map(), edges: [], walkers: [], animate: () => ({}) } } }); await new Promise(r => setTimeout(r, 0));
    const a = { id: 'wherecheck' }, run = mv.run(a, ag.trip), d = { case: `${mode} ${from}→${to}`, riderFrames: 0, riderInZone: 0, riderNearest: Infinity, cabFrames: 0, cabInZone: 0, cabNearest: Infinity, error: null };
    for (let sec = 0; sec < (raw.arr - 600) * 2.5 + 60 && !run.done; sec += .05) { time = sec; CLOCK.t = sec; const now = 600 + sec / 2.5; mv.frame(now); TS.step(.05);
      let o; try { o = run.frame(now, .05, a); } catch (e) { d.error = e.message; break; }
      if (o.show) { d.riderFrames++; d.riderNearest = Math.min(d.riderNearest, near(o.x, o.z)); if (inZone([o.x, o.z])) d.riderInZone++; }
      const c = run.veh?.c; if (c && !c.gone) { d.cabFrames++; d.cabNearest = Math.min(d.cabNearest, near(c.x, c.z)); if (inZone([c.x, c.z])) d.cabInZone++; } }
    d.done = !!run.done; for (const k of ['riderNearest', 'cabNearest']) d[k] = Number.isFinite(d[k]) ? Math.round(d[k]) : null; drawn.push(d);
    if (!JSONOUT) console.log(`draw · ${d.case}: rider drawn ${d.riderFrames} frames, ${d.riderInZone} in the lot's zone (nearest ${d.riderNearest} m); cab ${d.cabFrames} frames, ${d.cabInZone} in the zone (nearest ${d.cabNearest} m)${d.error ? ', ERROR ' + d.error : ''}`);
    if (d.error) fail('draw', `${d.case}: ${d.error}`); if (!d.done) fail('draw', `${d.case}: the trip never finished`);
    if (d.riderInZone) fail('draw', `${d.case}: the rider is drawn in ${L0.id}'s zone (${d.riderInZone} frames, nearest ${d.riderNearest} m)`);
    if (d.cabInZone) fail('draw', `${d.case}: the cab is drawn in ${L0.id}'s zone (${d.cabInZone} frames, nearest ${d.cabNearest} m)`); }
}

const out = { lens: OLD ? `lens.js @ ${OLD_AT}` : 'simstate/lens.js', lots: LOTS.length, ...counts, drawn: DRAW ? drawn : undefined, fails: fails.length, first: fails.slice(0, 25) };
if (JSONOUT) console.log(JSON.stringify(out, null, 1));
else { console.log(`${out.lens}: ${counts.trips} trips + ${counts.moves} moves to / from ${LOTS.length} foreign lots (${counts.noTrip} mode-pairs with no trip), ${counts.legsAtLot} legs at a lot, ${counts.legsKept} public legs kept; ${counts.publicTrips} public trips, ${counts.ownLot} to the agent's own lot; arrival minute: ${counts.arrivals} trips to a lot (${counts.tripShown} with a public stretch on the card), ${counts.departures} from one (${counts.noStretch} in section 2 with none public); Most Wanted: ${counts.wanted} cases`);
  for (const f of fails.slice(0, 25)) console.log('  FAIL ' + f); if (fails.length > 25) console.log(`  … ${fails.length - 25} more`);
  const bySec = {}; for (const f of fails) { const k = f.slice(0, f.indexOf(':')); bySec[k] = (bySec[k] || 0) + 1; }
  console.log(fails.length ? `GATE FAIL (${fails.length}: ${Object.entries(bySec).map(([k, n]) => `${k} ${n}`).join(' · ')})` : 'GATE PASS'); }
process.exit(fails.length ? 1 : 0);
