// HUMAN LAYER · WHAT THE STORE DERIVES (pure: no DOM, no fetch; storefeed.js runs it once per poll, tools/lenscheck.mjs runs it in node).
//   names    place, home and district names (sim2/places.json), short corner names for sentences ("Kent & 1st")
//   now      one plain sentence per agent: "dealing at Kent & 1st", "asleep at home", "in the yard on Iron Island", "walking to the Strip"
//   rap      the rap sheet, from PUBLIC events only: arrests, jail, bail, warrants, bounties, loans and late payments, missed rent,
//            evictions, marks earned, hospital, death, robberies done (a burglar is never named, nor an unseen robber: lens.js cityRules),
//            a drug worn off outdoors ("was on SUDO (12:02–12:10)": lens.js + VISIBLE HIGHS, the public `sober`)
//   people   crew, and the public dealings and fights between handles
//   tape     one agent's private side from the director's cut (asOf, cash, heat, inv, stash, think, plan, deals, whispers)
// Everything here reads what it is given; the lens (lens.js) decides what that is. rap and people take public events only.
import { PUBLIC_AGENT } from './lens.js';

const DIST = { forest: 'Blackpine Woods', sea: 'the Bay', downtown: 'Glasswall', strip: 'Neon Row', suburbs: 'Pleasantview', estates: 'Gatehill', trailer: 'Sunny Acres', industrial: 'the Yards', docks: 'Low Tide Docks', junkyard: 'the Heap', jail: 'Iron Island', hospital: 'St. Mercy', mall: 'the Millennium Mall', highway: 'Route 9' };   // (simplaces.js DISTRICT_NAMES, sentence case)
const SAY = { store: 'the 24/7 Store', fitstreet: 'Fit Street', heap: 'the Heap', mall: 'the mall ruins', docks: 'the docks', woods: 'the woods', plaza: 'Glasswall Plaza', court: 'the Hall of Justice', police: 'Precinct 9', motel: 'Motel 9', park: 'the park', hospital: 'St. Mercy', jail: 'Iron Island', trailer: 'Sunny Acres' };   // how a sentence says a place
const shortStreet = s => s.replace(/\s+(St|Ave|Rd|Blvd|Ln|Dr)\b\.?/g, '');

export function placeBook(places) {
  const P = new Map([...(places?.places || []), ...(places?.lots || [])].map(p => [p.id, p]));
  const coarse = id => typeof id === 'string' && id.startsWith('dist:') ? (DIST[id.slice(5)] || id.slice(5)) : null;   // (lens.js rule 5: someone else's lot, shown by district)
  const name = id => id == null ? null : coarse(id) ? coarse(id).replace(/^the /, 'The ') : P.get(id)?.name?.replace(/\s*\(DROP\)$/, '') ?? (String(id).startsWith('lot:') ? 'a lot' : String(id));
  const say = id => { if (id == null) return null; if (coarse(id)) return 'somewhere in ' + coarse(id); if (SAY[id]) return SAY[id]; const p = P.get(id); if (!p) return name(id); if (p.kind === 'corner') return shortStreet(p.name); return p.name.replace(/\s*\(DROP\)$/, ''); };
  const dist = id => { if (coarse(id)) return coarse(id); const d = P.get(id)?.dist; return d ? DIST[d] || d : null; };
  return { P, name, say, dist, coarse, kind: id => coarse(id) ? 'district' : P.get(id)?.kind ?? (String(id ?? '').startsWith('lot:') ? 'lot' : null), pos: id => { const p = P.get(id); return p ? { x: p.x, z: p.z } : null; } };
}

