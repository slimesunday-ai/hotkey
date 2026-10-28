# THE KEYS (one place for every key in the city)

Every key the city answers to, who owns it, and when it works. A new screen picks a free key from the list at the bottom and adds it
here. Keys never fire while typing in a field, nor with ⌘ / Ctrl / Alt held. One Esc closes one thing (the order: the **Esc** row). Two
things take their keys before every screen, and both are modal: while one is open no other screen and not the camera hears a key, and
Tab walks only its own controls: the camera help (**?**; Esc or ? closes it: `camera/rig.js`) and the diary room (`ui/kit.js` keysFirst,
trapTab).

## The human layer (`ui/`)

| Key | What | Where | File |
|---|---|---|---|
| **U** | next skin (zte → clean → 98 → zine; zte, Zine × TE · Pink, is the default) | always | `ui/index.js` |
| **P** | citizen pins on / off | always | `ui/index.js` |
| **F** | follow the open agent (one press). Once the camera follows them, and while F is held (key repeat), F is the camera's own "further" (zoom out), so holding F never flips follow ↔ orbit; stop following with the dossier's Following button, **1**, or **Esc** once the dossier is closed (while it is open, Esc closes it first). In photo mode F is photo's | dossier open | `ui/index.js` |
| **[ ]** | previous / next agent | dossier open | `ui/index.js` |
| **Esc** | close ONE thing per press: the camera help, then the diary room (both modal), then the NEWEST open screen — Settings, the Action card, the map (its chooser, its place card, then the map), the City TV / City panel, the crowd chooser, the dossier, People (its search first) — then back to LIVE (in TAPE), then the camera back to the map (follow, fly; photo: where you were). The screens are a stack (`ui/kit.js` screens): each goes on top as it opens, so the City panel opened after the dossier closes before it, and the dossier opened after the City panel before that. F's stop-following Esc waits for the screens | always | `camera/rig.js`, `ui/diary.js`, `ui/kit.js` (the stack: `ui/menu/index.js`, `ui/map/index.js`, `ui/city-info/index.js`, `ui/index.js`, `ui/dossier.js`), `ui/tape/index.js` |
| **N** | City TV, "CH 9 News" (again: close; with the map open the map closes first, as the menu's TV does) | always | `ui/city-info/index.js`, `ui/map/index.js` |
| **L** | The City: ladders, turf, economy, crime, the dead (again: close; with the map open the map closes first) | always | `ui/city-info/index.js`, `ui/map/index.js` |
| **L** | the record path (`?sim=record`): the board, docked right where the dossier docks (again: close) | record | `ui/record/index.js` |
| **Y** | the record path: the morning cards, the night's top 5 (again: close; CH 9 and the cards share the centre) | record | `ui/record/index.js` |
| **Shift+N** | the news ticker and clock on / off (kept in this browser) | always | `ui/city-info/index.js` |
| **← →** | switch tabs (the camera never sees them) | a tab row has the focus | `ui/kit.js` |
| **Space** | play / pause the tape | TAPE | `ui/tape/index.js` |
| **← →** | previous / next event on the tape (not while the menu bar, a tab row or a Settings choice has the focus: those keep ← →) | TAPE | `ui/tape/index.js` |
| **Shift+← →** | an hour back / on (the same exception) | TAPE | `ui/tape/index.js` |
| **T** | secrets over the agents on / off | TAPE | `ui/tape/index.js` |
| **M** | heat map: off → presence → crimes → deals | always | `ui/diary-toys.js` |
| **K** | start / stop a clip | always | `ui/diary-toys.js` |
| **J** | the open agent's diary | dossier open | `ui/diary-toys.js` |
| **I O** | clip in / out marks | TAPE | `ui/diary-toys.js` |
| **B** | the city map: a paper street map of the island, full screen (again: close; not in photo mode, where B is photo's) | always | `ui/map/index.js` |
| **Esc** | the map (the newest screen): its chooser / place card first, then the map | map open | `ui/map/index.js` |
| **+ − 0** | the map: zoom in / out, the whole island | map open | `ui/map/index.js` |
| **W A S D**, **arrows** | the map: pan (arrows stay the tape's in TAPE); the camera never sees a key while the map is open | map open | `ui/map/index.js` |
| **/** | People: every agent, search as you type (again: back to the search field) | always | `ui/menu/index.js` |
| **↑ ↓ Enter** | People: choose a row · follow them and open the dossier | the search field has the focus | `ui/people/index.js` |
| **Esc** | People (the newest screen, or the search field has the focus): clear the search, then close | People open | `ui/people/index.js` |
| **↑ ↓ Home End Enter** | People › Leaderboards: walk the rows · follow them and open the dossier (a City board's ladder row: one click does the same) | a leaderboard row has the focus | `ui/people/leaderboards.js` |
| **.** | Where's the action: the newest notable public event (again: the one before) | always | `ui/menu/index.js` |
| **,** | Where's the action: the one after | always | `ui/menu/index.js` |
| **`** | Settings (again: close) | always | `ui/menu/index.js` |
| **Shift+`** | the developer bar on / off (kept in this browser; also `?dev=1`) | always | `ui/menu/index.js` |
| **Esc** | the menu's popovers (Settings, the action card) and People, each when it is the newest screen, before the tape's "back to LIVE" | menu open | `ui/menu/index.js` |
| **← → Home End** | walk the menu bar's buttons (one Tab stop for the whole bar) | the bar has the focus | `ui/menu/index.js` |
| **← →** | Settings: move the choice (skin, quality; the camera never sees them) | a choice has the focus | `ui/settings/index.js` |

The dossier's own row: Follow (F) · Watch tape · Star; 2b's "Where they went", Diary and ⋯ (heat and clips); 3b's pin: the agent on the map.

The menu bar (section 4, top left) shows each screen's key: People **/** · Map **B** · City **L** · TV **N** · Tape (no key: the chip, or the
dossier's Watch tape) · Action **.** · Settings **`**. Its keys never fire in photo mode or while the diary is open.

## The camera and the map (`camera/`, `nav.js`)

| Key | What | Where |
|---|---|---|
| **1 2 3 4 5** | Orbit · Fly · Follow · Photo · Walk | always |
| **W A S D**, **arrows** | move | orbit, fly, follow (← → go to the tape while TAPE is open; ↑ ↓ still move) |
| **Q E** | turn (fly: down / up) | orbit, follow, fly |
| **R F** | zoom in / out · in follow: closer / further (with the dossier open, the first F press starts following its agent; held, or once following, F zooms out again) | orbit, follow |
| **Shift** | faster | moving |
| **G** | follow the next sim agent | follow |
| **Tab** · **Shift+Tab** | the next / previous person nearby, only while nothing has the focus (on a button or in a panel, Tab moves the focus) | follow |
| **[ ]** | the previous / next person nearby (while the dossier is open: its previous / next agent) · photo: focus nearer / further | follow, photo |
| drag · two-finger swipe sideways (or Shift-wheel) | orbit round the person followed; the camera stays at that angle until you move it — it never drifts back behind them, and Tab, G, a hold and a cut keep it (a wall can push it in or swing it for a moment, then it comes back) · two-finger up / down, pinch, wheel: closer / further — your distance, kept for the next person, a shot's hand-back and a reload · W S, ↑ ↓: higher / lower — your pitch, kept the same way | follow |
| **E Space · Q C**, **Alt** | fly: up · down, slower (Space is the tape's in TAPE) | fly |
| **Z X**, **- =** | photo: roll, the lens | photo |
| **B H V R Enter** | photo mode: depth of field, hide the bar, format, record, still | photo |
| **?** (Shift+/) | camera help, modal: every other key waits until it closes (Esc or ? closes it; Tab walks its close button, slider and checkbox) | always |
| **\\** | the render panel | always (`render/panel.js`) |

## Elsewhere

| Key | What | Where |
|---|---|---|
| **T, Enter, /** | the chat bar | the mainland (`mainland/chat.js`) |
| **B V** | walk mode | the mainland (`mainland/walk.js`) |
| **R C Delete** | rotate, recolour, store | the builders (`mainland/builder.js`, `interiors/city/builder.js`) |

## Free (as of section 4, 2026-10-07; checked against the code 2026-10-09)

**Shift+L**, **Shift+M**, **Shift+P**, the Digit keys **0** and **6–9** (the camera takes 1–5; the open map uses 0), **;** **'**
**-** **=** (photo uses **-** **=** for the lens, the open map for zoom). Section 4 took **/**, **.**, **,**, **`** and **Shift+`**.
