import { summarizeActionCounters, modelStatus } from './evidence.mjs';
// The match report (GAME.md §25): one page a season for slime, and a summary across seasons. This module only formats
// (R4-11): §27's bars, their readings and their verdicts are passbars.mjs's, and every other number is metrics.mjs's.
// Both are re-exported here for the modules and tests that read them through the report.
// Tiers are MOCK (§4), and the bars are §27's proposals, measured for the layers built so far: layer 1, and with layer
// 2's cast (a bot for each trade) the street's money too; with the cast where every seat trades (L2-6), the money bar
// part by part, by trade; with the layer3 cast, the drugs and §27's drug bar (L3-5a), and the tricks (L3-5b); with the
// layer4 cast, the big score and §27's vault bar (L4-4); and with model seats (R2-8), the model bars (R4-11).
import { BARS, VALUATIONS, SHADOWS, VALUED, HAUL_TEXT, TRADES, BOT_TYPES, DRUGS } from './passbars.mjs';
import { MONEY_COLUMNS, moneyOf } from './metrics.mjs';

export { seasonMetrics, summarize } from './metrics.mjs';
export {
  median, firstSales, openingPrices, known, haulsOf, recordText, seasonKeyOf, seasonCount, VALUATIONS, SHADOWS, VALUED,
  HAUL_TEXT, HAUL_BARS,
} from './passbars.mjs';

const sumOf = list => list.reduce((t, x) => t + x, 0);
const ratio = (part, whole) => (whole ? part / whole : null);
const pct = x => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
const money = x => (x == null ? 'n/a' : `$${Math.round(x).toLocaleString('en-US')}`);
const label = key => BARS.find(b => b.key === key).label;

// " · 5/30 distinct", and when every pass comes from one seed, which seed.
export function distinctText(c) {
  const d = c.distinct == null ? '' : ` · ${c.distinct}/${c.of} distinct${c.mixed ? ` (${c.mixed} passing under one rule only)` : ''}`;
  return `${d}${c.pass && c.seeds.length === 1 ? `, one seed (${c.seeds[0]})` : ''}`;
}
// "7/40 · 5/30 distinct".
export const countText = c => (c ? `${c.pass}/${c.n}${distinctText(c)}` : 'n/a');

// Descriptive mechanism evidence is separate from the unchanged pass bars.
export function mechanismLines(m) {
  const c = m.actionCounters;
  const ids = m.modelSeats || [];
  if (!ids.length) return [];
  const out = ['**Controller mechanism evidence** (selected seats; descriptive):', ''];
  if (c) out.push(...refusalLines(c));
  out.push('| seat | Mainland cash | real mints | unique traits | outfit slots | rarity | own list / other original buyer / unknown | last acquisition route | original copy basis |', '|---|---|---|---|---|---|---|---|---|');
  for (const id of ids) {
    const a = m.acquisition?.[id];
    if (a) out.push(`| ${id} | ${money(a.cash)} | ${a.minted} | ${a.uniqueTraits} | ${a.slots} | ${Object.entries(a.rarity).map(([k,n])=>`${k} ${n}`).join(', ') || 'none'} | ${a.ownList} / ${a.otherOrigin} / ${a.unknownOrigin} | ${Object.entries(a.routes || {}).map(([k,n])=>`${k} ${n}`).join(', ') || 'unknown'} | ${money(a.bookValue)} |`);
  }
  out.push('', 'Original-buyer provenance describes final retained copies; another original buyer does not by itself prove theft. Outfit coverage counts represented slots, not preferences or utility.', '');
  return out;
}

