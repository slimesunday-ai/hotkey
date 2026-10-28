// HUMAN LAYER · SECTION 3a · THE NEWS, as data: which events make the city's news, how they read, how they weigh. Pure JS (no DOM): the
// ticker, City TV and tools/infocheck.mjs all read it.
//   LIVE     the public log (sim.events()): what a witness on the street could know — robberies (unseen robbers unnamed), arrests,
//            deaths, marks, turf, the Director, the drop. Never a private event: the store's lens already removed them, and newsOf()
//            drops anything private again (a second lock).
//   TAPE     the director's cut (tape.events(), up to the horizon): the same stories with their names back (the burglar, the unseen
//            robber), plus the tape-only ones (bribes, tips, scams). Those are flagged tape: true and wear the TAPE colour.
import { publicEvent, cityEvents } from '../../simstate/lens.js';

// kinds: the colour of a story (kit tokens: the tape's six marker colours + three of 3a's own, defined in city-info.css)
export const KIND = {
  rob: { label: 'Robbery', token: '--k-ev-rob' }, burgle: { label: 'Break-in', token: '--k-ev-rob' }, arrest: { label: 'Police', token: '--k-ev-arrest' },
  death: { label: 'Death', token: '--k-ev-death' }, hurt: { label: 'Hospital', token: '--k-ev-death' }, mark: { label: 'Mark', token: '--k-ev-mark' },
  turf: { label: 'Turf', token: '--k-ev-turf' }, crew: { label: 'Crews', token: '--k-ev-turf' }, director: { label: 'The Director', token: '--k-ev-director' },
  drop: { label: 'The drop', token: '--ci-ev-drop' }, money: { label: 'Money', token: '--ci-ev-drop' }, city: { label: 'City', token: '--ci-ev-city' },
  secret: { label: 'On tape', token: '--k-tape' },
};
const TYPE = { rob: 'rob', burgle: 'burgle', arrest: 'arrest', warrant: 'arrest', bounty: 'arrest', raid: 'arrest', bail: 'arrest', death: 'death', killed: 'death', hospital: 'hurt',
  mark: 'mark', turf: 'turf', locals_out: 'turf', crew: 'crew', rug: 'crew', crew_payback: 'crew', director: 'director', drop: 'drop', trend: 'drop', claim: 'money', loan_late: 'money',
  loan_bounty: 'money', loan_collect: 'money', evicted: 'money', exposed: 'money', hire: 'money', hire_end: 'money', day: 'city', system: 'city', bribe: 'secret', tip: 'secret', scam: 'secret' };
// how big a story is (City TV's "top stories": weight, then the newest)
const WEIGHT = { death: 10, killed: 10, locals_out: 9, rug: 8, evicted: 8, bounty: 7, loan_bounty: 7, arrest: 7, raid: 7, turf: 6, rob: 6, director: 5, burgle: 5, exposed: 5,
  crew_payback: 4, warrant: 4, bribe: 6, scam: 6, tip: 5, hospital: 3, crew: 3, claim: 2, loan_late: 2, mark: 2, drop: 2, day: 1, system: 1 };
export const kindOf = e => e.type === 'director' ? 'director' : TYPE[e.type] || null;
export const weightOf = e => (WEIGHT[e.type] ?? 1) + (e.card ? 1.5 : 0) + (e.type === 'rob' && e.ok === false ? -2 : 0);
const NEWS_TYPES = new Set(['mark', 'death', 'killed']), TAPE_ONLY = new Set(['bribe', 'tip', 'scam']);
const QUIET = new Set(['hire_end', 'trend', 'loan_collect']);   // (news, but not worth the crawl: the drop and the Director say it better)

