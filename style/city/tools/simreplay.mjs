// SIM LIVE pass · THE REPLAY SERVER: a recorded sim2 run served as the live sim's GET /state, stepping through the run over time, so
// the city's ?sim=live mode can be run, tested and shot without the sim (sim2/server.mjs calls paid model APIs: never start it here).
//   node style/city/tools/simreplay.mjs [run dir | stamp] [--port 5262] [--speed 1] [--from <minutes | "D2 22:00">] [--loop] [--for <s>]
//     run      a directory under the sim's sim2/runs (a full path or its stamp). Default: the latest real run (names with
//              -dry are skipped), with at least two snapshots.
//     --port   5262 by default — NOT 5251: the sim session may be running the real server there.
//     --speed  a multiplier of the run's own recorded pace (meta.json `day`: real minutes per game day; 12 if unknown). 0 pauses.
//     --from   the game time to start at (clamped to the first snapshot); --loop starts over at the end; --for exits after <s> seconds.
//     --view   public (default since the human layer, 2026-10-07: what the sim's own GET /state serves viewers, sim2/server.mjs publicView
//              through simstate/lens.js — no cash, heat or stash, `wanted` for heat, no private events) | full (the recorded snapshots as
//              they are). /state?view= overrides per request.
//     --director-delay <game minutes>   the director's cut's delay (default 1440 = one game day, the sim's own default)
//     --archive  serve the run as a FINISHED season: everything, always (view=full by default, `archive: true` on every state, the
//              director's cut and /tape with no delay). Without it the run behaves like a LIVE season, so the UI is tested under the real rules.
// THE LENSES, as the sim serves them (sim2/server.mjs @ 77ce68c; the filter code itself is the sim's, copied verbatim into simstate/lens.js):
//   GET /state?view=public                        the public view (the default), under the city's rules (lens.js cityRules: no DMs, no
//                                                 burglar, no unseen robber, secret stats only as yesterday's `statsCut`, an agent
//                                                 at someone else's lot shown only by district)
//   GET /state?view=owner&handle=<h>&token=<t>    public + me (full record, home stash, plan, triggers, notes, memory, sees) + myEvents;
//                                                 403 on a bad token. Tokens: the run's owner-tokens.json, or (runs before 10-01 have
//                                                 none) dev tokens derived from the run's name — GET /dev/token?handle=<h> hands one out
//                                                 (the replay only; the real sim never does). A recording has no notes, memory or sees
//                                                 (null), and plan/triggers are rebuilt from the plan and trigger events.
//   GET /state?view=director                      the full hourly snapshot from now − delay + the events up to then; `pending` before
//   GET /state?view=full                          everything now (dev)
// THE TAPE (section 2 builds on it): GET /tape?from=&to=[&handle=][&snaps=0] → { horizon, from, to, clamped, snapshots, events }: full
// hourly snapshots and every event in the range, CLAMPED to the director's horizon (now − delay) unless --archive. Indexed by hour and by
// agent, so a range or one agent's events cost a lookup. GET /events?since=<id>[&upto=<t>][&handle=] → the PUBLIC events so far (public
// facts are public live: no delay), for a page that joins mid-run (the sim's /state only carries the last 150). Every public event, here
// and in /state, is lensed with the lots' owners as of its own minute (lens.js ownerBook: THE OWNERS THEN), the form it had live.
// THE PUBLIC TAPE (the public rewind, 2026-10-09): GET /tape?view=public[&from=&to=][&lag=<game min>][&handle=][&snaps=0] → { view,
// t, horizon, edge, lag, from, to, clamped, delay, snapshots, events }: the public city between the director's horizon (now − delay) and
// the broadcast edge (now − lag), never past it: hourly public snapshots (lens.js publicTapeSnap: each the public answer at its hour, cut
// to handle, status, act, at, x, z, trip) and the public events in the window (as /events serves them). The sim serves the same.
// What it serves is exactly the live server's shape: { ...snapshot, running, news: last 30, events: last 150 }, CORS, no-store. The run
// records one snapshot per game HOUR (snapshots.jsonl) and every change (events.jsonl); between two snapshots the state is the earlier
// snapshot advanced by the events since (trips, arrivals, sleep, jail, hospital, deaths, activities, homes bought, security installed,
// burglaries, raids, evictions, corner sales), so agents leave and arrive on the minute as they did in the run.
//   GET /state · /tape · /events · /dev/token · GET /seek?t=<minutes | D2 22:00> · GET /speed?x=<multiplier> · GET / (status). Read-only:
//   nothing is written to the run.
// THE BROADCAST'S JOIN (TV plan A1, 2026-10-09): GET /state?lag=<game min>[&view=…] → the same answer as of `lag` game minutes ago (the
// run's own state then, under the lens rules of then; never before the run's first minute), plus lag: { minutes, t, ago, rate }: the
// minutes it went back, the state's t, how many real s ago the sim entered that minute (null while paused) and the pace now (game min per
// real s). A page joining with a delay (simstate/broadcast.js) backfills its delay line from it and starts D s behind, with no ramp. The
// sim's own server would keep a ring of its last ~30 per-minute views for this (the request in simstate/STORE.md).
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { publicOf, livePublic, ownerOf, directorOf, ownerEvents, cityEvents, isDM, ownerBook, publicTapeSnap, publicTapeWindow } from '../simstate/lens.js';
import { createTimeline, stamp, parseT } from '../simstate/timeline.js';
import { createMoveMock } from '../simstate/movemock.mjs';   // (MOVEMENT W3a: --movemock / ?movemock=1 — trip legs for the recorded trips until the sim's own arrive)   // (the state between snapshots: one copy, shared with the page's tape player)

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), flag = k => args.includes('--' + k), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const pos = args.filter((a, k) => !a.startsWith('--') && !(k > 0 && args[k - 1].startsWith('--') && !['loop', 'quiet', 'archive', 'movemock'].includes(args[k - 1].slice(2))));
const SIM2 = process.env.SIM2 || [path.join(os.homedir(), 'Desktop/deadnet/sim2'), path.resolve(HERE, '../../../sim2')].find(d => fs.existsSync(path.join(d, 'runs'))) || path.join(os.homedir(), 'Desktop/deadnet/sim2');
const RUNS = path.join(SIM2, 'runs'), PORT = +opt('port', 5262), LOOP = flag('loop'), QUIET = flag('quiet'), FOR = +opt('for', 0);
const lines = f => { try { return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean); } catch { return []; } };
const die = m => { console.error('simreplay: ' + m); process.exit(1); };

