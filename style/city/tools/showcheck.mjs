// Re-pinned for slime's 10-27 call: "go with a".
// Node-only C1-6 properties. In-memory production mutations fail first; existing
// checks, source fixtures and core files are never changed. --fault exits 1.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFeed } from '../simstate/record/adapter.js';
import { CITY_PLACES, HOUSE_LOTS } from '../simstate/record/places.js';
import { sim } from '../simstate/store.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RECORD = new URL('../simstate/record/', import.meta.url);
const fault = process.argv.includes('--fault') ? process.argv[process.argv.indexOf('--fault') + 1] : null;
const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
const equal = (a, b, label) => property(isDeepStrictEqual(a, b), label);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const fileOf = seed => path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
function feed(seed) {
  if (!fs.existsSync(fileOf(seed))) {
    const args = ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'];
    const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    console.log(`generated seed ${seed}: ${args.join(' ')}`);
  }
  return freeze(parseFeed(fs.readFileSync(fileOf(seed), 'utf8')));
}
async function underTest() {
  const sources = Object.fromEntries(['show-plan.js', 'player.js', 'placement.js'].map(name => [name, fs.readFileSync(new URL(name, RECORD), 'utf8')]));
  function replace(name, before, after) {
    assert(sources[name].includes(before), `fault injection site missing: ${before}`);
    sources[name] = sources[name].replace(before, after);
  }
  if (fault === 'fold-fight') replace('show-plan.js', "event.kind, 'fight', fight,", "event.kind, 'ambient', fight,");
  else if (fault === 'hooded-named') replace('show-plan.js', 'scenes.push(scene); return scene;',
    "if (kind === 'hooded') scene.publicActors.push([...targets.keys()].find(id => !visible(id))); scenes.push(scene); return scene;");
  else if (fault === 'hooded-kind') replace('show-plan.js', 'scenes.push(scene); return scene;',
    "if (kind === 'hooded') scene.kind = 'hit'; scenes.push(scene); return scene;");
  else if (fault === 'hooded-dropped') replace('show-plan.js', 'scenes.push(scene); return scene;',
    "if (kind === 'hooded') return scene; scenes.push(scene); return scene;");
  else if (fault === 'early-result') replace('player.js',
    'times.set(scene.end, [...(times.get(scene.end) || []),', 'times.set(plan.start, [...(times.get(plan.start) || []),');
  else if (fault === 'future-show-length') {
    const before = sources['player.js'].match(/bounds, shows: [^\n]+, snapshot, seek, advance,/);
    assert(before, 'playlist fault injection site missing');
    replace('player.js', before[0], 'bounds, shows: () => shows.map(s => ({ night: s.night, minute: s.minute, end: s.end })), snapshot, seek, advance,');
  } else if (fault === 'fixed-show-window') {
    const before = sources['placement.js'].match(/function duringShow\(snapshot, minute, events\) \{[\s\S]*?\n\}/);
    assert(before, 'placement fault injection site missing');
    replace('placement.js', before[0], `function duringShow(snapshot, minute, events) {
  const night = snapshot.reveal?.night;
  if (night == null || minute < showMinute(night) || minute >= showMinute(night) + SHOW_MINUTES) return null;
  return showFor(events, night) ?? null;
}`);
  }
  else if (fault) throw new Error(`unknown fault ${fault}`);
  const loaded = {};
  for (const name of ['player.js', 'placement.js', 'show-plan.js']) {
    const source = sources[name].replace(/'\.\/([^']+\.js)'/g, (_, dependency) =>
      JSON.stringify(loaded[dependency]?.url ?? new URL(dependency, RECORD).href));
    const url = 'data:text/javascript,' + encodeURIComponent(source);
    loaded[name] = { url, module: await import(url) };
  }
  return { ...loaded['show-plan.js'].module, ...loaded['player.js'].module, ...loaded['placement.js'].module };
}
const ids = events => events.map(e => e.id).sort((a, b) => a - b);
const byId = events => [...events].sort((a, b) => a.id - b.id);

