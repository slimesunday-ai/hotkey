// R10a (brief R10a-trade-terms-and-tools-line; the 10-20 audit, reviews/2026-10-20-why-models-lose/AUDIT.md §2.2, §2.3;
// slime, 10-20: "Stop our tool code from throwing away trade terms. That's a plain bug." and "Reword the line "each call
// is one action", which models read as "one action a turn".").
// - Trade terms (terms that still name goods, a piece or cash once blanks are dropped) on an answer or an ask are never
//   dropped in silence by the native tool calls' reader (tool-calls.mjs): an answer that accepts runs, then a say with
//   those terms in its sit-down; an ask, or an answer that declines, runs, and its terms are refused, typed.
// - Blank terms ({}, goods [], cash 0) still read as a plain answer: no say, no refusal.
// - The tools line and the day line state how calls work, in both briefing versions, and advise nothing (§33).
// The outcome hash of a bot-only season is pinned by r9s-fight-numbers.test.mjs (OUTCOME_404); bots never use the
// tools, so nothing here can move it. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { checkPlay, legalPlays } from '../rules/plays.mjs';
import { read, reply } from '../agents/tools.mjs';
import { actionsOfToolCalls } from '../agents/tool-calls.mjs';
import { briefing, starterBriefing, TOOLS_LINE } from '../agents/briefing.mjs';

// r8b-lean.test.mjs's ADVICE pattern (§33).
const ADVICE = /\b(should|best|recommend\w*|strateg\w*|aggressive\w*|safest|smart\w*|wise\w*|mission\w*)\b/i;
const DAY_LINE = "Day: errands run now, so send every errand you want in this reply. You are called again today only if something new happens in one of your sit-downs (an ask, a message or an acceptance today, or a hand-over that leaves you owing on a deal you agreed). The lock asks for tonight's play; a play sent now sets tonight's pick, used if no lock play is accepted. Errands sent at the lock are refused.";

