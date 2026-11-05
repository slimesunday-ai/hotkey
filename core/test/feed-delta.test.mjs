// Orchestrator: "a frame that changes no sightings (or board) must not repeat them".
// Decoder/player seam coverage lives in style/city/tools/feedreadercheck.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeed } from '../feed.mjs';
import { Game } from './helpers.mjs';

test('a live-only errand repeats neither board nor sightings, and resumed encoding is identical', () => {
  const g=new Game({n:3}), feed=createFeed();
  const setup=feed.sample(g.s,g.log,{kind:'setup'});
  assert.ok(Object.hasOwn(setup,'board')&&Object.hasOwn(setup,'sightings'));
  g.errand('a01','note',{line:'private'});
  const act=feed.sample(g.s,g.log,{kind:'errand',round:1});
  assert.equal(act.events.filter(e=>e.type==='act').length,1);
  assert.ok(!Object.hasOwn(act,'sightings')&&!Object.hasOwn(act,'board'));
  const resumed=createFeed({saved:JSON.parse(JSON.stringify(feed.save()))});
  assert.equal(resumed.sample(g.s,g.log,{kind:'errand',round:1}),null);
  g.errand('a02','note',{line:'another private note'});
  assert.deepEqual(resumed.sample(g.s,g.log,{kind:'errand',round:1}),feed.sample(g.s,g.log,{kind:'errand',round:1}));
});
