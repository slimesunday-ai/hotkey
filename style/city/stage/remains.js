// C2-GAPS (2026-11-05) · THE REMAINS: what birds eat down and what rots away (slime, 11-05: "i think just the gaps we fill with birds and
// decay, max gore lol, birds (pigeons and gulls) 1/3 and  then that last 1/3rd is  decay over time. both leave stains"). traffic/accident.js
// owns the body; traffic/birds.js and traffic/decay.js drive one of these per body they take; this file only draws.
//   THE CAPTURE   the body as it lies (lie_still, the near tier's own pose — every look differs), read once from straight above: the
//                 near batch alone (every other walker hidden for the one render) into a depth target over a 2.9 m square round it →
//                 the height of its top surface over a grid of REMAINS.g cells in the body's frame (x along it to the head, z its
//                 forward). The columns under that surface hold the whole body (every point of it lies under its top), so a SHELL of
//                 cells on their top and their sides, one cell proud, encloses it: once the shell is whole the walker under it is hidden
//                 (w.hide) and nothing vanishes in view — what is seen is the shell. With no capture (the body not on the near tier),
//                 a generous stand-in field (lie_still's measured silhouette, 12 looks' union).
//   THE CELLS     shell (the body's surface: wounds for the birds, rotting skin for decay), inner (flesh, organs), bones (the spine,
//                 ribs, the skull at the head end, low in the columns). Each is a box of an InstancedMesh in the body's frame.
//   THE CONTROLS  set({ cover, eat, swell, rot, sink }) every frame, each 0 … 1:
//     cover   the shell grows over the body from its seeds (the birds' first pecks, decay's torso): a cell scales in as cover passes
//             its order; at 1 the shell is whole (whole() → true) and the inner cells are drawn behind it
//     eat     cells go from the top down (a cell shrinks away as eat passes its order); the bones stay (REMAINS.bones) — the skeleton
//     swell   decay's bloat: the torso's shell cells swell (up to REMAINS.swell larger) and rise
//     rot     decay's colour: pallid → green, purple marbling → black
//     sink    decay's collapse: every cell sinks and flattens toward the ground and spreads a little; past REMAINS.melt the flesh
//             shrinks away into the stain (the bones stay)
//   heightAt(x, z) the top of what is drawn there now (birds stand on it) · drop() removes it (accident.js: only out of view)
import * as THREE from 'three';

