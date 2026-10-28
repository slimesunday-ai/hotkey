// MAINLAND CHAT · the shared rules (2026-10-06): one file the relay (relay.mjs, Node) and the page (chat.js) both import, so the caps,
// the rate limits and the word filter are the same on both ends. The relay is the one that counts: the page applies them too, for the
// offline (solo) mode and so a message that would be cut is cut before it is sent.
// v1 GUARDRAILS ONLY: a 140-character cap, a per-connection rate limit, a basic word filter, a handle sanitiser. Real moderation (reports,
// bans, a moderator, accounts) and auth come before the Mainland is public (README).
export const RULES = {
  msgMax: 140,            // characters a chat line
  nameMax: 16,            // characters a handle
  frameMax: 1024,         // bytes a WebSocket message (the relay closes a connection that sends more)
  chatBurst: 4,           // chat: a bucket of 4 lines, refilled one every 1.5 s
  chatEvery: 1.5,
  stateHz: 10,            // presence updates a second (the page sends at this rate; the relay allows twice it, bursting)
  msgPerSec: 30,          // every message a connection sends (states, chat, emotes): past this, sustained, the relay hangs up
  emotes: ['wave', 'dap', 'dance'],
};

// the word filter: a short list, kept as ROT13 so the source doesn't read as a list of slurs. Matched on a normalised copy (lower case,
// common look-alike digits and symbols folded, repeated letters squeezed), whole words or the word as a prefix; a hit is replaced by
// stars of the same length in the original text. Basic by design: it stops the obvious, not the determined.
const ROT = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
const PREFIX = 'shpx fuvg phag ovgpu avttre avttn snttbg ergneq zbgureshpxre juber fyhg nffubyr'.split(' ').map(ROT);   // (and anything they start)
const EXACT = new Set('snt sntf qvpx qvpxf pbpx pbpxf cvff gjng xvxr fcvp fcvpf puvax jrgonpx genaal qvyqb encr xlf'.split(' ').map(ROT));   // (the word alone: no "cocktail")
const PHRASE = ['xvyy lbhefrys'].map(ROT);
const FOLD = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't' };
// the normalised form keeps a map back to the original string's indices, so a match can be starred in place
function norm(s) { let out = '', at = []; for (let i = 0; i < s.length; i++) { let c = s[i].toLowerCase(); c = FOLD[c] ?? c; if (!/[a-z]/.test(c)) { out += ' '; at.push(i); continue; }
  if (out.length && out[out.length - 1] === c && out[out.length - 2] === c) { at[at.length - 1] = i; continue; }   // (fuuuck → fuuck: three or more squeezed to two)
  out += c; at.push(i); } return { out, at }; }
const SQUEEZE = w => w.replace(/(.)\1+/g, '$1');
export function filterWords(text) {
  const { out, at } = norm(text), res = text.split(''); let hit = false;
  const tokens = []; out.replace(/[a-z]+/g, (w, i) => { tokens.push([w, i, i + w.length - 1]); return w; });
  const SQ_EX = new Set([...EXACT].map(SQUEEZE)), SQ_PRE = PREFIX.map(SQUEEZE), SQ_PH = PHRASE.map(p => SQUEEZE(p.replace(/ /g, '')));
  const bad = w => { const sq = SQUEEZE(w); return SQ_EX.has(sq) || SQ_PRE.some(p => sq.startsWith(p)) || SQ_PH.includes(sq); };
  const star = (i0, i1) => { for (let k = at[i0]; k <= at[i1]; k++) if (/\S/.test(res[k])) res[k] = '*'; hit = true; };
  // each word; then runs of words joined (2–3 at a time: a phrase, or a word spaced out letter by letter, "f u c k", up to 12 letters)
  for (const [w, i0, i1] of tokens) if (bad(w)) star(i0, i1);
  for (let a = 0; a < tokens.length; a++) { let w = tokens[a][0];
    for (let b = a + 1; b < tokens.length && b < a + 12; b++) { w += tokens[b][0]; const single = tokens.slice(a, b + 1).every(t => t[0].length === 1);
      if (single ? bad(w) : b === a + 1 && SQ_PH.includes(SQUEEZE(w))) { star(tokens[a][1], tokens[b][2]); break; } if (!single && b > a) break; } }
  return hit ? res.join('') : text;
}

// a chat line: no control characters or zero-width tricks, whitespace collapsed, capped at msgMax (by code point), filtered
export function cleanText(s) {
  if (typeof s !== 'string') return '';
  s = s.normalize('NFC').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim();
  const cps = [...s]; if (cps.length > RULES.msgMax) s = cps.slice(0, RULES.msgMax).join('');
  return filterWords(s);
}
// a handle: letters, digits, _ . - (no spaces), 2–16 long, filtered; '' when nothing usable is left
export function cleanName(s) {
  if (typeof s !== 'string') return '';
  s = s.normalize('NFKC').replace(/^@+/, '').replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_.-]/gu, '');
  s = [...s].slice(0, RULES.nameMax).join('');
  if ([...s].length < 2) return '';
  return /\*/.test(filterWords(s.replace(/[_.-]/g, ' '))) ? '' : s;
}
// a token bucket: take() → true when there was a token (cap tokens, one more every `every` seconds)
export function bucket(cap, every, now = () => Date.now() / 1000) { let n = cap, t = now();
  return { take() { const t1 = now(); n = Math.min(cap, n + (t1 - t) / every); t = t1; if (n >= 1) { n -= 1; return true; } return false; }, get left() { return n; } }; }
// the cast look a player id gives (stable per id): its seed (the page rolls the first look with hair from it, as walk.js does)
export function seedOf(pid) { let h = 0x811c9dc5; for (const c of String(pid)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
