// STORE OBJECTS · preview (owner: the store-objects agent). Built under STYLE.md's light, the city's own mesher and materials.
//   ?view=cat&page=n   one group per page: every object on a 0.25 m floor grid (1 m lines darker), labelled, a chars.js character beside
//                      each for scale; wall pieces on a backing wall at their mount height, surface pieces on a 0.7 m plinth, ceiling
//                      pieces under a gantry. &far=1 the 0.1 versions · &variants=1 every colourway
//   ?view=shop&shop=bodega|pawn|sneakers|cards|laundromat|pizza   a sample shop, cut away · &from=street: through its window (far versions)
//   ?tod=night · ?labels=0 · ?shot=1 (renders once, then document.title = 'ready')
const Q = new URLSearchParams(location.search), VIEW = Q.get('view') || 'cat', SHOT = Q.has('shot'), NIGHT = Q.get('tod') === 'night';
const STREET = Q.get('from') === 'street', FAR = Q.get('far') === '1' || STREET, VARIANTS = Q.get('variants') === '1';
const { TOD } = await import('../../kit.js'); TOD.night = NIGHT;
const THREE = await import('three'), { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
const { PAL } = await import('../../style.js'), { Vol, Bank, meshVol, stamp, boxInto, textMask } = await import('../../vox.js'), { geoOf, bakeMesh } = await import('../../glue.js');
const CH = await import('../../cast.js');
const S = await import('./index.js');
const LAYOUTS = (await import('./shops.js')).SHOPS;

const W = +(Q.get('w') || innerWidth), H = +(Q.get('h') || innerHeight);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SHOT }); renderer.setPixelRatio(SHOT ? 1 : Math.min(2, devicePixelRatio)); renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1.0; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(), C = h => new THREE.Color(h), skyTop = C(NIGHT ? PAL.nightTop : PAL.sky), skyHor = C(NIGHT ? PAL.nightHor : PAL.horizon);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: skyTop }, hor: { value: skyHor } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor; gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n}' });
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);
{ const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone())); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .02).texture; scene.environmentIntensity = NIGHT ? .25 : .55; }
scene.fog = new THREE.Fog(skyHor, 90, 380);
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3.0), sunDir = new THREE.Vector3(-0.52, 0.74, 0.42).normalize();
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = .02; sun.position.copy(sunDir).multiplyScalar(60); sun.target.position.set(0, 0, 0);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 });
scene.add(sun, sun.target, new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
const MATS4 = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];

const bank = new Bank(true), cast = new Bank(true), labels = [], slab = (x0, y0, z0, x1, y1, z1, c, li = 0) => boxInto(bank, li, x0, y0, z0, x1, y1, z1, c);
const label = (t, x, y, z) => labels.push({ t, p: new THREE.Vector3(x, y, z) });
const stats = { tris: 0, objs: 0 };
// put an object: (X, Z) = world min corner of its footprint after q quarter turns (q=0 front +z, 1 +x, 2 −z, 3 −x); y = its base
function put(o, v, X, Z, q = 0, y = 0, far = FAR, state) {
  const V = S.buildObject(o, { variant: v, seed: 7, far, state }), b = new Bank(true); meshVol(V, b); stats.tris += b.tris(); stats.objs++;
  const w = o.foot[0] * .25, d = o.place === 'wall' ? o.h : o.foot[1] * .25, T = [[X, Z], [X, Z + w], [X + w, Z + d], [X + d, Z]][q & 3];
  stamp(b, bank, q, T[0], y, T[1]); return b;
}
const visible = m => { for (let p = m; p; p = p.parent) if (!p.visible) return false; return true; };
const arms = (a, b) => rg => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
const POSE = { stand: null, clerk: arms(-.55, -.55), reach: arms(-2.3, -.2), phone: arms(0, -2.3), point: arms(-1.5, 0), carry: arms(-.25, -.15),
  sit: rg => { rg.legL.rotation.x = rg.legR.rotation.x = -1.35; rg.armL.rotation.x = rg.armR.rotation.x = -.5; }, hands: arms(-2.9, -2.8) };