const call = (name, args, i = 0) => ({ id: `call_${i + 1}`, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
const read1 = (name, args) => actionsOfToolCalls([call(name, args)]);

// The 10-20 test's talk calls whose terms named goods, a piece or cash on an answer or an ask (runs/2026-10-20-test,
// seasons 444-447, rule A): [seed, seat, call, model, the call's arguments as the tape holds them]. 44 by the brief's
// measure; 30 of them carry goods with a count and cash above 0, the audit's (scratch/dropped.py). All 44 lost their
// terms without a word before R10a.
const DROPPED = [
  [444,"a11",1,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a25\",\"line\":\"Brix here, chemist. Looking for a reliable buyer from night 2 onward: five TEMP per batch, $15 a dose. Interested? I work industrial tonight; no beef.\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a25\",\"piece\":\"\",\"cash\":75,\"night\":2,\"where\":\"industrial\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [444,"a25",2,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a11\",\"line\":\"Accepted. I'll be a buyer from night 2; five TEMP per batch at $15 each sounds good.\",\"sitdown\":\"s1\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a11\",\"piece\":\"\",\"cash\":75,\"night\":2,\"where\":\"industrial\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [444,"a25",10,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"I'll take the five at $15 each when I can pay on delivery. Keep me in mind; tonight I'm earning the cash.\",\"sitdown\":\"s25\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a28\",\"piece\":\"\",\"cash\":75,\"night\":3,\"where\":\"docks\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [444,"a29",13,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"I accept. If you can deliver 2 chems at $15 each, I can make business work.\",\"sitdown\":\"s50\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a03\",\"piece\":\"\",\"cash\":30,\"night\":0,\"where\":\"forest\",\"goods\":[{\"kind\":\"chems\",\"count\":2}]}}"],
  [444,"a29",13,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"I accept. I'll have doses for sale after I cook; let's settle payment on delivery.\",\"sitdown\":\"s58\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a27\",\"piece\":\"\",\"cash\":75,\"night\":0,\"where\":\"downtown\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [444,"a11",22,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a07\",\"line\":\"You received all five TEMP. Our agreed $75 is overdue: pay the full $75 today against s23. I need settlement, not another promise.\"       ,\"sitdown\":\"\",\"accept\":false,\"say\":\"answer\",\"terms\":{\"what\":\"pay\",\"who\":\"a11\",\"piece\":\"\",\"cash\":75,\"night\":6,\"where\":\"industrial\",\"goods\":[]}}"],
  [444,"a24",26,"gpt-6-luna", "{\"act\":\"ask\",\"to\":\"a06\",\"line\":\"I’m stuck in jail one more night and will lose my home at dawn for being $5 short. Send me $20 now and I’ll remember the favor when I’m out.\",\"sitdown\":\"\",\"accept\":false,\"say\":\"promise\",\"terms\":{\"what\":\"pay\",\"who\":\"a24\",\"piece\":\"\",\"cash\":20,\"night\":0,\"where\":\"downtown\",\"goods\":[]} }"],
  [444,"a01",28,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"No deal. I can't supply a warrant tonight.\",\"sitdown\":\"s160\",\"accept\":false,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a06\",\"piece\":\"\",\"cash\":108,\"night\":10,\"where\":\"downtown\",\"goods\":[]}}"],
  [445,"a13",11,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"I accept. I'll take six doses at $15 each, payment on delivery.\",\"sitdown\":\"s47\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a19\",\"piece\":\"\",\"cash\":90,\"night\":4,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"temp\",\"count\":6}]}}"],
  [445,"a26",15,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a29\",\"line\":\"Tex, six fresh chems ready at the agreed $15 each: $90 for the batch. Pay first and I'll hand them over today. Can you keep buying six daily?\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a29\",\"piece\":\"\",\"cash\":90,\"night\":5,\"where\":\"forest\",\"goods\":[{\"kind\":\"chems\",\"count\":6}]}}"],
  [445,"a13",16,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a21\",\"line\":\"Accepted. I'll buy seven temp at $15 each; hand them over and I'll pay.\",\"sitdown\":\"s55\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a21\",\"piece\":\"\",\"cash\":105,\"night\":0,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"temp\",\"count\":7}]} }"],
  [445,"a26",18,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a19\",\"line\":\"Six chems available now for $78 total, $13 each below the street. If you want them, pay today and I hand over all six; no waiting on tomorrow's run.\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a19\",\"piece\":\"\",\"cash\":78,\"night\":6,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"chems\",\"count\":6}]}}"],
  [445,"a13",27,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a06\",\"line\":\"I'll buy three temp at $15 each, hand them over and I'll pay today.\",\"sitdown\":\"s98\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a06\",\"piece\":\"\",\"cash\":45,\"night\":7,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"temp\",\"count\":3}]} }"],
  [445,"a26",33,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a24\",\"line\":\"Accepted. Two chems for $30; pay as I hand them over.\",\"sitdown\":\"s165\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a24\",\"piece\":\"\",\"cash\":30,\"night\":10,\"where\":\"forest\",\"goods\":[{\"kind\":\"chems\",\"count\":2}]}}"],
  [445,"a07",51,"gpt-6-luna", "{\"act\":\"ask\",\"to\":\"a30\",\"line\":\"I'm jailed and need a $100 bail to make the ferry. Please bail me today; I'll remember the favor.\",\"sitdown\":\"\",\"accept\":false,\"say\":\"promise\",\"terms\":{\"what\":\"pay\",\"who\":\"a07\",\"piece\":\"\",\"cash\":100,\"night\":0,\"where\":\"downtown\",\"goods\":[]}}"],
  [445,"a07",51,"gpt-6-luna", "{\"act\":\"ask\",\"to\":\"a05\",\"line\":\"I'm jailed and need a $100 bail to make the ferry. Please bail me today; I'll remember the favor.\",\"sitdown\":\"\",\"accept\":false,\"say\":\"promise\",\"terms\":{\"what\":\"pay\",\"who\":\"a07\",\"piece\":\"\",\"cash\":100,\"night\":0,\"where\":\"downtown\",\"goods\":[]}}"],
  [445,"a07",51,"gpt-6-luna", "{\"act\":\"ask\",\"to\":\"a25\",\"line\":\"I'm jailed and need a $100 bail to make the ferry. Please bail me today; I'll remember the favor.\",\"sitdown\":\"\",\"accept\":false,\"say\":\"promise\",\"terms\":{\"what\":\"pay\",\"who\":\"a07\",\"piece\":\"\",\"cash\":100,\"night\":0,\"where\":\"downtown\",\"goods\":[]}}"],
  [445,"a07",51,"gpt-6-luna", "{\"act\":\"ask\",\"to\":\"a15\",\"line\":\"I'm jailed and need a $100 bail to make the ferry. Please bail me today; I'll remember the favor.\",\"sitdown\":\"\",\"accept\":false,\"say\":\"promise\",\"terms\":{\"what\":\"pay\",\"who\":\"a07\",\"piece\":\"\",\"cash\":100,\"night\":0,\"where\":\"downtown\",\"goods\":[]}}"],
  [445,"a26",42,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a29\",\"line\":\"I have 2 chems for $30 total, same $15 street price. Can hand them over today once you agree.\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a29\",\"piece\":\"\",\"cash\":30,\"night\":12,\"where\":\"downtown\",\"goods\":[{\"kind\":\"chems\",\"count\":2}]}}"],
  [445,"a26",45,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a29\",\"line\":\"Last 2 chems available for $30 total. Pay on handover today; interested?\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a29\",\"piece\":\"\",\"cash\":30,\"night\":13,\"where\":\"docks\",\"goods\":[{\"kind\":\"chems\",\"count\":2}]}}"],
  [445,"a07",57,"gpt-6-luna", "{\"act\":\"ask\",\"to\":\"a15\",\"line\":\"I need $20 to clear my rent tab at the dock. Please send it today; I’ll board safely and won’t come after you.\",\"sitdown\":\"\",\"accept\":false,\"say\":\"promise\",\"terms\":{\"what\":\"pay\",\"who\":\"a07\",\"piece\":\"\",\"cash\":20,\"night\":14,\"where\":\"junkyard\",\"goods\":[]} }"],
  [446,"a09",1,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a01\",\"line\":\"Accepted. I can start producing from the two chems I have; lab cooking in the lawless forest keeps heat down. I can sell you doses at $15 each if you can meet that. I'll need more chems to sustain repeat supply.\",\"sitdown\":\"s1\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a01\",\"piece\":\"\",\"cash\":15,\"night\":2,\"where\":\"forest\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]} }"],
  [446,"a01",6,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a18\",\"line\":\"Accepted. I'll buy five doses for $75, payment immediately after all five are delivered. Tell me which drug you're supplying.\",\"sitdown\":\"s5\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a18\",\"piece\":\"\",\"cash\":75,\"night\":2,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [446,"a09",5,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"Accepted. I have no doses ready tonight; I'm producing five tomorrow and already have a standing buyer, but we can talk future supply.\",\"sitdown\":\"s11\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a27\",\"piece\":\"\",\"cash\":0,\"night\":3,\"where\":\"forest\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [446,"a25",5,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"Accepted. I can supply five doses after tonight's cook; $15 each, paid as handed over. Let's do that tomorrow.\",\"sitdown\":\"s12\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a27\",\"piece\":\"\",\"cash\":75,\"night\":3,\"where\":\"forest\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]} }"],
  [446,"a09",8,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a10\",\"line\":\"Accepted. I am cooking tonight; let's arrange a dose sale tomorrow at $15 each, paid on handover.\",\"sitdown\":\"s23\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a10\",\"piece\":\"\",\"cash\":15,\"night\":4,\"where\":\"forest\",\"goods\":[{\"kind\":\"temp\",\"count\":1}]}}"],
  [446,"a01",13,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a09\",\"line\":\"Zee robbed my home of $292. I can pay $27 now for five TEMP, with the other $48 after tonight's sales. You know I paid Ivy in full. Can you supply on those terms today?\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a09\",\"piece\":\"\",\"cash\":75,\"night\":4,\"where\":\"downtown\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [446,"a01",14,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a12\",\"line\":\"I want five TEMP. Zee robbed my home last night, so I have $27 now and can pay the remaining $48 after tonight's sales. I paid Ivy in full; deliver five and I'll pay $27 immediately, balance tomorrow. Can you extend that credit?\",\"sitdown\":\"s55\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a12\",\"piece\":\"\",\"cash\":75,\"night\":4,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [446,"a16",22,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"Accepted. I'll sell you two chems at $15 each; pay as you take them.\",\"sitdown\":\"s110\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a18\",\"piece\":\"\",\"cash\":30,\"night\":0,\"where\":\"suburbs\",\"goods\":[{\"kind\":\"chems\",\"count\":2}]}}"],
  [446,"a01",35,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a18\",\"line\":\"Need five TEMP today for $75, same settled price as before. Can you deliver before I pay?\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a18\",\"piece\":\"\",\"cash\":75,\"night\":9,\"where\":\"downtown\",\"goods\":[{\"kind\":\"temp\",\"count\":5}]}}"],
  [446,"a16",26,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a12\",\"line\":\"Accepted. I'll sell up to four chems at $15 each, paid as handed over.\",\"sitdown\":\"s143\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a12\",\"piece\":\"\",\"cash\":60,\"night\":9,\"where\":\"downtown\",\"goods\":[{\"kind\":\"chems\",\"count\":4}]}}"],
  [446,"a16",31,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"Accepted. I don't have parts on hand tonight, but we can talk terms.\",\"sitdown\":\"s166\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a17\",\"piece\":\"\",\"cash\":0,\"night\":0,\"where\":\"docks\",\"goods\":[{\"kind\":\"parts\",\"count\":2}]}}"],
  [446,"a16",31,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"Accepted. I don't have parts on hand tonight, but we can talk terms.\",\"sitdown\":\"s163\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a13\",\"piece\":\"\",\"cash\":0,\"night\":0,\"where\":\"docks\",\"goods\":[{\"kind\":\"parts\",\"count\":2}]}}"],
  [446,"a16",31,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"\",\"line\":\"Accepted. I don't have chems on hand tonight, but we can talk later.\",\"sitdown\":\"s155\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a18\",\"piece\":\"\",\"cash\":0,\"night\":0,\"where\":\"docks\",\"goods\":[{\"kind\":\"chems\",\"count\":4}]}}"],
  [447,"a23",1,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a26\",\"line\":\"Accepted. I can buy doses from day 2—quote me your price for TEMP, and I'll consider repeat orders.\",\"sitdown\":\"s1\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a26\",\"piece\":\"\",\"cash\":0,\"night\":2,\"where\":\"docks\",\"goods\":[{\"kind\":\"temp\",\"count\":1}]}}"],
  [447,"a26",6,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a09\",\"line\":\"Accepted: one TEMP for $15, available tomorrow after tonight's cook. Cash on delivery; I'll reserve one if you confirm.\",\"sitdown\":\"s15\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a09\",\"piece\":\"\",\"cash\":15,\"night\":3,\"where\":\"forest\",\"goods\":[{\"kind\":\"temp\",\"count\":1}]}}"],
  [447,"a22",7,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a19\",\"line\":\"I can hear the terms, but I don't have a gun to sell today. If you still need one after I build stock, we can talk.\",\"sitdown\":\"s16\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"sell\",\"who\":\"a19\",\"piece\":\"\",\"cash\":150,\"night\":0,\"where\":\"industrial\",\"goods\":[]}}"],
  [447,"a26",12,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a15\",\"line\":\"Accepted. Four TEMP available at $15 each, $60 total. Pay first and I hand over immediately; I won't extend credit.\",\"sitdown\":\"s27\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a15\",\"piece\":\"\",\"cash\":60,\"night\":3,\"where\":\"forest\",\"goods\":[{\"kind\":\"temp\",\"count\":4}]}}"],
  [447,"a23",14,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a19\",\"line\":\"I'll take all 7 doses at $15 each, $105 on delivery. I can deal them tonight.\",\"sitdown\":\"s41\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a19\",\"piece\":\"\",\"cash\":105,\"night\":4,\"where\":\"docks\",\"goods\":[{\"kind\":\"temp\",\"count\":7}]}}"],
  [447,"a26",16,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a08\",\"line\":\"I'll buy one chem for $15, payable immediately after delivery. Please deliver one only; I haven't ordered four.\",\"sitdown\":\"s45\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a08\",\"piece\":\"\",\"cash\":15,\"night\":4,\"where\":\"forest\",\"goods\":[{\"kind\":\"chems\",\"count\":1}]}}"],
  [447,"a26",23,"gpt-6.1-sol", "{\"act\":\"ask\",\"to\":\"a04\",\"line\":\"Four TEMP available for $60 total, cash before delivery. You can turn them into much more on your corner. If you want them today, pay $60 and I immediately hand over all four; no credit.\" ,\"sitdown\":\"\",\"accept\":false,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a04\",\"piece\":\"\",\"cash\":60,\"night\":6,\"where\":\"strip\",\"goods\":[{\"kind\":\"temp\",\"count\":4}]}}"],
  [447,"a23",24,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a24\",\"line\":\"I'll hear the offer, but I'm not paying before delivery. If you can hand over four TEMP doses for $60 today, we can do that.\",\"sitdown\":\"s76\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"buy\",\"who\":\"a24\",\"piece\":\"\",\"cash\":60,\"night\":0,\"where\":\"docks\",\"goods\":[{\"kind\":\"temp\",\"count\":4}]}}"],
  [447,"a26",24,"gpt-6.1-sol", "{\"act\":\"answer\",\"to\":\"a29\",\"line\":\"Accepted: one TEMP for $15. I'll hand over one now; pay the $15 promptly on delivery.\",\"sitdown\":\"s86\",\"accept\":true,\"say\":\"offer\",\"terms\":{\"what\":\"sell\",\"who\":\"a29\",\"piece\":\"\",\"cash\":15,\"night\":6,\"where\":\"docks\",\"goods\":[{\"kind\":\"temp\",\"count\":1}]}}"],
  [447,"a02",34,"gpt-6-luna", "{\"act\":\"answer\",\"to\":\"a21\",\"line\":\"I'll accept. Two chems at $15 each works; I can use the stock.\",\"sitdown\":\"s122\",\"accept\":true,\"say\":\"answer\",\"terms\":{\"what\":\"buy\",\"who\":\"a21\",\"piece\":\"\",\"cash\":30,\"night\":0,\"where\":\"industrial\",\"goods\":[{\"kind\":\"chems\",\"count\":2}]}}"],
];
const A13_CALL_16 = DROPPED.find(([seed, seat, n]) => seed === 445 && seat === 'a13' && n === 16);
const auditReal = t => (t.cash || 0) > 0 && (t.goods || []).some(g => (g.count || 0) > 0);

test('the fixtures are the audit\'s 30 and the brief\'s 44, 445 a13 call 16 among them', () => {
  assert.equal(DROPPED.length, 44);
  assert.equal(DROPPED.filter(([, , , , a]) => auditReal(JSON.parse(a).terms)).length, 30);
  assert.ok(A13_CALL_16);
  const shapes = new Set(DROPPED.map(([, , , , a]) => { const x = JSON.parse(a); return `${x.act} ${x.act === 'answer' ? x.accept : ''} ${x.say}`; }));
  assert.deepEqual([...shapes].sort(), ['answer false answer', 'answer true answer', 'answer true offer', 'ask  answer', 'ask  offer', 'ask  promise']);
});

test('every one of the 10-20 calls now gives the answer and its say, or the action and its terms refused; none loses its terms in silence', () => {
  for (const [seed, seat, n, , raw] of DROPPED) {
    const x = JSON.parse(raw);
    const name = `${seed} ${seat} call ${n}`;
    const { actions, at } = read1('talk', raw);
    assert.equal(actions.length, 2, name);
    assert.deepEqual(at, [0, 0], `${name}: both from the one call`);
    assert.equal(actions[0].act, x.act, name);
    assert.ok(!Object.hasOwn(actions[0], 'terms'), `${name}: the action runs as sent`);
    if (x.act === 'answer' && x.accept === true) {
      const [answer, say] = actions;
      assert.deepEqual([answer.sitdown, answer.accept, answer.line], [x.sitdown, true, x.line], name);
      assert.equal(say.act, 'say', name);
      assert.equal(say.sitdown, x.sitdown, `${name}: the same sit-down`);
      // The review (10-20): an offer when the call named answer (or none), else the kind it named.
      assert.equal(say.say, x.say === 'answer' || !x.say ? 'offer' : x.say, `${name}: an offer, as the audit's fix has it`);
      assert.ok(!Object.hasOwn(say, 'line'), `${name}: the words go with the answer, once`);
      const goods = Object.fromEntries(x.terms.goods.map(g => [g.kind, g.count]));
      if (x.terms.goods.length) assert.deepEqual(say.terms.goods, goods, `${name}: the goods`);
      if (x.terms.cash) assert.equal(say.terms.cash, x.terms.cash, `${name}: the cash`);
    } else {
      assert.equal(Object.keys(actions[1]).join(), 'act', `${name}: the second is no action of its own, only the mark`);
      assert.equal(actions[1].act, x.act, name);
    }
  }
});

test('445 a13 call 16, as sent: the answer, then a say offering 7 temp for $105 in s55', () => {
  const { actions } = read1('talk', A13_CALL_16[4]);
  assert.deepEqual(actions, [
    { act: 'answer', line: "Accepted. I'll buy seven temp at $15 each; hand them over and I'll pay.", sitdown: 's55', accept: true },
    { act: 'say', sitdown: 's55', say: 'offer', terms: { what: 'buy', who: 'a21', cash: 105, where: 'suburbs', goods: { temp: 7 } } },
  ]);
});

test('an accepting answer that names no say kind sends an offer', () => {
  for (const say of [undefined, '', null]) {
    const { actions } = read1('talk', { act: 'answer', sitdown: 's1', accept: true, ...(say === undefined ? {} : { say }), terms: { what: 'sell', goods: [{ kind: 'temp', count: 3 }], cash: 45 } });
    assert.deepEqual(actions[1], { act: 'say', sitdown: 's1', say: 'offer', terms: { what: 'sell', goods: { temp: 3 }, cash: 45 } }, String(say));
  }
  // A piece alone, or cash alone, is trade terms too.
  assert.equal(read1('talk', { act: 'answer', sitdown: 's1', accept: true, terms: { piece: 'P3' } }).actions[1].terms.piece, 'P3');
  assert.equal(read1('talk', { act: 'answer', sitdown: 's1', accept: true, terms: { cash: 20 } }).actions[1].terms.cash, 20);
});

test('no regression: an answer or an ask with blank terms ({}, goods [], cash 0, piece "") is the plain action, with no say and no refusal', () => {
  const blanks = [{}, { goods: [] }, { cash: 0 }, { piece: '' }, { what: 'meet', who: 'a10', piece: '', cash: 0, night: 0, where: 'industrial', goods: [] }, { what: 'buy', night: 2 }];
  for (const terms of blanks) {
    for (const accept of [true, false]) {
      const { actions } = read1('talk', { act: 'answer', to: '', sitdown: 's1', accept, say: 'offer', line: 'ok', terms });
      assert.deepEqual(actions, [{ act: 'answer', sitdown: 's1', accept, line: 'ok' }], JSON.stringify([terms, accept]));
    }
    const { actions } = read1('talk', { act: 'ask', to: 'a02', sitdown: '', accept: false, say: 'offer', line: 'hi', terms });
    assert.deepEqual(actions, [{ act: 'ask', to: 'a02', line: 'hi' }], JSON.stringify(terms));
  }
  // R8d's 10-19 ask, as its test has it.
  const SOL_ASK = '{"act":"ask","to":"a10","line":"Vex here, gunrunner.","sitdown":"","accept":false,"say":"offer","terms":{"what":"meet","who":"a10","piece":"","cash":0,"night":2,"where":"industrial","goods":[]}}';
  assert.deepEqual(read1('talk', SOL_ASK).actions, [{ act: 'ask', to: 'a10', line: 'Vex here, gunrunner.' }]);
  // A say keeps its terms as it did.
  assert.deepEqual(read1('talk', { act: 'say', sitdown: 's1', say: 'offer', terms: { cash: 5 } }).actions, [{ act: 'say', sitdown: 's1', say: 'offer', terms: { cash: 5 } }]);
});

// A seat's tool calls through the table into the rules (as r9-agree.test.mjs sends them).
function send(g, id, calls) {
  const { deal } = read(g.view(id), { audience: 'seat', seed: 'r10a' });
  const sent = [];
  const ctx = { deal, tries: {}, validatePlay: p => checkPlay(g.s, id, p, g.s.day), apply: e => {
    sent.push(e);
    const r = g.errand(id, e.kind, e);
    return { ...r, legal: legalPlays(g.s, id), kind: r.events.find(x => x.type === 'invalid')?.kind };
  } };
  return { ...reply({ actions: actionsOfToolCalls(calls).actions }, ctx), sent };
}
const asked = (g, from, to) => {
  g.errand(from, 'ask', { to });
  return g.events('ask').at(-1).sitdown;
};

test('an ask with trade terms runs as sent, and its terms come back refused, typed, in plain words; nothing else reaches the rules', () => {
  const g = new Game({ n: 3 });
  const { results, sent } = send(g, 'a01', [call('talk', { act: 'ask', to: 'a02', line: 'buyer here', say: 'offer', terms: { what: 'buy', goods: [{ kind: 'temp', count: 5 }], cash: 75 } })]);
  assert.deepEqual(sent.map(e => e.kind), ['ask'], 'only the ask reaches the rules');
  assert.equal(results.length, 2);
  assert.deepEqual([results[0].act, results[0].ok], ['ask', true]);
  assert.deepEqual([results[1].act, results[1].ok, results[1].status, results[1].source, results[1].code, results[1].kind], ['ask', false, 'refused', 'tools', 'unsent', 'never']);
  assert.equal(results[1].why, "its terms weren't sent: an ask carries no terms; they go in a say once the other side has taken the sit-down");
  assert.doesNotMatch(results[1].why, ADVICE);
});

test('an answer that declines with trade terms declines, and its terms come back refused, typed', () => {
  const g = new Game({ n: 3 });
  const sd = asked(g, 'a02', 'a01');
  const { results, sent } = send(g, 'a01', [call('talk', { act: 'answer', sitdown: sd, accept: false, say: 'answer', terms: { cash: 50 } })]);
  assert.deepEqual(sent.map(e => [e.kind, e.accept]), [['answer', false]]);
  assert.deepEqual(results.map(r => [r.act, r.ok, r.code]), [['answer', true, undefined], ['answer', false, 'unsent']]);
  assert.equal(results[1].why, "its terms weren't sent: an answer that declines carries no terms");
  assert.equal(g.s.sitdowns[sd].state, 'declined');
});

test('through the rules: an accepting answer opens the sit-down and its say states the offer, which the other side\'s same terms agree', () => {
  const g = new Game({ n: 3 });
  const sd = asked(g, 'a02', 'a01');
  const msgs = g.s.agents.a01.msgs;
  const { results, sent } = send(g, 'a01', [call('talk', { act: 'answer', sitdown: sd, accept: true, say: 'offer', line: 'deal', terms: { what: 'buy', goods: [{ kind: 'temp', count: 7 }], cash: 105, night: 0, piece: '' } })]);
  assert.deepEqual(sent.map(e => [e.kind, e.say ?? e.accept]), [['answer', true], ['say', 'offer']]);
  assert.deepEqual(results.map(r => [r.act, r.ok]), [['answer', true], ['say', true]], JSON.stringify(results));
  assert.equal(g.s.agents.a01.msgs, msgs + 2, 'two messages, as any answer and say');
  const said = g.events('say').at(-1);
  assert.deepEqual([said.from, said.say, said.terms, said.line], ['a01', 'offer', { what: 'trade', goods: { temp: 7 }, cash: 105 }, ''], 'the words went with the answer');
  // The other side offers the same terms back (its side: a sell), as a bot does: the deal is agreed.
  g.errand('a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: 7 }, cash: 105 } });
  const [d] = g.view('a01').me.deals;
  assert.deepEqual([d.agreed, d.role, d.with, d.goods, d.cash], [true, 'buyer', 'a02', { temp: 7 }, 105]);
});

test('through the rules: a split say whose terms match the other side\'s open offer agrees it', () => {
  // The sit-down is open and the other side has offered; the answer is refused (already open) and its say agrees.
  const g = new Game({ n: 3 });
  const sd = asked(g, 'a02', 'a01');
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  g.errand('a02', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: 5 }, cash: 75 } });
  const { results } = send(g, 'a01', [call('talk', { act: 'answer', sitdown: sd, accept: true, say: 'offer', terms: { what: 'buy', goods: [{ kind: 'temp', count: 5 }], cash: 75 } })]);
  assert.deepEqual(results.map(r => [r.act, r.ok, r.code]), [['answer', false, 'rules'], ['say', true, undefined]]);
  assert.equal(results[0].why, `already open; use say with sitdown ${sd}`);
  const [d] = g.view('a01').me.deals;
  assert.deepEqual([d.agreed, d.role, d.goods, d.cash, d.stated], [true, 'buyer', { temp: 5 }, 75, 'them']);
});

test('through the rules: a split say the rules refuse comes back refused, typed, with the rules\' own reason', () => {
  const g = new Game({ n: 3 });
  const sd = asked(g, 'a02', 'a01');
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  g.errand('a01', 'close', { sitdown: sd });
  const { results } = send(g, 'a01', [call('talk', { act: 'answer', sitdown: sd, accept: true, terms: { goods: [{ kind: 'temp', count: 2 }], cash: 30 } })]);
  assert.deepEqual(results.map(r => [r.act, r.ok, r.status, r.source, r.code]), [['answer', false, 'refused', 'core', 'rules'], ['say', false, 'refused', 'core', 'rules']]);
  assert.equal(results[1].why, 'no open sit-down');
  // A say kind the table doesn't take is the table's refusal: nothing is guessed.
  const g2 = new Game({ n: 3 });
  const sd2 = asked(g2, 'a02', 'a01');
  const r2 = send(g2, 'a01', [call('talk', { act: 'answer', sitdown: sd2, accept: true, say: 'deal', terms: { cash: 30 } })]).results;
  assert.deepEqual(r2.map(r => [r.act, r.ok, r.source, r.code]), [['answer', true, 'core', undefined], ['say', false, 'tools', 'field']]);
});

test('445 a13 call 16 through the rules: Luna\'s answer opens the sit-down and its offer stands for a21 to agree', () => {
  const g = new Game({ n: 30 });
  const sd = asked(g, 'a21', 'a13');
  const raw = A13_CALL_16[4].replace('"s55"', JSON.stringify(sd)).replace('"s55"', JSON.stringify(sd));
  const { results } = send(g, 'a13', [call('talk', raw)]);
  assert.deepEqual(results.map(r => [r.act, r.ok]), [['answer', true], ['say', true]], JSON.stringify(results));
  assert.deepEqual(g.events('say').at(-1).terms, { what: 'trade', who: 'a21', goods: { temp: 7 }, cash: 105, where: 'suburbs' });
  g.errand('a21', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: 7 }, cash: 105 } });
  assert.equal(g.view('a13').me.deals[0].agreed, true);
});

