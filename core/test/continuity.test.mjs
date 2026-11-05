// GAME §41, 10-30: "you watch X mask up and do it"; agents' knowledge stays §19.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { viewFor } from '../rules/view.mjs';
import { createFeed } from '../feed.mjs';
import { read } from '../agents/tools.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { briefing } from '../agents/briefing.mjs';

for (const kind of ['hit', 'breakin']) test(`following ${kind}: typed resolved places, viewer only, unchanged seats and sightings`, () => {
  const g = new Game({ n: 5 });
  if (kind === 'breakin') {
    addGoods(g.s.agents.a01, 'lockpicks', 1);
    bookGoods(g.s, 'in', 'test', 'lockpicks', 1);
  }
  const feed = createFeed();
  const setup = feed.sample(g.s, g.log, { kind: 'setup' });
  assert.ok(!setup.events.some(e => Object.hasOwn(e, 'masked')));
  const r = g.night({
    a01: { kind, target: 'a03', ...(kind === 'hit' ? { place: 'mall' } : {}), accept: ['a02'] },
    a02: { kind: 'back', target: 'a01' }, a03: { kind: 'laylow' },
    a04: { kind: 'back', target: 'a01' },
  });
  const log = g.log.slice(0, g.log.length - r.events.length + r.beforeDawn.eventCount);
  const state = r.beforeDawn.state;
  const viewer = viewFor(state, log, null, 'record');
  const show = viewer.events.find(e => e.type === 'show');
  // §41, 10-31: "Who and where show"; the resolved fight is part of the follower’s typed anchor.
  const wanted = kind === 'breakin' ? { place: 'suburbs', home: 'a03', fight: r.events.find(e => e.type === 'fight').n } : { place: 'mall' };
  assert.deepEqual(show.masked, { a01: wanted, a02: wanted });
  assert.ok(!Object.hasOwn(show.seen, 'a01') && !Object.hasOwn(show.seen, 'a02'));
  assert.ok(Object.hasOwn(show.seen, 'a04'), 'unaccepted back stays unmasked');
  const without = log.map(e => { const copy = structuredClone(e); delete copy.masked; return copy; });
  assert.deepEqual(viewer.sightings, viewFor(state, without, null, 'record').sightings);
  for (const audience of ['agent', 'owner', 'ownerAI', 'public']) for (const id of audience === 'public' ? [null] : Object.keys(state.agents)) {
    const actual = viewFor(state, log, id, audience);
    assert.deepEqual(actual, viewFor(state, without, id, audience));
    assert.ok(!actual.events.some(e => e.type === 'show' && Object.hasOwn(e, 'masked')));
  }
  for (const id of Object.keys(state.agents)) {
    assert.deepEqual(briefing(read(viewFor(state, log, id, 'agent'), { audience: 'seat', seed: 'continuity' }).result),
      briefing(read(viewFor(state, without, id, 'agent'), { audience: 'seat', seed: 'continuity' }).result));
  }
  const night = feed.sample(state, log, { kind: 'night' });
  const published = structuredClone(show.masked);
  const ids = new Map(feed.save().ids);
  for (const at of Object.values(published)) if (at.fight !== undefined) at.fight = ids.get(at.fight);
  assert.deepEqual(night.events.find(e => e.type === 'show').masked, published);
  // slime, 10-31, on the slimmer feed (readers carry unchanged sightings forward): "Slim"; test the same resolved sightings across a wire delta.
  const sightings = night.sightings ?? setup.sightings;
  assert.deepEqual(sightings, viewer.sightings);
  assert.ok(!JSON.stringify(sightings).includes('"masked"'));
  show.masked.a01.place = 'forest';
  assert.equal(viewFor(state, log, null, 'record').events.find(e => e.type === 'show').masked.a01.place, wanted.place);
});
