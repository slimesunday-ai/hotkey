# Lower-body construction (the wardrobe's rules)

The construction every bottom and shoe sits on. This file holds rules only; the per-slot API is in `world/fresh/README.md` (§ Bottoms, § Shoes).

## The assembly

- **Two grids.** `compose()` returns the body grid `B` and a separate shoe grid `SH`. Pants can't overwrite, delete or reparent a shoe cell. In the animated bake, every shoe cell rides foot 8 or 9 (the left or right foot).
- **The common socket is y 4 (0.20 m).** The shoe's sole is y 0–1, its upper y 2–3, and the leg's cloth starts at y 4. The 3×3 ankle seat at y 3 (left x −4…−2, right x 1…3, z −1…1) belongs to the shoe and is dressed:
  - under full pants, in the pant's colour
  - under shorts, in the skin or the sock
  So cloth meets the shoe without a second overlapping shell and without a band at the ankle.
- **The leg is one connected surface.** Thigh and shin share one height-dependent transform and one mesh across the knee: matching vertices, internal knee faces culled. In the shader (`style/city/anim/walk2.js`), the cross-sections run from the shoe socket to the hip in the shoe's frame:
  - their heights strictly increase and the keyed knee supplies the bend: an injective shear, so sections never fold back into each other
  - cloth never falls below the shoe's top plane
  - the cuff follows the foot exactly
  - the upper ring follows the hip
  - shoes and soles stay rigid
- **No per-frame cloth simulation.** Everything is baked once per look. Flexibility comes from the shared vertices, never from deleting cloth or handing shoe cells to another bone.

## Leg forms (`leg-forms.js`, `collection-forms.js`)

- Each form declares six sections, ankle to hip (y 4…9): `[width, back z, front z]` per row, with the width growing outwards from a fixed two-voxel inner gap.
- **The seat** (`drawSeat`, 2026-10-01): the inner gap closes for the top `seat` rows (default `SEAT` 2: y 8…9). Each leg grows in by the gap's column on its side (u −1), in that row's back/front z, so the seat and crotch are one surface from the waistband to the top of the thigh and the legs split below. `lower.js` draws it after the waist clearance (the waistband's inside stays whole over it) and routes each half to its own thigh. The two halves are the only place the legs meet: the walk shader (`walk2.js`) slides each half's midline vertices onto the hips' midplane, 0.05 mm to its own side, so they never cut into each other (unprojected, the hips' roll and yaw would cross them by up to 2.6 mm in the weight-shift idle). The bottom's `paint` colours the seat with `q.u = −1`.
- The hidden 3×3 ankle attachment stays filled even when the visible hem is wider.
- Optional `cuts` (`[y, outward column, z]`, mirrored) reserve space for the moving hands. Resting-hand clearance alone isn't enough: fast strides and the crossing idle need the cuts.
- Final geometry keeps out of the resting hand's footprint, thumb included.
- The waistband is y 10, with a waist clearance (`world/fit/lower.js`). The groove it leaves at y 9 is always painted as a seam, one shade darker than the cloth, whatever the top.
- **Approved forms:**
  - `roomy`: the fuller profile, approved; the base kit's pants
  - `longshorts`: the roomy profile cut at the knee
  - `slim`, `straight`, `baggy`
  - `shorts`: hem at y 7
- Skin, socks and cloth form one combined surface. A shorts hem is a real shape step, with no skin shell under the cloth. Exposed skin uses the worn skin's colour and material.
- A bottom paints its form through a pure cell function and never gets the grid, so no trait can break a clearance.
- **A new form** (`formSpec`) is a new geometry: it must pass the lower-body motion check before anyone treats it as wearable.

## Shoes (`shoe.js`, `shoe-shapes.js`)

- **The foot-local envelope:**
  - u 0…4 outwards from the inner edge, y 0…3, ground cells inside z −3…5
  - z −4 (a heel tab) and z 6 (a raised toe point) only above y 0
  - u 5 meets the hands-in-pockets hand
- The heel/toe ground endpoints are where the gait plants the foot, so keep the sole on them.
- One connected rigid piece per foot. Nothing above y 3, nothing in the inner gap.
- **Lasts** are approved, motion-checked volumes: `tongue` (a continuous two-tier sole, a broad low toe box and an upright tongue; the base kit's) and three neutral studies, `terrace`, `lowline` and `fullcourt`. Painting a last changes no geometry, so its motion evidence carries over.
- **A free-form shoe is a new shape.** It needs a fresh motion check against every form, the opposite foot and the hands.

## Motion acceptance (`style/city/anim/lower-motion-check.mjs`)

The check runs the real vertex shader over 64 walk phases at five stride levels and all nine idles, both crossing-glance directions included.

- **Assembly:** no same-leg folds or crossings, no coplanar overlaps, no cloth in a shoe volume, no crossing into the opposite leg. Knee continuity and the cuff must be exact, and the foot rigid.
- **Hands:** no leg/hand contact while walking or in eight idles. Shoes must clear the hands in every pose.
- **Known limit:** the hands-in-pockets idle reaches into even the bare leg. That contact is counted and reported separately; it is not a strict collision-free result.
- These are sampled checks at the stated margins, not a proof for every possible pose.
