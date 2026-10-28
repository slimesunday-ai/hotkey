// SIGNAGE · preview board (owner: the signage agent). ?view=sheet: every family's designs painted flat at their real sizes (layout
// iteration; &res=1: the reserve's new categories, the designs the swap table hands to repeats). The 3D views (all · roofs · walls ·
// street) build every format in voxels under STYLE.md's light, chars.js people for scale. ?tod=night · ?shot=1 (renders once, then
// document.title = 'ready') · ?labels=0 · ?seed=n (another sample of designs)
const Q = new URLSearchParams(location.search), VIEW = Q.get('view') || 'all', SHOT = Q.has('shot'), NIGHT = Q.get('tod') === 'night', SEED = +(Q.get('seed') || 0);
const { TOD } = await import('../kit.js'); TOD.night = NIGHT;
const D = await import('./designs.js'), PT = await import('./paint.js');

function drawImg(I, sc, title) {
  const fig = document.createElement('figure'), cv = document.createElement('canvas'); cv.width = I.w * sc; cv.height = I.h * sc; const g = cv.getContext('2d');
  for (let y = 0; y < I.h; y++) for (let x = 0; x < I.w; x++) { const c = I.c[x + y * I.w]; if (c < 0) continue; g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillRect(x * sc, y * sc, sc, sc);
    if (I.l[x + y * I.w] === 3 && NIGHT) { g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x * sc, y * sc, sc, sc); } }
  fig.append(cv); const cap = document.createElement('figcaption'); cap.textContent = title; fig.append(cap); document.getElementById('sheet').append(fig);
}
// ?view=fit: THE FIT CHECK (signage pass 4 review). Every reserve design painted at every size its family can land on (roof boards 76 × 36
// and the giant board's left 41 columns; the shelter lightbox 16 × 36; paste-ups 22 × 24 … 22 × 29; walls from the smallest a wall ever
// offers), each letter traced: a glyph pixel outside the board's face is an OVERFLOW (a clipped letter); words the layout could not place
// at all are a MISS (the wall allocator skips those designs there; roof boards have no such gate, so a roof miss is a fault too).
// The result: console + window.__fit; document.title = 'ready'.
if (VIEW === 'fit') {
  const { Img } = await import('./art.js'), { RESERVE } = await import('./alloc.js'), txt0 = Img.prototype.text; let CUR = null; const over = [], miss = [];
  Img.prototype.text = function (M, x, y, c, o = {}) { if (CUR) { const sc = o.sc || 1, x1 = x + M.w * sc, y1 = y + M.h * sc, e = CUR.e;
      if (x < 0 || y < e || x1 > this.w || y1 > e + CUR.h) over.push(`${CUR.fam} ${CUR.size} ${CUR.key} · "${o.label ?? M.s}" at ${x},${y - e}→${x1},${y1 - e} in ${this.w}×${CUR.h}`); }
    return txt0.call(this, M, x, y, c, o); };
  const SIZES = { roof: [[76, 36]], transit: [[16, 36, 'poster']], paste: [[22, 24], [22, 29]], wall: [[24, 24], [30, 20], [40, 26], [64, 36], [30, 57], [90, 40], [120, 90]] };
  let n = 0; for (const fam of Object.keys(SIZES)) for (const L of Object.values(RESERVE.gag[fam] || {})) for (const d of L) {
    for (const [w, h, lay] of SIZES[fam]) { const ext = fam === 'roof' ? (d.lay === 'figure' ? 15 : d.lay === 'product' ? 9 : 0) : 0; CUR = { fam, size: `${w}×${h}`, key: d.key, e: ext, h };
      const I = PT.paint(d, w, h, { ext, lay }); n++; if (I.miss) miss.push(`${fam} ${w}×${h} ${d.key}`); }
    if (fam === 'roof' && d.lay !== 'figure') {   // the giant board (boards.js giantPaint): the copy on the left 41 columns, the phone strip under it
      const sh = d.tel || d.sub ? 7 : 0, sub = { ...d, lay: d.icon && !d.look ? 'product' : 'type', tel: null, sub: null }; CUR = { fam: 'roof-giant', size: `41×${36 - sh - 2}`, key: d.key, e: 0, h: 36 - sh - 2 };
      const J = PT.paint(sub, 41, 36 - sh - 2, { lay: sub.lay }); n++; if (J.miss) miss.push(`roof-giant 41×${36 - sh - 2} ${d.key}`); } }
  CUR = null; window.__fit = { paints: n, overflow: over, miss };
  console.log(`FIT: ${n} paintings · ${over.length} overflowing letters · ${miss.length} misses`); for (const l of over.slice(0, 40)) console.log('OVERFLOW ' + l); for (const l of miss.slice(0, 60)) console.log('MISS ' + l);
  document.title = 'ready';
}
if (VIEW === 'sheet') {
  // ?res=1: the RESERVE (signage pass 4: the new categories the swap table hands to repeats), one design per category (?seed=n: another)
  const { RESERVE } = await import('./alloc.js'), RES = Q.has('res') ? Object.values(RESERVE.gag[Q.get('fam') || 'roof'] || {}).map(L => L[SEED % L.length]) : null;
  const fam = Q.get('fam') || 'roof', P = D.POOLS[fam], list = RES ? RES.slice(0, +(Q.get('n') || 60)) : Q.has('miss') ? P.part.flat() : P.part.map((S, c) => S[(c + SEED) % S.length]).filter(Boolean).slice(0, +(Q.get('n') || 36));
  const size = { roof: [76, 36, 4], wall: [64, 36, 4], face: [60, 110, 3], transit: [18, 36, 7], paste: [28, 36, 5], ghost: [60, 30, 4] }[Q.get('size') || fam] || [76, 36, 4];
  for (const d of list) { const ext = fam === 'roof' ? (d.lay === 'figure' ? 14 : d.lay === 'product' ? 8 : 0) : 0, I = PT.paint(d, size[0], size[1], { ext, lit: NIGHT ? 3 : 0, lay: fam === 'transit' ? 'poster' : undefined });
    if (Q.has('miss') && !I.fell && !I.miss && !I.k) continue;   // ?miss=1: only the designs whose picture narrowed, whose words fell back or are missing
    drawImg(I, size[2], `${d.home} · ${d.cat} · ${d.lay}${I.k ? ' ×' + I.k : ''}${I.fell ? '→' + I.lay : ''}${I.miss ? ' · MISSING WORDS' : ''} · ${d.key}`); }
  document.title = 'ready';
}