export const REMAINS = {
  g: .07,                      // m: a cell
  bones: true,                 // slime's call: the bones stay with the stain (false: they go with the last of the flesh)
  swell: .32, melt: .55,       // decay: the torso's swell at most (× a cell) · sink past which the flesh shrinks away
  // the frame (body frame, m): x from the feet (−) to the head (+), z its forward side; lie_still lies within it (12 looks: x −0.7 … 1.08,
  // z −0.21 … 1.04, up to 1.03 m)
  box: { x0: -.98, x1: 1.33, z0: -.49, z1: 1.33 },
  colors: {
    birds: { shell: [0xa3141a, 0x861015, 0xbf2a24, 0x6a0a0e, 0xd8b9a4], inner: [0x6e0d16, 0x8e1a24, 0x4f0a14, 0xc99e7a, 0x9b3341], bone: [0xe9e3d0, 0xd6cdb2] },
    decay: { pale: [0x9aa58d, 0x8e9a82], green: [0x5f6d3c, 0x6d6a3a, 0x52603a], purple: [0x5a3a58, 0x4c3150], black: [0x2b2118, 0x231a14, 0x3a2a1c], inner: [0x3d221a, 0x55302a], bone: [0xd9cfae, 0xc7bc98] },
  },
};
const G = REMAINS.g, BOX = new THREE.BoxGeometry(1, 1, 1);
const MAT = new THREE.MeshStandardMaterial({ roughness: .6, metalness: 0 });
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ── THE CAPTURE: the body's top over the frame's grid (nx × nz cells): Float32Array of heights (m over the ground; 0 where none)
const CAP = { px: 200, top: 2.5, near: .05, far: 3.2 }; let rt = null, rt2 = null, copy = null, ocam = null;
function captureField(renderer, peds, w, rest) {
  const an = peds.anim, B = an?.batch, list = an?.near; if (!B || !list) return null; const k = list.indexOf(w); if (k < 0) return null;
  if (!rt) { rt = new THREE.WebGLRenderTarget(CAP.px, CAP.px); rt.depthTexture = new THREE.DepthTexture(CAP.px, CAP.px); rt.depthTexture.type = THREE.FloatType;
    rt2 = new THREE.WebGLRenderTarget(CAP.px, CAP.px, { type: THREE.FloatType });
    const m = new THREE.ShaderMaterial({ uniforms: { t: { value: rt.depthTexture } }, vertexShader: 'varying vec2 u; void main() { u = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'uniform sampler2D t; varying vec2 u; void main() { gl_FragColor = vec4(texture2D(t, u).r, 0., 0., 1.); }', depthTest: false, depthWrite: false });
    copy = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) }; copy.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)); copy.scene.children[0].frustumCulled = false;
    ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, CAP.near, CAP.far); ocam.layers.set(30); }
  const { x0, x1, z0, z1 } = REMAINS.box, ex = [Math.cos(rest.yaw), -Math.sin(rest.yaw)], ez = [Math.sin(rest.yaw), Math.cos(rest.yaw)], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const wx = rest.x + ex[0] * cx + ez[0] * cz, wz = rest.z + ex[1] * cx + ez[1] * cz, half = Math.max(x1 - x0, z1 - z0) * .75;
  ocam.left = -half; ocam.right = half; ocam.top = half; ocam.bottom = -half; ocam.updateProjectionMatrix(); ocam.position.set(wx, rest.gy + CAP.top, wz); ocam.up.set(0, 0, -1); ocam.lookAt(wx, rest.gy, wz); ocam.updateMatrixWorld();
  // (the near batch alone, and of it the body alone: every other near walker hidden for this one render)
  const others = []; for (let i = 0; i < list.length; i++) if (i !== k && list[i]) { B.setVisibleAt(i, false); others.push(i); }
  const scene = B.parent; let root = scene; while (root.parent) root = root.parent;
  const prevT = renderer.getRenderTarget(), bg = root.background, fog = root.fog, br = root.onBeforeRender, ov = root.overrideMaterial, ac = renderer.autoClear, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), au = renderer.shadowMap.autoUpdate, nu = renderer.shadowMap.needsUpdate;
  const buf = new Float32Array(CAP.px * CAP.px * 4);
  B.layers.enable(30);
  try { root.background = null; root.fog = null; root.onBeforeRender = () => {}; root.overrideMaterial = null; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false; renderer.autoClear = true;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.render(root, ocam); renderer.setRenderTarget(rt2); renderer.render(copy.scene, copy.cam); renderer.readRenderTargetPixels(rt2, 0, 0, CAP.px, CAP.px, buf); }
  finally { B.layers.disable(30); renderer.setRenderTarget(prevT); root.background = bg; root.fog = fog; root.onBeforeRender = br; root.overrideMaterial = ov; renderer.autoClear = ac; renderer.setClearColor(cc, ca); renderer.shadowMap.autoUpdate = au; renderer.shadowMap.needsUpdate = nu;
    for (const i of others) B.setVisibleAt(i, true); }
  // (orthographic depth: linear) → the height over the ground at a world point
  const hAt = (x, z) => { const i = Math.floor((x - wx + half) / (2 * half) * CAP.px), j = Math.floor((wz + half - z) / (2 * half) * CAP.px); if (i < 0 || j < 0 || i >= CAP.px || j >= CAP.px) return 0;
    const d = buf[(i + j * CAP.px) * 4]; if (!(d < .9999)) return 0; return CAP.top - (CAP.near + d * (CAP.far - CAP.near)); };
  const nx = Math.round((x1 - x0) / G), nz = Math.round((z1 - z0) / G), H = new Float32Array(nx * nz); let any = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { let h = 0; for (const a of [.15, .5, .85]) for (const b of [.15, .5, .85]) { const bx = x0 + (i + a) * G, bz = z0 + (j + b) * G; h = Math.max(h, hAt(rest.x + ex[0] * bx + ez[0] * bz, rest.z + ex[1] * bx + ez[1] * bz)); }
    if (h > .02) { H[i + j * nx] = h; any++; } }
  let hm = 0; for (const h of H) hm = Math.max(hm, h); captureField.last = { any, hm: +hm.toFixed(2) };
  return any > 20 ? { nx, nz, H, captured: true } : null; }
