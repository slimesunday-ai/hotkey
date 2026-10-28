// Fight tests translated from the Diplomacy referee's test cases (DATC v3.0, chapter 6, sections 6.D and 6.E), as
// GAME.md §26 asks: backing stands in for support, ties hold, tied attackers all fail, and every case runs under both
// cut rules (§8). Every expected result below was worked out by hand from GAME.md §6, §7, §8, §12, §13 and the gap
// rows in core/numbers.mjs (gap.chainedBack, gap.groupCap, gap.burglarPlace) before the code was run. The code under
// test is used only through its interface: resolveFights({ agents, plays, levels, rule }).
//
// How a case is translated:
// - Every DATC unit is an agent, named after its province. Each great power is one crew (§12). Nobody wears anything,
//   so everyone counts 1 (§8): a unit and its supports count the same as an agent and its backers.
// - One district for the whole case, The Yards (industrial), a workplace (§6), unless a case needs two. The night is
//   a Blackout (§13, the midseason event: every district lawless), so no city cops ever join (§6, §8): Diplomacy has
//   no cops. Two extra cases at the end add cops on purpose.
// - A unit holding = an agent working a shift in The Yards (it's out there, §6).
// - R8 (slime, 10-19: "do 1 and 2"; GAP gap.jump 'alone'): a hit wins a tie on a target out working alone, with no
//   backer, city cops or patrol on its side (§7). A unit holding unsupported is exactly that, so a 1-against-1 hit on it
//   is the hitter's win, where DATC has a standoff. Every other tie still holds; the cases it changes say so.
// - "A moves to B" = a hit on the agent in B, naming The Yards. Nobody moves in this game: the hitter is out in the
//   district it names, and a win is a robbery, not a dislodgement. A head-to-head battle is two agents hitting each
//   other in the same district: two separate fights (§8, "no fight depends on another fight's result").
// - Support = a back on the supported unit's agent. A back joins that agent's group for whatever it actually plays,
//   attacking or defending (§7); there's no support for one particular move. Backers are wherever the play they back
//   is (§6). The defence in the street is the target's own group (§8).
// - R4-2 (gap.accept): a back joins only if the supported agent accepted it before the lock: its own great power (its
//   crew) by default, and a foreign supporter only when the supported agent's play names it (`accept`, which then lists
//   every supporter it accepts). Where DATC has a foreign support, the supported agent accepts it, so the case keeps
//   testing what it tested; 6.D.33's unwanted support, accepted by nobody, does nothing.
// - Support cut = the backer is found by a hit (§6). Rule A: any such attack cuts it. Rule B: an attack from the agent
//   its group is attacking (DATC 6.D.15), or from the backer's own crew (DATC 6.D.20), doesn't (§8).
// - No chains (§8): a back on an agent that is itself backing does nothing, and the backer stays home
//   (gap.chainedBack), where no hit can find it.
// - Nothing stops an agent robbing its own crew, or backing a hit on its own crew (§12: betrayal is part of the game),
//   so DATC's "no self-dislodgement" cases come out differently here. That's expected.
// - No case has more than 4 backers on one agent, so gap.groupCap never applies; no case breaks in, so
//   gap.burglarPlace never applies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFights } from '../rules/fights.mjs';

const DISTRICTS = ['downtown', 'strip', 'industrial', 'suburbs', 'docks', 'junkyard', 'mall', 'forest'];
const BLACKOUT = Object.fromEntries(DISTRICTS.map(d => [d, 'lawless']));
const YARDS = 'industrial';

const shift = (place = YARDS) => ({ kind: 'hustle', place });
const hit = (target, place = YARDS) => ({ kind: 'hit', target, place });
const back = target => ({ kind: 'back', target });

// crews: { crew: [agent ids] }. overrides: { id: { home, wanted, ... } } for the few agents that differ.
function agentsOf(crews, overrides = {}) {
  const agents = {};
  for (const [crew, ids] of Object.entries(crews)) {
    for (const id of ids) {
      agents[id] = { home: true, jailed: false, crew, wanted: false, knuckles: false, runners: false, ...overrides[id] };
    }
  }
  return agents;
}

const sorted = xs => [...xs].sort();
const byLeader = (x, y) => (x.leader < y.leader ? -1 : x.leader > y.leader ? 1 : 0);

// One attacking group: its leader, every member (the leader included) and its strength.
const group = (leader, backers, strength) => ({ leader, members: sorted([leader, ...backers]), strength });

// One expected fight, keyed by its target in a case. Lawless by default: no cops, so nobody is arrested.
const fight = (attackers, defence, winner, more = {}) => ({
  kind: 'hit', place: YARDS, attackers: attackers.slice().sort(byLeader), defence, cops: 0, winner, arrested: [], ...more,
});

// The code's fights, keyed by target, in the same shape as the expectations.
function summarize(r) {
  const fights = {};
  for (const f of r.fights) {
    assert.ok(!(f.target in fights), `two fights on ${f.target}: several attackers on one target share one fight (§8)`);
    fights[f.target] = {
      kind: f.kind,
      place: f.place,
      attackers: f.attackers.map(g => ({ leader: g.leader, members: sorted(g.members), strength: g.strength })).sort(byLeader),
      defence: f.defence,
      cops: f.cops,
      winner: f.winner,
      arrested: sorted(f.arrested || []),
    };
  }
  return fights;
}

const pick = (fights, keys) =>
  Object.fromEntries(Object.entries(fights).map(([target, f]) => [target, Object.fromEntries(keys.map(k => [k, f[k]]))]));