// ── the "now" sentence
const ACT = { deal: 'dealing at', cook: 'cooking at', gather: 'digging at', craft: 'crafting at', work: 'working a shift at', patrol: 'on patrol at', wait: 'hanging around' };
const MOOD_WORD = { wired: 'wired', spaced: 'spaced out', guarded: 'guarded' };   // (lens.js + VISIBLE HIGHS: the card's public `mood`)
export function nowOf(a, B) {
  if (!a) return '';
  if (MOOD_WORD[a.mood]) return `${nowOf({ ...a, mood: null }, B)}, ${MOOD_WORD[a.mood]}`;   // ("dealing at Kent & 1st, wired")
  if (a.retired) return 'retired';
  const home = a.at && a.at === a.home, here = home ? 'home' : B.say(a.at);
  if (a.status === 'asleep' && B.coarse(a.at)) return `asleep ${B.say(a.at)}`;
  switch (a.status) {
    case 'dead': return 'dead';
    case 'hospital': return 'in hospital at St. Mercy';
    case 'jail': return 'in the yard on Iron Island';
    case 'asleep': return home ? 'asleep at home' : a.at ? `sleeping rough at ${here}` : 'asleep';
  }
  if (B.coarse(a.at) && !a.trip) return a.status === 'asleep' ? `asleep ${B.say(a.at)}` : B.say(a.at);   // ("somewhere in Sunny Acres": rule 5)
  if (a.trip) { const to = a.trip.to, where = to === a.home ? 'home' : B.say(to) || 'somewhere'; return tripNow(a.trip, where, to === a.home); }
  const k = typeof a.act === 'string' ? a.act : a.act?.k;
  if (k && ACT[k] && a.at) return home ? (k === 'cook' ? 'cooking at home' : k === 'patrol' ? 'on patrol' : k === 'wait' ? 'at home' : `${ACT[k]} home`) : `${ACT[k]} ${here}`;
  if (home) return 'at home';
  if (a.at) return B.kind(a.at) === 'hangout' ? `hanging out at ${here}` : `at ${here}`;
  return 'somewhere in the city';
}

// MOVEMENT W3a · the trip in the "now" line, by its headline mode (MOVEMENT.md §3): "→ Fit Street by bus 14 · arrives 14:20", "skating
// to the Heap". `where` already obeys rule 5 ("somewhere in Sunny Acres"); without a mode (the old sim) as before
const hhmm = t => `${pad(Math.floor((t % 1440) / 60))}:${pad(Math.floor(t % 60))}`;
function tripNow(tr, where, home) {
  const by = { skate: 'skating', bike: 'cycling', scooter: 'scooting' }, arr = typeof tr.arr === 'number' ? ` · arrives ${hhmm(Math.ceil(tr.arr))}` : '', to = home ? 'home' : `to ${where}`;
  const line = k => (tr.legs || []).find(l => l.kind === k && l.line)?.line;
  switch (tr.mode) {
    case 'skate': case 'bike': case 'scooter': return `${by[tr.mode]} ${home ? 'home' : 'to ' + where}`;
    case 'bus': { const l = line('bus'); return `→ ${home ? 'home' : where} by bus${l ? ' ' + String(l).replace(/^bus-/, '') : ''}${arr}`; }
    case 'subway': { const l = line('subway'); return `→ ${home ? 'home' : where} by subway${l ? ' (' + String(l).toUpperCase() + ')' : ''}${arr}`; }
    case 'taxi': return `in a taxi ${to}${arr}`;
    case 'walk': return home ? 'walking home' : `walking to ${where}`;
  }
  return tr.taxi ? `in a taxi to ${where}` : home ? 'walking home' : `walking to ${where}`; }

// ── one agent's public card (the contract's sim.agents() row)
export function liveOf(a, B) {
  const r = {}; for (const k of PUBLIC_AGENT) if (a[k] !== undefined) r[k] = a[k];
  r.wanted = !!a.wanted; r.placeName = a.status === 'jail' ? 'Iron Island' : a.trip ? null : B.name(a.at); r.homeName = a.home ? B.name(a.home) : null; r.now = nowOf(a, B);
  r.district = B.dist(a.trip ? a.trip.to : a.at); r.coarse = !!B.coarse(a.at) || !!(a.trip && (B.coarse(a.trip.to) || B.coarse(a.trip.from)));
  r.indoors = !r.coarse && !a.trip && (a.status === 'asleep' || a.status === 'hospital' || B.kind(a.at) === 'lot'); return r;
}

