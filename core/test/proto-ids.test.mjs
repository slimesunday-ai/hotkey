// Ids that name what every object inherits (`__proto__`, `constructor`, `toString`, `hasOwnProperty`, `valueOf` and the
// rest of Object.prototype's names), in every id-typed field of every errand and every play (GAME.md §23, §33). The
// rules are the referee, so each is as unknown as any other id: the errand or play that names one is refused, typed
// never, exactly as one naming an ordinary unknown id is, or, where the rules drop an unknown id (a hit's want, a
// sit-down's terms, a payment's label), dropped the same way. Nothing throws, nothing changes but the record, and the
// ledger still checks.
// The sweep can't skip a kind or a field. The kinds are the ones the rules export (ERRANDS, PLAY_KINDS), and each needs a
// baseline here that goes through, or the first test fails. The fields are the ones the rules read: each baseline runs
// once through a recorder that notes every field the rules read from it, at any depth, and every field it finds is swept
// unless the baseline holds a number, a yes/no or a container there (a container's own fields are swept), or it's free
// text (§18: a line, a crew's name, a reason).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ITEMS, idOf, abilityCopy, tierCopy } from './helpers.mjs';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand, ERRANDS } from '../rules/errand.mjs';
import { checkPlay, defaultPlay, PLAY_KINDS, CRATE_AT, VAULT_AT } from '../rules/plays.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
// R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): WORKPLACES is gone (a hustle is in any district), so the fillers' place is DISTRICTS' first, Glasswall, as WORKPLACES' first was.
import { DISTRICTS, ROUTES, HOMES } from '../rules/state.mjs';
import { N } from '../numbers.mjs';

const NAMED = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];
const BAD = [...new Set([...NAMED, ...Object.getOwnPropertyNames(Object.prototype).sort()])];
// An ordinary id that names nothing: each of BAD must do exactly what it does.
const UNKNOWN = 'zz-unknown';
// §18: the only fields that carry words an agent wrote.
const TEXT = ['line', 'name', 'reason'];
const json = x => JSON.stringify(x);
// Where the fillers work and the hits, collars and patrols go, so each finds its target.
const OUT = DISTRICTS[0];
const CORNER = Object.keys(N.corners).sort()[0];

// --- The stage ------------------------------------------------------------------------------------------------------

// The cast: a01 runs most errands and plays and a02 is their other side; a04 keeps a crew, a06 took SUDO that a08 wrote,
// a08 cooks, a11 deals, a12 builds and a13 is the Cop; a09 sits in jail, a10 is evicted and a14 is wanted.
const CAST = Array.from({ length: 14 }, (_, i) => idOf(i + 1));
const TRADES = { a08: 'chemist', a11: 'dealer', a12: 'gunrunner', a13: 'cop' };
// Cash for every rent and every price below, many times over.
const PURSE = 10 * (N.rent * N.nights + Math.max(...N.bribe) + N.lookout + N.bailPerStar * N.maxHeat
  + Math.max(...Object.values(N.shopPrice)) + Math.max(...Object.values(N.price).map(p => p[0])));

function season() {
  const g = new Game({ n: 1 });
  const agents = CAST.map((id, i) => ({ id, name: `t${i + 1}`, trade: TRADES[id] || 'smuggler', driver: 'test' }));
  const r = newSeason({ seed: 404, rule: 'A', midseason: 'blackout', items: ITEMS, agents });
  g.s = r.state;
  g.log = [...r.events];
  checkLedger(g.s, 'setup');
  return g;
}
// Test-only goods, in through a named source, so the books still balance.
function stock(g, id, kind, n) {
  const a = g.s.agents[id];
  a.goods[kind] = (a.goods[kind] || 0) + n;
  const t = (g.s.goods.in.test ||= {});
  t[kind] = (t[kind] || 0) + n;
  checkLedger(g.s, 'stock');
}
const sitdownOf = (g, a, b) => Object.values(g.s.sitdowns).find(sd => sd.a === a && sd.b === b).id;
const dealOf = (g, kind) => Object.values(g.s.fence.deals).find(d => d.kind === kind).id;

