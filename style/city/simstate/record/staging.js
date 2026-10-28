import { SITES, ROUTES, placeIn } from './places.js';

const unique = ids => [...new Set(ids)].sort((a, b) => a - b);
const anchor = site => ({ corePlace: site.corePlace, cityPlace: site.cityPlace,
  district: site.district, standPlace: site.standPlace, lot: null });

// The finale's shared presentation boundaries. Placement reads these same
// intervals; it never maintains another boarding or departure clock.
export function finaleTiming(start, end) {
  return { walk: { start: start + .125, end: start + 3 },
    focus: { start: start + 3.25, end: start + 9.75 },
    boarding: { start: start + 10, end: start + 13 },
    leave: { start: start + 13.25, end: start + 14 },
    missed: { start: start + 14, end: end - .25 } };
}

// These are presentation intervals, not clip clocks or rule outcomes. The
// drawing maps names to its clips, props, spots and chains (clips/*.md).
function beats(scene, names, sources = scene.eventIds) {
  const width = (scene.end - scene.start) / names.length;
  scene.beats = names.map((name, i) => ({ name,
    start: scene.start + width * i,
    end: i === names.length - 1 ? scene.end : scene.start + width * (i + 1),
    eventIds: [...sources] }));
}
function stage(scene, names, eventIds = [scene.eventId]) {
  scene.actors = [...scene.publicActors];
  scene.eventIds = unique(eventIds);
  beats(scene, names);
  return scene;
}

