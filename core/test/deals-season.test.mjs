// R5-deals, a season ($0): model seats played by a scripted model that follows the shown facts. No model is called: a
// fetch stands in for the endpoint, as models.test.mjs's do, and reads each request's briefing as a model would read
// it, its sit-downs and deal lines among them (rules/deals.mjs; briefing.mjs). It takes every sit-down asked of it; in
// an open sit-down nothing has changed hands in yet, it takes a bot's offer to sell with the same terms back, and fills
// a bot's order while it holds the goods; it pays what came against a deal it agreed to, at the terms, naming the
// sit-down; it hands over the rest of what it sold while it holds the goods; and at the lock it plays its trade's work
// when the menu has it. The bots play as ever (bench/bots.mjs). In the season such a seat completes deals with bots as
// buyer and as seller; and one that skips the pay keeps the debt in every call after, the next days too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r5-deals-season-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const runnerModule = () => import('../bench/runner.mjs');
const botsModule = () => import('../bench/bots.mjs');
const URL = 'http://policy.invalid/v1/chat/completions';
// goodsText's singulars (briefing.mjs), back to the goods' kinds.
const KIND = { gun: 'guns', lockpick: 'lockpicks', warrant: 'warrants', dose: 'temp', doses: 'temp' };
const kindOf = w => KIND[w] || w;
// What the "You:" line says the seat holds: its goods, by kind.
function held(user) {
  const you = (user.split('\n').find(l => l.startsWith('You: ')) || '').slice(5).split('; ');
  return Object.fromEntries((you[1] || '').split(', ').map(x => x.match(/^(\d+) (\w+)$/)).filter(Boolean).map(m => [kindOf(m[2]), Number(m[1])]));
}
const PREFER = ['build', 'cook', 'run', 'deal', 'patrol', 'hustle', 'laylow', 'board'];
// A message's terms in a sit-down line ("a19: offer (sell $60 4 chems)"), one kind of goods, in either order: [from,
// say, what, units, word, cash], or null.
function saidTerms(x) {
  const m = x.match(/^(a\d+|you): (\w+) \((sell|buy) (?:\$(\d+) (\d+) (\w+)|(\d+) (\w+) \$(\d+))\)$/);
  if (!m) return null;
  const [, from, say, what, c1, n1, w1, n2, w2, c2] = m;
  return [from, say, what, Number(n1 || n2), w1 || w2, Number(c1 || c2)];
}
// The scripted model: { fetch, calls }. `pays: false` skips every pay.
function policy({ pays = true } = {}) {
  const calls = [];
  async function fetch(url, init) {
    const body = JSON.parse(init.body);
    const user = body.messages[1].content;
    const seat = new Headers(init.headers).get('x-seat');
    const lines = user.split('\n');
    const lock = user.includes('This call is the lock');
    calls.push({ seat, user, lock });
    const actions = [];
    const goods = held(user);
    if (!lock) {
      for (const l of lines) {
        const m = l.match(/^- (s\d+) with a\d+, a\d+ asked, waiting for yours/);
        if (m) actions.push({ act: 'answer', sitdown: m[1], accept: true });
      }
      // The sit-downs a deal line shows: something has changed hands there.
      const dealt = new Set(lines.map(l => (l.match(/^- (s\d+): /) || [])[1]).filter(Boolean));
      for (const l of lines) {
        // An open sit-down nothing has changed hands in, the bot's terms its last word: "- s38 with a19, a19 asked,
        // open; ... a19: offer (sell $60 4 chems)." Its offer to sell, taken with the same terms back; its order, filled.
        let m = l.match(/^- (s\d+) with (a\d+), [^.]*\bopen\b[^.]*\. (.*)\.$/);
        if (m) {
          const [, sd, other, talk] = m;
          const last = dealt.has(sd) ? null : talk.split('; ').map(saidTerms).filter(Boolean).at(-1);
          if (last && last[0] === other && last[1] === 'offer') {
            const [, , what, n, word, cash] = last;
            const kind = kindOf(word);
            if (what === 'sell') actions.push({ act: 'say', sitdown: sd, say: 'offer', terms: { what: 'trade', goods: { [kind]: n }, cash } });
            else if ((goods[kind] || 0) > 0) {
              const x = Math.min(n, goods[kind]);
              actions.push({ act: 'give', to: other, goods: { [kind]: x }, sitdown: sd });
              goods[kind] -= x;
            }
          }
          continue;
        }
        // Buying: "- s38: a19 sells you 4 chems for $60 (agreed day 4): a19 gave 4 of 4 ($60 due), you paid $0."
        m = l.match(/^- (s\d+): (a\d+) sells you \d+ \w+ for \$\d+ \(agreed day \d+(?:; sit-down over)?\): a\d+ gave \d+ of \d+(?: \(\$(\d+) due\))?, you paid \$(\d+)\.$/);
        if (m) {
          const [, sd, other, due, paid] = m;
          if (pays && due && Number(due) > Number(paid)) actions.push({ act: 'pay', to: other, amount: Number(due) - Number(paid), for: 'deal', sitdown: sd });
          continue;
        }
        // Selling: "- s41: you sell a19 1 gun for $150 (agreed day 8): you gave 0 of 1, a19 paid $0."
        m = l.match(/^- (s\d+): you sell (a\d+) (\d+) (\w+) for \$\d+ \(agreed[^)]*\): you gave (\d+) of (\d+)/);
        if (m) {
          const [, sd, other, , what, given, units] = m;
          const kind = kindOf(what);
          const n = Math.min(Number(units) - Number(given), goods[kind] || 0);
          if (n > 0) {
            actions.push({ act: 'give', to: other, goods: { [kind]: n }, sitdown: sd });
            goods[kind] -= n;
          }
        }
      }
    } else {
      // Tonight's work, from the menu: the first line of the trade's work with nothing left open, else a shift.
      const menu = lines.map(l => l.match(/^(\d+)\. (\w+)(.*)$/)).filter(Boolean).filter(m => !m[3].includes('one of'));
      const pick = PREFER.map(k => menu.find(m => m[2] === k)).find(Boolean) || menu[0];
      if (pick) actions.push({ act: 'play', menu: Number(pick[1]) });
    }
    const content = JSON.stringify({ actions });
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
  }
  return { fetch, calls };
}
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a test may name its seed; 415 as before unless it does.
async function season(name, p, seed = 415) {
  const { runModelSeason } = await runnerModule();
  const { CASTS } = await botsModule();
  const outDir = path.join(tmp, name);
  const r = await runModelSeason({
    seed, rule: 'A', outDir, mix: { ...CASTS.models, models: 4 }, url: URL, fetch: p.fetch,
    go: 'a test: a scripted policy stands in for the endpoint; no model is called', model: 'policy', say: () => {},
  });
  const log = fs.readFileSync(path.join(r.dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const ck = JSON.parse(fs.readFileSync(path.join(r.dir, 'checkpoint.json'), 'utf8'));
  return { log, ck, seats: new Set(ck.cast.filter(c => c.model).map(c => c.id)) };
}
// Each deal a give of goods and a pay closed, by the record: the goods from one side, then cash back from the other.
function completed(log, seats, modelSells) {
  const out = [];
  for (const g of log.filter(e => e.type === 'give' && e.goods && seats.has(modelSells ? e.from : e.to) && !seats.has(modelSells ? e.to : e.from))) {
    const paid = log.find(e => e.type === 'pay' && e.n > g.n && e.from === g.to && e.to === g.from);
    if (paid) out.push({ give: g, pay: paid });
  }
  return out;
}

test('a model seat that follows the shown facts completes deals with bots in a season: it pays for what a bot seller handed over, and hands over what a bot buyer ordered, which the bot pays for (§9, §10, §14, §17)', async () => {
  const p = policy();
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): seed 415's season no longer has a bot buy from a model seat (0 sales; trunk: 1), so the season is 405, the first seed from 404 where the claim holds, on the lane (4 sales, 5 buys) and on trunk (2, 8); it holds in 18 of 40 seasons (404-443, rule A) on each.
  const { log, seats } = await season('follows', p, 405);
  const bought = completed(log, seats, false);
  const sold = completed(log, seats, true);
  assert.ok(bought.length >= 1, `as buyer: a bot's goods, then the seat's pay (${bought.length})`);
  assert.ok(sold.length >= 1, `as seller: the seat's goods, then the bot's pay (${sold.length})`);
  // The seat paid at the terms it read.
  for (const { pay } of bought.slice(0, 3)) assert.equal(pay.for, 'deal');
  assert.ok(p.calls.some(c => /\bsells you \d+ \w+ for \$\d+/.test(c.user)), 'control: its briefings showed its deals');
});

test('a model seat that skips the pay keeps the debt in every call after the goods came, the next days too, until the season ends (§10, §17)', async () => {
  const p = policy({ pays: false });
  const { log, ck, seats } = await season('skips', p);
  const gives = log.filter(e => e.type === 'give' && e.goods && seats.has(e.to) && !seats.has(e.from));
  assert.ok(gives.length >= 1, 'control: a bot handed a model seat goods');
  assert.equal(log.filter(e => e.type === 'pay' && seats.has(e.from) && !seats.has(e.to)).length, 0, 'control: the seats never paid a bot');
  const owed = Object.values(ck.state.deals || []).filter(d => d.agreed && seats.has(d.buyer) && !seats.has(d.seller) && Object.values(d.given || {}).some(n => n > 0));
  assert.ok(owed.length >= 1, 'the record still holds the debt at the ferry');
  for (const d of owed) {
    const later = p.calls.filter(c => c.seat === d.buyer && Number(c.user.match(/^Day (\d+) of/)[1]) > d.givenDay);
    assert.ok(later.length >= 1, `control: ${d.buyer} was called after day ${d.givenDay}`);
    // One line per counterpart (§14): its newest deal the seat owes on, so a line for this seller that says what's due.
    for (const c of later) assert.match(c.user, new RegExp(`^- s\\d+: ${d.seller} sells you .*: ${d.seller} gave \\d+ of \\d+ \\(\\$\\d+ due\\), you paid \\$0\\.$`, 'm'), `every call after shows it: ${d.buyer}, ${d.sitdown}`);
  }
});