function planProperties(plan, frame, board, totals) {
  const show = frame.events.find(e => e.type === 'show'), visible = new Set(Object.keys(show.seen));
  const hidden = board.agents.filter(a => !visible.has(a.id));
  property(plan.start >= frame.day * 1440 + 1265 && plan.end <= frame.day * 1440 + 1280, 'show within 21:05–21:20');
  property(plan.end > plan.start, 'show has positive length');
  const strings = value => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  for (const scene of plan.scenes) {
    property(scene.start >= plan.start && scene.end <= plan.end && scene.end > scene.start, `scene ${scene.id} within show`);
    property(CITY_PLACES[scene.place.cityPlace] || HOUSE_LOTS.some(l => l.id === scene.place.cityPlace), 'scene uses exported city place');
    property(scene.publicActors.every(id => visible.has(id)), 'no hooded attacker in public actors');
    property(Number.isInteger(scene.hoodedCount) && scene.hoodedCount >= 0, 'nonnegative anonymous count');
    const text = strings(scene);
    property(hidden.every(a => !text.includes(a.id) && (!a.name || !text.includes(a.name))), 'no hooded identity or display name anywhere in scene');
    property(!['won', 'strength', 'defence', 'take', 'heat', 'card', 'line', 'text', 'reason', 'accept'].some(k => k in scene), 'scene carries no result or private prose');
    if (scene.kind === 'hooded' || scene.beat === 'ambient' && scene.hoodedCount > 0) {
      equal(scene.kind, 'hooded', 'anonymous ambient scene withholds play kind');
      property(scene.beat === 'ambient' && scene.hoodedCount > 0, 'hooded scene stages a positive ambient remainder');
      equal(Object.keys(scene).sort(), ['id', 'night', 'eventId', 'kind', 'beat', 'place', 'start', 'end', 'publicActors', 'hoodedCount', 'revealIds'].sort(), 'hooded scene has only count and staging metadata');
      equal(Object.keys(scene.place).sort(), ['corePlace', 'cityPlace', 'district', 'standPlace', 'lot'].sort(), 'hooded place has no target or play kind');
      equal(scene.eventId, show.id, 'hooded scene refers only to the public show');
      equal(scene.publicActors, [], 'hooded scene has no named actors');
      equal(scene.revealIds, [], 'hooded scene has no target or result receipt');
      property(scene.place.corePlace === scene.place.district && scene.place.lot === null, 'hooded scene uses district only');
    }
  }
  for (const [agent, play] of Object.entries(show.plays)) {
    const matching = plan.scenes.filter(s => s.beat === 'ambient' && s.kind === play.kind && s.publicActors.includes(agent));
    property(matching.length === 1, `night ${frame.day} every public play has a scene of its kind (${agent}/${play.kind})`);
    if (play.kind === 'hustle') {
      const event = frame.events.find(e => e.type === 'hustle' && e.night === frame.day && e.agent === agent);
      equal(matching[0].variant, event.how, 'hustle variant is typed public how');
      property(matching[0].revealIds.includes(event.id), 'hustle result belongs to its scene');
      totals.variants.add(event.how);
    }
    totals.plays++;
  }
  for (const event of frame.events.filter(e => ['fight', 'arrest'].includes(e.type) && e.night === frame.day)) {
    const matching = plan.scenes.filter(s => s.eventId === event.id && s.beat === event.type);
    property(matching.length === 1, `night ${frame.day} ${event.type} ${event.id} has its own beat`);
    equal(matching[0].kind, event.type === 'fight' ? event.kind : 'arrest', 'beat keeps source kind');
    equal(matching[0].revealIds, [event.id], 'fight/arrest beat pays off only its own event');
    if (event.type === 'fight') equal(matching[0].hoodedCount,
      ['hit', 'breakin'].includes(event.kind) ? event.sides.reduce((n, side) => n + side.size, 0) : 0,
      'fight hooded count equals its public attacking sides');
    totals[event.type]++;
  }
  const focus = plan.scenes.filter(s => ['fight', 'arrest'].includes(s.beat)).sort((a, b) => a.start - b.start);
  property(focus.every((s, i) => !i || s.start >= focus[i - 1].end), 'fights and arrests never share a beat');
  const anonymous = plan.scenes.filter(s => s.kind === 'hooded' || s.beat === 'fight' && s.hoodedCount > 0);
  for (const district of new Set([...Object.keys(show.hooded), ...anonymous.map(s => s.place.district)])) {
    const count = anonymous.filter(s => s.place.district === district).reduce((n, s) => n + s.hoodedCount, 0);
    equal(count, show.hooded[district] ?? 0, `night ${frame.day} district ${district} hooded scenes and fights sum exactly to show.hooded`);
    totals.hooded += count;
  }
  const published = [...plan.openingIds, ...plan.scenes.flatMap(s => s.revealIds)];
  equal(published.slice().sort((a, b) => a - b), ids(frame.events), 'every event form paid off exactly once');
  for (const event of frame.events.filter(e => e.type === 'turf' && e.night === frame.day)) {
    const due = plan.scenes.find(s => s.revealIds.includes(event.id));
    const contenders = plan.scenes.filter(s => s.kind === 'deal'
      && show.plays[s.publicActors[0]]?.corner === event.corner);
    property(contenders.every(s => s.end <= due.end), 'turf waits for every public corner contender');
  }
  const quiet = !focus.length && !Object.values(show.hooded).some(Boolean)
    && !Object.values(show.plays).some(p => ['grab', 'vault', 'collar', 'board'].includes(p.kind));
  if (quiet) { property(plan.end - plan.start < 15, 'quiet show is shorter'); totals.quiet++; }
  totals.scenes += plan.scenes.length;
}

