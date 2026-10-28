import { setupProvenance, semanticSource, fingerprint, seatUsage, spendBySeat } from './evidence.mjs';
// The season runner (GAME.md §25, steps 0 and 1): 30 seats play a whole season from a seed. Scripted bots cost $0; a
// cast with model seats (R2-8) calls a model for them, the fake one unless slime's go names a real endpoint.
// It writes the event log, a checkpoint after every night (so a killed run resumes to the same log), and at the end
// the result and the one-page match report.
// Usage: node core/bench/runner.mjs --seed 404 --rule A [--midseason blackout|crackdown|payday] [--rounds 3]
//          [--out dir] [--feed] [--resume] [--die-at after-night:7|mid-write:7] [--quiet] [--set key=value ...] [--squatter]
//          [--cast trades|layer4|layer3|layer2|layer1|models|models-canny] [--stop-after N]
//          [--briefing current|legacy|starter] [--reply json|tools] [--journal dawn] [--creeds file.json] [--creed-baseline file.txt] [--orders-baseline file.json] [--model-seats N] [--model name] [--model-url url --go "slime's words"] [--model-concurrency 8]
//          [--thinking-seats N] [--model-api openrouter|claude] [--model-key-file path --max-cost usd] [--model-provider json]
//          [--seat-models json]
//        node core/bench/runner.mjs --replay <run folder> --out dir [--quiet]
// --set overrides one of core/numbers.mjs's numbers for this run only (a sensitivity check, not a tuning). Dotted keys
// reach inside a value (hustle.take.lawless=50). A resumed run reapplies the overrides it was started with.
// --squatter swaps one hustler for the squatter bot (the eviction exploit); the default cast is unchanged.
// --cast picks the bots: trades (the default, L2-6: layer 2's seats, every one with a trade it works on any night its
// strategy leaves free), layer3 (L3-5: the trades cast with layer 3 in play, the drugs and the tricks), layer4 (L4-4:
// the layer3 cast with the big score in play: warrants, the vault, guards and fakes), layer2 (each
// trade, a Cop seat and layer 1's types, which hustle instead) or layer1 (the cast layer 1's reports were made
// with). runSeason() itself defaults to layer 1's mix; a resumed run keeps the cast it started with.
// --stop-after N stops at night N's checkpoint, writing no result (a pilot); --resume plays on from there.
// R2-8, model seats: --cast models is the layer4 cast with --model-seats N of its seats played by a model (bots.mjs,
// MODELS_MIX); R5-deals: --cast models-canny is the canny cast with them (MODELS_CANNY_MIX). With no --model-url the
// model is the fake (agents/fake-model.mjs, $0): each model seat's own bot answers through the reply format, on a
// clock that never waits, and the board names it `fake`. A real endpoint is called only
// with --model-url, --go "<slime's words>" and --model <its name>; without the go the runner exits 2 and writes
// nothing, and the run folder keeps the url and every go. --model-concurrency caps the lock's calls at once (8: oMLX
// takes 8 at a time). --thinking-seats N turns thinking on for the first N model seats by id (Q3: off by default).
// SIGINT or SIGTERM aborts the requests in flight and stops the run; --resume plays on. --replay plays a finished (or
// stopped) model season again from its tape, with no model, on a clock that never waits, into a new run folder.
// R2-12, a paid endpoint (agents/openrouter.mjs): --model-key-file names a file whose key goes, as a bearer header,
// only to --model-url, and needs --max-cost, the cap in dollars; the key is never saved, so a resume needs the flag
// again. --model-api openrouter (which needs the key) sends OpenRouter's fields in place of the local model's chat
// template kwargs, with the same messages, and reads the account's balance and the key's limit first, refusing to
// start below the cap; --model-provider '<json>' adds OpenRouter's provider routing. The run folder keeps the API, the
// provider and the cap, and spend.jsonl, a record a request. Once the spend reaches the cap, or the account's credit or
// the key runs out, the season stops as on SIGINT (exit 3); --resume plays on, and may raise --max-cost.
// R7, a mixed season: --seat-models '<json>' gives each model seat its own model, in place of --model, --thinking-seats
// and --model-provider: a list of groups, [{"model": name, "seats": n, "thinking": bool, "provider": {...}}, ...], whose
// seats add up to the model seats (--model-seats, which it sets when left out). The seed deals the groups to the model
// seats (dealSeatModels), so the same seed gives the same model the same seats. Without --model-url the fake answers
// every seat ($0), each still named its model on the board and in its requests; with one, each seat calls its own
// model at that url, under the one --max-cost for the season. A group's provider routing needs --model-api openrouter
// on a paid run. The run folder keeps the groups and the deal, a resume needs the same --seat-models, and the season's
// result and report give a row a model: haul, crimes, deals, lookups, refusals, calls, tokens and spend.
// R8: --briefing starter gives the model seats the starter rulebook (agents/rulebook.mjs); --reply tools has them answer
// with native tool calls (agents/tool-calls.mjs) in place of JSON text, and a --seat-models group's "reply" sets its own
// seats' ("json" or "tools"), the season's flag the rest. JSON stays the default. The run folder keeps both: the
// season's arm and reply in its setup's options and its checkpoint's models, a group's reply with its group; a resume
// must name the same, and a replay plays them.
// R8c, the Claude API direct (agents/anthropic.mjs): --model-api claude sends Anthropic's native Messages body to
// --model-url (https://api.anthropic.com/v1/messages for a real run), its key read from --model-key-file
// (~/.config/anthropic/key when left out) and sent as x-api-key, so Claude seats spend the account's API credits. Each
// call is priced from anthropic.mjs's table for --max-cost and spend.jsonl, and a Claude model with no price refuses to
// start. There is no balance to read first: the run folder (its checkpoint's models.billing) and the first line say the
// Console workspace's spend limit is the hard stop. Mixing: a --seat-models group may name "api": "claude", with its own
// "url" (the Claude API's by default) and "keyFile" (~/.config/anthropic/key by default), so its seats call the Claude
// API while the season's others call --model-url, every endpoint under the one --max-cost. The API is named claude
// (Anthropic's name for it): `anthropic` stays an API the runner doesn't know, as R2-12's checks require.
// R8b: --creeds <file> simulates owners editing their agents' Creeds later in the season (GAME.md §17): a JSON list of
// { day, seat, text }, each set at the start of its day, before any errand, through the owner's trusted context
// (core/rules/memory.mjs), on the season's model seats. Off by default; the season's setup options keep the list (so its
// provenance and every twin check carry it), a resume must name the same, and a replay plays them.
// R8e: --creed-baseline <file> starts every agent's Creed as the file's text (a final line break dropped), set at the
// season's start through the owner's trusted context, before the first checkpoint; the seats count it as the Creed
// their agents were told, so no "Your owner changed your Creed." goes out for it (a later --creeds edit replaces it and
// says so once). The text fits N.creed or the season doesn't start. Off by default; the setup options keep its text and
// sha256, a resume must name a file with the same text, and a replay plays it.
// R10b: a model seat's trade orders (buy, sell, pay: rules/memory.mjs) run its trade every day round, after its own
// call that round if it was called (agents/orders.mjs tradeOrders, the bots' own trade code held to the orders); each
// errand goes through the rules with origin 'orders', and the routine's memory rides in the checkpoint (`routines`).
// --orders-baseline <file> presets every model seat's trade orders, by trade, from a JSON object ({ "dealer": [...],
// ... }), set at the season's start through the owner's trusted context, so the record has them as the owner's; the
// agent can change them. Off by default; the setup options keep the orders and their sha256, a resume must name a file
// with the same orders, and a replay plays them.
// R9b: --journal dawn has the game ask every model seat for a journal entry at dawn on days 2-14, once each night has
// settled (agents/journal.mjs): the season loop yields { round: 'dawn', day, asks: [{ id, view }] }, every model seat's
// together, the model side answers each with its text, and the loop stores each entry, in id order, as a dated journal
// note through the core's memory path (the trusted dawn context), the ledger checked after each. The calls are taped,
// priced and capped as any call. Off by default; the setup options keep it, a resume must name the same, a replay plays
// it, and a seat whose journal has the day's entry already is never asked again.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { newSeason, applyErrand, settleNight, checkLedger, viewFor, defaultPlay, checkPlay } from '../index.mjs';
import { wornOf, wears } from '../rules/state.mjs';
import { N } from '../numbers.mjs';
import { rng, shuffle, hash32 } from '../rng.mjs';
import { makeCast, makeBot, DEFAULT_MIX, CASTS, driverOf } from './bots.mjs';
import { seasonReport } from './report.mjs';
import { seasonMetrics } from './metrics.mjs';
import { firstSales, openingPrices, known, VALUATIONS, SHADOWS } from './passbars.mjs';
import { makeSeat, REPLY_MODES, DEFAULT_REPLY } from '../agents/seat.mjs';
import { briefing, briefingPacket, starterBriefingPacket } from '../agents/briefing.mjs';
import { briefing as legacyBriefing } from './fixtures/legacy-briefing.mjs';
import { fakeHooks } from '../agents/fake-hooks.mjs';
import { fakeModel, manualClock, CHAT_PATH, SEAT_HEADER, CALL_HEADER } from '../agents/fake-model.mjs';
import { openRouter, readKey, spentIn } from '../agents/openrouter.mjs';
import { claudeApi, CLAUDE, CLAUDE_URL, CLAUDE_KEY_FILE, CLAUDE_NOTE, PRICES } from '../agents/anthropic.mjs';
import { JOURNAL_MODES, DEFAULT_JOURNAL, DAWN, DAWN_CONTEXT, dawnDay, dawnNote, entryOf, hasDawnEntry } from '../agents/journal.mjs';
import { tradeLimits, runTradeOrders } from '../agents/orders.mjs';
import { TRADE_ORDER_KINDS, checkMemory } from '../rules/memory.mjs';
import { TRADES } from '../rules/setup.mjs';
import { createFeed } from '../feed.mjs';

// key=value strings -> { key: value }, numbers and true/false parsed.
export function parseSet(list) {
  const out = {};
  for (const item of [].concat(list || [])) {
    const i = String(item).indexOf('=');
    if (i < 1) throw new Error(`--set wants key=value, got ${item}`);
    const raw = String(item).slice(i + 1);
    let value = raw;
    if (raw === 'true' || raw === 'false') value = raw === 'true';
    else if (raw.trim() !== '' && !Number.isNaN(Number(raw))) value = Number(raw);
    out[String(item).slice(0, i)] = value;
  }
  return out;
}

// Assigns into the imported N (a top-level key as written, or a dotted path into one) and returns the old value.
function setNumber(key, value) {
  let obj = N;
  let last = key;
  if (!(key in N)) {
    const parts = key.split('.');
    last = parts.pop();
    // N's own names can hold dots ('gap.briefing'), so the path starts at the longest name N has.
    let i = parts.length;
    while (i > 1 && !(parts.slice(0, i).join('.') in N)) i -= 1;
    if (i > 1) parts.splice(0, i, parts.slice(0, i).join('.'));
    for (const p of parts) {
      if (!obj[p] || typeof obj[p] !== 'object') throw new Error(`--set: no number called ${key}`);
      obj = obj[p];
    }
  }
  if (!(last in obj)) throw new Error(`--set: no number called ${key}`);
  const was = obj[last];
  obj[last] = value;
  return was;
}

