// Native tool calls (R8; GAME.md §17, §18, §33): the reply format as the OpenAI chat-completions `tools` a provider takes
// (OpenRouter, which translates them for Anthropic, Google and DeepSeek; OpenAI; oMLX), generated from the one action
// table (tools.mjs: ACTIONS, TYPES, TOOLS), and a reply's `message.tool_calls` read back into exactly the actions the
// JSON reply sends, so tools.mjs's reply() runs them: the rules, the refusals and the records are the JSON path's.
// - Few tools (§33): one a tool area of the table, in the table's order. An area with one action a seat may send is a
//   tool named for the action; an area with several names its action in `act`, the one field it requires. A call to an
//   area's tool may name any action: the rules check everything, as they do a JSON reply's.
// - Nothing but the game's own actions is a tool (§17: no files, web, wallet or shell).
// - The schemas keep to what every provider takes: object, string, integer, boolean, array, enum, required and
//   description. No oneOf, anyOf, allOf or $ref, and no map-shaped object. Three of the table's types have no such
//   shape in the JSON form, so the tools give them one, and the reader turns it back:
//   - goods, {"kind": count}: a list of {kind, count};
//   - a fit, {"slot": handle or null}: a list of {slot, piece}, the piece left out to empty the slot;
//   - a lie, {kind, agent, value}, its value's type its kind's: {kind, agent, cash | piece | tipped}.
//   A value that isn't the tools' shape goes on as it came, for the table to refuse as it would refuse it in JSON.
import { ACTIONS, TYPES, TOOLS, KIND_FIELDS, unsent } from './tools.mjs';
import { replyRows } from './reply-format.mjs';
import { GOODS } from '../rules/state.mjs';
import { MEMORY_ROUTES, ORDER_KINDS, SOLD_BY } from '../rules/memory.mjs';

const base = spec => spec.replace('?', '');
const optional = spec => spec.endsWith('?');
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const BY_ACT = new Map(ACTIONS.map(a => [a.act, a]));

// A lie's value, in the field the tools give its kind (TYPES.lie.kinds: each kind's value type).
const LIE_FIELD = { cash: 'cash', stash: 'piece', tip: 'tipped' };
for (const k of Object.keys(TYPES.lie.kinds)) if (!LIE_FIELD[k]) throw new Error(`tool-calls: a lie of kind ${k} has no field`);

