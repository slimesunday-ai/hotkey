// MOVEMENT W2 · SEEDS the apartments registry (world/export/apartments.json): every walk-up unit the city's blocks anchor
// (gen.js pass 2 · `apt:<i_j>·L<k>·<floor>`, heroes' own units). The 10-01 rule: apartment ids are FIXED ids in a registry file, like
// the lots, never derived from geometry at run time. So this tool only ever ADDS: an id already in the registry keeps its entry exactly
// (a unit the build no longer makes is marked `gone: true`, never removed or re-keyed); a new unit is appended. tools/export-world.mjs
// reads the registry, not the geometry.
//   THREE=<path to three/build/three.module.js> node style/city/tools/apartments-seed.mjs [--dry] [--positions]
//   SPREAD=<m> …: that spread's file (apartments.s<m>.json beside the default's: the same ids, its own doors; see SPREAD below)
// Pure node: builds every urban block with the page's own build (jobs.js jobBlock, every manifest module installed). The build needs a
// real three for its materials (the sim's stub isn't enough): set THREE, or it tries a few known checkouts.
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), CITY = path.resolve(HERE, '..'), ROOT = path.resolve(CITY, '../..');
const DRY = process.argv.includes('--dry'), POS = process.argv.includes('--positions');
const cands = [process.env.THREE, path.join(process.env.HOME || '', 'Desktop/degen-crafter-3d/node_modules/three/build/three.module.js'),
  path.join(process.env.HOME || '', 'Desktop/traits-demo/node_modules/three/build/three.module.js')].filter(Boolean);
const THREE = cands.find(p => fs.existsSync(p)); if (!THREE) { console.error('apartments-seed: no three found; set THREE=<…/three/build/three.module.js>'); process.exit(1); }
const T = pathToFileURL(path.dirname(path.dirname(THREE)) + '/').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'three') return { url: ${JSON.stringify(T + 'build/three.module.js')}, shortCircuit: true };
  if (s.startsWith('three/addons/')) return { url: ${JSON.stringify(T + 'examples/jsm/')} + s.slice(13), shortCircuit: true }; return n(s, c); }`));
globalThis.performance ??= { now: () => Date.now() };
const imp = p => import(pathToFileURL(path.join(CITY, p)).href);
const { parseManifest, loadOptional } = await imp('modules.js');
const J = await imp('jobs.js'), { kindAt, distOf, urban } = await imp('plan.js');
// SPREAD (pass 5b): each spread has its registry file (world/city.js sdata: apartments.json is the default spread's, apartments.s<m>.json
// another's) with the SAME ids — the ids are the law at any spread — and that spread's doors. A spread's file is seeded from the default
// registry's ids; --positions (implied when seeding one) sets every registry unit's x, z to its door as this build has it (ids untouched).
const { sdata, SPREAD } = await import(pathToFileURL(path.join(ROOT, 'world/city.js')).href), BASE_REG = path.join(ROOT, 'world/export/apartments.json'), OUT = path.join(ROOT, sdata('world/export/apartments.json'));
const inst = J.installModules(await loadOptional(parseManifest(fs.readFileSync(path.join(CITY, 'manifest.js'), 'utf8')), p => imp(p)));
if (inst.errors.length) console.log('module errors:', inst.errors.map(e => e.path).join(', '));
const flags = { neutral: true, pass2: true, faces: true }, units = new Map(), t0 = Date.now(); let blocks = 0, errs = 0;
for (let i = -12; i <= 12; i++) for (let j = -13; j <= 12; j++) { if (!urban(kindAt(i, j))) continue; let res;
  try { res = J.jobBlock({ i, j, night: false, audit: false, chars: false, flags }); } catch (e) { errs++; continue; } blocks++;
  for (const b of res.anchors?.buildings || []) { if (b.tier !== 'apartment') continue; const d = b.entrance?.simDoor || b.entrance?.door; if (!d) continue;
    const dx = +(+d[0]).toFixed(2), dz = +(+(d.length === 3 ? d[2] : d[1])).toFixed(2);
    for (const u of b.units || []) units.set(u.id, { id: u.id, building: b.id, block: [i, j], dist: distOf(kindAt(i, j)), floor: u.floor, x: dx, z: dz, stoop: !!b.entrance?.stoop }); } }
console.log(`built ${blocks} blocks (${errs} failed) in ${((Date.now() - t0) / 1000).toFixed(1)} s · ${units.size} apartment units`);
let reg = { version: 1, note: '', apartments: [] }, seeded = false; try { reg = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { if (OUT !== BASE_REG) { reg = JSON.parse(fs.readFileSync(BASE_REG, 'utf8')); seeded = true; } }
let moved = 0, notBuilt = 0; const stoopDiff = []; if (POS || seeded) for (const a of reg.apartments) { const u = units.get(a.id); if (!u) { if (!a.gone) notBuilt++; continue; }
  if (u.stoop !== a.stoop) stoopDiff.push(a.id); if (u.x !== a.x || u.z !== a.z) { a.x = u.x; a.z = u.z; moved++; } }
if (POS || seeded) console.log(`positions at SPREAD ${SPREAD}${seeded ? ' (seeded from ' + path.relative(ROOT, BASE_REG) + ')' : ''}: ${moved} doors moved · ${notBuilt} registry units this build doesn't make · stoop differs on ${stoopDiff.length}${stoopDiff.length ? ' (' + stoopDiff.slice(0, 5).join(', ') + ')' : ''}`);
const have = new Map(reg.apartments.map(a => [a.id, a])); let added = 0, gone = 0;
for (const a of reg.apartments) { if (!units.has(a.id) && !a.gone) { a.gone = true; gone++; } }
for (const [id, u] of [...units].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) if (!have.has(id)) { reg.apartments.push(u); added++; }
reg.version = 1;
reg.note = 'The apartments registry (the home ladder\'s second rung: walk-up units over the shops). FIXED ids, like the lots (10-01): this file is the law, not the geometry. tools/apartments-seed.mjs only appends new units and marks vanished ones gone: true; it never re-keys or removes. x, z = the building\'s street door (where an agent goes in).';
if (!DRY) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(reg, null, 1) + '\n'); }
console.log(`registry: ${reg.apartments.length} apartments (${added} added, ${gone} newly gone)${DRY ? ' · dry run, nothing written' : ' → ' + path.relative(ROOT, OUT)}`);
process.exit(0);
