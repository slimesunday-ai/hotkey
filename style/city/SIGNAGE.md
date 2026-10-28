# Signage (pass 3, pass 4)

`signage/` letters the city: billboards, wall ads, ghost signs, murals, paste-ups, shelter ads, rooftop neon, throw-ups and default shop names. The rules are in STYLE.md §12 and the kit notes in DISTRICTS.md §8.

## Vocabulary
`designs.js` and `lexicon.js` hold about 1,200 invented designs in 52 categories.
- **The bulk is NYC and crime-world services:** bail, injury law, cheque cashing, tax, pawn and gold, lotto and OTB, malt, locksmiths, exterminators, movers, tow, boxing, churches, campaigns, police recruiting, WANTED posters, transit notices and condos.
- **Capped per pool:** fashion and drops, collector culture, and 18 internet puns.
- **Characters star in the ads:** busts, figures breaking the frame, 4× giants, Dazed murals and candidates' portraits.
- **Section 1's 77 placed ads:** 90% services, 5% fashion, 4% collector, 1% internet.

## Formats
`boards.js`, `shop.js` and `paint.js` build:
- roof boards with a steel frame, a catwalk, gooseneck lamps and 3D cut-outs
- wall ads, murals, ghost signs and wheat-paste runs
- shop names, blade signs, window vinyl, window cards and sandwich boards
- bus-shelter lightboxes

Fourteen layouts fit any box. A design whose words don't fit a wall is never painted there.

## Variety
`alloc.js` combines lattice classes with a seeded, weighted draw without replacement.
- No design repeats within 96 m (160 m for roof boards) or inside a block.
- Shop names are unique per block.
- Each district draws its own flavour first.
- The audit's `sign-repeat` check enforces this.

| section 1 | before | after |
|---|---|---|
| lettered surfaces | 612 | 688 |
| internet references | 164 (26.8%) | 3 (0.4%) |
| repeats within the radius | 138 | 0 |

## Audit
- **Downtown:** 92 issues before and after, identical per block. Refused placements stay at 58.
- **Suburbs:** 0 before and after.
- **All 154 district blocks:** no `sign-repeat` issues and no module errors. The regulatory plate BEWARE OF DOG is exempt.

## Bench (cold cache)
- **Street views:** 140–203 draw calls. The bench flight peaks at 282.
- **First view:** 2.5–2.7 s, over the 2 s budget. Signage is not the cause: its modules load in 18 ms, and downtown's blocks build in 14.18 s (14.23 s before).
- **Node:** `art.js` loads `chars.js` lazily, so the kits load in node again.

## Shots and preview
- **Shots:** `shots/signage/before/` and `after/` (8 spots), plus `preview-day.png` and `preview-night.png`.
- **Preview:** `signage/preview.html` (`?view=all`, or `?view=sheet&fam=roof`).

## Pass 4: the reserve and the swap
The lattice stops a *design* repeating, but on the full island a *gag* (a design category: every lottery board, whatever its jackpot) still came round every few blocks.
- **Gag** (`signage/gags.js`): a pool design's category; a ghost sign's heritage trade; for neon words, throw-ups, shop names, the bodega's side band and the parking sign, the words themselves.
- **Repeat**: a second copy of a gag in the same family within its view distance: roof boards 250 m, everything else 100 m. Walking out from the city centre, the nearer copy stays. Section 1 (i −3…2, j −3…0) keeps all of its own.
- **Not signage**: kit words (fam `kit`, a kit's own names and wall lines), hero lettering, set-piece sculptures and regulatory plates are never counted or swapped.

**The reserve** (`signage/reserve.js`, `signage/icons.js`): 47 new categories that the lattice never draws, generated after the live pools from seeds of their own, so every live pool is byte-for-byte what it was.
- **The sim's own world**: alarms, guard dogs, safes, GOT WARRANTS? lawyers, title loans, St. Mercy, car service, the Bay ferry, jail calls and commissary, police auctions, PIs, divorce $299, DNA tests, immigration, traffic tickets.
- **The block**: phone cards, mattress blowouts, beauty supply, karaoke, cabaret, motels, car washes, bodega-cat adoption, rent strikes, stoop sales, tear-offs, club nights, record releases, tent revivals, psychics, lucha, bingo, plasma, trade school, rehab.
- **Held back**: consignment, vintage, card shows, watches and galleries (fashion and collector culture, weighted ×0.25); Gatehill's estates, motorcars and tailors.
- **Also new**: 22 neon words, 23 throw-up words, 25 heritage trades and reserve shop names.
- **Painters**: five layouts (`paint.js`): `price` (starburst), `club` (halftone flyer), `luxe` (the rich side), `rays` (sunburst) and `release` (record sleeve). There are 12 new icons.
- **Winks**: no internet winks.
- **Preview**: `signage/preview.html?view=sheet&res=1&fam=roof|wall|paste|transit`.

**The swap** (`signage/swaps.js`, written by `tools/signswap.mjs`):
- The table maps a sign's identity (`block | family | lot | the allocator's own pick`) to a new gag, or to candidate words.
- `pick()` draws exactly as before, then looks its pick up. A repeat gets the first design of its new gag that fits the box and is free in the block. Both keys are marked used, so every later draw is unchanged.
- The table is static, so workers in any order build the same city. `?signswap=0` switches it off for main-thread runs (census, hash, shots).
- The bodega band and the parking sign go through `bodegaBand()` and `parkSign()` (index.js, called from gen.js). No parking lot is built in the current city, so it has none yet.

**Regenerate after kit (or walls) changes.** Anything that calls `pick()` shifts the picks after it in its block, which stales the table. A stale entry simply doesn't match and does nothing. From the repository root:
1. `node style/city/signage/census.mjs before --q signswap=0`
2. `node style/city/tools/signswap.mjs before`
3. `node style/city/signage/census.mjs after --vs before`
4. `node style/city/tools/signswap.mjs before --learn after && node style/city/signage/census.mjs after --vs before`

Step 4 gives a new gag to any sign whose gag had no design that fitted. It remembers those in `TRIED`; repeat it until 0 repeats remain outside section 1. The census's `vs` line must say that every changed sign was a repeat.
