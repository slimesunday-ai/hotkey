// C2-seek · THE STAND PLAN AGREES WITH PLAY (docs/redesign/tape-20261103.md §5, the deciding test). Headless Chrome on ?sim=record: the
// record played without a seek at 60× (the player's own speed box and play button) from --from to --to, with the drawing's claims NOT
// reading the stand plan (agents.js claims as before it), and every --every island minutes, for every agent standing on a spot (mode
// stand, not stepping, not held by the stage), the spot play gave it beside the one the stand plan (simstate/record/stand-plan.js, built in
// the page from the same inputs it has when wired) gives it there at that minute. The bar (the orchestrator's, 11-03): ≥ 95% of the
// standing rows the same spot, then claim() may read the plan with no visible change to play. Reported per place, with the rows that differ.
//   node style/city/tools/standagree.mjs --port 5970 [--seed 404] [--from 1795] [--to 6120] [--every 10] [--out <dir>]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, choose, click, serve } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), SEED = +arg('seed', 404), FROM = +arg('from', 1795), TO = +arg('to', 6120), EVERY = +arg('every', 10);
const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-seek'))), BASE = `http://127.0.0.1:${PORT}`, FEED = `/core/runs/${SEED}-A/feed.jsonl`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PLAY = '#record-player button[aria-label="Play or pause"]', SPEED = '#record-player select[aria-label="Playback speed"]';
// (in the page: the claims off the plan; a sampler on each frame past the next sample minute)
const ARM = `(() => { const R = window.__record, D = R.draw, A = D.agents, P = R.player; A.standPlan = null; A.heldAt = null;
  const ref = sp => !sp ? null : sp.plan ? sp.k : (A.spots.get(sp.place) ?? []).indexOf(sp);
  window.__agree = { rows: [], next: Math.ceil(P.minute / ${EVERY}) * ${EVERY}, done: false };
  (function f() { const G = window.__agree, m = P.minute;
    if (m >= G.next) { G.next = (Math.floor(m / ${EVERY}) + 1) * ${EVERY};
      for (const a of A.map.values()) { if (!a.w || a.mode !== 'stand' || a.step || a.held || a.d?.kind !== 'stand') continue;
        const place = a.d.place, pl = D.standPlan?.spotOf(a.id, place, m);
        G.rows.push([+m.toFixed(3), a.id, place, a.spot?.place === place ? ref(a.spot) : 'elsewhere:' + (a.spot?.place ?? null), pl === undefined ? 'none' : ref(pl), !!(a.spot && A.keepOff?.(a.spot, a))]); } }
    if (m >= ${TO}) { P.pause(); G.done = true; return; } requestAnimationFrame(f); })(); })()`;
const server = await serve();
let B = null; const result = { seed: SEED, from: FROM, to: TO, every: EVERY };
try {
  B = await chrome();
  await B.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&simtod=0&tod=day&recordPaused=1&recordAt=${FROM}&cam=-300,40,300&look=-300,0,260` }); await ready(B);
  for (let t = 0; t < 100 && !(await B.ev('!!window.__recordUI?.tape && !!window.__record?.draw', false).catch(() => false)); t++) await sleep(200);
  await sleep(1500);
  await choose(B, SPEED, 60); await B.ev(ARM, false); await click(B, PLAY);
  const t0 = Date.now();
  while (!(await B.ev('window.__agree.done'))) { if (B.errors.length) throw new Error('page error: ' + B.errors[0]); if (!(await B.ev('window.__record.player.running'))) await click(B, PLAY); await sleep(2000); }
  const rows = await B.ev('window.__agree.rows', true, 120000);
  const by = new Map(), diff = []; let same = 0;
  for (const r of rows) { const [m, id, place, played, plan, kept] = r, k = place.replace(/[-_\d,.]+$/, '').replace(/^venue:.*/, 'venue').replace(/^home:.*/, 'home');
    const o = by.get(k) ?? by.set(k, { rows: 0, same: 0 }).get(k); o.rows++; if (played === plan) { o.same++; same++; } else diff.push({ m, id, place, played, plan, kept }); }
  Object.assign(result, { realSeconds: Math.round((Date.now() - t0) / 1000), rows: rows.length, same, share: rows.length ? +(same / rows.length).toFixed(4) : null,
    byPlace: Object.fromEntries([...by].sort((a, b) => b[1].rows - a[1].rows).map(([k, o]) => [k, { ...o, share: +(o.same / o.rows).toFixed(3) }])), differ: diff });
  console.log(`${result.share >= .95 ? 'PASS' : 'FAIL'} agreement ${same}/${rows.length} = ${(100 * (result.share ?? 0)).toFixed(1)}% (bar 95%)`);
  console.log(JSON.stringify(result.byPlace));
  for (const d of diff.slice(0, 30)) console.log(JSON.stringify(d));
} catch (e) { result.error = String(e && e.stack || e); console.log('FAIL', result.error.slice(0, 600)); }
finally { await B?.close(); server?.kill(); }
await fs.mkdir(OUT, { recursive: true }).catch(() => {});
await fs.writeFile(path.join(OUT, `standagree-${SEED}-${FROM}-${TO}.json`), JSON.stringify(result, null, 1)).catch(() => {});
process.exit(result.share >= .95 ? 0 : 1);
