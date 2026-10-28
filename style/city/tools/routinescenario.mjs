// C1-4 · THE DAY'S PUBLIC ROUTINES, WATCHED: one headless-Chrome run of seed 404's recorded season on the record path, driven with
// real input on the player's own controls (speed, play/pause, the minute box, the night picker, "Go to show").
//   node style/city/tools/routinescenario.mjs --port 5950 [--seed 404] [--out <dir>] [--quick]
// Steps, in order; the first that fails stops the run (no shots of a broken state):
//   1 before     the lane head's page (C1-3, 94d4b34: the files this change touches served as they were there, on --port + 1): the
//                sampled hours played at 60×, agent-seconds standing with no loop per agent-hour
//   2 after      the same hours on this checkout: the same number, every `meet` of the seed in them drawn with both agents together at
//                the venue (or displaced at the same minute by the planner: counted apart), the loops' first picks the same on a reload
//   3 bubbles    a planted fixture (the seed's feed with three out-loud lines added: the bench's bots never talk) — each line shows over
//                its speaker at its minute, not before, gone after its window; nothing else ever shows as a bubble
//   4 shows      C1-3's check at every show: placecheck's checkDrawn on the walkers' drawn positions (the loops stay within its 1.5 m)
//   5 network    only GETs of this server's static files and the two feeds (and the import map's three.js)
//   6 frames     frame time p95 on the record path at 60× vs the same view with no sim
//   7 shots      a sit-down at the diner, a dealer looping on its corner, a bubble, a wired walk: on 2×2 sheets, every tile labelled
// It serves this checkout itself (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, ready, choose, click, clickText, typeMinute, playUntil, serve, CHECK } from './recordscenario.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 0), SEED = +arg('seed', 404), QUICK = process.argv.includes('--quick'), HEAD = arg('head', '94d4b34');
const OUT = path.resolve(arg('out', path.join(ROOT, 'style/city/shots/c1-4')));
const BASE = `http://127.0.0.1:${PORT}`, FEED = `/core/runs/${SEED}-A/feed.jsonl`, FIXTURE = `/core/runs/${SEED}-A/feed-outloud.jsonl`;
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.185.1/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the sampled hours: day 2, 09:30–10:30 and 13:15–14:15 (the morning's and the afternoon's errands, with their sit-downs)
const DAY = 1440, WINDOWS = [[2 * DAY + 570, 2 * DAY + 630], [2 * DAY + 795, 2 * DAY + 855]];
// the planted lines (fixture only): [day, hh:mm of an errand frame, roster index]
const PLANT = [[2, 585, 1, 'Corner of First is open. Come see me.'], [2, 585, 10, 'Anybody seen the boat come in?'], [2, 810, 5, 'Hot out here today, stay cool.']];

// ── the lane head's page: every file this change touches, served as it was at HEAD (new files: 404); the rest from this checkout
function headServer(port) {
  const changed = new Set(execFileSync('git', ['diff', '--name-only', HEAD], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));
  const added = new Set(execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean));
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jsonl': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), rel = decodeURIComponent(u.pathname).replace(/^\/+/, ''), type = mime[path.extname(rel)] || 'application/octet-stream';
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(body); };
    if (rel.includes('..')) return send(403, 'no');
    try {
      if (added.has(rel)) return send(404, 'not at ' + HEAD);
      if (changed.has(rel)) return send(200, execFileSync('git', ['show', `${HEAD}:${rel}`], { cwd: ROOT, maxBuffer: 1 << 28 }));
      const file = path.join(ROOT, rel), st = await fs.stat(file).catch(() => null);
      if (!st) return send(404, 'missing');
      if (st.isDirectory()) return send(404, 'dir');
      send(200, await fs.readFile(file));
    } catch (e) { send(500, String(e)); }
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r({ srv, changed: [...changed], added: [...added] })));
}

