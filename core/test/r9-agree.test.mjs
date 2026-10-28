// R9, change 1 (brief R9-agents-work-their-trade; the orchestrator's review, 10-19): `agree`, one step to take the other
// side's open offer in a sit-down. It sends the rules' say: an offer of the same terms from the seat's own side (a sell
// for a buy; deals.mjs openOffer), which R5-terms agrees as the offer was made, so the deal agreed is the one offered,
// night and all. It is refused, typed, with no open offer by the other
// side, on the seat's own offer, on an expired offer and on a deal already agreed: through JSON and through the native
// tool calls alike. The sit-down line names the offer agree can take; the deals block shows a deal agreed with nothing
// handed over yet. Nothing here calls a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { checkPlay, legalPlays } from '../rules/plays.mjs';
import { read, reply, ACTIONS } from '../agents/tools.mjs';
import { toolCallsOf, actionsOfToolCalls, toolDefinitions } from '../agents/tool-calls.mjs';
import { starterBriefing } from '../agents/briefing.mjs';

function stock(g, id, kind, n) {
  addGoods(g.s.agents[id], kind, n);
  bookGoods(g.s, 'in', 'test', kind, n);
  checkLedger(g.s, `stock ${id} ${kind}`);
}
// A seat's reply, through the table, into the rules: as JSON, or written as native tool calls and read back.
function send(g, id, actions, mode) {
  const { deal } = read(g.view(id), { audience: 'seat', seed: 'r9-agree' });
  const sent = [];
  const ctx = { deal, tries: {}, validatePlay: p => checkPlay(g.s, id, p, g.s.day), apply: e => {
    sent.push(e);
    const r = g.errand(id, e.kind, e);
    return { ...r, legal: legalPlays(g.s, id), kind: r.events.find(x => x.type === 'invalid')?.kind };
  } };
  const raw = mode === 'tools' ? actionsOfToolCalls(toolCallsOf(actions)).actions : JSON.stringify({ actions });
  return { results: reply(raw, ctx).results, sent };
}
const seen = (g, id) => read(g.view(id), { audience: 'seat', seed: 'r9-agree' }).result;
const talkLine = (g, id, sd) => starterBriefing(seen(g, id), { call: 'round', reply: 'tools' })[1].content.split('\n').find(l => l.startsWith(`- ${sd} with`));
const dealsBlock = (g, id) => starterBriefing(seen(g, id), { call: 'round', reply: 'tools' })[1].content.split('\n\n').find(p => p.startsWith('Your deals'));

// a02 asks a01, a01 answers; then a02 (playing a bot's part: bots.mjs's buy offer, its what, goods and cash) offers.
function sitDown(terms = { what: 'trade', goods: { temp: 5 }, cash: 75 }) {
  const g = new Game({ n: 3 });
  g.errand('a02', 'ask', { to: 'a01' });
  const sd = g.events('ask').at(-1).sitdown;
  g.errand('a01', 'answer', { sitdown: sd, accept: true });
  if (terms) g.errand('a02', 'say', { sitdown: sd, say: 'offer', terms });
  return { g, sd };
}

test('the talk tool carries agree, generated from the table, and the JSON reply format names it', () => {
  const talk = toolDefinitions().find(d => d.function.name === 'talk');
  assert.ok(talk.function.parameters.properties.act.enum.includes('agree'));
  assert.ok(talk.function.description.split('\n').includes('agree(sitdown, line?): agrees their open offer: its terms, your side'));
  assert.ok(ACTIONS.find(a => a.act === 'agree').who.includes('seat'));
});