// ── the run
function latestRun() {
  const names = fs.existsSync(RUNS) ? fs.readdirSync(RUNS).filter(n => !/-dry/.test(n)).sort().reverse() : [];
  for (const n of names) { const d = path.join(RUNS, n); if (lines(path.join(d, 'snapshots.jsonl')).length >= 2 && fs.existsSync(path.join(d, 'events.jsonl'))) return d; }
  return null; }
const RUN = pos[0] ? (fs.existsSync(pos[0]) ? path.resolve(pos[0]) : path.join(RUNS, pos[0])) : latestRun();
if (!RUN || !fs.existsSync(path.join(RUN, 'snapshots.jsonl'))) die(`no run with snapshots.jsonl (${RUN || RUNS})`);
const SNAPS = lines(path.join(RUN, 'snapshots.jsonl')).map(l => JSON.parse(l)).sort((a, b) => a.t - b.t);
const EVENTS = lines(path.join(RUN, 'events.jsonl')).map(l => JSON.parse(l)).filter(e => typeof e.t === 'number');   // (in emit order: by id)
let META = {}; try { META = JSON.parse(fs.readFileSync(path.join(RUN, 'meta.json'), 'utf8')); } catch {}
if (!SNAPS.length) die('the run has no snapshots');
let PLACES = new Map(); try { const pj = JSON.parse(fs.readFileSync(path.join(SIM2, 'places.json'), 'utf8')); for (const p of [...pj.places, ...pj.lots]) PLACES.set(p.id, p); } catch {}
const T0 = SNAPS[0].t, T1 = Math.max(SNAPS[SNAPS.length - 1].t, EVENTS.length ? EVENTS[EVENTS.length - 1].t : 0);
const DAY = +META.day || 12, BASE_RATE = 1440 / (DAY * 60);   // game minutes per real second at the run's own pace
let speed = +opt('speed', 1); if (!(speed >= 0)) speed = 1;
// THE LENSES (simstate/lens.js: the sim's own publicView, verbatim): --view public is the default; --archive serves a finished season
const ARCHIVE = flag('archive'), VIEW = opt('view', ARCHIVE ? 'full' : 'public'), DELAY = ARCHIVE ? 0 : +opt('director-delay', 1440);
const TOKENS = (() => { try { return { tokens: JSON.parse(fs.readFileSync(path.join(RUN, 'owner-tokens.json'), 'utf8')), dev: false }; } catch {}   // (runs from 10-01 on)
  const t = {}; for (const s of SNAPS) for (const a of s.agents || []) if (!a.npc && !t[a.handle]) t[a.handle] = crypto.createHash('sha256').update(`simreplay-dev:${path.basename(RUN)}:${a.handle}`).digest('hex').slice(0, 24);
  return { tokens: t, dev: true }; })();
