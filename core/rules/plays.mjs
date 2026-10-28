// Tonight's legal plays (GAME.md §7, §15, §33), checking a play, and the default play (§17, §27).
import { N } from '../numbers.mjs';
import { DISTRICTS, ROUTES, HOMES, LAST_NIGHT, DRUGS, agentIds, byId, dosesOf, tookToday, own, dueOf } from './state.mjs';

// §6, §9: the shipment crate comes in at Low Tide Docks.
export const CRATE_AT = 'docks';
// §6, §13: the Evidence Vault is at Precinct 9, in Glasswall.
export const VAULT_AT = 'downtown';

// §11: a crash, or a night without a drug it's hooked on, leaves an agent only the default play (GAP gap.forced).
export const forcedWhy = a => (a.crash ? 'crash' : a.hooked.some(d => !tookToday(a, d)) ? 'withdrawal' : null);

// §11: what the lock forces, after jail: a crash or a withdrawal the default play, then TRUTH's locked play, then SUDO's
// written play, unless FIREWALL keeps that con out, each checked again then; one that no longer works gives way to the
// default play (GAP gap.forced, gap.sudo, gap.firewall). `opts` is checkPlay's.
export function forcedPlay(s, id, n, opts = {}) {
  const a = s.agents[id];
  const crash = forcedWhy(a);
  const why = crash || (a.locked ? 'truth' : a.written && !a.high.includes('firewall') ? 'sudo' : null);
  const r = why && !crash ? checkPlay(s, id, a.locked || a.written, n, opts) : null;
  return why ? { why, play: r && r.ok ? r.play : defaultPlay(s, id, n) } : null;
}

// §11, TRUTH: the play a take locks, or why it can't: one of tonight's legal plays as they stand once the dose is taken,
// so in jail none, and while a crash or a withdrawal forces the default play, only that one. From the take until dawn,
// what it locks is what the lock plays: lockOf(s, id, a.locked, n) stays ok (GAP gap.truth). R4-3: it counts only the
// goods the agent holds, never goods on order, which can come back at the lock.
export function lockOf(s, id, p, n) {
  if (s.agents[id].jail) return no('no play tonight to lock', 'not-yet');
  const r = checkPlay(s, id, p, n, { held: true });
  const d = forcedWhy(s.agents[id]) && defaultPlay(s, id, n);
  return r.ok && d && (r.play.kind !== d.kind || r.play.place !== d.place) ? no("tonight's play is forced", 'not-yet') : r;
}

// §11, HALLU: a cook's lies are its own until day 15, and (layer 4) so is the trait a build fakes, so a play goes on the
// record, and shows verified, without them (GAP gap.hallu, gap.fakes).
export const onRecord = ({ lies, fake, ...p }) => p;

// §33: list every legal play, with its place filled in. A hit's place is the agent's choice, so it lists the places.
// SUDO's writer works unseen, so its taker's legal plays don't change (GAP gap.sudo).
export function legalPlays(s, id) {
  const a = s.agents[id];
  if (!a || a.jail || s.over) return [];
  const forced = forcedPlay(s, id, s.day);
  if (forced && forced.why !== 'sudo') return [forced.play];
  const others = agentIds(s).filter(x => x !== id && !s.agents[x].jail);
  // §7, §13, §15: a vault job, on any night, while the agent holds a forged warrant (GAP gap.vault).
  const vault = a.goods.warrants ? [{ kind: 'vault', place: VAULT_AT }] : [];
  if (s.day === LAST_NIGHT) {
    return [
      ...ROUTES.map(r => ({ kind: 'board', place: r })),
      ...vault,
      ...others.map(x => ({ kind: 'hit', target: x, places: ROUTES })),
      ...others.map(x => ({ kind: 'back', target: x })),
    ];
  }
  // §13: a Cop patrols any district, guards the vault, wanted or not (layer 4, GAP gap.guard), and collars a wanted
  // agent unless it's wanted itself.
  const cop = a.trade !== 'cop' ? [] : [
    ...DISTRICTS.map(d => ({ kind: 'patrol', place: d })),
    { kind: 'guard', place: VAULT_AT },
    ...(a.heat >= N.wantedAt ? [] : others.filter(x => s.agents[x].heat >= N.wantedAt).map(x => ({ kind: 'collar', target: x, places: DISTRICTS }))),
  ];
  return [
    ...DISTRICTS.map(d => ({ kind: 'hustle', place: d })),
    ...tradePlays(s, a),
    ...cop,
    ...(s.crate ? [{ kind: 'grab', place: CRATE_AT }] : []),
    ...vault,
    ...others.map(x => ({ kind: 'hit', target: x, places: DISTRICTS })),
    ...agentIds(s).filter(x => x !== id && !s.agents[x].evicted).map(x => ({ kind: 'breakin', target: x, place: HOMES })),
    ...others.map(x => ({ kind: 'back', target: x })),
    ...(a.evicted ? [] : [{ kind: 'laylow', place: HOMES }]),
  ];
}

