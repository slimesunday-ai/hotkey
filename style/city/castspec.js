// Who stands where, per block: the anchors a block build leaves in A (life, stoops, doors, hero spots, corners, giants) → person
// specs { look, x, y, z, ry, fn (pose on the chars.js rig), scale }. Worker-safe: the chars module is passed in (CH).
// Cast pass (2026-10-02): CH is the city's cast (cast.js): named handles are its translated LOOKS, rolls come from the fresh traits slime
// didn't kill, and a life entry's `outfit` (cast.js OUTFITS) dresses it. `held` props are not drawn by the fresh construction (no held category yet).
// The placement and pose rules are pass 1b's people.js makeCast, now run per block (salt keeps looks distinct between blocks).
import { SIDE, hash } from './style.js';
import { REG } from './audit.js';
import { GEN } from './gen.js';
import { unshift } from '../../world/city.js';   // (crowd hold, SPREAD: a scene's look seed reads today's place — gen.js oneOff)
const HELD = { carry: ['duffel', 'cash', 'can', 'camera', 'duffel'], phone: ['flip', 'flip', 'ipod'], deal: ['cash', 'flip'], talk: ['can', 'none', 'none', 'flip'], talk2: ['none', 'none', 'can'], lean: ['none', 'can', 'ipod'], fe: ['none', 'can'], arms: ['none', 'cash'] };
const arms = (a, b) => rg => { rg.armL.rotation.x = a; rg.armR.rotation.x = b; };
const sit = (legs = -1.25, ar = -.45) => rg => { rg.legL.rotation.x = rg.legR.rotation.x = legs; rg.armL.rotation.x = rg.armR.rotation.x = ar; };
const party = k => rg => { rg.armL.rotation.x = -2.6 + (k % 2) * .3; rg.armR.rotation.x = -2.4 - (k % 3) * .2; };
// NPC integration (2026-10-07) · which pool dresses whom (cast.js TWO POOLS): the working civilians wear the NPC pool (shop clerks, the
// people in a shop's interior, a neighbour leaning out of a window); everyone else a block stages (the DROP line, its door, roof dancers,
// stoops, plazas, steps, dealing corners, giants, every hero and set-piece crowd and kerb scene) wears the agent cast, as before.
const NPC_ACTS = new Set(['clerk', 'window']), NPC = { pool: 'npc' };

