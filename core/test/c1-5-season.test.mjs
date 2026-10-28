import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSeason } from '../bench/runner.mjs';
import { CASTS } from '../bench/bots.mjs';
const tmp = process.env.C1_5_FEED ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'c1-5-season-'));
if (tmp) runSeason({ seed: 404, rule: 'A', mix: CASTS.layer4, feed: true, outDir: tmp });
const feedPath = process.env.C1_5_FEED || path.join(tmp, '404-A', 'feed.jsonl');
after(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

test('saved season: every night carries plays and every dawn carries exactly the selected cards', () => {
  const frames = fs.readFileSync(feedPath, 'utf8').trim().split('\n').map(JSON.parse);
  const dawns = frames.filter(f => f.step.kind === 'dawn');
  const nights = frames.filter(f => f.step.kind === 'night');
  assert.ok(nights.length && dawns.length, 'whole-season controls');
  for (const f of nights) {
    const show = f.events.find(e => e.type === 'show' && e.night === f.day);
    assert.ok(show?.plays && Object.keys(show.plays).length, `night ${f.day}: plays`);
    assert.ok(!f.events.some(e => e.card?.night === f.day), 'no early morning cards');
  }
  for (const f of dawns) {
    const selected = f.events.filter(e => e.card?.night === f.day - 1);
    assert.ok(selected.length <= 5, 'at most five cards');
    // Compare to the final forms retained by identity, so an empty night remains an empty card set.
    const final = new Map(frames.flatMap(x => x.events).map(e => [e.id, e]));
    const expected = [...final.values()].filter(e => e.card?.night === f.day - 1);
    assert.deepEqual(selected.map(e => e.id).sort(), expected.map(e => e.id).sort(), `dawn ${f.day}: exact selected set`);
  }
  assert.ok(dawns.some(f => f.events.some(e => e.card)), 'positive control: morning cards exist in this run');
});