// The tools' own shapes for the types the JSON form gives a map or a value of several types: the schema, the reader's
// way back to the JSON form (`back`), and the writer's way there (`out`, for the fake model, which answers as a model).
const SHAPES = {
  goods: {
    schema: () => ({
      type: 'array',
      items: { type: 'object', properties: { kind: { type: 'string', enum: GOODS }, count: { type: 'integer' } }, required: ['kind', 'count'] },
    }),
    back(v) {
      if (!Array.isArray(v) || !v.every(isObj)) return v;
      const out = new Map();
      for (const x of v) {
        const k = String(x.kind);
        out.set(k, !out.has(k) ? x.count : Number.isInteger(out.get(k)) && Number.isInteger(x.count) ? out.get(k) + x.count : NaN);
      }
      return Object.fromEntries(out);
    },
    out: v => (isObj(v) ? Object.entries(v).map(([kind, count]) => ({ kind, count })) : v),
  },
  fit: {
    schema: () => ({
      type: 'array', description: 'a slot to set each: its piece, or none to empty it',
      items: { type: 'object', properties: { slot: { type: 'string' }, piece: { type: 'string' } }, required: ['slot'] },
    }),
    back: v => (Array.isArray(v) && v.every(isObj) ? Object.fromEntries(v.map(x => [String(x.slot), x.piece ?? null])) : v),
    out: v => (isObj(v) ? Object.entries(v).map(([slot, piece]) => (piece === null ? { slot } : { slot, piece })) : v),
  },
  lie: {
    schema: () => ({
      type: 'object', description: `its value in ${Object.entries(LIE_FIELD).map(([k, f]) => `${f} for ${k}`).join(', ')} (none: no piece)`,
      properties: {
        kind: { type: 'string', enum: Object.keys(TYPES.lie.kinds) },
        agent: { type: 'string' },
        cash: { type: 'integer' },
        piece: { type: 'string' },
        tipped: { type: 'string' },
      },
      required: ['kind', 'agent'],
    }),
    back: v => (isObj(v) && Object.hasOwn(LIE_FIELD, v.kind)
      ? { kind: v.kind, agent: v.agent, value: v.kind === 'stash' ? v.piece ?? null : v[LIE_FIELD[v.kind]] } : v),
    out: v => (isObj(v) && Object.hasOwn(LIE_FIELD, v.kind)
      ? { kind: v.kind, agent: v.agent, ...(v.value === null && v.kind === 'stash' ? {} : { [LIE_FIELD[v.kind]]: v.value }) } : v),
  },
  memoryPlan: {
    schema: () => ({
      type: 'array', description: TYPES.memoryPlan.show,
      items: { type: 'object', properties: { trait: { type: 'string' }, routes: { type: 'array', items: { type: 'string', enum: MEMORY_ROUTES } } }, required: ['trait', 'routes'] },
    }),
  },
  memoryOrders: {
    schema: () => ({
      type: 'array', description: TYPES.memoryOrders.show,
      // R10b: and the trade orders' fields: an item, units a day, and a price a unit (max to buy, min to sell).
      items: { type: 'object', properties: { kind: { type: 'string', enum: ORDER_KINDS }, stars: { type: 'integer' }, agent: { type: 'string' }, item: { type: 'string', enum: Object.keys(SOLD_BY) }, units: { type: 'integer' }, max: { type: 'integer' }, min: { type: 'integer' } }, required: ['kind'] },
    }),
  },
};

// R8b, few words: a scalar's description goes only where the field's name, type and enum don't already say it (a
// piece's handle or a trait's id, a target's choices); the rest (agent ids, whole numbers, words, sit-down, deal and
// crew ids, true or false) the schema says by itself, and the table's refusal names the rule if a value breaks it.
const SAID = new Set(['agent', 'dollars', 'count', 'number', 'yes', 'text', 'sitdown', 'deal', 'crew', 'handle']);
// A type's schema, from the table: its tools' shape, its object's fields, its list's items, its values, or its scalar.
function schemaOf(name) {
  const t = TYPES[name];
  if (!t) throw new Error(`tool-calls: no type ${name}`);
  if (SHAPES[name]) return SHAPES[name].schema();
  if (t.spec) return objectOf(t.spec);
  if (t.of) return { type: 'array', items: schemaOf(t.of) };
  if (t.values) return { type: 'string', enum: t.show.split('|') };
  return { type: t.json || 'string', ...(SAID.has(name) ? {} : { description: t.show }) };
}
function objectOf(spec) {
  const properties = Object.fromEntries(Object.entries(spec).map(([f, s]) => [f, schemaOf(base(s))]));
  const required = Object.entries(spec).filter(([, s]) => !optional(s)).map(([f]) => f);
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

// One property several actions of a tool share: the same shape, or, for names of things, one string whose enum holds
// each action's values and whose description says which action takes which. Any other two shapes are refused here.
// R8b: which action takes which field is said once, in the tool's description (`signature`), not again on each field.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function shared(f, uses) {
  const [first] = uses;
  if (uses.every(u => same(u.schema, first.schema))) return first.schema;
  if (!uses.every(u => u.schema.type === 'string')) throw new Error(`tool-calls: ${f} has two shapes in one tool`);
  const values = [...new Set(uses.flatMap(u => u.schema.enum || []))];
  const each = uses.map(u => `${u.act}: ${u.schema.enum ? u.schema.enum.join('|') : u.schema.description}`).join('; ');
  return { type: 'string', ...(uses.every(u => u.schema.enum) ? { enum: values } : {}), description: each };
}
// An action as its tool's description names it: its act and its fields, `?` after an optional one.
const signature = row => `${row.act}(${Object.entries(row.fields).map(([f, s]) => `${f}${optional(s) ? '?' : ''}`).join(', ')})`;