// Runs fn with the overrides in N, and puts every old value back afterwards: once fn returns, or, when it's async (a
// model season), once it settles.
export function withOverrides(overrides, fn) {
  const undo = [];
  const back = () => {
    for (const [k, was] of undo.reverse()) setNumber(k, was);
  };
  let out;
  try {
    for (const [k, v] of Object.entries(overrides || {})) undo.push([k, setNumber(k, v)]);
    out = fn();
  } catch (e) {
    back();
    throw e;
  }
  if (out && typeof out.then === 'function') return out.finally(back);
  back();
  return out;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.resolve(here, '..');
export const MIDSEASON_ROTATION = ['blackout', 'crackdown', 'payday'];

export function loadItems() {
  return JSON.parse(fs.readFileSync(path.join(CORE, 'data', 'items.json'), 'utf8')).items;
}

// The public sightings at the lock: where each agent was seen on each of the last 3 nights (§6).
function sightingsAt(log, clock) {
  const shows = log.filter(e => e.type === 'show' && e.vis.to === 'all' && e.t < clock).slice(-3);
  const out = {};
  for (const e of shows) for (const [id, place] of Object.entries(e.seen)) (out[id] ||= []).push(place);
  return out;
}

// What a night decided, as a comparable string: every fight's target, kind, winner and arrests, and every missed hit.
function signature(R) {
  const fights = R.fights.map(f => `${f.kind}:${f.target}:${f.winner || '-'}:${f.arrested.join(',')}`).sort();
  const missed = R.missed.map(m => `${m.kind}:${m.leader}>${m.target}@${m.place}`).sort();
  return JSON.stringify([fights, missed]);
}

// Haul to date (§27, for testing), under each valuation (passbars.mjs's VALUATIONS, or those named): cash, an even share
// of the crew stash, and every piece held at a price. `paid`, the official (R4-1): that copy's own first sale on the
// list, from the record's `buy` events. The shadows: `mark`, its trait's latest list price (the measure before R4-1);
// `open`, its trait's opening list price, from the season's drop. A fake never mints, so it counts for nothing (layer 4).
export function haulsNow(s, log, valuations = VALUATIONS) {
  const price = {
    paid: () => {
      const paid = firstSales(log);
      return k => known(paid[k], `sale on the list for ${k}, held`);
    },
    mark: () => k => s.traits[s.copies[k].trait].last || 0,
    open: () => {
      const open = openingPrices(log);
      return k => known(open[s.copies[k].trait], `opening price for ${s.copies[k].trait}`);
    },
  };
  return Object.fromEntries(valuations.map(v => [v, haulAt(s, price[v]())]));
}
// The official haul to date.
export const haulNow = (s, log) => haulsNow(s, log, ['paid']).paid;

// Haul to date at one price a piece.
function haulAt(s, price) {
  const out = {};
  for (const id of Object.keys(s.agents).sort()) {
    const a = s.agents[id];
    out[id] = s.over ? a.mainland : a.cash;
  }
  for (const k of Object.keys(s.copies)) {
    const h = s.copies[k].holder;
    if ((h.k === 'agent' || h.k === 'minted') && out[h.id] != null && !s.copies[k].fake) out[h.id] += price(k);
  }
  for (const c of Object.values(s.crews)) {
    const pieces = Object.keys(s.copies).filter(k => s.copies[k].holder.k === 'crew' && s.copies[k].holder.id === c.id && !s.copies[k].fake);
    const worth = c.cash + pieces.reduce((t, k) => t + price(k), 0);
    for (const m of c.members) out[m] += worth / c.members.length;
  }
  return out;
}

// Guns at the lock (§8: +1 a person who holds one): how many agents and crew stashes hold, and how many agents are armed.
function gunsAt(s) {
  const agents = Object.values(s.agents).filter(a => !a.jail);
  const held = agents.reduce((t, a) => t + ((a.goods && a.goods.guns) || 0), 0) + Object.values(s.crews).reduce((t, c) => t + ((c.goods && c.goods.guns) || 0), 0);
  return { held, armed: agents.filter(a => a.goods && a.goods.guns >= 1).length };
}

// Layer 4 (§4, §19): the fakes worn at the lock, and those an agent in real shades could see, there on another agent;
// null when none is worn.
function fakesAt(s) {
  const free = Object.keys(s.agents).sort().filter(id => !s.agents[id].jail);
  const worn = free.flatMap(id => wornOf(s, id).filter(k => s.copies[k].fake).map(k => [id, k]));
  if (!worn.length) return null;
  const shades = free.filter(id => wears(s, id, 'shades'));
  return { worn: worn.map(([, k]) => k), seen: worn.filter(([id]) => shades.some(x => x !== id)).map(([, k]) => k) };
}

function writeAtomic(file, text) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function runSeason(opts) {
  return withOverrides(overridesOf(opts), () => {
    const step = seasonSteps({ ...opts, overrides: overridesOf(opts) }).next();
    if (!step.done) throw new Error('a cast with model seats plays through runModelSeason');
    return step.value;
  });
}

// The overrides a run plays with: its own, or on a resume the ones it was started with.
function overridesOf(opts) {
  if (opts.resume) {
    const ck = path.join(opts.outDir, `${opts.seed}-${opts.rule || 'A'}`, 'checkpoint.json');
    if (fs.existsSync(ck)) return JSON.parse(fs.readFileSync(ck, 'utf8')).bench.overrides || {};
  }
  return opts.overrides || {};
}

// One season, step by step: the one copy of the season loop (CLAUDE.md: every fact has one owner). A bot plays where it
// sits. A model seat's call is handed to the caller, yielded as { round, id, view, apply } by day, one at a time, or as
// { round: 'lock', asks: [{ id, view, defaultPlay }] } at the lock, every free model seat's together (R9b, with
// --journal dawn: { round: 'dawn', day, asks: [{ id, view }] } first thing on days 2-14, every model seat's together,
// answered with each seat's { text }); the caller sends
// back the seat's answer (`side`, from runModelSeason, is the model's side). A cast with no model seat never yields,
// so runSeason drives it in one step, synchronously, as before. `onNight(d)` hears of each night once its checkpoint
// is written (R2-12: a paid season's spend line). `observe` (R3-1, the crime diagnosis, core/bench/crime.mjs) only
// watches: at each lock it gets { at: 'lock', day, state, log, plays, cast }, and once the night has settled
// { at: 'night', day, lock, state, log, result }; nothing it does reaches the season.
function* seasonSteps({
  seed, rule = 'A', midseason, rounds = 3, mix = DEFAULT_MIX, outDir, resume = false, dieAt = null, quiet = true,
  overrides = {}, stopAfter = null, model = FAKE, onNight = null, observe = null, botFactory = makeBot, controllerLabels = {}, controllerSource = null,
  briefing: arm = DEFAULT_BRIEFING, drivers = null, reply = DEFAULT_REPLY, creeds = null, replies = null, creedBaseline = null,
  journal = DEFAULT_JOURNAL, ordersBaseline = null, feed = false,
}, side = null) {
  if (botFactory !== makeBot && (!Object.keys(controllerLabels).length || !controllerSource)) throw new Error('custom controller requires labels and an implementation source fingerprint');
  creeds = creeds && creeds.length ? creeds : null;
  const badArm = armRefusal(arm) || replyRefusal(reply) || journalRefusal(journal) || (creeds ? creedsRefusal(creeds) : null) || (creedBaseline === null ? null : baselineRefusal(creedBaseline)) || (ordersBaseline === null ? null : ordersBaselineRefusal(ordersBaseline));
  if (badArm) throw refusal(badArm);
  midseason = midseason || MIDSEASON_ROTATION[seed % MIDSEASON_ROTATION.length];
  const dir = path.join(outDir, `${seed}-${rule}`);
  const fresh = resume ? null : makeCast(seed, mix);
  if (fresh && fresh.some(c => c.model) && !side) throw new Error('a cast with model seats plays through runModelSeason');
  const notSeats = fresh && creeds ? creedSeatsRefusal(creeds, fresh) : null;
  if (notSeats) throw refusal(notSeats);
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, 'events.jsonl');
  const ckFile = path.join(dir, 'checkpoint.json');
  const feedFile = path.join(dir, 'feed.jsonl');
  let exporter = feed ? createFeed({ rounds }) : null;
  let feedBytes = 0;
  const publish = (state, history, step) => {
    if (!exporter) return;
    const frame = exporter.sample(state, history, step);
    if (!frame) return;
    const line = `${JSON.stringify(frame)}\n`;
    fs.appendFileSync(feedFile, line);
    feedBytes += Buffer.byteLength(line);
  };
  const die = dieAt ? { kind: dieAt.split(':')[0], night: Number(dieAt.split(':')[1]) } : null;
  const say = msg => { if (!quiet) console.log(msg); };

  let s;
  let log;
  let bench;
  let cast;
  let saved = null;
  // What each bot remembers (bots.mjs), saved with every checkpoint so a resumed season plays the same.
  let memos = {};
  // R10b: what each model seat's trade routine remembers (agents/orders.mjs tradeOrders), saved the same way, apart from
  // the seat's own bot's memo (the fake model's).
  let routines = {};
  // Each bot, made once the season is set up; the fake model's hooks read the model seats' own.
  const bots = {};
  if (resume) {
    if (!fs.existsSync(ckFile)) throw new Error(`nothing to resume in ${dir}`);
    const ck = JSON.parse(fs.readFileSync(ckFile, 'utf8'));
    ({ state: s, bench, cast } = ck);
    // The season keeps the briefing arm it started with: another is refused before anything is written.
    const otherArm = resumeArmRefusal(bench.options?.briefing, arm) || resumeReplyRefusal(bench.options?.reply, reply) || resumeJournalRefusal(bench.options?.journal, journal) || resumeCreedsRefusal(bench.options?.creeds, creeds) || resumeBaselineRefusal(bench.options?.creedBaseline, creedBaseline) || resumeOrdersRefusal(bench.options?.ordersBaseline, ordersBaseline);
    if (otherArm) throw refusal(otherArm);
    if (feed && !ck.feed) throw refusal('this season has no feed checkpoint; start a new run with --feed');
    if (ck.feed) {
      if (!fs.existsSync(feedFile) || fs.statSync(feedFile).size < ck.feed.bytes) throw new Error('feed is shorter than its checkpoint');
      exporter = createFeed({ rounds: bench.rounds, saved: ck.feed.exporter });
      feedBytes = ck.feed.bytes;
      fs.truncateSync(feedFile, feedBytes);
    }
    if (cast.some(c => c.model) && !side) throw new Error('a cast with model seats plays through runModelSeason');
    memos = ck.memos || {};
    routines = ck.routines || {};
    saved = ck.models || null;
    const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).slice(0, ck.logLength);
    fs.writeFileSync(logFile, lines.map(l => `${l}\n`).join(''));
    log = lines.map(l => JSON.parse(l));
    say(`resumed ${dir} at day ${s.day} (${log.length} events)`);
  } else {
    cast = fresh;
    // R7: in a mixed season each model seat's driver is its own model (`drivers`, by id).
    const agents = cast.map(c => ({ id: c.id, name: c.name, trade: c.trade, driver: drivers && c.model && drivers[c.id] !== undefined ? drivers[c.id] : driverOf(c, model) }));
    const r = newSeason({ seed, rule, midseason, items: loadItems(), agents });
    s = r.state;
    log = [...r.events];
    if (exporter) fs.writeFileSync(feedFile, '');
    publish(s, log, { kind: 'setup' });
    bench = {
      seed, rule, midseason, rounds, overrides,
      // The briefing arm, when it isn't the current one, is part of the setup, so its provenance and every twin check
      // carry it.
      options: { squatter: mix.squatter || 0, cast: castName(mix), ...(Object.keys(controllerLabels).length ? {controllers:controllerLabels,controllerSource,factory:fingerprint(botFactory.toString())} : {}), ...('models' in mix ? { modelSeats: mix.models } : {}), ...(arm === DEFAULT_BRIEFING ? {} : { briefing: arm }), ...(reply === DEFAULT_REPLY ? {} : { reply }), ...(creeds ? { creeds } : {}), ...(replies ? { replies } : {}), ...(creedBaseline === null ? {} : { creedBaseline: baselineRecord(creedBaseline) }), ...(journal === DEFAULT_JOURNAL ? {} : { journal }), ...(ordersBaseline === null ? {} : { ordersBaseline: ordersRecord(ordersBaseline) }) },
      nights: [], ledger: { errands: 0, nights: 0, failed: 0 },
    };
    // R8e: the baseline Creed, every agent's, at the start, through the owner's own context, the ledger checked.
    if (creedBaseline !== null) for (const id of Object.keys(s.agents).sort()) {
      const res = applyErrand(s, { by: id, kind: 'creed', text: creedBaseline }, { source: 'owner' });
      if (!res.ok) throw new Error(`--creed-baseline: ${id}'s Creed was refused: ${res.why}`);
      s = res.state;
      log.push(...res.events);
      publish(s, log, { kind: 'setup' });
      checkLedger(s, `setup ${id} creed`);
      bench.ledger.errands += 1;
    }
    // R10b: the owner's preset trade orders (--orders-baseline), every model seat's by its trade, at the start, through
    // the owner's own context, so the record has them as the owner's; never a bot seat's.
    if (ordersBaseline !== null) for (const c of cast.filter(x => x.model && (ordersBaseline[x.trade] || []).length).sort((x, y) => (x.id < y.id ? -1 : 1))) {
      const res = applyErrand(s, { by: c.id, kind: 'orders', orders: ordersBaseline[c.trade] }, { source: 'owner' });
      if (!res.ok) throw new Error(`--orders-baseline: ${c.id}'s trade orders were refused: ${res.why}`);
      s = res.state;
      log.push(...res.events);
      publish(s, log, { kind: 'setup' });
      checkLedger(s, `setup ${c.id} orders`);
      bench.ledger.errands += 1;
    }
  }
  if (!resume) bench.provenance = setupProvenance({ cast, bench, initial: log.find(e => e.type === 'season'), numbers: N });
  if (resume && bench.provenance && (Object.entries(bench.provenance.source || {}).some(([k,v])=>Object.hasOwn(semanticSource(),k) && semanticSource()[k]!==v) || bench.provenance.config?.numbers && bench.provenance.config.numbers !== fingerprint(N))) throw new Error('resume source/settings differ from the certified season setup');
  if (resume && (!isDeepStrictEqual(bench.options.controllers || {},controllerLabels) || (bench.options.controllerSource || null)!==controllerSource || bench.options.factory && bench.options.factory!==fingerprint(botFactory.toString()))) throw new Error('resume requires the original controller labels/factory');
  // R2-8: the model seats, their model, the per-season secret and the tape, set up before the first checkpoint.
  const seats = new Set(cast.filter(c => c.model).map(c => c.id));
  // R8e: a fresh seat counts the baseline as the Creed its agent was told (seat.mjs's memo), so the first call says no change.
  if (seats.size) side.start({ dir, cast, bots, saved, seed, rule, rounds, creedSeen: creedBaseline === null ? null : JSON.stringify([creedBaseline]) });
  const checkpoint = () => JSON.stringify({ state: s, logLength: log.length, bench, cast, memos, ...(exporter ? { feed: { bytes: feedBytes, exporter: exporter.save() } } : {}), ...(Object.keys(routines).length ? { routines } : {}), ...(seats.size ? { models: side.save() } : {}) });
  if (!resume) {
    fs.writeFileSync(logFile, log.map(e => `${JSON.stringify(e)}\n`).join(''));
    checkLedger(s, 'after setup');
    writeAtomic(ckFile, checkpoint());
  }

  // §23: the ledger is checked after every errand and every night. A failure throws and stops the season, so a season
  // that finishes has failed = 0; the counts say how many checks it took to get there.
  bench.ledger ||= { errands: 0, nights: 0, failed: 0 };
  // The cast where every seat trades (it has seats that work a trade) plays L2-6b's habits (bots.mjs, `cfg.every`);
  // layer 2's and layer 1's casts keep their bots as they were, so their reports reproduce.
  const every = cast.some(c => c.works);
  Object.assign(bots, Object.fromEntries(cast.map(c => [c.id, botFactory(every ? { ...c, every } : c, (memos[c.id] ||= {}))])));
  const ids = Object.keys(s.agents).sort();
  const append = events => {
    if (!events.length) return;
    log.push(...events);
    fs.appendFileSync(logFile, events.map(e => `${JSON.stringify(e)}\n`).join(''));
  };
  // One errand into the rules for an agent, the ledger checked after it; what it did, as a seat's tools read it.
  // R10b: a trade routine's errand goes in with the runner's own context, origin 'orders' (rules/errand.mjs); a model
  // seat's own, with origin 'model', so a change to its standing orders is on the record as the model's.
  const MODEL = { origin: 'model' };
  const errand = (id, d, round, context = {}) => e => {
    const res = applyErrand(s, { ...e, by: id }, context);
    s = res.state;
    append(res.events);
    publish(s, log, { kind: 'errand', round });
    checkLedger(s, `day ${d} round ${round} ${id} ${e.kind}`);
    bench.ledger.errands += 1;
    const bad = res.events.find(x => x.type === 'invalid');
    return { ok: res.ok, why: res.why, kind: bad ? bad.kind : undefined, actions: res.actions, legal: res.legal, receipt: res.receipt, quote: res.quote };
  };

  // R10b: a model seat's trade orders, carried out for this round (agents/orders.mjs tradeOrders): each errand through
  // the rules with origin 'orders', and what the rules did with it back to the routine's memory.
  const castOf = Object.fromEntries(cast.map(c => [c.id, every ? { ...c, every } : c]));
  const tradeRound = (id, d, round) => {
    const view = viewFor(s, log, id, 'agent');
    if (!tradeLimits(view)) return;
    const ctx = { seed, day: d, round, rounds, rng: rng(seed, 'orders', id, d, round) };
    const send = errand(id, d, round, { origin: 'orders' });
    runTradeOrders(view, ctx, castOf[id], (routines[id] ||= {}), e => {
      const at = log.length;
      return { ...send(e), events: log.slice(at) };
    });
  };
  while (!s.over) {
    const d = s.day;
    // R9b: dawn, after the night before settled (days 2-14), each model seat's journal entry, asked together, each
    // reading its own view of this one state; stored in id order through the trusted dawn context. An empty reply
    // stores nothing.
    if (journal === DAWN && seats.size && dawnDay(d)) {
      const asks = [...seats].sort().filter(id => !hasDawnEntry(log, id, d)).map(id => ({ id, view: viewFor(s, log, id, 'agent') }));
      const answers = asks.length ? (yield { round: 'dawn', day: d, asks }) : {};
      for (const { id } of asks) {
        const line = entryOf(answers[id] && answers[id].text);
        if (!line) continue;
        const res = applyErrand(s, dawnNote(id, line), DAWN_CONTEXT);
        if (!res.ok) throw new Error(`--journal dawn: ${id}'s entry on day ${d} was refused: ${res.why}`);
        s = res.state;
        append(res.events);
        publish(s, log, { kind: 'dawn' });
        checkLedger(s, `day ${d} ${id} dawn entry`);
        bench.ledger.errands += 1;
      }
    }
    // R8b: the owners' Creed edits for today (--creeds), first thing, through the owner's own context.
    for (const c of (creeds || []).filter(x => x.day === d)) {
      const res = applyErrand(s, { by: c.seat, kind: 'creed', text: c.text }, { source: 'owner' });
      if (!res.ok) throw new Error(`--creeds: ${c.seat}'s Creed on day ${d} was refused: ${res.why}`);
      s = res.state;
      append(res.events);
      publish(s, log, { kind: 'errand', round: 0 });
      checkLedger(s, `day ${d} ${c.seat} creed`);
      bench.ledger.errands += 1;
    }
    // The day: a few rounds of errands and messages, in an order the seed shuffles. A model seat answers when it wakes
    // (Q2: round 1, then only when a sit-down waits for it), its errands going into the rules as it sends them.
    for (let round = 1; round <= rounds; round++) {
      for (const id of shuffle(rng(seed, 'order', d, round), ids)) {
        const view = viewFor(s, log, id, 'agent');
        if (seats.has(id)) {
          if (side.wakes(view, round, side.seen ? side.seen(id) : -1)) yield { round, id, view, apply: errand(id, d, round, MODEL), validatePlay: p => checkPlay(s,id,p,s.day), currentView: () => viewFor(s,log,id,'agent') };
          // R10b: after the seat's own call this round (if it was called), its trade orders run its trade, from its own
          // view as the call left it.
          tradeRound(id, d, round);
          continue;
        }
        for (const e of bots[id].day(view, { seed, day: d, round, rounds, rng: rng(seed, 'bot', id, d, round) })) errand(id, d, round)(e);
      }
    }
    // The lock: one play each. The model seats' calls go out together, each reading its own view of this one state.
    const plays = {};
    const asks = [];
    for (const id of ids) {
      if (s.agents[id].jail) continue;
      const view = viewFor(s, log, id, 'agent');
      if (seats.has(id)) {
        asks.push({ id, view, defaultPlay: defaultPlay(s, id, d), validatePlay: p => checkPlay(s,id,p,s.day), currentView: () => viewFor(s,log,id,'agent') });
        continue;
      }
      const { play, reason } = bots[id].night(view, { seed, day: d, round: 'night', rng: rng(seed, 'bot', id, d, 'night') });
      plays[id] = { ...play, reason };
    }
    if (asks.length) {
      // Each play goes with who made it (§17; R2-1 puts it on the record): the model, standing orders or the default.
      const answers = yield { round: 'lock', asks };
      for (const { id } of asks) plays[id] = { ...answers[id].play, origin: answers[id].origin };
    }
    if (observe) observe({ at: 'lock', day: d, state: s, log, plays, cast });
    const seen = sightingsAt(log, s.clock);
    const guns = gunsAt(s);
    const fakes = fakesAt(s);
    // §27 "places matter": the same plays with places ignored. Pure, so it changes nothing.
    const cf = settleNight(s, plays, { ignorePlaces: true });
    const real = settleNight(s, plays);
    const atLock = s;
    s = real.state;
    const nightEnd = log.length + real.beforeDawn.eventCount;
    append(real.events);
    if (exporter) publish(real.beforeDawn.state, log.slice(0, nightEnd), { kind: 'night' });
    publish(s, log, { kind: 'dawn' });
    if (observe) observe({ at: 'night', day: d, lock: atLock, state: s, log, result: real });
    checkLedger(s, `night ${d}`);
    bench.ledger.nights += 1;

    const R = real.fights;
    const hauls = haulsNow(s, log);
    const hits = Object.keys(real.plays).sort().filter(id => real.plays[id].kind === 'hit').map(id => {
      const p = real.plays[id];
      return {
        leader: id, target: p.target, place: p.place,
        found: R.fights.some(f => f.kind === 'hit' && f.attackers.some(g => g.leader === id)),
        sighted: (seen[p.target] || []).includes(p.place),
      };
    });
    bench.nights.push({
      night: d,
      placesChanged: signature(cf.fights) !== signature(R),
      fights: R.fights.map(f => ({
        kind: f.kind, target: f.target, place: f.place, level: f.level, winner: f.winner,
        attackers: f.attackers.map(g => ({ leader: g.leader, members: g.members, strength: g.strength })),
        defence: f.defence, cops: f.cops, arrested: f.arrested, backingDecided: f.backingDecided,
        ...(f.patrols ? { patrols: f.patrols } : {}),
        // Layer 3: who tipped it right, and whose bribe kept its city cops out (§13), only when there are any.
        ...(f.tippers ? { tippers: f.tippers } : {}), ...(f.bribers ? { bribers: f.bribers } : {}),
        // Layer 4: the vault fight's guards and their strength (§13), as its patrols are kept, only when there are any.
        ...(f.guards ? { guards: f.guards, guard: f.guard } : {}),
      })),
      // Each target's hit on a backer of the attack on it, under either rule; whether it cut the backer is the bars'
      // reading of this night's record (passbars.mjs, the backing rules).
      cutByTarget: R.cutByTarget,
      hits,
      haul: hauls.paid,
      // R4-1: the haul to date under each shadow valuation.
      shadow: Object.fromEntries(SHADOWS.map(v => [v, hauls[v]])),
      guns,
      ...(fakes ? { fakes } : {}),
    });
    if (die && die.kind === 'mid-write' && die.night === d) process.kill(process.pid, 'SIGKILL');
    writeAtomic(ckFile, checkpoint());
    if (die && die.kind === 'after-night' && die.night === d) process.kill(process.pid, 'SIGKILL');
    say(`night ${d}: ${R.fights.length} fights, ${R.missed.length} missed, places ${bench.nights[bench.nights.length - 1].placesChanged ? 'changed' : 'did not change'} the result`);
    if (onNight) onNight(d);
    if (stopAfter === d && !s.over) return { dir, stopped: d };
  }

  // The model seats' records go to the bars (§27's call ceiling), as the checkpoint keeps them; the season is played.
  // R7: a mixed season's calls, tokens and spend, seat by seat, from its tape and its spend record, for the rows by model.
  const usage = seats.size && side.usage ? side.usage() : null;
  const metrics = seasonMetrics(s, log, seats.size ? { ...bench, models: side.save(), ...(usage ? { usage } : {}) } : bench, cast);
  fs.writeFileSync(path.join(dir, 'result.json'), `${JSON.stringify(metrics, null, 1)}\n`);
  fs.writeFileSync(path.join(dir, 'report.md'), seasonReport(metrics));
  return { dir, metrics };
}

