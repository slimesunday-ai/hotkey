// STORE OBJECTS · sample shop interiors for the preview (owner: the store-objects agent). A room 6 × 8 m: x 0…6, z −8 (back wall) … 0
// (the window). Items: [id, variant, X, Z, quarter turns (0 front +z · 1 +x · 2 −z · 3 −x), base y] with (X, Z) the min corner of the
// turned footprint. People: [seed, x, y, z, facing, pose, look?]. These are hand layouts for the preview, not the city's fill rules.
const PI = Math.PI;
export const SHOPS = {
  bodega: { title: 'bodega · LUCKY 56 DELI', sign: 'LUCKY 56', band: 0x14a83b, signC: 0xf7f7f2, front: 0xef4a2a, wall: 0xf4f1ea, floor: 0xf2f2f2, floor2: 0x26262c,
    items: [
      ['store-cooler', 0, .1, -8], ['store-cooler', 1, 2.1, -8, 0, 0, 'open'], ['store-case-stack', 1, 4.3, -7.9, 0], ['store-case-stack', 2, 4.3, -7.35, 0],
      ['store-shelf-chips', 0, 0, -6.7, 1], ['store-shelf-cereal', 0, 0, -5.7, 1], ['store-shelf-cans', 0, 0, -4.7, 1], ['store-coffee-station', 0, 0, -3.6, 1],
      ['store-gondola', 0, 1.65, -6.3, 1], ['store-gondola', 1, 3.05, -6.3, 1], ['store-deli-case', 0, 5.0, -7.9, 3],
      ['store-counter-bodega', 0, 4.1, -3.7, 3], ['store-backbar', 0, 5.55, -3.7, 3, .8], ['store-ice-cream-chest', 0, 2.75, -3.5, 1], ['store-cat-loaf', 0, 2.95, -2.75, 1, .85],
      ['store-atm', 0, .1, -1.35, 1], ['store-news-rack', 0, 1.25, -1.0, 2], ['store-cat-loaf', 2, .05, -6.6, 1, 1.8],
      ['store-fluoro-light', 0, 1.2, -6.5, 1, 3.4], ['store-fluoro-light', 1, 3.6, -6.5, 1, 3.4], ['store-fluoro-light', 0, 2.4, -3.2, 1, 3.4],
      ['store-security-camera', 0, 5.65, -1.0, 3, 2.6], ['store-sign-no-loitering', 0, 5.7, -7.2, 3, 2.2], ['store-sign-cash-only', 1, 4.05, -2.6, 3, 1.35]],
    people: [[11, 5.6, 0, -3.35, -PI / 2, 'clerk'], [23, 3.65, 0, -1.55, PI / 2, 'point'], [37, 4.4, 0, -6.45, PI + .4, 'reach']] },
  pawn: { title: 'pawn · ASK NO QS', sign: 'ASK NO QS', band: 0x17171b, signC: 0xffe23a, front: 0x2f5bff, wall: 0xe6e1d6, floor: 0xc9b89a, floor2: 0xa99f90,
    items: [
      ['store-cage-counter', 0, 1.75, -7.1], ['store-cctv-monitor', 0, 3.75, -6.55, 0, .7], ['store-guitar-wall', 0, 0, -6.6, 1, 1.0], ['store-tv-stack', 0, .05, -4.2, 1], ['store-tv-stack', 1, .05, -3.1, 1],
      ['store-gold-case', 0, 1.6, -4.4], ['store-gold-case', 1, 3.2, -4.4], ['store-gold-case', 2, 3.2, -3.4, 1], ['store-pawn-shelf', 0, 5.5, -6.9, 3], ['store-shoebox-stack', 1, 5.35, -2.4],
      ['store-sign-we-buy-gold', 0, 5.9, -4.9, 3, 2.0], ['store-sign-on-camera', 0, 1.9, -8, 0, 2.75], ['store-security-camera', 1, .05, -1.2, 1, 2.6],
      ['store-fluoro-light', 0, 1.3, -6.0, 1, 3.4], ['store-fluoro-light', 1, 3.8, -4.0, 1, 3.4]],
    people: [[61, 3.0, 0, -7.55, 0, 'clerk'], [73, 2.95, 0, -5.55, PI, 'point'], [89, .95, 0, -5.4, -PI / 2, 'stand'], [97, 2.4, 0, -3.35, PI + .3, 'stand']] },
  sneakers: { title: 'sneakers · KICK GAME', sign: 'KICK GAME', band: 0x17171b, signC: 0x6cff4a, front: 0x17171b, wall: 0xf7f7f2, floor: 0xd3d4d7, floor2: 0xc6c7cb,
    items: [
      ['store-shoe-wall', 0, .2, -8, 0, .3], ['store-shoe-wall', 1, 2.2, -8, 0, .3], ['store-shoe-wall', 0, 4.2, -8, 0, .3], ['store-shoe-wall', 2, 0, -7.2, 1, .3], ['store-shoe-wall', 0, 0, -5.0, 1, .3],
      ['store-tryon-bench', 0, 2.0, -5.2], ['store-shoe-mirror', 0, 3.7, -5.25], ['store-tryon-bench', 1, 2.0, -3.4], ['store-grail-case', 0, 3.0, -2.0], ['store-register-counter', 0, 4.85, -6.6, 3],
      ['store-shoebox-stack', 0, 5.35, -7.7], ['store-shoebox-stack', 2, 5.4, -4.4], ['store-mannequin', 0, .9, -2.3, 0],
      ['store-fluoro-light', 0, 1.3, -6.0, 1, 3.4], ['store-fluoro-light', 0, 3.8, -6.0, 1, 3.4], ['store-fluoro-light', 0, 2.6, -2.8, 1, 3.4]],
    people: [[101, 5.8, 0, -5.9, -PI / 2, 'clerk'], [113, 2.25, .05, -4.95, 0, 'sit'], [127, 2.0, 0, -1.45, PI / 2, 'point']] },
  cards: { title: 'cards & collectibles · GRAILS', sign: 'GRAILS', band: 0x2f5bff, signC: 0xf7f7f2, front: 0xffc21a, wall: 0xd3d4d7, floor: 0xf2f2f2, floor2: 0x2f5bff,
    items: [
      ['store-grading-counter', 0, 2.0, -8], ['store-binder-shelf', 0, 0, -7.2, 1], ['store-binder-shelf', 1, 0, -5.6, 1], ['store-slab-case', 0, 4.9, -6.9, 3], ['store-slab-case', 1, 4.9, -5.3, 3],
      ['store-register', 1, 5.0, -4.55, 3, 1.0], ['store-play-table', 0, 1.5, -4.2], ['store-grail-case', 2, .15, -2.0], ['store-sign-cash-only', 0, 5.9, -7.9, 3, 1.5], ['store-sign-on-camera', 1, 0, -3.5, 1, 2.3],
      ['store-fluoro-light', 0, 1.4, -6.0, 1, 3.4], ['store-fluoro-light', 1, 3.8, -6.0, 1, 3.4], ['store-fluoro-light', 0, 2.6, -2.9, 1, 3.4]],
    people: [[141, 5.8, 0, -5.8, -PI / 2, 'clerk'], [151, 1.05, 0, -3.7, PI / 2, 'point'], [163, 3.95, 0, -3.7, -PI / 2, 'stand'], [171, .95, 0, -6.1, -PI / 2, 'reach']] },
  laundromat: { title: 'laundromat · SPIN CYCLE', sign: 'SPIN CYCLE', band: 0xf7f7f2, signC: 0x2f5bff, front: 0x12b3a0, wall: 0xf4f1ea, floor: 0xf2f2f2, floor2: 0x12b3a0,
    items: [
      ['store-washer-pair', 0, 0, -7.6, 1], ['store-washer-pair', 1, 0, -6.1, 1], ['store-washer-pair', 0, 0, -4.6, 1], ['store-dryer-stack', 0, 1.2, -8], ['store-dryer-stack', 1, 1.95, -8], ['store-dryer-stack', 0, 2.7, -8],
      ['store-dryer-stack', 1, 3.45, -8], ['store-dryer-stack', 0, 4.2, -8], ['store-change-machine', 0, 5.5, -7.2, 3], ['store-folding-table', 0, 2.6, -6.0, 1], ['store-waiting-chairs', 0, 5.5, -5.6, 3],
      ['store-laundry-cart', 0, 1.25, -3.1], ['store-vending-machine', 0, 5.2, -2.0, 3], ['store-sign-no-loitering', 1, 5.9, -5.6, 3, 2.15], ['store-ceiling-fan', 0, 1.9, -5.4, 0, 3.4], ['store-fluoro-light', 0, 3.9, -6.3, 1, 3.4], ['store-fluoro-light', 1, 3.9, -3.0, 1, 3.4]],
    people: [[181, 3.65, 0, -5.1, -PI / 2, 'clerk'], [193, 5.65, 0, -4.4, -PI / 2, 'sit'], [201, 1.25, 0, -6.75, -PI / 2, 'reach'], [211, 4.7, 0, -2.2, PI - .8, 'phone']] },
  pizza: { title: 'dollar pizza · $1 SLICE', sign: '$1 SLICE', band: 0xe8232a, signC: 0xf7f7f2, front: 0x25b84c, wall: 0xfff0d0, floor: 0xf7f7f2, floor2: 0xe8232a,
    items: [
      ['store-pizza-oven', 0, .4, -8], ['store-pizza-boxes', 0, 2.5, -7.95], ['store-menu-board', 0, 3.0, -8, 0, 1.9], ['store-slice-counter', 0, .4, -5.4], ['store-cooler', 0, 5.2, -4.4, 3], ['store-diner-booth', 0, 0, -3.3, 1],
      ['store-counter-stool', 1, 3.3, -3.9], ['store-counter-stool', 1, 3.9, -3.9], ['store-claw-machine', 0, .1, -1.35], ['store-sign-cash-only', 0, 3.3, -8, 0, 1.2], ['store-ceiling-fan', 1, 1.8, -4.4, 0, 3.4], ['store-fluoro-light', 0, 4.1, -6.4, 1, 3.4]],
    people: [[221, 1.7, 0, -6.4, 0, 'clerk'], [233, 2.3, 0, -3.95, PI, 'point'], [241, .45, .05, -2.45, PI / 2, 'sit'], [251, 4.6, 0, -2.6, PI / 2, 'reach']] },
};
