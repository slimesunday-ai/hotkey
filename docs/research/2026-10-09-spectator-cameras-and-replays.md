# Spectator cameras, replays and legible busy scenes: research for AI City (2026-10-09)

Web research plus a read of AI City's `style/city/` as of 2026-10-09. Read-only: no code was changed, no pages were run. `file:line` references are to the code as it was then.

**How to read the sources.** ✓ means I opened the page and the claim is quoted or paraphrased from it. (s) means the claim comes from a search-result summary only; I did not read the page, so treat it as weaker. (R) means it is already cited and summarised in `style/city/camera/RESEARCH.md` (2026-10-05); I don't repeat that work here. "Unknown" means I looked and could not confirm.

---

## 0. The answer in brief

1. **Most of what slime complains about has a known fix in shipped games.** The fixes are mostly about grammar (how a camera, timeline or feed should behave), not new technology. AI City already has several of the hard parts done well: exact springs, a collision world, a delayed tape, "Where's the action", beacons, and click → go → play on the timeline.
2. **The follow wobble when zooming has three likely causes in the code, besides what the camera agent already fixed.** None of them are measured yet (§1.1):
 - Any zoom input switches off the view's smoothing (`follow.js:313`).
 - The trackpad splits each scroll event between zoom and orbit on its own (`input.js:44`), so a "vertical" two-finger zoom leaks small left/right orbit kicks.
 - Look-ahead and the shoulder offset are fixed in metres, so the same noise turns into a ~2× bigger angle when zoomed in from the default 4.6 m arm to 2.2 m.
3. **"Orbit and pan while locked" is a solved pattern.** It is Cinemachine's binding modes (world-space or "lazy" orbit), plus a screen-space framing offset, plus Rockstar Editor's "lock aim to a target, move with target" (§1.2).
4. **The timeline looks empty because it shows 6 event kinds and silently drops anything past 3 markers per 6 px** (`transport.js:77`). Every good scrubber pairs a density layer with prioritised markers: YouTube's "Most replayed" graph, League's replay timeline, CS2's round markers (§2.5).
5. **The biggest gain in entertainment is an auto-director, a lean-back "TV mode".** Valve's SourceTV director is open source and gives real numbers:
 - shots last 2 s minimum, 4 s typical, 8 s maximum;
 - it looks 8 s ahead and prefers the event 2–4 s ahead, so the cut lands just before the action;
 - it needs a broadcast delay of at least 10 s to do that.

 AI City's tape is a day-late delayed broadcast, so a tape director can look ahead freely. A live director can only react to events after they happen, unless slime adds a short live delay (§1.5, §2.2).
6. **"Low res" is mostly the pipeline, not the look.** On the high preset the canvas renders at most 2 px per CSS px (the `dpr` cap), and dynamic resolution can take that down to 1.4 (0.7×). The whole post stack, including the camcorder look's chroma, runs at that size, and then the browser stretches the result with plain bilinear filtering. Dynamic resolution also only climbs back when GPU time is under 55% of budget (`quality.js:45`). The standard fix is to upscale with a sharpening filter to display size and add grain at display size (§5).

The ranked "what AI City should do" list is in **Part 2**.

---

# Part 1: the dossier

## 1. Spectator and follow cameras

### 1.1 Damping that doesn't oscillate, and the wobble

