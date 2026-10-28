// BROADCAST CHECK (2026-10-09, TV plan A1 · simstate/broadcast.js; node, no browser). Exit code 1 on any failure.
//   node style/city/tools/broadcastcheck.mjs [run] [--port 5474] [--from "D1 12:00"] [--minutes 720]   (the default run's 12 h with 4 burglaries and 5 unseen robberies)
//   0 · THE GREP GATE: the lookahead (broadcast.js ahead()) is imported by camera/director.js and nothing else. Every .js / .mjs / .html
//       under style/city that names broadcast.js: no `ahead` among its named imports, no namespace or default import of the module, no
//       dynamic import of it in page code (tools/ may, for stats), no re-export, no call of ahead(); broadcast.js itself touches no
//       window, globalThis, document, self or postMessage (nothing global can hand ahead out); and director.js, once it exists, never
//       puts what ahead returns on window, in the DOM or in the console (its ahead binding on such a line).
//   1 · THE LINE (a simulated page clock and timer): D = 0 hands each message straight on (synchronously, in order, no timer); D = 15:
//       in order, each D s after it came once the ramp is done, the join's ramp at 0.8× (the first at once, D behind after 5 D), a late
//       timer folds what is due into one release (the map's diffs by id, the store's events in order), a clock that goes back flushes
//       the queue into the new state at once, a backfilled join (ago) starts D behind; the folds themselves.
//   2 · THE LOOKAHEAD AGAINST THE LENS: the replay (started here, paused: we seek) stepped a game minute at a time through a busy window,
//       the store feed as the page runs it (storefeed.js, here inline) claiming an agent (the owner view: `mine` in every state), each
//       state pushed into the page's store line (D = 15 s, one poll a second). After every step ahead() holds only lensed public data:
//       no private key or event at any depth (lens.js leaks), no DM, no unseen robber or burglar named, never `mine`, `tape`, `rap`,
//       `people`, `me` or `myEvents`, never the claimed agent's own card; and every event it showed is released later, unchanged.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLine, mergeDiff, mergeState, ahead } from '../simstate/broadcast.js';
import { leaks, isDM } from '../simstate/lens.js';
import { createStoreFeed } from '../simstate/storefeed.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..'), ROOT = path.resolve(HERE, '../../..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const RUN = args.find((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--'))) || '2026-09-29T23-18-20-641Z-mixed';
const PORT = +opt('port', 5474), FROM = opt('from', 'D1 12:00'), MINUTES = +opt('minutes', 720), BASE = `http://127.0.0.1:${PORT}`;
const fails = [], fail = (where, what) => { if (fails.length < 60) fails.push(`${where}: ${what}`); fails.n = (fails.n || 0) + 1; };
const ok = (c, where, what) => { if (!c) fail(where, what); };

// ── 0 · the grep gate
const DIRECTOR = 'camera/director.js', SKIP = new Set(['node_modules', 'shots', 'baked', 'runs', '.git']);
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');   // (comments out: a comment may name ahead)
function walk(dir, out = []) { for (const d of fs.readdirSync(dir, { withFileTypes: true })) { if (SKIP.has(d.name)) continue; const p = path.join(dir, d.name);
  if (d.isDirectory()) walk(p, out); else if (/\.(m?js|html)$/.test(d.name)) out.push(p); } return out; }
// one file's source → its violations (rel: the path under style/city)
function gateFile(rel, raw, bad) {
  if (rel === 'simstate/broadcast.js') { const code = strip(raw); for (const w of ['window', 'globalThis', 'document', 'self', 'postMessage']) if (new RegExp(`\\b${w}\\b`).test(code)) bad(rel, `touches ${w} (nothing global may hand ahead out)`); return false; }
  if (!/broadcast\.js/.test(raw)) return false; const code = strip(raw), isTool = /(^|\/)tools\//.test(rel);
  for (const m of code.matchAll(/import\s+([^;'"`]*?)\s+from\s+['"`]([^'"`]*broadcast\.js)['"`]/g)) {
    const spec = m[1].trim(), names = (spec.match(/\{([^}]*)\}/)?.[1] || '').split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    if ((/\*\s*as\s/.test(spec) || /^[A-Za-z_$][\w$]*\s*(,|$)/.test(spec)) && rel !== DIRECTOR) bad(rel, `imports the whole of broadcast.js (${spec}): ahead with it`);
    if (names.includes('ahead') && rel !== DIRECTOR && rel !== 'tools/broadcastcheck.mjs') bad(rel, 'imports ahead (only camera/director.js may)'); }
  for (const m of code.matchAll(/export\s+[^;]*?from\s+['"`]([^'"`]*broadcast\.js)['"`]/g)) bad(rel, `re-exports broadcast.js (${m[0].slice(0, 60)})`);
  if (/import\(\s*[^)]*broadcast\.js/.test(code) && rel !== DIRECTOR && !isTool) bad(rel, 'imports broadcast.js dynamically (the whole module, ahead with it)');
  if (/\bahead\s*\(/.test(code) && rel !== DIRECTOR && rel !== 'tools/broadcastcheck.mjs') bad(rel, 'calls ahead()');
  if (rel === DIRECTOR) {   // what ahead returns stays inside the director: its binding never on a line that reaches the window, the DOM or the console
    const binds = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"`][^'"`]*broadcast\.js/g)].flatMap(m => m[1].split(',').map(s => s.trim()).filter(s => /^ahead\b/.test(s)).map(s => s.split(/\s+as\s+/)[1] || 'ahead'));
    for (const b of binds) for (const line of code.split('\n')) if (new RegExp(`\\b${b}\\b`).test(line) && /\b(window|globalThis|document|textContent|innerHTML|insertAdjacent\w*|console\.\w+|postMessage|toast)\b/.test(line)) bad(rel, `ahead (${b}) on a line that reaches the screen: ${line.trim().slice(0, 100)}`); }
  return true;
}
const gate = { files: 0, importers: [], director: fs.existsSync(path.join(CITY, DIRECTOR)) };
for (const f of walk(CITY)) { const rel = path.relative(CITY, f).split(path.sep).join('/'); gate.files++; if (rel === 'tools/broadcastcheck.mjs') continue; if (gateFile(rel, fs.readFileSync(f, 'utf8'), fail)) gate.importers.push(rel); }   // (not this check: its plants are strings)
// the gate's self-test: one planted violation of each kind must be caught, and the director's own import must pass
const PLANTS = [
  ['ui/plant.js', "import { sim } from '../simstate/store.js';\nimport { delayS, ahead } from '../simstate/broadcast.js';"],
  ['ui/plant.js', "import { ahead as peek } from '../simstate/broadcast.js';"],
  ['ui/plant.js', "import * as B from '../simstate/broadcast.js';"],
  ['ui/plant.js', "import B from '../simstate/broadcast.js';"],
  ['ui/plant.js', "const m = await import('../simstate/broadcast.js'); m.ahead();"],
  ['simstate/plant.js', "export { ahead } from './broadcast.js';"],
  ['simstate/broadcast.js', "export function ahead() { return 1; }\nwindow.__ahead = ahead;"],
  [DIRECTOR, "import { ahead as look } from '../simstate/broadcast.js';\nconst a = look(); window.__dir = look();"],
  [DIRECTOR, "import { ahead } from '../simstate/broadcast.js';\nconst a = ahead(); el.textContent = JSON.stringify(ahead().events);"],
];
let caught = 0; for (const [rel, src] of PLANTS) { let n = 0; gateFile(rel, src, () => n++); if (n) caught++; else fail('0 · self-test', `missed: ${rel}: ${src.replace(/\n/g, ' ⏎ ')}`); }
{ let n = 0; gateFile(DIRECTOR, "import { ahead } from '../simstate/broadcast.js';\n// the director scores what ahead() shows\nconst next = ahead().events.filter(x => x.in < 4);", () => n++); if (n) fail('0 · self-test', 'the director\'s own import was refused'); }
console.log(`0 · grep gate: ${caught}/${PLANTS.length} planted violations caught; ${gate.files} files; broadcast.js named in ${gate.importers.length} (${gate.importers.join(', ')}); ${gate.director ? DIRECTOR + ' checked' : DIRECTOR + ' not written yet'} → ${fails.length ? fails.length + ' failures' : 'only the director may import ahead'}`);

// ── 1 · the line, on a simulated page clock and timer
function sim(o = {}) { let now = 0; const timers = new Map(); let id = 0; const out = [];
  const line = createLine({ release: m => out.push({ m, at: now }), tOf: m => m.t, now: () => now, timer: { set: (fn, ms) => { timers.set(++id, { at: now + ms, fn }); return id; }, clear: k => timers.delete(k) }, ...o });
  const advance = (ms, { fire = true } = {}) => { const end = now + ms; for (;;) { const nx = fire ? [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0] : null; if (!nx || nx[1].at > end) break; now = Math.max(now, nx[1].at); timers.delete(nx[0]); nx[1].fn(); } now = end; };
  return { line, out, advance, get now() { return now; }, timers }; }
{ // D = 0: today's path
  const S = sim({ delay: () => 0 }); S.line.push({ t: 1 }); ok(S.out.length === 1 && S.out[0].at === 0, '1 · D = 0', 'not released at once'); S.line.push({ t: 2 }); S.line.push({ t: 2 });
  ok(S.out.map(x => x.m.t).join() === '1,2,2', '1 · D = 0', 'out of order'); ok(S.timers.size === 0, '1 · D = 0', 'a timer was set'); }
{ // D = 15: the ramp, then each D s after it came, in order
  const S = sim({ delay: () => 15 }); for (let k = 0; k < 120; k++) { S.line.push({ t: k }); S.advance(1000); }
  const lagAt = k => { const r = S.out.find(x => x.m.t === k); return r ? (r.at - k * 1000) / 1000 : null; };
  ok(lagAt(0) === 0, '1 · ramp', `the first went after ${lagAt(0)} s, not at once`); ok(Math.abs(lagAt(20) - 5) < .01, '1 · ramp', `lag after 20 s ${lagAt(20)} (0.8×: 5)`);
  ok(Math.abs(lagAt(60) - 15) < .01 && Math.abs(lagAt(100) - 15) < .01, '1 · ramp', `lag at 60 s ${lagAt(60)}, at 100 s ${lagAt(100)} (15)`);
  ok(S.out.every((x, k) => x.m.t === k), '1 · order', 'released out of order'); ok(S.line.stats().maxBatch === 1, '1 · order', 'folded on time'); }
{ // a late timer (a hidden tab's throttled timers, no arrivals): what is due goes as one, folded
  const S = sim({ delay: () => 15, merge: mergeState }); const st = (t, ev) => ({ type: 'state', t, changed: [{ handle: 'a', live: { t } }], roster: null, events: ev.map(id => ({ id, t })) });
  S.line.push({ ...st(0, []), reset: true, events: [] }); for (let k = 1; k <= 80; k++) { S.line.push(st(k, [k])); S.advance(1000); }
  const n0 = S.out.length; S.advance(5000, { fire: false }); S.line.pump(); const got = S.out.slice(n0);
  const ids = got[0]?.m.events.map(e => e.id) || [], prev = S.out[n0 - 1]?.m.events.map(e => e.id).pop();
  ok(got.length === 1, '1 · fold', `${got.length} releases for what was due together`); ok(ids.length >= 5 && ids.every((v, k) => v === prev + 1 + k), '1 · fold', `events ${ids} after ${prev}: not all of them, in order`);
  ok(got[0]?.m.changed.length === 1 && got[0]?.m.changed[0].live.t === got[0]?.m.t, '1 · fold', 'the card is not the latest'); }
{ // the clock goes back: the queue is flushed into the new state, at once; the ramp starts again
  const S = sim({ delay: () => 15, merge: mergeDiff, tOf: d => d.t }); const d = (t, homes) => ({ t, homes: homes.map(([id, v]) => ({ id, v })), piles: [], corners: [], notes: [] });
  for (let k = 0; k < 90; k++) { S.line.push(d(500 + k, k === 85 ? [['h1', 'lit']] : [])); S.advance(1000); }
  const n0 = S.out.length, q0 = S.line.stats().queued; S.line.push(d(300, [['h2', 'dark']])); const got = S.out.slice(n0);
  ok(q0 > 5 && got.length === 1 && got[0].at === S.now, '1 · epoch', `${q0} queued → ${got.length} releases (one, at once)`);
  ok(got[0]?.m.t === 300 && got[0]?.m.homes.map(h => h.id).sort().join() === 'h1,h2', '1 · epoch', `the flush lost the queued diffs' homes (${got[0]?.m.homes.map(h => h.id)})`);
  ok(S.line.stats().flushes === 1 && S.line.stats().queued === 0, '1 · epoch', 'not flushed'); const F = S.now; S.advance(1000); S.line.push(d(301, [])); const q1 = S.line.stats().queued; S.advance(1000);
  ok(q1 === 1 && S.out[S.out.length - 1].m.t === 301 && S.out[S.out.length - 1].at === F + 1250, '1 · epoch', 'no ramp after the flush (the next, 1 s later, should go 1.25 s after it)'); }
{ // a backfilled join: D behind from the first message
  const S = sim({ delay: () => 15 }); for (let ag = 15; ag >= 1; ag--) S.line.push({ t: 100 - ag }, { ago: ag }); S.line.push({ t: 100 });
  ok(S.out.length === 1 && S.out[0].m.t === 85, '1 · backfill', `released ${S.out.map(x => x.m.t)} at once (the oldest only)`); S.advance(15000);
  ok(S.out.length === 16 && Math.abs(S.line.stats().lag - 15) < .01, '1 · backfill', `${S.out.length} released, lag ${S.line.stats().lag}`); }
{ // the folds themselves
  const m = mergeDiff({ t: 1, homes: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }], piles: [], corners: [{ id: 'c', v: 1 }], notes: ['x'] }, { t: 2, homes: [{ id: 'a', v: 2 }], piles: [{ id: 'p' }], corners: [], notes: ['y'], agents: [1] });
  ok(m.t === 2 && JSON.stringify(m.homes) === '[{"id":"a","v":2},{"id":"b","v":1}]' && m.corners.length === 1 && m.piles.length === 1 && m.notes.join() === 'x,y' && m.agents.length === 1, '1 · mergeDiff', JSON.stringify(m));
  const r = { type: 'state', t: 5, reset: true, changed: [], events: [{ id: 1 }], roster: ['a'] }, s1 = { type: 'state', t: 6, changed: [{ handle: 'a', live: 1 }], events: [{ id: 2 }], roster: null };
  ok(mergeState(r, s1) === null, '1 · mergeState', 'a reset was folded into a later state'); ok(mergeState(s1, r) === r, '1 · mergeState', 'a reset did not replace what came before');
  const s2 = mergeState(s1, { type: 'state', t: 7, changed: [{ handle: 'a', live: 2 }, { handle: 'b', live: 1 }], events: [{ id: 3 }], roster: null });
  ok(s2.t === 7 && s2.events.map(e => e.id).join() === '2,3' && s2.changed.length === 2 && s2.changed[0].live === 2, '1 · mergeState', JSON.stringify(s2)); }
console.log(`1 · the line: D = 0 at once and in order, no timer; D = 15 ramp (0 → 5 s at 20 s → 15 s from 60 s), order, a late timer folded to one release, a clock going back flushed at once and ramped again, a backfilled join D behind; the folds → ${fails.length ? fails.length + ' failures so far' : 'all hold'}`);

// ── 2 · the lookahead against the lens (the replay, started here, paused: we seek)
const get = async p => { const r = await fetch(BASE + p); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };
const rp = spawn(process.execPath, [path.join(HERE, 'simreplay.mjs'), RUN, '--port', String(PORT), '--speed', '0', '--quiet'], { stdio: ['ignore', 'pipe', 'pipe'] });
let rpOut = ''; rp.stdout.on('data', d => rpOut += d); rp.stderr.on('data', d => rpOut += d);
const C = { steps: 0, aheadEvents: 0, aheadCards: 0, kept: 0, released: 0, mineSeen: 0, ownCards: 0, rob: 0, robUnseen: 0, burgle: 0, says: 0 };
try {
  for (let k = 0; k < 100; k++) { await new Promise(r => setTimeout(r, 100)); try { await get('/'); break; } catch {} if (rp.exitCode !== null) throw new Error('the replay did not start: ' + rpOut.trim()); }
  const st = await get('/'), handles = (await get('/state?view=full')).agents.filter(a => !a.npc).map(a => a.handle), me = handles[0], token = (await get('/dev/token?handle=' + encodeURIComponent(me))).token;
  const places = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim2/places.json'), 'utf8'));
  // the page's store line (D = 15 s), on a clock this check moves a second per poll; what each released state carried, to hold ahead to it
  let now = 0; const timers = new Map(); let tid = 0; const promised = new Map(), rel = [];
  const line = createLine({ name: 'store', merge: mergeState, tOf: m => m.t, delay: () => 15, now: () => now, release: m => rel.push(m),
    timer: { set: (fn, ms) => { timers.set(++tid, { at: now + ms, fn }); return tid; }, clear: k => timers.delete(k) } });
  const tick = ms => { now += ms; for (const [k, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (t.at <= now) { timers.delete(k); t.fn(); } };
  const feed = createStoreFeed({ url: BASE + '/state', places, as: me, token, interval: 1e8, onMsg: m => { if (m.type === 'state') { if (m.changed.some(c => c.handle === me && c.mine)) C.mineSeen++; line.push(m); } } });
  const t0 = (await get('/seek?t=' + encodeURIComponent(FROM))).t;
  const BAD_KEYS = new Set(['mine', 'tape', 'rap', 'people', 'me', 'myEvents']);
  const badKeys = (o, w, depth = 0) => { if (!o || typeof o !== 'object' || depth > 8) return; for (const [k, v] of Object.entries(o)) { if (BAD_KEYS.has(k)) fail(w, `holds ${k}`); badKeys(v, `${w}.${k}`, depth + 1); } };
  for (let t = t0; t < t0 + MINUTES && t <= st.to; t++) {
    await get('/seek?t=' + t); await feed.pollNow(); tick(1000); C.steps++;
    const A = ahead(), w = `ahead @${t}`;
    for (const p of leaks(A)) fail(w, p); badKeys(A, w);
    for (const { e } of A.events) { ok(!isDM(e), w, `a DM (${e.id})`); if (e.type === 'rob') { C.rob++; if (e.seen === false) { C.robUnseen++; ok(!e.who, w, `an unseen robbery names @${e.who}`); } }
      if (e.type === 'burgle') { C.burgle++; ok(!e.who, w, `a burglary names @${e.who}`); } if (e.type === 'say') C.says++; promised.set(e.id, JSON.stringify(e)); }
    for (const a of A.agents) { ok(a.handle !== me, w, 'the claimed agent\'s own card (its owner\'s view)'); }
    C.aheadEvents += A.events.length; C.aheadCards += A.agents.length;
    ok(A.events.every((x, k) => k === 0 || x.at >= A.events[k - 1].at), w, 'not oldest first');
  }
  tick(30000);   // everything still queued goes out
  for (const m of rel) { if (m.reset) continue; for (const e of m.events) { C.released++; if (promised.has(e.id)) { C.kept++; if (promised.get(e.id) !== JSON.stringify(e)) fail(`released @${m.t}`, `event ${e.id} is not what ahead showed`); } } }
  ok(C.kept === promised.size, '2 · kept', `ahead showed ${promised.size} events, ${C.kept} of them released`);
  ok(C.aheadEvents > 0 && C.mineSeen > 0, '2 · coverage', `${C.aheadEvents} events seen ahead, ${C.mineSeen} owner states`);
  console.log(`2 · the lookahead: ${st.run} from ${FROM}, ${C.steps} polls a game minute apart (D = 15 s, a poll a second), claiming @${me} (the owner view in ${C.mineSeen} states): ahead showed ${C.aheadEvents} event-sightings (${promised.size} events: ${C.rob} robbery sightings, ${C.robUnseen} unseen, ${C.burgle} burglaries, ${C.says} says) and ${C.aheadCards} cards, never the claimed agent's; ${C.kept} of the ${promised.size} released later unchanged (${C.released} released in all) → ${fails.length ? fails.length + ' failures' : 'public and lensed'}`);
  feed.stop();
} catch (e) { fail('2', e.message); }
finally { rp.kill(); }
if (fails.length) { console.log(`\nFAILURES: ${fails.n}`); for (const f of fails) console.log('  ✗ ' + f); process.exitCode = 1; } else console.log('\nBROADCAST CHECK PASS');
