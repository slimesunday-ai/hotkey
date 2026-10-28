// CAST SYNC · copies the new character system and slime's curation from the clean room (ai-city-fresh) into the city, so the walkers
// and every other city character wear the fresh cast. Re-run it whenever traits are added or slime kills or ranks more:
//   node style/city/tools/sync-cast.mjs [--from <source-checkout>] [--dry]
// then rebake (node style/city/tools/bake.mjs): the build hash covers these files, so an old bake is never read.
//
// What lands where (the source's own layout is kept, so its relative imports keep working):
//   <src>/world/{chars.js, base-kit.js, fit/, fresh/, legacy/}   → world/cast/…          (the construction + the registry, both pools:
//                                                                 the agents' traits and the NPC pool, fresh/npc/, 2026-10-07)
//   <src>/world/fresh-curation.json                             → world/cast/fresh-curation.json (the snapshot, verbatim)
//                                                               + world/cast/curation.js (the same JSON as a module: the build
//                                                                 workers bundle modules only; style/city/cast.js reads the kills
//                                                                 and slime's ranks from it when it loads: an entry's `rank`,
//                                                                 common | rare | epic | grail, is the trait's tier in the city)
//   <src>/style/city/anim/{bake,walk2,gait2,grip,idle,fine}.js  → style/city/anim/cast/… (the approved walk + leg system, the seat
//                                                                 fix, the fine-detail bake and atlas)
//   <src>/style/city/anim/clips/                                → style/city/anim/cast/clips/ (the clip registry: robbery, falls, …;
//                                                                 walk2.js imports it; the stage plays its clips)
//   <src>/style/city/anim/elbow/{styles.js, bands.js, styles/}  → style/city/anim/cast/elbow/… (THE ELBOW, 2026-10-08: the cast's bend
//                                                                 style, compiled into the walker by walk2.js and baked for by bake.js;
//                                                                 only the registry and its styles: the elbow lab and gates stay there)
//   world/cast/SOURCE.json                                      the source commit, the time, the file list
// Five mechanical rewrites, each asserted (the sync fails loudly when the source changes shape):
//   1 · world/cast/fit/contract.js re-exports BUDGET from the studio's audit lib (which imports the registry: an import cycle the
//       city's worker bundler refuses, and the lib is not in the city). The BUDGET constant is copied in place of the re-export.
//   2 · world/cast/fresh/index.js loads each category file with import('./' + f): the worker bundler (pool.js / srcmap.js FROM_RE)
//       follows static imports only, so the files are imported statically and looked up by name (agent, imported and NPC files).
//   3 · world/cast/fresh/imported/kit.js loads fit/layers.js with a dynamic import (to dodge the cycle in 1); static here.
//   4 · style/city/anim/cast/*.js import '../../../world/…' → '../../../../world/cast/…'.
//   5 · "import'" in a comment (an apostrophe) → "import’": the worker bundler's regex would read it as an import (see below).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SRC = path.resolve(arg('--from', process.env.HOTKEY_CAST_SOURCE || path.join(os.homedir(), 'Desktop', 'ai-city-fresh'))), DRY = argv.includes('--dry');
const W_OUT = path.join(ROOT, 'world/cast'), A_OUT = path.join(ROOT, 'style/city/anim/cast');
const WORLD = ['chars.js', 'base-kit.js', 'fit', 'fresh', 'legacy'], ANIM = ['bake.js', 'walk2.js', 'gait2.js', 'grip.js', 'idle.js', 'fine.js'], ANIM_DIRS = ['clips'];   // (clips/: the authored clip registry, 2026-10-07; walk2.js imports it)
const die = m => { console.error('sync-cast: ' + m); process.exit(1); };
if (!fs.existsSync(path.join(SRC, 'world/fresh/index.js'))) die(`no fresh registry at ${SRC}/world/fresh/index.js`);

// ── collect the files (every .js / .mjs / .json / .md under the listed roots)
const files = [];   // [src abs, dest abs]
const walk = (dir, out) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(m?js|json|md)$/.test(e.name)) out.push(p); } };
for (const w of WORLD) { const p = path.join(SRC, 'world', w); if (!fs.existsSync(p)) die('missing ' + p); const list = []; fs.statSync(p).isDirectory() ? walk(p, list) : list.push(p);
  for (const f of list) files.push([f, path.join(W_OUT, path.relative(path.join(SRC, 'world'), f))]); }