// ───────────────────────── the 3D board
if (VIEW !== 'sheet' && VIEW !== 'fit') {
  const THREE = await import('three'), { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const { PAL, SIDE } = await import('../style.js'), { mass } = await import('../kit.js'), { Vol, Bank, meshVol, stamp, boxInto } = await import('../vox.js'), { geoOf } = await import('../glue.js');
  const { build, LOOKS } = await import('../cast.js'), { lampPost } = await import('../props.js'), { busShelter } = await import('../transit.js');
  const { windowRow, cornice } = await import('../facade.js');
  const S = await import('./index.js'), { shopRun } = await import('./shop.js'), { trade } = await import('./lexicon.js'), { pick, resetLocal } = await import('./alloc.js');
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
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = .03; sun.position.copy(sunDir).multiplyScalar(90); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
  scene.add(sun, sun.target, new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
  const MATS4 = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
  const bank = new Bank(true), slab = (x0, y0, z0, x1, y1, z1, c) => boxInto(bank, 0, x0, y0, z0, x1, y1, z1, c), labels = [], label = (t, x, y, z) => labels.push({ t, p: new THREE.Vector3(x, y, z) }), people = [], lamps = [];
  const person = (look, x, y, z, ry = 0, sc = 1, arms) => people.push({ look, x, y, z, ry, sc, arms });
  resetLocal();
  // ground: road, north sidewalk, south sidewalk
  slab(-90, -.2, -60, 90, 0, 60, PAL.asphalt); slab(-90, 0, -60, 90, SIDE, -8.2, PAL.walk); slab(-90, 0, -8.2, 90, SIDE, -8, PAL.curbTop); slab(-90, 0, 8, 90, SIDE, 8.2, PAL.curbTop); slab(-90, 0, 8.2, 90, SIDE, 60, PAL.walk);
  for (let x = -88; x < 90; x += 3) slab(x, 0, -.08, x + 1.8, .012, .08, PAL.lineY);
  // one building: world rect, height (voxels), wall; returns frames by side
  const building = (x0, z0, x1, z1, Hv, wall, sides) => { const V = new Vol(Math.round((x1 - x0) / .1) + 6, Hv + 16, Math.round((z1 - z0) / .1) + 6, { org: [x0 - .3, SIDE, z0 - .3] }), B = { x0: 3, z0: 3, x1: V.nx - 3, z1: V.nz - 3 };
    const F = mass(V, B, Hv, wall, PAL.cream, sides); return { V, F, top: SIDE + Hv * .1 }; };
  const trades = [['PIZZA', 0xe8232a, 'food'], ['CHECKS CASHED', 0x14a83b, 'office'], ['BARBER', 0x14a83b, 'barber'], ['PAWN', 0xffe23a, 'gold'], ['WIRELESS', 0x2f5bff, 'phones'], ['LIQUORS', 0x7a3cff, 'bottles'],
    ['NAILS', 0xff4fa3, 'misc'], ['CARDS', 0xffe23a, 'misc'], ['DELI & GROCERY', 0x14a83b, 'food'], ['TAX PREP', 0x2f5bff, 'office'], ['LAUNDROMAT', 0x2de2e6, 'machines'], ['CHICKEN', 0xff7a1a, 'food']];
  const kinds = ['awnBox', 'box', 'band', 'neon', 'awnSlope', 'blade'], walls = [0xffc21a, 0x7a3cff, 0x12b3a0, 0xef4a2a, 0xf4f1ea, 0x2f5bff, 0xff4fa3, 0x9b4f3a];
  // the north row: six buildings with shops, gaps between them so the side walls show; roof boards on top
  let k = 0; const row = []; for (let n = 0; n < 6; n++) { const x0 = -66 + n * 22, w = 16, Hv = [96, 126, 156, 116, 186, 136][n], b = building(x0, -24, x0 + w, -10, Hv, walls[n], ['+z', '+x']);
    const f = b.F('+z'); for (let y0 = 46, fl = 1; y0 + 30 <= Hv - 8; y0 += 30, fl++) windowRow(f, y0, 30, fl, { style: ['punched', 'arched', 'paired', 'tall', 'shutter', 'balcony'][n], trim: PAL.cream, seed: 11 * n + 3, accent: walls[(n + 3) % walls.length], curtain: [0xe8232a, 0xffc21a, 0x2f5bff], bayCol: walls[n], lights: n === 2 });
    cornice(f, Hv, 6, ['bracket', 'band', 'deco', 'crenel', 'pediment', 'thin'][n], PAL.cream, walls[n]);
    for (const [a0, a1] of [[0, 80], [80, 160]]) { const [t, sign, disp] = trades[k % trades.length]; shopRun(f, { a0, a1, name: trade(t), sign, kind: kinds[k % kinds.length], disp, seed: 17 * k + 5, doorLeft: k % 2 === 1, awn: [0xe8232a, 0x14a83b, 0x2f5bff, 0xffe23a][k % 4], gate: k === 7, blade: k === 3 }); k++; }
    // the exposed side wall (+x): the tallest two get a character mural and a big ad, the others a ghost or a wall ad
    const sf = b.F('+x'), L = sf.len; if (n === 1 || n === 4) S.wallMural(sf, 'face', 4, 40, L - 8, Hv - 50, 7 + n); else if (n === 2) S.wallGhost(sf, 4, Hv - 6, L - 8, null, walls[n], 3); else if (n === 3) S.wallMural(sf, 'bigad', 4, 50, L - 8, Hv - 60, 5); else S.wallAd(sf, 4, Hv - 46, L - 8, 40, null, 0xe8232a, 0xffffff);
    meshVol(b.V, bank); row.push(b); }
  // a low wall at the west end with a paste-up row (street level) and a lamp
  { const b = building(-90, -24, -70, -18, 50, 0x6d707a, ['+z']), f = b.F('+z'); S.wallMural(f, 'paste', 2, 4, f.len - 4, 40, 11); meshVol(b.V, bank); }
  // roof billboards: five boards (one with a 4× giant on its catwalk)
  // ?design=<key>: that design on the second and third boards (a plain one and the giant one), to look at one board up close
  const FIX = Q.get('design') ? D.byKey(Q.get('design')) : null;
  row.forEach((b, n) => { const seed = [48756, 48793, 48830, 49813, 50793, 51756][n] + SEED * 3, giant = n === 2; const r = S.roofBillboard(seed, { block: [-2 + n, -1 + (SEED % 3)], giant, design: FIX && (n === 1 || n === 2) ? FIX : undefined }); const cx = -58 + n * 22, cz = -17;
    stamp(r.bank, bank, 0, cx, b.top, cz); label(`<i>${r.design.cat}</i> ${r.design.key}`, cx, b.top + 7.5, cz);
    if (giant) person(LOOKS.find(l => l.handle === 'bail.money'), cx + 2.2, b.top + 1.8, cz + .45, 0, 4, [0, -2.4]); });
  // the bus shelter (its lightbox) and the lamps; people for scale
  { const lb = S.shelterAd({ block: [-2, -1], w: 16, h: 36 }), sh = busShelter(); stamp(sh, bank, 0, 8, SIDE, -9.2); const lv = new Bank(); meshVol(Object.assign(lb.V, { org: [8 + 1.1, SIDE + .3, -9.2 - .5] }), lv); stamp(lv, bank, 0, 0, 0, 0); label('<i>shelter</i> ' + lb.design.key, 9.5, SIDE + 2.6, -9.2); }
  for (const x of [-60, -30, 0, 30, 60]) { stamp(lampPost(), bank, 2, x, SIDE, -8.9); lamps.push([x, -10]); }
  if (NIGHT) for (const [x, z] of lamps) { const l = new THREE.PointLight(0xffd79a, 22, 15, 1.4); l.position.set(x, 5.4, z + 1.2); scene.add(l); }
  [[0, -64, -8.6, 0], [3, -50, -8.8, .4], [7, -36, -8.5, -.3], [9, -20, -8.7, 0], [11, -6, -8.6, .2], [12, 4, -8.8, 0], [13, 22, -8.7, -.2], [14, 40, -8.6, .3]].forEach(([k, x, z, ry]) => person(LOOKS[k % LOOKS.length], x, SIDE, z, ry));
  bank.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), MATS4[li]); m.castShadow = li !== 3; m.receiveShadow = true; scene.add(m); });
  for (const p of people) { const o = build(p.look); o.position.set(p.x, p.y, p.z); o.rotation.y = p.ry; if (p.sc !== 1) o.scale.multiplyScalar(p.sc); if (p.arms) { o.userData.rig.armL.rotation.x = p.arms[0]; o.userData.rig.armR.rotation.x = p.arms[1]; } o.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); scene.add(o); }
  const VIEWS = { all: { pos: [6, 12, 18], tgt: [-24, 14, -17], fov: 62 }, front: { pos: [-8, 26, 44], tgt: [-8, 10, -16], fov: 52 }, roofs: { pos: [-10, 34, 26], tgt: [-10, 20, -18], fov: 50 }, walls: { pos: [-20, 12, 20], tgt: [-20, 11, -18], fov: 58 },
    street: { pos: [-30, 2.4, 3.5], tgt: [-6, 2.4, -10], fov: 52 }, shelter: { pos: [14, 1.7, -7.2], tgt: [7, 1.4, -9.4], fov: 44 } };
  const camera = new THREE.PerspectiveCamera(50, W / H, .1, 1200), v = VIEWS[VIEW] || VIEWS.all; camera.position.set(...v.pos); camera.fov = v.fov; camera.updateProjectionMatrix();
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(...v.tgt); controls.update();
  const LAB = document.getElementById('labels'), els = labels.map(l => { const e = document.createElement('div'); e.className = 'lab'; e.innerHTML = l.t; LAB.appendChild(e); return [e, l.p]; }), tmp = new THREE.Vector3();
  function frame() { renderer.render(scene, camera); for (const [e, p] of els) { tmp.copy(p).project(camera); const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05; e.style.display = vis ? '' : 'none'; e.style.left = ((tmp.x + 1) / 2 * W) + 'px'; e.style.top = ((1 - tmp.y) / 2 * H) + 'px'; } }
  addEventListener('resize', () => { if (SHOT) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  if (SHOT) { frame(); requestAnimationFrame(() => { frame(); document.title = 'ready'; }); } else renderer.setAnimationLoop(() => { controls.update(); frame(); });
  window.__sign = { S, scene, camera, renderer, VIEWS };
}