// the indexes: events per agent (who or to), the first event of every game hour, the snapshot of every game hour
const BY_AGENT = new Map(); EVENTS.forEach((e, k) => { for (const h of new Set([e.who, e.to])) if (typeof h === 'string') { let L = BY_AGENT.get(h); if (!L) BY_AGENT.set(h, L = []); L.push(k); } });
const H0 = Math.floor(Math.min(SNAPS[0].t, EVENTS[0]?.t ?? Infinity) / 60), HOUR_EV = [], HOUR_SNAP = [];
for (let h = H0, k = 0, j = 0; h * 60 <= T1 + 60; h++) { while (k < EVENTS.length && EVENTS[k].t < h * 60) k++; HOUR_EV.push(k); while (j + 1 < SNAPS.length && SNAPS[j + 1].t <= h * 60) j++; HOUR_SNAP.push(j); }
const evFrom = t => { const h = Math.floor(t / 60) - H0; if (h < 0) return 0; if (h >= HOUR_EV.length) return EVENTS.length; let k = HOUR_EV[h]; while (k < EVENTS.length && EVENTS[k].t < t) k++; return k; };   // first event with t' ≥ t
// ── the state at game minute T: simstate/timeline.js (the last snapshot at or before T, advanced by the events after it; moved there
// unchanged so the page's tape player runs the very same code), + what the live server adds: running, the last 30 news, the last 150 events
const TL = createTimeline({ snaps: SNAPS, events: EVENTS, places: PLACES }), { lastEventUpTo } = TL;
function stateAt(T) {
  const S = TL.advance(T);
  const n = lastEventUpTo(T), ev = EVENTS.slice(Math.max(0, n - 150), n), news = []; for (let k = n - 1; k >= 0 && news.length < 30; k--) if (EVENTS[k].news) news.unshift(EVENTS[k]);
  return { ...S, running: T < T1, news, events: ev };
}

// ── the clock: game minutes from real time × speed
let T = Math.min(T1, Math.max(T0, parseT(opt('from', null)) ?? T0)), last = Date.now();
const clockNow = () => { const now = Date.now(), dt = (now - last) / 1000; last = now; T += dt * BASE_RATE * speed; if (T >= T1) T = LOOP ? T0 : T1; return Math.floor(T); };
let cacheS = { t: -1, S: null }; const full = t => { if (cacheS.t !== t) cacheS = { t, S: stateAt(t) }; return cacheS.S; };
const upTo = t => EVENTS.slice(Math.max(0, lastEventUpTo(t) - 600), lastEventUpTo(t));   // (enough raw events for the last 150 public ones)
const tag = o => ARCHIVE ? { ...o, archive: true } : o;
// the city's rules (simstate/lens.js cityRules) need: an agent's last line said out loud (when its lastSay was a DM), and the director's
// snapshot for yesterday's secret stats (statsCut); archive: no delay
const lastLoud = t => h => { const ix = BY_AGENT.get(h) || []; for (let k = ix.length - 1; k >= 0; k--) { const e = EVENTS[ix[k]]; if (e.t > t) continue; if (e.type === 'say' && e.who === h && !isDM(e)) return { text: e.text, to: 'here', t: e.t }; } return null; };
const cutOf = t => { if (ARCHIVE) return full(t); const c = t - DELAY; let k = -1; for (let j = SNAPS.length - 1; j >= 0; j--) if (SNAPS[j].t <= c) { k = j; break; } return k >= 0 ? SNAPS[k] : null; };
// THE OWNERS THEN (lens.js ownerBook): the lots' owners at the end of every minute they can change (a claim, an eviction: the timeline's
// own rules) and of every snapshot (the sim's truth), from the run's start; every event is lensed with the owners as of its own minute,
// so an event served later (/events, /state's window, the public tape) is the form it had live, not one under today's owners
const OWNERS = (() => { const b = ownerBook(), ms = new Set([T0, ...SNAPS.map(s => s.t), ...EVENTS.filter(e => e.type === 'claim' || e.type === 'evicted').map(e => Math.max(T0, e.t))]);
  for (const m of [...ms].sort((x, y) => x - y)) b.note(m, TL.advance(m).lots); return b; })();
