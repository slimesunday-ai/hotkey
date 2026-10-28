// The city's public record (GAME.md §19/20/23). Visibility and every game fact belong to viewFor; this module only
// selects changed projections, gives published events local identities, and puts bench steps on the island clock.
import { viewFor } from './rules/view.mjs';

export const ISLAND = Object.freeze({ zone: 'America/New_York', day: 1440, dawn: 360, lock: 1260, show: 1265 });

// Equally spaced rounds strictly between dawn and the lock. With three rounds: 09:45, 13:30, 17:15 Eastern.
export function islandMinute(day, step, rounds = 3) {
  const hour = step.kind === 'night' ? ISLAND.lock : step.kind === 'errand' && step.round > 0
    ? ISLAND.dawn + Math.floor((ISLAND.lock - ISLAND.dawn) * step.round / (rounds + 1)) : ISLAND.dawn;
  return day * ISLAND.day + hour;
}

export function createFeed({ rounds = 3, saved = null } = {}) {
  let i = saved?.i ?? 0;
  const ids = new Map(saved?.ids || []);
  const forms = new Map(saved?.forms || []);
  let boardWas = saved?.board ?? null;
  let restWas = saved?.rest ?? null;

  function sample(state, log, step) {
    const view = viewFor(state, log, null, 'record');
    const minute = islandMinute(view.day, step, rounds);
    // Allocate all newly published identities before remapping references, including references within this batch.
    for (const e of view.events) if (!ids.has(e.n)) ids.set(e.n, ids.size);
    const events = [];
    for (const source of view.events) {
      const { n, ...e } = source;
      // `orders.of` is the rules' event-reference field. Unpublished references reveal neither an id nor a count;
      // if one becomes public later, the changed form is emitted again under the same local identity.
      if (e.type === 'orders') e.of = e.of.flatMap(ref => ids.has(ref) ? [ids.get(ref)] : []);
      const form = JSON.stringify(e);
      if (forms.get(n) === form) continue;
      forms.set(n, form);
      events.push({ id: ids.get(n), ...e, minute });
    }
    const board = JSON.stringify(view.board);
    const rest = { sightings: view.sightings, day: view.day, nightsLeft: view.nightsLeft, midseason: view.midseason, over: view.over };
    const restText = JSON.stringify(rest);
    if (!events.length && board === boardWas && restText === restWas) return null;
    const frame = { i: i++, t: view.clock, step: { ...step }, minute,
      ...(board === boardWas ? {} : { board: view.board }), events, ...rest };
    boardWas = board;
    restWas = restText;
    return frame;
  }

  // Private checkpoint data, never part of a frame. The runner commits it with the file's byte boundary each night.
  const save = () => ({ i, ids: [...ids], forms: [...forms], board: boardWas, rest: restWas });
  return { sample, save };
}
