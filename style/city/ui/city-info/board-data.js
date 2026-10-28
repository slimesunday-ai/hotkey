// HUMAN LAYER · SECTION 3a · THE BOARDS, as data (pure JS, no DOM: boards.js draws them, tools/infocheck.mjs checks them).
// One input, two shapes:
//   LIVE   city = { lens: 'live', t, agents: the store's public cards, crews, loans, stats (live public counts), statsCut (yesterday's
//          secret counts), mostWanted, cityEv, events: the public log, econ: { trend, drop, inSlot, corners } | null (the public state),
//          cut: { lens, asOf, ts, rows: [{ handle, cash, stash }], pool, money } | 'pending' | null (the director's cut: TAPE, a day late) }
//   TAPE   city = { lens: 'tape' | 'archive', t, ...the FULL state at the tape time (tape.stateAt), events: the tape's log up to t }
// Every board says which lens it is in. Private numbers (cash, stash, the pool, the city tax, the secret counts) come ONLY from the cut
// (LIVE: under a TAPE badge, as of the horizon) or from the tape itself; a LIVE board never reads a private field.
import { dayStart, hhmm } from './feed.js';

// sim2/rules.mjs (read only: the numbers the sim plays by, for what a board means)
export const RULES = {
  DEMAND: { downtown: [4.5, 4.5], strip: [2, 10], trailer: [3, 4.5], suburbs: [1.5, 4], docks: [1.5, 4.5], industrial: [2, 3], highway: [1.5, 4.5] },   // street sales per game hour at a corner [day, night]
  STREET: { satCut: .1, priceFloor: .25 },   // a corner's price falls 10% per unit of saturation, to 25%
  NIGHT: [20, 6], RUSH: 2, LOCALS: 'Locals', TURF_TAX: .25, CITY_TAX: .03,
};
const alive = a => a.status !== 'dead' && !a.retired;
const stashOf = s => typeof s === 'number' ? s : s && typeof s === 'object' ? (s.cash || 0) : 0;
const isNight = t => { const hr = Math.floor((((t % 1440) + 1440) % 1440) / 60); return hr >= RULES.NIGHT[0] || hr < RULES.NIGHT[1]; };
export const lensOf = city => city.lens === 'live' ? 'live' : city.lens;   // the public boards' lens: live, or the tape's own
const privLens = city => city.lens === 'live' ? (city.cut && typeof city.cut === 'object' ? city.cut.lens || 'tape' : 'tape') : city.lens;