// The tools, in the table's order: one a tool area, built once (the same bytes every call, so a provider can cache them).
// A tool of several actions says in its description, once, each action's fields and what it does (R8b: one line each;
// R8 had said it again on every field, and the same sentence in six tools).
const AREAS = (() => {
  const rows = replyRows('seat', ACTIONS);
  const areas = [...new Set(rows.map(a => a.tool))];
  return areas.map(area => {
    const own = rows.filter(a => a.tool === area);
    if (own.length === 1) {
      const [row] = own;
      const parameters = objectOf(row.fields);
      return { area, name: row.act, single: true, act: row.act, acts: [row.act], def: { type: 'function', function: { name: row.act, description: `${TOOLS[area]}: ${row.about}.`, parameters } } };
    }
    const uses = new Map();
    for (const row of own) for (const [f, s] of Object.entries(row.fields)) {
      if (!uses.has(f)) uses.set(f, []);
      uses.get(f).push({ act: `${row.act}${optional(s) ? '?' : ''}`, schema: schemaOf(base(s)) });
    }
    const properties = { act: { type: 'string', enum: own.map(r => r.act) } };
    for (const [f, u] of uses) properties[f] = shared(f, u);
    const description = [`${TOOLS[area]}; act picks one (? optional):`, ...own.map(r => `${signature(r)}: ${r.about}`)].join('\n');
    return { area, name: area, single: false, acts: own.map(r => r.act), def: { type: 'function', function: { name: area, description, parameters: { type: 'object', properties, required: ['act'] } } } };
  });
})();
const BY_NAME = new Map(AREAS.map(a => [a.name, a]));
const BY_AREA = new Map(AREAS.map(a => [a.area, a]));
for (const a of AREAS) if (BY_ACT.has(a.name) && BY_ACT.get(a.name).tool !== a.area) throw new Error(`tool-calls: tool ${a.name} is another area's action`);

// The tools a seat's request carries: a copy, so no caller can change the next one.
export function toolDefinitions() {
  return structuredClone(AREAS.map(a => a.def));
}

// A value of a type, from the tools' shape back to the JSON form (`way` 'back'), or from it to the tools' (`way`
// 'out'): its own shape, then the fields of an object and the items of a list, each by its type.
function convert(name, x, way) {
  const t = TYPES[name];
  if (!t) return x;
  if (way === 'back' && SHAPES[name]?.back) x = SHAPES[name].back(x);
  let y = x;
  if (t.spec && isObj(x)) y = fieldsOf(t.spec, x, way);
  else if (t.of && Array.isArray(x)) y = x.map(v => convert(t.of, v, way));
  if (way === 'out' && SHAPES[name]?.out) y = SHAPES[name].out(y);
  return y;
}
const fieldsOf = (spec, x, way) => Object.fromEntries(Object.entries(x).map(([f, v]) => [f, Object.hasOwn(spec, f) ? convert(base(spec[f]), v, way) : v]));

