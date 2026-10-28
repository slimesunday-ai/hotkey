// Fresh drop: one accepted, continuous low-top silhouette; twenty panel constructions.
// Palette order is [body, ink, pop, clean]. Materials: matte=0, coated=1, metal=2.
const sw = (color, material = 0) => [color, material];

export const DESIGNS = [
  {
    id: 'drop_shoe_arcade', name: 'Arcade', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A bright rubber toe, dark outer saddle, and separate heel tab make a readable first collector shoe.',
    cw: [['Signal / Violet',0xff502e,0x242737,0x7957ff,0xf4f0e9],['Cobalt / Taxi',0x2c8dff,0x132640,0xffbd24,0xf1f5f2],['Orchid / Mint',0xe848a8,0x312031,0x49cdaa,0xf4f1ed]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z===5?C:T);
      if(q.region==='tongue') return sw(C,1);
      if(q.z>=3) return sw(C,1);
      if(q.z<=-1) return sw(A);
      return sw(q.u>=2?D:T);
    }
  },
  {
    id: 'drop_shoe_glass_taxi', name: 'Glass Taxi', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A lacquer body meets a clean half-toe window and an oversized contrast tongue.',
    cw: [['Taxi / Cobalt',0xffbe19,0x161c27,0x217cef,0xf5f4e9],['Vermilion / Glacier',0xe94730,0x21242b,0x78dbed,0xf8eee8],['Lagoon / Coral',0x3dbbdd,0x192f42,0xff685b,0xecf3f4]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(T);
      if(q.region==='midsole') return sw(q.z>=3?T:D);
      if(q.region==='tongue') return sw(A,1);
      if(q.z<=-1) return sw(D);
      return sw(q.z>=3&&q.u<2?T:C,1);
    }
  },
  {
    id: 'drop_shoe_knuckle', name: 'Knuckle', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A heavy dark forefoot sits over a broad bright bumper, with a clean heel and padded-looking tongue.',
    cw: [['Iris / Ember',0x5369ff,0x202128,0xff6636,0xeeeef0],['Punch / Marigold',0xe83465,0x232333,0xffbf29,0xf7efeb],['Jade / Periwinkle',0x18a585,0x142f30,0x8cb7ff,0xedf2e8]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z>=2?A:T);
      if(q.region==='tongue') return sw(T);
      return sw(q.z>=2?D:q.z<=-1?T:C);
    }
  },
  {
    id: 'drop_shoe_split_ticket', name: 'Split Ticket', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'Two uninterrupted color fields divide the upper lengthwise, echoed by an offset sole split.',
    cw: [['Flare / Ultramarine',0xf44942,0x202536,0x456dff,0xf3f0ec],['Violet / Saffron',0xa451ef,0x252330,0xffa821,0xf6f0e9],['Pool / Candy',0x05a7b0,0x152b31,0xf56aab,0xf5f4eb]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(T);
      if(q.region==='midsole') return sw(q.u<=1?T:D);
      if(q.region==='tongue') return sw(D,1);
      return sw(q.u<2?C:A,1);
    }
  },
  {
    id: 'drop_shoe_switchback', name: 'Switchback', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A single stepped diagonal seam carries two large coated panels from the outer heel to the toe corner.',
    cw: [['Ember / Indigo',0xff5635,0x212736,0x4d52d9,0xf1f2ed],['Royal / Seafoam',0x3767ed,0x172232,0x58d5bd,0xf2f4f0],['Fuchsia / Sun',0xf03c8b,0x272037,0xf7c22f,0xf6f0ed]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(T);
      if(q.region==='midsole') return sw(q.z>=3?T:D);
      if(q.region==='tongue') return sw(T);
      const seam=q.z<=0?1:q.z<=2?2:3;
      return sw(q.u>=seam?A:C,1);
    }
  },
  {
    id: 'drop_shoe_liftoff', name: 'Liftoff', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A full-height bright forefoot grows out of a pale rear platform; its dark toe tip keeps the front graphic crisp.',
    cw: [['Electric / Gold',0x395dff,0x142439,0xffb927,0xf4f3ed],['Cherry / Ice',0xeb3c4f,0x292235,0x6cc6ff,0xf6efeb],['Amethyst / Spring',0x9a47e5,0x242036,0x66d5a2,0xf1f3ef]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(q.z>=1?C:T);
      if(q.region==='midsole') return sw(q.z>=1?C:T);
      if(q.region==='tongue') return sw(A,1);
      return sw(q.z===4?D:q.z>=1?C:T,q.z>=1?1:0);
    }
  },
  {
    id: 'drop_shoe_sidewinder', name: 'Sidewinder', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A thick outer rail turns across the complete toe, wrapping a clean inner forefoot in one connected panel.',
    cw: [['Azure / Flame',0x26a5e8,0x252b38,0xfe6240,0xf3f1e9],['Purple / Lemon',0x8b51e8,0x241f35,0xfbce39,0xf4f0ee],['Jade / Bubblegum',0x12b190,0x1c3034,0xfb63ae,0xecf4ef]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.u>=3||q.z===5?C:T);
      if(q.region==='tongue') return sw(A,1);
      return sw(q.u>=2||q.z>=3?C:T,q.u>=2||q.z>=3?1:0);
    }
  },
  {
    id: 'drop_shoe_palindrome', name: 'Palindrome', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'Matching lacquer end caps bracket a clean middle band, while the sole reverses the same three-part rhythm.',
    cw: [['Cherry / Bluebird',0xe73e42,0x2b2530,0x4d79e5,0xf3eee9],['Iris / Tide',0x7753e8,0x232339,0x36bcaa,0xf2f1ef],['Lagoon / Tangerine',0x08a4bf,0x18323b,0xf59527,0xf6f3e8]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z>=0&&q.z<=2?A:T);
      if(q.region==='tongue') return sw(D);
      return sw(q.z<=-1||q.z>=3?C:T,q.z<=-1||q.z>=3?1:0);
    }
  },
  {
    id: 'drop_shoe_underpass', name: 'Underpass', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A clean upper rides a two-color running sole with a broad dark bridge under its middle and a loud toe dock.',
    cw: [['Bluebird / Tangerine',0x2d79f5,0x28303b,0xff703c,0xf5f2e9],['Berry / Pool',0xda3987,0x29263d,0x5ecbe1,0xf1f2ef],['Emerald / Taxi',0x2ca478,0x21342e,0xffbe2c,0xf6f1e9]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(q.z>=2?C:q.z<=-1?A:D);
      if(q.region==='midsole') return sw(q.z>=2?C:q.z<=-1?A:T);
      if(q.region==='tongue') return sw(C);
      return sw(q.z===4?A:T);
    }
  },
  {
    id: 'drop_shoe_portal', name: 'Portal', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A broad dark perimeter frames a bright rectangular vamp; the tongue becomes the top of the color window.',
    cw: [['Flame / Alloy',0xfe6c35,0x222b3a,0x8295aa,0xeef1ed],['Aqua / Steel',0x30d0bd,0x213641,0x96a8bd,0xf2f5f0],['Candy / Chrome',0xf34eac,0x29213e,0x91a1c3,0xf4f0ed]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z<=-2?A:T,q.z<=-2?2:0);
      if(q.region==='tongue') return sw(C,1);
      return sw(q.u>=1&&q.u<=2&&q.z>=0?C:D,q.u>=1&&q.u<=2&&q.z>=0?1:0);
    }
  },
  {
    id: 'drop_shoe_hot_step', name: 'Hot Step', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'Three large fore-aft fields climb from a clean heel through a dark saddle into a saturated coated toe.',
    cw: [['Cinder / Saffron',0xe94532,0x34374e,0xf6b326,0xf5f0e9],['Royal / Lime',0x387bea,0x273348,0x8fe150,0xf1f3ef],['Magenta / Tide',0xcc3ead,0x322940,0x48c6bd,0xf4f0ef]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(q.z>=3?A:D);
      if(q.region==='midsole') return sw(T);
      if(q.region==='tongue') return sw(A,1);
      return sw(q.z<=0?T:q.z<=2?D:C,q.z>=3?1:0);
    }
  },
  {
    id: 'drop_shoe_boulevard', name: 'Boulevard', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A wide clean center stripe runs without interruption into a pale tongue, between two bright side fields.',
    cw: [['Royal / Persimmon',0x2673dd,0x1c3049,0xf4693f,0xf4f2ec],['Carmine / Honey',0xca3554,0x392732,0xf7af37,0xf8eeea],['Violet / Pool',0x6e4dd4,0x2a2640,0x40c3c4,0xf3f0ec]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z<=-2?A:T);
      if(q.region==='tongue') return sw(T);
      return sw(q.u===1||q.u===2?T:C);
    }
  },
  {
    id: 'drop_shoe_wet_paint', name: 'Wet Paint', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A single glossy toe-and-inner panel appears dipped across the shoe, ending at a staggered boundary against a dry dark heel.',
    cw: [['Candy / Silver',0xf24490,0x253143,0xa4b5c7,0xf2f1ee],['Tangerine / Steel',0xff762b,0x233440,0x99b3c1,0xf5f2e8],['Tide / Platinum',0x20c3b5,0x2c2942,0xabb1c7,0xf2f4ef]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(T);
      if(q.region==='midsole') return sw(q.z>=3?C:T,q.z>=3?1:0);
      if(q.region==='tongue') return sw(A,2);
      return sw(q.z>=(q.u<2?0:2)?C:D,q.z>=(q.u<2?0:2)?1:0);
    }
  },
  {
    id: 'drop_shoe_headliner', name: 'Headliner', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A clean toe with a broad satin-metal outer half fronts a rich coated body and an oversized bright tongue.',
    cw: [['Amethyst / Platinum',0x713dcc,0x25213c,0xaabbd7,0xf0f0eb],['Petrol / Silver',0x137ba9,0x163140,0xb7c9cc,0xf3f1e9],['Garnet / Rosegold',0xc13569,0x392136,0xd4ada0,0xf5eeea]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(T);
      if(q.region==='tongue') return sw(C,1);
      if(q.z>=3) return sw(q.u>=2?A:T,q.u>=2?2:0);
      return sw(q.z<=-1?D:C,1);
    }
  },
  {
    id: 'drop_shoe_pit_lane', name: 'Pit Lane', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A two-wide bright racing band crosses a dark toe and tongue; the outer sole carries one continuous matching rail.',
    cw: [['Amber / Vermilion',0xffa821,0x242e3e,0xe74740,0xf3f2e9],['Pool / Orchid',0x36c3df,0x242941,0xe458ac,0xf2f3ee],['Citron / Royal',0xacd82e,0x263036,0x4b78e6,0xf4f3e9]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.u>=3?A:T);
      if(q.region==='tongue') return sw(q.u<2?C:D,1);
      return sw(q.u<2?C:D,q.u<2?1:0);
    }
  },
  {
    id: 'drop_shoe_afterhours', name: 'Afterhours', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A dark coated upper carries a low electric toe bar; its split-level sole sends that color around the back instead.',
    cw: [['Neon Rose / Iris',0xfc437d,0x242339,0x755aeb,0xebeef0],['Aqua / Royal',0x13c5ca,0x1b303e,0x3f7dea,0xecf3f2],['Taxi / Ember',0xf6bb28,0x292b35,0xf26535,0xf3f0e9]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(q.z<=0?C:D);
      if(q.region==='midsole') return sw(q.z<=0?D:T);
      if(q.region==='tongue') return sw(A,1);
      return sw(q.z===4?C:D,1);
    }
  },
  {
    id: 'drop_shoe_daybreak', name: 'Daybreak', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A clean heel opens into a broad bright vamp, with a dark inner toe corner and a matching raised tongue.',
    cw: [['Persimmon / Bluebird',0xff6a3b,0x273148,0x487ee0,0xf4f2ec],['Royal / Jade',0x386fe8,0x1e3144,0x4dc9a4,0xf4f2ed],['Candy / Lilac',0xf151a1,0x34223c,0xb098f2,0xf6efee]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z>=4?A:T);
      if(q.region==='tongue') return sw(D);
      if(q.z<=0) return sw(T);
      return sw(q.u<2&&q.z>=3?D:C,1);
    }
  },
  {
    id: 'drop_shoe_bodega_ice', name: 'Bodega Ice', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A pale coated toe and tongue float above a saturated sole, anchored by dark rear quarters and a bright outer saddle.',
    cw: [['Iris / Berry',0x5e55ef,0x27263b,0xe94886,0xe8f1f4],['Lagoon / Apricot',0x1595b9,0x1b3441,0xff8545,0xe9f3f3],['Cherry / Lavender',0xe04451,0x352936,0x8476e9,0xf3eeee]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(C,1);
      if(q.region==='tongue') return sw(T,1);
      if(q.z>=2) return sw(T,1);
      return sw(q.u>=2?A:D);
    }
  },
  {
    id: 'drop_shoe_dual_citizen', name: 'Dual Citizen', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A deliberate left-right exchange swaps broad lacquer toes and outer quarters; matching neutral platforms keep the pair unified.',
    cw: [['Vermilion / Royal',0xec4938,0x25283c,0x437aef,0xf4f0e9],['Orchid / Amber',0xb342dd,0x2c2439,0xf8ad2d,0xf5efec],['Tide / Candy',0x0aa99d,0x1b3038,0xf052a2,0xf0f3ed]],
    paint(q,[C,D,A,T]) {
      const toe=q.side<0?C:A, quarter=q.side<0?A:C;
      if(q.region==='outsole') return sw(D);
      if(q.region==='midsole') return sw(q.z<=-2?quarter:T);
      if(q.region==='tongue') return sw(quarter,1);
      if(q.z>=2) return sw(toe,1);
      return sw(q.u>=2?quarter:T,q.u>=2?1:0);
    }
  },
  {
    id: 'drop_shoe_high_water', name: 'High Water', shape: 'tongue', category: 'shoes', tier: 'common',
    why: 'A clean outsole, dark midsole, and vivid upper form three strong stacked layers; a broad clean outer toe panel breaks the top band.',
    cw: [['Bluebird / Taxi',0x247edf,0x243147,0xffbd2a,0xf5f3eb],['Raspberry / Pool',0xe84474,0x34283a,0x62d1d0,0xf4f0ed],['Jade / Lilac',0x22ad80,0x1d3633,0xa477e8,0xf2f4ea]],
    paint(q,[C,D,A,T]) {
      if(q.region==='outsole') return sw(T);
      if(q.region==='midsole') return sw(D);
      if(q.region==='tongue') return sw(A);
      return sw(q.u>=2&&q.z>=2?T:C,q.u>=2&&q.z>=2?0:1);
    }
  }
];
