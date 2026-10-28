// CAMERA PASS (2026-10-05) · THE ONE TUNABLE PLACE: every number the camera system uses lives here. Change a value here and every
// mode follows. A viewer's own choices (mouse sensitivity, invert Y, the photo format, the follow distance and pitch) are kept in this browser
// (localStorage 'city.camera') on top of these defaults; window.__city.cam.config is this live object (tweak it from the console to try values).
export const CAM = {
  look: { sens: 1.0, invertY: false, base: .0022 },        // mouse-look: radians per pixel × sens (pointer lock or drag)
  // FLY (camera build 3/4, RESEARCH.md §4.6 / §4.8): rates are half-lives in seconds (camera/damp.js) or per-second quantities
  fly: {
    speed: 9,                 // m/s at street level, before altitude
    altGain: .55,             // + m/s per metre of CLEARANCE (height above the highest top below, a 3 × 3 sample ±clearR m; smoothed clearHL s)
    clearR: 4, clearHL: .4,
    maxSpeed: 420,            // m/s cap (after altitude, before boost)
    boost: 3.2, slow: .3,     // Shift · Alt
    accelHL: .12, brakeHL: .28,   // s: the velocity eases to the wish while keys are held · dies away when released (a glide)
    inputSmooth: .07,         // s: keys ramp in and out over this (an S-curve onto the velocity: no steps)
    lookSmooth: 0,            // s: mouse-look smoothing — none in fly (direct control); photo keeps its own
    keyLook: 1.6,             // rad/s: arrows / gamepad stick look rate
    radius: .3,               // m: the camera's body — buildings, posts, people and cars never come closer
    aMin: 25, aFrom: 100, aPerV: 1.2,   // m/s²: the governor's deceleration (2.5 g), + aPerV per m/s above aFrom m/s (409 m/s² at 420 m/s)
    govG: 1, govMax: 300, hardK: 2.4,   // × k/4 (the near-law gain; ≤ 1 stays critically damped) · m of look-ahead at most · × the deceleration: the backstop
    stopGap: .4, standPerV: .06, standMax: 2,   // m short of contact it stops, + s × its speed (≤ m): a stand-off, so a wall's piers and ledges don't catch it
    corrUp: .03, corrDown: .15,   // s: the governor's cut ramps in / out (a surface met one frame and missed the next can't make it chatter)
    slideIters: 4,            // collide-and-slide bumps a frame
    dynTop: 30,               // m: nothing that moves (walkers, cars on the highway decks) is above this — higher up, queries skip people and cars
    depenHL: .06, depenMax: .05, deepAt: 1.5,   // s · m: out of a walker or car that moved into it, never left deeper than depenMax; deeper than deepAt: the nearest free spot
    floor: 1.4, riseMax: 6,   // m above the ground or a roof (eye level; people are solid, so it stays out of heads) · m/s up to a floor that rose
    ceiling: 480,
    maxStep: 1 / 120,         // s: sub-steps of the velocity (so 30, 60 and 120 Hz trace the same path)
    wheelStep: 1.15, speedMul: [.1, 12],
    spikePx: 400, lockQuietMs: 150,   // input.js: a pointer-lock event moving more than spikePx is dropped; and all motion for lockQuietMs after a lock change
    fov: 60,
  },
  // FOLLOW (camera build 2/4, RESEARCH.md §4.4 / §4.8): every rate is a half-life in seconds (camera/damp.js) or a per-second limit
  follow: {
    dist: 4.6, distRange: [2.2, 42], pitch: .24, pitchRange: [-.15, 1.2],   // m · rad: the arm the viewer sets (wheel / R F, W S): its default
    viewerDist: null,         // m: the viewer's own distance once they zoom (prefs: a reload, Tab, a cut, a shot's hand-back keep it); null = dist
    viewerPitch: null,        // rad: the viewer's own pitch once they tilt (W S, a drag, ↑ ↓: kept like viewerDist); null = pitch
    anchorH: .82,             // × the person's height: the pivot (shoulder height, ≈ 1.45 m)
    shoulder: .3,             // m to the camera's right, over the shoulder (× arm / dist when pulled in); 0 = centred
    pivotHL: [.06, .18],      // s: the pivot follows the person (xz, y: curbs and the gait filtered)
    lookAhead: .35, lookAheadMax: .6, lookAheadHL: .3,   // s of their velocity (≤ m) the camera looks ahead of them
    radius: .22,              // m: the camera's body (the arm is swept with it; walls and cars never get between the person and it)
    peopleClear: .55, peopleLiftMax: .9, liftHL: .12,   // another walker this close (m, horizontal): rise over their head, ≤ m, eased (dodge.rate)
    carLift: [.4, .8, 1.2, 1.6, 2.2], duck: [-.4, -.8, -1.2],   // m: the lifts tried when a car is on the arm (cars never shorten it) · the ducks tried under a sign or awning over it
    occl: { minTime: .2, clearTime: .5, inHL: .12, outHL: .35, rate: [1.2, 3], vis: .6, every: .05,     // a WALL hides them (posts never do): after minTime s, search (≤ rad/s, rad/s²)
            yaws: [.26, .52, .87], wideYaws: [1.3, 1.75, 2.4, 3.14], crushNow: true, crushAhead: true, holdRelease: true, lift: .25, drop: .22, w: { vis: 4, yaw: 1, pitch: .8, len: .6, flip: .5, short: 0, close: 2.5 },   // swings (wide ones when the arm has no room for its shortest, now or in armAhead s; short > 0 prices an arm under 2.2 m — 6 swung the camera into signs on posts, camera build 2b) · a lift · a pull-in
            pull: .75, pullOut: .9, stick: .3 },   // (10-09b) SWING BEFORE PULLING IN: a wall that pulls the arm under pull × the viewer's distance (now, armAhead s or 2 × armAhead s on) starts the search as a hidden view does, over the wide swings and behind a walker (half the yaw price); w.close prices an arm that close (0 at pull × it, w.close at the shortest arm, squared between), so a swing beats a close pull-in; the swing it holds keeps a stick bonus; it goes back once the viewer's angle has pullOut × their distance, now and two steps on, and a clear view
    dodge: { steps: [.15, .3, .45, .6, .75], inHL: .1, outHL: .35, rate: [2.5, 10], every: .05, ahead: .4, clear: .3 },   // a POST in the way: side-step (m, ≤ .75) round it, never pull in (≤ m/s, m/s²)
    armInHL: .08, armOutHL: .35, armRate: [3, 6], cutRate: [4.5, 20], armAhead: 1, closeLift: { from: 2.6, max: .3 },   // the arm eases in and out (≤ m/s, m/s²; a wall brings it in at cutRate, never at once); under 2.6 m it looks over the shoulder
    hold: { ahead: .4, hl: .25, backHL: .35, release: .3, cutOcc: .1, cutStuck: 1, max: 3.5, cool: 1.2 },   // a TIGHT SPACE (no room for the shortest arm at the person's pivot, now or `ahead` s on): the camera's pivot brakes onto the last spot with room (half-life) and holds, framing them; room again for `release` s → back (half-life); hidden from the hold cutOcc s with room where they are (cutStuck s without), > max m off, or back past it (they walked through a wall, on out of reach) → a cut to them (none within cool s of the last)
    body: { r: .26, cushion: .45, rWide: .13, cushionWide: .03, hl: .25, pushHL: .1, pushAcc: 15 },   // the camera's body round THIN spans (posts): motion into the cushion (m) fades out by r (m); the offset decays (half-life s); inside r: out with half-life pushHL s; rWide / cushionWide: the same round every other solid (the arm keeps .17 m off them)
    slideUndo: false, brakeAhead: .5, brakeSlack: .15,   // s: auto-motion that would bring a wall onto the arm this far ahead by more than brakeSlack m is braked (camera build 2c); the old undo (slideUndo: a velocity step) is off
    autoRate: 2.5, autoAcc: 12, autoJerk: 300,   // rad/s · rad/s² · rad/s³: the view's auto-motion limits (input is never limited)
    viewHL: .12,              // s: what those limits hold back is eased back onto the subject over this half-life (no overshoot)
    headHL: .1, flipTurn: 2, flipHold: .5,   // the heading the camera looks ahead along: eased (s); a turn over flipTurn rad only once it held flipHold s
    switchGlideMax: 25, switchHL: .15, switchT: .8,   // Tab / G / click: ≤ 25 m with a clear line glides (pivot half-life, eased back over switchT s), else a cut (10-09b: .25 / 1.2 s → .15 / .8 s: a 10 m hop settles in half the frames)
    enterMax: 160, enterT: [.8, 2.2], blendIn: .25,   // into follow from another mode: down the line of sight in parameter space (s, by distance), the rig's blend only turns the view
    orbitRate: 1.8,           // rad/s from keys
    cycleRadius: 70,          // m: Tab picks among the people this close to the one you follow
    lostWait: 1.6,            // s to wait for someone who vanished (indoors, out of range) before following the nearest
    fov: 55,
  },
  // CAMERA FADE (10-09b, camera/fade.js): walkers, cars and dogs in the camera's near zone or on the camera → subject line dissolve to
  // alpha (a 4×4 screen-door); one the camera is inside is not drawn. near: the zone (m off the body's surface; nearIn…nearAt ramps 0 → alpha,
  // inside it the body is gone) · line: m off the sight line · ramp: m over which a body comes back · walker [r, y0, y1] · car [r, y, half-length]
  fade: { on: true, alpha: .35, line: .25, ramp: .35, nearIn: .05, nearAt: .25, near: .6, walker: [.3, .3, 1.55], car: [1.0, .8, 1.5] },
  photo: {
    speed: 3.5, lookSmooth: .14, inputSmooth: .16, accelHL: .29, brakeHL: .43,   // slower, heavier: smooth pans for clips
    fovRange: [14, 100], rollStep: .9,          // deg · rad/s
    formats: {                                   // stills: [w, h] in px (null = the screen's aspect at 1× / 2×)
      'screen 1×': null, 'screen 2×': null, '4K 16:9': [3840, 2160], '9:16 reel': [2160, 3840], '4:5 feed': [2160, 2700], '1:1 square': [2160, 2160],
    },
    format: 'screen 2×',
    clipMax: 60, clipFps: 60, clipLong: 1920, clipBitrate: 16e6,   // s · fps · px (the clip's long side) · bits/s
    barHide: 2.6,             // s of no mouse movement before the photo bar fades
    focusSmooth: .25,         // s: autofocus racks over this
  },
  blend: { min: .55, max: 2.4, perMetre: 1 / 420, arc: .22, arcMax: 220 },   // hand-offs: duration (s) = min + distance × perMetre (≤ max); long hops rise in an arc
  orbit: { accel: .12, brake: .2 },             // s: WASD / Q E / R F in orbit ramp in and out (nav.js)
  wheelAxis: { px: 8, ms: 60, gapMs: 150 },   // input.js: a wheel gesture's first px (or ms) pick zoom or orbit; held until a gap of gapMs
  gamepad: { dead: .16, look: 2.4 },
  touch: { stick: 64, look: 1.6 },              // px for a full stick · look multiplier
};

const KEY = 'city.camera', OWN = { look: ['sens', 'invertY'], photo: ['format'], follow: ['viewerDist', 'viewerPitch'] };
export function loadPrefs() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v) return; for (const [s, ks] of Object.entries(OWN)) for (const k of ks) if (v[s]?.[k] !== undefined) CAM[s][k] = v[s][k]; } catch {} }
export function savePrefs() { try { const v = {}; for (const [s, ks] of Object.entries(OWN)) { v[s] = {}; for (const k of ks) v[s][k] = CAM[s][k]; } localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }
