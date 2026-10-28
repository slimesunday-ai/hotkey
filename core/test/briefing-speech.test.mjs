// R2-4's briefing over budget, and its block of in-game speech (GAME.md §18, §32, §33; brief R2-agents.md, task R2-4;
// GAP gap.briefing). Talk is where the stories come from (§32), so a story over budget gives up speech lines, the last
// (least important) first, but not the block while anything else can go: the block keeps its first line, the most
// important one (the seat's own sit-downs come first). Two days made too long for the budget, built as
// briefing.test.mjs builds its own: the seat in a sit-down with every other agent, each with long lines, which the last
// resort must trim; and one line that alone is longer than a quarter of the story's room, which the speech cut must
// keep. Amounts come from N.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { viewFor } from '../rules/view.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { addGoods, bookGoods, moveCopy } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng, shuffle } from '../rng.mjs';
import { makeCast, makeBot, CASTS } from '../bench/bots.mjs';
import { MIDSEASON_ROTATION } from '../bench/runner.mjs';
import { read, replyFormat } from '../agents/tools.mjs';
import { briefing, SPEECH } from '../agents/briefing.mjs';

// 10-19: slime raised gap.briefing to 21,000 characters ("raise the per-call limit to 21,000"). The scenarios marked
// atBudget(18000) are built on the 18,000 budget they were written for (their controls need the room to be that
// tight), so they run at it; the code they test reads the budget from N either way.
const atBudget = (chars, fn) => {
  const was = N['gap.briefing'].chars;
  N['gap.briefing'].chars = chars;
  let out;
  try { out = fn(); } catch (e) { N['gap.briefing'].chars = was; throw e; }
  if (out && typeof out.then === 'function') return out.finally(() => { N['gap.briefing'].chars = was; });
  N['gap.briefing'].chars = was;
  return out;
};

const SECRET = 'R2-4-SPEECH-SECRET';
const SEAT = 'a03';
const all = msgs => msgs.map(m => m.content).join('\n');
const count = (text, part) => text.split(part).length - 1;
const numbered = text => text.split('\n').map(l => l.match(/^(\d+)\. /)).filter(Boolean).map(m => Number(m[1]));
// The lines inside the speech block, markers aside.
const block = text => {
  const [i, j] = [text.indexOf(SPEECH.open), text.indexOf(SPEECH.close)];
  return i < 0 ? [] : text.slice(i + SPEECH.open.length, j).split('\n').filter(Boolean);
};
// One block, opened before it closes.
const oneBlock = text => count(text, SPEECH.open) === 1 && count(text, SPEECH.close) === 1 && text.indexOf(SPEECH.open) < text.indexOf(SPEECH.close);
// The same briefing with the budget lifted for one call, as tab.test.mjs sets its row: the whole block, for comparison.
function lifted(fn) {
  const was = N['gap.briefing'];
  N['gap.briefing'] = { ...was, chars: 1e9 };
  try {
    return fn();
  } finally {
    N['gap.briefing'] = was;
  }
}

