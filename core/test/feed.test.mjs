import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeed, islandMinute } from '../feed.mjs';
import { viewFor } from '../rules/view.mjs';
import { emit, toAll, toFew, toFewUntil, DAY15, DRUGS } from '../rules/state.mjs';
import { Game } from './helpers.mjs';

const has = (value, token) => JSON.stringify(value).includes(token);
const step = { kind: 'errand', round: 1 };
const memory = patch => ({ plan: [], orders: [], creed: [], journal: [], ...patch });
// Plant in the typed ledger's actual private slots, independent of which habits a season's bots happen to exercise.
const slots = [
  ['play reason', 'play', x => ({ agent: 'a01', reason: x })],
  ['sit-down line', 'say', x => ({ from: 'a01', to: 'a02', line: x })],
  ['sit-down terms', 'say', x => ({ from: 'a01', to: 'a02', terms: { what: 'back', who: x } })],
  ['holdings', 'holdings', x => ({ agent: 'a01', pieces: [{ copy: x }], cash: 777123 })],
  ['take', 'take', x => ({ agent: 'a01', drug: 'hallu', leads: [x] })],
  ['SUDO write', 'write', x => ({ by: 'a01', agent: 'a02', play: { kind: 'back', target: x } }), 3],
  ['HALLU lies', 'lies', x => ({ agent: 'a01', lies: [x] }), DAY15],
  ['fake maker', 'fake', x => ({ act: 'made', agent: x, copy: 'fake-copy' }), DAY15],
  ['warrant maker', 'used', x => ({ agent: 'a01', goods: { warrants: 1 }, maker: x })],
  ['bounty poster', 'bounty', x => ({ act: 'post', by: x, agent: 'a02', amount: 77 })],
  ['lookout target', 'look', x => ({ by: 'a01', agent: x, cash: 88 })],
  ['tipper', 'tip', x => ({ by: x, agent: 'a02', target: 'a03' })],
  ['memory plan', 'memory', x => ({ agent: 'a01', part: 'plan', memory: memory({ plan: [{ trait: x, routes: ['hit', 'buy'] }] }) })],
  ['memory orders', 'memory', x => ({ agent: 'a01', part: 'orders', memory: memory({ orders: [{ kind: 'back', agent: x }] }) })],
  ['memory Creed', 'memory', x => ({ agent: 'a01', part: 'creed', memory: memory({ creed: [x] }) })],
  ['memory dawn journal', 'memory', x => ({ agent: 'a01', part: 'dawn', memory: memory({ journal: [{ day: 1, line: x }] }) })],
  ['crew chat', 'chat', x => ({ crew: 'c1', from: 'a01', line: x, say: 'tell' })],
  ['close', 'close', x => ({ sitdown: 's1', a: 'a01', b: 'a02', by: x, why: 'left' })],
  ['give', 'give', x => ({ from: 'a01', to: 'a02', copies: [x] })],
  ['pay', 'pay', x => ({ from: 'a01', to: 'a02', amount: 77, for: { what: 'piece', copy: x } })],
];

for (const [name, type, fields, delay = 2] of slots) test(`private slot: ${name} waits for publication and then reaches a frame`, () => {
  const g = new Game({ n: 3 });
  const feed = createFeed();
  const token = `PRIVATE-${name.replaceAll(' ', '-')}-CANARY`;
  const vis = delay === DAY15 ? toFewUntil(['a01'], DAY15) : toFew(g.s, ['a01'], delay);
  const event = emit(g.s, g.log, type, fields(token), vis);
  assert.ok(has(viewFor(g.s, g.log, 'a01'), token), 'control: the private audience can see the planted slot');
  for (let t = g.s.clock; t < event.vis.pub; t++) {
    g.s.clock = t;
    g.s.day = Math.floor(t / 2);
    const frame = feed.sample(g.s, g.log, step);
    assert.ok(!has(frame, token), `${name}: absent at ${t}, before ${event.vis.pub}`);
    if (name === 'holdings') assert.ok(!has(frame, '777123'), 'stash cash is private too');
  }
  g.s.clock = event.vis.pub;
  g.s.day = Math.floor(g.s.clock / 2);
  const published = feed.sample(g.s, g.log, step);
  assert.ok(has(published, token), `${name}: positive control at publication`);
  if (name === 'holdings') assert.ok(has(published, '777123'), 'positive control: disclosed cash');
  assert.ok(published.events.some(e => e.type === type && has(e, token)), 'the event itself survives, even if the board also changes');
});

