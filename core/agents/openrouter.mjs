// The paid endpoint (R2-12): the fetch the runner hands the seats when a season calls OpenRouter, or any endpoint that
// takes a key and bills its calls, so a cloud model can play the season the local model played. Only the transport
// changes: the seat builds the same messages and adds OpenRouter's fields beside them (openRouterFields).
// - The key is read once from its file (readKey) and added here, to each request as it goes out, as
//   `authorization: Bearer <key>`: on the chat calls and the preflight's GETs, nowhere else. The seat, the tape, the
//   checkpoint and the config never hold it, and no error, reply or message that leaves here carries it.
// - The spend: every response that carries `usage.cost` counts, a cut-off's and an error body's too (sim2's counter
//   counted only the replies that parsed, and missed about a third of a bill). Once the tally reaches the cap the
//   season must stop: `halted` says why, and no request goes out after it.
// - The errors: a 402, or an error that names credits, stops the season (run 32 ran the account dry mid-city while the
//   key's own limit showed $40 left); a 401 or a 403 stops it as a bad key; a 429 waits 6, 12, then 18 s on the clock
//   passed in and asks again, up to 3 times (single-provider models got 429s), inside the seat's window. Anything else
//   goes to the seat as it came, and the seat's own handling (its window, its retry, its fallbacks) takes it from
//   there.
// - The preflight (OpenRouter's): the account's balance and the key's limit left, two free GETs at the endpoint's
//   origin, before the first call; and the key's usage, read again at the end, for what the run was billed, calls whose
//   reply never came back included.
// const paid = openRouter({ fetch, key, maxCost, clock, spent, onCall, onHalt })
//   fetch    fetch's shape, passed in: the real one, or a fake's
//   maxCost  the cap, in dollars; spent: { cost, calls } so far, a resumed season's (spentIn its run folder's record)
//   clock    { now, setTimeout, clearTimeout }: the real one by default, or the fake's manualClock() in tests
//   onCall   (record) -> void, as each request ends: { seat, call, try, status, finish, cost, provider, model, tokens:
//            { in, out, reasoning, cached, cacheWrite }, ms }, and `why` ('aborted' or 'failed') for one that got no response
//   onHalt   (reason) -> void, when a request is refused because the season has stopped: the runner stops it now
//   tally    R8c: a { cost, calls } shared with the season's other transports (anthropic.mjs), so one cap counts every
//            endpoint's calls; with one, a request also checks the cap before it goes out
// -> { fetch, preflight(url), keyUsage(url), spend: { cost, calls }, maxCost, halted }: `halted` is null, or an Error
//    whose `halt` is 'cap', 'credit' or 'key'; preflight gives { balance, left, usage, refused }, `refused` the reason
//    it won't start or null, and keyUsage the key's usage in dollars, or null when it can't be read.
import fs from 'node:fs';
import { SEAT_HEADER, CALL_HEADER } from './fake-model.mjs';

export const OPENROUTER = {
  // Run 32 sent max_tokens 6000 with a 1024-token reasoning budget: 0 of 488 and 0 of 219 calls failed on two
  // models, 7 of 168 on a third (6 timeouts, 1 cut-off). Smaller budgets cut off 24-26% of thinking calls, and a
  // cut-off is billed.
  thinking: { reasoning: { max_tokens: 1024 }, maxTokens: 6000 },
  plain: { reasoning: { enabled: false }, maxTokens: 2000 },
  // The waits after a 429, in seconds, one a try: they fixed sim2's single-provider models.
  waits: [6, 12, 18],
  // How long a preflight GET may take, in seconds.
  check: 30,
};
// OpenRouter's paths for the account's credits and the key's limit and usage, at the endpoint's origin.
export const CREDITS_PATH = '/api/v1/credits';
export const KEY_PATH = '/api/v1/key';
const REAL_CLOCK = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
const parsed = text => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
const dollars = x => `$${x.toFixed(2)}`;
// Cache counters are provider-reported prompt-token details, never inferred from the bill or a missing field.
const cacheTokens = x => Number.isSafeInteger(x) && x >= 0 ? x : null;

// OpenRouter's fields beside the briefing: a reasoning budget and a cap on the reply (larger for a thinking seat), the
// call's cost in its usage, and the provider's routing only when the caller names it.
export function openRouterFields({ thinking = false, provider = null } = {}) {
  const budget = thinking === true ? OPENROUTER.thinking : OPENROUTER.plain;
  return { reasoning: { ...budget.reasoning }, max_tokens: budget.maxTokens, usage: { include: true }, ...(provider ? { provider } : {}) };
}

