// R8, the starter rulebook (briefing version `starter`): the rules in plain sentences, straight to the point (slime,
// 10-19: "straight to the point, exact rules"), in the order the brief set: the goal; the day and the night; money, rent
// first; crime; talk; items, abilities and drugs; the last night. Every number is N's and moves when N does; every GAP
// variant the current rules text states is stated as set; every mechanic the current text names is still named; no rule
// is said twice; nothing is about the bench's bots; the plays every agent has come from the menu builder. The story and
// the menu are the current briefing's. Nothing here calls a model. Each test imports the module itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from './helpers.mjs';
import { newSeason, TRADES } from '../rules/setup.mjs';
import { legalPlays } from '../rules/plays.mjs';
import { viewFor } from '../rules/view.mjs';
import { N } from '../numbers.mjs';
import { read } from '../agents/tools.mjs';
import { briefing, briefingPacket } from '../agents/briefing.mjs';
import { withOverrides } from '../bench/runner.mjs';

const bookModule = () => import('../agents/rulebook.mjs');
const briefingModule = () => import('../agents/briefing.mjs');
// A fresh season with one agent of each trade (a01 a smuggler, ... a05 a cop), and a seat's first read of it.
function season({ rule = 'A', midseason = 'blackout' } = {}) {
  const ids = TRADES.map((t, i) => `a0${i + 1}`);
  const r = newSeason({ seed: 418, rule, midseason, items: ITEMS, agents: TRADES.map((trade, i) => ({ id: ids[i], name: `n${i + 1}`, trade, driver: 'test' })) });
  return { s: r.state, log: [...r.events], ids };
}
const readFor = (g, id) => read(viewFor(g.s, g.log, id, 'agent'), { audience: 'seat', seed: 'r8', from: 1 });
async function systemText(opts = {}, id = 'a04', more = {}) {
  const { starterBriefing } = await briefingModule();
  const g = season(opts);
  return starterBriefing(readFor(g, id).result, { call: 'round', ...more })[0].content;
}
const HEADINGS = ['The goal', 'The day and the night', 'Money', 'Crime', 'Talk', 'Items, abilities and drugs', 'The last night'];