test('an accepting answer that names say answer sends an offer; a promise or a threat goes as named', () => {
  const answer = say => read1('talk', { act: 'answer', sitdown: 's1', accept: true, say, terms: { what: 'buy', goods: [{ kind: 'temp', count: 5 }], cash: 75 } }).actions[1].say;
  assert.deepEqual(['answer', 'offer', 'promise', 'threat'].map(answer), ['offer', 'offer', 'promise', 'threat']);
});

test('445 a13-style, the answer kind: 444 a25 call 2 (say "answer") through the rules states its offer, and the other side\'s same terms agree it', () => {
  const [, , , , raw] = DROPPED.find(([seed, seat, n]) => seed === 444 && seat === 'a25' && n === 2);
  assert.equal(JSON.parse(raw).say, 'answer');
  const g = new Game({ n: 30 });
  const sd = asked(g, 'a11', 'a25');
  const { results } = send(g, 'a25', [call('talk', raw.replace('"s1"', JSON.stringify(sd)))]);
  assert.deepEqual(results.map(r => [r.act, r.ok]), [['answer', true], ['say', true]], JSON.stringify(results));
  const said = g.events('say').at(-1);
  assert.deepEqual([said.from, said.say, said.terms.goods, said.terms.cash, said.terms.night], ['a25', 'offer', { temp: 5 }, 75, 2]);
  const [stated] = g.view('a25').me.deals;
  assert.deepEqual([stated.agreed, stated.stated, stated.role, stated.with, stated.goods, stated.cash, stated.night], [false, 'me', 'buyer', 'a11', { temp: 5 }, 75, 2], 'a deal stated, as a bot offers');
  g.errand('a11', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: 5 }, cash: 75, night: 2 } });
  assert.equal(g.view('a25').me.deals[0].agreed, true);
});

