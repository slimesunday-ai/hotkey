// The model seat (GAME.md §17, §18, §33, §34; brief R2-agents.md, task R2-7): plays one agent by calling a model through
// the tools (tools.mjs). One call is the briefing in and one JSON reply out: a fresh request with no chat history, since
// the game holds the memory (§17), so the prompt never grows. A call gets a fixed window (gap.window) and one retry
// whose prompt names the failure (gap.retry); then, at the lock, tonight's pick (a play the model sent earlier in the
// day, §17: "your agent's pick plays"), then standing orders, then the core's default play, each marked with its
// origin. At most N.callCeiling requests a seat a day, every request counted, the retry too (Q1); past it the seat
// answers without calling. Thinking is off unless the caller turns it on (Q3). The request carries only the game's
// reply format: no tools of its own (§17: no files, web, wallet or shell).
// R8, the reply mode (`reply`): 'json' by default, one JSON object in the reply's text, as above; or 'tools', the
// game's own actions as native tool calls (tool-calls.mjs), its only tools, with no JSON reply format beside them. The
// calls are read back into the actions a JSON reply sends, so the rules, refusals and records are the same; a reply
// with no tool call, or a call whose arguments aren't JSON, is malformed, under the same one retry. An inspection's page
// comes back as a `tool` message answering its call, after a fresh briefing.
//
// The interface (R2-8's season loop drives it; `runSeason` stays synchronous for bots):
//   const seat = makeSeat({ id, url, fetch, secret, brief, orders, clock, model, thinking, maxTokens, temperature,
//                           api, provider, observe, memo, record, onTape })
//     id        the agent the seat plays; its x-seat header
//     url       the chat endpoint, and fetch, fetch's shape: both passed in, with no default, so no model is reached
//               unless a caller passes one (R2-8 adds the --go guard)
//     api       the endpoint's API (R2-12): 'local' by default, the local model's chat template kwargs; or
//               'openrouter', OpenRouter's fields (openrouter.mjs), with `provider`, its routing, only when given; or
//               (R8c) 'claude', the Messages API's thinking fields (anthropic.mjs claudeFields), which its transport
//               turns into a Messages body. The messages are the same every way
//     reply     R8: 'json' (the default) or 'tools', how the model answers (REPLY_MODES)
//     secret    the per-season secret the handles' shuffle uses, kept by the runner, never the season's seed
//     brief     (readResult, memory, lastResults, round) -> messages: the briefing (R2-4); `round` is the call's, so the
//               briefing can say which call it is (R2-8)
//     orders    (view, round) -> { errands, play, reason } or null: standing orders, read from the view as a bot would,
//               by copy (R2-2 hasn't built them, and Q8 gives the first season none, so by default there are none)
//     clock     { now, setTimeout, clearTimeout }: the real one by default, or the fake's manualClock()
//     observe   (info) -> void, before each request: { seat, call, day, round, view, deal } (the fake's bot hook)
//     memo      the seat's own state between calls (handle counter, call counts, the day's tries, last results and bounded feedback,
//               tonight's pick), plain JSON for a checkpoint; a new one by default
//     record    the seat's record so far, to go on with (a resumed season); a new one by default
//     onTape    (line) -> void, as each tape line is written, so a run folder keeps every call even if the run is killed
//   const out = await seat.call({ view, apply, round, defaultPlay, memory })
//     view         the agent's view now (viewFor(s, log, id, 'agent'))
//     apply(e)     by day: sends one errand into the rules now and says { ok, why, kind }, as tools.mjs's ctx.apply
//     round        the day's round, 1 to the bench's rounds, or 'lock'. At the lock errands are refused, typed, so the
//                  lock's calls each read one state and can go out together
//     defaultPlay  at the lock: the core's default play for the agent tonight (rules/plays.mjs's defaultPlay)
//     validatePlay (play by copy) -> core checkPlay result against current runner state, after earlier errands
//     memory       the game-held memory (R2-2), passed through to brief()
//   -> { results, play, origin, outcome, calls }
//     results  what the call point did, as the player reads it next (typed, pieces by handle)
//     play     at the lock, always a play, by copy, for the caller alone; by day null
//     origin   'model', 'orders' or 'default': who answered (by day 'default' sends nothing)
//     outcome  the last request's: 'reply', 'cutoff', 'malformed', 'timeout', 'error'; 'ceiling' with none
//     calls    the requests this call point made
//   const { text, outcome, calls } = await seat.dawn({ view })
//     R9b, the dawn journal (journal.mjs): one request for the day's journal entry, its text the entry; nothing acts
//   seat.record: an entry a call point { day, round, origin, play, pick, attempts: [{ call, outcome, why }] }, the
//     seat's own record of who made each play until R2-1 puts `origin` on the play; plays and picks without their
//     words. seat.tape(): every request and reply this seat made, one tapeLine() each (fake-model.mjs).
import { standingOrders } from './orders.mjs';
import { N } from '../numbers.mjs';
import { read, reply, act, ACTIONS } from './tools.mjs';
import { present, handleOf } from './handles.mjs';
import { tapeLine, SEAT_HEADER, CALL_HEADER } from './fake-model.mjs';
import { openRouterFields, needsCacheMark, cacheMarked } from './openrouter.mjs';
import { claudeFields, CLAUDE } from './anthropic.mjs';
import { toolDefinitions, actionsOfToolCalls } from './tool-calls.mjs';
import { splitWords } from './speech-context.mjs';
import { dawnReply, dawnTask } from './journal.mjs';

