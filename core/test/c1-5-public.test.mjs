import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { viewFor } from '../rules/view.mjs';
import { emit, toAll, toFewUntil, DAY15 } from '../rules/state.mjs';
import { createFeed } from '../feed.mjs';

const audiences = [[null, 'public'], [null, 'record'], ['a01', 'ownerAI'], ['a02', 'agent']];
const has = (x, token) => JSON.stringify(x).includes(token);
const secret = { reason: 'SECRET-REASON', drug: 'hallu', lies: ['SECRET-LIE'], want: 'SECRET-WANT', warrants: 'SECRET-WARRANT', fake: 'SECRET-FAKE', accept: ['SECRET-ACCEPT'] };
const forbidden = Object.values(secret).flat();
const cards = v => v.events.filter(e => e.card).sort((a, b) => a.card.rank - b.card.rank);
function fixture(night = 1, by = null, type = 'rob') {
  const g = new Game({ n: 4 });
  g.s.day = night;
  g.s.clock = 2 * night + 1;
  const priv = toFewUntil(['a01'], night === 14 ? DAY15 : g.s.clock + 2);
  for (const [agent, kind, place, rest] of [
    ['a01', 'cook', 'forest', {}], ['a02', 'back', undefined, { target: 'a01' }],
    ['a03', 'hit', 'docks', { target: 'a04' }], ['a04', 'hustle', 'docks', {}],
  ]) emit(g.s, g.log, 'play', { agent, kind, place, ...secret, ...rest }, priv);
  emit(g.s, g.log, 'show', { night, seen: { a01: 'forest', a02: 'forest', a04: 'docks' }, hooded: { docks: 1 } }, toAll(g.s));
  const receipt = emit(g.s, g.log, type, { night, leader: 'a03', members: ['a03'], target: 'a04', place: 'docks',
    copy: 'PIECE', trait: 'TRAIT', cash: 37, pieceValue: 81, value: 118, valueBasis: 'copy-paid', goods: { hallu: 3 }, ...secret }, priv);
  emit(g.s, g.log, 'robbed', { night, agent: 'a04', by, kind: type === 'rob' ? 'hit' : 'breakin', place: 'docks',
    copy: 'PIECE', trait: 'TRAIT', cash: 37 }, toFewUntil(['a04'], priv.pub));
  return { g, receipt };
}
function at(g, t, who, audience) {
  return viewFor({ ...g.s, clock: t, day: Math.floor(t / 2), over: t >= DAY15 }, g.log.filter(e => e.t <= t), who, audience);
}
for (const [who, audience] of audiences) {
  test(`show allow-list and timing: ${audience}`, () => {
    const { g } = fixture();
    assert.ok(!at(g, 2, who, audience).events.some(e => e.type === 'show' && e.plays), 'not before show');
    const show = at(g, 3, who, audience).events.find(e => e.type === 'show');
    assert.ok(show.plays, 'positive control: plays at show');
    assert.deepEqual(show.plays.a01, { kind: 'cook', place: 'forest' });
    assert.deepEqual(show.plays.a02, { kind: 'back', place: 'forest', target: 'a01' });
    assert.deepEqual(Object.keys(show.plays).sort(), Object.keys(show.seen).sort());
    for (const token of [...forbidden, 'a03']) assert.ok(!has(show.plays, token), `show must hide ${token}`);
    assert.deepEqual(show.hooded, { docks: 1 });
  });
  test(`card allow-list, dawn boundary and record names: ${audience}`, () => {
    for (const night of [1, 14]) for (const type of ['rob', 'burgle']) for (const by of [null, 'a03']) {
      const { g, receipt } = fixture(night, by, type);
      assert.equal(cards(at(g, 2 * night + 1, who, audience)).length, 0, 'cards wait for dawn');
      const dawn = 2 * (night + 1);
      const selected = cards(at(g, dawn, who, audience));
      assert.equal(selected.length, 1, 'positive control: a dawn card');
      const e = selected[0];
      assert.equal(e.n, receipt.n, 'receipt is replay anchor');
      assert.equal(e.card.kind, 'Took');
      assert.equal(e.card.night, night);
      assert.deepEqual(e.card.subjects, { agent: by, others: ['a04'] });
      assert.equal(e.card.masked, by === null, 'only the victim receipt masks a robber');
      assert.deepEqual(e.card.pieces, [{ copy: 'PIECE', trait: 'TRAIT' }]);
      assert.equal(e.card.place, 'docks');
      assert.equal(e.card.value, 118);
      for (const token of forbidden) assert.ok(!has(e.card, token), `card must hide ${token}`);
      if (by === null) assert.ok(!has(e.card, 'a03'), 'ski mask hides the robber on the card');
      if (night !== 14 && who !== 'a01') {
        assert.equal(e.type, 'card');
        for (const token of forbidden) assert.ok(!has(e, token), `private receipt must hide ${token}`);
        if (by === null) assert.ok(!has(e, 'a03'), 'card-only form hides the masked robber');
      }
      const disclosed = at(g, receipt.vis.pub, null, 'record').events.find(e => e.n === receipt.n);
      assert.equal(disclosed.type, type);
      assert.equal(disclosed.leader, 'a03', 'positive control: record names at disclosure');
      assert.deepEqual(disclosed.card, e.card, 'card keeps its receipt names and mask after disclosure');
    }
    const allKinds = cards(at(marketFixture(), 4, who, audience));
    assert.deepEqual(allKinds.map(e => e.card.kind), ['Took', 'Turned', 'Booked', 'Bought', 'Outbid']);
    for (const e of allKinds) for (const token of forbidden) assert.ok(!has(e.card, token), `${e.card.kind}: hide ${token}`);
  });
}