// The day of the first shipment, so a crate waits at the docks, with everything the baselines need: pieces and goods, a
// listing and a swap at the fence, a crew with a stash, an open sit-down and an asked one, a SUDO writer, and an agent
// in jail, an evicted one and a wanted one.
function dayStage() {
  const g = season();
  for (const id of CAST) if (id !== 'a10') g.grant(id, PURSE);
  // a10 lays low with no cash, so the first dawn evicts it (§10).
  g.night({ a10: { kind: 'laylow', place: HOMES } }, { filler: { kind: 'hustle', place: OUT } });
  g.advanceTo(Math.min(...Object.keys(N.shipments).map(Number)));
  const [p1, p2, q, r1, r2] = [0, 1, 2, 3, 4].map(i => tierCopy(g.s, 'common', () => true, i));
  g.hand('a01', p1);
  g.hand('a01', p2);
  g.hand('a02', q, { wear: true });
  g.hand('a04', r1);
  g.hand('a04', r2);
  g.hand('a03', abilityCopy(g.s, 'earpiece'), { wear: true });
  const goods = [['a01', 'chems', 1], ['a01', 'temp', 1], ['a01', 'truth', 1], ['a01', 'warrants', 1], ['a04', 'chems', 2],
    ['a08', 'sudo', 1], ['a08', 'chems', N.cook.chems], ['a11', 'temp', 1], ['a12', 'parts', N.build.fakes]];
  for (const [id, kind, n] of goods) stock(g, id, kind, n);
  const go = (by, kind, fields) => assert.equal(g.errand(by, kind, fields).ok, true, `the stage: ${by} ${kind}`);
  go('a01', 'fence_list', { copy: p2, price: 10 });
  go('a04', 'crew_form', { name: 'c' });
  go('a04', 'crew_invite', { agent: 'a05' });
  go('a04', 'stash_put', { copy: r1, cash: 5, goods: { chems: 1 } });
  go('a01', 'ask', { to: 'a02' });
  go('a02', 'answer', { sitdown: sitdownOf(g, 'a01', 'a02'), accept: true });
  go('a06', 'ask', { to: 'a07' });
  go('a06', 'fence_swap', { to: 'a02', give: { cash: 1 }, get: { cash: 1 } });
  // SUDO handed over arrives as TEMP with its giver's mark, and the TEMP taken with it makes the giver its writer (§11).
  go('a08', 'give', { to: 'a06', goods: { sudo: 1 } });
  go('a06', 'take', { drug: 'temp' });
  g.s.agents.a09.jail = { nights: N.jailNights, stars: 1, since: g.s.day - 1 };
  g.s.agents.a14.heat = N.wantedAt;
  g.grant('a10', N.rent);
  assert.ok(g.s.agents.a10.evicted && g.s.agents.a06.writer === 'a08' && g.s.crate, 'the stage is set');
  const trait = Object.keys(g.s.traits).sort().find(t => g.s.traits[t].opens <= g.s.day
    && g.s.traits[t].copies.some(k => g.s.copies[k].holder.k === 'list'));
  return {
    s: g.s, p1, q, r1, r2, trait, slot: g.s.copies[p1].slot, crew: g.s.agents.a04.crew,
    s1: sitdownOf(g, 'a01', 'a02'), s2: sitdownOf(g, 'a06', 'a07'), listing: dealOf(g, 'listing'), swap: dealOf(g, 'swap'),
  };
}
// The last night, for the one play only it allows: boarding the ferry (§15).
function lastStage() {
  const g = season();
  for (const id of CAST) g.grant(id, PURSE);
  g.advanceTo(N.nights);
  return { s: g.s };
}
let stages;
const stage = () => (stages ||= { day: dayStage(), last: lastStage() });

