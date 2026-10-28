// Pass 1d · the audit gate, from the command line. Pass 2: the fast per-block check (block / district) and new checks.
//   node style/city/tools/audit.mjs block <i>,<j> [<i>,<j> …] [--night] [--vs <label>]   build + audit only those blocks (seconds), print
//                                                             every issue, refused placement, walker pinch and module error; --vs
//                                                             compares with an earlier run of the same blocks (runs/<label>.json)
//   node style/city/tools/audit.mjs district <name> [--night]  the same for every block a district kit builds (districts/<name>.js)
//   node style/city/tools/audit.mjs run <label> [--night]     build every block of the section with the audit on (headless Chrome,
//                                                             ?audit=1&report=1&shot=1) and save the raw result to tools/runs/<label>.json
//   node style/city/tools/audit.mjs report <before> <after>   write AUDIT.md + audit.json (before/after counts per block and location)
// The page must be served: node style/serve.mjs 5320
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { LOCATIONS, locationOf } from '../locations.js';
import { REGULATORY } from '../signage/lexicon.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..'), RUNS = process.env.AUDIT_RUNS || path.join(HERE, 'runs');   // (AUDIT_RUNS: write the runs elsewhere, e.g. a scratch dir)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', BASE = process.env.CITY_URL || 'http://127.0.0.1:5320/style/city/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// pass 3 · signage: repeats. Every block's audit carries its sign log (REG.blk.signs: family, words, x, z, radius, lot group). Two
// records with the same words are a repeat when they are closer than their radius (a kit's own name, radius 0: in the same block),
// unless they are the same sign (the same block and lot: a corner shop's two faces). The later block gets the issue. Regulatory
// plates (signage/lexicon.js REGULATORY: BEWARE OF DOG, NO PARKING …) are street furniture and never count.
export function signRepeats(blocks) {
  const all = []; for (const b of blocks) for (const s of b.signs || []) { const key = String(s.key).toUpperCase(); if (!REGULATORY.has(key)) all.push({ ...s, key, blk: b.key, b }); }   // (regulatory plates repeat, like stop signs)
  const byKey = new Map(); for (const s of all) { if (!byKey.has(s.key)) byKey.set(s.key, []); byKey.get(s.key).push(s); }
  let n = 0; for (const list of byKey.values()) { if (list.length < 2) continue;
    for (let a = 0; a < list.length; a++) for (let c = a + 1; c < list.length; c++) { const A = list[a], B = list[c]; if (A.blk === B.blk && A.group === B.group) continue;
      const d = Math.hypot(A.x - B.x, A.z - B.z), r = Math.min(A.r ?? 96, B.r ?? 96); if (!(r > 0 ? d < r : A.blk === B.blk)) continue;
      B.b.issues.push({ type: 'sign-repeat', id: `${B.blk}·${B.group || 'sign'}·${B.fam}·"${B.key}"`, other: `${A.blk}·${A.group || 'sign'}`, kind: 'sign', group: B.group || 'sign', box: [B.x - .5, 0, B.z - .5, B.x + .5, 4, B.z + .5], note: `"${B.key}" (${B.fam}) also ${Math.round(d)} m away at ${A.blk}` }); n++; } }
  return n;
}
async function run(label, night, o = {}) {
  const prof = await fs.mkdtemp(path.join(os.tmpdir(), 'city-audit-')), url = o.url || `${BASE}?audit=1&report=1&shot=1${night ? '&tod=night' : ''}&w=800&h=500`;
  const ch = spawn(CHROME, ['--headless=new', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--use-angle=metal', '--ignore-gpu-blocklist', '--remote-debugging-port=0', '--window-size=800,588', 'about:blank'], { stdio: 'ignore' });
  try {
    let port = null; for (let t = 0; t < 100 && !port; t++) { await sleep(100); try { port = (await fs.readFile(path.join(prof, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; } catch {} }
    if (!port) throw new Error('chrome did not start');
    const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const wait = new Map(), logs = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value ?? a.description).join(' ')); if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 600)); };
    const send = (method, params = {}) => new Promise(res => { const k = ++id; wait.set(k, res); ws.send(JSON.stringify({ id: k, method, params })); });
    await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url });
    const t0 = Date.now(); let title = '';
    while (Date.now() - t0 < (+process.env.AUDIT_MS || 300000)) { await sleep(1000); const r = await send('Runtime.evaluate', { expression: 'document.title + "|" + (document.getElementById("err")?.textContent || "")', returnByValue: true }); title = r.result?.result?.value || '';
      if (title.startsWith('audit-ready')) break; if (title.split('|')[1]) { console.log('page error:', title.split('|')[1]); break; } }
    if (!title.startsWith('audit-ready')) { console.log(logs.slice(-30).join('\n')); throw new Error('audit did not finish: ' + title); }
    const r = await send('Runtime.evaluate', { expression: `JSON.stringify(window.${o.global || '__auditReport'})`, returnByValue: true }), data = JSON.parse(r.result.result.value);
    if (!o.global && data.blocks) signRepeats(data.blocks);   // pass 3: the signage repeat check across the run's blocks
    await fs.mkdir(RUNS, { recursive: true }); const out = path.join(RUNS, label + (o.ext || '.json')); await fs.writeFile(out, JSON.stringify(data));
    if (o.global) { console.log(`${o.global} ${label}: ${Object.keys(data.blocks).length} entries, ${data.ms} ms → ${path.relative(process.cwd(), out)}`); ws.close(); return data; }
    const n = data.blocks.reduce((s, b) => s + b.issues.length, 0); console.log(`audit ${label}: ${data.blocks.length} blocks, ${n} issues, ${data.ms} ms → ${path.relative(process.cwd(), out)}`);
    ws.close(); return data;
  } finally { ch.kill('SIGKILL'); await sleep(300); await fs.rm(prof, { recursive: true, force: true }).catch(() => {}); }
}