// --- R2-8: the model's side of a season ------------------------------------------------------------------------------
// The fake's name on the board, and its url: in-process, any URL with the endpoint's path will do, since the fake never
// reaches the network.
export const FAKE = 'fake';
const IN_PROCESS = `http://fake.invalid${CHAT_PATH}`;
const turn = () => new Promise(resolve => setImmediate(resolve));

// Q2 (the orchestrator's call, 10-15): a model seat is called in round 1 and at the lock, and in a later round only when
// a sit-down waits for it: one asked of it, or one open whose turn is its own (the other side spoke last, or accepted
// its ask and nothing has been said since). R4-3: a sit-down now lasts (sitdownDays), so only what happened in it today
// wakes the seat again: an ask, a message or an acceptance from an earlier day had its call in round 1. An acceptance is
// read off the view's `acted` (who has acted in it today), since a day's meeting now needs both sides (R4-3's review).
// R5-deals (the review): a hand-over wakes the seat too, only for a deal it agreed to that the hand-over leaves it owing
// on (the view's `deals`): goods that came for cash it hasn't paid, or cash that came for goods it hasn't given, so it
// can settle before the lock; and only once for each hand-over, one its own call hasn't read yet (`seen`: the last
// event the seat's last call read, from its memo; -1 when it has read none). An offer it never agreed to, and its
// offerer's hand-overs against it, wake nobody. The call ceiling (N.callCeiling) still bounds every call.
export function wakes(view, round, seen = -1) {
  if (round === 1) return true;
  const me = view.me.id;
  const today = day => !(day < view.day);
  const accepted = sd => (sd.acted ? sd.acted.includes(sd.with) : today(sd.met));
  const came = d => d.incomingAt;
  return view.me.sitdowns.some(sd => (sd.state === 'asked' && sd.asked === 'them' && today(sd.day))
    || (sd.state === 'open' && (sd.said.length ? sd.said[sd.said.length - 1].from !== me && today(sd.said[sd.said.length - 1].day) : sd.asked === 'me' && accepted(sd))))
    || (view.me.deals || []).some(d => d.agreed && d.owes === 'me' && Number.isInteger(came(d)) && came(d) > seen);
}