**What the field does**
- **Critically damped springs and exponential damping, exact at any dt.** These are Holden's "spring roll call", Juckett, and Unity's `SmoothDamp` (R §3.2). AI City already has them in `camera/damp.js`, so the remaining wobble is not the spring maths.
- **One controller per degree of freedom.** Nesky, "50 Game Camera Mistakes" (GDC 2014, from his Journey work; [vault](https://gdcvault.com/play/1020460/50-Camera), [list ✓](https://shermanrose.uk/knowledge/programming/games/50-game-camera-mistakes/)):
- #8 "Letting independent forces compete to push the camera."
- #16 "Shifting pitch, distance, and field-of-view independently."
- #14 "Using the same camera distance for all angles."
- #38 "Responding to accidental controller input."
- #44 "Bouncing the camera with the avatar's walk cycle."
- **Frame in screen space, not world metres.** Cinemachine's Rotation Composer ([docs ✓](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineRotationComposer.html)):
- *Screen Position* sets where the target sits in the frame.
- In the *Dead Zone*, "the camera will not adjust when the target is within this range".
- The *Soft Zone* eases the target back into the dead zone.
- *Lookahead Smoothing*: "Larger values smooth out jittery predictions and increase prediction lag."
- Because these zones are fractions of the screen, the framing behaves the same at any zoom.
- **Axis lock on two-axis gestures.** Apple's scroll view: "if the user begins dragging in one general direction (horizontally or vertically), the scroll view disables scrolling in the other direction" ([`isDirectionalLockEnabled` ✓](https://developer.apple.com/documentation/uikit/uiscrollview/isdirectionallockenabled)).

**What the code did then (2026-10-09)**

The camera agent's 10-09 fixes are in. The view tracker is open-loop (`follow.js:148-155`) and a heading flip must hold for 0.5 s (`follow.js:78-84`). Reading the code turned up three more candidates for a **left-right wobble while zooming**. None is measured; they are for the camera agent (ports 5355–5359) to test.

1. **Zooming switches off the view's smoothing.**
 - `const input = !!(dYaw || dPitch || dDist)` (`follow.js:190`).
 - Then at `:313`, `if (… input …)` puts the view straight on its target, bypassing the rate, acceleration and jerk limits.
 - A wheel or pinch zoom (`dDist`) therefore counts as "the viewer is steering". Whatever the look point does during the zoom reaches the screen 1:1: the pivot spring (xz half-life 0.06 s, so the walker's sway passes almost unfiltered), the look-ahead and the side-step.
 - The same motion is smoothed when nobody is zooming, which matches "it goes into a wobble when zooming".
 - macOS trackpad momentum keeps `dDist` non-zero for a second or so after the fingers lift.
 - *In plain terms:* the camera is steady until you scroll; scrolling takes its stabiliser off.
2. **The trackpad leaks orbit into zoom.**
 - `input.js:44` decides per wheel event: `if (|dx| > |dy|) wheelX += dx else wheel += dy`.
 - `wheelX` orbits (`follow.js:186`, 0.0031 rad/px).
 - A vertical two-finger zoom is never perfectly vertical. Small events near the start and end of the gesture can be x-dominant and become orbit kicks of about 2° per 10 px, left or right.
 - These kicks also set `orbitOff` (`:192`), so the trail then holds the jittered angle.
 - The standard fix is a per-gesture axis lock as above: decide zoom vs orbit in the first ~60 ms or ~8 px, and keep it until a ~150 ms pause.
3. **Lateral terms are in metres, so their angle grows as you zoom in.**
 - Look-ahead is ≤ 0.6 m along the eased heading (`:208-210`; `config.js` `lookAheadMax .6`, `headHL .1`). The shoulder offset is 0.3 m.
 - At the default 4.6 m arm, 0.6 m is ~7.4° of view angle. At the minimum 2.2 m arm it is ~15°, and at 42 m it is ~0.8°.
 - Any heading noise from weaving round other walkers, scaled through look-ahead, is about 2× larger on screen fully zoomed in than at the default.
 - Cinemachine-style framing in screen fractions removes this dependence.

A fourth, smaller one: the auto-trail aims at the eased *instantaneous facing* + π (`:223`), with a 0.1 s heading half-life. A walker weaving round a queue swings the trail target. Trailing the **path tangent** a few metres ahead removes this: the route geometry is known for sim agents (`movement.js` legs → `geomOf`).

### 1.2 Orbiting and panning while locked on

**What the field does**
- **Cinemachine Orbital Follow binding modes** ([docs ✓](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineOrbitalFollow.html)):
- *World Space*: "The camera will not change position when the target rotates."
- *Lazy Follow*: "emulates the action a human camera operator would take when instructed to follow a target. The camera attempts to move as little as possible to maintain the same distance."
- *Lock To Target*: "When the target rotates, the camera rotates with it."
- *Recentering* has a Wait and a Time.
- The *Radial Axis* (zoom) "scal[es] the orbits": zoom moves along a designed surface of distance and height ("Three Ring" style), not just distance.
- **Rockstar Editor, GTA V.** A free camera with a "Camera Target" option and "Move with Target" (s; [PC Gamer](https://www.pcgamer.com/gta-5-pc-director-mode/), [GTABase](https://www.gtabase.com/grand-theft-auto-v/rockstar-editor/)). You place the camera anywhere, its aim stays locked on a subject, and the offset is carried along with the subject. This is "orbit and pan while locked" in its most general form.
- **Nesky:**
- #6 "Pushing the camera away from an obstacle while the player is trying to swing the camera towards it."
- #35 "Immediately applying a camera hint after the player finished turning the camera."
- #23 "Leaving the camera yaw alone while the player is running."

The last one argues *for* trailing in a game where you steer the avatar. A spectator isn't steering, so Lazy Follow or World Space is the safer default for one.
- **Cities: Skylines.** The popular First Person Camera mod ([repo ✓](https://github.com/Asu4ni/CitiesSkylines-FPSCamera)) has Follow mode, a saved per-viewer camera offset ("press Backslash to save the current camera setting (position offset & angle) as the default"), and v2.2.0 LookAhead ("camera would look toward the position the vehicle is going to be"). Whether vanilla Cities: Skylines 1 has a built-in follow camera is **unknown**: every guide I found describes the mod. Cities: Skylines II's official camera page covers a keyframed cinematic camera, not follow ([Paradox ✓](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/cinematic-camera-photo-mode)).

**What AI City has.** Drag or a sideways swipe orbits. `orbitOff` keeps the viewer's angle relative to the trail's place behind the walker (`follow.js:85-87, 192, 223`). W/S pitches; wheel and R/F set distance.
- There is **no pan**: no framing offset, and the subject is always on the look point.
- There is **no world-space option**: the angle is always relative to the walker's heading, so a side view swings with every turn the walker makes.

### 1.3 Collision and occlusion

These are covered in depth in RESEARCH.md: Unreal SpringArm, Lyra feelers, Cinemachine Deoccluder, Nesky #9/#10 (thin occluders), Haigh-Hutchinson (R §3.1). Additions relevant to *spectating*:
- **X-ray silhouettes instead of moving the camera.** CS:GO/CS2 observers have `spec_show_xray`, which shows players' outlines through walls (s; [totalcsgo](https://totalcsgo.com/commands/specshowxray)). The survey in R §3.1 cites Mario Sunshine's silhouette and Witcher 3's dithering. For a watcher, keeping a calm shot and showing the subject through the wall often beats swinging the camera.
- **Cut, don't drag, through solids.** Nesky #17 "Not cutting when the avatar passes through opaque objects"; #46 "Rapidly transitioning to a new camera position."

### 1.4 Look-ahead and framing

- **Cinemachine.** Lookahead Time with Smoothing, and Ignore Y (✓ above). Group Framing "frame[s] one or more targets… to keep them in the frame at the desired size", with Zoom Only / Dolly Only / Dolly Then Zoom, and a Framing Size where 1 is the whole screen ([docs ✓](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineGroupFraming.html)). This is the tool for "robber + victim in one shot".
- **Itay Keren, "Scroll Back"** (GDC 2015; [article ✓](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers), [vault](https://gdcvault.com/play/1022243/Scroll-Back-The-Theory-and)):
- *camera-window*: "Push camera position as the player hits the window edge";
- *cue-focus*: "Focus is influenced by game world cues (e.g. attractors)";
- *region-based anchors*: "Different regions… set different anchors for position and focus".

For AI City: an attractor is a public event or a crowd near the followed walker that pulls the framing slightly toward it.
- **Nesky:**
- #21 "Focusing only on the avatar";
- #27 "Misusing the 'Rule of thirds'";
- #31/#32 on rotating versus translating to look at targets;
- #42 "Rapidly shifting field-of-view".

### 1.5 Auto-directors and cinematic cuts

- **Valve SourceTV/HLTV director.** The source is public ([hltvdirector.cpp ✓](https://swarm.workshop.perforce.com/files/guest/knut_wikstrom/ValveSDKCodedlls/hltvdirector.cpp); constants from `hltvdirector.h` ✓):
- `tv_delay` default **30 s**. `HLTV_MIN_DIRECTOR_DELAY 10`: "minimum delay if director is enabled". The director needs the delay because it reads the future.
- `MIN_SHOT_LENGTH 2.0`, `DEF_SHOT_LENGTH 4.0`, `MAX_SHOT_LENGTH 8.0` s.
- "search for next 4 best events within next 8 seconds", in 2-s windows. The cut rules prefer the best event in the **2–4 s window**, so the cut lands a beat before the action.
- "if the time diff to the next important event we have to switch to is too short (<2sec) just extent the current shot".
- Shot types: "view over shoulder, randomly left or right"; in-eye with a probability (more often for kills); fixed level cameras 25% of the time (`tv_allow_static_shots`).
- Valve's wiki puts the purpose of the delay plainly: the auto-director "chooses the camera mode and position based on interesting game events", and the delay "ensures that the playing teams can't use SourceTV to get any usable information about their opponents" (s; [wiki](https://developer.valvesoftware.com/wiki/SourceTV), which returned 403 to me).
- **Dota 2 directed camera:** "automatically place the camera where it thinks something interesting is happening… to give spectators a common view" ([Game Informer ✓](https://gameinformer.com/games/dota_2/b/pc/archive/2011/10/06/a-new-way-to-play-like-the-pros)). The algorithm is **unknown**; Valve hasn't documented it as far as I found.
- **League of Legends spectator (2012):** "a directed camera mode that will automatically follow the action", which prioritises champion kills and widens to fit several champions. It shipped with timeshift: "jump around the timeline of a live game to watch past events", slow motion, fast forward ([patch notes ✓](https://www.surrenderat20.net/2012/05/spectator-mode-patch-notes.html)).
- **Cities: Skylines FPS Camera mod, "Walk-Through mode":** "the camera randomly follows any peoples or vehicles in the city", switching when the target disappears or on click ([wiki ✓](https://github.com/Asu4ni/CitiesSkylines-FPSCamera/wiki)). This is the ambient channel-surf for a city.
- **Left 4 Dead's AI Director** paces drama, not cameras, but the rhythm transfers (Booth, Valve; [slides ✓](https://www.readkong.com/page/the-ai-systems-of-left-4-dead-michael-booth-valve-9664541)):
- Build Up "until Survivor Intensity crosses peak threshold";
- Sustain Peak "3-5 seconds";
- Relax "30-45 seconds";
- it spawns only where "not visible by the Survivor team".
- **Nesky:**
- #20 "Violating the 180 degree rule" (cut between two shots of a robbery from the same side of the robber–victim line);
- #22 "Relying on players to control the camera all the time";
- #34 "Giving the player control over the camera, and then taking it away".
- **GTA V's in-vehicle cinematic camera:** how it picks angles is **unknown** (no primary source found).

**What AI City has.** No director. The stage plays events only near the camera ("Off screen only the lasting aftermath is staged", `stage/index.js` header), so a live viewer who is looking elsewhere misses every robbery. "Where's the action" (`.`, `ui/menu/action.js`) is a manual jump, the same idea as StarCraft II's Space (§3.3).

---

## 2. Replays and timelines

### 2.1 Instant replay vs time travel

- **Time travel**, where the whole world is moved to time t:
- CS/Dota demos;
- League's timeshift on a live game (✓ above);
- Overwatch replays: "first-person, third-person, or a bird's eye view", speed control, kept for the patch's lifetime ([Blizzard ✓](https://overwatch.blizzard.com/it-it/news/23000187/introducing-overwatch-replays-see-your-past-games-from-new-perspectives/)).

AI City's TAPE is this: the city is re-driven at the tape time (`ui/tape/map.js`), with the lighting and traffic taken from live.
- **Instant replay**, a short re-showing of one moment while the live world keeps going:
- **Overwatch's kill cam.** Orwig, "Replay Technology in Overwatch: Kill Cam, Gameplay, and Highlights" (GDC 2017; [vault ✓](https://gdcvault.com/play/1024053/Replay-Technology-in-Overwatch-Kill)). The talk covers building replay "in parallel with your network model", making reels "within a hard respawn deadline", and refactoring the client "to support an interruptible kill cam". How it was built is behind the Vault paywall: **unknown in detail**.
- **TV's original.** Tony Verna, CBS, Army–Navy, 7 Dec 1963 ([DGA ✓](https://www.dga.org/News/Guild-News/2013/December-2013/InstantReplay50th), [Wikipedia ✓](https://en.wikipedia.org/wiki/Instant_replay)). The first replay needed a spoken label. Lindsey Nelson: "This is not live! Ladies and gentlemen, Army did not score again!" ([ESPN ✓](https://www.espn.com/ncf/s/1999/1203/210215.html)). The lesson still holds: **a replay must announce itself.**

For AI City the two are not either/or. The timeline agent's option list (1) for slime, "time-travel (built) vs an instant replay re-staged while the city stays live (~a day)", is really asking which one to add *on top*. Instant replay serves **LIVE** viewers who missed a public event. Time travel serves **TAPE**.

### 2.2 Delay as a privacy tool

SourceTV's `tv_delay` exists so that "the playing teams can't use SourceTV to get any usable information" (s, above). AI City's tape horizon (now − one game day) is the same mechanism, built for the same reason: watchers must not learn private things in time to act on them.

One consequence follows: **a director that looks ahead is safe only on the delayed feed.** On LIVE, cutting to a place *before* a public event happens would tell viewers something a street witness couldn't know yet. Owners could use that to tip off their agents. So a live director must react to events after they happen. The alternative is to put LIVE itself on a short delay (≥ 10 s, as SourceTV requires for its director); that is a decision for slime.

### 2.3 Kill cams and highlights

- Overwatch frames kill cams as "help you understand how your hero died", and Highlights and Play of the Game as "celebrate individual prowess" (GDC abstract ✓). How Play of the Game is scored: GameSpot and Dot Esports returned 403 to me, so it is **unverified**.
- The AI City version is a **YOURS kill cam**. When *your* agent is robbed, offer a replay from its point of view with the robber shown. This is consistent with lens rule 3 (`simstate/lens.js:44-45`): "The victim's owner sees the robber live (the victim was there)".
- Rocket League's Replay FX added "filters, focus points, vignettes, and greenscreen" to replays (s; [Psyonix](https://www.rocketleague.com/news/the-making-of-replay-fx)). Rocket League's replay-viewer specifics (skip sizes, timeline) are **unknown**: I found no official page.

### 2.4 Sports replay grammar

World Rugby's TMO operator guide is a primary source on how a replay operator works ([✓](https://passport.world.rugby/match-day-staff/television-match-official-tmo-operator/3-what-you-do-and-how-you-do-it/technical-and-operations/system-techniques/)):
- *Looping*: "Replaying either the same angle or a different angle but starting at the same point each time".
- *Split screens*: "Playing two angles next to each other in sync".
- *Bookmarks*: "time stamps… so that 'marks' can be held".
- Three speeds: slow for detail, real time for intent, medium for flow.

I found no primary source for the TV conventions of "wide first, then tight" angle order or a logo wipe into and out of a replay. The stinger and wipe convention is easy to see in any broadcast, but the rule set is **unknown** to me.

### 2.5 Event markers and density on a timeline

- **YouTube "Most replayed"** (2022): "this subtle gray graph… If the graph is high, then that part of the video has been replayed often". **Chapters** "allow users to jump forward to a particular section" ([TechCrunch ✓](https://techcrunch.com/2022/05/18/youtubes-player-gains-new-features-including-most-replayed-video-chapters-single-loop-and-more)). A density layer makes a scrubber read as full even when markers are sparse.
- **League replays:** lock onto a champion and "the marks on the timeline for their kills gets a little brighter, while all the other landmarks fade back" ([Riot ✓](https://support.riotgames.com/en-us/league-of-legends/gameplay/replays-faq-pro-tips)). The markers follow whoever you are watching.
- **CS2 demo UI** (Shift+F2): timeline, round markers, round-step and ±15 s buttons (s; [csdb](https://csdb.gg/guides/demo-guide/), [ONE Esports](https://www.oneesports.gg/counter-strike-2/cs2-replay-controls-guide-demo); secondary).
- **Football Manager's highlight levels**, from least to most: Only Commentary, Key, Extended, Comprehensive, Full Match (s; [GGRecon](https://ggrecon.com/guides/football-manager-2024-change-highlights)). The viewer picks how much of the quiet time to skip. This is the closest analogue for "watch yesterday in five minutes".
- **Map label placement**, applied to markers. Mapbox: "Collision detection is the process of preventing labels on a map from overlapping each other". `symbol-sort-key` decides who wins a contested slot ([✓](https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement/)).

**What AI City has** (`ui/tape/transport.js`):
- Six marker kinds (`:19`).
- Up to 3 dots per 6-px cell, stacked. The 4th and later are dropped silently, with no "+N" (`:77`).
- No density layer, no zoom on the time axis, no per-subject emphasis.
- The timeline agent counted 56 markers out of 1,737 events in the test run.
- Good already: marker click → seek 2.5 s before → fly → play at ≤ 4× (`ui/tape/index.js:118-178`). That is the SourceTV 2–4 s pre-roll in spirit.

---

## 3. Legibility in crowded scenes

### 3.1 Name tags and level of detail

- **Generative Agents** (Park et al. 2023, the closest precedent: LLM citizens in a watched town; [paper ✓](https://arxiv.org/abs/2304.03442)): each action "is displayed on the sandbox interface as a set of emojis… above each avatar's head in a speech bubble… The complete natural language description of the action can be accessed by clicking on the agent's avatar." The pattern is a glyph at a glance and the full sentence on click.
- **The Sims:**
- the plumbob marks the selected Sim and shows its mood (s; [Sims wiki](https://sims.fandom.com/wiki/Plumbob));
- thought bubbles carry needs and wants as icons (s; 205 extracted icons, [SimsCommunity](https://simscommunity.info/2014/10/10/sims-4-205-thoughtspeech-bubble-icons/)).
- **Map label rules** (✓ above): placement with collision detection, a priority key, and several candidate anchors per label.

**What AI City has** (`ui/city.js:63-98`):
- Pins over every drawn agent within 520 m. Crowds within 20 px merge into a count (`CLUSTER = 20`, `:13`).
- The name label shows only on hover and on the followed agent.
- Rings are depth-tested, but **the DOM pins are not occlusion-tested**: a pin for someone behind a building floats over the building looking the same as one in plain view.
- No per-agent "now" glyph on LIVE. TAPE has thought bubbles (`ui/tape/bubbles.js`).

### 3.2 Outlines and highlights

CS2's x-ray (§1.3) and the silhouette and dither survey (R §3.1) are the references. Spectator tools outline the *subject* through walls rather than every person. Note the privacy edge: the outline must stop where the lens stops (Part 2, item 11).

### 3.3 Event feeds and notifications

- **RimWorld letters** ([wiki ✓](https://rimworldwiki.com/wiki/Events)):
- "Blue envelopes: Good… Grey: Neutral… Yellow: Bad… Red: Direct threats";
- "Clicking the envelope icon offers the option to jump to the center point".
- **RimWorld's colonist bar** ([UI ✓](https://rimworldwiki.com/wiki/User_interface)): a permanent row of the people you care about. "Left-click jumps to a colonist on their local map".
- **StarCraft II** ([Blizzard ✓](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control)): "press the Space Bar to center the screen on the location of the last transmission". Pressing again cycles back through up to 8. AI City's `.` and `,` are this already.
- **Dwarf Fortress 50.10** (Steam, Sep 2023; [release notes ✓](https://www.catsplode.com/index.php/Release_information/50.10)) added "view all alerts, including old ones that have been dismissed". Players asked for it because a dismissed alert was gone for good.
- **Cities: Skylines' Chirper:** a game option turns off "Auto-open Chirper messages" (s; Steam). The ChirpFilter mod "removes every line not associated with the state of your city" ([CGM ✓](https://www.cgmagonline.com/articles/features/best-mods-for-cities-skylines/)). The lesson: an ambient feed must be filterable down to what matters.
- **Frostpunk 2's "Zoom Stories"** let players "zoom in to specific city parts that allow you to watch the day-to-day life of your citizens" ([GamingBolt ✓](https://gamingbolt.com/frostpunk-2-gameplay-improvements-new-ui-features-and-zoom-stories-detailed)). They were added at the post-beta delay; press reports tie them to beta players' lack of connection to individual citizens (s). Even a systems-first city needs a way down to one person.

**What AI City has:**
- The ticker crawl (always on, click to go). City TV. The action card (`.`/`,`, newest first).
- No persistent, severity-coded stack you can work through. No history of what you dismissed. No "replay" button on a story.

### 3.4 The minimap

- **Overwatch League Replay Viewer** ([Blizzard ✓](https://overwatch.blizzard.com/en-us/news/23013835/overwatch-league-replay-viewer-see-matches-from-a-new-perspective/)):
- a map overlay (Ctrl+I) with hero status;
- "Snap to the objective" (0);
- camera bookmarks Ctrl+1–9 to save and 1–9 to restore.
- **Esports dashboards research.** Charleer et al., "Real-Time Dashboards to Support eSports Spectating" (CHI PLAY 2018, LoL and CS:GO, 788 survey responses, 18 evaluators; s; [KU Leuven](https://lirias.kuleuven.be/retrieve/515432)). Their detailed findings are **unread** by me.

**What AI City has.** A full-screen paper map (B) with places, pins, stamps, trails, heat and "Go there". There is **no always-on minimap or compass**, so orientation in 3D depends on recognising streets.

---

## 4. Navigation

### 4.1 Go-to transitions

- **van Wijk & Nuij, "Smooth and efficient zooming and panning"** (InfoVis 2003 Best Paper; [TVCG intro ✓](https://bib.dbvis.de/uploadedFiles/123.pdf)) gives the optimal pan-and-zoom path: rise, travel, descend. d3 implements it ([interpolateZoom ✓](https://d3js.org/d3-interpolate/zoom)):
- "The default curvature is sqrt(2)";
- the duration "is based on the path length of the curved trajectory".
- **GTA V's character switch:** "The camera will zoom out, presenting a Google Earth-style overview of the city, and then seamlessly go into the role of the other character" ([Destructoid ✓](https://www.destructoid.com/grand-theft-auto-vs-character-switch-system-is-nuts/)). That it was built to hide streaming is a common claim, but I found no Rockstar statement: **unknown**.
- **Nesky:**
- #46 "Rapidly transitioning to a new camera position";
- #18 "Letting cuts remap directional controls";
- #30 "Letting players make themselves lost and confused".

**What AI City has:**
- Near (< 600 m): the rig eases in orbit (`ui/goto.js:44-50`), with an arc of 0.22 × distance, capped at 220 m (`config.js:72`).
- Far: a cut behind the load-in.
- The cut is honest about streaming, but it removes the sense of *where* you went.

### 4.2 Bookmarks

- Overwatch League viewer: Ctrl+1–9 / 1–9 (✓ above).
- StarCraft II: Ctrl+F5–F8 to save and F5–F8 to recall (s; [Blizzard](https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls)).
- The FPS Camera mod saves a preferred follow offset per viewer (✓).

AI City has stars on agents, and follow's own Shift-Tab history (`follow.js:169, 325`). There are no saved views or places, and no back/forward for camera jumps.

### 4.3 Search and chains of events

- **Crusader Kings III** "Tooltips in Tooltips": highlighted terms inside tooltips open further tooltips, so the player can follow a chain of names and terms as deep as they like (s; [PCGamesN](https://www.pcgamesn.com/victoria-3/nested-tooltip-system)). Later Paradox titles adopted it.
- **RimWorld's colonist bar** (✓ above) is a one-click jump to anyone you care about.
- **AI City's People search** (`/`) covers agents only. Places, streets and events aren't searchable. @handles are links in the ticker and the dossier, but events don't link to "what happened next".

---

## 5. "Low res": dynamic resolution practice vs what the code does

**Practice**
- **Intel, Binks, "Dynamic Resolution Rendering".** Render the 3D scene to a smaller viewport, then scale to the back buffer. Per-pixel cost dominates modern frames, so GPU time scales roughly with pixel count (s; [Intel PDF](https://www.intel.com/content/dam/develop/external/us/en/documents/dynamicresolutionrendering-183334.pdf)).
- **Unreal** ([docs ✓](https://dev.epicgames.com/documentation/en-us/unreal-engine/dynamic-resolution-in-unreal-engine)): `r.DynamicRes.FrameTimeBudget` (default 33.3 ms), `r.DynamicRes.MinScreenPercentage` (default 50), and a GPU *headroom* percentage. The upscale goes through its temporal upscaler (TSR). I could not confirm the headroom default from the page: **unknown**.
- **AMD FSR 1** is two passes, EASU (edge-adaptive upscale) and RCAS (contrast-adaptive sharpen). It is a spatial upscaler, so it suits a WebGL post chain with no motion vectors (s; [GPUOpen repo](https://github.com/GPUOpen-Effects/FidelityFX-FSR)).

**The code** (`quality.js`, `render/post.js`, `main.js:69`)
- The `high` preset caps DPR at 2 with `minScale .7`. `medium` caps at **1.5**, with `minScale .6` (`quality.js:13-15`).
- On a 2× Retina screen, medium never exceeds 75% of the physical pixels per axis, and can go to 45%.
- On high it can go to 70% per axis, about 49% of the pixels.
- The scene render target and every post pass are sized to the drawing buffer (`post.js:79-83`). The camcorder look's chroma, bloom and sharpen therefore all run at the reduced size, and the browser stretches the canvas with bilinear filtering. The CSS grain overlay (`post.js:50-57`, index.html `.grain`) is the one texture at native size.
- Drop rule: GPU average over 20 frames above the 15.5 ms budget → −0.1.
- Climb rule: average over 60 frames **< 55% of budget (8.5 ms)** → +0.05 (`quality.js:45-47`).
- With GPU at 9–12 ms at 0.7×, the next step (0.75×) is predicted at 9–12 × (0.75/0.7)² ≈ 10.3–13.8 ms. That is under budget, but the rule never tries it.
- This matches an earlier project note that dynamic resolution "can fall to 0.7× and never climb back".
- *In plain terms:* the city is drawn at about half the screen's pixels and then stretched. The rule that would raise it back waits for a calm that rarely comes.

---

## 6. Already matching best practice

These are worth keeping:
- **Exact, frame-rate-independent damping:** springs and limits with an open-loop view tracker (`damp.js`, `follow.js:148-155`).
- **Thin occluders separated from walls** (Nesky #9/#10), plus a sphere-swept arm and a tight-space hold.
- **The tape horizon**, the SourceTV delay idea applied to privacy, enforced in three places (TAPE.md "The rule").
- **Marker click → seek 2.5 s early → fly → play ≤ 4×** (`ui/tape/index.js:118-178`). This is the pre-roll grammar.
- **`.`/`,` "Where's the action"**, StarCraft II's last-alert cycle.
- **Beacons** (`ui/menu/beacon.js`): edge-pinned off-screen indicators with distance, and rule 5 shown as a dashed "somewhere in…" marker.
- **The TAPE frame and lens badges**, Lindsey Nelson's "this is not live" turned into UI.

## 7. Not found / unknown

- An Insomniac Games camera talk. I found Insomniac animation and lighting talks, but no camera-design talk.
- How Dota 2's directed camera chooses fights.
- How GTA V's cinematic camera chooses vehicle angles.
- Whether GTA V's switch camera masks streaming, per Rockstar.
- How the Overwatch kill cam was built (behind the Vault paywall).
- Rocket League's replay viewer specifics.
- Whether vanilla Cities: Skylines 1 has a follow camera.
- Unreal's headroom default.
- The TV rules for replay angle order and wipes.

---

# Part 2: what AI City should do (ranked)

**How I ranked:** slime's live complaints first (camera, timeline, low res), then entertainment per unit of effort, then navigation polish.

**Size:**
- **S:** a few hours for one agent.
- **M:** about one agent-day.
- **L:** 2–4 agent-days or several agents.

**Privacy** means the LIVE rule: viewers see only what a street witness could; everything else waits for the tape.

| # | Do this | What a viewer notices | Size | Privacy |
|---|---|---|---|---|
| 1 | Follow: zoom never removes smoothing; trackpad axis lock; framing in screen fractions | Zooming in on someone is steady; no left-right shimmy | S–M | none |
| 2 | Follow: orbit modes (lazy / world / behind) + pan offset + path-tangent trail | Swing round a person and it stays put; nudge the framing; the camera stops swaying when they weave | M | none |
| 3 | A timeline that's never empty: density strip + prioritised markers with "+N" + subject emphasis + day chapters + live public stamps in the wall | The bar reads like a city's day; the busy hours jump out | M | density/markers on LIVE from public events only; TAPE may use the cut |
| 4 | Fix "low res" in the pipeline: upscale + sharpen to native, look textures at native, a cost-predicted climb | Crisp edges, readable signs; the camcorder softness stays but looks intended | M | none |
| 5 | Highlights playback on the tape (Key / Extended / Full) | "Watch yesterday in 5 minutes": skips the quiet, slows for every robbery, flies to each | M | TAPE only (fine) |
| 6 | An auto-director "TV mode" (CH 9 LIVE / CH 9 TAPE) with a SourceTV-style shot grammar | Lean back and the city cuts to what matters, with a rhythm | L | LIVE: reactive, public events only, no pre-cut; TAPE: look-ahead allowed |
| 7 | Event shots that obey the 180° rule and frame everyone involved | Robberies read in one shot; cuts don't flip sides | S–M | LIVE unseen robbery: frame the victim only |
| 8 | A notification rail ("letters") with severity, Go / Replay, and a history | Nothing important slips by; one click to see it | S–M | LIVE public events only |
| 9 | Instant replay for missed LIVE public events + a YOURS kill cam | "I missed it": press ▶ and see it staged | L | public events only; YOURS shows the robber per rule 3 |
| 10 | Far go-to as a map hop (zoom out → paper map → zoom in); near hops on the van Wijk curve | You see where you're going; long jumps aren't blind cuts | M | none |
| 11 | Legible crowds: pin priority and collision, an occluded-pin style, a public "now" glyph, a subject marker and x-ray | You can tell who's who and who's behind the wall | M | glyph from the lens's public `act`; x-ray only for the followed subject and never inside someone else's lot |
| 12 | Back / forward camera history + saved views | Never lost after a jump; return to a favourite corner in one key | S | none (places) |
| 13 | A corner minimap / compass in paper style | Always know where you are and where the action is | M | the same lens as the paper map |
| 14 | Follow's lost-subject beat: "went into Sunny Acres · out of sight" | No silent switch to a stranger | S | reinforces rule 5 |
| 15 | Chains: every event card links before/after; search for places, streets and events | Follow a story from the robbery to the arrest | M | LIVE links through public events only (an unseen robber is never linked) |
| 16 | *slime's call:* a short LIVE broadcast delay (10–30 s) | LIVE can pre-cut like TV; owners can't tip agents off | L | improves it (anti-ghosting); costs "liveness" |

### 1. Follow: steady zoom (wobble)
- **What changes:**
- Only yaw and pitch input bypasses the view limiter; zoom (`dDist`) stays smoothed. Change `follow.js:190/313` to use `dYaw || dPitch` there, keeping `idle`'s reset on any input.
- Add a **per-gesture axis lock** in `camera/input.js:42-44`. Accumulate |dx| and |dy| for ~60 ms or ~8 px, lock zoom or orbit until a ~150 ms gap, and treat `ctrlKey` (pinch) as zoom always.
- Express look-ahead and shoulder as **screen fractions** (dead zone and soft zone as in Cinemachine), or scale them by arm/dist. Then their on-screen angle doesn't double when zoomed in.
- **Evidence:** §1.1; Nesky #8/#16/#38; Apple directional lock; Cinemachine composer.
- **Where:** `camera/follow.js`, `camera/input.js`, `camera/config.js`. **Coordinate with the running camera agent (ports 5355–5359).** These are code-read hypotheses: measure first, e.g. view-yaw jitter during a scripted wheel zoom, with and without trackpad-style dx noise.
- **Size:** S–M.

### 2. Follow: orbit and pan while locked
- **What changes:**
- **Orbit binding**, a setting with three values:
  - *Lazy*: the angle stays in world space and drifts behind only after a long idle. This is the spectator default.
  - *World*: never drifts.
  - *Behind*: today's trail, game-style.
- **Pan:** right- or middle-drag shifts the subject's screen position within ±0.25 of the frame, as Cinemachine's Screen Position does. Double-click recentres. Store it like `orbitOff`.
- **Zoom rail:** one wheel axis drives distance, pitch and FOV along a designed curve (Cinemachine's Radial Axis over Three Ring; Nesky #14/#16). Close in, it is lower and wider; far out, higher and tighter. A 10-05 project note already wants "a higher follow camera (~3–4 m, slight down-look)".
- **Trail the path tangent** 3–5 m ahead from the leg geometry when it is known (`simstate/movement.js`), with a heading dead zone (~20°) instead of the 0.1-s-eased facing.
- **Evidence:** §1.2.
- **Where:** `camera/follow.js` (`orbitOff`, `camAt`, `track`), `config.js`, `camera/hud.js` (the indicator line and `?` help), KEYS.md.
- **Size:** M.

### 3. A timeline that's never empty
- **Density strip:** a thin histogram of *all* events per 10 game minutes under the markers, like YouTube's Most replayed. On LIVE, use public events only. On TAPE, use the director's cut, with private kinds tinted in the tape colour.
- **Markers by priority:**
- Widen the kinds: burglary, warrant, bounty, hospital, deal (TAPE), crew moves.
- Give each kind a sort key, so a death beats a burglary.
- When a 6-px cell is full, draw a "+N" bubble instead of dropping silently (`transport.js:77`). Hovering it lists the events.
- **Subject emphasis:** while following or with a dossier open, that agent's markers brighten and the others fade (League).
- **Day chapters:** labelled spans such as "06:00 rent", "rush hour", "night", like YouTube chapters.
- **Zoom the time axis:** wheel over the track zooms in with an overview strip above, so a busy hour is clickable.
- **Live stamps in the horizon wall:** the timeline agent's option (3). Public LIVE events can be stamped past the horizon (privacy-safe: they're public). Clicking one leaves TAPE and goes there live.
- **Evidence:** §2.5. This extends the timeline agent's option (3).
- **Where:** `ui/tape/transport.js`, `simstate/tapeplay.js` (markers), `ui/tape/state.js` (`timeline.layer` already exists for a density layer), `tape.css`.
- **Size:** M.

### 4. Fix "low res" in the pipeline
- **What changes:**
- Keep dynamic resolution for the **scene**, and add an **upscale pass to native drawing size**: FSR1-style EASU + RCAS, or bilinear + CAS-style sharpen.
- Run the camcorder look's grain, chroma offset (in *display* px) and scanline-type passes **after** the upscale.
- Climb with a **predicted cost**: step up when `g·(s'/s)²` is below ~85% of budget, not when `g` is below 55%.
- Revisit the medium `dpr: 1.5` cap on 2× screens.
- First, confirm in slime's browser which preset auto picks. The regex `m\d+ (max|ultra)` relies on Chrome exposing the GPU name.
- **Taste note:** the softness of Camcorder '98 is slime's own look and should stay; this makes it *deliberate* rather than resampling blur.
- **Evidence:** §5.
- **Where:** `quality.js:30-48`, `render/post.js:75-90`, `main.js:69, 279`.
- **Size:** M. Check with a contact sheet at 0.7× before and after.

### 5. Highlights playback on the tape
- **What changes:**
- A "Highlights: Key · Extended · Full" control on the transport:
  - *Key* chains `goToEvent` over the top-priority markers;
  - *Extended* adds the second tier and runs 60× between them;
  - *Full* is today.
- Each stop uses the existing 2.5 s lead and ≤ 4× play, then L4D-style "relax": hold a wide shot for a beat before the next hop.
- The clip exporter (`ui/clip.js`) can then record the run as a daily reel, "Play of the day".
- **Evidence:** Football Manager's levels, League's timeshift, Overwatch Highlights (§2.3, §2.5).
- **Where:** `ui/tape/index.js` (a queue around `goToEvent`/`stepVisit`), `transport.js`.
- **Size:** M. **Privacy:** TAPE only, so it is fine.

### 6. An auto-director, "TV mode"
- **The shot grammar,** taken from SourceTV:
- shots of min 2 s, typical 4 s, max 8 s;
- a candidate list of events scored by kind (death > shooting > robbery > arrest > burglary > deal > crowd);
- shot types: establishing wide (the `eventShot` 26 m / 120 m logic), over-the-shoulder follow of the victim (or the robber when seen), and an occasional fixed "street camera" (`views.js` has rule-based street cameras).
- **Pacing,** from Left 4 Dead: after a peak, 30–45 s of "relax", meaning a walk-through follow of an ordinary citizen (the Cities: Skylines FPS Camera mod's Walk-Through), so the city breathes.
- **LIVE** reacts to public events (`sim.on('event')` through the lens). It cuts to the aftermath or to the people still on the street, and never anticipates.
- **TAPE** can look ahead 8 s like SourceTV and pre-roll 2–4 s.
- **Branding:** it could literally be **CH 9 LIVE** and **CH 9 TAPE**: City TV already exists (`ui/city-info/tv.js`).
- **Evidence:** §1.5, §2.2.
- **Where:**
- a new `camera/director.js`, registered as a rig controller (`rig.register`, `rig.js:188`, the WALK hook pattern) or driving orbit and follow;
- the stage must be in view to play the scene, which the director guarantees;
- a menu entry and a key (a free key from KEYS.md: **Y**).
- **Size:** L.
- **Privacy:**
- LIVE uses only public events and never pre-cuts.
- A coarse (rule 5) agent is framed only as a wide district shot.
- An unseen robbery shows the victim, never a robber.

### 7. Event shots with grammar
- **What changes:**
- In `ui/tape/index.js` `eventShot` (`:142-160`), choose the azimuth **perpendicular to the actors' line** (robber→victim, cop→target): side-on, as the stage already places the shooter. Keep to the same side across consecutive cuts (the 180° rule, Nesky #20).
- Size the distance to frame all actors (Cinemachine Group Framing, Framing Size ~0.5), instead of a fixed 26 m.
- **Where:** `ui/tape/index.js`; shared with the director (#6).
- **Size:** S–M.
- **Privacy:** on LIVE an unseen robbery has no robber, so the group is the victim alone.

### 8. A notification rail ("letters")
- **What changes:**
- A short stack at the right edge. Each item has:
  - a severity colour, RimWorld-style: blue good, grey neutral, yellow bad, red violent;
  - **Go**, which uses `goto.js`;
  - **Replay**, which uses #9 when built, or opens the tape at the event;
  - a dismiss.
- **History** keeps the dismissed items (Dwarf Fortress 50.10).
- **Filters:** a ChirpFilter-style "only what changes the city" default.
- **Keys:** `.`/`,` already cycle; show the key on the rail like StarCraft II's Space.
- **Evidence:** §3.3.
- **Where:** `ui/city-info/feed.js` (news weighting exists), `ui/menu/action.js` (the action model), a new rail module in `ui/city-info/`.
- **Size:** S–M.
- **Privacy:** LIVE uses `sim.events()` (already lensed); tape-only stories stay TAPE.

### 9. Instant replay on LIVE + a YOURS kill cam
- **What changes:**
- When a public event is staged off-screen (aftermath only), the rail item offers **▶ Replay**. The camera goes there, a "REPLAY" sting and badge show (the Lindsey Nelson lesson), and the stage re-runs the vignette with the actors' looks while the live city continues. The robber's body is used only if the event is seen.
- **YOURS kill cam:** if *your* agent is robbed, replay it from its point of view (or over the shoulder), robber named.
- **Evidence:** §2.1, §2.3. This is option (1) of the timeline agent, which estimated ~a day.
- **Where:** `stage/index.js` and `stage/vignettes.js` (re-stage hooks), `ui/tape/index.js` (visit flow), the rail (#8).
- **Size:** L.
- **Privacy:**
- LIVE replays only public events, and an unseen robbery stays robber-less.
- The YOURS kill cam is allowed by rule 3 ("the victim's owner sees the robber live"). For a burglary, only when CCTV fires or the victim woke (rule 2).

### 10. Far go-to as a map hop; near hops on the optimal curve
- **Near (< 600 m):** replace the 0.22 × distance arc with van Wijk's curve. Rise in proportion to distance with ρ ≈ √2, and set the duration from the path length (d3's `interpolateZoom` maths; `camera/rig.js` blend + `config.js:72`).
- **Far (> 600 m):** GTA V's switch camera on the paper map.
1. Pull up to a high oblique view.
2. Cross-fade into the paper map at that spot (`ui/map/index.js` `focus()`).
3. Animate the map pan to the destination.
4. Cross-fade back into 3D at the destination once the load-in is done.

The wait becomes a legible "travel" beat instead of a blind cut.
- **Where:** `ui/goto.js:44-50`, `camera/rig.js`, `ui/map/index.js`.
- **Size:** M.

### 11. Legible crowds
- **Priority labels:**
- Rank pins: followed > hovered > wanted > yours > starred > crew > locals.
- Place labels with collision (Mapbox): the top N get names, the rest get dots, crowds get counts.
- Re-evaluate in the existing ≤ 4 Hz batch (`ui/city.js:91`).
- **Occluded style:** a `world.ray` from the camera to each pinned head at 4 Hz. About 24 agents × ~15 µs is under 0.5 ms, by RESEARCH's §4.2 cost targets. Pins behind solids draw hollow and dim.
- **"Now" glyph:** a small icon over each agent from its public act (deal, patrol, work, wait, travel mode), the full sentence on hover or click (Generative Agents; Sims thought icons).
- **Subject marker:** a plumbob-like mark over the followed one, plus an x-ray silhouette when occluded (CS2).
- **Where:** `ui/city.js`, `ui/kit.css`, an outline pass in render.
- **Size:** M.
- **Privacy:**
- The glyph must come from the lens's public card (`act` is nulled by rule 5 at someone else's lot), never from TAPE data while LIVE.
- The x-ray is limited to the followed subject, and switched off when the subject is coarse or indoors at a lot that isn't theirs.

### 12. Back / forward + saved views
- **What changes:**
- Every Go-to, visit, follow switch and map "Go there" pushes `{mode, pose, subject}`. **Backspace / Shift+Backspace** walk the history (Nesky #30). Avoid Alt+←: it is the browser's Back on Windows and Linux.
- **Saved views:** Shift+6–9 saves, 6–9 recalls. These keys are free per KEYS.md, and 0–5 are the camera's. Saved views also appear on the paper map as pins. Avoid Ctrl/Cmd+digit: the browser uses it for tab switching.
- **Evidence:** §4.2.
- **Where:** `camera/rig.js` (one history), `ui/goto.js`, KEYS.md.
- **Size:** S.

### 13. A corner minimap or compass
- **What changes:** a small paper-style inset showing the view cone, the followed subject, beacons and fresh public event stamps. Click it to go there; drag to look around without moving. Collapsible.
- **Evidence:** Overwatch League's map overlay; esports spectator research (§3.4).
- **Where:** `ui/map/` can render a cropped `paper.js` sheet; it docks bottom-left above the ticker.
- **Size:** M.
- **Privacy:** the same lens as the paper map (public pins and stamps).

### 14. Follow's lost-subject beat
- **What changes:**
- When the followed agent goes out of sight (indoors, or a coarse leg at a lot that isn't theirs), hold a wide shot of the district edge.
- Show a card such as "@x went into Sunny Acres · out of sight", with **Wait** / **Next agent** / **Nearest walker**.
- Today, after `lostWait` 1.6 s it silently follows the nearest walker within 120 m (`follow.js:180`), so the viewer ends up following a stranger without being told.
- **Where:** `camera/follow.js:179-180`, `camera/hud.js`.
- **Size:** S.
- **Privacy:** it reinforces rule 5 (district only, no metres).

### 15. Chains and search
- **Chains:** event cards (rail, action card, map card, dossier rap sheet) get **Before / After** links:
- the robber's next public event;
- the arrest that names them;
- the victim's hospital trip.
On TAPE the chain uses the director's cut.
- **Nested hovers:** CK3-style nested hovers on @handles and places.
- **Search:** extend People's `/` search to places, streets and events: "jay & 1st", "robbery yesterday".
- **Where:** `ui/people/index.js` (search), `ui/menu/action.js`, `ui/dossier.js`, `ui/map/index.js`.
- **Size:** M.
- **Privacy:** LIVE chains walk only public events, so an unseen robbery or a burglary is never linked to its culprit; tape-only links appear only in TAPE.

### 16. *(slime's call)* A short LIVE delay
- **What it is:** run the LIVE view 10–30 s behind the sim (SourceTV requires ≥ 10 s for its director), buffering `/state` and `/events`.
- **Gain:** the live director (#6) can pre-cut and catch every robbery from the start, and no viewer can ever tip an agent off in real time (anti-ghosting).
- **Cost:** "live" is slightly behind. Owner tools (the owner phone) would need either their own undelayed lens or the same delay. This is a product decision, not a technical one.
- **Where:** `simstate/feed.js`/`storefeed.js` (buffer), `simstate/simclock.js` (offset).
- **Size:** L.

---

## Sources

The full list, grouped by topic, is linked inline above. The strongest primary sources:
- Valve's director source ([cpp](https://swarm.workshop.perforce.com/files/guest/knut_wikstrom/ValveSDKCodedlls/hltvdirector.cpp)).
- Cinemachine docs: [Orbital Follow](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineOrbitalFollow.html), [Rotation Composer](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineRotationComposer.html), [Group Framing](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachineGroupFraming.html).
- Nesky's [50 mistakes](https://gdcvault.com/play/1020460/50-Camera).
- Keren's [Scroll Back](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers).
- Booth's [L4D AI](https://www.readkong.com/page/the-ai-systems-of-left-4-dead-michael-booth-valve-9664541).
- Orwig's [Overwatch replay talk](https://gdcvault.com/play/1024053/Replay-Technology-in-Overwatch-Kill).
- The [Generative Agents paper](https://arxiv.org/abs/2304.03442).
- The [RimWorld wiki](https://rimworldwiki.com/wiki/Events).
- Blizzard's [StarCraft II](https://news.blizzard.com/en-us/article/4552955/game-guide-special-control) and [Overwatch League viewer](https://overwatch.blizzard.com/en-us/news/23013835/overwatch-league-replay-viewer-see-matches-from-a-new-perspective/) pages.
- [d3 interpolateZoom](https://d3js.org/d3-interpolate/zoom) (van Wijk & Nuij).
- [Unreal dynamic resolution](https://dev.epicgames.com/documentation/en-us/unreal-engine/dynamic-resolution-in-unreal-engine).
- Apple's [directional lock](https://developer.apple.com/documentation/uikit/uiscrollview/isdirectionallockenabled).
- [World Rugby TMO techniques](https://passport.world.rugby/match-day-staff/television-match-official-tmo-operator/3-what-you-do-and-how-you-do-it/technical-and-operations/system-techniques/).