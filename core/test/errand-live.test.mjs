// GAME §41, 10-31: "Who and where show"; §19 keeps every detail's release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, tierCopy } from './helpers.mjs';
import { applyErrand } from '../rules/errand.mjs';
import { viewFor } from '../rules/view.mjs';
import { createFeed } from '../feed.mjs';
import { read } from '../agents/tools.mjs';
import { briefing } from '../agents/briefing.mjs';
import { addGoods, bookGoods } from '../rules/state.mjs';

function verify(g, kind, fields = {}, by = 'a01', context = {}) {
  const feed = createFeed();
  feed.sample(g.s, g.log, { kind: 'setup' });
  const before = new Set(g.log.map(e => e.n));
  const r = applyErrand(g.s, { by, kind, ...fields }, context);
  assert.equal(r.ok, true, `${kind}: ${r.why}`);
  g.s = r.state; g.log.push(...r.events);
  const live = r.events.filter(e => e.live);
  assert.equal(live.length, 1, `${kind}: one executed annotation`);
  assert.deepEqual(Object.keys(live[0].live).sort(), ['agent','kind','place', ...(live[0].live.counterpart ? ['counterpart'] : [])].sort());
  assert.equal(live[0].live.kind, kind);
  const frame = feed.sample(g.s, g.log, { kind: 'errand', round: 2 });
  const acts = frame.events.filter(e => e.type === 'act');
  assert.equal(acts.length, 1);
  assert.equal(acts[0].agent, by);
  assert.equal(acts[0].minute, frame.minute);
  assert.ok(!frame.events.some(e => e.type === live[0].type && !before.has(e.n)), 'receipt remains delayed');
  const stripped = g.log.map(e => { const v = structuredClone(e); delete v.live; return v; });
  for (const age of [0, 1, 2, 3]) {
    const state = { ...g.s, clock: g.s.clock + age };
    for (const audience of ['agent', 'owner', 'ownerAI', 'public']) {
      for (const id of audience === 'public' ? [null] : Object.keys(state.agents)) {
        assert.equal(JSON.stringify(viewFor(state, g.log, id, audience)), JSON.stringify(viewFor(state, stripped, id, audience)), `${kind}: ${audience} unchanged at age ${age}`);
      }
    }
    const v = viewFor(state, g.log, by, 'agent'), clean = viewFor(state, stripped, by, 'agent');
    assert.deepEqual(briefing(read(v, { audience: 'seat', seed: 'errand' }).result), briefing(read(clean, { audience: 'seat', seed: 'errand' }).result));
    const detail = viewFor(state, g.log, null, 'record').events.find(e => e.n === live[0].n);
    assert.equal(!!detail, state.clock >= live[0].vis.pub, `${kind}: exact release clock`);
  }
  return r;
}
const game = () => { const g = new Game({ n: 4 }); g.grant('a01', 20000); g.grant('a02', 20000); return g; };
const stock = (g, kind, units) => { addGoods(g.s.agents.a01, kind, units); bookGoods(g.s, 'in', 'test', kind, units); };
for (const [kind, fields] of [
  ['dress', { fit: {} }], ['give', { to: 'a02', cash: 7 }], ['pay', { to: 'a02', amount: 7 }],
  ['shop', { item: 'parts', units: 1, max: 100 }], ['tip', { agent: 'a02', target: 'a03' }],
  ['lookout', { agent: 'a03' }], ['plan', { traits: [] }], ['orders', { orders: [] }], ['note', { line: 'PRIVATE-WORDS' }],
  ['creed', { text: 'PRIVATE-CREED' }], ['ask', { to: 'a02', line: 'PRIVATE-ASK' }],
]) test(`live ${kind} has no details and changes no seat, history or briefing`, () => {
  verify(game(), kind, fields, 'a01', kind === 'creed' ? { source: 'owner' } : {});
});
test('offer, sell, take, bribe and bounty use the same projection without contents or target', () => {
  const g = game();
  const trait = Object.values(g.s.traits).find(t => t.opens <= g.s.day);
  verify(g, 'offer', { trait: trait.id, amount: trait.price });
  stock(g, 'parts', 2); verify(g, 'sell', { item: 'parts', units: 1 });
  stock(g, 'truth', 1); verify(g, 'take', { drug: 'truth', play: {kind:'laylow'} });
  g.s.agents.a01.heat = 1;
  verify(g, 'bribe', { target: 'a02' });
  verify(g, 'bounty', { agent: 'a02', amount: 100 });
});
test('crew stash names the resolved keeper; crew chat and invites name only counterparts', () => {
  const g = game(); g.errand('a01','crew_form',{name:'crew'});
  verify(g,'crew_invite',{agent:'a02'});
  g.errand('a02','crew_join',{crew:g.s.agents.a01.crew});
  verify(g,'stash_put',{cash:5}); verify(g,'stash_take',{cash:5});
  verify(g,'chat',{say:'answer',line:'PRIVATE-CHAT'});
});
test('fence list, unlist, buy, swap and accept disclose neither pieces nor terms', () => {
  const g = game(); const copy = g.hand('a01',tierCopy(g.s,'rare'));
  const listed = verify(g,'fence_list',{copy,price:20}).events.find(e=>e.type==='fence').deal;
  verify(g,'fence_unlist',{deal:listed});
  const again = g.errand('a01','fence_list',{copy,price:20}).events.find(e=>e.type==='fence').deal;
  verify(g,'fence_buy',{deal:again},'a02');
  const swapped = verify(g,'fence_swap',{to:'a02',give:{cash:10},get:{cash:5}}).events.find(e=>e.type==='fence').deal;
  verify(g,'fence_accept',{deal:swapped},'a02');
});
test('private speech without a new meet, listening and closing have one act each', () => {
  const g = game();
  const sitdown = g.errand('a01','ask',{to:'a02'}).events[0].sitdown;
  verify(g,'answer',{sitdown,accept:false},'a02');
  const sd = g.errand('a01','ask',{to:'a03'}).events[0].sitdown;
  g.errand('a03','answer',{sitdown:sd,accept:true});
  verify(g,'say',{sitdown:sd,say:'answer',line:'PRIVATE-SAY'});
  const earpiece = Object.values(g.s.copies).find(c=>g.s.traits[c.trait].ability==='earpiece');
  if (earpiece) { g.hand('a02',earpiece.id,{wear:true}); verify(g,'listen',{sitdown:sd},'a02'); }
  verify(g,'close',{sitdown:sd});
});
test('an unsuccessful attempt never publishes a target, a reason or success', () => {
  const g = game(); const r = g.errand('a01','pay',{to:'NO-SUCH-TARGET',amount:30000});
  assert.equal(r.ok,false);
  assert.deepEqual(r.events[0].live,{agent:'a01',kind:'attempt',place:'current'});
  const acts = g.view(null,'record').events.filter(e=>e.type==='act');
  assert.equal(acts.length,1); assert.ok(!JSON.stringify(acts).includes('NO-SUCH-TARGET'));
});
test('public meet, outloud, high, crew changes, bail release and housing are not duplicated', () => {
  const g = game();
  const publicOnly = r => { assert.equal(r.ok,true,r.why); assert.ok(!r.events.some(e=>e.live)); };
  publicOnly(g.errand('a01','crew_form',{name:'crew'}));
  publicOnly(g.errand('a01','outloud',{say:'boast',line:'PUBLIC'}));
  const sd = g.errand('a01','ask',{to:'a02'}).events[0].sitdown;
  publicOnly(g.errand('a02','answer',{sitdown:sd,accept:true}));
  stock(g,'temp',1); publicOnly(g.errand('a01','take',{drug:'temp'}));
  g.s.agents.a02.jail = { nights: 1, stars: 1 }; publicOnly(g.errand('a01','bail',{agent:'a02'}));
  g.s.agents.a01.evicted = true; publicOnly(g.errand('a01','rent'));
});
test('masked fight ids are the resolved membership, including backing, with no id for a prowl', () => {
  const g = game();
  const r = g.night({a01:{kind:'hit',target:'a03',place:'mall',accept:['a02']},a02:{kind:'back',target:'a01'},a03:{kind:'hustle',place:'mall'}});
  const show = r.events.find(e=>e.type==='show');
  for (const [id,at] of Object.entries(show.masked)) {
    const attack = r.fights.fights.findIndex(f=>f.attackers.some(a=>a.members.includes(id)));
    const index = attack >= 0 ? attack : r.fights.fights.findIndex(f=>f.defenders.includes(id));
    const fights = r.events.filter(e=>e.type==='fight');
    assert.equal(at.fight,index<0?undefined:fights[index].n);
  }
  const h = game(); const prowl = h.night({a01:{kind:'hit',target:'a02',place:'forest'},a02:{kind:'hustle',place:'mall'}});
  assert.ok(!Object.hasOwn(prowl.events.find(e=>e.type==='show').masked.a01,'fight'));
});

