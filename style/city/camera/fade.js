// CAMERA FADE (2026-10-09b) · FADE, DON'T FIGHT: walkers, cars and the walkers' dogs in the camera's NEAR ZONE or on the camera-to-subject
// line (a capsule from the camera to the followed person's chest) dissolve to CAM.fade.alpha (35 %, the UX critique's figure) with the
// 4×4 Bayer screen-door the tier fades use (gpu.js DITHER: opaque, no sorting); a body the camera is INSIDE is not drawn at all (below
// nearIn m from its surface), so the camera is never inside a body on screen. The followed person never fades on the line (only when
// the camera is inside them). Shadows stay (the depth materials are untouched).
//   per instance, on the GPU: each instance's body is a capsule from its own transform (the batch's / instance's matrix: a walker's feet
//   and up, a car's centre and its nose axis), so a whole body fades as one; spatially smooth ramps (ramp m), so the fade eases in as
//   they walk into it — never a pop.
//   installFade(material, kind): kind 'walker' (a vertical capsule y0…y1 m over the feet, radius r) · 'car' (a horizontal capsule hl m
//   either side of the centre along the nose, at y m, radius r) · 'wheel' (the car's capsule round each wheel, its nose across the axle). It wraps onBeforeCompile and adds to the program cache key.
//   setFade(camPos, subject | null): once a frame, after the camera's pose (camera/rig.js). Off (no camera, a shot): nothing fades.
import * as THREE from 'three';
import { CAM } from './config.js';

const U = { uCfCam: { value: new THREE.Vector3(0, -1e5, 0) }, uCfSub: { value: new THREE.Vector3(0, -1e5, 0) }, uCfOn: { value: new THREE.Vector4(0, .35, .25, .3) }, uCfNear: { value: new THREE.Vector4(.05, .25, .6, .35) } };
export const FADE_UNIFORMS = U;
const BODY = { walker: k => new THREE.Vector4(k.walker[0], k.walker[1], k.walker[2], 0), car: k => new THREE.Vector4(k.car[0], k.car[1], k.car[2], 1), wheel: k => new THREE.Vector4(k.car[0], k.car[1], k.car[2], 2) };

const PARS = `
uniform vec3 uCfCam; uniform vec3 uCfSub; uniform vec4 uCfOn; uniform vec4 uCfNear; uniform vec4 uCfBody; varying float vCamFade;
float cfPtSeg( vec3 p, vec3 a, vec3 b ) { vec3 ab = b - a; float t = clamp( dot( p - a, ab ) / max( dot( ab, ab ), 1e-6 ), 0., 1. ); return length( p - a - ab * t ); }
float cfSegSeg( vec3 p1, vec3 q1, vec3 p2, vec3 q2 ) { vec3 d1 = q1 - p1, d2 = q2 - p2, r = p1 - p2; float a = dot( d1, d1 ), e = dot( d2, d2 ), f = dot( d2, r ), s = 0., t = 0.;
  if ( a <= 1e-6 ) { t = clamp( f / max( e, 1e-6 ), 0., 1. ); } else { float c = dot( d1, r ); if ( e <= 1e-6 ) { s = clamp( -c / a, 0., 1. ); }
    else { float b = dot( d1, d2 ), dn = a * e - b * b; s = dn > 1e-6 ? clamp( ( b * f - c * e ) / dn, 0., 1. ) : 0.; t = ( b * s + f ) / e;
      if ( t < 0. ) { t = 0.; s = clamp( -c / a, 0., 1. ); } else if ( t > 1. ) { t = 1.; s = clamp( ( b - c ) / a, 0., 1. ); } } }
  return length( p1 + d1 * s - p2 - d2 * t ); }`;
