// HUMAN LAYER · THE LENSES: who sees what, in one place, shared by tools/simreplay.mjs (node) and the page store (store.js, browser).
// Decided 2026-10-01 (slime), built in the sim server: deadnet commit 77ce68c, sim2/server.mjs publicView (~line 67–73).
//   public   (LIVE, everyone)   what someone on the street could see: no cash, heat (a `wanted` flag instead), stash, inventory,
//                              thoughts, plans; private events removed (offers, loan/hire offers, whispers, quests, tips, plans,
//                              triggers, invalid moves, anything `secret`, the ledger's payouts, refunds and worn-out tools:
//                              LEDGER_EVENTS), `think` stripped from the rest
//   owner    (MINE)             public + `me` (the agent's full record, home stash, plan, triggers, notes, memory, sees) + `myEvents`
//   director (TAPE, everyone)   the full snapshot + events from `delay` game minutes ago; `pending` until the city is that old
//   archive  (a finished season) everything, always
// The block between the VERBATIM markers is copied byte for byte from the sim (do not edit it here): tools/lenscheck.mjs fails when the
// sim's copy changes, and then this copy is re-taken. Its free names (R, g, running) are bound by publicOf() below.
// The city's own rules (DMs, burglars, unseen robbers, secret stats: below) and one deliberate fix are applied AFTER the verbatim code.
// The fix: the sim passes `g.news` through raw, and those are the same event objects
// as g.events, `think` attached (73 of them in the 09-29 run carry one) — so news goes through publicEvent here too. Reported to the sim.
// Pure JS: no DOM, no node.
export const SOURCE = { repo: 'deadnet', file: 'sim2/server.mjs', commit: '77ce68c', from: 'const PRIVATE_EVENTS', to: 'news: g.news.slice(-30), events:' };
let R = { HEAT: { wanted: 75 } }, g = { news: [] }, running = true;   // (rules.mjs HEAT.wanted: lenscheck.mjs checks the number)

// ── VERBATIM sim2/server.mjs @ 77ce68c ──────────────────────────────────────────────────────────────────────────────────────────────
const PRIVATE_EVENTS = new Set(['offer', 'loan_offer', 'hire_offer', 'whisper', 'quest', 'tip', 'invalid', 'plan', 'trigger', 'think']);
const publicEvent = e => !e.secret && !PRIVATE_EVENTS.has(e.type) ? (({ think, ...rest }) => rest)(e) : null;
function publicView(snap, evs) { return { t: snap.t, ts: snap.ts, mostWanted: snap.mostWanted, trend: snap.trend, drop: snap.drop, inSlot: snap.inSlot, stats: snap.stats, cityEv: snap.cityEv, corners: snap.corners, running,
    agents: snap.agents.map(a => ({ handle: a.handle, cls: a.cls, model: a.model, look: a.look, status: a.status, at: a.at, trip: a.trip, act: a.act, home: a.home, crew: a.crew, wear: a.wear, drip: a.drip, marks: a.marks, lastSay: a.lastSay, x: a.x, z: a.z, npc: a.npc, localOf: a.localOf, retired: a.retired, wanted: (a.heat || 0) >= R.HEAT.wanted })),
    lots: snap.lots.map(l => ({ id: l.id, owner: l.owner, tier: l.tier, sec: l.sec, scars: l.scars })),   // a stash is private; visible security is not
    crews: snap.crews.map(c => ({ name: c.name, leader: c.leader, members: c.members, turf: c.turf })), loans: snap.loans, hires: (snap.hires || []).map(h => ({ boss: h.boss, worker: h.worker, until: h.until })),
    news: g.news.slice(-30), events: evs.map(publicEvent).filter(Boolean).slice(-150) }; }
// ── END VERBATIM ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export { PRIVATE_EVENTS, publicEvent };
// THE LEDGER EVENTS (sim/payouts, 2026-10-10): the money and items the city moves on its own, which used to change with no event —
// `payout` (the Locals' hourly take, a tipster's fee, a hired dealer's street sale: the boss's share), `refund` (an order, a listing, a
// contract's side, a loan offer or a bounty coming back: expired or withdrawn) and `worn_out` (a pick breaking). Cash and pockets are
// private, so they are too: the sim marks them `secret` (publicEvent, verbatim, drops them), and the lens refuses them by type as well,
// should one ever arrive unmarked (cityEvent: never public; leaks(): a leak). The director's tape has them (simstate/timeline.js
// applies them at their minute), and so does the agent's owner (myEvents: its own; a dealer's, the share of its own sale, `to`).
export const LEDGER_EVENTS = new Set(['payout', 'refund', 'worn_out']);
export const WANTED = R.HEAT.wanted;
// the public fields of an agent, a lot, a crew, a hire (what publicView keeps): the store whitelists by these, the check tests against them
export const PUBLIC_AGENT = ['handle', 'cls', 'model', 'look', 'status', 'at', 'trip', 'act', 'home', 'crew', 'wear', 'drip', 'marks', 'lastSay', 'x', 'z', 'npc', 'localOf', 'retired', 'wanted', 'mood'];   // (mood: + VISIBLE HIGHS, below)
// names that must never reach a viewer live (the anti-cheat check looks for every one, at any depth, in public output)
export const PRIVATE_KEYS = ['cash', 'heat', 'stash', 'inv', 'lastThink', 'think', 'plan', 'triggers', 'notes', 'memory', 'mem', 'treasury', 'budget', 'high', 'haze', 'sees', 'whisper'];
export const isFull = s => !!s && Array.isArray(s.agents) && s.agents.some(a => a && ('cash' in a || 'heat' in a || 'inv' in a || 'lastThink' in a));

