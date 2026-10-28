// SETS · game-port: the lab's stand-in for the bench loops (bench_clamp, bench_file, bench_fit; CLIPS.md § The lab: a clip's `set` is
// drawn under its actor, never under &dbg=back). The city's bench (bench-props.js BENCH: the top at y 0.435, the front edge 0.30 m ahead)
// with a bench vise on it where the ported loops work: the jaws on the front half of the bench in front of the −x shoulder, the screw and
// its T-bar toward the walker. A stand-in, not a model: boxes in the walker's body frame (game-port.md § The bench says where the city's
// vise goes).
import { BENCH } from './bench-props.js';

// the vise (m, body frame): x0, y0, z0, x1, y1, z1, colour
export const VISE = {
  hub: [-.16, .53, .44],   // the screw's end, where the T-bar turns (bench_clamp's crank circles it, radius 0.09)
  jaws: { x: -.07, z: .55, top: .58 },   // the work stands in the jaws (bench_file's file runs over them, bench_fit sets the part)
};
const BOXES = (() => { const B = BENCH, b = [], box = (cx, cz, w, d, y0, y1, c) => b.push([cx - w / 2, y0, cz - d / 2, cx + w / 2, y1, cz + d / 2, c]);
  b.push([-B.HALF, B.TOP - .04, B.FRONT, B.HALF, B.TOP, B.BACK, 0x7a5232]);
  for (const [x, z] of [[-B.HALF + .05, B.FRONT + .05], [B.HALF - .05, B.FRONT + .05], [-B.HALF + .05, B.BACK - .05], [B.HALF - .05, B.BACK - .05]]) box(x, z, .05, .05, 0, B.TOP - .04, 0x3b2a1a);
  box(-.07, .57, .26, .14, B.TOP, .5, 0x3f5a46);                 // the vise's body, bolted down
  box(-.07, .55, .2, .1, .5, VISE.jaws.top, 0x4d6b55);           // the jaws
  box(-.07, .55, .08, .03, VISE.jaws.top, .64, 0x9aa0a8);       // the blank in the jaws
  box(VISE.hub[0], .47, .03, .06, .515, .545, 0x8b9099);        // the screw
  box(VISE.hub[0], VISE.hub[2], .2, .02, .52, .54, 0xb0b5bd);   // the T-bar
  box(-.3, .58, .16, .14, B.TOP, B.TOP + .01, 0x2d2f33);         // the mat for the parts, beside the vise (bench_fit's −x hand reaches out to it)
  box(-.28, .56, .04, .03, B.TOP + .01, B.TOP + .035, 0xb0b5bd); // a part on it
  return b; })();
let GEO = null;
export function viseSetGeometry(THREE) {
  if (GEO) return GEO;
  const P = [], N = [], C = [], I = [], col = new THREE.Color(); let v = 0;
  for (const [x0, y0, z0, x1, y1, z1, hex] of BOXES) { col.setHex(hex);
    const q = (a, b, c, d, n) => { for (const p of [a, b, c, d]) { P.push(...p); N.push(...n); C.push(col.r, col.g, col.b); } I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4; };
    q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); GEO = g; return g;
}