// (the body's capsule from the instance's world transform; the near zone: its distance to the camera; the line: to the camera → chest
// segment, ended lineEnd m short of the chest — a walker just behind the person is hidden by them anyway — the person's own body skipped)
const VERT = `
  { mat4 cfM = modelMatrix;
  #ifdef USE_BATCHING
    cfM = cfM * batchingMatrix;
  #endif
  #ifdef USE_INSTANCING
    cfM = cfM * instanceMatrix;
  #endif
    vec3 o = cfM[ 3 ].xyz, a, b; float sc = length( cfM[ 1 ].xyz ); vec3 f = uCfBody.w > 1.5 ? vec3( -cfM[ 0 ].z, 0., cfM[ 0 ].x ) : vec3( cfM[ 2 ].x, 0., cfM[ 2 ].z );   // (a wheel spins about its axle, x: the car's nose is across it)
    f = length( f ) > 1e-6 ? normalize( f ) : vec3( 0., 0., 1. );
    float s1 = sc > 1e-6 ? 1. : 0.;   // (a hidden or shrunk-to-nothing instance: no fade work)
    if ( uCfBody.w < .5 ) { a = o + vec3( 0., uCfBody.y, 0. ); b = o + vec3( 0., uCfBody.z, 0. ); } else { a = o + vec3( 0., uCfBody.y, 0. ) - f * uCfBody.z; b = o + vec3( 0., uCfBody.y, 0. ) + f * uCfBody.z; }
    float dn = cfPtSeg( uCfCam, a, b ) - uCfBody.x, al = 1.;
    al = dn < uCfNear.z ? mix( 0., uCfOn.y, smoothstep( uCfNear.x, uCfNear.y, dn ) ) : mix( uCfOn.y, 1., smoothstep( uCfNear.z, uCfNear.z + uCfNear.w, dn ) );
    if ( uCfOn.x > .5 ) { vec3 ch = uCfSub + vec3( 0., 1.25, 0. ), dv = ch - uCfCam; float L = length( dv );
      bool self = length( o - uCfSub ) < .2;
      if ( !self && L > .3 ) { vec3 e = uCfCam + dv * max( 0., ( L - uCfOn.z * 1.4 ) / L ); float dc = cfSegSeg( uCfCam, e, a, b ) - uCfBody.x - uCfOn.z;
        al = min( al, mix( uCfOn.y, 1., smoothstep( 0., uCfOn.w, dc ) ) ); } }
    vCamFade = mix( 1., al, s1 ); }
`;
const FRAG = `
  if ( vCamFade < .999 ) { vec2 cq = mod( floor( gl_FragCoord.xy ), 4. ); int ck = int( cq.x ) + int( cq.y ) * 4;
    float cb = ( float( ck == 0 ? 0 : ck == 1 ? 8 : ck == 2 ? 2 : ck == 3 ? 10 : ck == 4 ? 12 : ck == 5 ? 4 : ck == 6 ? 14 : ck == 7 ? 6 : ck == 8 ? 3 : ck == 9 ? 11 : ck == 10 ? 1 : ck == 11 ? 9 : ck == 12 ? 15 : ck == 13 ? 7 : ck == 14 ? 13 : 5 ) + .5 ) / 16.;
    if ( cb >= vCamFade ) discard; }`;

export function installFade(mat, kind = 'walker') {
  if (!mat || mat._camFade) return mat; const body = { value: BODY[kind](CAM.fade) }, prev = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat._camFade = body;
  mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); Object.assign(sh.uniforms, U, { uCfBody: body });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + PARS).replace('#include <project_vertex>', VERT + '#include <project_vertex>');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vCamFade;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FRAG); };
  mat.customProgramCacheKey = () => (key ? key.call(mat) : '') + '|camfade-' + kind;
  mat.needsUpdate = true; return mat;
}

// once a frame, after the pose: the camera, and the person followed (null: only the near zone fades)
export function setFade(p, subject = null) { const k = CAM.fade; if (!k?.on || !p) { U.uCfCam.value.set(0, -1e5, 0); U.uCfOn.value.x = 0; return; }
  U.uCfCam.value.copy(p); U.uCfOn.value.set(subject ? 1 : 0, k.alpha, k.line, k.ramp); U.uCfNear.value.set(k.nearIn, k.nearAt, k.near, k.ramp);
  if (subject) U.uCfSub.value.set(subject.p[0], subject.p[1], subject.p[2]); else U.uCfSub.value.set(0, -1e5, 0); }

// the same rule on the CPU (for probes): the alpha a walker at w.p gets, the camera at p, the subject s (or null)
export function fadeOfWalker(wp, p, s = null) { const k = CAM.fade, [r, y0, y1] = k.walker, ax = wp[0], az = wp[2];
  const seg = (px, py, pz, bx0, by0, bz0, bx1, by1, bz1) => { const ux = bx1 - bx0, uy = by1 - by0, uz = bz1 - bz0, L2 = ux * ux + uy * uy + uz * uz; let t = L2 > 1e-9 ? ((px - bx0) * ux + (py - by0) * uy + (pz - bz0) * uz) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - bx0 - ux * t, py - by0 - uy * t, pz - bz0 - uz * t); };
  const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const dn = seg(p.x, p.y, p.z, ax, wp[1] + y0, az, ax, wp[1] + y1, az) - r;
  let al = dn < k.near ? k.alpha * sm(k.nearIn, k.nearAt, dn) : k.alpha + (1 - k.alpha) * sm(k.near, k.near + k.ramp, dn);
  if (s && Math.hypot(wp[0] - s[0], wp[1] - s[1], wp[2] - s[2]) >= .2) { let dc = 1e9;   // (the line: sampled, for a probe that is plenty)
    const cx = s[0] - p.x, cy = s[1] + 1.25 - p.y, cz = s[2] - p.z, L = Math.hypot(cx, cy, cz), e = Math.max(0, (L - k.line * 1.4) / Math.max(L, 1e-6));
    for (let q = 0; q <= 24; q++) { const u = q / 24 * e; dc = Math.min(dc, seg(p.x + cx * u, p.y + cy * u, p.z + cz * u, ax, wp[1] + y0, az, ax, wp[1] + y1, az)); }
    dc -= r + k.line; al = Math.min(al, k.alpha + (1 - k.alpha) * sm(0, k.ramp, dc)); }
  return al; }
