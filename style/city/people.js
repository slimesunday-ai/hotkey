// The cast: every person is a chars.js character. Static ones are posed then baked into banks drawn with chars.js's own MATS
// (they look exactly like their cards). Pass 1b: the generator hands over life anchors (A.life: talk, carry, lean, sit, window,
// fire escape, roof party, garden, hoops…) and all walkers are merged into ONE mesh per material, animated on the GPU
// (walk cycle = the chars.js pose() curve), so a crowd costs 7 draw calls instead of 5 per walker.
import * as THREE from 'three';
import { S, build, pose, LOOKS, rollLook, MATS } from './cast.js';
import { Bank } from './vox.js';
import { bakeMesh, geoOf } from './glue.js';
import { SIDE, hash, rng } from './style.js';
const L = h => structuredClone(LOOKS.find(x => x.handle === h));
const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const isUnder = (m, g) => { for (let p = m.parent; p; p = p.parent) if (p === g) return true; return false; };
const HELD = { carry: ['duffel', 'cash', 'can', 'camera', 'duffel'], phone: ['flip', 'flip', 'ipod'], deal: ['cash', 'flip'], talk: ['can', 'none', 'none', 'flip'], talk2: ['none', 'none', 'can'], lean: ['none', 'can', 'ipod'], fe: ['none', 'can'], arms: ['none', 'cash'] };

