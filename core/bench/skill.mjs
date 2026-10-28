// R3-2's skill test (trunk docs/briefs/R3-crime-pays.md, "Skill decides"): does a criminal that reads the board out-earn
// one that doesn't, and go to jail less? A paired comparison on the crime cast (bots.mjs, CRIME_MIX): each seed and
// rule is played once with every robber playing as the cast does (reading the board), and once more for each robber
// with that one robber careless (carelessPlay: it robs whenever it can win something, at random, reading nothing), every
// other seat the same. Each pair compares the one seat: its haul, what its crimes took, its arrests, and whether it
// missed the ferry.
// Usage: node core/bench/skill.mjs --seeds 404-423 --rules A,B --out core/runs/r3-skill [--cast crime] [--set key=value ...]
//   It writes skill.json and SKILL.md to --out. --cast (R3-6): a cast built on the crime cast, its robbers' careless
//   twin the same (crime by default; canny is R3-6's).
//        node core/bench/skill.mjs --summary <out folder> [<out folder> ...]
//   One line for each earlier test, all its pairs: reads the board against careless, from its skill.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSeason, argsOrExit, parseSet } from './runner.mjs';
import { CASTS, makeCast } from './bots.mjs';
import { takesOf, takeWorth, firstSales, ROBBERS } from './passbars.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sum = xs => xs.reduce((t, x) => t + x, 0);
const mean = xs => (xs.length ? sum(xs) / xs.length : null);
const sd = xs => {
  const m = mean(xs);
  return xs.length > 1 ? Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1)) : null;
};
const money = x => (x == null ? 'n/a' : `${x < 0 ? '−' : ''}$${Math.abs(Math.round(x)).toLocaleString('en-US')}`);

// One seat's season, from its run folder's record: its haul (the report's: copy paid, and under R4-1 the two shadows,
// the last-price mark and the opening price), what its crimes took (R4-11: every take it led, a hit, a break-in, a
// grab or a vault job, at its worth as §27's bars count it, passbars.mjs's takeWorth: a piece at its copy's own first
// sale, goods at the city's opening prices), its arrests, and whether it missed the ferry.
function seatOf(dir, id, metrics) {
  const log = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const { copies } = JSON.parse(fs.readFileSync(path.join(dir, 'checkpoint.json'), 'utf8')).state;
  const sales = firstSales(log);
  return {
    haul: metrics.haul[id],
    haulMark: metrics.hauls.mark[id],
    haulOpen: metrics.hauls.open[id],
    took: sum(takesOf(log).filter(e => e.leader === id).map(e => takeWorth(e, sales, copies))),
    // R4-11: `took` reads every take at its worth; a test made before it kept its thefts at the record's `value`.
    tookAt: 'worth',
    crimes: log.filter(e => e.type === 'play' && e.agent === id && ['hit', 'breakin', 'grab', 'vault'].includes(e.kind)).length,
    arrests: log.filter(e => e.type === 'arrest' && e.agent === id).length,
    missed: log.some(e => e.type === 'missed' && e.agent === id) ? 1 : 0,
  };
}

function pairs({ seeds, rules, outDir, overrides, cast = 'crime' }) {
  const out = [];
  for (const rule of rules) {
    for (const seed of seeds) {
      const base = runSeason({ seed, rule, outDir: path.join(outDir, 'sharp'), overrides, mix: CASTS[cast] });
      const robbers = makeCast(seed, CASTS[cast]).filter(c => ROBBERS.includes(c.type)).sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1)));
      robbers.forEach((c, i) => {
        const mix = { ...CASTS[cast], careless: i + 1 };
        const r = runSeason({ seed, rule, outDir: path.join(outDir, `careless-${i + 1}`), overrides, mix });
        out.push({ seed, rule, id: c.id, type: c.type, trade: c.trade, sharp: seatOf(base.dir, c.id, base.metrics), careless: seatOf(r.dir, c.id, r.metrics) });
      });
    }
  }
  return out;
}

// Paired differences, sharp less careless: the mean, its standard error, and how often sharp came out ahead, level or
// behind. A key a test from before R4-1 never kept (the haul's shadows) is null.
function paired(list, key) {
  if (list.some(p => p.sharp[key] == null || p.careless[key] == null)) return null;
  const d = list.map(p => p.sharp[key] - p.careless[key]);
  const s = sd(d);
  return {
    sharp: mean(list.map(p => p.sharp[key])), careless: mean(list.map(p => p.careless[key])), diff: mean(d),
    se: s == null ? null : s / Math.sqrt(d.length), ahead: d.filter(x => x > 0).length, level: d.filter(x => x === 0).length, behind: d.filter(x => x < 0).length, n: d.length,
  };
}