// Independent projection oracle: walk original frames, choose due event forms,
// retain whole boards until the close. It does not use the player's reducer,
// cursor, pending cues or revealAt. Latest forms replace by id, never merge.
function expected(frames, plans, minute) {
  const events = new Map();
  let board = null, sightings = {}, last = null, nightsLeft = null, midseason = null, over = null;
  for (const frame of frames) {
    const plan = plans.get(frame.day), night = frame.step.kind === 'night';
    if ((night ? plan.start : frame.minute) > minute) break;
    last = frame;
    const full = !night || minute >= plan.end;
    const due = full ? frame.events.map(e => e.id) : [...plan.openingIds,
      ...plan.scenes.filter(s => s.end <= minute).flatMap(s => s.revealIds)];
    for (const event of frame.events) if (due.includes(event.id)) events.set(event.id, event);
    if (full) {
      if (frame.board !== undefined) board = frame.board;
      sightings = frame.sightings; ({ nightsLeft, midseason, over } = frame);
    } else break;
  }
  return { board, events: byId([...events.values()]), sightings, nightsLeft, midseason, over,
    frame: last ? { i: last.i, t: last.t, step: last.step, minute: last.minute } : null, day: last?.day ?? null };
}
function projectionProperties(state, want) {
  for (const key of ['board', 'sightings', 'nightsLeft', 'midseason', 'over', 'frame', 'day']) equal(state[key], want[key], `${key} held until its cue`);
  equal(byId(state.events), want.events, 'nothing revealed before its scene; complete forms replace by id');
  equal(sim.board(), state.board, 'store board equals presented player board');
  equal(ids(sim.events()), ids(state.events), 'store ticker has only paid-off events');
}

