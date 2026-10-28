import { modelStatus } from './evidence.mjs';
// R3-2: §27's bars side by side for several bench runs (each a folder with summary.json, from bench.mjs or crime.mjs),
// with the key medians the crime bar reads, so an option is measured against its baseline in one table.
// Usage: node core/bench/bars.mjs <run folder> [<run folder> ...] [--md]
//   Each column is a run, named by its folder; every bar is seasons passing out of seasons run (rules A and B together).
// R4-1 (trunk docs/briefs/R4-astra-fixes.md, task 1):
// - every count of seasons is also given as distinct seasons: two seasons are one when their events.jsonl match with
//   the rule label stripped (report.mjs's seasonKeyOf), and a count whose passes all come from one seed says so;
// - haul is copy paid (report.mjs's VALUATIONS), and every row that reads haul has a row for each shadow under it: the
//   last-price mark (the measure before R4-1) and the opening price;
// - the crime bar reads as §27 words it (the median robber by haul, arrested), with the separate medians as a shadow.
// A run made before R4-1 is refused: its haul is the last-price mark and its nights carry no shadows.
// R4-11: every season is scored again from its own record by passbars.mjs, the module that owns §27's bars, so a run
// made before R4-11 reads as today's bars read it; every count and verdict in the table is that module's, and a share
// of seasons (§27's 90%, 30% and half) is a share of distinct seasons. The crime bar's extra ways read "the median" as
// one seat, as every bar does.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { median, medianSeat, botSeats, ROBBERS, seasonKeyOf, seasonCount, acrossSeasons, VALUATIONS, SHADOWS, VALUED, HAUL_BARS } from './passbars.mjs';
import { seasonMetrics } from './metrics.mjs';
import { countText } from './report.mjs';

const money = x => (x == null ? 'n/a' : `$${Math.round(x).toLocaleString('en-US')}`);
const pct = x => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);

// One season's folder, scored again by passbars.mjs (through metrics.mjs) from its own record: the final state, the
// bench data, the cast and the model seats' records its checkpoint keeps, and its events.jsonl; with its cast.
function readSeason(dir, d) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, d, 'result.json'), 'utf8'));
  if (!r.shadow || !r.hauls) throw new Error(`${path.join(dir, d)} was made before R4-1: its haul is the last-price mark and its nights carry no shadows. Run it again.`);
  const ck = JSON.parse(fs.readFileSync(path.join(dir, d, 'checkpoint.json'), 'utf8'));
  const text = fs.readFileSync(path.join(dir, d, 'events.jsonl'), 'utf8');
  const log = text.split('\n').filter(Boolean).map(l => JSON.parse(l));
  const m = seasonMetrics(ck.state, log, { ...ck.bench, ...(ck.models ? { models: ck.models } : {}) }, ck.cast);
  if (m.seasonKey !== seasonKeyOf(text)) throw new Error(`${path.join(dir, d)}: its record doesn't read back as its events.jsonl`);
  return { ...m, cast: ck.cast };
}

// A season's reading of a bar under one valuation: the official one is in its bars, a shadow's in its shadow.
const barOf = (s, v, key) => (v === 'paid' ? s.bars[key] : s.shadow[v][key]);