// A layer4 season played by its bots up to the morning of `day`, as briefing.test.mjs's oneCall plays it.
function dayOf(seed, day) {
  const midseason = MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length];
  const cast = makeCast(seed, CASTS.layer4);
  const r = newSeason({ seed, rule: 'A', midseason, items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
  let s = r.state;
  const log = [...r.events];
  const memos = {};
  const bots = Object.fromEntries(cast.map(c => [c.id, makeBot({ ...c, every: true }, (memos[c.id] ||= {}))]));
  const ids = Object.keys(s.agents).sort();
  while (s.day < day) {
    const d = s.day;
    for (let round = 1; round <= 3; round++) {
      for (const a of shuffle(rng(seed, 'order', d, round), ids)) {
        for (const e of bots[a].day(viewFor(s, log, a, 'agent'), { seed, day: d, round, rounds: 3, rng: rng(seed, 'bot', a, d, round) })) {
          const res = applyErrand(s, { ...e, by: a });
          s = res.state;
          log.push(...res.events);
        }
      }
    }
    const plays = {};
    for (const a of ids) {
      if (s.agents[a].jail) continue;
      const { play, reason } = bots[a].night(viewFor(s, log, a, 'agent'), { seed, day: d, round: 'night', rng: rng(seed, 'bot', a, d, 'night') });
      plays[a] = { ...play, reason };
    }
    const n = settleNight(s, plays);
    s = n.state;
    log.push(...n.events);
  }
  return { s, log };
}

// A sit-down another agent asked of the seat, open, with its lines (nothing here changes the season: a copy).
const sitdown = (s, id, other, lines) => ({
  id, a: other, b: SEAT, day: s.day, state: 'open', listeners: [],
  said: lines.map((line, j) => ({ from: other, say: 'offer', terms: { what: 'trade', cash: 10 + j }, line })),
});

test('over budget, the last resort takes the speech block\'s lines, the last first, down to its first line and never the block, and the briefing fits (§18, §32; gap.briefing)', () => {
  const { s, log } = dayOf(405, 2);
  const others = Object.keys(s.agents).sort().filter(x => x !== SEAT);
  const big = { ...s, sitdowns: { ...s.sitdowns } };
  for (const [i, other] of others.entries()) {
    big.sitdowns[`s${8000 + i}`] = sitdown(s, `s${8000 + i}`, other, [0, 1, 2].map(j => `LONG-${i}-${j} ${'x'.repeat(N['gap.lineLength'] - 20)}`));
  }
  const rd = read(viewFor(big, log, SEAT, 'agent'), { audience: 'seat', seed: SECRET });
  const msgs = briefing(rd.result);
  const text = all(msgs);
  const whole = lifted(() => block(all(briefing(rd.result))));
  assert.equal(whole.filter(l => l.includes('LONG-')).length, 3 * others.length, 'control: with the budget lifted, the block holds every planted line');
  assert.ok(text.includes('whole lines past the budget'), 'control: the last resort ran');
  assert.ok(text.length <= N['gap.briefing'].chars, `fits: ${text.length}`);
  assert.ok(oneBlock(text), `one speech block: ${count(text, SPEECH.open)} opens, ${count(text, SPEECH.close)} closes`);
  const kept = block(text);
  assert.ok(kept.length >= 1 && kept.length < whole.length, `it keeps a line and gives some up: ${kept.length} of ${whole.length}`);
  assert.deepEqual(kept, whole.slice(0, kept.length), 'it keeps its first lines, the most important, and gives up the last');
  assert.ok(msgs[0].content.includes(replyFormat('seat')), 'the reply format, whole');
  assert.deepEqual(numbered(msgs[1].content), rd.result.menu.map(m => m.n), 'the menu, whole');
});

// R10b recalibrated this test's budget from 18,000 to 18,300 characters (slime, 10-20: "Recalibrate (Recommended)";
// core/reports/R9/REPINS.md): on trunk before R10b it fit with 1 character to spare (17,999 of 18,000), and the trade
// orders' fixed text took that room; 18,300 restores the same squeeze, and the cutting logic is unchanged.
// R11 recalibrated this test's budget from 18,300 to 19,192 characters (slime, 10-21: "Recalibrate (Recommended)";
// core/reports/R9/REPINS.md): the hustle's fixed text (its rules sentence, the hustle numbers, the run numbers' hustle
// line) means this case first passes at 19,105, where on trunk it passed from 18,213, 87 under its 18,300; 19,192
// restores the same squeeze (19,191 of 19,192, as trunk's 18,299 of 18,300), and the cutting logic is unchanged.
test('the speech cut keeps the block\'s first line even when that line alone is longer than a quarter of the story\'s room, and the briefing fits (§18, §32; gap.briefing)', () => atBudget(19192, () => {
  const { s, log } = dayOf(405, 2);
  const other = Object.keys(s.agents).sort().find(x => x !== SEAT);
  // A line at the length cap, every character one that's escaped to six when quoted (§18).
  let st = structuredClone(s);
  st.sitdowns.s8000 = sitdown(s, 's8000', other, ['<'.repeat(N['gap.lineLength'])]);
  // Valid build choices and bounded typed memory occupy the fixed portion now that Creed words live in speech.
  st.agents[SEAT].trade = 'gunrunner';
  addGoods(st.agents[SEAT], 'parts', N.build.parts); bookGoods(st, 'in', 'test', 'parts', N.build.parts);
  st.agents[SEAT].cash += 10000; st.money.in.test = (st.money.in.test || 0) + 10000;
  // Public affordable listings are real legal options, so they consume the untrimmed menu without changing its budget.
  // R6 compacts the header; ninety listings restore the original greater-than-quarter pressure condition.
  const copies = Object.keys(st.copies).filter(k => st.copies[k].holder.k === 'list' && st.copies[k].tier === 'common').slice(0,90);
  assert.equal(copies.length,90,'control: ninety real public choices supply the stress fixture');
  for (const copy of copies) {
    moveCopy(st, copy, {k:'agent',id:other}, 'test');
    const listed = applyErrand(st,{by:other,kind:'fence_list',copy,price:1});
    assert.equal(listed.ok,true); st=listed.state; log.push(...listed.events);
  }
  checkLedger(st, 'rich builder, bounded memory and public fence choices');
  const rd = read(viewFor(st, log, SEAT, 'agent'), { audience: 'seat', seed: SECRET });
  const traits = rd.result.view.board.list.slice().sort((a,b) => b.trait.length - a.trait.length).slice(0,3);
  const memory = { creed: Array(3).fill('C'.repeat(N['gap.lineLength'])), plan: traits.map(t => ({trait:t.trait,routes:['buy','trade','vault']})), orders: [{kind:'retaliate'},{kind:'laylow',stars:3},{kind:'protect_grail'},{kind:'back',agent:other},{kind:'avoid_lawless'}] };
  rd.result.view.me.memory = memory;
  const msgs = briefing(rd.result, { memory });
  const text = all(msgs);
  const whole = lifted(() => block(all(briefing(rd.result, { memory }))));
  const user = msgs[1].content;
  const room = N['gap.briefing'].chars - msgs[0].content.length - user.slice(user.indexOf("Tonight's menu")).length - 3;
  assert.ok(whole[0] && whole[0].includes('\\u003c'), 'control: with the budget lifted, the block opens with the planted line');
  assert.ok(whole[0].length + 1 > room / 4, `control: that line alone (${whole[0].length}) is more than a quarter of the room (${room})`);
  assert.ok(text.includes('some speech lines'), 'control: the speech cut was made');
  assert.ok(text.length <= N['gap.briefing'].chars, `fits: ${text.length}`);
  assert.ok(oneBlock(text), `one speech block: ${count(text, SPEECH.open)} opens, ${count(text, SPEECH.close)} closes`);
  assert.equal(block(text)[0], whole[0], 'it keeps its first line');
}));
