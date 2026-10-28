import { twinValidation, modelStatus, treatmentOf } from './evidence.mjs';
// GAME.md §27's pass bars: every one of them, and the measures they read, live in this module (R4-11; design (b) of
// docs/redesign/gates-20261017.md, and docs/redesign/gates-20261017-b.md). Each bar has its §27 line quoted above its
// code, as trunk's GAME.md words it, and one reading. The share of seasons a bar needs is applied here too, and so is
// each bar's count across a set of seasons. The rest of a season's numbers are metrics.mjs's; report.mjs only formats;
// bars.mjs, crime.mjs, skill.mjs and trades.mjs read the verdicts from here.
// The readings where §27's words could be read two ways are the orchestrator's calls (10-17), under slime's go of
// 10-17: "Keep tuning against the bot test , and we fix everything Astra mentioned . I'm not the engineer here, so do
// what's best for the game". Each is quoted again where a bar uses it:
// 1. Buy-late and turtle: every buy-late bot, and every turtle, finishes below the median haul.
// 2. "The median X" is one seat: the seats ranked by the bar's measure, lowest first; with an even count, the lower of
//    the two middle seats; a tie goes as the bar's line favours.
// 3. A trade's Cops, Gunrunners, Smugglers, Chemists and Dealers are the seats that play the trade: a bot by its own
//    driver, a model seat by its trade.
// 4. "All the value stolen" is every take by crime: hits (cash, pieces and goods), break-ins, grabs and vault jobs.
// 5. A stolen piece counts at its copy's own first sale on the list, as haul does; goods at the city's opening prices.
// 6. "Out-earn" in the money works is haul (copy paid), as in the crime bar; income stays as a shadow.
// 7. "Most chems that get cooked come from Smugglers": more than half of the Chemists' chems came from Smugglers, the
//    city's shop and the Chemists' own kits counted in the total.
// 8. The 90%, 30% and half thresholds count distinct seasons.
import { createHash } from 'node:crypto';
import { N } from '../numbers.mjs';
import { TRADES } from '../rules/setup.mjs';

// The five trades are the rules' own list (§9), so the bench never keeps a second one.
export { TRADES };

const sum = list => list.reduce((t, x) => t + x, 0);
const share = (part, whole) => (whole ? part / whole : null);
const mean = list => (list.length ? sum(list) / list.length : null);
const byId = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
// §11's six drugs, in its order.
export const DRUGS = Object.keys(N.walks);

// --- the bars ---------------------------------------------------------------------------------------------------------
// Every bar a season or a set of seasons carries, in the order the reports list them. `key` names it in a season's
// `bars`; `label` is its row in the reports; `need` is the share of seasons §27 gives it, or null where §27 gives none;
// `row` says whether the summary counts its seasons (a number reported with no bar isn't counted); `words` is its line
// in §27 (trunk's GAME.md), quoted again above its code below.
export const BARS = [
  {
    key: 'ledger', row: true, need: null, label: 'The ledger and cash checks (after every errand and every night; a failure stops the season)',
    words: 'The ledger never loses or doubles a copy, and the same seed gives the same log.',
  },
  {
    key: 'buyLate', row: true, need: 0.9, label: 'Buy-late bot below the median haul (≥ 90% of seasons)',
    words: "A buy-late bot (saves everything, buys only on the list's last two nights) and a turtle bot (lays low every night after its first rare) each finish below the median haul in at least 90% of seasons.",
  },
  {
    key: 'turtle', row: true, need: 0.9, label: 'Turtle below the median haul (≥ 90% of seasons)',
    words: "A buy-late bot (saves everything, buys only on the list's last two nights) and a turtle bot (lays low every night after its first rare) each finish below the median haul in at least 90% of seasons.",
  },
  {
    key: 'crimePays', row: true, need: null, label: 'Crime pays, with risk: the median robber by haul out-earns the median hustler, and was arrested at least once',
    words: 'Crime pays, with risk: the median robber out-earns the median hustler, and gets arrested at least once. The median robber is one robber: rank the robbers by haul, lowest first, a tie going to the one arrested fewer times. It\'s the middle one, or with an even count the lower of the two middle ones. Its haul beats the median hustler\'s, and it was itself arrested at least once that season.',
  },
  {
    key: 'crimeMedians', row: true, need: null, label: "Crime pays, with risk, the shadow reading (the bench's before R4-1): the robbers' median haul beats the hustler's, and the median of their arrests is at least 1",
    words: "Reports also show the earlier reading, the robbers' median haul and the median of their arrests, as a shadow.",
  },
  {
    key: 'middle', row: true, need: null, label: 'The last night moves < 1/3 of stolen value',
    words: 'The middle matters: the last night moves less than a third of all the value stolen in a season.',
  },
  { key: 'leaderChanges', row: true, need: null, label: '#1 by haul changes hands ≥ 3 times', words: '#1 by haul changes hands at least 3 times a season.' },
  { key: 'betrayals', row: true, need: null, label: '≥ 3 betrayals a season', words: 'At least 3 betrayals a season (walk, rug, turn, rat, double-sell).' },
  {
    key: 'showWorthy', row: true, need: null, label: 'A show-worthy event every night',
    words: 'Every night has at least one show-worthy event: a theft, an arrest, a corner fight, a turn, a grab or a vault job.',
  },
  {
    key: 'mintedMoved', row: true, need: null, label: '≥ 1/3 of minted traits taken or traded',
    words: 'At least a third of the traits that mint were taken or traded at least once.',
  },
  {
    key: 'places', row: true, need: null, label: 'Places matter',
    words: "Places matter: rerun each night with places ignored. At least 1 night's result in 5 changes. Hits backed by public or scouted sightings land more often than blind ones.",
  },
  {
    key: 'dropSells', row: true, need: null, label: 'Most of the drop sells (≥ 3/4)',
    words: 'Most of the drop sells: at least three in four copies sell before the list closes.',
  },
  {
    key: 'money', row: true, need: null, label: 'The money works (§27)',
    words: "The money works: the median Smuggler, Chemist and Dealer each out-earn the median hustler. Most chems that get cooked come from Smugglers, not the city's shop. No trade's median income is more than twice another's.",
  },
  {
    key: 'moneyEarn', row: true, need: null, label: 'The money works, 1: the median Smuggler, Chemist and Dealer each out-earn the median hustler (by haul; income a shadow)',
    words: 'the median Smuggler, Chemist and Dealer each out-earn the median hustler.',
  },
  {
    key: 'moneyChems', row: true, need: null, label: 'The money works, 2: most chems cooked come from Smugglers (more than half of what reached the Chemists, the shop and their kits counted)',
    words: "Most chems that get cooked come from Smugglers, not the city's shop.",
  },
  {
    key: 'moneyGap', row: true, need: null, label: "The money works, 3: no trade's median income more than twice another's",
    words: "No trade's median income is more than twice another's.",
  },
  {
    key: 'moneyShare', row: false, need: null, label: "The money works, 4: the street's share of the cash onto the island (§9: about two-thirds; reported, no bar)",
    words: 'Not a §27 bar: §9 says "The street is the biggest source: about two-thirds of everything earned."',
  },
  {
    key: 'copGunrunner', row: true, need: 0.3, label: 'The median Cop and the median Gunrunner finish in the top half (≥ 30% of seasons)',
    words: 'The median cop and the median Gunrunner finish in the top half in at least 30% of seasons.',
  },
  {
    key: 'drugs', row: true, need: null, label: 'Every drug taken at least once a season, and someone hooked (§27, layer 3)',
    words: 'From layer 3: every drug gets taken at least once a season, and someone gets hooked.',
  },
  {
    key: 'vault', row: true, need: 0.5, label: 'Someone jobs the vault (≥ 50% of seasons; §27, layer 4)',
    words: 'From layer 4: someone jobs the vault in at least half of seasons.',
  },
  {
    key: 'backing', row: false, need: null, label: 'The backing rules (reported, no bar)',
    words: 'The backing rules: run A and B on the same seeds and report how often a target cut a backer of the attack on itself, and how often backing decided a fight.',
  },
  {
    key: 'models', row: true, need: null, label: 'Local-model agents beat the scripted bots on average (paired seats, §27)',
    words: "Local-model agents beat the scripted bots on average (slime, 10-16, §41). Seats: the model plays seats of the trade bots and §25's strategies. It never plays a crew member or one of the 3 hustlers. The comparison: each seed plays twice, once with the bot in the seat and once with the model. The model wins the bar when its mean haul across the paired seats beats the bots'. How many: 10 paired seasons first. If the gap is within the season-to-season noise, run 40.",
  },
  {
    key: 'ceiling', row: true, need: null, label: `Runner calls stay inside the ceiling (§18: ${N.callCeiling} a seat a day)`,
    words: 'Runner calls stay inside the ceiling (§18).',
  },
  {
    key: 'invalid', row: false, need: null, label: 'Invalid plays (hygiene, no bar)',
    words: "Invalid plays are typed, logged and replaced by the default play, and the report gives the rate per model. There's no bar: it's a hygiene number, and choices are never hidden to lower it (§33).",
  },
  {
    key: 'invalidByModel', row: false, need: null, label: 'Invalid plays per model (hygiene, no bar)',
    words: "Invalid plays are typed, logged and replaced by the default play, and the report gives the rate per model. There's no bar: it's a hygiene number, and choices are never hidden to lower it (§33).",
  },
];
export const barOf = key => BARS.find(b => b.key === key);

