// Pass 2 · THE SIM-STATE ADAPTER. Reads a sim state — the demo (simstate/demo.json: adapt), or the live sim2 server (SIM LIVE pass:
// adaptLive below, polled by feed.js; http://127.0.0.1:5251/state = game.snapshot() + running, news, events) — into what the map draws:
//   homes    every home the state knows: tier (data: trailer · apartment · house · penthouse; the sim still says "estate"), owner,
//            vacant (for rent), lights (owner home and awake), asleep, security (lock, door, alarm, dog, safe), scars
//   piles    each supply site's bank level (0 … 12 + spills) and a recent spill
//   corners  the dealing corners: heat from the street demand now (× rush) and the corner's saturation
//   crowd    walkers per district: rules DEMAND [day, night] × the Director's rush
//   patrols  how many patrol cars to show (more when someone is WANTED)
//   holders  district turf holders — CARRIED, NOT DRAWN: turf and crew visuals are deferred (slime, 2026-09-26)
// PUBLIC VIEW (sim2/server.mjs, 2026-10-01): GET /state now defaults to what viewers may see live. Agents come without cash, heat or stash
// (a `wanted` flag stands in for heat), lots without `stash`, crews without `treasury`. So nothing here needs them: `wanted` is read where
// heat was (heat ≥ 75 still counts on a full snapshot: demo.json, simreplay, view=full), a lot's stash is null when the state doesn't say
// (never 0), and cash is never read. A full snapshot still works as before.
// Pure data, no three.js: layer.js draws the model.
// The browser can't import sim2/rules.mjs (it reads process.env), so the numbers the map needs are mirrored here, with their source.
export const RULES = {
  DEMAND: { downtown: [4.5, 4.5], strip: [2, 10], trailer: [3, 4.5], suburbs: [1.5, 4], docks: [1.5, 4.5], industrial: [2, 3], highway: [1.5, 4.5] },   // rules.mjs DEMAND
  TIME: { nightFrom: 20, nightTo: 6 },   // rules.mjs TIME
  SITES: { bank: 12, regen: 6 }, SPILL: 10,   // rules.mjs SITES, DIRECTOR.spill.n
  HEAT: { wanted: 75 }, RUSH: { mult: 2, hours: 3 },   // rules.mjs HEAT, DIRECTOR.rush
  YIELDS: { heap: ['scrap'], mall: ['salts', 'cloth'], docks: ['goo', 'cloth'], woods: ['leaf'] },   // what each site gives (the brief; the sim's places.json yields the first)
};
export const SOURCES = { demo: new URL('./demo.json', import.meta.url).href, live: 'http://127.0.0.1:5251/state' };
export async function load(src = 'demo') { const r = await fetch(SOURCES[src] || src, { cache: 'no-store' }); if (!r.ok) throw new Error(`sim state ${src}: ${r.status}`); return r.json(); }

// sim scar names → what the map shows (turf tags are deferred: carried, never drawn)
const SCARS = { boarded: 'boarded', burned: 'burned', foreclosed: 'foreclosed', raided: 'crime', burgled: 'crime', crime: 'crime', 'crime-scene': 'crime', memorial: 'memorial', tags: null };
const TIER = { estate: 'penthouse', penthouse: 'penthouse', house: 'house', trailer: 'trailer', apartment: 'apartment' };   // the new ladder; the sim's words stay data

