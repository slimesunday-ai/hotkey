// Accepted conversation traffic must make progress even when a packet cannot hold one quote from every group.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, idOf } from './helpers.mjs';
import { accepted, joined, quoted, speechBlock } from './r6-audit-fixtures.mjs';
import { N } from '../numbers.mjs';
import { makeSeat } from '../agents/seat.mjs';
import { briefingPacket } from '../agents/briefing.mjs';
import { read, act } from '../agents/tools.mjs';

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

function crowded({ shortThird = false } = {}) {
  const g = new Game({ n: 50 });
  for (let i = 1; i <= 50; i++) g.grant(idOf(i), 200);
  const conversations = [];
  const say = (conversation, serial) => {
    const prefix = `FAIR-${conversation.who}-${serial} `;
    const line = prefix + '<'.repeat(N['gap.lineLength'] - prefix.length);
    accepted(g, conversation.who, 'say', { sitdown: conversation.sitdown, say: 'offer', line });
  };
  for (let i = 2; i <= 7; i++) {
    const who = idOf(i);
    accepted(g, who, 'ask', { to: 'a01' });
    const sitdown = g.events('ask').at(-1).sitdown;
    accepted(g, 'a01', 'answer', { sitdown, accept: true });
    const conversation = { who, sitdown }; conversations.push(conversation);
    for (let j = 0; j < (shortThird && i === 4 ? 1 : 6); j++) say(conversation, `initial-${j}`);
  }
  return { g, conversations, say };
}

function driven(g, memo = {}) {
  const packets = []; const requests = [];
  const seat = makeSeat({ id: 'a01', url: 'http://offline.invalid/fairness', secret: 'r6-fair-conversations', memo,
    brief: (r, memory, last, round, context) => {
      const p = briefingPacket(r, { memory, last, call: 'round', ...context }); packets.push(p); return p;
    },
    fetch: async (url, init) => {
      requests.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"actions":[]}' }, finish_reason: 'stop' }] }));
    },
  });
  const call = async round => {
    const out = await seat.call({ view: g.view('a01'), currentView: () => g.view('a01'), round,
      apply: () => { throw new Error('scripted reply has no mutations'); } });
    assert.equal(out.calls, 1);
    const packet = packets.at(-1); const body = requests.at(-1);
    assert.deepEqual(body.messages, packet.messages, 'presentation metadata corresponds to the actual request');
    assert.ok(joined(body.messages).length <= N['gap.briefing'].chars);
    const byId = new Map(g.view('a01').me.speech.map(e => [e.speechId, e]));
    const groups = new Set();
    for (const id of packet.presentedSpeechIds) {
      const event = byId.get(id);
      if (!event?.line || !event.sitdown) continue;
      assert.ok(speechBlock(body.messages).includes(quoted(event.line)), `${id} retains the exact quote`);
      groups.add(event.sitdown);
    }
    return { packet, groups };
  };
  return { seat, call };
}

// R11 recalibrated this test's budget from 18,000 to 18,770 characters (slime, 10-21: "Recalibrate (Recommended)";
// core/reports/R9/REPINS.md): the hustle's fixed text means this case first passes at 18,365, where on trunk it passed
// from 17,595, 405 under its 18,000; 18,770 restores the same squeeze, and the cutting logic is unchanged.
test('six accepted conversations all receive a turn despite continuous arrivals to early groups and fewer packet slots', () => atBudget(18770, async () => {
  const { g, conversations, say } = crowded(); const d = driven(g); const received = new Set();
  for (let round = 1; round <= conversations.length; round++) {
    const { groups } = await d.call(round);
    if (round === 1) assert.ok(groups.size > 0 && groups.size < conversations.length, `control: only ${groups.size} of six groups fit`);
    for (const group of groups) received.add(group);
    // Continuous arrivals between decisions remain legal: ask + six initial + five arrivals = twelve.
    if (round < conversations.length) for (const conversation of conversations.slice(0, 3)) say(conversation, `arrival-${round}`);
  }
  assert.deepEqual(received, new Set(conversations.map(c => c.sitdown)), 'late conversations cannot starve behind replenished early backlogs');
}));