const rulesOpt = t => ({ lastLoud: lastLoud(t), cut: cutOf(t), delay: DELAY, places: PLACES, record: EVENTS.slice(0, lastEventUpTo(t)), ownersAt: OWNERS.at });   // (record: the whole log so far, for the public Most Wanted — rule 6, as the sim passes g.events)
// the extras the sim keeps outside its snapshot, rebuilt from the run for the owner view: the standing plan and the triggers set so far
function ownerExtras(h, t) { const ix = BY_AGENT.get(h) || [], mine = []; for (const k of ix) { const e = EVENTS[k]; if (e.t > t) break; if (e.who === h) mine.push(e); }
  const plan = [...mine].reverse().find(e => e.type === 'plan'); return { plan: plan ? (plan.steps || []).join(' | ') || plan.text.replace(/^set a plan:\s*/, '') : null,
    triggers: mine.filter(e => e.type === 'trigger').slice(-5).map(e => e.text.replace(/^set a trigger:\s*/, '')), notes: null, memory: null, sees: null }; }
// MOVEMENT W3a · the dev mock of the sim's trip legs (simstate/movemock.mjs): --movemock, or ?movemock=1 per request. It runs on the FULL
// state BEFORE any lens (once per game minute, one mock for every view), so rule 5 coarsens its legs exactly like the sim's real ones
// SPREAD (pass 5b): the export of the spread the city runs at — world.json is the default spread's, world.s<m>.json another's (world/city.js
// sdata); SPREAD=<m> picks it (no import of world/city.js here: it would pull three in)
const EXPORT_FILE = (() => { const d = +(/SPREAD_DEFAULT = (\d+)/.exec(fs.readFileSync(path.resolve(HERE, '../../../world/city.js'), 'utf8'))?.[1] ?? 0), s = process.env.SPREAD ? +process.env.SPREAD : d; return s === d ? 'world.json' : `world.s${s}.json`; })();
let MOCK = null, cacheM = { t: -1, S: null }; const mockOn = u => flag('movemock') || u.searchParams.get('movemock') === '1';
function fullM(t, u) { if (!mockOn(u)) return full(t);
  if (!MOCK) { MOCK = createMoveMock(JSON.parse(fs.readFileSync(path.resolve(HERE, '../../../world/export/' + EXPORT_FILE), 'utf8'))); console.log('  movemock: trip legs for the recorded trips (world/export/travel.mjs)'); }
  if (cacheM.t !== t) { const F = full(t), S = { ...F, agents: (F.agents || []).map(a => ({ ...a })) }; MOCK.apply(S, t); cacheM = { t, S }; } return cacheM.S; }
function stateFor(t, u) { return stateFor0(t, u); }
function stateFor0(t, u) { const view = u.searchParams.get('view') || VIEW;
  if (view === 'full') return [200, tag(fullM(t, u))];
  if (view === 'public') return [200, tag(publicAt(t, u))];
  if (view === 'owner') { const h = u.searchParams.get('handle'), tok = u.searchParams.get('token'); if (!h || !TOKENS.tokens[h] || TOKENS.tokens[h] !== tok) return [403, { error: 'owner view needs your agent\'s handle and its owner token' }];
    const S = fullM(t, u), n = lastEventUpTo(t), o = ownerOf({ ...S, events: upTo(t) }, h, upTo(t), ownerExtras(h, t), rulesOpt(t)); if (!o) return [403, { error: 'owner view needs your agent\'s handle and its owner token' }];
    o.myEvents = ownerEvents((BY_AGENT.get(h) || []).filter(k => k < n).slice(-80).map(k => EVENTS[k]), h, S.lots); return [200, tag(o)]; }
  if (view === 'director') { if (ARCHIVE) { const { news, running, ...S } = full(t); return [200, tag({ delayMinutes: 0, ...S, events: EVENTS.slice(Math.max(0, lastEventUpTo(t) - 150), lastEventUpTo(t)) })]; }
    const cut = t - DELAY, n = lastEventUpTo(cut); return [200, directorOf(SNAPS, EVENTS.slice(Math.max(0, n - 150), n), t, DELAY)]; }
  return [400, { error: 'view=public | owner&handle=&token= | director | full' }]; }