// ── LADDERS
export function ladders(city, n = 10) {
  const A = (city.agents || []).filter(alive), ev = city.events || [], live = city.lens === 'live';
  const drip = A.filter(a => (a.drip || 0) > 0).sort((a, b) => (b.drip || 0) - (a.drip || 0) || a.handle.localeCompare(b.handle)).slice(0, n)
    .map(a => ({ handle: a.handle, v: +(a.drip || 0).toFixed(1), sub: Object.values(a.wear || {}).join(' · '), npc: !!a.npc }));
  // most wanted: the city's Most Wanted, the WANTED flag (heat 75+: LIVE shows only the flag), warrants out (24 h), bounties posted (3 days)
  const t = city.t ?? 0, R = new Map(), add = (h, why, w) => { if (!h) return; let r = R.get(h); if (!r) R.set(h, r = { handle: h, why: [], w: 0, crimes: 0 }); if (!r.why.includes(why)) { r.why.push(why); r.w += w; } };
  if (city.mostWanted) add(city.mostWanted, 'Most Wanted', 100);
  for (const a of A) if (live ? a.wanted : (a.heat || 0) >= 75) add(a.handle, 'wanted', 20);
  const bountyOn = /(?:put \d+cr on|bounty on) @(\S+?)(?:'s|\s|$)/;
  for (const e of ev) { if (e.t > t) break;
    if (e.type === 'warrant' && e.who && t - e.t <= 1440) add(e.who, 'warrant', 10);
    if ((e.type === 'director' && e.kind === 'bounty' || e.type === 'loan_bounty') && t - e.t <= 3 * 1440) { const m = bountyOn.exec(e.text || ''); const who = e.to || m?.[1] || e.who; if (who && !ev.some(x => x.type === 'bounty' && x.to === who && x.t > e.t && x.t <= t)) add(who, 'bounty', 8); } }
  // public crimes on record (a seen robbery names its robber; an arrest names who was taken)
  const crimes = new Map(); for (const e of ev) { if (e.t > t) break; if ((e.type === 'rob' && e.who) || (e.type === 'burgle' && e.who)) crimes.set(e.who, (crimes.get(e.who) || 0) + 1); if (e.type === 'arrest' && e.to) crimes.set(e.to, (crimes.get(e.to) || 0) + .5); }
  for (const r of R.values()) r.crimes = Math.floor(crimes.get(r.handle) || 0);
  const alivers = new Set(A.map(a => a.handle));
  const wanted = [...R.values()].filter(r => alivers.has(r.handle)).sort((a, b) => b.w - a.w || b.crimes - a.crimes).slice(0, n);
  const marks = A.filter(a => (a.marks || []).length).sort((a, b) => b.marks.length - a.marks.length || a.handle.localeCompare(b.handle)).slice(0, n).map(a => ({ handle: a.handle, v: a.marks.length, sub: a.marks.join(' · ') }));
  // the longest survivor: alive, and untouched the longest — no robbery, break-in, arrest, hospital or eviction (public events)
  const hit = new Map(), start = ev.length ? Math.min(ev[0].t, 480) : 480;
  for (const e of ev) { if (e.t > t) break; const v = e.type === 'rob' || e.type === 'burgle' || e.type === 'arrest' ? e.to : e.type === 'hospital' || e.type === 'evicted' ? e.who : null; if (v) hit.set(v, { t: e.t, why: e.type }); }
  const surv = A.filter(a => !a.npc).map(a => { const x = hit.get(a.handle); return { handle: a.handle, v: t - (x ? x.t : start), since: x ? x.t : start, why: x ? x.why : null }; });
  const untouched = surv.filter(r => !r.why).map(r => r.handle).sort(), survivor = surv.filter(r => r.why).sort((a, b) => b.v - a.v || a.handle.localeCompare(b.handle)).slice(0, n);
  return { lens: lensOf(city), drip, wanted, marks, survivor, untouched, since: start, richest: richest(city, n) };
}
// the director's cut, LIVE: each agent's tape card (cash, stash) as of the horizon, a game day late (the store hands over only that). 'pending'
// while the first day isn't on tape yet; null when the sim keeps no cut. snap: the cut's last snapshot ({ pool, money }) when the caller has it.
// (Read by the City boards and People's Leaderboards: one reading of the store, so the two Richest boards can't disagree.)
export function cutOf(sim, snap = null) {
  const lens = sim.lens === 'archive' ? 'archive' : 'tape'; if (sim.tape?.pending) return 'pending';
  const R = []; let at = null, ts = null; for (const a of sim.agents()) { const tp = sim.agent(a.handle)?.tape; if (tp && typeof tp === 'object') { R.push({ handle: a.handle, cash: tp.cash, stash: tp.stash }); at ??= tp.asOf; ts ??= tp.ts; } }
  if (!R.length) return null; return { lens, asOf: at, ts, rows: R, pool: snap?.pool, money: snap?.money };
}
// richest: PRIVATE (cash + the home stash). LIVE: the director's cut only, as of the horizon (TAPE); TAPE / ARCHIVE: as of the tape time
export function richest(city, n = 10) {
  if (city.lens === 'live') { const c = city.cut; if (c === 'pending') return { lens: 'tape', pending: true, rows: [] }; if (!c || typeof c !== 'object' || !c.rows) return { lens: 'tape', none: true, rows: [] };
    return { lens: c.lens || 'tape', asOf: c.asOf, ts: c.ts, rows: c.rows.filter(r => typeof r.cash === 'number').map(r => ({ handle: r.handle, v: Math.round(r.cash + stashOf(r.stash)), cash: Math.round(r.cash), stash: Math.round(stashOf(r.stash)) })).sort((a, b) => b.v - a.v).slice(0, n) }; }
  const lots = new Map((city.lots || []).map(l => [l.id, l]));
  const rows = (city.agents || []).filter(alive).map(a => { const st = a.home ? stashOf(lots.get(a.home)?.stash) : 0; return { handle: a.handle, v: Math.round((a.cash || 0) + st), cash: Math.round(a.cash || 0), stash: Math.round(st) }; });
  return { lens: city.lens, asOf: city.t, rows: rows.sort((a, b) => b.v - a.v).slice(0, n) };
}

// ── TURF
export function turf(city) {
  const corners = city.econ?.corners || city.corners || null, perCrew = new Map();
  if (corners) for (const c of Object.values(corners)) if (c?.turf) perCrew.set(c.turf, (perCrew.get(c.turf) || 0) + 1);
  const crews = (city.crews || []).map(c => ({ name: c.name, leader: c.leader, members: c.members || [], turf: c.turf || [], corners: perCrew.get(c.name) || 0, locals: new RegExp(RULES.LOCALS + '$').test(c.name || '') }))
    .sort((a, b) => b.turf.length - a.turf.length || b.corners - a.corners || b.members.length - a.members.length);
  const t = city.t ?? Infinity, moves = (city.events || []).filter(e => (e.type === 'turf' || e.type === 'locals_out') && e.t <= t).slice(-12).reverse().map(e => ({ t: e.t, ts: e.ts, text: e.text, dist: e.at, took: e.type === 'turf' ? !!e.crew : false, out: e.type === 'locals_out' }));
  return { lens: lensOf(city), crews: crews.filter(c => !c.locals), locals: crews.filter(c => c.locals), moves };
}

// ── ECONOMY
export function economy(city) {
  const ev = city.events || [], t = city.t ?? 0, d0 = dayStart(t), E = city.econ || (city.lens !== 'live' ? city : null);
  const sales = ev.filter(e => e.type === 'sale' && e.t >= d0 && e.t <= t), byCorner = new Map();
  for (const s of sales) { let c = byCorner.get(s.at); if (!c) byCorner.set(s.at, c = { n: 0, cr: 0, last: null }); c.n++; c.cr += s.price || 0; c.last = { item: s.label || s.item, price: s.price, t: s.t }; }
  const rush = city.cityEv?.rush && city.cityEv.rush.until > t ? city.cityEv.rush : null, night = isNight(t);
  const corners = E?.corners ? Object.entries(E.corners).map(([id, c]) => ({ id, sat: +(c.sat || 0).toFixed(2), price: Math.max(RULES.STREET.priceFloor, 1 - (c.sat || 0) * RULES.STREET.satCut), turf: c.turf || null, today: byCorner.get(id) || { n: 0, cr: 0, last: null } })) : [...byCorner].map(([id, c]) => ({ id, sat: null, price: null, turf: null, today: c }));
  const dayEv = [...ev].reverse().find(e => e.type === 'day' && e.t <= t), rent = dayEv ? Object.fromEntries([...(dayEv.text || '').matchAll(/(trailer|house|estate) (\d+)/g)].map(m => [m[1], +m[2]])) : null;
  const dropEv = [...ev].reverse().find(e => e.type === 'drop' && e.t <= t);
  const loans = (city.loans || []).filter(l => !l.closed).map(l => ({ from: l.from, to: l.to, owe: l.owe, paid: l.paid || 0, left: Math.max(0, (l.owe || 0) - (l.paid || 0)), due: l.due, late: !!l.late || (l.due != null && l.due < t) }));
  const cut = city.lens === 'live' ? (city.cut && typeof city.cut === 'object' && city.cut.pool !== undefined ? { lens: city.cut.lens || 'tape', asOf: city.cut.asOf, ts: city.cut.ts, pool: city.cut.pool, money: city.cut.money || null } : city.cut === 'pending' ? 'pending' : null)
    : { lens: city.lens, asOf: t, pool: city.pool ?? null, money: city.money || null };
  return { lens: lensOf(city), trend: E?.trend || null, drop: E?.drop || null, dropText: dropEv?.text || null, inSlot: E?.inSlot || null, corners, rush, night, demand: d => (RULES.DEMAND[d] || [1, 1])[night ? 1 : 0] * (rush && rush.dist === d ? RULES.RUSH : 1),
    sales: { n: sales.length, cr: sales.reduce((s, e) => s + (e.price || 0), 0) }, turfTax: city.stats?.turfTax ?? null, loans, rent, cut };
}

// ── CRIME
export const CRIMES = [['rob', 'Robberies', e => e.ok !== false], ['robTry', 'Failed robberies', null], ['burgle', 'Break-ins', null], ['arrest', 'Arrests', null], ['warrant', 'Warrants', null],
  ['bounty', 'Bounties collected', null], ['hospital', 'Hospital trips', null], ['death', 'Deaths', null], ['raid', 'Raids', null], ['evicted', 'Evictions', null], ['exposed', 'Fakes caught', null], ['rug', 'Crews rugged', null]];
// the secret counts: rules.mjs ← lens.js SECRET_STATS (never live: yesterday's in statsCut, or the tape's own)
export const SECRET = [['scams', 'Scams'], ['bribes', 'Bribes'], ['tips', 'Tip-offs to the cops'], ['gives', 'Gifts']], MACHINE = [['plansSet', 'Plans made'], ['planInvalid', 'Plans that failed'], ['invalid', 'Invalid moves'], ['parseFails', 'Answers that didn’t parse'], ['fallbacks', 'Fallbacks to the script']];
const SEASON = { rob: 'robberies', burgle: 'burglaries', arrest: 'arrests', death: 'deaths', raid: 'raids', rug: 'rugs' };
export function crime(city) {
  const ev = city.events || [], t = city.t ?? 0, d0 = dayStart(t), today = {}, byHour = new Array(24).fill(0);
  for (const e of ev) { if (e.t < d0 || e.t > t) continue; let k = e.type; if (k === 'rob' && e.ok === false) k = 'robTry'; if (!CRIMES.some(c => c[0] === k)) continue; today[k] = (today[k] || 0) + 1;
    if (['rob', 'robTry', 'burgle', 'arrest', 'death', 'raid', 'exposed'].includes(k)) byHour[Math.floor((e.t - d0) / 60)]++; }
  const season = {}; if (city.stats) for (const [k, s] of Object.entries(SEASON)) if (typeof city.stats[s] === 'number') season[k] = city.stats[s];
  let secret = null;
  if (city.lens === 'live') { const c = city.statsCut; secret = c ? { lens: 'tape', asOf: c.asOf, ts: c.ts, counts: Object.fromEntries([...SECRET, ...MACHINE].filter(([k]) => typeof c[k] === 'number').map(([k]) => [k, c[k]])) } : { lens: 'tape', pending: true }; }
  else if (city.stats) secret = { lens: city.lens, asOf: t, counts: Object.fromEntries([...SECRET, ...MACHINE].filter(([k]) => typeof city.stats[k] === 'number').map(([k]) => [k, city.stats[k]])) };
  return { lens: lensOf(city), day: Math.floor(t / 1440) + 1, now: hhmm(t), hour: Math.floor((t - d0) / 60), today, byHour, season, secret };
}

// ── THE DEAD (public death events: who, when, where, how)
export function dead(city) {
  const t = city.t ?? Infinity, out = [], hurt = [];
  for (const e of city.events || []) { if (e.t > t) break;
    if (e.type === 'death' && e.who) { const how = String(e.text || '').replace(/^@\S+ is dead:?\s*/, '') || 'dead'; out.push({ handle: e.who, t: e.t, ts: e.ts, at: e.at || null, how, by: e.to || null }); }
    if (e.type === 'hospital' && e.who) hurt.push(e); }
  return { lens: lensOf(city), dead: out.reverse(), closeCalls: hurt.length, lastHurt: hurt.slice(-4).reverse().map(e => ({ handle: e.who, t: e.t, ts: e.ts, text: e.text })) };
}
