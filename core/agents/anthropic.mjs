// The Claude API, direct (R8c): the transport the runner hands a seat whose API is `claude` (--model-api claude, or a
// --seat-models group's "api": "claude"), so a Claude seat spends slime's Anthropic API credits and touches neither
// OpenRouter nor his Claude Code limits. The API is named `claude`, Anthropic's own name for it ("the Claude API");
// `anthropic` stays an API the runner doesn't know, as R2-12's checks require.
// - Only the transport changes: the seat builds the request it builds for every API (the system and user messages, the
//   tools, tool_choice, the inspection's continuation as an assistant tool call and a `tool` message), with the
//   Messages API's own thinking fields beside them (claudeFields). messagesBody() turns it into a Messages body, and
//   chatOf() turns the reply back into the chat reply the seat reads, so the rules, refusals and records are the
//   OpenRouter path's. The native Messages API (POST /v1/messages), never the OpenAI-compatible layer, which Anthropic
//   says supports no prompt caching and is "not considered a long-term or production-ready solution".
// - The body: the system text as a top-level `system` array (the seat's cache-marked fixed part keeps its
//   cache_control); the tools with `input_schema`; tool_choice as asked ("auto" from a Claude seat: Sonnet 5.5, Opus
//   5.5 and Fable 5.1 refuse forced tool use with a 400); an assistant's tool calls as `tool_use` blocks and a `tool`
//   message as a `tool_result` block in the user turn after it. No temperature or top_p (the Claude 5 models refuse a
//   non-default one), and none of OpenRouter's or the local model's fields. JSON replies go as plain text: the Messages
//   API has no json_object mode, and the seat reads the reply's text as it reads any other.
// - Thinking (Anthropic's thinking and errors pages, read 10-19): on Claude 5 models it is on by default and
//   budget_tokens is refused. A thinking seat sends adaptive thinking at effort high (R9, 10-19: at medium, Sonnet 5.5
//   reasoned on 3 of 31 calls; the effort levels low, medium, high, xhigh and max, and Sonnet 5.5's default of high,
//   are from the claude-api reference read 10-19, not from a call); a plain one turns it off where
//   the model can (Sonnet 5.5: between_tools; Haiku 5.5: disabled) and, where it can't (Opus 5.5), asks for effort
//   low. max_tokens caps the whole output, thinking included: 6000 for a thinking seat, 2000 for a plain one, as on
//   OpenRouter. Thinking tokens bill as output.
// - A reply's thinking blocks are not sent back: the seat's continuation is a fresh briefing, so the prefix they were
//   made in has changed, and Anthropic's documented recovery for that is to strip them (a replayed block bound to
//   another prefix is a 400 for accounts made on or after 2026-08-31).
// - The key, read once from its file (openrouter.mjs's readKey), goes on each request as `x-api-key`, with
//   `anthropic-version: 2023-06-01`, and nowhere else: not the seat, the tape, the checkpoint or any error.
// - The spend: the API returns usage, not cost, so each call is priced from PRICES (Anthropic's pricing page, read
//   10-19). Every response that carries usage counts. There is no balance to read first (OpenRouter's /credits): the
//   Console workspace's spend limit is the hard stop, and the run says so.
// - The errors: a 429 or a 529 (overloaded) waits its retry-after, or 6, 12 then 18 s without one, and asks again, up
//   to 3 times, inside the seat's window; a 401 or a 403 stops the season as a bad key; a 402, a 400 that says the
//   credit balance is too low or a spend limit is reached, and the tier spend-cap 429 (error_code
//   enforced_spend_limit_reached, no retry-after) stop it as out of credit, with no retry. Any other error goes to the
//   seat as it came, typed (its error.type) in the spend record.
// const paid = claudeApi({ fetch, key, maxCost, clock, spent, tally, onCall, onHalt }): openRouter()'s shape and
// options (openrouter.mjs), and `tally`, a { cost, calls } shared with the season's other transports so one cap counts
// them all. -> { fetch, spend, maxCost, halted }.
import os from 'node:os';
import path from 'node:path';
import { SEAT_HEADER, CALL_HEADER } from './fake-model.mjs';

// The seat's and the runner's name for this API.
export const CLAUDE = 'claude';
export const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
export const MESSAGES_PATH = '/v1/messages';
export const CLAUDE_VERSION = '2023-06-01';
// Where the key is read from when --model-key-file doesn't say.
export const CLAUDE_KEY_FILE = path.join(os.homedir(), '.config', 'anthropic', 'key');
export const CLAUDE_NOTE = "the Claude API has no balance to read: the Console workspace's spend limit is the hard stop, and --max-cost is this run's own tally of its priced calls";