// ── the rap sheet: public events only. Each entry: { id, t, ts, kind, text, with, at }
const isHandle = h => typeof h === 'string' && h && h !== 'here' && h !== 'shark' && h !== 'street';
export function rapEntry(e, h, B) {
  const w = e.who === h, o = e.to === h, at = e.at ?? null, where = at ? ` at ${B.say(at)}` : '';
  const R = (kind, text, other = null) => ({ id: e.id, t: e.t, ts: e.ts, kind, text, with: other, at });
  switch (e.type) {
    case 'arrest': if (o) return R('arrest', `arrested by @${e.who}${e.until ? `, held till ${stampHM(e.until)}` : ''}${e.seized && e.seized !== 'nothing' ? ` (seized: ${e.seized})` : ''}`, e.who); break;
    case 'release': if (w && at === 'jail') return R('release', 'released from Iron Island'); if (w && at === 'hospital') return R('release', 'left St. Mercy'); break;
    case 'bail': if (w) return R('bail', 'posted bail'); break;
    case 'warrant': if (w) return R('warrant', e.text.replace(/^a warrant is out for @\S+\s*/, 'warrant out ').trim()); break;
    case 'bounty': if (o) return e.who ? R('bounty', `@${e.who} collected a bounty on them`, e.who) : R('bounty', 'someone collected a bounty on them'); if (w) return R('bounty-hunter', `collected a bounty on @${e.to}`, e.to); break;
    case 'director': if (e.kind === 'bounty' && o) return R('bounty', 'the city put a bounty on their head'); break;
    case 'loan_bounty': if (w) return R('bounty', "the loan shark put a price on their head"); break;
    case 'loan': if (w && e.to === 'shark') return R('loan', e.text); if (o) return R('loan', `borrowed from @${e.who}: ${e.text.replace(/^@\S+ lent @\S+ /, '')}`, e.who); break;
    case 'loan_late': if (w) return R('late', e.to === 'shark' ? 'late paying the loan shark' : `late paying @${e.to} back`, isHandle(e.to) ? e.to : null); break;
    case 'loan_collect': if (w) return R('late', "the loan shark's collectors took from their stash"); break;
    case 'repay': if (w) return R('repaid', e.to === 'shark' ? 'paid the loan shark back' : `paid @${e.to} back`, isHandle(e.to) ? e.to : null); break;
    case 'rent_missed': if (w) return R('rent', `missed rent${at ? ' on ' + B.name(at) : ''}`); break;
    case 'evicted': if (w || o) return R('evicted', `evicted${at ? ' from ' + B.name(at) : ''}`); break;
    case 'mark': if (w) return R('mark', `earned the mark ${String(e.mark || '').toUpperCase()}`); break;
    case 'hospital': if (w) return R('hospital', e.text.replace(/^@\S+ was taken to St\. Mercy:?\s*/, 'hospital: ') || 'taken to St. Mercy'); break;
    case 'death': if (w) return R('death', e.text.replace(/^@\S+ is dead:?\s*/, 'died: ') || 'died'); if (o) return R('killed', `killed @${e.who}`, e.who); break;
    case 'rob': if (w && e.ok) return R('robbery', `robbed @${e.to}${where}`, e.to); if (o && e.ok) return e.who ? R('robbed', `robbed by @${e.who}${where}`, e.who) : R('robbed', `robbed${where} (nobody saw who)`); break;
    case 'burgle': if (o && e.ok) return R('burgled', `home burgled${at ? ' (' + B.name(at) + ')' : ''}`); break;   // (never the burglar: the sim's text hides them)
    case 'sober': if (w && typeof e.drug === 'string') return R('sober', String(e.text || '').replace(/^@\S+\s+/, '') || `was on ${e.drug.toUpperCase()}`); break;   // (only ever the public form: lens.js actForm)
  }
  return null;
}
const pad = n => String(n).padStart(2, '0'), stampHM = t => `D${Math.floor(t / 1440) + 1} ${pad(Math.floor((t % 1440) / 60))}:${pad(t % 60)}`;

