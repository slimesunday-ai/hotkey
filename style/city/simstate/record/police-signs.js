// C1-10, the drawn half · THE POLICE LEVELS ON THE 3D MAP (?sim=record). One sign per core district at its anchor (places.js DISTRICTS,
// the same anchors placement.js stages from): a board on a light pole, high over the roofs, that faces the camera and keeps its size in
// the world, so it reads at the overview zoom and fades out as the camera comes down into the street. It prints the board's own words
// for the level now and tonight (boardAt().police / .tonight, passed in by ui/record/index.js), coloured by the word: unlit and drawn
// over the city, so it reads the same by day and at night. Nothing here computes a level or predicts one; a district with no level on
// the board has no sign, and a null tonight leaves its line off.
import { DISTRICTS, CITY_PLACES } from './places.js';

const COLOUR = { heavy: '#ff3b3b', normal: '#ffb020', lawless: '#9aa3b5' };
const W = 512, H = 200, SIZE = [46, 18], HIGH = 38, NEAR = 70, FAR = 150, LOW = 30;
export function createPoliceSigns({ THREE, scene }) {
  const group = new THREE.Group(); group.name = 'police-signs'; group.renderOrder = 990; scene.add(group);
  const signs = new Map();
  let shown = {};
  function paint(ctx, district, level, tonight) {
    const c = COLOUR[level] ?? '#d0d4dc', t = tonight === null || tonight === undefined ? null : COLOUR[tonight] ?? '#d0d4dc';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(12,14,20,.92)'; ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, 18); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = c; ctx.stroke();
    ctx.fillStyle = c; ctx.fillRect(4, 4, 26, H - 8);
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.font = '700 34px system-ui, sans-serif'; ctx.fillText(district.toUpperCase(), 50, 42);
    ctx.fillStyle = c; ctx.font = '800 62px system-ui, sans-serif'; ctx.fillText(String(level).toUpperCase(), 50, 104);
    if (t) { ctx.fillStyle = '#c8ccd6'; ctx.font = '600 30px system-ui, sans-serif'; ctx.fillText('TONIGHT', 50, 160); ctx.fillStyle = t; ctx.font = '800 34px system-ui, sans-serif'; ctx.fillText(String(tonight).toUpperCase(), 196, 160); }
  }
  function signOf(district) {
    let s = signs.get(district); if (s) return s;
    const anchor = DISTRICTS[district] && CITY_PLACES[DISTRICTS[district].cityPlace]; if (!anchor) return null;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    sprite.scale.set(SIZE[0], SIZE[1], 1); sprite.position.set(anchor.x, HIGH, anchor.z); sprite.renderOrder = 991; sprite.center.set(.5, 0);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, HIGH, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, fog: false, toneMapped: false }));
    pole.position.set(anchor.x, HIGH / 2, anchor.z);
    group.add(sprite, pole);
    s = { district, cv, tex, sprite, pole, key: '' }; signs.set(district, s); return s;
  }
  // police, tonight: boardAt's values, verbatim (keyed by core district)
  function set(police, tonight) {
    const next = {};
    for (const [district, level] of Object.entries(police ?? {})) {
      const s = signOf(district); if (!s) continue;
      const t = tonight ? tonight[district] ?? null : null, key = `${level}|${t}`;
      next[district] = { level, tonight: t };
      if (s.key !== key) { s.key = key; paint(s.cv.getContext('2d'), district, level, t); s.tex.needsUpdate = true; s.pole.material.color.set(COLOUR[level] ?? '#d0d4dc'); }
      s.sprite.visible = s.pole.visible = true;
    }
    for (const [d, s] of signs) if (!next[d]) s.sprite.visible = s.pole.visible = false;
    shown = next;
  }
  // fades in from NEAR to FAR metres from the camera: in the street the signs step aside, at the overview they are full.
  // C1-8: they are drawn over everything, so they also step aside (fading out in ~0.25 s) whenever
  //   framing  the director or a replay frames a scene (a district's own sign would cover it: the docks replay under DOCKS)
  //   low      the camera comes down below LOW m (a close look at a street: no sign hangs over it)
  //   avoid    their box on screen meets a box of the UI (avoid(): the menu, the ticker, the player's bar, the caption, an open
  //            panel), checked every few frames (the overview's STRIP sign clipped under the ticker)
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), R = new THREE.Vector3();
  let n = 0, last = performance.now();
  function frame(camera, { framing = false, avoid = null, canvas = null } = {}) {
    const now = performance.now(), k = 1 - Math.exp(-(now - last) / 80); last = now;
    const check = avoid && n++ % 6 === 0, rects = check ? avoid() : null, box = check ? (canvas ?? document.querySelector('canvas'))?.getBoundingClientRect() : null;
    R.set(1, 0, 0).applyQuaternion(camera.quaternion);
    for (const s of signs.values()) {
      if (!s.sprite.visible) continue;
      const d = camera.position.distanceTo(s.sprite.position);
      let a = framing || camera.position.y < LOW ? 0 : Math.min(1, Math.max(0, (d - NEAR) / (FAR - NEAR)));
      if (check && a > 0 && box) s.blocked = covers(camera, s, rects, box);
      if (s.blocked) a = 0;
      s.alpha = (s.alpha ?? a) + (a - (s.alpha ?? a)) * k;
      if (s.alpha < .01) s.alpha = a === 0 ? 0 : s.alpha;
      s.sprite.material.opacity = s.alpha; s.pole.material.opacity = s.alpha * .85;
    }
  }
  // the sign's box on screen (its bottom centre, its top, its width at that distance) against each UI box
  function covers(camera, s, rects, box) {
    const p = s.sprite.position, half = SIZE[0] / 2;
    const pts = [[-half, 0], [half, 0], [-half, SIZE[1]], [half, SIZE[1]]].map(([dx, dy]) => {
      P.copy(p).addScaledVector(R, dx); P.y += dy; Q.copy(P).project(camera);
      return Q.z > 1 ? null : [box.left + (Q.x + 1) / 2 * box.width, box.top + (1 - Q.y) / 2 * box.height]; });
    if (pts.some(q => !q)) return false;
    const x0 = Math.min(...pts.map(q => q[0])), x1 = Math.max(...pts.map(q => q[0])), y0 = Math.min(...pts.map(q => q[1])), y1 = Math.max(...pts.map(q => q[1]));
    if (x1 < box.left || x0 > box.right || y1 < box.top || y0 > box.bottom) return false;
    return rects.some(r => x0 < r.right && x1 > r.left && y0 < r.bottom && y1 > r.top);
  }
  return { set, frame, group, stats: () => ({ shown: { ...shown }, opacity: Object.fromEntries([...signs].map(([d, s]) => [d, +s.sprite.material.opacity.toFixed(2)])), blocked: [...signs].filter(([, s]) => s.blocked).map(([d]) => d) }) };
}
