// C1-11 properties over the actual record, node only. Fault children run first.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { parseFeed } from '../simstate/record/adapter.js';
import { createShowPlayer } from '../simstate/record/show-plan.js';
import { addressesFor } from '../simstate/record/addresses.js';
import { CITY_PLACES, CORNERS, DISTRICTS } from '../simstate/record/places.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PANEL = new URL('../simstate/record/panel-data.js', import.meta.url);
const WORDS = new URL('../simstate/record/panel-events.js', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => property(isDeepStrictEqual(a, b), label);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const readPath = (o, path) => path.split('.').reduce((v, k) => v?.[k], o);
const agentKeys = 'id name trade driver crew heat wanted jailed bail evicted tab boarded walk fit fitHidden'.split(' ');
const pick = (o, keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(o, k)).map(k => [k, o[k]]));
const roles = e => {
  const ids = 'agent to a b by leader holder target'.split(' ').map(k => e[k]);
  if (['ask', 'decline', 'say', 'chat', 'give', 'pay'].includes(e.type)) ids.push(e.from);
  if (e.type === 'turf') ids.push(e.was);
  ids.push(...(e.members ?? []), ...(e.victims ?? []));
  if (e.card) ids.push(e.card.subjects.agent, ...e.card.subjects.others);
  if (e.type === 'show') ids.push(...Object.keys(e.seen));
  if (e.type === 'season') ids.push(...(e.agents ?? []).map(a => a.id));
  return [...new Set(ids.filter(x => typeof x === 'string'))];
};
const publicTypes = new Set('season season_end price meet heat high clean buy board mint missed gone rollover evicted tab show fight hustle arrest release turf police shipment outloud card'.split(' '));
const isPublic = e => publicTypes.has(e.type) || e.type === 'crew' && e.act !== 'invite' || e.type === 'fake' && e.act === 'exposed';
const publicForm = e => isPublic(e) ? e : e.card ? { id: e.id, minute: e.minute, t: e.t, day: e.day, type: 'card', card: e.card } : null;

async function selectors() {
  if (!fault) return { ...await import(PANEL), ...await import(WORDS) };
  let panel = fs.readFileSync(PANEL, 'utf8'), words = fs.readFileSync(WORDS, 'utf8');
  const replace = (s, before, after) => { assert(s.includes(before), `missing fault site: ${before}`); return s.replace(before, after); };
  if (fault === 'event-text') words = replace(words, "text: parts.map(p => typeof p === 'string' ? p : p.text).join('')", 'text: e.text');
  else if (fault === 'early-record') panel = replace(panel,
    "const events = rowsAt(snapshot, minute, 'record').filter(r => r.subjects.includes(agent));",
    "const events = rowsAt(snapshot, minute, 'record').filter(r => r.subjects.includes(agent)); if (globalThis.__earlyRow) events.push(globalThis.__earlyRow);");
  else if (fault === 'hooded-name') words = replace(words, "case 'fight':", "case 'fight': literal('penny (@a01) attacks. ');");
  else if (['drug-at-high', 'drug-before-disclosure'].includes(fault)) panel = replace(panel,
    'return rows;',
    "if (scope === 'record' && globalThis.__drugLeak?.at === minute) rows.push(eventRow(globalThis.__drugLeak.event, snapshot.board)); return rows;");
  else if (fault === 'drug-future-frame') panel = replace(panel,
    'const events = publicAt(snapshot, minute);',
    'const events = globalThis.__drugFuture ? publicAt(globalThis.__drugFuture) : publicAt(snapshot, minute);');
  else throw new Error(`unknown fault ${fault}`);
  const absolute = (s, base) => s.replace(/from '(\.\/[^']+)'/g, (_, name) => `from ${JSON.stringify(new URL(name, base).href)}`);
  const wordURL = 'data:text/javascript,' + encodeURIComponent(absolute(words, WORDS));
  panel = replace(panel, "'./panel-events.js'", JSON.stringify(wordURL));
  return { ...await import('data:text/javascript,' + encodeURIComponent(absolute(panel, PANEL))), ...await import(wordURL) };
}