const TYPES = ['prop-in-building', 'prop-in-facade', 'blocks-door', 'prop-overlap', 'car-in-curb', 'prop-floating', 'prop-sunk', 'prop-detached', 'text-overhang', 'text-floating', 'text-hidden', 'text-overwritten', 'text-blocked', 'z-fight', 'floating-geometry', 'char-inside', 'char-floating', 'char-railing', 'char-overlap', 'char-in-lane', 'walker-blocked', 'walker-overlap', 'walker-furniture', 'sign-repeat'];
const WHAT = { 'prop-in-building': 'props or street furniture inside a building mass', 'prop-in-facade': 'props inside facade parts (awnings, signs, stoops, storefronts)', 'blocks-door': 'props standing in a doorway',
  'prop-overlap': 'objects running into other objects', 'car-in-curb': 'cars with a wheel in the raised sidewalk', 'prop-floating': 'objects with no support underneath', 'prop-sunk': 'objects sunk into the surface below',
  'text-overhang': 'sign text partly off its board', 'text-floating': 'sign text with no board at all', 'text-hidden': 'sign text covered by geometry in front', 'text-overwritten': 'sign text painted over by later geometry',
  'z-fight': 'coincident faces drawn by two volumes (z-fighting)', 'floating-geometry': 'voxel islands floating inside a volume', 'char-inside': 'characters inside geometry', 'char-floating': 'characters standing on nothing',
  'prop-detached': 'props in more than one piece (a giant object below its bracket, a sign off its post) · NEW CHECK in pass 2', 'text-blocked': 'sign text covered 0.2–0.3 m in front · NEW CHECK in pass 2', 'char-railing': 'heads inside a railing or a wall · NEW CHECK in pass 2',
  'char-overlap': 'people inside people (heads closer than 0.7 m) · NEW CHECK in pass 2', 'char-in-lane': 'people standing where the cars drive: a travel lane or an intersection box · NEW CHECK in the walkers-fix round', 'walker-blocked': 'sidewalk spots where walkers pass through street furniture · NEW CHECK in pass 2 (for the location agents: hand-move the furniture)',
  'walker-overlap': 'the walk check (60 s of walkers, district runs): two walkers, or a walker and an agent, walking through each other · NEW CHECK in the cleanup pass',
  'walker-furniture': 'the walk check (60 s of walkers, district runs): a walker walking through street furniture, a facade part or a standing person · NEW CHECK in the cleanup pass',
  'sign-repeat': 'the same sign design or shop name twice within its radius (roof boards 160 m, other designs and shop names 96 m, a kit\'s own names within the block; regulatory plates never count) · NEW CHECK in pass 3 (signage)' };