// R7, a mixed season: a row a model group (metrics.mjs modelRows). `rows` may be one season's or, summed, several
// seasons' (summarize's byModel).
export function modelLines(rows, { seasons = 1, replies = null } = {}) {
  const num = x => (x == null ? 'n/a' : Math.round(x).toLocaleString('en-US'));
  const usd = x => (x == null ? 'n/a' : `$${x.toFixed(4)}`);
  const name = r => `${r.model}${r.thinking ? ', thinking' : ''}${r.provider ? `, provider ${JSON.stringify(r.provider)}` : ''}`;
  const out = [`**By model** (R7, a mixed season${seasons > 1 ? `; ${seasons} seasons summed, haul and cash a seat's mean` : ''}): haul and cash are a seat's mean; crimes are those its seats led, tried / won; deals are promises / hand-overs in a sit-down / betrayals (deals agreed and settled aren't measured: the core types no event for them); lookups the tools ran, and inspects sent / used; refused actions by typed source; requests' size is their messages' characters.${rows.some(r => r.dawn) ? " Dawn journal calls (\"· dawn\") act on nothing and are counted apart from call points, requests and their size; tokens and spend are every request's." : ''}`, ''];
  // R8b: each row's reply mode (JSON text or tools), a treatment of its own; n/a where the caller doesn't know it.
  out.push('| model | reply | seats | haul | cash | pieces | crimes | deals | lookups · inspects | refused: tools / core | call points / requests | request chars mean / max | tokens in / out | spend |', '|---|---|---|---:|---:|---:|---|---|---|---|---|---|---|---|');
  for (const [i, r] of rows.entries()) {
    const reply = replies ? replies[i] : 'n/a';
    const crimes = `${r.crimes.tried} / ${r.crimes.won}${Object.keys(r.crimes.byKind).length ? ` (${Object.entries(r.crimes.byKind).map(([k, x]) => `${k} ${x.tried}/${x.won}`).join(', ')})` : ''}`;
    const seats = Array.isArray(r.seats) ? r.seats.map((id, i) => `${id} ${r.types[i]}`).join(', ') : `${r.seats}`;
    const used = r.calls ? `${r.lookups} · ${r.inspectsSent} / ${r.inspects}` : 'n/a';
    // R9b: the dawn journal's calls, apart from the acting calls, when there are any.
    const calls = r.calls ? `${r.calls.callPoints} / ${r.calls.requests}${r.dawn ? ` · dawn ${r.dawn.requests}` : ''}` : 'n/a';
    const chars = r.chars ? `${num(r.chars.mean)} / ${num(r.chars.max)}${r.dawn ? ` · dawn ${num(r.dawn.chars.mean)} / ${num(r.dawn.chars.max)}` : ''}` : 'n/a';
    const tokens = r.tokens ? `${num(r.tokens.in)} / ${num(r.tokens.out)}` : 'n/a';
    const spend = r.spend ? `${usd(r.spend.cost)} (${r.spend.costed} of ${r.spend.sent} requests sent costed; reasoning ${num(r.spend.tokens.reasoning)} tokens)` : 'no spend record';
    out.push(`| ${name(r)} | ${reply} | ${seats} | ${money(r.haul.mean)} | ${money(r.cash.mean)} | ${r.pieces} | ${crimes} | ${r.deals.promises} / ${r.deals.handovers} / ${r.deals.betrayals} | ${used} | ${r.refusals.tools} / ${r.refusals.core} | ${calls} | ${chars} | ${tokens} | ${spend} |`);
  }
  out.push('');
  return out;
}

// Refused selections precede the nightly core; they are not executed invalid plays.
export function refusalLines(c) {
  const observed = c.coverage === 'complete' ? '' : 'observed ';
  const r = c.refusals;
  const out = [`Typed action coverage: ${c.coverage}; requests ${c.calls ?? 'unknown'} (observed ${c.observedCalls ?? c.calls ?? 0}), with action telemetry ${c.callsWithTelemetry}, affected by a refusal ${c.callsWithRefusal ?? 'unknown'} (observed ${c.callsWithRefusalObserved ?? c.callsWithRefusal}). Submitted actions ${c.actions ?? 'unknown'} (observed ${c.observedActions}); observed errands ${c.errands}, play selections ${c.playSelections}, reads/retrievals ${c.reads ?? 'unknown'}; observed core refusals ${c.coreRefusals}, tool refusals ${c.toolRefusals}; core invalid-errand events ${c.coreInvalidErrandEvents}; executed nightly plays ${c.executedPlays}. Unknown historical counts are not zeros.`, ''];
  if (r) {
    out.push(`| ${observed}Rejected submitted actions | errands | play selections | reads / unclassified | total |`, '|---|---:|---:|---:|---:|');
    for (const [name,row] of [...Object.entries(r.bySource),['all',r]]) out.push(`| ${name} | ${row.errands} | ${row.playSelections} | ${row.reads} / ${row.other} | ${row.total} |`);
    const rate = (n,d) => d ? `${(100*n/d).toFixed(2)}%` : 'n/a';
    out.push('', `Rejected actions: ${observed}${r.total}/${c.actions ?? 'unknown'} (${c.coverage==='complete' ? rate(r.total,c.actions) : 'unknown rate'}); affected calls: ${c.callsWithRefusal ?? 'unknown'}/${c.calls ?? 'unknown'} (${c.callsWithRefusal != null ? rate(c.callsWithRefusal,c.calls) : 'unknown rate'}).`, '');
  }
  // R9b: the dawn journal's calls can't act, so the counts above leave them out.
  if (c.dawnCalls) out.push(`Dawn journal calls ${c.dawnCalls}: they ask for an entry and act on nothing, so the requests and rates above leave them out.`, '');
  out.push(`A refused play selection can be corrected or leave a prior valid pick in place. Executed invalid nightly plays (core replacement events): ${c.executedInvalidPlays ?? 'unknown'}. Core invalid-errand events count core refusals only; tool refusals do not produce those events.`, '');
  return out;
}

const mark = b => (b.pass ? 'PASS' : 'FAIL');
const verdictOf = b => (b.pass === null ? 'n/a' : mark(b));
export const overrideText = o => Object.entries(o).map(([k, v]) => `${k}=${v}`).join(', ');

// The bars that read haul, for a season report: each one's label, and what it read this season under one valuation.
const CRIME_BAR = label('crimePays');
const CRIME_MEDIANS = label('crimeMedians');
const HAUL_ROWS = {
  buyLate: ['Each buy-late bot below the median haul', x => (x.value == null ? 'no buy-late bot' : `the highest buy-late bot ${money(x.value)} vs ${money(x.median)}`)],
  turtle: ['Each turtle below the median haul', x => (x.value == null ? 'no turtle' : `the highest turtle ${money(x.value)} vs ${money(x.median)}`)],
  crimePays: [CRIME_BAR, (x, m) => (x.robber ? `the median robber, ${x.robber} (${m.typeOf[x.robber]}), ${money(x.robberHaul)} vs the median hustler${x.hustle ? ` (${x.hustle})` : ''} ${money(x.hustleHaul)}; its arrests ${x.robberArrests}` : 'no robbers')],
  crimeMedians: [CRIME_MEDIANS, x => `robbers ${money(x.robberHaul)} vs the hustler ${money(x.hustleHaul)}; median robber arrests ${x.robberArrests}`],
  leaderChanges: ['#1 by haul changes hands ≥ 3 times', x => `${x.changes ?? 'n/a'}`],
  money: ["The money works (the median Smuggler, Chemist and Dealer out-earn the median hustler by haul; most chems from Smugglers; no trade's median income over twice another's)", x => `haul ${x.outEarn.map(o => `${o.type} ${money(o.haul)}`).join(' · ')} vs the hustler ${money(x.hustleHaul)}; Smugglers' share of the Chemists' chems ${pct(x.chems.share)}; trade incomes ${money(x.spread.lo)}–${money(x.spread.hi)}`],
  moneyEarn: [label('moneyEarn'), x => `${x.trades.filter(t => 'pass' in t).map(t => `${t.trade} ${money(t.haul)}`).join(' · ')} vs the hustler ${money(x.hustle)}`],
  copGunrunner: ['The median Cop and the median Gunrunner finish in the top half', x => `cop ${money(x.cop)} · gunrunner ${money(x.gunrunner)} vs the median ${money(x.median)}`],
};
// A pass-bar row with the shadow columns: a bar that reads haul shows each shadow's reading, any other a dash.
function barRow(m, rowLabel, text, verdict, key = null) {
  const shadows = SHADOWS.map(v => {
    const x = key && m.shadow && m.shadow[v] ? m.shadow[v][key] : null;
    if (!x) return '—';
    return x.pass === null ? 'n/a' : `${HAUL_ROWS[key][1](x, m)} · ${mark(x)}`;
  });
  return `| ${rowLabel} | ${text} | ${verdict} | ${shadows.join(' | ')} |`;
}
const haulRow = (m, key) => barRow(m, HAUL_ROWS[key][0], HAUL_ROWS[key][1](m.bars[key], m), verdictOf(m.bars[key]), key);
// Haul under each valuation, as table cells: the official, then the shadows.
const haulCells = (f, fmt = money) => VALUATIONS.map(v => fmt(f(v))).join(' | ');
const VALUED_HEAD = VALUATIONS.map(v => (v === 'paid' ? 'haul (copy paid)' : VALUED[v])).join(' | ');
// The readings every report states under its bars (R4-11).
const READINGS = "Each \"median X\" is one seat: the seats ranked by the bar's measure, lowest first, the middle one, or with an even count the lower of the two middle ones (the median robber's ties go to the one arrested fewer times); \"the median haul\" is the season's over every seat. A trade's Cops, Gunrunners, Smugglers, Chemists and Dealers are the seats that play it: its bots, and a model seat by its trade. Stolen value counts every take by crime, each piece at its copy's own first sale and goods at the city's opening prices.";

// R8b: a mixed season's rows' reply modes, in its groups' order, from its setup (runner.mjs: `replies` when its groups'
// differ from the season's, else the season's `reply`, JSON when none).
const repliesOf = m => {
  const o = m.provenance?.config?.options || {};
  return (m.byModel || []).map((_, i) => (Array.isArray(o.replies) ? o.replies[i] : o.reply || 'json'));
};

export function seasonReport(m) {
  const b = m.bars;
  const lines = [];
  lines.push(`# Season ${m.seed}, rule ${m.rule} (MOCK)`);
  lines.push('');
  if (Object.keys(m.overrides || {}).length) {
    lines.push(`**OVERRIDES (this run only, not core/numbers.mjs):** ${overrideText(m.overrides)}`);
    lines.push('');
  }
  lines.push(`${m.score ? LAYER4_SCORE : m.drugs ? LAYER3_DRUGS : m.every ? EVERY_SEAT : m.layer === 2 ? LAYER2_SO_FAR : 'Layer 1'}, 30 scripted bots, 14 nights, midseason event: ${m.midseason}. Tiers are MOCK (GAME.md §4); the numbers are §38's guesses.`);
  if ((m.modelSeats || []).length) lines.push(`Model seats (R2-8): ${m.modelSeats.join(', ')}.`);
  lines.push(...mechanismLines(m));
  if (m.byModel) lines.push(...modelLines(m.byModel, { replies: repliesOf(m) }));
  lines.push('');
  lines.push(`**Who won**, by haul (§27): ${HAUL_TEXT}.`);
  lines.push('');
  lines.push(`| # | agent | ${VALUED_HEAD} |`);
  lines.push(`|---|---|${VALUATIONS.map(() => '---').join('|')}|`);
  m.top.forEach((t, i) => lines.push(`| ${i + 1} | ${t.name} (${t.id}, ${t.type}) | ${haulCells(v => (v === 'paid' ? t.haul : t[v]))} |`));
  lines.push('');
  lines.push('**The biggest stories** (each piece at its copy\'s own first sale):');
  for (const s of m.stories.slice(0, 3)) {
    lines.push(`- Night ${s.night}: ${s.leader} (${s.leaderType}${s.members > 1 ? `, ${s.members} in the group` : ''}) ${s.kind === 'rob' ? 'robbed' : 'broke into'} ${s.target} (${s.targetType}) in ${s.place}: ${s.trait ? `${s.trait} (${s.tier})` : 'no piece'}${s.cash ? ` + ${money(s.cash)}` : ''}, worth ${money(s.value)}.`);
  }
  if (!m.stories.length) lines.push('- No thefts.');
  const bk = m.betrayals.map(x => `${x.kind} by ${x.by} (${x.byType}) on night ${x.night}`).join('; ');
  lines.push(`- Betrayals: ${bk || 'none'}.`);
  lines.push(`- Arrests: ${m.arrests.total} (${Object.entries(m.arrests.byWhy).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}); missed the ferry: ${m.arrests.missedFerry}. Thefts: ${m.thefts}. Evictions: ${m.evictions}. Crews formed: ${m.crews}.`);
  lines.push('');
  lines.push('**Money by bot** (median haul):');
  lines.push('');
  lines.push(`| bot (n) | ${VALUED_HEAD} |`);
  lines.push(`|---|${VALUATIONS.map(() => '---').join('|')}|`);
  for (const t of BOT_TYPES.filter(x => m.countByType[x])) lines.push(`| ${t} (${m.countByType[t]}) | ${haulCells(v => m.valued[v].byType[t])} |`);
  lines.push(`| all | ${haulCells(v => m.valued[v].all)} |`);
  lines.push('');
  lines.push(hustleLine(m.hustles, `a median of ${m.hustleWorkers ?? 'n/a'} agents hustled a night`));
  for (const q of m.squatters || []) {
    const tab = q.tab ? ` Its rent tab at the dock: ${money(q.tab.tab)}, ${money(q.tab.paid)} paid${q.tab.copy ? `, and the landlord took a ${q.tab.tier} (${q.tab.copy})` : ''}.` : '';
    // Its place and haul under each shadow too: 1 + the agents strictly ahead.
    const by = SHADOWS.map(v => `${VALUED[v]} #${1 + Object.values(m.hauls[v]).filter(h => h > m.hauls[v][q.id]).length}, ${money(m.hauls[v][q.id])}`).join('; ');
    lines.push(`**The squatter** (${q.id}, never pays the rent back): #${q.rank} of ${Object.keys(m.haul).length} by haul, ${money(q.haul)} (${by}).${tab}`);
  }
  if (m.tabs && m.tabs.agents) lines.push(`**Rent tabs at the dock** (gap.rentTab): ${m.tabs.agents} settled, ${money(m.tabs.paid)} paid, ${m.tabs.pieces} pieces taken by the landlord.`);
  if (m.hires) lines.push(`**Hired muscle:** ${m.hires.deals} deals; ${m.hires.fights} fights a robber led with hired backers, ${m.hires.won} won; ${m.hires.paid} cuts paid, ${m.hires.walks} walks.`);
  lines.push('');
  if (m.street) lines.push(...streetLines(m.street, m.valued, m.countByType), '');
  if (m.every) lines.push(...partsLines(m), '');
  if (m.police) lines.push(...policeLines(m.police), '');
  if (m.fence) lines.push(fenceLine(m.fence), '');
  if (m.drugs) lines.push(...drugLines(m), '');
  if (m.tricks) lines.push(...trickLines(m.tricks), '');
  if (m.score) lines.push(...scoreLines(m.score), '');
  lines.push(`**Places:** places changed the night's result on ${b.places.nightsChanged} of ${b.places.of} nights. Hits on a public sighting found their target ${pct(b.places.sightedRate)} of the time (${b.places.sightedHits} hits); blind hits ${pct(b.places.blindRate)} (${b.places.blindHits}).`);
  lines.push('');
  lines.push(`**Pass bars, ${m.score ? 'layers 2 to 4 so far' : m.drugs ? 'layers 2 and 3 so far' : m.layer === 2 ? 'layer 2 so far' : 'layer 1'}** (§27 proposals, read by core/bench/passbars.mjs):`);
  lines.push('');
  lines.push(`| Bar | This season | | ${SHADOWS.map(v => VALUED[v]).join(' | ')} |`);
  lines.push(`|---|---|---|${SHADOWS.map(() => '---').join('|')}|`);
  const row = (rowLabel, text, verdict) => lines.push(barRow(m, rowLabel, text, verdict));
  const l = b.ledger;
  row('The ledger and cash checks (after every errand and every night; a failure stops the season)', l.pass === null ? 'not played by the runner' : `${l.errands} after errands and ${l.nights} after nights, ${l.failed} failed`, verdictOf(l));
  lines.push(haulRow(m, 'buyLate'), haulRow(m, 'turtle'), haulRow(m, 'crimePays'), haulRow(m, 'crimeMedians'));
  row('The last night moves < 1/3 of stolen value (every take by crime)', `${money(b.middle.lastNight)} of ${money(b.middle.stolen)} (${pct(b.middle.share)})`, mark(b.middle));
  lines.push(haulRow(m, 'leaderChanges'));
  row(`≥ 3 betrayals (${m.score ? 'walk, rug, turn, rat, double-sell' : m.tricks ? 'walk, rug, turn, rat' : 'layer 1 has walk, rug, turn'})`, `${b.betrayals.total} (${Object.entries(b.betrayals.byKind).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'})`, mark(b.betrayals));
  row('A show-worthy event every night', `${b.showWorthy.nights}/${b.showWorthy.of}${b.showWorthy.missing.length ? ` (quiet: ${b.showWorthy.missing.join(', ')})` : ''}`, mark(b.showWorthy));
  row('≥ 1/3 of minted traits taken or traded', `${b.mintedMoved.moved}/${b.mintedMoved.minted} (${pct(b.mintedMoved.share)})`, mark(b.mintedMoved));
  row('Places matter (≥ 1 night in 5; sighted hits land more)', `${b.places.nightsChanged}/${b.places.of}; ${pct(b.places.sightedRate)} vs ${pct(b.places.blindRate)}`, mark(b.places));
  row('Most of the drop sells (≥ 3/4)', `${b.dropSells.sold}/${b.dropSells.total} (${pct(b.dropSells.share)})`, mark(b.dropSells));
  if (b.money) {
    lines.push(haulRow(m, 'money'));
    const x = b.money.byIncome;
    row('↳ the money works, 1, by income (shadow)', `${x.outEarn.map(o => `${o.type} ${money(o.income)}`).join(' · ')} vs the hustler ${money(x.hustleIncome)}`, mark(x));
  }
  if (b.moneyEarn) lines.push(...partsRows(m));
  if (b.copGunrunner) lines.push(haulRow(m, 'copGunrunner'));
  if (b.drugs) row('Every drug taken at least once, and someone hooked (§27, layer 3)', `${drugCounts(b.drugs.taken)}; hooked ${b.drugs.hooked}`, mark(b.drugs));
  if (b.vault) row(`${VAULT_BAR} this season (§27, layer 4: in at least half of seasons)`, `${b.vault.jobs} vault job${b.vault.jobs === 1 ? '' : 's'} tried`, mark(b.vault));
  row('The backing rules (reported, no bar)', `${b.backing.fights} fights, ${b.backing.backed} with backers; backing decided ${b.backing.decided}; a target cut a backer of the attack on itself ${b.backing.targetHitBacker}`, `rule ${m.rule}`);
  if (b.ceiling) row(label('ceiling'), b.ceiling.pass === null ? 'no seat records' : `the most a seat made in a day ${b.ceiling.most}, a mean of ${b.ceiling.mean == null ? 'n/a' : b.ceiling.mean.toFixed(1)} over ${b.ceiling.seatDays} seat-days; ${b.ceiling.over} over`, verdictOf(b.ceiling));
  const inv = Object.entries(b.invalid).filter(([, v]) => v.plays).map(([t, v]) => `${t} ${v.invalid}/${v.plays}`).join(', ');
  row('Invalid plays (hygiene, no bar)', `${inv || 'no bot plays'}; ${(m.modelSeats || []).length ? 'core-invalid errand events only' : 'invalid errands'} ${m.errandsInvalid.total}`, '—');
  if (b.invalidByModel) row('Invalid plays per model (hygiene, no bar)', modelInvalidText(b.invalidByModel), '—');
  lines.push('');
  lines.push(`The shadow columns score the bars that read haul again under each shadow valuation; a dash is a bar that doesn't read haul. ${READINGS}`);
  lines.push('');
  lines.push(`${waitingFor(m)} ${(m.modelSeats || []).length ? 'Local-model agents against the bots pairs this season with its bot twin, so the summary gives it.' : MODEL_BARS}`);
  lines.push('');
  return lines.join('\n');
}

// What this cast doesn't put in play yet, by layer.
function waitingFor(m) {
  if (m.score) return 'Every layer\'s bars are read.';
  if (m.drugs) return 'Waiting: the vault jobbed in half of seasons (layer 4).';
  if (m.every) return 'Waiting: every drug taken and someone hooked (layer 3); the vault jobbed in half of seasons (layer 4).';
  if (m.layer === 2) return 'Waiting: the fence (L2-4); every drug taken and someone hooked (layer 3); the vault jobbed in half of seasons (layer 4).';
  return 'Waiting for later layers: the median Cop and Gunrunner in the top half, and the money bar (layer 2); every drug taken and someone hooked (layer 3); the vault jobbed in half of seasons (layer 4).';
}
const MODEL_BARS = 'The model bars (local-model agents against the bots, runner calls inside the ceiling, invalid plays per model) are read where model seats play: `--cast models`.';
// Core-event hygiene only; typed tool refusal counts are reported above.
const modelInvalidText = by => Object.entries(by).map(([k, x]) => `${k} ${x.invalid}/${x.plays} (${pct(x.rate)}), ${x.errands} core-invalid errand event${x.errands === 1 ? '' : 's'} only`).join('; ') || 'none';

const LAYER2_SO_FAR = "Layer 2 (the street: the trades' nights, goods, the city's shop and buyer, corners, flex, gear, player cops, shipments and the fence)";
const LAYER3_DRUGS = "Layer 3 in play (the cast `layer3`, L3-5: the trades cast's seats and habits; every seat buys, sells and takes the six drugs, and tips, rats, bribes, posts bounties and hires lookouts, each for its own reasons)";
// R11 (reported, no bar): the hustles in words: how many, the median take, by district and level, robbed and arrested.
const placesText = (byPlace, n = x => x) => Object.entries(byPlace || {}).sort(([x], [y]) => (x < y ? -1 : 1))
  .map(([place, levels]) => `${place} ${Object.entries(levels).map(([l, k]) => `${n(k)} ${l}`).join(', ')}`).join('; ') || 'none';
const hustleLine = (h, head) => (h ? `**Hustles:** ${head}, for a median take of ${money(h.take)}; ${h.total} in all, by district and level: ${placesText(h.byPlace)}; hustlers robbed ${h.robbed}, arrested ${h.arrested}.` : `**Hustles:** ${head}.`);
const LAYER4_SCORE = "Layer 4 in play (the cast `layer4`, L4-4: the layer3 cast's seats and habits; Gunrunners build and sell forged warrants and fakes, crews and robbers job the vault, Cops guard it, and buyers in shades refuse the fakes they can see, each for its own reasons)";
const VAULT_BAR = 'Someone jobs the vault';
const EVERY_SEAT = "Layer 2 with every seat working a trade (the cast `trades`, L2-6: layer 2's seats and §25's strategies; the buy-late savers, turtles, robbers and crews work the trade they drew on any night their strategy leaves free, and the hustlers hustle)";
const PARTS_INCOME = "Income counts work (hustles, flex, the street, the city's buyer, goods and guns sold to agents, a Cop's patrols and collars) less what the trade's goods cost (from agents or the city's shop); a gun a seat buys is gear and doesn't count against its trade; thefts and grabs are apart.";
const ratioText = x => (x == null ? 'n/a' : `${x.toFixed(1)}×`);
// "dealer 3, crew 2": a trade's seats by strategy, most first. `per` divides (seats a season, over many seasons).
const strategies = (byType, per = 1) => Object.entries(byType).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([t, n]) => `${t} ${Math.round((n / per) * 10) / 10}`).join(', ');
const chemsText = c => `from Smugglers ${c.smugglers}, other seats ${c.others}, the city's shop ${c.shop}, the kits ${c.kits}, taken in thefts ${c.taken}`;

// The cast and the money bar's parts, for a season report (the cast where every seat works a trade).
function partsLines(m) {
  const b = m.bars;
  const e = b.moneyEarn;
  const out = [];
  out.push(`**The cast:** every seat has a trade: ${TRADES.map(t => `${t} ${sumOf(Object.values(m.seats[t]))} (${strategies(m.seats[t])})`).join(' · ')}. The hustlers are Cops on paper and hustle; every other seat works its trade on any night its strategy leaves free.`);
  out.push('');
  out.push(`**The money bar, part by part** (§27, §9; a trade's seats are the seats that play it, its bots and any model seat with the trade; each median is one seat): the median hustler's haul ${money(e.hustle)}, its income ${money(e.byIncome.hustleIncome)}.`);
  out.push('');
  out.push('| trade (seats that play it) | median income | median haul | out-earns the hustler by haul | by income (shadow) |');
  out.push('|---|---|---|---|---|');
  for (const t of e.trades) {
    const byIncome = e.byIncome.outEarn.find(o => o.type === t.trade);
    out.push(`| ${t.trade} (${t.seats}) | ${money(t.income)} | ${'haul' in t ? money(t.haul) : '—'} | ${'pass' in t ? mark(t) : 'not in the bar'} | ${byIncome ? mark(byIncome) : '—'} |`);
  }
  out.push('');
  out.push(PARTS_INCOME);
  const c = b.moneyChems;
  out.push(`- Chems that reached the Chemists: ${chemsText(c)}; the Smugglers' share ${pct(c.share)} (§27: most); ${c.cooked} cooked.`);
  const g = b.moneyGap;
  out.push(`- The widest gap between two trades' median incomes: ${g.hi ? `${g.hi.trade} ${money(g.hi.income)} against ${g.lo.trade} ${money(g.lo.income)}, ${ratioText(g.ratio)}` : 'n/a'} (§27: no more than 2×).`);
  out.push(`- The street's share of the cash onto the island: ${pct(b.moneyShare.share)}, ${money(b.moneyShare.street)} of ${money(b.moneyShare.total)} (§9: about two-thirds).`);
  if (m.dealers) out.push(dealersLine(m.dealers));
  if (m.close) out.push(closeLine(m.close));
  return out;
}

// The Dealers' nights on a corner and how many sold, for a season report or the summary.
const dealersLine = d => `- The Dealers' nights on a corner: ${d.dealt}, ${d.sold} of them with a sale (${pct(ratio(d.sold, d.dealt))}).`;
const closeLine = c => `- The close: ${money(c.boarded)} boarded unspent; ${c.unsold} copies left on the list when it closed; ${c.bailed} bails out of a jail that would have outlasted the ferry.`;

// The money bar's parts as rows of a season report's pass-bar table.
function partsRows(m) {
  const b = m.bars;
  const c = b.moneyChems;
  const g = b.moneyGap;
  return [
    haulRow(m, 'moneyEarn'),
    barRow(m, label('moneyChems'), `${c.smugglers} of ${c.total} from Smugglers (${pct(c.share)}): the shop ${c.shop}, other seats ${c.others}, the kits ${c.kits}, thefts ${c.taken}; ${c.cooked} cooked`, mark(c)),
    barRow(m, label('moneyGap'), g.hi ? `${g.hi.trade} ${money(g.hi.income)} vs ${g.lo.trade} ${money(g.lo.income)}: ${ratioText(g.ratio)}` : 'n/a', mark(g)),
    barRow(m, label('moneyShare'), pct(b.moneyShare.share), '—'),
  ];
}

// The street's lines for a season report: where the island's cash came from, each bot's money by source (medians) and
// its median haul under each valuation (`valued`, the official and the shadows), the drops, the corners and the chems.
function streetLines(st, valued, countByType) {
  const out = [];
  out.push(`**The street:** cash onto the island, by source: ${Object.entries(st.island).filter(([, x]) => x).map(([k, x]) => `${k} ${money(x)}`).join(' · ') || 'none'}. The street's share: ${pct(st.streetShare)} (§9 expects about two-thirds).`);
  out.push('');
  out.push(`| bot (n) | ${MONEY_COLUMNS.map(([, l]) => l).join(' | ')} | ${VALUED_HEAD} |`);
  out.push(`|---|${MONEY_COLUMNS.map(() => '---').join('|')}|${VALUATIONS.map(() => '---').join('|')}|`);
  for (const t of Object.keys(st.income)) {
    out.push(`| ${t} (${countByType[t]}) | ${MONEY_COLUMNS.map(([k]) => money(moneyOf(st, t, k))).join(' | ')} | ${haulCells(v => valued[v].byType[t])} |`);
  }
  out.push('');
  out.push('Medians per bot. Income is what work brought in (hustles, flex, the street, the city\'s buyer, goods sold to agents, a Cop\'s patrols and collars) less what its goods cost (bought from agents, the city\'s shop); thefts and grabs are apart.');
  out.push(`**Drops:** ${st.drops.runs} runs; a median of ${st.drops.perDrop ?? 'n/a'} Smugglers at a worked drop, ${pct(st.drops.shared)} of runs shared one, at most ${st.drops.most} at one. **Corners:** ${st.corners.fights} corner fights, ${st.corners.won} won outright; ${st.corners.turf} changes of hands. **Chems cooked:** ${st.chems.cooked}; bought from Smugglers ${st.chems.smugglers}, from the city's shop ${st.chems.shop} (the rest from the kits).`);
  return out;
}

// The fence, for a season report or the summary (one line).
function fenceLine(f) {
  return `**The fence:** ${f.listed} pieces listed, ${f.sold} sold (its cut ${money(f.fees)}); ${f.offered} swaps offered, ${f.swapped} done, ${f.lapsed} lapsed; ${f.returned} deals handed back on night 14.`;
}
// The police, the crate and guns, for a season report (one line each).
function policeLines(p) {
  const a = p.arrests;
  const by = Object.entries(p.crate.byType).map(([t, n]) => `${t} ${n}`).join(', ');
  const c = p.collars;
  const every = c ? ` Every seat that works the Cop trade: ${c.tried} collars tried, ${c.fought} found their target, ${c.won} won; ${c.backed} backs of another Cop's collar.` : '';
  return [
    `**Police:** arrests by a Cop's collar ${a.collar}, in a fight a patrol joined ${a.patrol}, in a fight with the city cops alone ${a.city}, at 5 stars ${a.heat}, at the dock ${a.dock}. The Cop seat patrolled ${p.seat.patrols} nights${p.seat.guards ? `, guarded the vault ${p.seat.guards}` : ''} and won ${p.seat.collarsWon} of ${p.seat.collarsTried} collars, for ${money(p.seat.pay)}.${every}`,
    `**The crate:** ${p.crate.fights} grab fights, ${p.crate.won} won${by ? ` (${by})` : ''}, ${money(p.crate.cash)} in cash taken. **Guns:** ${p.guns.built} built, ${p.guns.shop} bought at the city's shop, ${p.guns.crates} taken in crates, ${p.guns.sold} sold by Gunrunners to agents; at the lock a median of ${p.guns.held ?? 'n/a'} held and ${p.guns.armed ?? 'n/a'} agents armed.`,
  ];
}

const DRUG_NAME = d => d.toUpperCase();
const drugCounts = (counts, f = n => n) => DRUGS.map(d => `${DRUG_NAME(d)} ${f(counts[d] || 0)}`).join(' · ');
const goodsText = g => Object.entries(g).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
// The drugs, for a season report.
function drugLines(m) {
  const d = m.drugs;
  const takers = DRUGS.filter(x => d.taken[x]).map(x => `${DRUG_NAME(x)}: ${strategies(d.by[x])}`).join('; ');
  const hooks = Object.entries(d.hookedOn).map(([x, n]) => `${DRUG_NAME(x)} ${n}`).join(', ');
  return [
    `**The drugs** (§11; by the record, so a SUDO dose counts as SUDO, as its reveal shows it): taken ${drugCounts(d.taken)}${takers ? ` (${takers})` : ''}.`,
    `- Crashes ${d.crashes}, withdrawals ${d.withdrawals}; ${d.hooked} agent${d.hooked === 1 ? '' : 's'} hooked${hooks ? ` (${hooks})` : ''}, ${d.clean} clean mark${d.clean === 1 ? '' : 's'}.`,
    `- The \`taken\` sink: ${goodsText(d.sink)} (a SUDO dose goes out as the TEMP it was handed over as). Cooked: ${goodsText(d.cooked)}.`,
    `- SUDO: ${d.sudo.sold} doses handed over as TEMP, ${d.sudo.written} plays written, ${d.sudo.forced} forced at the lock. TRUTH locked ${d.truth} plays.`,
  ];
}
function drugSummaryLines(d) {
  return [
    `**The drugs, all seasons** (by the record, so a SUDO dose counts as SUDO, as its reveal shows it): taken ${drugCounts(d.taken)}.`,
    `- The seasons each drug was taken in: ${DRUGS.map(x => `${DRUG_NAME(x)} ${countText(d.counts[x])}`).join(' · ')}; someone hooked in ${countText(d.counts.hooked)}.`,
    `- Crashes ${d.crashes}, withdrawals ${d.withdrawals}; ${d.hooked} agents hooked, ${d.clean} clean marks.`,
    `- The \`taken\` sink: ${goodsText(d.sink)} (a SUDO dose goes out as the TEMP it was handed over as). Cooked: ${goodsText(d.cooked)}.`,
    `- SUDO: ${d.sudo.sold} doses handed over as TEMP, ${d.sudo.written} plays written, ${d.sudo.forced} forced at the lock. TRUTH locked ${d.truth} plays.`,
  ];
}

// The tricks, for a season report or (`all`) the summary.
function trickLines(t, all = false) {
  const b = t.bounties;
  const to = strategies(b.to);
  return [
    `**The tricks${all ? ', all seasons' : ''}** (§10, §12, §13): tips ${t.tips.given}, right ${t.tips.right} and wrong ${t.tips.wrong}; arrests in fights a right tip named ${t.tips.arrests}; rats ${t.tips.rats}. Bribes ${t.bribes.paid} (${money(t.bribes.cash)}), the city cops kept out of ${t.bribes.kept} fights. Bounties posted ${b.posted} (${money(b.cash)}): paid ${b.paid} (${money(b.paidCash)}${to ? `, to ${to}` : ''}), gone at the ferry ${b.gone} (${money(b.goneCash)}). Lookouts ${t.looks.hired}${t.looks.hired ? ` (${strategies(t.looks.by)})` : ''}.`,
    `- The new sinks: bribes ${money(t.sinks.bribe)}, lookouts ${money(t.sinks.lookout)}, bounties gone at the ferry ${money(t.sinks.bounty)}.`,
  ];
}

// The big score, for a season report or (`all`) the summary.
function scoreLines(s, all = false) {
  const [j, vt, w, f] = [s.jobs, s.vault, s.warrants, s.fakes];
  return [
    `**The big score${all ? ', all seasons' : ''}** (§7, §9, §12, §13): vault jobs tried ${j.tried}, won ${j.won}, lost ${j.lost}, with ${j.arrests} arrests in them; guards were in ${j.guarded} of those fights. Guard nights ${s.guards} (a guard's wage counts with a Cop's patrols). Warrants built ${w.built}, handed over ${w.sold}, used ${w.used}. Double-sells ${s.doubleSells}.`,
    `- The vault's money: in, ${money(vt.in)} in fines and ${vt.inPieces} pieces seized; out, ${money(vt.taken)} and ${vt.takenPieces} pieces taken by jobs, and ${money(vt.gone)} and ${vt.gonePieces} pieces gone at the ferry.`,
    `- Fakes (§4): made ${f.made}; sold as real ${f.sold}, for ${money(f.soldFor)}; refused ${f.refused} by a buyer, naming the piece, and ${f.fence} at the fence; seen through shades ${f.seen}; exposed at the ferry ${f.exposed}.`,
  ];
}

// A summary cell: seasons passing of the seasons that read the bar, the share of those runs, and in `all` the distinct
// seasons; for a bar with a share of seasons, whether its distinct seasons reach it (passbars.mjs's verdict).
function cellText(g, c, row) {
  if (row.key === 'models') return modelsCellText(g, c);
  const runs = `${c.pass}/${c.n} (${pct(ratio(c.pass, c.n))})${c.missing ? `; missing readings ${c.missing}/${c.total}` : ''}`;
  if (g !== 'all') return runs;
  const d = c.count ? distinctText(c.count) : '';
  return row.need == null ? `${runs}${d}` : `${runs}${d}: ${pct(c.rate)} of distinct seasons, ${c.meets ? 'PASS' : 'FAIL'} (§27: at least ${pct(row.need)})`;
}
// The model bar's cell: pairs won, and in `all` the mean haul a paired seat, the gap and its standard error, the
// verdict, and §27's "how many".
function modelsCellText(g, c) {
  const pairs = `${c.pass}/${c.n} pairs won${c.unpaired ? ` (${c.unpaired} model seasons with no bot twin)` : ''}`;
  if (g !== 'all') return pairs;
  if (!c.n) return `${pairs}: no pair to read; twin provenance ${Object.entries(c.provenance || {}).map(([k,n]) => `${k} ${n}`).join(', ')}`;
  const gap = `${money(c.gap)}${c.se == null ? '' : ` ± ${money(c.se)} (s.e.)`}`;
  const settled = c.settled ? '' : ` (not settled: §27 wants 10 paired seasons first, and 40 if the gap is within the noise${c.noise ? '; it is' : ''})`;
  return `${pairs}${c.count ? distinctText(c.count) : ''}; a paired seat: the model ${money(c.model)}, the bots ${money(c.bots)}, gap ${gap}: ${modelStatus(c)}${settled}; twin provenance ${Object.entries(c.provenance || {}).map(([k,n]) => `${k} ${n}`).join(', ')}`;
}

export function summaryMarkdown(sum, meta = {}) {
  const lines = [];
  lines.push('# R1 bench summary (MOCK)');
  lines.push('');
  if (Object.keys(meta.overrides || {}).length) {
    lines.push(`**OVERRIDES (this run only, not core/numbers.mjs):** ${overrideText(meta.overrides)}`);
    lines.push('');
  }
  if (meta.squatter) {
    lines.push('**BENCH OPTION:** one hustler is a squatter (never pays the rent back, keeps its rares in the bag).');
    lines.push('');
  }
  lines.push(`${sum.score ? LAYER4_SCORE : sum.drugs ? LAYER3_DRUGS : sum.every ? EVERY_SEAT : sum.layer === 2 ? LAYER2_SO_FAR : 'Layer 1'}, 30 scripted bots, 14 nights. ${meta.seeds || ''} ${meta.wall ? `Wall time ${meta.wall}.` : ''}`.trim());
  lines.push(`Tiers are MOCK (GAME.md §4); numbers are §38 guesses; bars are §27 proposals measured for ${sum.layer === 2 ? 'the layers built so far' : 'layer 1'}, read by core/bench/passbars.mjs.`);
  lines.push(`Haul (§27, for testing; R4-1) is Mainland money plus each minted copy at that copy's own first sale on the list. The last-price mark (the measure before R4-1) and the opening price are shadows: "Haul, three ways" below.`);
  lines.push('');
  lines.push(`| Bar | ${sum.groups.map(g => (g === 'all' ? 'all (· distinct seasons)' : `rule ${g}`)).join(' | ')} |`);
  lines.push(`|---|${sum.groups.map(() => '---').join('|')}|`);
  // §27's first bar: the ledger never loses or doubles a copy (checked after every errand and every night; a failure
  // stops the season), and the same seed gives the same log (core/test/determinism.test.mjs).
  lines.push(`| ${label('ledger')} | ${sum.keyNumbers.map(k => `${k.ledgerErrands.toLocaleString('en-US')} + ${k.ledgerNights} checks, ${k.ledgerFailed} failed`).join(' | ')} |`);
  for (const r of sum.rows.filter(x => x.key !== 'ledger')) lines.push(`| ${r.label} | ${r.cells.map((c, i) => cellText(sum.groups[i], c, r)).join(' | ')} |`);
  lines.push('');
  lines.push(`A share of seasons (§27's 90%, 30% and half) is a share of distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped. §27 gives the other bars no share of seasons, so they have no verdict across seasons; their counts are the reading. ${READINGS}`);
  lines.push('');
  if (sum.byModel) lines.push(...modelLines(sum.byModel, { seasons: Math.max(...sum.byModel.map(r => r.seasons)) }));
  const mechanismCounters=(sum.mechanisms || []).map(m=>m.actionCounters);
  if (mechanismCounters.length) lines.push('**All selected-seat submitted actions across reported seasons** (descriptive):', '', ...refusalLines(summarizeActionCounters(mechanismCounters)));
  for (const m of sum.mechanisms || []) lines.push(`Season ${m.seed}, rule ${m.rule}:`, '', ...mechanismLines(m));
  lines.push('**Key medians, per season:**');
  lines.push('');
  lines.push(`| | ${sum.keyNumbers.map(k => (k.group === 'all' ? 'all' : `rule ${k.group}`)).join(' | ')} |`);
  lines.push(`|---|${sum.keyNumbers.map(() => '---').join('|')}|`);
  const row = (rowLabel, f) => lines.push(`| ${rowLabel} | ${sum.keyNumbers.map(f).join(' | ')} |`);
  row('median haul (all agents)', k => money(k.medianHaul));
  for (const t of BOT_TYPES) if (sum.keyNumbers.some(k => k.medianByType[t] != null)) row(`median haul: ${t}`, k => money(k.medianByType[t]));
  if (sum.keyNumbers.some(k => k.squatterRanks.length)) {
    row('the squatter\'s rank by haul (median; #1 in)', k => `${k.squatterRank} (#1 in ${k.squatterRanks.filter(x => x === 1).length} of ${k.squatterRanks.length})`);
  }
  row('hustlers a night / take (medians)', k => `${k.hustleWorkers} / ${money(k.hustles && k.hustles.take)}`);
  row('hustlers robbed / arrested a season (medians)', k => (k.hustles ? `${k.hustles.robbed} / ${k.hustles.arrested}` : 'n/a'));
  row('hustles a season by district and level (means)', k => (k.hustles ? placesText(k.hustles.byPlace, x => x.toFixed(1)) : 'n/a'));
  row('rent tabs at the dock (all seasons): agents / paid / pieces taken', k => `${k.tabs.agents} / ${money(k.tabs.paid)} / ${k.tabs.pieces}`);
  row('hired muscle (all seasons): deals / fights / won / cuts paid / walks', k => `${k.hires.deals} / ${k.hires.fights} / ${k.hires.won} / ${k.hires.paid} / ${k.hires.walks}`);
  row("the median robber's arrests (the crime bar's robber, a season)", k => k.robberArrests);
  row("the robbers' median arrests (the crime bar's shadow reading)", k => k.robberArrestsMedians);
  row('last night share of stolen value', k => pct(k.lastNightShare));
  row('#1 changes', k => k.leaderChanges);
  row('betrayals (kinds, all seasons)', k => `${k.betrayals} (${Object.entries(k.betrayalKinds).map(([x, v]) => `${x} ${v}`).join(', ') || 'none'})`);
  row('show-worthy nights', k => `${k.showWorthyNights}/14`);
  row('minted taken or traded', k => pct(k.mintedMoved));
  row('nights places changed', k => `${k.placesNights}/14`);
  row('hit landing: sighted vs blind', k => `${pct(k.sightedRate)} vs ${pct(k.blindRate)}`);
  row('drop sold', k => pct(k.dropSold));
  if (sum.every) row(label('moneyShare'), k => (k.parts ? `${pct(k.parts.share.median)} (${pct(k.parts.share.lo)}–${pct(k.parts.share.hi)})` : 'n/a'));
  row('thefts / arrests / evictions', k => `${k.thefts} / ${k.arrests} / ${k.evictions}`);
  row('fights (all seasons): with backers / backing decided / a target cut a backer of the attack on itself', k => `${k.fights}: ${k.backed} / ${k.backingDecided} / ${k.targetHitBacker}`);
  row('invalid plays (all seasons)', k => `${k.invalidPlays} of ${k.plays}`);
  if (sum.models) {
    row('invalid plays per model (all seasons; hygiene, no bar)', k => modelInvalidText(k.invalidByModel));
    row('runner calls a seat a day (all seasons): the most / the mean / seat-days over the ceiling', k => `${k.ceiling.most ?? 'n/a'} / ${k.ceiling.mean == null ? 'n/a' : k.ceiling.mean.toFixed(1)} / ${k.ceiling.over}`);
  }
  lines.push('');
  if (sum.shadow) lines.push(...shadowLines(sum.shadow), '');
  if (sum.ruleDiff && sum.ruleDiff.seeds) {
    lines.push(`**Rule A against rule B:** on ${sum.ruleDiff.differ} of ${sum.ruleDiff.seeds} seeds the two rules fought different fights.`);
  }
  lines.push('');
  const all = sum.keyNumbers.find(k => k.group === 'all');
  if (sum.layer === 2 && all && all.street) lines.push(...streetSummaryLines(all.street), '');
  if (sum.every && all && all.parts) lines.push(...partsSummaryLines(all.parts), '');
  if (sum.layer === 2 && all && all.police) {
    lines.push('**The police, the crate and guns, all seasons:**', '');
    lines.push(...policeLines(all.police).map(l => `- ${l}`), '');
  }
  if (sum.layer === 2 && all && all.fence) lines.push(`${fenceLine(all.fence).replace('**The fence:**', '**The fence, all seasons:**')}`, '');
  if (sum.drugs && all && all.drugs) lines.push(...drugSummaryLines(all.drugs), '');
  if (sum.drugs && all && all.tricks) lines.push(...trickLines(all.tricks, true), '');
  if (sum.score && all && all.score) lines.push(...scoreLines(all.score, true), '');
  lines.push(`${sum.score ? "Every layer's bars are read." : sum.drugs ? 'Waiting: the vault (layer 4).' : sum.layer === 2 ? 'Waiting: drugs (layer 3); the vault (layer 4).' : 'Waiting for later layers: the cop and Gunrunner bar and the money bar (layer 2); drugs (layer 3); the vault (layer 4).'} ${sum.models ? 'The model seats are compared with their bot twins in the table.' : MODEL_BARS}`);
  lines.push('');
  return lines.join('\n');
}

// R4-1, haul three ways for the summary: the bars that read haul under each valuation, all seasons, with their distinct
// seasons; and each valuation's median hauls.
function shadowLines(sh) {
  const out = [];
  const head = `| ${VALUATIONS.map(v => (v === 'paid' ? 'copy paid (official)' : VALUED[v])).join(' | ')} |`;
  const rule = `|${VALUATIONS.map(() => '---').join('|')}|`;
  out.push("**Haul, three ways** (R4-1): the official haul values each minted copy at that copy's own first sale on the list; the shadows at its trait's latest list price (the last-price mark, the measure before R4-1) and at its trait's opening price.");
  out.push('');
  out.push(`| Bar, all seasons (seasons passing · distinct) ${head}`);
  out.push(`|---${rule}`);
  for (const r of sh.rows) out.push(`| ${r.label} | ${VALUATIONS.map(v => countText(r.cells[v])).join(' | ')} |`);
  out.push('');
  const m = sh.medians;
  out.push(`| Median haul, all seasons (each season's, then the median across seasons) ${head}`);
  out.push(`|---${rule}`);
  out.push(`| all agents | ${VALUATIONS.map(v => money(m[v].all)).join(' | ')} |`);
  for (const t of BOT_TYPES) if (VALUATIONS.some(v => m[v].byType[t] != null)) out.push(`| ${t} | ${VALUATIONS.map(v => money(m[v].byType[t])).join(' | ')} |`);
  out.push(`| the median robber (the crime bar's robber) | ${VALUATIONS.map(v => money(m[v].robber)).join(' | ')} |`);
  out.push(`| the robbers' median (the crime bar's shadow reading) | ${VALUATIONS.map(v => money(m[v].robbers)).join(' | ')} |`);
  out.push(`| the median hustler | ${VALUATIONS.map(v => money(m[v].hustle)).join(' | ')} |`);
  if (m.paid.squatterRanks.length) out.push(`| the squatter's rank by haul (median; #1 in) | ${VALUATIONS.map(v => `${m[v].squatterRank} (#1 in ${m[v].squatterRanks.filter(x => x === 1).length} of ${m[v].squatterRanks.length})`).join(' | ')} |`);
  out.push('');
  out.push('Distinct seasons: two seasons are one when their events.jsonl match with the rule label stripped.');
  return out;
}

function streetSummaryLines(st) {
  const out = [];
  out.push('**The street, all seasons** (each season\'s medians, then the median across seasons):');
  out.push('');
  out.push(`- Cash onto the island, by source (median season): ${Object.entries(st.island).filter(([, x]) => x).map(([k, x]) => `${k} ${money(x)}`).join(' · ')}. The street's share: ${pct(st.streetShare)} (§9 expects about two-thirds).`);
  const c = st.moneyParts.counts;
  const outEarn = v => c.outEarn[v].map(([t, x]) => `${t} ${countText(x)}`).join(', ');
  out.push(`- The money bar's parts, seasons passing: out-earn the median hustler by haul: ${outEarn('paid')} (shadows: ${SHADOWS.map(v => `${VALUED[v]} ${outEarn(v)}`).join('; ')}; by income: ${c.byIncome.map(([t, x]) => `${t} ${countText(x)}`).join(', ')}); most chems from Smugglers ${countText(c.chems)}; no trade's median income over twice another's ${countText(c.spread)}.`);
  out.push(`- Drops: a median of ${st.drops.perDrop ?? 'n/a'} Smugglers at a worked drop, ${pct(st.drops.shared)} of runs shared one, at most ${st.drops.most} at one. Corners: ${st.corners.fights} corner fights, ${st.corners.won} won outright, ${st.corners.turf} changes of hands. Chems cooked: ${st.chems.cooked}, bought from Smugglers ${st.chems.smugglers}, from the city's shop ${st.chems.shop}.`);
  out.push('');
  out.push(`| bot | ${MONEY_COLUMNS.map(([, l]) => l).join(' | ')} |`);
  out.push(`|---|${MONEY_COLUMNS.map(() => '---').join('|')}|`);
  for (const [t, r] of Object.entries(st.money)) out.push(`| ${t} | ${MONEY_COLUMNS.map(([k]) => money(r[k])).join(' | ')} |`);
  out.push('');
  out.push('Income is what work brought in (hustles, flex, the street, the city\'s buyer, goods sold to agents, a Cop\'s patrols and collars) less what its goods cost (bought from agents, the city\'s shop); thefts and grabs are apart.');
  return out;
}

// The money bar's parts, all seasons, for the summary.
function partsSummaryLines(p) {
  const out = [];
  out.push(`**The money bar, part by part, all seasons** (a trade's seats are the seats that play it; each season's medians, then the median across seasons; the median hustler's haul ${money(p.hustle)}, its income ${money(p.hustleIncome)}):`);
  out.push('');
  out.push('| trade | seats that play it (a season) | median income | median haul | seasons it out-earned the hustler by haul | by income (shadow) |');
  out.push('|---|---|---|---|---|---|');
  for (const t of p.trades) out.push(`| ${t.trade} | ${t.seats} | ${money(t.income)} | ${'haul' in t ? money(t.haul) : '—'} | ${'count' in t ? countText(t.count) : 'not in the bar'} | ${'byIncome' in t ? countText(t.byIncome) : '—'} |`);
  out.push('');
  out.push(`Every seat has a trade, by strategy (a season): ${TRADES.map(t => `${t}: ${strategies(Object.fromEntries(Object.entries(p.seats[t]).filter(([k]) => k !== 'hustle' && k !== 'squatter')), p.of) || 'none'}`).join(' · ')}. The hustlers are Cops on paper and hustle: they're the yardstick. Only a trade's own bots, and model seats with the trade, play it.`);
  const c = p.chems;
  out.push(`- Chems that reached the Chemists: ${chemsText(c)}; the Smugglers' share ${pct(c.share)}; ${c.cooked} cooked.`);
  const pairs = Object.entries(p.gap.pairs).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([k, n]) => `${k} ${n}`).join(', ');
  out.push(`- The widest gap between two trades' median incomes: a median of ${ratioText(p.gap.ratio)} (§27: no more than 2×); the widest pair, by season: ${pairs || 'none'}.`);
  out.push(`- The street's share of the cash onto the island: a median of ${pct(p.share.median)}, from ${pct(p.share.lo)} to ${pct(p.share.hi)} (§9: about two-thirds).`);
  if (p.dealers) out.push(dealersLine(p.dealers).replace('a corner:', 'a corner, all seasons:'));
  if (p.close) out.push(closeLine(p.close).replace('The close:', 'The close (medians a season; bails summed):'));
  out.push(`- ${PARTS_INCOME}`);
  return out;
}