// One run: each bar's seasons passing with its distinct seasons and its verdict, the bars that read haul under each
// valuation (passbars.mjs's counts), and the medians the crime bar and the money read.
export function readRun(dir) {
  const sum = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
  const seasonsIn = at => fs.readdirSync(at).filter(d => fs.existsSync(path.join(at, d, 'result.json'))).sort().map(d => readSeason(at, d));
  const seasons = seasonsIn(dir);
  // A models run (bench.mjs --cast models) keeps each seed's bot twin under bots/: the model bar pairs with them, and no
  // other bar counts them.
  const twins = fs.existsSync(path.join(dir, 'bots')) ? seasonsIn(path.join(dir, 'bots')) : [];
  const count = pass => seasonCount(seasons, pass);
  const across = acrossSeasons(seasons, { twins });
  const rows = across.rows.map(r => ({ key: r.key, label: r.label, need: r.need, verdict: r.verdict, cell: r.cells[r.cells.length - 1] }));
  const shadow = Object.fromEntries(across.shadow.map(r => [r.key, r.cells]));
  const types = Object.keys(seasons[0].medianByType);
  // Everything that reads haul, under one valuation.
  const byValuation = v => {
    const haulOf = s => s.hauls[v];
    // The crime bar's money part read three more ways, from each season's cast: without the robber the layer3 cast
    // deals a TEMP habit (L3-5a), the scouts alone, and the best robber; and its risk part, the median robber (by this
    // valuation's haul) arrested. The median hustler, and the median robber of each way, is one seat (passbars.mjs).
    const hustleOf = s => {
      const id = medianSeat(botSeats(s.cast, 'hustle'), x => haulOf(s)[x]);
      return id ? haulOf(s)[id] : null;
    };
    const robbersOf = s => {
      const ids = new Set(botSeats(s.cast, ROBBERS));
      return s.cast.filter(c => ids.has(c.id));
    };
    const medianRobber = (s, cs) => {
      const id = medianSeat(cs.map(c => c.id), x => haulOf(s)[x]);
      return id ? haulOf(s)[id] : null;
    };
    // Every robber's haul by its role: a scout with no drug habit dealt, the robber dealt the TEMP habit, a guesser
    // without it; and the scouts with no habit that out-earned their own season's median hustler, of all such
    // scout-seasons.
    const roles = { clean: [], habit: [], guess: [] };
    const cleanBeat = { beat: 0, n: 0 };
    for (const s of seasons) {
      for (const c of robbersOf(s)) roles[c.habit ? 'habit' : c.type === 'guess' ? 'guess' : 'clean'].push(haulOf(s)[c.id]);
      for (const c of robbersOf(s).filter(x => !x.habit && x.type === 'scout')) {
        cleanBeat.n += 1;
        if (haulOf(s)[c.id] > hustleOf(s)) cleanBeat.beat += 1;
      }
    }
    return {
      ways: {
        noHabit: count(s => medianRobber(s, robbersOf(s).filter(c => !c.habit)) > hustleOf(s)),
        scouts: count(s => medianRobber(s, robbersOf(s).filter(c => c.type === 'scout')) > hustleOf(s)),
        best: count(s => Math.max(...robbersOf(s).map(c => haulOf(s)[c.id])) > hustleOf(s)),
        arrested: count(s => barOf(s, v, 'crimePays').robberArrests >= 1),
      },
      roles: Object.fromEntries(Object.entries(roles).map(([k, xs]) => [k, { n: xs.length, median: median(xs) }])),
      cleanBeat,
      medians: {
        robber: median(seasons.map(s => barOf(s, v, 'crimePays').robberHaul)),
        robberArrests: median(seasons.map(s => barOf(s, v, 'crimePays').robberArrests)),
        robbers: median(seasons.map(s => barOf(s, v, 'crimeMedians').robberHaul)),
        hustle: median(seasons.map(s => barOf(s, v, 'crimePays').hustleHaul)),
        all: median(seasons.map(s => s.valued[v].all)),
        byType: Object.fromEntries(types.map(t => [t, median(seasons.map(s => s.valued[v].byType[t]))])),
      },
    };
  };
  return {
    name: path.basename(dir), overrides: sum.OVERRIDES, cast: sum.meta.cast, rows, shadow, n: seasons.length,
    distinct: new Set(seasons.map(s => s.seasonKey)).size,
    valued: Object.fromEntries(VALUATIONS.map(v => [v, byValuation(v)])),
    // The crime bar's shadow reading's risk part, which reads no haul: seasons the robbers' median arrests are at least 1.
    arrestedMedians: count(s => s.bars.crimeMedians.robberArrests >= 1),
    medians: {
      robberArrestsMedians: median(seasons.map(s => s.bars.crimeMedians.robberArrests)),
      thefts: median(seasons.map(s => s.thefts)), arrests: median(seasons.map(s => s.arrests.total)),
      showWorthy: median(seasons.map(s => s.bars.showWorthy.nights)), stolen: median(seasons.map(s => s.bars.middle.stolen)),
    },
  };
}