export function makeCast(scene, A, opts = {}) {
  const baked = new Map(), P = opts.region || 64, bankAt = (x, z) => { const k = Math.floor(x / P) + ',' + Math.floor(z / P); let b = baked.get(k); if (!b) baked.set(k, b = new Bank()); return b; };
  let people = 0; const put = (look, x, y, z, ry, fn, scale = 1) => { people++; const o = build(look); o.rotation.order = 'YXZ'; o.position.set(x, y, z); o.rotation.y = ry; if (scale !== 1) o.scale.setScalar(S * scale); pose(o, 0, 0); o.userData.open.visible = true; o.userData.shut.visible = false; fn?.(o.userData.rig, o);
    o.updateMatrixWorld(true); const bk = bankAt(x, z); o.traverse(m => { if (m.isMesh && visible(m)) bakeMesh(m, bk, Math.max(0, MATS.indexOf(m.material))); }); o.traverse(m => m.geometry?.dispose()); };
  const arms = (a, b) => rg => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
  const sit = (legs = -1.25, ar = -.45) => rg => { rg.legL.rotation.x = rg.legR.rotation.x = legs; rg.armL.rotation.x = rg.armR.rotation.x = ar; };
  const party = k => rg => { rg.armL.rotation.x = -2.6 + (k % 2) * .3; rg.armR.rotation.x = -2.4 - (k % 3) * .2; };
  const extra = seed => rollLook(seed);
  // ── Fit Street: the DROP queue (leads from LOOKS), the door guy, the deli, the roof party, the stoop
  if (A.drop) { const q = ['xXbadvibesXx', 'rawr_means_404', '56kballer', 'www.girl', 'cmd_q', 'dialog.box', 'fatal.exception'];
    q.forEach((h, i) => put(L(h), A.drop.door[0] - 1.3 - i * 1.15, SIDE, A.drop.queueZ + (i % 2) * .1, Math.PI / 2 + [.3, -.35, .15, .5, -.2, .35, -.1][i], null));
    put(L('anon_inc'), A.drop.door[0] + .75, SIDE, A.drop.queueZ + .15, .5, null); }
  if (A.deliDoor) { put(L('late.night'), A.deliDoor[0], SIDE, A.deliDoor[1] - .35, Math.PI + .2, null); put(L('dealwithit.mp3'), A.fruit[0] + .5, SIDE, A.fruit[1] + 1.2, Math.PI / 2 + .9, arms(-1.05, 0)); }
  if (A.clerk) put(extra(0x51a7), A.clerk[0], A.clerk[1], A.clerk[2], Math.PI, arms(-.5, -.5));
  if (A.roof) { const [x, y, z] = A.roof; put(L('bluescreen.bucket'), x - 1.2, y, z - .6, .6, party(0)); put(L('missing_texture'), x + .8, y, z - 1.0, -.3, party(1)); put(L('macpaint.artist'), x, y, z + .9, .2, party(2)); put(extra(0x2cde), x + .4, y, z + 2.3, Math.PI, arms(-.9, -.9)); }
  // stoops: sitters on the steps (every other stoop), facing the street
  A.stoops.forEach((s, k) => { if (k % 2) return; const [x, z] = s.at, ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][s.rot]; put(k < 2 ? L('county.blues') : extra(0x700 + k), x, SIDE + .8 - .5, z, ry + (hash(k) - .5) * .4, sit()); });
  // shop doors: a customer out front at one in five
  A.doors.forEach((d, k) => { if (k % 5 || k > 60) return; const [x, z] = d.at, ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][d.rot]; put(extra(0x900 + k), x, SIDE, z, ry + (hash(k, 2) - .5) * 1.2, k % 2 ? arms(0, -.4) : null); });
  // civic: plaza benches + carts, court steps, precinct steps, bank door
  if (A.plaza) { const { cx, cz } = A.plaza; [[0, -5.35, 0], [0, 5.35, Math.PI], [-5.35, 0, Math.PI / 2], [5.35, 0, -Math.PI / 2]].forEach(([dx, dz, ry], k) => put(extra(0xb00 + k), cx + dx * 1.03, SIDE + .1 + .5 - .5 + .05, cz + dz * 1.03, ry, sit(-1.45)));
    put(L('tag.crew'), cx - 7.6, SIDE + .1, cz + 5.2, 2.3, arms(0, -1.2)); put(extra(0xb44), cx + 6.2, SIDE + .1, cz - 7.4, -.7, null); put(extra(0xb55), cx + 7.0, SIDE + .1, cz - 6.6, -2.4, arms(-.4, 0)); }
  if (A.courtSteps) { const [x, z] = A.courtSteps; put(extra(0xc01), x - 2.4, SIDE + 1.2, z - .2, .2, null); put(extra(0xc02), x + 1.8, SIDE + .6, z + 1.2, -.3, arms(-.3, 0)); }
  if (A.precinctSteps) { const [x, z] = A.precinctSteps; put(extra(0xd01), x - .4, SIDE, z - 2.6, -Math.PI / 2 + .3, null); put(extra(0xd02), x - .6, SIDE, z + 2.8, -Math.PI / 2 - .2, arms(0, -.5)); }
  if (A.storeDoor) { const [x, z] = A.storeDoor; put(extra(0xe01), x - 1.6, SIDE, z + .4, .3, null); put(extra(0xe02), x + 1.9, SIDE, z + 1.3, -.4, arms(-.6, 0)); put(extra(0xe03), x - 6.3, SIDE + .1, z + 7.4, 1.2, arms(-2.2, 0)); }
  // dealing corners: three or four hanging out on the sidewalk corner (one holds the cash, one is on the flip phone)
  (A.corners || []).forEach((c, k) => { const face = Math.atan2(-c.qx, -c.qz), held = (s, id) => Object.assign(extra(s), { held: { id } });
    put(held(0xf00 + k * 7, 'cash'), c.cx, SIDE, c.cz, face + .4, arms(-.7, 0)); put(extra(0xf01 + k * 7), c.cx + c.qx * .9, SIDE + .5 - .5 + .02, c.cz + c.qz * 1.3, face - .8, sit(-1.3));
    put(held(0xf02 + k * 7, 'flip'), c.cx - c.qx * .2, SIDE, c.cz + c.qz * 2.2, face + 2.5, arms(0, -2.3)); if (k % 2 === 0) put(extra(0xf03 + k * 7), c.cx + c.qx * 1.9, SIDE, c.cz - c.qz * .6, face - 1.6, null); });
  // giants: billboard characters at 4×, Lady Justice (chrome, blindfolded) on the dome
  (A.giants || []).forEach((g, k) => { const look = g.look === 'justice' ? Object.assign(L('cmd_q'), { eyewear: { id: 'dwi' }, eyes: 'sparkle' }) : L(g.look || LOOKS[(g.seed ?? k) % LOOKS.length].handle);
    put(look, g.x, g.y, g.z, g.ry ?? [0, Math.PI / 2, Math.PI, -Math.PI / 2][g.rot], g.look === 'justice' ? arms(-2.9, -2.9) : arms(0, -2.4), g.scale ?? 4); });
  // ── generator life anchors: specific things, specific poses
  const lean = t => (rg, o) => { o.rotation.x = t; };
  (A.life || []).forEach((p, k) => { const sd = (Math.imul(p.seed | 0, 2654435761) ^ (k * 40503)) >>> 0, look = extra(sd & 0xffffff), hl = HELD[p.act];
    if (hl) { const id = hl[sd % hl.length]; if (id !== 'none') look.held = { id }; }
    const y = p.y ?? SIDE, sy = (p.seatY ?? .5) - .5;
    switch (p.act) {
      case 'sit': put(look, p.x, y + sy, p.z, p.ry, sit()); break;
      case 'lounge': put(look, p.x, y - .12, p.z, p.ry, (rg, o) => { sit(-1.35, .35)(rg); o.rotation.x = -.35; }); break;
      case 'soak': put(look, p.x, y - .38, p.z, p.ry, sit(-1.4, -.2)); break;
      case 'fe': put(look, p.x, y - .5 + .05, p.z, p.ry, sit(-1.3, -.3)); break;
      case 'window': put(look, p.x, y, p.z, p.ry, arms(-1.35, -1.2)); break;
      case 'dance': put(look, p.x, y, p.z, p.ry, party(k)); break;
      case 'dj': put(look, p.x, y, p.z, p.ry, arms(-1.15, -1.25)); break;
      case 'shoot': put(look, p.x, y, p.z, p.ry, arms(-2.9, -2.8)); break;
      case 'garden': put(look, p.x, y, p.z, p.ry, (rg, o) => { arms(-1.1, -.9)(rg); o.rotation.x = .28; }); break;
      case 'reach': put(look, p.x, y, p.z, p.ry, arms(-2.5, -2.3)); break;
      case 'arms': put(look, p.x, y, p.z, p.ry, arms(-1.3, -.35)); break;
      case 'talk': put(look, p.x, y, p.z, p.ry, arms(-.55, 0)); break;
      case 'talk2': put(look, p.x, y, p.z, p.ry, arms(0, -.8)); break;
      case 'phone': put(look, p.x, y, p.z, p.ry, arms(0, -2.3)); break;
      case 'carry': put(look, p.x, y, p.z, p.ry, arms(-.25, -.15)); break;
      case 'lean': put(look, p.x, y, p.z, p.ry, (rg, o) => { arms(.15, .1)(rg); rg.legL.rotation.x = .25; o.rotation.x = -.13; }); break;
      case 'walk': put(look, p.x, y, p.z, p.ry, (rg, o) => pose(o, 1.2, 1)); break;
      default: put(look, p.x, y, p.z, p.ry, null);
    } });
  // ── walkers: one GPU-animated mesh per material layer
  const W = opts.walkers || [], walk = W.length ? walkerBatch(scene, W) : null;
  // meshes for the baked cast
  let verts = 0; for (const bk of baked.values()) bk.L.forEach((O, i) => { if (!O.v) return; verts += O.v; const m = new THREE.Mesh(geoOf(O), MATS[i]); m.castShadow = i !== 3; m.receiveShadow = true; scene.add(m); });
  return { count: () => verts, people: () => people + W.length, walkers: W, update: t => walk?.update(t) };
}