// Delayed play records are an oracle ONLY here. Named plays keep their kind;
// hooded plays consume anonymous slots in their district, never a named scene.
function auditEveryPlay(frames, plans, seed, totals) {
  const latest = new Map(frames.flatMap(f => f.events.map(e => [e.id, e])));
  const plays = [...latest.values()].filter(e => e.type === 'play');
  const byNightAgent = new Map(plays.map(p => [`${p.day}:${p.agent}`, p]));
  function attackOf(play, visited = new Set()) {
    property(play && !visited.has(play.agent), 'hooded back resolves to a disclosed attack');
    visited.add(play.agent);
    if (play.kind === 'back') return attackOf(byNightAgent.get(`${play.day}:${play.target}`), visited);
    property(['hit', 'breakin'].includes(play.kind), 'hooded play belongs to a hit or break-in');
    return play;
  }
  const remaining = new Map([...plans].map(([night, plan]) => [night, plan.scenes
    .filter(s => s.kind === 'hooded' || s.beat === 'fight' && s.hoodedCount > 0)
    .map(scene => ({ scene, left: scene.hoodedCount }))]));
  const missing = [];
  let hoodedPlays = 0;
  for (const play of plays) {
    const plan = plans.get(play.day);
    property(plan, 'every disclosed play has a night plan');
    const frame = frames[plan.frame], show = frame.events.find(e => e.type === 'show');
    if (Object.hasOwn(show.seen, play.agent)) {
      property(Object.hasOwn(show.plays, play.agent), 'every non-hooded play is public');
      property(plan.scenes.some(s => s.kind === play.kind && s.publicActors.includes(play.agent)), 'every named disclosed play has its kind');
      continue;
    }
    property(!Object.hasOwn(show.plays, play.agent), 'hooded play kind absent from public plays');
    property(plan.scenes.every(s => !s.publicActors.includes(play.agent)), 'hooded play is staged only anonymously');
    const attack = attackOf(play);
    // Counts intentionally do not assert a private group/target correspondence:
    // an intercepted backer can leave the attack's fight smaller than its group.
    const slot = remaining.get(play.day).find(({ scene, left }) => left > 0 && scene.place.district === attack.place);
    if (slot) slot.left--;
    else missing.push({ night: play.day, kind: play.kind, receipt: play.id });
    hoodedPlays++;
  }
  const unused = [...remaining.values()].flat().filter(slot => slot.left);
  property(!unused.length, `every anonymous slot accounts for exactly one hooded play; unused ${JSON.stringify(unused.map(s => ({ id: s.scene.id, left: s.left })))}; missing ${JSON.stringify(missing)}`);
  totals.allPlays += plays.length;
  totals.missing.push(...missing.map(row => ({ seed, ...row })));
  console.log(`AUDIT seed ${seed}: ${plays.length} disclosed plays; ${hoodedPlays} hooded; ${missing.length} unstaged`);
}

function lookaheadProperties(frames, plans, api, seed) {
  const player = api.createShowPlayer(frames);
  for (const frame of frames.filter(f => f.step.kind === 'night')) {
    const plan = plans.get(frame.day);
    for (const minute of [1800, frame.minute - .001, frame.minute, plan.start, plan.end, plan.end + .1]) {
      player.seek(minute);
      const offered = player.shows().find(s => s.night === frame.day);
      equal(offered, { night: frame.day, minute: api.showMinute(frame.day),
        ...(minute >= frame.minute ? { end: plan.end } : {}) },
      `seed ${seed} night ${frame.day} picker exposes length only at frame publication (${minute}); got ${JSON.stringify(offered)}`);
    }
  }
  // Change only a future quiet night's public content. Before its publication,
  // neither a fresh player nor a reverse seek may offer any trace of its length.
  const quiet = [...plans.values()].find(p => p.end - p.start < api.SHOW_MINUTES);
  property(quiet, 'fixture has a short show for look-ahead properties');
  const changed = structuredClone(frames), frame = changed[quiet.frame];
  frame.events.find(e => e.type === 'show').hooded.downtown = 1;
  const other = api.createShowPlayer(changed);
  property(api.createShowPlanner(changed).night(quiet.night).end !== quiet.end, 'future mutation changes show length');
  for (const minute of [1800, frame.minute - .001]) {
    player.seek(minute); other.seek(minute);
    equal(player.shows(), other.shows(), `seed ${seed} future-only content cannot affect picker at ${minute}`);
  }
  player.jumpShow(quiet.night);
  equal(player.minute, quiet.start, 'future night number remains jumpable');
  const cached = player.shows(); cached[0].end = -1;
  property(player.shows()[0].end !== -1, 'picker rows are defensive copies');
  console.log(`LOOKAHEAD seed ${seed}: picker publication/mutation/reverse-seek PASS`);
}