const count = (blocks, f = () => true) => { const c = Object.fromEntries(TYPES.map(t => [t, 0])); for (const b of blocks) for (const q of b.issues) if (f(b, q)) c[q.type] = (c[q.type] || 0) + 1; return c; };
const sum = c => Object.values(c).reduce((s, x) => s + x, 0);

async function report(beforeLabel, afterLabel) {
  const B = JSON.parse(await fs.readFile(path.join(RUNS, beforeLabel + '.json'), 'utf8')), A = JSON.parse(await fs.readFile(path.join(RUNS, afterLabel + '.json'), 'utf8'));
  const tag = (d) => { for (const b of d.blocks) for (const q of b.issues) q.location = locationOf(b.key, q.group); return d; }; tag(B); tag(A);
  const cb = count(B.blocks), ca = count(A.blocks);
  const perBlock = A.blocks.map(b => { const bb = B.blocks.find(x => x.key === b.key); return { key: b.key, i: b.i, j: b.j, kind: b.k, hero: b.hero, place: b.place, location: locationOf(b.key), items: b.items, chars: b.chars, before: bb ? count([bb]) : null, after: count([b]), issues: b.issues,
    skipped: b.skipped || [], ids: b.list || [], people: b.people || [] }; });
  const perLoc = LOCATIONS.map(L => ({ id: L.id, name: L.name, blocks: L.blocks.map(([i, j]) => `${i}_${j}`), before: count(B.blocks, (b, q) => q.location === L.id), after: count(A.blocks, (b, q) => q.location === L.id) }));
  const json = { generated: new Date().toISOString(), before: { run: beforeLabel, when: B.when, total: sum(cb), byType: cb }, after: { run: afterLabel, when: A.when, total: sum(ca), byType: ca }, types: WHAT, locations: perLoc, blocks: perBlock };
  await fs.writeFile(path.join(CITY, 'audit.json'), JSON.stringify(json, null, 1));
  // AUDIT.md: the counts, then the open issues per location (ids + coordinates), short enough to read
  const L = []; const row = (name, b, a) => `| ${name} | ${b} | ${a} |`;
  L.push('# Audit: intersections, floating objects, floating text', '', `Generated by \`tools/audit.mjs\` from \`?audit=1&report=1\` (every block of the section built with the audit on). Before = run \`${beforeLabel}\`, after = run \`${afterLabel}\`. Full lists with boxes: \`audit.json\`. In the page: \`?audit=1\` draws every issue as a red box with a label.`, '');
  L.push('## Counts by type', '', '| type | before | after |', '|---|---:|---:|'); for (const t of TYPES) L.push(row(`${t}: ${WHAT[t]}`, cb[t] || 0, ca[t] || 0)); L.push(row('**total**', `**${sum(cb)}**`, `**${sum(ca)}**`), '');
  L.push('## Counts by location', '', '| location | blocks | before | after |', '|---|---|---:|---:|'); for (const p of perLoc) L.push(`| ${p.name} | ${p.blocks.join(' ')} | ${sum(p.before)} | ${sum(p.after)} |`); L.push('');
  L.push('## Counts by block', '', '| block | kind | location | items | before | after |', '|---|---|---|---:|---:|---:|');
  for (const b of perBlock) L.push(`| ${b.key} | ${b.place || b.kind} | ${b.location} | ${b.items} | ${b.before ? sum(b.before) : '–'} | ${sum(b.after)} |`); L.push('');
  // placements the generator refused (nothing clear within its search): candidates for hand placement in the block's override file
  const sk = A.blocks.flatMap(b => (b.skipped || []).map(k => ({ ...k, key: b.key, location: k.group === 'corner' ? 'corners' : locationOf(b.key) })));
  L.push('## Placements the generator gave up on', '', `The placement rules refuse a spot rather than stamp into something. ${sk.length} placements found no clear spot in this run (people are dropped only when a nudge of up to 0.6 m cannot clear them). Location agents can hand-place these in their block's override file.`, '', '| location | refused (by kind) |', '|---|---|');
  for (const p of perLoc) { const c = {}; for (const k of sk.filter(k => k.location === p.id)) c[k.kind] = (c[k.kind] || 0) + 1; if (Object.keys(c).length) L.push(`| ${p.name} | ${Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', ')} |`); }
  L.push('', 'Named refusals worth a hand placement:', ''); for (const k of sk.filter(k => /giant|oneoff|newsstand/.test(k.kind))) L.push(`- \`${k.key}\` ${k.kind} near (${k.at.map(v => v.toFixed(1)).join(', ')}): ${k.why}`); L.push('');
  L.push('## Open issues by location', '', 'Ids are `block·group·kind·n` (group = the lot `L<k>`, `yard`, `street`, `traffic`, `corner`, `oneoff`, `hand`, or a hero part). Coordinates are the box centre in metres.', '');
  for (const p of perLoc) { const qs = A.blocks.flatMap(b => b.issues.filter(q => q.location === p.id)); L.push(`### ${p.name} (${qs.length})`, ''); if (!qs.length) { L.push('Clean.', ''); continue; }
    const byT = {}; for (const q of qs) (byT[q.type] ??= []).push(q);
    for (const t of TYPES) { const list = byT[t]; if (!list) continue; L.push(`- **${t}** (${list.length})`);
      for (const q of list.slice(0, 12)) { const c = [(q.box[0] + q.box[3]) / 2, (q.box[1] + q.box[4]) / 2, (q.box[2] + q.box[5]) / 2].map(v => v.toFixed(1)).join(', '); L.push(`  - \`${q.id}\`${q.other ? ' × `' + q.other + '`' : ''} at (${c}): ${q.note || ''}`); }
      if (list.length > 12) L.push(`  - … ${list.length - 12} more in audit.json`); }
    L.push(''); }
  await fs.writeFile(path.join(CITY, 'AUDIT.md'), L.join('\n'));
  console.log(`AUDIT.md + audit.json: before ${sum(cb)} → after ${sum(ca)}`); for (const t of TYPES) console.log(`  ${t.padEnd(18)} ${String(cb[t] || 0).padStart(5)} → ${String(ca[t] || 0).padStart(5)}`);
}