// a02 offers a01 5 temp for $75 (a buy, or a sell) in an open sit-down; a01 agrees by tool call with `terms`.
function offered(what = 'trade') {
  const g = new Game({ n: 3 });
  const sd = asked(g, 'a02', 'a01');
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  g.errand('a02', 'say', { sitdown: sd, say: 'offer', terms: { what, goods: { temp: 5 }, cash: 75, night: 3 } });
  return { g, sd };
}
const AGREE_WHY = "its terms weren't sent: agree takes their open offer as it stands; other terms go in a say offer";

test('an agree whose terms are the open offer, in either form, runs with nothing more: no note', () => {
  for (const what of ['sell', 'buy']) {
    const { g, sd } = offered();
    const terms = { what, who: 'a02', piece: '', cash: 75, night: 3, where: 'docks', goods: [{ kind: 'temp', count: 5 }] };
    const { actions } = read1('talk', { act: 'agree', sitdown: sd, say: 'answer', line: 'done', terms });
    assert.equal(actions.length, 2, 'the reader marks them; the reply judges them');
    const { results, sent } = send(g, 'a01', [call('talk', { act: 'agree', sitdown: sd, say: 'answer', line: 'done', terms })]);
    assert.deepEqual(results.map(r => [r.act, r.ok, r.code]), [['agree', true, undefined]], `${what}: ${JSON.stringify(results)}`);
    assert.deepEqual(sent.map(e => [e.kind, e.agree, e.terms]), [['say', true, undefined]], 'the agree, as sent');
    assert.equal(g.view('a01').me.deals[0].agreed, true);
  }
  // Doses read as temp, as the rules read them.
  const { g, sd } = offered();
  const { results } = send(g, 'a01', [call('talk', { act: 'agree', sitdown: sd, terms: { what: 'sell', cash: 75, night: 3, goods: [{ kind: 'doses', count: 5 }] } })]);
  assert.deepEqual(results.map(r => [r.act, r.ok]), [['agree', true]]);
});

