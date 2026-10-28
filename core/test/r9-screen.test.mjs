// R9, changes 2, 3 and 4 (brief R9-agents-work-their-trade, and its addendum): facts on the seat's screen, never advice.
// - Rent as the seat's own consequence: at home and short of the rent, what dawn does; evicted, the tab, how it grows,
//   how the dock takes it, and the rent errand. Numbers from N.
// - The goods it holds, with the city buyer's one-unit price now and the agents whose trade uses them (rules/setup.mjs
//   USED_BY, the one owner the bots read too).
// - Its own record, a line a night, from the typed events its view holds, checked here against the raw ledger over a
//   full $0 season (seed 418, the canny cast); and who it has dealt with, a line each, which outlives the sit-down.
// - No new line uses a word §33's advice check bans (r8b-lean's list).
// Nothing here calls a model.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Game, ITEMS } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { newSeason, USED_BY } from '../rules/setup.mjs';
import { viewFor } from '../rules/view.mjs';
import { addGoods, bookGoods, LAST_NIGHT } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { read } from '../agents/tools.mjs';
import { toolDefinitions } from '../agents/tool-calls.mjs';
import { starterBriefingPacket, briefing, rentLines, goodsLines, recordLines, dealingsLines, CONTINUITY } from '../agents/briefing.mjs';
import { STARTER } from '../agents/rulebook.mjs';
import { runSeason, withOverrides } from '../bench/runner.mjs';
import { CASTS } from '../bench/bots.mjs';

const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;
const seen = (s, log, id) => read(viewFor(s, log, id, 'agent'), { audience: 'seat', seed: 'r9-screen' }).result;
function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}

test('rent: the line shows at home with less spendable cash than the rent, and not at the rent, in jail or on the last night', () => {
  const g = new Game({ n: 3 });
  const line = () => rentLines(seen(g.s, g.log, 'a01').view);
  g.grant('a01', N.rent - 1);
  assert.deepEqual(line(), [`Compute: $${N.rent} due at dawn unless in jail; with less by then (tonight's pay and lock sales count) you're evicted. A run, cook or build pays no cash. Once evicted: every dawn out of jail adds $${N.rent} to a compute tab, paid at dock from your cash, else with the rarest piece you carry; you can't lay low, and nobody can break in on you; a won hit on you, or a won break-in at a home you're in, reaches half your cash and every piece you hold; an arrest seizes the rarest piece you hold. rent ($${N.rent} compute) restores your home and leaves the tab.`]);
  g.grant('a01', 1);
  assert.deepEqual(line(), [], 'at the rent: none');
  // A shop order's held cash is not spendable: the line counts spendable cash.
  g.grant('a01', N.shopPrice.chems);
  assert.equal(g.errand('a01', 'shop', { item: 'chems', units: 1, max: N.shopPrice.chems + 1 }).ok, true);
  assert.equal(g.s.agents.a01.cash, N.rent - 1, 'control: the max is held');
  assert.equal(line().length, 1, 'cash held for an order is not spendable');
  g.s.agents.a01.jail = { nights: 1, stars: 1, since: 0 };
  assert.deepEqual(line(), [], 'in jail: none');
  g.s.agents.a01.jail = null;
  g.s.day = LAST_NIGHT;
  g.s.clock = 2 * LAST_NIGHT;
  assert.deepEqual(line(), [], 'no rent after the last night');
});