test('actual resolved plays: corners, drops, homes, woods labs, Precinct 9, idle and attacking backs, routes', () => {
  const g = new Game({ n: 10 });
  const roles = ['dealer', 'chemist', 'gunrunner', 'smuggler', 'cop', 'smuggler', 'smuggler', 'smuggler', 'smuggler', 'smuggler'];
  const setup = newSeason({ seed: 404, items: ITEMS, agents: roles.map((trade, i) => ({ id: idOf(i + 1), name: idOf(i + 1), trade })) });
  g.s = setup.state;
  g.log = setup.events;
  g.hand('a07', abilityCopy(g.s, 'knuckles'), { wear: true });
  g.hand('a08', tierCopy(g.s, 'common'), { wear: true });
  const r = g.night({
    a01: { kind: 'deal', corner: 'docks-1' }, a02: { kind: 'cook', place: 'forest', batches: 1 },
    a03: { kind: 'build', place: 'suburbs', guns: 1 }, a04: { kind: 'run', place: 'forest' },
    a05: { kind: 'guard' }, a06: { kind: 'laylow' },
    a07: { kind: 'hit', target: 'a08', place: 'mall', accept: ['a09'] },
    a09: { kind: 'back', target: 'a07' }, a10: { kind: 'back', target: 'a06' },
  });
  const log = g.log.slice(0, g.log.length - r.events.length + r.beforeDawn.eventCount);
  const v = viewFor(r.beforeDawn.state, log, null, 'record');
  const p = v.events.find(e => e.type === 'show').plays;
  assert.equal(p.a01.corner, 'docks-1');
  assert.equal(p.a04.kind, 'run');
  assert.equal(p.a04.place, 'forest');
  assert.equal(p.a02.place, 'forest');
  assert.equal(p.a03.place, 'home');
  assert.equal(p.a05.kind, 'guard');
  assert.equal(p.a05.place, 'downtown');
  assert.equal(p.a06.place, 'home');
  assert.equal(p.a10.target, 'a06');
  assert.ok(!p.a07 && !p.a09, 'leader and accepted attacker back stay hooded');
  g.advanceTo(14);
  g.night({ a01: { kind: 'board', place: 'industrial' } });
  const last = g.view(null, 'record').events.findLast(e => e.type === 'show');
  assert.deepEqual(last.plays.a01, { kind: 'board', place: 'industrial' });
});

function marketFixture() {
  const { g } = fixture();
  const priv = toFewUntil(['a01'], 5);
  // Several high-value Takes ensure diversity wins over a pure value sort, then the largest remainder fills.
  for (const value of [300, 500, 900, 500]) emit(g.s, g.log, 'rob', { night: 1, leader: 'a03', target: 'a04', place: 'docks', cash: value, pieceValue: 0 }, priv);
  emit(g.s, g.log, 'betray', { night: 1, kind: 'turn', by: 'a03', victims: ['a04'], play: secret }, priv);
  emit(g.s, g.log, 'arrest', { night: 1, agent: 'a03', place: 'docks', why: 'fight' }, toAll(g.s));
  emit(g.s, g.log, 'seized', { night: 1, agent: 'a03', copy: 'SEIZED', trait: 'SEIZED-TRAIT', fine: 9, ...secret }, toFewUntil(['a03'], 4));
  emit(g.s, g.log, 'refund', { agent: 'a02', trait: 'OUTBID', amount: 987654, ...secret }, priv);
  g.s.clock = 4;
  g.s.day = 2;
  emit(g.s, g.log, 'buy', { night: 1, agent: 'a01', trait: 'BOUGHT', copy: 'PRIVATE-SALE-COPY', price: 7 }, toAll(g.s));
  return g;
}
test('top five: highest of each kind first, value remainder, stable ties, exact receipt anchors', () => {
  const g = marketFixture();
  const selected = cards(g.view(null, 'record'));
  assert.deepEqual(selected.map(e => e.card.kind), ['Took', 'Turned', 'Booked', 'Bought', 'Outbid']);
  assert.equal(selected[0].card.value, 900, 'highest Took wins its kind');
  assert.ok(selected.every(e => g.log.some(x => x.n === e.n)), 'each card references its actual source receipt');
  const booked = selected.find(e => e.card.kind === 'Booked').card;
  assert.equal(booked.subjects.agent, 'a03', 'a booking names its subject even when hooded at the show');
  assert.equal(booked.masked, false);
  assert.equal(booked.value, 9);
  assert.equal(booked.pieces[0].trait, 'SEIZED-TRAIT');
  assert.equal(selected.find(e => e.card.kind === 'Bought').card.place, null, 'a list receipt supplies no physical place');
  assert.ok(!has(selected.map(e => e.card), 'PRIVATE-SALE-COPY'), 'list sale never identifies a copy');
  assert.ok(!has(selected.map(e => e.card), '987654'), 'outbid amount is not value moved');
  const outbid = g.log.find(e => e.type === 'refund');
  g.log = g.log.filter(e => e.n !== outbid.n);
  const filled = cards(g.view(null, 'record'));
  assert.equal(filled.length, 5);
  assert.equal(filled.at(-1).card.value, 500, 'largest remaining value fills missing kind');
  assert.equal(filled.at(-1).n, g.log.find(e => e.type === 'rob' && e.cash === 500).n, 'equal values keep receipt order');
  const first = filled.map(e => e.n);
  assert.deepEqual(cards(g.view(null, 'record')).map(e => e.n), first, 'selection repeats');
});

