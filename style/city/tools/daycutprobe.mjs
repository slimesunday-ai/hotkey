// C2-tvday · THE DAY DIRECTOR'S PICKS, IN NODE: which moments the day director (simstate/record/day-director.js) cuts to in
// directorscenario's day windows (two seeded 10-minute windows a seed, TV mode at 10×: the page ticks it once a real second, so every
// 10 island seconds), and where each cut's subjects are at its establishing minute and at its close-up (routineCloseup, else
// start + 0.5): at home (the timeline's place is its own home lot, no trip under way: draw.js draws it INSIDE its home, C2-indoors),
// on a trip, or out. Reads the record only (the same modules draw.js draws from); measures, decides nothing.
//   node style/city/tools/daycutprobe.mjs [--seeds 404] [--json]
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFeed } from '../simstate/record/adapter.js';
import { createShowPlanner, createShowPlayer } from '../simstate/record/show-plan.js';
import { createRoutinePlanner } from '../simstate/record/routines.js';
import { createDayDirector } from '../simstate/record/day-director.js';
import { buildTimeline, createTripRule, placeOf, HOME } from '../simstate/record/continuity.js';
import { continuityTrips } from '../simstate/record/routine-places.js';
import { addressesFor } from '../simstate/record/addresses.js';
import { HOUSE_LOTS } from '../simstate/record/places.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const SEEDS = arg('seeds', '404').split(',').map(Number), JSONOUT = process.argv.includes('--json'), DAY = 1440, TICK = 10 / 60;
// (directorscenario.mjs's windows(), the same seeded draw)
export function windows(seed) { let x = seed * 2654435761 % 4294967296; const rnd = () => (x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return [0, 1].map(() => { const d = 1 + Math.floor(rnd() * 13); return d * DAY + 360 + Math.floor(rnd() * 880); }); }
const LOTS = new Set(HOUSE_LOTS.map(l => l.id));

export function probe(seed) {
  const file = `${ROOT}core/runs/${seed}-A/feed.jsonl`;
  if (!fs.existsSync(file)) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  const frames = parseFeed(fs.readFileSync(file, 'utf8'));
  const routines = createRoutinePlanner(frames), planner = createShowPlanner(frames), TL = buildTimeline(frames, routines, planner);
  const rule = createTripRule({ timeline: TL, planner, trips: continuityTrips }), book = addressesFor(frames[0].board.agents.map(a => a.id));
  // where the record has an agent at minute m: 'home' (at its own home lot, arrived: drawn inside), 'trip', 'hidden', else 'out'
  function where(id, m) {
    const list = TL.segs.get(id) || []; let i = -1;
    for (let k = 0; k < list.length && list[k].start <= m; k++) i = k;
    if (i < 0) return 'origin';
    const t = list[i].t; if (t.reason === 'hidden' || t.reason === 'departed') return 'hidden';
    const d = rule.at(id, i); if (d?.trip && m < d.trip.arr) return 'trip';
    return placeOf(t) === HOME + book[id]?.home ? 'home' : 'out';
  }
  const out = [];
  for (const w0 of windows(seed)) {
    const player = createShowPlayer(frames), director = createDayDirector({ routines, delay: () => 15 });
    const cuts = [];
    for (let m = w0; m < w0 + 10; m += TICK) {
      const d = director.tick(player.seek(m));
      if (d?.action === 'cut' && d.cut) {
        const c = d.cut, close = c.routineCloseup ?? c.start + .5;
        cuts.push({ id: c.momentId, kind: c.captionFields.kind, start: +c.start.toFixed(2), place: c.place.cityPlace, homeLot: LOTS.has(c.place.cityPlace),
          subjects: c.subjects.map(id => ({ id, atCut: where(id, c.start), atClose: where(id, close) })) });
      }
    }
    out.push({ seed, window: w0, day: Math.floor(w0 / DAY), clock: `${String(Math.floor(w0 % DAY / 60)).padStart(2, '0')}:${String(w0 % 60).padStart(2, '0')}`, cuts });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const all = SEEDS.flatMap(probe);
  if (JSONOUT) console.log(JSON.stringify(all, null, 1));
  else for (const w of all) {
    console.log(`seed ${w.seed} · day ${w.day} ${w.clock} (${w.window}) · ${w.cuts.length} day cuts`);
    for (const c of w.cuts) console.log(`  ${c.start}  ${c.kind.padEnd(8)} ${c.place.padEnd(22)} ${c.homeLot ? 'home lot' : 'street  '}  ${c.subjects.map(s => `${s.id}:${s.atCut}→${s.atClose}`).join(' ')}`);
    const n = w.cuts.length, home = w.cuts.filter(c => c.subjects.some(s => s.atClose === 'home')).length;
    console.log(`  subject at home at the close-up: ${home}/${n}`);
  }
}
