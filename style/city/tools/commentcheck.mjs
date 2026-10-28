// Port of game/test/comment-swallow.test.mjs: same parenthesized-note, compile and balance rules.
// C1 changes: scan style/city + core (.js/.mjs), skip dependencies/bakes/generated files,
// lex real line comments first, and prove three in-memory violations before scanning.
// This is a heuristic for // (…) notes, not a ban on all inline comments. Source is never executed.
// Run from any directory: node style/city/tools/commentcheck.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIRS = ['style/city', 'core'];
const SKIP = new Set(['node_modules', 'baked']);
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const compiles1 = s => {
  try { new AsyncFn(`for (;;) {\n${s}\nbreak; }`); return true; }
  catch { return false; }
};

// Kept from the game: discard unmatched closers, append missing closers, skip quoted text.
function balance(s) {
  const stack = [], out = [], P = { ')': '(', ']': '[', '}': '{' }, C = { '(': ')', '[': ']', '{': '}' };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < s.length && s[j] !== ch) j += s[j] === '\\' ? 2 : 1;
      out.push(s.slice(i, j + 1)); i = j; continue;
    }
    if (C[ch]) stack.push(ch);
    else if (P[ch]) { if (stack.at(-1) !== P[ch]) continue; stack.pop(); }
    out.push(ch);
  }
  return out.join('') + stack.reverse().map(o => C[o]).join('');
}
const compiles = s => /[;=(]/.test(s) && s.replace(/[\s;})\]]/g, '') !== '' && (compiles1(s) || compiles1(balance(s)));

// Small lexical pass: strings, regex character classes, block comments and template raw text
// cannot start line comments. ${…} is JavaScript again, including nested templates.
function lineComments(text) {
  const out = [], control = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
  const prefix = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'of', 'instanceof', 'yield', 'await', 'else', 'do']);
  let i = 0, line = 1;
  const move = end => { for (; i < end; i++) if (text[i] === '\n') line++; };
  function quoted(quote) {
    i++;
    while (i < text.length) {
      if (text[i] === '\\') { move(Math.min(i + 2, text.length)); continue; }
      if (text[i] === quote) { i++; return; }
      move(i + 1);
    }
  }
  function regexEnd() {
    let j = i + 1, cls = false;
    for (; j < text.length && !/[\r\n]/.test(text[j]); j++) {
      if (text[j] === '\\') { j++; continue; }
      if (text[j] === '[') cls = true;
      else if (text[j] === ']') cls = false;
      else if (text[j] === '/' && !cls) {
        j++; while (j < text.length && /[a-z]/i.test(text[j])) j++;
        return j;
      }
    }
    return i;
  }
  function template() {
    i++;
    while (i < text.length) {
      if (text[i] === '\\') { move(Math.min(i + 2, text.length)); continue; }
      if (text[i] === '`') { i++; return; }
      if (text[i] === '$' && text[i + 1] === '{') { i += 2; code(true); continue; }
      move(i + 1);
    }
  }
  function code(interpolation = false) {
    const parens = [], braces = [], constructs = [];
    const statementStart = token => ['', ';', '{', '}', 'export', 'default'].includes(token);
    let expression = true, prev = '', asyncValue = false, forAwait = false;
    while (i < text.length) {
      const ch = text[i], next = text[i + 1];
      if (/\s/.test(ch)) { move(i + 1); continue; }
      if (ch === '/' && next === '/') {
        const end = text.indexOf('\n', i), to = end < 0 ? text.length : end;
        out.push({ line, text: text.slice(i, to) }); i = to; continue;
      }
      if (ch === '/' && next === '*') {
        const end = text.indexOf('*/', i + 2); move(end < 0 ? text.length : end + 2); continue;
      }
      if (ch === '"' || ch === "'") { quoted(ch); expression = false; prev = 'literal'; continue; }
      if (ch === '`') { template(); expression = false; prev = 'literal'; continue; }
      if (ch === '/' && expression) {
        const end = regexEnd();
        if (end > i) { i = end; expression = false; prev = 'literal'; continue; }
      }
      if (/[\w$]/.test(ch)) {
        const start = i++;
        while (i < text.length && /[\w$]/.test(text[i])) i++;
        const word = text.slice(start, i);
        if (word === 'async') asyncValue = expression && !statementStart(prev);
        if (['function', 'class'].includes(word) && prev !== '.' && !/^\s*:/.test(text.slice(i))) {
          constructs.push({ kind: word, value: prev === 'async' ? asyncValue : expression && !statementStart(prev),
            params: null, ready: false, parens: parens.length, braces: braces.length });
        }
        forAwait = word === 'await' && prev === 'for';
        expression = prev !== '.' && prefix.has(word); prev = word; continue;
      }
      i++;
      const pending = constructs.at(-1);
      if (ch === '(') {
        if (pending?.kind === 'function' && pending.params === null) pending.params = parens.length;
        parens.push(control.has(prev) || forAwait); forAwait = false; expression = true;
      } else if (ch === ')') {
        expression = parens.pop() === true;
        if (pending?.kind === 'function' && pending.params === parens.length) pending.ready = true;
      }
      else if (ch === '{') {
        const block = !expression || ['', ')', ';', '{', '=>', 'else', 'do', 'try', 'finally'].includes(prev);
        const body = pending && (pending.kind === 'function' ? pending.ready :
          pending.parens === parens.length && pending.braces === braces.length);
        braces.push(body ? !constructs.pop().value : block); expression = true;
      } else if (ch === '}') {
        if (interpolation && !braces.length) return;
        expression = braces.pop() !== false;
      } else if (ch === ']') expression = false;
      else if (ch === '.') expression = false;
      else if ((ch === '+' || ch === '-') && next === ch) { i++; prev = ch + ch; continue; }
      else if (ch === '=' && next === '>') { i++; prev = '=>'; expression = true; continue; }
      else expression = true;
      prev = ch;
    }
  }
  code();
  return out;
}

