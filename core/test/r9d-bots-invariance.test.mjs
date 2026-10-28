// R9d, Part A (docs/briefs/R9d-trade-you-can-read.md, item 4): the bots' asks now say what they're for, and a buyer
// answers a counter or a question; a bot-only season plays exactly as before. Pinned here, from trunk 097c990 (before
// R9d) on the bench's cast and the canny cast at no model seats: each season's fight outcome hash (metrics.mjs
// `outcome`) and every seat's haul, as a digest of the hauls in seat order. The full check (seeds 404-423, rules A and
// B, every event but the ask lines) is in the R9d hand-back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// Re-pinned by R11, hustles replace the shift (slime, 10-21: "they should be robbing npcs, doing crime", and on the
// build: "let's just do that"; core/reports/R9/REPINS.md): every bot-only season plays differently by design.
// They were 1020553383 / e395fb304c0160be, 1660163866 / 2932fd74896d6c2f, 3076710848 / d8f44f7aa1cb7014 and
// 1316726956 / 985b4af443e5c343.
const PINS = [
  { seed: 404, cast: 'default', outcome: 1042697977, hauls: '57867f011f509eb0' },
  { seed: 418, cast: 'default', outcome: 2767182580, hauls: '6cbb160ee30ce8c5' },
  { seed: 404, cast: 'models-canny', outcome: 811881037, hauls: '3d962378047e2ecc' },
  { seed: 418, cast: 'models-canny', outcome: 2548410205, hauls: '54c65c552448feb5' },
];
const digest = haul => crypto.createHash('sha256')
  .update(JSON.stringify(Object.keys(haul).sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))).map(id => [id, haul[id]]))).digest('hex').slice(0, 16);

test('a bot-only season comes out as it did before R9d: the outcome hash and every seat\'s haul (§25)', async () => {
  const { runSeason, mixOf } = await import('../bench/runner.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r9d-inv-'));
  try {
    for (const p of PINS) {
      const mix = p.cast === 'default' ? mixOf({}) : mixOf({ cast: p.cast, 'model-seats': '0' });
      const { metrics } = runSeason({ seed: p.seed, rule: 'A', outDir: path.join(dir, p.cast), mix, quiet: true });
      assert.deepEqual({ outcome: metrics.outcome, hauls: digest(metrics.haul) }, { outcome: p.outcome, hauls: p.hauls }, `${p.seed}-A, ${p.cast}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