// Dollars a million tokens (platform.claude.com/docs/en/about-claude/pricing, read 10-19): base input, 5-minute cache
// write, 1-hour cache write, cache hit, output. Haiku 5.5 costs more once a request's prompt (its input, cache writes
// and cache reads together) is over 100,000 tokens. A model not here has no price, and a season refuses to start it.
export const PRICES = {
  'claude-sonnet-5-5': { in: 2, write: 2.5, write1h: 4, read: 0.1, out: 10 },
  'claude-opus-5-5': { in: 4, write: 5, write1h: 8, read: 0.2, out: 20 },
  'claude-haiku-5-5': { in: 0.1, write: 0.125, write1h: 0.2, read: 0.01, out: 0.5, over: { prompt: 100000, in: 0.5, write: 0.625, write1h: 1, read: 0.05, out: 2.5 } },
};
const count = x => (Number.isFinite(x) && x >= 0 ? x : 0);
// A call's price in dollars from its usage, or null for a model with no price or a reply with no usage.
export function priceOf(model, usage) {
  const p = typeof model === 'string' && Object.hasOwn(PRICES, model) ? PRICES[model] : null;
  if (!p || !usage || typeof usage !== 'object') return null;
  const input = count(usage.input_tokens), read = count(usage.cache_read_input_tokens), out = count(usage.output_tokens);
  const written = count(usage.cache_creation_input_tokens);
  const hour = Math.min(written, count(usage.cache_creation?.ephemeral_1h_input_tokens));
  const rate = p.over && input + read + written > p.over.prompt ? p.over : p;
  return (input * rate.in + (written - hour) * rate.write + hour * rate.write1h + read * rate.read + out * rate.out) / 1e6;
}

// The thinking fields by model and the seat's flag. Claude 5 models think unless told otherwise; Sonnet 5.5 turns it
// off with between_tools, Haiku 5.5 with disabled, and Opus 5.5 can't, so its plain seat asks for the least.
export const CLAUDE_THINKING = {
  on: { thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, maxTokens: 6000 },
  off: {
    'claude-sonnet-5-5': { thinking: { type: 'between_tools' } },
    'claude-haiku-5-5': { thinking: { type: 'disabled' } },
    'claude-opus-5-5': { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } },
  },
  plainMaxTokens: 2000,
};
// The Messages API's fields beside the briefing, for the seat (seat.mjs APIS). A plain seat of a model the table
// doesn't name asks for the least thinking every Claude 5 model takes (adaptive, effort low).
export function claudeFields({ thinking = false, model } = {}) {
  if (thinking === true) {
    const { maxTokens, ...on } = CLAUDE_THINKING.on;
    return { ...structuredClone(on), max_tokens: maxTokens };
  }
  const off = CLAUDE_THINKING.off[model] || { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };
  return { ...structuredClone(off), max_tokens: CLAUDE_THINKING.plainMaxTokens };
}

const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
const parsed = text => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
// A message's content as Messages blocks: a string as one text block, text parts as they are (cache_control kept).
const blocksOf = content => (typeof content === 'string' ? (content ? [{ type: 'text', text: content }] : [])
  : Array.isArray(content) ? content.filter(p => isObject(p) && p.type === 'text').map(p => ({ type: 'text', text: p.text, ...(p.cache_control ? { cache_control: p.cache_control } : {}) })) : []);
const CHOICES = { auto: { type: 'auto' }, required: { type: 'any' }, none: { type: 'none' } };

// A seat's chat request as a Messages body. Its system messages become the top-level `system`; an assistant's tool
// calls `tool_use` blocks (arguments that aren't one JSON object go as an empty input: the seat answers such a call
// as malformed); a `tool` message a `tool_result` in the user turn after it; turns of one role in a row are one turn.
export function messagesBody(chat) {
  const system = [];
  const turns = [];
  const add = (role, content) => {
    const last = turns.at(-1);
    if (last && last.role === role) {
      last.content = [...(typeof last.content === 'string' ? blocksOf(last.content) : last.content), ...(typeof content === 'string' ? blocksOf(content) : content)];
    } else turns.push({ role, content });
  };
  for (const m of Array.isArray(chat.messages) ? chat.messages : []) {
    if (!isObject(m)) continue;
    if (m.role === 'system') system.push(...blocksOf(m.content));
    else if (m.role === 'tool') add('user', [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]);
    else if (m.role === 'assistant') {
      const calls = (Array.isArray(m.tool_calls) ? m.tool_calls : []).map(c => {
        const input = typeof c?.function?.arguments === 'string' ? parsed(c.function.arguments) : c?.function?.arguments;
        return { type: 'tool_use', id: c.id, name: c?.function?.name, input: isObject(input) ? input : {} };
      });
      const content = [...blocksOf(m.content), ...calls];
      if (content.length) add('assistant', content);
    } else add('user', typeof m.content === 'string' ? m.content : blocksOf(m.content));
  }
  const tools = Array.isArray(chat.tools) ? chat.tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) : null;
  const choice = typeof chat.tool_choice === 'string' ? CHOICES[chat.tool_choice] : isObject(chat.tool_choice) ? chat.tool_choice : null;
  return {
    model: chat.model, max_tokens: Number.isInteger(chat.max_tokens) ? chat.max_tokens : CLAUDE_THINKING.plainMaxTokens,
    ...(system.length ? { system } : {}), messages: turns,
    ...(tools && tools.length ? { tools, ...(choice ? { tool_choice: structuredClone(choice) } : {}) } : {}),
    ...(isObject(chat.thinking) ? { thinking: chat.thinking } : {}), ...(isObject(chat.output_config) ? { output_config: chat.output_config } : {}),
  };
}