export function skillPage(ps, meta) {
  const L = ['# R3-2: the skill test (MOCK)', '', `${meta.seeds}; ${meta.overrides || 'no overrides'}. Command: \`${meta.command}\`.`, ''];
  L.push('Each pair is one robber seat on one seed and rule: the crime cast as it plays (reading the board) against the same season with that one robber careless. Means a seat a season; the difference is sharp less careless, with its standard error; ahead/level/behind count the pairs.', '');
  const groups = [['all robbers', ps], ['scouts', ps.filter(p => p.type === 'scout')], ['guessers', ps.filter(p => p.type === 'guess')]];
  for (const [label, list] of groups) {
    if (!list.length) continue;
    L.push(`**${label}** (${list.length} pairs)`, '', '| | reads the board | careless | difference (± s.e.) | ahead / level / behind |', '|---|---|---|---|---|');
    for (const [key, name, fmt] of [['haul', 'haul (copy paid)', money], ['haulMark', 'haul, last-price mark (shadow)', money], ['haulOpen', 'haul, opening price (shadow)', money], ['took', 'crimes took (each take at its worth: a piece at its own first sale)', money], ['crimes', 'crimes tried', x => x.toFixed(2)], ['arrests', 'arrests', x => x.toFixed(2)], ['missed', 'missed the ferry', x => `${Math.round(x * 100)}%`]]) {
      const p = paired(list, key);
      if (!p) continue;
      L.push(`| ${name} | ${fmt(p.sharp)} | ${fmt(p.careless)} | ${fmt(p.diff)} (± ${p.se == null ? 'n/a' : fmt(p.se)}) | ${p.ahead} / ${p.level} / ${p.behind} |`);
    }
    L.push('');
  }
  return L.join('\n');
}

// One line a test: every pair's means, reads the board and careless, the difference, its standard error and the pairs
// ahead and behind, for the haul, the thefts' take, the arrests, the missed ferries and the crimes tried.
export function summaryLines(dirs) {
  const L = ['| skill test | pairs | haul (copy paid): reads / careless (diff ± s.e.; ahead-behind) | haul, last-price mark (shadow) | haul, opening price (shadow) | crimes took (each take at its worth) | arrests | missed the ferry | crimes tried |', '|---|---|---|---|---|---|---|---|---|'];
  const pct = x => `${Math.round(x * 100)}%`;
  for (const dir of dirs) {
    const ps = JSON.parse(fs.readFileSync(path.join(dir, 'skill.json'), 'utf8')).pairs;
    const cell = (key, f) => {
      const p = paired(ps, key);
      return p ? `${f(p.sharp)} / ${f(p.careless)} (${f(p.diff)} ± ${f(p.se)}; ${p.ahead}-${p.behind})` : 'n/a';
    };
    // A test from before R4-1 kept one haul, the last-price mark: it shows in that column, and copy paid is n/a.
    const old = ps.some(p => p.sharp.haulMark === undefined);
    // A test from before R4-11 kept its thefts at the record's `value` and its grabs' and vault jobs' cash alone.
    const before = ps.some(p => p.sharp.tookAt === undefined);
    L.push(`| ${path.basename(dir)} | ${ps.length} | ${old ? 'n/a (made before R4-1)' : cell('haul', money)} | ${cell(old ? 'haul' : 'haulMark', money)} | ${cell('haulOpen', money)} | ${before ? `${cell('took', money)} (made before R4-11: thefts at the record's value)` : cell('took', money)} | ${cell('arrests', x => x.toFixed(2))} | ${cell('missed', pct)} | ${cell('crimes', x => x.toFixed(1))} |`);
  }
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === '--summary') {
  console.log(summaryLines(process.argv.slice(3)));
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const usage = 'node core/bench/skill.mjs --seeds 404-423 --rules A,B --out core/runs/r3-skill [--cast crime|canny] [--set key=value ...]';
  const args = argsOrExit(process.argv.slice(2), { seeds: 'value', rules: 'value', out: 'value', cast: 'value', set: 'list' }, usage);
  const cast = args.cast || 'crime';
  if (!['crime', 'canny'].includes(cast)) {
    console.error(`--cast takes crime or canny, a cast built on the crime cast, not ${JSON.stringify(cast)}\nusage: ${usage}`);
    process.exit(2);
  }
  const overrides = parseSet(args.set);
  const [lo, hi] = (args.seeds || '404-423').split('-').map(Number);
  const seeds = Array.from({ length: (hi || lo) - lo + 1 }, (_, i) => lo + i);
  const rules = (args.rules || 'A,B').split(',');
  const outDir = path.resolve(args.out || path.join(here, '..', 'runs', 'r3-skill'));
  fs.rmSync(outDir, { recursive: true, force: true });
  const ps = pairs({ seeds, rules, outDir, overrides, cast });
  const meta = {
    seeds: `the ${cast} cast, seeds ${lo}-${hi || lo} under rules ${rules.join(' and ')}`, overrides: Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(', '),
    command: `node core/bench/skill.mjs ${process.argv.slice(2).join(' ')}`,
  };
  fs.writeFileSync(path.join(outDir, 'skill.json'), `${JSON.stringify({ meta, pairs: ps }, null, 1)}\n`);
  fs.writeFileSync(path.join(outDir, 'SKILL.md'), `${skillPage(ps, meta)}\n`);
  console.log(skillPage(ps, meta));
}