// One call's action: its tool's action, or for an area's tool the one it names; an unknown tool reads as an action of
// its name, which the table refuses, as it refuses an unknown action in JSON.
// Some models answer with every field of a tool's schema, blanks and first enum values included (10-19: GPT-6 Luna and
// GPT-6.1 Sol filled "target": "", "corner", "batches": 0 and "drug" on a shift). A call is read as the action it chose:
// a field its action, or its play's kind, doesn't take is dropped, and so is a blank value ("", null, {} or an empty
// list), at any depth; a play's menu 0 is no menu. A field it takes keeps its value, zero included, so the rules still
// judge it. Three empty lists mean something and stay: accept (the rules' "accept nobody", fights.mjs), and a plan's
// traits and the standing orders ("[] clears"). 10-19 season: Sol's sit-down answers sent terms.goods [], refused.
const MEANS_EMPTY = new Set(['accept', 'traits', 'orders']);
const blank = (v, key) => v === '' || v === null || (isObj(v) && !Object.keys(v).length) || (Array.isArray(v) && !v.length && !MEANS_EMPTY.has(key));
const unblank = v => (isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unblank(x)]).filter(([k, x]) => !blank(x, k))) : Array.isArray(v) ? v.map(unblank) : v);
// R8e: zero is none. A 0 in a field whose type can never be 0 (TYPES count and dollars, both >=1) reads as absent, at
// any depth (10-19 season: Sol's gives sent "cash": 0, Luna's sit-down terms "night": 0, each refused). A play's line
// fields keep theirs: the rules check them against tonight's menu line (r8d pins a cook's batches 0). The line fields
// are tools.mjs's LINE_FIELDS, which it doesn't export; a play's menu 0 is none, as before.
const NEVER_ZERO = new Set(['count', 'dollars']);
// R8 review (10-19): a missing shop or sell units means one unit to the rules (errand.mjs: `e.units == null ? 1`), so
// a 0 there stays 0, which the rules refuse, instead of turning into a real one-unit trade.
const ZERO_MEANT = new Set(['units']);
const PLAY_LINE = new Set(['target', 'place', 'corner', 'batches', 'guns', 'lockpicks']);
const isPlay = spec => spec === TYPES.play.spec || spec === BY_ACT.get('play').fields;
function unzero(spec, x) {
  if (!isObj(x)) return x;
  const out = {};
  for (const [f, v] of Object.entries(x)) {
    const name = Object.hasOwn(spec, f) ? base(spec[f]) : null;
    const t = name && TYPES[name];
    if (t && NEVER_ZERO.has(name) && v === 0 && !ZERO_MEANT.has(f) && !(isPlay(spec) && PLAY_LINE.has(f))) continue;
    out[f] = !t ? v : t.spec && isObj(v) ? unzero(t.spec, v) : t.of && TYPES[t.of]?.spec && Array.isArray(v) ? v.map(y => unzero(TYPES[t.of].spec, y)) : v;
  }
  return out;
}
function tidy(act, row, fields) {
  const own = unzero(row.fields, Object.fromEntries(Object.entries(fields).filter(([f]) => Object.hasOwn(row.fields, f))));
  let out = Object.fromEntries(Object.entries(own).map(([f, v]) => [f, unblank(v)]).filter(([f, v]) => !blank(v, f)));
  if (act !== 'play') return out;
  const takes = typeof out.kind === 'string' ? KIND_FIELDS[out.kind] : null;
  if (takes) out = Object.fromEntries(Object.entries(out).filter(([f]) => ['kind', 'menu', 'reason'].includes(f) || takes.has(f)));
  return out;
}

function actionOf(name, args) {
  const tool = BY_NAME.get(name);
  const { act: named, ...fields } = args;
  const act = !tool ? name : tool.single ? tool.act : named;
  const row = typeof act === 'string' ? BY_ACT.get(act) : null;
  return { act, ...(row ? fieldsOf(row.fields, tidy(act, row, fields), 'back') : fields) };
}