// ── pass 2 · the fast per-block check
async function blocks(label, list, night, district) {
  const q = district ? `district=${encodeURIComponent(district)}` : `blocks=${list.map(b => b.join(',')).join(';')}`;
  const data = await run(label, night, { url: `${BASE}?audit=1&report=1&shot=1&${q}${night ? '&tod=night' : ''}&w=400&h=250${process.argv.filter(a => a.startsWith('--q=')).map(a => '&' + a.slice(4)).join('')}` });
  const vsI = process.argv.indexOf('--vs'), vs = vsI > 0 ? JSON.parse(await fs.readFile(path.join(RUNS, process.argv[vsI + 1] + '.json'), 'utf8')) : null;
  let total = 0;
  for (const b of data.blocks) { const n = b.issues.length; total += n; const was = vs?.blocks.find(x => x.key === b.key);
    console.log(`\n■ block ${b.key} · ${b.kit || '?'}${b.placeholder ? ' · PLACEHOLDER' : ''}${b.place ? ' · ' + b.place : ''} · ${b.items} items · ${b.chars} people · ${n} issues${was ? ` (was ${was.issues.length})` : ''} · ${b.skipped?.length || 0} refused · ${b.ms} ms`);
    for (const e of b.errors || []) console.log(`  ✖ MODULE ${e.path} (${e.stage}): ${e.error}`);
    for (const t of TYPES) { const qs = b.issues.filter(x => x.type === t); if (!qs.length) continue; console.log(`  ${t} (${qs.length}) — ${WHAT[t]}`);
      for (const x of qs.slice(0, 8)) { const c = [(x.box[0] + x.box[3]) / 2, (x.box[1] + x.box[4]) / 2, (x.box[2] + x.box[5]) / 2].map(v => v.toFixed(1)).join(', '); console.log(`    ${x.id}${x.other ? ' × ' + x.other : ''} at (${c}): ${x.note || ''}`); }
      if (qs.length > 8) console.log(`    … ${qs.length - 8} more in tools/runs/${label}.json`); }
    const sk = b.skipped || []; if (sk.length) console.log(`  refused (${sk.length}): ${Object.entries(sk.reduce((m, k) => (m[k.kind] = (m[k.kind] || 0) + 1, m), {})).map(([k, v]) => k + ' ' + v).join(', ')}`); }
  for (const e of data.modules || []) if (!data.blocks.some(b => (b.errors || []).some(x => x.path === e.path))) console.log(`✖ MODULE ${e.path} (${e.stage}): ${e.error}`);
  if (data.walk) console.log(`\nwalk check: ${data.walk.walkers} walkers + ${data.walk.agents} agents × 60 s (${data.walk.foci} area${data.walk.foci === 1 ? '' : 's'}) · walker–walker ${data.walk.walkerWalker} · walker–agent ${data.walk.walkerAgent} · dog–walker ${data.walk.walkerDog ?? 0} (${data.walk.dogs ?? 0} dogs) · walker–furniture ${data.walk.walkerFurniture} · avoidance ${data.walk.avoidMsAvg} ms/step avg, ${data.walk.avoidMsMax} max`);
  console.log(`\n${data.blocks.length} block${data.blocks.length === 1 ? '' : 's'} · ${total} issues · ${data.ms} ms of building · saved tools/runs/${label}.json`);
}