test('an agree whose terms differ from the open offer runs, and its terms come back refused, typed; the deal formed is the open offer\'s', () => {
  const differ = [
    { what: 'sell', cash: 60, night: 3, goods: [{ kind: 'temp', count: 5 }] },
    { what: 'sell', cash: 75, night: 3, goods: [{ kind: 'temp', count: 4 }] },
    { what: 'sell', cash: 75, goods: [{ kind: 'temp', count: 5 }] },
    { what: 'sell', cash: 75, night: 3, goods: [{ kind: 'chems', count: 5 }] },
  ];
  for (const terms of differ) {
    const { g, sd } = offered();
    const { results } = send(g, 'a01', [call('talk', { act: 'agree', sitdown: sd, terms })]);
    assert.deepEqual(results.map(r => [r.act, r.ok, r.status, r.source, r.code, r.kind]), [['agree', true, 'applied', 'core', undefined, undefined], ['agree', false, 'refused', 'tools', 'unsent', 'never']], JSON.stringify(terms));
    assert.equal(results[1].why, AGREE_WHY);
    assert.doesNotMatch(results[1].why, ADVICE);
    const [d] = g.view('a01').me.deals;
    assert.deepEqual([d.agreed, d.role, d.with, d.goods, d.cash, d.night], [true, 'seller', 'a02', { temp: 5 }, 75, 3], 'the open offer, as made');
  }
  // No open offer to take: the agree is refused by the rules, and its terms are refused too.
  const g = new Game({ n: 3 });
  const sd = asked(g, 'a02', 'a01');
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  const { results } = send(g, 'a01', [call('talk', { act: 'agree', sitdown: sd, terms: { what: 'sell', cash: 75, goods: [{ kind: 'temp', count: 5 }] } })]);
  assert.deepEqual(results.map(r => [r.act, r.ok, r.code]), [['agree', false, 'rules'], ['agree', false, 'unsent']]);
  // Blank terms on an agree are no terms: no note.
  const o = offered();
  assert.deepEqual(send(o.g, 'a01', [call('talk', { act: 'agree', sitdown: o.sd, terms: { what: 'meet', piece: '', cash: 0, goods: [] } })]).results.map(r => [r.act, r.ok]), [['agree', true]]);
});