// ── THE CITY'S RULES (slime, 2026-10-07), applied AFTER the sim's publicView, so the verbatim block stays the sim's and the drift check
// keeps working. The rule: LIVE shows only what a witness on the street could know; everything else goes on the tape a day late.
//   1 DMs        a `say` with dm: true is private: gone from public events, the public log and `lastSay` (an agent whose last line was a
//                DM shows its last line said out loud, else none). On the tape, in archive, and live to both parties' owners (myEvents).
//   2 burglary   public: the house was burgled, no burglar anywhere (`who` stripped; "@X failed to break into …" → "someone failed …";
//                a burglar's dog-bite hospital trip is anonymous: only a break-in sets a dog on someone, so the one bitten IS the
//                burglar — "someone was taken to St. Mercy: bitten by a dog", `who` stripped). Named on the tape. The victim's owner sees the
//                burglar live only if the victim saw them: the lot has CCTV (a security entry named `cctv` or `camera`, active at the
//                time — no such item exists yet, so today this never fires) or the victim woke up (`woke`, as the sim's own memory has it)
//   3 robbery    seen: false → public, robber unnamed ("@Y was robbed at …", `who` stripped; nor in what it sets off that minute:
//                see cityEvent — hospital trips, bounties, a crew's payback call, a death; a failed robber's own trip "beaten off by @Y" is
//                "someone was taken to St. Mercy: hurt in a fight", `who` stripped: the one beaten off IS the robber). A burglary's crew payback is anonymous too. The victim's owner sees the robber live (the victim was there); the tape names them; a report or
//                warrant stays public and names them. seen: true (or a run that doesn't record `seen`) stays fully public
//   4 stats      counts of private event types (SECRET_STATS) leave the live `stats`; yesterday's totals come from the director's cut
//                (statsCut). Counts of public crimes (robberies, burglaries, arrests …) stay live.
//   5 whereabouts  an agent at a lot it doesn't own (someone else's house, or a vacant one) is shown only coarsely: `at` becomes the
//                district ('dist:trailer'), x/z the district's middle, `act` null, and a trip there or from there the same (its end
//                legs too: the lot's id or one derived from it, as its kerb → the district, the path cut where it enters the lot's
//                district, no metres, no wait spot there — cutLeg below; no director's `warn` to the lot's owner); its move,
//                say, deal … events there name the district ("heads to somewhere in Sunny Acres"). A public act AT that lot keeps
//                it visible: a cop's raid or search, a seen robbery, buying it (claim) — and a burglary names the house, not the burglar.
//                The tape and archive show the real lot; the agent's own owner sees it live (me, myEvents). Whose lot it is: for a card,
//                the state's own lots; for an event, the owners as of the event's minute (THE OWNERS THEN, ownerBook below), so an
//                event lensed later (a backfill, a rewind) is the form it had live.
//                THE ARRIVAL MINUTE (slime, 2026-10-09; ui-review #1: the minute a burglar arrives is the burglary's minute): a trip TO
//                someone else's lot drops its arrival time — the trip's and the move's `arr`, its `fare` (a cab's fare is its length),
//                the "(27m on foot)" in the move's text, and in the legs the clock stops where the public path does (coarseLegs); its
//                `arrive` event there is not public at all. And the minute it LEAVES (2026-10-09 follow-up: in the 09-29 model run 54
//                of 66 arrivals at someone else's lot were followed by a departure the same minute, which gave the arrival back): a
//                trip FROM the lot starts its public clock where its public path does (its `dep` is that minute), and its `move`
//                event is not public live (its minute, and its place in the log, is the departure's); the tape and the owner have it.
//   6 most wanted  the sim's Most Wanted (game.mjs: the most `n.crimes`, at least 3) counts unseen burglaries and robberies too: live,
//                it named a burglar nobody saw. The live one counts only crimes on the public record (publicRecord): a robbery
//                the street saw (its robber named; a payback is not a crime), a warrant (the victim's report), an arrest; at least
//                MW_MIN, alive, a tie to whoever got there first. The sim's own ranking waits for the tape (the director's
//                snapshot) and the archive. COUNTED ONCE (2026-10-10, the 10-09 leftover #4): those are records of crimes, not crimes —
//                one robbery the street saw, then reported (a warrant) and then an arrest, is ONE crime on the record (it counted 3):
//                publicRecord. THE BOUNTY (leftover #2): "@X collected the 20cr bounty on the Most Wanted, @Y" names whom the sim paid
//                on; it is public live only when the sim marks it `mostWantedFrom: 'public record'` (the sim pays on the public pick, the
//                one live shows); an unmarked one (an older sim: its own pick, a hidden burglar) waits for the tape.
//   + owner      in myEvents, other agents' events lose their `think`, and a secret `tip` or `scam` by someone else (the agent
//                doesn't know it was tipped on or scammed) waits for the tape.
//   + private acts  (2026-10-10) PRIVATE_ACTS: what an agent does to its own pockets and body, out of sight — `cut` ("cut their temp:
//                now 6 units": the stack and its count), `use` ("took temp — it was really HALLU": a drug's name is never public live,
//                slime 10-10) and `sober` (a look wearing off: the drug, when it was taken and where). Never public as they are
//                (cityEvent, marked `secret` or not; leaks() flags one); the tape and the agent's own owner (myEvents) keep them. Two have
//                a public form OUTDOORS (+ VISIBLE HIGHS, below: actForm): a `use` is "@X took something", a `sober` "@X was on SUDO
//                (12:02–12:10)".
//   + TRUTH      (slime 10-10, a drug's name is never public live) a `say` on TRUTH carries "[VERIFIED, on TRUTH] … (thinking: …)": in
//                public `say` events and `lastSay` the marker is "[VERIFIED]" (the thinking is the drug's own mechanic: kept). The tape
//                and the owner keep the original.
export const SECRET_STATS = ['scams', 'bribes', 'tips', 'gives', 'posted', 'expired', 'plansSet', 'planSteps', 'planInvalid', 'triggersFired', 'invalid', 'parseFails', 'fallbacks'];
export const CCTV = ['cctv', 'camera'];   // (lot.sec keys that record a burglar; `alarm` only wakes)
export const PRIVATE_ACTS = new Set(['cut', 'use', 'sober']);   // (+ private acts, above: never public as they are, the tape and the owner keep them)
const sober = x => x && typeof x.text === 'string' && x.text.includes('[VERIFIED, on ') ? { ...x, text: x.text.replace(/\[VERIFIED, on [^\]]+\]/g, '[VERIFIED]') } : x;   // (+ TRUTH, above)
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unseenRob = e => e.type === 'rob' && e.seen === false;
export const isDM = e => e?.type === 'say' && (e.dm === true || (typeof e.to === 'string' && e.to !== 'here'));
export const isDMSay = ls => !!ls && typeof ls.to === 'string' && ls.to !== 'here';
// one public event under the city's rules (null: not public). What a robbery or a break-in sets off in the same minute (the sim emits
// some of it just BEFORE the rob/burgle event) names the culprit only when the list shows how they were known: ctx.seen (a SEEN robbery,
// `robber>victim@t`) or ctx.arrests (an arrest, `cop>target@t`). Anything else — an unseen robbery, a burglary, a trigger outside the
// list — is anonymous (the safe side):
//   hospital "hurt in a robbery by @X" (the victim) · "beaten off by @Y" (a failed robber) · "bitten by @Y's dog" (a burglar)
//   bounty "@X collected … on @Y" (a robbery or an arrest) · crew_payback "… wants payback on @X for hitting @Y" (a robbery or a burglary)
//   death / the GHOST mark "shot during a robbery at P" → "shot at P", the killer (`to`) unnamed
const anon = (e, text) => { const { who: _w, ...r } = e; r.text = text; return r; };
const at = (re, who) => new RegExp(re.replace('WHO', '@' + esc(who) + '(?![\\w.])'));
export function cityEvent(e, ctx = {}) {
  if (!e) return null;
  if (isDM(e) || LEDGER_EVENTS.has(e.type)) return null;   // (a ledger event: private, marked or not)
  const T = String(e.text || ''), seen = k => !!ctx.seen?.has(k), arrested = k => !!ctx.arrests?.has(k);
  if (e.type === 'burgle' && e.who) return anon(e, T.replace(new RegExp('@' + esc(e.who) + '(?![\\w.])', 'g'), 'someone'));
  if (PRIVATE_ACTS.has(e.type)) return actForm(e, ctx.B);   // (a private act, marked `secret` or not: its public form outdoors, + VISIBLE HIGHS; else none)
  if (e.type === 'say') return sober(e);   // (+ TRUTH: "[VERIFIED, on TRUTH]" → "[VERIFIED]")
  if (unseenRob(e) && e.who) return anon(e, T.replace(new RegExp('^@' + esc(e.who) + ' (robbed|got payback on) @(\\S+)'), '@$2 was robbed').replace(at('^WHO tried to rob', e.who), 'someone tried to rob').replace(new RegExp('@' + esc(e.who) + '(?![\\w.])', 'g'), 'someone'));
  if (e.type === 'hospital') {
    const text = T.replace(/bitten by @\S+?'s dog/, 'bitten by a dog')
      .replace(/hurt in a robbery by @(\S+)/, (m, x) => seen(`${x}>${e.who}@${e.t}`) ? m : 'hurt in a robbery')
      .replace(/beaten off by @(\S+)/, (m, y) => seen(`${e.who}>${y}@${e.t}`) && !ctx.unseen?.has(`${y}>${e.who}@${e.t}`) ? m : 'hurt in a fight');   // (not the one who robbed them unseen that minute: a payback brawl names the hidden robber)
    // the one taken in is the culprit (2026-10-10, the 10-09 leftover #3): bitten by a dog (only a break-in sets one on someone) or
    // beaten off in a robbery the street didn't see — "@X was taken to St. Mercy: …" named them: anonymous, `who` stripped
    const beaten = T.match(/beaten off by @(\S+)/);
    if (e.who && (/bitten by @\S+?'s dog/.test(T) || (beaten && !seen(`${e.who}>${beaten[1]}@${e.t}`)))) return anon(e, text.replace(new RegExp('@' + esc(e.who) + '(?![\\w.])', 'g'), 'someone'));
    return text === T ? e : { ...e, text }; }
  if (e.type === 'bounty' && / bounty on the Most Wanted\b/.test(T) && e.mostWantedFrom !== MW_FROM) return null;   // (rule 6: whom an older sim paid on — its own pick — waits for the tape)
  if (e.type === 'bounty' && e.who && !seen(`${e.who}>${e.to}@${e.t}`) && !arrested(`${e.who}>${e.to}@${e.t}`)) return anon(e, T.replace(at('^WHO', e.who), 'someone'));
  if (e.type === 'crew_payback' && e.who) { const v = T.match(/for hitting @(\S+)/)?.[1]; if (!v || !seen(`${e.who}>${v}@${e.t}`)) return anon(e, T.replace(at(' on WHO', e.who), '')); }
  if ((e.type === 'death' || e.type === 'mark') && /shot during a robbery at/.test(T)) { const k = e.to || '', w = e.who;
    if (!(seen(`${w}>${k}@${e.t}`) || seen(`${k}>${w}@${e.t}`) || ctx.seenWho?.has(`${w}@${e.t}`))) { const { to: _k, ...r } = e; r.text = T.replace(/shot during a robbery at/, 'shot at'); return r; } }
  return e;
}
// ── rule 5, whereabouts: lots, their owners and the districts (opt.places: sim2/places.json { places, lots } or a Map id → place)
const isLotId = id => typeof id === 'string' && (id.startsWith('lot:') || id.startsWith('apt:'));
const DIST_NAMES = { forest: 'Blackpine Woods', sea: 'The Bay', downtown: 'Glasswall', strip: 'Neon Row', suburbs: 'Pleasantview', estates: 'Gatehill', trailer: 'Sunny Acres', industrial: 'The Yards', docks: 'Low Tide Docks', junkyard: 'The Heap', jail: 'Iron Island', hospital: 'St. Mercy', highway: 'Route 9', bridge: 'The Long Bridge', mall: 'Millennium Mall' };   // (sim2/places.json districts)
export const districtName = d => DIST_NAMES[d] || d;
const books = new WeakMap();
function bookOf(places) {
  if (!places || typeof places !== 'object') return null; let b = books.get(places); if (b) return b;
  const P = places instanceof Map ? places : new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p])), mid = new Map();
  for (const p of P.values()) { if (!p.dist || typeof p.x !== 'number') continue; const m = mid.get(p.dist) || { x: 0, z: 0, n: 0 }; m.x += p.x; m.z += p.z; m.n++; mid.set(p.dist, m); }
  const pts = [...P.values()].filter(p => p.dist && typeof p.x === 'number').map(p => [p.x, p.z, p.dist]);
  const distAt = (x, z) => { let best = null, bd = Infinity; for (const [px, pz, d] of pts) { const q = (px - x) ** 2 + (pz - z) ** 2; if (q < bd) { bd = q; best = d; } } return best; };   // (the district of the nearest place or lot)
  b = { P, distAt, mid: new Map([...mid].map(([d, m]) => [d, { x: Math.round(m.x / m.n), z: Math.round(m.z / m.n) }])) }; books.set(places, b); return b;
}
// a trip's legs (the movement contract, MOVEMENT.md §3: legs with node ids and `path` point lists) under rule 5: a leg that starts or ends
// at a foreign lot gets the district for that id, loses its metres (`m`), and its path is cut where it enters the lot's zone (the
// district the lot is in, or within ZONE m of it): a trip TO the lot keeps the path up to there, a trip FROM it from there on. The
// other legs stay public (a street witness sees you ride the bus). No places (no districts known): the whole end-leg path goes.
// A leg is at the lot when a node id of it STANDS FOR the lot (lotOf): the lot's own id, or one the movement contract derives from
// it, as the export's kerb where a cab or a bike stops for the lot ('kerb:lot:-284,134'; any '<prefix>:<lot id>' counts the same).
// Audit F05 (2026-10-08): the kerb leg kept the lot's id, the ride's whole path to its door and its metres. A wait's spot (`at`,
// the kerb where a cab is hailed) in the zone goes too, and a trip's total `metres` (the export's trip shape) with the legs' own.
const ZONE = 60;
const lotOf = id => { for (let s = id; typeof s === 'string'; ) { if (isLotId(s)) return s; const k = s.indexOf(':'); if (k < 0) return null; s = s.slice(k + 1); } return null; };
const zoneOf = (lot, B) => { const p = B?.P.get(lot); return pt => !p || !Array.isArray(pt) || Math.hypot(pt[0] - p.x, pt[1] - p.z) < ZONE || B.distAt(pt[0], pt[1]) === p.dist; };
function cutLeg(leg, lot, B) {
  const inZone = zoneOf(lot, B);
  const r = { ...leg, coarse: true }; delete r.m; const c = coarse(lot, B).at, A = lotOf(leg.from) === lot, Z = lotOf(leg.to) === lot;
  for (const k of ['from', 'to', 'at']) if (lotOf(r[k]) === lot) r[k] = c;
  if (Array.isArray(r.at) && inZone(r.at)) delete r.at;
  if (Array.isArray(leg.path)) { const P = leg.path;
    if (lotOf(leg.at) === lot || (A && Z)) r.path = [];
    else if (Z) { let i = 0; while (i < P.length && !inZone(P[i])) i++; r.path = P.slice(0, i); }
    else { let j = P.length; while (j > 0 && !inZone(P[j - 1])) j--; r.path = P.slice(j); } }
  return r;
}
// THE ARRIVAL MINUTE (rule 5, slime 2026-10-09): in a trip TO someone else's lot (dest) the public clock stops where the public path
// does. The leg that reaches the lot ends when its path enters the lot's zone: its own dep → arr scaled by the share of its path before
// the zone (the sim's own pace, so a cab drives its public stretch at its booked speed). Every leg after it (a cab's kerb to the door)
// starts and ends then. A leg with no path, or none of it public, ends at its departure. Without this, the last leg's `arr` is the
// minute of arrival (a burglar's: the burglary's minute). THE DEPARTURE (origin): the mirror — the leg that leaves the lot's zone starts
// when its path does (exitT), every leg before it (the walk to the kerb, the wait there) starts and ends then; none public: its arrival.
// One leg from a lot to a lot with no public stretch between: it starts and ends halfway between the two.
const plen = P => { let s = 0; for (let k = 1; k < P.length; k++) s += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); return s; };
function entryT(leg, lot, B) {
  if (typeof leg.dep !== 'number') return null; if (typeof leg.arr !== 'number') return leg.dep;
  const P = Array.isArray(leg.path) ? leg.path.filter(p => Array.isArray(p)) : [], inZone = zoneOf(lot, B), full = plen(P); let i = 0; while (i < P.length && !inZone(P[i])) i++;
  return Math.max(leg.dep, Math.round((leg.dep + (leg.arr - leg.dep) * (full > 0 ? Math.min(1, plen(P.slice(0, i)) / full) : 0)) * 1000) / 1000);
}
function exitT(leg, lot, B) {
  if (typeof leg.arr !== 'number') return null; if (typeof leg.dep !== 'number') return leg.arr;
  const P = Array.isArray(leg.path) ? leg.path.filter(p => Array.isArray(p)) : [], inZone = zoneOf(lot, B), full = plen(P); let j = P.length; while (j > 0 && !inZone(P[j - 1])) j--;
  return Math.min(leg.arr, Math.max(leg.dep, Math.round((leg.dep + (leg.arr - leg.dep) * (full > 0 && j < P.length ? plen(P.slice(0, j + 1)) / full : 1)) * 1000) / 1000));
}
const timed = (r, dep, arr) => { r = { ...r }; for (const [k, v] of [['dep', dep], ['arr', arr]]) if (v !== undefined) { if (v === null) delete r[k]; else r[k] = v; } return r; };
function coarseLegs(legs, lots, B, dest = null, origin = null) { if (!Array.isArray(legs)) return legs;
  const at = (l, lot) => [l.from, l.to, l.at].some(id => lotOf(id) === lot);
  let out = legs.map(l => { let r = l; for (const lot of lots) if (at(r, lot)) r = cutLeg(r, lot, B); return r; });
  let x = -1, start = null; if (origin) legs.forEach((l, k) => { if (at(l, origin)) x = k; });
  const y = dest ? legs.findIndex(l => at(l, dest)) : -1; let stop = y >= 0 ? entryT(legs[y], dest, B) : null;
  if (x >= 0) { start = exitT(legs[x], origin, B); if (x === y && start !== null && stop !== null && start > stop) start = stop = Math.round((start + stop) * 500) / 1000; }
  return out.map((r, k) => { if (x >= 0 && k < x && at(legs[k], origin)) r = timed(r, start, start); else if (x >= 0 && k === x) r = timed(r, start, undefined);
    if (y >= 0 && k === y) r = timed(r, undefined, stop); else if (y >= 0 && k > y) r = timed(r, stop, stop);
    return r; }); }