// the stand-in field: lie_still's silhouette, roughly (a long low loaf, the head end higher)
function standIn() { const { x0, x1, z0, z1 } = REMAINS.box, nx = Math.round((x1 - x0) / G), nz = Math.round((z1 - z0) / G), H = new Float32Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = x0 + (i + .5) * G, z = z0 + (j + .5) * G; if (x < -.72 || x > 1.1 || z < -.24 || z > 1.06) continue; const head = x > .55;
    const e = ((x - .19) / .92) ** 2 + ((z - .41) / .66) ** 2; if (e > 1) continue; H[i + j * nx] = (head ? .95 : .62) * Math.sqrt(1 - e * .7); }
  return { nx, nz, H, captured: false }; }

// inPath(x, z): a point in a travel lane's car path (accident.js's): the shell's own margin is never drawn there, and the body's own
// columns there are handed back (R.pathPts) for accident.js to keep the cars off them
export function createRemains({ scene, renderer, peds, inPath = null }) {
  const live = new Set(), S = { made: 0, captured: 0, standIn: 0, live: 0, cells: 0 };
  function add(K, kind) { const rest = K.rest; let F = null; try { const RR = renderer || globalThis.__city?.renderer; F = RR ? captureField(RR, peds, K.w, rest) : null; if (!F) S.why = peds.anim?.near?.includes(K.w) ? 'empty' : 'notNear'; } catch (e) { F = null; S.why = 'err: ' + String(e.message || e).slice(0, 160); } if (F) S.captured++; else { F = standIn(); S.standIn++; }
    const { nx, nz, H } = F, { x0, z0 } = REMAINS.box, solid = new Map(), key = (i, l, j) => i + ',' + l + ',' + j;
    // the columns, one cell proud on every side (the field dilated once, a cell higher): the solid that holds the body
    const ex0 = [Math.cos(rest.yaw), -Math.sin(rest.yaw)], ez0 = [Math.sin(rest.yaw), Math.cos(rest.yaw)], wOf = (i, j) => { const bx = x0 + (i + .5) * G, bz = z0 + (j + .5) * G; return [rest.x + ex0[0] * bx + ez0[0] * bz, rest.z + ex0[1] * bx + ez0[1] * bz]; }, pathPts = [];
    const D = new Float32Array(nx * nz); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { let h = H[i + j * nx]; const own = h > 0;
      if (!h) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) h = Math.max(h, H[ii + jj * nx]); }
      if (h > 0 && inPath) { const p = wOf(i, j); if (inPath(p[0], p[1])) { if (!own) h = 0; else pathPts.push(p); } }
      D[i + j * nx] = h > 0 ? h + G * .6 : 0; }
    let ymax = 0; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const h = D[i + j * nx]; if (!h) continue; const nl = Math.max(1, Math.ceil(h / G)); for (let l = 0; l < nl; l++) solid.set(key(i, l, j), [i, l, j]); ymax = Math.max(ymax, nl); }
    // the body's line (its middle across, per x) for the bones
    const mid = new Float32Array(nx).fill(NaN); for (let i = 0; i < nx; i++) { let a = 0, n = 0; for (let j = 0; j < nz; j++) if (H[i + j * nx] > 0) { a += j; n++; } if (n) mid[i] = a / n; }
    const cells = [], C = REMAINS.colors[kind] || REMAINS.colors.birds, pick = (list, s) => list[Math.floor(rnd(s) * list.length) % list.length];
    // (decay's torso: where the bloat starts; the birds' seeds: three spots on the top, the first pecks)
    const seeds = kind === 'birds' ? [0, 1, 2].map(s => [x0 + (.25 + .5 * rnd(K.rest.x * 3 + s)) * nx * G, z0 + (.3 + .4 * rnd(K.rest.z * 5 + s)) * nz * G]) : [[.15, .4]];
    for (const [i, l, j] of solid.values()) { const exposed = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => !solid.has(key(i + a, l + b, j + c)));
      const x = x0 + (i + .5) * G, z = z0 + (j + .5) * G, y = (l + .5) * G, s = i * 7.13 + j * 3.71 + l * 1.97 + K.rest.x;
      const m = mid[i], bone = !exposed && l <= 2 && !isNaN(m) && (Math.abs(j - m) < .8 && l <= 1 || (x > .62 && Math.abs(j - m) < 2.6 && l >= 1) || (x > -.05 && x < .55 && l === 1 && Math.abs(j - m) < 3.2 && i % 2 === 0));
      const type = bone ? 'bone' : exposed ? 'shell' : 'inner';
      let d0 = 1e9; for (const [sx, sz] of seeds) d0 = Math.min(d0, Math.hypot(x - sx, z - sz) + Math.max(0, ymax * G * .5 - y) * .3);
      const cover = Math.min(1, d0 / 1.35) * .85 + rnd(s) * .15, eat = type === 'bone' ? 2 : Math.min(1, Math.max(0, 1 - y / (ymax * G)) * .75 + rnd(s + 1) * .25);
      const torso = Math.max(0, 1 - Math.hypot((x - .15) / .55, (z - .4) / .45));
      cells.push({ x, y, z, type, cover, eat, torso, melt: rnd(s + 2), s, c0: kind === 'birds' ? pick(type === 'bone' ? C.bone : type === 'shell' ? C.shell : C.inner, s) : 0, f: -1 }); }
    const mesh = new THREE.InstancedMesh(BOX, MAT, cells.length); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.position.set(rest.x, rest.gy, rest.z); mesh.rotation.y = rest.yaw; mesh.updateMatrix(); mesh.matrixAutoUpdate = false; scene.add(mesh);
    const col = new THREE.Color(), M4 = new THREE.Matrix4(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Q = new THREE.Quaternion();
    for (let n = 0; n < cells.length; n++) { M4.makeScale(0, 0, 0); mesh.setMatrixAt(n, M4); mesh.setColorAt(n, col.setHex(cells[n].c0 || 0x5a5a5a)); }
    const tops = new Float32Array(nx * nz); const P = { cover: 0, eat: 0, swell: 0, rot: 0, sink: 0 }; let lastRot = -1, dirty = true;
    const R = { K, kind, cells, mesh, nx, nz, captured: F.captured, P, gone: false, pathPts,
      set(o) { for (const k in o) if (P[k] !== o[k]) { P[k] = o[k]; dirty = true; } },
      whole: () => P.cover >= 1,
      // the top of what is drawn at a body-frame point (m over the ground)
      heightAt(bx, bz) { const i = Math.floor((bx - x0) / G), j = Math.floor((bz - z0) / G); return i < 0 || j < 0 || i >= nx || j >= nz ? 0 : tops[i + j * nx]; },
      // the cells left (flesh, not bones) as a share of all
      left() { let n = 0, f = 0; for (const c of cells) { if (c.type === 'bone') continue; n++; if (c.f > .02) f++; } return n ? f / n : 0; },
      update() { if (!dirty || R.gone) return; dirty = false; const rotNow = Math.round(P.rot * 40) / 40, recol = kind === 'decay' && rotNow !== lastRot; if (recol) lastRot = rotNow; tops.fill(0);
        const bonesStay = REMAINS.bones;
        for (let n = 0; n < cells.length; n++) { const c = cells[n];
          // shown: the shell as cover passes its order (scaling in over 0.08 of it), the inside once the shell is whole
          let f = c.type === 'shell' ? Math.max(0, Math.min(1, (P.cover - c.cover * .92) / .08)) : P.cover >= 1 ? 1 : 0;
          // eaten: from the top down (the bones stay, or go last when they don't)
          if (c.type !== 'bone') f *= 1 - Math.max(0, Math.min(1, (P.eat - c.eat * .9) / .1)); else if (!bonesStay) f *= 1 - Math.max(0, Math.min(1, (P.eat - .9) / .1));
          // the collapse: down and flat; past melt the flesh shrinks into the stain
          const sk = P.sink, yk = 1 - .82 * sk; let sx = 1, sy = 1, y = c.y * yk, x = c.x, z = c.z;
          if (sk > 0) { sy = Math.max(.35, 1 - sk * .5); x = .15 + (c.x - .15) * (1 + .12 * sk); z = .4 + (c.z - .4) * (1 + .18 * sk); if (sk > REMAINS.melt && (c.type !== 'bone' || !bonesStay)) f *= 1 - Math.max(0, Math.min(1, (sk - REMAINS.melt) / (1 - REMAINS.melt) * 1.15 - c.melt * .15)); }
          // the bloat: the torso's shell swells and rises
          if (P.swell > 0 && c.type === 'shell' && c.torso > 0) { const k = 1 + REMAINS.swell * P.swell * c.torso; sx = k; sy *= k; x = .15 + (x - .15) * (1 + .1 * P.swell * c.torso); z = .4 + (z - .4) * (1 + .14 * P.swell * c.torso); y += G * .9 * P.swell * c.torso * (1 - sk); }
          if (Math.abs(f - c.f) > .004 || sk > 0 || P.swell > 0 || c.f < 0) { c.f = f; M4.compose(P3.set(x, y, z), Q, S3.set(G * 1.04 * f * sx, G * 1.04 * f * sy, G * 1.04 * f * sx)); mesh.setMatrixAt(n, M4); mesh.instanceMatrix.needsUpdate = true; }
          if (f > .02) { const i = Math.floor((c.x - x0) / G), j = Math.floor((c.z - z0) / G); const t = y + G * .5 * f * sy; if (t > tops[i + j * nx]) tops[i + j * nx] = t; }
          if (recol) { mesh.setColorAt(n, col.setHex(decayColor(c, P.rot, C))); mesh.instanceColor.needsUpdate = true; } } },
      drop() { if (R.gone) return; R.gone = true; scene.remove(mesh); mesh.dispose(); live.delete(R); } };
    live.add(R); S.made++; S.cells = cells.length; S.field = captureField.last; R.update(); return R; }
  // decay's colours: the shell pallid → green → purple marbling → black; the inside dark; the bones yellowed
  function decayColor(c, rot, C) { const pick = (list, s) => list[Math.floor(rnd(s) * list.length) % list.length];
    if (c.type === 'bone') return pick(C.bone, c.s); if (c.type === 'inner') return pick(C.inner, c.s);
    const r = rot + (rnd(c.s + 5) - .5) * .25; return r < .22 ? pick(C.pale, c.s) : r < .55 ? (rnd(c.s + 7) < .3 ? pick(C.purple, c.s) : pick(C.green, c.s)) : r < .8 ? (rnd(c.s + 7) < .55 ? pick(C.purple, c.s) : pick(C.black, c.s)) : pick(C.black, c.s); }
  function update() { for (const R of live) R.update(); }
  return { add, update, stats: () => ({ ...S, live: live.size }), get live() { return [...live]; } };
}