// is this event the city's news? LIVE: a public event the sim flagged as news (or a mark, a death); TAPE: the same, plus the secret stories
export function isNews(e, { tape = false } = {}) {
  if (!e || !e.type || QUIET.has(e.type)) return false;
  if (tape && TAPE_ONLY.has(e.type)) return true;
  return e.news === true || NEWS_TYPES.has(e.type);
}
// the text a viewer reads: the sim's sentence, with its subject named when the sim leaves it out ("earned the mark FOUNDER" → "@x earned …")
export function textOf(e) {
  let t = String(e.text || '').trim(); if (!t) return '';
  if (e.type === 'drop') t = t.replace(/^FIT STREET DROP/, 'Fit Street drop').replace(/,? (\d+) made\)/g, ')');
  if (e.who && !/^(@|someone|the |a |an |[A-Z])/.test(t) && !t.includes('@' + e.who)) t = '@' + e.who + ' ' + t;
  return t;
}
// a sentence in parts: plain text and @handles (the UI makes the handles buttons)
const HANDLE = /@([A-Za-z0-9_][A-Za-z0-9_.\-]*[A-Za-z0-9_])/g;
export function partsOf(text) { const out = []; let k = 0, m; HANDLE.lastIndex = 0; while ((m = HANDLE.exec(text))) { if (m.index > k) out.push(text.slice(k, m.index)); out.push({ handle: m[1] }); k = m.index + m[0].length; } if (k < text.length) out.push(text.slice(k)); return out; }
// where it happened, for the camera: a place id, else a district, else the agent (null: nowhere to go)
export function whereOf(e) {
  if (e.at && typeof e.at === 'string') return e.type === 'turf' || e.type === 'locals_out' || (e.type === 'director' && e.kind === 'rush') ? { dist: e.at, place: e.at } : { place: e.at };
  if (e.type === 'drop') return { place: 'fitstreet' };
  const h = e.to && e.type !== 'death' ? e.to : e.who; return h && h !== 'shark' ? { handle: h } : null;
}
// TAPE: which stories the street didn't get (a secret one, or one whose names the lens hid). Judged over the whole list, as the lens
// judges it (a bounty after an arrest keeps its names in public; after an unseen robbery it doesn't): → (event) => boolean
export function tapeOnlyOf(events) { const pub = new Map(cityEvents((events || []).map(publicEvent).filter(Boolean)).map(e => [e.id, e]));
  return e => { if (e.secret || TAPE_ONLY.has(e.type)) return true; const p = pub.get(e.id); return !p || p.text !== e.text || p.who !== e.who || p.to !== e.to; }; }
// the stories: newest last. opt.tape: the director's cut (the events are the full ones); else LIVE (public events only, checked again)
export function newsOf(events, { tape = false } = {}) {
  const out = [], tapeOnly = tape ? tapeOnlyOf(events) : null;
  for (const e of events || []) {
    if (!isNews(e, { tape })) continue;
    if (!tape && (e.secret || !publicEvent(e))) continue;   // (LIVE: never a private event, whatever the source)
    const text = textOf(e); if (!text) continue;
    out.push({ id: e.id, t: e.t, ts: e.ts, type: e.type, kind: kindOf(e) || 'city', card: !!e.card, weight: weightOf(e), text, where: whereOf(e), who: e.who ?? null, to: e.to ?? null, tape: tape && tapeOnly(e) });
  }
  return out;
}
// the top stories of a span: by weight, then newest; one per subject (the same person's three robberies are one story)
export function topOf(stories, n = 5) {
  const seen = new Set(), out = [];
  for (const s of [...stories].sort((a, b) => b.weight - a.weight || b.t - a.t)) { const k = s.type + ':' + (s.who || s.to || s.text.slice(0, 24)); if (seen.has(k)) continue; seen.add(k); out.push(s); if (out.length >= n) break; }
  return out;
}
// the game clock's day of a minute, and its start (the calendar day: Day N runs 00:00–24:00; rent is at 06:00)
export const dayOf = t => Math.floor(t / 1440) + 1;
export const dayStart = t => Math.floor(t / 1440) * 1440;
const pad = n => String(n).padStart(2, '0');
export const hhmm = t => { const m = ((Math.floor(t) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
export const stamp = t => `Day ${dayOf(t)} · ${hhmm(t)}`;
export const dur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h ${pad(mm)}m` : `${mm}m`; };
// minutes to the next 06:00 (rent, salaries, the broke-and-homeless check: sim2/rules.mjs TIME.daily)
export const toRent = t => { const m = ((Math.floor(t) % 1440) + 1440) % 1440, d = 6 * 60 - m; return d > 0 ? d : d + 1440; };
// the Director's rush at minute t from the log (the tape: no cityEv there): { dist, until } | null. RUSH.hours: sim2/rules.mjs DIRECTOR.rush
export function rushAt(events, t, hours = 3) { for (let k = (events?.length || 0) - 1; k >= 0; k--) { const e = events[k]; if (e.t > t) continue; if (e.t < t - hours * 60) break; if (e.type === 'director' && e.kind === 'rush' && e.at) return { dist: e.at, until: e.t + hours * 60, text: e.text }; } return null; }
// yesterday's private stories for City TV in LIVE: the director's cut's events, never past the horizon (whatever a server sends)
export function yesterdayOf(events, horizon) { if (horizon === null || horizon === undefined) return []; const E = (events || []).filter(e => e.t <= horizon); return newsOf(E, { tape: true }).filter(s => s.tape && s.t <= horizon); }