// Every selected leaf is an exact feed leaf; omissions are allowed, inventions
// aren't. This covers nested terms, quantities, plan routes and memory words.
function subset(actual, source, label) {
  if (actual && typeof actual === 'object') {
    property(source && typeof source === 'object', `${label}: object has a source`);
    for (const key of Object.keys(actual)) {
      property(Object.hasOwn(source, key), `${label}.${key}: feed path exists`);
      subset(actual[key], source[key], `${label}.${key}`);
    }
  } else equal(actual, source, `${label}: exact feed value`);
}
function noSeat(value, label, context = '') {
  if (!value || typeof value !== 'object') return;
  const denied = new Set('me mine deals dealt state walkAt expired promise promises verifiedPlan transactions fight run hustle stationCops mostWanted loans drip budget deaths'.split(' '));
  for (const [key, v] of Object.entries(value)) {
    property(!denied.has(key), `${label}: no seat/unsupported field ${context}.${key}`);
    if (['owed', 'paid'].includes(key)) property(context.endsWith('fields') && ['tab', 'evicted'].includes(value.__type), `${label}: no deal status ${key}`);
    noSeat(v, label, `${context}.${key}`);
  }
}
function rowProperties(row, s, label) {
  const source = s.events.find(e => e.id === row.id);
  property(source, `${label}: record fact cannot appear before disclosure`);
  property(row.minute <= s.minute, `${label}: row is not from the future`);
  equal(row.minute, source.minute, `${label}: exact publication stamp`);
  equal(row.source, { eventId: source.id, minute: source.minute }, `${label}: receipt provenance`);
  equal([row.day, row.t], [source.day, source.t], `${label}: occurrence day/half-day, never an invented minute`);
  const event = row.type === 'card' && source.type !== 'card' ? publicForm(source) : source;
  property(event && event.type === row.type, `${label}: exact type or safe public card projection`);
  subset(row.fields, event, `${label}.fields`);
  equal(row.subjects, roles(event), `${label} ${row.type} #${row.id}: only typed role ids name participants`);
  property(row.text === row.parts.map(p => typeof p === 'string' ? p : p.text).join(''), `${label}: news line is built from typed parts, never event text`);
  for (const part of row.parts) if (typeof part !== 'string') {
    equal(part.source.eventId, source.id, `${label}: dynamic word source id`);
    equal(part.value, readPath(event, part.source.path), `${label}: dynamic word source value`);
    const value = part.value, a = s.board?.agents.find(a => a.id === value);
    const allowed = [String(value), `$${value}`];
    if (a) allowed.push(`${a.name} (@${a.id})`);
    if (part.nameSource) equal(part.nameSource, { agent: a?.id, path: 'board.agents[].name' }, `${label}: display name provenance`);
    if (roles(event).includes(value)) allowed.push(`@${value}`);
    if (part.source.path === 'part') allowed.push(({ plan: 'the plan card', orders: 'standing orders', creed: 'the Creed', note: 'the journal', dawn: 'the dawn journal', clear: 'memory after CLEAR' })[value]);
    if (['guns', 'lockpicks', 'warrants', 'fakes', 'doses'].includes(part.source.path)) allowed.push(`${value} ${part.source.path}`);
    property(allowed.includes(part.text), `${label}: dynamic words are a typed value or a public roster name`);
  }
  // Public show/fight stories cannot attach an attacking identity, even after a
  // private receipt/card names it. Arrest names come from the public arrest,
  // never from an inferred attacking-side join.
  if (['show', 'fight'].includes(row.type)) {
    const show = s.events.find(e => e.type === 'show' && e.night === row.fields.night);
    for (const a of s.board?.agents ?? []) if (show && !Object.hasOwn(show.seen, a.id) && a.id !== row.fields.target) {
      property(!row.text.includes(`@${a.id}`) && !row.text.includes(`${a.name} (`), `${label}: no hooded attacker name live`);
    }
    property(!Object.hasOwn(row.fields, 'agent') && !Object.hasOwn(row.fields, 'members'), `${label}: no attacking identity fields`);
    if (row.type === 'show') property(Object.keys(row.fields.plays ?? {}).every(id => Object.hasOwn(row.fields.seen, id)), `${label}: no hooded identity in public plays`);
  }
  // A receipt may contain public rent owed/paid amounts; all private deal state
  // is excluded even after disclosure. Carry type only inside this check.
  noSeat({ ...row, fields: { ...row.fields, __type: row.type } }, label);
}

