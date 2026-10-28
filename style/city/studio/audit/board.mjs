// CHARACTER AUDIT · the board: close-ups of slime's five examples and the worst offenders per cause, the defect voxels painted
// magenta, posed by the real shader transforms. Renders to audit/renders/, then board.py lays out style/city/board-audit.jpg.
//   node style/city/studio/audit/board.mjs
import { register } from 'node:module'; register('./hooks.mjs', import.meta.url);
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const HERE = new URL('./', import.meta.url), CH = await import('../../../../world/chars.js'), A = await import('./lib.mjs'), R = await import('./render.mjs');
const { holdId } = await import('../../../../world/held2.js');
const P = JSON.parse(fs.readFileSync(new URL('poses.json', HERE))), pi = n => P.poses.findIndex(p => p.name === n);
const BASE = { skin: 'tan', eyes: 'bored', mouth: 'flat', mark: 'none', hair: { id: 'none' }, hat: { id: 'none' }, eyewear: { id: 'none' }, ears: { id: 'none' }, neck: { id: 'none' }, held: { id: 'none' }, acc: { id: 'none' }, top: { id: 'tank' }, bottom: { id: 'track' }, shoes: { id: 'slides' } };
const look = o => ({ ...structuredClone(BASE), ...o });
const seamK = (...joints) => (m, p) => { const r = A.seams(m, P, [p], holdId(m.L)); return Object.entries(r).filter(([k]) => joints.some(j => k.startsWith(j + '|') && !k.includes('skin'))).flatMap(([, v]) => v.keys || []); };
const layK = kind => m => A.layers(m).filter(l => l.kind === kind).flatMap(l => l.keys);
const extK = (own, cat) => m => A.extrusion(m).filter(e => e.own === own && (!cat || e.cat === cat)).flatMap(e => e.keys);
const flK = kind => m => { const f = A.floating(m); return kind === 'orphan' ? f.seg.flatMap(s => s.keys) : f.rest.filter(r => r.kind === kind).flatMap(r => r.keys); };
const oddK = kind => m => A.oddBits(m).filter(o => o.kind === kind).flatMap(o => o.keys);
const F3 = [.55, .22, 1], SIDE = [-1, .15, .12], BACK = [.5, .3, -1], SIDE3 = [-1, .2, .7];
const T = [   // [row, caption, look, pose, keys(m, poseIdx), view dir, distance m]
  ['slime', '1 · puffer: shoulder + flank ride the arm (walk)', look({ top: { id: 'puffer' } }), 'walk0', seamK('flank→forearm', 'shoulder'), [.5, .25, 1], 1.5],
  ['slime', '2 · balaclava + hoops: earrings float', look({ hat: { id: 'balaclava' }, ears: { id: 'hoops' } }), 'rest', layK('ear item floating'), [-1, .1, .35], 1.1],
  ['slime', '3 · bucket + braids: hair through the brim', look({ hat: { id: 'bucket' }, hair: { id: 'braids', cw: 0 } }), 'rest', layK('hair through brim'), [.6, .35, 1], 1.5],
  ['slime', '4 · exhibit on a hoodie: 3-4 vox proud, no wrap', look({ top: { id: 'hoodie' }, neck: { id: 'exhibit', cw: 0 } }), 'rest', m => [...extK('neck')(m), ...layK('necklace stands off the neck')(m)], SIDE3, 1.2],
  ['slime', '5 · varsity letters + panel stand 1 proud', look({ top: { id: 'varsity' } }), 'rest', extK('top', 'print'), SIDE3, 1.2],
  ['a', 'a · tee: flank rides the forearm, 4.7 vox gap (walk)', look({ top: { id: 'tee' } }), 'walk0', seamK('flank→forearm'), [.8, .2, 1], 1.4],
  ['a', 'a · jersey: shoulder cut opens 7.9 vox (stretch idle)', look({ top: { id: 'jersey' } }), 'idle5@7.5', seamK('shoulder'), [.4, .2, 1], 1.8],
  ['a', 'a · bubble: elbow slabs show (hands-on-hips idle)', look({ top: { id: 'bubble', cw: 0 } }), 'idle7@1.2', m => A.seams(m, P, [pi('idle7@1.2')], 0)['elbow|slab|top']?.keys || [], [.3, .2, 1], 1.4],
  ['a', 'a · baggy: knee cut splits the pants (walk)', look({ bottom: { id: 'baggy' } }), 'walk1', seamK('knee'), SIDE, 1.4],
  ['b', 'b · trucker + dreads: clip orphans locs', look({ hat: { id: 'trucker' }, hair: { id: 'dreads' } }), 'rest', flK('detached'), BACK, 1.6],
  ['b', 'b · trucker + afro: hair above the rim', look({ hat: { id: 'trucker' }, hair: { id: 'afro' } }), 'rest', layK('hair outside hat above its rim'), [.7, .3, 1], 1.7],
  ['b', 'b · long hair + hoopstack: earring on hair', look({ hair: { id: 'long' }, ears: { id: 'hoopstack', cw: 0 } }), 'rest', layK('ear item on hair (ear hidden)'), [-1, .1, .5], 1.2],
  ['b', 'b · balaclava + hoodie: hat and hood share voxels', look({ hat: { id: 'balaclava' }, top: { id: 'hoodie' } }), 'rest', m => A.layers(m).filter(l => l.kind === 'items share voxels').flatMap(l => l.keys), BACK, 1.4],
  ['c', 'c · varsity + exhibit: chain +4 over budget', look({ top: { id: 'varsity' }, neck: { id: 'exhibit', cw: 0 } }), 'rest', extK('neck'), SIDE3, 1.1],
  ['c', 'c · flannel + nameplate: pendant +6', look({ top: { id: 'flannel' }, neck: { id: 'nameplate', cw: 0 } }), 'rest', extK('neck'), SIDE3, 1.1],
  ['c', 'c · box-logo hoodie: logo 1 proud (budget 0)', look({ top: { id: 'hoodie' } }), 'rest', extK('top', 'print'), SIDE3, 1.1],
  ['c', 'c · dwi shades: 2 vox off the face', look({ eyewear: { id: 'dwi' } }), 'rest', extK('eyewear'), SIDE3, 1.1],
  ['other', 'other · back-pocket bandana floats', look({ acc: { id: 'bandana' } }), 'rest', flK('detached'), BACK, 1.3],
  ['other', 'other · bucket brim ring: diagonal-only steps', look({ hat: { id: 'bucket' } }), 'rest', flK('diagonal-only contact'), [.6, .5, 1], 1.5],
  ['other', 'other · hoopstack: the gap slime saw', look({ ears: { id: 'hoopstack', cw: 0 } }), 'rest', flK('diagonal-only contact'), [-1, .1, .4], .9],
  ['other', 'other · holofitted: one-sided voxels', look({ hat: { id: 'holofitted', cw: 0 } }), 'rest', oddK('one-sided glitch'), [.3, .4, 1], 1.4],
];
fs.mkdirSync(new URL('renders/', HERE), { recursive: true }); const tiles = [];
T.forEach(([row, cap, L, pose, keysF, dir, dist], i) => { const m = A.model(CH, L), p = pi(pose), keys = keysF(m, p) || [], g = holdId(L), c = R.posedCentre(m, P, p, g, keys.length ? keys : [...m.V.values()].filter(v => v.y > 8 && v.y < 30).map(v => v.k));
  const dl = Math.hypot(...dir), eye = c.map((a, k) => a + dir[k] / dl * dist * 2.3), img = R.render(m, P, p, g, { eye, target: c, fov: 30, hl: new Set(keys) });
  const f = `renders/audit-${String(i).padStart(2, '0')}.png`; fs.writeFileSync(new URL(f, HERE), R.png(img)); tiles.push({ row, cap: cap + ` [${pose}, ${keys.length} vox]`, file: f }); });
fs.writeFileSync(new URL('renders/tiles.json', HERE), JSON.stringify(tiles));
execFileSync('python3', [new URL('board.py', HERE).pathname], { stdio: 'inherit' });