// R8: how a model seat replies. 'json' stays the default; 'tools' is opt-in, by model group or season (runner.mjs).
export const REPLY_MODES = ['json', 'tools'];
export const DEFAULT_REPLY = 'json';
// R8: tool_choice "required" makes a model call a tool, and both APIs take the field (oMLX reads only "none"; OpenRouter
// passes it on). A thinking seat sends "auto": Anthropic refuses a forced tool with extended thinking on.
// R8b: by day a seat sends `dayToolChoice` ("required" by default, R8's; "auto" lets a model call nothing on an idle
// day, the starter version's, runner.mjs), and at the lock always R8's. By day a reply with no call and no text is
// "nothing this call", under either: no retry. Text with no call is malformed, and so is any reply at the lock with no
// call.
export const DAY_TOOL_CHOICES = ['required', 'auto'];
// R8c: a Claude seat always sends "auto": Sonnet 5.5, Opus 5.5 and Fable 5.1 refuse forced tool use with a 400.
const toolChoice = (thinking, lock, day = 'required', api = 'local') => (thinking === true || api === CLAUDE ? 'auto' : lock ? 'required' : day);
// A reply's text, after any thinking: nothing but white space is no text.
const textOf = content => (typeof content === 'string' ? content.slice(content.includes('</think>') ? content.lastIndexOf('</think>') + '</think>'.length : 0).trim() : '');
// The JSON a tool message carries, its angles and non-ASCII escaped as the briefing escapes quoted words.
const toolJSON = x => JSON.stringify(x).replace(/[^\x20-\x7e]|[<>]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// The request's API fields beside the briefing, by the endpoint's API: the local model's chat template takes thinking
// as a kwarg (oMLX), and OpenRouter takes a reasoning budget, a cap on the reply and the call's cost in its usage
// (R2-12).
const APIS = {
  local: ({ thinking }) => ({ chat_template_kwargs: { enable_thinking: thinking === true } }),
  openrouter: openRouterFields,
  [CLAUDE]: claudeFields,
};
const REAL_CLOCK = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
const COPY = /^k\d+$/;
const HANDLE = /^P\d+$/;
// Words an agent wrote (§18): never read as a piece.
const WORDS = new Set(['line', 'reason', 'name']);
// A handle no briefing deals.
const UNDEALT = 'P0';
const noOrders = (view, round, defaultPlay) => round === 'lock' ? standingOrders(view, { defaultPlay }) : null;
// At the lock only tonight's play counts: an errand there is refused, typed, and never reaches the rules.
const atTheLock = () => ({ ok: false, why: "at the lock only tonight's play counts: errands are for the day", kind: 'not-yet', source: 'tools', code: 'lock' });
const parsed = text => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
// A call point's failure, typed as the tools type theirs, for the next briefing.
const failed = (code, why) => ({ act: null, ok: false, why, kind: 'not-yet', code });
// §11, CLEAR: the newest take of CLEAR by the seat's own agent that its view shows, by event number, or null. A take is
// the taker's own now and everyone's 24 hours later, so another agent's can show too, and wipes nothing here.
const clearIn = (view, id) => view.events.reduce((n, e) => (e.type === 'take' && e.agent === id && e.drug === 'clear' && (n === null || e.n > n) ? e.n : n), null);

// Each string of x that names a piece, by `to`: a copy as its handle, or (back) a handle as its copy; words aside.
function named(x, to, key = null) {
  if (typeof x === 'string') return WORDS.has(key) ? x : to(x);
  if (Array.isArray(x)) return x.map(y => named(y, to, key));
  if (!x || typeof x !== 'object') return x;
  return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, named(y, to, k)]));
}

const presentBack = (value, deal) => named(value, x => HANDLE.test(x) && Object.hasOwn(deal.byHandle, x) ? deal.byHandle[x] : x);

