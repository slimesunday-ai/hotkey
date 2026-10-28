// Preview for the home objects. Catalogue sheets: every object on the 0.25 m cell grid with its footprint outlined, a label, and
// chars.js characters for scale (some sitting in the seats). Tier rooms: one small room per rung of the ladder, furnished only from
// this set, dollhouse-cut (back and right walls). Light is the city's (STYLE §3).
//   ?view=cat&sheet=1..4 | trailer | apartment | house | penthouse · ?tod=night · ?far=1 (the 0.1 far builds) · ?shot=1 · ?labels=0
// Catalogue v2: ?view=v2&k=base|gear|crime|collector|wallfloor|trophy (the new pieces by kind, rarity badges, buffs) ·
//   ?view=asm&a=<tier>-<name> (a preset layout from assemblies/, dollhouse-cut; the owner's slots filled with a demo piece, outlined pink)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PAL, hash } from '../../style.js';
import { TOD } from '../../kit.js';
import { Vol, Bank, meshVol, stamp, stampA, boxInto } from '../../vox.js';
import { geoOf, bakeMesh } from '../../glue.js';
import { build as buildChar, LOOKS, rollLook, MATS as CMATS } from '../../cast.js';

const Q = new URLSearchParams(location.search), NIGHT = Q.get('tod') === 'night', SHOT = Q.has('shot'), FAR = Q.get('far') === '1';
const VIEW = Q.get('view') || 'cat', SHEET = Math.max(1, Math.min(6, +(Q.get('sheet') || 1))), K2 = Q.get('k') || 'base', ASM = Q.get('a') || 'trailer-fresh-start';
TOD.night = NIGHT;                                                          // before any object is built (lit layers follow it)
const H = await import('./index.js');
const { dog } = await import('../../props.js');                            // the city's dog, to sit in the dog bed (preview only)

// ── renderer, sky, light: the city's numbers
const W = +(Q.get('w') || innerWidth), Hh = +(Q.get('h') || innerHeight);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(SHOT ? 1 : Math.min(2, devicePixelRatio)); renderer.setSize(W, Hh);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = NIGHT ? 1.25 : 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(), C = h => new THREE.Color(h), skyTop = C(NIGHT ? PAL.nightTop : PAL.sky), skyHor = C(NIGHT ? PAL.nightHor : PAL.horizon);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: skyTop }, hor: { value: skyHor } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top, hor; varying vec3 vD; void main(){ float h = vD.y; vec3 c = h > 0. ? mix(hor, top, pow(clamp(h,0.,1.), .5)) : hor; gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n}' });
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);
{ const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone())); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .02).texture; scene.environmentIntensity = NIGHT ? .25 : .55; }
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa4ff : 0xfff2dc, NIGHT ? .35 : 3.0), sunDir = new THREE.Vector3(-0.52, 0.74, 0.42).normalize();
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = .02;
scene.add(sun, sun.target, new THREE.HemisphereLight(NIGHT ? 0x4050a0 : 0xd6ecff, NIGHT ? 0x201830 : 0xe0cfb0, NIGHT ? .5 : 1.05));
const MATS4 = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .1 }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: .85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];

// ── placing objects (footprint corner after rotation → stamp translation; vox.js stamp: x' = x c + z s + tx, z' = −x s + z c + tz)
const bank = new Bank(true), CB = new Bank(true), labels = [], lamps = [];
function meshOf(o, opt = {}) { const V = FAR && o.far ? H.buildObject(o, { ...opt, far: true }) : H.buildObject(o, opt), b = new Bank(true); meshVol(V, b); return b; }
function place(id, opt, X, Z, r = 0, y = 0) { const o = H.byId.get(id), w = o.foot[0] * .25, d = o.foot[1] * .25, T = [[X, Z], [X, Z + w], [X + w, Z + d], [X + d, Z]][r & 3];
  stamp(meshOf(o, opt), bank, r, T[0], y, T[1]); return o; }
function placeA(id, opt, cx, cz, ang, y = 0) { const o = H.byId.get(id), lx = o.foot[0] * .125, lz = o.foot[1] * .125, c = Math.cos(ang), s = Math.sin(ang);   // free rotation about the centre
  stampA(meshOf(o, opt), bank, ang, cx - (lx * c + lz * s), y, cz - (-lx * s + lz * c)); return o; }
function onWall(id, opt, side, along, Wr, y, off = 0) { const o = H.byId.get(id), m = y ?? o.mount;               // back wall z = 0 · right wall x = Wr (off: stand proud of a door)
  if (side === 'back') stamp(meshOf(o, opt), bank, 0, along, m, off); else stamp(meshOf(o, opt), bank, 3, Wr - off, m, along); return o; }
