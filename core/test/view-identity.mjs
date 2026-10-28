// R6 view-perf identity check: the bytes a seat, a lookup and a bot read, for whole bot seasons (rule A, layer4), as
// one digest per seed. Run it against any checkout's core and compare: `node core/test/view-identity.mjs [core dir]`
// prints the digests; view-identity.test.mjs holds trunk 9550334's and checks this checkout's against them.
// At every call point (each agent, each round, and the night) it hashes the seat's briefing (briefingPacket's messages
// and its presented, available and omitted speech ids), every lookup section's first pages (and a page filtered to one
// counterpart, and one through currentView), the owner's AI read, and the bot's decisions, then the season's final
// state and log.
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SEEDS = [404, 405, 406];
const SECTIONS = ['deals', 'transactions', 'speech', 'conversations', 'history', 'citizens', 'state'];

export async function identity(coreDir = path.join(here, '..'), seeds = SEEDS) {
  const T = pathToFileURL(path.resolve(coreDir)).href;
  const { ITEMS } = await import(`${T}/test/helpers.mjs`);
  const { newSeason } = await import(`${T}/rules/setup.mjs`);
  const { applyErrand } = await import(`${T}/rules/errand.mjs`);
  const { settleNight } = await import(`${T}/rules/night.mjs`);
  const { viewFor } = await import(`${T}/rules/view.mjs`);
  const { rng, shuffle } = await import(`${T}/rng.mjs`);
  const { makeCast, makeBot, CASTS } = await import(`${T}/bench/bots.mjs`);
  const { MIDSEASON_ROTATION } = await import(`${T}/bench/runner.mjs`);
  const { read, act } = await import(`${T}/agents/tools.mjs`);
  const { briefingPacket } = await import(`${T}/agents/briefing.mjs`);
  const out = {};
  for (const seed of seeds) {
    const h = { brief: crypto.createHash('sha256'), lookup: crypto.createHash('sha256'), ownerAI: crypto.createHash('sha256'), bots: crypto.createHash('sha256') };
    const put = (k, x) => h[k].update(`${JSON.stringify(x)}\n`);
    const cast = makeCast(seed, CASTS.layer4);
    const r = newSeason({ seed, rule: 'A', midseason: MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length], items: ITEMS, agents: cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: `bot:${c.type}` })) });
    let s = r.state;
    const log = [...r.events];
    const ids = Object.keys(s.agents).sort();
    const from = Object.fromEntries(ids.map(id => [id, 1]));
    const fromAI = Object.fromEntries(ids.map(id => [id, 1]));
    const memos = {};
    const every = cast.some(c => c.works);
    const bots = Object.fromEntries(cast.map(c => [c.id, makeBot(every ? { ...c, every } : c, (memos[c.id] ||= {}))]));
    let calls = 0, pages = 0;
    const measure = (id, round) => {
      calls += 1;
      const rd = read(viewFor(s, log, id, 'agent'), { audience: 'seat', seed: 'view-identity', from: from[id] });
      from[id] = rd.deal.next;
      const p = briefingPacket(rd, { call: round === 'night' ? 'lock' : 'round' });
      put('brief', [id, round, p.messages, p.presentedSpeechIds, p.availableSpeechIds, p.omittedSpeechCount]);
      const ctx = { deal: rd.deal, tries: {} };
      const other = rd.deal.view.board.agents.find(a => a.id !== id).id;
      for (const section of SECTIONS) {
        let offset = 0;
        for (let i = 0; i < 3 && offset !== null; i++) {
          const res = act({ act: 'lookup', section, offset }, ctx);
          put('lookup', [id, round, section, res]);
          pages += 1;
          offset = res.lookup ? res.lookup.nextOffset : null;
        }
        put('lookup', [id, round, section, other, act({ act: 'lookup', section, with: other }, ctx)]);
        pages += 1;
      }
      put('lookup', [id, round, 'current', act({ act: 'lookup', section: 'history' }, { ...ctx, currentView: () => viewFor(s, log, id, 'agent') })]);
      pages += 1;
      const ai = read(viewFor(s, log, id, 'ownerAI'), { audience: 'ownerAI', seed: 'view-identity', from: fromAI[id] });
      fromAI[id] = ai.deal.next;
      put('ownerAI', [id, round, ai.result]);
    };
    while (!s.over) {
      const day = s.day;
      for (let round = 1; round <= 3; round++) {
        for (const id of shuffle(rng(seed, 'order', day, round), ids)) {
          measure(id, round);
          const view = viewFor(s, log, id, 'agent');
          const errands = bots[id].day(view, { seed, day, round, rounds: 3, rng: rng(seed, 'bot', id, day, round) });
          put('bots', [id, day, round, errands]);
          for (const e of errands) {
            const x = applyErrand(s, { ...e, by: id });
            s = x.state;
            log.push(...x.events);
          }
        }
      }
      const plays = {};
      for (const id of ids) {
        if (s.agents[id].jail) continue;
        measure(id, 'night');
        const view = viewFor(s, log, id, 'agent');
        const { play, reason } = bots[id].night(view, { seed, day, round: 'night', rng: rng(seed, 'bot', id, day, 'night') });
        put('bots', [id, day, 'night', play, reason]);
        plays[id] = { ...play, reason };
      }
      const night = settleNight(s, plays);
      s = night.state;
      log.push(...night.events);
    }
    const end = crypto.createHash('sha256').update(JSON.stringify([s, log])).digest('hex');
    out[seed] = { calls, pages, events: log.length, ...Object.fromEntries(Object.entries(h).map(([k, x]) => [k, x.digest('hex')])), end };
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = performance.now();
  const out = await identity(process.argv[2]);
  console.log(JSON.stringify(out, null, 2));
  console.error(`seconds ${((performance.now() - t0) / 1000).toFixed(1)}`);
}
