// Shared set-up for the rules tests. Not a test file itself: it only builds seasons and hands out fixtures.
// Fixtures are looked up by tier, slot and ability, never by copy id, so a different seed can't silently change them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newSeason } from '../rules/setup.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { settleNight } from '../rules/night.mjs';
import { checkLedger } from '../rules/ledger.mjs';
import { viewFor } from '../rules/view.mjs';
import { moveCopy } from '../rules/state.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ITEMS = JSON.parse(fs.readFileSync(path.join(here, '..', 'data', 'items.json'), 'utf8')).items;
export const idOf = i => `a${String(i).padStart(2, '0')}`;
export const cast = n => Array.from({ length: n }, (_, i) => ({ id: idOf(i + 1), name: `t${i + 1}`, trade: 'smuggler', driver: 'test' }));

export class Game {
  constructor({ n = 6, seed = 404, rule = 'A', midseason = 'blackout' } = {}) {
    const r = newSeason({ seed, rule, midseason, items: ITEMS, agents: cast(n) });
    this.s = r.state;
    this.log = [...r.events];
    checkLedger(this.s, 'setup');
  }

  errand(by, kind, fields = {}) {
    const r = applyErrand(this.s, { by, kind, ...fields });
    this.s = r.state;
    this.log.push(...r.events);
    checkLedger(this.s, `${by} ${kind}`);
    return r;
  }

  // Settles tonight. Agents without a play in `plays` get `filler` (a hustle at the Mall; on night 14, boarding
  // through Glasswall), so every test spells out only the plays it is about.
  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): the filler is a hustle at the Mall, lawless, so it adds no star, as the shift at the docks added none; a hustle at the docks (normal) adds one a night, and the fillers were arrested by night 5.
  night(plays = {}, { filler = { kind: 'hustle', place: 'mall' }, exact = false, opts } = {}) {
    const all = {};
    if (exact) Object.assign(all, plays);
    else {
      for (const id of Object.keys(this.s.agents).sort()) {
        if (this.s.agents[id].jail) continue;
        all[id] = plays[id] || (this.s.day === 14 ? { kind: 'board', place: 'downtown' } : filler);
      }
    }
    const before = this.log.length;
    const r = settleNight(this.s, all, opts);
    this.s = r.state;
    this.log.push(...r.events);
    checkLedger(this.s, `night ${this.s.day - 1}`);
    r.newEvents = this.log.slice(before);
    return r;
  }

  // R11 re-pin (the shift replaced by hustles; slime, 10-21: "let's just do that"; core/reports/R9/REPINS.md): a test can pass the nights' options (a filler of its own) to every night up to the day.
  advanceTo(day, opts) {
    while (this.s.day < day) this.night({}, opts);
  }

  // Test-only money: it comes in through a named source, so the cash check still holds.
  grant(id, cash) {
    this.s.money.in.test = (this.s.money.in.test || 0) + cash;
    this.s.agents[id].cash += cash;
    checkLedger(this.s, 'grant');
  }

  // Test-only hand-out of a copy from the list.
  hand(id, copy, { wear = false } = {}) {
    moveCopy(this.s, copy, { k: 'agent', id }, 'test');
    if (wear) this.s.agents[id].outfit[this.s.copies[copy].slot] = copy;
    checkLedger(this.s, 'hand');
    return copy;
  }

  view(who, audience = 'agent') {
    return viewFor(this.s, this.log, who, audience);
  }

  events(type, pred = () => true) {
    return this.log.filter(e => e.type === type && pred(e));
  }
}

// The copies still on the list whose trait matches, in id order.
export function listCopies(s, pred) {
  return Object.values(s.traits)
    .filter(t => pred(t))
    .sort((x, y) => (x.id < y.id ? -1 : 1))
    .flatMap(t => t.copies.filter(k => s.copies[k].holder.k === 'list'));
}
export const abilityCopy = (s, ability, i = 0) => listCopies(s, t => t.ability === ability)[i];
export const tierCopy = (s, tier, pred = () => true, i = 0) => listCopies(s, t => t.tier === tier && !t.ability && pred(t))[i];
// Two plain pieces of one tier in different slots (for the §4 tie rule).
export function twoInDifferentSlots(s, tier, avoid = []) {
  const traits = Object.values(s.traits).filter(t => t.tier === tier && !t.ability && !avoid.includes(t.slot)).sort((x, y) => (x.id < y.id ? -1 : 1));
  const first = traits[0];
  const second = traits.find(t => t.slot !== first.slot);
  return [first.copies[0], second.copies[0]];
}
export const json = x => JSON.stringify(x);