test('rent: evicted, the line shows the tab, how it grows, how the dock takes it and the rent errand; the tab moves with the rules', () => {
  // Three smugglers at $0 shift at the docks, paid at least the shift's minimum: housed. Evict a01 the rules' way.
  const h = new Game({ n: 3 });
  h.s.agents.a01.cash = 0;
  h.night({ a01: { kind: 'run', place: Object.keys(N.drops)[0] } });
  const v = () => seen(h.s, h.log, 'a01').view;
  assert.equal(h.s.agents.a01.evicted, true, 'control: evicted at the first dawn');
  const text = tab => `Evicted: compute tab owed $${tab}; each dawn out of jail adds $${N.rent}; at the dock it's paid from your cash, else with the rarest piece you carry. You can't lay low, and nobody can break in on you; a won hit on you, or a won break-in at a home you're in, reaches half your cash and every piece you hold; an arrest seizes the rarest piece you hold. rent ($${N.rent} compute) restores your home now and leaves the tab.`;
  assert.deepEqual(rentLines(v()), [text(h.s.agents.a01.tab)]);
  h.night({ a01: { kind: 'run', place: Object.keys(N.drops)[0] } });
  assert.equal(h.s.agents.a01.tab, N.rent, 'control: a dawn evicted adds the rent');
  assert.deepEqual(rentLines(v()), [text(N.rent)], 'the line reads the tab');
  withOverrides({ 'gap.rentTab': 'off' }, () => assert.deepEqual(rentLines(v()), [`Evicted: no compute tab accrues. You can't lay low, and nobody can break in on you; a won hit on you, or a won break-in at a home you're in, reaches half your cash and every piece you hold; an arrest seizes the rarest piece you hold. rent ($${N.rent} compute) restores your home now.`]));
  // Home again by the rent errand: the evicted line goes.
  h.grant('a01', N.rent);
  h.errand('a01', 'rent');
  assert.ok(!rentLines(v()).some(l => l.startsWith('Evicted')));
});

test('goods: one line names what the seat holds, the city buyer\'s price now for each kind it buys, and the agents whose trade uses chems, parts and doses', () => {
  const ids = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06'];
  const trades = ['smuggler', 'chemist', 'dealer', 'gunrunner', 'cop', 'chemist'];
  const r = newSeason({ seed: 418, items: ITEMS, agents: ids.map((id, i) => ({ id, name: id, trade: trades[i], driver: 'test' })) });
  const g = new Game({ n: 1 });
  Object.assign(g, { s: r.state, log: [...r.events] });
  assert.equal(goodsLines(seen(g.s, g.log, 'a01').view).length, 0, 'no goods: no line');
  stock(g, 'a01', 'chems', 3);
  stock(g, 'a01', 'parts', 2);
  stock(g, 'a01', 'temp', 1);
  stock(g, 'a01', 'guns', 1);
  const p = N.buyerPrice;
  assert.deepEqual(goodsLines(seen(g.s, g.log, 'a01').view), [
    `Goods you hold: 3 chems (the city's buyer pays $${p.chems} a chem now, cash at the lock; agents' settled trades, last 3 days: none; used by chemists: a02, a06); 2 parts (the city's buyer pays $${p.parts} a part now, cash at the lock; agents' settled trades, last 3 days: none; used by gunrunners: a04); 1 temp (the city's buyer pays $${p.doses} a dose now, cash at the lock; agents' settled trades, last 3 days: none; used by dealers: a03); 1 gun (the city's shop sells a gun for $${N.shopPrice.guns} now; agents' settled trades, last 3 days: none).`,
  ]);
  // The price is the board's, now: a sale moves it at the lock.
  g.errand('a01', 'sell', { item: 'chems', units: 3 });
  g.night();
  const now = seen(g.s, g.log, 'a01').view.board.market.buyer.chems;
  assert.ok(now < p.chems, 'control: the buyer\'s price fell');
  assert.match(goodsLines(seen(g.s, g.log, 'a01').view)[0], new RegExp(`2 parts \\(the city's buyer pays \\$${seen(g.s, g.log, 'a01').view.board.market.buyer.parts} a part now`));
  assert.deepEqual(USED_BY, { chems: 'chemist', parts: 'gunrunner', doses: 'dealer' });
});

