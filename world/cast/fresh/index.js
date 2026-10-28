// FRESH REGISTRY · the aggregator. Reads the thirteen category files (one owner each), validates every entry and exposes them by slot.
// Nobody edits this file to add a trait: add it to your category file. chars.js wires the registry into compose(); the studio, the
// lab and the checks read it from here. No three.js, no chars.js: node imports it directly.
import { legForm } from '../fit/leg-forms.js';
import { LASTS, footCells, envelopeProblems } from '../fit/shoe.js';
import * as KIT from './kit.js';
// (sync-cast.mjs: every category file imported statically, for the city's worker bundler; loadFile looks them up by name)
import * as __f0 from './skin.js'; import * as __f1 from './hair.js'; import * as __f2 from './hats.js'; import * as __f3 from './eyes.js'; import * as __f4 from './eyewear.js'; import * as __f5 from './mouths.js'; import * as __f6 from './mouth.js'; import * as __f7 from './ears.js'; import * as __f8 from './tops.js'; import * as __f9 from './bottoms.js'; import * as __f10 from './shoes.js'; import * as __f11 from './accessories.js'; import * as __f12 from './held.js'; import * as __f13 from './imported/skin.js'; import * as __f14 from './imported/hair.js'; import * as __f15 from './imported/hats.js'; import * as __f16 from './imported/eyes.js'; import * as __f17 from './imported/eyewear.js'; import * as __f18 from './imported/mouth.js'; import * as __f19 from './imported/ears.js'; import * as __f20 from './imported/tops.js'; import * as __f21 from './imported/bottoms.js'; import * as __f22 from './imported/shoes.js'; import * as __f23 from './npc/skin.js'; import * as __f24 from './npc/hair.js'; import * as __f25 from './npc/hats.js'; import * as __f26 from './npc/eyes.js'; import * as __f27 from './npc/eyewear.js'; import * as __f28 from './npc/mouths.js'; import * as __f29 from './npc/tops.js'; import * as __f30 from './npc/bottoms.js'; import * as __f31 from './npc/shoes.js'; import * as __f32 from './npc/held.js';
const __FILES = { 'skin.js': __f0, 'hair.js': __f1, 'hats.js': __f2, 'eyes.js': __f3, 'eyewear.js': __f4, 'mouths.js': __f5, 'mouth.js': __f6, 'ears.js': __f7, 'tops.js': __f8, 'bottoms.js': __f9, 'shoes.js': __f10, 'accessories.js': __f11, 'held.js': __f12, 'imported/skin.js': __f13, 'imported/hair.js': __f14, 'imported/hats.js': __f15, 'imported/eyes.js': __f16, 'imported/eyewear.js': __f17, 'imported/mouth.js': __f18, 'imported/ears.js': __f19, 'imported/tops.js': __f20, 'imported/bottoms.js': __f21, 'imported/shoes.js': __f22, 'npc/skin.js': __f23, 'npc/hair.js': __f24, 'npc/hats.js': __f25, 'npc/eyes.js': __f26, 'npc/eyewear.js': __f27, 'npc/mouths.js': __f28, 'npc/tops.js': __f29, 'npc/bottoms.js': __f30, 'npc/shoes.js': __f31, 'npc/held.js': __f32 };
import { POSES as HELD_POSES } from '../fit/held.js';