// The fetch the seats call through, stopped with the run: once `signal` aborts (the runner on SIGINT or SIGTERM), every
// request in flight is aborted, so none stays queued at the model's server (the brain, 09-23: a killed run left its
// requests queued in oMLX), and any later one fails at once.
export function stoppable(send, signal) {
  if (!signal) return send;
  return (url, init = {}) => send(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, signal]) : signal });
}

// The per-season secret the handles' shuffle deals from (the orchestrator's call, 10-15: the seed is public, so never
// the seed). Drawn when the season starts and kept in the run folder (the checkpoint's `models`), never in the state or
// any view. With a real endpoint it is 16 random bytes. With the fake, which no player reads, it is rng's hash of the
// seed, the rule, "secret" and 1 to 4, in hex, so a test season repeats.
function secretOf(real, seed, rule) {
  if (real) return crypto.randomBytes(16).toString('hex');
  return [1, 2, 3, 4].map(i => hash32(`${seed}|${rule}|secret|${i}`).toString(16).padStart(8, '0')).join('');
}

// At most `cap` calls at once, the next starting as one ends; the answers in the asks' order.
async function together(asks, cap, call) {
  const out = [];
  let next = 0;
  const one = async () => {
    while (next < asks.length) {
      const i = next++;
      out[i] = await call(asks[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(cap, asks.length) }, one));
  return out;
}

const keyOf = init => {
  const h = new Headers(init.headers);
  return `${h.get(SEAT_HEADER)}#${h.get(CALL_HEADER)}`;
};

// The briefing arms (--briefing), for the paired briefing experiment: `current` (agents/briefing.mjs) by default, or
// `legacy`, the frozen formatter the $0 diagnostic compares (bench/fixtures/legacy-briefing.mjs), called the same way;
// R8, `starter`, the current story and menu with the starter rulebook (agents/rulebook.mjs).
// Only the text a model seat reads changes: its tools, the rules, memory and settlement are the current ones.
export const BRIEFINGS = { current: briefing, legacy: legacyBriefing, starter: starterBriefingPacket };
export const DEFAULT_BRIEFING = 'current';
// Why an arm is refused, or null.
const armRefusal = arm => (Object.hasOwn(BRIEFINGS, arm) ? null : `--briefing takes current or legacy, not ${arm} (or starter, R8's rulebook)`);
// R8: why a reply mode (--reply, or a group's "reply") is refused, or null; and a resume's, as the arm's.
const replyRefusal = mode => (REPLY_MODES.includes(mode) ? null : `--reply takes ${REPLY_MODES.join(' or ')}, not ${mode}`);
// R8b: why a --creeds list is refused, or null: a list of { day, seat, text }, a day of the season, the owner's words
// up to N.creed characters, one a seat a day; its seats the season's model seats (creedSeatsRefusal, once the cast is
// dealt); and a resume's, which must name the same list.
export function creedsRefusal(creeds) {
  if (!Array.isArray(creeds)) return '--creeds takes a JSON list of { day, seat, text }';
  const seen = new Set();
  for (const [i, c] of creeds.entries()) {
    const what = `--creeds, entry ${i + 1}`;
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).sort().join() !== 'day,seat,text') return `${what}: an entry has day, seat and text, and nothing else`;
    if (!Number.isInteger(c.day) || c.day < 1 || c.day > N.nights) return `${what}: its day is a whole number from 1 to ${N.nights}`;
    if (typeof c.seat !== 'string' || !c.seat) return `${what}: its seat is an agent's id`;
    if (typeof c.text !== 'string' || c.text.length > N.creed) return `${what}: its text is the owner's words, up to ${N.creed} characters`;
    if (seen.has(`${c.day} ${c.seat}`)) return `${what}: one Creed a seat a day`;
    seen.add(`${c.day} ${c.seat}`);
  }
  return null;
}
const creedSeatsRefusal = (creeds, cast) => {
  const seats = cast.filter(c => c.model).map(c => c.id);
  const bad = creeds.find(c => !seats.includes(c.seat));
  return bad ? `--creeds: ${bad.seat} isn't one of this season's model seats (${seats.join(', ') || 'none'}), and only a model seat reads its Creed` : null;
};
const resumeCreedsRefusal = (was = null, now = null) => (isDeepStrictEqual(was || null, now || null) ? null
  : was ? "this season's owners set Creeds: resume it with the same --creeds" : 'this season had no --creeds: resume it without');
// R8e: why a baseline Creed is refused, or null: the owner's words, nonempty, up to N.creed characters; what the run
// folder keeps of it (its text and sha256); and a resume's, which must name the same text.
export function baselineRefusal(text) {
  if (typeof text !== 'string' || !text) return '--creed-baseline: the file holds the owner\'s words, and it is empty';
  if (text.length > N.creed) return `--creed-baseline: a Creed is the owner's words, up to ${N.creed} characters (this one is ${text.length})`;
  return null;
}
const baselineRecord = text => ({ text, sha256: crypto.createHash('sha256').update(text).digest('hex') });
const resumeBaselineRefusal = (was = null, now = null) => ((was ? was.text : null) === now ? null
  : was ? `this season's Creeds started from a baseline (sha256 ${was.sha256.slice(0, 12)}): resume it with the same --creed-baseline` : 'this season had no --creed-baseline: resume it without');
// R10b: why an --orders-baseline preset is refused, or null: a JSON object of trade orders by trade ({ "dealer": [{
// "kind": "buy", "item": "doses", "units": 6, "max": 15 }, { "kind": "pay" }], ... }), each list one its trade may
// hold (rules/memory.mjs), trade orders only; a trade left out starts with none, and a Cop has none. What the run folder
// keeps of it (the orders and their sha256); and a resume's, which must name a file with the same orders.
export function ordersBaselineRefusal(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return '--orders-baseline: the file holds a JSON object of trade orders by trade';
  for (const [trade, orders] of Object.entries(o)) {
    if (!TRADES.includes(trade)) return `--orders-baseline: ${trade} isn't a trade (${TRADES.join(', ')})`;
    if (!Array.isArray(orders) || orders.some(x => !x || typeof x !== 'object' || !TRADE_ORDER_KINDS.includes(x.kind))) return `--orders-baseline: ${trade}'s are a list of trade orders (${TRADE_ORDER_KINDS.join(', ')})`;
    const c = checkMemory({ agents: { [trade]: { trade } } }, { by: trade, kind: 'orders', orders });
    if (!c.ok) return `--orders-baseline: ${trade}: ${c.why}`;
  }
  return null;
}
const ordersRecord = orders => ({ orders, sha256: crypto.createHash('sha256').update(JSON.stringify(orders)).digest('hex') });
const resumeOrdersRefusal = (was = null, now = null) => (isDeepStrictEqual(was ? was.orders : null, now) ? null
  : was ? `this season's trade orders started from a preset (sha256 ${was.sha256.slice(0, 12)}): resume it with the same --orders-baseline` : 'this season had no --orders-baseline: resume it without');
// R9b: why a --journal mode is refused, or null; and a resume's, which must name the season's own.
const journalRefusal = mode => (JOURNAL_MODES.includes(mode) ? null : `--journal takes ${DAWN} (or ${DEFAULT_JOURNAL}, the default), not ${mode}`);
const resumeJournalRefusal = (was = DEFAULT_JOURNAL, mode = DEFAULT_JOURNAL) => (was === mode ? null : `this season's journal is ${was}: resume it ${was === DEFAULT_JOURNAL ? 'without --journal' : `with --journal ${was}`}`);
const resumeReplyRefusal = (was = DEFAULT_REPLY, mode = DEFAULT_REPLY) => (was === mode ? null : `this season's reply is ${was}: resume it ${was === DEFAULT_REPLY ? 'without --reply' : `with --reply ${was}`}`);
// A resume plays the arm its season started with (`was`, from its run folder; none recorded is the current one): why
// another is refused, or null.
const resumeArmRefusal = (was = DEFAULT_BRIEFING, arm = DEFAULT_BRIEFING) => (was === arm ? null : `this season's briefing is ${was}: resume it ${was === DEFAULT_BRIEFING ? 'without --briefing' : `with --briefing ${was}`}`);