// Extend C1-6 rows only after their intervals have been assigned. No delayed
// play/work receipt or resulting board is an input to night staging. A public
// back's location is not proof of membership in a vault/grab group.
export function stageNight({ frame, show, scenes, add, visible, start, end, board }) {
  const events = frame.events.filter(e => ['fight', 'arrest', 'board', 'missed'].includes(e.type));
  const current = events.filter(e => e.night === frame.day);
  const atSet = kind => Object.entries(show.plays).filter(([, p]) => p.kind === kind).map(([id]) => id).sort();
  for (const scene of scenes) {
    if (scene.beat === 'ambient' && scene.publicActors.length === 1) {
      const play = show.plays[scene.publicActors[0]];
      if (!play) continue;
      if (play.kind === 'vault') stage(scene, ['arrive', 'lookout'], [show.id]);
      else if (play.kind === 'guard') stage(scene, ['post'], [show.id]);
      else if (play.kind === 'grab') stage(scene, ['converge'], [show.id]);
      else if (play.kind === 'build') stage(scene, ['clamp', 'hammer', 'file', 'fit', 'assemble'], [show.id]);
      else if (play.kind === 'cook') stage(scene, play.place === 'forest'
        ? ['stir', 'pour', 'fan', 'check'] : ['stir', 'pour', 'stir', 'check'], [show.id]);
      else if (play.kind === 'run') stage(scene, play.place === 'forest'
        ? ['dig', 'unearth', 'carry'] : play.place === 'docks'
          ? ['container', 'lift', 'carry'] : ['search', 'pick_up', 'carry'], [show.id]);
    } else if (scene.beat === 'fight') {
      const event = current.find(e => e.id === scene.eventId);
      if (event.kind === 'vault' || event.kind === 'grab') {
        // Public co-presence, not sides, leadership, acceptance or a winner id.
        scene.publicActors = [...new Set([...atSet(event.kind),
          ...(event.kind === 'vault' ? atSet('guard') : [])])].filter(visible).sort();
        if (event.kind === 'vault') scene.roles = { jobbers: atSet('vault'), guards: atSet('guard') };
        stage(scene, event.kind === 'vault'
          ? ['shove', ...(event.won ? ['drill', 'heave', 'carry'] : ['struggle'])]
          : ['scramble', ...(event.won ? ['tug', 'ram', 'carry'] : ['struggle'])], [show.id, event.id]);
      }
    } else if (scene.beat === 'arrest') {
      const event = current.find(e => e.id === scene.eventId);
      if (event.why === 'fight' && show.plays[event.agent]?.kind === 'vault') scene.place = anchor(SITES.vault);
      stage(scene, ['cuff', 'escort'], [show.id, scene.eventId]);
    }
  }
  function arrivals() {
    for (const scene of scenes.filter(s => s.beat === 'ambient' && ['vault', 'grab', 'guard'].includes(s.kind))) {
      const fight = scenes.find(s => s.beat === 'fight' && s.kind === (scene.kind === 'guard' ? 'vault' : scene.kind));
      if (!fight) continue;
      scene.start = start + .125; scene.end = fight.start;
      beats(scene, scene.beats.map(b => b.name));
    }
  }
  if (frame.day !== 14) { arrivals(); return; }
  const timing = finaleTiming(start, end);

  // One city-owned running order: walks, route fights, arrests, boarding,
  // departure, missed boat, closing results. Existing fight/arrest rows retain
  // their identities and single-event reveal cues, in the same serial order.
  const focus = scenes.filter(s => ['fight', 'arrest'].includes(s.beat));
  focus.forEach((scene, i) => {
    const width = (timing.focus.end - timing.focus.start) / focus.length;
    scene.start = timing.focus.start + i * width;
    scene.end = scene.start + width * .8;
    if (scene.beat === 'fight') {
      const event = current.find(e => e.id === scene.eventId);
      scene.route = event.place;
      stage(scene, ['fight', ...(scene.beats?.map(b => b.name) ?? [])], scene.eventIds ?? [show.id, event.id]);
    } else beats(scene, scene.beats.map(b => b.name));
  });
  arrivals();
  const boarded = events.filter(e => e.type === 'board' && e.day === 14);
  const missed = events.filter(e => e.type === 'missed' && e.day === 14);
  function afterVault(scene, agent) {
    if (show.plays[agent]?.kind !== 'vault') return;
    // GAME §15: job the vault, THEN run through Glasswall. The existing job
    // end and the boarding window bound its walk, with no new clock.
    const job = scenes.filter(s => s !== scene && s.kind === 'vault' && s.publicActors.includes(agent));
    scene.start = Math.max(...job.map(s => s.end));
    scene.end = timing.boarding.start;
    beats(scene, ['walk', 'arrive']);
  }
  function walk(event, route) {
    // A public back walks too: reuse its ambient row rather than giving it
    // simultaneous back-place and route-place appearances.
    let scene = scenes.find(s => s.beat === 'ambient' && ['board', 'back'].includes(s.kind) && s.publicActors.includes(event.agent));
    if (!scene) scene = add(show.id, `walk:${event.id}`, 'walk', 'finale', placeIn(ROUTES, route),
      [event.agent], visible(event.agent) ? 0 : 1);
    scene.place = anchor(placeIn(ROUTES, route));
    scene.route = route; scene.start = timing.walk.start; scene.end = timing.walk.end;
    stage(scene, ['walk', 'arrive'], [show.id, event.id]);
    return scene;
  }
  boarded.forEach((event, i) => {
    const routeWalk = walk(event, event.route);
    const scene = add(event.id, `board:${event.id}`, 'board', 'finale', SITES.ferry,
      [event.agent], visible(event.agent) ? 0 : 1, [event.id]);
    scene.route = event.route;
    const width = (timing.boarding.end - timing.boarding.start) / Math.max(1, boarded.length);
    scene.start = timing.boarding.start + i * width; scene.end = scene.start + width * .9;
    stage(scene, ['queue', 'gangway'], [event.id]);
    afterVault(routeWalk, event.agent);
  });
  const departure = add(show.id, 'ferry', 'ferry', 'finale', SITES.ferry);
  departure.start = timing.leave.start; departure.end = timing.leave.end;
  stage(departure, ['leave'], [show.id, ...boarded.map(e => e.id), ...missed.map(e => e.id)]);
  missed.forEach(event => {
    const route = show.seen[event.agent];
    const precedingJail = board?.agents.find(a => a.id === event.agent)?.jailed;
    const jailed = precedingJail || current.some(e => e.type === 'arrest' && e.agent === event.agent);
    if (Object.hasOwn(ROUTES, route) && !precedingJail && !(jailed && show.plays[event.agent]?.kind === 'vault')) {
      afterVault(walk(event, route), event.agent);
    }
    const scene = add(event.id, `missed:${event.id}`, 'missed', 'finale', jailed ? SITES.jail : SITES.ferry,
      [event.agent], visible(event.agent) ? 0 : 1, [event.id]);
    if (Object.hasOwn(ROUTES, route)) scene.route = route;
    scene.start = timing.missed.start; scene.end = timing.missed.end;
    stage(scene, ['missed'], [event.id]);
  });
}

// Day 15 is its own publication window, never a flash-forward inside night 14.
// Mint subjects come from this dawn's typed receipts, not the prior board or a
// prediction of what a boarded agent will mint. No card contents enter scenes.
export function planMint(frame) {
  if (frame.day !== 15 || frame.step.kind !== 'dawn') throw new TypeError('mint needs day-15 dawn');
  const events = frame.events.filter(e => e.type === 'mint');
  const start = frame.minute, end = start + 3;
  const scenes = events.map(event => stage({ id: `mint:${event.id}`, night: null,
    eventId: event.id, kind: 'mint', beat: 'mint', place: anchor(SITES.ferry), start, end,
    publicActors: [event.agent], hoodedCount: 0, revealIds: [] }, ['mint'], [event.id]));
  return { day: 15, frame: frame.i, start, end, scenes };
}
