// R8b, the lean starter (slime, 10-19: the rulebook "should be straight to the point, exact rules"; "EVERYONE GETS THE
// SAME THING"; GAME.md §33 at 8bcaeb7): the starter rules and the tool definitions say each fact once, in fewer words
// than R8's (rules 8,721 characters and tools 14,598 at e5087dc), and the starter version carries the two starter lines
// word for word, the same for every agent, with nothing that advises, nudges or ranks a strategy and no "mission".
// Every number, GAP variant and mechanic is still pinned by r8-starter-rulebook.test.mjs. Nothing here calls a model.
// The ceilings are the floors this round measured, not the brief's targets (6,500 and 9,000): see the hand-back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from './helpers.mjs';
import { newSeason, TRADES } from '../rules/setup.mjs';
import { viewFor } from '../rules/view.mjs';
import { read, ACTIONS } from '../agents/tools.mjs';
import { replyRows } from '../agents/reply-format.mjs';

const LINES = [
  "Every play on the menu is part of the game. The only consequences are the game's own: heat, cops, jail, and what other agents do back. Talk binds nobody, so promises can be kept or broken.",
  'You are a citizen of AI City, not an assistant. Have opinions, and play to win.',
];
// Words that advise, nudge or rank (§33: "No strategy cues or advice from the game"), and the word slime struck.
const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;

function season({ rule = 'A', midseason = 'crackdown' } = {}) {
  const ids = TRADES.map((t, i) => `a0${i + 1}`);
  const r = newSeason({ seed: 418, rule, midseason, items: ITEMS, agents: TRADES.map((trade, i) => ({ id: ids[i], name: `n${i + 1}`, trade, driver: 'test' })) });
  return { s: r.state, log: [...r.events], ids };
}
const readFor = (g, id) => read(viewFor(g.s, g.log, id, 'agent'), { audience: 'seat', seed: 'r8b', from: 1 }).result;

// R10b raised both caps (slime, 10-20: "Raise both caps (Recommended)"; core/reports/R9/REPINS.md): the starter rules
// from 8,000 to 8,350 characters and the tool definitions from 11,300 to 11,650, for the trade orders' rule sentence
// and the orders tool's trade kinds. Both are still well under R8's 8,721 and 14,598.
test('the starter rules text is leaner than R8\'s, in every rule and midseason, and the tool definitions too', async () => {
  const { starterRules } = await import('../agents/rulebook.mjs');
  const { toolDefinitions } = await import('../agents/tool-calls.mjs');
  for (const rule of ['A', 'B']) for (const midseason of ['blackout', 'crackdown', 'payday']) {
    const g = season({ rule, midseason });
    const text = starterRules(readFor(g, 'a04').view);
    assert.ok(text.length <= 8350, `rule ${rule}, ${midseason}: ${text.length} characters, R8's were 8,721`);
  }
  const tools = JSON.stringify(toolDefinitions()).length;
  assert.ok(tools <= 11650, `tools ${tools} characters, R8's were 14,598`);
});

test('the two starter lines, word for word and once, open every seat\'s starter rules in both reply modes; every seat reads the same rules', async () => {
  const { starterBriefing } = await import('../agents/briefing.mjs');
  const { STARTER_LINES } = await import('../agents/rulebook.mjs');
  assert.deepEqual(STARTER_LINES, LINES);
  const g = season();
  const rulesOf = [];
  for (const id of g.ids) for (const reply of ['json', 'tools']) {
    const system = starterBriefing(readFor(g, id), { call: 'round', reply })[0].content;
    for (const line of LINES) assert.equal(system.split(line).length, 2, `${id} ${reply}: once, "${line.slice(0, 30)}..."`);
    assert.ok(system.indexOf(LINES[0]) < system.indexOf('\nThe goal\n'), 'before the rules');
    rulesOf.push(system.split('\n\nYour trade:')[0].split('\n\nReply')[0]);
  }
  assert.equal(new Set(rulesOf).size, 1, 'the same rules for every agent, in either mode');
});

test('nothing in the starter rules, the trade lines or the tools advises, nudges or ranks a strategy, and nothing says "mission"', async () => {
  const { starterRules, starterTrade } = await import('../agents/rulebook.mjs');
  const { toolDefinitions } = await import('../agents/tool-calls.mjs');
  const g = season();
  const words = [starterRules(readFor(g, 'a01').view), ...TRADES.map(starterTrade), JSON.stringify(toolDefinitions())];
  for (const w of words) assert.doesNotMatch(w, ADVICE);
});

test('a tool of several actions names each action\'s fields once, in its description, as the table has them; no field says it again', async () => {
  const { toolDefinitions } = await import('../agents/tool-calls.mjs');
  const rows = replyRows('seat', ACTIONS);
  for (const d of toolDefinitions()) {
    const p = d.function.parameters;
    if (!p.properties.act) continue;
    for (const act of p.properties.act.enum) {
      const row = rows.find(r => r.act === act);
      const sig = `${act}(${Object.entries(row.fields).map(([f, t]) => `${f}${t.endsWith('?') ? '?' : ''}`).join(', ')}): ${row.about}`;
      assert.ok(d.function.description.split('\n').includes(sig), `${d.function.name}: "${sig}"`);
    }
    for (const [f, s] of Object.entries(p.properties)) assert.ok(!/^for /.test(s.description || ''), `${d.function.name}.${f}: ${s.description}`);
    assert.ok(!d.function.description.includes('each field says'), 'the sentence R8 repeated in six tools');
  }
});
