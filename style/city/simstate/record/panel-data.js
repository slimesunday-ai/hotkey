import { publicAt } from './placement.js';
import { addressesFor } from './addresses.js';
import { CITY_PLACES, DISTRICTS, CORNERS } from './places.js';
import { boardAt } from './board-data.js';
import { recordSideAt } from './tape-data.js';
import { eventRow, scopeOf, subjectsOf, memoryFields } from './panel-events.js';

const CARD_FIELDS = Object.freeze('id name trade driver crew heat wanted jailed bail evicted tab boarded walk fit fitHidden'.split(' '));
const select = (value, fields) => Object.fromEntries(fields.filter(k => Object.hasOwn(value, k)).map(k => [k, value[k]]));
const roster = snapshot => snapshot.board?.agents ?? [];
const byId = (a, b) => a < b ? -1 : a > b ? 1 : 0;
// Presented snapshots and their feed fields are read-only (STORE.md). Share
// wording across the panels at that snapshot; a seek gets a new snapshot key.
const rowCache = new WeakMap();

export function homeAt(snapshot, agent, minute = snapshot.minute) {
  publicAt(snapshot, minute);
  const a = roster(snapshot).find(a => a.id === agent);
  if (!a) return null;
  const address = addressesFor(roster(snapshot).map(a => a.id))[agent];
  return { address, evicted: a.evicted,
    sources: { address: 'addressesFor(board.agents[].id)', evicted: `board.agents[id=${agent}].evicted` } };
}

export function cardAt(snapshot, agent, minute = snapshot.minute) {
  publicAt(snapshot, minute);
  const a = roster(snapshot).find(a => a.id === agent);
  if (!a) return null;
  const fields = select(a, CARD_FIELDS), said = snapshot.board.outloud?.filter(s => s.agent === agent).at(-1);
  return { ...fields, home: homeAt(snapshot, agent, minute),
    lastSay: said ? select(said, ['agent', 'say', 'terms', 'line']) : null,
    sources: { ...Object.fromEntries(Object.keys(fields).map(k => [k, `board.agents[id=${agent}].${k}`])),
      lastSay: 'board.outloud[last agent=id]', home: 'addressesFor(board.agents[].id); board.agents[].evicted' } };
}

// The public picture remains public when its enclosing receipt is replaced by
// the full record. It supplies no extra receipt identity, goods or deal status.
function publicForm(e) {
  if (scopeOf(e) === 'public') return e;
  if (e.card) return { id: e.id, type: 'card', t: e.t, day: e.day, minute: e.minute, card: e.card };
  return null;
}
function rowsAt(snapshot, minute, scope) {
  const events = publicAt(snapshot, minute);
  const cached = rowCache.get(snapshot) ?? {};
  if (cached[scope]) return cached[scope];
  const rows = events.flatMap(event => {
    const e = scope === 'public' ? publicForm(event) : scopeOf(event) === 'record' ? event : null;
    const row = e && eventRow(e, snapshot.board);
    return row ? [row] : [];
  });
  cached[scope] = rows; rowCache.set(snapshot, cached);
  return rows;
}

export function rapAt(snapshot, agent, minute = snapshot.minute) {
  return rowsAt(snapshot, minute, 'public').filter(r => r.subjects.includes(agent)).reverse();
}

export function bountiesAt(snapshot, agent, minute = snapshot.minute) {
  // Copy-target posters do not identify a current holder. Never join a private
  // posting receipt or a historical sale to attach one to a dossier.
  return boardAt(snapshot, minute).bounties.filter(b => b.agent === agent);
}

// Receipts, never a locally advanced inventory or a reconstruction of a deal.
// Each row keeps its occurrence half-day and its actual publication minute.
export function tapeAt(snapshot, agent, minute = snapshot.minute) {
  const events = rowsAt(snapshot, minute, 'record').filter(r => r.subjects.includes(agent));
  const holdings = events.findLast(r => r.type === 'holdings' && r.fields.agent === agent) ?? null;
  const memory = snapshot.board?.memories?.find(m => m.agent === agent);
  return { asOf: minute, pending: !events.length && !memory, events, holdings,
    memory: memory ? memoryFields(memory) : null,
    sources: { events: 'presented events (latest form per id), typed participant roles',
      holdings: 'last disclosed holdings receipt for agent; never advanced',
      memory: 'board.memories[agent=id], a complete disclosed snapshot' } };
}

