// Display windows only. The record selectors still own fields, subjects, scope,
// wording and disclosure; only presented events can enter a window. Keep one
// window snapshot for the refresh so their wording cache is shared by panels.
import { publicAt } from '../../simstate/record/placement.js';
import { EVENT_KINDS, scopeOf, subjectsOf } from '../../simstate/record/panel-events.js';

export const ROWS = 40, TIES = 16, LIVE = 12, RECORD = 5;
const kinds = new Set(EVENT_KINDS), forms = new WeakMap();
function formsOf(event) {
  if (forms.has(event)) return forms.get(event);
  const scope = scopeOf(event);
  const pub = scope === 'public' ? event : event.card
    ? { id: event.id, type: 'card', t: event.t, day: event.day, minute: event.minute, card: event.card } : null;
  const value = { public: pub && kinds.has(pub.type) ? pub : null,
    record: scope === 'record' && kinds.has(event.type) ? event : null };
  forms.set(event, value); return value;
}
const subjects = new WeakMap();
function namesOf(event) {
  if (!subjects.has(event)) subjects.set(event, subjectsOf(event));
  return subjects.get(event);
}
const windows = new WeakMap();
export function windowAt(snapshot, agent = null) {
  if (snapshot.uiWindow) return snapshot;
  let cache = windows.get(snapshot);
  if (!cache) { cache = new Map(); windows.set(snapshot, cache); }
  if (cache.has(agent)) return cache.get(agent);
  const events = publicAt(snapshot, snapshot.minute), live = [], record = [];
  for (const event of events) {
    const f = formsOf(event);
    if (f.public) live.push(event);
    if (f.record) record.push(event);
  }
  const show = snapshot.show, shown = new Set(show && snapshot.reveal?.night === show.night ? snapshot.reveal.revealIds : []);
  const ticker = [...live.slice(-LIVE), ...record.slice(-RECORD)];
  const ch9 = [...(show ? live.filter(e => shown.has(e.id)) : live).slice(-20), ...live.slice(-4), ...record.slice(-2)];
  const selected = new Set([...ticker, ...ch9]);
  const counts = { rap: 0, public: 0, record: 0 }, dossier = [];
  if (agent) {
    const roster = new Set((snapshot.board?.agents ?? []).map(a => a.id));
    for (const scope of ['public', 'record']) {
      const own = [], ties = [];
      for (const event of scope === 'public' ? live : record) {
        const form = formsOf(event)[scope], ids = namesOf(form);
        if (!ids.includes(agent)) continue;
        own.push(event);
        for (const id of ids) if (id !== agent && roster.has(id)) ties.push(event);
      }
      if (scope === 'public') counts.rap = own.length;
      counts[scope] = ties.length;
      dossier.push(...own.slice(-ROWS), ...ties.slice(-TIES));
      // The exact last holdings receipt is displayed even outside the window.
      if (scope === 'record') {
        const held = own.findLast(e => e.type === 'holdings' && e.agent === agent);
        if (held) dossier.push(held);
      }
    }
    for (const event of dossier) selected.add(event);
  }
  // Morning cards remain complete, including card-only -> receipt replacements.
  for (const event of events) if (event.card?.night === snapshot.day - 1) selected.add(event);
  const value = { ...snapshot, events: events.filter(e => selected.has(e)),
    uiWindow: { ticker, ch9, dossier, counts } };
  cache.set(agent, value); return value;
}

export const sameInputs = (a, b) => !!a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

// One failed panel must never prevent another panel from dropping later facts.
export function refreshPanels(sim, panels, agent = null, showOf = null) {
  const state = sim.record();
  // The store omits the stager's scene plan. Read its public banner once too.
  const snapshot = windowAt(showOf ? { ...state, show: showOf() } : state, agent);
  for (const [name, panel] of Object.entries(panels)) {
    try { panel.update(false, snapshot); } catch (error) { console.error(`[record ui: ${name}]`, error); }
  }
}