// Every errand kind the rules export, each with errands that go through on the day stage: [sender, fields].
const ERRAND_CASES = st => ({
  dress: [['a01', { fit: { [st.slot]: st.p1 } }]],
  offer: [['a01', { trait: st.trait, amount: st.s.traits[st.trait].price }]],
  give: [['a01', { to: 'a02', copy: st.p1, cash: 1, goods: { chems: 1 } }]],
  pay: [['a01', { to: 'a02', amount: 1, for: 'gift' }]],
  bail: [['a01', { agent: 'a09' }]],
  rent: [['a10', {}]],
  crew_form: [['a03', { name: 'c2' }]],
  crew_invite: [['a04', { agent: 'a03' }]],
  crew_join: [['a05', { crew: st.crew }]],
  crew_leave: [['a04', {}]],
  stash_put: [['a04', { copy: st.r2, cash: 1, goods: { chems: 1 } }]],
  stash_take: [['a04', { copy: st.r1, cash: 1, goods: { chems: 1 } }]],
  ask: [['a01', { to: 'a08', line: 'a word' }]],
  answer: [['a07', { sitdown: st.s2, accept: true, line: 'sure' }]],
  say: [['a01', {
    sitdown: st.s1, say: 'promise', line: 'a deal',
    terms: { what: 'pay', who: 'a03', piece: st.trait, cash: 5, night: st.s.day, where: DISTRICTS[0], goods: { chems: 1 } },
  }]],
  close: [['a02', { sitdown: st.s1 }]],
  listen: [['a03', { sitdown: st.s1 }]],
  chat: [['a04', {
    say: 'promise', line: 'a deal',
    terms: { what: 'pay', who: 'a03', piece: st.trait, cash: 5, night: st.s.day, where: DISTRICTS[0], goods: { chems: 1 } },
  }]],
  outloud: [['a01', {
    say: 'offer', line: 'a deal',
    terms: { what: 'trade', who: 'a03', piece: st.trait, cash: 5, night: st.s.day, where: DISTRICTS[0], goods: { chems: 1 } },
  }]],
  shop: [['a01', { item: 'chems', units: 1, max: N.shopPrice.chems }]],
  sell: [['a01', { item: 'doses', drug: 'temp', units: 1 }]],
  fence_list: [['a01', { copy: st.p1, price: 10 }]],
  fence_unlist: [['a01', { deal: st.listing }]],
  fence_buy: [['a02', { deal: st.listing }]],
  fence_swap: [['a01', {
    to: 'a02', give: { pieces: [st.p1], goods: { chems: 1 }, cash: 1 }, get: { pieces: [st.q], goods: { parts: 1 }, cash: 1 },
  }]],
  fence_accept: [['a02', { deal: st.swap }]],
  tip: [['a01', { agent: 'a02', target: 'a03' }]],
  bribe: [['a01', { target: 'a02' }]],
  bounty: [['a01', { copy: st.q, amount: 1 }], ['a01', { agent: 'a02', amount: 1 }]],
  lookout: [['a01', { agent: 'a02' }]],
  take: [['a01', { drug: 'truth', play: { kind: 'hit', target: 'a02', place: OUT, want: st.q } }]],
  write: [['a08', { agent: 'a06', play: { kind: 'hit', target: 'a02', place: OUT, want: st.q } }]],
  plan: [['a01', { traits: [{ trait: st.trait, routes: ['buy', 'trade'] }] }]],
  orders: [['a01', { orders: [{ kind: 'retaliate' }, { kind: 'laylow', stars: 3 }, { kind: 'protect_grail' }, { kind: 'back', agent: 'a02' }, { kind: 'avoid_lawless' }] }]],
  note: [['a01', { line: 'a memory' }]],
  // Creed words are free text, not IDs; nonempty owner words and untrusted authority have their own canary tests.
  creed: [['a01', { lines: [] }]],
});

