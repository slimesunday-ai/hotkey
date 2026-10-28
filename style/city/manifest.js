// Every OPTIONAL module of the city: district kits, hero set pieces, per-block overrides. Each one is loaded on its own, in
// isolation (modules.js): if a file fails to load or throws while building, its blocks show a magenta placeholder with an
// error sign and the page lists the failure in red; everything else loads as normal. One agent's half-edited file can no
// longer break the page for everyone.
//
// To add a file: add its path to the right list (one line). The loader reads this file as TEXT and picks up every quoted path
// that starts with districts/, heroes/ or blocks/, so even a half-edited line here cannot stop the others from loading.
// Owner: the systems agent (DISTRICTS.md). Shared code (gen.js, props.js, kit.js, …) is not listed: it is the core and must never break.

export const KITS = [
  'districts/downtown.js',     // Glasswall · section 1 (batch 1) · systems agent until a downtown section agent takes it
  'districts/suburbs.js',      // Pleasantview (batch 4) · the Pleasantview section agent
  'districts/strip.js',        // Neon Row (batch 3) · the Neon Row agent
  'districts/industrial.js',   // The Yards (batch 3) · the supply agent
  'districts/docks.js',        // Low Tide Docks (batch 3) · the supply agent
  'districts/junkyard.js',     // The Heap (batch 3) · the supply agent
  'districts/trailer.js',      // Sunny Acres (batch 3) · the Sunny Acres / Millennium Mall agent
  'districts/mall.js',         // Millennium Mall (batch 3) · the Sunny Acres / Millennium Mall agent
  'districts/forest.js',       // Blackpine Woods (batch 4) · the Blackpine Woods agent
  'districts/estates.js',      // Gatehill (batch 4) · the Gatehill agent
  'districts/hospital.js',     // St. Mercy (batch 4) · the St. Mercy / Route 9 agent
  'districts/highway.js',      // Route 9 + Motel 9 (batch 4) · the St. Mercy / Route 9 agent
  'districts/jail.js',         // Iron Island + the Long Bridge (batch 5) · the water-side agent
  'districts/sea.js',          // The Bay (batch 5) · the water-side agent
];

export const HEROES = [
  'heroes/fitstreet.js', 'heroes/hall-of-justice.js', 'heroes/precinct.js', 'heroes/plaza.js', 'heroes/store.js', 'heroes/bank.js',
  'heroes/corners.js',         // the dealing corners' props (section 1)
  'heroes/docks-shift.js', 'heroes/docks-crane.js',   // Low Tide Docks (batch 3) · the supply agent
  'heroes/junkyard-mountain.js',   // The Heap (batch 3) · the supply agent
  'heroes/industrial-chopshop.js', 'heroes/industrial-foundry.js',   // The Yards (batch 3) · the supply agent
  'heroes/strip-jay.js', 'heroes/strip-club.js', 'heroes/strip-diner.js', 'heroes/strip-pawn.js',   // Neon Row (batch 3) · one module per block · the Neon Row agent
  'heroes/trailer-swapmeet.js', 'heroes/trailer-office.js', 'heroes/trailer-laundry.js',   // Sunny Acres (batch 3) · the Sunny Acres / Millennium Mall agent
  'heroes/mall-atrium.js', 'heroes/mall-pylon.js', 'heroes/mall-foodcourt.js',   // Millennium Mall (batch 3) · the Sunny Acres / Millennium Mall agent
  'heroes/suburbs-park.js', 'heroes/suburbs-store.js', 'heroes/suburbs-school.js',   // Pleasantview (batch 4) · the Pleasantview section agent
  'heroes/forest-lab-north.js', 'heroes/forest-lab-west.js', 'heroes/forest-lab-south.js', 'heroes/forest-tower.js', 'heroes/forest-leaf.js',   // Blackpine Woods (batch 4) · the Blackpine Woods agent
  'heroes/estates-aureum.js', 'heroes/estates-offshore.js', 'heroes/estates-solitaire.js', 'heroes/estates-auction.js',   // Gatehill (batch 4) · the Gatehill agent
  'heroes/hospital-er.js', 'heroes/hospital-garage.js', 'heroes/hospital-smokers.js', 'heroes/hospital-entrance.js',   // St. Mercy (batch 4) · one module per block · the St. Mercy / Route 9 agent
  'heroes/highway-gas.js', 'heroes/highway-motel.js',   // Route 9 + Motel 9 (batch 4) · one module per block · the St. Mercy / Route 9 agent
  'heroes/jail-visitors.js', 'heroes/jail-sallyport.js', 'heroes/jail-yard.js', 'heroes/jail-lighthouse.js', 'heroes/jail-bridge.js',   // Iron Island + the Long Bridge (batch 5) · the water-side agent
  'heroes/downtown-fringe-church.js', 'heroes/downtown-fringe-garage.js', 'heroes/downtown-fringe-carwash.js', 'heroes/downtown-fringe-signs.js', 'heroes/downtown-fringe-gym.js', 'heroes/downtown-fringe-coop.js', 'heroes/downtown-fringe-cards.js',   // the downtown fringe (batch 5) · one module per hero block · the downtown fringe agent
  'heroes/sea-wreck.js',   // The Bay (batch 5) · the water-side agent (C1-7d: SECOND CHANCE is live, second-chance.js)
];

