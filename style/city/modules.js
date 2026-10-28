// Pass 2 · page isolation. The registry of OPTIONAL modules (district kits, heroes, block overrides — manifest.js), filled once per
// thread by installModules() after each module was imported on its own (worker.js in the pool, main.js for shots and reports).
// Nothing in the core imports an optional module statically, so a module that fails to parse, to load, or to build only costs its
// own blocks: they get a placeholder (jobs.js) and the failure is listed on the page. Worker-safe (no three, no DOM).
import { kindAt, distOf } from './plan.js';
import { FALLBACK, defineKit } from './districts/api.js';
export const MODS = { kits: new Map(), heroes: new Map(), blocks: new Map(), corners: null, cornerOv: {}, errors: [], installed: false, paths: [] };

// the manifest, read as TEXT: every quoted districts/…, heroes/… or blocks/… path, in file order (a half-edited line can't hide the rest)
export function parseManifest(text) {
  const out = []; const re = /['"`]((?:districts|heroes|blocks)\/[A-Za-z0-9_.\-]+\.js)['"`]/g; let m;
  for (const line of text.split('\n')) { const code = line.replace(/\/\/.*$/, ''); re.lastIndex = 0; while ((m = re.exec(code))) if (!out.includes(m[1])) out.push(m[1]); }
  return out;
}
// import every listed module on its own; importer(path) → Promise<module>. Never throws: failures come back as { __error }.
export async function loadOptional(paths, importer) {
  const mods = {};
  await Promise.all(paths.map(async p => { try { mods[p] = await importer(p); } catch (e) { mods[p] = { __error: String(e && (e.stack || e.message) || e).split('\n').slice(0, 3).join(' · ') }; } }));
  return mods;
}
const fail = (path, error, stage = 'load', extra = {}) => { const e = { path, error: String(error).slice(0, 400), stage, ...extra }; MODS.errors.push(e); return e; };
// merge two overrides: lists concatenate, maps merge, add() and lot hooks chain (pass 1d's blocks/index.js rule)
export function mergeOverride(a = {}, b = {}) { const o = { ...a };
  o.remove = [...(a.remove || []), ...(b.remove || [])]; o.move = { ...(a.move || {}), ...(b.move || {}) }; o.replace = { ...(a.replace || {}), ...(b.replace || {}) };
  o.lots = { ...(a.lots || {}) }; for (const [k, f] of Object.entries(b.lots || {})) { const g = o.lots[k]; o.lots[k] = g ? (s, l) => { g(s, l); f(s, l); } : f; }
  if (a.add || b.add) o.add = api => { a.add?.(api); b.add?.(api); };
  const pa = a.people || {}, pb = b.people || {}; o.people = { remove: [...(pa.remove || []), ...(pb.remove || [])], move: { ...(pa.move || {}), ...(pb.move || {}) }, add: [...(pa.add || []), ...(pb.add || [])] };
  return o; }

// mods: { 'districts/downtown.js': module | { __error }, … } — relative to city/
export function installModules(mods) {
  MODS.kits.clear(); MODS.heroes.clear(); MODS.blocks.clear(); MODS.corners = null; MODS.cornerOv = {}; MODS.errors.length = 0; MODS.paths = Object.keys(mods);
  for (const [path, m] of Object.entries(mods)) {
    if (!m) continue; if (m.__error) { fail(path, m.__error); continue; }
    try {
      if (path.startsWith('districts/')) { const k = m.default; if (!k || !k.district || !k.api) { fail(path, 'a district kit must `export default defineKit({ … })` (districts/api.js)'); continue; } k.path = path; MODS.kits.set(k.district, k); }
      else if (path.startsWith('heroes/')) { MODS.heroes.set(path, m); if (path === 'heroes/corners.js') MODS.corners = m; }
      else if (path === 'blocks/corners.js') MODS.cornerOv = m.default || {};
      else if (path.startsWith('blocks/')) { const key = path.slice(7, -3); if (!/^-?\d+_-?\d+$/.test(key)) { fail(path, 'block override files are named blocks/<i>_<j>.js'); continue; } MODS.blocks.set(key, m.default || {}); }
    } catch (e) { fail(path, e); }
  }
  MODS.installed = true; return { loaded: MODS.paths.filter(p => !mods[p]?.__error), errors: MODS.errors.slice() };
}
// the block's override: its own file merged with the corners agent's nudges for it (null when neither exists)
export function overrideFor(i, j) { const k = `${i}_${j}`, a = MODS.blocks.get(k), b = MODS.cornerOv[k]; return a || b ? mergeOverride(a || {}, b || {}) : null; }
export const kitNamed = d => MODS.kits.get(d) || null;
export function heroFn(path, fn) { const m = MODS.heroes.get(path); if (!m) return { error: MODS.errors.find(e => e.path === path)?.error || `${path} is not loaded (missing from manifest.js?)` }; const f = m[fn]; return typeof f === 'function' ? { f } : { error: `${path} has no export ${fn}()` }; }
export const noteError = fail;
// an error thrown by (or on behalf of) an optional module: jobs.js catches it and rebuilds the block without that module
export class ModuleError extends Error { constructor(path, cause, stage) { super(`${path}: ${cause && cause.message || cause}`); this.path = path; this.cause = cause; this.stage = stage; } }

// the kit that builds block (i, j): a kit that adopted it, else its plan district's kit, else the placeholder. A district whose kit
// file is listed but failed shows the BROKEN placeholder (magenta, with the error on a sign), so the failure is seen, not hidden.
const BROKEN = new Map();
export function kitFor(i, j) {
  const d = distOf(kindAt(i, j));
  for (const k of MODS.kits.values()) if (k.adopt?.length && k.owns(i, j, d)) return k;
  const k = MODS.kits.get(d); if (k) return k;
  const e = MODS.errors.find(e => e.path === `districts/${d}.js`);
  if (e) { let b = BROKEN.get(d); if (!b) BROKEN.set(d, b = defineKit({ district: d, name: 'BROKEN ' + d, status: 'broken', built: 'all', error: e })); return b; }
  return FALLBACK;
}
// does this block get a full build (near / mid tiers)? stress mode builds every urban block (placeholders with the standard grammar)
export const buildsBlock = (i, j, stress = false) => { const k = kitFor(i, j); return stress || k.status === 'broken' || (k !== FALLBACK && k.builds(i, j, distOf(kindAt(i, j)))); };
