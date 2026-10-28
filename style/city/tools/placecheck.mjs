// Re-pinned for slime's 10-27 call: "go with a".
// Browser-safe exports first; node-only imports/CLI stay inside run().
// Page seam: checkDrawn(player.snapshot(), minute, {agents, fights}) -> {ok, errors}.
// Night 14 needs the active show plan; the page's sim.record() view strips it.
// Agents: {agent,cityPlace,lot,x?,z?,hidden?}; fights: {eventId,cityPlace,lot,sides,defence,x?,z?}.
// Call at settled beats/arrivals (late travel cuts to its arrival), not mid-trip.
// Supply x/z to also check physical anchors; omitted coordinates check labels only.
import { targetsAt, fightsAt } from '../simstate/record/placement.js';
import { addressesFor } from '../simstate/record/addresses.js';
import { PLACE_TABLE, CITY_PLACES, HOUSE_LOTS, STANDS, CORNERS, DISTRICTS, SITES } from '../simstate/record/places.js';
import { createRecordPlayer, showMinute, SHOW_MINUTES } from '../simstate/record/player.js';
import { parseFeed } from '../simstate/record/adapter.js';
import { planShow, createShowPlayer } from '../simstate/record/show-plan.js';
import { createRoutinePlanner } from '../simstate/record/routines.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isShow = (s, m) => s.reveal && m >= (s.reveal.start ?? showMinute(s.reveal.night)) && m < (s.reveal.end ?? showMinute(s.reveal.night) + SHOW_MINUTES);
const invisible = row => row.hidden || ['hidden', 'departed'].includes(row.reason);
function positionErrors(want, got, label) {
  const errors = [];
  if (got.cityPlace !== want.cityPlace && (!want.standPlace || got.cityPlace !== want.standPlace)) errors.push(`${label}: city place ${got.cityPlace} != ${want.cityPlace}`);
  if ((got.lot ?? null) !== want.lot) errors.push(`${label}: wrong lot`);
  if ('x' in got || 'z' in got) {
    const spots = STANDS[got.cityPlace];
    const anchor = CITY_PLACES[want.cityPlace] ?? HOUSE_LOTS.find(l => l.id === want.cityPlace);
    const near = spots?.length ? spots.some(p => Math.hypot(got.x - p.x, got.z - p.z) <= 1.5)
      : anchor && Math.hypot(got.x - anchor.x, got.z - anchor.z) <= 12;
    if (!Number.isFinite(got.x) || !Number.isFinite(got.z) || !near) errors.push(`${label}: coordinates outside city anchor`);
  }
  return errors;
}

export function checkDrawn(snapshot, minute, drawn) {
  const errors = [], targets = targetsAt(snapshot, minute), rows = drawn.agents || [];
  const byId = new Map(rows.map(a => [a.agent, a]));
  if (byId.size !== rows.length) errors.push('duplicate drawn agent');
  for (const want of targets) {
    const got = byId.get(want.agent), label = `agent ${want.agent}`;
    if (['hidden', 'departed'].includes(want.reason)) {
      if (got && !invisible(got)) errors.push(`${label}: ${want.reason} agent drawn outside scene`);
    } else if (!got || invisible(got)) errors.push(`${label}: missing visible target`);
    else errors.push(...positionErrors(want, got, label));
    byId.delete(want.agent);
  }
  for (const id of byId.keys()) errors.push(`unknown drawn agent ${id}`);
  const fights = isShow(snapshot, minute) ? fightsAt(snapshot, snapshot.reveal.night) : [];
  const actual = drawn.fights || [], byFight = new Map(actual.map(f => [f.eventId, f]));
  if (actual.length !== byFight.size) errors.push('duplicate drawn fight');
  for (const want of fights) {
    const got = byFight.get(want.eventId), label = `fight ${want.eventId}`;
    if (!got) errors.push(`${label}: missing scene`);
    else {
      errors.push(...positionErrors(want, got, label));
      if (!same(want.sides, got.sides)) errors.push(`${label}: public sides differ (hooded sides must have no ids)`);
      if (!same(want.defence, got.defence)) errors.push(`${label}: public defence differs`);
    }
    byFight.delete(want.eventId);
  }
  for (const id of byFight.keys()) errors.push(`fight ${id}: scene before/after its show`);
  return { ok: errors.length === 0, errors };
}

