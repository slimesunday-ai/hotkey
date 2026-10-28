// GAME.md §23: the rules never read the clock, randomness, coordinates or anything outside core/; the seed only sets
// the mock tiers and the bots' choices. A static scan of the source, comments removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(core, '..');
const rel = f => path.relative(core, f);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'runs' || d.name === 'node_modules' ? [] : walk(p);
    return p.endsWith('.mjs') || p.endsWith('.js') ? [p] : [];
  });
}

// Strip block comments, whole-line comments, and string contents' effect on the scan stays: a banned word inside a
// string literal still counts, which is the safe side.
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n');
}

function specifiers(src) {
  const out = [];
  const re = /(?:^|\n)\s*(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1] || m[2] || m[3]);
  return out;
}

const rules = fs.readdirSync(path.join(core, 'rules')).filter(f => f.endsWith('.mjs')).map(f => path.join(core, 'rules', f));
const pure = [...rules, path.join(core, 'numbers.mjs')];

test('the scan sees every rules file (positive control)', () => {
  const names = rules.map(f => path.basename(f)).sort();
  for (const f of ['errand.mjs', 'fights.mjs', 'ledger.mjs', 'night.mjs', 'plays.mjs', 'setup.mjs', 'state.mjs', 'view.mjs']) {
    assert.ok(names.includes(f), `missing ${f}`);
  }
  assert.ok(specifiers(code(path.join(core, 'rules', 'night.mjs'))).includes('./fights.mjs'), 'the import scan finds a known import');
  assert.ok(/\bDate\b/.test('const t = Date.now()'), 'the banned-word pattern matches a planted use');
});

test('the rules use no clock, no randomness, no process and no timers', () => {
  const banned = [
    [/\bDate\b/, 'Date'],
    [/\bMath\.random\b/, 'Math.random'],
    [/\bperformance\b/, 'performance'],
    [/\bprocess\b/, 'process'],
    [/\bsetTimeout\b|\bsetInterval\b|\bsetImmediate\b/, 'timers'],
    [/\brequire\s*\(/, 'require'],
    [/['"]node:/, 'node: import'],
    [/\bfetch\s*\(/, 'fetch'],
  ];
  const hits = [];
  for (const f of pure) {
    const src = code(f);
    for (const [re, name] of banned) if (re.test(src)) hits.push(`${rel(f)}: ${name}`);
  }
  assert.deepEqual(hits, []);
});

test('every rules import is relative and stays inside core/', () => {
  const bad = [];
  for (const f of pure) {
    for (const spec of specifiers(code(f))) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) { bad.push(`${rel(f)} imports ${spec}`); continue; }
      const target = path.resolve(path.dirname(f), spec);
      if (!target.startsWith(core + path.sep)) bad.push(`${rel(f)} imports ${spec}, outside core/`);
      else if (/[\\/](bench|tools|test)[\\/]/.test(path.relative(core, target) + '/')) bad.push(`${rel(f)} imports ${spec}, which isn't the rules`);
    }
  }
  assert.deepEqual(bad, []);
});

test('only the season setup imports the seed (§23: the seed only sets mock tiers and the bots\' choices)', () => {
  const users = pure.filter(f => specifiers(code(f)).some(spec => path.resolve(path.dirname(f), spec) === path.join(core, 'rng.mjs')));
  assert.deepEqual(users.map(rel), ['rules/setup.mjs']);
});

test('nothing in core/ imports from sim2/, style/ or world/', () => {
  const bad = [];
  for (const f of walk(core)) {
    for (const spec of specifiers(code(f))) {
      let target;
      if (spec.startsWith('file:')) target = fileURLToPath(spec);
      else if (spec.startsWith('/')) target = spec;
      else if (spec.startsWith('.')) target = path.resolve(path.dirname(f), spec);
      else continue;
      for (const dir of ['sim2', 'style', 'world']) {
        if (target.startsWith(path.join(repo, dir) + path.sep)) bad.push(`${rel(f)} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
