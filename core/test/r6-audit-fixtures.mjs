// Every speech event here is accepted through the rules, including the 30/50-player pressure cases.
import assert from 'node:assert/strict';
import { Game, idOf } from './helpers.mjs';
import { N } from '../numbers.mjs';
import { read } from '../agents/tools.mjs';

export const quoted = text => JSON.stringify(String(text)).replace(/[^\x20-\x7e]|[<>]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
export const joined = messages => messages.map(m => m.content).join('\n');
export const speechBlock = messages => joined(messages).match(/<speech>\n([\s\S]*?)\n<\/speech>/)?.[1] || '';
export function accepted(g, who, kind, fields = {}) {
  const result = g.errand(who, kind, fields);
  assert.equal(result.ok, true, `${who} ${kind}: ${result.why}`);
  return result;
}
export const auditRead = (g, id = 'a01', from = 1) => read(g.view(id), { audience: 'seat', seed: 'r6-independent-audit', from });

export function contextPressure(n) {
  const g = new Game({ n });
  for (let i = 1; i <= n; i++) g.grant(idOf(i), 200);
  const conversations = [];
  for (let i = 2; i <= 5; i++) {
    const who = idOf(i);
    accepted(g, who, 'ask', { to: 'a01' });
    const sitdown = g.events('ask').at(-1).sitdown;
    accepted(g, 'a01', 'answer', { sitdown, accept: true });
    conversations.push({ who, sitdown });
  }
  accepted(g, 'a01', 'pay', { to: 'a02', amount: 20 });
  g.night();
  accepted(g, 'a02', 'pay', { to: 'a01', amount: 20, for: 'debt' });
  const repayment = g.events('pay').at(-1);
  g.night();
  const lines = [];
  for (const { who, sitdown } of conversations) {
    for (let j = 0; j < 9; j++) {
      const prefix = `${who}:${j} `;
      const line = j === 0 && who === 'a02' ? 'Please repay the $20. R6-REMINDER' : prefix + '<'.repeat(N['gap.lineLength'] - prefix.length);
      accepted(g, who, 'say', { sitdown, say: 'offer', line });
      lines.push({ who, sitdown, line, event: g.events('say').at(-1) });
    }
  }
  for (let i = 6; i <= n; i++) {
    const who = idOf(i);
    accepted(g, who, 'outloud', { say: 'boast', line: `R6-PUBLIC-${who} ` + 'p'.repeat(150) });
  }
  return { g, conversations, lines, repayment };
}