export const BLOCKS = [
  'blocks/-3_0.js', 'blocks/0_-2.js', 'blocks/1_-1.js', 'blocks/0_-1.js', 'blocks/2_-3.js', 'blocks/-1_-1.js',
  'blocks/-3_-3.js', 'blocks/-3_-2.js', 'blocks/-3_-1.js', 'blocks/-2_-3.js', 'blocks/-2_-2.js', 'blocks/-2_-1.js',
  'blocks/-1_-3.js', 'blocks/0_-3.js', 'blocks/1_-3.js', 'blocks/-1_-2.js', 'blocks/1_-2.js', 'blocks/2_-2.js', 'blocks/2_-1.js',
  'blocks/-2_0.js', 'blocks/-1_0.js', 'blocks/0_0.js', 'blocks/1_0.js', 'blocks/2_0.js',
  'blocks/corners.js',         // the corners agent's per-block nudges, merged into each block's override
  'blocks/-2_1.js',            // Neon Row (batch 3) · the Neon Row agent
  'blocks/4_-2.js',            // St. Mercy (batch 4) · the ER bay's traffic-car swap · the St. Mercy / Route 9 agent
  'blocks/7_4.js',             // Route 9 (batch 4) · a street tree moved off the LAST GAS BEFORE BRIDGE sight line · the St. Mercy / Route 9 agent
  // the downtown fringe (batch 5) · the downtown fringe agent · the 52 blocks round section 1 (each deals its side's trades: districts/downtown/fringe.js)
  'blocks/-5_-4.js', 'blocks/-4_-4.js', 'blocks/-3_-4.js', 'blocks/-2_-4.js', 'blocks/-1_-4.js', 'blocks/0_-4.js', 'blocks/1_-4.js', 'blocks/2_-4.js', 'blocks/3_-4.js', 'blocks/4_-4.js', 'blocks/5_-4.js', 'blocks/6_-4.js', 'blocks/-5_-3.js', 'blocks/-4_-3.js', 'blocks/3_-3.js', 'blocks/4_-3.js', 'blocks/5_-3.js', 'blocks/6_-3.js', 'blocks/-4_-2.js', 'blocks/3_-2.js', 'blocks/6_-2.js', 'blocks/-5_-1.js', 'blocks/-4_-1.js', 'blocks/3_-1.js', 'blocks/6_-1.js', 'blocks/-5_0.js', 'blocks/-4_0.js', 'blocks/3_0.js', 'blocks/4_0.js', 'blocks/5_0.js', 'blocks/6_0.js', 'blocks/-5_1.js', 'blocks/-4_1.js', 'blocks/-3_1.js', 'blocks/0_1.js', 'blocks/1_1.js', 'blocks/2_1.js', 'blocks/4_1.js', 'blocks/5_1.js', 'blocks/6_1.js', 'blocks/-5_2.js', 'blocks/-4_2.js', 'blocks/-3_2.js', 'blocks/-2_2.js', 'blocks/-1_2.js', 'blocks/0_2.js', 'blocks/1_2.js', 'blocks/2_2.js', 'blocks/3_2.js', 'blocks/4_2.js', 'blocks/5_2.js', 'blocks/6_2.js',
];
