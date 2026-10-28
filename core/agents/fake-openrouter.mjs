// The fake OpenRouter (R2-12, $0): a stand-in for OpenRouter's API, so the paid transport (openrouter.mjs), the spend
// cap and the preflight are tested with no network and no bill. Nothing here connects out: the in-process form never
// touches the network, and the HTTP form listens on 127.0.0.1 only, on a port the system picks (port 0).
// It wraps the fake model (fake-model.mjs), which writes the replies by seat and call as it does for the local
// endpoint, and answers around it as OpenRouter does, at OpenRouter's documented paths:
// - every request needs `authorization: Bearer <key>`, or it gets a 401;
// - GET /api/v1/credits: { data: { total_credits, total_usage } }, the account's. GET /api/v1/key: { data: { label,
//   limit, limit_remaining, usage, is_free_tier } }, the key's; a null limit is none set. `down: { credits: 500 }` (or
//   `key`) makes one answer that status instead;
// - POST /api/v1/chat/completions: the fake model's reply with the `provider` that answered, and `usage` with its
//   `cost` (a request with a reasoning budget also reasons, `reasoning` tokens), billed to the account and the key.
//   Once the account is spent, a chat call gets a 402;
// - errors(seat, call, attempt): OpenRouter's own answer to one request before the model's, by the seat, its call and
//   which try this is (a 429 is asked again with the same seat and call): { status } (429, 402, 401, 403, 5xx...), with
//   an optional `message`, `code` (an error in a 200's body, which OpenRouter sends once the model has started) and
//   `cost` (an error body that carries usage, and is billed). The fake model never sees such a request.
// The prices: `cost(request body)` in dollars a call, or `price` in dollars a million tokens in and out.
// fakeOpenRouter({ key, credits, used, limit, keyUsage, script, hooks, clock, errors, cost, price, reasoning, down })
// makes one: `key` is the only one it takes; `credits` and `used` the account's; `limit` and `keyUsage` the key's;
// `script`, `hooks` and `clock` go to the fake model as they are. fake.fetch has fetch's shape; await fake.listen()
// gives { port, origin, url } (url: the chat path at origin); await fake.close() ends both. A test reads back
// fake.requests, every request in arrival order ({ method, path, auth, seat, call, attempt, status }: auth as it came,
// attempt for chat calls, status once answered), fake.account() ({ credits, used, limit, keyUsage }), fake.provider,
// and the fake model's fake.calls and fake.failures.
import http from 'node:http';
import { fakeModel, CHAT_PATH, SEAT_HEADER, CALL_HEADER } from './fake-model.mjs';

export const OPENROUTER_CHAT = '/api/v1/chat/completions';
const CREDITS = '/api/v1/credits';
const KEY = '/api/v1/key';
// Where the fake model sits behind it: in-process, so any URL with its path will do.
const MODEL_URL = `http://fake-model.invalid${CHAT_PATH}`;
// OpenRouter's words for its errors, as near as the fake needs them.
const SAID = {
  401: 'No auth credentials found', 402: 'Insufficient credits. Add more using https://openrouter.ai/credits',
  403: 'Key limit exceeded', 404: 'Not Found', 429: 'Rate limit exceeded: too many requests to this provider',
  500: 'Internal Server Error', 502: 'Provider returned error', 503: 'No available provider',
};
// A rough token count, as the fake model's: R2's views measured 2.4 to 3.1 characters a token.
const tokens = s => Math.ceil(String(s).length / 3);
const parseJSON = s => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const failed = status => ({ status, body: { error: { code: status, message: SAID[status] || 'error' } } });

