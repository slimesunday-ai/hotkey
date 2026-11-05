# Acts: the clips that didn't exist (a list for a clip job)

**Built (lane C2-clips, 11-01, a first pass for slime to direct):** every clip below but `count_cash` (never live, §19) is in the
studio's `acts` group (anim/cast/clips/acts.js, acts.md) and staged by acts.js ACT_STAGING. Where the rig changed the spec: the
floorboard lies at the actor's +x side, not in front (bent over in front, the big head comes down on the work and the hands go
through the knees); the haggle counter is the toon's (top 0.74 m, drawn by act-marks.js while haggle_counter plays: the booth's
shelf is above the cast's shoulders); `floorboard_lift` is three clips (lift → rummage loop → close); `listen` is its own set
(earpiece_listen). change_clothes's garment is held back from the city until actcheck's neutral list knows it (acts.js HELD_BACK).

stage/acts.js stages every day errand with clips the registry has. Where none fits, it uses the nearest one and the act
reads only roughly. These are the specs for the animation studio (the studio builds them; nothing here is built). Each clip
must stay drug-neutral and detail-neutral: no labels, no amounts, no visible cash or goods (GAME.md §41: "details a day late").

| clip | length | kind | prop (hand) | beats | replaces, in ACT_STAGING |
|---|---|---|---|---|---|
| `phone_up` + `phone_call` + `phone_down` | 1.05 s one-shot · 4.8 s loop · 1.2 s one-shot | standing | phone (+x), phone-prop.js | phone_tip cut in three: the phone out and up to the ear (phone_tip 0–1.05); the call held: weight shifts, two nods, the free hand turns out once, a glance round (no lip sync); the phone down into the pocket and a look back | `call`: phone_tip again and again (the phone goes up and down every 6 s) |
| `phone_type` | 4 s loop | standing | phone (both hands, chest height) | thumbs typing (0–1.6), a pause reading (1.6–2.4), the head up and round once (2.4–3.2), typing again; the screen dark, never readable | `message`, `order`: film_phone (held up as if filming) |
| `change_clothes` | 6 s one-shot, then the stand | standing, at a wardrobe or a door | a folded garment (plain grey, no print) | the top pulled over the head (0.4–2.0), shaken out and dropped on the arm, the folded one shaken open (2.4–3.4), pulled on (3.4–5.0), the hem tugged and a look down (5.0–6.0). The walker's look changes only when the board says (a hoodie conceals the fit) | `dress`: pat_pockets, deal_lookout |
| `floorboard_lift` | 5.5 s one-shot, its middle (2.0–3.6) a loop for the act's length | kneeling | a plain parcel; the floorboard's own state | knee down (0–0.8); both hands pry the board up (0.8–1.8; the floorboard goes `open` at 1.4); reach in (2.0–2.6); the parcel in or out (2.6–3.6); the board back down (3.6–4.6; `closed` at 4.2); up (4.6–5.5). Needs the stash-floorboard's open state with neutral contents (interiors/home/security.js shows cash and gold): a plain parcel in the gap | `stash`: rummage beside a plain parcel, at the door |
| `parcel_tuck` | 2.4 s one-shot | standing, the taker of a hand-over | the plain parcel (act-marks: the envelope, bills hidden) | the parcel weighed in the hand (0–0.6), turned once (0.6–1.2), tucked into the hoodie's front (1.2–2.0), the hoodie patted flat | `handover` partner: act_take then listen_nod |
| `earpiece_listen` | 5 s loop | standing | none (a small earpiece is part of the clip's hand pose, no prop) | two fingers to the ear (0–0.5), the head down and still, listening (0.5–4.0), a glance round (4.0–4.6), the hand stays up | `call` for `listen`: phone_tip |
| `count_cash` | 3 s loop | standing | a bill stack (both hands) | thumbing the stack, lips moving, a look up and back down. NOT for live acts: it tells "cash" and "how much". Only for a replay once the details are public (tomorrow) | none live |
| `haggle_counter` | 4.4 s loop | standing at a counter (the Heap's fence booth, ~1.0 m high) | none | forearms on the counter (0–0.8), a point at something on it (0.8–1.6), a shrug (1.6–2.4), a head shake and a lean back (2.4–3.4), back on the counter | `fence`: act_pass then listen_nod, at the Heap's stand spot facing the booth |

Placement the clips assume (stage/acts.js): the actor's own walker at its routine spot (a home act at the door until the rooms are
drawn: `HOME_ACTS`), a hand-over's pair 1.02 m apart face to face (bribe_pass's pair gap), a pair's pass on one clock
(`PASS_AT` island seconds after the act's start).
