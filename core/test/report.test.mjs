// The match report's bars (GAME.md §27) count what happened, not artefacts of how the report breaks ties.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seasonMetrics } from '../bench/report.mjs';
import { runSeason } from '../bench/runner.mjs';

const cast = [{ id: 'a01', type: 'hustle', name: 'x' }, { id: 'a02', type: 'hustle', name: 'y' }];
const state = { agents: { a01: {}, a02: {} }, copies: {}, money: { in: {}, out: {} } };
const night = (n, haul) => ({ night: n, haul, fights: [], hits: [], placesChanged: false });

test('#1 changes hands only between nights where #1 is strictly ahead; a tie at the top is no #1 (§27)', () => {
  const bench = { seed: 1, rule: 'A', midseason: 'payday', nights: [
    night(1, { a01: 10, a02: 10 }),
    night(2, { a01: 10, a02: 11 }),
    night(3, { a01: 10, a02: 10 }),
    night(4, { a01: 10, a02: 11 }),
    night(5, { a01: 12, a02: 11 }),
  ] };
  const m = seasonMetrics(state, [], bench, cast);
  assert.equal(m.bars.leaderChanges.changes, 1, 'a02 leads on nights 2 and 4, a01 takes over on night 5');
});

test('a betrayal is counted once per act (§27)', () => {
  const log = [
    { type: 'betray', kind: 'walk', by: 'a01', victims: ['a02'], night: 3, day: 5 },
    { type: 'betray', kind: 'walk', by: 'a01', victims: ['a03'], night: 3, day: 5 },
    { type: 'betray', kind: 'turn', by: 'a02', victims: ['a01'], night: 4, day: 4 },
  ];
  const m = seasonMetrics(state, log, { seed: 1, rule: 'A', midseason: 'payday', nights: [] }, cast);
  assert.equal(m.bars.betrayals.total, 2);
});

test('the runner counts its ledger checks: one after every errand and every night, none failed (§23)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r1-ledger-'));
  try {
    const { metrics } = runSeason({ seed: 404, rule: 'A', outDir: dir });
    assert.ok(metrics.ledger, 'the result carries the ledger counts');
    assert.equal(metrics.ledger.nights, 14);
    assert.ok(metrics.ledger.errands > 0);
    assert.equal(metrics.ledger.failed, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