// WANTED: the public view's flag; a full snapshot has heat instead (rules.mjs HEAT.wanted)
export const wantedOf = a => typeof a?.wanted === 'boolean' ? a.wanted : (typeof a?.heat === 'number' ? a.heat : 0) >= RULES.HEAT.wanted;
export function clockOf(t) { const m = ((t % 1440) + 1440) % 1440, hh = Math.floor(m / 60); return { day: Math.floor(t / 1440) + 1, hh, mm: m % 60, night: hh >= RULES.TIME.nightFrom || hh < RULES.TIME.nightTo, t }; }
// places = sim2/places.json ({ places, lots }); state = the snapshot. Returns the model; unknown fields are ignored, missing ones default.
export function adapt(state, places, opt = {}) {   // opt.rush: a district to put in a rush now (the page's toggle, ?rush=<district>)
  const t = state.t ?? 0, clock = clockOf(t), agents = new Map((state.agents || []).map(a => [a.handle, a]));
  const P = new Map((places.places || []).map(p => [p.id, p])), L = new Map((places.lots || []).map(l => [l.id, l]));
  const active = v => v === true || (typeof v === 'number' && (v > t || v === 1));
  // homes: every lot of the plan (vacant unless the state says otherwise) + every unit the state lists (apartments, penthouses)
  const homes = new Map();
  for (const l of places.lots || []) homes.set(l.id, { id: l.id, tier: TIER[l.tier] || l.tier, simTier: l.tier, name: l.name, owner: null, vacant: true, lit: false, asleep: false, away: false, sec: new Set(), scars: new Set(), stash: null });
  for (const s of state.lots || []) { const h = homes.get(s.id) ?? { id: s.id, tier: TIER[s.tier] || s.tier, simTier: s.tier, name: s.name || s.id, sec: new Set(), scars: new Set() }; homes.set(s.id, h);
    h.owner = s.owner || null; h.stash = typeof s.stash === 'number' ? s.stash : null; h.tier = TIER[s.tier] || h.tier; h.simTier = s.tier ?? h.simTier;   // (stash: null when the state doesn't carry it — the public view — never 0)
    h.sec = new Set(Object.entries(s.sec || {}).filter(([, v]) => active(v)).map(([k]) => k)); h.scars = new Set((s.scars || []).map(x => SCARS[x]).filter(Boolean));
    h.vacant = !h.owner && !h.scars.has('boarded') && !h.scars.has('burned') && !h.scars.has('foreclosed'); h.forRent = s.forRent ?? h.vacant; }
  for (const h of homes.values()) { h.forRent ??= h.vacant; if (!h.owner) continue; const a = agents.get(h.owner); if (!a) continue;
    const home = a.at === h.id; h.asleep = home && a.status === 'asleep'; h.away = !home; h.lit = home && a.status !== 'asleep' && a.status !== 'dead'; }
  // supply sites: the bank (proposed snapshot field `banks`; the sim keeps g.banks) and a spill in the last two hours (events)
  const piles = new Map(); for (const p of places.places || []) { if (p.kind !== 'site') continue; const level = state.banks?.[p.id] ?? RULES.SITES.bank;
    const spill = (state.events || []).some(e => e.type === 'director' && e.kind === 'spill' && e.at === p.id && (e.t === undefined || t - e.t < 120));
    piles.set(p.id, { id: p.id, name: p.name, x: p.x, z: p.z, dist: p.dist, yields: RULES.YIELDS[p.id] || [p.yields], level: Math.max(0, Math.min(RULES.SITES.bank + 2 * RULES.SPILL, level)), base: RULES.SITES.bank, spill }); }
  // the Director's rush and the street crowd per district
  const ev = state.cityEv || {}, rush = opt.rush ? { dist: opt.rush, mult: RULES.RUSH.mult, forced: true } : ev.rush && (ev.rush.until === undefined || ev.rush.until > t) ? { dist: ev.rush.dist, mult: ev.rush.mult ?? RULES.RUSH.mult, until: ev.rush.until } : null;
  const isNight = opt.night ?? clock.night, crowd = {}; for (const [d, [day, night]] of Object.entries(RULES.DEMAND)) crowd[d] = (isNight ? night : day) * (rush?.dist === d ? rush.mult : 1);
  // dealing corners: heat 0–1 from the demand now and the corner's saturation (sales wear a corner out: sat)
  const corners = new Map(); for (const p of places.places || []) { if (p.kind !== 'corner') continue; const c = state.corners?.[p.id] || {}, dem = crowd[p.dist] ?? 1;
    corners.set(p.id, { id: p.id, name: p.name, x: p.x, z: p.z, dist: p.dist, sat: c.sat ?? 0, demand: dem, rush: rush?.dist === p.dist, heat: Math.max(0, Math.min(1, dem / 7 + (c.sat ?? 0) * .06)), holder: c.turf ?? null }); }
  const wanted = (state.agents || []).filter(a => wantedOf(a) && a.status !== 'jail' && a.status !== 'dead').length;
  // district holders: carried through for later (turf visuals are deferred — nothing draws this)
  const holders = {}; for (const c of state.crews || []) for (const d of c.turf || []) holders[d] = c.name; for (const c of Object.values(state.corners || {})) if (c.turf && !Object.values(holders).includes(c.turf)) holders['?' + c.turf] = c.turf;
  // STATION COPS (sim/subway, 2026-10-09): the stations the police are posted at this shift (lens.js stationCopsOf) — drawn by stationcops.js
  const sc = state.stationCops, stationCops = sc && Array.isArray(sc.posted) ? { posted: sc.posted.filter(id => typeof id === 'string'), from: sc.from ?? null, until: sc.until ?? null } : null;
  return { t, clock, homes, piles, corners, crowd, rush, wanted, patrols: Math.min(6, 3 + wanted), holders, running: state.running ?? null, stationCops };
}

