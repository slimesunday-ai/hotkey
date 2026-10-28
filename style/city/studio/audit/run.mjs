// CHARACTER AUDIT · the checker. Every trait (every colourway whose shape differs) on a plain mannequin, the pairs that layer
// (hat × hair, hat × ears, hat × eyewear, hat × top, top × neck, hair × neck, hair × top, hair × ears, top × acc, top × bottom,
// bottom × shoes) and the city's common looks (the 16 presets + 60 rolled walkers), each checked for:
//   1 floating parts · 2 hot extrusion · 3 layer conflicts · 4 joint seams (rest, 8 walk phases, 2 extreme frames of each idle;
//   the real walk v2 transforms) · 5 odd bits. Every defect is scored for severity × visibility (close-up and the 10 m street
//   camera), grouped by cause: a seams (the segment cut) · b layering · c depth · other.
//   node style/city/studio/audit/run.mjs [--poses] [--quick] [--gate]
//     --poses  re-capture poses.json from the shader (needs the page server on :5320; otherwise the saved file is used)
//     --quick  singles only (no pairs, fewer rolled looks)
//     --gate   exit 1 if a KEPT or UNDECIDED trait has a defect of severity ≥ 40 (the refit agents' gate)
// Writes results.json (every defect) and prints the counts and the top 30.
import { register } from 'node:module'; register('./hooks.mjs', import.meta.url);
import fs from 'node:fs';
const HERE = new URL('./', import.meta.url), argv = process.argv.slice(2), QUICK = argv.includes('--quick');
const CH = await import('../../../../world/chars.js'), CAT = await import('../catalog.js'), A = await import('./lib.mjs');
const { holdId } = await import('../../../../world/held2.js');

// ── poses
if (argv.includes('--poses') || !fs.existsSync(new URL('poses.json', HERE))) { const { open } = await import('./chrome.mjs');
  const P = await open('http://127.0.0.1:5320/style/city/studio/audit/poses.html', { title: 'audit-poses-ready', timeout: 40000 });
  try { await P.ev('(() => { window.__J = JSON.stringify(window.__poses()); return 1; })()'); const n = await P.ev('window.__J.length'); let s = ''; for (let i = 0; i < n; i += 4e6) s += await P.ev(`window.__J.slice(${i}, ${i + 4e6})`);
    fs.writeFileSync(new URL('poses.json', HERE), s); } finally { await P.close(); } }
const P = JSON.parse(fs.readFileSync(new URL('poses.json', HERE)));
const angle = T => Math.acos(Math.max(-1, Math.min(1, (T[0] + T[4] + T[8] - 1) / 2)));
const POSES = [0, 1, 2, 3, 4, 5, 6, 7, 8];   // rest + the 8 walk phases
P.idles.forEach((nm, i) => { const fr = P.poses.map((p, k) => [p, k]).filter(([p]) => p.name.startsWith('idle' + i + '@'));
  const dev = fr.map(([p, k]) => [k, [1, 2, 3, 4, 5, 6, 7].reduce((s, q) => s + angle(P.T[k][0][q]), 0), +p.name.split('@')[1]]).sort((a, b) => b[1] - a[1]);
  const pick = [dev[0]]; for (const d of dev) if (pick.length < 2 && Math.abs(d[2] - pick[0][2]) >= 1) pick.push(d); POSES.push(...pick.map(d => d[0])); });

// ── the catalogue, slime's decisions, the mannequin
const cur = JSON.parse(fs.readFileSync(new URL('../../../../world/traits-curation.json', HERE))).traits;
const status = key => cur[key]?.status || 'unset', CW = { keep: 1, undecided: 1, unset: .8, kill: .25 };
const cat = CAT.buildCatalog(null, null), STR = new Set(['skin', 'eyes', 'mouth', 'mark']);
const BASE = { skin: 'tan', eyes: 'bored', mouth: 'flat', mark: 'none', hair: { id: 'none' }, hat: { id: 'none' }, eyewear: { id: 'none' }, ears: { id: 'none' }, neck: { id: 'none' }, held: { id: 'none' }, acc: { id: 'none' },
  top: { id: 'tank' }, bottom: { id: 'track' }, shoes: { id: 'slides' } };
const wear = (L, slot, id, cw) => { const o = structuredClone(L); o[slot] = STR.has(slot) ? id : (cw != null ? { id, cw } : { id }); return o; };
const ownerOf = slot => slot === 'eyes' || slot === 'mouth' ? 'face' : slot === 'skin' ? 'base' : slot;