export function castOf(A, CH, salt = 0) {
  const out = [], L = h => structuredClone(CH.LOOKS.find(x => x.handle === h)), extra = seed => CH.rollLook((seed + salt * 977) & 0xffffff), civ = seed => CH.rollLook((seed + salt * 977) & 0xffffff, NPC);
  // fidelity pass (people round) · every person also carries where it came from (src: 'queue' the DROP line, 'door' its bouncer, 'deli',
  // 'fruit', 'clerk', 'roof', 'stoop', 'doors' a customer at a shop door, 'plaza', 'steps', 'corner' a dealing crew, 'giant', 'life' the
  // generator's, 'hand' a kit's or hero's scene, 'override' a block file's people.add) and whether it stands on a street sidewalk (walk).
  // charbake.js bakeCast decides from these who is baked (the frozen sidewalk crowd retires: walkers fill those sidewalks) and how
  // the rest move (their idle animation). Nobody is removed here: ids, overrides, the audit and the lanes see the same cast as before.
  // (kerb: how far into the sidewalk from the curb, 0 – the side's walk: 2 m today)
  const kerbOf = (x, z) => { for (const S of REG.blk?.walk || []) { const [u, p] = S.ax === 'x' ? [x, z] : [z, x], c = S.dir > 0 ? p - S.cur : S.cur - p; if (u >= S.u0 && u <= S.u1 && c >= -.05 && c <= (S.w ?? 2)) return c; } return -1; };   // (crowd hold, SPREAD: the side's own walk — at 2 m the shopfront crowd 2.5–3.5 m out never retired)
  let act = 'stand', src = 'life'; const put = (look, x, y, z, ry, fn, scale = 1) => { const c = Math.abs(y - SIDE) < .15 ? kerbOf(x, z) : -1; out.push({ look, x, y, z, ry, fn, scale, act, src, walk: c >= 0, kerb: c }); };   // pass 1d: act rides along (ids + audit)
  if (A.drop) { src = 'queue'; const q = ['xXbadvibesXx', 'rawr_means_404', '56kballer', 'www.girl', 'cmd_q', 'dialog.box', 'fatal.exception'];
    q.forEach((h, i) => put(L(h), A.drop.door[0] - 1.3 - i * 1.15, SIDE, A.drop.queueZ + (i % 2) * .1, Math.PI / 2 + [.3, -.35, .15, .5, -.2, .35, -.1][i], null));
    src = 'door'; put(L('anon_inc'), A.drop.door[0] + .75, SIDE, A.drop.queueZ + .15, .5, null); }
  if (A.deliDoor) { src = 'deli'; put(L('late.night'), A.deliDoor[0], SIDE, A.deliDoor[1] - .35, Math.PI + .2, null); if (A.fruit) { src = 'fruit'; put(L('dealwithit.mp3'), A.fruit[0] + .5, SIDE, A.fruit[1] + 1.2, Math.PI / 2 + .9, arms(-1.05, 0)); } }
  if (A.clerk) { act = 'clerk'; src = 'clerk'; put(civ(0x51a7), A.clerk[0], A.clerk[1], A.clerk[2], Math.PI, arms(-.5, -.5)); act = 'stand'; }   // pass 2: indoors on purpose (jobs.js HOME)
  if (A.roof) { act = 'dance'; src = 'roof'; const [x, y, z] = A.roof; put(L('bluescreen.bucket'), x - 1.2, y, z - .6, .6, party(0)); put(L('missing_texture'), x + .8, y, z - 1.0, -.3, party(1)); put(L('macpaint.artist'), x, y, z + .9, .2, party(2)); put(extra(0x2cde), x + .4, y, z + 2.3, Math.PI, arms(-.9, -.9)); }
  act = 'sit'; src = 'stoop'; (A.stoops || []).forEach((s, k) => { if (k % 2) return; const [x, z] = s.at, ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][s.rot]; put(A.drop && k < 2 ? L('county.blues') : extra(0x700 + k), x, SIDE + .8 - .5, z, ry + (hash(k, salt) - .5) * .4, sit()); });
  act = 'stand'; src = 'doors'; (A.doors || []).forEach((d, k) => { if (k % 5 || k > 15) return; const [x, z] = d.at, ry = [0, Math.PI / 2, Math.PI, -Math.PI / 2][d.rot]; put(extra(0x900 + k), x, SIDE, z, ry + (hash(k, 2, salt) - .5) * 1.2, k % 2 ? arms(0, -.4) : null); });
  if (A.plaza) { const { cx, cz } = A.plaza; act = 'sit'; src = 'plaza'; [[0, -5.35, 0], [0, 5.35, Math.PI], [-5.35, 0, Math.PI / 2], [5.35, 0, -Math.PI / 2]].forEach(([dx, dz, ry], k) => put(extra(0xb00 + k), cx + dx * 1.03, SIDE + .1 + .05, cz + dz * 1.03, ry, sit(-1.45)));
    act = 'stand'; put(L('tag.crew'), cx - 7.6, SIDE + .1, cz + 5.2, 2.3, arms(0, -1.2)); put(extra(0xb44), cx + 6.2, SIDE + .1, cz - 7.4, -.7, null); put(extra(0xb55), cx + 7.0, SIDE + .1, cz - 6.6, -2.4, arms(-.4, 0)); }
  act = 'stand'; src = 'steps'; if (A.courtSteps) { const [x, z] = A.courtSteps; put(extra(0xc01), x - 2.4, SIDE + 1.2, z - .2, .2, null); put(extra(0xc02), x + 1.8, SIDE + .6, z + 1.2, -.3, arms(-.3, 0)); }
  if (A.precinctSteps) { const [x, z] = A.precinctSteps; put(extra(0xd01), x - .4, SIDE, z - 2.6, -Math.PI / 2 + .3, null); put(extra(0xd02), x - .6, SIDE, z + 2.8, -Math.PI / 2 - .2, arms(0, -.5)); }
  src = 'corner'; (A.corners || []).forEach((c, k) => { const face = Math.atan2(-c.qx, -c.qz), held = (s, id) => Object.assign(extra(s), { held: { id } }); k = c.k ?? k;
    act = 'stand'; put(held(0xf00 + k * 7, 'cash'), c.cx, SIDE, c.cz, face + .4, arms(-.7, 0)); act = 'sit'; put(extra(0xf01 + k * 7), c.cx + c.qx * .65, SIDE + .02, c.cz + c.qz * 1.35, face - .8, sit(-1.3)); act = 'stand';
    put(held(0xf02 + k * 7, 'flip'), c.cx - c.qx * .2, SIDE, c.cz + c.qz * 2.2, face + 2.5, arms(0, -2.3)); if (k % 2 === 0) put(extra(0xf03 + k * 7), c.cx + c.qx * 1.9, SIDE, c.cz - c.qz * .6, face - 1.6, null); });
  act = 'giant'; src = 'giant'; (A.giants || []).forEach((g, k) => { const look = g.look === 'justice' ? CH.namedLook('justice') : L(g.look || CH.LOOKS[(g.seed ?? k) % CH.LOOKS.length].handle);   // (cast pass: Lady Justice is cast.js's gilded 'justice')
    put(look, g.x, g.y, g.z, g.ry ?? [0, Math.PI / 2, Math.PI, -Math.PI / 2][g.rot], g.look === 'justice' ? arms(-2.9, -2.9) : arms(0, -2.4), g.scale ?? 4); });
  const lean = (rg, o) => { arms(.15, .1)(rg); rg.legL.rotation.x = .25; o.rotation.x = -.13; };
  const added = GEN.override?.people?.add || [], fromFile = p => p.hand && added.some(q => q.x === p.x && q.z === p.z);
  // (a generator kerb scene — a cart and its vendor, a move, a yard sale, a domino table — seeds its people from where they stand: gen.js scene)
  // (crowd hold, SPREAD: since the seed pin a scene's seed is made from TODAY's place, unshift(x, z) — read on the world place it never matched
  // at a spread, so a kerb scene's vendor and helpers read as the generator's door crowd and retired)
  const isScene = p => { const [ux, uz] = unshift(p.x, p.z); return p.seed === ((ux * 97 + uz * 13) | 0); };
  let hk = 0; const nLife = (A.life || []).length; (A.shops?.length ? [...(A.life || []), ...A.shops] : A.life || []).forEach((p, k) => {   /* hardening: shop clerks last (interiors/store/fill.js), so no earlier id moves */ src = fromFile(p) ? 'override' : p.hand ? 'hand' : isScene(p) ? 'scene' : 'life'; const sd = (Math.imul(p.seed | 0, 2654435761) ^ ((p.hand ? 9000 + hk++ : k) * 40503) ^ (salt * 7919)) >>> 0, look = CH.rollLook(sd & 0xffffff, k >= nLife || NPC_ACTS.has(p.act) ? NPC : undefined), hl = HELD[p.act];   // (A.shops: the shops' people, after A.life)
    if (p.outfit && CH.OUTFITS?.[p.outfit]) CH.wear(look, CH.OUTFITS[p.outfit]);   // (cast pass: a set piece's uniform over the roll, cast.js OUTFITS: the jail's county issue and its officers)   // (cleanup pass: a hand-placed person's look depends on its own seed and place in the hand list only, never on how many people generation made)
    if (hl) { const id = hl[sd % hl.length]; if (id !== 'none') look.held = { id }; }
    const y = p.y ?? SIDE, sy = (p.seatY ?? .5) - .5, P = (dy, fn) => { act = p.act || 'stand'; put(look, p.x, y + dy, p.z, p.ry, fn); if (p.hand) out[out.length - 1].hand = true; };
    switch (p.act) {
      case 'sit': P(sy, sit()); break;
      case 'lounge': P(-.12, (rg, o) => { sit(-1.35, .35)(rg); o.rotation.x = -.35; }); break;
      case 'soak': P(-.38, sit(-1.4, -.2)); break;
      case 'fe': P(-.45, sit(-1.3, -.3)); break;
      case 'window': P(0, arms(-1.35, -1.2)); break;
      case 'dance': P(0, party(k)); break;
      case 'dj': P(0, arms(-1.15, -1.25)); break;
      case 'shoot': P(0, arms(-2.9, -2.8)); break;
      case 'garden': P(0, (rg, o) => { arms(-1.1, -.9)(rg); o.rotation.x = .28; }); break;
      case 'reach': P(0, arms(-2.5, -2.3)); break;
      case 'arms': P(0, arms(-1.3, -.35)); break;
      case 'talk': P(0, arms(-.55, 0)); break;
      case 'talk2': P(0, arms(0, -.8)); break;
      case 'phone': P(0, arms(0, -2.3)); break;
      case 'carry': P(0, arms(-.25, -.15)); break;
      case 'lean': P(0, lean); break;
      case 'walk': P(0, (rg, o) => CH.pose(o, 1.2, 1)); break;
      default: P(0, null);
    } });
  return out;
}