// Errands and a play by copy (a bot's, or standing orders') as the reply format names them: each errand as the action
// of its kind, its fields renamed back through the table's `as`, each copy as its handle in this briefing (a copy the
// briefing never dealt as a handle no briefing deals), and the play written out with its reason.
export function actionsOf({ errands = [], play = null, reason } = {}, deal) {
  const asHandle = x => (COPY.test(x) ? handleOf(deal, x) ?? UNDEALT : x);
  const out = errands.map(({ kind, by, ...fields }) => {
    const row = ACTIONS.find(a => a.errand === kind);
    const back = Object.fromEntries(Object.entries((row && row.as) || {}).map(([mine, theirs]) => [theirs, mine]));
    return { act: kind, ...Object.fromEntries(Object.entries(named(fields, asHandle)).map(([f, x]) => [back[f] || f, x])) };
  });
  if (play) out.push({ act: 'play', ...named(play, asHandle), ...(reason === undefined ? {} : { reason }) });
  return out;
}

// A reply that isn't one JSON value, read up to where it stops (sim2's brain.mjs found cut-off replies still carry a
// whole action): the whole objects in its list of actions (the "actions" list of its one object, or a bare list), in
// order. Quotes and brackets inside strings are words, not structure; an object that doesn't parse counts for nothing.
export function keptActions(text) {
  const s = String(text);
  const out = [];
  const depth = [];
  let key = null, word = null, list = 0, item = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === '\\' ? 2 : 1;
      if (j >= s.length) break;
      word = s.slice(i + 1, j);
      i = j;
    } else if (ch === ':') {
      if (depth.at(-1) === '{') key = word;
    } else if (ch === '{' || ch === '[') {
      if (!list && ch === '[' && (depth.length === 0 || (depth.length === 1 && depth[0] === '{' && key === 'actions'))) list = depth.length + 1;
      else if (list && depth.length === list && ch === '{') item = i;
      depth.push(ch);
    } else if (ch === '}' || ch === ']') {
      depth.pop();
      if (list && depth.length === list && item >= 0) {
        const x = parsed(s.slice(item, i + 1));
        if (x !== undefined) out.push(x);
        item = -1;
      }
      if (list && depth.length < list) break;
    }
  }
  return out;
}

// R8, a tools-mode reply: its tool calls read as actions. No call is malformed (or cut off); a call whose arguments
// aren't one JSON object makes the reply malformed, its whole calls still read, as a JSON reply's whole actions are.
// `calls` are the calls as they came, for an inspection's continuation to answer. R8b: by day (`idle`), no call and no
// text is a reply of no actions.
function toolCompletion(choice, idle = false) {
  const message = choice && choice.message;
  if (!message || typeof message !== 'object') return { outcome: 'error', why: "the model's endpoint sent no reply" };
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const cut = choice.finish_reason === 'length';
  if (!calls.length && idle && !cut && !textOf(message.content)) return { outcome: 'reply', value: { actions: [] }, calls: [], at: [] };
  if (!calls.length) return { outcome: cut ? 'cutoff' : 'malformed', why: cut ? 'it was cut off before a tool call was whole' : 'it called no tool' };
  const { actions, at, broken } = actionsOfToolCalls(calls);
  const value = actions.length ? { actions } : undefined;
  if (!broken.length) return { outcome: 'reply', value, calls, at };
  const why = cut ? 'it was cut off before every tool call was whole'
    : `the arguments of ${broken.length === 1 ? 'a tool call weren\'t' : `${broken.length} tool calls weren't`} one JSON object`;
  return { outcome: cut ? 'cutoff' : 'malformed', value, why, calls, at };
}

// What came back for one request, typed: a whole reply's value, or a cut-off or malformed one's whole actions.
function completion(res, api, tools = false, idle = false) {
  if (res.status !== 200) return { outcome: 'error', why: `the model's endpoint answered ${res.status}` };
  // OpenRouter sends an error that comes up once the model has started as a 200 with the error in its body (R2-12): it
  // reads as the error it is, never as a reply.
  const error = api === 'openrouter' && res.body && typeof res.body === 'object' ? res.body.error : null;
  if (error) return { outcome: 'error', why: `the model's endpoint answered with an error${Number.isInteger(error.code) ? ` (${error.code})` : ''}` };
  const choice = res.body && Array.isArray(res.body.choices) ? res.body.choices[0] : null;
  if (tools) return toolCompletion(choice, idle);
  const content = choice && choice.message ? choice.message.content : null;
  if (typeof content !== 'string') return { outcome: 'error', why: "the model's endpoint sent no reply text" };
  // Thinking, when the caller turns it on, comes before the reply.
  const text = content.includes('</think>') ? content.slice(content.lastIndexOf('</think>') + '</think>'.length) : content;
  const whole = parsed(text);
  if (whole !== undefined) return { outcome: 'reply', value: whole };
  const kept = keptActions(text);
  const cut = choice.finish_reason === 'length';
  const why = cut ? 'it was cut off before an action was whole' : "it wasn't one JSON object";
  return { outcome: cut ? 'cutoff' : 'malformed', value: kept.length ? { actions: kept } : undefined, why };
}