// Every play kind the rules export, each with plays that go through: [player, play, 'last' for the last night]. The
// second shift names no workplace and carries every field an invalid play's record keeps (§27: typed and logged), so
// that record is swept too.
const PLAY_CASES = st => ({
  hustle: [['a01', { kind: 'hustle', place: OUT }], ['a01', {
    // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a hustle may name any district, Pleasantview too, so the refused one names no district (UNKNOWN) where it named no workplace (Pleasantview).
    kind: 'hustle', place: UNKNOWN, target: 'a02', want: st.q, corner: CORNER, drug: 'temp', batches: 1, guns: 1, lockpicks: 1, warrants: 1,
  }, 'invalid']],
  hit: [['a01', { kind: 'hit', target: 'a02', place: OUT, want: st.q }]],
  breakin: [['a01', { kind: 'breakin', target: 'a02', want: st.q }]],
  back: [['a01', { kind: 'back', target: 'a02' }]],
  laylow: [['a01', { kind: 'laylow', place: HOMES }]],
  board: [['a01', { kind: 'board', place: ROUTES[0] }, 'last']],
  run: [['a01', { kind: 'run', place: Object.keys(N.drops).sort()[0] }]],
  cook: [['a08', {
    kind: 'cook', place: HOMES, batches: 1, drug: 'hallu',
    lies: [{ kind: 'cash', agent: 'a01', value: 5 }, { kind: 'stash', agent: 'a02', value: st.q }, { kind: 'tip', agent: 'a03', value: 'a04' }],
  }]],
  deal: [['a11', { kind: 'deal', corner: CORNER }]],
  build: [['a12', { kind: 'build', place: HOMES, guns: 0, lockpicks: 0, warrants: 0, fake: st.trait }]],
  patrol: [['a13', { kind: 'patrol', place: OUT }]],
  guard: [['a13', { kind: 'guard', place: VAULT_AT }]],
  collar: [['a13', { kind: 'collar', target: 'a14', place: OUT }]],
  grab: [['a01', { kind: 'grab', place: CRATE_AT }]],
  vault: [['a01', { kind: 'vault', place: VAULT_AT }]],
});

// --- The recorder and the swap --------------------------------------------------------------------------------------

// Wraps an errand or a play so every field the rules read from it, at any depth, is noted by its path: `give.pieces.0`,
// or `fit{}` for a map whose keys they list.
function recorder(value, seen, path = '') {
  if (value === null || typeof value !== 'object') return value;
  const at = k => (path ? `${path}.${k}` : k);
  return new Proxy(value, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      if (typeof k === 'symbol' || (Array.isArray(t) && !/^\d+$/.test(k))) return v;
      seen.add(at(k));
      return recorder(v, seen, at(k));
    },
    ownKeys(t) {
      seen.add(`${path}{}`);
      return Reflect.ownKeys(t);
    },
  });
}
const valueAt = (base, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), base);
// Whether a field is swept, by what the baseline holds there: a map's keys, a string, and nothing (a field the baseline
// leaves out) are; a number, a yes/no, free text and a container aren't.
function swept(base, path) {
  if (path.endsWith('{}')) return true;
  if (TEXT.includes(path.split('.').pop())) return false;
  const v = valueAt(base, path);
  return v == null || typeof v === 'string';
}
// Whether the baseline names an id there (a string, or a map's keys): such a field, refused, is typed never. One it
// leaves out may be no id at all (an optional number, say), so it's held only to what an unknown id does.
const named = (base, path) => path.endsWith('{}') || typeof valueAt(base, path) === 'string';
// The baseline with the field at `path` set to x, or, for `fit{}`, its map's keys swapped for x alone, holding the map's
// first value.
function swap(base, path, x) {
  const out = structuredClone(base);
  const keys = path.endsWith('{}');
  const parts = (keys ? path.slice(0, -2) : path).split('.');
  const last = parts.pop();
  const parent = parts.reduce((o, k) => o[k], out);
  parent[last] = keys ? { [x]: Object.values(parent[last])[0] } : x;
  return out;
}
// The fields of a baseline the sweep swaps: every one the rules read from it that's swept.
function fieldsOf(base, run) {
  const seen = new Set();
  run(recorder(base, seen));
  return [...seen].filter(p => p !== 'by' && swept(base, p)).sort();
}

