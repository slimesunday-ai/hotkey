import { createHash } from 'node:crypto';

const free = new Set(['line', 'reason', 'name', 'creed']);
const identity = text => createHash('sha256').update(text).digest('hex').slice(0, 24);
export const quotedWords = text => JSON.stringify(String(text)).replace(/[^\x20-\x7e]|[<>]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// A lookup is typed evidence plus separately attributed words. Free fields never enter trusted JSON context.
export function splitWords(value, path = 'lookup', source = null, words = []) {
  if (Array.isArray(value)) return { typed: value.map((v, i) => splitWords(v, `${path}.${i}`, source, words).typed), words };
  if (!value || typeof value !== 'object') return { typed: value, words };
  const here = value.speechId || (Number.isInteger(value.n) ? `event:${value.n}` : source);
  const typed = {};
  for (const [key, v] of Object.entries(value)) {
    if (free.has(key)) {
      const entries = Array.isArray(v) ? v : [v];
      for (const [i, text] of entries.entries()) if (typeof text === 'string' && text) {
        const id = key === 'line' && value.speechId ? value.speechId : `quoted:${identity(`${here || path}.${key}.${i}:${text}`)}`;
        words.push({ id, group: value.sitdown || here || path, rank: -1, text: `${here || path} ${key}: ${quotedWords(text)}`, payload: quotedWords(text) });
      }
    } else typed[key] = splitWords(v, `${path}.${key}`, here, words).typed;
  }
  return { typed, words };
}

// Quote tiers (docs/redesign/agents-20261018-context-priority.md), highest first:
// - A: words the seat asked to read (lookup evidence), its owner's Creed and its own journal, the game-held memory.
// - B: the seat's own active (open or asked) conversations, both sides, with fair turns across conversations.
// - C: today's words around the seat: addressed to it, overheard by it, said out loud or in crew chat, invitations and
//   declines, and today's lines of a conversation that closed today.
// - D: ambient words: other agents' sit-down words revealed after 24 hours, older days, the seat's closed conversations,
//   published Creeds and notes, play reasons and crew names. They give way before any decision fact loses a line.
// Every record says who said it, to whom where that is not the seat, and where it was said; the label is typed, the
// words are quoted.
export const TIER = { A: 'A', B: 'B', C: 'C', D: 'D' };

export function speechRecords(view, memory = null, requested = [], journalNotes = 0) {
  const me = view.me.id;
  const today = view.day;
  const who = x => (x === me ? 'you' : x);
  const sitdowns = new Map((view.me.sitdowns || []).map(sd => [sd.id, sd]));
  const active = new Set([...sitdowns.values()].filter(sd => ['open', 'asked'].includes(sd.state)).map(sd => sd.id));
  const records = new Map();
  let seq = 0;
  const add = r => { if (!records.has(r.id)) records.set(r.id, { seq: seq++, n: null, ...r }); };
  for (const r of requested) add({ ...r, tier: TIER.A, kind: 'request', day: today });
  for (const [i, line] of [].concat(memory?.creed || []).filter(x => typeof x === 'string' && x).entries()) {
    add({ id: `creed:${i}:${identity(line)}`, tier: TIER.A, kind: 'creed', protected: true, group: 'owner Creed', day: today,
      text: `Your Creed, in your owner's words: ${quotedWords(line)}` });
  }
  for (const note of (memory?.journal || []).slice(-journalNotes)) if (note?.line) {
    const text = `Your journal, day ${note.day}: ${quotedWords(note.line)}`;
    add({ id: `journal:${identity(text)}`, tier: TIER.A, kind: 'journal', group: 'journal', day: note.day, text });
  }
  const archive = view.me.speech || [];
  for (const e of archive) if (e.line) {
    const q = quotedWords(e.line);
    const id = e.speechId || `speech:${e.n}:0`;
    const old = d => (d < today ? `, day ${d}` : '');
    const involved = e.from === me || e.to === me;
    let tier, text;
    if (e.type === 'overheard') {
      const heard = e.observedDay ?? e.day;
      tier = heard === today ? TIER.C : TIER.D;
      text = `${e.sitdown} ${who(e.from)}, overheard${heard < today ? ` on day ${heard}` : ''}: ${q}`;
    } else if (e.type === 'outloud') {
      tier = e.day === today ? TIER.C : TIER.D;
      text = `${who(e.agent || e.from)} out loud${old(e.day)}: ${q}`;
    } else if (e.type === 'chat') {
      tier = e.day === today ? TIER.C : TIER.D;
      text = `crew ${e.crew} chat, ${who(e.from)}${old(e.day)}: ${q}`;
    } else if (involved) {
      tier = active.has(e.sitdown) ? TIER.B : e.day === today ? TIER.C : TIER.D;
      const verb = e.type === 'ask' ? ' asking' : e.type === 'decline' ? ' declining' : '';
      text = `${e.sitdown} ${who(e.from)}${verb}${old(e.day)}: ${q}`;
    } else {
      // Another pair's words: live only to a listener with an earpiece (today), everyone's 24 hours later.
      tier = e.day === today ? TIER.C : TIER.D;
      const verb = e.type === 'ask' ? ' asking' : e.type === 'decline' ? ' declining' : ' to';
      text = `${e.sitdown} ${e.from}${verb} ${e.to}${e.day === today ? ', overheard' : `, day ${e.day}`}: ${q}`;
    }
    add({ id, tier, kind: e.type, group: tier === TIER.B ? e.sitdown : e.sitdown || (e.crew && `crew ${e.crew}`) || e.agent || e.from || e.type,
      day: e.type === 'overheard' ? e.observedDay ?? e.day : e.day, n: e.n, text, payload: q });
  }
  // Older saved views and formatter fixtures can have sit-down messages without an event archive. Their typed
  // conversation/from/day identity supplies the same tier; never identify unrelated sources by quote alone.
  for (const sd of sitdowns.values()) for (const [i, message] of sd.said.entries()) if (message.line) {
    if (archive.some(e => e.type === 'say' && e.sitdown === sd.id && e.from === message.from && e.day === message.day && e.line === message.line)) continue;
    const older = message.day < today;
    add({ id: `sitdown:${sd.id}:${i}`, tier: active.has(sd.id) ? TIER.B : older ? TIER.D : TIER.C, kind: 'say', group: sd.id, day: message.day,
      text: `${sd.id} ${who(message.from)}${older ? `, day ${message.day}` : ''}: ${quotedWords(message.line)}` });
  }
  const ambient = (text, day, group, n = null) => add({ id: `quoted:${identity(text)}`, tier: TIER.D, kind: 'ambient', group, day, n, text });
  // A published Creed word for word the seat's own (every agent starts on one baseline, 10-19) is named, not quoted:
  // one line lists those agents, so 29 copies of one text don't crowd out the day's words.
  const mine = new Set([].concat(memory?.creed || []).filter(x => typeof x === 'string' && x));
  const same = new Set();
  for (const m of view.board.memories || []) if (m.agent !== me) {
    for (const line of [].concat(m.creed || [])) if (typeof line === 'string' && line) {
      if (mine.has(line)) same.add(m.agent);
      else ambient(`${m.agent}'s published Creed, as of day ${m.asOfDay}: ${quotedWords(line)}`, m.asOfDay, m.agent);
    }
    for (const note of m.journal || []) if (note?.line) ambient(`${m.agent}'s published note, day ${note.day}: ${quotedWords(note.line)}`, note.day, m.agent);
  }
  if (same.size) ambient(`Published Creeds word for word your own: ${[...same].sort().join(', ')}.`, today, 'creeds');
  const archived = new Set(archive.map(e => e.n));
  for (const e of view.events || []) {
    if (e.type === 'play' && e.reason) ambient(`${e.agent === me ? 'your' : `${e.agent}'s`} reason for night ${e.day}: ${quotedWords(e.reason)}`, e.day, e.agent, e.n);
    else if (!archived.has(e.n) && !['ask', 'decline', 'overheard', 'say', 'play'].includes(e.type) && typeof e.line === 'string' && e.line && e.t >= view.clock - 1) {
      const text = `${e.type} ${who(e.from || e.agent || e.by || '')}: ${quotedWords(e.line)}`;
      add({ id: `quoted:${identity(text)}`, tier: e.day === today ? TIER.C : TIER.D, kind: e.type, group: e.type, day: e.day, n: e.n, text });
    }
  }
  for (const c of view.board.crews || []) if (typeof c.name === 'string' && c.name) ambient(`crew ${c.id} is named ${quotedWords(c.name)}`, today, `crew ${c.id}`);
  return [...records.values()];
}

// The order said: by day, then by event; a record without an event (memory, a crew's name) after that day's events.
const after = (a, b) => (a === b ? 0 : a > b ? 1 : -1);
const chronological = (x, y) => (x.day ?? 0) - (y.day ?? 0) || after(x.n ?? Infinity, y.n ?? Infinity) || x.seq - y.seq;

// Selection order: what a tight packet keeps first, so the formatter drops from the end. Tier A; then undelivered
// tier B lines in fair turns across conversations (the turn after the most recently presented conversation comes
// first) and undelivered tier C lines in the order said; then the repeats of both, in the same orders; then tier D,
// undelivered first, newest first. The rotation anchor is read from presentation IDs, which the seat keeps in this selection order.
export function deliveryRecords(view, memory = null, requested = [], delivery = null, journalNotes = 0) {
  const records = speechRecords(view, memory, requested, journalNotes);
  const byId = new Map(records.map(r => [r.id, r]));
  const recency = delivery?.presentedSpeechIds || [];
  const presented = new Set(recency);
  const tier = t => records.filter(r => r.tier === t);
  const conversation = tier(TIER.B).sort(chronological);
  const groups = [...new Set(conversation.map(r => r.group))];
  let after = -1;
  for (let i = recency.length - 1; i >= 0; i--) {
    // Include already-presented groups in the ring: an anchor with no unread rows still determines which waiting
    // group comes next. Derive the anchor only from IDs actually sent and still present in the permitted view.
    const last = byId.get(recency[i]);
    if (last?.tier === TIER.B) { after = groups.indexOf(last.group); break; }
  }
  const ring = [...groups.slice(after + 1), ...groups.slice(0, after + 1)];
  const turns = seen => {
    const queues = new Map(ring.map(group => [group, conversation.filter(r => r.group === group && presented.has(r.id) === seen)]));
    const out = [];
    while ([...queues.values()].some(rows => rows.length)) for (const rows of queues.values()) if (rows.length) out.push(rows.shift());
    return out;
  };
  const around = seen => tier(TIER.C).filter(r => presented.has(r.id) === seen).sort(chronological);
  const ambient = seen => tier(TIER.D).filter(r => presented.has(r.id) === seen).sort((x, y) => chronological(y, x));
  const kindOrder = ['request', 'creed', 'journal'];
  // Undelivered conversation and nearby words come before repeats of either, as R6 ordered undelivered words first.
  return [
    ...tier(TIER.A).sort((x, y) => kindOrder.indexOf(x.kind) - kindOrder.indexOf(y.kind) || x.seq - y.seq),
    ...turns(false), ...around(false), ...turns(true), ...around(true), ...ambient(false), ...ambient(true),
  ];
}

// Display order for the records a packet includes, given in selection order: requested words; each new
// conversation's first line; the owner Creed and journal; the rest of the seat's conversations, each conversation's
// lines in the order said within the turns it was given; then tier C and tier D in the order said.
export function displayOrder(selected, delivery = null) {
  const presented = new Set(delivery?.presentedSpeechIds || []);
  const conversation = selected.filter(r => r.tier === TIER.B);
  const lines = new Map();
  for (const r of conversation.slice().sort(chronological)) lines.set(r.group, [...(lines.get(r.group) || []), r]);
  const turns = conversation.map(r => lines.get(r.group).shift());
  const fresh = new Set(conversation.filter(r => !presented.has(r.id)).map(r => r.group)).size;
  const memory = selected.filter(r => r.tier === TIER.A && r.kind !== 'request');
  return [
    ...selected.filter(r => r.kind === 'request'),
    ...turns.slice(0, fresh),
    ...memory,
    ...turns.slice(fresh),
    ...selected.filter(r => r.tier === TIER.C).sort(chronological),
    ...selected.filter(r => r.tier === TIER.D).sort(chronological),
  ];
}
