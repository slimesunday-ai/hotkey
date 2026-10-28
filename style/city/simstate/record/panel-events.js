// C1-11: typed receipts and city words. No rules, event prose or owner view.
const keys = s => s.split(' ');
const piece = keys('copy trait slot tier fake');
const play = keys('kind place target corner accept origin');
const terms = keys('what who piece cash night where');
const goods = keys('chems parts guns lockpicks warrants doses temp hallu sudo truth clear firewall');
const memory = {
  plan: [{ trait: true, routes: [true] }],
  orders: [{ kind: true, stars: true, agent: true, item: true, units: true, max: true, min: true }],
  creed: [true], journal: [{ day: true, line: true }],
};
const shape = names => Object.fromEntries(names.map(k => [k, true]));
const P = shape(piece), G = shape(goods), T = { ...shape(terms), goods: G };
const W = shape(play.filter(k => k !== 'accept'));
W.accept = [true];
const speech = { from: true, say: true, terms: T, line: true };
const card = { night: true, rank: true, kind: true, masked: true,
  subjects: { agent: true, others: [true] }, pieces: [P], place: true,
  cash: true, pieceValue: true, value: true, valueBasis: true };

// Explicit per-kind allow-list: future owner-only extensions cannot enter panels
// by object spread. Deal receipts are history; no promise/deal state is copied.
const FIELDS = {
  season: 'seed rule midseason nights mock', season_end: 'seed rule',
  price: 'trait side item price was', meet: 'sitdown a b',
  heat: 'agent heat was wanted', high: 'agent walk', clean: 'agent',
  buy: 'night agent trait price', board: 'agent route',
  mint: 'agent cash mainland', missed: 'agent cash', gone: 'from cash', rollover: '',
  evicted: 'agent on owed', tab: 'agent tab paid copy trait tier',
  show: 'night', fight: 'night kind target place corner level defence cops patrol guard won backingDecided tipped',
  hustle: 'night agent place how level crowd take',
  arrest: 'night agent why by place stars bail', release: 'agent why',
  turf: 'night corner place holder was', police: 'place level was crimes',
  crew: 'act crew name agent by', shipment: 'night cash', fake: 'act night agent copy trait tier',
  outloud: 'agent say line',
  play: 'agent reason kind place target corner origin', holdings: 'agent cash home',
  ask: 'sitdown from to line', decline: 'sitdown from to line', say: 'sitdown from to say line',
  chat: 'crew from say line', close: 'sitdown a b by why', overheard: 'sitdown agent a b',
  give: 'from to copy trait cash sitdown', pay: 'from to amount for sitdown',
  take: 'agent drug writer', memory: 'agent part origin', orders: 'agent errand origin ok',
  order: 'act order night agent side item units max drug',
  shop: 'night agent item units cash order drug', sell: 'night agent item units cash order drug',
  rob: 'night leader target place copy trait tier cash value pieceValue mark valueBasis vest',
  burgle: 'night leader target place copy trait tier cash value pieceValue mark valueBasis',
  robbed: 'night agent by kind place copy trait tier cash vest crew',
  collar: 'night agent target stars pay fine', seized: 'night agent copy trait fine vault',
  gather: 'night agent place', cook: 'night agent place batches chems doses drug',
  craft: 'night agent guns lockpicks warrants fakes parts', sale: 'night agent corner place hot doses cash',
  patrol: 'night agent place wage', guard: 'night agent place wage',
  flex: 'night agent pay', grab: 'night leader place cash', vault: 'night leader place cash',
  stash: 'act crew agent copy trait cash', wear: 'agent', bid: 'agent trait amount',
  fence: 'act deal agent a b copy trait price', tip: 'by agent target',
  bribe: 'by target stars price', bounty: 'act bounty by to agent copy trait slot tier amount night',
  rent: 'agent amount', bail: 'by agent amount', refund: 'agent trait amount',
  betray: 'kind by night target place', crash: 'agent night', hooked: 'agent drug',
  forced: 'agent why', invalid: 'agent errand why kind', write: 'by agent', lies: 'night agent',
  used: 'night agent maker', card: '',
};
const SCHEMAS = Object.fromEntries(Object.entries(FIELDS).map(([type, fields]) => [type, shape(fields ? keys(fields) : [])]));
for (const type of ['outloud', 'say', 'chat']) SCHEMAS[type].terms = T;
for (const type of ['give', 'gather', 'grab', 'stash', 'used', 'shipment', 'holdings', 'look']) {
  SCHEMAS[type] ??= shape(keys('by agent cash home'));
  SCHEMAS[type].goods = G;
}
for (const type of ['rob', 'burgle', 'grab', 'vault']) SCHEMAS[type].members = [true];
for (const type of ['gone', 'missed', 'rollover', 'vault', 'stash']) SCHEMAS[type].copies = [true];
for (const type of ['mint', 'missed', 'gone']) SCHEMAS[type].goodsLeft = G;
SCHEMAS.mint.cards = [{ ...P, mark: true, value: true, valueBasis: true }];
SCHEMAS.shipment.crate = { cash: true, goods: G };
SCHEMAS.season.agents = [{ id: true, name: true, trade: true, driver: true }];
SCHEMAS.season.drop = [{ trait: true, slot: true, name: true, tier: true, copies: true, ability: true, opens: true, price: true, floor: true }];
SCHEMAS.holdings.pieces = [P];
SCHEMAS.look.pieces = [P];
for (const type of ['holdings', 'look']) SCHEMAS[type].crew = { id: true, cash: true, pieces: [P], goods: G };
SCHEMAS.show.seen = 'map';
SCHEMAS.show.hooded = 'map';
SCHEMAS.show.plays = { '*': { kind: true, place: true, corner: true, target: true } };
SCHEMAS.fight.sides = [{ size: true, strength: true }];
SCHEMAS.play.accept = [true];
SCHEMAS.memory.memory = memory;
SCHEMAS.orders.of = [true];
SCHEMAS.overheard.said = [{ ...speech, day: true }];
SCHEMAS.betray.victims = [true];
SCHEMAS.betray.play = W;
for (const type of ['forced', 'invalid', 'write']) SCHEMAS[type].play = W;
for (const type of ['forced', 'invalid']) SCHEMAS[type].instead = W;
SCHEMAS.wear.fit = 'map';
for (const type of ['fence']) for (const field of ['give', 'get']) SCHEMAS[type][field] = { copy: true, cash: true, goods: G };
for (const type of Object.keys(SCHEMAS)) SCHEMAS[type].card = card;