for (const mode of ['json', 'tools']) {
  test(`${mode}: agree takes a bot's open offer, night included, as the deal it offered; it is one say, one message`, () => {
    // Sol's 10-19 case: the offer named a night, and a counter that added one never matched.
    const { g, sd } = sitDown({ what: 'trade', goods: { temp: 5 }, cash: 75, night: 3 });
    stock(g, 'a01', 'temp', 5);
    assert.equal(talkLine(g, 'a01', sd).includes('a02 offers to buy 5 temp from you for $75 (night 3): agree allowed'), true, talkLine(g, 'a01', sd));
    const msgs = g.s.agents.a01.msgs;
    const before = g.log.length;
    const { results, sent } = send(g, 'a01', [{ act: 'agree', sitdown: sd, line: 'done' }], mode);
    assert.equal(results[0].ok, true, results[0].why);
    assert.equal(results[0].act, 'agree');
    assert.deepEqual(sent.map(e => [e.kind, e.say, e.agree]), [['say', 'offer', true]], 'the rules get a say');
    assert.equal(g.s.agents.a01.msgs, msgs + 1, 'one message');
    const said = g.log.slice(before).filter(e => e.type === 'say');
    assert.deepEqual(said.map(e => [e.from, e.say, e.terms, e.line]), [['a01', 'offer', { what: 'sell', goods: { temp: 5 }, cash: 75, night: 3 }, 'done']], 'its own side, as any say');
    assert.ok(talkLine(g, 'a01', sd).includes('a02: offer (buy $75 night 3 5 temp); you: offer (sell $75 night 3 5 temp)'), `the seat's message reads its own side: ${talkLine(g, 'a01', sd)}`);
    const [d] = g.view('a01').me.deals;
    assert.deepEqual([d.agreed, d.role, d.with, d.goods, d.cash, d.night, d.stated], [true, 'seller', 'a02', { temp: 5 }, 75, 3, 'them'], 'the deal a02 offered');
    assert.match(dealsBlock(g, 'a01'), new RegExp(`- ${sd}: you sell a02 5 temp for \\$75 \\(agreed day 1, nothing handed over yet\\)\\.`));
    // From then on the hand-over counts against it.
    g.errand('a01', 'give', { to: 'a02', goods: { temp: 5 }, sitdown: sd });
    assert.equal(g.view('a01').me.deals[0].due, 75);
  });

  test(`${mode}: agree is refused, typed, with no open offer, on the seat's own offer, on an expired offer and on a deal already agreed; a refusal changes nothing`, () => {
    const cases = [];
    {
      const { g, sd } = sitDown(null);
      cases.push(['no offer', g, sd, 'no open offer in this sit-down', 'not-yet']);
    }
    {
      const { g, sd } = sitDown(null);
      g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'sell', goods: { temp: 2 }, cash: 30 } });
      cases.push(['own offer', g, sd, 'the open offer is your own', 'not-yet']);
    }
    {
      const { g, sd } = sitDown({ what: 'trade', goods: { temp: 2 }, cash: 30, night: 1 });
      g.night();
      cases.push(['expired', g, sd, 'that offer expired after night 1', 'never']);
    }
    {
      const { g, sd } = sitDown();
      g.errand('a01', 'say', { sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { temp: 5 }, cash: 75 } });
      assert.equal(g.view('a01').me.deals[0].agreed, true, 'control: agreed by the echo');
      cases.push(['agreed', g, sd, 'already agreed day 1', 'never']);
    }
    for (const [name, g, sd, why, kind] of cases) {
      const line = talkLine(g, 'a01', sd);
      const before = JSON.stringify(g.s.sitdowns[sd]);
      const msgs = g.s.agents.a01.msgs;
      const { results } = send(g, 'a01', [{ act: 'agree', sitdown: sd }], mode);
      assert.deepEqual([results[0].ok, results[0].why, results[0].kind, results[0].act], [false, why, kind, 'agree'], name);
      assert.equal(JSON.stringify(g.s.sitdowns[sd]), before, `${name}: the sit-down unchanged`);
      assert.equal(g.s.agents.a01.msgs, msgs, `${name}: no message used`);
      if (name === 'expired') assert.ok(line.includes(`agree ${why}`), `${name}: the sit-down line says so: ${line}`);
      else assert.ok(!/agree allowed/.test(line), `${name}: ${line}`);
    }
  });
}

test('a human\'s app reads the same precondition: the owner action contract carries agree for each sit-down', () => {
  const { g, sd } = sitDown();
  const inv = sd2 => g.view('a01').me.actions.invitations.find(x => x.sitdown === sd2);
  assert.deepEqual([inv(sd).agree.ok], [true]);
  assert.deepEqual([inv(sd).agree.ok, inv(sd).agree.why], [true, undefined]);
  const theirs = g.view('a02').me.actions.invitations.find(x => x.sitdown === sd).agree;
  assert.deepEqual([theirs.ok, theirs.why], [false, 'the open offer is your own']);
  // The rules' say with agree, as an app sends it, does what the table's agree does.
  const r = g.errand('a01', 'say', { sitdown: sd, agree: true });
  assert.equal(r.ok, true, r.why);
  assert.equal(g.view('a01').me.deals[0].agreed, true);
  assert.equal(g.errand('a01', 'say', { sitdown: sd, agree: true, terms: { cash: 1 } }).why, 'agree takes no terms: it sends their open offer back');
});