export function swallowed(text) {
  const out = [];
  for (const comment of lineComments(text)) {
    const line = comment.text;
    for (let k = line.indexOf('// ('); k >= 0; k = line.indexOf('// (', k + 4)) {
      let depth = 0, j = k + 3;
      for (; j < line.length; j++) {
        if (line[j] === '(') depth++;
        else if (line[j] === ')' && !--depth) break;
      }
      const rest = line.slice(j + 1).trim();
      if (j < line.length && !rest.startsWith('//') && compiles(rest)) {
        out.push({ line: comment.line, rest }); break;
      }
    }
  }
  return out;
}

function controls() {
  const plants = [
    ['assignment', 'a(); // (M6 · A1: a note) b.dirty = true;', 'b.dirty = true;'],
    ['closing block', 'if (x) { a(); // (M6 · A1: a note) b.dirty = true; }', 'b.dirty = true; }'],
    ['opening block', 'a(); // (M10 · D2: a note) if (k > 2) { b(k);', 'if (k > 2) { b(k);'],
  ];
  for (const [name, source, rest] of plants) {
    assert.deepEqual(swallowed(source), [{ line: 1, rest }], `planted ${name}`);
    console.log(`control ${name}: PASS (caught 1/1)`);
  }
  const clean = [
    'a(); // (a note) and then more words about it',
    'a(); // (a note; with (nested) parens)',
    'return true; }; // (a note) };',
    'a(); // (a note) // (a second note)',
    'const s = "// (a note) b();";',
    "const s = '// (a note) b();';",
    'const s = "escaped \\" // (a note) b();";',
    'const r = /[// (a note) b();]/;',
    'if (x) /[// (a note) b();]/.test(x);',
    'if (x) {} /[// (a note) b();]/.test(x);',
    'for await (const x of xs) /[// (a note) b();]/.test(x);',
    '/* // (a note) b();\n// (a note) c(); */',
    'const t = `raw\n// (a note) b(); ${`nested // (note) c();`}`;',
  ];
  for (const source of clean) assert.deepEqual(swallowed(source), [], `literal/prose control: ${source}`);
  assert.deepEqual(swallowed('const t = `${a() // (a note) b();\n}`;'), [{ line: 1, rest: 'b();' }]);
  assert.deepEqual(swallowed('const n = (a + b) / c; // (a note) b();'), [{ line: 1, rest: 'b();' }]);
  for (const value of ['function () {}', 'async function () {}', 'class {}', '{ x: 1 }']) {
    assert.deepEqual(swallowed(`const n = ${value} / 2; // (a note) b();`), [{ line: 1, rest: 'b();' }]);
  }
  console.log(`literal/prose controls: PASS (${clean.length} clean, interpolation and division checked)`);
}

// Only explicit generated-file markers in the leading comment header count, not prose about generation.
const generated = (file, text) => /\.(?:generated|min)\.m?js$/.test(file) ||
  /^\s*(?:\/\/|\/\*|\*)\s*(?:@generated\b|auto[- ]?generated\b|generated\s+(?:by|file|code)\b|do not (?:edit|hand[- ]?edit)\b)/im.test(
    text.match(/^\s*(?:(?:\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*/)?.[0] || '');

export function scan(root = ROOT) {
  const files = [], skipped = [], hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!SKIP.has(entry.name)) walk(file); continue; }
      if (!entry.isFile() || !/\.m?js$/.test(entry.name)) continue;
      const text = fs.readFileSync(file, 'utf8'), relative = path.relative(root, file);
      if (generated(file, text)) { skipped.push(relative); continue; }
      files.push(relative);
      for (const hit of swallowed(text)) hits.push({ file: relative, ...hit });
    }
  }
  for (const dir of DIRS) walk(path.join(root, dir));
  return { files, skipped, hits };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    controls();
    const { files, skipped, hits } = scan();
    for (const hit of hits) console.log(`${hit.file}:${hit.line}: ${hit.rest}`);
    console.log(`COMMENTCHECK ${hits.length ? 'FAIL' : 'PASS'}: ${hits.length} hits in ${files.length} files; ${skipped.length} generated files skipped`);
    process.exitCode = hits.length ? 1 : 0;
  } catch (error) {
    console.error(`COMMENTCHECK FAIL: ${error.message}`); process.exitCode = 1;
  }
}