// The model's side: the seats (seat.mjs) with the briefing (briefing.mjs), the model they call and the tape.
// - The fake (no url): each seat's own bot answers through the reply format (fake-hooks.mjs), on a manual clock, so no
//   window or delay waits in real time; `script` adds the fake's faults.
// - A real endpoint: `url`, `fetch` and slime's `go`, on the real clock.
// - A replay: `replay.tape` answers every call, on a manual clock, with the settings `replay.models` kept.
// The tape (tape.jsonl in the run folder) gets each call as it ends. On a resume the calls after the checkpoint are
// answered from it, so the model is never called twice for one call, and each seat's counter goes on from its memo.
// R2-12: the seats send the body for `api` (with `provider`), a resumed or replayed season's own; `paid` is the paid
// transport, whose cap the checkpoint keeps, and `halt` stops the season once the transport says so.
function modelSide({
  model = FAKE, url = null, go = null, fetch: send = null, concurrency = 8, thinking = 0, script, replay = null, wake = wakes,
  signal = null, api = 'local', provider = null, paid = null, halt = null, briefing: asked = DEFAULT_BRIEFING, mixed = null,
  reply: askedReply = DEFAULT_REPLY, billing = null,
}) {
  const real = url !== null;
  let dir = null;
  const clock = real ? undefined : manualClock();
  const counts = { live: 0, taped: 0 };
  const taped = new Map();
  const seats = {};
  let cfg = null;
  let fake = null;
  let fromTape = null;
  let tapeFile = null;

  // On the manual clock, time moves only while a call waits for a reply that isn't coming (a hang, a delay, or a
  // timeout on the tape): to the end of its window, so nothing waits in real time.
  async function settle(p) {
    if (!clock) return p;
    let done = false;
    p.then(() => { done = true; }, () => { done = true; });
    while (!done) {
      if ([fake, fromTape].some(f => f && f.calls.some(c => c.outcome === 'pending'))) await clock.advance(N['gap.window'] * 1000);
      else await turn();
    }
    return p;
  }

  return {
    wakes: wake,
    // R5-deals: the last event a seat's own last call read (seat.mjs keeps it in its memo), for the wake.
    seen: id => (seats[id] && Number.isInteger(seats[id].memo.seen) ? seats[id].memo.seen : -1),
    counts,
    start({ dir: at, cast, bots, saved, seed, rule, rounds, creedSeen = null }) {
      dir = at;
      const ids = cast.filter(c => c.model).map(c => c.id).sort();
      const was = saved || (replay && replay.models) || null;
      if (saved && saved.model !== model) throw new Error(`this season's model is ${saved.model}: resume it with --model ${saved.model}`);
      if (saved && (saved.url === null) !== !real) throw new Error(saved.url === null ? 'this season called the fake: resume it without --model-url' : 'this season called a real endpoint: resume it with --model-url and --go');
      // The body a resume or a replay builds is the season's own, so the tape's requests are the ones made again.
      const body = was ? { api: was.api || 'local', provider: was.provider || null } : { api, provider };
      // So is the briefing arm, kept with the API when it isn't the current one, and (R8) the reply mode.
      const arm = was ? was.briefing || DEFAULT_BRIEFING : asked;
      const mode = was ? was.reply || DEFAULT_REPLY : askedReply;
      // R7: a mixed season's groups and deal (runModelSeason's `mixed`), its thinking seats those of the groups that think.
      const fresh = mixed ? ids.filter(id => mixed.spec[mixed.seatOf[id]].thinking) : ids.slice(0, thinking);
      cfg = {
        model, url, go: [...(saved ? saved.go : []), ...(go === null ? [] : [go])], concurrency,
        thinking: was ? was.thinking : fresh, secret: was ? was.secret : secretOf(real, seed, rule),
        ...(body.api === 'local' ? {} : { api: body.api }), ...(body.provider ? { provider: body.provider } : {}),
        ...(arm === DEFAULT_BRIEFING ? {} : { briefing: arm }),
        ...(mode === DEFAULT_REPLY ? {} : { reply: mode }),
        ...(paid ? { maxCost: paid.maxCost } : {}),
        ...(billing ? { billing } : {}),
        ...(mixed ? { mixed: mixed.spec, seatOf: mixed.seatOf } : {}),
      };
      // Each seat's model and routing: its group's in a mixed season, else the season's one.
      const group = id => (mixed ? mixed.spec[mixed.seatOf[id]] : null);
      const format = BRIEFINGS[arm];
      // The tape so far, on a resume: every whole line stays (a line a kill cut short goes), and the calls after the
      // checkpoint answer again from it, so a second kill loses none of them.
      tapeFile = path.join(dir, 'tape.jsonl');
      if (saved && fs.existsSync(tapeFile)) {
        const whole = [];
        for (const raw of fs.readFileSync(tapeFile, 'utf8').split('\n')) {
          let l;
          try {
            l = JSON.parse(raw);
          } catch {
            continue;
          }
          whole.push(raw);
          if (!saved.seats[l.seat] || l.call > saved.seats[l.seat].memo.calls) taped.set(`${l.seat}#${l.call}`, raw);
        }
        writeAtomic(tapeFile, whole.map(l => `${l}\n`).join(''));
      } else fs.writeFileSync(tapeFile, '');
      // The model: a replay's tape, or the fake or the real endpoint, with the old tape's calls answered from it.
      let observe = null;
      let live = send;
      if (replay) fake = fakeModel({ tape: replay.tape, clock });
      else if (!real) {
        const h = fakeHooks({ bots, seed, rounds });
        fake = fakeModel({ script, hooks: h.hooks, clock });
        live = fake.fetch;
        // A call answered from the tape still moves its bot's memory on, as the call it stands for did.
        observe = info => {
          h.observe(info);
          if (taped.has(`${info.seat}#${info.call}`)) h.hooks.bot({ seat: info.seat, call: info.call });
        };
      }
      if (taped.size) fromTape = fakeModel({ tape: [...taped.values()].join('\n'), clock });
      // The tape answers by seat and call, in-process, whatever the endpoint's path (OpenRouter's isn't the local
      // one's).
      const route = replay ? fake.fetch : (u, init) => (fromTape && taped.has(keyOf(init)) ? fromTape.fetch(IN_PROCESS, init) : live(u, init));
      const call = stoppable((u, init) => {
        counts[replay || taped.has(keyOf(init)) ? 'taped' : 'live'] += 1;
        return route(u, init);
      }, signal);
      // Each call on the tape as it ends, but one the tape answered, which is on it already, as it was first made; and
      // none once the run is stopping, so a call cut off is made again on a resume.
      const onTape = line => {
        if (signal && signal.aborted) return;
        const l = taped.size ? JSON.parse(line) : null;
        if (!l || !taped.has(`${l.seat}#${l.call}`)) fs.appendFileSync(tapeFile, `${line}\n`);
        // R2-12: a paid call that reached the cap, or found the account's credit or the key spent, stops the season now
        // its line is kept, as SIGINT would: the requests still in flight are aborted.
        if (halt) halt();
      };
      for (const id of ids) {
        // R8c: a group that names its own API calls it, at its own url on a real run.
        const own = group(id) && group(id).api && group(id).api !== body.api ? group(id) : null;
        seats[id] = makeSeat({
          id, url: real && own ? own.url || CLAUDE_URL : url || IN_PROCESS, fetch: call, secret: cfg.secret, clock, model: group(id) ? group(id).model : model, thinking: cfg.thinking.includes(id),
          api: group(id) && group(id).api ? group(id).api : body.api, provider: group(id) ? group(id).provider || null : body.provider,
          // R8: a group's own reply mode, else the season's. R8b: the starter version lets a model call nothing by day
          // (tool_choice "auto"); the current briefing keeps R8's "required".
          reply: group(id)?.reply || mode, dayToolChoice: arm === 'starter' ? 'auto' : 'required',
          // R8b: the new modes mark the fixed part for a provider's cache (seat.mjs); the 10-18 shape stays as it was.
          cacheMark: arm === 'starter' || (group(id)?.reply || mode) === 'tools',
          brief: (r, memory, last, round, context) => (format === briefing ? briefingPacket : format)(r, { memory, last, call: round === 'lock' ? 'lock' : 'round', ...context }),
          observe, memo: saved ? saved.seats[id].memo : creedSeen === null ? {} : { creedSeen }, record: saved ? saved.seats[id].record : [], onTape,
        });
      }
    },
    // What the checkpoint keeps: the settings, the secret, and each seat's memo and record.
    save() {
      return { ...cfg, seats: Object.fromEntries(Object.entries(seats).map(([id, x]) => [id, { memo: x.memo, record: x.record }])) };
    },
    // R7: a mixed season's use, seat by seat (evidence.mjs seatUsage), read off its tape and its spend record; null for
    // a season of one model, whose result stays as it was.
    usage() {
      if (!mixed) return null;
      const read = file => (fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8') : null);
      return seatUsage(this.save(), read('tape.jsonl') || '', read(SPEND_FILE));
    },
    async answer(ask) {
      // R9b: the dawn journal's calls go out together, as the lock's do; each answers with its text.
      if (ask.round === 'dawn') {
        const outs = await settle(together(ask.asks, cfg.concurrency, a => seats[a.id].dawn({ view: a.view })));
        return Object.fromEntries(ask.asks.map((a, i) => [a.id, outs[i]]));
      }
      if (ask.round !== 'lock') return settle(seats[ask.id].call({ view: ask.view, apply: ask.apply, validatePlay: ask.validatePlay, currentView: ask.currentView, round: ask.round }));
      const outs = await settle(together(ask.asks, cfg.concurrency, a => seats[a.id].call({ view: a.view, validatePlay: a.validatePlay, currentView: a.currentView, round: 'lock', defaultPlay: a.defaultPlay })));
      return Object.fromEntries(ask.asks.map((a, i) => [a.id, outs[i]]));
    },
    // A replay must ask for every call on the tape, each as it was made, and a resume each call it answers from the
    // tape; the fake never fails on a season of its own.
    check() {
      const wrong = [fake, fromTape].filter(Boolean).flatMap(f => f.failures);
      if (replay) wrong.push(...fake.unused().map(u => ({ why: 'never asked', ...u })));
      if (wrong.length) throw new Error(`the model's calls went wrong (${wrong.length}): ${JSON.stringify(wrong.slice(0, 3))}`);
    },
    async close() {
      if (fake) await fake.close();
      if (fromTape) await fromTape.close();
    },
  };
}

// R2-12: a paid season's spend record in its run folder, a line a request (openrouter.mjs's onCall).
const SPEND_FILE = 'spend.jsonl';
// A run refused before anything is written or called: the CLI exits 2 with its reason, as its guards do.
const refusal = why => Object.assign(new Error(why), { refused: true });

// What a paid endpoint needs, as the flags name it: why it's refused, or null. The key goes only to the url named and
// never without a cap; OpenRouter's body needs the key, and only it takes provider routing.
// R8c: `groups`, a real run's --seat-models groups that call an API of their own, each with its own key, under the cap.
function paidRefusal({ url, key, api, provider, maxCost, groups = false }) {
  if (api !== 'local' && api !== 'openrouter' && api !== CLAUDE) return `--model-api takes openrouter or ${CLAUDE}, not ${api}`;
  if (key !== null && url === null) return '--model-key-file goes with --model-url: the key is sent only to the endpoint it names';
  if (api === 'openrouter' && key === null) return '--model-api openrouter needs --model-key-file <path>';
  if (api === CLAUDE && key === null && url !== null) return `--model-api ${CLAUDE} needs its key: --model-key-file <path> (${CLAUDE_KEY_FILE} when left out on the command line)`;
  if ((key !== null || groups) && maxCost === null) return `${key !== null ? '--model-key-file' : "--seat-models' groups with an \"api\""} needs --max-cost <usd>: no paid call without a cap`;
  if (key === null && !groups && maxCost !== null) return '--max-cost goes with --model-key-file: only a paid endpoint costs anything';
  if (maxCost !== null && !(Number.isFinite(maxCost) && maxCost > 0)) return '--max-cost takes a positive number of dollars';
  if (provider !== null && api !== 'openrouter') return '--model-provider goes with --model-api openrouter';
  if (provider !== null && !(typeof provider === 'object' && !Array.isArray(provider))) return "--model-provider takes a JSON object, OpenRouter's provider routing";
  return null;
}

// R7: a mixed season's name for its model, where a season of one model keeps the model's name (the checkpoint's
// `models.model`); each seat's own is its group's.
export const MIXED = 'mixed';
const GROUP_KEYS = ['model', 'seats', 'thinking', 'provider', 'reply', 'api', 'url', 'keyFile'];
// The groups of a mixed season (--seat-models), each { model, seats, thinking, provider }: why they're refused, or null.
// A group's provider routing is OpenRouter's, so a run that calls an endpoint sends it only with --model-api openrouter;
// the fake, which no request leaves, takes the groups as the paid run will.
export function seatModelsRefusal(spec, { url = null, api = 'local' } = {}) {
  const what = '--seat-models takes a JSON list of groups, [{"model": "<name>", "seats": n, "thinking": true or false, "provider": {...}}, ...]';
  if (!Array.isArray(spec) || !spec.length) return what;
  for (const g of spec) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) return what;
    const extra = Object.keys(g).find(k => !GROUP_KEYS.includes(k));
    if (extra !== undefined) return `${what}, with no "${extra}"`;
    if (typeof g.model !== 'string' || !g.model.trim()) return `${what}: each group names its model`;
    if (!Number.isInteger(g.seats) || g.seats < 1) return `${what}: each group plays a whole number of seats, 1 or more`;
    if ('thinking' in g && typeof g.thinking !== 'boolean') return `${what}: thinking is true or false`;
    if ('provider' in g && !(g.provider && typeof g.provider === 'object' && !Array.isArray(g.provider))) return `${what}: a provider is a JSON object, OpenRouter's provider routing`;
    // R8c: a group's own API, the Claude API's, with its endpoint and key file; OpenRouter's routing isn't for it.
    if ('api' in g && g.api !== CLAUDE) return `${what}: a group's "api" is "${CLAUDE}" (the Claude API), or left out for the season's`;
    if (('url' in g || 'keyFile' in g) && !('api' in g)) return `${what}: url and keyFile go with a group's "api"`;
    for (const k of ['url', 'keyFile']) if (k in g && !(typeof g[k] === 'string' && g[k].trim())) return `${what}: a group's ${k} is a string`;
    if (g.provider && g.api === CLAUDE) return "--seat-models' provider routing goes with --model-api openrouter";
    if (g.provider && url !== null && api !== 'openrouter') return "--seat-models' provider routing goes with --model-api openrouter";
    if ('reply' in g && !REPLY_MODES.includes(g.reply)) return `${what}: a group's reply is ${REPLY_MODES.join(' or ')}`;
  }
  return null;
}
// The groups as the run folder keeps them: thinking said either way, a provider only where one is named.
export const seatModelsOf = spec => spec.map(g => ({
  model: g.model, seats: g.seats, thinking: g.thinking === true, ...(g.provider ? { provider: g.provider } : {}), ...(g.reply ? { reply: g.reply } : {}),
  ...(g.api ? { api: g.api } : {}), ...(g.url ? { url: g.url } : {}), ...(g.keyFile ? { keyFile: g.keyFile } : {}),
}));
// R8c: the groups that call an API other than the season's, each with its own endpoint and key.
export const ownApi = (g, api) => !!(g && g.api && g.api !== api);
// R7: which model seat plays for which group: the model seats, by id, in an order the seed shuffles (a stream of its
// own, so the cast and every other draw are as they were), the first group's seats first. -> { id: group index }.
// Refused unless the groups' seats add up to the cast's model seats.
export function dealSeatModels(seed, ids, spec) {
  const total = spec.reduce((t, g) => t + g.seats, 0);
  if (total !== ids.length) throw refusal(`--seat-models' groups play ${total} seats, and this cast has ${ids.length} model seats (--model-seats)`);
  const order = shuffle(rng(seed, 'cast', 'seat-models'), ids.slice().sort());
  const out = {};
  let at = 0;
  spec.forEach((g, i) => {
    for (const id of order.slice(at, at + g.seats)) out[id] = i;
    at += g.seats;
  });
  return Object.fromEntries(Object.keys(out).sort().map(id => [id, out[id]]));
}