function boardProperties(api, s, id, label) {
  const agents = s.board?.agents ?? [], a = agents.find(a => a.id === id), c = api.cardAt(s, id);
  if (!a) { equal(c, null, `${label}: no phantom card`); return; }
  equal(pick(c, agentKeys), pick(a, agentKeys), `${label}: card is exactly the public board`);
  equal(Object.keys(c).sort(), [...agentKeys, 'home', 'lastSay', 'sources'].sort(), `${label}: card allow-list`);
  const address = addressesFor(agents.map(a => a.id))[id];
  equal(c.home.address, address, `${label}: dealt city address`);
  equal(c.home.evicted, a.evicted, `${label}: public eviction`);
  equal(api.homeAt(s, id), c.home, `${label}: one home reader`);
  const said = s.board.outloud.filter(line => line.agent === id).at(-1);
  equal(c.lastSay, said ? pick(said, ['agent', 'say', 'terms', 'line']) : null, `${label}: only public out-loud words`);
  const leaders = api.leadersAt(s);
  equal(leaders.heat, agents.map(a => ({ agent: a.id, heat: a.heat, wanted: a.wanted })).sort((a, b) => b.heat - a.heat || a.agent.localeCompare(b.agent)), `${label}: public heat sorted, no crime ladder`);
  equal(leaders.crews, [...s.board.crews].sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id)), `${label}: public crew membership sorted`);
  const map = api.mapAt(s);
  equal(map.places, Object.values(CITY_PLACES), `${label}: paper map uses city export`);
  equal(map.corners, s.board.corners.map(c => ({ ...c, anchor: CORNERS[c.corner] ?? null })), `${label}: corners from board and city anchors`);
  equal(map.districts, Object.entries(DISTRICTS).map(([district, anchor]) => ({ district, anchor, level: s.board.police[district], tonight: s.board.tonight?.[district] ?? null })), `${label}: exact police levels`);
  equal(map.wanted, agents.filter(a => a.wanted).map(a => ({ agent: a.id, heat: a.heat, wanted: a.wanted })), `${label}: public wanted posters`);
  equal(api.bountiesAt(s, id), s.board.bounties.filter(b => b.agent === id), `${label}: only explicit public bounty targets`);
  noSeat({ card: c, leaders, map }, label);
}
function historyProperties(api, s, id, news, label) {
  const rap = api.rapAt(s, id), tape = api.tapeAt(s, id), people = api.peopleAt(s, id);
  const pub = s.events.map(publicForm).filter(Boolean), record = s.events.filter(e => !isPublic(e));
  equal(rap.map(r => r.id), pub.filter(e => roles(e).includes(id)).map(e => e.id).reverse(), `${label}: complete public record naming this agent`);
  equal(tape.events.map(r => r.id), record.filter(e => roles(e).includes(id)).map(e => e.id), `${label}: complete disclosed receipts`);
  for (const row of tape.events) rowProperties(row, s, label);
  const h = record.findLast(e => e.type === 'holdings' && e.agent === id);
  equal(tape.holdings?.id ?? null, h?.id ?? null, `${label}: last holdings receipt, no advancing`);
  const memory = s.board?.memories?.find(m => m.agent === id) ?? null;
  equal(tape.memory, memory, `${label}: complete disclosed memory snapshot, CLEAR does not delete history`);
  if (!people) return;
  equal(people.crew, s.board.crews.find(c => c.id === s.board.agents.find(a => a.id === id).crew) ?? null, `${label}: crew from board`);
  for (const [scope, events] of [['public', pub], ['record', record]]) {
    const expected = events.filter(e => roles(e).includes(id)).flatMap(e => roles(e).filter(other => other !== id && s.board.agents.some(a => a.id === other)).map(agent => ({ agent, eventId: e.id, type: e.type, minute: e.minute })));
    equal(people[scope], expected, `${label}: ties only from typed participants, separated by disclosure`);
  }
  for (const [scope, events] of [['live', pub], ['record', record]]) {
    equal(news[scope].map(r => r.id), events.map(e => e.id), `${label}: every ${scope} event has news`);
    for (const row of news[scope]) {
      rowProperties(row, s, label);
      equal([row.ticker, row.ch9], [row.text, row.text], `${label}: ticker and CH 9 use the typed line`);
      equal(row.scope, scope === 'live' ? 'public' : 'record', `${label}: disclosed stories wear record scope`);
    }
  }
}

