// C1-8, the drawn half · TV MODE'S FACE ON THE RECORD PATH: the lower third (the director's caption), the menu's TV button and the
// ON AIR bug. camera/director.js decides what is on; this file only draws it.
//   caption   from a cut's captionFields alone (cut-plan.js / day-director.js): the public actors' names with their drivers, verbatim
//             from the board (a model, an owner, a bot label: never inferred), a hooded side as a count, the public action and the
//             place. Text nodes only; no event text, no result, nobody the cut does not name
//   button    TV in the menu (key 0): on when off, off when on
//   floorPx   the lowest screen row a framed figure may stand on: above the caption, the ticker and the record player
import { h, set, button } from '../kit.js';

// the public action, by the scene's kind (night) or the moment's (day): words for what is seen, never for how it ends
const ACTION = {
  hit: 'a jump in the street', breakin: 'a break-in', grab: 'the crate grab', collar: 'a collar', arrest: 'an arrest', vault: 'the vault job',
  hustle: 'a hustle', deal: 'dealing on the corner', run: 'a smuggling run', cook: 'cooking', build: 'at the Gunrunner’s bench', patrol: 'on patrol',
  back: 'backing up', laylow: 'laying low', lay_low: 'laying low', hooded: 'hooded figures', results: 'the night’s results', walk: 'the walk to the dock',
  ferry: 'the SECOND CHANCE', mint: 'the mint', meet: 'a sit-down', outloud: 'says it out loud', release: 'out of Iron Island', arrival: 'arrives',
  routine: 'about the day',
};
const PLACE = { downtown: 'Glasswall', strip: 'Neon Row', industrial: 'The Yards', suburbs: 'Pleasantview', docks: 'the docks', junkyard: 'The Heap',
  mall: 'the Mall', forest: 'Blackpine Woods', precinct: 'Precinct 9', vault: 'Precinct 9', crate: 'the docks', ferry: 'the docks', jail: 'Iron Island',
  heap: 'The Heap', diner: 'the diner', home: 'at home' };
const words = s => String(s ?? '').replace(/[-_]/g, ' ');
export const actionOf = f => ACTION[f.kind] ?? words(f.kind);
export const placeOf = p => PLACE[p] ?? (/^sitdown-/.test(p) ? { car: 'in a car', diner: 'a diner booth', roof: 'a rooftop', rooftop: 'a rooftop' }[p.slice(8)] ?? words(p.slice(8)) : null) ?? (/^(downtown|strip|suburbs|industrial|docks)-\d$/.test(p) ? `${PLACE[p.split('-')[0]]} corner` : /^lab/.test(p) ? 'a lab' : words(p));

export function createTv({ root, onToggle }) {
  const who = h('div', { class: 'r-tv-who' }), what = h('div', { class: 'r-tv-what' });
  const cap = h('div', { id: 'r-tv-cap', class: 'r-tv-cap', role: 'status', 'aria-live': 'polite', hidden: true }, h('span', { class: 'r-live r-tv-bug' }, 'TV'), who, what);
  const btn = button('TV', { kbd: '0', tip: 'TV mode: the director has the camera; any input hands it back (0)', cls: 'r-tv-btn', onclick: () => onToggle() });
  btn.setAttribute('data-tv-button', ''); btn.setAttribute('aria-pressed', 'false');
  root.append(cap);
  // the caption's text: names (driver) · …, a hooded count; then the action · the place
  function caption(f) {
    if (!f) { cap.hidden = true; return null; }
    const names = (f.subjects ?? []).map(s => s.driver ? `${s.name} (${s.driver})` : s.name);
    if (f.anonymousCount) names.push(`${f.anonymousCount} hooded`);
    set(who, names.join(' · ') || ' '); set(what, `${actionOf(f)} · ${placeOf(f.place)}`);
    cap.hidden = false; return `${who.textContent} | ${what.textContent}`;
  }
  return {
    button: btn, el: cap, caption,
    on() { btn.setAttribute('aria-pressed', 'true'); btn.classList.add('is-on'); document.body.classList.add('r-tv-on'); },
    off() { btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('is-on'); document.body.classList.remove('r-tv-on'); cap.hidden = true; },
    // the lowest row a framed figure may stand on: above the caption when it shows, else above the ticker and the player's bar
    floorPx() {
      let y = innerHeight;
      for (const el of [cap.hidden ? null : cap, document.getElementById('r-ticker'), document.getElementById('record-player')]) {
        const r = el?.getBoundingClientRect(); if (r && r.height > 0 && !el.hidden) y = Math.min(y, r.top);
      }
      return y - 6;
    },
  };
}
