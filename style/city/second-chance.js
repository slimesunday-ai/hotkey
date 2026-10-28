// C1-7d · THE SECOND CHANCE, LIVE (GAME.md §15: "the SECOND CHANCE docks at dawn at Low Tide Docks … everyone who isn't arrested
// boards, and the ferry leaves"). The bay's passenger ferry is no longer baked into its sea block (districts/sea.js): it is one live mesh
// of the same model (districts/sea/boats.js ferry(), the teal catamaran), so it can lie at the docks and sail.
//   every path   createFerry({ scene, mats }) puts her where the bake had her, out in the bay heading out (HERO), with her wake
//   the record   poseAt(minute, leave) (draw.js, every update): out in the bay until day 14's dawn; then alongside Low Tide Docks' quay at
//                BERTH with her gangway down, through night 14's boarding; in the ferry's `leave` beat she sails, a function of the beat's
//                clock only (a seek lands her on the same point), round from the berth toward and past HERO, out of sight; then gone
// Her places are spread-world metres: HERO is the bake's own (FERRY in the bay block's frame, its shift), BERTH and the gangway were
// measured on the docks' height map (stage occ: the quay's edge at z −287.5, clear water north of it from x 74 to 105).
import * as THREE from 'three';
import { FERRY } from './districts/sea/bay.js';
import { ferry as ferryModel } from './districts/sea/boats.js';
import { Bank, stamp } from './vox.js';
import { packMerged } from './lod.js';
import { meshOf } from './gpu.js';
import { shiftOf } from '../../world/city.js';

const [SX, SZ] = shiftOf(4, -11);
// a pose: { x, z, a } (heading a: the bow points to (sin a, cos a), as bay.js's plan)
export const HERO = Object.freeze({ x: FERRY.x + SX, z: FERRY.z + SZ, a: FERRY.a });
export const BERTH = Object.freeze({ x: 90, z: -292.1, a: -Math.PI / 2 });
const DRAFT = FERRY.draft, L = FERRY.L, DECK = 2.2 - DRAFT;
// (body frame → world on a pose: `ahead` along her heading, `side` to her port; at the berth she lies port side to the quay)
const at = (p, side, ahead, y = 0) => { const s = Math.sin(p.a), c = Math.cos(p.a); return { x: p.x + side * c + ahead * s, y, z: p.z - side * s + ahead * c }; };
// the gangway: from the quay's edge up to her aft cross deck (boats.js: the deck from 0.8 m to 2.4 m off the stern, at 2.2 m on the keel),
// on her quay side; then a step in over the deck to the cabin's after door, where a boarder goes below
export const GANGWAY = Object.freeze({ foot: at(BERTH, 5.2, -L / 2 + 1.6, .2), top: at(BERTH, 3.4, -L / 2 + 1.6, DECK), door: at(BERTH, 1.2, -L / 2 + 2.2, DECK) });
// the berth's quay line, the way a queue forms from the gangway's foot (along the quay, away from her stern: toward her bow)
export const QUAY = Object.freeze({ dx: Math.sin(BERTH.a), dz: Math.cos(BERTH.a) });
// below: where a boarder is held once aboard, in her main cabin (boats.js: 2.4 to 19.2 m off the stern, 7.2 m wide, closed), out of
// sight on its deck (distinct points 1.4 m apart: no two heads on one spot)
export function below(k) { const i = k % 12, j = Math.floor(k / 12) % 4; return at(BERTH, -2.1 + j * 1.4, -L / 2 + 3 + i * 1.4, DECK); }