// ── SIM LIVE pass (?sim=live) ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Everything below is for the live mode only (simstate/feed.js); ?sim=demo draws adapt() above, unchanged. This stays the ONE file that
// knows the snapshot's field names (sim2/game.mjs snapshot() + server.mjs /state). A field the map doesn't know is logged once and
// ignored; a field it needs and doesn't get is logged once and defaulted.
const KNOWN = new Set(['t', 'ts', 'pool', 'money', 'stats', 'mostWanted', 'trend', 'drop', 'inSlot', 'agents', 'lots', 'crews', 'loans', 'cityEv', 'hires', 'corners', 'banks', 'running', 'news', 'events', '_about', 'stationCops']);   // (stationCops: STATION COPS, sim/subway 2026-10-09)
const NEEDS = { t: 'no clock: day and night stay as the page says, trips are timed by arrival only', agents: 'no agents on the streets', lots: 'every home shows vacant',
  corners: 'hotspots from demand only', events: 'no pile levels (banks) or corner sales', banks: 'pile levels are estimated from the dig and spill events (the sim keeps g.banks: export it as `banks`)' };
const AGENT_KNOWN = new Set(['handle', 'cls', 'model', 'look', 'status', 'at', 'trip', 'act', 'cash', 'heat', 'home', 'crew', 'budget', 'wear', 'drip', 'npc', 'localOf', 'retired', 'inv', 'high', 'haze', 'marks', 'n', 'lastThink', 'lastSay', 'x', 'z', 'wanted', 'mood']);
const MOOD = new Set(['wired', 'spaced', 'guarded']);   // (VISIBLE HIGHS, lens.js MOODS: the public card's behaviour family; never a drug, and `haze` / `high` are never passed on)
const STATUS = { active: 'active', busy: 'busy', asleep: 'asleep', jail: 'jail', hospital: 'hospital', dead: 'dead' };   // sim2/game.mjs a.status
// CAST PASS (2026-10-02): these worn traits still name the OLD chars.js ids, which the city's fresh cast (cast.js) doesn't have, so
// simstate/looks.js does not draw them for now: every agent wears a stable random look from the new cast, seeded by its handle.
// LATER: map the sim's TRAITS table (sim2 rules.mjs) onto fresh cast ids here, then lay them over the roll (cast.js wear).
const WEAR = { hat: 'hat', eyes: 'eyewear', top: 'top', feet: 'shoes', neck: 'neck', mouth: 'mouth', wrist: 'acc', bag: 'held' };
const BAG_ACC = new Set(['crossbody', 'sling']);   // bag-slot traits that chars.js draws as accessories (on the torso), not held items   // sim2 rules.mjs TRAITS slots → world/chars.js look slots (the trait ids are the fit-check's)
function wearOf(w) { if (!w || typeof w !== 'object' || Array.isArray(w)) return null; const out = {};
  for (const [slot, id] of Object.entries(w)) { let k = WEAR[slot]; if (!k) { note('wear:' + slot, `unknown worn-trait slot "${slot}" — not drawn`); continue; } if (typeof id !== 'string') continue;
    if (slot === 'bag' && BAG_ACC.has(id)) { if (out.acc) continue; k = 'acc'; }   // the sim's bag slot holds a duffel (chars.js HELD) or a strap bag (chars.js ACC): route by the item, and a worn watch keeps the acc slot
    out[k] = id; }
  return Object.keys(out).length ? out : null; }