// GAME.md §19 (53c0dd5): day events disclose at the next 06:00 dawn,
// night events at the next 21:00 lock. This is only a check's clock oracle;
// selectors must still read the published naming receipt, never infer a drug.
const drugDisclosure = t => (Math.floor(t / 2) + 1) * 1440 + (t % 2 ? 1260 : 360);
function drugNamesAt(api, s, take, label) {
  const panels = api.panelsAt(s, take.agent);
  const rows = [...panels.rap, ...panels.tape.events, ...panels.news.live, ...panels.news.record];
  const named = rows.filter(r => r.id === take.id && (r.fields.drug != null || r.text.includes(take.drug)));
  for (const row of named) {
    property(s.minute >= drugDisclosure(take.t), `${label}: drug name before half-day disclosure @${drugDisclosure(take.t)}`);
    const published = s.events.find(e => e.id === take.id && e.type === 'take' && e.drug === take.drug);
    property(published && published.minute <= s.minute && s.frame?.minute <= s.minute,
      `${label}: drug naming event not published at playhead @${s.minute}`);
    equal(row.fields.drug, published.drug, `${label}: drug name is the published typed value`);
    equal(row.source, { eventId: published.id, minute: published.minute }, `${label}: drug naming publication source`);
  }
  return named.length;
}

function drugProbes(api, base) {
  for (const [t, lag] of [[4, 0], [5, 0], [4, 5], [5, 5]]) {
    const day = Math.floor(t / 2), boundary = drugDisclosure(t), at = day * 1440 + (t % 2 ? 1260 : 585);
    const high = { id: 902000, type: 'high', t, day, minute: at, agent: base.board.agents[0].id, walk: 'wired' };
    const take = { id: 902001, type: 'take', t, day, minute: boundary + lag, agent: high.agent, drug: 'temp' };
    const snapshotAt = minute => ({ ...base, minute, day: Math.floor(minute / 1440),
      frame: { i: minute < take.minute ? 1 : 2, t: minute < take.minute ? t : t + 2,
        minute: minute < take.minute ? at : take.minute, step: { kind: 'errand' } },
      events: minute < take.minute ? [high] : [high, take] });
    if (t === 4 && ['drug-at-high', 'drug-before-disclosure'].includes(fault)) {
      globalThis.__drugLeak = { event: take, at: fault === 'drug-at-high' ? at : boundary - 1 };
    }
    try {
      for (const minute of [at, boundary - 1, boundary - .001, boundary, boundary + .001, take.minute - .001, take.minute, take.minute + .001]) {
        if (fault === 'drug-future-frame' && minute >= boundary && minute < take.minute) globalThis.__drugFuture = snapshotAt(take.minute);
        else delete globalThis.__drugFuture;
        const count = drugNamesAt(api, freeze(snapshotAt(minute)), take, `${t % 2 ? 'night' : 'day'} drug probe @${minute}`);
        equal(count, minute < take.minute ? 0 : 2, 'drug probe: panel and news wait for actual publication, then name the drug');
      }
    } finally { delete globalThis.__drugLeak; delete globalThis.__drugFuture; }
  }
  console.log('PASS drug probes: next dawn/next lock, boundary -1/equality/epsilon, withheld publication, future frame');
}

