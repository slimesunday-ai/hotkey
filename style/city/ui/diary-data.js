// HUMAN LAYER · SECTION 2b · THE DIARY ROOM, THE DATA (pure: no DOM; ui/tools/diarycheck.mjs runs it in node).
// One agent, one game day: a short confession from that day's thoughts (`think` on its own events) and the lines it said (`say`,
// DMs included: they are private, so they too wait for the tape). Everything here is PRIVATE, so the lens is enforced here too, not
// only by the server's clamp:
//   tape     (everyone)        only what is behind the horizon (now − delay); a day not yet on tape is `pending`; a day the horizon cuts
//                              through is `partial` (up to the horizon, the rest pending)
//   yours    (your own agent)   live: up to now
//   archive  (a finished season) everything
// diaryOf never returns a line newer than its limit, whatever events it is handed.
export const DAY = 1440, MAX_LINES = 7, MAX_CHARS = 150;
const CANNED = /^\((local|plan|fallback|auto)\)/i;
const isDM = e => e.type === 'say' && (e.dm === true || (typeof e.to === 'string' && e.to !== 'here'));

// opt: { lens: 'tape' | 'yours' | 'archive', horizon (tape: the newest minute on tape, or null: pending), now (yours) }
export function diaryOf(events, handle, day, opt = {}) {
  const t0 = (day - 1) * DAY, t1 = day * DAY - 1, lens = opt.lens || 'tape';
  const limit = lens === 'archive' ? Infinity : lens === 'yours' ? (opt.now ?? Infinity) : opt.horizon ?? null;
  const base = { handle, day, t0, t1, lens, lines: [], state: 'pending', upTo: null, total: 0 };
  if (limit === null || limit < t0) return base;
  const upTo = Math.min(t1, limit), all = [], seen = new Set();
  for (const e of events || []) {
    if (!e || e.who !== handle || typeof e.t !== 'number' || e.t < t0 || e.t > upTo) continue;
    if (e.type === 'say' && e.text) { const dm = isDM(e); all.push({ id: e.id, t: e.t, kind: dm ? 'dm' : 'say', to: dm ? e.to : null, text: clean(e.text) }); }
    if (e.think && !CANNED.test(e.think)) { const k = clean(e.think); if (!seen.has(k)) { seen.add(k); all.push({ id: e.id, t: e.t, kind: 'think', did: e.type, text: k }); } }
  }
  all.sort((a, b) => a.t - b.t || (a.kind === 'think' ? -1 : 1));
  // short and skippable: at most MAX_LINES, spread over the day, the spoken lines kept first (they are rarer and punchier)
  let pick = all;
  if (all.length > MAX_LINES) { const says = all.filter(l => l.kind !== 'think').slice(0, 3), rest = all.filter(l => l.kind === 'think'), want = MAX_LINES - says.length, step = rest.length / want;
    pick = [...says, ...Array.from({ length: want }, (_, k) => rest[Math.min(rest.length - 1, Math.floor(k * step + step / 2))])].sort((a, b) => a.t - b.t); }
  return { ...base, lines: pick, total: all.length, upTo, state: upTo >= t1 ? 'ok' : 'partial' };
}
function clean(s) {
  s = String(s).replace(/\s+/g, ' ').trim(); if (s.length <= MAX_CHARS) return s;
  const cut = s.slice(0, MAX_CHARS), stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 60 ? cut.slice(0, stop + 1) : cut.replace(/\s+\S*$/, '') + '…';
}
// the days an agent's diary can show (1 … the newest day that has started), and when a day reaches the tape
export const daysUpTo = now => Math.max(1, Math.floor(now / DAY) + 1);
export const opensAt = (day, delay) => day * DAY - 1 + delay;   // the game minute the whole day is behind the horizon