for (const a of ANIM) { const p = path.join(SRC, 'style/city/anim', a); if (!fs.existsSync(p)) die('missing ' + p); files.push([p, path.join(A_OUT, a)]); }
// the elbow (ai-city-fresh style/city/anim/ELBOW.md § The cast): walk2.js and bake.js import elbow/styles.js, which imports styles/*.js,
// which import bands.js (no cycle: the worker bundler refuses one)
{ const E = path.join(SRC, 'style/city/anim/elbow'); if (!fs.existsSync(path.join(E, 'styles.js'))) die('missing ' + path.join(E, 'styles.js') + ' (sync from ai-city-fresh with the elbow, 2026-10-08 or later)');
  for (const f of ['styles.js', 'bands.js', ...fs.readdirSync(path.join(E, 'styles')).filter(f => f.endsWith('.js')).map(f => 'styles/' + f)]) files.push([path.join(E, f), path.join(A_OUT, 'elbow', f)]); }
for (const a of ANIM_DIRS) { const p = path.join(SRC, 'style/city/anim', a); if (!fs.existsSync(p)) die('missing ' + p); const list = []; walk(p, list); for (const f of list) files.push([f, path.join(A_OUT, path.relative(path.join(SRC, 'style/city/anim'), f))]); }

// ── the rewrites
const rel = d => path.relative(ROOT, d), text = new Map();
for (const [s, d] of files) text.set(d, fs.readFileSync(s, 'utf8'));
const edit = (d, fn, what) => { const before = text.get(d); if (before === undefined) die('no file for rewrite ' + what); const after = fn(before); if (after === before) die(`rewrite "${what}" matched nothing in ${rel(d)} (the source changed shape: update sync-cast.mjs)`); text.set(d, after); };
// 1 · BUDGET
{ const lib = fs.readFileSync(path.join(SRC, 'style/city/studio/audit/lib.mjs'), 'utf8'), m = lib.match(/^export const BUDGET = \{[^\n]*\};$/m); if (!m) die('BUDGET not found in the audit lib');
  edit(path.join(W_OUT, 'fit/contract.js'), t => t.replace(/^export \{ BUDGET \} from '\.\.\/\.\.\/style\/city\/studio\/audit\/lib\.mjs';[^\n]*$/m,
    m[0] + '   // (sync-cast.mjs: copied from style/city/studio/audit/lib.mjs, which is not in the city and would close an import cycle)'), 'BUDGET'); }
// 2 · the registry's category files, statically
//     (the NPC pool's files too, world/fresh/npc/: index.js NPC; without them the city's registry would load no NPC trait at all)
const R = await import(pathToFileURL(path.join(SRC, 'world/fresh/index.js')).href);
if (!R.NPC || !R.NPC_REG || !R.NPC_PREFIX) die('the source registry has no NPC pool (index.js NPC / NPC_REG / NPC_PREFIX): sync from ai-city-fresh 46731d4 or later');
{ const names = [...new Set([...Object.values(R.FILE_OF), ...Object.keys(R.IMPORTED), ...Object.keys(R.NPC)])];
  const imps = names.map((f, i) => `import * as __f${i} from './${f}';`).join(' '), map = `const __FILES = { ${names.map((f, i) => `'${f}': __f${i}`).join(', ')} };`;
  edit(path.join(W_OUT, 'fresh/index.js'), t => t.replace("(await import('./' + f)).default", "(__FILES[f] || (() => { throw new Error('not in the city bundle: ' + f); })()).default"), 'registry loadFile');
  edit(path.join(W_OUT, 'fresh/index.js'), t => t.replace(/^(import \* as KIT from '\.\/kit\.js';)$/m, `$1\n// (sync-cast.mjs: every category file imported statically, for the city's worker bundler; loadFile looks them up by name)\n${imps}\n${map}`), 'registry static imports'); }
// 3 · imported/kit.js → fit/layers.js
edit(path.join(W_OUT, 'fresh/imported/kit.js'), t => t.replace("let LAYERS = null; import('../../fit/layers.js').then(m => { LAYERS = m; }, () => {});",
  "import * as LAYERS_NS from '../../fit/layers.js'; const LAYERS = LAYERS_NS;   // (sync-cast.mjs: static in the city; the source loads it dynamically)"), 'imported kit layers');