// The bench's bot types, in the order the reports list them.
export const BOT_TYPES = ['hustle', 'buylate', 'turtle', 'scout', 'guess', 'crew', 'squatter', ...TRADES];

// --- haul -------------------------------------------------------------------------------------------------------------
// §27: "**Haul** (for testing) is Mainland money plus what each minted copy itself first sold for on the list. That's
// the copy's own sale on the record, not what its last holder gave for it after a theft, a gift or the fence. A later
// sale of the same trait reprices nothing, so an overbid can't raise anyone's haul. Reports show two shadows beside it:
// each copy at what its trait last sold for (the measure before 10-17), and at its trait's opening price."
// Three prices, one official:
// - `paid` (official since R4-1): that copy's own first sale on the list, as the record's `buy` event has it;
// - `mark` (a shadow): the trait's latest list price, which the mint card carries as its `value`;
// - `open` (a shadow): the trait's opening list price, from the season's drop.
export const VALUATIONS = ['paid', 'mark', 'open'];
export const SHADOWS = ['mark', 'open'];
export const VALUED = { paid: 'copy paid', mark: 'last-price mark (shadow)', open: 'opening price (shadow)' };
export const HAUL_TEXT = "Mainland money plus each minted copy at that copy's own first sale on the list (copy paid). Two shadows beside it: each copy at its trait's latest list price (the last-price mark, the measure before R4-1), and at its trait's opening price";

// Each copy's first sale on the list, from the record's `buy` events (§3): { copy: price }.
export function firstSales(log) {
  const out = {};
  for (const e of log) if (e.type === 'buy' && !Object.hasOwn(out, e.copy)) out[e.copy] = e.price;
  return out;
}
// Each trait's opening list price, from the season's drop on the record: { trait: price }.
export function openingPrices(log) {
  const season = log.find(e => e.type === 'season');
  return Object.fromEntries(((season && season.drop) || []).map(t => [t.trait, t.price]));
}
// A price the record must have: every real copy leaves the list only by a sale (rules/night.mjs, dawn), so a minted,
// held or stolen copy with no sale, or a trait with no opening price, stops the report rather than counting as $0.
export function known(x, what) {
  if (x == null) throw new Error(`haul: the record has no ${what}`);
  return x;
}

// Every agent's final haul under each valuation, from the mint events: { paid: { id: haul }, mark: {...}, open: {...} }.
export function haulsOf(log, ids) {
  const paid = firstSales(log);
  const open = openingPrices(log);
  const worth = {
    paid: c => known(paid[c.copy], `sale on the list for ${c.copy}, minted`),
    mark: c => c.mark ?? c.value ?? 0,
    open: c => known(open[c.trait], `opening price for ${c.trait}, minted`),
  };
  const out = Object.fromEntries(VALUATIONS.map(v => [v, Object.fromEntries(ids.map(id => [id, 0]))]));
  for (const e of log) {
    if (e.type !== 'mint') continue;
    for (const v of VALUATIONS) out[v][e.agent] = e.mainland + sum(e.cards.map(worth[v]));
  }
  return out;
}

// --- who plays what (reading 3) ---------------------------------------------------------------------------------------
// §27 names seats by what they play: the robbers, the hustlers, a buy-late bot, a turtle bot, and the trades'
// Cops, Gunrunners, Smugglers, Chemists and Dealers. Reading 3: the seats that play the role. A bot plays its own
// driver (its type); a model seat (the cast's `model`, R2-8) plays no bot's strategy, only its trade. In the casts where
// every seat has a trade, the seats of other strategies hold trade labels too (a turtle with the Cop trade); counting
// every label would measure those strategies, not the trade.
export const ROBBERS = ['scout', 'guess'];
// §27 names three trades against the hustler.
export const OUT_EARN = ['smuggler', 'chemist', 'dealer'];
const isBot = c => !c.model;
export const botSeats = (cast, types) => cast.filter(c => isBot(c) && [].concat(types).includes(c.type)).map(c => c.id);
export const playsTrade = (c, trade) => (c.model ? c.trade === trade : c.type === trade);
export const tradeSeats = (cast, trade) => cast.filter(c => playsTrade(c, trade)).map(c => c.id);
export const modelSeats = cast => cast.filter(c => c.model).map(c => c.id);

