// C1-10 properties: node only; public feed only. Faults modify in-memory modules.
// Default requires five faulty child runs to fail before checking seeds 404–406.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseFeed, createRecordAdapter } from '../simstate/record/adapter.js';
import { createRecordPlayer } from '../simstate/record/player.js';
import { sim } from '../simstate/store.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const BOARD = new URL('../simstate/record/board-data.js', import.meta.url);
const CARDS = new URL('../simstate/record/cards.js', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => property(isDeepStrictEqual(a, b), label);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const due = f => f.step.kind === 'night' ? Math.max(f.minute, f.day * 1440 + 1265) : f.minute;
const fileOf = seed => path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
function ensureFeed(seed) {
  if (fs.existsSync(fileOf(seed))) return;
  const args = ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'];
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  console.log(`generated seed ${seed}: ${args.join(' ')}`);
}

async function selectors() {
  if (!fault) return { ...(await import(BOARD.href)), ...(await import(CARDS.href)) };
  let board = fs.readFileSync(BOARD, 'utf8'), cards = fs.readFileSync(CARDS, 'utf8');
  const replace = (source, before, after) => {
    assert(source.includes(before), `fault injection site missing: ${before}`);
    return source.replace(before, after);
  };
  if (fault === 'future-value') board = replace(board, 'const list = b?.list ?? []', 'const list = globalThis.__futureBoard.list');
  else if (fault === 'future-shipment') board = replace(board, 'nextShipment: b?.nextShipment ?? null,', 'nextShipment: globalThis.__futureBoard.nextShipment,');
  else if (fault === 'copied-shipments') board = replace(board, 'nextShipment: b?.nextShipment ?? null,',
    'nextShipment: [2, 5, 8, 11].filter(night => 2 * night >= snapshot.frame?.t).map(night => ({ night }))[0] ?? null,');
  else if (fault === 'private-card') cards = replace(cards, '}).sort((a, b) => a.rank - b.rank);', `
    }).sort((a, b) => a.rank - b.rank).concat(events.filter(e => e.type === 'play').slice(0, 1).map(e => ({
      ...globalThis.__privatePicture, night, replay: { night, eventId: e.id }, source: { eventId: e.id, path: 'card' }
    })));`);
  else if (fault === 'bounty-poster') {
    board = replace(board, 'return { frame: snapshot.frame, minute, clock,', 'const result = { frame: snapshot.frame, minute, clock,');
    board = replace(board, 'cards: cardsAt(snapshot, undefined, minute), sources: BOARD_SOURCES };', `
      cards: cardsAt(snapshot, undefined, minute), sources: BOARD_SOURCES };
    result.bounties = result.bounties.map(b => ({ ...b, poster: 'private-poster' }));
    return result;`);
  } else throw new Error(`unknown fault: ${fault}`);
  const absoluteImports = (source, base) => source.replace(/from '(\.\/[^']+)'/g, (_, name) => `from ${JSON.stringify(new URL(name, base).href)}`);
  const cardURL = 'data:text/javascript,' + encodeURIComponent(absoluteImports(cards, CARDS));
  board = replace(board, "'./cards.js'", JSON.stringify(cardURL));
  return { ...(await import('data:text/javascript,' + encodeURIComponent(absoluteImports(board, BOARD)))), ...(await import(cardURL)) };
}

// Independent prefix oracle. No reducer, player, selector or rules helper.
function prefixState(frames, minute) {
  const prefix = frames.filter(f => due(f) <= minute), last = prefix.at(-1), events = new Map();
  for (const f of prefix) for (const e of f.events) events.set(e.id, e);
  return { frame: last ? { i: last.i, t: last.t, step: last.step, minute: last.minute } : null,
    board: prefix.findLast(f => f.board !== undefined)?.board ?? null, events: [...events.values()],
    minute, day: last?.day ?? null, nightsLeft: last?.nightsLeft ?? null, over: last?.over ?? null };
}

function cardProperties(actual, snapshot, night, label) {
  const sources = snapshot.events.filter(e => e.card?.night === night && e.minute <= snapshot.minute
    && snapshot.minute >= (night + 1) * 1440 + 360).sort((a, b) => a.card.rank - b.card.rank);
  for (const row of actual) {
    const e = snapshot.events.find(e => e.id === row.source?.eventId);
    property(e?.card, `${label}: every card must come from a typed card form`);
    property(snapshot.minute >= (row.night + 1) * 1440 + 360, `${label}: no card before its dawn`);
    equal(row.replay, { night: e.card.night, eventId: e.id }, `${label}: Replay is the enclosing feed id and night`);
    equal(row.source, { eventId: e.id, path: 'card' }, `${label}: card provenance`);
    const { replay, source, ...picture } = row;
    equal(picture, e.card, `${label}: picture fields equal the typed card, with no receipt fields`);
    if (e.card.masked) {
      property(row.subjects.agent === null, `${label}: masked robber must never be named on a card`);
      property(!Object.hasOwn(row, 'agent') && !Object.hasOwn(row, 'by'), `${label}: no masked receipt actor copied`);
    }
  }
  equal(actual.map(row => row.replay.eventId), sources.map(e => e.id), `${label}: complete rank-ordered typed top five`);
  property(actual.length <= 5, `${label}: at most five cards, no filler`);
  equal(actual.map(row => row.rank), Array.from({ length: actual.length }, (_, i) => i + 1), `${label}: core ranks retained`);
}