// 4 · anim → world/cast
for (const a of ANIM) { const d = path.join(A_OUT, a), t = text.get(d); if (t.includes("'../../../world/")) edit(d, s => s.split("'../../../world/").join("'../../../../world/cast/"), 'anim world path ' + a); }
// 5 · the worker bundler scans source text with srcmap.js FROM_RE: an apostrophe right after the word "import" in a comment
//     ("the tops import's own module") reads as `import '…'` and swallows the next real import. Such apostrophes become ’.
{ const { FROM_RE } = await import(pathToFileURL(path.join(ROOT, 'style/city/srcmap.js')).href);
  for (const [d, t] of text) { if (!/\.m?js$/.test(d)) continue; const u = t.replace(/^(.*\/\/.*?\bimport)'/gm, '$1’'); if (u !== t) text.set(d, u);
    for (const m of text.get(d).matchAll(FROM_RE)) if (!/^(\.{1,2}\/|three)\S*$/.test(m[3])) die(`${rel(d)}: the worker bundler would read ${JSON.stringify(m[3].slice(0, 60))} as an import (srcmap.js FROM_RE)`); } }
// any import left that leaves the copied trees is a bug
for (const [d, t] of text) { if (!/\.m?js$/.test(d)) continue; for (const m of t.matchAll(/(?:from\s*|import\s*\(?\s*)'(\.[^']+)'/g)) { const to = path.resolve(path.dirname(d), m[1]);
  if (!to.startsWith(W_OUT) && !to.startsWith(A_OUT)) die(`${rel(d)} imports ${m[1]}, outside the copied trees`); if (!text.has(to)) die(`${rel(d)} imports ${m[1]}, which was not copied`); } }

// ── the curation snapshot (verbatim) + its module form
const curSrc = path.join(SRC, 'world/fresh-curation.json'), cur = fs.readFileSync(curSrc, 'utf8'), C = JSON.parse(cur);
if (C.version !== 1 || !C.traits) die('unexpected curation shape');
// ranks ride in the snapshot verbatim; one the city can't read is a loud failure, not a silent common
const RANK_OK = new Set(['common', 'rare', 'epic', 'grail']);
for (const [k, e] of Object.entries(C.traits)) if (e && e.rank !== undefined && !RANK_OK.has(e.rank)) die(`curation: ${k} has rank ${JSON.stringify(e.rank)} (expected common, rare, epic or grail)`);
text.set(path.join(W_OUT, 'fresh-curation.json'), cur);
text.set(path.join(W_OUT, 'curation.js'), `// GENERATED by style/city/tools/sync-cast.mjs from ai-city-fresh world/fresh-curation.json (slime's keep / kill / undecided + rank).\n// Do not edit: re-run the sync. style/city/cast.js reads the kills (keep and undecided both ship) and the ranks (a trait's tier for\n// the roll weights, over the designer's) from it when it loads.\nexport default ${cur.trim()};\n`);
let commit = '?', dirty = false; try { commit = execFileSync('git', ['-C', SRC, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); dirty = execFileSync('git', ['-C', SRC, 'status', '--porcelain', '--', 'world', 'style/city/anim'], { encoding: 'utf8' }).trim() !== ''; } catch {}
const kills = Object.entries(C.traits).filter(([, e]) => e.status === 'kill').map(([k]) => k).sort(), ranks = Object.values(C.traits).filter(e => e.rank).length;
// the NPC pool's curation rides in the same snapshot under '<slot>/npc_<id>' (style/city/cast.js applies kills and ranks to both pools);
// an npc_ key that names no NPC trait is a loud failure (a typo'd kill would otherwise let the trait roll)
const isNpcKey = k => k.split('/')[1]?.startsWith(R.NPC_PREFIX), npcKills = kills.filter(isNpcKey), npcRanks = Object.entries(C.traits).filter(([k, e]) => e.rank && isNpcKey(k)).length;
for (const k of Object.keys(C.traits).filter(isNpcKey)) { const [slot, id] = k.split('/'); if (!R.NPC_REG[slot]?.[id]) die(`curation: ${k} names no NPC trait in the source registry`); }
const npcCount = Object.values(R.NPC_REG).reduce((n, o) => n + Object.keys(o).length, 0);
text.set(path.join(W_OUT, 'SOURCE.json'), JSON.stringify({ from: SRC, commit, dirty, at: new Date().toISOString(), kills: kills.length, ranks, npc: { traits: npcCount, kills: npcKills, ranks: npcRanks }, files: [...text.keys()].map(rel).sort() }, null, 1) + '\n');

// ── write (the copied trees are replaced whole, so a trait file removed upstream goes here too)
const npcLine = `NPC pool: ${npcCount} traits, ${npcKills.length} kills${npcKills.length ? ' (' + npcKills.join(', ') + ')' : ''}, ${npcRanks} ranks`;
if (DRY) { console.log(`sync-cast (dry): ${text.size} files from ${SRC} @ ${commit}${dirty ? ' (dirty)' : ''}, ${kills.length} kills, ${ranks} ranks · ${npcLine}`); process.exit(0); }
for (const d of [W_OUT, A_OUT]) fs.rmSync(d, { recursive: true, force: true });
for (const [d, t] of text) { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, t); }
console.log(`sync-cast: ${text.size} files from ${SRC} @ ${commit}${dirty ? ' (dirty)' : ''} → ${rel(W_OUT)}/, ${rel(A_OUT)}/ · ${kills.length} kills, ${ranks} ranks in the curation snapshot`);
console.log(npcLine);
console.log('next: node style/city/tools/bake.mjs (the build hash changed)');