function publicAt(t, u) { const S = fullM(t, u); return publicOf(S, { events: upTo(t), news: S.news, running: S.running, ...rulesOpt(t) }); }
// the tape: everything in [from, to], clamped to the director's horizon (archive: the end of the run)
function tapeFor(t, u) { const horizon = ARCHIVE ? T1 : t - DELAY, open = SNAPS[0].t <= horizon;
  const want = { from: parseT(u.searchParams.get('from')), to: parseT(u.searchParams.get('to')) }, to = Math.min(want.to ?? horizon, horizon), from = Math.max(0, Math.min(want.from ?? to - 1440, to));
  if (!open) return { horizon: null, delay: DELAY, pending: `the director's cut starts ${DELAY} game minutes into the city`, from: null, to: null, clamped: true, snapshots: [], events: [] };
  const h = u.searchParams.get('handle'), snaps = u.searchParams.get('snaps') !== '0';
  const events = h ? (BY_AGENT.get(h) || []).map(k => EVENTS[k]).filter(e => e.t >= from && e.t <= to) : EVENTS.slice(evFrom(from), lastEventUpTo(to));
  const snapshots = []; if (snaps) { for (let k = HOUR_SNAP[Math.max(0, Math.min(HOUR_SNAP.length - 1, Math.floor(from / 60) - H0))] ?? 0; k < SNAPS.length && SNAPS[k].t <= to; k++) if (SNAPS[k].t >= from) snapshots.push(SNAPS[k]); }
  return { horizon, delay: DELAY, archive: ARCHIVE || undefined, from, to, clamped: (want.to ?? -Infinity) > horizon, snapshots, events }; }
// the public log so far (public facts are public live)
function eventsFor(t, u) { const since = +(u.searchParams.get('since') || 0), upto = Math.min(parseT(u.searchParams.get('upto')) ?? t, t), h = u.searchParams.get('handle'), n = lastEventUpTo(upto);
  const ix = h ? (BY_AGENT.get(h) || []).filter(k => k < n) : null, out = []; for (const e of ix ? ix.map(k => EVENTS[k]) : EVENTS.slice(0, n)) { if (!(e.id > since)) continue; const p = livePublic(e, PLACES); if (p) out.push(p); }   // (livePublic: + VISIBLE HIGHS, a private act's public form)
  // (the context: the log from the start of the first minute served — a cursor inside a minute must not cost an event its robber)
  let k0 = 0; for (let hi = n; k0 < hi; ) { const m = (k0 + hi) >> 1; if (EVENTS[m].id > since) hi = m; else k0 = m + 1; }
  return { t, upto, events: cityEvents(out, { ownersAt: OWNERS.at, places: PLACES, context: k0 < n ? EVENTS.slice(evFrom(EVENTS[k0].t), n) : null }) }; }