const noted = new Set(), NOTES = [];
export const notes = () => NOTES.slice();
export function note(key, text) { if (noted.has(key)) return; noted.add(key); NOTES.push(text); try { console.info('[sim live] ' + text); } catch {} }
export function checkFields(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) { note('state', 'the state is not an object — ignored'); return false; }
  for (const k of Object.keys(state)) if (!KNOWN.has(k)) note('field:' + k, `unknown snapshot field "${k}" — ignored`);
  for (const [k, why] of Object.entries(NEEDS)) if (state[k] === undefined || state[k] === null) note('missing:' + k, `the snapshot has no "${k}": ${why}`);
  if (state.t !== undefined && typeof state.t !== 'number') note('type:t', `"t" is ${typeof state.t}, not game minutes — no clock`);
  for (const k of ['agents', 'lots', 'events']) if (state[k] !== undefined && !Array.isArray(state[k])) note('type:' + k, `"${k}" is not a list — ignored`);
  for (const a of Array.isArray(state.agents) ? state.agents : []) { if (typeof a?.handle !== 'string') note('agent:handle', 'an agent without a handle — skipped'); for (const k of Object.keys(a || {})) if (!AGENT_KNOWN.has(k)) note('agent:' + k, `unknown agent field "${k}" — ignored`); }
  for (const l of Array.isArray(state.lots) ? state.lots : []) if (typeof l?.id !== 'string') note('lot:id', 'a lot without an id — skipped');
  return true;
}
// the sim's places by id: places.json places + lots (a lot is a place too: 'lot:x,z')
export const placeIndex = places => new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p]));

