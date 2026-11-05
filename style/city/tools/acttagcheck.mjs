// C2 · AN ACT'S COUNTERPART IS THE FOLLOWER'S (GAME.md §41, slime 10-31: "A follower sees the act, who it's with and where, live").
// Headless Chrome on ?sim=record. For each sampled act of one day of the seed whose counterpart is named (a call, a hand-over, the fence,
// the precinct: the first of each kind, and for a hand-over its partner too), sought to the act's middle with the camera framing its
// actor:
//   orbit      nobody followed: no act tag on the page names this act's counterpart (a .rec-act element for the event, shown or not)
//   other      following an agent that is not in the act: the same
//   follower   following the act's agent (a hand-over: each of the pair in turn): its tag is shown, and it names the counterpart
// The follow is the camera rig's own (the card's Follow sets the same mode and subject: ui/record/follow.js).
//   node style/city/tools/acttagcheck.mjs --port 5984 [--seed 404] [--day 11]
// It serves this checkout (style/serve.mjs on --port) unless the port answers, and stops only what it started.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, PORT, arg, sleep, chrome, ready, serve, writeResult } from './c2lib.mjs';

const SEED = +arg('seed', 404), DAY = +arg('day', 11), OUT = path.resolve(arg('out', path.join(ROOT, 'tmp/c2-acts/acttagcheck')));
const load = name => import(pathToFileURL(path.join(ROOT, 'style/city', name)).href);
const [{ parseFeed }, { createRoutinePlanner }] = await Promise.all([load('simstate/record/adapter.js'), load('simstate/record/routines.js')]);
const frames = parseFeed(fs.readFileSync(path.join(ROOT, `core/runs/${SEED}-A/feed.jsonl`), 'utf8')), routines = createRoutinePlanner(frames);
const names = new Map(frames[0].board.agents.map(a => [a.id, a.name ?? a.id]));
// (the counterpart as the live act names it: the label a tag may carry)
const label = cp => !cp ? null : ['agent', 'keeper'].includes(cp.kind) ? names.get(cp.id) : { cops: 'P9', fence: 'the Fence', lookout: 'a lookout', crew: 'crew', earpiece: 'earpiece' }[cp.kind] ?? null;
const named = routines.day(DAY).acts.filter(c => !c.blocked && label(c.counterpart) && !(c.counterpart.kind === 'keeper' && c.counterpart.id === c.agent));
const sample = [...new Map([...named].reverse().map(c => [c.kind, c])).values()].reverse();
const roster = frames[0].board.agents.map(a => a.id);

const server = await serve(), B = await chrome(), rows = [];
let bad = 0;
try {
  await B.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/style/city/index.html?sim=record&feed=/core/runs/${SEED}-A/feed.jsonl&tod=day&recordPaused=1&recordAt=${DAY * 1440 + 600}` });
  await ready(B); await sleep(3000);
  const tags = id => B.ev(`[...document.querySelectorAll('.rec-act')].filter(e => e.dataset.event === ${JSON.stringify(String(id))}).map(e => ({ text: e.textContent, shown: e.style.display !== 'none', ndc: window.__record.draw.scenes.acts.shown?.().find(x => x.eventId === ${JSON.stringify(id)})?.ndc ?? null }))`);
  const orbitOn = id => B.ev(`(() => { const c = window.__city, a = window.__record.draw.agents.map.get(${JSON.stringify(id)}); if (c.cam && c.cam.mode !== 'orbit') c.cam.toOrbit({ instant: true }); if (a?.w) { c.controls.target.set(a.w.p[0], 1, a.w.p[2]); c.camera.position.set(a.w.p[0] + 6, 8, a.w.p[2] + 9); c.controls.update?.(); } return c.cam?.mode ?? null; })()`);
  const follow = id => B.ev(`(() => { const r = window.__city.cam, w = r?.people?.byAid(${JSON.stringify(id)}); if (!w) return null; r.setMode('follow', { subject: w }); return r.mode === 'follow' && r.subject?.aid === ${JSON.stringify(id)}; })()`);
  for (const cue of sample) {
    const m = cue.minute + cue.minimum / 2, want = label(cue.counterpart), pair = cue.participants.length > 1 ? cue.participants : [cue.agent];
    await B.ev(`(() => { const p = window.__record.player; p.pause(); p.seek(${m}); return true; })()`); await sleep(1200);
    await orbitOn(cue.agent); await sleep(700);
    const orbit = await tags(cue.eventId);
    const other = roster.find(id => !cue.participants.includes(id) && id !== cue.counterpart?.id);
    const onOther = await follow(other); await sleep(700);
    const others = await tags(cue.eventId);
    const followers = [];
    for (const id of pair) { const on = await follow(id); await sleep(2000); followers.push({ id, on, tags: await tags(cue.eventId) }); }
    await orbitOn(cue.agent);
    const okOrbit = orbit.length === 0, okOther = !onOther || others.length === 0, okFollow = followers.every(f => f.on && f.tags.some(t => t.shown && t.text.replace(/^[^\p{L}]+/u, '').trim() === want));
    const ok = okOrbit && okOther && okFollow; if (!ok) bad++;
    rows.push({ eventId: cue.eventId, kind: cue.kind, agent: cue.agent, participants: cue.participants, counterpart: want, minute: +m.toFixed(3), orbit, other: { id: other, on: onOther, tags: others }, followers, ok });
    console.log(`${ok ? 'ok  ' : 'BAD '} ${cue.kind.padEnd(11)} e${cue.eventId} ${cue.agent}${pair.length > 1 ? '+' + pair.filter(p => p !== cue.agent).join(',') : ''} -> ${want} · orbit ${JSON.stringify(orbit.map(t => t.text))} · following ${other} ${JSON.stringify(others.map(t => t.text))} · ${followers.map(f => `following ${f.id} ${JSON.stringify(f.tags.filter(t => t.shown).map(t => t.text))}`).join(' · ')}`);
  }
} finally { await B.close(); server?.kill?.(); }
const file = await writeResult(OUT, { seed: SEED, day: DAY, sampled: rows.length, bad, rows });
console.log(`seed ${SEED} day ${DAY}: ${rows.length} acts with a named counterpart sampled (${sample.map(c => c.kind).join(', ')}); ${bad} bad`);
console.log(`ACTTAGCHECK ${rows.length && !bad ? 'PASS' : 'FAIL'} · ${path.relative(ROOT, file)}`);
process.exitCode = rows.length && !bad ? 0 : 1;