// ── the fixture: the seed's feed with PLANT's out-loud lines added at their errand frames (ids renumbered to stay dense)
function writeFixture() {
  const frames = fss.readFileSync(path.join(ROOT, FEED.slice(1)), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const roster = frames[0].board.agents.map(a => a.id), lines = [];
  const plants = PLANT.map(([day, hm, k, line]) => ({ frame: frames.findIndex(f => f.step.kind === 'errand' && f.minute >= day * DAY + hm), agent: roster[k], line }));
  // where each planted id goes: after the last event of its frame; every later id moves up by the plants before it
  let next = 0; const remap = new Map(), out = [];
  for (const [i, f] of frames.entries()) {
    const events = [];
    for (const e of f.events) { if (!remap.has(e.id)) remap.set(e.id, next++); events.push({ ...e, id: remap.get(e.id) }); }
    for (const p of plants.filter(p => p.frame === i)) { const id = next++; events.push({ id, t: f.t, day: f.day, type: 'outloud', agent: p.agent, say: p.line, terms: {}, line: p.line, minute: f.minute }); lines.push({ id, agent: p.agent, minute: f.minute, line: p.line }); }
    out.push(JSON.stringify({ ...f, events }));
  }
  fss.writeFileSync(path.join(ROOT, FIXTURE.slice(1)), out.join('\n') + '\n');
  return lines;
}

// ── in the page: agent-seconds by state over the playhead's windows (page seconds; the player at 60×: one island minute a second)
const SAMPLER = windows => `(() => { const R = window.__record, A = R.draw.agents, W = ${JSON.stringify(windows)}; const S = window.__c14 = { t: 0, agents: 0, stand: 0, noLoop: 0, per: {}, meets: {}, walks: {}, frames: 0 };
  const cues = [...(R.draw.meetings?.values() ?? [])].filter(c => W.some(([a, b]) => c.minute >= a && c.minute < b));
  let last = null; const f = now => { const dt = last === null ? 0 : Math.min(.1, (now - last) / 1000); last = now; const m = R.player.minute;
    if (R.player.running && W.some(([a, b]) => m >= a && m < b) && dt > 0) { S.t += dt; S.frames++;
      for (const a of A.map.values()) { S.agents += dt; const p = S.per[a.id] ||= { stand: 0, noLoop: 0 };
        if (!a.w || a.mode !== 'stand' || a.held) continue; S.stand += dt; p.stand += dt;
        const L = a.life, busy = !!(L && L.wait <= 0 && !(L.settle > 0) && (L.cur?.k === 'loop' || L.cur?.k === 'go')) || !!a.talk?.on;
        if (!busy) { S.noLoop += dt; p.noLoop += dt; } }
      for (const c of cues) { if (m < c.minute) continue; const M = S.meets[c.eventId] ||= { a: c.a, b: c.b, venue: c.venue, minute: c.minute, staged: null, together: null, talked: false, apart: null };
        if (M.staged === null && R.draw.routines) { const rows = R.draw.routines.at(c.minute), ra = rows.find(r => r.agent === c.a), rb = rows.find(r => r.agent === c.b); M.staged = ra?.meet === c.eventId && rb?.meet === c.eventId; }
        const x = A.map.get(c.a), y = A.map.get(c.b);
        if (x?.rec?.meet === c.eventId && y?.rec?.meet === c.eventId && x.w && y.w && x.mode === 'stand' && y.mode === 'stand') { const d = Math.hypot(x.w.p[0] - y.w.p[0], x.w.p[2] - y.w.p[2]);
          if (d <= 3 && x.spot?.place === y.spot?.place) { if (M.together === null) M.together = +(m - c.minute).toFixed(2); M.place = x.spot.place; M.gap = +d.toFixed(2); if (x.talk?.on || y.talk?.on) M.talked = true; } else M.apart = +d.toFixed(2); } }
      for (const a of A.map.values()) if (a.rec?.walkClip && a.w) { const k = a.id + ':' + a.rec.walkClip, wk = S.walks[k] ||= { overlay: 0, stand: 0 }; if (a.w.mv?.walkOverlay || (a.life?.cur?.k === 'go' && a.life.cur.clip === a.rec.walkClip)) wk.overlay += dt; if (a.life?.cur?.clip && ${JSON.stringify(['wired_bounce', 'spaced_drift', 'guarded_stance'])}.includes(a.life.cur.clip)) wk.stand += dt; } }
    if (!S.done) requestAnimationFrame(f); }; requestAnimationFrame(f); return cues.length; })()`;
const summary = S => ({ pageSeconds: +S.t.toFixed(1), agentHours: +(S.agents / 3600).toFixed(4), standingShare: +(S.stand / Math.max(1e-9, S.agents)).toFixed(3),
  noLoopPerAgentHour: +(S.noLoop / Math.max(1e-9, S.agents / 3600)).toFixed(1), noLoopShareOfStanding: +(S.noLoop / Math.max(1e-9, S.stand)).toFixed(3),
  worst: Object.entries(S.per).map(([id, p]) => [id, +(p.noLoop / Math.max(1e-9, p.stand)).toFixed(2), +p.stand.toFixed(1)]).filter(x => x[2] > 5).sort((a, b) => b[1] - a[1]).slice(0, 5) });
async function sampleWindows(B, base) {
  const S = { t: 0, agents: 0, stand: 0, noLoop: 0, per: {}, meets: {}, walks: {}, frames: 0 };
  for (const [from, to] of WINDOWS) {
    await B.send('Page.navigate', { url: `${base}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=day&simtod=0&recordAt=${from - 1}&cam=0,300,0&look=0,0,1` });
    await ready(B); await sleep(2500);
    await B.ev(SAMPLER([[from, to]]));
    await playUntil(B, to, 200000);
    const W = await B.ev('(() => { window.__c14.done = true; return window.__c14; })()');
    for (const k of ['t', 'agents', 'stand', 'noLoop', 'frames']) S[k] += W[k];
    for (const [id, p] of Object.entries(W.per)) { const q = S.per[id] ||= { stand: 0, noLoop: 0 }; q.stand += p.stand; q.noLoop += p.noLoop; }
    Object.assign(S.meets, W.meets);
    for (const [k, v] of Object.entries(W.walks)) { const q = S.walks[k] ||= { overlay: 0, stand: 0 }; q.overlay += v.overlay; q.stand += v.stand; }
  }
  return S;
}

const aim = (B, x, z, { h = 9, back = 12, side = 5 } = {}) => B.ev(`(() => { const c = window.__city; c.controls.target.set(${x}, 0.9, ${z}); c.camera.position.set(${x + side}, ${h}, ${z + back}); c.controls.update?.(); return true; })()`);
async function shot(B, file) { const r = await B.send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(file, Buffer.from(r.result.data, 'base64')); return file; }
const agentAt = (B, id) => B.ev(`(() => { const a = window.__record.draw.agents.map.get(${JSON.stringify(id)}); return a?.w ? { x: a.w.p[0], y: a.w.p[1], z: a.w.p[2], yaw: a.w.yawS ?? a.w.p[3], mode: a.mode, clip: a.life?.cur?.clip ?? a.w.mv?.clip ?? null, talk: a.talk?.role ?? null, spot: a.spot?.place ?? null } : null; })()`, false);

async function main() {
  if (!PORT) { console.error('usage: node style/city/tools/routinescenario.mjs --port <port>'); process.exit(2); }
  if (!fss.existsSync(path.join(ROOT, FEED.slice(1)))) { const r = spawnSync(process.execPath, ['core/bench/runner.mjs', '--seed', String(SEED), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'], { cwd: ROOT, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); }
  await fs.mkdir(OUT, { recursive: true });
  const planted = writeFixture();
  const server = await serve(), result = { seed: SEED, windows: WINDOWS, steps: [], planted };
  const step = (name, ok, detail) => { result.steps.push({ name, ok, ...detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`); if (!ok) throw Object.assign(new Error(name + ' failed'), { step: true }); };
  const tiles = []; let B = null, B0 = null, head = null;
  try {
    // (--only shots: the shots alone, for looking again; the run then reports FAIL: its steps did not all run)
    if (arg('only') !== 'shots') {
    // 1 · before: the lane head's page, on its own server and browser. A checkout without that commit (a fresh clone) reads the
    // measurement made on it from tools/fixtures/routinescenario-baseline.json instead, only for the same commit, seed, hours and
    // feed (slime, 10-27: "go with your recommendations": package the baseline's measured numbers)
    const hasHead = (() => { try { execFileSync('git', ['cat-file', '-e', `${HEAD}^{commit}`], { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; } })();
    let before;
    if (hasHead) {
      head = await headServer(PORT + 1); B0 = await chrome();
      console.log(`  before: ${HEAD} for ${head.changed.length} changed files, ${head.added.length} new ones absent`);
      const S0 = await sampleWindows(B0, `http://127.0.0.1:${PORT + 1}`); before = summary(S0);
      if (B0.errors.length) throw new Error('lane-head page error: ' + B0.errors[0]);
      await B0.close(); B0 = null; head.srv.close(); head = null;
      step('before', S0.t > 60, { head: HEAD, ...before });
    } else {
      const F = JSON.parse(fss.readFileSync(path.join(ROOT, 'style/city/tools/fixtures/routinescenario-baseline.json'), 'utf8'));
      const feed = createHash('sha256').update(fss.readFileSync(path.join(ROOT, FEED))).digest('hex');
      before = { pageSeconds: F.pageSeconds, noLoopPerAgentHour: F.noLoopPerAgentHour, noLoopShareOfStanding: F.noLoopShareOfStanding };
      console.log(`  before: ${HEAD} isn't in this checkout; its measured numbers from the fixture`);
      step('before', F.head === HEAD && F.seed === SEED && F.feedSha256 === feed && JSON.stringify(F.windows) === JSON.stringify(WINDOWS) && F.pageSeconds > 60,
        { head: HEAD, fixture: true, feedMatches: F.feedSha256 === feed, ...before });
    }
    // 2 · after: the same hours here; the sit-downs in them
    B = await chrome();
    const S1 = await sampleWindows(B, BASE), after = summary(S1);
    const meets = Object.entries(S1.meets).map(([id, M]) => ({ id: +id, ...M }));
    const staged = meets.filter(M => M.staged), bad = staged.filter(M => M.together === null || M.together > 10 || !M.talked);
    const walks = S1.walks;
    result.after = { ...after, meets, walks };
    step('after', after.noLoopPerAgentHour < before.noLoopPerAgentHour && bad.length === 0 && meets.length > 0, { ...after, before: before.noLoopPerAgentHour,
      meets: { inWindows: meets.length, staged: staged.length, together: staged.filter(M => M.together !== null).length, talked: staged.filter(M => M.talked).length, displacedSameMinute: meets.filter(M => M.staged === false).map(M => `${M.id}@${M.minute}:${M.a}-${M.b}`) }, bad });
    // the loops' first picks: the same on a reload at the same minute (seeded by the rows' loopSeed, never Math.random)
    const picks = async () => { await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=day&simtod=0&recordAt=${WINDOWS[0][0] + 20}` }); await ready(B); await sleep(6000);
      return B.ev(`Object.fromEntries([...window.__record.draw.agents.map.values()].filter(a => a.life).map(a => [a.id, a.life.trace]))`); };
    const p1 = await picks(), p2 = await picks(), keys = Object.keys(p1).filter(k => p1[k]?.length && p2[k]?.length);
    const same = keys.filter(k => p1[k][0] === p2[k][0]);
    step('seeded', keys.length > 10 && same.length === keys.length, { agents: keys.length, sameFirstPick: same.length, differ: keys.filter(k => p1[k][0] !== p2[k][0]).map(k => [k, p1[k][0], p2[k][0]]).slice(0, 5) });
    // 3 · bubbles: the fixture
    const bub = [];
    for (const L of planted) {
      await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FIXTURE}&recordPaused=1&tod=day&simtod=0&recordAt=${L.minute - 0.5}` });
      await ready(B); await sleep(2500);
      const q = `(() => { const R = window.__record; R.draw.update(true); return { shown: R.draw.bubbles.shown(), dom: [...document.querySelectorAll('.rec-bubble')].filter(e => e.style.display !== 'none').map(e => ({ event: +e.dataset.event, agent: e.dataset.agent, text: e.lastChild.textContent })) }; })()`;
      const pre = await B.ev(q);
      await typeMinute(B, L.minute); await sleep(1500);
      const pos = await agentAt(B, L.agent); if (pos) { await aim(B, pos.x, pos.z, { h: 8, back: 11, side: 4 }); await sleep(1800); }
      const at = await B.ev(q);
      const f = await shot(B, path.join(OUT, `bubble-${L.id}.png`));
      const span = await B.ev('window.__record.draw.bubbles.span()');
      await typeMinute(B, +(L.minute + span + 0.5).toFixed(2)); await sleep(800);
      const post = await B.ev(q);
      const ok = !pre.shown.some(s => s.eventId === L.id) && at.dom.some(d => d.event === L.id && d.text === L.line && d.agent === L.agent) && at.shown.find(s => s.eventId === L.id)?.onWalker && !post.shown.some(s => s.eventId === L.id)
        && at.dom.every(d => planted.some(p => p.id === d.event && p.line === d.text));
      bub.push({ id: L.id, agent: L.agent, minute: L.minute, ok, before: pre.shown.length, at: at.shown, after: post.shown.length, file: f });
      if (!tiles.some(t => t.key === 'bubble')) tiles.push({ key: 'bubble', file: f, label: `Day 2 ${hhmm(L.minute)} · ${L.agent} out loud (planted fixture line) · bubbles ${ok ? 'PASS' : 'FAIL'}` });
    }
    step('bubbles', bub.every(b => b.ok), { lines: bub.map(({ file, ...b }) => b) });
    // 4 · every show: C1-3's check, with the loops on
    const shows = await B.ev(`(async () => { await new Promise(r => setTimeout(r, 0)); return window.__record.player.shows(); })()`), checks = [];
    for (const s of QUICK ? shows.slice(0, 3) : shows) {
      await ready(B);
      await choose(B, '#record-player select[aria-label="Night to replay"]', s.night);
      await clickText(B, 'Go to show');
      await ready(B);
      await playUntil(B, s.minute + 12); await sleep(1500);
      const c = await B.ev(CHECK);
      checks.push({ night: s.night, ok: c.ok, errors: c.errors.slice(0, 4), agents: c.agents, withXZ: c.withXZ });
      console.log(`  night ${s.night}: ${c.ok ? 'ok' : 'FAIL ' + c.errors.slice(0, 3).join(' | ')} · ${c.agents} rows (${c.withXZ} with x/z)`);
    }
    step('shows', checks.every(c => c.ok), { checked: checks.length, failed: checks.filter(c => !c.ok) });
    // 5 · network
    const badReq = B.requests.filter(r => {
      if (r.url.startsWith('data:') || r.url.startsWith('blob:')) return false;
      if (r.url.startsWith(THREE_CDN) && r.method === 'GET') return false;
      const u = new URL(r.url);
      if (u.origin !== BASE || r.method !== 'GET') return true;
      if (u.pathname.startsWith('/core/')) return u.pathname !== FEED && u.pathname !== FIXTURE;
      return /^\/(state|tape|events|api|__bake)\b/.test(u.pathname) || u.search.includes('since=');
    });
    step('network', badReq.length === 0, { requests: B.requests.length, fromWorkers: B.requests.filter(r => r.from === 'worker').length, bad: badReq.slice(0, 8) });
    // 6 · frames: the record path playing at 60× through a sampled hour vs the same view with no sim
    const measure = () => B.ev(`new Promise(r => { const d = []; let l = null; const t0 = performance.now(); const f = t => { if (l !== null) d.push(t - l); l = t; if (t - t0 < 10000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ n: d.length, p50: +d[Math.floor(d.length * .5)].toFixed(2), p95: +d[Math.floor(d.length * .95)].toFixed(2), max: +d.at(-1).toFixed(2) }); } }; requestAnimationFrame(f); })`);
    const view = 'cam=108,24,-236&look=88,0.6,-262&tod=day&simtod=0';
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordAt=${WINDOWS[0][0]}&recordSpeed=60&${view}` });
    await ready(B); await sleep(5000); const rec = await measure();
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?${view}` });
    for (let t = 0; t < 240 && !(await B.ev('document.title', false).catch(() => '')).startsWith('AI City · live'); t++) await sleep(500);
    await sleep(5000); const none = await measure();
    step('frames', true, { record: rec, noSim: none, bar: 16.8, recordUnderBar: rec.p95 <= 16.8, life: null });
    } else B = await chrome();
    // 7 · the shots
    const seek = async (minute, tod = 'day') => { await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${FEED}&recordPaused=1&tod=${tod}&simtod=0&recordAt=${minute - 0.5}` }); await ready(B); await typeMinute(B, minute); await sleep(1200); };
    // a sit-down at the diner, staged by the planner (the first in the season)
    await seek(2 * DAY + 660);
    const diner = await B.ev(`(() => { const R = window.__record; for (const c of [...R.draw.meetings.values()].sort((a, b) => a.minute - b.minute)) { if (c.venue !== 'diner') continue; const rows = R.draw.routines.at(c.minute); if (rows.find(r => r.agent === c.a)?.meet === c.eventId && rows.find(r => r.agent === c.b)?.meet === c.eventId) return c; } return null; })()`);
    if (diner) {
      await seek(diner.minute + 2); await sleep(5000);
      const a = await agentAt(B, diner.a), b = await agentAt(B, diner.b);
      // (from the side of the line between them, so both faces show)
      if (a && b) { const L = Math.hypot(b.x - a.x, b.z - a.z) || 1, px = -(b.z - a.z) / L, pz = (b.x - a.x) / L, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        // (the side with fewer bystanders between the camera and the pair)
        const crowd = await B.ev(`[1, -1].map(s => [...window.__record.draw.agents.map.values()].filter(o => o.w && ![${JSON.stringify(diner.a)}, ${JSON.stringify(diner.b)}].includes(o.id) && Math.hypot(o.w.p[0] - (${mx} + s * ${px} * 2.5), o.w.p[2] - (${mz} + s * ${pz} * 2.5)) < 2.5).length)`), s = crowd[0] <= crowd[1] ? 1 : -1;
        await aim(B, (a.x + b.x) / 2, (a.z + b.z) / 2, { h: 6.5, back: 5 * pz * s, side: 5 * px * s }); await sleep(4000); }
      const a2 = await agentAt(B, diner.a), b2 = await agentAt(B, diner.b), gap = a2 && b2 ? Math.hypot(a2.x - b2.x, a2.z - b2.z) : null;
      tiles.push({ key: 'diner', file: await shot(B, path.join(OUT, 'sitdown-diner.png')), label: `Day ${Math.floor(diner.minute / DAY)} ${hhmm(diner.minute + 2)} · sit-down at the diner, ${diner.a} (${a2?.talk ?? a2?.clip ?? '-'}) + ${diner.b} (${b2?.talk ?? b2?.clip ?? '-'}), ${gap?.toFixed(1)} m · ${gap !== null && gap <= 3 ? 'PASS' : 'FAIL'}` });
    }
    // a dealer looping on its corner (day 2 11:00): the first dealer seen in deal_pace, else in any loop
    await seek(2 * DAY + 660); await sleep(3000);
    let dealer = null;
    for (let k = 0; k < 30 && !dealer; k++) { dealer = await B.ev(`(() => { const ds = [...window.__record.draw.agents.map.values()].filter(a => a.rec?.loopRole === 'deal' && a.w && a.mode === 'stand' && a.life?.cur?.k === 'loop'); const d = ds.find(a => a.life.cur.clip === 'deal_pace') ?? (${k} > 20 ? ds[0] : null); return d ? { id: d.id, x: d.w.p[0], z: d.w.p[2], clip: d.life.cur.clip, at: d.spot.place } : null; })()`); if (!dealer) await sleep(400); }
    if (dealer) { await aim(B, dealer.x, dealer.z, { h: 5, back: 6.5, side: 2.5 }); await sleep(2500); const d2 = await agentAt(B, dealer.id);
      tiles.push({ key: 'dealer', file: await shot(B, path.join(OUT, 'dealer-loop.png')), label: `Day 2 11:00 · ${dealer.id} dealing on ${dealer.at}: ${d2?.clip ?? '-'} · after PASS` }); }
    // a wired walk: a17 (board walk "wired" from day 12 17:15), the first trip it takes by day after that: its last walking leg, at Live,
    // the camera following it. A wired trip with no walking leg over half a minute (a ride) is passed over for the next one (slime,
    // 10-27: "fix the search"; since 4b53689 staged every meet, a17's first is a scooter ride from a sit-down)
    const trip = await B.ev(`(() => { const R = window.__record; for (let m = 12 * 1440 + 1036; m < 14 * 1440 + 1260; m += 1) { if ((m % 1440) < 360 || (m % 1440) >= 1260) continue; const s = R.draw.stateAt('a17', m); if (s.trip && s.t?.walk === 'wired') { const w = s.trip.legs.filter(l => l.kind === 'walk' && l.arr - l.dep > .5).at(-1); if (w) return { dep: s.trip.dep, mode: s.trip.mode, walk: w.dep + .3 }; } } return null; })()`);
    if (trip) {
      await seek(trip.walk); await click(B, '#record-player button[aria-label="Play or pause"]');
      let seen = 0, file = null;
      for (let k = 0; k < 40; k++) { const p = await agentAt(B, 'a17'); // (from ahead of it, a little to the side: its face and its fists)
        if (p) await aim(B, p.x, p.z, { h: 4.2, back: Math.cos(p.yaw + .5) * 6, side: Math.sin(p.yaw + .5) * 6 });
        const g = await B.ev(`window.__record.draw.agents.map.get('a17')?.w?.g?.clip?.name ?? null`, false); if (g === 'wired_walk' && p?.mode === 'leg') seen++;
        if (seen >= 12) { file = await shot(B, path.join(OUT, 'wired-walk.png')); break; } await sleep(100); }
      await click(B, '#record-player button[aria-label="Play or pause"]');
      tiles.push({ key: 'wired', file: file ?? await shot(B, path.join(OUT, 'wired-walk.png')), label: `Day ${Math.floor(trip.dep / DAY)} ${hhmm(trip.walk)} · a17 wired (board walk), on foot after the ${trip.mode}: ${file ? 'wired_walk playing' : 'no wired_walk seen'} · ${file ? 'PASS' : 'FAIL'}` });
      result.wired = { trip, seen };
    }
    step('shots', tiles.length >= 4 && tiles.every(t => !t.label.endsWith('FAIL')), { tiles: tiles.map(t => t.label) });
  } catch (e) { result.error = String(e.message || e); if (!e.step) console.log('FAIL ' + result.error + (e.stack ? '\n' + e.stack.split('\n').slice(1, 4).join('\n') : '')); }
  finally {
    result.pageErrors = B?.errors.slice(0, 5) ?? [];
    const sheets = [];
    for (let k = 0; k < tiles.length; k += 4) {
      const sheet = path.join(OUT, `sheet-${k / 4 + 1}.jpg`), py = spawnSync('python3', ['-c', SHEET_PY, sheet, JSON.stringify(tiles.slice(k, k + 4))], { encoding: 'utf8' });
      if (py.status) console.log('sheet: ' + py.stderr); else sheets.push(sheet);
    }
    result.sheets = sheets; result.tiles = tiles;
    await fs.writeFile(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));
    await B0?.close(); await B?.close(); head?.srv.close(); server?.kill();
    const ok = !result.error && result.steps.length >= 8 && result.steps.every(s => s.ok);
    console.log(`${ok ? 'ROUTINESCENARIO PASS' : 'ROUTINESCENARIO FAIL'} · ${path.relative(ROOT, OUT)}/result.json · sheets ${sheets.map(s => path.relative(ROOT, s)).join(', ')}`);
    process.exitCode = ok ? 0 : 1;
  }
}
const hhmm = m => { const x = ((Math.floor(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const SHEET_PY = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
out, tiles = sys.argv[1], json.loads(sys.argv[2])
tw, th, pad, bar = 960, 600, 12, 44
cols = 2 if len(tiles) > 1 else 1; rows = (len(tiles) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * (th + bar) + (rows + 1) * pad), (18, 20, 26))
try: F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
except Exception: F = ImageFont.load_default()
for i, t in enumerate(tiles):
    im = Image.open(t['file']).convert('RGB'); im.thumbnail((tw, th)); x = pad + (i % cols) * (tw + pad); y = pad + (i // cols) * (th + bar + pad)
    S.paste(im, (x, y + bar)); d = ImageDraw.Draw(S); ok = t['label'].endswith('PASS')
    d.rectangle([x, y, x + tw, y + bar - 4], fill=(30, 90, 50) if ok else (120, 30, 30)); d.text((x + 10, y + 11), t['label'], fill=(255, 255, 255), font=F)
S.save(out, quality=88)
`;
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