// A resume calls as its season did, so the requests the tape answers are the ones made again: a paid season only with
// its key and a cap (the key is never saved), with the same API, the same provider routing and the same briefing arm;
// R7, a mixed season with the same groups. Why not, or null.
function resumeRefusal(saved, { api, provider, paid, briefing: arm, mixed = null, reply = DEFAULT_REPLY }) {
  if (!isDeepStrictEqual(saved.mixed || null, mixed)) {
    return saved.mixed ? `this season's seats play several models: resume it with --seat-models '${JSON.stringify(saved.mixed)}'` : `this season plays one model: resume it without --seat-models`;
  }
  if (('maxCost' in saved) !== paid) {
    return 'maxCost' in saved ? 'this season called a paid endpoint: resume it with --model-key-file and --max-cost (the key is never saved)' : 'this season called no paid endpoint: resume it without --model-key-file and --max-cost';
  }
  if ((saved.api || 'local') !== api) return `this season's API is ${saved.api || 'local'}: resume it ${saved.api ? `with --model-api ${saved.api}` : 'without --model-api'}`;
  if (!isDeepStrictEqual(saved.provider || null, provider)) return `this season's provider routing is ${JSON.stringify(saved.provider || null)}: resume it with the same --model-provider`;
  return resumeArmRefusal(saved.briefing, arm) || resumeReplyRefusal(saved.reply, reply);
}

// A season's model settings from its checkpoint (the checkpoint's `models`), or null.
function savedModels(dir) {
  const ck = path.join(dir, 'checkpoint.json');
  return fs.existsSync(ck) ? JSON.parse(fs.readFileSync(ck, 'utf8')).models || null : null;
}

// A season with model seats (R2-8): the same steps as runSeason's, the model seats' calls awaited. A real endpoint is
// called only with slime's words (`go`) and the model's name; otherwise the fake, or a replay's tape, answers. Stopping
// (`signal`) aborts the requests in flight and stops the season before anything else is written. `briefing` names the
// arm every model seat reads (BRIEFINGS: 'current' by default, or 'legacy').
// R2-12, a paid endpoint: `key` (the key itself, handed to the transport and nothing else), `maxCost` (the cap, in
// dollars), `api` ('openrouter': OpenRouter's body and its preflight), `provider` (its routing) and `say` (where the
// money lines go: the preflight's amounts, a spend line after each night and a final one, and the billed total).
// Refused (an error with `refused: true`) before anything is written or called: a guard, a resume that wouldn't call
// as its season did, a season already at its cap, or the preflight. Stopped as SIGINT stops it (an error with `halt`)
// once the spend reaches the cap, or the account's credit or the key runs out.
// -> { dir, metrics } (or { dir, stopped }), and calls: { live, taped }, the requests the model answered and those the
// tape did; with a key, spend: { cost, calls }, the season's so far.
// R8c: `api` may be 'claude' (anthropic.mjs, the Claude API); `groupKeys`, aligned with `seatModels`, the key of each
// group that names its own API (null for the others), each handed only to its group's transport.
export async function runModelSeason(opts) {
  // The keys stay here, handed only to the transports: nothing below gets them.
  const { key = null, groupKeys = null, ...rest } = opts;
  const { url = null, go = null, signal = null, api = 'local', provider = null, maxCost = null, say = console.log, briefing: arm = DEFAULT_BRIEFING, seatModels = null, reply = DEFAULT_REPLY } = rest;
  // R7: a mixed season names each seat's model in its groups, never one model for all of them.
  if (seatModels !== null && (rest.model || provider !== null || rest.thinking)) throw refusal('--seat-models names each seat\'s model, thinking and provider: not with --model, --thinking-seats or --model-provider');
  if (url !== null && !(typeof go === 'string' && go.trim())) throw new Error('a real endpoint is called only with --go "<slime\'s words>" (CLAUDE.md: no model run without his go)');
  if (url !== null && !rest.model && seatModels === null) throw new Error('name the model the endpoint serves: --model <name>');
  if (url !== null && typeof rest.fetch !== 'function') throw new Error('a real endpoint needs the fetch to call it with');
  const groupsPaid = url !== null && Array.isArray(seatModels) && seatModels.some(g => ownApi(g, api));
  const no = paidRefusal({ url, key, api, provider, maxCost, groups: groupsPaid }) || armRefusal(arm) || replyRefusal(reply) || (seatModels === null ? null : seatModelsRefusal(seatModels, { url, api }));
  if (no) throw refusal(no);
  const spec = seatModels === null ? null : seatModelsOf(seatModels);
  // R8c: every model a real run sends to the Claude API has a price, and every group with its own API its key.
  if (url !== null) {
    const claudeModels = spec ? spec.filter(g => (g.api || api) === CLAUDE).map(g => g.model) : api === CLAUDE ? [rest.model] : [];
    const unpriced = claudeModels.find(m => !Object.hasOwn(PRICES, m));
    if (unpriced !== undefined) throw refusal(`no price for ${unpriced}: the Claude API's calls are priced from anthropic.mjs PRICES (${Object.keys(PRICES).join(', ')}), and a model without one doesn't start`);
    const keyless = (spec || []).findIndex((g, i) => ownApi(g, api) && !(groupKeys && typeof groupKeys[i] === 'string' && groupKeys[i]));
    if (keyless >= 0) throw refusal(`--seat-models' group ${keyless + 1} (${spec[keyless].model}) calls the ${spec[keyless].api} API and needs its key (its "keyFile")`);
  }
  const model = spec ? MIXED : rest.model || FAKE;
  const dir = path.join(rest.outDir, `${rest.seed}-${rest.rule || 'A'}`);
  const saved = rest.resume ? savedModels(dir) : null;
  const wrong = saved && resumeRefusal(saved, { api, provider, paid: key !== null || groupsPaid, briefing: arm, mixed: spec, reply });
  if (wrong) throw refusal(wrong);
  // R7, a mixed season's groups and which seat plays for which: a replay's and a resumed season's as their run folder
  // keeps them, a new season's dealt from its seed; refused, before anything is written or called, unless they fit.
  const kept = rest.replay ? rest.replay.models : saved;
  const mixed = kept && kept.mixed ? { spec: kept.mixed, seatOf: kept.seatOf }
    : spec && !saved ? { spec, seatOf: dealSeatModels(rest.seed, makeCast(rest.seed, rest.mix).filter(c => c.model).map(c => c.id), spec) } : null;
  const drivers = mixed ? Object.fromEntries(Object.entries(mixed.seatOf).map(([id, i]) => [id, mixed.spec[i].model])) : null;
  // R8b: a mixed season whose groups answer in other modes than the season's keeps each group's mode in its setup, so
  // the bench never pairs or pools it with a season of other modes (evidence.mjs replyOf).
  const replies = mixed && mixed.spec.some(g => (g.reply || reply) !== reply) ? mixed.spec.map(g => g.reply || reply) : null;
  // The paid transport: the key on each request, the spend counted into the run folder, and the season stopped, as
  // SIGINT stops it, once the transport says so.
  let paid = null, stop = signal, halt = null, usageAtStart = null, billing = null, seasonPaid = null;
  if (key !== null || groupsPaid) {
    const spendFile = path.join(dir, SPEND_FILE);
    const before = rest.resume ? spentIn(spendFile) : { cost: 0, calls: 0 };
    if (before.cost >= maxCost) throw refusal(`this season has spent $${before.cost.toFixed(4)} already, at or past --max-cost $${maxCost}: raise --max-cost to play on`);
    const halting = new AbortController();
    stop = signal ? AbortSignal.any([signal, halting.signal]) : halting.signal;
    halt = () => {
      if (paid.halted && !halting.signal.aborted) halting.abort(paid.halted);
    };
    // R8c: a transport an endpoint (the season's, and each group's own), one tally and one cap across them all, each
    // with its own key; a request goes through its seat's.
    const tally = { cost: before.cost, calls: before.calls };
    const transport = (which, k) => (which === CLAUDE ? claudeApi : openRouter)({ fetch: rest.fetch, key: k, maxCost, tally, onCall: line => fs.appendFileSync(spendFile, `${JSON.stringify(line)}\n`), onHalt: halt });
    seasonPaid = key !== null ? transport(api, key) : null;
    const groupPaid = mixed ? mixed.spec.map((g, i) => (ownApi(g, api) && url !== null ? transport(g.api, groupKeys[i]) : null)) : [];
    const transportOf = init => {
      const id = new Headers(init && init.headers).get(SEAT_HEADER);
      return (mixed && Object.hasOwn(mixed.seatOf, id) && groupPaid[mixed.seatOf[id]]) || seasonPaid;
    };
    paid = {
      fetch: (u, init) => (transportOf(init) || { fetch: rest.fetch }).fetch(u, init), spend: tally, maxCost,
      get halted() {
        return [seasonPaid, ...groupPaid].find(t => t && t.halted)?.halted || null;
      },
    };
    if (api === 'openrouter' && seasonPaid) {
      const check = await seasonPaid.preflight(url);
      if (check.balance !== undefined) say(`OpenRouter: account balance $${check.balance.toFixed(2)} · key limit left ${check.left === null ? 'none set' : `$${check.left.toFixed(2)}`} · cap $${maxCost}`);
      if (check.refused) throw refusal(check.refused);
      usageAtStart = check.usage;
    }
    if ((api === CLAUDE && seasonPaid) || (mixed && mixed.spec.some(g => ownApi(g, api) && g.api === CLAUDE))) {
      billing = CLAUDE_NOTE;
      say(`Claude API: ${CLAUDE_NOTE} · cap $${maxCost}`);
    }
    if (!rest.resume) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(spendFile, '');
    }
  }
  // R7: in a mixed season the line adds each model's spend so far, from the spend record, seat by seat.
  const byModel = () => {
    if (!mixed) return '';
    const file = path.join(dir, SPEND_FILE);
    const seats = spendBySeat(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
    const cost = mixed.spec.map(g => [g.model, 0]);
    for (const [id, x] of Object.entries(seats)) if (mixed.seatOf[id] !== undefined) cost[mixed.seatOf[id]][1] += x.cost;
    return ` · ${cost.map(([m, c]) => `${m} $${c.toFixed(4)}`).join(', ')}`;
  };
  const spendLine = when => `[spend] $${paid.spend.cost.toFixed(4)} of $${maxCost} · ${paid.spend.calls} calls · ${when}${byModel()}`;
  const side = modelSide({ ...rest, model, wake: rest.wakes || wakes, fetch: paid ? paid.fetch : rest.fetch, signal: stop, paid, halt, mixed, billing });
  return withOverrides(overridesOf(rest), async () => {
    const steps = seasonSteps({ ...rest, overrides: overridesOf(rest), model, drivers, replies, ...(paid ? { onNight: d => say(spendLine(`after night ${d}`)) } : {}) }, side);
    try {
      let step = steps.next();
      while (!step.done) {
        const answer = await side.answer(step.value);
        if (halt) halt();
        if (stop) stop.throwIfAborted();
        step = steps.next(answer);
      }
      side.check();
      return { ...step.value, calls: { ...side.counts }, ...(paid ? { spend: { ...paid.spend } } : {}) };
    } finally {
      await side.close();
      // The money's last word, at the end or the stop: the tally, and what the key's usage says was billed, calls whose
      // reply never came back included.
      if (paid) {
        say(spendLine('final'));
        if (api === 'openrouter' && seasonPaid) {
          const now = await seasonPaid.keyUsage(url);
          say(usageAtStart === null || now === null ? "[billed] the key's usage could not be read at both ends"
            : `[billed] $${(now - usageAtStart).toFixed(4)} by the key's usage since this run started ($${usageAtStart.toFixed(4)} then, $${now.toFixed(4)} now)`);
        }
      }
    }
  });
}

