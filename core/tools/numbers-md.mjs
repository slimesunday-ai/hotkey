// Writes core/reports/NUMBERS.md from core/numbers.mjs's ROWS: every number the core uses, its status (RULE, GUESS or
// GAP), where GAME.md says it, and its note. Run it after any change to numbers.mjs:
//   node core/tools/numbers-md.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROWS } from '../numbers.mjs';

const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cell = v => (typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/\|/g, '\\|');
const counts = ['RULE', 'GUESS', 'GAP'].map(k => `${ROWS.filter(r => r.status === k).length} ${k}`).join(', ');
const lines = [
  '# R1 numbers and gaps',
  '',
  "Every number the core uses, from `core/numbers.mjs`. RULE: written in GAME.md. GUESS: §38's starting guess (or one GAME.md asks for), measured by the bench, slime decides. GAP: GAME.md gives no answer; the simplest deterministic one, for slime to confirm.",
  '',
  `${ROWS.length} rows: ${counts}.`,
  '',
  '| key | value | status | ref | note |',
  '|---|---|---|---|---|',
  ...ROWS.map(r => `| ${r.key} | ${cell(r.value)} | ${r.status} | ${r.ref} | ${cell(r.note)} |`),
  '',
];
fs.writeFileSync(path.join(core, 'reports', 'NUMBERS.md'), lines.join('\n'));
console.log(`${ROWS.length} rows: ${counts}`);