async function run() {
  const [{ default: fs }, { default: path }, { fileURLToPath }, { spawnSync }, { default: assert }, { isDeepStrictEqual }] = await Promise.all([
    import('node:fs'), import('node:path'), import('node:url'), import('node:child_process'), import('node:assert/strict'), import('node:util'),
  ]);
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const faultAt = process.argv.indexOf('--fault'), fault = faultAt < 0 ? null : process.argv[faultAt + 1];
  const property = (ok, label) => { if (!ok) throw new Error(`PROPERTY ${label}`); };
  const equal = (actual, expected, label) => property(isDeepStrictEqual(actual, expected), label);
  const freeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  const fileOf = seed => path.join(ROOT, `core/runs/${seed}-A/feed.jsonl`);
  function ensure(seed) {
    if (fs.existsSync(fileOf(seed))) return;
    const args = ['core/bench/runner.mjs', '--seed', String(seed), '--rule', 'A', '--cast', 'layer4', '--feed', '--out', 'core/runs'];
    const child = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    console.log(`generated seed ${seed}: ${args.join(' ')}`);
  }
  // Independent prefix projection: C1-2 before the finale, then the published
  // finale's scene cues and held preceding board. Never uses player/reducer code.
  function at(frames, minute) {
    const prefix = frames.filter(f => f.minute <= minute && (f.step.kind !== 'night' || f.day * 1440 + 1265 <= minute));
    const last = prefix.at(-1), night = prefix.findLast(f => f.step.kind === 'night'), events = new Map();
    let board = null, finale = null, sightings = {};
    for (const frame of prefix) {
      if (frame.step.kind === 'night' && frame.day === 14) finale = planShow(frame, board);
      const held = frame.step.kind === 'night' && frame.day === 14 && minute < finale.end;
      const due = held ? new Set([...finale.openingIds, ...finale.scenes.filter(s => s.end <= minute).flatMap(s => s.revealIds)]) : null;
      for (const event of frame.events) if (!due || due.has(event.id)) events.set(event.id, event);
      if (!held) { board = frame.board ?? board; sightings = frame.sightings; }
    }
    return { minute, frame: last ? { i: last.i, t: last.t, step: last.step, minute: last.minute } : null,
      board, events: [...events.values()], sightings, day: last?.day ?? null,
      reveal: night ? { night: night.day, start: finale?.start ?? night.day * 1440 + 1265,
        ...(finale ? { end: finale.end } : {}) } : null,
      ...(finale ? { show: minute < finale.end ? { night: 14, start: finale.start, end: finale.end,
        active: finale.scenes.filter(s => s.start <= minute && minute < s.end),
        completed: finale.scenes.filter(s => s.end <= minute).map(s => s.id) } : null } : {}) };
  }
  async function planners() {
    if (!fault || ['lookahead', 'boarded-island', 'boarding-home', 'jailed-docks', 'evicted-missed-home'].includes(fault)) return { targetsAt, fightsAt };
    const url = new URL('../simstate/record/placement.js', import.meta.url);
    let code = fs.readFileSync(url, 'utf8');
    const replace = (old, next) => { assert(code.includes(old), 'fault site exists'); code = code.replace(old, next); };
    if (fault === 'jail-home') replace("if (agent.jailed) target = location(SITES.jail, 'jail', source);", 'if (agent.jailed) target = atHome(book[agent.id], source);');
    else if (fault === 'hooded-place') {
      // Wrong: select a missing roster id and stage the burglary at ITS home.
      replace("place = atHome(book[e.target], { kind: 'fight', eventId: e.id });",
        "place = atHome(book[snapshot.board.agents.find(a => !Object.hasOwn(show.seen, a.id) && !a.jailed)?.id ?? e.target], { kind: 'fight', eventId: e.id });");
    } else throw new Error(`unknown fault ${fault}`);
    for (const name of ['places.js', 'addresses.js', 'player.js', 'staging.js']) code = code.replace(`'./${name}'`, JSON.stringify(new URL(name, url).href));
    return import('data:text/javascript,' + encodeURIComponent(code));
  }
  function checkTable() {
    const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'world/export/world.json')));
    const stands = JSON.parse(fs.readFileSync(path.join(ROOT, 'style/city/simstate/stands.json')));
    let mappings = 0, measured = 0, fallback = 0;
    for (const [group, rows] of Object.entries(PLACE_TABLE)) {
      if (group === 'home') continue;
      for (const row of Object.values(rows)) {
        const p = world.places.find(p => p.id === row.cityPlace), spots = stands.places[row.standPlace]?.spots;
        property(p && p.dist === row.district, `city counterpart ${row.corePlace}`);
        property(spots?.length > 0 && spots.every(s => Number.isFinite(s.x) && Number.isFinite(s.z)), `measured stands ${row.corePlace}`);
        property(CITY_PLACES[row.standPlace].dist === row.district, 'exterior stays in district');
        mappings++; if (row.stands.status === 'measured') measured++; else { fallback++; property(!!row.note, 'stand gap documented'); }
      }
    }
    equal(new Set(Object.values(CORNERS).map(p => p.cityPlace)).size, Object.keys(CORNERS).length, 'distinct core corners');
    property(HOUSE_LOTS.every(l => world.lots.some(p => p.id === l.id && p.tier === 'house' && p.dist === 'suburbs')), 'Pleasantview house lots only');
    console.log(`place table: ${mappings} mappings, ${measured} measured sets, ${fallback} documented exterior fallbacks; ${HOUSE_LOTS.length} house lots PASS`);
  }
  function checkTargets(snapshot, minute, targets, finale = null) {
    const agents = snapshot.board?.agents || [], book = addressesFor(agents.map(a => a.id));
    equal(targets.map(t => t.agent), agents.map(a => a.id), 'one target per roster id');
    for (const agent of agents) {
      const target = targets.find(t => t.agent === agent.id);
      if (agent.jailed) property(target.reason === 'jail' && target.cityPlace === 'jail', `jailed ${agent.id} on Iron Island`);
      else if (finale && minute >= finale.start) {
        const leave = finale.scenes.find(s => s.kind === 'ferry').beats.find(b => b.name === 'leave').start;
        const boarding = Math.min(...finale.scenes.filter(s => s.kind === 'board' && s.beat === 'finale').map(s => s.start));
        const show = snapshot.events.find(e => e.type === 'show' && e.night === 14);
        const boarded = agent.boarded || snapshot.events.some(e => e.type === 'board' && e.day === 14 && e.agent === agent.id);
        const arrest = finale.scenes.find(s => s.beat === 'arrest' && s.publicActors.includes(agent.id)
          && snapshot.events.some(e => e.type === 'arrest' && e.id === s.eventId && e.agent === agent.id));
        const missed = snapshot.events.find(e => e.type === 'missed' && e.day === 14 && e.agent === agent.id);
        const missedEnd = missed && finale.scenes.find(s => s.kind === 'missed' && s.eventId === missed.id).end;
        if (arrest && minute >= arrest.end) property(target.reason === 'jail' && target.cityPlace === 'jail', 'finale arrest stays on Iron Island');
        else if (boarded && minute >= leave) property(target.reason === 'departed' && target.cityPlace === null && target.corePlace === null
          && target.district === null && target.lot === null && target.standPlace === null, 'boarded agent stays off island from leave beat');
        else if (minute >= finale.end || missed && minute >= missedEnd) property(target.reason === (agent.evicted ? 'heap' : 'home')
          && target.cityPlace === (agent.evicted ? 'heap' : book[agent.id].home), 'other missed agent rests at home/Heap after scene');
        else if (!Object.hasOwn(show.seen, agent.id)) property(target.reason === 'hidden' && target.cityPlace === null, 'hooded walker hidden');
        else {
          const named = finale.scenes.filter(s => s.publicActors.includes(agent.id));
          const active = named.find(s => s.start <= minute && minute < s.end);
          const completed = named.filter(s => s.end <= minute).sort((a, b) => b.end - a.end)[0];
          const want = active?.place ?? (minute >= boarding ? SITES.ferry : completed?.place ?? named[0]?.place
            ?? (show.plays[agent.id]?.kind === 'vault' ? SITES.vault : null));
          property(want && target.cityPlace === want.cityPlace && target.lot === (want.lot ?? null), `finale ${agent.id} follows scene place at ${minute}`);
        }
      }
      else if (isShow(snapshot, minute)) {
        const show = snapshot.events.find(e => e.type === 'show' && e.night === snapshot.reveal.night);
        if (!Object.hasOwn(show.seen, agent.id)) property(target.reason === 'hidden' && target.cityPlace === null, 'hooded walker hidden');
        else if (show.seen[agent.id] === 'home') property(target.cityPlace === (agent.evicted ? 'heap' : book[agent.id].home), 'seen at address');
        else property(target.district === show.seen[agent.id], `seen ${agent.id} in public district`);
      } else if (minute >= 1440 && (minute % 1440 >= 1280 || minute % 1440 < 360)) {
        property(target.cityPlace === (agent.evicted ? 'heap' : book[agent.id].home), 'after show goes home/Heap');
      }
    }
  }
  function checkFights(snapshot, planned) {
    const night = snapshot.reveal.night, events = snapshot.events.filter(e => e.type === 'fight' && e.night === night);
    equal(planned.map(f => f.eventId), events.map(e => e.id), 'every public fight staged');
    const book = addressesFor(snapshot.board.agents.map(a => a.id));
    for (const event of events) {
      const f = planned.find(f => f.eventId === event.id);
      property(!!f.cityPlace && (!!CITY_PLACES[f.cityPlace] || HOUSE_LOTS.some(l => l.id === f.cityPlace)), 'fight has city place');
      if (event.kind === 'breakin') property(f.cityPlace === book[event.target].home, 'breakin at public target address, never hooded attacker address');
      if (event.kind === 'grab') property(f.cityPlace === 'docks', 'grab at docks');
      if (event.kind === 'hit') property(f.district === event.place, 'hit in public district');
      if (event.kind === 'collar') {
        const show = snapshot.events.find(e => e.type === 'show' && e.night === night);
        const arrest = snapshot.events.find(e => e.type === 'arrest' && e.night === night && e.agent === event.target && e.why === 'collar');
        property(show.seen[event.target] === 'home' ? f.cityPlace === book[event.target].home : f.district === (arrest?.place ?? event.place), 'collar at public arrest place');
      }
      for (const [i, side] of f.sides.entries()) {
        equal(side.count, event.sides[i].size, 'fight preserves side counts');
        if (['hit', 'breakin'].includes(event.kind)) property(!side.ids.length && side.hooded === side.count, 'no hooded attacker named');
      }
    }
  }
  function synthetic() {
    const ids = ['__proto__', 'constructor', 'toString', ...Array.from({ length: HOUSE_LOTS.length - 3 }, (_, i) => `id-${i}`)];
    const book = addressesFor(ids);
    equal(new Set(Object.values(book).map(a => a.home)).size, ids.length, 'address collision resolution at capacity');
    equal(book, addressesFor(ids.slice().reverse()), 'address roster-order independence');
    assert.throws(() => addressesFor([...ids, 'overflow']));
    const agents = ['a', 'b', 'c'].map(id => ({ id, jailed: false, evicted: false }));
    const base = { minute: 0, frame: null, day: 0, board: { agents, corners: [] }, events: [], reveal: null };
    property(targetsAt(base).every(t => t.reason === 'docks'), 'day zero docks');
    const minute = showMinute(1), show = { id: 1, type: 'show', night: 1, minute, seen: { a: 'home', b: 'downtown' }, hooded: { suburbs: 1 } };
    const state = { ...base, minute, day: 1, reveal: { night: 1 }, events: [show] };
    const aHome = addressesFor(agents.map(a => a.id)).a.home;
    const cases = [
      ['deal', 'downtown', 'downtown-1', CORNERS['downtown-1'].cityPlace], ['run', 'forest', null, 'woods'],
      ['cook', 'suburbs', null, aHome], ['cook', 'forest', null, null], ['build', 'suburbs', null, aHome],
      ['laylow', 'suburbs', null, aHome], ['guard', 'downtown', null, 'police'], ['vault', 'downtown', null, 'police'],
      ['grab', 'docks', null, 'docks'], ['hustle', 'industrial', null, DISTRICTS.industrial.cityPlace],
      ['board', 'junkyard', null, 'heap'], ['back', 'mall', null, 'mall'],
    ];
    for (const [kind, place, corner, expected] of cases) {
      const play = { kind, place, ...(corner ? { corner } : {}) };
      const s = { ...state, events: [{ ...show, seen: { a: kind === 'build' || kind === 'laylow' || (kind === 'cook' && place === 'suburbs') ? 'home' : place, b: 'downtown' }, plays: { a: play } }] };
      const t = targetsAt(s)[0];
      property(expected ? t.cityPlace === expected : ['lab-north', 'lab-west', 'lab-south'].includes(t.cityPlace), `public play ${kind}/${place}`);
    }
    // A disclosed old private play must not locate or name today's hooded walker.
    const old = { type: 'play', night: 1, agent: 'c', play: { kind: 'breakin', target: 'b' }, minute };
    equal(targetsAt({ ...state, events: [...state.events, old] }), targetsAt(state), 'private play records ignored by placement');
    const homeBack = { ...state, events: [{ ...show, plays: { a: { kind: 'back', place: 'suburbs', target: 'b' } } }] };
    equal(targetsAt(homeBack)[0].cityPlace, aHome, 'seen-home backer stays at its address');
    const evicted = { ...base, minute: 1800, board: { agents: [{ ...agents[0], evicted: true }], corners: [] } };
    equal(targetsAt(evicted)[0].reason, 'heap', 'evicted at Heap');
    const atCorner = { ...base, minute: 1800, board: { agents, corners: [{ holder: 'a', corner: 'downtown-1' }] } };
    equal(targetsAt(atCorner)[0].cityPlace, CORNERS['downtown-1'].cityPlace, 'public holder at corner by day');
    const vault = { ...state, events: [...state.events, { id: 2, type: 'fight', night: 1, kind: 'vault', place: 'downtown', sides: [{ size: 2, strength: 3 }], minute }] };
    equal(fightsAt(vault, 1)[0].cityPlace, SITES.vault.cityPlace, 'vault at precinct');
    const hidden = targetsAt(state)[2];
    property(hidden.reason === 'hidden' && hidden.cityPlace === null, 'hooded has no location');
    assert.throws(() => targetsAt(state, minute - 1), /at or before/);
    const drawn = { agents: targetsAt(state).filter(t => t.reason !== 'hidden'), fights: [] };
    property(checkDrawn(state, minute, drawn).ok, 'page drawn seam accepts targets');
    property(!checkDrawn(state, minute, { ...drawn, agents: [...drawn.agents, { agent: 'c', cityPlace: aHome }] }).ok, 'page catches named hooded walker');
    property(!checkDrawn(state, minute, { ...drawn, agents: drawn.agents.map((a, i) => i ? a : { ...a, x: 1e6, z: 1e6 }) }).ok, 'page catches wrong physical coordinates');
    const finaleStart = showMinute(14), finaleShow = { ...show, night: 14, minute: finaleStart,
      seen: { a: 'junkyard' }, hooded: {}, plays: { a: { kind: 'board', place: 'junkyard' } } };
    const missed = { id: 2, type: 'missed', day: 14, agent: 'a', minute: finaleStart };
    const board = { agents: [{ ...agents[0], boarded: false }, { ...agents[1], jailed: true }], corners: [] };
    const plan = planShow({ i: 0, t: 29, day: 14, minute: finaleStart, step: { kind: 'night' }, events: [finaleShow, missed] }, board);
    const missScene = plan.scenes.find(s => s.kind === 'missed');
    for (const m of [missScene.start, (missScene.start + missScene.end) / 2, missScene.end, plan.end, 15 * 1440 + 361]) {
      const s = { minute: m, frame: null, board, day: 14, events: [finaleShow, ...(m >= missScene.end ? [missed] : [])],
        reveal: { night: 14, start: plan.start, end: plan.end }, show: m < plan.end ? { night: 14, start: plan.start,
          active: plan.scenes.filter(row => row.start <= m && m < row.end) } : null };
      const rows = targetsAt(s);
      property(rows[0].cityPlace === (m < missScene.end ? 'docks' : addressesFor(board.agents.map(a => a.id)).a.home), 'non-jailed missed agent stays through scene then goes home');
      property(rows[1].reason === 'jail' && rows[1].cityPlace === 'jail', 'preceding-board prisoner stays on Iron Island throughout finale');
    }
    console.log('synthetic: day 0, all public play branches, eviction, holder, vault, prototype ids/collisions, page position/privacy checks PASS');
  }
  function checkEvictedMissed(planner) {
    // Baseline 404–406 has no non-jailed, evicted missed subject. Construct the
    // public night frame and preceding board; no season or result is simulated.
    const start = showMinute(14), id = 'evicted-missed';
    const board = { agents: [{ id, jailed: false, evicted: true, boarded: false },
      { id: 'jailed-missed', jailed: true, evicted: true, boarded: false }], corners: [] };
    const show = { id: 0, type: 'show', night: 14, minute: start, t: 29,
      seen: { [id]: 'junkyard' }, hooded: {}, plays: { [id]: { kind: 'board', place: 'junkyard' } } };
    const missed = board.agents.map((a, i) => ({ id: i + 1, type: 'missed', agent: a.id, day: 14, minute: start, t: 29 }));
    const frame = { i: 1, day: 14, minute: start, t: 29, step: { kind: 'night' }, sightings: {}, board: structuredClone(board), events: [show, ...missed] };
    const frames = [{ i: 0, day: 0, minute: 0, t: 0, step: { kind: 'setup' }, sightings: {}, board, events: [] }, frame,
      { i: 2, day: 15, minute: 15 * 1440 + 360, t: 30, step: { kind: 'dawn' }, sightings: {}, board: structuredClone(board), events: [] }];
    freeze(frames);
    const plan = planShow(frame, board), scene = plan.scenes.find(s => s.kind === 'missed' && s.publicActors.includes(id));
    const player = createShowPlayer(frames), home = addressesFor(board.agents.map(a => a.id))[id];
    const points = [scene.start, (scene.start + scene.end) / 2, scene.end, scene.end + .1,
      plan.end, plan.end + .1, 15 * 1440, 15 * 1440 + 361];
    for (const minute of [...points, ...points.slice().reverse()]) {
      const state = player.seek(minute), rows = planner.targetsAt(state, minute), row = rows.find(a => a.agent === id);
      if (minute < plan.end) property(state.board === board, 'eviction comes from the held preceding board');
      equal([row.reason, row.cityPlace, row.lot], minute < scene.end ? ['docks', 'docks', null] : ['heap', 'heap', null],
        'evicted missed agent stays at docks through scene, then rests at Heap through day 15');
      property(rows.find(a => a.agent === 'jailed-missed').reason === 'jail', 'jail takes precedence over eviction for missed agents');
      const drawn = { agents: rows.filter(a => !invisible(a)), fights: [] };
      property(checkDrawn(state, minute, drawn).ok, 'draw seam accepts evicted missed agent at its current place');
      if (minute < scene.end) continue;
      const agents = drawn.agents.map(a => a.agent === id ? { agent: id, cityPlace: home.home, lot: home.lot } : a);
      const result = checkDrawn(state, minute, { ...drawn, agents });
      if (fault === 'evicted-missed-home') property(result.ok, `evicted-missed-home: ${result.errors.join('; ')}`);
      else property(!result.ok, 'draw seam rejects evicted missed agent at its old home after scene');
    }
    console.log('constructed eviction: docks through missed scene; Heap after scene/close/night/day 15; jail precedence and reverse seeks PASS');
  }
  function checkFinale(frames, plan, planner, seed) {
    const player = createShowPlayer(frames), routines = createRoutinePlanner(frames), leave = plan.scenes.find(s => s.kind === 'ferry').beats.find(b => b.name === 'leave');
    const firstBoard = Math.min(...plan.scenes.filter(s => s.kind === 'board' && s.beat === 'finale').map(s => s.start));
    const frame = frames[plan.frame], boarded = frame.events.filter(e => e.type === 'board' && e.day === 14).map(e => e.agent);
    let subjects = 0;
    for (const scene of plan.scenes) for (const beat of scene.beats ?? []) {
      const minute = (beat.start + beat.end) / 2, state = player.seek(minute), rows = planner.targetsAt(state, minute);
      for (const id of scene.publicActors) {
        const row = rows.find(t => t.agent === id);
        property(row && row.cityPlace === scene.place.cityPlace && row.lot === scene.place.lot,
          `seed ${seed} finale beat midpoint ${scene.id}/${beat.name} places ${id} at ${scene.place.cityPlace}`);
        subjects++;
      }
    }
    for (const a of plan.scenes) for (const b of plan.scenes) {
      if (a.id >= b.id || a.end <= b.start || b.end <= a.start) continue;
      property(!a.publicActors.some(id => b.publicActors.includes(id)) || same(a.place, b.place), 'one finale place per named agent at a time');
    }
    for (const minute of [leave.start, (leave.start + leave.end) / 2, leave.end, plan.end, plan.end + .1, 15 * 1440 + 361]) {
      const state = player.seek(minute), rows = planner.targetsAt(state, minute);
      equal(rows, planner.targetsAt(state, minute, routines), 'day routines cannot bring departed agents back');
      property(boarded.every(id => rows.find(t => t.agent === id)?.reason === 'departed'), 'boarded agents remain absent through close, night and day 15');
      const drawn = { agents: rows.filter(t => !invisible(t)), fights: isShow(state, minute) ? planner.fightsAt(state, 14) : [] };
      property(checkDrawn(state, minute, drawn).ok, 'draw seam accepts omitted departed walkers');
      const id = boarded[0], home = addressesFor(state.board.agents.map(a => a.id))[id];
      property(!checkDrawn(state, minute, { ...drawn, agents: [...drawn.agents,
        { agent: id, cityPlace: home.home, lot: home.lot }] }).ok, 'draw seam rejects a visible departed walker at every departure boundary');
    }
    if (['boarded-island', 'boarding-home', 'jailed-docks'].includes(fault)) {
      const minute = fault === 'boarded-island' ? leave.start + .1 : firstBoard + .5;
      const state = player.seek(minute), rows = planner.targetsAt(state, minute);
      const chosen = rows.find(t => fault === 'boarded-island' ? t.reason === 'departed' : fault === 'jailed-docks' ? t.reason === 'jail' : t.cityPlace === 'docks');
      property(!!chosen, `${fault} fixture reached`);
      const home = addressesFor(state.board.agents.map(a => a.id))[chosen.agent];
      const agents = rows.filter(t => !invisible(t) && t.agent !== chosen.agent);
      agents.push({ agent: chosen.agent, cityPlace: fault === 'jailed-docks' ? 'docks' : home.home,
        lot: fault === 'jailed-docks' ? null : home.lot });
      const result = checkDrawn(state, minute, { agents, fights: planner.fightsAt(state, 14) });
      property(result.ok, `${fault}: ${result.errors.join('; ')}`);
    }
    console.log(`finale seed ${seed}: ${subjects}/${subjects} named beat midpoints, no overlapping places, leave/close/night/day-15 absence PASS`);
  }
  try {
    ensure(404);
    if (!fault) {
      for (const name of ['lookahead', 'jail-home', 'hooded-place', 'boarded-island', 'boarding-home', 'jailed-docks', 'evicted-missed-home']) {
        const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--fault', name], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(r.status, 1, `${name} must fail`);
        assert.match(r.stderr, /PROPERTY/, `${name} must fail a placement property`);
        if (['boarded-island', 'boarding-home', 'jailed-docks', 'evicted-missed-home'].includes(name)) property(r.stderr.includes(`PROPERTY ${name}:`), `${name} control reaches its own property: ${r.stderr.trim()}`);
        console.log(`CONTROL ${name}: ${r.stderr.trim()}`);
      }
      checkTable(); synthetic();
    }
    const planner = await planners();
    if (!fault || fault === 'evicted-missed-home') checkEvictedMissed(planner);
    let addressBook;
    for (const seed of fault ? [fault === 'jailed-docks' ? 406 : 404] : [404, 405, 406]) {
      ensure(seed);
      const frames = freeze(parseFeed(fs.readFileSync(fileOf(seed), 'utf8'))), before = JSON.stringify(frames);
      const player = createRecordPlayer(frames), repeat = createRecordPlayer(parseFeed(fs.readFileSync(fileOf(seed), 'utf8')));
      const staged = createShowPlayer(frames), stagedRepeat = createShowPlayer(parseFeed(fs.readFileSync(fileOf(seed), 'utf8')));
      const finaleFrame = frames.find(f => f.step.kind === 'night' && f.day === 14);
      const preceding = frames.slice(0, finaleFrame.i).findLast(f => f.board !== undefined).board;
      const finale = planShow(finaleFrame, preceding);
      const book = addressesFor(frames[0].board.agents.map(a => a.id));
      if (addressBook) equal(book, addressBook, 'addresses stable across seeds');
      addressBook = book;
      const points = [...new Set([0, ...frames.flatMap(f => [f.minute, f.minute - .25]),
        ...frames.filter(f => f.step.kind === 'night').flatMap(f => [showMinute(f.day) - .25, showMinute(f.day), showMinute(f.day) + 7, showMinute(f.day) + SHOW_MINUTES]),
        ...finale.scenes.flatMap(s => [s.start, s.end, ...(s.beats ?? []).map(b => (b.start + b.end) / 2)]),
        finale.end + .1, 15 * 1440 + 361])].filter(m => m >= 0).sort((a, b) => a - b);
      let shows = 0, fightCount = 0, jailed = 0;
      for (const minute of points) {
        const state = { ...(minute >= finale.start ? staged : player).seek(minute), minute };
        const prefix = at(frames.filter(f => f.minute <= minute), minute);
        let targets;
        try {
          // Plant one true next-frame read, including its future board and forms.
          const next = minute >= frames[0].minute && frames.find(f => f.minute > minute);
          const input = fault === 'lookahead' && next ? at(frames, Math.max(next.minute, next.day * 1440 + (next.step.kind === 'night' ? 1265 : 0))) : state;
          targets = planner.targetsAt(input, minute);
        } catch (e) { throw new Error(`PROPERTY no look-ahead at minute ${minute}: ${e.message}`); }
        equal(targets, planner.targetsAt(prefix, minute), `seed ${seed} cut at ${minute} gives same targets`);
        equal(targets, planner.targetsAt({ ...(minute >= finale.start ? stagedRepeat : repeat).seek(minute), minute }, minute), `seed ${seed} deterministic targets at ${minute}`);
        checkTargets(state, minute, targets, finale);
        for (const f of frames.filter(f => f.step.kind === 'night' && minute === showMinute(f.day) - .25)) {
          equal(planner.fightsAt(state, f.day), [], 'no fight scene before its show');
        }
        if (isShow(state, minute)) {
          const fights = planner.fightsAt(state, state.reveal.night);
          equal(fights, planner.fightsAt(prefix, prefix.reveal.night), 'fight suffix independence');
          equal(fights, planner.fightsAt(state, state.reveal.night), 'deterministic fights');
          checkFights(state, fights);
          if (minute === showMinute(state.reveal.night)) {
            shows++; fightCount += fights.length; jailed += state.board.agents.filter(a => a.jailed).length;
            property(checkDrawn(state, minute, { agents: targets, fights }).ok, 'page checks the same targets/fights');
            if (fights.some(f => f.sides.some(s => s.hooded))) {
              const bad = structuredClone(fights), side = bad.find(f => f.sides.some(s => s.hooded)).sides.find(s => s.hooded);
              side.ids = ['PLANTED_ATTACKER'];
              property(!checkDrawn(state, minute, { agents: targets, fights: bad }).ok, 'page rejects named hooded attacker');
            }
          }
        }
      }
      checkFinale(frames, finale, planner, seed);
      equal(JSON.stringify(frames), before, 'feed unmodified');
      console.log(`seed ${seed}: ${frames.length} frames, ${points.length} prefix/repeat points, ${shows} shows, ${fightCount} fights, ${jailed} jailed show targets PASS`);
    }
    console.log('PLACECHECK PASS');
  } catch (e) { console.error(`PLACECHECK FAIL${fault ? ` (${fault})` : ''}: ${e.message}`); process.exitCode = 1; }
}

if (typeof process !== 'undefined' && process.argv?.[1] && new URL(import.meta.url).pathname === process.argv[1]) await run();
