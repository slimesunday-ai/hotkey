// C2-indoors2 · THE RECORD'S HOMES SHOW NOTHING AHEAD OF ITS PUBLICATION (GAME.md §19, slime 10-30: "Watch the action live, details
// a day late"; the 10-31 review of C2-indoors). Headless Chrome on ?sim=record, seed --seed. It reads the page's own drawing and the
// record's own receipts (panel-data.js tapeAt, as the card's Pockets), and judges the rooms by the home catalogue, never by fill.js:
//   rewind   per agent with a holdings receipt that changes what its room shows: its room opened at home after the receipt (the camera
//            over its house, nobody followed, as a viewer leaves it), then a seek back to a minute at home before it. On the landing
//            frame and the 12 after, the room on screen must be filled from the receipt presented at that minute (stale = 0) and show
//            nothing that receipt doesn't list (leak = 0). Then the same with the room's build in flight when the seek lands (its cache
//            emptied, a sync started and the seek on the same tick): no room built for the later minute may ever show
//   future   at minutes a little before agents leave home (their next departure is in a frame not yet published), the same page with
//            every later frame removed from its feed (a copy of the feed, cut at the minute, and one frame that changes nothing at the
//            minute itself so the playhead can stand there, in both feeds) must draw the same indoor picture: per agent, inside or not,
//            where (to the mm), walking or not, its clip, its door. Mismatches = 0
//   kinds    every agent's every disclosed receipt in the season, filled into its own room's layout by the page: each piece shown is
//            covered kind by kind (cash for the stash open and the pieces that show money: cash, a counterfeit press, framed dye-pack bills; baggies only for a drug the receipt names, in that drug's
//            colour, the catalogue's vnames; a scale or tray for a dose; guns for a gun rack; pieces for collectibles and trophies),
//            and a few made-up receipts ({parts: 1}, {chems: 2}, {temp: 1}, {hallu: 2, sudo: 1}, {doses: 1}, {guns: 1}) the same
//   cost     with a room open late in the season (thousands of events): the record homes' own work per frame (its onFrame: the room
//            checks, the holdings read), median and max ms over 240 frames paused and 240 playing at 1x; and one fresh read (a new
//            snapshot, tapeAt) timed 50 times, as the review timed it
//   node style/city/tools/indoorleakcheck.mjs --port 5973 [--seed 404] [--root <checkout>] [--only rewind,future,kinds,cost] [--out f.json]
// Exit 1 on any failure (cost is reported, never judged). It serves the checkout (style/serve.mjs) unless the port answers.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chrome } from './recordscenario.mjs';

const HERE = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5973), SEED = +arg('seed', 404), ROOT = path.resolve(arg('root', HERE)), OUT = arg('out', null);
const ONLY = new Set((arg('only', 'rewind,future,kinds,cost')).split(',')), BASE = `http://127.0.0.1:${PORT}`, RUN = `${SEED}-A`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const revealAt = f => f.step.kind === 'night' ? Math.max(f.minute, f.day * 1440 + 1265) : f.minute;

