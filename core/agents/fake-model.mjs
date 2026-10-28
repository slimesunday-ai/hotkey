// The fake model (R2-6, $0): a stand-in for the local model's chat endpoint, so seats, the season loop and the report
// are tested with no model run. Nothing here calls a model or connects out: the in-process form never touches the
// network, and the HTTP form listens on 127.0.0.1 only, on a port the system picks (port 0).
//
// The endpoint as a seat calls it (sim2's brain.mjs): POST /v1/chat/completions with a JSON body ({ model, messages,
// response_format: { type: 'json_object' }, chat_template_kwargs: { enable_thinking: false }, ... }), plus, for the
// fake, the seat and its call number in the x-seat and x-call headers. It replies with the endpoint's JSON:
// { choices: [{ message: { content }, finish_reason }], usage: { prompt_tokens, completion_tokens, total_tokens } }.
// fakeModel({ script, tape, hooks, clock }) makes one; every option can be left out. The clock is { now, setTimeout,
// clearTimeout }: the real one by default, or manualClock(), so windows and retries are tested without waiting.
// - In-process: fake.fetch(url, init) has fetch's shape and returns a Response.
// - HTTP: const { url } = await fake.listen(), then post to url.
// - await fake.close() ends both: open calls are dropped, timers cleared, the server and its sockets closed.
// A test reads back fake.calls (every call taken: { seat, call, from: 'script', 'tape' or 'bot', fault, request,
// reply, start, ms, outcome: 'pending', 'reply' or 'none' when the caller gave up first }), fake.failures,
// fake.canaries ({ seat, call, slot, text }), fake.unused() (script entries and tape lines no call asked for) and
// fake.tape().
//
// A reply is keyed by seat and call number, never by arrival, so the order requests finish in can't change it. The
// first of these that has the call answers it:
// 1. the script: script[seat][call] (an array from call 1, or an object by call number), or script(seat, call);
// 2. the tape: its line for that seat and call (below). A request that isn't the one on the tape is a failure;
// 3. hooks.bot(request, ctx): the seat's own bot speaking through the reply format (bot-playing).
// With none of them, the call is a failure: the fake never guesses.
// A script entry is { content } (the model's text as it is), { json } (sent as JSON), { toolCalls } (R8: the reply's
// message.tool_calls as they are, with no text), { bot: true } or { fault }, each with an optional delayMs (on the
// clock passed in), usage and finish. R8: a request that carries `tools` (a seat in tools mode) has the bot's answer,
// and a table fault's, as tool calls, which hooks.toolCalls(request, ctx) writes from ctx.value, the actions; a cut-off
// then cuts the last call's arguments. The faults:
// - malformed: text that isn't JSON (or the entry's content);
// - cutoff: the entry's content or json, or the bot's reply, cut after `at` characters (half by default), with finish
//   'length';
// - hang: no reply, until the caller gives up (its window) or the fake closes;
// - illegalPlay, unknownErrand, staleHandle and canaries: only R2-5's action table knows the reply format, so R2-7
//   fills hooks[fault](request, ctx) to build each one. Until it does, a call for one is a failure.
// A hook's request is { seat, call, body }, and its ctx { earlier: this seat's earlier request bodies, in call order;
// canary(slot): a new canary for one free-text slot, kept in fake.canaries; bot(): the bot's reply, to build on }.
//
// Failures are typed. Each goes on fake.failures as { why, seat, call, ... } and comes back as an error reply (400 for
// a request that isn't a chat call, 409 for the rest) whose error.why is one of: 'bad request', 'asked twice', 'not on
// the tape', 'differs from the tape' (with `at`: where they first differ), 'nothing scripted', 'bad script', 'needs the
// table' (with `hook`) and 'hook failed' (with `hook` and `error`).
//
// The tape: one JSON line per call, in any order; a seat and a call number name one line.
//   seat     the seat's agent id ("a07")
//   call     the seat's call number in the season, from 1; every request counts, a retry too (Q1)
//   request  the request body as sent
//   reply    { status, body }: the endpoint's status and JSON body as received; null when nothing came back inside
//            the window, and a replay then waits until the caller gives up
//   start    when the call went out, in ms on the caller's clock
//   ms       how long the call took: to the reply, or to the end of the window
//   tokens   { in, out }: the reply's usage.prompt_tokens and usage.completion_tokens, or null with no usage
// tapeLine() writes a line and readTape() reads a tape. R2-7's seat writes tapes; fake.tape() gives the calls this fake
// has ended. A replay answers at once: the timings are a record, not replayed.
import http from 'node:http';