const FINISH = { end_turn: 'stop', stop_sequence: 'stop', tool_use: 'tool_calls', max_tokens: 'length' };
// A Messages reply as the chat reply the seat reads: its text, its tool_use blocks as tool calls (the arguments the
// input as JSON), its stop reason as a finish reason, and the usage as OpenRouter's (the whole prompt in, the cached
// and written parts, thinking inside output) with the call's cost. Thinking blocks stay out (see the top).
export function chatOf(msg, cost = null) {
  const content = Array.isArray(msg.content) ? msg.content : [];
  const text = content.filter(b => b && b.type === 'text').map(b => b.text).join('');
  const calls = content.filter(b => b && b.type === 'tool_use').map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input ?? {}) } }));
  const u = isObject(msg.usage) ? msg.usage : {};
  const prompt = count(u.input_tokens) + count(u.cache_creation_input_tokens) + count(u.cache_read_input_tokens);
  const thought = u.output_tokens_details?.thinking_tokens;
  return {
    id: msg.id, object: 'chat.completion', model: msg.model,
    choices: [{ index: 0, message: calls.length ? { role: 'assistant', content: text || null, tool_calls: calls } : { role: 'assistant', content: text }, finish_reason: FINISH[msg.stop_reason] ?? msg.stop_reason ?? null }],
    usage: {
      prompt_tokens: prompt, completion_tokens: count(u.output_tokens), total_tokens: prompt + count(u.output_tokens),
      prompt_tokens_details: { cached_tokens: count(u.cache_read_input_tokens), cache_write_tokens: count(u.cache_creation_input_tokens) },
      completion_tokens_details: { reasoning_tokens: Number.isFinite(thought) ? thought : null }, cost,
    },
  };
}

// The Messages API's counts, as the spend record keeps them.
const usageOf = u => ({
  input_tokens: count(u.input_tokens), cache_creation_input_tokens: count(u.cache_creation_input_tokens),
  cache_read_input_tokens: count(u.cache_read_input_tokens), output_tokens: count(u.output_tokens),
});
// The waits after a 429 or 529 with no retry-after, in seconds, one a try (openrouter.mjs's).
export const CLAUDE_WAITS = [6, 12, 18];
const REAL_CLOCK = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
// The words Anthropic's errors use when the money has run out (its errors and rate-limits pages, read 10-19).
const OUT_OF_CREDIT = /credit balance is too low|reached your specified (workspace )?API usage limits/i;

