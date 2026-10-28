// Fights with no dice (GAME.md §8), as a set computation (§23): find where everyone is, find which attacks reach
// their target, drop cut backers, compare group strengths. Every fight reads only the plays at the lock, so no fight
// depends on another fight's result.
import { N } from '../numbers.mjs';
import { HOMES, CRATE, VAULT, byId } from './state.mjs';

// agents: { id: { home, jailed, crew, wanted, heat, knuckles, runners, gun, lockpick, temp } }, what each one had at
//   the lock (gun and lockpick are layer 2's, heat and temp are layer 3's; they default to off).
// plays:  { id: { kind, place, target, accept } } for every agent not in jail (already checked). `accept`, optional on
//   any play but a back, is the list of agents its group's leader accepts as backers, in its order (§8, GAP gap.accept).
// levels: { place: 'lawless' | 'normal' | 'heavy' } tonight.
// rule:   'A' or 'B', the cut-backing rule (§8).
// ignorePlaces: the bench's counterfactual for "places matter" (§27): a hit finds its target wherever it's out, and
//   every place has normal cops.
// corners: { corner: { holder } } at the lock (§9, layer 2); none by default.
// tips: [{ by, agent, target }] and bribes: [{ by, target }], tonight's (§13, layer 3); none by default. A fight's name is
//   its target: an agent (a hit, a break-in or a collar on it), CRATE (the grab), VAULT (the vault job) or a corner.
// walk: on the last night (§15), id -> the route an agent walks to the dock when its backs lead to no agent walking one
//   (the default play's, gap.defaultPlay); null on every other night.
// night: tonight's number, for the turn a crew's lockpicks go round in (GAP gap.gear); 0 when not given.
export function resolveFights({ agents, plays, levels, rule, ignorePlaces = false, corners = {}, tips = [], bribes = [], walk = null, night = 0 }) {
  const ids = Object.keys(agents).sort(byId);
  const live = ids.filter(id => !agents[id].jailed);
  for (const id of live) if (!plays[id]) throw new Error(`no play for ${id}`);
  const level = place => (ignorePlaces ? 'normal' : levels[place]);

  // 1. Where everyone is (§6). Out in its play's district; home if it lays low; backers wherever the play they back
  //    is; jailed agents are on Iron Island. A back on a backer does nothing (no chains), so that agent stays home
  //    (GAP: numbers.mjs gap.chainedBack), and so does a back its leader didn't accept (§8, GAP gap.accept). On the
  //    last night nobody stays home (§15: everyone walks to the dock), so a back that does nothing still walks: with
  //    the agent its backs lead to, or, when they lead to jail, to nobody or round a ring, by `walk`'s route. All of it
  //    before any attack is found.
  const where = {};
  const idle = new Set();
  const unaccepted = new Set();
  // §8 (GAP gap.accept): whom a group's leader accepts as backers, in its order: its play's list, or, with none, its
  // crewmates at the lock. A crew always fits in a group (crewMax is at most groupMax, which the night checks), so
  // the crewmates' order never decides who's in.
  const accepts = leader => (Array.isArray(plays[leader].accept) ? plays[leader].accept
    : live.filter(x => x !== leader && !!agents[leader].crew && agents[x].crew === agents[leader].crew));
  for (const id of ids) {
    const p = plays[id];
    if (agents[id].jailed) where[id] = { at: 'jail' };
    else if (p.kind === 'laylow' || p.kind === 'build' || (p.kind === 'cook' && p.place === HOMES)) where[id] = { at: 'home', home: id };
    else if (p.kind === 'breakin') where[id] = { at: 'out', place: HOMES, door: p.target };
    else if (p.kind !== 'back') where[id] = { at: 'out', place: p.place };
  }
  // The agent out of jail, playing no back, that id's backs lead to, or null.
  const walker = id => {
    const seen = new Set();
    let x = id;
    while (agents[x] && !agents[x].jailed && plays[x] && plays[x].kind === 'back' && !seen.has(x)) {
      seen.add(x);
      x = plays[x].target;
    }
    return agents[x] && !agents[x].jailed && plays[x] && plays[x].kind !== 'back' ? x : null;
  };
  for (const id of live) {
    const p = plays[id];
    if (p.kind !== 'back') continue;
    const target = agents[p.target];
    const tp = plays[p.target];
    const chained = !target || target.jailed || !tp || tp.kind === 'back';
    if (!chained && !accepts(p.target).includes(id)) unaccepted.add(id);
    if (chained || unaccepted.has(id)) {
      idle.add(id);
      const w = walk ? walker(id) : null;
      if (walk) where[id] = w ? { ...where[w] } : { at: 'out', place: walk(id) };
      else where[id] = agents[id].home ? { at: 'home', home: id } : { at: 'out', place: HOMES };
    } else {
      where[id] = { ...where[p.target] };
    }
  }

  // 2. Which attacks reach their target. A hit or a collar finds the target only if it's out in the place it names
  //    (§6); a collar naming Pleasantview also finds it at home (§13, GAP gap.collar); a break-in finds the home of
  //    anyone who has one.
  const attacks = [];
  const missed = [];
  for (const id of live) {
    const p = plays[id];
    if (p.kind === 'hit' || p.kind === 'collar') {
      const w = where[p.target];
      const home = p.kind === 'collar' && p.place === HOMES && !!w && w.at === 'home' && w.home === p.target;
      const found = home || (!!w && w.at === 'out' && (ignorePlaces || w.place === p.place));
      if (found) attacks.push({ leader: id, kind: p.kind, target: p.target, place: home ? HOMES : w.place, home });
      else missed.push({ leader: id, kind: p.kind, target: p.target, place: p.place });
    } else if (p.kind === 'breakin') {
      if (agents[p.target] && agents[p.target].home) attacks.push({ leader: id, kind: 'breakin', target: p.target, place: HOMES });
      else missed.push({ leader: id, kind: 'breakin', target: p.target, place: HOMES });
    }
  }
  // A collar is an attack on its target, as a hit is (GAP gap.collar).
  const hitBy = {};
  for (const x of attacks) if (x.kind !== 'breakin') (hitBy[x.target] ||= []).push(x.leader);

  // 3. Cut backing (§8). A: a backer that's attacked tonight never arrives. B: the same, except an attack from the
  //    agent its group is attacking, or from the backer's own crew.
  const cut = new Set();
  const cutByTarget = [];
  for (const id of live) {
    const p = plays[id];
    if (p.kind !== 'back' || idle.has(id)) continue;
    const lp = plays[p.target];
    const attacking = ['hit', 'breakin', 'collar'].includes(lp.kind) ? lp.target : null;
    const by = hitBy[id] || [];
    if (attacking && by.includes(attacking)) cutByTarget.push({ backer: id, leader: p.target, target: attacking });
    const cuts = rule === 'A' ? by : by.filter(x => x !== attacking && !(agents[x].crew && agents[x].crew === agents[id].crew));
    if (cuts.length) cut.add(id);
  }

  // 4. Groups: an agent plus the backers it accepted who arrive, 5 at most, in its order (§8, GAP gap.groupCap); the
  //    rest are there but not in the group.
  const backers = {};
  for (const id of live) {
    const p = plays[id];
    if (p.kind === 'back' && !idle.has(id) && !cut.has(id)) (backers[p.target] ||= []).push(id);
  }
  const groups = {};
  const turnedAway = [];
  for (const id of live) {
    if (plays[id].kind === 'back') continue;
    const order = accepts(id);
    const b = (backers[id] || []).sort((x, y) => order.indexOf(x) - order.indexOf(y));
    groups[id] = [id, ...b.slice(0, N.groupMax - 1)];
    turnedAway.push(...b.slice(N.groupMax - 1));
  }
  const groupOf = id => groups[id] || [id];
  // §13 (GAP gap.tip, gap.bribe): who tipped a fight right (naming an agent in one of its attacking groups; a hit, a
  // break-in, the grab or the vault only), and who bribed it: a briber on the side the city cops are against (attacking,
  // or defending a collar), whose price, paid at its own stars, isn't below the price of the hottest agent's stars on
  // that side at the lock; nothing covers 5 (call 6). Stars change only at night, so a briber's are what it paid at.
  const price = m => N.bribe[agents[m].heat || 0];
  const tricks = (name, kind, attacking, defenders = []) => {
    const side = kind === 'collar' ? defenders : attacking;
    const need = N.bribe[Math.max(0, ...side.map(m => agents[m].heat || 0))];
    return {
      tippers: ['hit', 'breakin', 'grab', 'vault'].includes(kind) ? tips.filter(t => t.target === name && attacking.includes(t.agent)).map(t => t.by).sort(byId) : [],
      bribers: bribes.filter(b => b.target === name && side.includes(b.by) && need <= price(b.by)).map(b => b.by).sort(byId),
    };
  };
  // A fight's tip and bribe fields, there only when used.
  const marks = t => ({ ...(t.tippers.length ? { tipped: true, tippers: t.tippers } : {}), ...(t.bribers.length ? { bribers: t.bribers } : {}) });

  // §8 (GAP gap.gear, gap.accept): whose lockpick a break-in uses: its leader's own, else the first backer holding one
  // in the leader's list; with no list, the crewmates holding one go round by night, as a drop's leftovers do (in id
  // order, from the (night mod k)-th of the k), so no id pays for it every time.
  const lockpickOf = (leader, members) => {
    if (agents[leader].lockpick) return leader;
    const holders = members.filter(m => m !== leader && agents[m].lockpick);
    if (!holders.length) return null;
    if (Array.isArray(plays[leader].accept)) return holders[0];
    const turn = [...holders].sort(byId);
    return turn[night % turn.length];
  };
  // 5. Strength is counted per person (personStrength, below).
  const strength = (members, attacking) => members.reduce((t, m) => t + personStrength(agents[m], attacking), 0);
  // An attacking group's strength; a break-in adds 1 for one lockpick (lockpickOf). A hit adds GAP gap.jump (R3-2's
  // option, 0 by default) for picking its moment, and nothing else does; R3-2c's 'alone' adds no strength (see `alone`
  // below).
  const attackOf = (leader, members, kind, extra = 0) => {
    const lockpick = kind === 'breakin' ? lockpickOf(leader, members) : null;
    const jump = kind === 'hit' && Number.isInteger(N['gap.jump']) ? N['gap.jump'] : 0;
    return { leader, members, strength: strength(members, true) + (lockpick ? 1 : 0) + jump + extra, ...(lockpick ? { lockpick } : {}) };
  };
  // City cops by the district's level: +2 against a wanted attacker or in a fight tipped right (not in lawless
  // districts, and the two don't stack), +1 more in every fight in a heavy district; none in a bribed fight (§8, §13).
  const copsFor = (lv, groupsIn, t) => (t.bribers.length ? 0 : (lv !== 'lawless' && (t.tippers.length || groupsIn.some(g => g.members.some(m => agents[m].wanted))) ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0));
  // A patrolling cop's group joins every fight in its district on the defender's side, unless a hit or a collar found
  // the cop tonight (§8, §13). With places ignored, it joins none (GAP gap.patrol). solo: the cops without backers.
  const attacked = new Set(attacks.filter(x => x.kind !== 'breakin').map(x => x.target));
  const patrolsIn = place => (ignorePlaces ? [] : live.filter(id => plays[id].kind === 'patrol' && plays[id].place === place && !attacked.has(id)));
  const patrolOf = (cops, solo = false, skip = []) => cops.reduce((t, c) => t + strength((solo ? [c] : groupOf(c)).filter(m => !skip.includes(m)), false), 0);
  // A fight's losing attackers are arrested if any cop was in it, city or player (§8): a cop on duty (patrolling,
  // collaring or guarding the vault: GAP gap.guard) defending counts. Its tippers are spared only when the tips are what
  // brought the cops: without them no cop would be in the fight, so never in a lawless district, against a wanted
  // attacker, in a heavy district, with a player cop there or in a bribed fight (§12; slime, 10-15). players: whether a
  // player cop is in it.
  const onDuty = m => ['patrol', 'collar', 'guard'].includes(plays[m].kind);
  const arrestsOf = (losers, copsIn, spared = []) => (copsIn ? losers.flatMap(g => g.members).filter(m => !agents[m].runners && !spared.includes(m)).sort(byId) : []);
  const sparedOf = (lv, groupsIn, t, players) => (players || copsFor(lv, groupsIn, { ...t, tippers: [] }) > 0 ? [] : t.tippers);

  // 6. Every attack on one target is one fight. A collar is fought like a hit, or like a break-in at home, with the
  //    city cops on the Cop's side (+2 except in lawless districts, +1 more in a heavy one) and no patrol; a failed
  //    collar arrests nobody (GAP gap.collar).
  const byTarget = {};
  for (const x of attacks) (byTarget[`${x.kind}:${x.target}`] ||= []).push(x);
  const fights = [];
  for (const key of Object.keys(byTarget).sort(byId)) {
    const list = byTarget[key].sort((x, y) => byId(x.leader, y.leader));
    const { kind, target, place } = list[0];
    const collar = kind === 'collar';
    const street = kind === 'hit' || (collar && !list[0].home);
    const layingLow = !agents[target].jailed && plays[target].kind === 'laylow';
    const ownerHome = where[target].at === 'home' && where[target].home === target;
    const lv = level(place);
    // The defence: in the street, the target's own group; at home, 1 for the lock, plus everyone home (the owner and
    // its group, GAP gap.homeDefence), plus 1 if the owner is laying low; and the city cops and any patrol.
    const defenders = street || ownerHome ? groupOf(target) : [];
    const t = tricks(target, kind, list.flatMap(x => groupOf(x.leader)), defenders);
    const withCop = collar && !t.bribers.length ? (lv !== 'lawless' ? N.copsWanted : 0) + (lv === 'heavy' ? N.copsHeavy : 0) : 0;
    const attackers = list.map(x => attackOf(x.leader, groupOf(x.leader), kind, withCop));
    const base = street ? strength(defenders, false) : HOME.lock + strength(defenders, false) + (layingLow ? HOME.laylow : 0);
    const cops = collar ? withCop : copsFor(lv, attackers, t);
    const patrols = collar ? [] : patrolsIn(place);
    const patrol = patrolOf(patrols, false, defenders);
    const defence = base + (collar ? 0 : cops) + patrol;
    // R3-2c's option (GAP gap.jump, 'alone'): §7's "a hit beats an agent out working alone": a hit wins a tie on a
    // target out working (§7's Work play, away from home) with nobody else on its side (no backer, no city cops, no
    // patrol). With everyone's backers gone, the target is alone if no cops come.
    const lone = kind === 'hit' && N['gap.jump'] === 'alone' && worksOut(plays[target]);
    const alone = lone && defenders.length === 1 && cops === 0 && !patrols.length;
    const winner = winnerOf(attackers, defence, alone);
    const losers = attackers.filter(g => g.leader !== winner);
    // Losing attackers walk away with nothing; if any cop was in the fight, they're arrested (runners: never).
    const players = patrols.length > 0 || defenders.some(onDuty);
    const arrested = collar ? [] : arrestsOf(losers, cops > 0 || players, sparedOf(lv, attackers, t, players));
    // Would the result change with everyone's backers gone? (§27, the backing rules)
    const solo = list.map(x => attackOf(x.leader, [x.leader], kind, withCop));
    const soloBase = street ? strength([target], false) : HOME.lock + (ownerHome ? strength([target], false) : 0) + (layingLow ? HOME.laylow : 0);
    const soloCops = collar ? 0 : copsFor(lv, solo, t);
    const backingDecided = winnerOf(solo, soloBase + soloCops + patrolOf(patrols, true, defenders), lone && soloCops === 0 && !patrols.length) !== winner;
    fights.push({
      kind, target, place, level: lv, attackers, defenders, base, cops, ...(patrols.length ? { patrol, patrols } : {}), defence,
      winner, losers: losers.map(g => g.leader), arrested, backingDecided, ...marks(t),
    });
  }

  // 7. Corners (§9): Dealers on one corner fight for it like a hit. Its holder, if it deals there tonight, defends with
  //    its group; otherwise the corner is open and the challengers face only the cops. A lone Dealer deals; a tie on an
  //    open corner means nobody does (GAP gap.corners). deals: who deals on each corner tonight.
  const deals = {};
  const onCorner = {};
  for (const id of live) if (plays[id].kind === 'deal') (onCorner[plays[id].corner] ||= []).push(id);
  for (const corner of Object.keys(onCorner).sort(byId)) {
    const here = onCorner[corner].sort(byId);
    const holder = corners[corner] && here.includes(corners[corner].holder) ? corners[corner].holder : null;
    if (here.length === 1) {
      deals[corner] = here[0];
      continue;
    }
    const place = plays[here[0]].place;
    const attackers = here.filter(x => x !== holder).map(x => attackOf(x, groupOf(x), 'corner'));
    const defenders = holder ? groupOf(holder) : [];
    const base = strength(defenders, false);
    const lv = level(place);
    const t = tricks(corner, 'corner', attackers.flatMap(g => g.members));
    const cops = copsFor(lv, attackers, t);
    const patrols = patrolsIn(place);
    const patrol = patrolOf(patrols, false, defenders);
    const winner = winnerOf(attackers, base + cops + patrol);
    deals[corner] = winner || holder;
    const losers = attackers.filter(g => g.leader !== winner);
    const solo = attackers.map(g => attackOf(g.leader, [g.leader], 'corner'));
    const soloDefence = (holder ? strength([holder], false) : 0) + copsFor(lv, solo, t) + patrolOf(patrols, true, defenders);
    fights.push({
      kind: 'corner', corner, target: holder, place, level: lv, attackers, defenders, base, cops, ...(patrols.length ? { patrol, patrols } : {}),
      defence: base + cops + patrol, winner, losers: losers.map(g => g.leader), arrested: arrestsOf(losers, cops > 0 || patrols.length > 0),
      backingDecided: winnerOf(solo, soloDefence) !== winner, ...marks(t),
    });
  }

  // 8. The crate (§9): every group grabbing at the docks is in one fight against the city cops and any patrol there.
  //    The strongest takes it all if it beats them and every other group; a tie leaves it (GAP gap.shipments).
  const grabbers = live.filter(id => plays[id].kind === 'grab');
  if (grabbers.length) {
    const place = plays[grabbers[0]].place;
    const attackers = grabbers.map(x => attackOf(x, groupOf(x), 'grab'));
    const lv = level(place);
    const t = tricks(CRATE, 'grab', attackers.flatMap(g => g.members));
    const cops = copsFor(lv, attackers, t);
    const patrols = patrolsIn(place);
    const patrol = patrolOf(patrols);
    const winner = winnerOf(attackers, cops + patrol);
    const losers = attackers.filter(g => g.leader !== winner);
    const solo = attackers.map(g => attackOf(g.leader, [g.leader], 'grab'));
    fights.push({
      kind: 'grab', target: null, place, level: lv, attackers, defenders: [], base: 0, cops, ...(patrols.length ? { patrol, patrols } : {}),
      defence: cops + patrol, winner, losers: losers.map(g => g.leader), arrested: arrestsOf(losers, cops > 0 || patrols.length > 0, sparedOf(lv, attackers, t, patrols.length > 0)),
      backingDecided: winnerOf(solo, copsFor(lv, solo, t) + patrolOf(patrols, true)) !== winner, ...marks(t),
    });
  }

  // 9. The vault (§13), last: every group jobbing it is in one fight against its flat defence on every night (call 3:
  //    Glasswall's heavy +1 is in it), with no city cops for a wanted jobber and no patrol (call 4). Every guard's group
  //    adds its strength, unless a hit or a collar found the guard, and a right tip the city cops' +2, except in a
  //    lawless Glasswall; a jobber's bribe keeps out only that +2 (GAP gap.guard, gap.tip, gap.bribe). The strongest gets
  //    in if it beats the defence and every other group; every member of a losing group is arrested, runners aside
  //    (call 5), its tippers too: the cops are always at the vault (slime, 10-15; GAP gap.vault).
  const jobbers = live.filter(id => plays[id].kind === 'vault');
  if (jobbers.length) {
    const place = plays[jobbers[0]].place;
    const lv = level(place);
    const attackers = jobbers.map(x => attackOf(x, groupOf(x), 'vault'));
    const t = tricks(VAULT, 'vault', attackers.flatMap(g => g.members));
    const [base, cops] = [N.vault.defence, t.tippers.length && !t.bribers.length && lv !== 'lawless' ? N.copsWanted : 0];
    const guards = live.filter(id => plays[id].kind === 'guard' && !attacked.has(id));
    const guard = patrolOf(guards);
    const defence = base + cops + guard;
    const winner = winnerOf(attackers, defence);
    const losers = attackers.filter(g => g.leader !== winner);
    const solo = attackers.map(g => attackOf(g.leader, [g.leader], 'vault'));
    fights.push({
      kind: 'vault', target: null, place, level: lv, attackers, defenders: [], base, cops, ...(guards.length ? { guard, guards } : {}), defence,
      winner, losers: losers.map(g => g.leader), arrested: arrestsOf(losers, true),
      backingDecided: winnerOf(solo, base + cops + patrolOf(guards, true)) !== winner, ...marks(t),
    });
  }

  return {
    where, idle: [...idle].sort(byId), unaccepted: [...unaccepted].sort(byId), cut: [...cut].sort(byId), cutByTarget, groups,
    turnedAway: turnedAway.sort(byId), fights, missed, deals,
  };
}