// What every object shares, which no errand or play may touch: the prototypes, and the functions an inherited name
// finds.
const SHARED = [Object.prototype, Object, Function.prototype, Array.prototype,
  ...Object.getOwnPropertyNames(Object.prototype).map(k => Object.prototype[k]).filter(v => typeof v === 'function' && v !== Object)];
const sharedNow = () => SHARED.map(o => Object.getOwnPropertyNames(o).sort().join(','));
// Runs one try; anything it left on what every object shares is reported and taken back off, so the next try starts
// clean.
function guarded(fn) {
  const was = sharedNow();
  let out;
  try {
    out = fn();
  } catch (err) {
    out = { threw: `${err.constructor.name}: ${err.message.split('\n')[0]}` };
  }
  const left = [];
  SHARED.forEach((o, i) => {
    const keep = new Set(was[i].split(','));
    for (const k of Object.getOwnPropertyNames(o)) {
      if (keep.has(k)) continue;
      left.push(k);
      delete o[k];
    }
  });
  return left.length ? { ...out, left } : out;
}
const tryErrand = (s, e) => guarded(() => {
  const r = applyErrand(s, e, { source: 'owner' });
  return { r, json: json([r.ok, r.why, r.events, r.state]) };
});
const tryCheck = (s, who, p, n) => guarded(() => {
  const r = checkPlay(s, who, p, n);
  return { r, json: json(r) };
});
const tryNight = (s, plays) => guarded(() => {
  const r = settleNight(s, plays);
  return { r, json: json([r.events, r.state, r.fights, r.plays]) };
});
const reason = w => (typeof w === 'string' ? w : `a ${typeof w} as its reason`);
// What a try did, in words; x: the id it named, which a result that went through may have kept.
const said = (o, x) => {
  if (o.threw) return `threw ${o.threw}`;
  if (o.r.ok === false) return `refused (${reason(o.r.why)}, ${o.r.kind || (o.r.events[0] && o.r.events[0].kind)})`;
  const kept = x !== undefined && json([o.r.events, o.r.state, o.r.play]).includes(json(x));
  return `went through${kept ? `, keeping ${x}` : ''}`;
};
const without = (s, k) => json({ ...s, [k]: null });
// Every agent not in jail works a shift (boards, on the last night), so each night below differs only in the play swept.
const fillers = s => Object.fromEntries(Object.keys(s.agents).sort().filter(id => !s.agents[id].jail)
  .map(id => [id, s.day === N.nights ? { kind: 'board', place: ROUTES[0] } : { kind: 'hustle', place: OUT }]));
// An agent's play and invalid events of a night, as the record shows them.
const playsOf = (r, who) => r.events.filter(e => e.agent === who && ['play', 'invalid'].includes(e.type))
  .map(({ n, t, day, vis, ...e }) => json(e)).join(' ');

// --- The sweeps -----------------------------------------------------------------------------------------------------

// Each errand baseline, with every field it sweeps swapped for each of BAD and for an unknown id. Returns the problems
// found and the fields swept, by kind.
function sweepErrands() {
  const st = stage().day;
  const before = json(st.s);
  const problems = [];
  const fields = {};
  for (const [kind, cases] of Object.entries(ERRAND_CASES(st))) {
    cases.forEach(([by, rest], i) => {
      const base = { by, kind, ...rest };
      for (const path of fieldsOf(base, e => applyErrand(st.s, e, { source: 'owner' }))) {
        (fields[kind] ||= new Set()).add(path);
        const ctrl = tryErrand(st.s, swap(base, path, UNKNOWN));
        for (const bad of BAD) {
          const where = `${kind}${cases.length > 1 ? ` #${i + 1}` : ''} ${path}: ${bad}`;
          const o = tryErrand(st.s, swap(base, path, bad));
          if (o.left) problems.push(`${where} left ${o.left.join(', ')} on what every object shares`);
          if (o.threw) {
            problems.push(`${where} ${said(o)}`);
            continue;
          }
          if (o.json !== ctrl.json) problems.push(`${where} ${said(o, bad)}, where an unknown id ${said(ctrl, UNKNOWN)}`);
          try {
            checkLedger(o.r.state, where);
          } catch (err) {
            problems.push(`${where}: ${err.message.split('\n')[0]}`);
          }
          if (o.r.ok) continue;
          const [e, ...more] = o.r.events;
          if (more.length || !e || e.type !== 'invalid') problems.push(`${where} refused, but not as one invalid event: ${json(o.r.events)}`);
          else if (named(base, path) && e.kind !== 'never') problems.push(`${where} refused, typed ${e.kind}, not never`);
          if (without(o.r.state, 'seq') !== without(st.s, 'seq') || o.r.state.seq !== st.s.seq + 1) problems.push(`${where} refused, but the state changed`);
        }
      }
    });
  }
  if (json(st.s) !== before) problems.push('the stage itself changed');
  return { problems, fields };
}