export function claudeApi({ fetch: send, key, maxCost, clock = REAL_CLOCK, spent = {}, tally = null, onCall = null, onHalt = null } = {}) {
  if (typeof send !== 'function') throw new Error('the Claude transport calls through the fetch passed in: there is no default');
  if (typeof key !== 'string' || !key) throw new Error('the Claude transport needs the key');
  if (!(Number.isFinite(maxCost) && maxCost > 0)) throw new Error('the Claude transport needs the cap, in dollars');
  const spend = tally || { cost: spent.cost || 0, calls: spent.calls || 0 };
  let halted = null;
  const hide = s => String(s).split(key).join('[key]');
  const clean = e => {
    const cause = e && e.cause && e.cause.message ? `: ${e.cause.message}` : '';
    return Object.assign(new Error(hide(`${e && e.message !== undefined ? e.message : e}${cause}`)), { name: (e && e.name) || 'Error' });
  };
  // The request as it goes out: the Messages body, the key and the version on a copy of the headers.
  const outgoing = (init, body) => {
    const headers = new Headers(init.headers);
    headers.delete('authorization');
    headers.set('x-api-key', key);
    headers.set('anthropic-version', CLAUDE_VERSION);
    headers.set('content-type', 'application/json');
    return { ...init, headers, body };
  };
  const halt = (kind, why) => {
    if (!halted) halted = Object.assign(new Error(hide(why)), { halt: kind });
  };
  const wait = (ms, signal) => new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(signal.reason);
    const stop = () => {
      clock.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = clock.setTimeout(() => {
      if (signal) signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    if (signal) signal.addEventListener('abort', stop, { once: true });
  });

  async function messages(url, init = {}) {
    const asked = new Headers(init.headers);
    const seat = asked.get(SEAT_HEADER);
    const call = Number(asked.get(CALL_HEADER)) || null;
    const chat = parsed(typeof init.body === 'string' ? init.body : '');
    if (!isObject(chat)) throw new Error("the seat's request isn't one JSON object");
    const model = typeof chat.model === 'string' ? chat.model : null;
    const body = JSON.stringify(messagesBody(chat));
    for (let n = 1; ; n++) {
      // The cap, counted with the season's other transports, and nothing more once stopped.
      if (!halted && spend.cost >= maxCost) halt('cap', `the spend reached the cap: $${spend.cost.toFixed(4)} of $${maxCost} after ${spend.calls} calls`);
      if (halted) {
        if (onHalt) onHalt(halted);
        throw new Error(`no paid call once the season has stopped: ${halted.message}`);
      }
      if (init.signal && init.signal.aborted) throw clean(init.signal.reason);
      const start = clock.now();
      let res, text;
      try {
        res = await send(url, outgoing(init, body));
        text = hide(await res.text());
      } catch (e) {
        spend.calls += 1;
        if (onCall) onCall({ seat, call, try: n, status: null, finish: null, cost: null, provider: 'anthropic', model, tokens: null, ms: clock.now() - start, why: init.signal && init.signal.aborted ? 'aborted' : 'failed' });
        throw clean(e);
      }
      const reply = parsed(text);
      const usage = isObject(reply) && isObject(reply.usage) ? reply.usage : null;
      const cost = usage ? priceOf(model, usage) : null;
      const error = isObject(reply) && isObject(reply.error) ? reply.error : null;
      const said = error && typeof error.message === 'string' ? error.message.slice(0, 200) : '';
      const header = res.headers.get('retry-after');
      const after = header === null || header.trim() === '' ? NaN : Number(header);
      spend.calls += 1;
      if (cost !== null) spend.cost += cost;
      if (onCall) {
        onCall({
          seat, call, try: n, status: res.status, finish: (isObject(reply) && reply.stop_reason) ?? null, cost, provider: 'anthropic', model,
          tokens: usage ? {
            in: count(usage.input_tokens) + count(usage.cache_creation_input_tokens) + count(usage.cache_read_input_tokens), out: count(usage.output_tokens),
            reasoning: Number.isFinite(usage.output_tokens_details?.thinking_tokens) ? usage.output_tokens_details.thinking_tokens : null,
            cached: count(usage.cache_read_input_tokens), cacheWrite: count(usage.cache_creation_input_tokens),
          } : null,
          ...(usage ? { usage: usageOf(usage) } : {}),
          ...(error ? { error: { type: typeof error.type === 'string' ? error.type : null, message: said, ...(error.details?.error_code ? { code: error.details.error_code } : {}) } } : {}),
          ms: clock.now() - start,
        });
      }
      const status = res.status;
      if (status === 401 || status === 403) halt('key', `the Claude API refused the key (${status}${said ? `: ${said}` : ''})`);
      else if (status === 402 || (status === 400 && OUT_OF_CREDIT.test(said)) || (status === 429 && error?.details?.error_code === 'enforced_spend_limit_reached')) {
        halt('credit', `the Claude API account is out of credit or at its spend limit (${status}${said ? `: ${said}` : ''})`);
      }
      if (spend.cost >= maxCost) halt('cap', `the spend reached the cap: $${spend.cost.toFixed(4)} of $${maxCost} after ${spend.calls} calls`);
      if ((status === 429 || status === 529) && !halted && n <= CLAUDE_WAITS.length) {
        try {
          await wait((Number.isFinite(after) && after >= 0 ? after : CLAUDE_WAITS[n - 1]) * 1000, init.signal);
        } catch (e) {
          throw clean(e);
        }
        continue;
      }
      if (status === 200 && isObject(reply) && reply.type === 'message') return new Response(JSON.stringify(chatOf(reply, cost)), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(text, { status, statusText: res.statusText });
    }
  }

  return {
    fetch: messages, spend, maxCost,
    get halted() {
      return halted;
    },
  };
}