// THE PUBLIC TAPE (lens.js publicTapeSnap): view=public — the public city between the director's horizon and the broadcast edge (now −
// lag), hourly public snapshots (the public answer at each hour, positions, status and trips; an hour once its minute is over, as on the
// sim) + the public events, as they were live.
// A snapshot depends only on its hour (and the movemock), so it is kept once made
const PUBTAPE = new Map();
function publicTapeFor(t, u) { const horizon = ARCHIVE ? T1 : t - DELAY, w = publicTapeWindow({ now: t, delay: ARCHIVE ? t - horizon : DELAY, lag: u.searchParams.get('lag'), from: parseT(u.searchParams.get('from')), to: parseT(u.searchParams.get('to')) });
  const h = u.searchParams.get('handle'), snaps = [], list = [], { empty, ...win } = w;
  if (!empty) { if (u.searchParams.get('snaps') !== '0') for (let k = Math.max(Math.ceil(w.from / 60), Math.ceil(T0 / 60)) * 60; k <= w.to && (k < t || t >= T1); k += 60) { const key = `${k}:${mockOn(u) ? 1 : 0}`; let s = PUBTAPE.get(key); if (!s) { s = publicTapeSnap(publicAt(k, u)); if (PUBTAPE.size > 2000) PUBTAPE.clear(); PUBTAPE.set(key, s); } snaps.push(s); }
    for (const e of h ? (BY_AGENT.get(h) || []).map(k => EVENTS[k]).filter(e => e.t >= w.from && e.t <= w.to) : EVENTS.slice(evFrom(w.from), lastEventUpTo(w.to))) { const p = livePublic(e, PLACES); if (p) list.push(p); } }
  return { view: 'public', t, ...win, delay: DELAY, archive: ARCHIVE || undefined, snapshots: snaps, events: cityEvents(list, { ownersAt: OWNERS.at, places: PLACES, context: h && !empty ? EVENTS.slice(evFrom(w.from), lastEventUpTo(w.to)) : null }) }; }

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' }); return res.end(); }
  if (u.pathname === '/state') { const now = clockNow(), lg = u.searchParams.has('lag') ? Math.max(0, Math.floor(+u.searchParams.get('lag') || 0)) : null, t = lg === null ? now : Math.max(T0, now - lg);
    const [code, body] = stateFor(t, u), rate = BASE_RATE * speed;   // (?lag=: the broadcast's join)
    return send(code, lg === null || code !== 200 ? body : { ...body, lag: { minutes: now - t, t, ago: rate > 0 ? +((T - t) / rate).toFixed(3) : null, rate: +rate.toFixed(4) } }); }
  if (u.pathname === '/tape') return send(200, u.searchParams.get('view') === 'public' ? publicTapeFor(clockNow(), u) : tapeFor(clockNow(), u));
  if (u.pathname === '/events') return send(200, eventsFor(clockNow(), u));
  if (u.pathname === '/dev/token') { const h = u.searchParams.get('handle'); return TOKENS.tokens[h] ? send(200, { handle: h, token: TOKENS.tokens[h], dev: TOKENS.dev }) : send(404, { error: `no owner token for ${h} (the Locals have none)` }); }
  if (u.pathname === '/seek') { const t = parseT(u.searchParams.get('t')); if (t === null) return send(400, { error: 't=<minutes | D2 22:00>' }); clockNow(); T = Math.min(T1, Math.max(T0, t)); return send(200, { t: Math.floor(T), ts: stamp(Math.floor(T)) }); }
  if (u.pathname === '/speed') { const x = +u.searchParams.get('x'); if (!(x >= 0)) return send(400, { error: 'x=<multiplier ≥ 0>' }); clockNow(); speed = x; return send(200, { speed, rate: +(BASE_RATE * speed).toFixed(3) }); }
  if (u.pathname === '/') { const t = clockNow(); return send(200, { run: path.basename(RUN), t, ts: stamp(t), from: T0, to: T1, speed, rate: +(BASE_RATE * speed).toFixed(3), snapshots: SNAPS.length, events: EVENTS.length, loop: LOOP,
    view: VIEW, archive: ARCHIVE, directorDelay: DELAY, horizon: ARCHIVE ? T1 : t - DELAY, tokens: TOKENS.dev ? 'dev (derived from the run name: GET /dev/token?handle=)' : 'owner-tokens.json', owners: Object.keys(TOKENS.tokens).length }); }
  send(404, { error: 'GET /state[?view=public|owner|director|full][&lag=<min>] · /tape?from=&to=[&view=public&lag=<min>] · /events?since= · /dev/token?handle= · /seek?t= · /speed?x= · /' });
});
server.on('error', e => die(e.code === 'EADDRINUSE' ? `port ${PORT} is taken (the replay default is 5262; the sim's own server uses 5251)` : e.message));
server.listen(PORT, '127.0.0.1', () => {
  console.log(`sim replay: ${path.relative(os.homedir(), RUN)} · ${SNAPS.length} snapshots, ${EVENTS.length} events · ${stamp(T0)} → ${stamp(T1)}`);
  console.log(`  ×${speed} of the run's pace (1 day = ${DAY} min): ${(BASE_RATE * speed).toFixed(2)} game min/s${LOOP ? ' · loops' : ''} · http://127.0.0.1:${PORT}/state`);
  console.log(`  the city: ?sim=live&simport=${PORT} · ${ARCHIVE ? 'ARCHIVE: a finished season, everything visible' : `a live season: the public view, the director's cut ${DELAY} game min behind`} · owner tokens: ${TOKENS.dev ? 'dev (GET /dev/token?handle=)' : "the run's owner-tokens.json"}`); });
if (!QUIET) setInterval(() => { const t = clockNow(); process.stdout.write(`\r  ${stamp(t)} (${t})   `); }, 5000).unref();
if (FOR > 0) setTimeout(() => { console.log('\nsim replay: --for elapsed, bye'); process.exit(0); }, FOR * 1000);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));