// Each play baseline, with every field it sweeps swapped for each of BAD and for an unknown id, checked alone and
// played at the lock beside every other agent's filler.
function sweepPlays() {
  const problems = [];
  const fields = {};
  for (const [kind, cases] of Object.entries(PLAY_CASES(stage().day))) {
    cases.forEach(([who, play, mode], i) => {
      const st = mode === 'last' ? stage().last : stage().day;
      const before = json(st.s);
      const n = st.s.day;
      const night = p => tryNight(st.s, { ...fillers(st.s), [who]: p });
      for (const path of fieldsOf(play, p => settleNight(st.s, { ...fillers(st.s), [who]: p }))) {
        (fields[kind] ||= new Set()).add(path);
        const [ctrlCheck, ctrlNight] = [tryCheck(st.s, who, swap(play, path, UNKNOWN), n), night(swap(play, path, UNKNOWN))];
        for (const bad of BAD) {
          const where = `${kind}${cases.length > 1 ? ` #${i + 1}` : ''} ${path}: ${bad}`;
          const p = swap(play, path, bad);
          const [c, o] = [tryCheck(st.s, who, p, n), night(p)];
          for (const x of [c, o]) if (x.left) problems.push(`${where} left ${x.left.join(', ')} on what every object shares`);
          if (c.threw) problems.push(`${where}: checking it ${said(c)}`);
          else if (c.json !== ctrlCheck.json) problems.push(`${where}: checked, it ${c.r.ok ? `goes through as ${json(c.r.play)}` : said(c)}, where an unknown id ${ctrlCheck.r.ok ? `goes through as ${json(ctrlCheck.r.play)}` : said(ctrlCheck)}`);
          else if (!c.r.ok && named(play, path) && c.r.kind !== 'never') problems.push(`${where}: refused, typed ${c.r.kind}, not never`);
          if (o.threw) {
            problems.push(`${where}: the night ${said(o)}`);
            continue;
          }
          if (o.json !== ctrlNight.json) problems.push(`${where}: at the lock ${playsOf(o.r, who)}, where an unknown id ${ctrlNight.threw ? said(ctrlNight) : playsOf(ctrlNight.r, who)}`);
          try {
            checkLedger(o.r.state, where);
          } catch (err) {
            problems.push(`${where}: ${err.message.split('\n')[0]}`);
          }
          const invalid = o.r.events.filter(e => e.type === 'invalid' && e.agent === who);
          if (!c.threw && !c.r.ok && invalid.length !== 1) problems.push(`${where}: refused, but not as one invalid event at the lock`);
        }
      }
      if (json(st.s) !== before) problems.push(`${kind}: the stage itself changed`);
    });
  }
  return { problems, fields };
}
let sweeps;
const sweep = () => (sweeps ||= { errands: sweepErrands(), plays: sweepPlays() });
const list = problems => `\n  ${problems.join('\n  ')}`;

// --- The tests ------------------------------------------------------------------------------------------------------