export function walkerBatch(scene, W) {
  const N = W.length, banks = [0, 1, 2, 3].map(() => new Bank()), tags = [[], [], [], []];
  W.forEach((w, wi) => { const o = build(w.look); pose(o, 0, 0); o.userData.open.visible = true; o.userData.shut.visible = false; o.updateMatrixWorld(true); const rig = o.userData.rig;
    o.traverse(m => { if (!m.isMesh || !visible(m)) return; let part = 0; ['legL', 'legR', 'armL', 'armR'].forEach((n, pi) => { if (isUnder(m, rig[n])) part = pi + 1; });
      const li = Math.max(0, MATS.indexOf(m.material)), dst = banks[li], v0 = dst.L[0].v; bakeMesh(m, dst, 0); for (let q = v0; q < dst.L[0].v; q++) tags[li].push(wi * 8 + part); });
    o.traverse(m => m.geometry?.dispose()); });
  const U = { uWP: { value: W.map(() => new THREE.Vector4()) }, uWG: { value: new Float32Array(N) } };
  const inject = sh => { sh.uniforms.uWP = U.uWP; sh.uniforms.uWG = U.uWG;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aW; uniform vec4 uWP[${N}]; uniform float uWG[${N}];
vec3 walkXf(vec3 p, bool nrm) { int t = int(aW + .5), wi = t / 8, part = t - wi * 8; float s = sin(uWG[wi]);
  float a = part == 1 ? s * .6 : part == 2 ? -s * .6 : part == 3 ? -s * .45 : part == 4 ? s * .45 : 0.;
  vec3 pv = part == 0 ? vec3(0.) : part <= 2 ? vec3(0., .5, .025) : vec3(0., .825, 0.);
  if (!nrm) p -= pv; float c = cos(a), sn = sin(a); p = vec3(p.x, p.y * c - p.z * sn, p.y * sn + p.z * c); if (!nrm) p += pv;
  vec4 P = uWP[wi]; float cy = cos(P.w), sy = sin(P.w); p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy); if (!nrm) p += P.xyz; return p; }`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed = walkXf(transformed, false);');
    if (sh.vertexShader.includes('#include <beginnormal_vertex>')) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = walkXf(objectNormal, true);'); };
  banks.forEach((bk, li) => { const O = bk.L[0]; if (!O.v) return; const g = geoOf(O); g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(tags[li]), 1));
    const mat = MATS[li].clone(); mat.onBeforeCompile = inject; mat.customProgramCacheKey = () => 'walk' + N + li; const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.castShadow = li !== 3; m.receiveShadow = true;
    if (li !== 3) { const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); dm.onBeforeCompile = inject; dm.customProgramCacheKey = () => 'walkd' + N; m.customDepthMaterial = dm; }
    scene.add(m); });
  // pass 1c: walkers beyond `far` metres from the camera drop underground (their batch stays one draw per material)
  return { n: N, update(t, cam, far = 1e9) { let shown = 0; W.forEach((w, i) => { const [ax, az] = w.a, [bx, bz] = w.b, len = Math.hypot(bx - ax, bz - az), s = (t * w.sp + w.off) % (2 * len), fwd = s < len, d = fwd ? s : 2 * len - s, g = s * 6;
    const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len, hide = cam && Math.hypot(x - cam.x, z - cam.z, cam.y) > far; if (!hide) shown++;
    U.uWP.value[i].set(x, hide ? -1000 : (w.y ?? SIDE) + Math.abs(Math.cos(g)) * .05, z, Math.atan2((bx - ax) * (fwd ? 1 : -1), (bz - az) * (fwd ? 1 : -1))); U.uWG.value[i] = g; }); return shown; } };
}