const slab = (x0, y0, z0, x1, y1, z1, c) => boxInto(bank, 0, x0, y0, z0, x1, y1, z1, c);

// ── characters (chars.js, baked like people.js) and the city's dog
const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
function person(look, x, y, z, ry, fn) { const c = buildChar(look); c.rotation.order = 'YXZ'; c.position.set(x, y, z); c.rotation.y = ry;
  c.userData.open.visible = true; c.userData.shut.visible = false; fn?.(c.userData.rig, c); c.updateMatrixWorld(true);
  c.traverse(m => { if (m.isMesh && vis(m)) bakeMesh(m, CB, Math.max(0, CMATS.indexOf(m.material))); }); c.traverse(m => m.geometry?.dispose()); }
const sit = (legs = -1.35, ar = -.5) => rg => { rg.legL.rotation.x = rg.legR.rotation.x = legs; rg.armL.rotation.x = rg.armR.rotation.x = ar; };
const arms = (a, b) => rg => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
const L = k => structuredClone(LOOKS[k % LOOKS.length]), R = k => rollLook((k * 7919 + 13) & 0xffffff);
const seated = (look, id, X, Z, r, fn, dx = 0) => { const o = H.byId.get(id), w = o.foot[0] * .25, d = o.foot[1] * .25, lx = w / 2 + dx, lz = d * .5;   // sit someone in a seat
  const [c, s] = [[1, 0], [0, 1], [-1, 0], [0, -1]][r & 3], T = [[X, Z], [X, Z + w], [X + w, Z + d], [X + d, Z]][r & 3];
  person(look, lx * c + lz * s + T[0], (o.seat ?? .45) - .5, -lx * s + lz * c + T[1], r * Math.PI / 2, fn ?? sit()); };
const label = (html, x, y, z) => labels.push({ html, p: new THREE.Vector3(x, y, z) });