export const CHAT_PATH = '/v1/chat/completions';
export const SEAT_HEADER = 'x-seat';
export const CALL_HEADER = 'x-call';
export const FAULTS = ['malformed', 'cutoff', 'hang', 'illegalPlay', 'unknownErrand', 'staleHandle', 'canaries'];
// The faults only the action table can build.
const TABLE_FAULTS = FAULTS.slice(3);
const MALFORMED = '{ this reply is not JSON }';
// A rough token count for scripted replies: R2's views measured 2.4 to 3.1 characters a token.
const CHARS_PER_TOKEN = 3;
const REAL_CLOCK = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };

// A typed failure, thrown inside the fake and answered as an error reply.
const failure = (why, more = {}) => Object.assign(new Error(`fake model: ${why}`), { failure: { why, ...more } });
const asText = out => (typeof out === 'string' ? out : JSON.stringify(out));
const tokens = s => Math.ceil(s.length / CHARS_PER_TOKEN);
const turn = () => new Promise(resolve => setImmediate(resolve));
const parseJSON = s => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

export function fakeModel({ script = {}, tape = null, hooks = {}, clock = REAL_CLOCK } = {}) {
  const taped = tape === null ? null : readTape(tape);
  const calls = [], failures = [], canaries = [], asked = new Set();
  const closing = new AbortController();
  let server = null, listening = null;

  const scripted = (seat, call) => (typeof script === 'function' ? script(seat, call)
    : Array.isArray(script[seat]) ? script[seat][call - 1] : script[seat]?.[call]);

  function fail(status, f) {
    failures.push(f);
    return { status, body: { error: { type: 'fake_model', message: `fake model: ${f.why}`, ...f } } };
  }

  async function hook(name, request, ctx) {
    if (typeof hooks[name] !== 'function') throw failure('needs the table', { hook: name });
    try {
      return await hooks[name](request, ctx);
    } catch (e) {
      throw e?.failure ? e : failure('hook failed', { hook: name, error: String(e?.message ?? e) });
    }
  }

  // What a script entry, or the bot, answers: { status, body }, or null for no reply at all.
  async function build(entry, request) {
    const { seat, call, body } = request;
    const ctx = {
      earlier: calls.filter(c => c.seat === seat && c.call < call).sort((a, b) => a.call - b.call).map(c => c.request),
      canary: slot => {
        const n = canaries.filter(c => c.seat === seat && c.call === call).length + 1;
        canaries.push({ seat, call, slot, text: `CANARY-${seat}-${call}-${n}-${slot}` });
        return canaries.at(-1).text;
      },
      bot: () => hook('bot', request, ctx),
    };
    const fault = entry?.fault;
    if (!entry || typeof entry !== 'object' || (fault !== undefined && !FAULTS.includes(fault))) throw failure('bad script');
    if (fault === 'hang') return null;
    const tools = Array.isArray(body.tools) && body.tools.length > 0;
    let content = null, toolCalls = null, value;
    if (fault === 'malformed') content = asText(entry.content ?? MALFORMED);
    else if (TABLE_FAULTS.includes(fault)) value = await hook(fault, request, ctx);
    else if (Array.isArray(entry.toolCalls)) toolCalls = entry.toolCalls;
    else if (typeof entry.content === 'string') content = entry.content;
    else if (entry.json !== undefined) content = JSON.stringify(entry.json);
    else if (entry.bot || fault === 'cutoff') value = await ctx.bot();
    else throw failure('bad script');
    if (value !== undefined) {
      // R9b: a hook's text (the dawn journal's entry) is the reply's text, in tools mode too.
      if (typeof value === 'string') content = value;
      else if (tools) toolCalls = await hook('toolCalls', request, { ...ctx, value });
      else content = asText(value);
    }
    const cut = fault === 'cutoff';
    if (cut && toolCalls) {
      const last = toolCalls.at(-1);
      const args = last ? last.function.arguments : '';
      if (last) toolCalls = [...toolCalls.slice(0, -1), { ...last, function: { ...last.function, arguments: args.slice(0, entry.at ?? Math.floor(args.length / 2)) } }];
    } else if (cut) content = content.slice(0, entry.at ?? Math.floor(content.length / 2));
    const prompt = tokens(body.messages.map(m => asText(m?.content ?? '')).join(''));
    const out = cut && Number.isInteger(body.max_tokens) ? body.max_tokens : tokens(toolCalls ? JSON.stringify(toolCalls) : content);
    const message = toolCalls ? { role: 'assistant', content: null, tool_calls: toolCalls } : { role: 'assistant', content };
    return {
      status: 200,
      body: {
        id: `chatcmpl-fake-${seat}-${call}`,
        object: 'chat.completion',
        created: Math.floor(clock.now() / 1000),
        model: typeof body.model === 'string' ? body.model : 'fake',
        choices: [{ index: 0, message, finish_reason: entry.finish ?? (cut ? 'length' : toolCalls ? 'tool_calls' : 'stop') }],
        usage: entry.usage ?? { prompt_tokens: prompt, completion_tokens: out, total_tokens: prompt + out },
      },
    };
  }

  function replayed({ seat, call, body }) {
    const line = taped.get(`${seat}#${call}`);
    if (!line) throw failure('not on the tape');
    const at = differs(line.request, body);
    if (at) throw failure('differs from the tape', { at });
    return line.reply;
  }

  // Sends the reply after delay ms on the clock, or never when there is none. The caller giving up, or the fake
  // closing, ends the wait and clears its timer.
  function deliver(rec, reply, delay, signal) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const end = outcome => {
        signal.removeEventListener('abort', stop);
        rec.outcome = outcome;
        rec.ms = clock.now() - rec.start;
      };
      const stop = () => {
        if (timer !== null) clock.clearTimeout(timer);
        end('none');
        reject(signal.reason);
      };
      const send = () => {
        rec.reply = reply;
        end('reply');
        resolve(reply);
      };
      if (signal.aborted) return stop();
      signal.addEventListener('abort', stop, { once: true });
      if (reply === null) return;
      if (delay > 0) timer = clock.setTimeout(send, delay);
      else send();
    });
  }

  // One call, in either form: { status, body } once answered, or a rejection when the caller gives up or the fake
  // closes first.
  async function answer({ method, path, seat, call: sent, text, signal }) {
    if (closing.signal.aborted) throw new Error('the fake model is closed');
    const stopped = AbortSignal.any(signal ? [signal, closing.signal] : [closing.signal]);
    if (stopped.aborted) throw stopped.reason;
    const call = Number(sent), body = parseJSON(text);
    if (method !== 'POST' || path !== CHAT_PATH || !seat || !Number.isInteger(call) || call < 1 || !Array.isArray(body?.messages)) {
      return fail(400, { why: 'bad request', seat: seat || null, call: Number.isInteger(call) && call > 0 ? call : null });
    }
    if (asked.has(`${seat}#${call}`)) return fail(409, { why: 'asked twice', seat, call });
    asked.add(`${seat}#${call}`);
    const request = { seat, call, body }, start = clock.now();
    let entry, from, reply;
    try {
      entry = scripted(seat, call);
      if (entry !== undefined) [from, reply] = ['script', await build(entry, request)];
      else if (taped) [from, reply] = ['tape', replayed(request)];
      else if (hooks.bot) [from, reply] = ['bot', await build({ bot: true }, request)];
      else throw failure('nothing scripted');
    } catch (e) {
      return fail(409, { ...(e?.failure ?? { why: 'bad script', error: String(e?.message ?? e) }), seat, call });
    }
    const rec = { seat, call, from, fault: entry?.fault ?? null, request: body, reply: null, start, ms: null, outcome: 'pending' };
    calls.push(rec);
    return deliver(rec, reply, from === 'tape' ? 0 : entry?.delayMs ?? 0, stopped);
  }

  // The in-process form: fetch's shape, and the endpoint's request and reply.
  async function fetchFake(url, init = {}) {
    const headers = new Headers(init.headers);
    const out = await answer({
      method: String(init.method ?? 'GET').toUpperCase(), path: new URL(String(url), 'http://fake.invalid').pathname,
      seat: headers.get(SEAT_HEADER), call: headers.get(CALL_HEADER), text: typeof init.body === 'string' ? init.body : '',
      signal: init.signal,
    });
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json' } });
  }

  async function onRequest(req, res) {
    const gone = new AbortController();
    res.on('close', () => gone.abort());
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const out = await answer({
        method: req.method, path: new URL(req.url, 'http://127.0.0.1').pathname, seat: req.headers[SEAT_HEADER],
        call: req.headers[CALL_HEADER], text: Buffer.concat(chunks).toString('utf8'), signal: gone.signal,
      });
      res.writeHead(out.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.body));
    } catch {
      // The caller gave up, or the fake closed: nobody is left to answer.
      res.destroy();
    }
  }

  // The HTTP form: { port, url } on 127.0.0.1, at a port the system picks.
  function listen() {
    if (closing.signal.aborted) return Promise.reject(new Error('the fake model is closed'));
    listening ??= new Promise((resolve, reject) => {
      server = http.createServer(onRequest);
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const { address, port } = server.address();
        resolve({ port, url: `http://${address}:${port}${CHAT_PATH}` });
      });
    });
    return listening;
  }

  async function close() {
    closing.abort(new Error('the fake model closed'));
    // A server still starting is closed once it has started.
    await listening?.catch(() => {});
    const open = server;
    server = null;
    if (open) await new Promise(resolve => {
      open.close(() => resolve());
      open.closeAllConnections();
    });
  }

  // The calls this fake has ended, as a tape: by seat, then call number.
  function tapeOf() {
    const ended = calls.filter(c => c.outcome !== 'pending')
      .sort((a, b) => (a.seat === b.seat ? a.call - b.call : a.seat < b.seat ? -1 : 1));
    return ended.map(c => `${tapeLine(c)}\n`).join('');
  }

  // The script's entries and the tape's lines that no call asked for.
  function unused() {
    const all = [];
    if (typeof script !== 'function') {
      for (const [seat, entries] of Object.entries(script)) {
        for (const k of Object.keys(entries)) all.push({ seat, call: Number(k) + (Array.isArray(entries) ? 1 : 0) });
      }
    }
    if (taped) for (const { seat, call } of taped.values()) all.push({ seat, call });
    const keyed = new Map(all.map(c => [`${c.seat}#${c.call}`, c]));
    return [...keyed].filter(([key]) => !asked.has(key)).map(([, c]) => c);
  }

  return { fetch: fetchFake, listen, close, tape: tapeOf, unused, calls, failures, canaries };
}