function placementProperties(frames, plans, api, seed) {
  const player = api.createShowPlayer(frames);
  // Check the exact close, including after showState becomes null, and a later
  // minute requested from the last active snapshot. Corner holders go home too.
  for (const plan of plans.values()) {
    const before = player.seek(plan.end - .001);
    property(api.targetsAt(before).some(t => t.source.kind === 'show'), 'show targets remain until planned close');
    for (const minute of [plan.end, plan.end + .1]) {
      const snapshot = player.seek(minute);
      for (const input of [snapshot, before]) for (const routines of [null, { at() { throw new Error('day routine read after show'); } }]) {
        const targets = api.targetsAt(input, minute, routines);
        const held = targets.filter(t => t.source.kind === 'show');
        equal(held.length, 0, `seed ${seed} night ${plan.night} ${held.length} agents stay at show targets at ${minute}`);
        for (const row of targets) {
          const agent = input.board.agents.find(a => a.id === row.agent);
          const finale = plan.night === 14;
          const arrested = finale && input.events.some(e => e.type === 'arrest' && e.night === 14 && e.agent === agent.id);
          const boarded = finale && (agent.boarded || input.events.some(e => e.type === 'board' && e.day === 14 && e.agent === agent.id));
          equal(row.reason, finale ? agent.jailed || arrested ? 'jail' : boarded ? 'departed' : agent.evicted ? 'heap' : 'home'
            : agent.jailed ? 'jail' : agent.evicted ? 'heap' : 'home', finale
            ? 'finale close preserves departure and Iron Island; other missed agents rest at home/Heap'
            : 'planned close returns everyone home, with jail/eviction respected');
        }
      }
    }
    const legacy = api.createRecordPlayer(frames).seek(plan.start + 3.1);
    property(api.targetsAt(legacy).some(t => t.source.kind === 'show'), 'unplanned player retains fixed show window');
  }
  console.log(`PLACEMENT seed ${seed}: ${plans.size} show closes and fixed-window fallback PASS`);
}

async function properties(seed, api, totals) {
  const frames = feed(seed), original = JSON.stringify(frames), planner = api.createShowPlanner(frames), plans = new Map();
  let board = null;
  for (const frame of frames) {
    if (frame.step.kind === 'night') {
      const plan = planner.night(frame.day); plans.set(frame.day, plan);
      planProperties(plan, frame, board, totals);
      equal(plan, api.createShowPlanner(frames.slice(0, frame.i + 1)).night(frame.day), 'future frames cannot change a show');
    }
    board = frame.board ?? board;
  }
  if (fault === 'fixed-show-window') placementProperties(frames, plans, api, seed);
  lookaheadProperties(frames, plans, api, seed);
  if (fault !== 'fixed-show-window') placementProperties(frames, plans, api, seed);
  const player = api.createRecordPlayer(frames, { speed: 60, showPlanner: planner });
  sim.useRecord(player); player.seek(0); player.play();
  const points = [...new Set([0, ...frames.flatMap(f => [f.minute - .001, f.minute]),
    ...[...plans.values()].flatMap(plan => [plan.start - .001, plan.start, plan.end, plan.end + .001,
      ...plan.scenes.flatMap(s => [s.start, (s.start + s.end) / 2, s.end - .001, s.end])])])]
    .filter(m => m >= 0 && m <= player.bounds.to).sort((a, b) => a - b);
  const played = new Map();
  for (const minute of points) {
    player.advance(Math.max(0, minute - player.minute));
    const state = player.snapshot();
    projectionProperties(state, expected(frames, plans, minute));
    const plan = plans.get(Math.floor(minute / 1440));
    const active = plan && minute >= plan.start && minute < plan.end;
    equal(state.show?.active.map(s => s.id) ?? [], active ? plan.scenes.filter(s => s.start <= minute && minute < s.end).map(s => s.id) : [], 'scene selection follows absolute intervals');
    if (state.show) property(state.show.active.every(s => s.progress >= 0 && s.progress < 1), 'seek progress within scene');
    played.set(minute, state);
  }
  for (const minute of points.slice().reverse()) equal(player.seek(minute), played.get(minute), 'reverse seek lands on same scene and store state');
  const replay = api.createRecordPlayer(frames, { showPlanner: api.createShowPlanner(frames) });
  for (const plan of plans.values()) {
    for (const minute of [plan.start, ...plan.scenes.filter(s => s.beat !== 'ambient').map(s => (s.start + s.end) / 2), plan.end]) {
      equal(replay.seek(minute), player.seek(minute), 'fresh replay equals warm seek mid-show');
    }
  }
  const first = [...plans.values()][0], mid = first.start + .75;
  equal(api.createShowPlayer(frames).seek(mid), replay.seek(mid), 'staging factory wires the same player and planner');
  const cut = frames.slice(0, first.frame + 1), cutPlayer = api.createShowPlayer(cut);
  equal(cutPlayer.bounds.to, first.end, 'night-only feed retains its closing beat in player bounds');
  equal(cutPlayer.seek(first.end).board, cut.at(-1).board, 'night-only feed releases final board');
  const playlist = api.createRecordPlayer(frames, { speed: 60, showPlanner: planner });
  playlist.playShows(); playlist.advance([...plans.values()].reduce((sum, p) => sum + p.end - p.start, 0) + 1);
  equal(playlist.minute, [...plans.values()].at(-1).end, 'playlist uses actual shorter shows');
  equal(playlist.running, false, 'playlist stops at final close');
  equal(JSON.stringify(frames), original, 'input feed unchanged');
  totals.nights += plans.size; totals.points += points.length;
  auditEveryPlay(frames, plans, seed, totals);
  sim.stop();
  console.log(`seed ${seed}: ${plans.size} nights, ${[...plans.values()].reduce((n, p) => n + p.scenes.length, 0)} scenes; ${points.length} reveal/playback/seek points PASS`);
}