// look slots, in the studio's order. A look is { skin, eyes, mouth, mark: '<id>' | 'base' | 'none', hair, hat, eyewear, ears, top,
// bottom, shoes, acc, held: { id } } ('base' = the base kit's piece, world/base-kit.js; 'none' = nothing in an optional slot).
// held: a thing in the hand(s), drawn through the closed fist (world/fit/held.js, README § Held); the mannequin holds nothing.
export const SLOTS = ['skin', 'hair', 'hat', 'eyes', 'eyewear', 'mouth', 'mark', 'ears', 'top', 'bottom', 'shoes', 'acc', 'held'];
export const STRING_SLOTS = new Set(['skin', 'eyes', 'mouth', 'mark']);
export const OPTIONAL = new Set(['hair', 'hat', 'eyewear', 'mark', 'ears', 'top', 'acc', 'held']);   // can be 'none'; the rest fall back to the base kit
export const SLOT_LABEL = { skin: 'skin', hair: 'hair', hat: 'hat', eyes: 'eyes', eyewear: 'eyewear', mouth: 'mouth', mark: 'face ink', ears: 'ears', top: 'top', bottom: 'bottom', shoes: 'shoes', acc: 'accessory', held: 'held' };
export const FILE_OF = { skin: 'skin.js', hair: 'hair.js', hat: 'hats.js', eyes: 'eyes.js', eyewear: 'eyewear.js', mouth: 'mouths.js', mark: 'mouth.js', ears: 'ears.js', top: 'tops.js', bottom: 'bottoms.js', shoes: 'shoes.js', acc: 'accessories.js', held: 'held.js' };
// the category a designer names on the command line (--slot) → the slots its file fills
export const CATEGORY = { skin: ['skin'], hair: ['hair'], hats: ['hat'], hat: ['hat'], eyes: ['eyes'], eyewear: ['eyewear'], mouth: ['mouth', 'mark'], mark: ['mark'], ink: ['mark'],
  mouths: ['mouth'], ears: ['ears'], tops: ['top'], top: ['top'], bottoms: ['bottom'], bottom: ['bottom'], shoes: ['shoes'], accessories: ['acc'], acc: ['acc'], held: ['held'] };
// two files fill the mouth slot (mouth.js: the earlier mouths and the face ink · mouths.js: the mouths drawn in the mouth zone), so a
// category that names a file is narrowed to it: its check, its lab looks (&slot=) and its studio sweep see that file's entries only
// (a value may list several files: the mouth category also tests the imported rows mouths, imported/mouth.js, the same form as mouth.js)
export const CATEGORY_FILE = { mouth: ['mouth.js', 'imported/mouth.js'], mark: 'mouth.js', ink: 'mouth.js', mouths: 'mouths.js' };
export const inCategory = (category, t) => !!t && (t.pool || 'agent') === poolOf(category) && (slotsOf(category) || []).includes(t.slot)
  && (poolOf(category) === 'npc' || !CATEGORY_FILE[category] || [].concat(CATEGORY_FILE[category]).includes(t.file));   // (the NPC pool has one file per slot)
// IMPORTED TRAITS (README § Imported traits): traits brought over from the old Trait Studio, one file per slot in imported/, each
// entry drawn by an adapter (imported/kit.js) over isolated legacy construction (world/legacy/). They load, validate and check
// exactly like fresh ones; every entry carries `origin` (its old collection) and `from` (the old slot/id). A fresh entry's origin is
// 'fresh'. ORIGINS is the studio's ORIGIN filter order; an import agent adds its collections here (the label is what the chip says).
export const IMPORTED = { 'imported/skin.js': 'skin', 'imported/hair.js': 'hair', 'imported/hats.js': 'hat', 'imported/eyes.js': 'eyes', 'imported/eyewear.js': 'eyewear',
  'imported/mouth.js': 'mouth', 'imported/ears.js': 'ears', 'imported/tops.js': 'top', 'imported/bottoms.js': 'bottom', 'imported/shoes.js': 'shoes' };
export const ORIGINS = ['fresh', 'original', 'drop02', 'jewelry', 'v2', 'shoes', 'newdrop', 'earlier', 'opus', 'opus2', 'classic'];
export const ORIGIN_LABEL = { fresh: 'fresh', original: 'original', drop02: 'drop 02', jewelry: 'jewelry', v2: 'v2', shoes: 'shoes pass', newdrop: 'new drop (astra)', earlier: 'earlier (astra)',
  opus: 'opus', opus2: 'opus 2', classic: 'classic' };