// a move's text without what times the trip: "(27m on foot)" → "(on foot)", "(12m by taxi, 9cr)" → "(by taxi)"
const untimed = text => text.replace(/ \(([^()]*)\)$/, (m, s) => { const k = s.replace(/\b\d+(?:\.\d+)?m\b ?/g, '').replace(/,? ?\b\d+cr\b/g, '').trim(); return k ? ` (${k})` : ''; });
function coarseTrip(trip, who, owners, B) {
  const lots = ['from', 'to'].map(k => trip[k]).filter(id => foreignLot(id, who, owners)); if (!lots.length) return trip;
  const t = { ...trip }, dest = lots.includes(trip.to) ? trip.to : null, origin = lots.includes(trip.from) ? trip.from : null; delete t.metres; delete t.seconds; delete t.fare;   // (the export's trip shape: its length and its duration; a cab's fare is its length)
  for (const k of ['from', 'to']) if (lots.includes(t[k])) t[k] = coarse(t[k], B).at;
  if (t.legs) t.legs = coarseLegs(t.legs, lots, B, dest, origin);
  if (dest) delete t.arr;   // (the arrival minute: above)
  if (origin) { const L = t.legs, n = typeof trip.dep === 'number' && typeof trip.arr === 'number', s = Array.isArray(L) && L.length ? L[0].dep : !n ? null : dest ? Math.round((trip.dep + trip.arr) * 500) / 1000 : trip.arr;
    if (typeof s === 'number') t.dep = s; else delete t.dep; }   // (the departure: its public clock starts where its public path does; no legs: at its public end)
  return t;
}
export const PUBLIC_ACTS = new Set(['raid', 'search', 'claim', 'burgle']);   // (+ a robbery that names its robber: a seen one)
export const actAt = e => !!e && (PUBLIC_ACTS.has(e.type) || (e.type === 'rob' && !!e.who && e.seen !== false));
// someone else's lot (or a vacant one) for this handle: owners = Map lot id → owner handle (the public lots)
export const foreignLot = (id, who, owners) => isLotId(id) && owners.get(id) !== who;
function coarse(id, B) { const d = B?.P.get(id)?.dist; return d ? { at: 'dist:' + d, name: 'somewhere in ' + districtName(d), mid: B.mid.get(d) || null } : { at: null, name: 'somewhere in the city', mid: null }; }
// A `warn` (the director's heads-up to a lot's owner: "@X got word that @Y is heading to their house") is only ever about a trip to
// someone else's lot, and it names whose house: not public live (audit F05). The owner has it in myEvents, the tape has it.
function coarseEvent(e, owners, B) {
  if (e?.type === 'warn') return null;
  if (!e?.who || actAt(e)) return e;
  const keys = e.type === 'move' ? ['from', 'to'] : ['at'], hit = keys.filter(k => foreignLot(lotOf(e[k]), e.who, owners)); if (!hit.length) return e;
  if (e.type === 'arrive') return null;   // (the arrival minute: an arrival at someone else's lot says nothing but when)
  if (e.type === 'move' && hit.includes('from')) return null;   // (the departure: a move FROM someone else's lot is its minute, and its place in the log)
  const r = { ...e }; let text = String(e.text || ''); delete r.metres; delete r.seconds;
  for (const k of hit) { const lot = lotOf(e[k]), c = coarse(lot, B), nm = B?.P.get(lot)?.name; if (nm) text = text.split(' to ' + nm).join(' ' + c.name).split(' at ' + nm).join(' ' + c.name).split(nm).join(c.name); r[k] = c.at;
    if (e.type === 'move') { const [x, z] = k === 'from' ? ['x0', 'z0'] : ['x1', 'z1']; if (x in r) { r[x] = c.mid?.x ?? null; r[z] = c.mid?.z ?? null; } } }
  const dest = e.type === 'move' && hit.includes('to') ? lotOf(e.to) : null;
  if (e.type === 'move' && Array.isArray(e.legs)) r.legs = coarseLegs(e.legs, hit.map(k => lotOf(e[k])), B, dest);
  if (dest) { delete r.arr; delete r.fare; text = untimed(text); }   // (the arrival minute: see coarseLegs)
  r.text = text; return r;
}
// the agents' cards under rule 5 (in place). events: the public events of the same answer (a public act at the lot keeps it visible);
// t: the answer's game minute. THE ARRIVAL MINUTE on the card: a card shown by district is `active` (its act is gone; `busy` would time
// it), and an agent in transit (no `at`) on a trip TO someone else's lot is shown there already once the trip's public clock has
// stopped (its last leg's end, coarseLegs; no legs: its departure). Before, the card's trip ended and `busy` turned `active` at the
// minute of arrival: a burglar's card flipped on the burglary's minute (19 of 23 in the 10-09T12-43 dry run). The mirror for a trip
// FROM someone else's lot: still shown there until the trip's public clock starts (its `dep`, coarseTrip).
function coarseAgents(agents, owners, B, events = [], t = null) {
  const act = new Map(), arrived = new Map();
  for (const e of events) { if (e.type === 'arrive' && e.who) arrived.set(`${e.who}@${e.at}`, e.t); if (actAt(e) && e.who && e.at) act.set(`${e.who}@${e.at}`, e.t); }
  const there = (a, id) => { const c = coarse(id, B); a.at = c.at; a.act = null; if (a.status === 'busy') a.status = 'active'; if ('x' in a) a.x = c.mid?.x; if ('z' in a) a.z = c.mid?.z; };
  for (const a of agents || []) {
    if (foreignLot(a.at, a.handle, owners)) { const k = `${a.handle}@${a.at}`; if (!(act.has(k) && act.get(k) >= (arrived.get(k) ?? -Infinity))) there(a, a.at); }
    if (a.trip) { const dest = foreignLot(a.trip.to, a.handle, owners) ? a.trip.to : null, origin = foreignLot(a.trip.from, a.handle, owners) ? a.trip.from : null; a.trip = coarseTrip(a.trip, a.handle, owners, B);
      if ((dest || origin) && typeof t === 'number' && a.at == null) { const L = a.trip.legs, end = Array.isArray(L) && L.length ? L[L.length - 1].arr : a.trip.dep;
        if (origin && !(typeof a.trip.dep === 'number' && t >= a.trip.dep)) { there(a, origin); a.trip = null; }
        else if (dest && (typeof end !== 'number' || t >= end)) { there(a, dest); a.trip = null; } } }
  }
}