test('dealings: a deal, its hand-overs and a hit show on one line for the counterpart, and the line outlives the sit-down', () => {
  const g = new Game({ n: 3 });
  g.errand('a02', 'ask', { to: 'a01' });
  const sd = g.events('ask').at(-1).sitdown;
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  g.errand('a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { temp: 5 }, cash: 75 } });
  g.errand('a01', 'say', { sitdown: sd, agree: true });
  stock(g, 'a01', 'temp', 5);
  g.errand('a01', 'give', { to: 'a02', goods: { temp: 5 }, sitdown: sd });
  g.grant('a02', 75);
  g.errand('a02', 'pay', { to: 'a01', amount: 75, sitdown: sd });
  g.errand('a01', 'close', { sitdown: sd });
  assert.equal(g.view('a01').me.deals.length, 0, 'control: off the live record');
  const lines = dealingsLines(seen(g.s, g.log, 'a01').view);
  assert.equal(lines[1], '- a02: deals: sold 5 temp for $75 (agreed day 1), settled; all hand-overs: you gave 5 temp, they gave $75.');
  // A hit, both sides' lines, once the plays are on the record.
  g.night({ a03: { kind: 'hit', target: 'a01', place: 'docks' }, a01: { kind: 'hustle', place: 'docks' } });
  g.night();
  const robbed = g.events('robbed', e => e.agent === 'a01' && e.by === 'a03');
  const mine = dealingsLines(seen(g.s, g.log, 'a01').view).find(l => l.startsWith('- a03:'));
  const theirs = dealingsLines(seen(g.s, g.log, 'a03').view).find(l => l.startsWith('- a01:'));
  if (robbed.length) assert.match(mine, /hit you night 1, took /);
  else assert.match(mine, /hit you night 1, took nothing/);
  assert.match(theirs, /you hit them night 1, took /);
  for (const l of [...lines, mine, theirs]) assert.doesNotMatch(l, ADVICE);
});

// A full $0 season, seed 418, the canny cast: every seat's record checked night by night against the raw ledger, and
// every new line against the advice words; each briefing within the per-call budget.
const season = { checks: 0, problems: [], lines: new Set(), maxDealings: 0, maxRecord: 0, over: 0 };
before(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r9-screen-'));
  const raw = (log, pred) => log.filter(pred);
  runSeason({ seed: 418, rule: 'A', midseason: 'crackdown', rounds: 3, outDir: tmp, mix: CASTS.canny, observe: x => {
    if (x.at !== 'night') return;
    const { state: s, log, day: d } = x;
    for (const id of Object.keys(s.agents).sort()) {
      const a = s.agents[id];
      const r = seen(s, log, id);
      const v = r.view;
      const record = recordLines(v);
      const dealings = dealingsLines(v);
      season.maxRecord = Math.max(season.maxRecord, record.join('\n').length);
      season.maxDealings = Math.max(season.maxDealings, dealings.join('\n').length);
      for (const l of [...record, ...dealings, ...rentLines(v), ...goodsLines(v)]) season.lines.add(l.replace(/\d+/g, '#'));
      if (d % 4 === 0 || d === LAST_NIGHT) {
        const packet = starterBriefingPacket(r, { call: 'round', reply: 'tools' });
        const size = packet.messages.reduce((t, m) => t + m.content.length, 0);
        if (size > N['gap.briefing'].chars) season.over += 1;
        for (const l of packet.messages[1].content.split('\n').filter(x => /: agree |nothing handed over yet/.test(x))) season.lines.add(l.replace(/\d+/g, '#'));
      }
      if (a.wiped) continue;
      // The record, night by night, against the raw ledger.
      const played = Math.min(d, LAST_NIGHT);
      if (record.length !== played + 1) season.problems.push(`${id} day ${d + 1}: ${record.length - 1} night lines for ${played} nights`);
      for (let n = 1; n <= played; n++) {
        season.checks += 1;
        const line = record.find(l => l.startsWith(`- night ${n}, `));
        const at = e => e.t === 2 * n + 1;
        const play = raw(log, e => e.type === 'play' && e.agent === id && at(e))[0];
        const want = [];
        const not = [];
        if (play) want.push(`- night ${n}, ${play.kind}`, ...[play.target, play.corner || play.place].filter(Boolean).map(x => ` ${x}`));
        else want.push(raw(log, e => e.type === 'arrest' && e.agent === id && e.t < 2 * n).length ? 'no play' : 'no play on record');
        // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the work event is now the agent's own hustle event, and the record's phrase says the hustle's kind, district and take, where it said the shift's pay.
        const work = raw(log, e => e.type === 'hustle' && at(e) && e.agent === id)[0];
        (work ? want : not).push(work ? `hustle (${work.how}) in ${work.place} took $${work.take}` : 'hustle (');
        const evicted = raw(log, e => e.type === 'evicted' && e.on && e.agent === id && e.t === 2 * n + 2).length;
        (evicted ? want : not).push('evicted at dawn');
        const arrest = raw(log, e => e.type === 'arrest' && e.agent === id && at(e))[0];
        (arrest ? want : not).push(arrest ? `arrested (${arrest.why}), bail $${arrest.bail}` : 'arrested');
        const sale = raw(log, e => e.type === 'sale' && e.agent === id && at(e))[0];
        (sale ? want : not).push(sale ? `on ${sale.corner} for $${sale.cash}` : 'dose on ');
        for (const e of raw(log, x => x.type === 'sell' && x.agent === id && at(x))) want.push(`the city's buyer paid $${e.cash} for ${e.units}`);
        const gather = raw(log, e => e.type === 'gather' && e.agent === id && at(e)).length;
        (gather ? want : not).push('gathered');
        const lost = raw(log, e => e.type === 'robbed' && e.agent === id && at(e)).length;
        (lost ? want : not).push('lost ');
        if (!line) season.problems.push(`${id} night ${n}: no line`);
        else {
          for (const w of want) if (!line.includes(w)) season.problems.push(`${id} night ${n}: "${w}" missing from ${line}`);
          for (const w of not) if (line.includes(w)) season.problems.push(`${id} night ${n}: "${w}" without its fact in ${line}`);
        }
      }
      // Every counterpart of an agreed deal, a hand-over or a named robbery has its dealings line.
      const who = new Set([...(v.me.dealt || []), ...v.me.deals.filter(x => x.agreed)].map(x => x.with));
      for (const e of v.me.transactions) who.add(e.from === id ? e.to : e.from);
      for (const e of raw(log, x => x.type === 'robbed' && x.agent === id && x.by && x.vis.pub <= s.clock)) who.add(e.by);
      for (const x of who) if (!dealings.some(l => l.startsWith(`- ${x}: `)) && !dealings.some(l => /more agents omitted/.test(l))) season.problems.push(`${id} day ${d + 1}: no dealings line for ${x}`);
    }
  } });
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the record matches the typed facts, night by night, for every seat over a full $0 season; the dealings line covers every counterpart', t => {
  t.diagnostic(`${season.checks} night lines checked; longest record ${season.maxRecord} characters, longest dealings block ${season.maxDealings}`);
  assert.ok(season.checks > 300, `${season.checks} checks`);
  assert.deepEqual(season.problems.slice(0, 10), []);
  assert.equal(season.over, 0, 'every briefing within the per-call budget');
});