function drugTimingProperties(api, frames, player, seed) {
  const first = new Map();
  for (const f of frames) for (const e of f.events) if (!first.has(e.id)) first.set(e.id, e);
  const events = [...first.values()], takes = events.filter(e => e.type === 'take');
  let points = 0, witnesses = 0;
  const gaps = new Set();
  for (const take of takes) {
    const boundary = drugDisclosure(take.t);
    const highs = events.filter(e => e.type === 'high' && e.agent === take.agent && e.t === take.t);
    const high = highs.length === 1 && takes.filter(e => e.agent === take.agent && e.t === take.t).length === 1 ? highs[0] : null;
    if (high) { witnesses++; gaps.add(take.minute - high.minute); }
    const minutes = new Set([boundary - 1, boundary - .001, boundary, boundary + .001,
      take.minute - 1, take.minute - .001, take.minute, take.minute + .001, ...(high ? [high.minute] : [])]);
    for (const minute of minutes) {
      if (minute < 0 || minute > frames.at(-1).minute) continue;
      const s = player.seek(minute), label = `seed ${seed} take #${take.id} @${minute}`;
      const count = drugNamesAt(api, s, take, label);
      equal(count, s.events.some(e => e.id === take.id && e.drug === take.drug) ? 2 : 0,
        `${label}: panel and news name only the published take`);
      points++;
    }
  }
  property(takes.length > 0, `seed ${seed}: drug timing exercised`);
  console.log(`PASS drug seed ${seed}: ${takes.length} takes · ${points} boundary probes · ${witnesses} high witnesses · gaps ${gaps.size ? [...gaps].sort((a, b) => a - b).join('/') + 'm' : 'none'}`);
}