// §9 (R4-3): what an agent has for tonight's work, by kind: what it holds, and what its orders at the city's shop bring at
// the lock, before the plays lock (GAP gap.marketOrder). checkPlay's `opts`: `held`, only what it holds; `short`, what
// its orders at tonight's lock didn't bring.
function tonightsGoods(s, a, opts = {}) {
  const due = opts.held ? {} : dueOf(s, a.id);
  const short = opts.short || {};
  return k => (a.goods[k] || 0) + (due[k] || 0) + (short[k] || 0);
}

// §9: the night's work of the agent's trade, each with its place, and only what it holds enough for tonight (GAP
// gap.trades).
function tradePlays(s, a) {
  const has = tonightsGoods(s, a);
  const out = [];
  if (a.trade === 'smuggler') for (const d of Object.keys(N.drops).sort(byId)) out.push({ kind: 'run', place: d });
  if (a.trade === 'chemist') {
    for (const place of a.evicted ? ['forest'] : [HOMES, 'forest']) {
      for (let b = 1; b <= N.cook.batches && has('chems') >= b * N.cook.chems; b++) out.push({ kind: 'cook', place, batches: b });
    }
  }
  if (a.trade === 'dealer' && dosesOf(a)) {
    for (const c of Object.keys(N.corners).sort(byId)) out.push({ kind: 'deal', corner: c, place: N.corners[c].place });
  }
  if (a.trade === 'gunrunner' && !a.evicted) {
    const most = Math.min(N.build.parts, has('parts'));
    for (let guns = 0; guns * N.build.guns <= most; guns++) {
      for (let lockpicks = 0; guns * N.build.guns + lockpicks * N.build.lockpicks <= most; lockpicks++) {
        if (guns + lockpicks) out.push({ kind: 'build', place: HOMES, guns, lockpicks });
      }
    }
  }
  return out;
}

const no = (why, kind = 'never') => ({ ok: false, why, kind });
const yes = play => ({ ok: true, play });

// Checks a play for night n and keeps only its typed fields. A failure says whether it could work later ("not yet")
// or never can (§33: "type every failure"). §8 (GAP gap.accept): any play but a back may name the agents its leader
// accepts as backers, in its order, as `accept`: other agents, each once (none at all is a list too: nobody). A back
// leads no group, so a back's list is dropped.
// `opts`: `held`, count only the goods the agent holds (TRUTH's lock, so a verified play never rests on an order that can
// come back); `short`, the goods its orders at the city's shop didn't bring at tonight's lock (R4-3: a cook or a build is
// never invalid for an unfilled order, and works with what came, GAP gap.marketOrder).
export function checkPlay(s, id, p, n, opts = {}) {
  const r = checkKind(s, id, p, n, opts);
  if (!r.ok || r.play.kind === 'back' || p.accept == null) return r;
  const why = acceptWhy(p.accept, id, x => !!own(s.agents, x));
  return why ? no(`accept: ${why}`) : yes({ ...r.play, accept: [...p.accept] });
}

// §8 (GAP gap.accept): why a play's `accept` can't stand, or null when it can: a list of other agents (`known` says who
// is one), each once. The one owner of the check: the tools ask it too, so a seat hears the refusal when it replies.
export const acceptWhy = (list, self, known) => (Array.isArray(list) && list.every(x => known(x) && x !== self)
  && new Set(list).size === list.length ? null : 'a list of other agents, each once');