test('the tools line and the day line: in tools-mode requests of both briefing versions, the tools line at the lock too, and no advice', () => {
  assert.equal(TOOLS_LINE, 'Reply only by calling the tools. A reply can make several tool calls, one action each; they run in the order called, and the first play stands.');
  for (const line of [TOOLS_LINE, DAY_LINE]) assert.doesNotMatch(line, ADVICE);
  const g = new Game({ n: 3 });
  const seen = read(g.view('a01'), { audience: 'seat', seed: 'r10a' }).result;
  for (const [version, make] of [['current', briefing], ['starter', starterBriefing]]) {
    for (const reply of ['tools', 'json']) {
      const day = make(seen, { call: 'round', reply });
      const lock = make(seen, { call: 'lock', reply });
      const text = m => m.map(x => x.content).join('\n');
      assert.equal(text(day).split(DAY_LINE).length, 2, `${version} ${reply}: the day line, once`);
      assert.ok(!text(lock).includes(DAY_LINE), `${version} ${reply}: not at the lock`);
      for (const m of [day, lock]) {
        assert.equal(m[0].content.includes(TOOLS_LINE), reply === 'tools', `${version} ${reply}: the tools line in the shared header`);
        assert.ok(!text(m).includes('each call is one action'), `${version} ${reply}: the old line is gone`);
      }
    }
  }
});