function probes(api, base) {
  const a = base.board.agents[0].id, b = base.board.agents[1].id;
  const e = (id, type, fields) => ({ id, type, minute: 4145, t: 5, day: 2, ...fields });
  const hidden = e(900001, 'memory', { agent: a, part: 'dawn', memory: { plan: [], orders: [], creed: ['PRIVATE_CREED'], journal: [{ day: 2, line: 'PRIVATE_JOURNAL' }] } });
  const disclosed = { ...base, minute: 4145, frame: { i: 1, minute: 4145, t: 5, step: { kind: 'night' } }, day: 2,
    events: [e(900000, 'show', { night: 2, seen: { [b]: 'suburbs' }, hooded: { suburbs: 1 }, plays: { [b]: { kind: 'laylow', place: 'home' } } }),
      e(900002, 'fight', { night: 2, kind: 'breakin', target: b, place: 'suburbs', level: 'normal', sides: [{ size: 1, strength: 3 }], defence: 2, cops: 0, won: true, backingDecided: false, text: 'EVENT_TEXT_POISON' })] };
  globalThis.__earlyRow = api.eventRow(hidden, base.board);
  // This tests the production reader, not an assertion against a fabricated result.
  for (const row of api.tapeAt(disclosed, a).events) rowProperties(row, disclosed, 'planted unpublished memory');
  for (const row of api.newsAt(disclosed).live) rowProperties(row, disclosed, 'planted hooded fight');
  delete globalThis.__earlyRow;
  const memory = { plan: [{ trait: 'top/dock_vest', routes: ['buy', 'trade'] }],
    orders: [{ kind: 'buy', item: 'parts', units: 2, max: 30 }], creed: ['PUBLIC_CREED'], journal: [{ day: 2, line: 'PUBLIC_DAWN' }] };
  const delayed = [hidden, e(900003, 'memory', { agent: a, part: 'clear', memory: { ...memory, plan: [], journal: [] } }),
    e(900004, 'orders', { agent: a, errand: 'pay', origin: 'orders', ok: false, of: [900005] }),
    e(900005, 'pay', { from: a, to: b, amount: 27, for: 'debt', sitdown: 's1' }),
    e(900006, 'say', { from: a, to: b, say: 'offer', sitdown: 's1', terms: { what: 'trade', cash: 27, goods: { chems: 2 } }, line: 'PUBLIC_WORDS' }),
    e(900007, 'play', { agent: a, kind: 'hit', place: 'suburbs', target: b, accept: [b], origin: 'model', reason: 'PUBLIC_REASON' }),
    e(900008, 'take', { agent: a, drug: 'truth' }),
    e(900009, 'memory', { agent: a, part: 'orders', origin: 'owner', memory })];
  const late = { ...disclosed, minute: 5585, events: [...disclosed.events, ...delayed.map(e => ({ ...e, minute: 5585 }))],
    board: { ...base.board, memories: [{ agent: a, asOfDay: 2, asOfClock: 5, ...memory }] } };
  const rows = api.tapeAt(freeze(late), a);
  equal(rows.events.map(r => r.id), delayed.map(r => r.id), 'probe: every disclosure retained, including pre-CLEAR journal');
  equal(rows.memory.journal, memory.journal, 'probe: dawn journal labels its entry day');
  equal(rows.events.find(r => r.type === 'orders').fields.of, [900005], 'probe: standing-order receipt ids retained');
  property(rows.events.find(r => r.type === 'orders').text.includes('standing orders'), 'probe: standing orders never attributed to model');
  equal(rows.events.find(r => r.type === 'play').fields.accept, [b], 'probe: disclosed acceptance');
  for (const row of rows.events) rowProperties(row, late, 'positive memory/words/orders probe');
  for (const [type, act] of [['order', 'place'], ['order', 'back'], ['shop', null], ['sell', null]]) {
    const row = api.eventRow(e(900010, type, { agent: a, act, order: 'o1', side: 'shop', item: 'parts', units: 2, cash: 51 }), base.board);
    property(row.text.includes(type === 'order' ? act === 'back' ? 'gets an order back' : 'places an order' : 'fills'), 'probe: placed, filled and returned orders differ');
  }
  for (const fn of ['cardAt', 'rapAt', 'tapeAt', 'peopleAt', 'leadersAt', 'mapAt', 'newsAt']) {
    const args = ['cardAt', 'rapAt', 'tapeAt', 'peopleAt'].includes(fn) ? [late, a, 4145] : [late, 4145];
    assert.throws(() => api[fn](...args), /snapshot at or before/, `${fn} rejects future snapshot`);
  }
  const seek = { ...disclosed, minute: 4145 };
  equal(api.replaySideAt(seek, { ...late, minute: 5585 }, a).names, [], 'probe: exactly 24h keeps hood');
  property(api.replaySideAt(seek, { ...late, minute: 5585.001 }, a).names.length === 1, 'probe: >24h and disclosed play restores name');
  equal(api.replaySideAt(seek, { ...disclosed, minute: 5585.001 }, a).names, [], 'probe: age without disclosed play cannot name attacker');
  // Public kinds absent from the three bot feeds still get positive wording
  // and provenance coverage. Include each variant with a different audience.
  const fixtures = [
    ['season', { nights: 14, agents: [{ id: a }] }], ['season_end', {}],
    ['price', { side: 'shop', item: 'chems', price: 25, was: 24 }],
    ['meet', { a, b }], ['heat', { agent: a, heat: 3, wanted: true }],
    ['high', { agent: a, walk: 'wired', drug: 'temp' }], ['clean', { agent: a }],
    ['buy', { agent: a, trait: 'top/dock_vest', price: 83 }],
    ['board', { agent: a, route: 'industrial' }], ['mint', { agent: a, cash: 30, mainland: 30, cards: [] }],
    ['missed', { agent: a, cash: 50 }], ['gone', { from: 'vault', cash: 10 }], ['rollover', { copies: [] }],
    ['evicted', { agent: a, on: false }], ['tab', { agent: a, tab: 20, paid: 20 }],
    ['hustle', { agent: a, place: 'forest', how: 'campers', take: 10 }],
    ['arrest', { agent: a, by: b, stars: 3, bail: 300, place: 'strip' }], ['release', { agent: a, why: 'served' }],
    ['turf', { corner: 'strip-1', holder: a, was: b }], ['police', { place: 'strip', level: 'heavy' }],
    ['shipment', { cash: 500, goods: { guns: 1 } }], ['outloud', { agent: a, say: 'offer', terms: { goods: { doses: 1 } }, line: 'PUBLIC_LINE' }],
    ['crew', { act: 'form', crew: 'c1', name: 'Public crew', agent: a }],
    ['crew', { act: 'invite', crew: 'c1', agent: a, by: b }], ['fake', { agent: a, act: 'exposed', trait: 'top/dock_vest' }],
  ].map(([type, fields], i) => e(901000 + i, type, fields));
  const fixtureState = { ...disclosed, events: fixtures };
  for (const row of [...api.newsAt(fixtureState).live, ...api.newsAt(fixtureState).record]) rowProperties(row, fixtureState, 'public kind probe');
  const high = api.newsAt(fixtureState).live.find(r => r.type === 'high');
  property(!JSON.stringify(high).includes('temp'), 'probe: live walk never copies a named drug');
  property(!api.newsAt(disclosed).live.some(r => ['play', 'take', 'memory', 'holdings'].includes(r.type)), 'probe: no private drug/reason/holdings/memory before disclosure');
  const bountyState = { ...disclosed, board: { ...disclosed.board, bounties: [
    { bounty: 'b1', agent: a, amount: 40, poster: 'PRIVATE_POSTER' },
    { bounty: 'b2', copy: 'k1', trait: 'top/dock_vest', amount: 50 },
  ] } };
  equal(api.bountiesAt(bountyState, a), [{ bounty: 'b1', agent: a, amount: 40 }], 'probe: dossier bounty neither names poster nor infers copy holder');
  // Private getters and event text are traps; neither can become an input.
  const trap = { ...late, board: { ...late.board, agents: late.board.agents.map(a => ({ ...a })) }, events: late.events.map(e => ({ ...e })) };
  for (const value of [trap, trap.board, ...trap.board.agents, ...trap.events]) for (const key of ['me', 'text', 'deals', 'fight', 'run', 'hustle']) {
    if (!Object.hasOwn(value, key)) Object.defineProperty(value, key, { get() { throw new Error(`forbidden read: ${key}`); } });
  }
  const originalRandom = Math.random; Math.random = () => { throw new Error('panel RNG'); };
  try { api.panelsAt(trap, a); } finally { Math.random = originalRandom; }
  console.log('PASS probes: memory/CLEAR/dawn, words/terms, origins, order receipts, 24h replay, forbidden getters, future snapshots');
}