export function fakeOpenRouter({
  key, credits = 100, used = 0, limit = null, keyUsage = 0, script = {}, hooks, clock, errors = null, cost = null,
  price = { in: 0.1, out: 0.5 }, reasoning = 300, down = {},
} = {}) {
  if (typeof key !== 'string' || !key) throw new Error('the fake OpenRouter needs the one key it takes');
  const model = fakeModel({ script, hooks, ...(clock ? { clock } : {}) });
  const account = { credits, used, limit, keyUsage };
  const provider = 'FakeProvider';
  const requests = [];
  const tries = new Map();
  let server = null, listening = null;

  const bill = usd => {
    account.used += usd;
    account.keyUsage += usd;
  };

  // A chat call: OpenRouter's own answer when the script has one, else the fake model's, priced and billed.
  async function chat(rec, text, signal) {
    const body = parseJSON(text) || {};
    const k = `${rec.seat}#${rec.call}`;
    rec.attempt = (tries.get(k) || 0) + 1;
    tries.set(k, rec.attempt);
    const own = errors ? errors(rec.seat, rec.call, rec.attempt, body) : undefined;
    if (own) {
      const status = own.status ?? 200;
      const code = own.code ?? status;
      const usd = own.cost ?? null;
      if (usd !== null) bill(usd);
      const usage = usd === null ? {} : { usage: { prompt_tokens: tokens(text), completion_tokens: 0, total_tokens: tokens(text), cost: usd } };
      return { status, body: { error: { code, message: own.message ?? SAID[code] ?? 'error' }, ...usage } };
    }
    if (account.used >= account.credits) return failed(402);
    const res = await model.fetch(MODEL_URL, {
      method: 'POST', body: text, signal,
      headers: { 'content-type': 'application/json', [SEAT_HEADER]: rec.seat ?? '', [CALL_HEADER]: rec.call === null ? '' : String(rec.call) },
    });
    const out = parseJSON(await res.text());
    if (res.status !== 200 || !out || !Array.isArray(out.choices)) return { status: res.status, body: out };
    const thought = body.reasoning && Number.isInteger(body.reasoning.max_tokens) ? reasoning : 0;
    const usage = {
      ...out.usage, completion_tokens: out.usage.completion_tokens + thought, total_tokens: out.usage.total_tokens + thought,
      completion_tokens_details: { reasoning_tokens: thought },
    };
    usage.cost = cost ? cost(body) : (usage.prompt_tokens * price.in + usage.completion_tokens * price.out) / 1e6;
    bill(usage.cost);
    return { status: 200, body: { ...out, provider, usage } };
  }

  // One request, in either form: { status, body }, or a rejection when the caller gives up first.
  async function answer({ method, path, auth, seat, call, text, signal }) {
    if (signal && signal.aborted) throw signal.reason;
    const rec = { method, path, auth, seat: seat || null, call: call ? Number(call) : null, attempt: null, status: null };
    requests.push(rec);
    let out;
    if (auth !== `Bearer ${key}`) out = failed(401);
    else if (method === 'GET' && path === CREDITS) {
      out = down.credits ? failed(down.credits) : { status: 200, body: { data: { total_credits: account.credits, total_usage: account.used } } };
    } else if (method === 'GET' && path === KEY) {
      const left = account.limit === null ? null : account.limit - account.keyUsage;
      out = down.key ? failed(down.key) : { status: 200, body: { data: { label: 'fake', limit: account.limit, limit_remaining: left, usage: account.keyUsage, is_free_tier: false } } };
    } else if (method === 'POST' && path === OPENROUTER_CHAT) out = await chat(rec, text, signal);
    else out = failed(404);
    rec.status = out.status;
    return out;
  }

  // The in-process form: fetch's shape.
  async function fetchFake(url, init = {}) {
    const headers = new Headers(init.headers);
    const out = await answer({
      method: String(init.method ?? 'GET').toUpperCase(), path: new URL(String(url), 'http://openrouter.invalid').pathname,
      auth: headers.get('authorization'), seat: headers.get(SEAT_HEADER), call: headers.get(CALL_HEADER),
      text: typeof init.body === 'string' ? init.body : '', signal: init.signal,
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
        method: req.method, path: new URL(req.url, 'http://127.0.0.1').pathname, auth: req.headers.authorization ?? null,
        seat: req.headers[SEAT_HEADER] ?? null, call: req.headers[CALL_HEADER] ?? null,
        text: Buffer.concat(chunks).toString('utf8'), signal: gone.signal,
      });
      res.writeHead(out.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out.body));
    } catch {
      // The caller gave up, or the fake closed: nobody is left to answer.
      res.destroy();
    }
  }

  // The HTTP form, on 127.0.0.1 at a port the system picks.
  function listen() {
    listening ??= new Promise((resolve, reject) => {
      server = http.createServer(onRequest);
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const { address, port } = server.address();
        const origin = `http://${address}:${port}`;
        resolve({ port, origin, url: `${origin}${OPENROUTER_CHAT}` });
      });
    });
    return listening;
  }

  async function close() {
    await model.close();
    await listening?.catch(() => {});
    const open = server;
    server = null;
    if (open) await new Promise(resolve => {
      open.close(() => resolve());
      open.closeAllConnections();
    });
  }

  return {
    fetch: fetchFake, listen, close, requests, provider, account: () => ({ ...account }),
    calls: model.calls, failures: model.failures,
  };
}