// MOVEMENT W3a · a trip's legs (MOVEMENT.md §3), kept as the sim sends them when well formed: { kind, from, to, dep, arr, path?, line?, dir?, at?, coarse? }
const LEG_KINDS = new Set(['walk', 'skate', 'bike', 'scooter', 'wait', 'bus', 'subway', 'taxi', 'stairs']);
function legsOf(L) { if (!Array.isArray(L) || !L.length) return null; const out = [];
  for (const l of L) { if (!l || !LEG_KINDS.has(l.kind) || typeof l.dep !== 'number' || typeof l.arr !== 'number') { note('trip:legs', 'a trip leg without kind / dep / arr — the trip is walked the old way'); return null; }
    const r = { kind: l.kind, from: l.from ?? null, to: l.to ?? null, dep: l.dep, arr: l.arr };
    if (Array.isArray(l.path)) r.path = l.path.filter(p => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number');
    for (const k of ['line', 'dir', 'm', 'coarse', 'transfer']) if (l[k] !== undefined) r[k] = l[k]; if (Array.isArray(l.at)) r.at = l.at; out.push(r); }
  return out; }

// the agents, as the map walks them: where they are (a place and its coordinates) or where they are going (a trip, in game minutes)
export function agentsOf(state, P) {
  const out = [], list = Array.isArray(state.agents) ? state.agents : [];
  for (const a of list) {
    if (!a || typeof a.handle !== 'string') { note('agent:handle', 'an agent without a handle — skipped'); continue; }
    let status = STATUS[a.status]; if (!status) { note('status:' + a.status, `unknown agent status "${a.status}" — treated as active`); status = 'active'; }
    let trip = null; if (a.trip && typeof a.trip === 'object') { const { from, to, dep, arr, taxi } = a.trip, F = P.get(from), T = P.get(to);
      if (typeof dep !== 'number' || typeof arr !== 'number') note('trip:time', 'a trip without dep / arr game minutes — walked at walking pace');
      if (!T) note('trip:to:' + to, `a trip to an unknown place "${to}" — not walked`);
      trip = { from: from ?? null, to: to ?? null, dep: typeof dep === 'number' ? dep : null, arr: typeof arr === 'number' ? arr : null, taxi: !!taxi,
        mode: typeof a.trip.mode === 'string' ? a.trip.mode : null, fare: typeof a.trip.fare === 'number' ? a.trip.fare : null, legs: legsOf(a.trip.legs),   // (MOVEMENT W3a: the trip's legs, MOVEMENT.md §3)
        x0: F?.x ?? null, z0: F?.z ?? null, x1: T?.x ?? null, z1: T?.z ?? null, fromKind: F?.kind ?? null, toKind: T?.kind ?? null }; }
    const at = typeof a.at === 'string' ? a.at : null, p = at ? P.get(at) : null; if (at && !p) note('at:' + at, `an agent at an unknown place "${at}" — not drawn there`);
    out.push({ id: a.handle, look: typeof a.look === 'number' ? a.look : null, npc: !!a.npc, wear: wearOf(a.wear),
      status, act: typeof a.act === 'string' ? a.act : null, at, kind: p?.kind ?? null, x: p?.x ?? (typeof a.x === 'number' ? a.x : null), z: p?.z ?? (typeof a.z === 'number' ? a.z : null),
      trip: status === 'busy' || trip ? trip : null, home: typeof a.home === 'string' ? a.home : null, wanted: wantedOf(a), crew: a.crew ?? null,
      marks: Array.isArray(a.marks) ? a.marks.filter(m => typeof m === 'string') : [], drip: typeof a.drip === 'number' ? a.drip : 0, mood: MOOD.has(a.mood) ? a.mood : null });   // (mood: VISIBLE HIGHS, simstate/moods.js reads it)   // (public: the cutaway's wealth reads marks and drip; cash and heat are never carried)
  }
  return out;
}

// what the snapshot doesn't carry, from the events it does (the last 150 each poll; this remembers them by id across polls):
//   banks   each supply site's stock (sim2/game.mjs g.banks, not in the snapshot): 12 each, − every `gather` there, + a `director` spill,
//           + the hourly refill (SITES.regen, up to SITES.bank). An estimate until the sim exports `banks` (then that is used as is).
//   sales   every street `sale` per corner (game minutes) for the last six hours: the live hotspots' heat
//   boards  recent swap-meet `list` / `market` events, fence sales and the loan shark's open loans — carried, not drawn (no pieces yet)
export function createTracker() {
  const seen = new Set(), order = [], sales = new Map(); let banks = null, lastT = null;
  const regen = (from, to) => { for (let h = Math.floor(from / 60) + 1; h <= Math.floor(to / 60); h++) for (const k of Object.keys(banks)) banks[k] = Math.max(banks[k], Math.min(RULES.SITES.bank, banks[k] + RULES.SITES.regen)); };
  return {
    feed(state, places) {
      const t = typeof state.t === 'number' ? state.t : 0, events = Array.isArray(state.events) ? state.events : [];
      if (!banks || (lastT !== null && t < lastT - 1)) { banks = {}; for (const p of places.places || []) if (p.kind === 'site') banks[p.id] = RULES.SITES.bank; seen.clear(); order.length = 0; sales.clear(); lastT = null; }   // first poll, or the sim went back in time (restarted, or the replay looped)
      const fresh = events.filter(e => e && e.id !== undefined && !seen.has(e.id)).sort((a, b) => a.id - b.id); let cur = lastT ?? (fresh.length && typeof fresh[0].t === 'number' ? fresh[0].t : t);
      for (const e of fresh) { seen.add(e.id); order.push(e.id); if (typeof e.t === 'number' && e.t > cur) { regen(cur, e.t); cur = e.t; }
        if (e.type === 'gather' && banks[e.at] !== undefined) banks[e.at] = Math.max(0, banks[e.at] - (Array.isArray(e.items) ? e.items.length : 1));
        else if (e.type === 'director' && e.kind === 'spill' && banks[e.at] !== undefined) banks[e.at] += RULES.SPILL;
        else if (e.type === 'sale' && typeof e.at === 'string') { let L = sales.get(e.at); if (!L) sales.set(e.at, L = []); L.push(typeof e.t === 'number' ? e.t : t); } }
      if (t > cur) regen(cur, t); lastT = Math.max(t, cur);
      while (order.length > 6000) seen.delete(order.shift());
      for (const L of sales.values()) while (L.length && L[0] < t - 360) L.shift();
      const sb = state.banks && typeof state.banks === 'object' ? state.banks : null;
      return { banks: sb || banks, estimated: !sb, sales };
    },
  };
}
// the live model: adapt() + the agents, the pile levels and the hotspots' heat from sales and price (sim2/game.mjs cornerValue:
// the demand now × the corner's price factor, which every sale there cuts: STREET.satCut, floor STREET.priceFloor)
const PRICE = { satCut: .1, floor: .25 };   // rules.mjs STREET
// the state as adapt() may read it: every list a list, every map an object, t a number, lots and agents with their ids — whatever the
// sim sends (checkFields has logged what was wrong, once)
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : undefined, list = v => Array.isArray(v) ? v : [];
function sane(s) {
  return { ...s, t: typeof s.t === 'number' && Number.isFinite(s.t) ? s.t : undefined, cityEv: obj(s.cityEv), corners: obj(s.corners), banks: obj(s.banks), crews: list(s.crews).filter(obj), loans: list(s.loans).filter(obj), events: list(s.events).filter(obj),
    agents: list(s.agents).filter(a => obj(a) && typeof a.handle === 'string'),
    lots: list(s.lots).filter(l => obj(l) && typeof l.id === 'string').map(l => ({ ...l, sec: obj(l.sec) || {}, scars: list(l.scars).filter(x => typeof x === 'string') })) }; }
export function adaptLive(state, places, P, tracker, opt = {}) {
  state = sane(state);
  const m = adapt(state, places, opt), tr = tracker.feed(state, places), agents = agentsOf(state, P), t = m.t;
  for (const p of m.piles.values()) { const b = tr.banks[p.id]; if (typeof b === 'number') p.level = Math.max(0, Math.min(RULES.SITES.bank + 2 * RULES.SPILL, b)); p.estimated = tr.estimated; }
  const dealing = new Map(); for (const a of agents) if (a.act === 'deal' && a.at && a.kind === 'corner' && a.status === 'busy') dealing.set(a.at, (dealing.get(a.at) || 0) + 1);
  for (const c of m.corners.values()) { const price = Math.max(PRICE.floor, 1 - c.sat * PRICE.satCut), recent = (tr.sales.get(c.id) || []).filter(x => x > t - 120).length, dealers = dealing.get(c.id) || 0;
    c.price = price; c.sales = recent; c.dealers = dealers; c.heat = Math.max(0, Math.min(1, .25 * Math.min(1, c.demand / 10) * price + .3 * dealers + .1 * recent)); }   // (nobody there: a lone couch at most; one dealer selling: the umbrella)
  // carried, not drawn: the loan shark's book, the fence and the two swap-meet boards (the layer has no pieces for them yet)
  const loans = Array.isArray(state.loans) ? state.loans : [], shark = loans.filter(l => l && l.from === 'shark');
  const recent = (Array.isArray(state.events) ? state.events : []).filter(e => e && typeof e.t === 'number' && e.t > t - 360);
  m.boards = { shark: { open: shark.length, owed: shark.reduce((s, l) => s + Math.max(0, (l.owe ?? 0) - (l.paid ?? 0)), 0), late: shark.filter(l => l.late).length },
    fence: { sales: recent.filter(e => e.type === 'fence').length }, market: Object.fromEntries(['trailer', 'heap'].map(k => [k, recent.filter(e => (e.type === 'list' || e.type === 'market') && e.at === k).length])) };
  m.agents = agents; m.ts = typeof state.ts === 'string' ? state.ts : null; m.hasClock = typeof state.t === 'number';
  return m;
}
