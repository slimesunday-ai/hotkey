// Public feed -> store. No rules, lens, event-text parsing, or reconstruction of holdings.
// Frames replace the board/sightings; an event's latest disclosed form replaces its id.
export function parseFeed(text) {
  const frames = text.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`feed line ${i + 1}: invalid JSON`); }
  });
  if (!frames.length) throw new Error('empty record feed');
  let minute = -Infinity;
  const ids = new Set();
  for (const [i, f] of frames.entries()) {
    if (f.i !== i || !Number.isFinite(f.minute) || f.minute < minute || !Number.isFinite(f.t)
      || !['setup', 'errand', 'night', 'dawn'].includes(f.step?.kind) || !Array.isArray(f.events)
      || !f.sightings || !Number.isInteger(f.day) || (i === 0 && !f.board)) throw new Error(`invalid feed frame ${i}`);
    for (const e of f.events) {
      if (!Number.isInteger(e.id) || e.id < 0 || (!ids.has(e.id) && e.id !== ids.size)
        || e.minute !== f.minute || typeof e.type !== 'string' || 'n' in e || 'vis' in e) throw new Error(`invalid event in frame ${i}`);
      ids.add(e.id);
    }
    minute = f.minute;
  }
  return frames;
}

export function createRecordAdapter() {
  const events = new Map();
  let state;
  function reset() {
    events.clear();
    state = { frame: null, board: null, events: [], sightings: {}, day: null, nightsLeft: null, midseason: null, over: null };
  }
  function apply(frame) {
    for (const e of frame.events) events.set(e.id, e);
    state = { frame: { i: frame.i, t: frame.t, step: frame.step, minute: frame.minute },
      board: frame.board === undefined ? state.board : frame.board, events: [...events.values()],
      sightings: frame.sightings, day: frame.day, nightsLeft: frame.nightsLeft, midseason: frame.midseason, over: frame.over };
    return state;
  }
  reset();
  return { apply, reset, snapshot: () => state };
}

// Compatibility names keep their meaning. Absent presentation and retired-game facts stay absent.
export function publicCards(state) {
  return (state.board?.agents || []).map(a => {
    const said = state.board.outloud?.filter(line => line.agent === a.id).at(-1);
    return { ...a, handle: a.id, cls: a.trade, model: a.driver, wear: a.fit,
      status: a.jailed ? 'jail' : 'active', mood: a.walk, ...(said ? { lastSay: said.line } : {}) };
  });
}

export function cityEvent(e) {
  const who = e.agent ?? e.from ?? e.a;
  const to = e.to ?? e.target ?? e.b;
  const at = e.place ?? e.corner;
  return { ...e, coreT: e.t, t: e.minute, ...(who === undefined ? {} : { who }),
    ...(to === undefined ? {} : { to }), ...(at === undefined ? {} : { at }) };
}

export function islandClock(minute) {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440, hh = Math.floor(m / 60);
  return { t: minute, day: Math.floor(minute / 1440), hhmm: `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    night: hh >= 20 || hh < 6 };
}