test('no new line uses a word the advice check bans; the continuity line states the fact and nothing more', () => {
  const g = new Game({ n: 3 });
  const fixed = [CONTINUITY, STARTER.rules(seen(g.s, g.log, 'a01').view).split('\n').find(l => /agree/.test(l)),
    briefing(seen(g.s, g.log, 'a01'))[0].content.split('\n').find(l => /agree action/.test(l)),
    toolDefinitions().find(d => d.function.name === 'talk').function.description];
  for (const l of [...fixed, ...season.lines]) assert.doesNotMatch(l, ADVICE, l);
  assert.ok(season.lines.size > 50, `${season.lines.size} distinct new lines from the season`);
  assert.equal(CONTINUITY, "Earlier calls aren't kept: each call is this briefing alone. The game keeps your plan, standing orders and journal notes.");
  assert.ok(!/\bnote\b.*\b(write|keep)\b/i.test(CONTINUITY.replace('journal notes', '')), 'no instruction to write notes');
});

// R9 review fix 2 (the orchestrator, 10-19; the reviewer's mask.mjs setup): the dealings line states no take the seat
// can't know. A ski-masked hitter's or burglar's take is the seat's own record line ("lost ... to a masked robber"), so
// once the play is public the line says only that the play was made; a hit that found nobody says the same.
test('dealings: a masked hit or break-in, and a hit that found nobody, read as the play made, never "took nothing"', async () => {
  const { abilityCopy, tierCopy } = await import('./helpers.mjs');
  const view = (g, id) => seen(g.s, g.log, id).view;
  for (const kind of ['hit', 'breakin']) {
    const g = new Game({ n: 4 });
    g.hand('a01', abilityCopy(g.s, 'knuckles'), { wear: true });
    g.hand('a01', abilityCopy(g.s, 'skimask'), { wear: true });
    g.hand('a02', tierCopy(g.s, 'common'), { wear: kind === 'hit' });
    g.grant('a02', 40);
    const place = kind === 'hit' ? 'docks' : 'suburbs';
    g.night({ a01: { kind, target: 'a02', place }, a02: { kind: 'hustle', place: 'docks' } });
    const robbed = g.events('robbed', e => e.agent === 'a02');
    assert.deepEqual(robbed.map(e => [e.kind, e.by]), [[kind, null]], `control: a masked ${kind} took from a02`);
    assert.match(recordLines(view(g, 'a02'))[1], /lost .* to a masked robber/, 'the record says what was lost');
    g.night();
    const line = dealingsLines(view(g, 'a02')).find(l => l.startsWith('- a01:'));
    assert.equal(line, `- a01: played a ${kind === 'hit' ? 'hit on you' : 'break-in on your home'} night 1.`);
    assert.match(dealingsLines(view(g, 'a01')).find(l => l.startsWith('- a02:')), new RegExp(`you ${kind === 'hit' ? 'hit them' : 'broke into their home'} night 1, took `));
  }
  // A hit on an agent laying low finds nobody: no fight, and both lines say only that the play was made.
  const g = new Game({ n: 4 });
  g.night({ a01: { kind: 'hit', target: 'a02', place: 'docks' }, a02: { kind: 'laylow', place: 'suburbs' } });
  assert.equal(g.events('fight', e => e.target === 'a02').length, 0, 'control: no fight');
  g.night();
  assert.equal(dealingsLines(view(g, 'a02')).find(l => l.startsWith('- a01:')), '- a01: played a hit on you night 1.');
  assert.equal(dealingsLines(view(g, 'a01')).find(l => l.startsWith('- a02:')), '- a02: you played a hit on them night 1.');
});

