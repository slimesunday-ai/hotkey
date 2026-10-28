// R4-2, the review's fix (GAME.md §8, §33; GAP gap.accept): a model seat's `accept` is checked when it replies, by the
// rules' own check (rules/plays.mjs acceptWhy), not first at the lock. A list naming the seat itself, or one agent twice,
// came back ok from reply() and then voided the whole play at the lock, so the seat laid low instead of making its hit.
// Now the reply is refused, typed, with the rules' words, and the seat retries and falls back as for any refused play.
// Every call goes to the fake model, in-process, on its manual clock: nothing here calls a model. Each test imports what
// it needs itself, so each fails on its own before the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './helpers.mjs';
import { checkPlay, defaultPlay } from '../rules/plays.mjs';
import { read, reply, replyFormat } from '../agents/tools.mjs';
import { fakeModel, manualClock, CHAT_PATH } from '../agents/fake-model.mjs';
import { N } from '../numbers.mjs';

const YARDS = 'industrial';
const SECRET = 'a secret drawn when the season starts';
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
const turn = () => new Promise(resolve => setImmediate(resolve));
// The rules' words for a list they refuse, as a model reads them back.
const REFUSED = (() => {
  const g = new Game({ n: 3 });
  return checkPlay(g.s, 'a01', { kind: 'hustle', place: YARDS, accept: ['a01'] }, g.s.day).why;
})();

test("the tools refuse an accept list the rules would refuse, with the rules' own words, when the seat replies: itself, or one agent twice; a good list goes through as the rules take it", () => {
  assert.equal(REFUSED, 'accept: a list of other agents, each once', 'control: the rules refuse it at the lock');
  const g = new Game({ n: 4 });
  const { deal, result } = read(g.view('a01'), { audience: 'seat', seed: SECRET });
  const hit = result.menu.find(m => m.kind === 'hit').n;
  const send = accept => reply({ actions: [{ act: 'play', menu: hit, target: 'a02', place: YARDS, accept }] }, { deal, apply: () => ({ ok: true }), tries: {} });
  for (const bad of [['a01'], ['a03', 'a03'], ['a03', 'a01']]) {
    const out = send(bad);
    assert.equal(out.play, null, `${JSON.stringify(bad)}: no play reaches the rules`);
    assert.deepEqual([out.results[0].ok, out.results[0].why, out.results[0].kind, out.results[0].code], [false, REFUSED, 'never', 'field'], JSON.stringify(bad));
  }
  const good = send(['a04', 'a03']);
  assert.deepEqual(good.play, { kind: 'hit', target: 'a02', place: YARDS, accept: ['a04', 'a03'] });
  assert.equal(checkPlay(g.s, 'a01', good.play, g.s.day).ok, true, 'and the rules take it');
  assert.ok(replyFormat('seat').includes('"accept"?'), 'the reply format names the field');
});

test("a model seat on the fake whose reply names itself in accept is refused at the lock call, typed, retries once, and falls back to the default play; it never plays a hit the lock would void (§18, §33)", async () => {
  const { makeSeat } = await import('../agents/seat.mjs');
  const g = new Game({ n: 4 });
  g.grant('a01', 2 * N.nights * N.rent);
  const first = read(g.view('a01'), { audience: 'seat', seed: SECRET, from: 1 });
  const hit = first.deal.menu.find(m => m.kind === 'hit').n;
  const play = accept => ({ json: { actions: [{ act: 'play', menu: hit, target: 'a02', place: YARDS, accept }] } });
  const clock = manualClock(0);
  const fake = fakeModel({ script: { a01: [play(['a01']), play(['a03', 'a03'])] }, clock });
  const brief = (r, memory, last) => [{ role: 'system', content: replyFormat('seat') }, { role: 'user', content: JSON.stringify({ menu: r.menu, last }) }];
  const seat = makeSeat({ id: 'a01', url: IN_PROCESS, fetch: fake.fetch, secret: SECRET, brief, clock });
  const p = seat.call({ view: g.view('a01'), round: 'lock', defaultPlay: defaultPlay(g.s, 'a01', g.s.day) });
  let done = false;
  p.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 1000 && !done; i++) await turn();
  const lock = await p;
  assert.equal(fake.calls.length, 2, 'the first reply had no play on the menu, so the seat retried once');
  const refused = lock.results.filter(r => r.act === 'play' && r.ok === false);
  assert.ok(refused.length >= 1 && refused.every(r => r.why === REFUSED && r.kind === 'never'), JSON.stringify(lock.results));
  assert.deepEqual([lock.origin, lock.play], ['default', defaultPlay(g.s, 'a01', g.s.day)], 'then the default play, as for any refused play');
  assert.ok(JSON.stringify(fake.calls[1].request.messages).includes(REFUSED), "the retry's prompt names the refusal");
  assert.deepEqual(fake.failures, []);
  await fake.close();
});