export const originOf = t => (t && t.origin) || 'fresh';
// THE TWO POOLS (README § The NPC pool). 'agent': every trait above (fresh and imported): what a real citizen, someone's AI agent,
// wears. 'npc': the background civilians (world/fresh/npc/<category>.js), plain common city-goers drawn so a viewer tells them from
// an agent at a glance. The pools never mix: REG holds the agent pool only (the city's cast reads it whole), NPC_REG the NPC pool;
// an NPC id starts with npc_ and an agent id never does, so entry(slot, id) resolves either and the curation key '<slot>/npc_<id>'
// can't collide. list(slot) is the agent pool (as it always was); list(slot, 'npc') the NPC pool; list(slot, 'all') both.
// A check names an NPC category with the npc- prefix (node style/check.mjs npc-tops): it tests that pool against itself only.
export const POOLS = ['agent', 'npc'];
export const POOL_LABEL = { agent: 'Agents', npc: 'NPCs' };
export const NPC = { 'npc/skin.js': 'skin', 'npc/hair.js': 'hair', 'npc/hats.js': 'hat', 'npc/eyes.js': 'eyes', 'npc/eyewear.js': 'eyewear', 'npc/mouths.js': 'mouth',
  'npc/tops.js': 'top', 'npc/bottoms.js': 'bottom', 'npc/shoes.js': 'shoes', 'npc/held.js': 'held' };
export const NPC_PREFIX = 'npc_';
export const poolOf = category => typeof category === 'string' && category.startsWith('npc-') ? 'npc' : 'agent';   // the pool a category names
const baseCategory = category => typeof category === 'string' && category.startsWith('npc-') ? category.slice(4) : category;
export const NECKLINES = ['crew', 'vee', 'hood', 'collar', 'high', 'bare'];

export const REG = Object.fromEntries(SLOTS.map(s => [s, {}]));   // the AGENT pool: slot → id → entry (+ id, slot, file, key, pool)
export const NPC_REG = Object.fromEntries(SLOTS.map(s => [s, {}]));   // the NPC pool (world/fresh/npc/), same shape
export const PROBLEMS = [];   // 'file · id: problem' (the studio shows them; every check fails on them)
// each file is loaded on its own: one designer's syntax error leaves that file out (as a problem), never the whole registry
const loadFile = async f => { try { return (__FILES[f] || (() => { throw new Error('not in the city bundle: ' + f); })()).default; } catch (e) { PROBLEMS.push(`${f}: failed to load, every entry in it is left out (${String(e && e.message || e).split('\n')[0]})`); return {}; } };
const [skin, hair, hats, eyes, eyewear, mouth, mouths, ears, tops, bottoms, shoes, accessories, held] = await Promise.all(
  ['skin.js', 'hair.js', 'hats.js', 'eyes.js', 'eyewear.js', 'mouth.js', 'mouths.js', 'ears.js', 'tops.js', 'bottoms.js', 'shoes.js', 'accessories.js', 'held.js'].map(loadFile));
const imported = await Promise.all(Object.keys(IMPORTED).map(loadFile));   // (a missing imported file is a problem too: each slot's file exists, maybe empty)
const npc = await Promise.all(Object.keys(NPC).map(loadFile));   // the NPC pool's files (README § The NPC pool)