const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === 'run') await run(a1 || 'latest', process.argv.includes('--night'));
else if (cmd === 'report') await report(a1, a2);
else if (cmd === 'hash') await run(a1 || 'hash', process.argv.includes('--night'), { url: `${BASE}?hash=1&shot=1${process.argv.includes('--night') ? '&tod=night' : ''}&w=800&h=500${process.argv.filter(a => a.startsWith('--q=')).map(a => '&' + a.slice(4)).join('')}`, global: '__hashReport', ext: '.hash.json' });
else if (cmd === 'hashdiff') { const A = JSON.parse(await fs.readFile(path.join(RUNS, a1 + '.hash.json'), 'utf8')).blocks, B = JSON.parse(await fs.readFile(path.join(RUNS, a2 + '.hash.json'), 'utf8')).blocks; let same = 0, diff = 0;
  for (const k of Object.keys(A)) { const x = JSON.stringify(A[k]), y = JSON.stringify(B[k]); if (x === y) same++; else { diff++; console.log('DIFF', k, x, '→', y); } } console.log(`hashdiff ${a1} → ${a2}: ${same} identical, ${diff} changed`); }
else if (cmd === 'block') { const list = process.argv.slice(3).filter(a => /^-?\d+,-?\d+$/.test(a)).map(a => a.split(',').map(Number)); if (!list.length) { console.log('usage: audit.mjs block <i>,<j> [<i>,<j> …]'); process.exit(2); }
  await blocks('block-' + list.map(b => b.join('_')).join('-').slice(0, 60), list, process.argv.includes('--night')); }
else if (cmd === 'district') await blocks('district-' + a1, null, process.argv.includes('--night'), a1);
else if (cmd === 'summary') { const d = JSON.parse(await fs.readFile(path.join(RUNS, a1 + '.json'), 'utf8')); const c = count(d.blocks); console.log(a1, sum(c)); for (const t of TYPES) console.log(`  ${t.padEnd(18)} ${c[t] || 0}`); }
else console.log('usage: audit.mjs block <i>,<j> … | district <name> | run <label> [--night] | report <before> <after> | summary <label> | hash <label> | hashdiff <a> <b>');