function guardedInputs(api) {
  const frames = structuredClone(feed(404));
  for (const frame of frames) {
    if (frame.board) Object.defineProperty(frame.board, 'memories', { get() { throw new Error('private board read'); } });
    for (const event of frame.events) {
      for (const key of ['text', 'line', 'reason', 'accept', 'origin']) Object.defineProperty(event, key, { configurable: true, get() { throw new Error(`forbidden ${key} read`); } });
      if (event.type === 'play') for (const key of ['kind', 'agent', 'target', 'place']) {
        Object.defineProperty(event, key, { get() { throw new Error(`delayed play ${key} read`); } });
      }
    }
  }
  const random = Math.random;
  Math.random = () => { throw new Error('random show'); };
  try {
    const planner = api.createShowPlanner(frames);
    for (const f of frames.filter(f => f.step.kind === 'night')) {
      planner.night(f.day); planner.at(f.day * 1440 + 1266);
    }
  } finally { Math.random = random; }
  console.log('forbidden text/private payload getters and Math.random trap PASS');
}

try {
  if (!fault) {
    feed(404);
    for (const name of ['hooded-kind', 'hooded-dropped', 'fold-fight', 'hooded-named', 'early-result', 'future-show-length', 'fixed-show-window']) {
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
      assert.equal(result.status, 1, `${name} must fail`);
      assert.match(result.stderr, /PROPERTY/, `${name} must fail a property`);
      console.log(`CONTROL ${name}: ${result.stderr.trim()}`);
    }
  }
  const api = await underTest(), totals = { nights: 0, scenes: 0, plays: 0, fight: 0, arrest: 0, hooded: 0, quiet: 0, points: 0, variants: new Set(), allPlays: 0, missing: [] };
  for (const seed of fault ? [404] : [404, 405, 406]) await properties(seed, api, totals);
  if (!fault) {
    equal([...totals.variants].sort(), ['boats', 'campers', 'cars', 'crates', 'mugging', 'scrap', 'shoplift', 'stickup'].sort(), 'all eight district hustles exercised');
    guardedInputs(api);
  }
  const { missing, ...counts } = totals;
  console.log(`show properties: ${JSON.stringify({ ...counts, variants: [...totals.variants].sort(), unrepresentedPlays: missing.length })}`);
  property(!missing.length, `every play staged by public kind or anonymously hooded: ${missing.length}/${totals.allPlays} unstaged; first ${JSON.stringify(missing[0])}`);
  console.log('SHOWCHECK PASS');
} catch (error) {
  console.error(`SHOWCHECK FAIL${fault ? ` (${fault})` : ''}: ${error.message}`); process.exitCode = 1;
}