test('a checkpoint preserves the next fair turn and serves waiting groups before repeating the prior packet', async () => {
  const { g, conversations } = crowded(); const uninterrupted = driven(g);
  const first = await uninterrupted.call(1);
  const checkpoint = JSON.parse(JSON.stringify(uninterrupted.seat.memo));
  const resumed = driven(g, checkpoint);
  const second = await uninterrupted.call(2);
  const restored = await resumed.call(2);
  assert.deepEqual(restored.packet.presentedSpeechIds, second.packet.presentedSpeechIds, 'resume preserves delivery recency without storing words');
  const waiting = new Set(conversations.map(c => c.sitdown).filter(id => !first.groups.has(id)));
  const newlyServed = [...restored.groups].filter(id => waiting.has(id));
  assert.equal(newlyServed.length, Math.min(waiting.size, restored.groups.size), 'waiting groups take the next available slots');
});

test('closing the last presented conversation leaves a valid rotation anchor among remaining live groups', async () => {
  const { g, conversations } = crowded(); const d = driven(g);
  const first = await d.call(1);
  const byId = new Map(g.view('a01').me.speech.map(e => [e.speechId, e]));
  const anchor = first.packet.presentedSpeechIds.map(id => byId.get(id)).filter(e => e?.sitdown).at(-1).sitdown;
  accepted(g, 'a01', 'close', { sitdown: anchor });
  const second = await d.call(2);
  const waiting = new Set(conversations.map(c => c.sitdown).filter(id => !first.groups.has(id)));
  assert.equal([...second.groups].filter(id => waiting.has(id)).length, Math.min(waiting.size, second.groups.size), 'a closed priority-group anchor cannot reset traffic to the first backlogged groups');
});

test('a fully delivered anchor remains in the group ring while earlier conversations still have unread backlogs', async () => {
  const { g, conversations } = crowded({ shortThird: true }); const d = driven(g);
  const first = await d.call(1);
  assert.ok(first.groups.has(conversations[2].sitdown), 'control: the one-message third conversation was delivered');
  const delivered = new Set(d.seat.memo.delivery);
  const shortMessages = g.view('a01').me.speech.filter(e => e.sitdown === conversations[2].sitdown && e.line);
  assert.ok(shortMessages.every(e => delivered.has(e.speechId)), 'control: this anchor has no unread messages left');
  const second = await d.call(2);
  const waiting = new Set(conversations.map(c => c.sitdown).filter(id => !first.groups.has(id)));
  assert.equal([...second.groups].filter(id => waiting.has(id)).length, Math.min(waiting.size, second.groups.size), 'an empty unread queue must not reset rotation to groups one and two');
});

test('citizen identity lookup selects the requested public row without revealing private agent state', () => {
  const g = new Game({ n: 3 }); g.grant('a02', 9876543);
  const r = read(g.view('a01'), { audience: 'seat', seed: 'citizen-filter' });
  const result = act({ act: 'lookup', section: 'citizens', with: 'a02' }, { deal: r.deal, tries: {} });
  assert.equal(result.ok, true);
  assert.equal(result.lookup.total, 1);
  assert.equal(result.lookup.shown, 1);
  assert.deepEqual(result.lookup.rows, [r.result.view.board.agents.find(a => a.id === 'a02')]);
  assert.ok(!JSON.stringify(result).includes('9876543'));
  assert.ok(!Object.hasOwn(result.lookup.rows[0], 'cash'));
  const self = act({ act: 'lookup', section: 'state', with: 'a01' }, { deal: r.deal, tries: {} });
  assert.equal(self.ok, true); assert.ok(self.lookup.total > 0);
  const other = act({ act: 'lookup', section: 'state', with: 'a02' }, { deal: r.deal, tries: {} });
  assert.equal(other.lookup.total, 0, 'state lookup cannot become another agent private-state query');
});