async function answers() { try { return (await fetch(BASE + '/style/city/index.html', { method: 'HEAD' })).ok; } catch { return false; } }
async function serve() { if (await answers()) return null; const c = spawn(process.execPath, [path.join(ROOT, 'style/serve.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let k = 0; k < 80 && !(await answers()); k++) await sleep(100); return c; }
async function open(B, feed, at) {
  await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=${feed}&tod=day&simtod=0&recordAt=${at}&recordPaused=1` });
  for (let t = 0; t < 300; t++) { if (B.errors.length) throw new Error('page error: ' + B.errors[0]); if (await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1 && window.__city.recordHomes)`, false).catch(() => false)) break; await sleep(400); }
  await B.ev(LIB); await sleep(1200);
}
// ── in the page: frames, the receipt presented now, a room's fills on screen, and the catalogue's judgement of a fill against a receipt
const LIB = `window.__lk = (() => { const D = window.__record.draw, C = window.__city, P = window.__record.player, RH = C.recordHomes, I = D.indoors;
  const frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  let HO = null, PD = null, F = null; const mods = async () => { HO ??= await import('/style/city/interiors/home/index.js'); PD ??= await import('/style/city/simstate/record/panel-data.js'); F ??= await import('/style/city/interiors/city/fill.js'); };
  const receipt = id => { try { return PD.tapeAt(P.snapshot(), id, P.minute).holdings ?? null; } catch { return null; } };
  // (the room on screen: the built room whose group is in the scene)
  const shown = () => { for (const e of RH.H.cache.values()) if (e.g.parent && e.g.visible) return e; return null; };
  // (one piece against a receipt, by the catalogue: what it shows and whether the receipt lists it)
  function judge(fills, r, f) { const n = k => r ? +(r.goods?.[k] ?? 0) || 0 : 0, cash = r ? +(r.cash ?? 0) : 0, drugs = ['temp', 'hallu', 'sudo', 'truth', 'clear', 'firewall', 'doses'];
    let pieces = r ? (r.pieces?.length ?? 0) : 0; const bad = [];
    for (const x of fills) { if (!x) continue; const o = HO.byId.get(x.id); if (!o) continue; const tags = o.tags ?? [], kind = o.game?.kind ?? null;
      if (o.cat === 'stash') { if (x.state === 'open' && !(cash > 0)) bad.push(o.id + ' open, no cash'); continue; }
      if (o.sim) continue;
      if (tags.includes('cash') || tags.includes('counterfeit') || tags.includes('bank')) { if (!(cash > 0)) bad.push(o.id + ', no cash'); continue; }
      if (tags.includes('baggies')) { const drug = (o.vnames?.[x.variant] ?? '').split(' ')[0].toLowerCase(); if (!(n(drug) > 0)) bad.push(o.id + ' ' + (o.vnames?.[x.variant] ?? x.variant) + ', no ' + drug); continue; }
      if (tags.includes('scale') || tags.includes('tray') || tags.includes('product')) { if (!drugs.some(k => n(k) > 0)) bad.push(o.id + ', no dose'); continue; }
      if (tags.includes('guns')) { if (!(n('guns') > 0)) bad.push(o.id + ', no guns'); continue; }
      if (kind === 'collectible' || kind === 'trophy') { if (pieces-- <= 0) bad.push(o.id + ', past the pieces'); } }
    return bad; }
  return { D, C, P, RH, I, frames, mods, receipt, shown, judge, get HO() { return HO; }, get F() { return F; } }; })(); true`;

async function rewind(B, report) {
  const R = report.rewind = { cases: 0, frames: 0, stale: 0, leak: 0, inflight: { cases: 0, frames: 0, stale: 0, leak: 0 }, bad: [] };
  // the cases: a receipt that changes the room's fills, the agent at home after it and at home before it
  const cases = await B.ev(`(async () => { const L = window.__lk; await L.mods(); const { D, P, I } = L, out = [], snap0 = P.snapshot(); P.seek(P.bounds.to); const all = P.snapshot();
    const HOME = 'home:', home = (id, m) => { const s = D.stateAt(id, m), b = D.book[id]; return !!(s && !s.hidden && !s.trip && !s.ride && !s.jail && b && s.place === HOME + b.home && !D.playAt?.(id, m) && !I.inSceneAt(id, m)); };
    const settled = (id, m) => home(id, m) && home(id, m - 1) && home(id, m + 1) && D.stateAt(id, m - 1).seed === D.stateAt(id, m + 1).seed;
    for (const id of Object.keys(D.book).sort()) { const p = I.planOf(id); if (!p) continue;
      const rec = (all.events || []).filter(e => e.type === 'holdings' && e.agent === id).sort((a, b) => a.minute - b.minute);
      for (let k = 0; k < rec.length; k++) { const e = rec[k], prev = rec[k - 1] ?? null, fl = r => JSON.stringify(L.F.recordFills(p.A, r ? { fields: r } : null));
        if (fl(e) === fl(prev)) continue;
        let a = null; for (let m = e.minute + 1; m < e.minute + 1440; m += 7) if (settled(id, m)) { a = m; break; } if (a === null) continue;
        let b = null; for (let m = e.minute - 1; m > (prev?.minute ?? 1800); m -= 7) if (settled(id, m)) { b = m; break; } if (b === null) continue;
        out.push({ id, lot: p.lot, cx: p.h.cx, cz: p.h.cz, receipt: e.id, D: e.minute, after: a, before: b }); break; } }
    P.seek(snap0.minute); return out; })()`, true, 120000);
  report.rewind.list = cases;
  const check = `(L, c, out) => { const e = L.shown(), r = L.receipt(c.id), p = L.I.planOf(c.id); out.frames++; if (!e || L.RH.H.current?.id !== c.lot) return;
    const want = JSON.stringify(L.F.recordFills(p.A, r)), got = JSON.stringify(e.fills), bad = L.judge(e.fills, r?.fields ?? null);
    if (want !== got) { out.stale++; out.bad.push(c.id + ' @' + L.P.minute.toFixed(2) + ' frame ' + out.k + ': stale fills (receipt ' + (r?.id ?? 'none') + ')'); }
    if (bad.length) { out.leak++; out.bad.push(c.id + ' @' + L.P.minute.toFixed(2) + ' frame ' + out.k + ': ' + bad.join('; ')); } }`;
  for (const c of cases) {
    // the room opened after the receipt, then the seek back
    const o = await B.ev(`(async () => { const L = window.__lk, c = ${JSON.stringify(c)}, out = { frames: 0, stale: 0, leak: 0, bad: [], k: 0, opened: false }, chk = ${check};
      L.P.pause(); L.P.seek(c.after); await L.frames(8);
      for (let k = 0; k < 120 && L.RH.H.current?.id !== c.lot; k++) { L.C.controls.target.set(c.cx, .8, c.cz); L.C.controls.update?.(); await L.frames(1); } out.opened = L.RH.H.current?.id === c.lot; if (!out.opened) return out;
      await L.frames(8); L.P.seek(c.before);
      for (out.k = 0; out.k < 13; out.k++) { await L.frames(1); chk(L, c, out); } return out; })()`);
    // the build in flight when the seek lands
    const q = await B.ev(`(async () => { const L = window.__lk, c = ${JSON.stringify(c)}, out = { frames: 0, stale: 0, leak: 0, bad: [], k: 0, opened: false }, chk = ${check};
      L.P.pause(); L.P.seek(c.after); await L.frames(8);
      for (let k = 0; k < 120 && L.RH.H.current?.id !== c.lot; k++) { L.C.controls.target.set(c.cx, .8, c.cz); L.C.controls.update?.(); await L.frames(1); } out.opened = L.RH.H.current?.id === c.lot; if (!out.opened) return out;
      L.RH.H.close({ instant: true }); for (const e of L.RH.H.cache.values()) e.g.removeFromParent(); L.RH.H.cache.clear();
      L.RH.sync(); L.P.seek(c.before);
      for (out.k = 0; out.k < 13; out.k++) { await L.frames(1); chk(L, c, out); } return out; })()`);
    if (!o.opened) { R.bad.push(c.id + ': its room never opened at ' + c.after); continue; }
    R.cases++; R.frames += o.frames; R.stale += o.stale; R.leak += o.leak; R.bad.push(...o.bad.slice(0, 3));
    if (q.opened) { R.inflight.cases++; R.inflight.frames += q.frames; R.inflight.stale += q.stale; R.inflight.leak += q.leak; R.bad.push(...q.bad.slice(0, 2).map(s => 'in flight: ' + s)); }
    console.log(`rewind ${c.id} receipt ${c.receipt} (minute ${c.D}): open at ${c.after}, seek to ${c.before}: stale ${o.stale}, leak ${o.leak} · in flight: stale ${q.stale}, leak ${q.leak}`);
  }
  return !R.cases ? 'no cases' : R.stale + R.leak + R.inflight.stale + R.inflight.leak === 0;
}

async function future(B, report) {
  const feedPath = path.join(ROOT, 'core/runs', RUN, 'feed.jsonl'), frames = (await fs.readFile(feedPath, 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  // the minutes: 3 island s before a minute 2 or more agents leave home (six of them, spread over the season; the last frame kept
  // not a night's)
  await open(B, `/core/runs/${RUN}/feed.jsonl`, 1800);
  const leaving = await B.ev(`(() => { const D = window.__lk.D, out = {}; for (const id of Object.keys(D.book)) { const L = D.timeline.segs.get(id) || [];
    for (let i = 1; i < L.length; i++) { const d = D.rule.at(id, i); if (d?.trip && d.from === 'home:' + D.book[id].home && L[i].start > 1800) (out[L[i].start] ||= []).push(id); } } return out; })()`);
  const ms = Object.entries(leaving).filter(([m, ids]) => ids.length >= 2).map(([m]) => +m).sort((a, b) => a - b);
  const pick = ms.filter((m, k) => k % Math.max(1, Math.floor(ms.length / 6)) === 0).slice(0, 6), R = report.future = { minutes: [], compared: 0, mismatches: 0, bad: [] };
  for (const M of pick) {
    const m = M - .05, keep = frames.filter(f => revealAt(f) <= m), last = keep.at(-1); if (last.step.kind === 'night') continue;
    // (one frame that changes nothing at m: no events, no board, the last frame's sightings and counters; in both feeds)
    const still = { ...last, board: undefined, events: [], minute: m };
    const cut = [...keep, still], full = [...keep, still, ...frames.slice(keep.length)];
    const renum = L => L.map((f, i) => JSON.stringify({ ...f, i }));
    const dir = path.join(ROOT, 'core/runs', `${RUN}-leak`); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `cut-${M}.jsonl`), renum(cut).join('\n') + '\n'); await fs.writeFile(path.join(dir, `full-${M}.jsonl`), renum(full).join('\n') + '\n');
    const pic = async feed => { await open(B, `/core/runs/${RUN}-leak/${feed}`, m - 2); return B.ev(`(async () => { const L = window.__lk; L.P.seek(${m}); await L.frames(10); await new Promise(r => setTimeout(r, 200)); await L.frames(4);
      const out = {}; for (const id of Object.keys(L.D.book).sort()) { const P = L.I.inside.get(id); out[id] = P ? [+P.x.toFixed(3), +P.z.toFixed(3), P.v > 0, P.clip ?? null, +(P.door ?? 0).toFixed(2), !!P.inside] : null; } return [L.P.minute, out]; })()`); };
    const [ma, A] = await pic(`full-${M}.jsonl`), [mb, Bp] = await pic(`cut-${M}.jsonl`);
    let bad = 0; for (const id of Object.keys(A)) { R.compared++; if (JSON.stringify(A[id]) !== JSON.stringify(Bp[id])) { bad++; if (R.bad.length < 12) R.bad.push(`@${m} ${id}: with later frames ${JSON.stringify(A[id])}, without ${JSON.stringify(Bp[id])}`); } }
    R.mismatches += bad; R.minutes.push({ m, leaving: leaving[M].length, playhead: [ma, mb], mismatches: bad });
    console.log(`future @${m} (${leaving[M].length} leave home at ${M}): playhead ${ma.toFixed(3)} / ${mb.toFixed(3)} · indoor picture mismatches ${bad}`);
  }
  return R.minutes.length ? R.mismatches === 0 : 'no minutes';
}

async function kinds(B, report) {
  await open(B, `/core/runs/${RUN}/feed.jsonl`, 1800);
  const r = await B.ev(`(async () => { const L = window.__lk; await L.mods(); const { D, P, I } = L, m0 = P.minute; P.seek(P.bounds.to); const all = P.snapshot(), out = { receipts: 0, shown: 0, bad: [], made: [] };
    for (const id of Object.keys(D.book).sort()) { const p = I.planOf(id); if (!p) continue;
      for (const e of (all.events || []).filter(e => e.type === 'holdings' && e.agent === id)) { out.receipts++; const f = L.F.recordFills(p.A, { fields: e }); out.shown += f.filter(Boolean).length; for (const b of L.judge(f, e)) out.bad.push(id + ' receipt ' + e.id + ' (' + JSON.stringify(e.goods) + ', cash ' + e.cash + '): ' + b); } }
    const made = [{ parts: 1 }, { chems: 2 }, { temp: 1 }, { hallu: 2, sudo: 1 }, { truth: 1 }, { doses: 1 }, { guns: 1 }, { lockpicks: 2, warrants: 1 }];
    for (const name of new Set([...I.plans.values()].map(p => p.name))) { const p = [...I.plans.values()].find(q => q.name === name);
      for (const g of made) { const rr = { cash: 0, pieces: [], goods: g }, f = L.F.recordFills(p.A, { fields: rr }); for (const b of L.judge(f, rr)) out.made.push(name + ' ' + JSON.stringify(g) + ': ' + b); } }
    P.seek(m0); return out; })()`, true, 120000);
  report.kinds = { receipts: r.receipts, shown: r.shown, undisclosed: r.bad.length, made: r.made.length, bad: [...r.bad.slice(0, 8), ...r.made.slice(0, 8)] };
  console.log(`kinds: ${r.receipts} receipts, ${r.shown} pieces shown, ${r.bad.length} not covered by their receipt kind by kind · made-up receipts: ${r.made.length} not covered`);
  return r.bad.length + r.made.length === 0;
}

async function cost(B, report) {
  await open(B, `/core/runs/${RUN}/feed.jsonl`, 1800);
  const r = await B.ev(`(async () => { const L = window.__lk, { D, I, P } = L; P.pause(); let c = null;
    for (const m of [14 * 1440 + 600, 13 * 1440 + 720, 12 * 1440 + 720, 2 * 1440 + 720]) { P.seek(m); await L.frames(8); for (const id of [...I.inside.keys()].sort()) { const p = I.planOf(id); if (p) { c = { id, m, cx: p.h.cx, cz: p.h.cz, lot: p.lot }; break; } } if (c) break; }
    if (!c) return null; L.C.controls.target.set(c.cx, .8, c.cz); L.C.controls.update?.(); for (let k = 0; k < 120 && L.RH.H.current?.id !== c.lot; k++) await L.frames(1);
    const f = I.onFrame, t = []; I.onFrame = m => { const t0 = performance.now(); f(m); t.push(performance.now() - t0); };
    await L.frames(240); const paused = t.splice(0); P.setSpeed(1); P.play(); await L.frames(240); P.pause(); const playing = t.splice(0); I.onFrame = f;
    const q = a => { const s = a.slice().sort((x, y) => x - y); return { n: s.length, median: +s[s.length >> 1].toFixed(3), max: +s.at(-1).toFixed(3), mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(3) }; };
    // (and one fresh read as the review timed it: a new snapshot, tapeAt for the room's agent, 50 times)
    await L.mods(); const one = []; for (let k = 0; k < 50; k++) { const t0 = performance.now(); L.receipt(c.id); one.push(performance.now() - t0); }
    return { room: c, open: L.RH.H.current?.id === c.lot, events: (P.snapshot().events || []).length, paused: q(paused), playing: q(playing), freshRead: q(one), reads: L.RH.stats.reads ?? null }; })()`, true, 120000);
  report.cost = r; console.log('cost', JSON.stringify(r));
  return true;
}

async function main() {
  const served = await serve(), B = await chrome(), report = { seed: SEED, root: ROOT }, verdict = {};
  try {
    if (ONLY.has('rewind')) { await open(B, `/core/runs/${RUN}/feed.jsonl`, 1800); verdict.rewind = await rewind(B, report); }
    if (ONLY.has('kinds')) verdict.kinds = await kinds(B, report);
    if (ONLY.has('cost')) verdict.cost = await cost(B, report);
    if (ONLY.has('future')) verdict.future = await future(B, report);
    if (B.errors.length) { report.pageErrors = B.errors.slice(0, 5); verdict.pageErrors = false; }
  } finally { await B.close(); if (served) served.kill(); await fs.rm(path.join(ROOT, 'core/runs', `${RUN}-leak`), { recursive: true, force: true }).catch(() => {}); }
  for (const k of ['rewind', 'future', 'kinds']) for (const b of (report[k]?.bad ?? []).slice(0, 12)) console.log(`  ${k}: ${b}`);
  const pass = Object.values(verdict).every(v => v === true);
  console.log(`INDOORLEAKCHECK seed ${SEED} ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify({ verdict, rewind: report.rewind && { cases: report.rewind.cases, frames: report.rewind.frames, stale: report.rewind.stale, leak: report.rewind.leak, inflight: report.rewind.inflight },
    future: report.future && { minutes: report.future.minutes.length, compared: report.future.compared, mismatches: report.future.mismatches }, kinds: report.kinds && { receipts: report.kinds.receipts, undisclosed: report.kinds.undisclosed, made: report.kinds.made } })}`);
  if (OUT) await fs.writeFile(OUT, JSON.stringify(report, null, 1));
  if (!pass) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