// R9 review fix 3: in the last trim, the seat's history lines (dealings, nights) go before its live sit-downs, whose
// line carries "agree allowed", and before its journal.
test('the last trim cuts the nights before the seat\'s live sit-down line', () => {
  const g = new Game({ n: 3 });
  for (let i = 0; i < 10; i++) g.night();
  g.errand('a02', 'ask', { to: 'a01' });
  const sd = g.events('ask').at(-1).sitdown;
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  g.errand('a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { temp: 5 }, cash: 75 } });
  const r = seen(g.s, g.log, 'a01');
  let trimmedNights = 0;
  let trims = 0;
  for (let chars = 8000; chars <= 14000; chars += 50) {
    const u = withOverrides({ 'gap.briefing': { ...N['gap.briefing'], chars } }, () => starterBriefingPacket(r, { call: 'round', reply: 'tools' }).messages[1].content);
    if (!/whole lines past the budget/.test(u)) continue;
    trims += 1;
    const nights = (u.match(/^- night \d+, /gm) || []).length;
    if (!/agree allowed/.test(u)) assert.equal(nights, 0, `${chars}: the sit-down line went while ${nights} night lines stayed`);
    else if (nights < 10) trimmedNights += 1;
  }
  assert.ok(trims > 10, `the trim fired at ${trims} budgets`);
  assert.ok(trimmedNights > 0, 'some budget cuts nights and keeps the sit-down line');
});
