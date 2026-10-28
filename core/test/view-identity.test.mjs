// 2026-10-27: re-pin bot reason prose for slime's call, "the first 2 we should do" (rent is now compute); plays and rules unchanged.
// 2026-10-27: re-pin only brief digests for slime's call, "2. compute is more meanigful to agents than rent".
// R6 view-perf: a view's archive is built when first read, and copies and handles are dealt by plain loops; none of it
// may change a byte any reader sees. For seeds 404-406 (rule A, layer4), every seat's briefing (messages and speech
// ids), every lookup page, the owner's AI read and every bot decision hash to what dfb165b gives
// (fixtures/view-identity-dfb165b.json, from `node core/test/view-identity.mjs <dfb165b's core>`). Re-pinned from
// trunk 9550334 after §19's sale-copy fix: only the lookup digests changed, and trunk 9550334 with nothing but list
// sales' copies removed from the currentView page reproduces all 24 fields exactly (docs/redesign/privacy-20261018.md).
// Re-pinned by R8 when gap.jump became 'alone' (slime, 10-19: "do 1 and 2"; core/reports/R8/ALONE-DEFAULT.md): every
// field moved, and the same checkout with gap.jump 0 still reproduces the previous fixture exactly. Re-pinned again when
// gap.briefing rose to 21,000 characters (slime, 10-19: "raise the per-call limit to 21,000"): only the three
// briefing digests moved; calls, pages, events, lookups, owner AI reads and bot decisions are unchanged.
// Re-pinned by R9 (slime, 10-19: "Ok fix 1 and 2"; core/reports/R9/REPINS.md): the brief, lookup, owner AI and end
// digests moved (the seat's new screen lines, the view's actionState agree and me.dealt, the state's dealsDone);
// calls, pages, events and bot decisions are unchanged.
// Re-pinned when gap.briefing rose to 25,000 characters (slime, 10-19: "Yeah bump to 25k"): only the three briefing
// digests moved; calls, pages, events, lookups, owner AI reads and bot decisions are unchanged.
// Re-pinned by R9c (slime, 10-19: "Show hit strength numbers"; core/reports/R9/REPINS.md): the brief, lookup and owner
// AI digests moved (the menu's fight numbers; me.fight in the state lookup and the owner AI's read); calls, pages,
// events, bot decisions and end are unchanged.
// Re-pinned by R9d (core/reports/R9/REPINS.md): the brief, lookup, owner AI, bots and end digests moved (bot asks' lines,
// street prices, the rent and goods lines, patrols on the record); calls, pages and events are unchanged, and with the
// asks' lines stripped the bots digests equal the previous ones.
// Re-pinned by R9e (slime, 10-20: "Run numbers, then test"; core/reports/R9/REPINS.md): the brief, lookup and owner
// AI digests moved (the menu's run numbers; me.run in the state lookup and the owner AI's read; board.marketSteps);
// calls, pages, events, bots and end are unchanged, and with those three stripped every digest equals the previous one.
// Re-pinned by R10a (slime, 10-20: "Alright let's start with 1 and 2 and see if that helps us";
// core/reports/R9/REPINS.md): only the brief digests moved (the reworded tools line and day line); with those two lines
// as they were, every digest equals the previous one.
// Re-pinned by R10b (slime, 10-20: "Alright let's start with 1 and 2 and see if that helps us";
// core/reports/R9/REPINS.md): only the brief digests moved (the trade orders' lines, rule sentence and tool text);
// with those and the order kinds' list as they were, every digest equals the previous one.
// Re-pinned by R11 step 1, the shift renamed to hustle (slime, 10-21: "let's just do that, and run the tests after to
// save movey"; core/reports/R9/REPINS.md): with "hustle" mapped back to "shift", calls, pages, events, lookup, owner AI,
// bots and end equal the previous digests; the briefs differ only where the briefing's length cut kept less.
// Re-pinned by R11, hustles replace the shift (slime, 10-21: "they should be robbing npcs, doing crime", and on the
// build: "let's just do that"; core/reports/R9/REPINS.md): every digest moved, since every season plays differently.
// Re-pinned by C1-5/C1-5c (slime, 10-27: "go with our suggestions"; core/reports/C1-5.md): only the three owner AI
// digests moved for the public show plays, morning cards (including corrected attribution) and board.nextShipment.
// With show.plays, morning cards and board.nextShipment stripped, every digest and count equals the previous fixture
// (core/reports/C1-5c-verify.mjs); briefing, lookup, bots and end are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identity } from './view-identity.mjs';
import { viewFor } from '../rules/view.mjs';
import { Game } from './helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'view-identity-dfb165b.json'), 'utf8'));

test('seats, lookups, owner AI reads and bots read the same bytes as dfb165b, seeds 404-406', async () => {
  assert.deepEqual(await identity(), GOLDEN);
});

test('a view read later shows its archive as the ledger stood when the view was built', () => {
  const g = new Game({ n: 4 });
  const early = viewFor(g.s, g.log, 'a01', 'agent');
  const eager = JSON.parse(JSON.stringify(viewFor(g.s, g.log, 'a01', 'agent')));
  g.errand('a01', 'ask', { to: 'a02', line: 'meet me' });
  g.night();
  assert.deepEqual(JSON.parse(JSON.stringify(early)), eager);
  const later = viewFor(g.s, g.log, 'a01', 'agent');
  assert.ok(later.me.history.length > early.me.history.length);
  early.me.speech = [];
  assert.deepEqual(early.me.speech, []);
});