// --- the median (reading 2) -------------------------------------------------------------------------------------------
// "The median X" is one seat, as §27's median robber is since R4-1: the seats ranked by the bar's measure, lowest
// first, and the middle one, or with an even count the lower of the two middle ones. `tie` orders seats level on the
// measure as the bar's line favours; the id comes last, so the pick never rests on the order the seats came in.
export function medianSeat(ids, measure, tie = () => 0) {
  if (!ids.length) return null;
  const ranked = ids.slice().sort((x, y) => measure(x) - measure(y) || tie(x, y) || byId(x, y));
  return ranked[Math.floor((ranked.length - 1) / 2)];
}
// "The median haul", the line a seat finishes below or in the top half of, is the season's middle haul over every seat:
// a value, the middle one, or with an even count the mean of the two middle ones. The shadow readings and the reports'
// medians by kind of seat use it too.
export function median(list) {
  const a = list.filter(x => x != null && !Number.isNaN(x)).slice().sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// --- what a crime took (readings 4 and 5) -----------------------------------------------------------------------------
// Every take by crime: a hit (`rob`: cash, the piece and the goods it carried), a break-in (`burgle`: cash and a
// piece), a grab (`grab`: the crate's cash and goods) and a vault job (`vault`: its cash and pieces). A take that took
// nothing (a hit a vest stopped, a home with nothing in it) isn't one.
export const TAKE_KINDS = ['rob', 'burgle', 'grab', 'vault'];
const took = e => !!e.copy || (e.cash || 0) > 0 || (e.copies || []).length > 0 || Object.keys(e.goods || {}).length > 0;
export const takesOf = log => log.filter(e => TAKE_KINDS.includes(e.type) && took(e));
// A theft, as §27's show-worthy list names it apart from a grab and a vault job: a hit or a break-in that took something.
export const theftsOf = log => takesOf(log).filter(e => e.type === 'rob' || e.type === 'burgle');

// Reading 5: goods at a price no one agent can move, the city's opening prices in N. What the city's shop sells (chems,
// parts, guns) counts at the shop's opening price (N.shopPrice). A dose of any drug, which the shop doesn't sell,
// counts at a corner's opening street price (N.corner.price). N prices its own crates this way: night 5's 20 chems and
// night 11's 14 TEMP are each "about $500" (N.shipments). The shop's and the buyer's next prices move with every unit
// anyone trades, and a deal between agents is theirs to set, so neither stands in. Lockpicks and forged warrants, which
// no crime takes, count at the parts they're built from (N.build). Cash counts at what it is.
export function unitPrice(kind) {
  if (Object.hasOwn(N.shopPrice, kind)) return N.shopPrice[kind];
  if (DRUGS.includes(kind) || kind === 'doses') return N.corner.price;
  if (kind === 'lockpicks' || kind === 'warrants') return N.build[kind] * N.shopPrice.parts;
  throw new Error(`a take of ${kind}: N gives it no price`);
}
export const goodsWorth = goods => sum(Object.entries(goods || {}).map(([k, u]) => u * unitPrice(k)));
// A take's worth: its cash, each piece at its copy's own first sale on the list (as haul counts it; a fake, which never
// sold, at nothing), and its goods at the city's opening prices. The sale is the record's `buy` event, as for haul; the
// rules keep the same price on the copy itself (`sold`, rules/night.mjs, dawn), which stands in when the record given
// holds no `buy` for it. A hit's or a break-in's own `value` prices its piece at what its trait last sold for
// (rules/night.mjs:409), which one overbid moves, so it isn't read.
export function takeWorth(e, sales, copies = {}) {
  const pieces = e.type === 'vault' ? e.copies || [] : e.copy ? [e.copy] : [];
  const piece = k => (copies[k] && copies[k].fake ? 0 : known(sales[k] ?? (copies[k] ? copies[k].sold : null), `sale on the list for ${k}, stolen`));
  return (e.cash || 0) + sum(pieces.map(piece)) + goodsWorth(e.goods);
}

// --- distinct seasons (reading 8) -------------------------------------------------------------------------------------
// A season's record as events.jsonl holds it, a line an event.
export const recordText = log => log.map(e => `${JSON.stringify(e)}\n`).join('');
// Two seasons are one season when their events.jsonl match with the `"rule":"A"` / `"rule":"B"` label stripped: under
// rules A and B a seed often plays the same season.
export function seasonKeyOf(text) {
  return createHash('sha256').update(text.replace(/"rule":"[AB]"/g, '"rule":""')).digest('hex').slice(0, 16);
}
// A count of seasons: those `pass` picks out of `results`, also as distinct seasons, and the seeds they come from. A
// distinct season whose copies disagree (A and B played one record, but a bar that reads the runner's counterfactual
// differs) counts as passing, and `mixed` says how many did. `has` (optional) says whether a season carries the bar at
// all; without it in every season the count is null.
export function seasonCount(results, pass, has = () => true) {
  if (!results.length || !results.every(has)) return null;
  const yes = results.filter(pass);
  const keyed = results.every(r => r.seasonKey);
  const keys = rs => new Set(rs.map(r => r.seasonKey));
  const passing = keyed ? keys(yes) : null;
  const failing = keyed ? keys(results.filter(r => !pass(r))) : null;
  return {
    pass: yes.length, n: results.length,
    distinct: keyed ? passing.size : null, of: keyed ? keys(results).size : null,
    mixed: keyed ? [...passing].filter(k => failing.has(k)).length : null,
    seeds: [...new Set(yes.map(r => r.seed))].sort((x, y) => x - y),
  };
}

// --- one season's bars ------------------------------------------------------------------------------------------------
// The bars that read haul, each also scored under the shadow valuations.
export const HAUL_BARS = ['buyLate', 'turtle', 'crimePays', 'crimeMedians', 'leaderChanges', 'money', 'moneyEarn', 'copGunrunner'];

// A season's bars, from its final state, its record, the runner's bench data (each night's fights, hits, haul to date,
// what the night changed with places ignored, the ledger's checks and, with model seats, the seats' records) and its
// cast. -> { bars, shadow (the bars that read haul, under each shadow valuation), hauls (each valuation's) }.
export function seasonBars(state, log, bench, cast) {
  const ids = Object.keys(state.agents).sort();
  // Layer 2's street, the Cop and the Gunrunner come with layer 2's casts; the money bar's clauses get rows of their
  // own in the cast where every seat works a trade (L2-6); the drugs with the layer3 cast; the vault with the layer4.
  const layer2 = cast.some(c => c.layer === 2);
  const every = layer2 && cast.some(c => c.works);
  const nights = bench.nights || [];
  const hauls = haulsOf(log, ids);
  const sales = firstSales(log);
  const arrestsOf = id => log.filter(e => e.type === 'arrest' && e.agent === id).length;
  const robbers = botSeats(cast, ROBBERS);
  const shifts = botSeats(cast, 'hustle');
  // The money bar's parts that read no haul: each seat's income, the chems, the trades' median incomes and their spread.
  const parts = layer2 ? moneyParts(state, log, cast) : null;

  const byValuation = v => {
    const h = hauls[v];
    const all = median(ids.map(id => h[id]));
    const money = parts ? moneyBar(cast, h, shifts, parts) : null;
    return {
      buyLate: belowMedian(botSeats(cast, 'buylate'), h, all),
      turtle: belowMedian(botSeats(cast, 'turtle'), h, all),
      crimePays: crimePays(robbers, shifts, h, arrestsOf),
      crimeMedians: separateMedians(robbers, shifts, h, arrestsOf),
      leaderChanges: leaderChanges(nights.map(n => (v === 'paid' ? n.haul : (n.shadow && n.shadow[v]) || null))),
      ...(money ? { money: money.bar, ...(every ? { moneyEarn: money.earn } : {}) } : {}),
      ...(layer2 ? { copGunrunner: copGunrunner(cast, h, all) } : {}),
    };
  };
  const official = byValuation('paid');
  const shadow = Object.fromEntries(SHADOWS.map(v => [v, byValuation(v)]));
  const models = modelSeats(cast);

  const bars = {
    ledger: ledger(bench),
    buyLate: official.buyLate,
    turtle: official.turtle,
    crimePays: official.crimePays,
    crimeMedians: official.crimeMedians,
    middle: middle(log, sales, state.copies),
    leaderChanges: official.leaderChanges,
    betrayals: betrayals(log),
    showWorthy: showWorthy(log, nights),
    mintedMoved: mintedMoved(state),
    places: places(nights),
    dropSells: dropSells(state),
    ...(official.money ? { money: official.money } : {}),
    ...(every ? { moneyEarn: official.moneyEarn, moneyChems: parts.chems, moneyGap: parts.gap, moneyShare: parts.share } : {}),
    ...(official.copGunrunner ? { copGunrunner: official.copGunrunner } : {}),
    ...(cast.some(c => c.drugs) ? { drugs: drugsBar(log) } : {}),
    ...(cast.some(c => c.score) ? { vault: vaultBar(nights) } : {}),
    backing: backing(nights),
    ...(models.length ? { ceiling: ceiling(models, bench.models) } : {}),
    invalid: invalidByType(log, cast),
    ...(models.length ? { invalidByModel: invalidByModel(log, models) } : {}),
  };
  return { bars, shadow, hauls };
}

// §27: "The ledger never loses or doubles a copy, and the same seed gives the same log."
// The runner checks the ledger and the cash after every errand and every night (§23), and a failure stops the season,
// so a season that finishes has none failed. The same log from the same seed is determinism.test.mjs's. A season the
// runner didn't play (a hand-built one) has no checks, and no reading.
function ledger(bench) {
  const l = bench.ledger;
  if (!l) return { errands: null, nights: null, failed: null, pass: null };
  return { errands: l.errands, nights: l.nights, failed: l.failed, pass: l.failed === 0 };
}

// §27: "A buy-late bot (saves everything, buys only on the list's last two nights) and a turtle bot (lays low every
// night after its first rare) each finish below the median haul in at least 90% of seasons."
// Reading 1: every buy-late bot, and every turtle, finishes below the median haul; not the median or the mean of their
// hauls. So the highest of them decides (`value`). "The median haul" is the season's, over every seat (`median`).
// "Below" is strictly below. With no such bot the bar has no reading.
function belowMedian(seats, h, all) {
  if (!seats.length) return { value: null, median: all, pass: null };
  const value = Math.max(...seats.map(id => h[id]));
  return { value, median: all, pass: value < all };
}

// §27: "The median cop and the median Gunrunner finish in the top half in at least 30% of seasons."
// The Cops and the Gunrunners are the seats that play those trades (reading 3). The median one of each is one seat, by
// haul (reading 2); the line favours neither of two seats level on haul, which are in the same half, so the id decides
// only which is named. A seat finishes in the top half when its haul is above the season's median haul, over every
// seat; one on it is in neither half.
function copGunrunner(cast, h, all) {
  const of = trade => {
    const seat = medianSeat(tradeSeats(cast, trade), id => h[id]);
    return seat ? h[seat] : null;
  };
  const cop = of('cop');
  const gunrunner = of('gunrunner');
  return { cop, gunrunner, median: all, pass: cop != null && gunrunner != null && cop > all && gunrunner > all };
}

// §27: "Crime pays, with risk: the median robber out-earns the median hustler, and gets arrested at least once.
// The median robber is one robber: rank the robbers by haul, lowest first, a tie going to the one arrested fewer times.
// It's the middle one, or with an even count the lower of the two middle ones. Its haul beats the median
// hustler's, and it was itself arrested at least once that season."
// The robbers are the robber bots, the scouts and the guessers (reading 3). The median hustler is one seat too, by
// haul (reading 2): hustlers level on haul have the same haul, so the line favours neither and the id decides only
// which is named.
function crimePays(robbers, shifts, h, arrestsOf) {
  const robber = medianSeat(robbers, id => h[id], (x, y) => arrestsOf(x) - arrestsOf(y));
  const hustle = medianSeat(shifts, id => h[id]);
  const robberHaul = robber ? h[robber] : null;
  const hustleHaul = hustle ? h[hustle] : null;
  const robberArrests = robber ? arrestsOf(robber) : null;
  return { robber, robberHaul, hustle, hustleHaul, robberArrests, pass: robber != null && hustleHaul != null && robberHaul > hustleHaul && robberArrests >= 1 };
}
// §27: "Reports also show the earlier reading, the robbers' median haul and the median of their arrests, as a shadow."
// The bench's reading before R4-1, in full: the median of the robbers' hauls against the median of the hustlers',
// and the median of the robbers' arrests at least 1.
function separateMedians(robbers, shifts, h, arrestsOf) {
  const robberHaul = median(robbers.map(id => h[id]));
  const hustleHaul = median(shifts.map(id => h[id]));
  const robberArrests = median(robbers.map(arrestsOf));
  return { robberHaul, hustleHaul, robberArrests, pass: robberHaul > hustleHaul && robberArrests >= 1 };
}

// §27: "The middle matters: the last night moves less than a third of all the value stolen in a season."
// Reading 4: all the value stolen is every take by crime: hits (cash, pieces and goods), break-ins, grabs and vault
// jobs. Reading 5: each at its worth by takeWorth: a stolen piece at its copy's own first sale on the list, goods at the
// city's opening prices. "Less than a third" is strictly less.
function middle(log, sales, copies) {
  const takes = takesOf(log);
  const worth = e => takeWorth(e, sales, copies);
  const stolen = sum(takes.map(worth));
  const lastNight = sum(takes.filter(e => e.night === N.nights).map(worth));
  const lastShare = share(lastNight, stolen);
  return { stolen, lastNight, share: lastShare, pass: lastShare != null && lastShare < 1 / 3 };
}

// §27: "#1 by haul changes hands at least 3 times a season."
// #1 by haul to date, night by night, must be strictly ahead: a night with a tie at the top has no #1, so a tie broken
// by agent id never counts as a change. `nights` holds each night's haul to date; a night without it (a run from before
// R4-1, for a shadow) leaves the bar unread.
function leaderChanges(nights) {
  if (nights.some(h => !h)) return { changes: null, leaders: null, pass: null };
  let changes = 0;
  let prev = null;
  const leaders = [];
  for (const h of nights) {
    const sorted = Object.entries(h).sort((x, y) => y[1] - x[1]);
    const top = sorted.length && (sorted.length === 1 || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null;
    leaders.push(top);
    if (!top) continue;
    if (prev && top !== prev) changes++;
    prev = top;
  }
  return { changes, leaders, pass: changes >= 3 };
}

// §27: "At least 3 betrayals a season (walk, rug, turn, rat, double-sell)."
// One betrayal per act: the same kind, by the same agent, on the same night (or day, for a rug). The rules record a turn
// that broke two promises once per promise.
export function betrayalActs(log) {
  const acts = new Map();
  for (const e of log) {
    if (e.type !== 'betray') continue;
    const key = `${e.kind}|${e.by}|${e.night ?? `d${e.day}`}`;
    if (!acts.has(key)) acts.set(key, e);
  }
  return [...acts.values()];
}
function betrayals(log) {
  const acts = betrayalActs(log);
  const byKind = {};
  for (const b of acts) byKind[b.kind] = (byKind[b.kind] || 0) + 1;
  return { total: acts.length, byKind, pass: acts.length >= 3 };
}

// §27: "Every night has at least one show-worthy event: a theft, an arrest, a corner fight, a turn, a grab or a vault
// job."
// A theft is a hit or a break-in that took something; a grab and a vault job are their fights (a grab at the docks, the
// vault in Glasswall), won or not; a turn is one betrayal act.
function showWorthy(log, nights) {
  const thefts = theftsOf(log);
  const acts = betrayalActs(log);
  const nightsWith = kind => new Set(nights.filter(n => n.fights.some(f => f.kind === kind)).map(n => n.night));
  const corner = nightsWith('corner');
  const grab = nightsWith('grab');
  const vault = nightsWith('vault');
  const worthy = [];
  for (let n = 1; n <= N.nights; n++) {
    const theft = thefts.some(e => e.night === n);
    const arrest = log.some(e => e.type === 'arrest' && e.night === n);
    const turn = acts.some(e => e.kind === 'turn' && e.night === n);
    if (theft || arrest || turn || corner.has(n) || grab.has(n) || vault.has(n)) worthy.push(n);
  }
  return { nights: worthy.length, of: N.nights, missing: Array.from({ length: N.nights }, (_, i) => i + 1).filter(n => !worthy.includes(n)), pass: worthy.length === N.nights };
}

// §27: "At least a third of the traits that mint were taken or traded at least once."
// A minted copy that passed through two agents' hands or more; in and out of a crew stash by one agent is neither. A
// fake never mints (§15).
function mintedMoved(state) {
  const minted = Object.values(state.copies).filter(c => c.holder.k === 'minted');
  const moved = minted.filter(c => new Set(c.hist.map(h => h.to).filter(t => t.startsWith('agent:'))).size >= 2);
  const mintedShare = share(moved.length, minted.length);
  return { minted: minted.length, moved: moved.length, share: mintedShare, pass: mintedShare != null && mintedShare >= 1 / 3 };
}

// §27: "Places matter: rerun each night with places ignored. At least 1 night's result in 5 changes. Hits backed by
// public or scouted sightings land more often than blind ones."
// The runner settles every night twice, the second time with places ignored, and keeps whether its fights changed; and
// it keeps each hit with whether a public sighting put its target where it went and whether it found it.
function places(nights) {
  const hits = nights.flatMap(n => n.hits);
  const sighted = hits.filter(h => h.sighted);
  const blind = hits.filter(h => !h.sighted);
  const landRate = list => share(list.filter(h => h.found).length, list.length);
  const changed = nights.filter(n => n.placesChanged).length;
  const sightedRate = landRate(sighted);
  const blindRate = landRate(blind);
  return {
    nightsChanged: changed, of: nights.length, sightedRate, blindRate, sightedHits: sighted.length, blindHits: blind.length,
    pass: share(changed, nights.length) >= 1 / 5 && sightedRate != null && blindRate != null && sightedRate > blindRate,
  };
}

// §27: "Most of the drop sells: at least three in four copies sell before the list closes."
// The drop's copies: a fake (layer 4) is none of them.
function dropSells(state) {
  const copies = Object.values(state.copies).filter(c => !c.fake);
  const sold = copies.filter(c => c.sold != null).length;
  return { sold, total: copies.length, share: share(sold, copies.length), pass: share(sold, copies.length) >= 3 / 4 };
}

// §27: "The money works: the median Smuggler, Chemist and Dealer each out-earn the median hustler. Most chems that
// get cooked come from Smugglers, not the city's shop. No trade's median income is more than twice another's."
// One bar, computed once; in the cast where every seat works a trade its clauses also get rows of their own, which are
// the same objects. The trades' seats are the seats that play them (reading 3) and each trade's median seat is one seat
// (reading 2).
// Income is what work brought in (hustles, flex, the street, the city's buyer, goods sold to agents, a Cop's patrols,
// guards and collars) less what the work's goods cost (bought from agents or the city's shop). A gun a seat buys is
// gear, as a piece off the list is, so it doesn't count against its trade; and thefts and grabs aren't work.
function incomes(log, cast) {
  const tradeOf = Object.fromEntries(cast.map(c => [c.id, c.trade]));
  const income = Object.fromEntries(cast.map(c => [c.id, 0]));
  const add = (id, x) => {
    if (income[id] != null && Number.isFinite(x)) income[id] += x;
  };
  for (const e of log) {
    if (e.type === 'hustle') add(e.agent, e.take);
    else if (e.type === 'flex') add(e.agent, e.pay);
    else if (e.type === 'sale' || e.type === 'sell') add(e.agent, e.cash);
    else if (e.type === 'patrol' || e.type === 'guard') add(e.agent, e.wage);
    else if (e.type === 'collar') add(e.agent, e.pay);
    else if (e.type === 'shop' && e.item !== 'guns') add(e.agent, -e.cash);
    else if (e.type === 'pay' && e.for === 'debt') {
      add(e.to, e.amount);
      // What a seat with the Gunrunner trade sells is gear, so paying one is buying gear.
      if (tradeOf[e.to] !== 'gunrunner') add(e.from, -e.amount);
    }
  }
  return income;
}

// The money bar's parts that read no haul: each seat's income; the chems (the second clause); each trade's median
// income and the spread (the third); and the street's share of the island's cash, reported beside them with no bar.
function moneyParts(state, log, cast) {
  const income = incomes(log, cast);
  // Clause 3: "No trade's median income is more than twice another's." All five trades of §9, the Cop's included, each
  // its median seat by income (seats level on income have the same income, so the id decides only which is named). A
  // trade with no seat in the cast has no income to compare; with fewer than two trades there's no spread to pass.
  const trades = TRADES.map(t => {
    const ids = tradeSeats(cast, t);
    const seat = medianSeat(ids, id => income[id]);
    return { trade: t, seats: ids.length, seat, income: seat ? income[seat] : null };
  });
  const rated = trades.filter(t => t.seats && t.income != null);
  const hi = rated.reduce((a, t) => (!a || t.income > a.income ? t : a), null);
  const lo = rated.reduce((a, t) => (!a || t.income < a.income ? t : a), null);
  const spreads = rated.length > 1 && lo.income > 0 && hi.income <= 2 * lo.income;
  const island = (state.money && state.money.in) || {};
  const total = sum(Object.values(island));
  return {
    income, trades,
    spread: { lo: lo ? lo.income : null, hi: hi ? hi.income : null, pass: spreads },
    gap: rated.length > 1
      ? { hi: { trade: hi.trade, income: hi.income }, lo: { trade: lo.trade, income: lo.income }, ratio: lo.income > 0 ? hi.income / lo.income : null, pass: spreads }
      : { hi: null, lo: null, ratio: null, pass: false },
    chems: chems(state, log, cast),
    share: { street: island.street || 0, total, share: share(island.street || 0, total) },
  };
}

// Clause 2: "Most chems that get cooked come from Smugglers, not the city's shop." Reading 7: more than half of the
// chems the Chemists cooked came from Smugglers, the city's shop and the kits counted in the total. Chems are all alike
// once in a Chemist's hands, so a cooked chem comes from where the Chemists' chems came from, in proportion: from
// Smugglers (`smugglers`), from other seats (`others`, a seat with the Smuggler trade that is no Smuggler among them),
// from the city's shop, taken in a theft, and the Chemists' own kits. Chems between two Chemists stay among them.
// The record keeps the kits only island-wide (the books' `kit`), and every seat gets its trade's kit (N.kits, §9), so
// the Chemists' own are the books' total times their share of the kits' chems N deals.
function chems(state, log, cast) {
  const chemists = new Set(tradeSeats(cast, 'chemist'));
  const smugglers = new Set(tradeSeats(cast, 'smuggler'));
  const into = log.filter(e => e.type === 'give' && e.goods && e.goods.chems && chemists.has(e.to) && !chemists.has(e.from));
  const kitChems = c => ((N.kits[c.trade] || {}).chems || 0);
  const dealt = sum(cast.map(kitChems));
  const booked = (((state.goods || {}).in || {}).kit || {}).chems || 0;
  const out = {
    cooked: sum(log.filter(e => e.type === 'cook' && chemists.has(e.agent)).map(e => e.chems || 0)),
    smugglers: sum(into.filter(e => smugglers.has(e.from)).map(e => e.goods.chems)),
    shop: sum(log.filter(e => e.type === 'shop' && e.item === 'chems' && chemists.has(e.agent)).map(e => e.units || 0)),
    others: sum(into.filter(e => !smugglers.has(e.from)).map(e => e.goods.chems)),
    kits: dealt ? (booked * sum(cast.filter(c => chemists.has(c.id)).map(kitChems))) / dealt : 0,
    taken: sum(log.filter(e => (e.type === 'rob' || e.type === 'grab') && chemists.has(e.leader) && e.goods).map(e => e.goods.chems || 0)),
  };
  out.total = out.smugglers + out.others + out.shop + out.taken + out.kits;
  out.share = share(out.smugglers, out.total);
  out.pass = out.share != null && out.share > 1 / 2;
  return out;
}

// The bar under one valuation of haul. Clause 1: "the median Smuggler, Chemist and Dealer each out-earn the median
// hustler". Reading 6: out-earn is haul, as in the crime bar; the same by income is a shadow (`byIncome`). Each is
// one seat (reading 2): the trade's median seat by haul against the median hustler by haul; seats level on haul
// have the same haul, so the id decides only which is named. "Out-earn" is strictly more.
function moneyBar(cast, h, shifts, parts) {
  const { income } = parts;
  const hustle = medianSeat(shifts, id => h[id]);
  const hustleHaul = hustle ? h[hustle] : null;
  const outEarn = OUT_EARN.map(t => {
    const seat = medianSeat(tradeSeats(cast, t), id => h[id]);
    const haul = seat ? h[seat] : null;
    return { type: t, seat, haul, pass: haul != null && hustleHaul != null && haul > hustleHaul };
  });
  const hustleBy = medianSeat(shifts, id => income[id]);
  const hustleIncome = hustleBy ? income[hustleBy] : null;
  const byIncomeRows = OUT_EARN.map(t => {
    const x = parts.trades.find(r => r.trade === t);
    return { type: t, seat: x.seat, income: x.income, pass: x.income != null && hustleIncome != null && x.income > hustleIncome };
  });
  const earns = outEarn.every(o => o.pass);
  const bar = {
    hustle, hustleHaul, outEarn,
    byIncome: { hustle: hustleBy, hustleIncome, outEarn: byIncomeRows, pass: byIncomeRows.every(o => o.pass) },
    chems: parts.chems, trades: parts.trades, spread: parts.spread,
    pass: earns && parts.chems.pass && parts.spread.pass,
  };
  // Clause 1's own row: each trade's seats, its median income (clause 3's), and for the three §27 names, its median
  // seat's haul and whether it out-earns the median hustler's.
  const earn = {
    hustle: hustleHaul,
    trades: parts.trades.map(t => {
      const o = outEarn.find(x => x.type === t.trade);
      return { trade: t.trade, seats: t.seats, income: t.income, ...(o ? { seat: o.seat, haul: o.haul, pass: o.pass } : {}) };
    }),
    byIncome: bar.byIncome,
    pass: earns,
  };
  return { bar, earn };
}

// §27: "From layer 3: every drug gets taken at least once a season, and someone gets hooked."
// By the record, which keeps every drug's name: a SUDO dose taken as TEMP is SUDO taken, as its reveal shows it.
export function drugsBar(log) {
  const takes = log.filter(e => e.type === 'take');
  const taken = Object.fromEntries(DRUGS.map(d => [d, takes.filter(e => e.drug === d).length]));
  const missing = DRUGS.filter(d => !taken[d]);
  const hooked = new Set(log.filter(e => e.type === 'hooked').map(e => e.agent)).size;
  return { taken, missing, hooked, pass: !missing.length && hooked > 0 };
}

// §27: "From layer 4: someone jobs the vault in at least half of seasons."
// A job is a group that reached the vault's fight, won or lost; a warrant bought or a vault play refused is none.
function vaultBar(nights) {
  const jobs = sum(nights.flatMap(n => n.fights).filter(f => f.kind === 'vault').map(f => f.attackers.length));
  return { jobs, pass: jobs > 0 };
}

// §27: "The backing rules: run A and B on the same seeds and report how often a target cut a backer of the attack on
// itself, and how often backing decided a fight."
// Reported, no bar. §8: under A "a backer that's attacked tonight never arrives"; under B "an attack from the agent its
// group is attacking ... doesn't cut it". The rules list each target's hit on a backer of the attack on it under both
// rules (the night's `cutByTarget`, rules/fights.mjs); it cut that backer only when the backer is missing from its
// leader's group in that fight, as the night's record shows. `targetHitBacker` counts the fights where it did.
function backing(nights) {
  const fights = nights.flatMap(n => n.fights);
  const cut = (n, f) => (n.cutByTarget || []).some(c => c.target === f.target && f.attackers.some(g => g.leader === c.leader && !g.members.includes(c.backer)));
  return {
    fights: fights.length, decided: fights.filter(f => f.backingDecided).length,
    targetHitBacker: sum(nights.map(n => n.fights.filter(f => cut(n, f)).length)),
    backed: fights.filter(f => f.attackers.some(g => g.members.length > 1)).length,
  };
}

// §27: "Runner calls stay inside the ceiling (§18)." §18: "The runner's ceiling is 14 calls per agent per day ... Past
// the ceiling, standing orders answer." Every request counts, the retry too (the orchestrator's Q1, R2-agents.md).
// Read from each model seat's own record (agents/seat.mjs: an entry a call point, each with its requests), which the
// runner hands the report: the requests per seat a day, the most and the mean, and the seat-days over the ceiling.
// Without the records there's no reading.
function ceiling(seats, models) {
  const records = models && models.seats;
  if (!records) return { seatDays: 0, most: null, mean: null, over: null, ceiling: N.callCeiling, pass: null };
  const perDay = {};
  for (const id of seats) {
    for (const entry of (records[id] && records[id].record) || []) {
      const k = `${id}|${entry.day}`;
      perDay[k] = (perDay[k] || 0) + entry.attempts.filter(a => a.call !== null).length;
    }
  }
  const counts = Object.values(perDay);
  const most = counts.length ? Math.max(...counts) : 0;
  return { seatDays: counts.length, most, mean: mean(counts), over: counts.filter(x => x > N.callCeiling).length, ceiling: N.callCeiling, pass: most <= N.callCeiling };
}

// §27: "Invalid plays are typed, logged and replaced by the default play, and the report gives the rate per model.
// There's no bar: it's a hygiene number, and choices are never hidden to lower it (§33)."
// A play the rules typed as invalid and replaced (an `invalid` event with `instead`), against the plays made; a forced
// play and a refused errand aren't invalid plays. The bots' rate by bot type, the model seats left out; each model's by
// the driver the season's record names for its seats, with its refused errands beside it.
function invalidByType(log, cast) {
  const typeOf = Object.fromEntries(cast.filter(isBot).map(c => [c.id, c.type]));
  const plays = {};
  const invalid = {};
  for (const e of log) {
    const t = typeOf[e.agent];
    if (!t) continue;
    if (e.type === 'play') plays[t] = (plays[t] || 0) + 1;
    if (e.type === 'invalid' && 'instead' in e) invalid[t] = (invalid[t] || 0) + 1;
  }
  return Object.fromEntries(BOT_TYPES.map(t => [t, { plays: plays[t] || 0, invalid: invalid[t] || 0, rate: share(invalid[t] || 0, plays[t] || 0) }]));
}
function invalidByModel(log, seats) {
  const season = log.find(e => e.type === 'season');
  const driver = Object.fromEntries(((season && season.agents) || []).map(a => [a.id, a.driver]));
  const modelOf = Object.fromEntries(seats.map(id => [id, driver[id] || 'model']));
  const out = {};
  const row = m => (out[m] ||= { seats: 0, plays: 0, invalid: 0, rate: null, errands: 0 });
  for (const id of seats) row(modelOf[id]).seats += 1;
  for (const e of log) {
    const m = modelOf[e.agent];
    if (!m) continue;
    if (e.type === 'play') row(m).plays += 1;
    if (e.type === 'invalid' && 'instead' in e) row(m).invalid += 1;
    if (e.type === 'invalid' && 'errand' in e) row(m).errands += 1;
  }
  for (const r of Object.values(out)) r.rate = share(r.invalid, r.plays);
  return out;
}

// --- across seasons ---------------------------------------------------------------------------------------------------
// One cell of a bar's row: of the seasons that read the bar (a season with no reading, such as a buy-late bar with no
// buy-late bot, isn't counted), those passing, also as distinct seasons. Reading 8: a bar's share of seasons is its
// share of distinct seasons (`rate`), and where §27 gives the bar a share (`need`), `meets` says whether it reaches it.
function cellOf(rs, pick, need) {
  const read = rs.filter(r => {
    const x = pick(r);
    return !!x && x.pass !== null && x.pass !== undefined;
  });
  const count = seasonCount(read, r => !!pick(r).pass);
  const rate = !count ? null : count.distinct != null ? share(count.distinct, count.of) : share(count.pass, count.n);
  return { pass: count ? count.pass : 0, n: read.length, total: rs.length, missing: rs.length - read.length, rate, count, ...(need != null ? { meets: rate != null && rate >= need } : {}) };
}

// The seasons grouped as the summary shows them: each rule, then all.
export function groupsOf(results) {
  const rules = [...new Set(results.map(r => r.rule))].sort();
  return [...rules.map(g => [g, results.filter(r => r.rule === g)]), ['all', results]];
}

// Every bar across a set of seasons: a row a bar the seasons carry, in BARS' order, each with a cell a group (each rule,
// then all) and its verdict across all of them: whether its distinct seasons reach §27's share, for a bar §27 gives
// one; the model's mean against the bots', for the model bar; null for every other bar, whose count of seasons is all
// §27's words give. `twins` are bot seasons the model bar may pair with that the other bars don't count. Also the bars
// that read haul under each shadow valuation, all seasons together.
export function acrossSeasons(results, { twins = [] } = {}) {
  // Seasons played under two briefing arms are two treatments (runner.mjs, --briefing): no count pools them. Nor do
  // two reply modes or two Creed setups (evidence.mjs treatmentOf).
  const arms = [...new Set(results.map(treatmentOf))].sort();
  if (arms.length > 1) throw new Error(`these seasons were played under different briefings (${arms.join(', ')}): score each arm on its own`);
  const groups = groupsOf(results);
  const rows = [];
  for (const b of BARS) {
    if (!b.row) continue;
    if (b.key === 'models') {
      if (results.some(r => (r.modelSeats || []).length)) rows.push(modelsRow(b, groups, twins));
      continue;
    }
    if (!results.some(r => r.bars && r.bars[b.key])) continue;
    const cells = groups.map(([, rs]) => cellOf(rs, r => r.bars[b.key], b.need));
    rows.push({ key: b.key, label: b.label, need: b.need, cells, verdict: b.need == null ? null : cells[cells.length - 1].meets });
  }
  // A season from before R4-1 carries no shadows, so their counts are n/a.
  const pick = (r, v, key) => (v === 'paid' ? r.bars[key] : r.shadow && r.shadow[v] ? r.shadow[v][key] : null);
  const shadow = rows.filter(r => HAUL_BARS.includes(r.key)).map(({ key, label }) => ({
    key, label,
    cells: Object.fromEntries(VALUATIONS.map(v => [v, seasonCount(results, r => !!pick(r, v, key).pass, r => !!pick(r, v, key) && pick(r, v, key).pass !== null)])),
  }));
  return { groups: groups.map(([g]) => g), rows, shadow };
}

// §27: "Local-model agents beat the scripted bots on average (slime, 10-16, §41).
//   - **Seats:** the model plays seats of the trade bots and §25's strategies. It never plays a crew member or one of
//     the 3 hustlers.
//   - **The comparison:** each seed plays twice, once with the bot in the seat and once with the model. The model wins
//     the bar when its mean haul across the paired seats beats the bots'.
//   - **How many:** 10 paired seasons first. If the gap is within the season-to-season noise, run 40."
// Each season with model seats pairs with the season on its seed and rule that has none, the same seats holding the same
// bots (the bench plays it first: bench.mjs, --cast models). The model seats' hauls against those seats' hauls in the
// bot season. A pair whose two seasons were both played again (rules A and B playing the same seasons) counts once.
export function pairSeasons(results, twins = []) {
  const pool = [...results, ...twins];
  const out = [];
  for (const m of results) {
    const seats = m.modelSeats || [];
    if (!seats.length) continue;
    const candidates = pool.filter(b => b.seed === m.seed && b.rule === m.rule && !(b.modelSeats || []).length);
    const bot = candidates.find(b => twinValidation(m,b).status === 'verified') || candidates.find(b => twinValidation(m,b).status === 'legacy/unknown');
    const validation = twinValidation(m,bot || candidates[0]);
    out.push({
      seed: m.seed, rule: m.rule, validation, seasonKey: bot ? `${m.seasonKey}|${bot.seasonKey}` : null,
      model: seats.map(id => m.haul[id]), bots: bot ? seats.map(id => bot.haul[id]) : null,
    });
  }
  return out;
}
// One cell of the model bar: the pairs won (the model's mean haul in its seats above the bots' in the same seats), the
// mean haul a paired seat of the model and of the bots over the distinct pairs, the gap and its standard error across
// those seasons, and §27's "how many": the gap is within the noise when it's no more than twice its standard error,
// and the count is settled at 40 distinct pairs, or at 10 with the gap outside the noise.
function modelsCell(pairs) {
  const paired = pairs.filter(p => p.bots);
  const won = p => mean(p.model) > mean(p.bots);
  const count = seasonCount(paired, won);
  const distinct = [...new Map(paired.map(p => [p.seasonKey, p])).values()];
  const model = mean(distinct.flatMap(p => p.model));
  const bots = mean(distinct.flatMap(p => p.bots));
  const gaps = distinct.map(p => mean(p.model) - mean(p.bots));
  const g = mean(gaps);
  const se = gaps.length > 1 ? Math.sqrt(sum(gaps.map(x => (x - g) ** 2)) / (gaps.length - 1)) / Math.sqrt(gaps.length) : null;
  const gap = model != null && bots != null ? model - bots : null;
  const noise = gap != null && se != null ? Math.abs(gap) <= 2 * se : null;
  return {
    pass: count ? count.pass : 0, n: paired.length, unpaired: pairs.length - paired.length,
    provenance: Object.fromEntries(['verified', 'legacy/unknown', 'invalid', 'missing'].map(s => [s,pairs.filter(p=>p.validation.status===s).length])),
    pairingEvidence: pairs.map(({seed,rule,validation})=>({seed,rule,...validation})),
    rate: count ? share(count.distinct, count.of) : null, count,
    model, bots, gap, se, noise, settled: distinct.length >= 40 || (distinct.length >= 10 && noise === false),
    verdict: model != null && bots != null ? model > bots : null,
  };
}
function modelsRow(b, groups, twins) {
  const cells = groups.map(([, rs]) => modelsCell(pairSeasons(rs, twins)));
  return { key: b.key, label: b.label, need: null, cells, verdict: cells[cells.length - 1].verdict, status: modelStatus(cells.at(-1)) };
}