test('the sweep has a baseline for every errand kind and every play kind the rules export, and each goes through (positive control)', () => {
  const st = stage();
  const errands = ERRAND_CASES(st.day);
  const plays = PLAY_CASES(st.day);
  assert.deepEqual(Object.keys(errands).sort(), [...ERRANDS].sort(), 'an errand kind the rules export has no baseline here');
  assert.deepEqual(Object.keys(plays).sort(), [...PLAY_KINDS].sort(), 'a play kind the rules export has no baseline here');
  for (const [kind, cases] of Object.entries(errands)) {
    for (const [by, fields] of cases) {
      const r = applyErrand(st.day.s, { by, kind, ...fields }, { source: 'owner' });
      assert.equal(r.ok, true, `${by} ${kind} ${json(fields)}: ${r.why}`);
    }
  }
  for (const [kind, cases] of Object.entries(plays)) {
    for (const [who, play, mode] of cases) {
      const s = (mode === 'last' ? st.last : st.day).s;
      const c = checkPlay(s, who, play, s.day);
      if (mode === 'invalid') assert.deepEqual([c.ok, c.kind], [false, 'never'], `${who} ${json(play)} is refused, typed never`);
      else assert.equal(c.ok, true, `${who} ${json(play)}: ${c.why}`);
      const r = settleNight(s, { ...fillers(s), [who]: play });
      const on = r.events.find(e => e.type === 'play' && e.agent === who);
      assert.equal(on.kind, mode === 'invalid' ? defaultPlay(s, who, s.day).kind : kind, `${who} plays ${kind} at the lock`);
    }
  }
});

test('the recorder finds the fields the rules read, at any depth, and every kind is swept (positive control)', t => {
  const { errands, plays } = sweep();
  const st = stage().day;
  const want = {
    errands: [['plan', 'traits.0.trait'], ['plan', 'traits.0.routes.0'], ['orders', 'orders.3.agent'], ['give', 'to'], ['give', 'copy'], ['give', 'goods{}'], ['pay', 'to'], ['pay', 'for'], ['ask', 'to'],
      ['fence_swap', 'to'], ['fence_swap', 'give.pieces.0'], ['fence_swap', 'get.pieces.0'], ['fence_swap', 'get.goods{}'],
      ['crew_join', 'crew'], ['offer', 'trait'], ['dress', 'fit{}'], ['dress', `fit.${st.slot}`], ['answer', 'sitdown'],
      ['say', 'terms.who'], ['say', 'terms.piece'], ['say', 'terms.where'], ['stash_take', 'copy'], ['fence_accept', 'deal'],
      ['bribe', 'target'], ['bounty', 'copy'], ['bounty', 'agent'], ['sell', 'item'], ['sell', 'drug'], ['take', 'play.target'],
      ['take', 'play.want'], ['write', 'agent'], ['write', 'play.target']],
    plays: [['hit', 'target'], ['hit', 'want'], ['hit', 'place'], ['run', 'place'], ['deal', 'corner'], ['cook', 'drug'],
      ['cook', 'lies.0.kind'], ['cook', 'lies.0.agent'], ['cook', 'lies.1.value'], ['cook', 'lies.2.value'], ['build', 'fake'],
      ['collar', 'target'], ['board', 'place'], ['hustle', 'corner'], ['hustle', 'drug']],
  };
  for (const [side, found] of Object.entries({ errands: errands.fields, plays: plays.fields })) {
    for (const [kind, path] of want[side]) assert.ok(found[kind] && found[kind].has(path), `${side}: ${kind} ${path} is swept`);
    for (const kind of side === 'errands' ? ERRANDS : PLAY_KINDS) assert.ok(found[kind] && found[kind].has('kind'), `${side}: ${kind}'s own kind is swept`);
  }
  const count = found => Object.values(found).reduce((k, f) => k + f.size, 0);
  t.diagnostic(`swept ${count(errands.fields)} errand fields over ${ERRANDS.length} kinds and ${count(plays.fields)} play fields over ${PLAY_KINDS.length} kinds, ${BAD.length} inherited names each, against an unknown id`);
});