function project(value, schema) {
  if (value == null) return value;
  if (schema === true) return value;
  if (Array.isArray(schema)) return value.map(v => project(v, schema[0]));
  if (schema === 'map') return { ...value };
  if (schema['*']) return Object.fromEntries(Object.keys(value).map(k => [k, project(value[k], schema['*'])]));
  return Object.fromEntries(Object.keys(schema).filter(k => Object.hasOwn(value, k)).map(k => [k, project(value[k], schema[k])]));
}
export const EVENT_KINDS = Object.freeze(Object.keys(SCHEMAS));
const PUBLIC = new Set(keys('season season_end price meet heat high clean buy board mint missed gone rollover evicted tab show fight hustle arrest release turf police shipment outloud card'));
export function scopeOf(e) {
  if (e.type === 'crew') return e.act === 'invite' ? 'record' : 'public';
  if (e.type === 'fake') return e.act === 'exposed' ? 'public' : 'record';
  return PUBLIC.has(e.type) ? 'public' : 'record';
}
export function fieldsOf(e) {
  return SCHEMAS[e.type] ? project(e, SCHEMAS[e.type]) : null;
}
export function memoryFields(m) {
  return project(m, { agent: true, asOfDay: true, asOfClock: true, ...memory });
}

// Dynamic word parts carry their precise source. Literal parts are city copy.
// Render parts as text, never HTML. Roster display names are joined only by id.
export function wordsOf(e, board) {
  const d = fieldsOf(e);
  if (!d) return null;
  const parts = [], refs = [];
  const literal = text => { parts.push(text); return ''; };
  const val = (path, format = String) => {
    const value = path.split('.').reduce((x, k) => x?.[k], d);
    if (value === undefined || value === null) return '';
    const text = format(value);
    parts.push({ text, source: { eventId: e.id, path }, value }); refs.push(path);
    return '';
  };
  const person = path => {
    val(path, id => {
      const a = board?.agents?.find(a => a.id === id);
      return a ? `${a.name} (@${a.id})` : `@${id}`;
    });
    const part = parts.at(-1), a = board?.agents?.find(a => a.id === part?.value);
    if (a) part.nameSource = { agent: a.id, path: 'board.agents[].name' };
  };
  const money = path => val(path, n => `$${n}`);
  const subject = ['tip', 'look', 'write'].includes(e.type) ? 'by'
    : d.agent != null ? 'agent' : d.from != null ? 'from' : d.leader != null ? 'leader'
      : d.by != null ? 'by' : d.a != null ? 'a' : d.to != null ? 'to' : null;
  const who = () => subject ? person(subject) : literal('The city');
  const tail = (path, prefix, format) => { if (d[path] != null) { literal(prefix); val(path, format); } };
  // Counted labels are city copy, selected by typed counts and item keys.
  // Keep the number itself as an unchanged, sourced part; never read prose.
  const nouns = { nights: ['night', 'nights'], stars: ['star', 'stars'], heat: ['heat star', 'heat stars'],
    batches: ['batch', 'batches'], chems: ['chem', 'chems'], parts: ['part', 'parts'],
    guns: ['gun', 'guns'], lockpicks: ['lockpick', 'lockpicks'], warrants: ['warrant', 'warrants'],
    fakes: ['fake', 'fakes'], doses: ['dose', 'doses'], copies: ['copy', 'copies'] };
  const count = (path, item) => {
    val(path);
    const n = path.split('.').reduce((x, k) => x?.[k], d);
    literal(` ${nouns[item]?.[n === 1 ? 0 : 1] ?? item}`);
  };
  const itemCount = () => {
    const item = Object.keys(nouns).find(key => nouns[key].includes(d.item));
    if (item) { count('units', item); refs.push('item'); }
    else { val('units'); literal(' '); val('item'); }
  };
  const quantities = (prefix = ' · ') => {
    const add = (path, item) => { literal(prefix); count(path, item); prefix = ' · '; };
    if (d.goods) for (const item of Object.keys(d.goods)) add(`goods.${item}`, item);
    for (const key of ['guns', 'lockpicks', 'warrants', 'fakes', 'doses']) if (d[key] != null) add(key, key);
  };
  switch (e.type) {
    case 'season': literal('The island opens for '); count('nights', 'nights'); literal('.'); break;
    case 'season_end': literal('The island closes. The season ends.'); break;
    case 'price': val(d.trait ? 'trait' : 'item'); literal(!d.trait && nouns[d.item] ? ' cost ' : ' costs '); money('price'); tail('side', ' at the '); literal('.'); break;
    case 'meet': person('a'); literal(' sits down with '); person('b'); literal('.'); break;
    case 'show': literal('Night '); val('night'); literal(' hits the streets.'); break;
    case 'fight':
      if (d.target) { person('target'); literal(' faces a '); val('kind'); }
      else { literal('The '); val('kind'); literal(' fight breaks out'); }
      tail('place', ' in '); literal(d.won ? '. The attack wins.' : '. The defence holds.'); break;
    case 'hustle': who(); literal(' hustles in '); val('place'); literal(' for '); money('take'); literal(' · method: '); val('how'); literal('.'); break;
    case 'arrest': who(); literal(' gets booked'); if (d.by) { literal(' by '); person('by'); } tail('place', ' in '); literal(' · '); count('stars', 'stars'); literal('. Bail: '); money('bail'); literal('.'); break;
    case 'release': who(); literal(' walks out of jail.'); break;
    case 'heat': who(); if (d.heat === 0 && d.was > 0) { literal(' drops from '); count('was', 'heat'); literal(' to '); count('heat', 'heat'); } else { literal(' carries '); count('heat', 'heat'); } literal('.'); break;
    case 'high': who(); literal(' walks '); val('walk'); literal('.'); break;
    case 'clean': who(); literal(' gets clean.'); break;
    case 'evicted': who(); literal(d.on ? ' loses the home.' : ' gets the home back.'); break;
    case 'tab': who(); literal(' settles a compute tab of '); money('tab'); literal(' · paid '); money('paid'); literal('.'); break;
    case 'turf': if (d.holder) person('holder'); else literal('Nobody'); literal(' holds '); val('corner'); literal('.'); break;
    case 'police': val('place'); literal(' goes '); val('level'); literal(' on police.'); break;
    case 'crew': if (d.act === 'invite') { person('by'); literal(' invites '); person('agent'); } else who(); literal(' · crew '); val('act'); literal(' · '); val(d.name ? 'name' : 'crew'); literal('.'); break;
    case 'buy': who(); literal(' buys '); val('trait'); literal(' for '); money('price'); literal('.'); break;
    case 'board': who(); literal(' boards SECOND CHANCE via '); val('route'); literal('.'); break;
    case 'mint': who(); literal(' mints the haul and carries '); money('mainland'); literal(' to the Mainland.'); break;
    case 'missed': who(); literal(' misses SECOND CHANCE.'); break;
    case 'gone': if (d.from === 'vault') literal('The '); val('from'); literal(' loses what stays on the island.'); break;
    case 'rollover': literal('The unsold drop rolls over.'); break;
    case 'shipment': literal('The docks get a shipment: '); money('cash'); quantities(); literal('.'); break;
    case 'fake': who(); literal(d.act === 'exposed' ? ' has a fake exposed: ' : ' makes a fake: '); val('trait'); literal('.'); break;
    case 'outloud': who(); literal(' speaks out: '); val('line'); break;
    case 'card': literal('The morning paper posts '); val('card.kind'); literal(' · night '); val('card.night'); literal('.'); break;
    case 'play': who(); literal(' picks '); val('kind'); tail('place', ' at '); if (d.target) { literal(' with '); person('target'); } tail('origin', ' · called by '); tail('reason', ' · '); break;
    case 'holdings': who(); literal(' holds '); money('cash'); literal(' in cash'); quantities(); literal('.'); break;
    case 'ask': case 'decline': who(); literal(e.type === 'ask' ? ' asks ' : ' declines '); person('to'); tail('line', ': '); break;
    case 'say': case 'chat': who(); literal(' speaks'); if (d.to) { literal(' to '); person('to'); } literal(' · '); val('say'); if (d.terms?.what) { literal(' · '); val('terms.what'); } if (d.line) tail('line', ': '); break;
    case 'close': person('a'); literal(' and '); person('b'); literal(' end the sit-down · '); val('why'); literal('.'); break;
    case 'overheard': who(); literal(' hears the sit-down.'); break;
    case 'give': who(); literal(' hands over'); tail('trait', ' '); tail('cash', ' ', n => `$${n}`); quantities(); literal(' to '); person('to'); literal('.'); break;
    case 'pay': who(); literal(' pays '); person('to'); literal(' '); money('amount'); tail('for', ' for '); literal('.'); break;
    case 'take': who(); literal(' takes '); val('drug'); literal('.'); break;
    case 'memory': who(); literal(' updates '); val('part', p => ({ plan: 'the plan card', orders: 'standing orders', creed: 'the Creed', note: 'the journal', dawn: 'the dawn journal', clear: 'memory after CLEAR' })[p] ?? p); tail('origin', ' · set by '); literal('.'); break;
    case 'orders': who(); literal(' acts on standing orders: '); val('errand'); literal(d.ok ? ' · done.' : ' · refused.'); break;
    case 'order': who(); literal(d.act === 'back' ? ' gets an order back: ' : ' places an order: '); val('side'); literal(' · '); itemCount(); literal('.'); break;
    case 'shop': case 'sell': who(); literal(e.type === 'shop' ? ' fills a buy order: ' : ' fills a sale: '); itemCount(); literal(' for '); money('cash'); literal('.'); break;
    case 'rob': case 'burgle': who(); literal(e.type === 'rob' ? ' hits ' : ' breaks into the home of '); person('target'); literal(' · cash '); money('cash'); tail('trait', ' · piece '); tail('value', ' · haul ', n => `$${n}`); tail('mark', ' · mark ', n => `$${n}`); literal('.'); break;
    case 'robbed': who(); literal(' gets robbed'); if (d.by) { literal(' by '); person('by'); } literal('.'); break;
    case 'collar': who(); literal(' collars '); person('target'); literal(' · pay '); money('pay'); literal(' · fine '); money('fine'); literal('.'); break;
    case 'seized': who(); literal(' gets a seizure receipt · fine '); money('fine'); literal(' · vault '); money('vault'); literal('.'); break;
    case 'gather': who(); literal(' brings back'); quantities(' '); tail('place', ' from '); literal('.'); break;
    case 'cook': who(); literal(' cooks '); count('batches', 'batches'); quantities(); literal('.'); break;
    case 'craft': who(); literal(' builds'); quantities(' '); literal('.'); break;
    case 'sale': who(); literal(' sells '); count('doses', 'doses'); literal(' for '); money('cash'); literal('.'); break;
    case 'patrol': case 'guard': who(); literal(e.type === 'patrol' ? ' patrols ' : ' guards '); val('place'); literal(' for '); money('wage'); literal('.'); break;
    case 'flex': who(); literal(' flexes for '); money('pay'); literal('.'); break;
    case 'grab': case 'vault': who(); literal(e.type === 'grab' ? ' takes the shipment · ' : ' takes the vault · '); money('cash'); quantities(); literal('.'); break;
    case 'stash': who(); literal(' moves the crew stash · '); val('act'); literal(' · '); money('cash'); quantities(); literal('.'); break;
    case 'wear': who(); literal(' changes the fit.'); break;
    case 'bid': who(); literal(' bids '); money('amount'); literal(' on '); val('trait'); literal('.'); break;
    case 'fence': who(); literal(' deals at the fence · '); val('act'); tail('trait', ' · '); tail('price', ' · ', n => `$${n}`); literal('.'); break;
    case 'tip': who(); literal(' tips off '); person('agent'); literal(' about '); person('target'); literal('.'); break;
    case 'bribe': who(); literal(' pays a bribe of '); money('price'); literal('.'); break;
    case 'bounty': who(); literal(' · bounty '); val('act'); literal(' · '); money('amount'); literal('.'); break;
    case 'rent': case 'bail': who(); literal(e.type === 'rent' ? ' pays for compute: ' : ' gets bail paid: '); money('amount'); literal('.'); break;
    case 'refund': who(); literal(' gets '); money('amount'); literal(' back on '); val('trait'); literal('.'); break;
    case 'betray': who(); literal(' turns · '); val('kind'); literal('.'); break;
    case 'crash': who(); literal(' crashes.'); break;
    case 'hooked': who(); literal(' gets hooked on '); val('drug'); literal('.'); break;
    case 'forced': case 'invalid': who(); literal(e.type === 'forced' ? ' has a play forced · ' : ' has a call refused · '); val('why'); literal('.'); break;
    case 'write': who(); literal(' writes a play for '); person('agent'); literal('.'); break;
    case 'lies': who(); literal(' records the cooking lies.'); break;
    case 'used': who(); literal(' uses'); quantities(' '); literal('.'); break;
    case 'look': who(); literal(' looks into '); person('agent'); literal('’s holdings.'); break;
    default: return null;
  }
  return { text: parts.map(p => typeof p === 'string' ? p : p.text).join(''), parts, paths: [...new Set(refs)] };
}

// Only role fields name participants. A scalar amount (e.g. hustle.take), a
// crew id or a goods key is never mistaken for an agent id.
export function subjectsOf(e) {
  const d = fieldsOf(e);
  if (!d) return [];
  const ids = keys('agent to a b by leader holder target').map(k => d[k]);
  if (['ask', 'decline', 'say', 'chat', 'give', 'pay'].includes(e.type)) ids.push(d.from);
  if (e.type === 'turf') ids.push(d.was);
  ids.push(...(d.members ?? []), ...(d.victims ?? []));
  if (d.card) ids.push(d.card.subjects.agent, ...d.card.subjects.others);
  if (e.type === 'show') ids.push(...Object.keys(d.seen ?? {}));
  if (e.type === 'season') ids.push(...(d.agents ?? []).map(a => a.id));
  return [...new Set(ids.filter(id => typeof id === 'string'))];
}

export function eventRow(e, board) {
  const fields = fieldsOf(e), words = wordsOf(e, board);
  if (!fields || !words) return null;
  return { id: e.id, type: e.type, t: e.t, day: e.day, minute: e.minute,
    scope: scopeOf(e), fields, subjects: subjectsOf(e), ...words,
    source: { eventId: e.id, minute: e.minute } };
}
