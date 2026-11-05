// C2-indoors · AN AGENT AT HOME IS INSIDE IT (GAME.md §41, slime 10-30: "if the agent goes into a house, we should watch them enter the
// house, then be inside the house with the agent"; §19 and slime 10-30: "you see them cook or hide something under the floor, but what,
// how much and which drug land on the tape a day later"). Headless Chrome on ?sim=record (no day/night reloads: &simtod=0), per roster
// agent of --seed. What it reads is the page's own drawing and the city's own data, never the indoors code it checks: the house is
// its lot anchor's rect (ANCHORS lots[id].house, its door and face), the stay is the drawing's stateAt, a walker is a pedsim agent.
//   inside    every --every island minutes, sought there: each agent at its own home, settled (the same stay 0.75 min either side, no play
//             of its at home): drawn (its walker), inside its house (within the anchor's rect, behind the front wall), and drawn once
//             (one pedsim walker under its id, and no sleeper baked into an open room). An agent the stage holds in a scene of the show
//             at its home (its lay-low on its step) is the stage's to draw: counted apart, as `staged`
//   doors     per agent, its first stay at home with a trip in: played at 10x through the arrival and through the departure, each frame
//             its walker's place: every crossing of its house's front wall (outside → inside an enter, back an exit) within DOOR_R m of
//             its door (the anchor's door point taken onto the wall), an enter on the way in and an exit on the way out, and no jump off
//             its trip's legs within 10 m of its house (a jump on a trip's legs is the trip's: counted apart) (c2probe's allowance: 2 m, plus 20 m/s on a
//             trip's legs or 3 m/s otherwise, times the frame's island seconds; the first 1.2 island s after the seek that starts the
//             window are the seek's own placing, as c2probe leaves seeks out)
//   seek      at the end of each arrival window, paused, then sought to the very minute: every agent standing at its own home within
//             0.05 m and in the same clip (seekscenario's stand tolerance), a walker anywhere else within 1.5 m
//   fill      at noon of every day, every agent's room opened (the record viewer's homes, interiors/city/record.js): every slot piece that
//             holds something (the catalogue: a stash open, cash, product, a collectible or a trophy) must be covered by the agent's
//             last disclosed holdings receipt at that minute (panel-data.js tapeAt, as the card's Pockets): cash for cash and an open
//             stash, goods for product, at most as many collectibles and trophies as the receipt's pieces. Undisclosed shown = 0
// --plant fill: the fill step also scores the homes runtime's own fills (fill.js fillsFor at the wealth a rich owner has), to show it
//   catches a room that shows holdings nobody disclosed. --root <checkout>: serve and check another checkout (trunk: before/after).
//   node style/city/tools/indoorcheck.mjs --port 5972 [--seed 404] [--every 60] [--ids a01,a02] [--root <dir>] [--plant fill] [--out f.json]
// Exit 1 on any failure. It serves the checkout (style/serve.mjs) unless the port answers, and stops only what it started.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chrome } from './recordscenario.mjs';