// ── people: crew and public ties. A tie counts dealings (deals, jobs, loans, fronts, talk) and fights (robbery, arrests, bounties, kills)
const DEAL = new Set(['contract', 'hire', 'hire_end', 'front', 'loan', 'repay', 'say', 'crew']), FIGHT = new Set(['rob', 'arrest', 'bounty', 'death', 'search', 'warn', 'crew_payback']);
export function tieOf(e) {   // [a, b, 'deal' | 'fight', kind] for an event between two handles, else null (burglaries never: the burglar is hidden)
  if (!isHandle(e.who) || !isHandle(e.to) || e.who === e.to) return null;
  if (DEAL.has(e.type)) return [e.who, e.to, 'deal', e.type];
  if (FIGHT.has(e.type)) return [e.who, e.to, 'fight', e.type];
  return null;
}
export function peopleOf(h, ties, crews) {
  const c = (crews || []).find(c => (c.members || []).includes(h) || c.leader === h) || null, m = ties.get(h);
  const list = m ? [...m.entries()].map(([handle, v]) => ({ handle, n: v.deals + v.fights, deals: v.deals, fights: v.fights, last: v.last, kinds: { ...v.kinds } })).sort((x, y) => y.n - x.n || y.last - x.last) : [];
  return { crew: c ? { name: c.name, leader: c.leader, members: [...(c.members || [])], turf: c.turf || [] } : null, ties: list };
}
export function addTie(ties, e) {
  const tie = tieOf(e); if (!tie) return; const [a, b, kind, type] = tie;
  for (const [x, y] of [[a, b], [b, a]]) { let m = ties.get(x); if (!m) ties.set(x, m = new Map()); let v = m.get(y); if (!v) m.set(y, v = { deals: 0, fights: 0, last: 0, kinds: {} });
    v[kind === 'deal' ? 'deals' : 'fights']++; v.last = Math.max(v.last, e.t || 0); v.kinds[type] = (v.kinds[type] || 0) + 1; }
}

// ── the tape: one agent's private side as of the director's cut. dir: the director state (full snapshot of t − delay), evs: the
// director's events so far (every event up to the cut, private ones too), newest last
const DEALS = new Set(['offer', 'contract', 'sale', 'loan_offer', 'hire_offer', 'hire', 'front', 'fill', 'fence', 'list', 'bid', 'market', 'buy', 'bribe', 'scam', 'loan', 'repay']);
export function tapeOf(dir, h, evs) {
  const a = (dir.agents || []).find(x => x.handle === h); if (!a) return null;
  const home = a.home && (dir.lots || []).find(l => l.id === a.home), mine = evs.filter(e => e.who === h || e.to === h);
  const plan = [...mine].reverse().find(e => e.type === 'plan' && e.who === h), thoughts = mine.filter(e => e.who === h && e.think && !/^\((local|plan|fallback)\)/.test(e.think)).slice(-8);
  return { asOf: dir.t, ts: dir.ts, cash: a.cash ?? null, heat: a.heat ?? null, inv: a.inv ?? [], stash: home ? home.stash ?? null : null, budget: a.budget ?? null, high: a.high ?? null,
    think: a.lastThink ?? null, thoughts: thoughts.map(e => ({ t: e.t, ts: e.ts, think: e.think, did: e.type })),
    plan: plan ? { t: plan.t, ts: plan.ts, steps: plan.steps || [], text: plan.text } : null,
    deals: mine.filter(e => DEALS.has(e.type)).slice(-12).map(e => ({ id: e.id, t: e.t, ts: e.ts, type: e.type, who: e.who, to: e.to ?? null, text: e.text, secret: !!e.secret })),
    whispers: mine.filter(e => e.type === 'whisper' && e.who === h).slice(-6).map(e => ({ t: e.t, ts: e.ts, text: e.text })) };
}