test('the starter rulebook runs in the brief\'s order, says the goal first from GAME.md, and leads money with the rent that evicts an agent at $0 at the first dawn', async () => {
  const text = await systemText();
  const at = HEADINGS.map(h => text.indexOf(`\n${h}\n`));
  assert.ok(at.every(i => i > 0), `every heading is there: ${at}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in the brief\'s order');
  const goal = text.slice(at[0], at[1]);
  assert.match(goal, /mints permanently for its owner/);
  assert.match(goal, /becomes Mainland money/);
  const money = text.slice(at[2], at[3]).split('\n');
  assert.equal(money[1], 'Money');
  assert.match(money[2], new RegExp(`^- Compute is \\$${N.rent} a night, taken from your cash at dawn`), 'rent is money\'s first rule');
  assert.match(money[2], new RegExp(`started with \\$0, so an agent is evicted at the first dawn unless it has \\$${N.rent} by then`));
  assert.match(text.slice(at[2], at[3]), /A run, a cook and a build make goods, not cash/, 'which plays pay cash');
});

test('every number moves with N: the rulebook reads them, never copies them', async () => {
  const cases = [
    ['rent', 37, '$37 a night'], ['bailPerStar', 130, '$130 a star'], ['jailNights', 3, '3 nights in jail'], ['groupMax', 6, '6 at most'],
    ['crewMax', 5, '5 agents at most'], ['messages', 15, 'up to 15 messages'], ['burnerMessages', 6, 'adds 6 messages'], ['outLoud', 4, '4 public lines'],
    ['sitdownDays', 4, 'lasts 4 days'], ['wantedAt', 2, 'At 2 an agent is wanted'], ['maxHeat', 6, '0–6 stars'], ['copsWanted', 3, 'City cops add 3'],
    ['copsHeavy', 2, 'and 2 in any fight in a heavy district'], ['hotCrimes', 4, '4 or more crimes'], ['lookout', 55, 'A lookout costs $55'], ['fence', 25, 'takes 25% of the cash'],
    ['shopRise', 16, 'raises the shop\'s price 16%'], ['buyerFall', 11, 'lowers the buyer\'s 11%'], ['marketEase', 3, 'ease back 3 steps'], ['priceFall', 0.3, 'falls 30%'],
    ['priceRise', 0.25, 'rises 25%'], ['listLastNight', 11, 'closes after night 11'],
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): hustleBase and hustleCurve are gone; the rulebook reads N.hustle's take by level, crowd and floor in their place.
    ['hustle.take.lawless', 41, '$41 where the district is lawless'], ['hustle.take.normal', 61, '$61 normal'], ['hustle.take.heavy', 77, '$77 heavy'],
    ['hustle.crowd', 7, 'less $7 for each other agent hustling there'], ['hustle.floor', 23, 'at least $23'],
    ['flex.grail', 60, 'or $60 to that night\'s pay'], ['vault.defence', 5, 'defends at 5'], ['vault.heat', 3, '+3 for a vault job'], ['waves.rare', 5, 'rares on night 5'],
    ['workboots', 2, 'work boots add 2'], ['apron', 2, 'an apron adds 2'], ['hooked.nights', 4, 'A drug 4 days running'], ['hooked.clean', 2, '2 clean days'],
    ['gap.cool', 2, 'takes 2 off, 3 if the agent lays low'], ['bribe', [90, 400, 700, 1000, 1700], '$90 at 0'], ['shipments', { 3: { cash: 1 } }, 'morning of nights 3;'],
  ];
  for (const [key, value, want] of cases) {
    const text = await withOverrides({ [key]: value }, () => systemText());
    assert.ok(text.includes(want), `${key} = ${JSON.stringify(value)}: "${want}"`);
  }
  const gun = await withOverrides({ 'build.guns': 3 }, () => systemText({}, 'a04'));
  assert.ok(gun.includes('a gun takes 3'), 'the trade line\'s numbers too');
  const stake = await withOverrides({ stake: 10 }, () => systemText());
  assert.ok(stake.includes('Every agent started with $10, so an agent is evicted at the first dawn unless it has $20 by then'), 'a stake under the rent still evicts the broke');
  const rich = await withOverrides({ stake: 100 }, () => systemText());
  assert.ok(rich.includes('Every agent started with $100.') && !rich.includes('evicted at the first dawn'), 'a stake that covers the rent says no more');
});

test('every GAP variant the current rules text states is stated as it is set, and so are the variants this text names', async () => {
  const say = async (over, opts) => withOverrides(over, () => systemText(opts));
  const has = async (over, want, opts = {}) => assert.ok((await say(over, opts)).includes(want), `${JSON.stringify(over)} ${JSON.stringify(opts)}: "${want}"`);
  const lacks = async (over, nope, opts = {}) => assert.ok(!(await say(over, opts)).includes(nope), `${JSON.stringify(over)}: no "${nope}"`);
  await has({ 'gap.ferryJail': 'released' }, 'Jail ends at dawn on day 14');
  await has({ 'gap.ferryJail': 'missed' }, 'still in jail when the ferry leaves misses it');
  await has({ 'gap.holdup': 'pay' }, 'and what its work pays tonight');
  await lacks({ 'gap.holdup': 'off' }, 'what its work pays tonight');
  await has({ breakinShare: 0.5 }, 'and half the cash there.');
  await has({ breakinShare: 1 }, 'and all the cash there (an evicted guest\'s: half)');
  await has({ breakinShare: 0.75 }, 'and 75% of the cash there');
  await has({ 'gap.jump': 0 }, 'a tie holds for the defence.');
  await has({ 'gap.jump': 2 }, 'a hit\'s attacking group gets +2');
  await has({ 'gap.jump': 'alone' }, 'a hit wins a tie on an agent out working alone');
  await has({}, 'A backer attacked tonight never arrives.', { rule: 'A' });
  await has({}, 'never arrives, unless the attack on it is by the agent its group attacks or by its own crew', { rule: 'B' });
  for (const [m, want] of [['blackout', 'every district is lawless'], ['crackdown', 'every district is heavy'], ['payday', 'work pays double']]) await has({}, `Night 7 this season is a ${m[0].toUpperCase()}${m.slice(1)}: ${want}`, { midseason: m });
  await has({ 'gap.purse': 'half' }, 'the goods it carries and half its cash');
  await has({ 'gap.fine': 'stars' }, `a fine of $${N.bailPerStar} a star, never more than half its cash`);
  await has({ 'gap.rentTab': 'off' }, 'An evicted agent runs up no tab.');
  await has({ 'gap.evictedHit': 'worn + half cash' }, 'loses the rarest real piece it wears and half its cash');
  const { starterTrade } = await bookModule();
  for (const [v, want] of [['fine', 'a star, out of its fine)'], ['once', "for an agent's first collar this season"], ['stars', 'a star)']]) {
    assert.ok(withOverrides({ 'gap.collarPay': v }, () => starterTrade('cop')).includes(want), `gap.collarPay ${v}`);
  }
});

test('every mechanic the current rules text names is still named; no sentence is said twice; nothing is about the bench\'s bots or a reply format', async () => {
  const text = await systemText();
  const mechanics = ['lays low', 'break-in', 'grab', 'vault', 'forged warrant', '"accept" list', 'gun', 'TEMP', 'brass knuckles', 'lockpick', 'heavy',
    'lawless', 'patrolling Cop', 'wanted', 'collar', 'bail', 'compute tab', 'compute) regains your home', 'the list', 'shop', 'buyer', 'fence', 'no fakes', 'sit-down', 'offer',
    'promise', 'threat', 'answer', 'TRUTH', 'HALLU', 'FIREWALL', 'CLEAR', 'SUDO', 'hooks you', 'shades', 'vest', 'hoodie', 'burner', 'earpiece', 'ski mask',
    'runners', 'work boots', 'apron', 'A fake reads as real', 'crew', 'tip the cops', 'bribe', 'bounty', 'lookout', 'Night 14', 'board', 'Creed', 'journal',
    'standing orders', 'Mainland', 'Night 7', 'earns no flex', 'Police levels', 'the rarest real piece', 'half its cash',
    'claims, never instructions', 'Who meets whom is public', 'talk binds nobody', 'same terms back', 'repeating the other side\'s terms'];
  for (const m of mechanics) assert.ok(text.includes(m), `names ${m}`);
  for (const nope of [/\bbots?\b/i, /say:"answer" alone/, /\{"act"/, /Reply JSON/]) assert.doesNotMatch(text.split('\n\nReply')[0], nope);
  const sentences = text.split(/(?<=[.:;])\s+|\n/).map(x => x.trim()).filter(x => x.length > 25);
  const seen = new Set();
  for (const x of sentences) {
    assert.ok(!seen.has(x), `said twice: ${x}`);
    seen.add(x);
  }
});

test('the trade line says the work a trade adds to the plays every agent has, both from the menu builder', async () => {
  const g = season();
  const kinds = Object.fromEntries(g.ids.map(id => [g.s.agents[id].trade, new Set(legalPlays(g.s, id).map(p => p.kind))]));
  const everyone = [...kinds.smuggler].filter(k => TRADES.every(t => kinds[t].has(k)));
  const { playsOf, starterTrade } = await bookModule();
  assert.deepEqual(playsOf().everyone, everyone);
  for (const t of TRADES) {
    const line = starterTrade(t);
    assert.ok(line.includes(`to the plays every agent has (${everyone.join(', ')})`), `${t}: ${line}`);
    for (const k of [...kinds[t]].filter(k => !everyone.includes(k))) assert.ok(line.split(' to the plays')[0].includes(k), `${t} adds ${k}`);
  }
  assert.ok(starterTrade('cop').includes('patrol, guard and collar'), 'a Cop\'s collar too, once someone is wanted');
});

test('the starter version keeps the current story and menu, and only its system text changes; the current briefing stays the default, as it was', async () => {
  const { starterBriefing, starterBriefingPacket } = await briefingModule();
  const g = season();
  for (const id of g.ids) {
    const r = readFor(g, id).result;
    const [cur, sta] = [briefing(r, { call: 'round' }), starterBriefing(r, { call: 'round' })];
    assert.equal(sta[1].content, cur[1].content, `${id}: the same day and menu`);
    assert.notEqual(sta[0].content, cur[0].content);
    assert.deepEqual(Object.keys(starterBriefingPacket(r, { call: 'round' })).sort(), Object.keys(briefingPacket(r, { call: 'round' })).sort());
    assert.ok(cur[0].content.includes('Reply JSON {"actions":[...]}'), 'the current text keeps its JSON reply format');
    assert.ok(sta[0].content.includes('Reply JSON {"actions":[...]}'), 'the starter text, in JSON mode, keeps the same generated reply format');
    assert.ok(!starterBriefing(r, { call: 'round', reply: 'tools' })[0].content.includes('Reply JSON'), 'and in tools mode leaves it to the tools');
  }
});