if (!fault) for (const name of ['event-text', 'early-record', 'hooded-name', 'drug-at-high', 'drug-before-disclosure', 'drug-future-frame']) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
  property(child.status === 1 && /PROPERTY/.test(child.stderr), `fault ${name} must fail a property (exit=${child.status})`);
  console.log(`PLANTED ${name}: exit 1 · ${child.stderr.match(/Error: PROPERTY[^\n]*/)?.[0]}`);
}
const api = await selectors();
for (const seed of [404, 405, 406]) {
  const file = `${ROOT}/core/runs/${seed}-A/feed.jsonl`;
  if (!fs.existsSync(file)) {
    const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  }
  const frames = freeze(parseFeed(fs.readFileSync(file, 'utf8'))), player = createShowPlayer(frames);
  if (seed === 404) { drugProbes(api, player.snapshot()); probes(api, player.snapshot()); }
  const end = frames.at(-1).minute, points = new Set([0, end]);
  for (let minute = 0; minute <= end; minute += 60) points.add(minute);
  for (const f of frames) { const at = f.step.kind === 'night' ? f.day * 1440 + 1265 : f.minute; points.add(at); points.add(at - .001); }
  // Explicitly inspect every staged scene midpoint and release edge.
  const { createShowPlanner } = await import('../simstate/record/show-plan.js');
  const planner = createShowPlanner(frames);
  for (let night = 1; night <= 14; night++) for (const scene of planner.night(night).scenes) {
    points.add(scene.start); points.add((scene.start + scene.end) / 2); points.add(scene.end - .001); points.add(scene.end);
  }
  const samples = [...points].filter(m => m >= 0 && m <= end).sort((a, b) => a - b);
  let newsRows = 0, values = 0;
  const known = new Set();
  for (const [index, minute] of samples.entries()) {
    const s = player.seek(minute), id = s.board?.agents[index % s.board.agents.length]?.id ?? 'a01';
    const label = `seed ${seed} minute ${minute}`;
    boardProperties(api, s, id, label);
    // Row provenance is checked once per disclosed form. Completeness and all
    // card/map/leaderboard values are checked at every sample.
    const news = api.newsAt(s);
    for (const scope of ['live', 'record']) {
      const expected = scope === 'live' ? s.events.map(publicForm).filter(Boolean) : s.events.filter(e => !isPublic(e));
      equal(news[scope].map(r => r.id), expected.map(e => e.id), `${label}: complete ${scope} news`);
      for (const row of news[scope]) {
        const signature = JSON.stringify([row.id, row.type, row.minute, row.fields]);
        if (!known.has(signature)) { rowProperties(row, s, label); known.add(signature); newsRows++; }
      }
    }
    // Inspect every roster member at each actual frame and every show release;
    // rotate at other boundaries. All news forms above are checked regardless.
    const ids = s.board && frames.some(f => f.minute === minute) ? s.board.agents.map(a => a.id) : [id];
    for (const agent of ids) {
      const tape = api.tapeAt(s, agent), expected = s.events.filter(e => !isPublic(e) && roles(e).includes(agent));
      equal(tape.events.map(r => r.id), expected.map(e => e.id), `${label}: disclosed dossier receipts`);
      const h = expected.findLast(e => e.type === 'holdings' && e.agent === agent);
      equal(tape.holdings?.id ?? null, h?.id ?? null, `${label}: exact holdings receipt`);
      equal(tape.memory, s.board?.memories?.find(m => m.agent === agent) ?? null, `${label}: exact disclosed memory`);
      equal(api.rapAt(s, agent).map(r => r.id), s.events.map(publicForm).filter(e => e && roles(e).includes(agent)).map(e => e.id).reverse(), `${label}: public rap`);
      values++;
    }
    if (index % 101 === 0 && s.board) historyProperties(api, s, id, news, label);
    if (index % 149 === 0) {
      equal(api.peopleAt(s).map(c => pick(c, agentKeys)), (s.board?.agents ?? []).map(a => pick(a, agentKeys)), `${label}: People is the roster`);
      const again = player.seek(minute);
      equal(api.cardAt(again, id), api.cardAt(s, id), `${label}: repeat seek`);
    }
  }
  // Backward seeks compare full selectors to fresh players, including no prior
  // board and the disclosed-card -> receipt replacement at the same feed id.
  for (const minute of samples.filter((_, i) => i % 97 === 0).reverse()) {
    const a = player.seek(minute), b = createShowPlayer(frames).seek(minute);
    equal(api.panelsAt(a, 'a01'), api.panelsAt(b, 'a01'), `seed ${seed}: backwards/fresh panels at ${minute}`);
  }
  const presentKinds = new Set(frames.flatMap(f => f.events.map(e => e.type)));
  for (const type of presentKinds) property(api.EVENT_KINDS.includes(type), `seed ${seed}: wording supplied for ${type}`);
  console.log(`PASS seed ${seed}: ${frames.length} frames · ${samples.length} minutes/cues · ${newsRows} news forms · ${values} dossiers · ${presentKinds.size} event kinds`);
  drugTimingProperties(api, frames, player, seed);
}
console.log('PANELCHECK PASS: all feed values at/before playhead; disclosed record only; no seat/deal projections; no hooded fight names; half-day drug disclosure.');
