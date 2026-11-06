// C2-GAPS (2026-11-05) · THE BIRDS: a flock that eats a body the van can't reach down to its bones (slime, 11-05: "i think just the gaps
// we fill with birds and decay, max gore lol, birds (pigeons and gulls) 1/3 and  then that last 1/3rd is  decay over time. both leave
// stains"). traffic/accident.js owns the body and decides who takes it; this file only flies the flock and drives the remains
// (stage/remains.js) and the stain's spread (accident.js's, through the flock's progress).
//   WHICH BIRD   ONE SETTING, BIRDS.gulls: gulls within that many blocks of the sea (plan.js kindAt '~'), pigeons inland (−1: pigeons
//                everywhere, 99: gulls everywhere). slime's to change.
//   THE PLAN     (once, when the flock is sent) from the stage's height maps round the body: the low one (from under a head's height:
//                trunks, bins, posts) and the tall one (from 60 m: walls, crowns, awnings, roofs). The spots the birds eat from: on the
//                body and round it on the ground, each clear of anything standing there and under open sky. A COLUMN of open sky by the
//                body (the way down and back up). Where they come from: a point out of the camera's view, from which the straight
//                flight to the top of the column clears every roof and crown by a metre.
//   THE BIRDS    in from out of view (staggered), down the column, a glide to their spot; then they peck (the wounds spread from the
//                first pecks: remains cover → whole, then eaten from the top down: remains eat, blood shed at the pecks), hop now and
//                then; when the body is eaten down to the bones they go back up the column and away until the camera can't see them,
//                and only then are they removed. Nothing appears or vanishes in view.
//   THE CARS     birds read traffic/sim.js's cars and never stop or steer them (no hazards). A bird on or near the ground with a car's
//                body coming over it within BIRDS.look s (the car's box ahead along its lane, BIRDS.pad round it) flies up over the
//                car's roof (a little toward open sky away from the car's line), hovers until the way is clear, and settles back; a
//                spot a car stands on is given up for another.
//   A SEEK       is a cut: finish() takes the birds off at once and the body to its end (accident.js leaves the stain).
import * as THREE from 'three';
import { birdGeometry, BIRD_SIZE } from './birdmodels.js';
import { kerbOut, kindAt, P as BLOCK } from '../plan.js';
import { groundY } from '../stage/gorefx.js';

export const BIRDS = {
  gulls: 2,                                // THE ONE SETTING (blocks from the sea): gulls within it, pigeons inland (−1 / 99: all one kind)
  n: { gull: [7, 9], pigeon: [10, 13] },  // birds in a flock (from … to)
  speed: { gull: 9, pigeon: 7.5 }, climb: 3.6, glide: 2.4, hop: .9,   // m/s: flying, up and down the column, the glide to a spot, a hop
  arrive: 6,                               // s over which the flock sets off (one by one)
  wound: 14, eat: 34,                      // s of pecking (by the whole flock) for the wounds to cover the body · to eat it to the bones
  look: 3, pad: [.7, .55],                 // s ahead a bird watches a car's way (a highway's cars too) · m round its box (along, across)
  flushV: 5,                               // m/s a flushed bird climbs, straight up
  over: .9,                                // m over the car's roof a flushed bird hovers
  up: [8, 14, 22, 32, 45, 60, 80],         // m over the column's top a flock may come down from (the lowest out of view)
  ring: { d: [26, 34, 40], alt: [16, 24, 34, 46, 58], dirs: 16 },   // else where it may come from round the column's top
  colTop: 7,                               // m: the column's top over the body
};
const SP = { gull: { n: 32 }, pigeon: { n: 40 } };
const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
// a car's height (m): conservative — the tallest of its class (the bus, the trucks), so a bird flushed over one clears it
export const carHeight = c => c.hgt || (c.len > 7 ? 3.4 : c.len > 5 ? 3 : 2.1);

