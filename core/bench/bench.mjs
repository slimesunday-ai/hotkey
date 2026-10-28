// The $0 bench (GAME.md §25, step 0): every seed under every backing rule, a report per season, and one summary.
// Usage: node core/bench/bench.mjs --seeds 404-423 --rules A,B --out core/runs/bench [--set key=value ...] [--squatter]
//          [--cast trades|layer4|layer3|layer2|layer1|models|models-canny] [--model-seats N]
// --set overrides one of core/numbers.mjs's numbers for this run only (see runner.mjs); SUMMARY.md and summary.json
// say so at the top. --squatter swaps one hustler for the squatter bot in every season, and says so too. --cast
// picks the bots (runner.mjs): trades (every seat works a trade) by default, layer3 (layer 3 in play: the drugs and the
// tricks), layer4 (layer 4 in play: warrants, the vault, guards and fakes), or layer2 or layer1 to reproduce theirs.
// --cast models --model-seats N (R2-8) is the layer4 cast with N seats played by the fake model, still $0 (R5-deals:
// --cast models-canny, the canny cast's, the same way, its twin canny too): each seat's
// own bot answers through the reply format. The bench never calls a real model: one model season is the runner's.
// R4-11, §27's model bar: with --cast models each seed plays twice, first with the bots in every seat (the same cast
// with no model seat, into <out>/bots/), then with the model in its seats; the summary pairs the two. Every other bar
// counts the model seasons.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSeason, runModelSeason, argsOrExit, BENCH_ARGS, parseSet, mixOrExit, castName, MODEL_CASTS } from './runner.mjs';
import { summarize } from './metrics.mjs';
import { summaryMarkdown } from './report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const usage = 'node core/bench/bench.mjs --seeds 404-423 --rules A,B --out core/runs/bench [--set key=value ...] [--squatter] [--cast trades|layer4|layer3|layer2|layer1|models|models-canny] [--model-seats N]';
const args = argsOrExit(process.argv.slice(2), BENCH_ARGS, usage);
const overrides = parseSet(args.set);
const mix = mixOrExit(args, usage);
const cast = castName(mix);
const modelCast = MODEL_CASTS.includes(cast);
const [lo, hi] = (args.seeds || '404-423').split('-').map(Number);
const seeds = Array.from({ length: (hi || lo) - lo + 1 }, (_, i) => lo + i);
const rules = (args.rules || 'A,B').split(',');
const outDir = path.resolve(args.out || path.join(here, '..', 'runs', 'bench'));

const started = Date.now();
if (Object.keys(overrides).length) console.log(`OVERRIDES (this run only): ${Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(", ")}`);
if (mix.squatter) console.log('BENCH OPTION: one hustler is a squatter');
console.log(`CAST: ${cast}`);
if (modelCast) console.log(`MODEL SEATS: ${mix.models} a season, played by the fake model ($0), each seed after its bot twin`);
const results = [];
const twins = [];
const times = [];
const calls = { live: 0, taped: 0 };
for (const rule of rules) {
  for (const seed of seeds) {
    if (modelCast) {
      fs.rmSync(path.join(outDir, 'bots', `${seed}-${rule}`), { recursive: true, force: true });
      twins.push(runSeason({ seed, rule, outDir: path.join(outDir, 'bots'), overrides, mix: { ...mix, models: 0 } }).metrics);
    }
    const t0 = Date.now();
    fs.rmSync(path.join(outDir, `${seed}-${rule}`), { recursive: true, force: true });
    const r = modelCast ? await runModelSeason({ seed, rule, outDir, overrides, mix }) : runSeason({ seed, rule, outDir, overrides, mix });
    times.push(Date.now() - t0);
    results.push(r.metrics);
    if (r.calls) for (const k of Object.keys(calls)) calls[k] += r.calls[k];
  }
}
const wall = `${((Date.now() - started) / 1000).toFixed(1)} s`;
const sum = summarize(results, { twins });
const meta = { seeds: `Seeds ${lo}-${hi || lo} under rules ${rules.join(' and ')}: ${results.length} seasons.`, wall, overrides, squatter: mix.squatter || 0, cast };
fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), summaryMarkdown(sum, meta));
fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify({ OVERRIDES: overrides, meta, ...sum, perSeason: results.map(r => ({ seed: r.seed, rule: r.rule, midseason: r.midseason, bars: Object.fromEntries(Object.entries(r.bars).map(([k, v]) => [k, v.pass])) })) }, null, 1)}\n`);

const pctOf = c => `${c.pass}/${c.n}`;
console.log(`${results.length} seasons in ${wall} (per season: median ${times.sort((a, b) => a - b)[Math.floor(times.length / 2)]} ms, max ${times[times.length - 1]} ms)`);
console.log(['bar', ...sum.groups].join(' | '));
// Each bar's seasons passing, and where §27 gives one, its verdict across seasons (passbars.mjs).
for (const r of sum.rows) console.log([r.label, ...r.cells.map(pctOf), ...(r.verdict == null ? [] : [r.status || (r.verdict ? 'PASS' : 'FAIL')])].join(' | '));
if (modelCast) console.log(`model calls: ${calls.live} to the fake, ${calls.taped} from a tape`);
console.log(`summary: ${path.join(outDir, 'SUMMARY.md')}`);
