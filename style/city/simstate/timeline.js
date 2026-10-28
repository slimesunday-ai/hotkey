// HUMAN LAYER · THE TIMELINE: the sim's state at any game minute, from a recorded run's hourly snapshots and its events log. ONE copy,
// shared by tools/simreplay.mjs (which serves the live city with it), the tape player (simstate/tapeplay.js, in the page's worker) and
// the store's director's cut (storefeed.js), so they can never drift.
// The state at game minute T: the last snapshot at or before T, advanced by the events after it.
//   THE SNAPSHOT'S EDGE. The sim takes the snapshot inside the hour's tick (sim2/game.mjs hourly → onHour): the events of that minute's
//   tick (arrivals, releases, street sales, digging, cooking, crafting, the hour's turf / director / loan events, a patrol's arrest) are
//   already in it; the daily step, the 07:00 wake-up and every decision of that minute come after it. snapCut() finds that edge from the
//   event types (the last tick-only event of the snapshot's minute); every event past it is applied, none before it.
//   MONEY AND ITEMS (audit F17, 2026-10-09). Cash, pockets (stacks of { k, label, n, q, fake }, the snapshot's own shape) and the home
//   stash's cash move with the events that move them, at their minute: buys, sales (less the turf tax and crew dues), fares, digging,
//   cooking, crafting, the boards (list, bid, fill, buy), robbery, burglary, arrests, the hospital's bill, deaths, loans, bounties,
//   quests, bail, homes, gifts, contracts, the stash, the fence, bribes, crews — and the daily step at 06:00 (the `day` event: rent,
//   the city tax, the cops' pay) and dock-shift wages (an hour of a shift).
//   THE LEDGER EVENTS (sim/payouts, 2026-10-10; STORE.md "The ledger events"): what the sim used to change with no event now has one,
//   private (`secret`): `payout` (the Locals' hourly take, a tipster's fee, a hired dealer's sale: the boss's share and whether the unit
//   was the boss's, right after its `sale`), `refund` (an order, listing, contract, loan offer or bounty coming back: expired, in the hour's
//   tick, or withdrawn) and `worn_out` (a pick breaking). A tape from an older sim has none: what they carry lands at the next snapshot
//   as before, and a dealer's sale falls back to counting the boss's units. Still without one: a cop's evidence turned in leaves the
//   pockets as they were (the event doesn't say which stacks), a `cut` stack, an arrest bonus the pool couldn't pay in full; and the boss's
//   units going back when a dealer's job ends: counted since the hire (a robbery off a dealer who also holds their own of that label takes
//   the best first, either's: unknowable here), exact once the sim names them (a `refund` of: 'front', to the dealer, before the hire_end).
//   tools/tapecheck.mjs measures it against full states.
//   WEAR (F15 hook): today's `wear` events carry no slot, so they move only the pockets; applyWear() is where a structured wear change
//   ({ slot, item, on }) lands on the outfit.
// Pure JS: no DOM, no node. snaps sorted by t; events in emit order (by id: t never goes down).
export const SEC_DAYS = { lock: 4, door: 6, dog: 5, alarm: 7, safe: 8 }, BREAKS = ['lock', 'door'];   // sim2/rules.mjs SECURITY (days; which a burglary wrecks)
export const RUSH = { mult: 2, hours: 3 };   // sim2/rules.mjs DIRECTOR.rush
// sim2/rules.mjs (sim/movement f8ec64f), the numbers the money moves by. tools/tapecheck.mjs compares them with the sim's rules.mjs
export const RULES = {
  kit: 3, marketFee: 1, fakeCost: 2, motel: 5, bail: 25, arrestBonus: 5, hospitalBill: 15, contractFee: 1, crewFound: 0, wage: 1, wageMaxHours: 4,
  turfTax: .25, crewTax: .10, tax: { rate: .03, over: 100 }, salaryCap: 20, burgle: { takeCash: .5, takePocket: .3, safeCut: .5 },
  land: { trailer: 0, house: 45, estate: 150 }, cookOut: [2, 3, 4, 5, 6], skillStart: 2,
  skillOf: { digger: 'dig', cook: 'cook', dealer: 'deal', gunsmith: 'craft', cop: 'fight', local: 'fight' },
  recipes: { temp: ['leaf', 'goo'], hallu: ['leaf', 'salts'], sudo: ['salts', 'goo'], truth: ['leaf', 'leaf'], clear: ['salts', 'salts'], firewall: ['goo', 'goo'] },
  craft: { gun: { pipe: 1, spring: 1, grip: 1 }, lock: { pipe: 1, spring: 1 }, door: { pipe: 2, grip: 1 }, safe: { pipe: 1, spring: 2, grip: 2 }, pick: { pipe: 1, grip: 1 }, stove: { pipe: 2, spring: 1 }, rig: { pipe: 1, spring: 3, grip: 2 } },
  quests: { crew: 15, house: 25, day100: 20, chain: 15, rob: 10, burgle: 10, tipoff: 10, contracts: 15, gather20: 15, scrapgun: 15, cook5: 15, q90: 20, sell15: 20, fakes: 20, guns3: 15, gun2cop: 20, arrest3: 20, bribe: 20, raid: 20 },
  daily: 360, wake: 420,
};
const PRODUCT = new Set(Object.keys(RULES.recipes)), contraband = k => PRODUCT.has(k) || k === 'gun';
// the snapshot's edge: event types only the minute's tick emits (before the snapshot); a patrol's arrest is the hour's too
const TICK = new Set(['arrive', 'release', 'gather', 'cook', 'craft', 'gun', 'sale', 'street_fake', 'turf', 'locals_out', 'director', 'loan_late', 'loan_collect', 'loan_bounty', 'station_bust']);
const tickOnly = e => TICK.has(e.type) || (e.type === 'arrest' && e.patrol === true) || (e.type === 'hire_end' && / ended \(/.test(e.text || ''))   // (a job that runs out ends in the hour's tick)
  || e.type === 'worn_out' || (e.type === 'refund' && (e.why === 'expired' || (e.of === 'front' && e.why === 'ended'))) || (e.type === 'payout' && (e.of === 'locals' || e.of === 'front' || e.patrol === true));   // (the ledger's: a tipster's fee is its arrest's)
// a hired dealer's street sale: its share, the ledger event right after it (none: a tape from before sim/payouts)
const shareOf = (e, nx) => nx && nx.type === 'payout' && nx.of === 'front' && nx.to === e.who && nx.t === e.t ? nx : null;
const pad = n => String(n).padStart(2, '0');
export const stamp = t => `D${Math.floor(t / 1440) + 1} ${pad(Math.floor((t % 1440) / 60))}:${pad(t % 60)}`;
export const parseT = s => { if (s === undefined || s === null || s === '') return null; const m = String(s).match(/^D?(\d+)\s+(\d{1,2}):(\d{2})$/i); if (m) return (+m[1] - 1) * 1440 + +m[2] * 60 + +m[3]; const v = +s; return Number.isFinite(v) ? v : null; };
// "20cr + 3 temp", "4cr, 2 pipe" (the sim's stuffText / escrowOut lists) → [{ cr } | { label, n }]
const stuffOf = s => String(s || '').split(/\s*(?:\+|,)\s*/).map(p => p.trim()).filter(Boolean).map(p => { let m = p.match(/^(\d+)\s*cr$/); if (m) return { cr: +m[1] }; m = p.match(/^(\d+)\s+(.+)$/); return m ? { label: m[2].trim(), n: +m[1] } : null; }).filter(Boolean);

// VISIBLE HIGHS (2026-10-10; lens.js + VISIBLE HIGHS): between snapshots a dose's look starts at its `use` and ends at its `sober` — the
// look is all the public card reads (the sim counts a dose in turns, not minutes: what it holds between those two only the snapshot
// knows). dosed: the drug is on (`high`), a spaced one sets the haze (sim2/rules.mjs SPACED, DRUG_FX.haze; a fake does nothing); woreOff:
// gone, and a spaced look's end is the haze's (its sober comes when the haze ends, with every other spaced look then)
export const SPACED = ['hallu', 'clear', 'sudo'], HAZE = 3;
function dosed(a, e) { if (e.fake || typeof e.drug !== 'string') return; a.high = { ...(a.high || {}), [e.drug]: Math.max(1, a.high?.[e.drug] || 0) }; if (SPACED.includes(e.drug)) a.haze = HAZE; }
function woreOff(a, e) { if (a.high && e.drug in a.high) { const h = { ...a.high }; delete h[e.drug]; a.high = h; } if (SPACED.includes(e.drug)) a.haze = 0; }

// snaps / events may grow after creation (the tape extends as its horizon moves on): every lookup reads the arrays as they are now
export function createTimeline({ snaps, events, places = new Map() }) {
  const SNAPS = snaps, EVENTS = events, PLACES = places instanceof Map ? places : new Map([...(places.places || []), ...(places.lots || [])].map(p => [p.id, p]));
  const snapIdx = T => { let lo = 0, hi = SNAPS.length - 1, k = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (SNAPS[m].t <= T) { k = m; lo = m + 1; } else hi = m - 1; } return k; }, snapAt = T => SNAPS[snapIdx(T)];
  const firstEventAt = t => { let lo = 0, hi = EVENTS.length; while (lo < hi) { const m = (lo + hi) >> 1; if (EVENTS[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const lastEventUpTo = T => firstEventAt(T + 1);   // index one past the last event with t ≤ T
  // the first event the snapshot does NOT hold: past the last tick-only event of its minute (none: the minute's first event)
  // (an agent out of decisions for the day — `offline` since the 07:00 refill — heads straight home in the tick when it arrives or walks
  // out: that `move` / `sleep` right after its `arrive` / `release` is the tick's; anyone else's is its next decision's)
  function snapCut(snap) { const a = firstEventAt(snap.t), b = lastEventUpTo(snap.t); let k = a;
    for (let j = a; j < b; j++) { const e = EVENTS[j], p = j > a ? EVENTS[j - 1] : null;
      if (tickOnly(e) || ((e.type === 'move' || e.type === 'sleep') && p && p.who === e.who && (p.type === 'arrive' || p.type === 'release') && offline(e.who, j))) k = j + 1; } return k; }
  function offline(h, j) { const t = EVENTS[j].t, refill = Math.floor((t - 1 - RULES.wake) / 1440) * 1440 + RULES.wake, L = mine(h);   // (the last refill BEFORE t: at 07:00 the tick runs before wake())
    for (let i = L.length - 1; i >= 0; i--) { if (L[i] >= j) continue; const e = EVENTS[L[i]]; if (e.t < refill) return false; if (e.type === 'offline' && e.who === h) return true; } return false; }
  // each agent's events (who or to), by index; it grows with the log (the tape extends it)
  const BY = new Map(); let byN = 0;
  const mine = h => { for (; byN < EVENTS.length; byN++) { const e = EVENTS[byN]; for (const x of new Set([e.who, e.to])) if (typeof x === 'string') { let L = BY.get(x); if (!L) BY.set(x, L = []); L.push(byN); } } return BY.get(h) || []; };
  // an agent's skill level at event k (a cook's batch size): its latest `skill` event before k, else the class's head start
  function skillAt(a, skill, k) { const L = mine(a.handle); for (let j = L.length - 1; j >= 0; j--) { const e = EVENTS[L[j]]; if (L[j] < k && e.type === 'skill' && e.who === a.handle && e.skill === skill) return e.level; } return RULES.skillOf[a.cls] === skill ? RULES.skillStart : 0; }
  // FRONTED PRODUCT: a hired dealer's street sale of the boss's product pays the boss its share. The snapshot doesn't mark which units
  // are fronted, so each job's are counted from its own events (hire, front, sales, seizures) up to the snapshot's edge: worker →
  // { boss, cut, left: Map(label → units) }. A worker sells the boss's units first (the sim sells its best-priced stack: unknowable here)
  const FRONT = new Map();
  function frontedAt(base, cut) { const key = `${base.t}:${cut}`; let F = FRONT.get(key);
    if (!F) { F = new Map(); for (const h of base.hires || []) { if (!(h.until > base.t)) continue; const L = mine(h.worker), lo = firstEventAt(h.until - 3 * 1440 - 1); let s0 = -1;
        for (let j = L.length - 1; j >= 0 && L[j] >= lo; j--) { const e = EVENTS[L[j]]; if (L[j] < cut && e.type === 'hire' && e.who === h.worker && e.to === h.boss) { s0 = j; break; } }
        const f = { boss: h.boss, cut: h.cut, left: new Map() }; if (s0 >= 0) for (let j = s0; j < L.length && L[j] < cut; j++) fronted(f, EVENTS[L[j]], h.worker, EVENTS[L[j] + 1]);
        F.set(h.worker, f); } if (FRONT.size > 64) FRONT.clear(); FRONT.set(key, F); }
    return new Map([...F].map(([w, f]) => [w, { ...f, left: new Map(f.left) }])); }
  // nx: the event after e (a sale's share, when the sim says whose unit it was; else the boss's are counted as sold first)
  function fronted(f, e, w, nx) { const L = f.left;
    if (e.type === 'front' && e.who === f.boss && e.to === w) L.set(e.item, (L.get(e.item) || 0) + (e.n ?? 0));
    else if (e.type === 'sale' && e.who === w) { const lab = e.label ?? e.item, sp = shareOf(e, nx); if (sp ? sp.fronted : L.get(lab) > 0) { if (L.get(lab) > 0) L.set(lab, L.get(lab) - 1); return true; } }
    else if ((e.type === 'arrest' && e.to === w) || (e.type === 'death' && e.who === w)) L.clear();
    else if (e.type === 'rob' && e.ok && e.to === w) { const m = String(e.item || '').match(/^(\d+) (.+)$/); if (m && L.get(m[2]) > 0) L.set(m[2], Math.max(0, L.get(m[2]) - +m[1])); }
    return false; }
  // THE BOARDS (the swap meets). A `market` buy names the seller, the label, the units and the price, not the stack the sim hands over
  // (fake or real, its quality, its real kind). The snapshot doesn't hold the boards, so the timeline keeps them as rows { at, who, price,
  // s: the stack }: a `list` books the stacks it took off the seller, a buy takes the seller's rows at that price oldest first (the sim's
  // order: cheapest, then oldest), a listing's `refund` (expired, withdrawn) takes them off. BOARDS[i]: the rows at snapshot i's edge, each
  // from the one before by a replay of that hour (once). Before the first snapshot (and so on a one-snapshot timeline: the director's cut)
  // they're unknown: a buy off such a row takes its `scam` event's word (a seller who knew: fake, or really another kind), else the label's
  const BOARDS = [[]];
  function boardAt(i) { let b = BOARDS[Math.min(i, BOARDS.length - 1)];
    for (let j = BOARDS.length; j <= i; j++) { b = play(SNAPS[j - 1], snapCut(SNAPS[j]), SNAPS[j].t, b).board; if (j === BOARDS.length && EVENTS.at(-1)?.t > SNAPS[j].t) BOARDS.push(b); }   // (kept once the log is past that minute)
    return b; }
  // the full state at T (the snapshot's shape: agents, lots, crews, corners, cityEv …; t and ts set to T). No running / news / events:
  // the caller adds what it serves
  function advance(T) { const i = snapIdx(T); return play(SNAPS[i], lastEventUpTo(T), T, boardAt(i)).S; }
  // snapshot `base` advanced by the events from its edge up to index n, the boards from board0 → { S, board }
  function play(base, n, T, board0) {
    const S = structuredClone(base); S.t = T; S.ts = stamp(T);
    const A = new Map((S.agents || []).map(a => [a.handle, a])), lots = new Map((S.lots || []).map(l => [l.id, l]));
    const lot = id => { let l = lots.get(id); if (!l) { const p = PLACES.get(id); l = { id, owner: null, tier: p?.tier ?? null, stash: 0, sec: { lock: 0, alarm: 0, dog: 0 }, scars: [] }; lots.set(id, l); } return l; };
    const at = (a, id) => { a.at = id; const p = id && PLACES.get(id); if (p) { a.x = p.x; a.z = p.z; } else { delete a.x; delete a.z; } };
    const board = board0.filter(r => r.s.n > 0).map(r => ({ ...r, s: { ...r.s } })), scams = new Set();
    const from = snapCut(base), front = frontedAt(base, from), crews = new Set((S.crews || []).map(c => c.name)), missed = new Set(), dailyQuest = new Map(), raided = new Set(), debt = new Map();
    for (let k = from; k < n; k++) { const e = EVENTS[k], a = A.get(e.who), o = typeof e.to === 'string' ? A.get(e.to) : null;
      if (e.type !== 'sale' && e.type !== 'front') for (const x of [a, o]) { const f = x && front.get(x.handle); if (f) fronted(f, e, x.handle); }
      switch (e.type) {
        case 'move': if (a) { a.trip = e.legs ? { mode: e.mode, from: e.from, to: e.to, dep: e.dep, arr: e.arr, fare: e.fare ?? 0, legs: e.legs, taxi: !!e.taxi } : { from: e.from, to: e.to, dep: e.dep, arr: e.arr, taxi: !!e.taxi }; at(a, null); a.act = null; a.status = 'busy'; if (e.fare > 0) cash(a, -e.fare); } break;   // (a movement-branch trip keeps its mode, fare and legs: MOVEMENT.md §3)
        case 'arrive': if (a) { a.trip = null; at(a, e.at); a.status = 'active'; } break;
        case 'sleep': if (a) { a.status = 'asleep'; a.act = null; } break;
        case 'wake': if (a && a.status === 'asleep') a.status = 'active'; break;
        case 'release': if (a) { a.status = 'active'; a.trip = null; at(a, e.at); } break;
        case 'hospital': if (a) { a.status = 'hospital'; a.trip = null; a.act = null; at(a, 'hospital'); cash(a, -Math.min(RULES.hospitalBill, Math.max(0, a.cash ?? 0))); } break;
        case 'death': if (a) { a.status = 'dead'; a.trip = null; a.act = null; if (o) { for (const s of a.inv || []) addInv(o, s); cash(o, Math.max(0, a.cash ?? 0)); } a.inv = []; a.cash = 0; } break;
        case 'arrest': if (o) { o.status = 'jail'; o.trip = null; o.act = null; at(o, 'jail'); o.heat = 10;
          // contraband comes off them; a cop's own arrest books it as evidence and earns the bonus (a raid's arrest seizes the stash's: raid)
          const cb = (o.inv || []).filter(s => contraband(s.k)); o.inv = (o.inv || []).filter(s => !contraband(s.k));
          if (a) { if (!raided.has(`${e.who}>${e.to}@${e.t}`)) for (const s of cb) addInv(a, s); cash(a, RULES.arrestBonus); } } break;
        case 'activity': if (a && !a.trip && e.k) { a.act = e.k; a.status = 'busy'; } break;
        case 'claim': if (a && e.at) { const old = a.home && a.home !== e.at ? lots.get(a.home) : null;
          for (const l of lots.values()) if (l.owner === a.handle && l.id !== e.at) l.owner = null;
          const l = lot(e.at); l.owner = a.handle; if (e.tier) l.tier = e.tier; a.home = e.at; if (old) { l.stash = old.stash ?? 0; old.stash = 0; } cash(a, -(RULES.land[e.tier] ?? 0)); } break;
        case 'install': if (a) { takeK(a, e.item, 1); if (a.home && SEC_DAYS[e.item]) { const l = lot(a.home); l.sec ||= {}; l.sec[e.item] = Math.max(l.sec[e.item] || 0, e.t) + SEC_DAYS[e.item] * 1440; } } break;
        case 'burgle': if (e.ok && e.at && e.of == null) { const l = lot(e.at);   // (`of`: the report of a break-in when it is found, not the break-in: lens.js A BREAK-IN IS FOUND)
          if (!l.scars.includes('burgled')) l.scars.push('burgled');
          // the take: half the stash (a quarter with the alarm, half that with a safe) plus, from a sleeper inside, part of their pockets
          const cut = RULES.burgle.takeCash * (e.alarm ? .5 : 1) * (l.sec?.safe ? RULES.burgle.safeCut : 1), fromStash = Math.floor((l.stash ?? 0) * cut);
          l.stash = (l.stash ?? 0) - fromStash; if (o && e.asleep) cash(o, -Math.max(0, (e.take ?? 0) - fromStash)); if (a) cash(a, e.take ?? 0);
          for (const it of stuffOf((e.items || []).join(', '))) { const got = o && e.asleep ? takeLabel(o, it.label, it.n) : []; const left = it.n - got.reduce((s, x) => s + x.n, 0);
            if (a) { for (const s of got) addInv(a, s); if (left > 0) addInv(a, { k: it.label, label: it.label, n: left }); } }
          for (const k2 of BREAKS) if (l.sec?.[k2]) l.sec[k2] = 0; } break;
        case 'raid': if (e.at) { const l = lot(e.at); if (!l.scars.includes('raided')) l.scars.push('raided'); raided.add(`${e.who}>${e.to}@${e.t}`);
          if (a) for (const m of String(e.text || '').replace(/^.*? and seized /, '').matchAll(/(\S+) x(\d+)/g)) addInv(a, { k: m[1], label: m[1], n: +m[2] }); } break;
        case 'evicted': if (e.at) { const l = lot(e.at); l.owner = null; l.stash = 0; if (!l.scars.includes('boarded')) l.scars.push('boarded'); if (a) a.home = null; } break;
        case 'sale': if (e.at && S.corners?.[e.at]) S.corners[e.at].sat = +(S.corners[e.at].sat + 1).toFixed(2);
          if (a) { const price = e.price ?? 0, turf = S.corners?.[e.at]?.turf, f = front.get(a.handle), sp = shareOf(e, EVENTS[k + 1]); let net = price, share = 0;
            // the gross, less the street tax on someone else's turf, the boss's share of a fronted unit (the sim's own, its ledger
            // event: else counted), the seller's own crew dues
            if (turf && turf !== a.crew && crews.has(turf)) net -= Math.min(net, Math.round(price * RULES.turfTax));
            if (sp) { if (f) fronted(f, e, a.handle, sp); share = sp.cr ?? 0; cash(A.get(sp.who), share); }
            else if (f && fronted(f, e, a.handle)) { share = Math.round(net * (100 - f.cut) / 100); cash(A.get(f.boss), share); }
            const dues = a.crew && crews.has(a.crew) ? Math.min(net - share, Math.round(price * RULES.crewTax)) : 0;
            cash(a, net - share - Math.max(0, dues)); takeExact(a, { k: e.item, label: e.label ?? e.item, q: e.q ?? null, fake: !!e.fake }, 1); } break;
        case 'street_fake': if (a) { const lab = String(e.text || '').match(/selling fake (.+) and made a scene$/)?.[1]; if (lab) takeExact(a, { label: lab, fake: true }, 1); } break;
        case 'director': if (e.kind === 'rush' && e.at) S.cityEv = { ...(S.cityEv || {}), rush: { dist: e.at, mult: RUSH.mult, until: e.t + RUSH.hours * 60 } }; break;
        // ── money and items (F17)
        case 'gather': if (a) for (const k2 of e.items || []) addInv(a, { k: k2, n: 1 }); break;
        case 'cook': if (a && e.drug) { const per = RULES.cookOut[skillAt(a, 'cook', k)] ?? 2;
          // a fake batch's text says perBatchOut whatever it made: the cook's level says how many. A real one says its count; more than
          // any one batch makes is a rig's several sets
          if (e.fake) { cash(a, -RULES.fakeCost); addInv(a, { k: e.drug, n: per, q: 0, fake: true }); break; }
          const out = +(String(e.text || '').match(/^cooked (\d+) /)?.[1] ?? per), sets = out > Math.max(...RULES.cookOut) ? Math.max(1, Math.round(out / per)) : 1;
          for (const ing of RULES.recipes[e.drug] || []) takeK(a, ing, sets); addInv(a, { k: e.drug, n: out, q: e.q ?? null }); } break;
        case 'craft': if (a && e.item) { for (const [p, m] of Object.entries(RULES.craft[e.item] || {})) takeK(a, p, m); addInv(a, { k: e.item, n: 1 }); } break;
        case 'gun': if (a) { for (const p of ['pipe', 'spring', 'grip']) takeK(a, p, 1); addInv(a, { k: 'gun', n: 1 }); } break;
        case 'buy': if (a) { if (e.at === 'store' && SEC_DAYS[e.item]) { cash(a, -(e.price ?? 0)); if (a.home) { const l = lot(a.home); l.sec ||= {}; l.sec[e.item] = e.t + SEC_DAYS[e.item] * 1440; } break; }
          const q = e.price == null && e.item === 'kit' ? +(String(e.text || '').match(/bought (\d+) test kit/)?.[1] ?? 1) : 1;
          cash(a, -(e.price ?? q * RULES.kit)); addInv(a, { k: e.item, n: q }); } break;
        case 'list': if (a) { cash(a, -RULES.marketFee); for (const s of takeLabel(a, e.item, e.n ?? 1)) board.push({ at: e.at, who: a.handle, price: e.price, s }); } break;
        case 'bid': if (a) cash(a, -(e.n ?? 1) * (e.price ?? 0)); break;
        case 'fill': if (a) for (const m of String(e.text || '').matchAll(/(\d+) (\S+) to @(\S+) @(\d+)cr/g)) { const q = +m[1], b = A.get(m[3]); cash(a, q * +m[4]); for (const s of takeLabel(a, m[2], q)) if (b) addInv(b, s); } break;
        case 'market': if (a) for (const m of String(e.text || '').matchAll(/(\d+) (\S+) from @(\S+) @(\d+)cr/g)) { const q = +m[1], s0 = A.get(m[3]); cash(a, -q * +m[4]); if (s0) cash(s0, q * +m[4]); bought(a, k, m[3], m[2], +m[4], q); } break;
        case 'rob': if (e.ok && a && o) { cash(o, -(e.take ?? 0)); cash(a, e.take ?? 0); const it = String(e.item || ''); let m;
          if ((m = it.match(/^the (\S+) off them$/))) { applyWear(o, { item: m[1], on: false, slot: Object.keys(o.wear || {}).find(sl => o.wear[sl] === m[1]) ?? null, gone: true }); addInv(a, { k: m[1], n: 1 }); }
          else if ((m = it.match(/^their (\S+)$/))) { takeK(o, m[1], 1); addInv(a, { k: m[1], n: 1 }); }
          else if ((m = it.match(/^(\d+) (.+)$/))) for (const s of takeLabel(o, m[2], +m[1])) addInv(a, s); } break;
        // a stolen trait the cops give back at booking: out of the thief's pockets, else off their outfit (worn: its `wear` already took it
        // out of the pockets; nothing owed). A thief booked with their own, robbed back (@p0 → @p0): off the outfit, back in the pockets
        case 'recovered': if (a) { if (o) { if ((o.inv || []).some(s => s.k === e.item && s.n > 0)) takeK(o, e.item, 1); else applyWear(o, { item: e.item, on: false, slot: Object.keys(o.wear || {}).find(sl => o.wear[sl] === e.item) ?? null, gone: true }); }
          addInv(a, { k: e.item, n: 1 }); } break;
        case 'loan': if (a) { const m = String(e.text || '').match(/(?:borrowed|lent @\S+) (\d+)cr/), n2 = m ? +m[1] : 0;
          if (e.to === 'shark') cash(a, n2); else if (o) { cash(o, n2); if (!escrowed(e, k)) cash(a, -n2); } } break;
        case 'loan_offer': if (a) { const m = String(e.text || '').match(/^offered @\S+ a (\d+)cr loan/); if (m) cash(a, -+m[1]); } break;
        case 'repay': if (a) { const m = String(e.text || '').match(/ back (\d+)cr/), n2 = m ? +m[1] : 0; cash(a, -n2); if (o) cash(o, n2); } break;
        case 'loan_collect': if (a?.home) { const m = String(e.text || '').match(/took (\d+)cr/); if (m) { const l = lot(a.home); l.stash = (l.stash ?? 0) - +m[1]; } } break;
        case 'bounty': if (a) { const m = String(e.text || '').match(/collected (?:the )?(\d+)cr/); if (m) cash(a, +m[1]); } break;
        case 'bounty_posted': if (a) { const m = String(e.text || '').match(/put a (\d+)cr bounty/); if (m) cash(a, -+m[1]); } break;
        case 'quest': if (a) { const r = RULES.quests[e.quest] ?? 0; cash(a, r); if (e.t % 1440 === RULES.daily) dailyQuest.set(a.handle, (dailyQuest.get(a.handle) || 0) + r); } break;
        case 'bail': if (a) cash(a, -RULES.bail); break;
        case 'room': if (a) cash(a, -RULES.motel); break;
        case 'wear': if (a) { const w = wearOf(e); if (w.slot != null) applyWear(a, w);
          else if (w.on) { takeK(a, w.item, 1); if (w.off) addInv(a, { k: w.off, n: 1 }); } else addInv(a, { k: w.item, n: 1 }); } break;
        case 'stash': if (a?.home) { const l = lot(a.home); for (const x of stuffOf(String(e.text || '').match(/^stashed (.+) at home$/)?.[1])) { if (x.cr) { cash(a, -x.cr); l.stash = (l.stash ?? 0) + x.cr; } else takeLabel(a, x.label, x.n); } } break;
        case 'take': if (a?.home) { const l = lot(a.home); for (const x of stuffOf(String(e.text || '').match(/^took (.+) from the stash$/)?.[1])) { if (x.cr) { cash(a, x.cr); l.stash = (l.stash ?? 0) - x.cr; } else addInv(a, { k: x.label, label: x.label, n: x.n }); } } break;
        case 'use': if (a) { takeLabel(a, e.label ?? e.drug, 1); dosed(a, e); } break;
        case 'sober': if (a) woreOff(a, e); break;
        case 'test': if (a) takeK(a, 'kit', 1); break;
        case 'exposed': if (a && /tested their "/.test(e.text || '')) takeK(a, 'kit', 1); break;
        case 'label': if (a) { const m = String(e.text || '').match(/^relabelled (\S+) as "(.+)"$/), s = m && (a.inv || []).find(x => (x.label ?? x.k) === m[1]); if (s) s.label = m[2]; } break;
        case 'give': if (a && o) moveStuff(a, o, String(e.text || '').match(/^gave @\S+ (.+)$/)?.[1]); break;
        case 'offer': if (a) for (const x of e.give || []) { if (x.cr) cash(a, -x.cr); else if (x.k) takeLabel(a, x.k, x.n); } break;
        case 'contract': if (a && o) { const m = String(e.text || '').match(/: got (.+) for (.+)$/);
          if (m) { for (const x of stuffOf(m[1])) { if (x.cr) cash(a, x.cr); else addInv(a, { k: x.label, label: x.label, n: x.n }); } moveStuff(a, o, m[2]); } cash(o, -Math.min(RULES.contractFee, Math.max(0, o.cash ?? 0))); } break;
        case 'cancel': case 'decline': if (a) refundOffer(e, k); break;
        case 'front': if (a && o) { for (const s of takeLabel(a, e.item, e.n ?? 0)) addInv(o, s); const f = front.get(o.handle); if (f) fronted(f, e, o.handle); } break;
        case 'hire': if (a && o) front.set(a.handle, { boss: o.handle, cut: +(String(e.text || '').match(/keeps (\d+)%/)?.[1] ?? 0), left: new Map() }); break;
        // a job's end: fired (or run out), the boss's units go back to the boss; a dealer who quits keeps them
        case 'hire_end': { const [w, b] = / quit /.test(e.text || '') ? [a, o] : [o, a], f = w && front.get(w.handle);
          if (f && b && !/ quit /.test(e.text || '')) for (const [lab, m] of f.left) for (const s of takeLabel(w, lab, m)) addInv(b, s);
          if (w) front.delete(w.handle); } break;
        case 'fence': if (a) { cash(a, e.price ?? 0); takeLabel(a, e.item, e.n ?? 0); } break;
        case 'evidence': if (a) { const m = String(e.text || '').match(/\(\+(\d+)cr\)/); if (m) cash(a, +m[1]); } break;
        case 'bribe': if (a && o) { const m = String(e.text || '').match(/slipped @\S+ (\d+)cr/); if (m) { cash(a, -+m[1]); cash(o, +m[1]); } } break;
        case 'crew': if (a) { const t = String(e.text || ''); let m;
          if (/ founded the crew /.test(t)) { a.crew = e.crew; crews.add(e.crew); cash(a, -RULES.crewFound); }
          else if (/ joined /.test(t)) a.crew = e.crew;
          else if (/ left /.test(t)) a.crew = null;
          else if ((m = t.match(/^paid (\d+)cr into /))) cash(a, -+m[1]);
          else if ((m = t.match(/^paid @\S+ (\d+)cr from /)) && o) cash(o, +m[1]); } break;
        case 'rug': if (a) { const m = String(e.text || '').match(/took the (\d+)cr treasury/); if (m) cash(a, +m[1]); for (const x of A.values()) if (x.crew === e.crew) x.crew = null; crews.delete(e.crew); } break;
        case 'locals_out': crews.delete(e.crew); for (const x of A.values()) if (x.crew === e.crew) x.crew = null; break;
        // the ledger events (sim/payouts): what the city pays out or hands back on its own, a pick that breaks. A dealer's share is its sale's
        case 'payout': if (a && e.of !== 'front') cash(a, e.cr ?? 0); break;
        // (`of: 'front'`: a job's end, fired or run out, names the boss's units going back from the dealer — `to` — and its `hire_end` then
        // moves nothing more; a sim without it: the units counted since the hire go back, FRONTED PRODUCT)
        case 'refund': if (a) { cash(a, e.cr ?? 0); for (const s of e.items || []) { if (e.of === 'front') takeExact(o, { ...s, label: s.label ?? s.k }, s.n); addInv(a, s); }
          if (e.of === 'listing') unboard(e); if (e.of === 'front' && o) front.delete(o.handle); } break;
        case 'worn_out': if (a) takeK(a, e.item, e.n ?? 1); break;
        case 'rent_missed': missed.add(e.at); break;
        // the daily step (sim2/game.mjs daily, right after the 06:00 snapshot; its last event is `day`): rent off every owned lot (the
        // stash first), the city tax on what each holds above the line (cash first), the cops' pay from the pool
        case 'day': if (e.t % 1440 === RULES.daily) daily(e); break;
      } }
    for (const [h, w] of wages(base, T)) cash(A.get(h), w);
    S.lots = [...lots.values()].filter(l => l.owner || l.scars?.length);   // (the sim's own rule: lots with an owner or a scar)
    return { S, board };

    // ── the boards: a buy's rows (the seller's at that price on that board, oldest first; rows the tape doesn't hold: the units its `scam`
    // events name — one per lying row, just before the buy — else the label's) · a listing back with its seller (expired: that row;
    // withdrawn: all of theirs on that board under its labels)
    function bought(a, k, who, label, price, q) { const e = EVENTS[k];
      for (const r of board) { if (q <= 0) break; if (r.at !== e.at || r.who !== who || r.price !== price || (r.s.label ?? r.s.k) !== label || !(r.s.n > 0)) continue;
        const m = Math.min(q, r.s.n); r.s.n -= m; q -= m; addInv(a, { ...r.s, n: m }); }
      for (let j = k - 1; q > 0 && j >= 0 && EVENTS[j].t === e.t; j--) { const x = EVENTS[j], m = x.type === 'scam' && !scams.has(j) && x.who === who && x.to === e.who
        && String(x.text || '').match(/ board listing sold @\S+ (\d+) "(.+)" that (?:(is fake)|is really (\S+))$/); if (!m || m[2] !== label) continue;
        const u = Math.min(q, +m[1]); scams.add(j); q -= u; addInv(a, { k: m[4] ?? label, label, n: u, fake: !!m[3] }); }
      addInv(a, { k: label, label, n: q }); }
    function unboard(e) { const lab = s => s.label ?? s.k, mine = r => r.who === e.who && r.at === e.board && r.s.n > 0;
      if (e.why === 'withdrawn') { const L = new Set((e.items || []).map(lab)); for (const r of board) if (mine(r) && L.has(lab(r.s))) r.s.n = 0; return; }
      for (const s of e.items || []) { const L = board.filter(r => mine(r) && lab(r.s) === lab(s)), r = L.find(r => r.s.k === s.k && (r.s.q ?? null) === (s.q ?? null) && !!r.s.fake === !!s.fake) ?? L[0]; if (r) r.s.n = 0; } }

    // ── the pockets: cash, and stacks as the snapshot keeps them ({ k, label, n, q, fake }; the sim merges stacks on more fields, a
    // grouping of these is the same). A take that finds too little leaves a debt the next add of that item pays first (the sim may
    // emit the two in either order: a Fit Street buy worn at the shop emits its `wear` before its `buy`)
    function cash(a, d) { if (a && d) a.cash = (a.cash ?? 0) + d; }
    function addInv(a, s) { if (!a || !(s.n > 0)) return; const k2 = s.k ?? s.label, label = s.label ?? k2, q = s.q ?? null, fake = !!s.fake; let n2 = s.n;
      const dk = `${a.handle}|${label}`, owed = debt.get(dk) || 0; if (owed) { const p = Math.min(owed, n2); debt.set(dk, owed - p); n2 -= p; if (!n2) return; }
      a.inv ||= []; const m = a.inv.find(x => x.k === k2 && (x.label ?? x.k) === label && (x.q ?? null) === q && !!x.fake === fake);
      if (m) m.n += n2; else a.inv.push({ k: k2, label, n: n2, q, fake }); }
    function owe(a, label, n2) { if (n2 > 0) debt.set(`${a.handle}|${label}`, (debt.get(`${a.handle}|${label}`) || 0) + n2); }
    function take(a, list, n2, label) { const out = []; for (const s of list) { if (n2 <= 0) break; const m = Math.min(n2, s.n); out.push({ k: s.k, label: s.label ?? s.k, n: m, q: s.q ?? null, fake: !!s.fake }); s.n -= m; n2 -= m; }
      a.inv = a.inv.filter(s => s.n > 0); owe(a, label, n2); return out; }
    // by label, best quality first (the sim's takeLabel) · by kind, in pocket order (takeK) · one exact stack (a street sale)
    function takeLabel(a, label, n2) { if (!a || !(n2 > 0)) return []; a.inv ||= []; return take(a, a.inv.filter(s => (s.label ?? s.k) === label).sort((x, y) => (y.q ?? 0) - (x.q ?? 0)), n2, label); }
    function takeK(a, k2, n2) { if (!a || !(n2 > 0)) return []; a.inv ||= []; return take(a, a.inv.filter(s => s.k === k2), n2, k2); }
    function takeExact(a, s0, n2) { if (!a) return []; a.inv ||= []; const hit = a.inv.filter(s => (s0.k === undefined || s.k === s0.k) && (s.label ?? s.k) === s0.label && !!s.fake === !!s0.fake);
      const best = hit.filter(s => s0.q === undefined || (s.q ?? null) === s0.q); return take(a, best.length ? best : hit, n2, s0.label); }
    function moveStuff(a, o, text) { for (const x of stuffOf(text)) { if (x.cr) { cash(a, -x.cr); cash(o, x.cr); } else for (const s of takeLabel(a, x.label, x.n)) addInv(o, s); } }
    // a lender's offer held its cash in escrow when made; the `loan` then only pays the borrower
    function escrowed(e, k) { for (let j = k - 1; j >= 0 && EVENTS[j].t >= e.t - 720; j--) { const x = EVENTS[j]; if (x.type === 'loan_offer' && x.who === e.who && x.to === e.to) return /^offered /.test(x.text || ''); } return false; }
    // a cancelled or declined contract: its side goes back to whoever offered it (the offer's own `give`)
    function refundOffer(e, k) { if (/turned down a loan/.test(e.text || '')) { for (let j = k - 1; j >= 0 && EVENTS[j].t >= e.t - 720; j--) { const x = EVENTS[j], m = x.type === 'loan_offer' && (x.who === e.who || x.to === e.who) && String(x.text || '').match(/^offered @\S+ a (\d+)cr loan/); if (x.type === 'loan_offer' && (x.who === e.who || x.to === e.who)) { if (m) cash(A.get(x.who), +m[1]); return; } } return; }
      const [f, to] = e.type === 'cancel' ? [e.who, e.to] : [e.to, e.who], F = A.get(f); if (!F || /job/.test(e.text || '')) return;
      for (let j = k - 1; j >= 0 && EVENTS[j].t >= e.t - 720; j--) { const x = EVENTS[j]; if (x.type === 'offer' && x.who === f && x.to === to) { for (const y of x.give || []) { if (y.cr) cash(F, y.cr); else if (y.k) addInv(F, { k: y.k, label: y.k, n: y.n }); } return; } } }
    function daily(e) { const rate = {}; for (const m of String(e.text || '').matchAll(/(trailer|house|estate) (\d+)/g)) rate[m[1]] = +m[2]; let pool = S.pool ?? 0;
      for (const l of lots.values()) { const a = l.owner && A.get(l.owner), due = rate[l.tier]; if (!a || !due || missed.has(l.id)) continue;
        const st = Math.min(due, Math.max(0, l.stash ?? 0)); l.stash = (l.stash ?? 0) - st; cash(a, -(due - st)); pool += due; }
      for (const a of A.values()) { if (a.status === 'dead') continue; const l = a.home && lots.get(a.home), held = Math.max(0, (a.cash ?? 0) - (dailyQuest.get(a.handle) || 0)), w = held + (l ? l.stash ?? 0 : 0);
        if (w > RULES.tax.over) { const tax = Math.floor((w - RULES.tax.over) * RULES.tax.rate), fc = Math.min(tax, held); cash(a, -fc); if (l) l.stash -= tax - fc; pool += tax; } }
      const cops = [...A.values()].filter(a => a.cls === 'cop' && a.status !== 'dead' && a.status !== 'jail');
      if (cops.length) { const pay = Math.min(RULES.salaryCap, Math.floor(pool / cops.length)); for (const c of cops) cash(c, pay); } }
  }
  // wear: { item, on, off?, slot?, gone? } from a `wear` event. Today's (sim2/game.mjs wear/unwear) carry only the item and the text;
  // F15's structured ones carry slot and on, and are applied to the outfit here
  const wearOf = e => { if (typeof e.on === 'boolean') return { item: e.item, on: e.on, slot: e.slot ?? null, off: e.off ?? null };
    const t = String(e.text || ''), off = t.match(/\(took off the (\S+)\)/)?.[1] ?? null; return /^took off /.test(t) ? { item: e.item, on: false, slot: null } : { item: e.item, on: true, slot: null, off }; };
  function applyWear(a, w) { a.wear ||= {};
    // F15 HOOK: a structured change moves the outfit (and the pockets: what comes off goes back in them, unless a robber took it)
    if (w.slot == null) return; const old = a.wear[w.slot];
    if (w.on) { a.wear[w.slot] = w.item; } else if (old === w.item) delete a.wear[w.slot];
    if (w.gone) return; const inv = a.inv ||= [];
    if (w.on) { const s = inv.find(x => x.k === w.item); if (s) { s.n--; if (s.n <= 0) inv.splice(inv.indexOf(s), 1); } if (old && old !== w.item) inv.push({ k: old, label: old, n: 1, q: null, fake: false }); }
    else inv.push({ k: w.item, label: w.item, n: 1, q: null, fake: false }); }
  // dock-shift wages (sim2/game.mjs tick: +wage at every full hour of a `work` act, paid before the snapshot of that minute) → [[handle, cr]]
  function wages(base, T) { const out = new Map(), lo = firstEventAt(base.t - 60 * RULES.wageMaxHours), hi = lastEventUpTo(T), was = new Map((base.agents || []).map(a => [a.handle, a.act]));
    for (let k = lo; k < hi; k++) { const e = EVENTS[k]; if (e.type !== 'activity' || e.k !== 'work' || !was.has(e.who)) continue;
      const h = +(String(e.text || '').match(/(\d+)h/)?.[1] ?? 1), ends = stops(e.who, k + 1, e.t + 60 * h, hi);
      if (e.t < base.t && was.get(e.who) !== 'work') continue;
      for (let i = 1; i <= h; i++) { const m = e.t + 60 * i; if (m > base.t && m <= T && m <= ends) out.set(e.who, (out.get(e.who) || 0) + RULES.wage); } }
    return out; }
  // the minute the shift stopped: the agent's next event that ends an act (a move, another act, sleep, jail, hospital, a robbery …)
  const STOPS = new Set(['activity', 'move', 'sleep', 'hospital', 'death', 'rob', 'burgle', 'arrest', 'search', 'offline']);
  function stops(h, k0, until, hi) { for (let k = k0; k < hi; k++) { const e = EVENTS[k]; if (e.t > until) break; if ((e.who === h || e.to === h) && STOPS.has(e.type) && e.of == null) return e.t - 1; } return until; }
  return { advance, snapAt, snapCut, firstEventAt, lastEventUpTo, get snaps() { return SNAPS; }, get events() { return EVENTS; } };
}
