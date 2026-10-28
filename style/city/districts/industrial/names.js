// THE SUPPLY SIDE · the sign voice of Low Tide Docks, The Heap and The Yards (owner: the supply agent). Working waterfront and
// industrial New York with a crime world under it: union halls, marine supply, fish, freight, tow yards, auto parts, scrap prices, a
// chop shop dressed as a body shop, the fence. Invented names only, no real brands. Every entry is painted ONCE on the whole supply side:
// the plan pass hands them out in order (lib.js allocator), so no company, stall or warning repeats across blocks (slime, 2026-09-26).
export const DECKS = {
  // shipping lines: short names for 2× container lettering (≤ 8 letters), with a mark and a colour each (a line owns its colour). A box
  // half hidden behind a ship's house or a stack shows any piece of its name, so no name holds a rude fragment (CUTLASS read ASS)
  lines: [
    ['MARLOWE', 'star', 0x2f5bff], ['OKAPI', 'ring', 0xff7a1a], ['KESTREL', 'wing', 0xe8232a], ['TIDEMARK', 'wave', 0x12b3a0], ['HALCYON', 'sun', 0xffc21a],
    ['CORVO', 'diamond', 0x17171b], ['GULLWING', 'wing', 0xf4f1ea], ['FOGHORN', 'ring', 0x8c52ff], ['BALLAST', 'bar', 0xa4502a], ['LODESTAR', 'star', 0x25b84c],
    ['CAPSTAN', 'diamond', 0xe83b5b], ['BOSUN', 'anchor', 0x3fa9f5], ['HAWSER', 'bar', 0xa7a9b1], ['MISTRAL', 'wave', 0xff4fa3], ['SIRENA', 'sun', 0x7a3cff],
    ['KRAKEN', 'ring', 0x6d707a], ['NARWHAL', 'star', 0x12b3a0], ['PELICANO', 'wing', 0xff8a1f], ['BLUEFIN', 'wave', 0x2f5bff], ['IRONKEEL', 'anchor', 0x9b4f3a],
    ['GALLEON', 'diamond', 0xffc21a], ['QUAYSIDE', 'bar', 0x25b84c], ['RIPTIDE', 'wave', 0xef4a2a], ['UNDERTOW', 'ring', 0x2f5bff], ['OSPREY', 'sun', 0x25b84c],
    ['SEAWOLF', 'star', 0xa7a9b1], ['BRINELY', 'anchor', 0xff7a1a], ['MOONFISH', 'ring', 0xffc21a], ['PORTSIDE', 'bar', 0xe8232a], ['TEMPESTA', 'diamond', 0x8c52ff],
    ['BOWLINE', 'wing', 0x3fa9f5], ['ALBATROS', 'wing', 0xf4f1ea], ['CALAMARI', 'ring', 0xff4fa3], ['SKIPJACK', 'wave', 0xef4a2a], ['FATHOM', 'anchor', 0x17171b],
    ['MACKEREL', 'bar', 0x12b3a0], ['DOGFISH', 'diamond', 0xa4502a], ['SANDPIPE', 'sun', 0xff8a1f],
  ],
  // brick warehouses: the old painted names high on the wall (serif or pixel, 2–3×)
  warehouse: [
    'KOWALSKI BROS STORAGE', 'DELVECCHIO & SONS', 'CANAL PAPER BOX CO', 'FERRANTE CANDY CO', 'LUDLOW LAMP WORKS', 'ZELNICK BUTTONS', "O'RYAN FURNITURE",
    'GREENBERG TEXTILES', 'HUANG BROS PRODUCE', 'LIEBOWITZ LADDERS', 'NOVAK BOX & CRATE', 'FITZGERALD ROPE WORKS', 'MORRISSEY BRASS', 'PERLMAN PIANO CO',
    'HOLLANDER HATS', 'ATLAS BEDDING', 'SILENT PARTNER PAPER', 'NO QUESTIONS STORAGE', 'ALIBI MOVING & STORAGE', 'BORO HALL FURNITURE', 'CASTELLANO COFFEE',
    'SANTIAGO BAKERY SUPPLY', 'PAPPAS RESTAURANT SUPPLY', 'REYES & REYES', 'MANDELBAUM TWINE', 'VITALE WINE & OIL', 'GOLDFARB SHOE LACE', 'CLEAN SLATE LINEN',
  ],
  // steel sheds and trades
  shed: [
    'TIDEWATER STEEL', 'EMPIRE PIPE & VALVE', 'BORO SHEET METAL', 'IRONSIDES FAB', 'BULLDOG HOIST', 'LIGHTNING ELECTRIC', 'NORTHSIDE SCAFFOLD',
    'BIG APPLE BOLT & NUT', 'SEVEN SEAS ROPE', 'GRAVEYARD SHIFT GLASS', 'KNUCKLES WELDING', 'MUNDO SCAFFOLDING', 'PIPE DREAMS SUPPLY', 'STEADY EDDIE ELEVATOR',
    'HOT SHOT SANDBLAST', 'DOUBLE DUTY HVAC', 'SWEENEY SIGN CO', 'CRANK CASE MOTORS', 'OLD SPARKY ELECTRIC', 'MACHINE SHOP 9', 'DYNAMO REWIND',
  ],
  // cold storage and food
  cold: [
    'HARBOR COLD STORAGE', 'DELANCEY PROVISIONS', 'ROSARIO MEATS', 'ICEBOX BROS', 'NORTH POLE ICE CO', 'SALT & BRINE FISH', 'FROSTBITE FOODS',
    'CAPELLI PRODUCE', 'MIRAGLIA DAIRY', 'KING CRAB COLD STORE', 'ZERO DEGREES', 'POLAR BEAR PORK',
  ],
  // garages: body shops, tyres, parts, glass, towing
  auto: [
    'PEREZ AUTO BODY', 'LUGNUT TIRE CO', 'SPARKY AUTO ELECTRIC', 'TRANSMISSION TONY', 'DENT KINGS COLLISION', 'CRUZ BROS AUTO GLASS', 'NIGHT HAWK TOWING',
    'FIVE BORO RADIATOR', 'PAINT BY NESTOR', 'CHROME DOME CUSTOMS', 'MUFFLER MIKE', 'BRAKE CITY', 'USED PARTS & RIMS', 'JIFFY SMOG', 'GRILLE & GRIME',
  ],
  // fleets and freight
  trucking: [
    'NUNZIO FREIGHT', 'BUSY BEE MOVERS', 'OVERNIGHT OSCAR', 'BLACKTOP EXPRESS', 'IRON HORSE HAULING', 'LOW TIDE LOGISTICS', 'HAPPY JACK DELIVERY',
    'MOONLIGHT MOVERS', 'EASTSIDE EXPRESS', 'BOOMERANG FREIGHT', 'GALLAGHER CARTING', 'ON THE DOT COURIER', 'DOLAN DRAYAGE', 'NO NAME TRUCKING',
  ],
  // materials yards
  yard: [
    "O'MALLEY IRON & STEEL", 'GRECO LUMBER', 'BRICK CITY MASONRY', 'VITALE CONCRETE', "SAL'S SAND & GRAVEL", 'BALDASSARE PALLETS', 'KING SIZE LUMBER',
    'PETROV MARBLE & TILE', 'DIAMOND PLATE STEEL', 'REBAR RAY', 'PALLET PALACE',
  ],
  // roof lettering read from the air: numbers, initials, piers
  roof: ['No 47', 'K&S', 'PIER 6', 'No 212', 'B-19', 'No 9', 'R&R', 'No 88', '1931', 'No 30', 'D&D', 'No 5', 'G-2', 'No 71', 'M&O', '1924', 'No 14', 'Z-7', 'No 63', 'H&H'],
  // tin plates and stencils on fences, gates and walls (each warning once)
  warn: [
    'NO DUMPING', 'BEWARE OF DOG', 'NO TRESPASSING', 'HARD HAT AREA', 'AUTHORIZED ONLY', 'TOW AWAY ZONE', 'KEEP GATE CLOSED', 'TRUCK ENTRANCE',
    'NO PARKING ANYTIME', 'VIOLATORS TOWED', 'WATCH YOUR STEP', 'FORKLIFTS CROSSING', 'SMILE · ON CAMERA', 'PRIVATE PROPERTY', 'DELIVERIES 6-2',
    'OFFICE IN REAR', 'RING BELL', 'HIGH VOLTAGE', 'DRIVEWAY 24 HRS', 'NO PARKING · TOWED', 'KEEP CLEAR', 'SAFETY FIRST', 'EYE PROTECTION', 'NO SMOKING',
    'SPEED LIMIT 5', 'ALL VISITORS REPORT', 'LOADING ZONE', 'BACK IN ONLY', 'DEAD END', 'MIND THE GAP', 'NO ENTRY', 'SIDEWALK CLOSED', 'USE OTHER DOOR',
    'DOG ON DUTY', 'NO CASH ON PREMISES', 'KNOCK LOUD', 'SECURITY PATROLLED', 'STAY OFF THE PILES', 'NO SCRAPPING', 'SHUT THE GATE',
  ],
  // vacant lots and the fuel depot
  lease: ['FOR LEASE', 'LOT FOR SALE', 'BUILD TO SUIT', 'AVAILABLE NOW', 'ZONED M-3', 'WILL SUBDIVIDE'],
  fuel: ['CARBONE FUEL OIL', 'NIGHT OIL CO'],
  // the fronts of the small shops and lunch spots between the warehouses
  small: [
    'EL TIGRE TACOS', 'GANTRY DINER', 'HERO KING', 'SHIFT CHANGE COFFEE', 'LUNCH BOX', 'CUCHIFRITOS', 'RUIZ SIGN CO', 'BODEGA LA ESQUINA', 'CHECK CASHING',
    'WORK BOOTS · GLOVES', 'UNIFORMS', 'BAIL BONDS 24H',
  ],
};
