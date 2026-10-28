// R8, native tool calls (GAME.md §17, §18, §33): the reply format as OpenAI chat-completions `tools`, generated from the
// one action table (tools.mjs), and `message.tool_calls` read back into exactly the actions a JSON reply sends. These
// tests read the generator and the reader alone; r8-tools-seat.test.mjs plays them through the seat and the fakes.
// Nothing here calls a model. Each test imports the module itself, so each fails on its own before it exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, TYPES, TOOLS } from '../agents/tools.mjs';
import { replyRows } from '../agents/reply-format.mjs';
import { GOODS } from '../rules/state.mjs';

const toolsModule = () => import('../agents/tool-calls.mjs');
// The subset every provider takes (the brief: OpenRouter's translations for Anthropic, Google and DeepSeek, OpenAI, oMLX).
const KEYS = new Set(['type', 'properties', 'required', 'items', 'enum', 'description']);
const TYPES_OK = new Set(['object', 'string', 'integer', 'boolean', 'array']);

// Every problem a schema has against the portable subset, by path; none means it stays inside it.
function outside(schema, at) {
  const bad = [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [`${at}: not a schema`];
  for (const k of Object.keys(schema)) if (!KEYS.has(k)) bad.push(`${at}: key ${k}`);
  if (!TYPES_OK.has(schema.type)) bad.push(`${at}: type ${JSON.stringify(schema.type)}`);
  if ('description' in schema && typeof schema.description !== 'string') bad.push(`${at}: description`);
  if ('enum' in schema && (schema.type !== 'string' || !Array.isArray(schema.enum) || !schema.enum.length || !schema.enum.every(x => typeof x === 'string'))) bad.push(`${at}: enum`);
  if (schema.type === 'object') {
    // No map-shaped object: every object names its properties, and none takes keys it doesn't name.
    if (!schema.properties || typeof schema.properties !== 'object' || !Object.keys(schema.properties).length) bad.push(`${at}: an object with no properties`);
    for (const [k, v] of Object.entries(schema.properties || {})) bad.push(...outside(v, `${at}.${k}`));
    if ('required' in schema && !(Array.isArray(schema.required) && schema.required.every(r => Object.hasOwn(schema.properties || {}, r)))) bad.push(`${at}: required`);
  } else {
    if ('properties' in schema || 'required' in schema) bad.push(`${at}: properties on a ${schema.type}`);
  }
  if (schema.type === 'array') bad.push(...outside(schema.items, `${at}[]`));
  else if ('items' in schema) bad.push(`${at}: items on a ${schema.type}`);
  return bad;
}

test('the tool definitions are the OpenAI chat-completions `tools` format, one a tool area of the action table, and every schema stays in the portable subset: object, string, integer, boolean, array, enum, required, description', async () => {
  const { toolDefinitions } = await toolsModule();
  const defs = toolDefinitions();
  const areas = [...new Set(replyRows('seat', ACTIONS).map(a => a.tool))];
  assert.equal(defs.length, areas.length, 'few tools: one for each tool area a seat may use');
  assert.ok(areas.every(a => Object.hasOwn(TOOLS, a)));
  for (const d of defs) {
    assert.deepEqual(Object.keys(d).sort(), ['function', 'type']);
    assert.equal(d.type, 'function');
    assert.deepEqual(Object.keys(d.function).sort(), ['description', 'name', 'parameters']);
    assert.match(d.function.name, /^[a-zA-Z0-9_-]{1,64}$/, 'a name every provider takes');
    assert.ok(d.function.description.length > 0);
    assert.equal(d.function.parameters.type, 'object');
    assert.deepEqual(outside(d.function.parameters, d.function.name), [], `${d.function.name} stays in the subset`);
  }
  assert.equal(new Set(defs.map(d => d.function.name)).size, defs.length, 'no two tools share a name');
  assert.deepEqual(toolDefinitions(), defs, 'generated the same every time');
  assert.equal(JSON.stringify(toolDefinitions()), JSON.stringify(defs), 'byte for byte, so a provider can cache them');
});

test('the walk catches what the portable subset leaves out (the check checks)', () => {
  const ok = { type: 'object', properties: { a: { type: 'string', enum: ['x'] } }, required: ['a'] };
  assert.deepEqual(outside(ok, 't'), []);
  for (const bad of [
    { type: 'object', properties: { a: { oneOf: [{ type: 'string' }] } } },
    { type: 'object', properties: { a: { anyOf: [{ type: 'string' }] } } },
    { type: 'object', properties: { a: { $ref: '#/x' } } },
    { type: 'object', properties: { a: { type: 'object', additionalProperties: { type: 'integer' } } } },
    { type: 'object', properties: { a: { type: 'object', properties: {} } } },
    { type: 'object', properties: { a: { type: 'number' } } },
    { type: 'object', properties: { a: { type: 'array' } } },
    { type: 'object', properties: { a: { type: 'string', minimum: 1 } } },
    { type: 'object', properties: { a: { type: ['string', 'null'] } } },
  ]) assert.notDeepEqual(outside(bad, 't'), [], JSON.stringify(bad));
});

test('the tools offer exactly the actions the JSON reply format offers a seat, and nothing else (§17: no files, web, wallet or shell)', async () => {
  const { toolDefinitions } = await toolsModule();
  const offered = new Set();
  for (const d of toolDefinitions()) {
    const p = d.function.parameters;
    if (p.properties.act) for (const a of p.properties.act.enum) offered.add(a);
    else offered.add(d.function.name);
  }
  const rows = replyRows('seat', ACTIONS);
  assert.deepEqual([...offered].sort(), rows.map(a => a.act).sort());
  // Each action's fields are its tool's properties, with the same names, and a single action's required ones required.
  for (const d of toolDefinitions()) {
    const p = d.function.parameters;
    const acts = p.properties.act ? p.properties.act.enum : [d.function.name];
    for (const act of acts) {
      const row = ACTIONS.find(a => a.act === act);
      for (const f of Object.keys(row.fields)) assert.ok(Object.hasOwn(p.properties, f), `${act}.${f} is a property of ${d.function.name}`);
      if (!p.properties.act) assert.deepEqual((p.required || []).slice().sort(), Object.entries(row.fields).filter(([, t]) => !t.endsWith('?')).map(([f]) => f).sort());
      else assert.deepEqual(p.required, ['act'], 'several actions share a tool: only act is required');
    }
    const names = new Set(acts.flatMap(act => Object.keys(ACTIONS.find(a => a.act === act).fields)));
    for (const f of Object.keys(p.properties)) assert.ok(f === 'act' || names.has(f), `${d.function.name}.${f} belongs to one of its actions`);
  }
  // No tool's name is another action's, so a call's name can't be read as the wrong action.
  for (const d of toolDefinitions()) {
    const own = d.function.parameters.properties.act ? [] : [d.function.name];
    assert.ok(!ACTIONS.some(a => a.act === d.function.name && !own.includes(a.act)), d.function.name);
  }
});

test('the three map-shaped JSON types get portable shapes: goods a list of {kind, count}, a fit a list of {slot, piece}, and a lie its value in a field of its kind', async () => {
  const { toolDefinitions } = await toolsModule();
  const find = name => toolDefinitions().find(d => d.function.name === name).function.parameters.properties;
  const goods = find('money').goods;
  assert.equal(goods.type, 'array');
  assert.deepEqual(goods.items.properties.kind.enum, GOODS);
  assert.equal(goods.items.properties.count.type, 'integer');
  const fit = find('money').fit;
  assert.equal(fit.type, 'array');
  assert.deepEqual(Object.keys(fit.items.properties).sort(), ['piece', 'slot']);
  const lie = find('play').lies.items;
  assert.deepEqual(lie.properties.kind.enum, Object.keys(TYPES.lie.kinds));
  assert.deepEqual(Object.keys(lie.properties).sort(), ['agent', 'cash', 'kind', 'piece', 'tipped']);
});

// One action of every kind a seat sends, with every nested shape: goods, a fit, halves, terms, lies, plays in plays.
const SAMPLE = [
  { act: 'lookup', section: 'deals', mode: 'inspect', with: 'a02', offset: 4 },
  { act: 'play', menu: 3, target: 'a04', place: 'strip', want: 'P2', accept: ['a05', 'a06'], reason: 'words' },
  { act: 'play', kind: 'cook', place: 'forest', batches: 2, drug: 'hallu', lies: [{ kind: 'cash', agent: 'a02', value: 40 }, { kind: 'stash', agent: 'a03', value: null }, { kind: 'stash', agent: 'a03', value: 'P4' }, { kind: 'tip', agent: 'a04', value: 'a05' }] },
  { act: 'dress', fit: { hat: 'P1', eyewear: null } },
  { act: 'give', to: 'a02', piece: 'P3', goods: { chems: 2, temp: 1 }, cash: 5, sitdown: 's1' },
  { act: 'pay', to: 'a02', amount: 10, for: 'debt' },
  { act: 'bail', agent: 'a03' },
  { act: 'rent' },
  { act: 'shop', item: 'guns', units: 1, max: 250 },
  { act: 'sell', item: 'doses', units: 3, drug: 'temp' },
  { act: 'offer', trait: 't1', amount: 120 },
  { act: 'fence_list', piece: 'P2', price: 300 },
  { act: 'fence_unlist', deal: 'f1' },
  { act: 'fence_buy', deal: 'f2' },
  { act: 'fence_swap', to: 'a03', give: { pieces: ['P1'], goods: { parts: 2 } }, get: { cash: 80 } },
  { act: 'fence_accept', deal: 'f3' },
  { act: 'crew_form', name: 'the crew' },
  { act: 'crew_invite', agent: 'a04' },
  { act: 'crew_join', crew: 'c1' },
  { act: 'crew_leave' },
  { act: 'stash_put', piece: 'P1', goods: { guns: 1 }, cash: 5 },
  { act: 'stash_take', cash: 5 },
  { act: 'ask', to: 'a02', line: 'a word?' },
  { act: 'answer', sitdown: 's1', accept: true, line: 'sure' },
  { act: 'say', sitdown: 's1', say: 'offer', terms: { what: 'buy', goods: { parts: 2 }, cash: 30, night: 2, where: 'docks' }, line: 'deal?' },
  { act: 'agree', sitdown: 's1', line: 'done' },
  { act: 'close', sitdown: 's1' },
  { act: 'chat', say: 'promise', terms: { what: 'back', who: 'a02', night: 3 }, line: 'in' },
  { act: 'outloud', say: 'boast', line: 'look at me' },
  { act: 'listen', sitdown: 's2' },
  { act: 'tip', agent: 'a03', target: 'vault' },
  { act: 'bribe', target: 'strip-1' },
  { act: 'bounty', agent: 'a03', amount: 50 },
  { act: 'lookout', agent: 'a03' },
  { act: 'take', drug: 'truth', play: { menu: 2 } },
  { act: 'write', agent: 'a03', play: { kind: 'hit', target: 'a04', place: 'mall', accept: [] } },
  { act: 'plan', traits: [{ trait: 't1', routes: ['buy', 'hit'] }] },
  { act: 'orders', orders: [{ kind: 'laylow', stars: 3 }, { kind: 'back', agent: 'a02' }] },
  { act: 'note', line: 'a note' },
];

test('every action a seat sends, written as tool calls and read back, is the same action: the reader is the writer\'s exact inverse, nested shapes included', async () => {
  const { toolCallsOf, actionsOfToolCalls } = await toolsModule();
  const acts = new Set(SAMPLE.map(a => a.act));
  assert.deepEqual([...acts].sort(), replyRows('seat', ACTIONS).map(a => a.act).sort(), 'the sample covers every action');
  const calls = toolCallsOf(SAMPLE);
  assert.equal(calls.length, SAMPLE.length);
  for (const c of calls) {
    assert.equal(c.type, 'function');
    assert.equal(typeof c.id, 'string');
    assert.equal(typeof c.function.arguments, 'string', 'arguments are a JSON string, as the API sends them');
  }
  const back = actionsOfToolCalls(calls);
  assert.deepEqual(back.broken, []);
  assert.deepEqual(back.actions, SAMPLE);
  // A goods list and a fit list as a model writes them read as the JSON forms.
  const goods = JSON.parse(calls[4].function.arguments).goods;
  assert.deepEqual(goods, [{ kind: 'chems', count: 2 }, { kind: 'temp', count: 1 }]);
  assert.deepEqual(JSON.parse(calls[3].function.arguments).fit, [{ slot: 'hat', piece: 'P1' }, { slot: 'eyewear' }]);
});

test('arguments that aren\'t one JSON object are broken calls, typed by their place; the whole calls around them still read, in order; an unknown tool reads as an action of its name, which the table refuses as it refuses one in JSON', async () => {
  const { actionsOfToolCalls } = await toolsModule();
  const call = (name, args, id) => ({ id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } });
  const out = actionsOfToolCalls([
    call('money', { act: 'pay', to: 'a02', amount: 3 }, 'c1'),
    call('play', '{"menu": 2', 'c2'),
    call('play', '[1, 2]', 'c3'),
    call('teleport', { place: 'docks' }, 'c4'),
    call('crew', { name: 'no act' }, 'c5'),
    call('outloud', { act: 'chat', say: 'boast', line: 'x' }, 'c6'),
  ]);
  assert.deepEqual(out.broken.map(b => b.index), [1, 2]);
  assert.deepEqual(out.actions, [
    { act: 'pay', to: 'a02', amount: 3 },
    { act: 'teleport', place: 'docks' },
    { act: undefined, name: 'no act' },
    { act: 'outloud', say: 'boast', line: 'x' },
  ]);
  assert.deepEqual(out.at, [0, 3, 4, 5], 'each action says which call it came from');
});