// ═════════ catalogue sheets
const SHEETS = { 1: ['seating', 'beds'], 2: ['tables', 'storage', 'kitchen', 'bath'], 3: ['electronics', 'gaming', 'music'], 4: ['lights', 'decor', 'plants', 'rugs'], 5: ['wall', 'collectibles'], 6: ['security', 'stash', 'clutter'] };
const TITLES = { 1: 'seating + beds', 2: 'tables, storage, kitchen, bath', 3: 'electronics, gaming, music', 4: 'lights, decor, plants, rugs', 5: 'wall art + collector culture', 6: 'security, stash, clutter · sim pieces shown open / armed' };
function sheet(n, list0, title0) {
  const list = list0 ?? H.OBJECTS.filter(o => SHEETS[n].includes(o.cat)), tall = o => o.place === 'wall' ? 9 : o.place === 'ceiling' ? 8 : o.h + (o.place === 'surface' ? .45 : 0);
  list.sort((a, b) => tall(b) - tall(a));                                                                       // tall at the back, so nothing hides
  const V2S = !!list0, RW = V2S ? 8 : 12, GAP = V2S ? .3 : .5, ROW = V2S ? 1.15 : 2.1, BUD = V2S ? 0 : .95; let x = 0, z = 0, rowD = 0, rows = [[]], maxX = 0;   // BUD: the character's spot beside each piece (v2: one per row)
  for (const o of list) { const w = o.foot[0] * .25, d = o.place === 'wall' ? .35 : o.foot[1] * .25, sw = Math.max(w + BUD, V2S ? 1.4 : 2.05);
    if (x + sw > RW && x > 0) { z += rowD + ROW; x = 0; rowD = 0; rows.push([]); }
    rows[rows.length - 1].push({ o, x: x + (sw - w - BUD) / 2, z, w, d }); x += sw + GAP; maxX = Math.max(maxX, x); rowD = Math.max(rowD, d); }
  const PK = 0xff4fa3, outline = (x0, y, z0, x1, z1, wall) => { const t = .02; if (wall) { const zz = z0 + .002; for (const [a, b, c, d] of [[x0, y, x1, y + t], [x0, z1 - t, x1, z1], [x0, y, x0 + t, z1], [x1 - t, y, x1, z1]]) boxInto(bank, 3, a, b, zz, c, d, zz + .004, PK); return; }
    for (const [a, b, c, d] of [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1], [x0, z0, x0 + t, z1], [x1 - t, z0, x1, z1]]) boxInto(bank, 3, a, y, b, c, y + .004, d, PK); };
  let k = 0, hmax = 1.8;
  rows.forEach((row, ri) => { row.forEach(({ o, x, z, w, d }, j) => { k++;
    const opt = { variant: 0, seed: 3 + k, state: o.states ? (o.states.includes('open') && o.sim !== 'door' ? 'open' : o.states[0]) : undefined };
    if (o.place === 'wall') { const m = o.mount ?? 1; slab(x - .12, 0, z - .1, x + w + .12, Math.max(2.6, m + o.foot[1] * .25 + .2), z, 0xe6e1d6); slab(x - .12, 0, z, x + w + .12, .12, z + .03, 0xc9c3b6);
      stamp(meshOf(o, opt), bank, 0, x, m, z); outline(x, m, z, x + w, m + o.foot[1] * .25, true); }
    else if (o.place === 'ceiling') { slab(x - .25, 2.6, z + d / 2 - .06, x + w + .25, 2.72, z + d / 2 + .06, 0x6d707a); for (const px of [x - .25, x + w + .15]) slab(px, 0, z + d / 2 - .05, px + .1, 2.6, z + d / 2 + .05, 0x6d707a);
      stamp(meshOf(o, opt), bank, 0, x, 2.6, z); outline(x, .002, z, x + w, z + d); }
    else if (o.place === 'surface') { slab(x - .06, 0, z - .06, x + w + .06, .45, z + d + .06, 0xb9b3a8); stamp(meshOf(o, opt), bank, 0, x, .45, z); outline(x, .452, z, x + w, z + d); }
    else { stamp(meshOf(o, opt), bank, 0, x, 0, z); outline(x, .002, z, x + w, z + d); }
    const f = o.place === 'wall' ? `${o.foot[0]}×${o.foot[1]} wall@${o.mount}` : `${o.foot[0]}×${o.foot[1]} ${o.place} ${o.h}m`;
    if (V2S) label(`${o.name}${badge(o)}`, x + w / 2, 0, z + d + .1); else label(`${o.name}<i>${o.id}</i><i>${f}${o.variants > 1 ? ' · ' + o.variants + 'v' : ''}${o.sim ? ' · ' + o.sim : ''}${o.states ? (o.sim ? ':' : ' · ') + opt.state : ''}</i>${badge(o)}`, x + w / 2, 0, z + d + .12);
    // a character for scale beside every piece (two sit: the couch and the bar stool prove the seat heights)
    if (o.id === 'couch-house') seated(R(k), o.id, x, z, 0, sit(-1.35, -.6), .55);
    else if (o.id === 'stool-bar') seated(R(k), o.id, x, z, 0, sit(-1.1, -.3));
    else if (V2S) { if (j === 0 && ri === 0) person(R(k * 31 + ri), x - .75, 0, z + .2, .35, arms(-.3, 0)); }   // v2 sheets: one character at the head of each row
    else person(k % 3 ? R(k * 31 + n) : L(k + n), x + w + (o.place === 'wall' ? .6 : .45), 0, o.place === 'wall' ? z + .35 : z + .15, -.25, k % 4 === 1 ? arms(0, -.4) : k % 4 === 3 ? arms(-.5, 0) : null);   // beside and a step behind the piece's front
    if (o.id === 'dog-bed') stamp(dog(1, 3, 'sit'), bank, 0, x + .38, .1, z + .3);
    hmax = Math.max(hmax, Math.min(2.8, tall(o)));
  }); });
  const X1 = maxX, Z1 = z + rowD + .9;
  const grid = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#d9d3c7'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#bdb4a5'; for (let i = 0; i < 4; i++) { g.fillRect(i * 64, 0, 2, 256); g.fillRect(0, i * 64, 256, 2); } g.fillStyle = '#9d9485'; g.fillRect(0, 0, 3, 256); g.fillRect(0, 0, 256, 3);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })();
  const G = 60; grid.repeat.set(G, G); const floor = new THREE.Mesh(new THREE.PlaneGeometry(G, G), new THREE.MeshStandardMaterial({ map: grid, roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(G / 2 - 10, 0, G / 2 - 10); floor.receiveShadow = true; scene.add(floor);   // cell lines at whole 0.25 m from the origin
  return { box: [V2S ? -1.1 : -.3, 0, -.3, X1, V2S ? Math.min(hmax, 2.2) : hmax, Z1], el: V2S ? .6 : .86, title: title0 ?? TITLES[n] };
}
// catalogue v2: a rarity badge and what the piece does in the game (FORMAT `game`)
function buffText(G) { if (!G) return ''; const b = G.buff ?? {}, pc = v => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`;
  if (G.kind === 'trophy') return `MARK ${G.mark}`; if (G.kind === 'base') return G.source === 'base' ? 'base kit' : 'store decor';
  const t = []; if (b.secure) t.push(`${b.secure}${b.burgleOdds ? ' ' + b.burgleOdds + '% burgle' : ''}${b.safeTake ? ' take ' + pc(b.safeTake) : ''}`); if (b.stashTake) t.push(`stash take ${pc(b.stashTake)}`);
  if (b.cook) t.push(`cook: ${b.cook}`); if (b.heatDecay) t.push(`heat decay ×${b.heatDecay}`); if (b.crib) t.push(`crib +${b.crib}`); return t.join(' · '); }
function badge(o) { const G = o.game; if (!G) return ''; return `<i class="g"><b class="r ${G.rarity}">${G.rarity === '1of1' ? '1 of 1' : G.rarity}</b> ${G.kind}${G.stealable ? '' : ' · safe'} · ${buffText(G)}</i>`; }
const V2T = { base: 'v2 · base kit additions (everyone gets these)', gear: 'v2 · gear: stash spots, security, cook gear, laying low', crime: 'v2 · collectibles: the crime shelf', collector: 'v2 · collectibles: collector culture', wallfloor: 'v2 · collectibles: wall, floor, ceiling', trophy: 'v2 · trophies: one per MARK (never stolen)' };


// ═════════ tier rooms (dollhouse cut: floor, back wall at z = 0, right wall at x = Wr)
function floorVol(Wr, D, col) { const nx = Math.round(Wr * 20), nz = Math.round(D * 20), V = new Vol(nx, 1, nz, { s: .05, org: [0, -.05, 0], ground: false });
  for (let x = 0; x < nx; x++) for (let z = 0; z < nz; z++) V.set(x, 0, z, col(x, z)); meshVol(V, bank); }
function wallVol(Wr, D, side, col, Hw = 2.8) { const n = Math.round((side === 'back' ? Wr : D) * 20), ny = Math.round(Hw * 20), V = side === 'back' ? new Vol(n, ny, 2, { s: .05, org: [0, 0, -.1], ground: false }) : new Vol(2, ny, n, { s: .05, org: [Wr, 0, 0], ground: false });
  for (let a = 0; a < n; a++) for (let y = 0; y < ny; y++) for (let t = 0; t < 2; t++) { const c = col(a, y, t); if (side === 'back') V.set(a, y, t, c); else V.set(t, y, a, c); } meshVol(V, bank); }
const plain = (c, base = 0xf7f7f2) => (a, y) => y < 3 ? base : c;
function door(side, Wr, a0, c, knobLeft = false) {   // a 1.0 × 2.2 door slab on a wall, the knob on the latch side
  if (side === 'back') { slab(a0, 0, 0, a0 + 1, 2.2, .04, c); slab(a0 - .06, 0, 0, a0 + 1.06, 2.28, .02, 0xf7f7f2); slab(knobLeft ? a0 + .1 : a0 + .82, 1.0, .04, knobLeft ? a0 + .18 : a0 + .9, 1.08, .09, PAL.gold); }
  else { slab(Wr - .04, 0, a0, Wr, 2.2, a0 + 1, c); slab(Wr - .02, 0, a0 - .06, Wr, 2.28, a0 + 1.06, 0xf7f7f2); slab(Wr - .09, 1.0, knobLeft ? a0 + .1 : a0 + .82, Wr - .04, 1.08, knobLeft ? a0 + .18 : a0 + .9, PAL.gold); } }
function ground() { }   // rooms float on the sky, like the sim-asset boards

const ROOMS = {
  trailer() { const Wr = 5, D = 4; ground();
    floorVol(Wr, D, (x, z) => ((x / 5 | 0) + (z / 5 | 0)) & 1 ? 0xd9a93a : 0x8a5a33);                                  // harvest-gold linoleum
    wallVol(Wr, D, 'back', () => 0xa4652f); wallVol(Wr, D, 'right', () => 0xa4652f);
    for (let a = 0; a < 5; a++) onWall('wall-panelling', { variant: 0, seed: a + 1 }, 'back', a, Wr); for (let a = 0; a < 3; a++) onWall('wall-panelling', { variant: 0, seed: a + 7 }, 'right', a, Wr);
    door('right', Wr, 3.0, 0xe8e2d0, true); onWall('door-locks', { variant: 0 }, 'right', 3.02, Wr, .95, .04);
    placeA('rug-rag', { variant: 0 }, 2.9, 1.65, .1);
    place('table-coffee', { variant: 0 }, 4.1, .95, 3); place('tv-crt', { variant: 0, seed: 1 }, 4.3, 1.2, 3, .35); place('lava-lamp', { variant: 0, seed: 2 }, 4.4, 1.93, 0, .35);   // the CRT on a low bench, facing the recliner
    place('recliner', { variant: 0, seed: 2 }, 1.85, 1.1, 1); seated(R(4), 'recliner', 1.85, 1.1, 1, sit(-1.3, -.6));
    placeA('box-fan', { variant: 0 }, 1.25, 2.75, 2.4); placeA('pizza-boxes', { variant: 0, seed: 5 }, 3.2, 3.2, .5);
    onWall('photos-family', { variant: 0, seed: 3 }, 'back', 1.9, Wr); onWall('art-print', { variant: 1 }, 'right', 2.2, Wr, 1.3);
    place('dog-bed', { variant: 0 }, 3.9, .15); stamp(dog(0, 0, 'sit'), bank, 3, 4.3, .1, .5);
    place('stash-shoebox', { variant: 1, state: 'open' }, .45, 1.75); place('safe-small', { state: 'closed' }, .1, .1);
    return { Wr, D, title: 'Trailer · <em>the pads at Sunny Acres</em> — panelling, recliner, CRT, box fan, a loose floorboard' }; },
  apartment() { const Wr = 5, D = 4; ground();
    floorVol(Wr, D, (x, z) => { const p = (z / 3) | 0, j = (x + p * 17) % 40 === 0; return j ? 0x7a4a24 : p & 1 ? 0xb07a45 : 0xa06a3a; });   // worn planks
    wallVol(Wr, D, 'back', (a, y) => ((y % 4 === 3) || ((a + ((y >> 2) & 1) * 3) % 6 === 5)) ? 0xc9b8a8 : 0x9b4f3a);                                  // brick
    wallVol(Wr, D, 'right', plain(0x2f5bff));
    door('back', Wr, 3.9, 0x3a3c44); onWall('door-locks', { variant: 1 }, 'back', 4.62, Wr, .9, .04);
    placeA('rug-shag', { variant: 2, seed: 4 }, 2.3, 2.2, -.08);
    place('gaming-setup', { variant: 0, seed: 2 }, 1.55, .05); place('crate-shelf', { variant: 0, seed: 5 }, .1, .05);
    place('boombox', { variant: 1 }, .3, .1, 0, 1.05); place('lava-lamp', { variant: 2, seed: 3 }, 1.05, .15, 0, 1.05);
    onWall('poster', { variant: 1, seed: 2 }, 'back', 1.55, Wr, 1.2); onWall('poster', { variant: 3 }, 'back', 2.62, Wr, 1.25); onWall('stash-vent', { state: 'open' }, 'back', 3.25, Wr);
    place('futon', { variant: 0 }, 3.95, 1.55, 3); seated(R(9), 'futon', 3.95, 1.55, 3, sit(-1.35, -.7), .35);
    onWall('neon-sign', { variant: 0 }, 'right', 1.65, Wr, 2.1); onWall('ac-window', { variant: 0 }, 'right', .3, Wr);   // the walk-up's window AC
    place('beanbag', { variant: 2 }, 2.0, 2.2, 2); place('stash-floorboard', { variant: 1, state: 'open' }, 3.15, 1.0);
    place('sneaker-boxes', { variant: 0, seed: 2 }, .1, 1.0); placeA('laundry-pile', { variant: 1, seed: 6 }, .6, 3.3, .4);
    placeA('pizza-boxes', { variant: 2, seed: 2 }, 3.0, 3.35, -.3);
    return { Wr, D, title: 'Walk-up apartment · <em>first place</em> — futon, milk crates, a CRT on crates, posters, the window AC, a vent stash' }; },
  house() { const Wr = 5.5, D = 4.5; ground();
    floorVol(Wr, D, (x, z) => { const p = (x / 3) | 0, j = (z + p * 23) % 44 === 0; return j ? 0x6e3e19 : p & 1 ? 0xa86a35 : 0x9a5f2e; });
    const wallC = (a, y) => y < 3 ? 0xf7f7f2 : y === 18 ? 0xf7f7f2 : y < 18 ? 0xc0506e : 0xe07a94;                               // rose walls, a white rail
    wallVol(Wr, D, 'back', wallC); wallVol(Wr, D, 'right', wallC);
    place('couch-house', { variant: 0, seed: 1 }, 1.4, .1); seated(R(21), 'couch-house', 1.4, .1, 0, sit(-1.35, -.55), -.55); seated(L(5), 'couch-house', 1.4, .1, 0, sit(-1.35, -.9), .55);
    onWall('art-print', { variant: 0 }, 'back', 2.15, Wr, 1.3);
    place('table-end', { variant: 0 }, 3.8, .2); place('lamp-table', { variant: 0 }, 3.8, .2, 0, .55);
    placeA('rug-rag', { variant: 1 }, 2.55, 2.1, 0);
    place('tv-console', { variant: 0, seed: 1 }, 2.0, 3.35, 2);
    onWall('photos-family', { variant: 0, seed: 8 }, 'right', .9, Wr); place('plant-monstera', { variant: 0, seed: 2 }, .2, .2);
    door('right', Wr, 3.2, 0xf7f7f2, true); onWall('door-locks', { variant: 0 }, 'right', 3.25, Wr, .95, .04); onWall('alarm-keypad', { state: 'armed' }, 'right', 2.55, Wr);
    place('dog-bed', { variant: 1 }, 4.5, 1.25, 3); stamp(dog(2, 3, 'sit'), bank, 3, 4.9, .1, 1.75);
    return { Wr, D, title: 'House · <em>Pleasantview</em> — the couch, the TV, the lamp, the rug (and the keypad, and the dog)' }; },
  penthouse() { const Wr = 6.5, D = 5.5; ground();
    floorVol(Wr, D, (x, z) => ((x / 20 | 0) + (z / 20 | 0)) & 1 ? 0x3a3c44 : 0x44464f);                                           // big dark stone tiles
    wallVol(Wr, D, 'back', (a, y) => (a % 26 < 2 || y < 2 || y > 53) ? 0x1d1d24 : (a + y) % 40 < 2 && a % 26 < 12 ? PAL.glint : y > 34 ? PAL.glassHi : PAL.glassLo);   // the glass wall
    wallVol(Wr, D, 'right', plain(0xf4f1ea, 0xd3d4d7));
    placeA('rug-persian', { variant: 0 }, 2.5, 2.05, 0); place('sofa-low', { variant: 1 }, 1.25, .6); seated(R(33), 'sofa-low', 1.25, .6, 0, sit(-1.35, -.4), -.5);
    place('table-coffee', { variant: 1 }, 1.9, 2.0); place('chair-puffer', { variant: 2 }, .3, 3.05, 1); place('lamp-arc', { variant: 0 }, .05, 2.35, 0);
    place('bar-home', { variant: 0, seed: 2 }, 5.7, .2, 3); for (const z of [.45, 1.4]) place('stool-bar', { variant: z > 1 ? 1 : 0 }, 5.05, z, 1);
    seated(R(44), 'stool-bar', 5.05, .45, 1, sit(-1.1, -.9));
    onWall('safe-painting', { variant: 0, state: 'open' }, 'right', 2.35, Wr, 1.05); onWall('art-big', { variant: 0 }, 'right', 3.3, Wr, .75);
    place('grails-case', { variant: 0 }, 4.3, .15); place('plant-monstera', { variant: 2, seed: 5 }, .1, .05); place('sneakers-kicked', { variant: 1 }, 2.4, 4.4); placeA('rug-logo', { variant: 1 }, 4.4, 4.2, .25);
    return { Wr, D, title: 'Penthouse · <em>the Gatehill towers</em> — designer seating, big art, the grails case, the bar, the safe behind the art' }; },
};

// ═════════ assemblies (catalogue v2): a preset layout from assemblies/<tier>-<name>.json, dollhouse-cut like the tier rooms
const FLOORS = { linoleum: (x, z) => ((x / 5 | 0) + (z / 5 | 0)) & 1 ? 0xd9a93a : 0x8a5a33, planks: (x, z) => { const p = (z / 3) | 0, j = (x + p * 17) % 40 === 0; return j ? 0x7a4a24 : p & 1 ? 0xb07a45 : 0xa06a3a; },
  oak: (x, z) => { const p = (x / 3) | 0, j = (z + p * 23) % 44 === 0; return j ? 0x6e3e19 : p & 1 ? 0xa86a35 : 0x9a5f2e; }, stone: (x, z) => ((x / 20 | 0) + (z / 20 | 0)) & 1 ? 0x3a3c44 : 0x44464f };
function floorFn(m) { if (m.startsWith('carpet:')) { const c = parseInt(m.slice(8), 16); return (x, z) => hash(x, z, 5) > .8 ? shade2(c, .92) : c; } return FLOORS[m] ?? FLOORS.planks; }
const shade2 = (c, k) => { const f = s => Math.min(255, Math.round(((c >> s) & 255) * k)); return (f(16) << 16) | (f(8) << 8) | f(0); };
function wallFn(m) { if (m.startsWith('paint:')) return plain(parseInt(m.slice(7), 16));
  if (m === 'brick') return (a, y) => ((y % 4 === 3) || ((a + ((y >> 2) & 1) * 3) % 6 === 5)) ? 0xc9b8a8 : 0x9b4f3a;
  if (m === 'rose') return (a, y) => y < 3 ? 0xf7f7f2 : y === 18 ? 0xf7f7f2 : y < 18 ? 0xc0506e : 0xe07a94;
  if (m === 'glass') return (a, y) => (a % 26 < 2 || y < 2 || y > 53) ? 0x1d1d24 : (a + y) % 40 < 2 && a % 26 < 12 ? PAL.glint : y > 34 ? PAL.glassHi : PAL.glassLo;
  if (m.startsWith('panelling')) { const c = m.endsWith('dark') ? 0x8b5a2b : 0xc98a4b; return (a, y) => a % 5 === 0 ? shade2(c, .74) : c; } return plain(0xe6e1d6); }
async function assembly(name) {
  const A = await (await fetch(`./assemblies/${name}.json`)).json(), Wr = A.room.w * .25, D = A.room.d * .25, C4 = .25, occ = new Set();
  floorVol(Wr, D, floorFn(A.room.floor)); wallVol(Wr, D, 'back', wallFn(A.room.walls.N)); wallVol(Wr, D, 'right', wallFn(A.room.walls.E));
  const put = (it, isSlot) => { const o = H.byId.get(isSlot ? it.demo : it.id), r = ((it.rot ?? 0) / 90) & 3, opt = { variant: it.variant ?? 0, seed: 5 + (it.x ?? 0), state: it.state };
    const on = isSlot ? (it.place === 'wall' ? { wall: it.wall } : it.place === 'surface' ? { top: it.on } : it.place) : it.on;
    if (on && on.wall) { onWall(o.id, opt, on.wall === 'N' ? 'back' : 'right', it.x * C4, Wr, it.y); return o; }
    if (on === 'ceiling') { stamp(meshOf(o, opt), bank, r, it.x * C4, 2.8, it.z * C4); return o; }
    let y = 0; if (on && on.top !== undefined) { const P = A.items[on.top]; y = H.byId.get(P.id).tops[0]; }
    place(o.id, opt, it.x * C4, it.z * C4, r, y);
    if (!on || on === 'floor') { const [w, d] = r & 1 ? [o.foot[1], o.foot[0]] : o.foot; if (o.cat !== 'rugs') for (let x = it.x; x < it.x + w; x++) for (let z = it.z; z < it.z + d; z++) occ.add(x + ',' + z); }
    return o; };
  const rugs = A.items.filter(it => H.byId.get(it.id).cat === 'rugs'); for (const it of [...rugs, ...A.items.filter(it => !rugs.includes(it))]) put(it, false);
  const PK = 0xff4fa3, T = .025;
  A.slots.forEach((s, i) => { const o = put(s, true), w = s.foot[0] * C4, d = s.foot[1] * C4, x0 = s.x * C4, z0 = s.z * C4;
    let lp;
    if (s.place === 'wall') { const y0 = s.y ?? o.mount, y1 = y0 + (s.wall === 'N' ? s.foot[1] : s.foot[1]) * C4;
      if (s.wall === 'N') { for (const [a, b, c, e] of [[x0, y0 - T, x0 + w, y0], [x0, y1, x0 + w, y1 + T], [x0 - T, y0, x0, y1], [x0 + w, y0, x0 + w + T, y1]]) boxInto(bank, 3, a, b, .002, c, e, .03, PK); lp = [x0 + w / 2, y1 + .05, .1]; }
      else { for (const [a, b, c, e] of [[x0, y0 - T, x0 + w, y0], [x0, y1, x0 + w, y1 + T], [x0 - T, y0, x0, y1], [x0 + w, y0, x0 + w + T, y1]]) boxInto(bank, 3, Wr - .03, b, a, Wr - .002, e, c, PK); lp = [Wr - .1, y1 + .05, x0 + w / 2]; } }
    else { const y = s.place === 'surface' ? H.byId.get(A.items[s.on].id).tops[0] + .004 : .006;
      for (const [a, b, c, e] of [[x0, z0, x0 + w, z0 + T], [x0, z0 + d - T, x0 + w, z0 + d], [x0, z0, x0 + T, z0 + d], [x0 + w - T, z0, x0 + w, z0 + d]]) boxInto(bank, 3, a, y, b, c, y + .01, e, PK);
      lp = [x0 + w / 2, s.place === 'ceiling' ? 1.9 : y + (s.place === 'surface' ? o.h : Math.min(o.h, 1.6)) + .1, z0 + d / 2]; }
    label(`<span class="slot">SLOT ${i + 1}</span> ${s.label}<i>${o.name} · ${o.game?.kind ?? ''}</i>`, ...lp); });
  // one character for scale: at the back-right, clear of every item and floor slot (so it never stands in front of the story)
  const fp = s => s.rot / 90 & 1 ? [s.foot[1], s.foot[0]] : s.foot;
  spot: for (let z = 3; z < A.room.d - 3; z++) for (let x = A.room.w - 4; x > 1; x--) { let ok = true; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (occ.has((x + a) + ',' + (z + b))) ok = false;
    if (ok && !A.slots.some(s => s.place === 'floor' && x + 3 > s.x && x < s.x + fp(s)[0] && z + 3 > s.z && z < s.z + fp(s)[1])) { person(R(A.name.length * 7 + x), (x + 1.5) * C4, 0, (z + 1.5) * C4, -.6, arms(-.3, 0)); break spot; } }
  return { Wr, D, title: `${A.tier} · <em>${A.name.replace(/-/g, ' ')}</em> — ${A.story}` };
}

// ── build the view
let frameBox, el = .62, title = '', roomCam = null;
if (VIEW === 'cat') { const s = sheet(SHEET); frameBox = s.box; el = s.el; title = `Sheet ${SHEET} · <em>${s.title}</em>${FAR ? ' · far builds (0.1)' : ''}`; }
else if (VIEW === 'v2') { const list = H.OBJECTS.filter(o => H.V2.get(o.id) === K2), s = sheet(0, list, V2T[K2] ?? K2); frameBox = s.box; el = s.el; title = `Catalogue v2 · <em>${s.title}</em> · ${list.length} pieces`; }
else if (VIEW === 'asm') { const R0 = await assembly(ASM); title = R0.title; roomCam = R0; frameBox = [0, 0, 0, R0.Wr, 2.8, R0.D]; }
else { const R0 = (ROOMS[VIEW] || ROOMS.trailer)(); title = R0.title; roomCam = R0; frameBox = [0, 0, 0, R0.Wr, 2.8, R0.D]; }
document.getElementById('cap').innerHTML = title;
bank.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), MATS4[li]); m.castShadow = li !== 3; m.receiveShadow = true; scene.add(m); });
CB.L.forEach((O, li) => { if (!O.v) return; const m = new THREE.Mesh(geoOf(O), CMATS[li]); m.castShadow = li !== 3; m.receiveShadow = true; scene.add(m); });
const [bx0, by0, bz0, bx1, by1, bz1] = frameBox, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, span = Math.max(bx1 - bx0, bz1 - bz0);
sun.position.set(cx, 0, cz).addScaledVector(sunDir, 60); sun.target.position.set(cx, 0, cz); Object.assign(sun.shadow.camera, { left: -span * .8, right: span * .8, top: span * .8, bottom: -span * .8, near: 1, far: 160 }); sun.shadow.camera.updateProjectionMatrix();
if (NIGHT && roomCam) for (const [x, y, z] of [[cx, 2.4, cz], [bx1 - .8, 1.6, .8]]) { const l = new THREE.PointLight(0xffd79a, 6, 9, 1.4); l.position.set(x, y, z); scene.add(l); }

// camera: fit the frame box (sheets: from the front, ~40° down; rooms: from the open front-left corner)
const camera = new THREE.PerspectiveCamera(roomCam ? 44 : 34, W / Hh, .1, 900), tgt = new THREE.Vector3(cx, roomCam ? .9 : .5, roomCam ? cz * .92 : cz);
const dir = roomCam ? new THREE.Vector3(-.62, .58, .9).normalize() : new THREE.Vector3(0, Math.sin(el), Math.cos(el));
let dist = span * 1.2; const corners = []; for (const x of [bx0, bx1]) for (const y of [by0, by1]) for (const z of [bz0, bz1]) corners.push(new THREE.Vector3(x, y, z));
for (let it = 0; it < 40; it++) { camera.position.copy(tgt).addScaledVector(dir, dist); camera.lookAt(tgt); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  let m = 0; for (const c of corners) { const p = c.clone().project(camera); m = Math.max(m, Math.abs(p.x), Math.abs(p.y) * 1.02); } dist *= Math.pow(m / (roomCam ? .9 : .93), .7); }
const controls = new OrbitControls(camera, renderer.domElement); controls.target.copy(tgt); controls.update();
const LAB = document.getElementById('labels'), els = labels.map(l => { const e = document.createElement('div'); e.className = 'lab'; e.innerHTML = l.html; LAB.appendChild(e); return [e, l.p]; });
const tmp = new THREE.Vector3();
function frame() { renderer.render(scene, camera);
  for (const [e, p] of els) { tmp.copy(p).project(camera); const v = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05; e.style.display = v ? '' : 'none'; e.style.left = ((tmp.x + 1) / 2 * W) + 'px'; e.style.top = ((1 - tmp.y) / 2 * Hh) + 'px'; } }
addEventListener('resize', () => { if (SHOT) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
if (SHOT) { frame(); requestAnimationFrame(() => { frame(); document.title = 'ready'; }); }
else renderer.setAnimationLoop(() => { controls.update(); frame(); });
window.__home = { H, scene, camera, renderer };
