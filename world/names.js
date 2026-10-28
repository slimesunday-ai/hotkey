// AI CITY world v2 — every place name and brand in one table (candidates; slime picks the final names).
export const NAMES = {
  district: {
    forest: 'Blackpine Woods', sea: 'The Bay', downtown: 'Glasswall', strip: 'Neon Row', suburbs: 'Pleasantview', estates: 'Gatehill',
    trailer: 'Sunny Acres', industrial: 'The Yards', docks: 'Low Tide Docks', junkyard: 'The Heap', jail: 'Iron Island', hospital: 'St. Mercy',
    highway: 'Route 9', bridge: 'The Long Bridge', mall: 'Millennium Mall',
  },
  sign: {
    bank: 'GLASSWALL BANK', court: 'HALL OF JUSTICE', police: 'POLICE', precinct: 'PRECINCT 9', hospital: 'HOSPITAL', hospitalFull: 'ST. MERCY HOSPITAL', er: 'EMERGENCY',
    jail: 'IRON ISLAND', jailSub: 'COUNTY JAIL', booking: 'BOOKING', junk: 'THE HEAP\nSCRAP & SALVAGE', trailer: 'SUNNY ACRES\nMOBILE HOMES', ship: 'MV LOW TIDE',
    motel: 'MOTEL 9', vacancy: 'VACANCY', gas: 'GAS', gasPrice: 'GAS\n4.04', mart: 'FOOD MART', mall: 'MILLENNIUM\nMALL', mallDead: 'CLOSED', lab: 'KEEP OUT',
  },
  // storefronts: tied to our systems (FIT, MARKS, crews) and 2000s street life, not the crime-sim default list
  shops: ['KICKS', 'RESALE', 'THRIFT', 'DROP', 'FITS', 'CAPS', 'GRILLZ', 'CHAINS', 'VINTAGE', 'TEES', 'SHADES', 'TATTOO', 'INK', 'NET CAFE', 'PHONES',
    'VIDEO', 'RECORDS', 'CDS', 'KARAOKE', 'DELI', 'BODEGA', 'PIZZA', 'NOODLES', 'DONUTS', 'DINER', 'BOBA', 'WINGS', 'NAILS', 'WIGS', 'BAIL BONDS', 'CHECKS CASHED', '24/7'],
  strip: ['CLUB VOID', 'AFTERHOURS', 'LOUNGE', 'KARAOKE', 'HOTEL', 'BAR', 'XO', 'BAIL BONDS', 'LIQUOR', 'NET CAFE'],
  stripVertical: ['CLUB', 'BAR', 'HOTEL', 'OPEN', '***', 'LIVE'],
  industry: ['COLD STORAGE', 'SUPPLY CO', 'PACKAGING', 'AUTO PARTS', 'RECYCLING', 'LUMBER', 'FREIGHT', 'IMPORTS'],
  // Fit Street: the block where the city's economy (fits, marks) is visible from the sidewalk
  fitStreet: [['DROP', 'white'], ['TATTOO', 'neon'], ['THRIFT', 'box'], ['NET CAFE', 'neon']],
  billboards: [['BAIL BONDS\n24/7', '#ffe066', '#1f1f22'], ['INJURED?\n1-800-GET-PAID', '#ffffff', '#c0392f'], ['GRILLZ KING\nGOLD TEETH', '#2b2d31', '#f0c330'],
    ['NOOB GRAY\nBE ANYONE', '#ffffff', '#8a8f98'], ['LAST EXIT\nBEFORE JAIL', '#ffffff', '#2f5b9a'], ['RESALE\nWE BUY KICKS', '#1f1f22', '#6ff3a0'], ['MOTEL 9\nNEXT RIGHT', '#ff5f7e', '#16151c']],
};