// ── scoring
const W = { 'detached': 1, 'diagonal-only contact': .5, 'segment orphan': .9, 'hair through brim': 1, 'hair outside hat above its rim': .8, 'hair through hat crown': .9, 'hair orphaned by the hat clip': 1,
  'ear item on a covering hat': 1, 'ear item floating': 1, 'ear item on hair (ear hidden)': .7, 'ear item off the ear': .8, 'necklace stands off the neck': .8, 'necklace cuts into the top': .7,
  'necklace is a front decal (no wrap)': .25, 'items share voxels': .5, 'item overwrites item': .35, 'stray voxel': .3, 'one-sided glitch': .3, 'colour speckle': .25 };
const JW = { shoulder: .8, 'hem→thigh': .6, knee: .5, waist: .5, hip: .5, ankle: .4, neck: .5, 'thigh→foot': .6 };
const cl = x => Math.max(0, Math.min(1, x)), PX10 = 4.7;   // px per voxel at 10 m (street camera, fov 56, 1000 px tall)
function score(d) {
  let w = 1, close = 0, street = 0;
  if (d.check === 'extrusion') { w = { 'mouth piece': .5, print: .8, chain: .9, pendant: .8, 'ear jewellery': .7, 'face ink': .6, collar: .6, 'hat decal': .6 }[d.cat] ?? .5; close = cl(d.n / 8) * (d.front ? 1 : .6); street = cl(d.max * PX10 / 10) * cl(d.n / 12); }
  else if (d.check === 'seam') { w = (JW[d.joint] ?? .4) * (d.slab ? .7 : 1); const n = d.slab ? d.slabShow : d.split + d.patBreak + d.open; close = cl(n / 20); street = cl(d.sepMax * PX10 / 12) * cl(n / 30); }
  else { w = W[d.kind] ?? .5; close = cl(d.n / 6); street = cl(d.n / 24) * (d.kind === 'detached' || d.kind.startsWith('ear item') ? 1 : .6); }
  d.close = +close.toFixed(2); d.street = +street.toFixed(2); d.sev = +(100 * w * (.6 * close + .4 * street) * CW[d.status]).toFixed(1); return d; }
const CAUSE = d => d.check === 'seam' || d.kind === 'segment orphan' ? 'a' : d.check === 'layer' ? 'b' : d.check === 'extrusion' ? 'c' : 'other';

// ── one look → defects (only those that belong to `own`: the traits under test)
const defects = []; let looks = 0;
function audit(L, ctx, own, { seams = false, poses = POSES } = {}) {
  looks++; const m = A.model(CH, L), out = [], mine = o => own.includes(o), keep = ks => (ks || []).slice(0, 600);
  const fl = A.floating(m);
  const byDesign = L.hat?.id === 'halo' || L.hat?.id === 'cursorclip';   // a halo and a cursor float over the head on purpose
  for (const f of fl.rest) if (Object.keys(f.owners).some(mine) && !(byDesign && f.owners.hat)) out.push(f.owners.hair && L.hat?.id && L.hat.id !== 'none' ? { check: 'layer', kind: 'hair orphaned by the hat clip', n: f.n, owners: f.owners, keys: keep(f.keys) } : { check: 'floating', kind: f.kind, n: f.n, owners: f.owners, keys: keep(f.keys) });
  for (const f of fl.seg) if (Object.keys(f.owners).some(mine) && Object.keys(f.touch).length) out.push({ check: 'floating', kind: 'segment orphan', part: A.PARTN[f.part], n: f.n, owners: f.owners, touch: Object.keys(f.touch).map(p => A.PARTN[p]), keys: keep(f.keys) });
  for (const e of A.extrusion(m)) if (mine(e.own) && !(e.own === 'ears' && L.ears?.id === 'phones')) out.push({ check: 'extrusion', kind: 'hot extrusion: ' + e.cat, ...e, keys: keep(e.keys) });
  for (const l of A.layers(m)) { const inv = l.pair ? l.pair.split(/[∩→]/) : null; if (inv && !inv.some(mine)) continue; if (!inv && own.length === 1 && !['neck', 'ears', 'hair', 'hat'].includes(own[0])) continue;
    out.push({ check: 'layer', ...l, keys: keep(l.keys) }); }
  for (const o of A.oddBits(m)) if (mine(o.own)) out.push({ check: 'odd', ...o, keys: keep(o.keys) });
  if (seams) { const se = A.seams(m, P, poses, holdId(L));
    for (const [k, r] of Object.entries(se)) { const [joint, o, o2] = k.split('|'), slab = o === 'slab', ow = slab ? o2 : o; if (!mine(ow) || !r.worst) continue;
      if (slab ? !r.slabShow : !(r.split || r.open)) continue;
      out.push({ check: 'seam', kind: slab ? 'joint slab shows' : 'seam at ' + joint, joint, own: ow, slab, faces: r.faces, split: r.split, patBreak: r.patBreak, open: r.open, slabShow: r.slabShow, sepMax: +(r.sepMax || 0).toFixed(2),
        planes: se[joint + '|' + ow]?.planes, ragged: se[joint + '|' + ow]?.ragged, pose: P.poses[r.pose].name, poseIdx: r.pose, n: slab ? r.slabShow : r.split, keys: keep(r.keys) }); } }
  for (const d of out) { Object.assign(d, ctx, { look: L }); d.status = ctx.keys.map(status).sort((a, b) => CW[b] - CW[a])[0]; d.cause = CAUSE(d); score(d); defects.push(d); }
  return m;
}