// §8: strength is counted per person: 1, +1 with a gun, +1 on TEMP, +1 with brass knuckles when attacking (GAP
// gap.temp). `a` is what the agent had at the lock, as resolveFights' `agents` holds it ({ gun, temp, knuckles }). The one
// owner of the count: the fights add it up, and a seat's view counts its fight numbers by it (rules/view.mjs, me.fight).
export const personStrength = (a, attacking) => 1 + (a.gun ? 1 : 0) + (a.temp ? 1 : 0) + (attacking && a.knuckles ? 1 : 0);
// §8: what a home adds to the strength of everyone home in its defence: 1 for the lock, and 1 more if its owner lays low.
export const HOME = { lock: 1, laylow: 1 };

// The strongest group wins only if it beats the defence and every other group. A tie with the defence means the
// defender holds, unless `tieWins` (R3-2c, a hit on an agent out working alone); if the top attackers tie, they all
// fail (§8).
function winnerOf(groups, defence, tieWins = false) {
  const sorted = groups.slice().sort((x, y) => y.strength - x.strength || byId(x.leader, y.leader));
  const top = sorted[0];
  const unique = sorted.length === 1 || top.strength > sorted[1].strength;
  return unique && (top.strength > defence || (tieWins && top.strength === defence)) ? top.leader : null;
}

// §7, R3-2c (GAP gap.jump, 'alone'): out working is the Work play, your trade's night or a hustle (R11), played away
// from home: a hustle, a Smuggler's run, cooking at a lab, dealing, and a Cop's patrol or guard (§7's table, §9's trades). Cooking
// or building at home is home (§6), and a collar is its own play (§7).
export const OUT_WORK = ['hustle', 'run', 'cook', 'deal', 'patrol', 'guard'];
export const worksOut = p => !!p && OUT_WORK.includes(p.kind) && !(p.kind === 'cook' && p.place === HOMES);