export function makeSeat({
  id, url, fetch: send, secret, brief, orders = noOrders, clock = REAL_CLOCK, model, thinking = false, maxTokens,
  temperature, api = 'local', provider = null, observe = null, memo = {}, record = [], onTape = null, reply: mode = DEFAULT_REPLY,
  dayToolChoice = 'required', cacheMark = false,
} = {}) {
  if (typeof id !== 'string' || !id) throw new Error('a seat plays one agent: pass its id');
  if (!Object.hasOwn(APIS, api)) throw new Error(`a seat calls the local model's API, OpenRouter's or the Claude API (${CLAUDE}), not ${api}`);
  if (!REPLY_MODES.includes(mode)) throw new Error(`a seat's reply is ${REPLY_MODES.join(' or ')}, not ${mode}`);
  const tools = mode === 'tools';
  if (!DAY_TOOL_CHOICES.includes(dayToolChoice)) throw new Error(`a seat's dayToolChoice is ${DAY_TOOL_CHOICES.join(' or ')}, not ${dayToolChoice}`);
  if (typeof url !== 'string' || !url) throw new Error('a seat calls only the url passed in: there is no default endpoint');
  if (typeof send !== 'function') throw new Error('a seat calls through the fetch passed in: there is no default fetch');
  if (secret === undefined || secret === null) throw new Error("a seat deals handles from the season's secret, never its seed: pass the secret");
  if (typeof brief !== 'function') throw new Error('a seat needs the briefing: brief(readResult, memory, lastResults) -> messages');
  const m = Object.assign(memo, { next: 1, calls: 0, day: null, today: 0, tries: {}, last: [], feedback: [], delivery: [], pick: null, ownerPick: null, lockDay: null, ...memo });
  const lines = [];
  let busy = false, locking = false;
  // R8b: mark the fixed part of the request for the provider's cache (openrouter.mjs), when the caller asks (the runner's
  // new modes) and the model's provider needs a mark to cache at all; every other request goes as it was.
  // R8c: the Claude API caches only up to a mark too, so a Claude seat marks as an anthropic/ model on OpenRouter does.
  const marking = cacheMark === true && ((api === 'openrouter' && needsCacheMark(model)) || api === CLAUDE);

  // One request inside the window, on the tape: what came back, typed.
  // R9b: `readReply`, when given, reads what came back in place of the action reply (the dawn journal's text), and
  // `delivers` false keeps the request's quotes out of the delivery record (a dawn call can't act on them, so a line
  // first shown there is still fresh for the day's first call).
  async function request(body, info, presentation = null, idle = false, { readReply = null, delivers = true } = {}) {
    if (marking) body = cacheMarked(body, presentation && presentation.systemFixed);
    const call = ++m.calls;
    m.today += 1;
    if (observe) observe({ ...info, call });
    const stop = new AbortController();
    const start = clock.now();
    const timer = clock.setTimeout(() => stop.abort(), N['gap.window'] * 1000);
    let res = null, got;
    try {
      if (presentation && delivers) {
        const allowed = new Set(presentation.availableSpeechIds || []);
        const sent = [...new Set((presentation.presentedSpeechIds || []).filter(id => allowed.has(id)))];
        const sentIds = new Set(sent);
        // The permitted projection bounds this ID-only set. Dropping an arbitrary prefix would make old delivered
        // speech look unread again and could starve new messages in a long, busy season.
        // Move this request's IDs to the end in actual presentation order, preserving a fair next-group anchor.
        m.delivery = [...(m.delivery || []).filter(id => allowed.has(id) && !sentIds.has(id)), ...sent];
      }
      const r = await send(url, {
        method: 'POST', body: JSON.stringify(body), signal: stop.signal,
        headers: { 'content-type': 'application/json', [SEAT_HEADER]: id, [CALL_HEADER]: String(call) },
      });
      const text = await r.text();
      const json = parsed(text);
      res = { status: r.status, body: json === undefined ? text : json };
      got = readReply ? readReply(res, api) : completion(res, api, tools, idle);
    } catch {
      got = stop.signal.aborted
        ? { outcome: 'timeout', why: `no reply came inside the ${N['gap.window']} s window` }
        : { outcome: 'error', why: "the request to the model's endpoint failed" };
    } finally {
      clock.clearTimeout(timer);
    }
    lines.push(tapeLine({ seat: id, call, request: body, reply: res, start, ms: clock.now() - start }));
    if (onTape) onTape(lines.at(-1));
    return { call, ...got };
  }

  // What a briefing shows of earlier calls: the bounded feedback of the last two days that the last call's results
  // don't repeat, then those results.
  function priorResults(feedback = m.feedback) {
    const withoutDay = r => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'day')));
    return [...feedback.filter(r => !m.last.some(x => withoutDay(x) === withoutDay(r))), ...m.last];
  }

  // §11, CLEAR: once the view shows a take the seat hasn't met, nothing it kept from before goes on.
  function clearMet(view) {
    const clear = clearIn(view, id);
    if (clear !== null && clear !== m.cleared) Object.assign(m, { cleared: clear, pick: null, ownerPick: null, last: [], feedback: [], delivery: [], tries: {} });
  }

  async function callPoint({ view, apply, round, defaultPlay, memory, validatePlay, currentView }) {
    if (!view || !view.me || view.me.id !== id) throw new Error(`seat ${id} reads only its own agent's view`);
    memory = Object.hasOwn(view.me, 'memory') ? view.me.memory : memory;
    const lock = round === 'lock';
    if (lock && !defaultPlay) throw new Error(`seat ${id}: the lock needs the core's default play`);
    if (!lock && typeof apply !== 'function') throw new Error(`seat ${id}: a day's call needs apply`);
    if (m.day !== view.day) Object.assign(m, { day: view.day, today: 0, pick: null, ownerPick: null, lockDay: null });
    if (lock) m.lockDay = view.day;
    // §11, CLEAR wipes what the agent learned before the take (GAP gap.clear). Once the view shows a take the seat
    // hasn't met, nothing it kept from before goes on: tonight's pick, the last reply's results and the day's failed
    // tries. The call counts and the handles' numbering stay: they're the ceiling and the deal, nothing it learned.
    const clear = clearIn(view, id);
    if (clear !== null && clear !== m.cleared) Object.assign(m, { cleared: clear, pick: null, ownerPick: null, last: [], feedback: [], delivery: [], tries: {} });
    let { deal, result } = read(view, { audience: 'seat', seed: secret, from: m.next });
    m.next = deal.next;
    // R10b: the last event the seat's last call read, for its trade orders' line (briefing.mjs ordersLines).
    const since = Number.isInteger(m.seen) ? m.seen : -1;
    // R5-deals: the last event this call reads, so a hand-over it has read wakes the seat no more (runner.mjs wakes).
    m.seen = view.events.reduce((n, e) => Math.max(n, e.n), Number.isInteger(m.seen) ? m.seen : -1);
    const ctx = { deal, apply: lock ? atTheLock : apply, tries: m.tries, validatePlay, currentView, legal: view.legal, actions: view.me.actions };
    m.feedback = m.feedback.filter(r => r.day >= view.day - 2);
    const prior = priorResults();
    let presentation = null;
    // R8b (§17): the owner changed the Creed since the last call that went out, so this call says so, once. The seat
    // keeps the Creed its agent was last told (plain JSON, in the memo); none kept is none set.
    const creedNow = JSON.stringify([].concat((memory && memory.creed) || []));
    const creedChanged = creedNow !== (m.creedSeen ?? '[]');
    // R8: in tools mode the briefing is told so (its system text then drops the JSON reply format), and an inspection's
    // page goes in a tool message, not the briefing; the JSON path's context stays exactly as it was.
    const messages = (last, inspection = null) => {
      const formatted = brief(result, memory, last, round, { delivery: { presentedSpeechIds: m.delivery || [] }, inspection, since, ...(tools ? { reply: 'tools' } : {}), ...(creedChanged ? { creedChanged } : {}) });
      presentation = Array.isArray(formatted) ? null : formatted;
      return presentation ? presentation.messages : formatted;
    };
    const body = {
      ...(model === undefined ? {} : { model }), messages: messages(present(deal, prior)),
      ...(tools ? { tools: toolDefinitions(), tool_choice: toolChoice(thinking, lock, dayToolChoice, api) } : { response_format: { type: 'json_object' } }), ...APIS[api]({ thinking, provider, model }),
      ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }), ...(temperature === undefined ? {} : { temperature }),
    };
    const info = { seat: id, day: view.day, round, view, deal };
    const results = [], attempts = [], resultDeals = [];
    let rememberFrom = 0, clearPending = false;
    ctx.afterAction = () => {
      if (!currentView) return false;
      const fresh = currentView();
      const taken = clearIn(fresh, id);
      if (taken === null || taken === m.cleared) return false;
      Object.assign(m, { cleared: taken, pick: null, ownerPick: null, last: [], feedback: [], delivery: [], tries: {} });
      ctx.tries = m.tries;
      memory = null;
      clearPending = true;
      return true;
    };
    let play = null, origin = null, pick = null, why = null;
    let inspecting = false;
    if (lock && m.ownerPick?.day === view.day) {
      play = m.ownerPick.play;
      origin = 'owner';
      const validation = validatePlay ? validatePlay(play) : { ok: true };
      results.push({ act: 'play', ok: validation.ok, status: 'intent', source: 'owner', play: present(deal, play), origin, pendingCore: true, validation: { ok: validation.ok, ...(validation.ok ? {} : { why: validation.why, kind: validation.kind }) }, ...(validation.ok ? {} : { why: validation.why, kind: validation.kind, code: 'rules' }) });
    }
    // The call, and its retry: the same briefing, one more message naming the failure.
    for (let i = 0; i <= N['gap.retry'] && origin === null; i++) {
      if (m.today >= N.callCeiling) {
        attempts.push({ call: null, outcome: 'ceiling' });
        results.push(failed('ceiling', `no more calls today: the ceiling is ${N.callCeiling}`));
        break;
      }
      const again = () => ({ role: 'user', content: tools ? `Your last reply failed: ${why}. Reply again by calling the tools${lock ? ", with tonight's play" : ''}.`
        : `Your last reply failed: ${why}. Reply again with one JSON object, {"actions": [...]}${lock ? ", with tonight's play" : ''}.` });
      const got = await request(i && !inspecting ? { ...body, messages: [...body.messages, again()] } : body, info, presentation, !lock);
      inspecting = false;
      why = null;
      // Each attempt that didn't answer says why, typed, once: in the tools' results (a reply that isn't a list of
      // actions, a refused play) or here.
      const beforeResults = results.length;
      const attemptDeal = deal;
      let inspection = null;
      if (got.value === undefined) {
        why = got.why;
        results.push(failed(got.outcome, why));
      } else {
        const out = reply(got.value, ctx);
        if (out.forgetBefore !== undefined) rememberFrom = results.length + out.forgetBefore;
        results.push(...out.results);
        const refused = out.results.slice(out.forgetBefore || 0).find(r => r.act === 'play' && !r.ok);
        if (out.inspection?.ok) {
          inspection = out.results[0];
          if (i >= N['gap.retry']) results.push(failed('inspection-budget', 'the inspection used the last request at this call point; no continuation remains'));
        } else if (out.inspection) why = out.results[0]?.why || 'inspection was refused';
        else if (out.results.length === 1 && out.results[0].code === 'malformed') why = out.results[0].why;
        else if (lock && !out.play && refused) why = `tonight's play was refused: ${refused.why}`;
        else if (lock && !out.play) {
          why = { reply: 'it had no play for tonight', cutoff: "it was cut off before tonight's play" }[got.outcome] || (tools ? `${got.why}, and no play in it was whole` : "it wasn't one JSON object, and no play in it was whole");
          results.push(failed('no-play', why));
        } else {
          // A reply cut off, or with words around it, read up to its last whole action, answers, and says so.
          if (got.outcome !== 'reply') results.push(failed(got.outcome, tools ? `${got.why}: only its whole tool calls were read` : `${got.outcome === 'cutoff' ? 'it was cut off' : "it wasn't one JSON object"}: only its whole actions were read`));
          origin = 'model';
          if (lock) play = out.play;
          else if (out.play) pick = m.pick = out.play;
        }
      }
      attempts.push({ call: got.call, outcome: got.outcome, ...(why ? { why } : {}), actions: results.slice(beforeResults).filter(r => r.source).map(({ act, ok, source, status, code }) => ({ act, ok, source, status, ...(code ? { code } : {}) })) });
      for (let at = beforeResults; at < results.length; at++) resultDeals[at] = attemptDeal;
      if (inspection && i < N['gap.retry']) {
        // A read-before-act continuation is a new authoritative read with fresh handles. Re-run only the read;
        // presenting new copies through the old deal would irreversibly replace them with [piece].
        view = currentView ? currentView() : view;
        const taken = clearIn(view, id);
        if (taken !== null && taken !== m.cleared) {
          Object.assign(m, { cleared: taken, pick: null, ownerPick: null, last: [], feedback: [], delivery: [], tries: {} });
          rememberFrom = results.length;
        }
        memory = Object.hasOwn(view.me, 'memory') ? view.me.memory : memory;
        ({ deal, result } = read(view, { audience: 'seat', seed: secret, from: m.next }));
        m.next = deal.next;
        Object.assign(ctx, { deal, tries: m.tries, legal: view.legal, actions: view.me.actions });
        const { section, mode, with: counterpart, sitdown, offset } = inspection.lookup;
        const evidence = act({ act: 'lookup', section, mode, ...(counterpart ? { with: counterpart } : {}), ...(sitdown ? { sitdown } : {}), offset }, ctx);
        results[beforeResults] = evidence;
        resultDeals[beforeResults] = deal;
        if (clearPending) rememberFrom = beforeResults;
        if (tools) {
          // R8: the fresh briefing quotes the words the page holds in its speech block, and the page itself, typed,
          // answers the call that asked for it: every call of the reply is answered, the rest by their refusals.
          // An inspection is its reply's one action, so one call asked for the page; any other was a broken call.
          const answered = got.calls.map((c, i) => ({ ...c, id: typeof c?.id === 'string' && c.id ? c.id : `call_${i + 1}` }));
          body.messages = [...messages([], evidence), { role: 'assistant', content: null, tool_calls: answered },
            ...answered.map((c, i) => ({ role: 'tool', tool_call_id: c.id, content: toolJSON(i === got.at[0] ? splitWords(evidence).typed : failed('malformed', "its arguments weren't one JSON object")) }))];
        } else body.messages = messages([evidence], evidence);
        Object.assign(info, { view, deal });
        inspecting = true;
        clearPending = false;
      }
      if (clearPending && origin === null) {
        // A retry is a new read after CLEAR. The earlier successful errands are never resubmitted.
        view = currentView();
        ({ deal, result } = read(view, { audience: 'seat', seed: secret, from: m.next }));
        m.next = deal.next;
        Object.assign(ctx, { deal, legal: view.legal, actions: view.me.actions });
        const learned = results.slice(rememberFrom).map((r, i) => presentBack(r, resultDeals[rememberFrom + i] || attemptDeal));
        body.messages = messages(present(deal, learned));
        Object.assign(info, { view, deal });
        clearPending = false;
      }
    }
    // Nobody answered: at the lock tonight's pick (§17: "your agent's pick plays"), then standing orders, then the
    // core's default play; by day standing orders' errands, or nothing. Each through the tools, as a reply would be.
    const fallback = (from, x) => {
      const out = reply({ actions: actionsOf(x, deal) }, ctx);
      results.push(...out.results.map(r => (r.act === 'play' && r.ok ? { ...r, origin: from } : r)));
      if (lock && !out.play) return;
      origin = from;
      play = lock ? out.play : null;
    };
    if (origin === null && lock && m.pick) fallback('model', { play: m.pick });
    if (origin === null) {
      const o = orders(view, round, defaultPlay);
      if (o?.unfulfilled) results.push({ act: 'orders', ok: false, source: 'orders', status: 'unavailable', code: 'orders', kind: 'not-yet', why: o.reason });
      else if (o) fallback('orders', o);
    }
    if (origin === null) {
      origin = 'default';
      if (lock) {
        play = defaultPlay;
        results.push({ act: 'play', ok: true, play: present(deal, play), origin });
      }
    }
    if (lock) { m.pick = null; m.ownerPick = null; }
    if (creedChanged && attempts.some(a => a.call !== null)) m.creedSeen = creedNow;
    // What the next briefing shows: these results, their pieces kept by copy until that briefing's deal names them.
    m.last = results.slice(rememberFrom).map((r, i) => presentBack(r, resultDeals[rememberFrom + i] || deal));
    // Bounded mechanical feedback only: no plans, private journal or extra message history. CLEAR erases it above.
    const typedFeedback = x => Array.isArray(x) ? x.map(typedFeedback) : x && typeof x === 'object'
      ? Object.fromEntries(Object.entries(x).filter(([k]) => !WORDS.has(k)).map(([k, v]) => [k, typedFeedback(v)])) : x;
    for (const r of m.last.filter(r => r.act !== 'play' && r.act !== 'read' && r.act !== 'lookup')) {
      m.feedback = m.feedback.filter(old => !(old.act === r.act && (old.action && r.action
        ? JSON.stringify(old.action) === JSON.stringify(r.action)
        : !r.ok && !old.ok && old.code === r.code && old.why === r.why)));
      m.feedback.push({ ...typedFeedback(r), day: view.day });
    }
    m.feedback = m.feedback.slice(-12);
    // The record keeps who answered and what was played, never the words.
    const typed = p => (p ? Object.fromEntries(Object.entries(p).filter(([k]) => !WORDS.has(k))) : null);
    record.push({ day: view.day, round, origin, play: lock ? typed(play) : null, ...(pick ? { pick: typed(pick) } : {}), attempts });
    return { results, play: lock ? play : null, origin, outcome: attempts.at(-1)?.outcome || 'owner', calls: attempts.filter(a => a.call !== null).length };
  }

  // R9b, the dawn journal (journal.mjs): the day's ordinary briefing with the same system text, and the task line
  // below it; one request, with no retry, under the day's ceiling (§18: the morning report is one of the 14). The
  // reply's text is the entry, and any tool call in it is ignored: the request offers the tools (so a provider's cache
  // holds) with tool_choice "none". Nothing at dawn acts: no errand, no play; the last call's results, the bounded
  // feedback, the day's pick and the quotes' delivery record stay for the day's first call, which starts the day as it
  // always has. The record gets
  // an entry with round 'dawn', so the calls, the ceiling and the use count it.
  // -> { text: the reply's text ('' with none), outcome, calls }
  async function dawnPoint({ view }) {
    if (!view || !view.me || view.me.id !== id) throw new Error(`seat ${id} reads only its own agent's view`);
    const memory = Object.hasOwn(view.me, 'memory') ? view.me.memory : null;
    if (m.day !== view.day) Object.assign(m, { day: view.day, today: 0, pick: null, ownerPick: null, lockDay: null });
    clearMet(view);
    if (m.today >= N.callCeiling) {
      record.push({ day: view.day, round: 'dawn', origin: 'default', play: null, attempts: [{ call: null, outcome: 'ceiling' }] });
      return { text: '', outcome: 'ceiling', calls: 0 };
    }
    const { deal, result } = read(view, { audience: 'seat', seed: secret, from: m.next });
    m.next = deal.next;
    const prior = priorResults(m.feedback.filter(r => r.day >= view.day - 2));
    // The task goes as its own message, with no separator in any message's text, so the briefing reserves its exact
    // length (briefing.mjs `reserve`): the briefing and the task together stay inside gap.briefing's characters.
    const task = dawnTask(view.day);
    const formatted = brief(result, memory, present(deal, prior), 'dawn', { delivery: { presentedSpeechIds: m.delivery || [] }, reserve: task.length, since: Number.isInteger(m.seen) ? m.seen : -1, ...(tools ? { reply: 'tools' } : {}) });
    const presentation = Array.isArray(formatted) ? null : formatted;
    const body = {
      ...(model === undefined ? {} : { model }), messages: [...(presentation ? presentation.messages : formatted), { role: 'user', content: task }],
      ...(tools ? { tools: toolDefinitions(), tool_choice: 'none' } : {}), ...APIS[api]({ thinking, provider, model }),
      ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }), ...(temperature === undefined ? {} : { temperature }),
    };
    const got = await request(body, { seat: id, day: view.day, round: 'dawn', view, deal }, presentation, false, { readReply: dawnReply, delivers: false });
    const text = typeof got.text === 'string' ? got.text : '';
    record.push({ day: view.day, round: 'dawn', origin: text.trim() ? 'model' : 'default', play: null, attempts: [{ call: got.call, outcome: got.outcome, ...(got.why ? { why: got.why } : {}), actions: [] }] });
    return { text, outcome: got.outcome, calls: 1 };
  }

  return {
    id,
    memo: m,
    record,
    async dawn(input = {}) {
      if (busy) throw new Error(`seat ${id}: one call at a time`);
      busy = true;
      try {
        return await dawnPoint(input);
      } finally {
        busy = false;
      }
    },
    tape: () => lines.map(l => `${l}\n`).join(''),
    // Trusted human controller boundary: never a model/ownerAI action, and never serialized source authority.
    ownerPick({ deal, action, validatePlay } = {}) {
      if (locking || deal && m.lockDay === deal.day) return { results: [{ act: 'play', ok: false, status: 'refused', source: 'owner', code: 'lock', kind: 'not-yet', why: 'the lock is underway or closed for this day; human picks resume next day' }], play: null };
      if (!deal || deal.audience !== 'seat' || deal.view?.me?.id !== id || typeof validatePlay !== 'function') throw new Error('a human pick needs its own dealt view and current core validator');
      if (action?.act !== 'play' || m.day !== null && deal.day < m.day) return { results: [{ act: 'play', ok: false, status: 'refused', source: 'owner', code: 'field', kind: 'not-yet', why: 'pick one play from a current-day read' }], play: null };
      const clear = clearIn(deal.view, id);
      if (clear !== null && clear !== m.cleared) Object.assign(m, { cleared: clear, pick: null, ownerPick: null, last: [], feedback: [], delivery: [], tries: {} });
      const out = reply(action, { deal, validatePlay, tries: {} });
      if (out.play) {
        if (m.day !== deal.day) Object.assign(m, { day: deal.day, today: 0, pick: null, ownerPick: null, lockDay: null });
        m.ownerPick = { day: deal.day, play: out.play };
        m.next = Math.max(m.next, deal.next);
      }
      return out;
    },
    async call(input = {}) {
      if (busy) throw new Error(`seat ${id}: one call at a time`);
      busy = true;
      locking = input.round === 'lock';
      try {
        return await callPoint(input);
      } finally {
        busy = false;
        locking = false;
      }
    },
  };
}