// R10a (the 10-20 audit, §2.3; slime, 10-20: "Stop our tool code from throwing away trade terms. That's a plain bug."):
// an answer, an ask and an agree take no terms, so the tidying above dropped every term one carried, without a word (the
// 10-20 test: 30 answers and asks with goods and cash, Luna 15 and Sol 15; 21 agrees). Trade terms, terms that still
// name goods, a piece or cash once blanks are dropped (a cash of 0 is none), are never dropped in silence now:
// - an answer that accepts runs as sent, then a say in its sit-down with those terms: an offer, as the audit's fix has it
//   ("accept, then send the terms as an offer"), when the call named no say kind, a blank one or `answer` (a say-answer
//   states no deal, errand.mjs); a promise or a threat as named. (The brief said "the say kind the call named"; the
//   review, 10-20, made a named answer an offer: 21 of the 10-20 test's 28 named it, and lost the deal.) Both go through
//   the table and the rules as any answer and say do: a say that matches the other side's open offer agrees it (§14),
//   and one the rules refuse comes back refused, typed. Nothing else is guessed;
// - an ask, or an answer that declines, runs as sent, and its terms are refused, typed (tools.mjs `unsent`), in its place;
// - an agree runs as sent, and takes the open offer as it stands; terms it carried that aren't that offer are refused,
//   typed, the same way (the reply judges them: only it sees the offer). Terms that are the offer say nothing more.
// Terms with no goods, piece or cash stay as they were: dropped, the action a plain answer, ask or agree (10-19: Sol's
// asks and answers sent "terms" with goods [], piece "" and cash 0). The 10-20 calls sent their terms only in `terms`,
// never as goods or cash at the action's top level, which no talk action takes.
const SAY = BY_ACT.get('say');
const SAY_TOOL = BY_AREA.get(SAY.tool).name;
const TRADE = ['goods', 'piece', 'cash'];
function tradeTerms(args) {
  if (!isObj(args.terms)) return false;
  const { terms } = tidy('say', SAY, { terms: args.terms });
  return isObj(terms) && TRADE.some(f => Object.hasOwn(terms, f) && !(f === 'cash' && terms.cash === 0));
}
const UNSENT_WHY = {
  ask: "its terms weren't sent: an ask carries no terms; they go in a say once the other side has taken the sit-down",
  answer: "its terms weren't sent: an answer that declines carries no terms",
  agree: "its terms weren't sent: agree takes their open offer as it stands; other terms go in a say offer",
};
// The say kinds an accepting answer's terms go as an offer under: none named, a blank, or the answer's own.
const AS_OFFER = new Set([undefined, 'answer']);
function actionsOf(name, args) {
  const action = actionOf(name, args);
  if (!Object.hasOwn(UNSENT_WHY, action.act) || !tradeTerms(args)) return [action];
  const say = args.say === undefined || blank(args.say) || AS_OFFER.has(args.say) ? 'offer' : args.say;
  const split = actionOf(SAY_TOOL, { act: 'say', sitdown: args.sitdown, say, terms: args.terms });
  if (action.act === 'answer' && args.accept === true) return [action, split];
  return [action, unsent(action.act, UNSENT_WHY[action.act], action.act === 'agree' ? { sitdown: split.sitdown, terms: split.terms } : null)];
}

// A reply's tool calls as the actions a JSON reply would send, in the order called: { actions, at, broken }. `at` says
// which call each action came from (R10a: a call can make two, an answer and its say, or an action and its unsent
// terms); `broken` the calls whose arguments aren't one JSON object, { index, name }.
export function actionsOfToolCalls(calls) {
  const actions = [], at = [], broken = [];
  for (const [index, c] of (Array.isArray(calls) ? calls : []).entries()) {
    const name = c?.function?.name;
    const raw = c?.function?.arguments;
    let args;
    try {
      args = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      args = undefined;
    }
    if (!isObj(args) || typeof name !== 'string') {
      broken.push({ index, name: typeof name === 'string' ? name : null });
      continue;
    }
    for (const action of actionsOf(name, args)) {
      actions.push(action);
      at.push(index);
    }
  }
  return { actions, at, broken };
}

// Actions as a model would call them: one tool call each, arguments a JSON string (the fake model's answer).
export function toolCallsOf(actions) {
  return actions.map((a, i) => {
    const { act, ...fields } = isObj(a) ? a : {};
    const row = BY_ACT.get(act);
    // Only an action a seat may send has a tool; any other is called by its own name, as an unknown tool.
    const tool = row && BY_AREA.get(row.tool)?.acts.includes(act) ? BY_AREA.get(row.tool) : null;
    const args = tool ? fieldsOf(row.fields, fields, 'out') : fields;
    return { id: `call_${i + 1}`, type: 'function', function: { name: tool ? tool.name : String(act), arguments: JSON.stringify(tool && !tool.single ? { act, ...args } : args) } };
  });
}
