// The dawn journal (R9b; GAME.md §17: "One memory, held by the game: the plan card, the Creed, standing orders and the
// journal"; §18's morning report, one of the 14 calls a seat a day). In four paid seasons no model seat wrote a note:
// nothing asked for one. Every system before this one asks at a fixed point (AI Diplomacy's diary after each phase,
// Emergence's entry a date, Mintfluencer's reflections, OpenClaw's flush), so the game does here: with --journal dawn
// (runner.mjs, off by default), once each night has settled, on days 2-14, every model seat gets its ordinary briefing
// for the day with the same system text (so a provider's cache holds) and one task line below it, and the reply's text
// is the entry. No tool is needed, so it works on every API; a tool call in the reply is ignored, and an empty reply
// stores nothing, with no retry. The entry goes into the core's own memory path, a `note` through the runner's
// trusted dawn context (core/rules/memory.mjs), dated that day, so the briefing's journal lines (speech-context.mjs,
// tier A) show it on every later call, and CLEAR and the 24-hour publication apply as to any note.
import { N } from '../numbers.mjs';

// --journal: 'off' (the default) or 'dawn'.
export const JOURNAL_MODES = ['off', 'dawn'];
export const DEFAULT_JOURNAL = 'off';
export const DAWN = 'dawn';
// The trusted context the runner stores an entry with (never an action's fields: a model can't send it).
export const DAWN_CONTEXT = Object.freeze({ source: 'dawn' });

// The days with a dawn call: after nights 1 to 13, so none before night 1 and none after the ferry.
export const dawnDay = day => Number.isInteger(day) && day >= 2 && day <= N.nights;

// The task line, below the day's briefing. Neutral (§33: no strategy cue): what to write, where it goes, and one
// mechanical fact (a piece's handle is dealt fresh each call, tools.mjs/handles.mjs, so one quoted in an entry is stale
// later). Short: every character of it is out of the briefing's budget. The
// briefing shows the newest gap.briefing.notes notes (speech-context.mjs); the journal keeps gap.journal of them, which
// lookup state reads.
export function dawnTask(day) {
  return `Dawn, day ${day}: write today's journal entry in your own words, at most about ${N['gap.journalEntry'].words} words: what happened last night, what you make of it, what you mean to do. Your newest ${N['gap.briefing'].notes} entries show on every call, older ones via lookup state; public after 24 hours. Piece handles like P36 change from call to call. Reply with the entry alone as plain text (no JSON, no tool call).`;
}

// A reply's text, after any thinking; null when there is none. A reply cut off while still thinking (a <think> with
// no </think>) has no text: its reasoning is never the entry, which goes public after 24 hours.
const textOf = content => {
  if (typeof content !== 'string') return null;
  if (content.includes('</think>')) return content.slice(content.lastIndexOf('</think>') + '</think>'.length);
  return content.includes('<think>') ? null : content;
};

// What came back for a dawn request, typed as seat.mjs types a call's: 'reply' with its text (empty when there was
// none: a reply of tool calls alone, say), or 'error'. A cut-off reply is still its text, cut by entryOf below.
export function dawnReply(res, api = 'local') {
  if (res.status !== 200) return { outcome: 'error', why: `the model's endpoint answered ${res.status}` };
  const error = api === 'openrouter' && res.body && typeof res.body === 'object' ? res.body.error : null;
  if (error) return { outcome: 'error', why: `the model's endpoint answered with an error${Number.isInteger(error.code) ? ` (${error.code})` : ''}` };
  const choice = res.body && Array.isArray(res.body.choices) ? res.body.choices[0] : null;
  if (!choice || !choice.message || typeof choice.message !== 'object') return { outcome: 'error', why: "the model's endpoint sent no reply" };
  const text = textOf(choice.message.content);
  return { outcome: choice.finish_reason === 'length' ? 'cutoff' : 'reply', text: text === null ? '' : text };
}

// The entry as the journal keeps it: one line, white space run together, cut at a word boundary to
// gap.journalEntry.chars (a single word longer than that is cut where it reaches it). '' stores nothing.
export function entryOf(text) {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim();
  const cap = N['gap.journalEntry'].chars;
  if (line.length <= cap) return line;
  const cut = line.slice(0, cap + 1).lastIndexOf(' ');
  return (cut > 0 ? line.slice(0, cut) : line.slice(0, cap)).trim();
}

// The errand that stores it, by the runner, with DAWN_CONTEXT.
export const dawnNote = (id, line) => ({ by: id, kind: 'note', line });

// Whether the record has an agent's dawn entry for `day` already (core/rules/memory.mjs names its event's part
// 'dawn'), so a resumed season never asks for it twice.
export const hasDawnEntry = (log, id, day) => log.some(e => e.type === 'memory' && e.part === DAWN && e.agent === id && e.day === day);