function person(seed, x, y, z, ry, pose = 'stand', look) {
  // (NPC integration: shop people are civilians, as in the city: castspec.js)
  const L = look ? structuredClone(CH.LOOKS.find(l => l.handle === look)) : CH.rollLook(seed, { pool: 'npc' }), g = CH.build(L); g.rotation.order = 'YXZ'; g.position.set(x, y, z); g.rotation.y = ry;
  CH.pose(g, 0, 0); if (g.userData.open) { g.userData.open.visible = true; g.userData.shut.visible = false; } POSE[pose]?.(g.userData.rig, g); g.updateMatrixWorld(true);
  g.traverse(m => { if (m.isMesh && visible(m)) bakeMesh(m, cast, Math.max(0, CH.MATS.indexOf(m.material))); }); g.traverse(m => m.geometry?.dispose());
}
// a word in the city's 5×7 at 0.1 m cubes on a band (the shopfront sign in the street view)
function word(s, cx, y0, z, c, bg, pad = 3) { const M = textMask(s), w = M.w + pad * 2, V = new Vol(w, 9, 2, { s: .1, org: [cx - w * .05, y0, z] });   // a 0.9 m band, like the city's shops
  V.box(0, 0, 0, w, 9, 1, bg); for (let j = 0; j < 7; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) V.set(pad + i, 7 - j, 1, c, NIGHT ? 3 : 0); meshVol(V, bank); }