function checkKind(s, id, p, n, opts = {}) {
  if (!p || typeof p !== 'object') return no('no play', 'not-yet');
  const last = n === LAST_NIGHT;
  const a = s.agents[id];
  const t = own(s.agents, p.target);
  // §4: a hit or a break-in can name the piece it wants if two tie; only a real piece or trait counts.
  const want = own(s.copies, p.want) || own(s.traits, p.want) ? p.want : undefined;
  const target = () => (!t || t.id === id ? 'no such target' : null);
  switch (p.kind) {
    case 'hustle':
      if (last) return no('no work on the last night');
      if (!DISTRICTS.includes(p.place)) return no('a hustle names a district');
      return yes({ kind: 'hustle', place: p.place });
    case 'run':
    case 'cook':
    case 'deal':
    case 'build':
      return last ? no('no work on the last night') : checkTrade(s, a, p, opts);
    case 'hit': {
      if (target()) return no(target());
      if (t.jail) return no('the target is in jail', 'not-yet');
      if (!(last ? ROUTES : DISTRICTS).includes(p.place)) return no(last ? 'name a route' : 'name a district');
      return yes(want ? { kind: 'hit', target: t.id, place: p.place, want } : { kind: 'hit', target: t.id, place: p.place });
    }
    case 'breakin':
      if (last) return no('every home is empty on the last night');
      if (target()) return no(target());
      if (t.evicted) return no('the target has no home', 'not-yet');
      return yes(want ? { kind: 'breakin', target: t.id, place: HOMES, want } : { kind: 'breakin', target: t.id, place: HOMES });
    case 'back':
      if (target()) return no(target());
      if (t.jail) return no('the agent is in jail', 'not-yet');
      return yes({ kind: 'back', target: t.id });
    case 'laylow':
      if (last) return no('nobody lays low on the last night');
      if (a.evicted) return no('no home to lay low in', 'not-yet');
      return yes({ kind: 'laylow', place: HOMES });
    case 'patrol':
    case 'guard':
      if (last) return no('no work on the last night');
      if (a.trade !== 'cop') return no(`only a cop can ${p.kind}`);
      // §13 (layer 4): a guard is at the vault, whatever place it names (GAP gap.guard).
      if (p.kind === 'guard') return yes({ kind: 'guard', place: VAULT_AT });
      if (!DISTRICTS.includes(p.place)) return no('name a district');
      return yes({ kind: 'patrol', place: p.place });
    case 'collar':
      if (last) return no('no work on the last night');
      if (a.trade !== 'cop') return no('only a cop can collar');
      if (target()) return no(target());
      if (t.jail) return no('the target is in jail', 'not-yet');
      if (a.heat >= N.wantedAt) return no("a wanted cop can't collar", 'not-yet');
      if (t.heat < N.wantedAt) return no("the target isn't wanted", 'not-yet');
      if (!DISTRICTS.includes(p.place)) return no('name a district, or Pleasantview for its home');
      return yes({ kind: 'collar', target: t.id, place: p.place });
    case 'grab':
      if (last) return no('no grabs on the last night');
      if (!s.crate) return no('no crate at the docks tonight', 'not-yet');
      return yes({ kind: 'grab', place: CRATE_AT });
    case 'board':
      if (!last) return no('the ferry leaves on night 14', 'not-yet');
      if (!ROUTES.includes(p.place)) return no('pick a route: downtown, industrial or junkyard');
      return yes({ kind: 'board', place: p.place });
    case 'vault':
      if (!a.goods.warrants) return no('nobody gets in without a forged warrant', 'not-yet');
      return yes({ kind: 'vault', place: VAULT_AT });
    default:
      return no('unknown play kind');
  }
}

// §9: a trade's night of work (GAP gap.trades). A play another trade's agent sends never works; one it can't afford yet
// may work later.
const TRADE_OF = { run: 'smuggler', cook: 'chemist', deal: 'dealer', build: 'gunrunner' };
const count = x => (x === undefined ? 0 : Number.isInteger(x) && x >= 0 ? x : NaN);
// §11, HALLU: a lead is typed: an agent's cash (whole dollars), the piece in its stash (a copy, or null for none) or the
// agent it tipped on; anything else is no lead (GAP gap.hallu).
const LEAD = {
  cash: (s, v) => Number.isInteger(v) && v >= 0,
  stash: (s, v) => v === null || !!own(s.copies, v),
  tip: (s, v) => !!own(s.agents, v),
};
const leadOf = (s, l) => (l && own(LEAD, l.kind) && own(s.agents, l.agent) && LEAD[l.kind](s, l.value)
  ? { kind: l.kind, agent: l.agent, value: l.value } : null);