// §41: "Watch the action live"; the orchestrator specifies words as phone/message acts at the current place.
test('a silent answer to yesterday’s ask is watchable without a new game sequence or seat receipt', () => {
  const g = game();
  const sid = g.errand('a01','ask',{to:'a02'}).events[0].sitdown;
  g.night();
  const seq = g.s.seq, before = [...g.log];
  const r = g.errand('a02','answer',{sitdown:sid,accept:true});
  assert.equal(r.ok,true); assert.equal(g.s.seq,seq);
  assert.equal(r.events.length,1); assert.equal(r.events[0].type,'viewer-act');
  assert.deepEqual(r.events[0].live,{agent:'a02',kind:'answer',counterpart:{kind:'agent',id:'a01'},place:'current'});
  assert.equal(g.view(null,'record').events.filter(e=>e.type==='act' && e.kind==='answer').length,1);
  for (const clock of [g.s.clock,g.s.clock+2,30]) {
    const state = {...g.s,clock};
    for (const audience of ['agent','owner','ownerAI','public']) for (const id of audience==='public'?[null]:Object.keys(state.agents)) {
      assert.equal(JSON.stringify(viewFor(state,g.log,id,audience)),JSON.stringify(viewFor(state,before,id,audience)));
    }
  }
});

test('a later collar does not replace the masked attacker’s own fight id', () => {
  const g = game();
  g.s.agents.a01.heat = 3; g.s.agents.a04.trade = 'cop';
  stock(g,'lockpicks',1);
  const r = g.night({a01:{kind:'breakin',target:'a02'},a04:{kind:'collar',target:'a01',place:'suburbs'}});
  const fights = r.events.filter(e=>e.type==='fight');
  assert.ok(fights.some(f=>f.kind==='collar'));
  assert.equal(r.events.find(e=>e.type==='show').masked.a01.fight,fights.find(f=>f.kind==='breakin').n);
});

// §41: "Watch the action live"; the orchestrator places every words-only act at its current place.
test('a write never exposes the controlled target or play and still releases after three half-days', () => {
  const g = game(); g.s.agents.a02.writer = 'a01';
  verify(g,'write',{agent:'a02',play:{kind:'laylow'}});
  const act = g.view(null,'record').events.find(e=>e.type==='act');
  assert.ok(!act.counterpart); assert.equal(act.place,'current');
});