// ── 1 · singles: every trait, every colourway with its own shape
const t0 = Date.now(); let variants = 0;
for (const e of cat) { const cws = e.cws ? e.cws.map((_, i) => i) : [null], seen = new Map();
  for (const cw of cws) { const L = wear(BASE, e.slot, e.id, cw), sig = (() => { const m = A.model(CH, L); return [...m.V.values()].filter(v => v.own === ownerOf(e.slot)).map(v => v.k).sort().join(','); })();
    if (seen.has(sig)) continue; seen.set(sig, cw); variants++;
    audit(L, { scope: 'single', keys: [e.key], label: e.key + (cw != null ? '#' + cw + ' ' + e.cws[cw].name : '') }, [ownerOf(e.slot)], { seams: ['top', 'bottom', 'shoes', 'acc', 'held', 'neck', 'hair', 'skin'].includes(e.slot) }); } }
// the bare mannequin's own seams (a baseline, not a trait's defect)
const baseSe = A.seams(A.model(CH, BASE), P, POSES, 0), baseline = Object.fromEntries(Object.entries(baseSe).filter(([, r]) => r.split).map(([k, r]) => [k, { split: r.split, open: r.open, sepMax: +(r.sepMax || 0).toFixed(2), pose: r.worst }]));
console.log(`singles: ${cat.length} traits, ${variants} shape variants · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ── 2 · pairs
if (!QUICK) { const t1 = Date.now(), by = s => cat.filter(e => e.slot === s);
  const PAIRS = [['hat', 'hair'], ['hat', 'ears'], ['hat', 'eyewear'], ['hat', 'top'], ['top', 'neck'], ['hair', 'neck'], ['hair', 'top'], ['hair', 'ears'], ['top', 'acc'], ['top', 'bottom'], ['bottom', 'shoes'], ['hair', 'eyewear']];
  let n = 0; for (const [s1, s2] of PAIRS) for (const a of by(s1)) for (const b of by(s2)) { const L = wear(wear(BASE, s1, a.id, a.cws ? 0 : null), s2, b.id, b.cws ? 0 : null);
    const before = defects.length; audit(L, { scope: 'pair', keys: [a.key, b.key], label: a.key + ' + ' + b.key }, [ownerOf(s1), ownerOf(s2)]);
    // a pair keeps only what the pair adds: layer conflicts, and the neck's depth on that top
    for (let i = defects.length - 1; i >= before; i--) { const d = defects[i]; if (!(d.check === 'layer' || (d.check === 'extrusion' && d.own === 'neck' && s1 === 'top') || (d.check === 'floating' && (d.owners?.ears || d.owners?.neck)))) defects.splice(i, 1); }
    n++; }
  console.log(`pairs: ${n} · ${((Date.now() - t1) / 1000).toFixed(1)} s`); }

const involved = d => d.kind.startsWith('hair') ? ['hat', 'hair'] : d.kind.startsWith('ear item') ? ['ears', 'hat'] : d.kind.startsWith('necklace') ? ['neck', 'top'] : d.pair ? d.pair.split(/[∩→]/).filter(x => x !== 'base' && x !== 'face') : [d.own || Object.keys(d.owners || {})[0]];
// ── 3 · the city's common looks: presets + rolled walkers (new traits on), with their grips
{ const t2 = Date.now(), L2 = [...CH.LOOKS.map(l => [l, 'preset ' + l.handle]), ...Array.from({ length: QUICK ? 12 : 60 }, (_, i) => [CH.rollLook(1000 + i, { newTraits: true }), 'rolled #' + (1000 + i)])];
  for (const [L, lab] of L2) { const keys = CH.SLOTS.filter(s => STR.has(s) ? true : L[s] && L[s].id !== 'none').map(s => s + '/' + (STR.has(s) ? L[s] : L[s].id));
    const before = defects.length; audit(L, { scope: 'look', keys, label: lab }, ['top', 'bottom', 'shoes', 'hair', 'hat', 'eyewear', 'ears', 'neck', 'acc', 'held', 'mark'], { seams: true });
    for (let i = before; i < defects.length; i++) { const d = defects[i], slots = involved(d), ks = slots.map(o => keys.find(k => k.startsWith(o + '/'))).filter(Boolean);
      if (ks.length) { d.trait = ks.join(' + '); d.status = ks.map(status).sort((a, b) => CW[b] - CW[a])[0]; score(d); } } }
  console.log(`common looks: ${L2.length} · ${((Date.now() - t2) / 1000).toFixed(1)} s`); }

// ── rank, group, write
for (const d of defects) if (!d.trait) d.trait = d.keys.length === 1 ? d.keys[0] : d.keys.join(' + ');
const ranked = defects.slice().sort((a, b) => b.sev - a.sev), top = [], seenK = new Set();
const perKind = {}, SYS = {};   // a defect every trait of a slot shares is systemic: listed once in the top 30, with how many traits share it
for (const d of defects) { const k = d.kind + '|' + (d.cat || d.joint || ''); (SYS[k] ||= new Set()).add(d.trait); }
for (const d of ranked) { const k = d.trait + '|' + d.kind + '|' + (d.cat || d.joint || ''), kk = d.kind + '|' + (d.cat || d.joint || ''); if (seenK.has(k) || (perKind[kk] || 0) >= 3) continue; seenK.add(k); perKind[kk] = (perKind[kk] || 0) + 1; d.shared = SYS[kk].size; top.push(d); if (top.length >= 30) break; }
const counts = {}; for (const d of defects) { const c = counts[d.cause] ||= { total: 0, kinds: {} }; c.total++; const k = d.check === 'extrusion' ? d.kind : d.check === 'seam' ? d.kind : d.kind; c.kinds[k] = (c.kinds[k] || 0) + 1; }
const byTrait = {}; for (const d of defects) { if (d.scope !== 'single') continue; const t = byTrait[d.trait] ||= { status: d.status, a: 0, b: 0, c: 0, other: 0, worst: 0 }; t[d.cause]++; t.worst = Math.max(t.worst, d.sev); }
const slim = d => { const { look, keys, ...r } = d; return { ...r, keys: d.keys?.slice(0, 600), look }; };
fs.writeFileSync(new URL('results.json', HERE), JSON.stringify({ at: new Date().toISOString(), looks, poses: POSES.map(i => P.poses[i].name), counts, baseline, byTrait, top: top.map(slim), defects: defects.map(d => { const { keys, look, ...r } = d; return r; }) }));
console.log(`\n${looks} looks composed · ${POSES.length} poses · ${defects.length} defects`);
for (const c of ['a', 'b', 'c', 'other']) { const x = counts[c] || { total: 0, kinds: {} }; console.log(`  ${c}: ${x.total}  ` + Object.entries(x.kinds).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(' · ')); }
console.log('\nTOP 30');
top.forEach((d, i) => console.log(`${String(i + 1).padStart(2)}. [${d.cause}] ${d.sev.toFixed(0).padStart(3)}  ${d.trait} (${d.status}) · ${d.kind}${d.cat ? '' : ''} · n ${d.n}${d.max ? ' · +' + d.max + ' over budget ' + d.budget : ''}${d.sepMax ? ' · opens ' + d.sepMax + ' vox at ' + d.pose : ''}${d.standoff ? ' · stands off ' + d.standoff : ''} · ${d.label}${d.shared > 3 ? ' · (' + d.shared + ' traits/looks share it)' : ''}`));
if (argv.includes('--gate')) { const bad = defects.filter(d => d.sev >= 40 && (d.status === 'keep' || d.status === 'undecided')); console.log(`\nGATE: ${bad.length} defects ≥ 40 on kept / undecided traits`); process.exit(bad.length ? 1 : 0); }