// a list of public events under the city's rules: first every robbery and arrest in it (the sim emits some consequences before them).
// opt.owners (Map lot → owner) + opt.places: rule 5 on the events' places. opt.ownersAt (minute → Map, an ownerBook's at): rule 5 on
// each event with the owners as of its own minute (THE OWNERS THEN, below); it wins over opt.owners. opt.context: more of the log (raw or
// public; only its public robberies and arrests count) to find those in, for a list cut inside a minute — /state's last 150, /events
// since an id, the last 30 news — so an event at the cut has the form it has in the whole log (a victim's "hurt in a robbery by @X" lost
// its robber when the seen robbery fell just outside /state's window or its news: #1570 and #1237 in the 09-29 run)
export function cityEvents(list, opt = {}) { const seen = new Set(), arrests = new Set(), seenWho = new Set(), unseen = new Set(), out = [];
  for (const L of [opt.context, list]) for (const e of L || []) { if (!e || e.secret || PRIVATE_EVENTS.has(e.type)) continue;
    if (e.type === 'rob' && e.who && e.seen !== false) { seen.add(`${e.who}>${e.to}@${e.t}`); seenWho.add(`${e.who}@${e.t}`); seenWho.add(`${e.to}@${e.t}`); } if (e.type === 'rob' && e.who && e.seen === false) unseen.add(`${e.who}>${e.to}@${e.t}`); if (e.type === 'arrest' && e.who) arrests.add(`${e.who}>${e.to}@${e.t}`); }
  const at = typeof opt.ownersAt === 'function' ? opt.ownersAt : null, B = at || opt.owners ? bookOf(opt.places) : null;
  const PB = bookOf(opt.places);   // (+ VISIBLE HIGHS: a private act's public form needs the places)
  for (const e of list || []) { let c = cityEvent(e, { seen, arrests, seenWho, unseen, B: PB }); const own = c && (at ? at(e.t) : opt.owners); if (own) c = coarseEvent(c, own, B); if (c) out.push(c); } return out; }
