// C2 · EVERY ERRAND IS WATCHABLE (GAME.md §41; slime 10-30: "every action the agent preforms ... needs to be watchable", "Watch the
// action live, details a day late"; 10-31: "Who and where show"). Headless Chrome on ?sim=record, against the routine planner's acts read
// in node (routines.js planner.day(n).acts: the fact owner for where and when). For every act of one sampled day of the seed:
//   staged        at three minutes inside it (just after its start, its middle, just before its minimum ends) the page's acts report
//                 it (scenes.acts.state()) and each of its walkers plays one of its set's clips (stage/acts.js clipsOf)
//   at place      each participant is drawn at the cue's place (draw.drawn(): its cityPlace or lot), standing
//   participants  the figures are exactly the cue's participants: a hand-over's pair both there and within 1.6 m of each other after
//                 the pass; a remote counterpart (a call, a fence, a stash, a bribe) never a second figure
//   minimum       staged at all three minutes, the last one 0.02 island minutes before cue.minute + cue.minimum
//   live details  0: every tag names only who (an agent's name or P9, the Fence, a lookout, crew, earpiece), no digit, no $; every prop on
//                 an act's walker is neutral (phone, the plain parcel, the dose's packet, the stash's parcel), never the envelope's bills
//   seek = play   for the first act of each kind: played into it at 10x from 0.3 island minutes before and paused, then sought away and
//                 back to that very minute: the same figures, the same clips, each within 0.05 m, the same tag
//   node style/city/tools/actcheck.mjs --port 5960 [--seed 404] [--day N] [--out dir]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PORT, arg, sleep, chrome, ready, serve, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-acts/actcheck')));
const load = name => import(pathToFileURL(path.join(ROOT, 'style/city', name)).href);
const [{ parseFeed }, { createRoutinePlanner }] = await Promise.all([load('simstate/record/adapter.js'), load('simstate/record/routines.js')]);
// (the drawing's own table of clips per set, when this checkout has one: on a checkout without it nothing can be staged)
const ACTS = await load('stage/acts.js').catch(() => null);
const frames = parseFeed(fs.readFileSync(path.join(ROOT, `core/runs/${SEED}-A/feed.jsonl`), 'utf8'));
const routines = createRoutinePlanner(frames), days = [...new Set(frames.map(f => f.day))];
const byDay = new Map(days.map(d => [d, routines.day(d).acts.filter(c => !c.blocked)]));
// the sampled day: --day, else the one with the most kinds (ties: the most acts, then the earliest)
const DAY = arg('day', null) !== null ? +arg('day') : [...byDay].sort((a, b) => new Set(b[1].map(c => c.kind)).size - new Set(a[1].map(c => c.kind)).size || b[1].length - a[1].length || a[0] - b[0])[0][0];
const cues = byDay.get(DAY) ?? [];
const names = new Map(frames[0].board.agents.map(a => [a.id, a.name ?? a.id]));
const LABELS = new Set([...names.values(), 'P9', 'the Fence', 'a lookout', 'crew', 'earpiece']);
const NEUTRAL = new Set([null, 'phone', 'act-parcel', 'packet']);
const clean = t => t.replace(/^[^\p{L}]+/u, '').trim();
// (a tag is a detail unless it is exactly one of those names: no digit, no $, no item can pass)
const detailIn = tag => tag !== null && !LABELS.has(clean(tag));

