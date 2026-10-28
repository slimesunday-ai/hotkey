// §9, §19: announce only the next unplayed shipment night; its contents wait for that morning.
// Three in-memory faults must fail these properties before the real projection is checked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Game } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { createFeed } from '../feed.mjs';

const fault = process.env.C1_SHIPMENT_FAULT;
const url = new URL('../rules/view.mjs', import.meta.url);
let source = fs.readFileSync(url, 'utf8');
if (fault) {
  const before = 'nextShipment: next === undefined ? null : { night: next },';
  const after = {
    'wrong-night': 'nextShipment: { night: 3 },',
    'early-contents': 'nextShipment: next === undefined ? null : { night: next, ...N.shipments[next] },',
    'past-night': 'nextShipment: { night: 2 },',
  }[fault];
  assert.ok(after && source.includes(before), 'fault injection site exists');
  source = source.replace(before, after).replace(/from '(\.{1,2}\/[^']+)'/g,
    (_, name) => `from ${JSON.stringify(new URL(name, url).href)}`);
}
const { viewFor } = await import(fault ? 'data:text/javascript,' + encodeURIComponent(source) : url.href);
const audiences = [[null, 'public'], [null, 'record'], ['a01', 'agent'], ['a01', 'owner'], ['a01', 'ownerAI']];

if (!fault) test('FAIL FIRST: wrong night, early contents and past night are rejected', () => {
  for (const name of ['wrong-night', 'early-contents', 'past-night']) {
    const env = { ...process.env, C1_SHIPMENT_FAULT: name };
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(process.execPath, ['--test', fileURLToPath(import.meta.url)], {
      encoding: 'utf8', env,
    });
    assert.equal(child.status, 1, `${name}: ${child.stderr}\n${child.stdout}`);
    assert.match(child.stdout, /next shipment is only the next unplayed night/, `${name}: intended property fails`);
    console.log(`FAIL FIRST ${name}: exit 1 · next shipment is only the next unplayed night`);
  }
});

test('next shipment is only the next unplayed night, for every audience before/after all 14 nights', () => {
  const g = new Game({ n: 3 });
  const nights = [2, 5, 8, 11];
  const check = (state, log, want) => {
    for (const [who, audience] of audiences) {
      assert.deepEqual(viewFor(state, log, who, audience).board.nextShipment,
        want == null ? null : { night: want },
        `next shipment is only the next unplayed night: ${audience}, clock ${state.clock}`);
    }
  };
  check({ ...g.s, day: 0, clock: 0 }, g.log, 2);
  for (let night = 1; night <= 14; night++) {
    const next = nights.find(n => n >= night) ?? null;
    check(g.s, g.log, next);
    const before = g.log.length, result = g.night();
    check(result.beforeDawn.state, g.log.slice(0, before + result.beforeDawn.eventCount),
      nights.find(n => n > night) ?? null);
    check(g.s, g.log, nights.find(n => n > night) ?? null);
  }
});

test('the core schedule owns the announcement, without exposing an unposted crate in views or feed', () => {
  const saved = N.shipments;
  try {
    // Deliberately irregular, with recognizable contents. No public projection may copy them before dawn 4.
    N.shipments = { 4: { cash: 876543, hallu: 987 }, 10: { parts: 765 } };
    const g = new Game({ n: 3 }), feed = createFeed();
    for (let night = 1; night < 4; night++) {
      for (const [who, audience] of audiences) {
        const v = viewFor(g.s, g.log, who, audience);
        assert.deepEqual(v.board.nextShipment, { night: 4 });
        assert.equal(v.board.crate, null);
        assert.ok(!JSON.stringify(v).includes('876543') && !JSON.stringify(v).includes('987'));
      }
      const frame = feed.sample(g.s, g.log, { kind: night === 1 ? 'setup' : 'dawn' });
      assert.deepEqual(frame.board.nextShipment, { night: 4 }, 'feed carries the board unchanged');
      assert.equal(frame.board.crate, null);
      assert.ok(!frame.events.some(e => e.type === 'shipment'));
      const result = g.night();
      const prefix = g.log.slice(0, g.log.length - result.events.length + result.beforeDawn.eventCount);
      const show = feed.sample(result.beforeDawn.state, prefix, { kind: 'night' });
      assert.equal(show.board.crate, null, 'contents wait through the show before shipment morning');
    }
    const dawn = feed.sample(g.s, g.log, { kind: 'dawn' });
    assert.deepEqual(dawn.board.nextShipment, { night: 4 }, 'tonight counts even after its crate is posted');
    assert.deepEqual(dawn.board.crate, { cash: 876543, goods: { doses: 987 } });
    assert.ok(dawn.events.some(e => e.type === 'shipment' && e.night === 4), 'positive control: contents at morning');
    const night = g.night();
    assert.deepEqual(viewFor(night.beforeDawn.state, g.log, null, 'public').board.nextShipment, { night: 10 });
    N.shipments = {};
    assert.equal(viewFor(g.s, g.log, null, 'public').board.nextShipment, null, 'empty schedule');
  } finally {
    N.shipments = saved;
  }
});