// Global People is the public roster. Dossier People adds witnessed links and
// disclosed links as separate lists, with receipts instead of trust/deal scores.
export function peopleAt(snapshot, agent = null, minute = snapshot.minute) {
  publicAt(snapshot, minute);
  if (agent == null) return roster(snapshot).map(a => cardAt(snapshot, a.id, minute));
  const a = roster(snapshot).find(a => a.id === agent);
  if (!a) return null;
  const c = snapshot.board.crews?.find(c => c.id === a.crew);
  const crew = c ? select(c, ['id', 'name', 'members']) : null;
  function ties(scope) {
    return rowsAt(snapshot, minute, scope).filter(r => r.subjects.includes(agent))
      .flatMap(r => r.subjects.filter(id => id !== agent && roster(snapshot).some(a => a.id === id))
        .map(other => ({ agent: other, eventId: r.id, type: r.type, minute: r.minute })));
  }
  return { crew, public: ties('public'), record: ties('record'),
    sources: { crew: 'board.agents[].crew -> board.crews[].id',
      public: 'public event typed participant roles', record: 'disclosed event typed participant roles' } };
}

// Ranking is only sorting an existing board value. No crime score, appraisal,
// survival clock, wealth estimate or Most Wanted ladder is manufactured here.
export function leadersAt(snapshot, minute = snapshot.minute) {
  publicAt(snapshot, minute);
  return {
    heat: roster(snapshot).map(a => ({ agent: a.id, heat: a.heat, wanted: a.wanted }))
      .sort((a, b) => b.heat - a.heat || byId(a.agent, b.agent)),
    crews: (snapshot.board?.crews ?? []).map(c => select(c, ['id', 'name', 'members']))
      .sort((a, b) => b.members.length - a.members.length || byId(a.id, b.id)),
    sources: { heat: 'board.agents[].{id,heat,wanted}', crews: 'board.crews[].{id,name,members}' },
  };
}

export function mapAt(snapshot, minute = snapshot.minute) {
  const b = boardAt(snapshot, minute);
  return { places: Object.values(CITY_PLACES),
    districts: Object.entries(DISTRICTS).map(([district, anchor]) => ({ district, anchor,
      level: b.police?.[district] ?? null, tonight: b.tonight?.[district] ?? null })),
    corners: b.corners.map(c => ({ ...c, anchor: CORNERS[c.corner] ?? null })),
    wanted: b.wanted,
    sources: { places: 'places.js CITY_PLACES (city export, presentation)',
      districts: 'places.js DISTRICTS; board.police; board.tonight',
      corners: 'board.corners; places.js CORNERS', wanted: 'board.agents[].{id,heat,wanted}' } };
}

const weight = type => ({ arrest: 7, fight: 6, turf: 6, evicted: 5, board: 5, mint: 5, card: 5,
  rob: 6, burgle: 6, betray: 6, hustle: 3, crew: 3 })[type] ?? 1;
export function newsAt(snapshot, minute = snapshot.minute) {
  const story = row => ({ ...row, ticker: row.text, ch9: row.text, weight: weight(row.type),
    where: row.fields.place != null ? { place: row.fields.place }
      : row.fields.corner != null ? { corner: row.fields.corner } : null });
  return { live: rowsAt(snapshot, minute, 'public').map(story),
    record: rowsAt(snapshot, minute, 'record').map(story) };
}

// Use this only for a replay with an explicitly retained, later viewing horizon.
// C1-9 owns the literal >24h rule and the typed identity correspondence.
export function replaySideAt(replay, disclosed, agent) {
  const side = recordSideAt(replay, disclosed);
  return { ...side,
    events: side.events.filter(e => subjectsOf(e).includes(agent)).map(e => eventRow(e, disclosed.board)).filter(Boolean),
    names: side.names.filter(n => n.agent === agent || n.victim === agent) };
}

export function panelsAt(snapshot, agent, minute = snapshot.minute) {
  publicAt(snapshot, minute);
  return { frame: snapshot.frame, minute, card: cardAt(snapshot, agent, minute),
    rap: rapAt(snapshot, agent, minute), bounties: bountiesAt(snapshot, agent, minute), people: peopleAt(snapshot, agent, minute),
    tape: tapeAt(snapshot, agent, minute), home: homeAt(snapshot, agent, minute),
    leaders: leadersAt(snapshot, minute), map: mapAt(snapshot, minute), news: newsAt(snapshot, minute) };
}
