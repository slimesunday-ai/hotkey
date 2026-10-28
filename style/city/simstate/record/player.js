import { createRecordAdapter } from './adapter.js';
import { writeClock } from './clock.js';

export const SPEEDS = Object.freeze([1, 10, 60]);
export const SHOW_MINUTES = 15;
export const showMinute = night => night * 1440 + 1265;
// C1-2 compatibility timing. C1-6's explicit showPlanner option supplies staged
// event cues and holds the complete board until the close; no board is inferred.
export const revealAt = frame => frame.step.kind === 'night' ? Math.max(frame.minute, showMinute(frame.day)) : frame.minute;

export function createRecordPlayer(frames, { speed = 1, running = false, onChange = () => {}, clock = null, showPlanner = null } = {}) {
  if (!frames.length) throw new Error('empty record feed');
  if (!SPEEDS.includes(speed)) throw new RangeError('speed must be 1, 10 or 60');
  const adapter = createRecordAdapter(), clocks = new Set(clock ? [clock] : []), listeners = new Set([onChange]);
  const shows = frames.filter(f => f.step.kind === 'night').map(f => ({ night: f.day, minute: showMinute(f.day), publishedAt: f.minute,
    ...(showPlanner ? { end: showPlanner.night(f.day).end } : {}) }));
  // (C1-7: a record ending at day 15's dawn keeps the mint's presentation tail on the clock, show-plan.js planner.day(15).end)
  const last = frames.at(-1), tail = showPlanner?.day && last.step.kind === 'dawn' && last.day === 15 ? [showPlanner.day(15).end] : [];
  const bounds = Object.freeze({ from: frames[0].minute, to: Math.max(...frames.map(revealAt), ...shows.map(s => s.end ?? s.minute), ...tail) });
  let minute = bounds.from, cursor = 0, epoch = 0, mode = 'season', reveal = null, pending = null;
  function sync() { for (const c of clocks) writeClock(c, minute, { speed, running, epoch }); }
  function snapshot() { return { ...adapter.snapshot(), minute, reveal, ...(showPlanner ? { show: showPlanner.at(minute) } : {}) }; }
  function publish(reset = false) { sync(); for (const fn of listeners) fn(snapshot(), { reset, epoch, speed, running, mode }); }
  function consumeStaged(reset) {
    if (reset) { adapter.reset(); cursor = 0; reveal = null; pending = null; }
    let changed = reset;
    while (cursor < frames.length && minute >= revealAt(frames[cursor])) {
      const frame = frames[cursor];
      if (frame.step.kind !== 'night') { adapter.apply({ ...frame }); cursor++; changed = true; continue; }
      if (!pending) {
        const plan = showPlanner.night(frame.day), times = new Map([[plan.start, [...plan.openingIds]]]);
        for (const scene of plan.scenes) times.set(scene.end, [...(times.get(scene.end) || []), ...scene.revealIds]);
        pending = { plan, before: adapter.snapshot(), index: 0, ids: [],
          cues: [...times].sort((a, b) => a[0] - b[0]) };
      }
      while (pending.index < pending.cues.length && pending.cues[pending.index][0] <= minute) {
        const [at, ids] = pending.cues[pending.index++];
        pending.ids = [...pending.ids, ...ids];
        if (at === pending.plan.end) adapter.apply({ ...frame });
        else adapter.apply({ ...frame, board: undefined, events: frame.events.filter(e => ids.includes(e.id)),
          sightings: pending.before.sightings, nightsLeft: pending.before.nightsLeft,
          midseason: pending.before.midseason, over: pending.before.over });
        reveal = { night: frame.day, frame: frame.i, minute: frame.minute,
          start: pending.plan.start, end: pending.plan.end, revealIds: pending.ids };
        changed = true;
      }
      if (pending.index < pending.cues.length) break;
      pending = null; cursor++;
    }
    sync();
    if (changed) publish(reset);
  }
  function consume(reset = false) {
    if (showPlanner) { consumeStaged(reset); return; }
    if (reset) { adapter.reset(); cursor = 0; reveal = null; }
    let changed = reset;
    while (cursor < frames.length && revealAt(frames[cursor]) <= minute) {
      const frame = frames[cursor++];
      adapter.apply(frame);
      if (frame.step.kind === 'night') reveal = { night: frame.day, frame: frame.i, minute: frame.minute,
        start: showMinute(frame.day), revealIds: frame.events.map(e => e.id) };
      changed = true;
    }
    sync();
    if (changed) publish(reset);
  }
  function seek(to) {
    if (!Number.isFinite(to)) throw new RangeError('seek minute must be finite');
    minute = Math.max(0, Math.min(bounds.to, to)); epoch++;
    consume(true);
    return snapshot();
  }
  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('elapsed seconds must be nonnegative');
    if (!running) { sync(); return snapshot(); }
    let left = seconds * speed / 60;
    if (mode === 'shows') {
      while (left > 0 && running) {
        const index = shows.findIndex(s => minute >= s.minute && minute < (s.end ?? s.minute + SHOW_MINUTES));
        if (index < 0) { running = false; break; }
        const end = shows[index].end ?? shows[index].minute + SHOW_MINUTES, step = Math.min(left, end - minute);
        minute += step; left -= step; consume();
        if (minute >= end) {
          if (index + 1 < shows.length) seek(shows[index + 1].minute);
          else running = false;
        }
      }
    } else {
      minute = Math.min(bounds.to, minute + left);
      if (minute >= bounds.to) running = false;
      consume();
    }
    sync();
    return snapshot();
  }
  // Night numbers remain jumpable; duration belongs to the public night frame.
  function publicShows() {
    return shows.map(({ publishedAt, end, ...show }) => ({ ...show,
      ...(end !== undefined && minute >= publishedAt ? { end } : {}) }));
  }
  const player = {
    bounds, shows: publicShows, snapshot, seek, advance,
    get minute() { return minute; }, get speed() { return speed; }, get running() { return running; }, get mode() { return mode; },
    setSpeed(value) {
      if (!SPEEDS.includes(value)) throw new RangeError('speed must be 1, 10 or 60');
      speed = value; publish();
    },
    play() { running = minute < bounds.to; publish(); },
    pause() { running = false; publish(); },
    jumpShow(night) {
      const s = shows.find(s => s.night === night);
      if (!s) throw new RangeError(`no show for night ${night}`);
      mode = 'season'; return seek(s.minute);
    },
    playShows(night = shows[0]?.night) {
      player.jumpShow(night); mode = 'shows'; running = true; publish();
    },
    playSeason() { mode = 'season'; player.play(); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    attachClock(c) { clocks.add(c); sync(); return () => clocks.delete(c); },
  };
  consume();
  return player;
}
