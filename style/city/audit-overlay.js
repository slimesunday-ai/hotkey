// ?audit=1 · the in-page view of the audit (pass 1d): every issue a block's build job reported becomes a red box (drawn through
// walls, so buried offenders show) with a short label; a panel counts issues by type. Main thread only.
import * as THREE from 'three';

const SHORT = { 'prop-in-building': 'IN BUILDING', 'prop-in-facade': 'IN FACADE', 'blocks-door': 'IN DOORWAY', 'prop-overlap': 'OVERLAP', 'prop-floating': 'FLOATING', 'prop-sunk': 'SUNK',
  'car-in-curb': 'CAR IN CURB', 'text-overhang': 'TEXT OFF BOARD', 'text-floating': 'TEXT FLOATING', 'text-hidden': 'TEXT HIDDEN', 'text-overwritten': 'TEXT PAINTED OVER', 'z-fight': 'Z-FIGHT',
  'floating-geometry': 'FLOATING VOXELS', 'char-inside': 'PERSON IN GEOMETRY', 'char-floating': 'PERSON FLOATING' };
export const shortOf = t => SHORT[t] || t.toUpperCase();

export function createAuditOverlay(scene, camera, renderer) {
  const group = new THREE.Group(); group.renderOrder = 999; scene.add(group);
  const mat = new THREE.LineBasicMaterial({ color: 0xff1f1f, depthTest: false, depthWrite: false, transparent: true, opacity: .95, fog: false, toneMapped: false });
  const blocks = new Map(), all = [];
  const layer = document.createElement('div'); layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;font:800 10px/1 "Arial Black",Impact,sans-serif;letter-spacing:.02em;';
  document.body.appendChild(layer);
  const panel = document.createElement('div'); panel.style.cssText = 'position:fixed;right:14px;top:56px;background:#17171b;color:#f7f7f2;padding:10px 12px;font:11px/1.45 ui-monospace,Menlo,monospace;box-shadow:4px 4px 0 #ff1f1f;max-width:300px;pointer-events:none;white-space:pre';
  document.body.appendChild(panel);
  const pool = []; const label = k => { let d = pool[k]; if (!d) { d = pool[k] = document.createElement('div'); d.style.cssText = 'position:absolute;background:#ff1f1f;color:#fff;padding:3px 4px 2px;white-space:nowrap;transform:translate(-50%,-100%);'; layer.appendChild(d); } return d; };
  function add(key, audit) {
    const old = blocks.get(key); if (old) { group.remove(old.lines); old.lines.geometry.dispose(); for (const q of old.issues) all.splice(all.indexOf(q), 1); }
    const P = [];
    for (const q of audit.issues) { const [x0, y0, z0, x1, y1, z1] = q.box, e = .03;
      const a = [x0 - e, y0 - e, z0 - e], b = [x1 + e, y1 + e, z1 + e], c = [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]], [a[0], b[1], a[2]], [b[0], b[1], a[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]];
      for (const [u, v] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) P.push(...c[u], ...c[v]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const lines = new THREE.LineSegments(g, mat); lines.renderOrder = 999; lines.frustumCulled = false; group.add(lines);
    const issues = audit.issues.map(q => ({ ...q, key, c: new THREE.Vector3((q.box[0] + q.box[3]) / 2, q.box[4], (q.box[2] + q.box[5]) / 2) }));
    all.push(...issues); blocks.set(key, { lines, issues }); summary();
  }
  function summary() { const n = {}; for (const q of all) n[q.type] = (n[q.type] || 0) + 1;
    panel.textContent = `AUDIT · ${blocks.size} blocks · ${all.length} issues\n` + Object.entries(n).sort((a, b) => b[1] - a[1]).map(([t, k]) => `${String(k).padStart(4)}  ${shortOf(t)}`).join('\n'); }
  const v = new THREE.Vector3(), size = new THREE.Vector2();
  function update(maxLabels = 36, target = null) {
    renderer.getSize(size); const cam = camera.position, list = [], reach = Math.max(140, target ? cam.distanceTo(target) * 1.8 : 140);
    for (const q of all) { const d = q.c.distanceTo(cam); if (d > reach) continue; v.copy(q.c).project(camera); if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue; list.push([d, q, v.x, v.y]); }
    list.sort((a, b) => a[0] - b[0]); let k = 0;
    for (const [, q, x, y] of list.slice(0, maxLabels)) { const d = label(k++); d.hidden = false; d.textContent = `${shortOf(q.type)} · ${q.text ? '"' + q.text.slice(0, 14) + '"' : q.kind}`; d.style.left = ((x + 1) / 2 * size.x) + 'px'; d.style.top = ((1 - y) / 2 * size.y) + 'px'; }
    for (; k < pool.length; k++) pool[k].hidden = true;
  }
  return { add, update, all, blocks, panel };
}