// R8b, prompt caching through OpenRouter (its prompt-caching docs, read 10-19): OpenAI and DeepSeek cache a repeated
// prefix by themselves; Anthropic caches only up to an explicit cache_control breakpoint in a message's content, and
// Google's Gemini needs one there too (OpenRouter uses the last). In the 10-18 seasons the OpenAI and DeepSeek seats had
// about 57% of their input cached, the Sonnet and Gemini seats none. The models whose requests need the mark, by
// OpenRouter's model id:
export const CACHE_MARKED = ['anthropic/', 'google/'];
export const needsCacheMark = model => typeof model === 'string' && CACHE_MARKED.some(p => model.startsWith(p));
// The request with its fixed prefix marked: the system message as text parts, the first the fixed text (`fixed`, the
// start of the system text) with cache_control, the rest after it unmarked. Anthropic's cache prefix runs tools, then
// system, so the tools are in it. A body whose system text doesn't start with `fixed` goes as it came.
export function cacheMarked(body, fixed) {
  const [first, ...rest] = body.messages || [];
  if (!first || first.role !== 'system' || typeof first.content !== 'string' || typeof fixed !== 'string' || !fixed || !first.content.startsWith(fixed)) return body;
  const tail = first.content.slice(fixed.length);
  const content = [{ type: 'text', text: fixed, cache_control: { type: 'ephemeral' } }, ...(tail ? [{ type: 'text', text: tail }] : [])];
  return { ...body, messages: [{ ...first, content }, ...rest] };
}

// The key in a file, read once and trimmed. One word of what a header can carry, or refused; no message names it.
export function readKey(file) {
  const key = fs.readFileSync(file, 'utf8').trim();
  if (!key) throw new Error(`the key file ${file} is empty`);
  if (!/^[\x21-\x7e]+$/.test(key)) throw new Error(`the key file ${file} holds more than one word, or a character a header can't carry`);
  return key;
}

// What a run folder's spend record adds up to: { cost, calls }. A line a kill cut short counts for nothing.
export function spentIn(file) {
  const out = { cost: 0, calls: 0 };
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = parsed(raw);
    if (!isObject(line)) continue;
    out.calls += 1;
    if (Number.isFinite(line.cost)) out.cost += line.cost;
  }
  return out;
}