test('Turned names its receipt subjects even when hooded or absent at the show', () => {
  const { g } = fixture();
  const receipt = emit(g.s, g.log, 'betray', { kind: 'turn', by: 'a03', victims: ['a02', 'a03'], cash: 11 }, toFewUntil(['a02'], 5));
  for (const [who, audience] of audiences) for (const t of [4, 5]) {
    const e = cards(at(g, t, who, audience)).find(e => e.n === receipt.n);
    assert.deepEqual(e.card.subjects, { agent: 'a03', others: ['a02', 'a03'] });
    assert.equal(e.card.masked, false);
  }
});

test('Took joins the victim receipt by night, victim and attack kind', () => {
  const { g, receipt } = fixture(1, 'a03', 'burgle');
  const match = g.log.pop();
  for (const fields of [{ night: 0 }, { agent: 'a02' }, { kind: 'hit' }]) {
    emit(g.s, g.log, 'robbed', { night: 1, agent: 'a04', kind: 'breakin', by: null, ...fields }, toFewUntil(['a04'], 5));
  }
  g.log.push(match);
  for (const t of [4, 5]) {
    const e = cards(at(g, t, null, 'record')).find(e => e.n === receipt.n);
    assert.equal(e.card.subjects.agent, 'a03');
    assert.equal(e.card.masked, false);
  }
});

test('piece values come from receipt-time copy payments, never current price or hidden goods', () => {
  const { g } = fixture();
  const prior = { n: -1, t: 2, day: 1, type: 'buy', night: 0, agent: 'a04', copy: 'RUG', trait: 'RUG-TRAIT', price: 67, vis: { to: 'all', pub: 2 } };
  g.log.unshift(prior);
  emit(g.s, g.log, 'betray', { kind: 'rug', by: 'a02', victims: ['a04'], copies: ['RUG'], cash: 11, goods: { hallu: 999 }, ...secret }, toFewUntil(['a02'], 5));
  g.s.clock = 4;
  const card = cards(g.view(null, 'record')).find(e => e.card.kind === 'Turned').card;
  assert.equal(card.value, 78);
  assert.equal(card.pieces[0].trait, 'RUG-TRAIT');
  g.s.traits[Object.keys(g.s.traits)[0]].last = 999999;
  assert.deepEqual(cards(g.view(null, 'record')).find(e => e.card.kind === 'Turned').card, card);
});

test('feed identities and card replay ignore private-event gaps; disclosures replace the same id', () => {
  function play(hidden) {
    const { g } = fixture();
    const position = g.log.findIndex(e => e.type === 'show');
    const log = g.log.map((e, i) => ({ ...e, n: e.n + (i >= position ? hidden : 0) }));
    for (let i = 0; i < hidden; i++) log.splice(position, 0, { n: 10000 + i, t: 3, day: 1, type: 'say', line: 'HIDDEN', vis: { to: [], pub: DAY15 } });
    const feed = createFeed();
    return [3, 4, 5].map(t => feed.sample({ ...g.s, clock: t, day: Math.floor(t / 2) }, log, { kind: t % 2 ? 'night' : 'dawn' }));
  }
  const frames = play(0);
  assert.deepEqual(play(17), frames, 'private insertions cannot change a public byte');
  const early = frames[1].events.find(e => e.card);
  assert.ok(early, 'positive control: card reaches feed');
  const later = frames[2].events.find(e => e.id === early.id);
  assert.equal(later.type, 'rob');
  assert.deepEqual(later.card, early.card);
  for (const frame of frames) for (const e of frame.events) {
    assert.ok(!('n' in e) && !('vis' in e));
    if (e.card) assert.ok(!('n' in e.card) && !('event' in e.card), 'parent id alone anchors replay');
  }
});