const isFn = f => typeof f === 'function', isCol = c => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
const grid = (rows, n, w) => Array.isArray(rows) && rows.length === n && rows.every(r => typeof r === 'string' && r.length === w);
const NEED = {
  skin: t => (isCol(t.c) || isFn(t.c)) ? null : 'needs c: a colour or (x, y, z) => colour',
  hair: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  hat: t => !isFn(t.draw) ? 'needs draw(H, ctx)' : t.cover !== undefined && !['auto', 'all', 'none'].includes(t.cover) ? "cover must be 'auto', 'all' or 'none'" : null,
  eyes: t => !grid(t.rows, 4, 5) ? 'needs rows: 4 strings of 5 (y 26 → 23, outer → inner)' : !grid(t.brow, 3, 5) ? 'needs brow: 3 strings of 5 (y 29 → 27)'
    : t.right && (!grid(t.right.rows, 4, 5) || !grid(t.right.brow, 3, 5)) ? 'right: { rows, brow } like the left' : t.closed && !grid(t.closed, 4, 5) ? 'closed: 4 strings of 5' : null,
  // a mouth is drawn in the MOUTH ZONE (world/fit/body.js MOUTH; README § Mouth) by draw(H, ctx) and / or fine(P, ctx). The earlier
  // mouth.js entries keep their rows form (the face grid: rows, palette, fx), which still loads; mouths.js entries use the zone only.
  mouth: t => t.rows !== undefined ? (t.file === 'mouths.js' ? 'mouths.js draws in the mouth zone: draw(H, ctx) and / or fine(P, ctx), no rows (README § Mouth)'
      : grid(t.rows, 3, 6) ? null : 'rows: 3 strings of 6')
    : t.palette !== undefined || t.fx !== undefined ? 'palette and fx go with rows only: draw(H, ctx) and / or fine(P, ctx) in the mouth zone (README § Mouth)'
    : t.draw !== undefined && !isFn(t.draw) ? 'draw must be a function: draw(H, ctx)' : isFn(t.draw) || isFn(t.fine) ? null : 'needs draw(H, ctx) and / or fine(P, ctx), in the mouth zone (README § Mouth)',
  mark: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  eyewear: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  ears: t => !isFn(t.draw) ? 'needs draw(H, ctx)' : t.lobe !== undefined && t.lobe !== 'hang' && t.lobe !== 'stud' ? "lobe must be 'hang' or 'stud' (README § Ears: the lobe anchor)" : null,
  top: t => !isFn(t.draw) ? 'needs draw(B, ctx)' : ![undefined, 0, 1, 2].includes(t.flank) ? 'flank must be 0, 1 or 2' : t.neckline !== undefined && !NECKLINES.includes(t.neckline) ? 'neckline must be one of ' + NECKLINES.join(', ') : null,
  bottom: t => !(t.formSpec || legForm(t.form)) ? 'needs form: roomy, longshorts, slim, straight, baggy or shorts' : !isCol(t.color) ? 'needs color: one colour (0xRRGGBB)'
    : t.paint !== undefined && !isFn(t.paint) ? 'paint must be a function' : t.sock !== undefined && !['none', 'ankle', 'crew'].includes(t.sock) ? "sock must be 'none', 'ankle' or 'crew'" : null,
  shoes: t => { const m = t.last ? (!LASTS[t.last] ? 'last must be one of ' + Object.keys(LASTS).join(', ') : !isFn(t.paint) ? 'a last needs paint(q)' : null) : isFn(t.draw) ? null : 'needs draw(F, ctx) or last + paint(q)';
    if (m) return m; if (t.ankle !== undefined && t.ankle !== 'shoe' && t.ankle !== 'dressed') return "ankle must be 'dressed' (default) or 'shoe'";
    try { const p = envelopeProblems(footCells(t, { ...KIT })); return p.length ? 'outside the shoe envelope: ' + p.slice(0, 3).join('; ') : null; } catch (e) { return 'draw threw: ' + (e && e.message || e); } },
  acc: t => isFn(t.draw) ? null : 'needs draw(B, ctx)',
  // a held trait names its hold pose (world/fit/held.js POSES, by geometry) and draws on the gripping arm's grid (README § Held)
  held: t => !isFn(t.draw) ? 'needs draw(G, ctx): drawn through the grip, ctx.grip (README § Held)' : !HELD_POSES.includes(t.pose) ? 'needs pose: one of ' + HELD_POSES.join(', ') : null,
};
// THE NPC READABILITY RULES the registry can enforce (README § The NPC pool; the palette rules are checked on the composed voxels by
// style/city/studio/audit/npc-palette.mjs): common only; no fine detail (no logos, prints, lettering or half voxels); a skin is one
// ordinary tone (no pattern, no decorate). The slots the agents flex in (ears, face ink, accessories) have no NPC file at all.
function npcRule(slot, t) {
  if (t.tier !== undefined && t.tier !== 'common') return "an NPC is common only: tier 'common' or none";
  if (t.fine !== undefined) return 'an NPC has no fine detail: plain shapes, no logos, prints or lettering';
  if (slot === 'skin' && (typeof t.c !== 'number' || t.decorate !== undefined || t.layer !== undefined || t.noEars)) return 'an NPC skin is one ordinary human tone: c a colour, no pattern, decorate, layer or noEars';
  return null;
}
function add(slot, file, id, t) {
  const where = `${file} · ${id}`, bad = m => PROBLEMS.push(`${where}: ${m}`);
  if (!/^[a-z0-9_]{1,40}$/.test(id) || id === 'none' || id === 'base') return bad('id must be a-z, 0-9, _ (1–40 chars), not none or base');
  if (!t || typeof t !== 'object') return bad('entry must be an object');
  if (typeof t.name !== 'string' || !t.name.trim() || t.name.length > 40) return bad('needs name: a display name (1–40 chars)');
  for (const k of ['cw', 'cws', 'colorways', 'colourways', 'variants']) if (k in t) return bad('one colour scheme per trait: no colourways (' + k + ')');
  const pool = NPC[file] ? 'npc' : 'agent', R = pool === 'npc' ? NPC_REG : REG;
  if (pool === 'npc' && !id.startsWith(NPC_PREFIX)) return bad('an NPC id starts with npc_ (README § The NPC pool: the pools never share an id)');
  if (pool === 'agent' && id.startsWith(NPC_PREFIX)) return bad('npc_ ids are the NPC pool\'s (world/fresh/npc/): an agent trait never takes one');
  if (REG[slot][id] || NPC_REG[slot][id]) return bad(`duplicate id in slot ${slot}`);
  if (pool === 'npc') { const m = npcRule(slot, t); if (m) return bad(m); }
  if (t.fine !== undefined && typeof t.fine !== 'function') return bad('fine must be a function: fine(P, ctx), the fine-detail pass (README.md § Fine detail)');
  if (IMPORTED[file] && (!ORIGINS.includes(t.origin) || t.origin === 'fresh')) return bad('an imported entry needs origin: one of ' + ORIGINS.slice(1).join(', ') + ' (index.js ORIGINS)');
  if (IMPORTED[file] && (typeof t.from !== 'string' || !/^[a-z]+\/[a-z0-9_]+$/.test(t.from))) return bad("an imported entry needs from: its old 'slot/id'");
  if (!IMPORTED[file] && (t.origin !== undefined || t.from !== undefined)) return bad('origin and from are for imported entries (imported/*.js) only');
  const m = NEED[slot]({ ...t, file }); if (m) return bad(m);
  R[slot][id] = Object.freeze({ ...t, id, slot, file, key: slot + '/' + id, origin: originOf(t), pool });
}
const load = (slot, file, obj) => { if (!obj || typeof obj !== 'object') { PROBLEMS.push(`${file}: must export default { id: entry, … }`); return; } for (const [id, t] of Object.entries(obj)) add(slot, file, id, t); };
load('skin', 'skin.js', skin); load('hair', 'hair.js', hair); load('hat', 'hats.js', hats); load('eyes', 'eyes.js', eyes); load('eyewear', 'eyewear.js', eyewear);
for (const [id, t] of Object.entries(mouth || {})) { const s = t && t.slot; if (s !== 'mouth' && s !== 'mark') { PROBLEMS.push(`mouth.js · ${id}: needs slot: 'mouth' or 'mark'`); continue; } add(s, 'mouth.js', id, t); }
load('mouth', 'mouths.js', mouths); load('ears', 'ears.js', ears); load('top', 'tops.js', tops); load('bottom', 'bottoms.js', bottoms); load('shoes', 'shoes.js', shoes); load('acc', 'accessories.js', accessories); load('held', 'held.js', held);
// the imported files last (an id clash with a fresh trait is a registry problem: imported ids are namespaced old_<old id>)
Object.entries(IMPORTED).forEach(([file, slot], i) => load(slot, file, imported[i]));
Object.entries(NPC).forEach(([file, slot], i) => load(slot, file, npc[i]));   // the NPC pool last (its own registry, NPC_REG)

export const entry = (slot, id) => (REG[slot] && (REG[slot][id] || NPC_REG[slot][id])) || null;   // (either pool: their ids never overlap)
// a slot's traits in one pool: 'agent' (the default, what every check and the city always read), 'npc', or 'all' (both)
export const list = (slot, pool = 'agent') => pool === 'all' ? [...Object.values(REG[slot] || {}), ...Object.values(NPC_REG[slot] || {})] : Object.values((pool === 'npc' ? NPC_REG : REG)[slot] || {});
export const all = (pool = 'agent') => SLOTS.flatMap(s => list(s, pool));
export const slotsOf = category => { const c = baseCategory(category); return CATEGORY[c] || (SLOTS.includes(c) ? [c] : null); };