function bountyProperties(rows, board, label) {
  const keys = new Set(['bounty', 'copy', 'trait', 'slot', 'tier', 'agent', 'amount']);
  for (const row of rows) property(Object.keys(row).every(k => keys.has(k)), `${label}: no bounty poster or private bounty fields`);
  equal(rows, board?.bounties ?? [], `${label}: exact feed bounty targets and amounts`);
}

function boardProperties(actual, s, label) {
  const b = s.board, agents = b?.agents ?? [], list = b?.list ?? [], sales = b?.sales ?? [];
  equal(actual.frame, s.frame, `${label}: as-of frame`);
  equal(actual.minute, s.minute, `${label}: island minute`);
  equal(actual.list, list, `${label}: prices, copies and list must equal this frame, never a later frame`);
  equal(actual.sales, sales, `${label}: every public dawn sale exactly once`);
  equal(actual.fits, agents.map(a => ({ agent: a.id, fit: a.fit, fitHidden: a.fitHidden })), `${label}: public fits, including hidden nulls`);
  const grails = list.filter(t => t.tier === 'grail');
  equal(actual.grails.map(({ wearers, buyers, ...t }) => t), grails, `${label}: typed grails`);
  for (const row of actual.grails) {
    const worn = [];
    for (const a of agents) for (const piece of a.fit ?? []) if (piece.trait === row.trait) worn.push({ agent: a.id, piece });
    equal(row.wearers, worn, `${label}: grail wearers from visible fits only`);
    equal(row.buyers, sales.filter(sale => sale.trait === row.trait), `${label}: grail buyers from public sales only`);
    property(!Object.hasOwn(row, 'holder'), `${label}: no inferred grail holder`);
  }
  for (const field of ['corners', 'police', 'tonight', 'vault', 'crate']) {
    equal(actual[field], b?.[field] ?? (field === 'corners' ? [] : null), `${label}: board.${field} verbatim`);
  }
  equal(actual.wanted, agents.filter(a => a.wanted).map(a => ({ agent: a.id, heat: a.heat, wanted: a.wanted })), `${label}: wanted flags and heat stars from board`);
  bountyProperties(actual.bounties, b, label);
  equal(actual.nextShipment, b?.nextShipment ?? null, `${label}: next shipment from this board only, never a later frame or copied schedule`);
  const day = Math.floor(s.minute / 1440), m = Math.floor(s.minute) % 1440, hh = Math.floor(m / 60);
  equal(actual.clock, { t: s.minute, day, hhmm: `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    night: hh >= 20 || hh < 6 }, `${label}: same civil island clock`);
  equal(actual.countdowns, { lock: b && !s.over ? { at: day * 1440 + 1260, minutes: Math.max(0, day * 1440 + 1260 - s.minute) } : null,
    ferry: { nightsLeft: s.nightsLeft } }, `${label}: lock clock and exact nightsLeft`);
  equal(actual.sources.nextShipment, 'board.nextShipment', `${label}: shipment source is the feed board`);
  for (const field of ['list', 'sales', 'fits', 'grails', 'corners', 'police', 'tonight', 'wanted', 'bounties', 'vault', 'crate', 'nextShipment', 'clock', 'lock', 'ferry', 'cards']) {
    property(typeof actual.sources[field] === 'string' && actual.sources[field].length > 0, `${label}: named source for ${field}`);
  }
  cardProperties(actual.cards, s, s.day == null ? null : s.day - 1, label);
}

function shipmentProbes(api, frames) {
  const first = frames.find(f => f.board);
  const announced = { ...first, board: { ...first.board, nextShipment: { night: 6 } }, events: [] };
  const later = { ...announced, i: announced.i + 1, minute: announced.minute + 60,
    board: { ...announced.board, nextShipment: { night: 13 } } };
  const held = { ...later, i: later.i + 1, minute: later.minute + 60 };
  delete held.board;
  const player = createRecordPlayer(freeze([announced, later, held]));
  for (const minute of [first.minute, later.minute - .25, later.minute, held.minute, first.minute]) {
    const snapshot = player.seek(minute);
    boardProperties(api.boardAt(snapshot), prefixState([announced, later, held], minute), `irregular shipment announcement at ${minute}`);
  }
  const end = prefixState(frames, frames.at(-1).minute);
  for (const nextShipment of [null, undefined]) {
    const snapshot = { ...end, board: { ...end.board, nextShipment } };
    boardProperties(api.boardAt(snapshot), snapshot, 'absent shipment announcement');
  }
}

function privacyProbes(api, frames) {
  const end = prefixState(frames, frames.at(-1).minute);
  // Baseline seeds have no bounties. Plant both target shapes and a disclosed
  // private posting receipt, so anonymity is checked positively rather than vacuously.
  const bounties = [{ bounty: 'probe-agent', agent: 'a02', amount: 91 },
    { bounty: 'probe-piece', copy: 'probe-copy', trait: 'probe-trait', slot: 'held', tier: 'grail', amount: 117 }];
  const probe = { ...end, board: { ...end.board, bounties },
    events: [...end.events, { id: 900001, t: 2, day: 1, minute: end.minute, type: 'bounty', by: 'private-poster', bounty: 'probe-agent' }] };
  bountyProperties(api.boardAt(freeze(probe)).bounties, probe.board, 'planted bounty with disclosed poster');
  // These seeds also buy/wear no grails and hide no fits. Exercise both public
  // relationships without borrowing copy identity from a sale or a delayed stash.
  const grail = end.board.list.find(t => t.tier === 'grail');
  const piece = { copy: 'visible-grail-copy', trait: grail.trait, slot: grail.slot, tier: grail.tier };
  const sales = [1, 2].map(night => ({ night, agent: 'historical-buyer', trait: grail.trait, price: grail.floor }));
  const grailProbe = freeze({ ...end, board: { ...end.board, sales,
    agents: [{ id: 'visible-wearer', fit: [piece], fitHidden: false, heat: 2, wanted: false },
      { id: 'hidden-wearer', fit: null, fitHidden: true, heat: 4, wanted: true }] },
    events: [{ id: 900003, type: 'holdings', minute: end.minute, agent: 'stash-holder', copies: [piece.copy] },
      { id: 900004, type: 'wear', minute: end.minute, agent: 'hidden-wearer', copy: piece.copy, trait: grail.trait }] });
  const value = api.boardAt(grailProbe);
  boardProperties(value, grailProbe, 'public grail wearers, buyers, hidden fits and exact stars');
  const row = value.grails.find(t => t.trait === grail.trait);
  equal(row.wearers, [{ agent: 'visible-wearer', piece }], 'hidden fits and delayed holdings never become grail wearers');
  equal(row.buyers, sales, 'multiple purchases of a grail remain distinct historical sales');
  property(row.buyers.every(sale => !Object.hasOwn(sale, 'copy')), 'grail sales never acquire copy identities');
  // A masked public card alongside a full receipt naming the robber: picture
  // selectors may read only card, minute and id, even after that disclosure.
  const sample = frames.flatMap(f => f.events).find(e => e.card);
  const card = { ...sample.card, kind: 'Took', rank: 1, masked: true, subjects: { agent: null, others: ['victim-id'] } };
  const receipt = { id: 900002, t: 3, day: 1, type: 'burgle', minute: end.minute, card };
  for (const key of ['agent', 'by', 'target', 'members', 'reason', 'line', 'text']) {
    Object.defineProperty(receipt, key, { get() { throw new Error(`private receipt field read: ${key}`); } });
  }
  const masked = { ...end, events: [receipt] };
  cardProperties(api.cardsAt(masked, card.night), masked, card.night, 'masked full receipt');
  equal(api.cardsAt({ ...masked, minute: (card.night + 1) * 1440 + 359.75, frame: null,
    events: [{ ...receipt, minute: (card.night + 1) * 1440 + 359.75 }] }, card.night), [], 'even a malformed early card form cannot show before dawn');
  // Irrelevant delayed receipts and event text cannot alter any board value.
  const clean = api.boardAt(end), events = end.events.map(e => {
    const safe = { id: e.id, minute: e.minute, card: e.card };
    for (const key of ['type', 'agent', 'by', 'target', 'reason', 'text', 'line', 'terms', 'members']) {
      Object.defineProperty(safe, key, { get() { throw new Error(`unneeded event field read: ${key}`); } });
    }
    return safe;
  });
  equal(api.boardAt({ ...end, events }), clean, 'no event text, private event or bounty receipt read for board values');
  assert.throws(() => api.boardAt({ ...end, minute: end.minute + 1 }, end.minute));
  assert.throws(() => api.cardsAt({ ...end, minute: end.minute + 1 }, 1, end.minute));
}

async function season(seed, api) {
  ensureFeed(seed);
  const text = fs.readFileSync(fileOf(seed), 'utf8'), frames = freeze(parseFeed(text));
  const original = JSON.stringify(frames), adapter = createRecordAdapter(), events = new Map();
  globalThis.__futureBoard = frames.findLast(f => f.board)?.board;
  globalThis.__privatePicture = frames.flatMap(f => f.events).find(e => e.card).card;
  let board = null, cardForms = 0, maskedForms = 0, namedTookForms = 0;
  const firstCards = new Set(), firstForms = new Map();
  // Each raw frame is checked separately, even when several share one minute.
  for (const f of frames) {
    if (f.board !== undefined) board = f.board;
    for (const e of f.events) {
      events.set(e.id, e);
      if (e.card) {
        cardForms++; maskedForms += Number(e.card.masked);
        namedTookForms += Number(e.card.kind === 'Took' && e.card.subjects.agent !== null);
        if (!firstCards.has(e.id)) {
          firstCards.add(e.id); firstForms.set(e.id, e.card);
          property(f.step.kind === 'dawn' && f.minute >= (e.card.night + 1) * 1440 + 360, `seed ${seed}: first card form waits for dawn`);
        }
        equal(e.card, firstForms.get(e.id), `seed ${seed}: picture and Replay survive receipt updates`);
      }
    }
    const s = { ...adapter.apply(f), minute: due(f) };
    const want = { frame: { i: f.i, t: f.t, step: f.step, minute: f.minute },
      board, events: [...events.values()], minute: due(f), day: f.day, nightsLeft: f.nightsLeft, over: f.over };
    boardProperties(api.boardAt(s), want, `seed ${seed} frame ${f.i}`);
    for (let night = 1; night <= 14; night++) cardProperties(api.cardsAt(s, night), want, night, `seed ${seed} frame ${f.i} night ${night}`);
  }
  const points = [...new Set([0, ...frames.flatMap(f => [f.minute, f.minute - .25, due(f), due(f) - .25]),
    ...Array.from({ length: 15 }, (_, i) => (i + 1) * 1440).flatMap(m => [m, m + 360 - .25, m + 360])])]
    .filter(m => m >= 0 && m <= frames.at(-1).minute).sort((a, b) => a - b);
  const player = createRecordPlayer(frames, { speed: 60 });
  sim.useRecord(player); player.seek(0); player.play();
  for (const minute of points) {
    player.advance(minute - player.minute);
    boardProperties(api.boardAt(sim.record()), prefixState(frames, minute), `seed ${seed} playback ${minute}`);
  }
  for (const minute of points.slice().reverse()) {
    player.seek(minute);
    boardProperties(api.boardAt(sim.record()), prefixState(frames, minute), `seed ${seed} reverse seek ${minute}`);
    // A fresh prefix must give the same values after having visited the future.
    const prefix = frames.filter(f => f.minute <= minute);
    if (prefix.length) equal(api.boardAt(createRecordPlayer(prefix).seek(minute), minute), api.boardAt(sim.record()), `seed ${seed}: suffix cannot change board/cards at ${minute}`);
  }
  shipmentProbes(api, frames);
  privacyProbes(api, frames);
  equal(JSON.stringify(frames), original, `seed ${seed}: selector leaves the public feed unchanged`);
  property(cardForms > 0 && namedTookForms > 0, `seed ${seed}: positive typed and named Took card coverage`);
  console.log(`seed ${seed}: ${frames.length} frames; ${points.length} playback/reverse/prefix points; ${firstCards.size} cards, ${cardForms} forms (${maskedForms} masked, ${namedTookForms} named Took); PASS`);
}

try {
  if (!fault) {
    for (const [name, message] of [['future-value', 'never a later frame'], ['private-card', 'typed card form'], ['bounty-poster', 'no bounty poster'],
      ['future-shipment', 'next shipment from this board only'], ['copied-shipments', 'copied schedule']]) {
      const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
      property(child.status === 1 && child.stderr.includes('PROPERTY') && child.stderr.includes(message), `planted ${name} must fail its intended property: ${child.stderr}`);
      console.log(`FAIL FIRST ${name}: exit 1 · ${child.stderr.trim().split('\n').at(-1)}`);
    }
  }
  const api = await selectors();
  for (const seed of fault ? [404] : [404, 405, 406]) await season(seed, api);
  console.log('synthetic: irregular/absent shipment announcements, retained boards, grail wearers/buyers, hidden fits, heat stars, both bounty targets, masked full receipts and forbidden getters PASS');
  console.log('boardcheck PASS: feed equality, as-of shipment announcements, dawn-only typed cards, stable Replay, anonymous bounties and masked pictures');
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