export function openRouter({ fetch: send, key, maxCost, clock = REAL_CLOCK, spent = {}, tally = null, onCall = null, onHalt = null } = {}) {
  if (typeof send !== 'function') throw new Error('the paid transport calls through the fetch passed in: there is no default');
  if (typeof key !== 'string' || !key) throw new Error('the paid transport needs the key');
  if (!(Number.isFinite(maxCost) && maxCost > 0)) throw new Error('the paid transport needs the cap, in dollars');
  const spend = tally || { cost: spent.cost || 0, calls: spent.calls || 0 };
  let halted = null;
  // Text on its way out, with the key cut out wherever it turns up: a server's reply or message, a library's error.
  const hide = s => String(s).split(key).join('[key]');
  // An error on its way out: its message (and its cause's) without the key, and nothing else of the original, whose
  // stack or cause could hold the request.
  const clean = e => {
    const cause = e && e.cause && e.cause.message ? `: ${e.cause.message}` : '';
    return Object.assign(new Error(hide(`${e && e.message !== undefined ? e.message : e}${cause}`)), { name: (e && e.name) || 'Error' });
  };
  // The request with the key on it: a copy, so the caller's headers never hold it.
  const keyed = (init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${key}`);
    return { ...init, headers };
  };
  const halt = (kind, why) => {
    if (!halted) halted = Object.assign(new Error(hide(why)), { halt: kind });
  };
  const note = record => {
    if (onCall) onCall(record);
  };
  // ms on the clock, or until the signal ends the wait.
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

  // One chat call, as the seat makes it: the key added, the response read and costed, a 429 waited out, a stop noted.
  async function chat(url, init = {}) {
    const asked = new Headers(init.headers);
    const seat = asked.get(SEAT_HEADER);
    const call = Number(asked.get(CALL_HEADER)) || null;
    for (let n = 1; ; n++) {
      // R8c: a shared tally may have reached the cap through another endpoint's calls.
      if (tally && !halted && spend.cost >= maxCost) halt('cap', `the spend reached the cap: $${spend.cost.toFixed(4)} of $${maxCost} after ${spend.calls} calls`);
      // Once stopped, nothing more goes out, and the runner hears of it now.
      if (halted) {
        if (onHalt) onHalt(halted);
        throw new Error(`no paid call once the season has stopped: ${halted.message}`);
      }
      if (init.signal && init.signal.aborted) throw clean(init.signal.reason);
      const start = clock.now();
      let res, text;
      try {
        res = await send(url, keyed(init));
        text = hide(await res.text());
      } catch (e) {
        spend.calls += 1;
        note({ seat, call, try: n, status: null, finish: null, cost: null, provider: null, model: null, tokens: null, ms: clock.now() - start, why: init.signal && init.signal.aborted ? 'aborted' : 'failed' });
        throw clean(e);
      }
      const body = parsed(text);
      const usage = isObject(body) && isObject(body.usage) ? body.usage : null;
      const cost = usage && Number.isFinite(usage.cost) ? usage.cost : null;
      const choice = isObject(body) && Array.isArray(body.choices) ? body.choices[0] : null;
      spend.calls += 1;
      if (cost !== null) spend.cost += cost;
      note({
        seat, call, try: n, status: res.status, finish: (choice && choice.finish_reason) ?? null, cost,
        provider: (isObject(body) && body.provider) ?? null, model: (isObject(body) && body.model) ?? null,
        tokens: usage ? {
          in: usage.prompt_tokens ?? null, out: usage.completion_tokens ?? null,
          reasoning: (usage.completion_tokens_details && usage.completion_tokens_details.reasoning_tokens) ?? null,
          cached: cacheTokens(usage.prompt_tokens_details?.cached_tokens),
          cacheWrite: cacheTokens(usage.prompt_tokens_details?.cache_write_tokens),
        } : null,
        ms: clock.now() - start,
      });
      // OpenRouter's error: the HTTP status, or, in a 200 (an error once the model had started), the body's own code.
      const error = isObject(body) && isObject(body.error) ? body.error : null;
      const code = res.status !== 200 ? res.status : error ? Number(error.code) || null : null;
      const said = error && typeof error.message === 'string' ? `: ${error.message.slice(0, 200)}` : '';
      if (code === 402) halt('credit', `the account is out of credit (402${said})`);
      else if (code === 401 || code === 403) halt('key', `the endpoint refused the key (${code}${said})`);
      else if (code !== 429 && error && /credit/i.test(JSON.stringify(error))) halt('credit', `the account is out of credit (${code ?? res.status}${said})`);
      if (spend.cost >= maxCost) halt('cap', `the spend reached the cap: $${spend.cost.toFixed(4)} of $${maxCost} after ${spend.calls} calls`);
      if (code === 429 && !halted && n <= OPENROUTER.waits.length) {
        try {
          await wait(OPENROUTER.waits[n - 1] * 1000, init.signal);
        } catch (e) {
          throw clean(e);
        }
        continue;
      }
      return new Response(text, { status: res.status, statusText: res.statusText });
    }
  }

  // A preflight GET at the url's origin: its data, or an error that says what came back.
  async function get(url, where) {
    const stop = new AbortController();
    const timer = clock.setTimeout(() => stop.abort(new Error(`no answer inside ${OPENROUTER.check} s`)), OPENROUTER.check * 1000);
    try {
      const res = await send(new URL(where, url).href, keyed({ method: 'GET', signal: stop.signal }));
      const body = parsed(await res.text());
      if (res.status !== 200) throw new Error(`it answered ${res.status}`);
      if (!isObject(body) || !isObject(body.data)) throw new Error('it answered without its data');
      return body.data;
    } catch (e) {
      throw clean(e);
    } finally {
      clock.clearTimeout(timer);
    }
  }

  // Before the first call: the account's balance and the key's limit left, and the key's usage now. Refused below the
  // cap, or when either can't be read.
  async function preflight(url) {
    let credits, limit;
    try {
      credits = await get(url, CREDITS_PATH);
    } catch (e) {
      return { refused: `the preflight could not read the account's balance at ${CREDITS_PATH} (${e.message}): not starting` };
    }
    try {
      limit = await get(url, KEY_PATH);
    } catch (e) {
      return { refused: `the preflight could not read the key's limit at ${KEY_PATH} (${e.message}): not starting` };
    }
    const balance = credits.total_credits - credits.total_usage;
    const left = limit.limit_remaining ?? null;
    if (!Number.isFinite(balance)) return { refused: "the preflight could not read the account's balance: not starting" };
    if (left !== null && !Number.isFinite(left)) return { refused: "the preflight could not read the key's limit: not starting" };
    const out = { balance, left, usage: Number.isFinite(limit.usage) ? limit.usage : null, refused: null };
    if (balance < maxCost) out.refused = `the account's balance, ${dollars(balance)}, is below --max-cost $${maxCost}: not starting`;
    else if (left !== null && left < maxCost) out.refused = `the key's limit left, ${dollars(left)}, is below --max-cost $${maxCost}: not starting`;
    return out;
  }

  async function keyUsage(url) {
    try {
      const data = await get(url, KEY_PATH);
      return Number.isFinite(data.usage) ? data.usage : null;
    } catch {
      return null;
    }
  }

  return {
    fetch: chat, preflight, keyUsage, spend, maxCost,
    get halted() {
      return halted;
    },
  };
}