test('seat-only fight, run and hustle numbers never enter any frame', () => {
  const g = new Game({ n: 3 });
  const feed = createFeed();
  const owner = viewFor(g.s, g.log, 'a01');
  for (const name of ['fight', 'run', 'hustle']) assert.ok(owner.me[name], `control: owner has ${name}`);
  for (let t = g.s.clock; t <= DAY15; t++) {
    // These slots have no publication event. Mark their containing state as well, to catch accidental state copies.
    for (const name of ['fight', 'run', 'hustle']) g.s.agents.a01[name] = `SEAT-ONLY-${name}`;
    const frame = feed.sample(g.s, g.log, step);
    assert.ok(!has(frame, 'SEAT-ONLY-'));
    if (frame) {
      assert.ok(!('me' in frame) && !('legal' in frame));
      for (const agent of frame.board?.agents || []) for (const name of ['fight', 'run', 'hustle']) assert.ok(!(name in agent));
    }
    g.s.clock++;
    g.s.day = Math.floor(g.s.clock / 2);
  }
});

test('drug names wait for the core 24-hour boundary; live goods are doses, changed forms retain their id', () => {
  const g = new Game({ n: 3 });
  const feed = createFeed();
  // A shipment is live, but every drug in its goods (including nested goods) must remain anonymous for two half-days.
  const goods = Object.fromEntries(DRUGS.map(d => [d, 1]));
  emit(g.s, g.log, 'shipment', { agent: 'a02', goods, nested: { goodsLeft: goods } }, toAll(g.s));
  let id;
  for (let age = 0; age <= 2; age++) {
    g.s.clock = 2 + age;
    g.s.day = Math.floor(g.s.clock / 2);
    const frame = feed.sample(g.s, g.log, { kind: age === 1 ? 'night' : 'dawn' });
    if (age === 1) {
      assert.ok(!frame?.events.some(e => e.type === 'shipment'), 'unchanged event form is not repeated');
      for (const d of DRUGS) assert.ok(!has(frame, `"${d}"`));
    }
    else {
      const event = frame.events.find(e => e.type === 'shipment');
      assert.ok(event);
      if (age === 0) id = event.id;
      assert.equal(event.id, id);
      for (const d of DRUGS) assert.equal(has(frame, `"${d}"`), age === 2, `${d}: age ${age}`);
      if (age === 0) assert.equal(event.goods.doses, DRUGS.length, 'control: live quantity still arrives');
    }
  }
});

test('private steps leave no trace: local identities and all event references ignore hidden-event gaps', () => {
  function play(hidden) {
    const g = new Game({ n: 3 });
    const feed = createFeed();
    const frames = [feed.sample(g.s, g.log, step)];
    for (let j = 0; j < hidden; j++) {
      emit(g.s, g.log, 'say', { line: 'HIDDEN' }, toFewUntil(['a01'], DAY15));
      assert.equal(feed.sample(g.s, g.log, step), null, 'no private-step frame');
    }
    const a = emit(g.s, g.log, 'meet', { a: 'a01', b: 'a02' }, toAll(g.s));
    const b = emit(g.s, g.log, 'outloud', { agent: 'a01', line: 'hello' }, toAll(g.s));
    emit(g.s, g.log, 'orders', { agent: 'a01', origin: 'orders', of: [a.n, b.n] }, toAll(g.s));
    frames.push(feed.sample(g.s, g.log, step));
    return frames;
  }
  const frames = play(0);
  assert.deepEqual(play(17), frames, 'private insertions do not change even one public byte');
  const events = frames.flatMap(f => f.events);
  assert.deepEqual(events.map(e => e.id), events.map((_, i) => i), 'contiguous local ids');
  const provenance = events.find(e => e.type === 'orders');
  assert.deepEqual(provenance.of.map(id => events.find(e => e.id === id).type), ['meet', 'outloud']);
  for (const e of events) assert.ok(!('n' in e) && !('vis' in e));
});

test('unpublished references disclose neither their numbers nor their count, and are updated once public', () => {
  const g = new Game({ n: 3 });
  const feed = createFeed();
  const privateEvent = emit(g.s, g.log, 'say', { line: 'LATER' }, toFew(g.s, ['a01']));
  emit(g.s, g.log, 'orders', { agent: 'a01', of: [privateEvent.n] }, toAll(g.s));
  const first = feed.sample(g.s, g.log, step).events.find(e => e.type === 'orders');
  assert.deepEqual(first.of, []);
  g.s.clock += 2;
  g.s.day++;
  const after = feed.sample(g.s, g.log, step);
  const changed = after.events.find(e => e.type === 'orders');
  assert.equal(changed.id, first.id);
  assert.deepEqual(changed.of, [after.events.find(e => e.type === 'say').id]);
});

test('nominal island minutes place every round strictly between Eastern dawn and lock', () => {
  for (const rounds of [1, 3, 7]) for (const day of [1, 7, 14]) {
    const times = Array.from({ length: rounds }, (_, i) => islandMinute(day, { kind: 'errand', round: i + 1 }, rounds));
    assert.ok(times.every((t, i) => t > day * 1440 + 360 && t < day * 1440 + 1260 && (!i || t > times[i - 1])));
    assert.equal(islandMinute(day, { kind: 'night' }), day * 1440 + 1260);
    assert.equal(islandMinute(day + 1, { kind: 'dawn' }), (day + 1) * 1440 + 360);
  }
});