function checkTrade(s, a, p, opts = {}) {
  if (a.trade !== TRADE_OF[p.kind]) return no(`only a ${TRADE_OF[p.kind]} can ${p.kind}`);
  const has = tonightsGoods(s, a, opts);
  if (p.kind === 'run') {
    if (!own(N.drops, p.place)) return no('run a drop: mall, forest, junkyard or docks');
    return yes({ kind: 'run', place: p.place });
  }
  if (p.kind === 'cook') {
    if (p.place !== HOMES && p.place !== 'forest') return no('cook at home (suburbs) or at the lab (forest)');
    if (!Number.isInteger(p.batches) || p.batches < 1 || p.batches > N.cook.batches) return no(`cook 1 to ${N.cook.batches} batches`);
    // §11: a cook may name its drug, like a hit's want; one that names none makes TEMP (GAP gap.doses). A HALLU cook
    // writes as many lies as it likes, at least two (slime, 10-15; GAP gap.hallu).
    if (p.drug != null && !DRUGS.includes(p.drug)) return no(`cook one of the drugs: ${DRUGS.join(', ')}`);
    const lies = p.drug === 'hallu' && Array.isArray(p.lies) && p.lies.length >= 2 ? p.lies.map(l => leadOf(s, l)) : [];
    if (p.drug === 'hallu' && !(lies.length && lies.every(Boolean))) return no('a HALLU cook writes at least two lies: cash, stash or tip, each with an agent and a value');
    if (p.place === HOMES && a.evicted) return no('no home to cook in', 'not-yet');
    if (has('chems') < p.batches * N.cook.chems) return no('not enough chems', 'not-yet');
    return yes({ kind: 'cook', place: p.place, batches: p.batches, ...(p.drug != null ? { drug: p.drug } : {}), ...(lies.length ? { lies } : {}) });
  }
  if (p.kind === 'deal') {
    if (!own(N.corners, p.corner)) return no('name a corner');
    if (!dosesOf(a)) return no('no doses to deal', 'not-yet');
    return yes({ kind: 'deal', corner: p.corner, place: N.corners[p.corner].place });
  }
  // §9, §38 (layer 4): a build may name forged warrants too, and one trait of the drop to fake, which the legal plays
  // don't list (GAP gap.warrants, gap.fakes).
  const [guns, lockpicks, warrants, fake] = [count(p.guns), count(p.lockpicks), count(p.warrants), p.fake == null ? 0 : 1];
  if (fake && !own(s.traits, p.fake)) return no('fake one trait of the drop');
  const parts = guns * N.build.guns + lockpicks * N.build.lockpicks + warrants * N.build.warrants + fake * N.build.fakes;
  if (!(guns + lockpicks + warrants + fake >= 1) || parts > N.build.parts) return no(`build guns and lockpicks, up to ${N.build.parts} parts`);
  if (warrants > N.warrantsNight) return no(`forged warrants: ${N.warrantsNight} a night at most`);
  if (a.evicted) return no('no home to build in', 'not-yet');
  if (has('parts') < parts) return no('not enough parts', 'not-yet');
  return yes({ kind: 'build', place: HOMES, guns, lockpicks, ...(warrants ? { warrants } : {}), ...(fake ? { fake: p.fake } : {}) });
}

export const PLAY_KINDS = ['hustle', 'hit', 'breakin', 'back', 'laylow', 'board', 'run', 'cook', 'deal', 'build', 'patrol', 'collar', 'grab', 'vault', 'guard'];

// §17: who made a play, so "which AI won" stays honest: a seat's model, its standing orders, or its default play. A
// play may carry one, kept only when it's one of these, so a bot's play carries none (GAP gap.origin).
// These tags are stamped by trusted controllers; model/tool JSON cannot grant human authorship.
export const ORIGINS = ['model', 'orders', 'default', 'owner'];
export const originOf = p => (p && ORIGINS.includes(p.origin) ? { origin: p.origin } : {});

// The typed parts of a play as it was sent, and who made it, for the record of an invalid or a forced one (§18:
// nothing an agent wrote goes on the record outside `line` and `reason`; GAP gap.origin).
export function typedPlay(s, p) {
  if (!p || typeof p !== 'object') return null;
  const out = { kind: PLAY_KINDS.includes(p.kind) ? p.kind : 'unknown' };
  if (DISTRICTS.includes(p.place)) out.place = p.place;
  if (own(s.agents, p.target)) out.target = p.target;
  if (own(s.copies, p.want) || own(s.traits, p.want)) out.want = p.want;
  if (own(N.corners, p.corner)) out.corner = p.corner;
  for (const k of ['batches', 'guns', 'lockpicks', 'warrants']) if (Number.isInteger(p[k]) && p[k] >= 0 && p[k] <= N.build.parts) out[k] = p[k];
  if (DRUGS.includes(p.drug)) out.drug = p.drug;
  // §8 (GAP gap.accept): a list of agents on the board, kept only when every entry is one.
  if (Array.isArray(p.accept) && p.accept.length <= agentIds(s).length && p.accept.every(x => !!own(s.agents, x))) out.accept = [...p.accept];
  return { ...out, ...originOf(p) };
}

// §17: with no answer and no standing orders, an agent lays low. Where it can't (GAP, numbers.mjs gap.defaultPlay):
// an evicted agent hustles at Millennium Mall (R11), and on the last night it boards through Glasswall.
export function defaultPlay(s, id, n) {
  if (n === LAST_NIGHT) return { kind: 'board', place: 'downtown' };
  if (s.agents[id].evicted) return { kind: 'hustle', place: 'mall' };
  return { kind: 'laylow', place: HOMES };
}