export function table(runs) {
  const L = [];
  L.push(`| bar | ${runs.map(r => `${r.name} (${r.n} seasons, ${r.distinct} distinct)`).join(' | ')} |`, `|---|${runs.map(() => '---').join('|')}|`);
  // A row of each run's values, and when it reads haul, a row for each shadow under it.
  const line = (label, f) => L.push(`| ${label} | ${runs.map(f).join(' | ')} |`);
  const three = (label, f) => {
    line(label, r => f(r, 'paid'));
    for (const v of SHADOWS) line(`↳ ${VALUED[v]}`, r => f(r, v));
  };
  for (const row of runs[0].rows) {
    const cell = (r, v) => {
      if (v !== 'paid') return countText((r.shadow[row.key] || {})[v]);
      const x = r.rows.find(y => y.key === row.key);
      return x ? cellText(x) : 'n/a';
    };
    if (HAUL_BARS.includes(row.key)) three(row.label, cell);
    else line(row.label, r => cell(r, 'paid'));
  }
  const way = (k, label) => three(label, (r, v) => countText(r.valued[v].ways[k]));
  way('noHabit', 'crime bar, money part, without the robber dealt the TEMP habit: seasons its other robbers\' median robber beats the median hustler');
  way('scouts', 'the same for the scouts alone (the guesser left out)');
  way('best', 'the best robber beats the median hustler');
  way('arrested', 'crime bar, risk part: seasons the median robber (by haul) was arrested at least once');
  line("the shadow reading's risk part: seasons the robbers' median arrests are at least 1", r => countText(r.arrestedMedians));
  three("the median robber's haul (the crime bar's robber; a season's, then across seasons)", (r, v) => money(r.valued[v].medians.robber));
  three("the median robber's arrests (a season's, then across seasons)", (r, v) => r.valued[v].medians.robberArrests);
  three("the robbers' median haul (the shadow reading; a season's, then across seasons)", (r, v) => money(r.valued[v].medians.robbers));
  line("the robbers' median arrests (the shadow reading)", r => r.medians.robberArrestsMedians);
  three("robbers' haul by role, every robber-season (medians): scouts with no habit / the TEMP-habit robber / guessers", (r, v) => ['clean', 'habit', 'guess'].map(k => money(r.valued[v].roles[k].median)).join(' / '));
  three("scouts with no habit that out-earned their season's median hustler (scout-seasons)", (r, v) => `${r.valued[v].cleanBeat.beat}/${r.valued[v].cleanBeat.n}`);
  three('median hustler haul', (r, v) => money(r.valued[v].medians.hustle));
  three('median haul, all agents', (r, v) => money(r.valued[v].medians.all));
  line('thefts / arrests a season (medians)', r => `${r.medians.thefts} / ${r.medians.arrests}`);
  line('stolen value a season (median)', r => money(r.medians.stolen));
  line('show-worthy nights (median of 14)', r => r.medians.showWorthy);
  for (const t of Object.keys(runs[0].valued.paid.medians.byType)) {
    if (runs.every(r => r.valued.paid.medians.byType[t] == null)) continue;
    three(`median haul: ${t}`, (r, v) => money(r.valued[v].medians.byType[t]));
  }
  L.push('', ...runs.map(r => `- ${r.name}: cast ${r.cast}; ${Object.keys(r.overrides || {}).length ? Object.entries(r.overrides).map(([k, v]) => `${k}=${v}`).join(', ') : 'no overrides'}`));
  L.push('', "Haul is Mainland money plus each minted copy at that copy's own first sale on the list (copy paid). Each ↳ row is the row above under a shadow: each copy at its trait's latest list price (the last-price mark, the measure before R4-1), or at its trait's opening price. A count is seasons passing of the run's seasons, then distinct seasons passing of its distinct seasons (two seasons are one when their events.jsonl match with the rule label stripped); \"one seed\" marks a count whose passes all come from one seed. A bar with §27's share of seasons (90%, 30%, half) gives its verdict on its share of distinct seasons; §27 gives the other bars no share. Every \"median X\" is one seat: the seats ranked by the bar's measure, lowest first, the middle one, or with an even count the lower of the two middle ones (the median robber's ties go to the one arrested fewer times). Each season is scored from its own record by core/bench/passbars.mjs.");
  return L.join('\n');
}

// A bar's cell for a run: its seasons passing and distinct seasons passing (passbars.mjs's count); for a bar with a
// share of seasons, its share of distinct seasons and the verdict; for the model bar, the pairs and the means.
function cellText(x) {
  const c = x.cell;
  if (x.key === 'models') return c.n ? `${countText(c.count)} pairs won · the model ${money(c.model)} vs the bots ${money(c.bots)} a seat: ${modelStatus(c)}; twin provenance ${Object.entries(c.provenance || {}).map(([k,n])=>`${k} ${n}`).join(', ')}` : `no paired seasons; twin provenance ${Object.entries(c.provenance || {}).map(([k,n])=>`${k} ${n}`).join(', ')}`;
  const text = `${countText(c.count)}${c.missing ? `; missing readings ${c.missing}/${c.total}` : ''}`;
  return x.need == null ? text : `${text} · ${pct(c.rate)} of distinct seasons: ${x.verdict ? 'PASS' : 'FAIL'} (§27: at least ${pct(x.need)})`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2).filter(a => a !== '--md');
  if (!dirs.length) {
    console.error('usage: node core/bench/bars.mjs <run folder> [<run folder> ...]');
    process.exit(2);
  }
  let runs;
  try {
    runs = dirs.map(readRun);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  console.log(table(runs));
}