// The cast for a run: --cast's mix (DEFAULT_CAST's by default), and with --squatter one hustler swapped for the
// squatter. An unknown cast name throws. The model casts take --model-seats, the seats a model plays; no other does.
// R5-deals: models-canny, the canny cast with model seats, is a model cast beside models.
export const DEFAULT_CAST = 'trades';
export const MODEL_CASTS = ['models', 'models-canny'];
export const castName = mix => ('models' in mix ? (mix.canny ? 'models-canny' : 'models') : mix.canny ? 'canny' : mix.sharp ? 'crime' : mix.score ? 'layer4' : mix.drugs ? 'layer3' : mix.every ? 'trades' : mix.layer === 2 ? 'layer2' : 'layer1');
export function mixOf(args) {
  const name = args.cast || DEFAULT_CAST;
  if (!CASTS[name]) throw new Error(`unknown argument ${JSON.stringify(name)}: no such --cast. Takes: ${Object.keys(CASTS).join(', ')}`);
  if (MODEL_CASTS.includes(name) || args['model-seats'] !== undefined) {
    const n = Number(args['model-seats']);
    if (!MODEL_CASTS.includes(name) || !Number.isInteger(n) || n < 0) throw new Error('--cast models (or models-canny) takes --model-seats N, the seats a model plays, and no other cast takes --model-seats');
    return { ...CASTS[name], models: n, ...(args.squatter ? { squatter: 1 } : {}) };
  }
  return args.squatter ? { ...CASTS[name], squatter: 1 } : CASTS[name];
}

// What each program takes: 'value' (--flag value), 'flag' (--flag alone) or 'list' (--set, which repeats).
export const RUNNER_ARGS = {
  seed: 'value', rule: 'value', midseason: 'value', rounds: 'value', out: 'value', 'die-at': 'value',
  resume: 'flag', quiet: 'flag', feed: 'flag', squatter: 'flag', set: 'list', cast: 'value', 'stop-after': 'value',
  'model-seats': 'value', model: 'value', 'model-url': 'value', go: 'value', 'model-concurrency': 'value',
  'thinking-seats': 'value', replay: 'value', 'model-api': 'value', 'model-key-file': 'value', 'max-cost': 'value',
  'model-provider': 'value', briefing: 'value', 'seat-models': 'value', reply: 'value', creeds: 'value', 'creed-baseline': 'value',
  journal: 'value', 'orders-baseline': 'value',
};
export const BENCH_ARGS = { seeds: 'value', rules: 'value', out: 'value', squatter: 'flag', set: 'list', cast: 'value', 'model-seats': 'value' };

// The cast for a program's own command line, or the reason on stderr and exit 2.
export function mixOrExit(args, usage) {
  try {
    return mixOf(args);
  } catch (e) {
    console.error(`${e.message}\nusage: ${usage}`);
    process.exit(2);
  }
}

// --flag value pairs; --set can repeat and collects into a list. Anything the program doesn't know stops the run: an
// unknown flag, a stray word, a flag without its value, or "--set k=v" passed as one word (as zsh does with a quoted
// or unsplit variable). A run must never report numbers it didn't use.
export function parseArgs(argv, known) {
  const out = { set: [] };
  const refuse = (what, why) => {
    throw new Error(`unknown argument ${JSON.stringify(what)}: ${why}. Takes: ${Object.keys(known).map(k => `--${k}`).join(' ')}`);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) refuse(a, 'not a --flag');
    const key = a.slice(2);
    const kind = known[key];
    if (!kind) refuse(a, /\s/.test(key) ? 'a flag and its value in one word; pass them as two' : 'no such flag');
    if (kind === 'flag') {
      out[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) refuse(a, 'it needs a value');
    if (kind === 'list') out[key].push(next);
    else out[key] = next;
    i++;
  }
  return out;
}

// For a program's own command line: the parsed arguments, or the reason on stderr and exit 2.
export function argsOrExit(argv, known, usage) {
  try {
    return parseArgs(argv, known);
  } catch (e) {
    console.error(`${e.message}\nusage: ${usage}`);
    process.exit(2);
  }
}