// THE OWNERS THEN (2026-10-09, the public rewind). Rule 5 asks who owns a lot. For an event the answer is the owners as of the event's
// own minute (the end of it: every claim and eviction of that minute in), never today's. With today's, a past event changed form when it
// was lensed later (/events, /state's window, a rewind, a page's backfill): an agent who later bought the house they had broken into
// got their move there (its arrival minute: the burglary's), their `arrive` and their `say` there shown precisely, which names the
// burglar (the 10-09 repro: 3 of 3 events on the sim and on the replay); and an agent who moved out had their own home's past events
// turn coarse (782 events in 25 of the 47 recorded runs with a claim, up to 175 in one). ownerBook(): the lots' owners over time.
// note(t, lots) at a game minute (lots: any iterable of { id, owner }, or a Map id → owner; a later note in the same minute replaces it:
// the end of the minute wins; a note before the last drops what came after it, a clock that went back), at(t) the owners at the end of
// minute t (before the first note: the first). Only owned lots are kept (a vacant lot is someone else's for everyone, as before).
// cityEvents / cityRules / publicOf take book.at as opt.ownersAt.
export function ownerBook() {
  const T = [], O = [], none = new Map();
  const owned = x => new Map((x instanceof Map ? [...x] : [...(x || [])].map(l => [l?.id, l?.owner])).filter(([id, o]) => typeof id === 'string' && o));
  const same = (p, q) => p.size === q.size && [...p].every(([id, o]) => q.get(id) === o);
  const book = {
    note(t, x) { if (typeof t !== 'number') return book; const m = owned(x); while (T.length && T[T.length - 1] > t) { T.pop(); O.pop(); }
      const k = T.length - 1;
      if (k >= 0 && T[k] === t) { if (k > 0 && same(O[k - 1], m)) { T.pop(); O.pop(); } else O[k] = m; }
      else if (k < 0 || !same(O[k], m)) { T.push(t); O.push(m); }
      return book; },
    at: t => { let lo = 0, hi = T.length - 1, k = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (T[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return O[k] ?? none; },
    get changes() { return T.map((t, k) => ({ t, owners: O[k] })); } };
  return book;
}
// rule 6 · THE PUBLIC MOST WANTED. publicRecord(log): per handle, the crimes on the public record in a log (raw or public, in order):
// { n, t } (t: when the n-th came). publicMostWanted(log, agents): the most of them, at least MW_MIN (the sim's own floor), not dead or
// retired (agents: the public cards), a tie to whoever got there first. A public state carries mostWantedFrom: MW_FROM.
// COUNTED ONCE (2026-10-10, the 10-09 leftover #4: one robbery seen, reported and arrested counted 3). The record holds CRIMES; a
// warrant and an arrest are what the street learns about them. A robbery the street saw is one. A warrant for a robbery (its text:
// "(robbery, reported by the victim)") is one of theirs the street saw and nobody had reported yet, within a report's reach (MW_WARRANT
// game minutes, rules.mjs WARRANT.minutes: lenscheck checks the number), the oldest first; with none, it is one more (a robbery the
// street didn't see, now reported; selling fakes). An arrest is for what came before it when anything did since their last arrest (a
// seen robbery, a warrant: an open case), else it is one more. A warrant doesn't say whose report it is, so a seen robbery of one
// victim can take the warrant of another's unseen one: one fewer, never one more (the safe side).
// recordBook(): the same one event at a time — add(e), record (the Map), mostWanted(agents). The sim keeps one: its Most Wanted
// bounty pays on this pick (the one live shows) and marks its event mostWantedFrom: MW_FROM (cityEvent: an unmarked one isn't public).
export const MW_MIN = 3, MW_FROM = 'public record', MW_WARRANT = 1440;
export function recordBook() {
  const R = new Map(), of = h => { let r = R.get(h); if (!r) R.set(h, r = { n: 0, t: null, robs: [], open: false, seenT: null, warrantT: null, arrestT: null }); return r; }, one = (r, t) => { r.n++; r.t = t; r.open = true; };
  const add = e => { if (!e || e.secret || PRIVATE_EVENTS.has(e.type)) return;
    if (e.type === 'rob' && typeof e.who === 'string' && e.who && e.seen !== false && !/ got payback on @/.test(String(e.text || ''))) { const r = of(e.who); one(r, e.t); r.robs = r.robs.filter(t => e.t - t < MW_WARRANT); r.robs.push(e.t); r.seenT = e.t; }   // (a robbery the street saw)
    else if (e.type === 'warrant' && typeof e.who === 'string' && e.who) { const r = of(e.who); r.robs = r.robs.filter(t => e.t - t < MW_WARRANT); r.warrantT = e.t;
      if (/\(robbery\b/.test(String(e.text || '')) && r.robs.length) { r.robs.shift(); r.open = true; } else one(r, e.t); }   // (that robbery, reported; else one more)
    else if (e.type === 'arrest' && typeof e.to === 'string' && e.to) { const r = of(e.to); if (!r.open) one(r, e.t); r.open = false; r.arrestT = e.t; } };   // (for the open case; else one more)
  return { add, record: R, mostWanted: agents => mostWantedOf(R, agents) };
}
function mostWantedOf(R, agents = []) {
  const gone = new Set((agents || []).filter(a => a && (a.status === 'dead' || a.retired)).map(a => a.handle)); let best = null;
  for (const [h, r] of R) if (r.n >= MW_MIN && !gone.has(h) && (!best || r.n > best.n || (r.n === best.n && (r.t < best.t || (r.t === best.t && h < best.h))))) best = { h, n: r.n, t: r.t };
  return best ? best.h : null;
}
// THE PUBLIC WANTED FLAG (2026-10-10, the planner's leak). The sim's `wanted` (publicView, verbatim) is heat ≥ HEAT.wanted, and heat
// rises on what nobody saw: an unseen robbery, a burglary, a private sale, cooking, a secret tip, cash over a line. So the flag on a card
// told the street about crimes it can't know. Live it comes from the public record instead (cityRules, with the record): wanted while
// the police have PUBLIC grounds to arrest them, the sim's own grounds less what nobody saw — a warrant (the victim's report), newer
// than their last arrest and under MW_WARRANT old (rules.mjs WARRANT.minutes: its life), or a crime the street saw (a seen robbery, not
// a payback) newer than their last arrest and under MW_SEEN old (rules.mjs COPS.arrestWindow: how long a witnessed crime is grounds).
// lenscheck checks both numbers. Never from heat, so it never moves at the minute of a hidden crime. The tape and the owner (`me`) keep
// the sim's heat. A state that is already public (the store's second pass) keeps the flags it was served with.
export const MW_SEEN = 60;
export const wantedOf = (r, now) => { if (!r) return false; const a = r.arrestT ?? -Infinity, w = r.warrantT ?? -Infinity, s = r.seenT ?? -Infinity; return (w > a && now - w < MW_WARRANT) || (s > a && now - s < MW_SEEN); };
export function publicRecord(list) { const b = recordBook(); for (const e of list || []) b.add(e); return b.record; }
export function publicMostWanted(list, agents = []) { return mostWantedOf(publicRecord(list), agents); }
// RULE 2 · A BREAK-IN IS FOUND (slime 2026-10-10; the 10-09 privacy leftover #1, option a). The minute a burglar arrives is the burglary's,
// and anyone can re-plan the arrival from a public departure, mode and origin with the export's own planner (20 of 23 within a minute on
// 10-09; 128 of 145 on seeds 404–408 on 10-10). So the sim (rules.mjs FOUND, game.mjs foundTick) emits a burglary nobody noticed `secret`
// at its own minute — the tape and the owners have it then — and reports it when it is FOUND: a public `burgle` with `of` (the
// burglary's id), `found` (owner | woke | neighbour | street) and no burglar, at that minute: when anyone but the burglar next arrives at
// the house or next door, the owner wakes up there, or a passer-by 1–6 game hours later. At once (as before) when the alarm went off, the
// dog bit, or the owner woke. Until then nothing public may move at its minute: unfoundOf(record) is the burglaries not found yet, and
// the live answer hides what they changed: the lot's 'burgled' scars (as many as were found; the timeline keeps one) and its wrecked
// security (the event's secBefore, as it was), here; and the burglary count in `stats` (rule 4 keeps public crime counts live) is the
// sim's count of the PUBLIC ones, `burglariesPublic` (cityRules; an older sim's own count otherwise).
export function unfoundOf(list) { const U = new Map(); for (const e of list || []) { if (e?.type !== 'burgle') continue; if (e.secret && e.who) U.set(e.id, e); else if (e.of != null) U.delete(e.of); } return U; }
function hideUnfound(out, list) {
  const U = unfoundOf(list); if (!U.size) return;
  const at = new Map(), seen = new Map(); for (const e of U.values()) at.set(e.at, [...(at.get(e.at) || []), e]);
  for (const e of list) if (e?.type === 'burgle' && e.ok && !e.secret && e.at) seen.set(e.at, (seen.get(e.at) || 0) + 1);   // (found or public at once)
  out.lots = (out.lots || []).map(l => { const L = at.get(l.id); if (!L) return l; const r = { ...l };
    if (Array.isArray(l.scars) && L.some(e => e.ok)) { let extra = l.scars.filter(x => x === 'burgled').length - (seen.get(l.id) || 0); const sc = [...l.scars]; for (let i = sc.length - 1; i >= 0 && extra > 0; i--) if (sc[i] === 'burgled') { sc.splice(i, 1); extra--; } r.scars = sc; }
    const before = Object.assign({}, ...L.filter(e => e.secBefore).reverse().map(e => e.secBefore));   // (the first break-in's: what the house had)
    if (l.sec && Object.keys(before).length) { r.sec = { ...l.sec }; for (const [k, v] of Object.entries(before)) if (!r.sec[k]) r.sec[k] = typeof v === 'number' && v > (out.t ?? 0) ? v : 0; }
    return r; });
}
// + VISIBLE HIGHS (slime 2026-10-10: live shows only a behaviour FAMILY, a drug's name only once it has worn off, the owner always sees their
// own agent's). The public card's `mood` ('wired' | 'spaced' | 'guarded', or absent; `look` is the appearance) comes from the sim's private
// `high` and `haze` (moodOf): TEMP → wired, FIREWALL → guarded, HALLU / CLEAR / SUDO → spaced, by the haze alone (rules.mjs DRUG_FX.haze:
// one length for all three, so how long the look lasts never tells them apart; a state without haze shows no spaced look), TRUTH →
// nothing. Stacked: WIRED > GUARDED > SPACED. Set (setMoods) only while the drug is on, the card `active` or `busy`, not shown by
// district, and the agent OUTDOORS (outdoorsNow): (a) no trip, at a place of an OUTDOOR kind; (b) on a trip whose current leg — on its
// public clock: the lensed legs, so a trip to or from someone else's lot counts only its public stretch — is on foot, on a skateboard,
// bike or scooter, or a wait at the kerb for a taxi. Without places, never. OUTDOOR: the kinds the city draws its agents standing
// outdoors at (simstate/stands.js STAND.radius: "kinds not listed: indoors only") less Iron Island's yard (jail): the corners, Glasswall
// Plaza, Fit Street, the park, the trailer park (hangout), the dig sites, the court's and the precinct's steps, the motel's lot. Never a
// home or any lot, the 24/7 Store, a forest lab, St. Mercy or Iron Island. The tape and the owner (`me.high`, `me.haze`) keep the drug.
// THE TWO PUBLIC FORMS (actForm; livePublic gives every server path the same): a `use` taken OUTDOORS (its `at`) is public as "@X took
// something" — no drug, label, fake or card; a `sober` (the sim's end of a look: { drug, from, to, at, usedAt }) whose `at` is OUTDOORS
// is public at its minute (`to`) as "@X was on SUDO (12:02–12:10)", the start (`from`, and the dose's place `usedAt`) only when the dose
// itself was taken outdoors, else "@X was on SUDO until 12:10". Anywhere else neither is public: the tape and the owner keep them.
export const MOODS = ['wired', 'spaced', 'guarded'];
export const OUTDOOR = new Set(['corner', 'plaza', 'fit', 'park', 'hangout', 'site', 'court', 'police', 'motel']);
export const SPACED_DRUGS = ['hallu', 'clear', 'sudo'];   // (rules.mjs SPACED: lenscheck checks it)
const OPEN_LEGS = new Set(['walk', 'skate', 'bike', 'scooter']), ACT_FORMS = new Set(['use', 'sober']);
export const moodOf = a => { const h = a?.high && typeof a.high === 'object' ? a.high : {}; return h.temp > 0 ? 'wired' : h.firewall > 0 ? 'guarded' : a?.haze > 0 ? 'spaced' : null; };
const outdoorAt = (id, B) => !!B && typeof id === 'string' && OUTDOOR.has(B.P.get(id)?.kind);
function outdoorsNow(a, t, B) {
  if (!B) return false; if (!a.trip) return outdoorAt(a.at, B);
  const L = a.trip.legs; if (!Array.isArray(L) || typeof t !== 'number') return false;
  const k = L.findIndex(l => typeof l?.dep === 'number' && typeof l?.arr === 'number' && l.dep <= t && t < l.arr); if (k < 0) return false;
  return OPEN_LEGS.has(L[k].kind) || (L[k].kind === 'wait' && L[k + 1]?.kind === 'taxi');
}
function setMoods(out, moods, B) {
  for (const a of out.agents || []) { const m = moods?.get(a.handle); delete a.mood;
    if (MOODS.includes(m) && (a.status === 'active' || a.status === 'busy') && !(typeof a.at === 'string' && a.at.startsWith('dist:')) && outdoorsNow(a, out.t, B)) a.mood = m; }
}
const hm = t => `${String(Math.floor((((t % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(((t % 60) + 60) % 60)).padStart(2, '0')}`;
const dhm = t => `D${Math.floor(t / 1440) + 1} ${hm(t)}`;
function actForm(e, B) {
  if (!e || typeof e.who !== 'string' || !outdoorAt(e.at, B)) return null;
  const base = { id: e.id, t: e.t, ts: e.ts, type: e.type, who: e.who, at: e.at };
  if (e.type === 'use') return { ...base, text: `@${e.who} took something` };
  if (e.type !== 'sober' || typeof e.drug !== 'string' || !/^[a-z]+$/.test(e.drug) || typeof e.to !== 'number' || !(e.t >= e.to)) return null;
  const D = e.drug.toUpperCase(), from = typeof e.from === 'number' && e.from <= e.to && outdoorAt(e.usedAt, B) ? e.from : null;
  const span = from === null ? null : Math.floor(from / 1440) === Math.floor(e.to / 1440) ? `${hm(from)}–${hm(e.to)}` : `${dhm(from)}–${dhm(e.to)}`;
  return { ...base, drug: e.drug, ...(from === null ? {} : { from, usedAt: e.usedAt }), to: e.to, text: span ? `@${e.who} was on ${D} (${span})` : `@${e.who} was on ${D} until ${hm(e.to)}` };
}
const USE_KEYS = ['id', 't', 'ts', 'type', 'who', 'at', 'text'], SOBER_KEYS = [...USE_KEYS, 'drug', 'from', 'usedAt', 'to'];
const isActForm = o => (o.type === 'use' && Object.keys(o).every(k => USE_KEYS.includes(k)) && /^@\S+ took something$/.test(String(o.text)))
  || (o.type === 'sober' && Object.keys(o).every(k => SOBER_KEYS.includes(k)) && typeof o.to === 'number' && o.t >= o.to && ('from' in o) === ('usedAt' in o) && /^@\S+ was on [A-Z]+ (\(.+\)|until \d\d:\d\d)$/.test(String(o.text)));
// one raw event's public form, before the city's rules (cityEvents): what publicEvent (verbatim) passes, or a private act's public form.
// Every path that builds a public log from the raw one (the sim's and the replay's /events and public tape) takes this, so the public
// `use` and `sober` read the same in every answer (publicOf does the same before publicView)
export const livePublic = (e, places) => publicEvent(e) ?? (e?.secret && ACT_FORMS.has(e.type) ? actForm(e, bookOf(places)) : null);
// the city's rules over a public view (in place). opt.events: raw events to find an agent's last line said out loud; opt.lastLoud(h):
// the same from a fuller log (the replay); opt.cut: the director's snapshot (or null: pending) → statsCut; opt.record: the log the
// public Most Wanted is counted from (rule 6; without one, opt.mostWantedFrom says whether out.mostWanted already is that: else none);
// opt.ownersAt: the events and news under rule 5 with the owners as of each one's minute (an ownerBook's at; the cards always take the
// state's own lots: the owners at its minute). The log the window's and the news' robberies and arrests are found in: opt.record (the
// whole log so far), else opt.events
export function cityRules(out, opt = {}) {
  const owners = new Map((out.lots || []).map(l => [l.id, l.owner || null])), B = bookOf(opt.places), then = { owners, ownersAt: opt.ownersAt, places: opt.places, context: opt.record || opt.events };
  out.events = cityEvents(out.events, then); out.news = cityEvents(out.news, then);
  coarseAgents(out.agents, owners, B, out.events, out.t);
  setMoods(out, opt.moods, B);   // (+ VISIBLE HIGHS: after rule 5, on the cards as the street sees them)
  const loud = new Map(); for (const e of opt.events || []) if (e.type === 'say' && !isDM(e) && e.who) loud.set(e.who, { text: e.text, to: 'here', t: e.t });
  for (const a of out.agents || []) if (isDMSay(a.lastSay)) a.lastSay = opt.lastLoud?.(a.handle) ?? loud.get(a.handle) ?? null;
  for (const a of out.agents || []) if (a.lastSay) a.lastSay = sober(a.lastSay);   // (+ TRUTH)
  if (out.stats) { const st = { ...out.stats }; for (const k of SECRET_STATS) delete st[k]; if (typeof st.burglariesPublic === 'number') st.burglaries = st.burglariesPublic; delete st.burglariesPublic; out.stats = st; }   // (A BREAK-IN IS FOUND: the found ones)
  if ('cut' in opt) out.statsCut = statsCutOf(opt.cut, opt.delay);
  const rec = opt.record ? publicRecord(opt.record) : null; if (opt.record) hideUnfound(out, opt.record);   // (A BREAK-IN IS FOUND)
  out.mostWanted = rec ? mostWantedOf(rec, out.agents) : opt.mostWantedFrom === MW_FROM ? out.mostWanted ?? null : null;   // (rule 6: an older server's own, the sim's, is dropped)
  if (rec) for (const a of out.agents || []) a.wanted = wantedOf(rec.get(a.handle), out.t);   // (THE PUBLIC WANTED FLAG: the record's, never heat)
  out.mostWantedFrom = MW_FROM;
  return out;
}
export const statsCutOf = (cut, delay = null) => cut ? { asOf: cut.t, ts: cut.ts, delay, ...Object.fromEntries(SECRET_STATS.filter(k => cut.stats && k in cut.stats).map(k => [k, cut.stats[k]])) } : null;
// the owner's own events under the city's rules: what the agent itself witnessed. lots: the lots now (their visible security)
const sees = (lot, t) => !!lot?.sec && CCTV.some(k => { const v = lot.sec[k]; return v === true || (typeof v === 'number' && v > t); });
export function ownerEvents(list, me, lots = []) {
  const L = new Map((lots || []).map(l => [l.id, l])), out = [];
  for (const e of list || []) {
    if (e.who === me) { out.push(e); continue; }   // (its own doings, its own thoughts)
    if (e.secret && (e.type === 'tip' || e.type === 'scam')) continue;   // (tipped on, scammed: it doesn't know — the tape)
    let r = e; if ('think' in r) { const { think, ...x } = r; r = x; }   // (never someone else's thoughts)
    if (r.type === 'burgle' && r.to === me && r.who && !r.woke && !sees(L.get(r.at), r.t)) r = cityEvent(r);   // (no CCTV, slept through it: no name)
    out.push(r); }
  return out;
}

// the public view of a state. A FULL state (a snapshot, the replay's view=full, the demo) goes through the sim's own publicView; a state
// that is already public is whitelisted the same way (its `wanted` flag kept: publicView would read the missing heat as 0). Then the
// city's rules. opt.news: the news list (default: the state's own), opt.running (default: the state's own), opt.events (default: the
// state's own), opt.lastLoud / opt.cut / opt.delay: see cityRules, opt.places: sim2/places.json (rule 5 needs it for districts),
// opt.record: the whole raw log so far for the public Most Wanted (rule 6; default: a full state's events — the sim passes g.events —
// and for a state that is already public, its own pick when it carries the mark), opt.ownersAt: the owners as of each event's minute
// (an ownerBook's at: THE OWNERS THEN; without it the events take the state's own lots, as before).
// STATION COPS (sim/subway cfe86be, 2026-10-09): the stations the police are posted at this shift — `stationCops: { posted: [station ids,
// sorted], from, until }` (game min; rules.mjs STATION_COPS: 7 of the 13 stations, a new posting every 2 game hours). A city-wide rota drawn
// from the seed: it says nothing about any agent. Passed through after the verbatim block (the sim's own publicView doesn't know it), only
// in that shape; and on the public tape's snapshots (publicTapeSnap), so the rewind can draw the cops.
export const stationCopsOf = c => c && typeof c === 'object' && Array.isArray(c.posted) ? { posted: c.posted.filter(id => typeof id === 'string').sort(), from: typeof c.from === 'number' ? c.from : null, until: typeof c.until === 'number' ? c.until : null } : null;
export function publicOf(state, opt = {}) {
  if (!state || typeof state !== 'object') return state;
  const pub = !isFull(state), snap = { ...state, agents: state.agents || [], lots: state.lots || [], crews: state.crews || [] }, evs = opt.events ?? state.events ?? [];
  g = { news: opt.news ?? state.news ?? [] }; running = opt.running ?? state.running ?? true;
  const B0 = bookOf(opt.places), out = publicView(snap, evs.map(e => e?.secret && ACT_FORMS.has(e.type) ? actForm(e, B0) ?? e : e));   // (+ VISIBLE HIGHS: a private act's public form outdoors, livePublic)
  g = { news: [] }; running = true;
  if (pub) out.agents.forEach((a, k) => { const w = snap.agents[k]?.wanted; if (typeof w === 'boolean') a.wanted = w; });
  out.news = (out.news || []).map(publicEvent).filter(Boolean);   // (the one difference from the sim's own code: see the header)
  if (pub && state.statsCut !== undefined && !('cut' in opt)) out.statsCut = state.statsCut;   // (already served by the replay)
  { const sc = stationCopsOf(state.stationCops); if (sc) out.stationCops = sc; }   // (STATION COPS: the rota, shape-checked)
  const moods = new Map(snap.agents.map(a => [a?.handle, pub ? (MOODS.includes(a?.mood) ? a.mood : null) : moodOf(a)]));   // (+ VISIBLE HIGHS: a public state's own, checked again)
  if (!state.archive) cityRules(out, { ...opt, events: evs, record: opt.record ?? (pub ? null : evs), mostWantedFrom: pub ? state.mostWantedFrom : null, moods });   // (archive: a finished season shows everything)
  if (state.archive) out.archive = true;   // (the replay's --archive flag: the season is over)
  return out;
}
// the owner's view (sim2/server.mjs view=owner): public + me + myEvents (under ownerEvents). `full` is the full state now, `rec` the
// extras the sim keeps outside the snapshot (plan, triggers, notes, memory, sees: null where a recorded run doesn't hold them), `events`
// the full log so far.
export function ownerOf(full, handle, events, rec = {}, opt = {}) {
  const me = (full.agents || []).find(x => x.handle === handle); if (!me) return null;
  const home = me.home && (full.lots || []).find(l => l.id === me.home);
  return { ...publicOf(full, { events, ...opt }), me: { ...me, stash: home ? home.stash : null, plan: rec.plan ?? null, triggers: rec.triggers ?? [], notes: rec.notes ?? null, memory: rec.memory ?? null, sees: rec.sees ?? null },
    myEvents: ownerEvents(events.filter(e => e.who === handle || e.to === handle).slice(-80), handle, full.lots) };
}
// THE PUBLIC TAPE (2026-10-09, the public rewind: GET /tape?view=public on the sim and the replay). The public city between the
// director's horizon (now − delay: older is on the director's tape, everything) and the broadcast edge (now − lag: the page's delay, in
// game minutes; never past it): hourly snapshots, each the public answer at its minute (publicOf of the full state then, its own lots
// the owners) cut down to where everyone is — PUBLIC_TAPE_AGENT: position, status and trip — and the public events in the window, each
// through the lens with the owners as of its own minute (opt.ownersAt): the form it had live. Nothing a public answer at that minute
// didn't show; no cash, no secrets, nothing of an owner's or the director's view.
export const PUBLIC_TAPE_AGENT = ['handle', 'status', 'act', 'at', 'x', 'z', 'trip'];
export const publicTapeSnap = pub => ({ t: pub.t, ts: pub.ts, ...(pub.stationCops ? { stationCops: pub.stationCops } : {}), agents: (pub.agents || []).map(a => Object.fromEntries(PUBLIC_TAPE_AGENT.filter(k => a[k] !== undefined).map(k => [k, a[k]]))) });
// the public tape's window: { horizon, edge, lag, from, to, clamped, empty } from now, the director's delay, the page's lag and the asked
// from / to (game minutes or null)
export function publicTapeWindow({ now, delay, lag = 0, from = null, to = null }) {
  lag = Math.max(0, Math.floor(+lag || 0)); const horizon = now - delay, edge = now - lag, T = Math.min(to ?? edge, edge), F = Math.max(from ?? horizon, horizon, 0);
  return { horizon, edge, lag, from: F, to: T, clamped: (to ?? -Infinity) > edge || (from ?? Infinity) < horizon, empty: F > T };
}
// the director's cut (sim2/server.mjs view=director): the newest hourly snapshot at or before now − delay, and the events up to then
export function directorOf(snaps, events, now, delay) {
  const cut = now - delay; let snap = null; for (let k = snaps.length - 1; k >= 0; k--) if (snaps[k].t <= cut) { snap = snaps[k]; break; }
  return snap ? { delayMinutes: delay, ...snap, events: events.filter(e => e.t <= cut).slice(-150) } : { delayMinutes: delay, pending: `the director's cut starts ${delay} game minutes into the city` };
}
// any private name, at any depth: [] when clean, else the paths where one was found (the anti-cheat check; also a dev assert in store.js)
export function leaks(obj, where = '', out = [], depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8 || out.length > 20) return out;
  if (Array.isArray(obj)) { obj.forEach((v, k) => leaks(v, `${where}[${k}]`, out, depth + 1)); return out; }
  if (typeof obj.type === 'string' && (obj.secret || PRIVATE_EVENTS.has(obj.type) || LEDGER_EVENTS.has(obj.type))) out.push(`${where} (private event: ${obj.type}${obj.secret ? ', secret' : ''})`);
  for (const [k, v] of Object.entries(obj)) { if (PRIVATE_KEYS.includes(k) && v !== undefined) out.push(`${where}.${k}`); leaks(v, `${where}.${k}`, out, depth + 1); }
  if (typeof obj.type === 'string' && !obj.secret && PRIVATE_ACTS.has(obj.type) && !isActForm(obj)) out.push(`${where} (private act: ${obj.type})`);   // (a private act, unmarked, not in its public form: + private acts)
  if (obj.mood !== undefined && !MOODS.includes(obj.mood)) out.push(`${where}.mood (${String(obj.mood).slice(0, 12)}: not a behaviour family)`);   // (+ VISIBLE HIGHS: never a drug)
  return out;
}
