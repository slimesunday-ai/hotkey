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
    floorY: 0,                // m: the lowest the subject's feet count for the pivot (C2: a station's stairs go under the street; the camera doesn't)
    lostWait: 1.6,            // s to wait for someone who vanished (indoors, out of range) before following the nearest
    // INDOORS (C2-camera, GAME.md §41, slime 10-31: "Rise to the cutaway"): while the agent followed is inside its home the camera rises to
    // its room's own three-quarter street-side view (interiors frameOf) and eases back down at the door. inT / outT / switchT: s of the
    // ease in at the door, out at the door, and onto another room or person (a seek or a jump further than snapFar m: at once) ·
    // holdMax: s the camera holds still for a room that isn't open yet (a seek, a reload) · ks × kp: the ease's path shapes tried (how
    // early it rises, how early its look point moves to the room): clear of solids outside the house, the person in sight; none → at once
    // (blindOk: ease even with the person out of sight a moment) · the viewer's orbit inside: yaw ± rad and
    // pitch [lo, hi] rad off the room's own view (its elevation kept within el), zoom × its distance — the outside angle and distance
    // are kept apart and come back as they were
    room: { inT: 1.5, outT: 1.3, switchT: 1, snapFar: 40, holdMax: 1.5, ks: [1, 2, 3, 5, -2, -3, -5], kp: [1, 2, -2], blindOk: false, yaw: .7, pitch: [-.45, .4], el: [.3, 1.4], zoom: [.6, 1.8] },
    fov: 55,
  },
  // CAMERA FADE (10-09b, camera/fade.js): walkers, cars and dogs in the camera's near zone or on the camera → subject line dissolve to
  // alpha (a 4×4 screen-door); one the camera is inside is not drawn. near: the zone (m off the body's surface; nearIn…nearAt ramps 0 → alpha,
  // inside it the body is gone) · line: m off the sight line · ramp: m over which a body comes back · walker [r, y0, y1] · car [r, y, half-length]
  // lineAlpha (C2-camera2): what a body on the line dissolves to (fade.js THE LINE, CLEAR: 0, gone, and out of its batch; it was alpha)
  fade: { on: true, alpha: .35, line: .25, ramp: .35, nearIn: .05, nearAt: .25, near: .6, lineAlpha: 0, walker: [.3, .3, 1.55], car: [1.0, .8, 1.5] },
  // LOCK (C2-lock, camera/lock.js, slime 11-04: "another setting just locked onto a subject and you could rotate and zoom around them
  // instead of the camera trying to avoid everything"): the viewer's angle and distance round the person, fixed to the world, carried
  // with them; nothing in the way moves the camera — it goes see-through instead (hole: gpu.js HOLE, set by fade.js).
  //   distRange · pitchRange (rad) · dist / pitch: the default arm, the viewer's own once they move it (viewerDist, viewerPitch,
  //   viewerAz: kept in this browser, so a day / night reload comes back to the same angle) · anchorH × the person's height: the point
  //   it turns round (follow's) · floor: m the lens stays above their feet · viewT: s the view turns onto them after a hand-off ·
  //   enterT: s of the glide in from far off (in parameter space, along the line to them) · switchGlideMax / switchT: a switch to someone
  //   ≤ m away with a clear line between glides over s, else the camera is at once on them · outT: s of the hand-off to follow (relative
  //   to the person) · hole: lens / at (m: the cone's radius at the lens and at the person), edge (m of soft edge), short (m short of the
  //   chest it ends), floor [lo, hi] (m over their feet where it begins), chest (m over the feet it aims at), inT / outT (s it eases in / out) ·
  //   lineBody [r, top]: m a walker's body on fade.js's line grows by while the hole is on, to what is drawn (C2-lock2: .3 + .45 = the
  //   near walkers' .75 m reach; 1.55 + .55 = 2.1 m, a head; the lock tools' body box, 3debe44) · lineAlpha: what a walker or a car on the
  //   line drops to under Lock (C2-lock2, slime 11-05 "ghost the cars, lock only": a see-through ghost on the near fade's screen-door,
  //   CAM.fade.alpha's .35 to start; Follow keeps CAM.fade.lineAlpha, 0)
  lock: { dist: 6, distRange: [1.5, 80], pitch: .3, pitchRange: [-.35, 1.5], viewerDist: null, viewerPitch: null, viewerAz: null, anchorH: .82, floor: .25,
    viewT: .45, enterT: [.6, 2.2], switchGlideMax: 25, switchT: [.4, 1], outT: .6, orbitRate: 1.8, cycleRadius: 70,
    hole: { on: true, lens: 1.0, at: 1.1, edge: .4, short: .05, floor: [.15, .4], chest: 1.25, inT: .35, outT: .4 }, lineBody: [.45, .55], lineAlpha: .35 },
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

const KEY = 'city.camera', OWN = { look: ['sens', 'invertY'], photo: ['format'], follow: ['viewerDist', 'viewerPitch'], lock: ['viewerDist', 'viewerPitch', 'viewerAz'] };
export function loadPrefs() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v) return; for (const [s, ks] of Object.entries(OWN)) for (const k of ks) if (v[s]?.[k] !== undefined) CAM[s][k] = v[s][k]; } catch {} }
export function savePrefs() { try { const v = {}; for (const [s, ks] of Object.entries(OWN)) { v[s] = {}; for (const k of ks) v[s][k] = CAM[s][k]; } localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }
