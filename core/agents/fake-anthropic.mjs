// The fake Anthropic server (R8c, $0): a stand-in for the Claude API's Messages endpoint, so the Claude transport
// (anthropic.mjs), its prices, its cap and its errors are tested with no network and no bill. Nothing here connects
// out: the in-process form never touches the network, and the HTTP form listens on 127.0.0.1 only, on a port the system
// picks (port 0). It sits beside fake-openrouter.mjs and works as it does.
// It wraps the fake model (fake-model.mjs), which writes the replies by seat and call, and answers around it as the
// Messages API does (Anthropic's API reference, errors and thinking pages, read 10-19):
// - POST /v1/messages only; every request needs `x-api-key: <key>` (else a 401 authentication_error) and
//   `anthropic-version: 2023-06-01` (else a 400);
// - the body is checked as the Claude 5 models check it, each a 400 invalid_request_error: max_tokens required; a field
//   the API doesn't take (OpenRouter's or the local model's); temperature or top_p; forced tool use (tool_choice any or
//   tool) on Sonnet 5.5 or Opus 5.5; thinking disabled on Sonnet 5.5 or Opus 5.5, between_tools on any other model,
//   enabled (budget_tokens) on any; and a model with no price is a 404 not_found_error;
// - the reply: the fake model's answer as a Message, its text as a text block, its tool calls as tool_use blocks (an
//   argument string that isn't JSON goes as it is, so a broken call reaches the reader), a thinking block first when
//   the request's thinking is adaptive (its tokens, `thinking`, billed inside output_tokens), and the usage: a system
//   text whose first part carries cache_control is written to the cache the first time its model and text are seen
//   (cache_creation_input_tokens, with the tools) and read after (cache_read_input_tokens);
// - the account: each call billed at anthropic.mjs's prices; once `credits` is spent a call gets the 400 Anthropic sends
//   ("Your credit balance is too low ...");
// - errors(seat, call, attempt, body): the API's own answer to one request before the model's, { status, type,
//   message, retryAfter (seconds, as the retry-after header), errorCode (as error.details.error_code) }; a 429 or 529
//   is asked again with the same seat and call. The fake model never sees such a request.
// fakeAnthropic({ key, credits, script, hooks, clock, errors, thinking }) makes one; fake.fetch has fetch's shape; await
// fake.listen() gives { port, origin, url } (url: the messages path at origin); await fake.close() ends both. A test
// reads back fake.requests, every request in arrival order ({ method, path, key, auth, version, seat, call, attempt,
// status, body, reply }: key and auth as they came, body the Messages body, reply the body sent back), fake.account()
// ({ credits, used }) and the fake model's fake.calls and fake.failures.
import http from 'node:http';
import { fakeModel, CHAT_PATH, SEAT_HEADER, CALL_HEADER } from './fake-model.mjs';
import { MESSAGES_PATH, CLAUDE_VERSION, PRICES, priceOf } from './anthropic.mjs';

const MODEL_URL = `http://fake-model.invalid${CHAT_PATH}`;
const TYPES = { 400: 'invalid_request_error', 401: 'authentication_error', 402: 'billing_error', 403: 'permission_error', 404: 'not_found_error', 413: 'request_too_large', 429: 'rate_limit_error', 500: 'api_error', 529: 'overloaded_error' };
const SAID = { 401: 'invalid x-api-key', 429: 'Number of request tokens has exceeded your per-minute rate limit', 500: 'Internal server error', 529: 'Overloaded' };
const CREDIT = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
// The fields the Messages API takes at the top of a body, as far as the fake needs them.
const FIELDS = new Set(['model', 'max_tokens', 'messages', 'system', 'tools', 'tool_choice', 'thinking', 'output_config', 'metadata', 'stop_sequences', 'stream']);
const NO_FORCE = ['claude-sonnet-5-5', 'claude-opus-5-5'];
const tokens = s => Math.ceil(String(s).length / 3);
const parseJSON = s => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
const failed = (status, message, more = {}) => ({ status, body: { type: 'error', error: { type: TYPES[status] || 'api_error', message: message ?? SAID[status] ?? 'error', ...more }, request_id: 'req_fake' } });
const textOf = content => (typeof content === 'string' ? content : Array.isArray(content) ? content.filter(b => b && b.type === 'text').map(b => b.text).join('') : '');

// Why a body is refused as a Claude 5 model refuses it, or null.
function refused(b) {
  const extra = Object.keys(b).find(k => !FIELDS.has(k));
  if (extra !== undefined) return `${extra}: Extra inputs are not permitted`;
  if (!Number.isInteger(b.max_tokens)) return 'max_tokens: Field required';
  if (!Array.isArray(b.messages) || !b.messages.length) return 'messages: Field required';
  const choice = b.tool_choice && b.tool_choice.type;
  if ((choice === 'any' || choice === 'tool') && NO_FORCE.includes(b.model)) return 'tool_choice: type "tool" and "any" are not supported for this model.';
  const t = b.thinking && b.thinking.type;
  if (t === 'enabled') return '"thinking.type.enabled" is not supported for this model. Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.';
  if (t === 'disabled' && NO_FORCE.includes(b.model)) return '"thinking.type.disabled" is not supported for this model.';
  if (t === 'between_tools' && b.model !== 'claude-sonnet-5-5') return '"thinking.type.between_tools" is not supported for this model.';
  return null;
}

// A Messages body as the fake model's chat request: the system text, the turns with tool_use as tool calls and
// tool_result as tool messages, the tools with their parameters.
function chatOf(b) {
  const messages = [];
  if (b.system) messages.push({ role: 'system', content: textOf(b.system) });
  for (const m of b.messages) {
    if (m.role === 'assistant') {
      const blocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }];
      const calls = blocks.filter(x => x.type === 'tool_use').map(x => ({ id: x.id, type: 'function', function: { name: x.name, arguments: JSON.stringify(x.input) } }));
      messages.push({ role: 'assistant', content: textOf(blocks) || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else if (Array.isArray(m.content)) {
      for (const x of m.content.filter(y => y.type === 'tool_result')) messages.push({ role: 'tool', tool_call_id: x.tool_use_id, content: textOf(x.content) || String(x.content) });
      const text = textOf(m.content);
      if (text) messages.push({ role: 'user', content: text });
    } else messages.push({ role: 'user', content: m.content });
  }
  const choice = { auto: 'auto', any: 'required', none: 'none' }[b.tool_choice?.type];
  return {
    model: b.model, messages, max_tokens: b.max_tokens,
    ...(Array.isArray(b.tools) ? { tools: b.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}),
    ...(choice ? { tool_choice: choice } : {}),
  };
}

export function fakeAnthropic({ key, credits = 100, script = {}, hooks, clock, errors = null, thinking = 300 } = {}) {
  if (typeof key !== 'string' || !key) throw new Error('the fake Anthropic server needs the one key it takes');
  const model = fakeModel({ script, hooks, ...(clock ? { clock } : {}) });
  const account = { credits, used: 0 };
  const requests = [];
  const tries = new Map();
  const cached = new Set();
  let server = null, listening = null;

  async function messages(rec, b, signal) {
    const k = `${rec.seat}#${rec.call}`;
    rec.attempt = (tries.get(k) || 0) + 1;
    tries.set(k, rec.attempt);
    const own = errors ? errors(rec.seat, rec.call, rec.attempt, b) : undefined;
    if (own) {
      const out = failed(own.status, own.message, own.errorCode ? { details: { error_code: own.errorCode } } : {});
      if (own.type) out.body.error.type = own.type;
      return { ...out, headers: Number.isFinite(own.retryAfter) ? { 'retry-after': String(own.retryAfter) } : {} };
    }
    const no = refused(b);
    if (no) return failed(400, no);
    if (!Object.hasOwn(PRICES, b.model)) return failed(404, `model: ${b.model}`);
    if (account.used >= account.credits) return failed(400, CREDIT);
    const res = await model.fetch(MODEL_URL, {
      method: 'POST', body: JSON.stringify(chatOf(b)), signal,
      headers: { 'content-type': 'application/json', [SEAT_HEADER]: rec.seat ?? '', [CALL_HEADER]: rec.call === null ? '' : String(rec.call) },
    });
    const out = parseJSON(await res.text());
    if (res.status !== 200 || !out || !Array.isArray(out.choices)) return { status: res.status === 200 ? 500 : res.status, body: failed(500, 'the fake model failed').body };
    const { message, finish_reason: finish } = out.choices[0];
    const thought = b.thinking && b.thinking.type === 'adaptive' ? thinking : 0;
    const content = [
      ...(thought ? [{ type: 'thinking', thinking: '', signature: `fake-signature-${rec.seat}-${rec.call}` }] : []),
      ...(message.content ? [{ type: 'text', text: message.content }] : []),
      ...(message.tool_calls || []).map((c, i) => ({ type: 'tool_use', id: `toolu_fake_${rec.seat}_${rec.call}_${i + 1}`, name: c.function.name, input: parseJSON(c.function.arguments) ?? c.function.arguments })),
    ];
    // The cache: the marked fixed part (with the tools ahead of it) written once a model, read after.
    const first = Array.isArray(b.system) ? b.system[0] : null;
    const prefix = first && first.cache_control ? tokens(JSON.stringify(b.tools || []) + first.text) : 0;
    const seen = prefix && cached.has(`${b.model}|${JSON.stringify(b.tools || [])}|${first.text}`);
    if (prefix) cached.add(`${b.model}|${JSON.stringify(b.tools || [])}|${first.text}`);
    const prompt = tokens(JSON.stringify(b.tools || []) + textOf(b.system || '') + JSON.stringify(b.messages));
    const usage = {
      input_tokens: Math.max(1, prompt - prefix), cache_creation_input_tokens: prefix && !seen ? prefix : 0, cache_read_input_tokens: seen ? prefix : 0,
      output_tokens: out.usage.completion_tokens + thought, ...(thought ? { output_tokens_details: { thinking_tokens: thought } } : {}),
    };
    account.used += priceOf(b.model, usage);
    const stop = { tool_calls: 'tool_use', length: 'max_tokens', stop: 'end_turn' }[finish] ?? 'end_turn';
    return { status: 200, body: { id: `msg_fake_${rec.seat}_${rec.call}_${rec.attempt}`, type: 'message', role: 'assistant', model: b.model, content, stop_reason: stop, stop_sequence: null, usage } };
  }

  async function answer({ method, path, key: given, auth, version, seat, call, text, signal }) {
    if (signal && signal.aborted) throw signal.reason;
    const body = parseJSON(text);
    const rec = { method, path, key: given, auth, version, seat: seat || null, call: call ? Number(call) : null, attempt: null, status: null, body, reply: null };
    requests.push(rec);
    let out;
    if (given !== key) out = failed(401);
    else if (version !== CLAUDE_VERSION) out = failed(400, 'anthropic-version: header is required');
    else if (method !== 'POST' || path !== MESSAGES_PATH) out = failed(404, 'Not Found');
    else if (!isObject(body)) out = failed(400, 'There was an issue with the format of your request.');
    else out = await messages(rec, body, signal);
    rec.status = out.status;
    rec.reply = out.body;
    return out;
  }

  async function fetchFake(url, init = {}) {
    const headers = new Headers(init.headers);
    const out = await answer({
      method: String(init.method ?? 'GET').toUpperCase(), path: new URL(String(url), 'http://anthropic.invalid').pathname,
      key: headers.get('x-api-key'), auth: headers.get('authorization'), version: headers.get('anthropic-version'),
      seat: headers.get(SEAT_HEADER), call: headers.get(CALL_HEADER), text: typeof init.body === 'string' ? init.body : '', signal: init.signal,
    });
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json', ...(out.headers || {}) } });
  }

  async function onRequest(req, res) {
    const gone = new AbortController();
    res.on('close', () => gone.abort());
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const out = await answer({
        method: req.method, path: new URL(req.url, 'http://127.0.0.1').pathname, key: req.headers['x-api-key'] ?? null,
        auth: req.headers.authorization ?? null, version: req.headers['anthropic-version'] ?? null,
        seat: req.headers[SEAT_HEADER] ?? null, call: req.headers[CALL_HEADER] ?? null, text: Buffer.concat(chunks).toString('utf8'), signal: gone.signal,
      });
      res.writeHead(out.status, { 'content-type': 'application/json', ...(out.headers || {}) });
      res.end(JSON.stringify(out.body));
    } catch {
      res.destroy();
    }
  }

  function listen() {
    listening ??= new Promise((resolve, reject) => {
      server = http.createServer(onRequest);
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const { address, port } = server.address();
        const origin = `http://${address}:${port}`;
        resolve({ port, origin, url: `${origin}${MESSAGES_PATH}` });
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

  return { fetch: fetchFake, listen, close, requests, account: () => ({ ...account }), calls: model.calls, failures: model.failures };
}