test("the R2 tools' probe: give, pay, ask and fence_swap to __proto__ or constructor, crew_join and offer naming __proto__, and a hit on __proto__ or wanting it, each as an unknown id", () => {
  const st = stage().day;
  const errand = (kind, fields) => tryErrand(st.s, { by: 'a01', kind, ...fields });
  for (const x of ['__proto__', 'constructor']) {
    for (const [kind, fields] of [['give', { cash: 1 }], ['pay', { amount: 1 }], ['ask', {}], ['fence_swap', { give: { cash: 1 }, get: { cash: 1 } }]]) {
      const [o, ctrl] = [errand(kind, { to: x, ...fields }), errand(kind, { to: UNKNOWN, ...fields })];
      assert.ok(!o.threw && o.r.ok === false, `${kind} to ${x}: ${said(o, x)}`);
      assert.deepEqual([o.r.why, o.r.events.map(e => [e.type, e.kind])], [ctrl.r.why, [['invalid', 'never']]], `${kind} to ${x}`);
    }
  }
  for (const [kind, fields] of [['crew_join', { crew: '__proto__' }], ['offer', { trait: '__proto__', amount: 1 }]]) {
    const o = errand(kind, fields);
    assert.ok(!o.threw && o.r.ok === false, `${kind} ${json(fields)}: ${said(o, '__proto__')}`);
    assert.deepEqual(o.r.events.map(e => [e.type, e.kind]), [['invalid', 'never']], `${kind} ${json(fields)}`);
  }
  const hit = { kind: 'hit', target: 'a02', place: OUT };
  assert.deepEqual(checkPlay(st.s, 'a01', { ...hit, target: '__proto__' }, st.s.day), checkPlay(st.s, 'a01', { ...hit, target: UNKNOWN }, st.s.day), 'a hit on __proto__');
  assert.deepEqual(checkPlay(st.s, 'a01', { ...hit, target: '__proto__' }, st.s.day).kind, 'never', 'a hit on __proto__ is refused, typed never');
  assert.deepEqual(checkPlay(st.s, 'a01', { ...hit, want: '__proto__' }, st.s.day), { ok: true, play: hit }, 'a want of __proto__ is dropped, as an unknown want is');
  const lock = target => settleNight(st.s, { ...fillers(st.s), a01: { ...hit, target } }).events
    .filter(e => e.agent === 'a01' && e.type === 'invalid').map(e => [e.why, e.kind, e.play]);
  assert.deepEqual(lock('__proto__'), lock(UNKNOWN), 'at the lock, the hit is invalid as one on an unknown agent is');
  assert.deepEqual(lock('__proto__').map(([, kind, p]) => [kind, p]), [['never', { kind: 'hit', place: OUT }]], 'typed never, and its record names no target');
});

test('an errand naming an inherited name in any id field is refused, typed never, exactly as one naming an unknown id: nothing throws, nothing changes but the record, and the ledger checks (§23, §33)', () => {
  const { problems } = sweep().errands;
  assert.equal(problems.length, 0, list(problems));
});

test('an errand sent as an agent with an inherited name stops loudly, as one from any unknown agent does, and touches nothing every object shares', () => {
  const st = stage().day;
  const problems = [];
  for (const [kind, cases] of Object.entries(ERRAND_CASES(st))) {
    for (const [, fields] of cases) {
      const ctrl = tryErrand(st.s, { by: UNKNOWN, kind, ...fields });
      for (const bad of BAD) {
        const o = tryErrand(st.s, { by: bad, kind, ...fields });
        if (o.left) problems.push(`${kind} by ${bad} left ${o.left.join(', ')} on what every object shares`);
        if (!o.threw || o.threw.replaceAll(bad, 'ID') !== (ctrl.threw || '').replaceAll(UNKNOWN, 'ID')) problems.push(`${kind} by ${bad} ${said(o)}, where an unknown agent's ${said(ctrl)}`);
      }
    }
  }
  assert.equal(problems.length, 0, list(problems));
});

test('a play naming an inherited name in any id field is refused, typed never, exactly as one naming an unknown id, checked alone and at the lock, where the night settles as it would for the unknown id and the ledger checks (§23, §27, §33)', () => {
  const { problems } = sweep().plays;
  assert.equal(problems.length, 0, list(problems));
});