const HERE = fileURLToPath(new URL('../../../', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = +arg('port', 5972), SEED = +arg('seed', 404), EVERY = +arg('every', 60), ROOT = path.resolve(arg('root', HERE)), PLANT = arg('plant', null), OUT = arg('out', null);
const IDS = arg('ids', null)?.split(',') ?? null, BASE = `http://127.0.0.1:${PORT}`, DOOR_R = .9, SPEED = 10;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function answers() { try { return (await fetch(BASE + '/style/city/index.html', { method: 'HEAD' })).ok; } catch { return false; } }
async function serve() { if (await answers()) return null; const c = spawn(process.execPath, [path.join(ROOT, 'style/serve.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  for (let k = 0; k < 80 && !(await answers()); k++) await sleep(100); return c; }

// ── in the page: the house of each agent (its lot anchor), whether a point is inside it, its door; the stay and the walkers
const LIB = `window.__ic = (() => { const D = window.__record.draw, C = window.__city, P = window.__record.player, HOME = 'home:';
  const lotOf = id => { const lot = D.book[id]?.home; for (const a of C.ANCHORS.values()) if (a?.lots?.[lot]) return a.lots[lot]; return null; };
  function inside(id, x, z) { const l = lotOf(id); if (!l) return null; const R = l.house; return x > R[0] + .05 && x < R[2] - .05 && z > R[1] + .05 && z < R[3] - .05; }
  // (the door on the house's front wall: the anchor's door point taken onto the rect's edge that faces the street; a porch puts it out)
  function door(id) { const l = lotOf(id); if (!l) return null; const R = l.house, [fx, fz] = l.face;
    return fz > .5 ? [l.door[0], R[3]] : fz < -.5 ? [l.door[0], R[1]] : fx > .5 ? [R[2], l.door[2]] : [R[0], l.door[2]]; }
  const near = (id, x, z) => { const l = lotOf(id); if (!l) return false; const R = l.house; return Math.hypot(x - (R[0] + R[2]) / 2, z - (R[1] + R[3]) / 2) < 10; };
  const at = (id, m) => { const s = D.stateAt(id, m), b = D.book[id]; return s && !s.hidden && !s.trip && !s.ride && !s.jail && b && s.place === HOME + b.home && !D.playAt?.(id, m) ? s : null; };
  function settled(id, m) { const s = at(id, m), a = at(id, m - .75), c = at(id, m + .75); return !!(s && a && c && a.seed === s.seed && c.seed === s.seed); }
  const figures = id => (C.peds?.sim?.agents || []).filter(w => (w.aid ?? w.id) === id && !w.gone).length;
  function sleeper(id) { const RH = C.recordHomes, cur = RH?.H?.current; if (!cur) return 0; const lot = D.book[id]?.home; if (cur.id !== lot) return 0;
    for (const e of RH.H.cache.values()) if (e.key.startsWith(lot + '|') && e.head) return 1; return 0; }
  const frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const staged = id => !!C.peds && !!D.agents.map.get(id)?.held;
  return { D, C, P, lotOf, inside, door, near, at, settled, figures, sleeper, frames, staged }; })(); true`;

async function main() {
  const served = await serve(), B = await chrome(), report = { seed: SEED, root: ROOT, agents: {}, fails: [] };
  const fail = (k, msg) => { report.fails.push(`${k}: ${msg}`); };
  try {
    await B.send('Page.navigate', { url: `${BASE}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=day&simtod=0&recordAt=1800&recordPaused=1` });
    for (let t = 0; t < 300; t++) { if (B.errors.length) throw new Error('page error: ' + B.errors[0]); if (await B.ev(`!!(window.__record?.draw && window.__city && !window.__city.loading && window.__record.clock.pageT > 1)`, false).catch(() => false)) break; await sleep(400); }
    await B.ev(LIB); await sleep(1500);
    const roster = (await B.ev(`Object.keys(window.__ic.D.book).sort()`)).filter(id => !IDS || IDS.includes(id)), end = await B.ev(`window.__ic.P.bounds.to`);
    for (const id of roster) report.agents[id] = { inside: [0, 0], outsideAt: [], twice: 0, enters: [0, 0], exits: [0, 0], jumps: [], seek: [0, 0], seekBad: [], fill: [0, 0], fillBad: [] };
    const indoors = await B.ev(`!!window.__ic.D.indoors`); report.indoorsCode = indoors;
    // ── inside, by seeking
    for (let m = 1800 + 30; m < end; m += EVERY) {
      const rows = await B.ev(`(async () => { const I = window.__ic; I.P.seek(${m}); await I.frames(8); await new Promise(r => setTimeout(r, 120)); await I.frames(4);
        return ${JSON.stringify(roster)}.filter(id => I.settled(id, ${m})).map(id => { const a = I.D.agents.map.get(id), w = a?.w; return [id, w ? [+w.p[0].toFixed(2), +w.p[2].toFixed(2)] : null, w ? I.inside(id, w.p[0], w.p[2]) : false, I.figures(id) + I.sleeper(id), I.staged(id)]; }); })()`);
      // (an agent the stage holds in a scene of the show at its home, its lay-low on its step: the stage's to draw; counted apart)
      for (const [id, p, inn, n, staged] of rows) { const R = report.agents[id]; if (staged) { R.staged = (R.staged ?? 0) + 1; continue; } R.inside[1]++; if (inn) R.inside[0]++; else if (R.outsideAt.length < 4) R.outsideAt.push([m, p]); if (n > 1) R.twice++; }
    }
    // ── doors and seek, by playing each agent's first stay at home with a trip in
    const stays = await B.ev(`(() => { const I = window.__ic, D = I.D, out = {}; for (const id of ${JSON.stringify(roster)}) { const L = D.timeline.segs.get(id) || [];
      for (let i = 0; i < L.length - 1; i++) { const g = L[i], d = D.rule.at(id, i); if (g.start < 1800 || !d?.trip || !I.at(id, d.trip.arr + .3)) continue;
        const nx = D.rule.at(id, i + 1), dep = nx?.dep ?? L[i + 1].start; if (dep - d.trip.arr < .6) continue; out[id] = { arr: d.trip.arr, dep, mode: d.trip.mode }; break; } } return out; })()`);
    for (const id of roster) {
      const S = stays[id], R = report.agents[id]; if (!S) { R.noStay = true; continue; }
      const wins = S.dep - S.arr < 2.6 ? [[S.arr - .2, S.dep + .3, 'both']] : [[S.arr - .2, S.arr + 1.2, 'in'], [S.dep - 1.2, S.dep + .3, 'out']];
      for (const [a, b, kind] of wins) {
        const W = await B.ev(`(async () => { const I = window.__ic, id = ${JSON.stringify(id)}, out = { enters: [], exits: [], jumps: [], tripJumps: [], frames: 0 }; I.P.pause(); I.P.seek(${a}); await I.frames(10); I.P.setSpeed(${SPEED}); I.P.play();
          let last = null, lm = I.P.minute, wasIn = null; const t0 = performance.now();
          await new Promise(res => { const f = () => { const m = I.P.minute; if (m >= ${b} || performance.now() - t0 > 60000) { I.P.pause(); return res(); } const a = I.D.agents.map.get(id), w = a?.w, s = I.D.stateAt(id, m), dm = m - lm; lm = m; out.frames++;
            if (w) { const p = [w.p[0], w.p[2]], inn = I.inside(id, p[0], p[1]);
              // (a jump on the way in or out: off its trip's legs, within 10 m of its house; one on a trip's legs elsewhere is the trip's, counted apart)
              if (last && dm >= 0 && dm < .05 && m - ${a} > .02) { const d = Math.hypot(p[0] - last[0], p[1] - last[1]), leg = a.mode === 'leg' || !!s.trip, allow = 2 + (leg ? 20 : 3) * dm * 60;
                if (d > allow) (!leg && (I.near(id, p[0], p[1]) || I.near(id, last[0], last[1])) ? out.jumps : out.tripJumps).push([+m.toFixed(3), +d.toFixed(2), a.mode]); }
              if (last && wasIn !== null && inn !== wasIn) { const q = I.door(id), ax = last[0], az = last[1], bx = p[0], bz = p[1], L2 = (bx - ax) ** 2 + (bz - az) ** 2, t = L2 ? Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - az) * (bz - az)) / L2)) : 0;
                const dd = Math.hypot(ax + (bx - ax) * t - q[0], az + (bz - az) * t - q[1]); (inn ? out.enters : out.exits).push([+m.toFixed(3), +dd.toFixed(2)]); }
              last = p; wasIn = inn; } else { last = null; }
            requestAnimationFrame(f); }; requestAnimationFrame(f); });
          return out; })()`);
        for (const [m, d] of W.enters) { R.enters[1]++; if (d <= DOOR_R) R.enters[0]++; else fail(id, `entered its house ${d} m from its door at ${m}`); }
        for (const [m, d] of W.exits) { R.exits[1]++; if (d <= DOOR_R) R.exits[0]++; else fail(id, `left its house ${d} m from its door at ${m}`); }
        if (kind !== 'out' && !W.enters.length) fail(id, `no way in through its door on its arrival at ${S.arr.toFixed(2)} (${S.mode})`);
        if (kind !== 'in' && !W.exits.length) fail(id, `no way out through its door on its departure at ${S.dep.toFixed(2)}`);
        R.jumps.push(...W.jumps); R.tripJumps = (R.tripJumps ?? 0) + W.tripJumps.length;
        // seek = play: paused at the window's end, then sought to the same minute
        if (kind !== 'out') {
          const snap = `(() => { const I = window.__ic, out = {}; for (const [id, a] of I.D.agents.map) { const w = a.w; out[id] = w ? [+w.p[0].toFixed(3), +w.p[2].toFixed(3), a.mode, w.mv?.clip ?? null, !!I.at(id, I.P.minute)] : null; } return [I.P.minute, out]; })()`;
          const [m1, played] = await B.ev(snap); await B.ev(`(async () => { const I = window.__ic; I.P.seek(${m1}); await I.frames(10); await new Promise(r => setTimeout(r, 150)); await I.frames(4); return true; })()`);
          const [, sought] = await B.ev(snap);
          for (const k of Object.keys(played)) { const p = played[k], q = sought[k], X = report.agents[k]; if (!X) continue; if (!p && !q) continue;
            X.seek[1]++; let bad = null; if (!p || !q) bad = `drawn ${!!p} played, ${!!q} sought`;
            else { const d = Math.hypot(p[0] - q[0], p[1] - q[1]), home = p[4] && q[4], tol = home && p[2] === 'stand' ? .05 : 1.5; if (d > tol) bad = `${home ? 'at home' : p[2]} ${d.toFixed(2)} m apart`; else if (home && p[3] !== q[3]) bad = `at home: clip ${p[3]} played, ${q[3]} sought`; }
            if (bad) { if (X.seekBad.length < 4) X.seekBad.push(`@${m1.toFixed(3)} ${bad}`); } else X.seek[0]++; }
        }
      }
    }
    // ── fill: every agent's room at noon of each day, against its last disclosed receipt
    const hasHomes = await B.ev(`!!window.__city.recordHomes`); report.rooms = hasHomes;
    if (hasHomes) for (let d = 1; d * 1440 + 720 < end; d++) {
      const m = d * 1440 + 720;
      const rows = await B.ev(`(async () => { const I = window.__ic, RH = I.C.recordHomes, HO = await import('/style/city/interiors/home/index.js'), PD = await import('/style/city/simstate/record/panel-data.js'), F = await import('/style/city/interiors/city/fill.js');
        I.P.seek(${m}); await I.frames(6); const snap = I.P.snapshot(), out = [];
        const score = (fills, r) => { let cash = r ? +(r.cash ?? 0) : 0, goods = r ? Object.values(r.goods ?? {}).reduce((s, n) => s + (+n || 0), 0) : 0, pieces = r ? (r.pieces?.length ?? 0) : 0, shown = 0, bad = [];
          for (const f of fills) { if (!f) continue; const o = HO.byId.get(f.id); if (!o) continue; const tags = o.tags ?? [], kind = o.game?.kind ?? null;
            // (a stash shows what is in it only open: shut, a floorboard, a book, a vent or a shoebox is the same in every home)
            if (o.cat === 'stash' && f.state !== 'open') continue;
            const isCash = o.cat === 'stash' || tags.includes('cash') || /cash|money|duffel|counterfeit|bank/.test(o.id), isGoods = tags.includes('product') || tags.includes('dealer') || /baggies|scale|rolling/.test(o.id), isPiece = !isCash && !isGoods && (kind === 'collectible' || kind === 'trophy');
            if (isCash) { shown++; if (!(cash > 0)) bad.push(o.id + ' (cash, none disclosed)'); }
            else if (isGoods) { shown++; if (!(goods > 0)) bad.push(o.id + ' (goods, none disclosed)'); }
            else if (isPiece) { shown++; if (pieces-- <= 0) bad.push(o.id + ' (a piece, past the disclosed ' + (r?.pieces?.length ?? 0) + ')'); } }
          return { shown, bad }; };
        for (const id of ${JSON.stringify(roster)}) { const p = I.D.indoors?.planOf(id); if (!p) continue; const h = RH.H.index().get(p.lot); if (!h) continue; await RH.H.open(h, { instant: true });
          let e = null; for (const x of RH.H.cache.values()) if (x.key.startsWith(p.lot + '|')) e = x;
          const held = PD.tapeAt(snap, id, ${m}).holdings, r = held?.fields ?? null, s = e ? score(e.fills, r) : null;
          const planted = ${PLANT === 'fill'} ? score(F.fillsFor(p.A, { tier: 'house', wealth: .8, sec: new Set(), seed: 7, show: false }), r) : null;
          out.push([id, !!e, s, planted, held ? held.minute : null]); }
        RH.H.close({ instant: true }); return out; })()`);
      for (const [id, built, s, planted] of rows) { const R = report.agents[id]; if (!built) { fail(id, `room not built at ${m}`); continue; } R.fill[1] += s.shown; R.fill[0] += s.shown - s.bad.length; for (const b of s.bad) if (R.fillBad.length < 4) R.fillBad.push(`@${m} ${b}`);
        if (planted) { report.planted = report.planted ?? { shown: 0, undisclosed: 0 }; report.planted.shown += planted.shown; report.planted.undisclosed += planted.bad.length; } }
    }
    if (B.errors.length) report.pageErrors = B.errors.slice(0, 5);
  } finally { await B.close(); if (served) served.kill(); }
  // ── per agent, and the verdict
  let pass = true; const T = { inside: [0, 0], twice: 0, enters: [0, 0], exits: [0, 0], jumps: 0, seek: [0, 0], fillShown: 0, fillUndisclosed: 0, noStay: 0 };
  for (const [id, R] of Object.entries(report.agents)) {
    const und = R.fillBad.length ? R.fill[1] - R.fill[0] : 0, ok = R.inside[0] === R.inside[1] && R.inside[1] > 0 && !R.twice && R.enters[0] === R.enters[1] && R.exits[0] === R.exits[1] && !R.jumps.length && R.seek[0] === R.seek[1] && und === 0 && !report.fails.some(f => f.startsWith(id + ':'));
    if (!ok) pass = false;
    T.inside[0] += R.inside[0]; T.inside[1] += R.inside[1]; T.twice += R.twice; T.enters[0] += R.enters[0]; T.enters[1] += R.enters[1]; T.exits[0] += R.exits[0]; T.exits[1] += R.exits[1]; T.jumps += R.jumps.length; T.seek[0] += R.seek[0]; T.seek[1] += R.seek[1]; T.fillShown += R.fill[1]; T.fillUndisclosed += R.fill[1] - R.fill[0]; T.noStay += R.noStay ? 1 : 0;
    T.staged = (T.staged ?? 0) + (R.staged ?? 0); T.tripJumps = (T.tripJumps ?? 0) + (R.tripJumps ?? 0);
    console.log(`${id} ${ok ? 'PASS' : 'FAIL'} inside ${R.inside[0]}/${R.inside[1]}${R.staged ? ' (staged ' + R.staged + ')' : ''}${R.outsideAt.length ? ' (outside: ' + R.outsideAt.map(([m, p]) => '@' + m + ' ' + (p ? p.join(',') : 'not drawn')).join('; ') + ')' : ''} · twice ${R.twice} · enters through the door ${R.enters[0]}/${R.enters[1]} · exits ${R.exits[0]}/${R.exits[1]} · jumps ${R.jumps.length}${R.jumps.length ? ' ' + JSON.stringify(R.jumps.slice(0, 3)) : ''} · seek=play ${R.seek[0]}/${R.seek[1]}${R.seekBad.length ? ' ' + R.seekBad.join('; ') : ''} · fill shown ${R.fill[1]}, undisclosed ${R.fill[1] - R.fill[0]}${R.fillBad.length ? ' ' + R.fillBad.join('; ') : ''}${R.noStay ? ' · no stay with a trip in' : ''}`);
  }
  for (const f of report.fails.slice(0, 40)) console.log('  ' + f);
  if (report.planted) console.log(`planted fill (fill.js fillsFor, a rich owner's): shown ${report.planted.shown}, undisclosed ${report.planted.undisclosed} — ${report.planted.undisclosed > 0 ? 'caught' : 'NOT caught'}`);
  if (report.pageErrors) { console.log('page errors', report.pageErrors); pass = false; }
  report.totals = T;
  console.log(`INDOORCHECK seed ${SEED} ${pass ? 'PASS' : 'FAIL'} ${JSON.stringify({ indoorsCode: report.indoorsCode, rooms: report.rooms, ...T })}`);
  if (OUT) await fs.writeFile(OUT, JSON.stringify(report, null, 1));
  if (!pass) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