// Runs one case under both cut rules. c: { agents, plays, levels?, where?, A?, B?, both? }, where A / B / both are
// { fights: { target: fight(...) }, cut?: [ids] }. where: { id: 'home' | district }.
function datc(id, title, c) {
  for (const rule of ['A', 'B']) {
    const want = c[rule] || c.both;
    test(`${id} ${title} (rule ${rule})`, async t => {
      const r = resolveFights({ agents: c.agents, plays: c.plays, levels: c.levels || BLACKOUT, rule });
      const got = summarize(r);
      await t.test('which fights happen, and who wins', () => {
        assert.deepEqual(pick(got, ['kind', 'place', 'winner']), pick(want.fights, ['kind', 'place', 'winner']));
      });
      await t.test('attacking groups and the defence', () => {
        assert.deepEqual(pick(got, ['attackers', 'defence']), pick(want.fights, ['attackers', 'defence']));
      });
      if (want.cut) {
        await t.test('cut backers', () => {
          assert.deepEqual(sorted(r.cut), sorted(want.cut));
        });
      }
      await t.test('cops and arrests', () => {
        assert.deepEqual(pick(got, ['cops', 'arrested']), pick(want.fights, ['cops', 'arrested']));
      });
      if (c.where) {
        await t.test('where everyone is', () => {
          for (const [agent, place] of Object.entries(c.where)) {
            if (place === 'home') {
              assert.equal(r.where[agent].at, 'home', `${agent} should be home`);
            } else {
              assert.notEqual(r.where[agent].at, 'home', `${agent} should be out`);
              assert.equal(r.where[agent].place, place, `${agent} should be out in ${place}`);
            }
          }
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// 6.D: supports and dislodges
// ---------------------------------------------------------------------------------------------------------------------

// 6.D.1 Supported hold can prevent dislodgement.
// Translation: venice works a shift, backed by tyrolia; trieste hits venice, backed by adriatic.
// Expected, A and B: venice's fight is 2 (trieste, adriatic) against 2 (venice, tyrolia): a tie, venice holds. Nobody
//   is attacked but venice, so nobody is cut.
// DATC: Venice isn't dislodged; Trieste doesn't move.
// Same as Diplomacy.
datc('6.D.1', 'supported hold can prevent dislodgement', {
  agents: agentsOf({ austria: ['adriatic', 'trieste'], italy: ['venice', 'tyrolia'] }),
  plays: { adriatic: back('trieste'), trieste: hit('venice'), venice: shift(), tyrolia: back('venice') },
  both: {
    cut: [],
    fights: { venice: fight([group('trieste', ['adriatic'], 2)], 2, null) },
  },
});

// 6.D.2 A move cuts support on hold.
// Translation: as 6.D.1, plus vienna hits tyrolia (the backer) in The Yards, where tyrolia is (with venice's shift).
// Expected, A and B: tyrolia is cut under both rules (venice attacks nobody, so vienna can't be "the agent its group is
//   attacking", and vienna is another crew). venice: 2 against 1, trieste wins (robs venice). tyrolia: 1 against 1,
//   holds.
// DATC: Tyrolia's support is cut, so Trieste dislodges Venice.
// Same as Diplomacy (a robbery instead of a dislodgement).
datc('6.D.2', 'a move cuts support on hold', {
  agents: agentsOf({ austria: ['adriatic', 'trieste', 'vienna'], italy: ['venice', 'tyrolia'] }),
  plays: {
    adriatic: back('trieste'), trieste: hit('venice'), vienna: hit('tyrolia'), venice: shift(), tyrolia: back('venice'),
  },
  both: {
    cut: ['tyrolia'],
    fights: {
      venice: fight([group('trieste', ['adriatic'], 2)], 1, 'trieste'),
      tyrolia: fight([group('vienna', [], 1)], 1, null),
    },
  },
});

// 6.D.3 A move cuts support on move.
// Translation: venice works a shift; trieste hits venice, backed by adriatic; ionian hits adriatic (the backer, out in
//   The Yards with trieste's hit).
// Expected, A and B: adriatic is cut under both (ionian isn't venice, the agent adriatic's group attacks, and is
//   another crew). venice: 1 against 1, a tie on venice out working alone, so trieste wins it (gap.jump 'alone').
//   adriatic: 1 against 1, holds (backing isn't work).
// DATC: Adriatic's support is cut; Venice isn't dislodged.
// The cut is the same as Diplomacy. Different since R8: the lone worker loses the tie (gap.jump 'alone').
datc('6.D.3', 'a move cuts support on move', {
  agents: agentsOf({ austria: ['adriatic', 'trieste'], italy: ['venice', 'ionian'] }),
  plays: { adriatic: back('trieste'), trieste: hit('venice'), venice: shift(), ionian: hit('adriatic') },
  both: {
    cut: ['adriatic'],
    fights: {
      venice: fight([group('trieste', [], 1)], 1, 'trieste'),
      adriatic: fight([group('ionian', [], 1)], 1, null),
    },
  },
});

// 6.D.4 Support to hold on a unit supporting a hold is allowed.
// Translation: berlin backs kiel and kiel backs berlin; prussia hits berlin in The Yards, backed by baltic.
// Expected, A and B: both backs are chains (each backs an agent that is itself backing), so both do nothing and both
//   stay home (§8 no chains, gap.chainedBack). prussia's hit finds nobody in The Yards (§6): no fight at all. prussia
//   and baltic are out in The Yards.
// DATC: the Russian move fails (Kiel's hold support on Berlin counts).
// Same outcome (nothing is taken), different reason: no chains. Here two agents backing each other both stay home,
//   out of reach of any hit, instead of supporting each other.
datc('6.D.4', 'support to hold on a unit supporting a hold', {
  agents: agentsOf({ germany: ['berlin', 'kiel'], russia: ['baltic', 'prussia'] }),
  plays: { berlin: back('kiel'), kiel: back('berlin'), baltic: back('prussia'), prussia: hit('berlin') },
  where: { berlin: 'home', kiel: 'home', prussia: YARDS, baltic: YARDS },
  both: { cut: [], fights: {} },
});

// 6.D.4, extra variant: the same, but berlin has no home (it's been evicted).
// Translation: as 6.D.4, but prussia's hit names Pleasantview (suburbs), since berlin has no home.
// Expected, A and B: berlin's back still does nothing, and with no home it is out in Pleasantview (gap.chainedBack).
//   kiel's back on berlin is a chain too, so kiel stays home and doesn't defend berlin. baltic is out in Pleasantview
//   with prussia's hit. berlin: 2 (prussia, baltic) against 1, prussia wins.
//   Not asserted: whether berlin is listed as cut. It's a backer that's attacked, but its back was void anyway, so
//   GAME.md's cut has nothing left to remove; listing it is a reporting choice, not a rule.
// DATC: no counterpart (Diplomacy has no homes); this covers the "no home" branch of gap.chainedBack.
datc('6.D.4+', 'chained backer with no home is out in Pleasantview (extra)', {
  agents: agentsOf({ germany: ['berlin', 'kiel'], russia: ['baltic', 'prussia'] }, { berlin: { home: false } }),
  plays: { berlin: back('kiel'), kiel: back('berlin'), baltic: back('prussia'), prussia: hit('berlin', 'suburbs') },
  where: { kiel: 'home', berlin: 'suburbs', baltic: 'suburbs' },
  both: {
    fights: { berlin: fight([group('prussia', ['baltic'], 2)], 1, 'prussia', { place: 'suburbs' }) },
  },
});

// 6.D.5 Support to hold on a unit supporting a move is allowed.
// Translation: munich's move into empty Silesia has no target here (nobody moves into empty places), so munich works a
//   shift in The Yards; berlin backs munich, so berlin is out there too; kiel backs berlin; prussia hits berlin,
//   backed by baltic.
// Expected, A and B: kiel's back is a chain (berlin is itself backing), so it does nothing and kiel stays home. berlin
//   is attacked, so it's cut under both rules (munich attacks nobody; prussia is another crew), which changes nothing
//   since munich isn't in a fight. berlin defends alone: 2 (prussia, baltic) against 1, prussia wins.
// DATC: the Russian move fails (Kiel's hold support on Berlin counts).
// Different: no chains (§8). A back on an agent that is backing does nothing, so berlin defends alone and is robbed.
datc('6.D.5', 'support to hold on a unit supporting a move', {
  agents: agentsOf({ germany: ['berlin', 'kiel', 'munich'], russia: ['baltic', 'prussia'] }),
  plays: { berlin: back('munich'), kiel: back('berlin'), munich: shift(), baltic: back('prussia'), prussia: hit('berlin') },
  where: { kiel: 'home', berlin: YARDS },
  both: {
    cut: ['berlin'],
    fights: { berlin: fight([group('prussia', ['baltic'], 2)], 1, 'prussia') },
  },
});

// 6.D.7 Support to hold on a moving unit is not allowed.
// Translation (two districts): Sweden is empty and nobody moves, so the bounce over Sweden becomes a hit that finds
//   nobody: baltic hits finland naming the docks ("Sweden"), but finland works a shift in The Yards. prussia backs
//   baltic, so it's out at the docks with baltic's hit. livonia hits baltic at the docks, backed by bothnia.
// Expected, A and B: baltic's hit finds nobody (§6): no fight on finland. baltic is attacking, but its backer still
//   defends it (§7: a back joins the group "attacking or defending"; §8: the defence is the target's own group).
//   baltic: 2 (livonia, bothnia) against 2 (baltic, prussia), a tie: baltic holds. Nobody is cut.
// DATC: Prussia's hold support on the moving Baltic fleet fails; Baltic is dislodged by Livonia.
// Different: here a back covers whatever the agent plays, so a hitter's backer also defends it (§7, §8).
datc('6.D.7', 'support to hold on a moving unit', {
  agents: agentsOf({ germany: ['baltic', 'prussia'], russia: ['livonia', 'bothnia', 'finland'] }),
  plays: {
    baltic: hit('finland', 'docks'), prussia: back('baltic'),
    livonia: hit('baltic', 'docks'), bothnia: back('livonia'), finland: shift(),
  },
  where: { prussia: 'docks', bothnia: 'docks', baltic: 'docks', finland: YARDS },
  both: {
    cut: [],
    fights: { baltic: fight([group('livonia', ['bothnia'], 2)], 2, null, { place: 'docks' }) },
  },
});

// 6.D.9 Support to move on a holding unit is not allowed.
// Translation: venice hits trieste, backed by tyrolia; trieste works a shift, backed by albania (DATC's support was
//   for a move Trieste never made).
// Expected, A and B: there's no support for a particular move here, so albania's back defends trieste. trieste: 2
//   against 2, a tie: trieste holds. Nobody is cut.
// DATC: Albania's support fails (unmatched); Trieste is dislodged by Venice.
// Different: a back joins the agent's group for whatever it actually plays (§7), so it can't be "unmatched".
datc('6.D.9', 'support to move on a holding unit', {
  agents: agentsOf({ italy: ['venice', 'tyrolia'], austria: ['albania', 'trieste'] }),
  plays: { venice: hit('trieste'), tyrolia: back('venice'), albania: back('trieste'), trieste: shift() },
  both: {
    cut: [],
    fights: { trieste: fight([group('venice', ['tyrolia'], 2)], 2, null) },
  },
});

// 6.D.10 Self-dislodgement is prohibited.
// Translation: berlin works a shift; kiel hits berlin, backed by munich. All three are one crew.
// Expected, A and B: berlin: 2 against 1, kiel wins: it robs its own crew-mate. Nobody is cut.
// DATC: the move to Berlin fails (no self-dislodgement).
// Different: nothing forbids robbing your own crew; betrayal is part of the game (§12).
datc('6.D.10', 'self-dislodgement prohibited', {
  agents: agentsOf({ germany: ['berlin', 'kiel', 'munich'] }),
  plays: { berlin: shift(), kiel: hit('berlin'), munich: back('kiel') },
  both: {
    cut: [],
    fights: { berlin: fight([group('kiel', ['munich'], 2)], 1, 'kiel') },
  },
});

// 6.D.12 Supporting a foreign unit to dislodge your own unit is prohibited.
// Translation: trieste works a shift; vienna (trieste's crew) backs venice, who hits trieste.
// Expected, A and B: trieste: 2 (venice, vienna) against 1, venice wins. Nobody is cut.
// DATC: no dislodgement (Vienna's support can't be used against its own unit).
// Different: anyone can back anyone (§12), including a hit on its own crew (the "turn").
datc('6.D.12', 'supporting a foreign unit to dislodge own unit', {
  agents: agentsOf({ austria: ['trieste', 'vienna'], italy: ['venice'] }),
  plays: { trieste: shift(), vienna: back('venice'), venice: { ...hit('trieste'), accept: ['vienna'] } },
  both: {
    cut: [],
    fights: { trieste: fight([group('venice', ['vienna'], 2)], 1, 'venice') },
  },
});

// 6.D.14 Supporting a foreign unit is not enough to prevent dislodgement.
// Translation: trieste works a shift; venice hits trieste, backed by vienna (trieste's crew), tyrolia and adriatic.
// Expected, A and B: trieste: 4 against 1, venice wins. Nobody is cut. (A group of 4: under the cap of 5.)
// DATC: Trieste is dislodged (3 against 1, Vienna's support not counting against its own unit).
// Same outcome; here vienna's back counts too (§12), which only makes the win bigger.
datc('6.D.14', 'supporting a foreign unit is not enough to prevent dislodgement', {
  agents: agentsOf({ austria: ['trieste', 'vienna'], italy: ['venice', 'tyrolia', 'adriatic'] }),
  plays: {
    trieste: shift(), vienna: back('venice'), venice: { ...hit('trieste'), accept: ['tyrolia', 'adriatic', 'vienna'] }, tyrolia: back('venice'), adriatic: back('venice'),
  },
  both: {
    cut: [],
    fights: { trieste: fight([group('venice', ['adriatic', 'tyrolia', 'vienna'], 4)], 1, 'venice') },
  },
});

// 6.D.15 The defender can't cut support for an attack on itself.
// Translation: blacksea hits ankara, backed by constantinople; ankara hits constantinople (the backer).
// Expected, rule A: constantinople is attacked, so it's cut. ankara: 1 (blacksea) against 1, holds.
//   constantinople: 1 against 1, holds.
// Expected, rule B: ankara is the agent constantinople's group is attacking, so it isn't cut. ankara: 2 (blacksea,
//   constantinople) against 1, blacksea wins. constantinople: 1 against 1, holds.
// DATC: the support isn't cut; Ankara is dislodged.
// B: same as Diplomacy. A: different, on purpose (§8: under A a target can cancel one backer of the attack on it by
//   hitting that backer).
datc('6.D.15', 'defender cannot cut support for attack on itself', {
  agents: agentsOf({ russia: ['constantinople', 'blacksea'], turkey: ['ankara'] }),
  plays: { constantinople: back('blacksea'), blacksea: hit('ankara'), ankara: hit('constantinople') },
  A: {
    cut: ['constantinople'],
    fights: {
      ankara: fight([group('blacksea', [], 1)], 1, null),
      constantinople: fight([group('ankara', [], 1)], 1, null),
    },
  },
  B: {
    cut: [],
    fights: {
      ankara: fight([group('blacksea', ['constantinople'], 2)], 1, 'blacksea'),
      constantinople: fight([group('ankara', [], 1)], 1, null),
    },
  },
});

// 6.D.18 A surviving unit will sustain support.
// Translation: blacksea hits ankara, backed by constantinople; bulgaria backs constantinople. ankara hits
//   constantinople, backed by smyrna; armenia hits ankara (its own crew-mate: the move into Ankara is an attack on the
//   agent there).
// Expected, both rules: bulgaria's back is a chain (constantinople is backing), so it does nothing and bulgaria stays
//   home. constantinople defends alone: 2 (ankara, smyrna) against 1, ankara wins.
// Expected, rule A: constantinople is cut. ankara's fight: blacksea 1 and armenia 1 against 2 (ankara, smyrna: the
//   back covers the defence too): the top attackers tie, and neither beats 2; ankara holds.
// Expected, rule B: constantinople isn't cut (ankara is the agent its group attacks). ankara's fight: blacksea 2
//   (blacksea, constantinople) and armenia 1 against 2: blacksea doesn't beat the defence; ankara holds.
// DATC: Black Sea dislodges Ankara; Constantinople survives (Bulgaria's support), so its support stands.
// Different, both fights: smyrna's back defends ankara as well as attacking (§7), so blacksea only ties; and
//   bulgaria's back on a backer is a chain (§8), so constantinople is robbed.
datc('6.D.18', 'a surviving unit will sustain support', {
  agents: agentsOf({ russia: ['constantinople', 'blacksea', 'bulgaria'], turkey: ['ankara', 'smyrna', 'armenia'] }),
  plays: {
    constantinople: back('blacksea'), blacksea: hit('ankara'), bulgaria: back('constantinople'),
    ankara: hit('constantinople'), smyrna: back('ankara'), armenia: hit('ankara'),
  },
  where: { bulgaria: 'home' },
  A: {
    cut: ['constantinople'],
    fights: {
      ankara: fight([group('blacksea', [], 1), group('armenia', [], 1)], 2, null),
      constantinople: fight([group('ankara', ['smyrna'], 2)], 1, 'ankara'),
    },
  },
  B: {
    cut: [],
    fights: {
      ankara: fight([group('blacksea', ['constantinople'], 2), group('armenia', [], 1)], 2, null),
      constantinople: fight([group('ankara', ['smyrna'], 2)], 1, 'ankara'),
    },
  },
});

// 6.D.19 Even when surviving is in an alternative way.
// Translation: blacksea hits ankara, backed by constantinople; ankara hits constantinople, backed by smyrna (a
//   Russian backing a Turkish hit on its own crew-mate).
// Expected, both rules: constantinople defends alone: 2 (ankara, smyrna) against 1, ankara wins.
// Expected, rule A: constantinople is cut. ankara: 1 (blacksea) against 2 (ankara, smyrna), holds.
// Expected, rule B: constantinople isn't cut (ankara is the agent its group attacks). ankara: 2 against 2, a tie,
//   holds.
// DATC: Constantinople isn't dislodged (one support is Russian), so its support stands and Ankara is dislodged.
// Different, both fights, opposite results: smyrna's back counts against its own crew-mate (§12), and it defends
//   ankara too (§7).
datc('6.D.19', 'even when surviving is in alternative way', {
  agents: agentsOf({ russia: ['constantinople', 'blacksea', 'smyrna'], turkey: ['ankara'] }),
  plays: {
    constantinople: back('blacksea'), blacksea: hit('ankara'), smyrna: back('ankara'), ankara: { ...hit('constantinople'), accept: ['smyrna'] },
  },
  A: {
    cut: ['constantinople'],
    fights: {
      ankara: fight([group('blacksea', [], 1)], 2, null),
      constantinople: fight([group('ankara', ['smyrna'], 2)], 1, 'ankara'),
    },
  },
  B: {
    cut: [],
    fights: {
      ankara: fight([group('blacksea', ['constantinople'], 2)], 2, null),
      constantinople: fight([group('ankara', ['smyrna'], 2)], 1, 'ankara'),
    },
  },
});

// 6.D.20 A unit can't cut support of its own country.
// Translation: northsea hits channel (working a shift), backed by london; yorkshire (london's crew) hits london.
// Expected, rule A: london is cut. channel: 1 against 1, a tie on channel out working alone, so northsea wins it
//   (gap.jump 'alone'). london: 1 against 1, holds (backing isn't work).
// Expected, rule B: an attack from the backer's own crew doesn't cut. channel: 2 (northsea, london) against 1,
//   northsea wins. london: 1 against 1, holds.
// DATC: York doesn't cut the support; the English Channel is dislodged.
// B: same as Diplomacy. A: the cut is different, on purpose (§8: under A any attack cuts); since R8 the channel is
//   taken anyway, as the lone worker loses the tie (gap.jump 'alone').
datc('6.D.20', 'unit cannot cut support of its own country', {
  agents: agentsOf({ england: ['london', 'northsea', 'yorkshire'], france: ['channel'] }),
  plays: { london: back('northsea'), northsea: hit('channel'), yorkshire: hit('london'), channel: shift() },
  A: {
    cut: ['london'],
    fights: {
      channel: fight([group('northsea', [], 1)], 1, 'northsea'),
      london: fight([group('yorkshire', [], 1)], 1, null),
    },
  },
  B: {
    cut: [],
    fights: {
      channel: fight([group('northsea', ['london'], 2)], 1, 'northsea'),
      london: fight([group('yorkshire', [], 1)], 1, null),
    },
  },
});

// 6.D.21 Dislodging doesn't cancel a support cut.
// Translation: trieste works a shift; venice hits trieste, backed by tyrolia; munich hits tyrolia; silesia hits
//   munich, backed by berlin.
// Expected, A and B: tyrolia is cut under both (munich isn't trieste, and is another crew). Your own play still
//   happens if you're attacked (§8), so munich's hit still cuts though munich is robbed. trieste: 1 against 1, a tie
//   on trieste out working alone, so venice wins it (gap.jump 'alone'). tyrolia: 1 against 1, holds (backing isn't
//   work). munich: 2 (silesia, berlin) against 1, silesia wins.
// DATC: Munich is dislodged but still cuts Tyrolia's support; Trieste isn't dislodged.
// The cut is the same as Diplomacy. Different since R8: the lone worker loses the tie (gap.jump 'alone').
datc('6.D.21', 'dislodging does not cancel a support cut', {
  agents: agentsOf({
    austria: ['trieste'], italy: ['venice', 'tyrolia'], germany: ['munich'], russia: ['silesia', 'berlin'],
  }),
  plays: {
    trieste: shift(), venice: hit('trieste'), tyrolia: back('venice'), munich: hit('tyrolia'),
    silesia: hit('munich'), berlin: back('silesia'),
  },
  both: {
    cut: ['tyrolia'],
    fights: {
      trieste: fight([group('venice', [], 1)], 1, 'venice'),
      tyrolia: fight([group('munich', [], 1)], 1, null),
      munich: fight([group('silesia', ['berlin'], 2)], 1, 'silesia'),
    },
  },
});

// 6.D.33 Unwanted support is allowed.
// Translation: serbia and vienna "move into empty Budapest", which has no target here, so both work shifts in The
//   Yards; galicia (another crew, unasked) backs serbia; bulgaria hits serbia.
// Expected, A and B (R4-2, gap.accept): an unwanted back does nothing: serbia accepted only its crew, so galicia stays
//   home. serbia: 1 against 1, a tie on serbia out working alone, so bulgaria wins it (gap.jump 'alone', R8). Nobody
//   is cut.
// DATC: the unwanted support breaks Austria's standoff: Serbia moves to Budapest and Bulgaria takes Serbia.
// Different: nobody moves (§6), so bulgaria meets serbia where it is; and here no back joins a group its leader didn't
//   accept, so the unwanted support counts for nothing.
datc('6.D.33', 'unwanted support does nothing', {
  agents: agentsOf({ austria: ['serbia', 'vienna'], russia: ['galicia'], turkey: ['bulgaria'] }),
  plays: { serbia: shift(), vienna: shift(), galicia: back('serbia'), bulgaria: hit('serbia') },
  where: { galicia: 'home' },
  both: {
    cut: [],
    fights: { serbia: fight([group('bulgaria', [], 1)], 1, 'bulgaria') },
  },
});

// ---------------------------------------------------------------------------------------------------------------------
// 6.E: head-to-head battles and beleaguered garrisons
// ---------------------------------------------------------------------------------------------------------------------

// 6.E.1 A dislodged unit has no effect on the attacker's area.
// Translation: berlin hits prussia, backed by silesia; prussia hits berlin (a head-to-head: two fights); kiel hits
//   berlin (its own crew-mate: the "follow" into Berlin is an attack on the agent there).
// Expected, A and B: prussia: 2 (berlin, silesia) against 1, berlin wins. berlin: kiel 1 and prussia 1 against 2
//   (berlin, silesia: the backer defends too): the top attackers tie, and neither beats 2; berlin holds. Nobody is
//   cut.
// DATC: Berlin dislodges Prussia, and Kiel follows into Berlin.
// Same winner of the head-to-head. The follow has no counterpart (nobody moves): it becomes an attack on its own
//   crew-mate, which fails.
datc('6.E.1', 'dislodged unit has no effect on attacker\'s area', {
  agents: agentsOf({ germany: ['berlin', 'kiel', 'silesia'], russia: ['prussia'] }),
  plays: { berlin: hit('prussia'), kiel: hit('berlin'), silesia: back('berlin'), prussia: hit('berlin') },
  both: {
    cut: [],
    fights: {
      prussia: fight([group('berlin', ['silesia'], 2)], 1, 'berlin'),
      berlin: fight([group('kiel', [], 1), group('prussia', [], 1)], 2, null),
    },
  },
});

// 6.E.2 No self-dislodgement in a head-to-head battle.
// Translation: berlin hits kiel, backed by munich; kiel hits berlin. All one crew.
// Expected, A and B: kiel: 2 against 1, berlin wins (robs its crew-mate). berlin: 1 against 2, holds. Nobody is cut.
// DATC: no unit moves.
// Different: nothing forbids robbing your own crew (§12).
datc('6.E.2', 'no self-dislodgement in head-to-head battle', {
  agents: agentsOf({ germany: ['berlin', 'kiel', 'munich'] }),
  plays: { berlin: hit('kiel'), kiel: hit('berlin'), munich: back('berlin') },
  both: {
    cut: [],
    fights: {
      kiel: fight([group('berlin', ['munich'], 2)], 1, 'berlin'),
      berlin: fight([group('kiel', [], 1)], 2, null),
    },
  },
});

// 6.E.4 A non-dislodged loser still has an effect.
// Translation: holland hits northsea, backed by helgoland and skagerrak; northsea hits holland, backed by belgium;
//   norwegian hits northsea, backed by edinburgh and yorkshire; ruhr hits holland, backed by kiel.
// Expected, A and B: northsea: holland 3 and norwegian 3 against 2: the top attackers tie, all fail; northsea holds.
//   holland: northsea 2 and ruhr 2 against 3 (holland's group defends too): a tie on top, and neither beats 3;
//   holland holds. Nobody is cut.
// DATC: North Sea isn't dislodged (beleaguered garrison), so Ruhr doesn't move to Holland.
// Same as Diplomacy (nothing is taken).
datc('6.E.4', 'non-dislodged loser still has effect', {
  agents: agentsOf({
    germany: ['holland', 'helgoland', 'skagerrak'], france: ['northsea', 'belgium'],
    england: ['edinburgh', 'yorkshire', 'norwegian'], austria: ['kiel', 'ruhr'],
  }),
  plays: {
    holland: hit('northsea'), helgoland: back('holland'), skagerrak: back('holland'),
    northsea: hit('holland'), belgium: back('northsea'),
    edinburgh: back('norwegian'), yorkshire: back('norwegian'), norwegian: hit('northsea'),
    kiel: back('ruhr'), ruhr: hit('holland'),
  },
  both: {
    cut: [],
    fights: {
      northsea: fight([group('holland', ['helgoland', 'skagerrak'], 3), group('norwegian', ['edinburgh', 'yorkshire'], 3)], 2, null),
      holland: fight([group('northsea', ['belgium'], 2), group('ruhr', ['kiel'], 2)], 3, null),
    },
  },
});

// 6.E.5 A loser dislodged by another army still has an effect.
// Translation: as 6.E.4, plus london backs norwegian.
// Expected, A and B: northsea: norwegian 4 beats holland 3 and the defence 2: norwegian wins. holland: northsea 2 and
//   ruhr 2 against 3: holland holds. Nobody is cut. (england is 4 agents, the crew cap; norwegian's group is 4.)
// DATC: North Sea is dislodged by the Norwegian Sea; Ruhr's move fails; Holland isn't dislodged.
// Same as Diplomacy.
datc('6.E.5', 'loser dislodged by another army still has effect', {
  agents: agentsOf({
    germany: ['holland', 'helgoland', 'skagerrak'], france: ['northsea', 'belgium'],
    england: ['edinburgh', 'yorkshire', 'norwegian', 'london'], austria: ['kiel', 'ruhr'],
  }),
  plays: {
    holland: hit('northsea'), helgoland: back('holland'), skagerrak: back('holland'),
    northsea: hit('holland'), belgium: back('northsea'),
    edinburgh: back('norwegian'), yorkshire: back('norwegian'), norwegian: hit('northsea'), london: back('norwegian'),
    kiel: back('ruhr'), ruhr: hit('holland'),
  },
  both: {
    cut: [],
    fights: {
      northsea: fight([
        group('holland', ['helgoland', 'skagerrak'], 3), group('norwegian', ['edinburgh', 'london', 'yorkshire'], 4),
      ], 2, 'norwegian'),
      holland: fight([group('northsea', ['belgium'], 2), group('ruhr', ['kiel'], 2)], 3, null),
    },
  },
});

// 6.E.6 Not dislodged because of own support still has an effect.
// Translation: holland hits northsea, backed by helgoland and by channel (northsea's crew); northsea hits holland,
//   backed by belgium; ruhr hits holland, backed by kiel.
// Expected, A and B: northsea: 3 (holland, helgoland, channel) against 2, holland wins. holland: northsea 2 and ruhr 2
//   against 3: holland holds. Nobody is cut.
// DATC: North Sea isn't dislodged (one support on the German move is French); Ruhr doesn't move.
// Different on northsea: channel's back counts against its own crew-mate (§12). Same on holland.
datc('6.E.6', 'not dislodge because of own support still has effect', {
  agents: agentsOf({
    germany: ['holland', 'helgoland'], france: ['northsea', 'belgium', 'channel'], austria: ['kiel', 'ruhr'],
  }),
  // R4-2 (gap.accept): holland accepts the French channel's back, and its own helgoland's.
  plays: {
    holland: { ...hit('northsea'), accept: ['helgoland', 'channel'] }, helgoland: back('holland'),
    northsea: hit('holland'), belgium: back('northsea'), channel: back('holland'),
    kiel: back('ruhr'), ruhr: hit('holland'),
  },
  both: {
    cut: [],
    fights: {
      northsea: fight([group('holland', ['channel', 'helgoland'], 3)], 2, 'holland'),
      holland: fight([group('northsea', ['belgium'], 2), group('ruhr', ['kiel'], 2)], 3, null),
    },
  },
});

// 6.E.7 No self-dislodgement with a beleaguered garrison.
// Translation: northsea works a shift; norway hits northsea, backed by skagerrak and by yorkshire (northsea's crew);
//   helgoland hits northsea, backed by holland.
// Expected, A and B: northsea: norway 3 beats helgoland 2 and the defence 1: norway wins. Nobody is cut.
// DATC: North Sea isn't dislodged (it wouldn't be without England's own support).
// Different: yorkshire's back counts against its own crew-mate (§12).
datc('6.E.7', 'no self-dislodgement with beleaguered garrison', {
  agents: agentsOf({ england: ['northsea', 'yorkshire'], germany: ['holland', 'helgoland'], russia: ['skagerrak', 'norway'] }),
  plays: {
    northsea: shift(), yorkshire: back('norway'), holland: back('helgoland'), helgoland: hit('northsea'),
    skagerrak: back('norway'), norway: { ...hit('northsea'), accept: ['skagerrak', 'yorkshire'] },
  },
  both: {
    cut: [],
    fights: {
      northsea: fight([group('helgoland', ['holland'], 2), group('norway', ['skagerrak', 'yorkshire'], 3)], 1, 'norway'),
    },
  },
});

// 6.E.12 Support on an attack on your own unit can be used for other means.
// Translation: budapest hits rumania; vienna hits budapest, backed by serbia (budapest's crew); galicia hits budapest,
//   backed by rumania.
// Expected, rule A: rumania is attacked, so it's cut. budapest: vienna 2 (vienna, serbia) beats galicia 1 and the
//   defence 1: vienna wins. rumania: 1 against 1, holds.
// Expected, rule B: budapest is the agent rumania's group attacks, so rumania isn't cut. budapest: vienna 2 and
//   galicia 2 tie on top: all fail, budapest holds. rumania: 1 against 1, holds.
// DATC: no army moves (Serbia's support on the Italian army stalls Galicia; Rumania's support isn't cut by Budapest).
// B: same as Diplomacy. A: different, on purpose: budapest cancels rumania's back by hitting it (§8, rule A), and
//   serbia's back on a hit on its own crew-mate counts (§12), so vienna robs budapest.
datc('6.E.12', 'support on attack on own unit can be used for other means', {
  agents: agentsOf({ austria: ['budapest', 'serbia'], italy: ['vienna'], russia: ['galicia', 'rumania'] }),
  plays: {
    budapest: hit('rumania'), serbia: back('vienna'), vienna: { ...hit('budapest'), accept: ['serbia'] }, galicia: hit('budapest'),
    rumania: back('galicia'),
  },
  A: {
    cut: ['rumania'],
    fights: {
      budapest: fight([group('vienna', ['serbia'], 2), group('galicia', [], 1)], 1, 'vienna'),
      rumania: fight([group('budapest', [], 1)], 1, null),
    },
  },
  B: {
    cut: [],
    fights: {
      budapest: fight([group('vienna', ['serbia'], 2), group('galicia', ['rumania'], 2)], 1, null),
      rumania: fight([group('budapest', [], 1)], 1, null),
    },
  },
});

// 6.E.13 A three-way beleaguered garrison.
// Translation: northsea works a shift; yorkshire (backed by edinburgh), belgium (backed by channel) and norwegian
//   (backed by norway) each hit northsea.
// Expected, A and B: northsea: three groups of 2 against 1: the top attackers tie, all fail; northsea holds. Nobody is
//   cut.
// DATC: none of the fleets move; North Sea isn't dislodged.
// Same as Diplomacy.
datc('6.E.13', 'three way beleaguered garrison', {
  agents: agentsOf({
    england: ['edinburgh', 'yorkshire'], france: ['belgium', 'channel'], germany: ['northsea'],
    russia: ['norwegian', 'norway'],
  }),
  plays: {
    edinburgh: back('yorkshire'), yorkshire: hit('northsea'), belgium: hit('northsea'), channel: back('belgium'),
    northsea: shift(), norwegian: hit('northsea'), norway: back('norwegian'),
  },
  both: {
    cut: [],
    fights: {
      northsea: fight([
        group('yorkshire', ['edinburgh'], 2), group('belgium', ['channel'], 2), group('norwegian', ['norway'], 2),
      ], 1, null),
    },
  },
});

// 6.E.15 The friendly head-to-head battle.
// Translation: ruhr hits kiel, backed by holland; kiel hits berlin, backed by munich and silesia; berlin hits kiel,
//   backed by denmark and helgoland; prussia hits berlin, backed by baltic.
// Expected, A and B: kiel: berlin 3 beats ruhr 2 but not the defence 3 (kiel, munich, silesia): kiel holds. berlin:
//   kiel 3 beats prussia 2 but not the defence 3 (berlin, denmark, helgoland): berlin holds. Nobody is cut.
// DATC: none of the moves succeeds.
// Same as Diplomacy.
datc('6.E.15', 'the friendly head-to-head battle', {
  agents: agentsOf({
    england: ['holland', 'ruhr'], france: ['kiel', 'munich', 'silesia'], germany: ['berlin', 'denmark', 'helgoland'],
    russia: ['baltic', 'prussia'],
  }),
  plays: {
    holland: back('ruhr'), ruhr: hit('kiel'),
    kiel: hit('berlin'), munich: back('kiel'), silesia: back('kiel'),
    berlin: hit('kiel'), denmark: back('berlin'), helgoland: back('berlin'),
    baltic: back('prussia'), prussia: hit('berlin'),
  },
  both: {
    cut: [],
    fights: {
      kiel: fight([group('berlin', ['denmark', 'helgoland'], 3), group('ruhr', ['holland'], 2)], 3, null),
      berlin: fight([group('kiel', ['munich', 'silesia'], 3), group('prussia', ['baltic'], 2)], 3, null),
    },
  },
});

// ---------------------------------------------------------------------------------------------------------------------
// Extra: two cases with cops on purpose (not DATC; GAME.md §6, §8, §13). The defence counts city cops (§8 lists them
// under "the defence"), and a losing attacker in a fight with any cop in it is arrested, backers included (§8, and its
// table: "all three of you are arrested").
// ---------------------------------------------------------------------------------------------------------------------

// Extra 1: 6.D.2 with The Yards at its usual normal level, and trieste wanted (3 stars).
// Expected, A and B: tyrolia is cut as in 6.D.2. venice: trieste is wanted, so city cops add 2 to the defence of the
//   agent it attacks (normal district): 2 (trieste, adriatic) against 1 + 2 = 3. venice holds; trieste and adriatic
//   are arrested. tyrolia: vienna isn't wanted and nobody tipped, so no cops: 1 against 1, holds, nobody arrested.
datc('extra 1', '6.D.2 in a normal district with a wanted attacker', {
  agents: agentsOf({ austria: ['adriatic', 'trieste', 'vienna'], italy: ['venice', 'tyrolia'] }, { trieste: { wanted: true } }),
  plays: {
    adriatic: back('trieste'), trieste: hit('venice'), vienna: hit('tyrolia'), venice: shift(), tyrolia: back('venice'),
  },
  levels: { ...BLACKOUT, industrial: 'normal' },
  both: {
    cut: ['tyrolia'],
    fights: {
      venice: fight([group('trieste', ['adriatic'], 2)], 3, null, { cops: 2, arrested: ['adriatic', 'trieste'] }),
      tyrolia: fight([group('vienna', [], 1)], 1, null),
    },
  },
});

// Extra 2: 6.D.2 in Glasswall (downtown), heavy, nobody wanted.
// Expected, A and B: tyrolia is cut as in 6.D.2. Heavy adds 1 to every fight there (§6, §8), and those are city cops,
//   so every losing attacker there is arrested. venice: 2 against 1 + 1 = 2, a tie: venice holds (in the Blackout it
//   was robbed); trieste and adriatic are arrested. tyrolia: 1 against 1 + 1 = 2, holds; vienna is arrested.
datc('extra 2', '6.D.2 in a heavy district', {
  agents: agentsOf({ austria: ['adriatic', 'trieste', 'vienna'], italy: ['venice', 'tyrolia'] }),
  plays: {
    adriatic: back('trieste'), trieste: hit('venice', 'downtown'), vienna: hit('tyrolia', 'downtown'),
    venice: shift('downtown'), tyrolia: back('venice'),
  },
  levels: { ...BLACKOUT, downtown: 'heavy' },
  both: {
    cut: ['tyrolia'],
    fights: {
      venice: fight([group('trieste', ['adriatic'], 2)], 2, null, { place: 'downtown', cops: 1, arrested: ['adriatic', 'trieste'] }),
      tyrolia: fight([group('vienna', [], 1)], 2, null, { place: 'downtown', cops: 1, arrested: ['vienna'] }),
    },
  },
});
