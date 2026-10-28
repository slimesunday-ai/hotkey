import { publicAt } from './placement.js';
import { createShowPlanner } from './show-plan.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const priority = scene => scene.beat === 'fight' ? 10 : scene.beat === 'arrest' ? 9
  : scene.kind === 'hooded' ? 6 : scene.kind === 'results' ? 1 : 3;
const required = scene => ['fight', 'arrest'].includes(scene.beat);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};

// Identity is a board lookup by id. Driver is an opaque core-owned label (model,
// owner, bot); neither names nor labels are parsed for facts or attribution.
export function captionSubjects(ids, board) {
  const roster = new Map((board?.agents ?? []).map(agent => [agent.id, agent]));
  return [...new Set(ids)].sort(compare).map(id => {
    const agent = roster.get(id);
    if (!agent) throw new Error(`caption subject absent from public board: ${id}`);
    return { id, name: agent.name ?? id, driver: agent.driver ?? null };
  });
}

// Scene kinds describe the public action, never its still-held outcome. The
// camera may show these fields at the cut's start; revealIds remain C1-6's job.
export function sceneCaption(scene, board) {
  return { kind: scene.kind, beat: scene.beat, place: scene.place.corePlace,
    subjects: captionSubjects(scene.publicActors, board), anonymousCount: scene.hoodedCount };
}

// The sole archive forecast used here is C1-6's already public-safe night plan.
// Reserve every full fight/arrest interval first; fit other scenes around it.
// A half-minute separation enforces <=2 cuts in ANY half-open rolling minute,
// including across civil minute boundaries. No hidden-value/stakes scoring.
export function planCuts(plan, board) {
  const mandatory = plan.scenes.filter(required).sort((a, b) => a.start - b.start || compare(a.id, b.id));
  for (let i = 1; i < mandatory.length; i++) {
    if (mandatory[i].start - mandatory[i - 1].start < .5 || mandatory[i].start < mandatory[i - 1].end) {
      throw new Error('show cannot cover every fight/arrest at two cuts per minute');
    }
  }
  const selected = [...mandatory];
  const optional = plan.scenes.filter(scene => !required(scene)).sort((a, b) =>
    priority(b) - priority(a) || a.start - b.start || compare(a.id, b.id));
  for (const scene of optional) {
    if (selected.some(other => Math.abs(other.start - scene.start) < .5
      || required(other) && scene.start >= other.start && scene.start < other.end)) continue;
    selected.push(scene);
  }
  selected.sort((a, b) => a.start - b.start || compare(a.id, b.id));
  const cuts = selected.map((scene, i) => ({ sceneId: scene.id, score: priority(scene),
    start: i === 0 ? plan.start : scene.start,
    end: selected[i + 1]?.start ?? plan.end,
    subjects: [...scene.publicActors], captionFields: sceneCaption(scene, board) }));
  // Moving the opening establishing shot earlier can only increase separation.
  return freeze(cuts);
}

export function cutAt(cuts, minute) {
  return cuts.find(cut => cut.start <= minute && minute < cut.end) ?? null;
}

// D6 is an explicit overlay, never a mutation of the live cut. Both clocks are
// supplied: the replay playhead cannot authorize disclosure at viewing time.
// Use ONLY an already-disclosed receipt that directly names this fight's actors.
// An ambiguous/missing receipt stays anonymous; no private back/group inference.
export function replayCut(cut, scene, plan, disclosed) {
  const events = publicAt(disclosed);
  if (disclosed.minute <= plan.end + 1440 || scene.beat !== 'fight' || !scene.hoodedCount) return cut;
  const fight = events.find(event => event.id === scene.eventId && event.type === 'fight');
  if (!fight) return cut;
  const type = scene.kind === 'hit' ? 'rob' : scene.kind === 'breakin' ? 'burgle' : null;
  if (!type) return cut;
  const receipts = events.filter(event => event.type === type && event.night === scene.night
    && event.target === fight.target && event.place === fight.place && Array.isArray(event.members));
  if (receipts.length !== 1) return cut;
  const receipt = receipts[0];
  const subjects = [...new Set([...cut.subjects, ...receipt.members])].sort(compare);
  return freeze({ ...cut, subjects, captionFields: { ...cut.captionFields,
    subjects: captionSubjects(subjects, disclosed.board), recordEventId: receipt.id,
    identityMode: 'disclosed-record' } });
}

// Convenience seam for the camera. All caches contain the live-safe version;
// a D6 overlay is requested separately using an as-of disclosed snapshot.
export function createCutPlanner(frames) {
  const shows = createShowPlanner(frames), cache = new Map();
  function night(n) {
    if (cache.has(n)) return cache.get(n);
    const plan = shows.night(n);
    let board = null;
    for (const frame of frames) {
      if (frame.i === plan.frame) break;
      if (frame.board !== undefined) board = frame.board;
    }
    const cuts = planCuts(plan, board); cache.set(n, cuts); return cuts;
  }
  function at(minute, disclosed = null) {
    if (!Number.isFinite(minute) || minute < 0) throw new RangeError('invalid cut minute');
    const n = Math.floor(minute / 1440);
    // Frame metadata is navigation only, not a forecast of a day's payloads.
    if (!frames.some(frame => frame.step.kind === 'night' && frame.day === n)
      || minute < n * 1440 + 1265) return null;
    const plan = shows.night(n), cut = cutAt(night(n), minute);
    if (!cut || !disclosed) return cut;
    return replayCut(cut, plan.scenes.find(scene => scene.id === cut.sceneId), plan, disclosed);
  }
  return { night, at };
}