// ── the sail out: a cubic from the berth (bow west) swinging north round to her bay mark, then straight on along the curve's last
// heading, out of sight. Arc-length tables, so the beat's clock maps to distance (easing off the berth: s ∝ u^1.5)
const P = [[BERTH.x, BERTH.z], [64, -293], [130, -322], [HERO.x, HERO.z]], ON = 170;
const bez = t => { const u = 1 - t, k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; return [0, 1].map(d => k.reduce((s, w, i) => s + w * P[i][d], 0)); };
const TAB = (() => { const T = [[0, 0, 0]]; let s = 0, q = bez(0); for (let i = 1; i <= 200; i++) { const p = bez(i / 200); s += Math.hypot(p[0] - q[0], p[1] - q[1]); T.push([i / 200, s]); q = p; } return T; })();
const CURVE = TAB.at(-1)[1], END = (() => { const a = bez(.995), b = bez(1), l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })();
export function sailAt(u) {
  const s = (CURVE + ON) * Math.pow(Math.max(0, Math.min(1, u)), 1.5);
  if (s >= CURVE) { const d = s - CURVE; return { x: HERO.x + END[0] * d, z: HERO.z + END[1] * d, a: Math.atan2(END[0], END[1]) }; }
  let i = 1; while (i < TAB.length - 1 && TAB[i][1] < s) i++; const [t0, s0] = TAB[i - 1], [t1, s1] = TAB[i], t = t0 + (t1 - t0) * (s - s0) / Math.max(1e-6, s1 - s0);
  const p = bez(t), q = bez(Math.min(1, t + .005)), r = t + .005 > 1 ? bez(t - .005) : null, dir = r ? [p[0] - r[0], p[1] - r[1]] : [q[0] - p[0], q[1] - p[1]];
  return { x: p[0], z: p[1], a: Math.atan2(dir[0], dir[1]) };
}
// where she is at island minute m on the record: leave = night 14's ferry `leave` beat {start, end} (null: no finale in the record);
// moor: the minute she docks (day 14's dawn). → { pose, gangway, wake } or null (gone)
export function poseAt(m, leave, moor) {
  if (!leave || m < moor) return { pose: HERO, gangway: false, wake: true };
  if (m < leave.start) return { pose: BERTH, gangway: true, wake: false };
  if (m < leave.end) return { pose: sailAt((m - leave.start) / (leave.end - leave.start)), gangway: false, wake: true };
  return null;
}

export function createFerry({ scene, mats }) {
  const g = new THREE.Group(); g.name = 'second-chance';
  const hull = meshOf(packMerged((() => { const b = new Bank(true); stamp(ferryModel(), b, 0, 0, 0, 0); return b; })(), [0, 0, 0]), mats.tier, { cast: true });
  hull.position.y = -DRAFT; g.add(hull);
  // her wake (bay.js wake()'s shape, live and plain): the wash straight back off the stern and the two arms spreading at ~19°
  const foam = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: .32, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  const wakeG = new THREE.BufferGeometry(), V = [];
  const quad = (a, b, c, d) => V.push(...a, ...b, ...c, ...a, ...c, ...d);
  const z0 = -L / 2, len = 26, half = FERRY.W * .32;
  for (const s of [-1, 1]) { const w0 = FERRY.W * .5, w1 = w0 + len * .34; quad([s * w0, .05, z0], [s * (w0 + .5), .05, z0], [s * (w1 + .9), .05, z0 - len], [s * w1, .05, z0 - len]); }
  quad([-half, .05, z0], [half, .05, z0], [half + len * .04, .05, z0 - len * .8], [-half - len * .04, .05, z0 - len * .8]);
  wakeG.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); wakeG.computeVertexNormals();
  const wake = new THREE.Mesh(wakeG, foam); wake.renderOrder = 5; wake.position.y = .2; g.add(wake);
  // the gangway: a steel plank with its rails, quay to deck (in the world, not on her: it stays on the quay's edge when she goes)
  const gw = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: .6, metalness: .3 }), F = GANGWAY.foot, T = GANGWAY.top;
  const len2 = Math.hypot(T.x - F.x, T.y - F.y, T.z - F.z), plank = new THREE.Mesh(new THREE.BoxGeometry(1.1, .08, len2), steel);
  const mid = new THREE.Vector3((F.x + T.x) / 2, (F.y + T.y) / 2, (F.z + T.z) / 2); plank.position.copy(mid); plank.lookAt(T.x, T.y, T.z); gw.add(plank);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, len2), steel); r.position.copy(mid); r.lookAt(T.x, T.y, T.z); r.translateX(s * .55); r.translateY(.9); gw.add(r);
    for (const k of [0, .5, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .9, .05), steel); p.position.set(F.x + (T.x - F.x) * k, F.y + (T.y - F.y) * k + .45, F.z + (T.z - F.z) * k); p.position.add(new THREE.Vector3(1, 0, 0).applyQuaternion(plank.quaternion).multiplyScalar(s * .55)); gw.add(p); } }
  for (const m of [...g.children, ...gw.children]) { m.castShadow = m !== wake; m.receiveShadow = m !== wake; }
  scene.add(g); scene.add(gw);
  let cur = undefined;
  // (state: a { pose, gangway, wake } from poseAt, or null: gone)
  function set(state) {
    const key = state ? `${state.pose.x.toFixed(3)},${state.pose.z.toFixed(3)},${state.pose.a.toFixed(4)},${state.gangway},${state.wake}` : 'gone'; if (key === cur) return; cur = key;
    g.visible = !!state; gw.visible = !!state?.gangway; if (!state) return;
    g.position.set(state.pose.x, 0, state.pose.z); g.rotation.set(0, state.pose.a, 0); wake.visible = state.wake; g.updateMatrixWorld(true);
  }
  set({ pose: HERO, gangway: false, wake: true });
  return { group: g, gangway: gw, set, get visible() { return g.visible; } };
}