let CAM;
if (VIEW === 'cat') {
  // ───────────────────────── the catalogue: a page per group, rows toward −z, the camera in front looking down ~35°
  // pages by position in OBJECTS (index.js order: bodega · pawn + cards · wear · food · cash), balanced to ≤ 10 a page
  const R = (a, b) => Array.from({ length: b - a }, (_, i) => a + i), PAGES = [
    ['bodega · shelves, cooler, counter, deli', R(0, 9)], ['bodega · ATM, coffee, papers, the cat, lotto', R(9, 18)], ['pawn · phones', [...R(18, 23), 67, 69]],
    ['cards & collectibles · sneakers', R(23, 32)], ['streetwear · barber', R(32, 41)], ['laundromat · dollar pizza', R(41, 49)], ['diner · check cashing · liquor · aisles', R(49, 59)],
    ['anywhere · signs inside', [...R(59, 67), 68]], ['wave 2 · vending, claw, barber pole, pizza boxes, stockroom · states', R(70, 75)]];
  const pg = Math.min(PAGES.length - 1, +(Q.get('page') || 0)), list = PAGES[pg][1].map(i => S.OBJECTS[i]).filter(Boolean).sort((a, b) => (a.place === 'ceiling' ? 2.6 : a.h + (a.mount || 0)) - (b.place === 'ceiling' ? 2.6 : b.h + (b.mount || 0)));
  const items = list.flatMap(o => (VARIANTS ? Array.from({ length: o.variants }, (_, v) => v) : [0]).flatMap(v => (o.states ?? [undefined]).map(st => [o, v, st])));   // every state side by side
  document.getElementById('title').textContent = `${pg + 1}/${PAGES.length} · ${PAGES[pg][0]}` + (FAR ? ' · far (0.1 m)' : '') + (VARIANTS ? ' · all colourways' : '');
  const ROW = +(Q.get('row') || 12); let x = 0, z = 0, rowD = 0; const spots = [];
  for (const [o, v, st] of items) { const w = o.foot[0] * .25, d = o.place === 'wall' ? .3 : o.foot[1] * .25, sw = w + 1.2;
    if (x + sw > ROW && x > 0) { z -= rowD + 2.7; x = 0; rowD = 0; }
    spots.push({ o, v, st, x, z, w, d }); x += sw + .45; rowD = Math.max(rowD, d); }
  const zMin = z - rowD - .8, X1 = ROW + .5;
  slab(-1, -.1, zMin - .5, X1, 0, 2.2, 0xdcd6ca);
  for (let gx = -1; gx <= X1 + 1e-6; gx += .25) { const m = Math.abs(gx - Math.round(gx)) < 1e-6; slab(gx - (m ? .012 : .006), 0, zMin - .5, gx + (m ? .012 : .006), .002, 2.2, m ? 0xa9a293 : 0xc6bfb1); }
  for (let gz = zMin - .5; gz <= 2.2 + 1e-6; gz += .25) { const m = Math.abs(gz - Math.round(gz)) < 1e-6; slab(-1, 0, gz - (m ? .012 : .006), X1, .002, gz + (m ? .012 : .006), m ? 0xa9a293 : 0xc6bfb1); }
  spots.forEach(({ o, v, st, x, z, w, d }, k) => { const z0 = z - d;
    if (o.place === 'wall') { const hh = o.foot[1] * .25; slab(x - .05, 0, z0 - .1, x + w + .05, o.mount + hh + .1, z0, 0xe6e1d6); put(o, v, x, z0, 0, o.mount, FAR, st); }
    else if (o.place === 'ceiling') { const cy = 2.6, dd = o.foot[1] * .25; slab(x - .1, cy, z0 + dd / 2 - .05, x + w + .1, cy + .1, z0 + dd / 2 + .05, 0x6d707a); for (const px of [x - .1, x + w]) slab(px, 0, z0 + dd / 2 - .05, px + .1, cy, z0 + dd / 2 + .05, 0x6d707a);
      put(o, v, x, z - o.foot[1] * .25, 0, cy); }
    else if (o.place === 'surface') { slab(x - .05, 0, z0 - .05, x + w + .05, .7, z + .05, 0xc9c3b6); put(o, v, x, z0, 0, .7, FAR, st); }
    else put(o, v, x, z0, 0, 0, FAR, st);
    person(1000 + k * 37 + pg * 331, x + w + .6, 0, z - Math.min(d, 1) * .5, -.3, k % 4 === 2 ? 'point' : 'stand');
    label(`${o.name}${VARIANTS ? ' <i>v' + v + '</i>' : o.variants > 1 ? ' <i>×' + o.variants + '</i>' : ''}${st ? ' <i>· ' + st + '</i>' : ''}<br><s>${o.id} · ${o.foot.join('×')} · ${o.h} m${o.mount ? ' @' + o.mount : ''}${o.sim ? ' · sim ' + o.sim : ''}</s>`, x + w / 2, 0, z + .12); });
  const xs = spots.map(p => p.x + p.w + 1.2), cx = Math.max(...xs) / 2 - .1, span = Math.max(Math.max(...xs) * .84, -zMin * 1.25);
  CAM = { pos: [cx, span * .86, 2.4 + span * .52], tgt: [cx, .4, zMin * .52 + .5], fov: 40 };
}
if (VIEW === 'shop') {
  // ───────────────────────── a sample shop: room 6 × 8 × 3.4 m, front (window) at z = 0, back wall at z = −8; cut away, or from the street
  const L = LAYOUTS[Q.get('shop') || 'bodega'] || LAYOUTS.bodega, RW = L.w ?? 6, RD = L.d ?? 8, RH = 3.4;
  document.getElementById('title').textContent = L.title + (STREET ? ' · through the window (far, 0.1 m)' : ' · inside');
  slab(-.3, -.1, -RD - .3, RW + .3, 0, 0, 0xcfcac0);
  for (let i = 0; i < RW / .5; i++) for (let j = 0; j < RD / .5; j++) if ((i + j) % 2 === 0) slab(i * .5, 0, -RD + j * .5, i * .5 + .5, .002, -RD + j * .5 + .5, L.floor2 ?? 0x26262c);
  slab(0, 0, -RD, RW, .002, 0, L.floor ?? 0xf2f2f2, 0); slab(-.3, 0, -RD - .3, RW + .3, RH, -RD, L.wall); slab(-.3, 0, -RD, 0, RH, 0, L.wall); slab(RW, 0, -RD, RW + .3, RH, 0, shadeHex(L.wall, .92));
  slab(-.3, RH, -RD - .3, RW + .3, RH + .25, STREET ? .3 : 0, 0xefeee8);
  for (const it of L.items) { const o = S.byId(it[0]); if (!o) { console.warn('no object', it[0]); continue; } const [, v, x, z, q = 0, y = 0, st] = it; put(o, v, x, z, q, y, FAR, st); }
  for (const p of L.people || []) person(p[0], p[1], p[2] ?? 0, p[3], p[4], p[5], p[6]);
  if (STREET) {   // the shopfront at the city grain: wall, window, door, sign band; sidewalk, curb, street
    const fw = L.front ?? 0xffc21a, win = [.35, 4.3], door = [4.65, 5.75], TOP = 3.6;
    slab(-.3, 0, 0, win[0], TOP, .3, fw); slab(win[1], 0, 0, door[0], TOP, .3, fw); slab(door[1], 0, 0, RW + .3, TOP, .3, fw); slab(win[0], 0, 0, win[1], .5, .3, fw); slab(win[0], 2.6, 0, door[1], TOP, .3, fw); slab(door[0], 2.4, 0, door[1], 2.6, .3, fw);
    slab(win[0] - .05, .45, .2, win[1] + .05, .52, .45, PAL.white); for (const x of [win[0], (win[0] + win[1]) / 2 - .05, win[1] - .1]) slab(x, .5, .15, x + .1, 2.6, .3, PAL.ink); slab(win[0], 2.5, .15, win[1], 2.6, .3, PAL.ink);
    slab(door[0], 0, .1, door[1], 2.4, .16, 0x2a2d38, 1); slab(door[0] + .12, .12, .16, door[1] - .12, 2.28, .17, 0x3f6bc4, 1); slab(door[0] + .15, 1.1, .17, door[0] + .35, 1.16, .22, PAL.white, 2);
    slab(-.3, 2.65, .3, RW + .3, 3.6, .38, L.band ?? PAL.ink); word(L.sign, RW / 2, 2.68, .38, L.signC ?? PAL.yellow, L.band ?? PAL.ink, 2);
    slab(-4, -.1, 0, RW + 4, 0, 3, PAL.walk); slab(-4, -.1, 3, RW + 4, 0, 3.2, PAL.curbTop); slab(-4, -.3, 3.2, RW + 4, -.1, 12, PAL.asphalt);
    for (let x = -4; x < RW + 4; x += 1) slab(x, 0, 0, x + .01, .002, 3, PAL.joint);
    CAM = { pos: [RW * .47, 1.75, 6.8], tgt: [RW * .46, 1.55, -3], fov: 46 };
  } else CAM = L.cam ?? { pos: [RW / 2, 2.95, 5.3], tgt: [RW / 2, .8, -RD * .55], fov: 52 };
  // the tubes are on: a warm fill under the ceiling (a preview aid: the city's interiors get only the sky fill today; PASS.md)
  for (const [x, z] of [[RW * .3, -RD * .3], [RW * .7, -RD * .3], [RW * .3, -RD * .75], [RW * .7, -RD * .75]]) { const l = new THREE.PointLight(0xfff4dc, NIGHT ? 7 : 5, 7, 1.3); l.position.set(x, RH - .35, z); scene.add(l); }
}
function shadeHex(c, f) { const m = s => Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * f))); return (m(16) << 16) | (m(8) << 8) | m(0); }