// --replay: the model season a run folder holds, played again from its tape with no model, into a new run folder; to
// its last night when it was stopped. Its settings come from the folder, so no other season flag goes with it.
function replayOf(folder, outDir, refuse) {
  const src = path.resolve(folder);
  const [ckFile, tapeFile] = [path.join(src, 'checkpoint.json'), path.join(src, 'tape.jsonl')];
  if (!fs.existsSync(ckFile) || !fs.existsSync(tapeFile)) refuse(`nothing to replay in ${folder}: a model season's run folder holds checkpoint.json and tape.jsonl`);
  const ck = JSON.parse(fs.readFileSync(ckFile, 'utf8'));
  if (!ck.models) refuse(`nothing to replay in ${folder}: it has no model seats`);
  const b = ck.bench;
  if (path.resolve(outDir, `${b.seed}-${b.rule}`) === src) refuse('a replay writes a new run folder: pass another --out');
  // The model cast its season was dealt from (R5-deals: models or models-canny; a folder from before either is models).
  const castOf = MODEL_CASTS.includes(b.options.cast) ? b.options.cast : 'models';
  const mix = { ...CASTS[castOf], models: ck.cast.filter(c => c.model).length, ...(b.options.squatter ? { squatter: 1 } : {}) };
  if (JSON.stringify(makeCast(b.seed, mix)) !== JSON.stringify(ck.cast)) refuse(`${folder}'s cast doesn't deal again from its seed`);
  return {
    seed: b.seed, rule: b.rule, midseason: b.midseason, rounds: b.rounds, overrides: b.overrides, outDir, mix,
    stopAfter: ck.state.over ? null : b.nights.length, model: ck.models.model, briefing: ck.models.briefing || DEFAULT_BRIEFING,
    reply: ck.models.reply || DEFAULT_REPLY, ...(b.options.journal ? { journal: b.options.journal } : {}), ...(b.options.creeds ? { creeds: b.options.creeds } : {}), ...(b.options.creedBaseline ? { creedBaseline: b.options.creedBaseline.text } : {}),
    ...(b.options.ordersBaseline ? { ordersBaseline: b.options.ordersBaseline.orders } : {}),
    replay: { tape: fs.readFileSync(tapeFile, 'utf8'), models: ck.models },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const usage = 'node core/bench/runner.mjs --seed 404 --rule A [--midseason ...] [--rounds 3] [--out dir] [--feed] [--resume] [--die-at after-night:7] [--quiet] [--set key=value ...] [--squatter] [--cast trades|layer4|layer3|layer2|layer1|models|models-canny] [--stop-after N] [--briefing current|legacy|starter] [--reply json|tools] [--journal dawn] [--creeds file.json] [--creed-baseline file.txt] [--orders-baseline file.json] [--model-seats N] [--model name] [--model-url url --go "slime\'s words"] [--model-concurrency 8] [--thinking-seats N] [--model-api openrouter|claude] [--model-key-file path --max-cost usd] [--model-provider \'{json}\'] [--seat-models \'[{json}, ...]\'], or --replay <run folder> --out dir';
  const args = argsOrExit(process.argv.slice(2), RUNNER_ARGS, usage);
  const refuse = why => {
    console.error(`${why}\nusage: ${usage}`);
    process.exit(2);
  };
  // A whole number in [lo, hi] for --key, or its default when it isn't given.
  const whole = (key, lo, hi, fallback = null) => {
    if (args[key] === undefined) return fallback;
    const n = Number(args[key]);
    if (!Number.isInteger(n) || n < lo || n > hi) refuse(`--${key} takes a whole number from ${lo} to ${hi}`);
    return n;
  };
  const outDir = typeof args.out === 'string' ? args.out : path.join(CORE, 'runs');
  let o;
  let seatModels = null;
  if (typeof args.replay === 'string') {
    const others = Object.keys(args).filter(k => !['replay', 'out', 'quiet', 'feed', 'set'].includes(k) || (k === 'set' && args.set.length));
    if (others.length) refuse(`a replay takes its season from the run folder, not --${others[0]}`);
    o = { ...replayOf(args.replay, outDir, refuse), quiet: !!args.quiet, feed: !!args.feed };
  } else {
    // R7: --seat-models, parsed and checked first, gives --model-seats when it's left out (its groups' seats, added up).
    if (args['seat-models'] !== undefined) {
      try {
        seatModels = JSON.parse(args['seat-models']);
      } catch {
        seatModels = undefined;
      }
      const bad = seatModelsRefusal(seatModels, { url: args['model-url'] === undefined ? null : args['model-url'], api: args['model-api'] === undefined ? 'local' : args['model-api'] });
      if (bad) refuse(bad);
      const total = seatModels.reduce((t, g) => t + g.seats, 0);
      if (MODEL_CASTS.includes(args.cast) && args['model-seats'] === undefined) args['model-seats'] = String(total);
      if (args['model-seats'] !== undefined && Number(args['model-seats']) !== total) refuse(`--seat-models' groups play ${total} seats, not --model-seats ${args['model-seats']}`);
      for (const k of ['model', 'thinking-seats', 'model-provider']) if (args[k] !== undefined) refuse(`--seat-models names each seat's model, thinking and provider: not with --${k}`);
    }
    const mix = mixOrExit(args, usage);
    const seed = Number(args.seed);
    if (!Number.isInteger(seed)) {
      console.error(`usage: ${usage}`);
      process.exit(2);
    }
    o = {
      seed, rule: args.rule || 'A', midseason: typeof args.midseason === 'string' ? args.midseason : undefined,
      rounds: args.rounds ? Number(args.rounds) : 3, outDir, overrides: parseSet(args.set), mix,
      resume: !!args.resume, feed: !!args.feed, dieAt: typeof args['die-at'] === 'string' ? args['die-at'] : null, quiet: !!args.quiet,
      stopAfter: whole('stop-after', 1, N.nights), ...(args.briefing === undefined ? {} : { briefing: args.briefing }),
      ...(args.reply === undefined ? {} : { reply: args.reply }), ...(args.journal === undefined ? {} : { journal: args.journal }),
    };
    // R8b: --creeds, the owners' Creed edits, read from its file and checked before anything is written.
    if (args.creeds !== undefined) {
      let creeds;
      try {
        creeds = JSON.parse(fs.readFileSync(args.creeds, 'utf8'));
      } catch {
        refuse(`--creeds: ${args.creeds} isn't a JSON file`);
      }
      const bad = creedsRefusal(creeds);
      if (bad) refuse(bad);
      o.creeds = creeds;
    }
    // R8e: --creed-baseline, the text every agent's Creed starts as, read from its file (a final line break dropped)
    // and checked before anything is written.
    if (args['creed-baseline'] !== undefined) {
      let text;
      try {
        text = fs.readFileSync(args['creed-baseline'], 'utf8').replace(/\r?\n$/, '');
      } catch {
        refuse(`--creed-baseline: can't read ${args['creed-baseline']}`);
      }
      const bad = baselineRefusal(text);
      if (bad) refuse(bad);
      o.creedBaseline = text;
    }
    // R10b: --orders-baseline, the owner's preset trade orders by trade, read from its JSON file and checked before
    // anything is written.
    if (args['orders-baseline'] !== undefined) {
      let orders;
      try {
        orders = JSON.parse(fs.readFileSync(args['orders-baseline'], 'utf8'));
      } catch {
        refuse(`--orders-baseline: ${args['orders-baseline']} isn't a JSON file`);
      }
      const bad = ordersBaselineRefusal(orders);
      if (bad) refuse(bad);
      o.ordersBaseline = orders;
    }
  }
  // A model season: --cast models or models-canny, a replay, or a resumed season that has model seats.
  const ckFile = path.join(o.outDir, `${o.seed}-${o.rule}`, 'checkpoint.json');
  const saved = o.resume && fs.existsSync(ckFile) ? JSON.parse(fs.readFileSync(ckFile, 'utf8')).models || null : null;
  const models = !!o.replay || MODEL_CASTS.includes(castName(o.mix)) || !!saved;
  // The guard (CLAUDE.md: no model run without slime's go): before anything is written or called.
  const real = args['model-url'] !== undefined || !!(saved && saved.url);
  const modelFlags = ['model', 'model-url', 'go', 'model-concurrency', 'thinking-seats', 'model-api', 'model-key-file', 'max-cost', 'model-provider', 'creeds', 'creed-baseline', 'reply', 'seat-models', 'briefing'];
  if (!models && modelFlags.some(k => args[k] !== undefined)) {
    refuse('--model, --model-url, --go, --model-concurrency, --thinking-seats, --model-api, --model-key-file, --max-cost, --model-provider, --creed-baseline, --creeds, --reply, --seat-models and --briefing go with --cast models (or models-canny)');
  }
  // R10b: only a model seat has trade orders.
  if (!models && args['orders-baseline'] !== undefined) refuse('--orders-baseline goes with --cast models (or models-canny): only a model seat has trade orders');
  // R9b: only a model seat writes a journal entry.
  if (!models && args.journal !== undefined) refuse('--journal goes with --cast models (or models-canny): only a model seat is asked for a journal entry');
  // R7: a mixed season resumes only with its own groups (runModelSeason checks they're the same).
  if (saved && saved.mixed && seatModels === null) refuse(`this season's seats play several models: resume it with --seat-models '${JSON.stringify(saved.mixed)}'`);
  const badArm = (args.briefing === undefined ? null : armRefusal(args.briefing)) || (args.reply === undefined ? null : replyRefusal(args.reply)) || (args.journal === undefined ? null : journalRefusal(args.journal));
  if (badArm) refuse(badArm);
  if (args.go !== undefined && args['model-url'] === undefined) refuse('--go goes with --model-url: the fake needs no go');
  if (args.model !== undefined && args['model-url'] === undefined) refuse(`--model names the model at --model-url; the fake is always \`${FAKE}\``);
  if (real && !(typeof args['model-url'] === 'string' && typeof args.go === 'string' && args.go.trim())) {
    refuse('a real endpoint is called only with --model-url <url> and --go "<slime\'s words>" (CLAUDE.md: no model run without his go)');
  }
  if (real && !args.model && seatModels === null) refuse('name the model the endpoint serves: --model <name>');
  // R2-12, a paid endpoint, also before anything is written or called: the flags as runModelSeason takes them (its
  // guards, run here first so a refusal names the flag), then the key, read once from its file.
  if (args['model-api'] !== undefined && args['model-api'] !== 'openrouter' && args['model-api'] !== CLAUDE) refuse(`--model-api takes openrouter or ${CLAUDE}, not ${args['model-api']}`);
  let provider = null;
  if (args['model-provider'] !== undefined) {
    try {
      provider = JSON.parse(args['model-provider']);
    } catch {
      provider = undefined;
    }
    if (!provider || typeof provider !== 'object' || Array.isArray(provider)) refuse("--model-provider takes a JSON object, OpenRouter's provider routing");
  }
  // R8c: the Claude API's key file is ~/.config/anthropic/key unless --model-key-file names another.
  const keyFile = args['model-key-file'] !== undefined ? args['model-key-file'] : args['model-api'] === CLAUDE && args['model-url'] !== undefined ? CLAUDE_KEY_FILE : null;
  const paidFlags = {
    url: args['model-url'] === undefined ? null : args['model-url'], key: keyFile,
    api: args['model-api'] === undefined ? 'local' : args['model-api'], provider, maxCost: args['max-cost'] === undefined ? null : Number(args['max-cost']),
  };
  const groupsPaid = paidFlags.url !== null && Array.isArray(seatModels) && seatModels.some(g => ownApi(g, paidFlags.api));
  const notPaid = paidRefusal({ ...paidFlags, groups: groupsPaid });
  if (notPaid) refuse(notPaid);
  let key = null;
  if (paidFlags.key !== null) {
    try {
      key = readKey(paidFlags.key);
    } catch (e) {
      refuse(`--model-key-file: ${e.message}`);
    }
  }
  // R8c: each group with its own API reads its own key, once, from its keyFile (the API's default when left out).
  let groupKeys = null;
  if (groupsPaid) {
    groupKeys = seatModels.map(g => {
      if (!ownApi(g, paidFlags.api)) return null;
      try {
        return readKey(g.keyFile || CLAUDE_KEY_FILE);
      } catch (e) {
        return refuse(`--seat-models' ${g.model} group's keyFile: ${e.message}`);
      }
    });
  }
  const started = Date.now();
  const secs = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
  if (!models) {
    const r = runSeason(o);
    console.log(r.stopped ? `${r.dir} · stopped after night ${r.stopped} · ${secs()}` : `${r.dir} · ${r.metrics.events} events · ${secs()}`);
  } else {
    // Stopping aborts the requests in flight, and the run stops before it writes anything more; --resume plays on.
    const stop = new AbortController();
    let code = 1;
    for (const [sig, n] of [['SIGINT', 130], ['SIGTERM', 143]]) {
      process.once(sig, () => {
        code = n;
        stop.abort(new Error(`stopped by ${sig}`));
        setTimeout(() => process.exit(n), 2000).unref();
      });
    }
    try {
      const url = real ? args['model-url'] : null;
      const r = await runModelSeason({
        ...o, ...(o.replay ? {} : { model: args.model }), url, go: real ? args.go : null, fetch: real ? fetch : undefined,
        concurrency: whole('model-concurrency', 1, 64, 8), thinking: whole('thinking-seats', 0, o.mix.models || 0, 0), signal: stop.signal,
        key, api: paidFlags.api, provider, maxCost: paidFlags.maxCost, say: line => console.log(line), ...(seatModels === null ? {} : { seatModels }),
        ...(groupKeys ? { groupKeys } : {}),
      });
      const what = r.stopped ? `stopped after night ${r.stopped}` : `${r.metrics.events} events`;
      console.log(`${r.dir} · ${what} · ${secs()} · ${r.calls.live + r.calls.taped} model calls (${r.calls.taped} from the tape)`);
    } catch (e) {
      // Refused before anything was written or called (a resume that wouldn't call as its season did, a season already
      // at its cap, the preflight): exit 2, as the guards do.
      if (e && e.refused) {
        console.error(e.message);
        process.exit(2);
      }
      // Stopped by the spend cap, the account's credit or the key, as SIGINT stops a season: exit 3.
      if (e && e.halt) {
        const then = { cap: 'with a higher --max-cost', credit: 'once the account has credit', key: 'with a key the endpoint takes' }[e.halt];
        console.error(`stopped: ${e.message}; the requests in flight were aborted, and --resume plays on ${then}`);
        process.exit(3);
      }
      if (!stop.signal.aborted) throw e;
      console.error(`stopped: ${stop.signal.reason.message}; the requests in flight were aborted, and --resume plays on`);
      process.exit(code);
    }
  }
}