const server = await serve(), B = await chrome();
const result = { seed: SEED, day: DAY, acts: cues.length, kinds: {}, rows: [], seek: [], frame: null };
try {
  await B.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=day&recordPaused=1` });
  await sleep(400); await ready(B);
  const read = () => B.ev(`(() => { const r = window.__record, d = r.draw, acts = d.scenes?.acts ?? null; return { minute: r.player.minute, state: acts ? acts.state() : null,
    drawn: d.drawn(), list: [...d.agents.map.values()].map(a => ({ id: a.id, mode: a.mode, step: !!a.step, x: a.w ? +a.w.p[0].toFixed(3) : null, z: a.w ? +a.w.p[2].toFixed(3) : null, clip: a.w?.mv?.clip ?? null })) }; })()`);
  const seekTo = async m => { await B.ev(`(() => { const p = window.__record.player; p.pause(); p.seek(${m}); return true; })()`); await sleep(900); return read(); };
  const k = (kind, key) => { const K = result.kinds[kind] ??= { acts: 0, staged: 0, atPlace: 0, participants: 0, minimum: 0, details: 0, seekPlay: null }; if (key) K[key]++; return K; };
  for (const cue of cues) {
    const K = k(cue.kind); K.acts++;
    const set = ACTS?.setOf?.(cue.kind) ?? null, row = { eventId: cue.eventId, kind: cue.kind, agent: cue.agent, participants: cue.participants, place: cue.place.cityPlace, minute: +cue.minute.toFixed(3), minimum: cue.minimum, samples: [] };
    let staged = 0, there = 0, present = 0, details = 0;
    const span = cue.minimum, at = [cue.minute + .15, cue.minute + span / 2, cue.minute + span - .02];
    for (const m of at) {
      const s = await seekTo(m), st = s.state?.find(x => x.eventId === cue.eventId) ?? null, figs = st?.figures ?? [];
      const playing = figs.length > 0 && figs.every(f => !!ACTS && ACTS.clipsOf(set, f.role === 'partner').includes(f.clip));
      const want = [...cue.participants].sort(), got = figs.map(f => f.id).sort();
      const isStaged = !!st && playing && JSON.stringify(want) === JSON.stringify(got);
      const drawn = new Map(s.drawn.map(r => [r.agent, r])), walkers = new Map(s.list.map(a => [a.id, a]));
      const atPlace = cue.participants.every(id => { const r = drawn.get(id); return r && !r.trip && (r.cityPlace === cue.place.cityPlace || r.cityPlace === cue.place.standPlace || (r.lot && cue.place.lot && r.lot === cue.place.lot)) && walkers.get(id)?.mode === 'stand'; });
      let together = cue.participants.length === 1 ? figs.length <= 1 : (() => { const [a, b] = cue.participants.map(id => walkers.get(id)); return !!(a?.x !== null && b?.x !== null && Math.hypot(a.x - b.x, a.z - b.z) <= 1.6); })();
      // (the pair walks up to its marks over the first PASS_AT island seconds: closeness counts from the middle on)
      if (cue.participants.length > 1 && m === at[0]) together = true;
      const bad = (st?.tag !== undefined && detailIn(st?.tag ?? null) ? 1 : 0) + figs.filter(f => !NEUTRAL.has(f.prop)).length;
      if (isStaged) staged++; if (atPlace) there++; if (together && (isStaged || cue.participants.length === 1)) present++; details += bad;
      row.samples.push({ m: +m.toFixed(3), staged: isStaged, atPlace, together, tag: st?.tag ?? null, figures: figs.map(f => ({ id: f.id, role: f.role, clip: f.clip, prop: f.prop })), details: bad });
    }
    row.staged = staged === at.length; row.atPlace = there === at.length; row.participants = present === at.length; row.minimum = row.staged; row.details = details;
    if (row.staged) K.staged++; if (row.atPlace) K.atPlace++; if (row.participants) K.participants++; if (row.minimum) K.minimum++; K.details += details;
    result.rows.push(row);
    console.log(`${row.staged && row.atPlace && row.participants && !details ? 'ok  ' : 'BAD '} ${cue.kind.padEnd(12)} e${cue.eventId} ${cue.agent} [${cue.participants.join(',')}] ${cue.place.cityPlace} ${cue.minute.toFixed(2)}+${cue.minimum}: staged ${staged}/3 place ${there}/3 present ${present}/3 details ${details}`);
  }
  // seek = play: the first act of each kind, played into at 10x and paused, then sought back to that minute
  const firsts = [...new Map([...cues].reverse().map(c => [c.kind, c])).values()].reverse();
  for (const cue of firsts) {
    await seekTo(cue.minute - .3);
    const target = cue.minute + Math.min(.6, cue.minimum / 2);
    await B.ev(`(() => { const p = window.__record.player; p.setSpeed(10); p.play(); return true; })()`);
    for (let t = 0; t < 200; t++) { const m = await B.ev('window.__record.player.minute'); if (m >= target) break; await sleep(40); }
    await B.ev('window.__record.player.pause()'); await sleep(300);
    const played = await read();
    const back = await seekTo(cue.minute - 30), sought = await seekTo(played.minute);
    const pick = s => { const st = s.state?.find(x => x.eventId === cue.eventId) ?? null; return { tag: st?.tag ?? null, figs: (st?.figures ?? []).map(f => ({ id: f.id, clip: f.clip, x: f.x, z: f.z, dx: f.mark ? +(f.x - f.mark[0]).toFixed(3) : null, dz: f.mark ? +(f.z - f.mark[1]).toFixed(3) : null })).sort((a, b) => a.id < b.id ? -1 : 1) }; };
    const P = pick(played), S = pick(sought);
    const same = P.figs.length > 0 && P.tag === S.tag && P.figs.length === S.figs.length && P.figs.every((f, i) => f.id === S.figs[i].id && f.clip === S.figs[i].clip && Math.hypot(f.dx - S.figs[i].dx, f.dz - S.figs[i].dz) <= .05);
    // (where the spot itself fell: agents.js's claim, the class seekscenario's hours step measures on trunk; reported, not this check's)
    const spotMoved = P.figs.filter((f, i) => S.figs[i] && Math.hypot(f.x - S.figs[i].x, f.z - S.figs[i].z) > .05).map(f => f.id);
    k(cue.kind).seekPlay = same; result.seek.push({ kind: cue.kind, eventId: cue.eventId, minute: played.minute, played: P, sought: S, same, spotMoved, away: back.minute });
    console.log(`${same ? 'ok  ' : 'BAD '} seek=play ${cue.kind} e${cue.eventId} at ${played.minute.toFixed(3)}${spotMoved.length ? ' (spot claimed elsewhere: ' + spotMoved.join(',') + ')' : ''}: played ${JSON.stringify(P)} sought ${JSON.stringify(S)}`);
  }
  await B.ev('window.__record.player.setSpeed(1)');
} finally { await B.close(); server?.kill?.(); }
console.log(`\nseed ${SEED} day ${DAY}: ${cues.length} acts`);
console.log('kind          acts staged atPlace participants minimum details seek=play');
for (const [kind, K] of Object.entries(result.kinds)) console.log(`${kind.padEnd(13)} ${String(K.acts).padStart(4)} ${String(K.staged).padStart(6)} ${String(K.atPlace).padStart(7)} ${String(K.participants).padStart(12)} ${String(K.minimum).padStart(7)} ${String(K.details).padStart(7)} ${K.seekPlay === null ? '-' : K.seekPlay ? 'same' : 'DIFF'}`);
const ok = cues.length > 0 && Object.values(result.kinds).every(K => K.staged === K.acts && K.atPlace === K.acts && K.participants === K.acts && K.minimum === K.acts && K.details === 0 && K.seekPlay !== false);
const file = await writeResult(OUT, result);
console.log(`ACTCHECK ${ok ? 'PASS' : 'FAIL'} · ${path.relative(ROOT, file)}`);
process.exitCode = ok ? 0 : 1;