bank.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), MATS4[li]); m.castShadow = li !== 3; m.receiveShadow = true; scene.add(m); });
cast.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), CH.MATS[li]); m.castShadow = li !== 3; m.receiveShadow = true; scene.add(m); });
const camera = new THREE.PerspectiveCamera(CAM.fov, W / H, .05, 1200); camera.position.set(...CAM.pos);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(...CAM.tgt); controls.update();
sun.target.position.set(CAM.tgt[0], 0, CAM.tgt[2]); sun.position.copy(sun.target.position).addScaledVector(sunDir, 60); sun.target.updateMatrixWorld();
const LAB = document.getElementById('labels'), els = labels.map(l => { const e = document.createElement('div'); e.className = 'lab'; e.innerHTML = l.t; LAB.appendChild(e); return [e, l.p]; }), tmp = new THREE.Vector3();
function frame() { renderer.render(scene, camera); for (const [e, p] of els) { tmp.copy(p).project(camera); const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05; e.style.display = vis ? '' : 'none'; e.style.left = ((tmp.x + 1) / 2 * W) + 'px'; e.style.top = ((1 - tmp.y) / 2 * H) + 'px'; } }
addEventListener('resize', () => { if (SHOT) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
console.log(`store preview: ${stats.objs} objects · ${Math.round(stats.tris / 1000)}k object tris`);
if (SHOT) { frame(); requestAnimationFrame(() => { frame(); document.title = 'ready'; }); } else renderer.setAnimationLoop(() => { controls.update(); frame(); });
window.__store = { S, scene, camera, renderer, stats };