export function createBirds({ scene, sim, seen, fx, stage, remains }) {
  const S = { flocks: 0, birds: 0, noPlan: 0, why: {}, flushes: 0, removedSeen: 0, spawnSeen: 0, kinds: {} }, why = k => { S.why[k] = (S.why[k] || 0) + 1; };
  // ── the meshes: one InstancedMesh per kind and pose (perched, wings up, wings down)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, metalness: 0 }), MESH = {};
  for (const kind of ['gull', 'pigeon']) for (const pose of ['stand', 'flyA', 'flyB']) { const m = new THREE.InstancedMesh(birdGeometry(THREE, kind, pose), mat, SP[kind].n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = true; scene.add(m); MESH[kind + pose] = m; }
  const flocks = new Set(); let now = 0;
  const kindFor = (x, z) => { const g = BIRDS.gulls; if (g < 0) return 'pigeon'; if (g >= 99) return 'gull'; const i = Math.floor(x / BLOCK), j = Math.floor(z / BLOCK); for (let a = -g; a <= g; a++) for (let b = -g; b <= g; b++) if (kindAt(i + a, j + b) === '~') return 'gull'; return 'pigeon'; };

  // ════ THE PLAN
  function planFor(K) { const Cx = stage(); if (!Cx) return why('noStage'), null; const R0 = K.rest; let lo = null, hi = null;
    try { lo = Cx.occ(R0.x, R0.z, 6, { n: 160, top: 1.95 }); hi = Cx.occ(R0.x, R0.z, 42, { n: 336, top: 60 }); } catch { return why('noMap'), null; } if (!lo || !hi) return why('noMap'), null;
    // open sky over (x, z): nothing above the ground there (r m round it) · clear at the ground: nothing standing there (the low map)
    const open = (x, z, r = .35) => { const d = r * .7; for (const [a, b] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]]) { const h = hi.at(x + a, z + b); if (h === null || h > groundY(x + a, z + b) + .12) return false; } return true; };
    const clearLow = (x, z, r = .18) => { for (const [a, b] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const h = lo.at(x + a, z + b); if (h === null || h > groundY(x + a, z + b) + .06) return false; } return true; };
    const parked = (x, z) => !!globalThis.__city?.parkedIn?.(x - .25, z - .25, x + .25, z + .25);
    // the straight flight a → b clears the tall map (and is over it: off the map it must be higher than anything there can be)
    const flightClear = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(d / .8); for (let k = 0; k <= n; k++) { const f = k / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f, h = hi.at(x, z); if (h === null ? y < 70 : y < h + 1.2) return false; } return true; };
    const ex = [Math.cos(R0.yaw), -Math.sin(R0.yaw)], ez = [Math.sin(R0.yaw), Math.cos(R0.yaw)], W = (bx, bz) => [R0.x + ex[0] * bx + ez[0] * bz, R0.z + ex[1] * bx + ez[1] * bz];
    // the column: open sky beside the body (its own middle first), the nearest
    let col = null; for (let r = 0; r <= 4.5 && !col; r += .5) for (let a = 0; a < 12 && !col; a++) { const x = R0.x + Math.cos(a / 12 * 6.283) * r, z = R0.z + Math.sin(a / 12 * 6.283) * r; if (open(x, z, 1) && !parked(x, z)) col = [x, z]; }
    if (!col) return why('noColumn'), null;
    const top = [col[0], groundY(col[0], col[1]) + BIRDS.colTop, col[1]];
    // the spots: on the body (its frame: x −0.6 … 1.0, z −0.1 … 0.9) and round it (a ring 0.5 … 1.2 m out), clear and under open sky
    const spots = []; for (let k = 0; k < 90; k++) { const on = k < 36, bx = on ? -.55 + 1.5 * hash(k, 1) : -1 + 2.6 * hash(k, 2), bz = on ? -.05 + .9 * hash(k, 3) : -.8 + 2.4 * hash(k, 4);
      if (!on && bx > -.8 && bx < 1.25 && bz > -.3 && bz < 1.15) continue; const [x, z] = W(bx, bz); if (!open(x, z, .45) || parked(x, z)) continue; if (!clearLow(x, z)) continue;
      if (spots.some(s => Math.hypot(s.x - x, s.z - z) < .32)) continue; if (!flightClear(top, [x, top[1], z])) continue; spots.push({ x, z, bx, bz, on, taken: null }); }
    if (spots.length < 4) return why('noSpots'), null;
    // where they come from: out of view, the flight to the column's top clear
    // (straight down the column from above the frame first — the column is open sky to the map's top, and nothing in the city stands over a
    // road above it — else from round it, the straight flight to the column's top clear of every roof and crown)
    let from = null, vertical = false; for (const alt of BIRDS.up) { const p = [top[0], top[1] + alt, top[2]]; if (!seen(p[0], p[1], p[2], 2.5)) { from = p; vertical = true; break; } }
    const R = BIRDS.ring;
    for (const d of R.d) for (const alt of R.alt) for (let a = 0; a < R.dirs; a++) { if (from) break; const an = a / R.dirs * 6.283 + hash(R0.x, R0.z) * .4, p = [top[0] + Math.cos(an) * d, top[1] + alt, top[2] + Math.sin(an) * d];
      if (seen(p[0], p[1], p[2], 2.5)) continue; if (!flightClear(p, top)) continue; from = p; }
    if (!from) { why('noFrom'); return null; }
    return { col, top, spots, from, vertical, open, clearLow, W, lo, hi, flightClear }; }

  // ════ A FLOCK
  // the plan alone (accident.js asks first: no plan, no flock — the body rots instead)
  const plan = K => { const pl = planFor(K); if (!pl) S.noPlan++; return pl; };
  function start(K, R, pl = planFor(K)) { if (!pl) { S.noPlan++; return null; }
    const kind = kindFor(K.rest.x, K.rest.z), [n0, n1] = BIRDS.n[kind], n = Math.min(pl.spots.length, n0 + Math.floor(hash(K.rest.x, K.rest.z + 1) * (n1 - n0 + 1)));
    const F = { K, kind, pl, R, birds: [], t: 0, cover: 0, eat: 0, leaving: false, done: false, landedT: null };
    // the spots: on the body first (about half), then round it
    const order = [...pl.spots.filter(s => s.on), ...pl.spots.filter(s => !s.on)];
    for (let k = 0; k < n; k++) { const sp = order[(k % 2 ? Math.floor(order.length / 2) : 0) + (k >> 1)] || order[k]; if (!sp || sp.taken) continue; sp.taken = true;
      const jh = pl.vertical ? .7 : 0, j = (a, b) => (hash(k, a) - .5) * b, s0 = [pl.from[0] + j(1, jh), pl.from[1] + j(2, pl.vertical ? 3 : 1), pl.from[2] + j(3, jh)];
      F.birds.push({ k, spot: sp, x: s0[0], y: s0[1], z: s0[2], yaw: 0, st: 'wait', go: hash(k, 9) * BIRDS.arrive, path: null, pi: 0, flap: hash(k, 5), peck: hash(k, 6) * 2, pitch: 0, hold: 0, hovT: 0, shown: false, gone: false, seenNow: false }); }
    S.flocks++; S.birds += F.birds.length; S.kinds[kind] = (S.kinds[kind] || 0) + 1; flocks.add(F); return F; }
  // the way in: from out of view to the column's top, across at that height to over its spot, straight down onto it (open sky over every
  // spot, and the way across clear: the plan's) — each with its own little offset at the top so they don't stack
  const pathIn = (F, b) => { const p = F.pl, j = (a, s) => (hash(b.k, a) - .5) * s, gy = groundY(b.spot.x, b.spot.z);
    return [[p.top[0] + j(11, .8), p.top[1] + j(12, 1.2), p.top[2] + j(13, .8)], [b.spot.x, p.top[1], b.spot.z], [b.spot.x, gy + .9, b.spot.z]]; };
  // the way out: straight up from where it is, across to the column's top, and away the way the flock came (until out of view)
  const pathOut = (F, b) => { const p = F.pl, j = (a, s) => (hash(b.k, a) - .5) * s; return [[b.x, p.top[1], b.z], [p.top[0] + j(23, .8), p.top[1] + j(24, 1.2), p.top[2] + j(25, .8)], [p.from[0] + j(26, p.vertical ? .7 : 0), p.from[1] + j(27, 4), p.from[2] + j(28, p.vertical ? .7 : 0)]]; };
  // a hop's way along the ground clear: nothing standing on it (the low map) and no parked car
  const hopClear = (F, b, s) => { for (let f = 0; f <= 1; f += .1) { const x = b.x + (s.x - b.x) * f, z = b.z + (s.z - b.z) * f, h = F.pl.lo.at(x, z); if (h === null || h > groundY(x, z) + .06 && !(b.spot.on && s.on)) return false; if (globalThis.__city?.parkedIn?.(x - .15, z - .15, x + .15, z + .15)) return false; } return true; };
  // where a perched bird stands: its spot, on top of what's left of the body when the spot is on it
  const standY = (F, b) => groundY(b.spot.x, b.spot.z) + (b.spot.on && F.R ? F.R.heightAt(b.spot.bx, b.spot.bz) : 0);

  // ── a car coming over a bird: its box ahead along its heading, within BIRDS.look s → the car (the soonest), or null
  function threat(x, y, z) { let best = null, bt = 1e9; for (const c of sim.cars) { if (c.gone || Math.abs(c.x - x) > 120 || Math.abs(c.z - z) > 120) continue; if (y > carHeight(c) + .35) continue;
      const h = c.h + (c.yawOff || 0), sh = Math.sin(h), ch = Math.cos(h), dx = x - c.x, dz = z - c.z, al = dx * sh + dz * ch, ac = Math.abs(dx * ch - dz * sh);
      // (a car standing still is no threat beside a bird — only over it; one moving, with BIRDS.pad round it)
      if (c.v < .4 && c.acc <= .05) { if (ac < c.wid / 2 + .12 && Math.abs(al) < c.len / 2 + .12) { bt = 0; best = c; } continue; }
      if (ac > c.wid / 2 + BIRDS.pad[1]) continue;
      // (along its heading: the box now, swept ahead as far as it goes in BIRDS.look s at its speed — and a little more for one speeding up)
      const reach = Math.max(0, c.v) * BIRDS.look + (c.v > .3 ? 2 : 0), t = al < -c.len / 2 - BIRDS.pad[0] ? 1e9 : al <= c.len / 2 + BIRDS.pad[0] ? 0 : (al - c.len / 2 - BIRDS.pad[0]) <= reach ? (al - c.len / 2) / Math.max(.5, c.v) : 1e9;
      if (t < bt) { bt = t; best = c; } }
    return best; }
  // a car standing on a spot (a queue: the spot is given up)
  const standing = (x, z) => sim.cars.some(c => !c.gone && Math.abs(c.x - x) < 6 && Math.abs(c.z - z) < 6 && (() => { const h = c.h + (c.yawOff || 0), dx = x - c.x, dz = z - c.z; return Math.abs(dx * Math.sin(h) + dz * Math.cos(h)) < c.len / 2 + .3 && Math.abs(dx * Math.cos(h) - dz * Math.sin(h)) < c.wid / 2 + .3; })());
  // fly toward p at v m/s: → true on arrival
  function fly(b, p, v, dt) { const dx = p[0] - b.x, dy = p[1] - b.y, dz = p[2] - b.z, d = Math.hypot(dx, dy, dz), st = v * dt; if (d <= st) { b.x = p[0]; b.y = p[1]; b.z = p[2]; return true; }
    b.x += dx / d * st; b.y += dy / d * st; b.z += dz / d * st; if (Math.hypot(dx, dz) > .05) b.yaw = Math.atan2(-dx, -dz); b.vel = v; return false; }
  // where a flushed bird hovers: straight up over where it is (open sky over every spot: the plan's), over the car's roof — never sideways,
  // where the next lane's car may come (a highway's tall one, unseen from the spot)
  function flushTo(F, b, c) { return [b.x, Math.max(b.y, carHeight(c) + BIRDS.over), b.z]; }

  function stepFlock(F, dt) { F.t += dt; const sp = BIRDS.speed[F.kind]; let eating = 0, landed = 0, alive = 0;
    for (const b of F.birds) { if (b.gone) continue; alive++;
      switch (b.st) {
        case 'wait': if (F.t >= b.go && !F.leaving) { b.st = 'in'; b.path = pathIn(F, b); b.pi = 0; b.shown = true; if (seen(b.x, b.y, b.z, .8)) S.spawnSeen++; } break;
        case 'in': { const p = b.path[b.pi], v = b.pi === 0 ? sp : b.pi === 1 ? BIRDS.glide : BIRDS.climb;
          // (low over the road: a car coming → hold over its roof first)
          if (b.y < 4.6) { const c = threat(b.x, b.y, b.z); if (c) { b.st = 'flush'; b.hold = flushTo(F, b, c); b.back = 'in'; S.flushes++; break; } }
          if (fly(b, p, v, dt)) { b.pi++; if (b.pi >= b.path.length) { b.st = 'land'; } } break; }
        case 'land': { const y = standY(F, b); if (fly(b, [b.spot.x, y, b.spot.z], 1.4, dt)) { b.st = 'eat'; b.yaw = Math.atan2(-(F.K.rest.x - b.x), -(F.K.rest.z - b.z)) + (hash(b.k, 31) - .5) * 1.4; } else { const c = threat(b.x, b.y, b.z); if (c) { b.st = 'flush'; b.hold = flushTo(F, b, c); b.back = 'land'; S.flushes++; } } break; }
        case 'eat': { landed++; b.y = standY(F, b); const c = threat(b.x, b.y, b.z); if (c) { b.st = 'flush'; b.hold = flushTo(F, b, c); b.back = 'land'; S.flushes++; b.pitch = 0; break; }
          if (F.leaving) { b.st = 'out'; b.path = pathOut(F, b); b.pi = 0; b.pitch = 0; break; }
          eating++; b.peck -= dt; const ph = Math.max(0, b.peck); b.pitch = b.peck < .35 && b.peck > 0 ? Math.sin((.35 - ph) / .35 * Math.PI) * .75 : 0;
          if (b.peck <= 0) { b.peck = .45 + hash(b.k, F.t * 3) * 1.1;
            // (a peck on the body: a little blood off it, max gore — slime 10-30: "gore is in 100%")
            if (b.spot.on || hash(b.k, F.t) < .3) fx.shed(b.x, b.y + .05, b.z, (hash(b.k, F.t + 1) - .5) * 1.2, 1.6, (hash(b.k, F.t + 2) - .5) * 1.2, 1);
            // (now and then a hop to a free spot near)
            if (hash(b.k, F.t * 7) < .08) { const q = F.pl.spots.find(s => !s.taken && Math.hypot(s.x - b.x, s.z - b.z) < 1.1 && !standing(s.x, s.z) && hopClear(F, b, s)); if (q) { b.spot.taken = null; q.taken = true; b.spot = q; b.st = 'land'; } } }
          break; }
        case 'flush': { fly(b, b.hold, BIRDS.flushV, dt);
          // (every car coming over it, where it hovers and where it would settle: up over the tallest)
          const c = threat(b.x, groundY(b.x, b.z), b.z) || threat(b.spot.x, standY(F, b), b.spot.z); if (c) { b.hovT = 0; b.hold[1] = Math.max(b.hold[1], carHeight(c) + BIRDS.over); } else b.hovT += dt;
          if (F.leaving && b.hovT > .3) { b.st = 'out'; b.path = pathOut(F, b); b.pi = 0; break; }
          // (clear for a beat: back to its spot — or another, when a car stands on it)
          if (b.hovT > .7) { if (b.back === 'out') { b.st = 'out'; break; } if (standing(b.spot.x, b.spot.z)) { const q = F.pl.spots.find(s => !s.taken && !standing(s.x, s.z)); if (q) { b.spot.taken = null; q.taken = true; b.spot = q; } else break; }
            if (b.back === 'in') { b.st = 'in'; b.path = pathIn(F, b); b.pi = 2; } else b.st = 'land'; }
          break; }
        case 'out': { const p = b.path[b.pi], v = b.pi === 0 ? BIRDS.climb : b.pi === 1 ? BIRDS.glide : sp;
          if (b.y < 4.6 && b.pi === 0) { const c = threat(b.x, b.y, b.z); if (c) { b.st = 'flush'; b.hold = [b.x, Math.max(b.y, carHeight(c) + BIRDS.over), b.z]; b.back = 'out'; S.flushes++; break; } }
          if (fly(b, p, v, dt)) b.pi = Math.min(b.pi + 1, b.path.length - 1);
          // (gone only once the camera can't see it — and on past the flock's way out until then)
          if (b.pi >= 2 && !seen(b.x, b.y, b.z, .8)) { b.gone = true; if (b.spot) b.spot.taken = null; }
          else if (b.pi >= b.path.length - 1 && Math.hypot(b.x - p[0], b.y - p[1], b.z - p[2]) < .3) { b.path.push(F.pl.vertical ? [b.x, b.y + 8, b.z] : [b.x + (b.x - F.pl.top[0]) * .5, b.y + 6, b.z + (b.z - F.pl.top[2]) * .5]); b.pi++; }
          break; } }
      b.flap += dt * (F.kind === 'gull' ? 4.5 : 9); }
    // the body: the wounds cover it, then it is eaten down, at the pace of the birds pecking (the whole flock: BIRDS.wound / BIRDS.eat s)
    const k = eating / Math.max(1, F.birds.length);
    if (eating) { if (F.cover < 1) F.cover = Math.min(1, F.cover + dt * k / BIRDS.wound); else F.eat = Math.min(1, F.eat + dt * k / BIRDS.eat); }
    F.R?.set({ cover: F.cover, eat: F.eat });
    if (F.eat >= 1 && !F.leaving) { F.leaving = true; F.leaveT = F.t; }
    if (!alive && F.birds.length) { F.done = true; } }

  // ── drawing: every live bird into its kind's and pose's mesh
  const M4 = new THREE.Matrix4(), Qy = new THREE.Quaternion(), Qp = new THREE.Quaternion(), P3 = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1), YA = new THREE.Vector3(0, 1, 0), XA = new THREE.Vector3(1, 0, 0);
  function draw() { const n = {}; for (const k in MESH) n[k] = 0;
    for (const F of flocks) for (const b of F.birds) { if (b.gone || !b.shown) continue; const perched = b.st === 'eat' || (b.st === 'land' && Math.hypot(b.x - b.spot.x, b.z - b.spot.z) < .25 && b.y - standY(F, b) < .3);
      const pose = perched ? 'stand' : (b.flap % 1) < .5 ? 'flyA' : 'flyB', m = MESH[F.kind + pose], i = n[F.kind + pose]++; if (i >= SP[F.kind].n) continue;
      Qy.setFromAxisAngle(YA, b.yaw); Qp.setFromAxisAngle(XA, -b.pitch); Qy.multiply(Qp); M4.compose(P3.set(b.x, b.y, b.z), Qy, ONE); m.setMatrixAt(i, M4); }
    for (const k in MESH) { MESH[k].count = Math.min(n[k], SP[k.startsWith('gull') ? 'gull' : 'pigeon'].n); MESH[k].instanceMatrix.needsUpdate = true; } }

  function update(dt) { now += dt; for (const F of flocks) { stepFlock(F, dt); if (F.done) flocks.delete(F); } draw(); }
  // a seek: the flock off at once, the body to its end (a cut)
  function finish(F) { for (const b of F.birds) b.gone = true; F.cover = 1; F.eat = 1; F.R?.set({ cover: 1, eat: 1 }); F.done = true; flocks.delete(F); draw(); }
  return { plan, start, update, finish, BIRDS, kindFor, stats: () => ({ ...S, why: { ...S.why }, kinds: { ...S.kinds }, live: flocks.size, flying: [...flocks].reduce((n, F) => n + F.birds.filter(b => !b.gone && b.shown).length, 0) }),
    get flocks() { return [...flocks]; }, meshes: MESH };
}