// One line of a tape, its fields in the order above, without the newline.
export function tapeLine({ seat, call, request, reply = null, start, ms }) {
  const usage = reply?.body?.usage;
  const tokens = usage ? { in: usage.prompt_tokens ?? null, out: usage.completion_tokens ?? null } : null;
  return JSON.stringify({ seat, call, request, reply, start, ms, tokens });
}

// A tape's lines by "seat#call". A line that isn't one, or a seat and call met twice, is an error naming the line.
export function readTape(tape) {
  const lines = new Map();
  String(tape).split('\n').forEach((raw, i) => {
    if (!raw.trim()) return;
    const l = parseJSON(raw);
    const ok = typeof l?.seat === 'string' && l.seat !== '' && Number.isInteger(l.call) && l.call > 0
      && Array.isArray(l.request?.messages) && (l.reply === null || (Number.isInteger(l.reply?.status) && 'body' in l.reply));
    const why = !ok ? 'bad tape line' : lines.has(`${l.seat}#${l.call}`) ? 'twice on the tape' : null;
    if (why) throw Object.assign(new Error(`fake model: ${why}, line ${i + 1}`), { why, line: i + 1 });
    lines.set(`${l.seat}#${l.call}`, l);
  });
  return lines;
}

// Where two JSON values first differ ("request.messages[1].content, character 812"), or null when they're the same.
function differs(a, b, at = 'request') {
  if (a === b) return null;
  if (typeof a === 'string' && typeof b === 'string') {
    let i = 0;
    while (a[i] === b[i]) i++;
    return `${at}, character ${i}`;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return at;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of Array.isArray(a) ? keys : keys.sort()) {
    const d = differs(a[k], b[k], Array.isArray(a) ? `${at}[${k}]` : `${at}.${k}`);
    if (d) return d;
  }
  return null;
}

// A clock for tests: time moves only when advance() moves it, so windows and retries are tested without waiting.
// advance runs each timer that falls due, in time order (ties in the order they were set), and lets promises settle
// after each, so a reply or a window can start the next call before a later timer runs.
export function manualClock(start = 0) {
  let now = start, last = 0;
  const due = new Map();
  const next = () => [...due].sort(([i, a], [j, b]) => a.at - b.at || i - j)[0];
  return {
    now: () => now,
    setTimeout: (fn, ms = 0) => {
      due.set(++last, { at: now + Math.max(0, ms), fn });
      return last;
    },
    clearTimeout: id => {
      due.delete(id);
    },
    pending: () => due.size,
    async advance(ms) {
      if (!(ms >= 0)) throw new Error(`the clock only moves forward, not by ${ms}`);
      const end = now + ms;
      await turn();
      for (let t = next(); t && t[1].at <= end; t = next()) {
        due.delete(t[0]);
        now = t[1].at;
        t[1].fn();
        await turn();
      }
      now = end;
    },
  };
}
