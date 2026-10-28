// NPC POOL · tops (slot 'top'). What the city's ordinary people wear to work and on their day off: suits and ties, shirts, blouses,
// cardigans, polos, work shirts, overalls, a faded hi-vis, a deli apron, scrubs, a guard's shirt, a delivery uniform, plain tees,
// a fleece, a windbreaker, a trench. Muted colours from the civilian palette (kit.js CIV), plain shapes: every detail (a tie, a
// placket, a pocket, an apron) is the shell recoloured, never a print, a logo or lettering, never fine paint, never metal. Built
// with tops.js's own construction (copied into kit.js): the torso shell and the sleeve rule (one box per arm, one proud at most).
// README § The NPC pool and § Tops. The only import allowed is './kit.js'.
import { shell, sleeves, hem, vee, collarWings, shade, CIV } from './kit.js';
const FRONT = 3;                                                  // the shell's front face (z 3)
const tieAt = (x, y) => (x === -1 || x === 0) && y >= 11 && y <= 17;   // a tie down the middle of the chest, knot at the collar
const opening = (x, y) => y >= 12 && Math.abs(x + .5) <= (y - 10) / 2.4;   // a jacket's V opening, widening to the collar

export default {
  // ───────────────────────── office
  npc_top_suit_navy: { name: 'Civilian · navy suit + tie', tier: 'common', neckline: 'collar', why: 'office · navy two-button suit, white shirt, a burgundy tie',
    draw(B, ctx) { const J = CIV.navy, S = CIV.white, T = CIV.burgundy;
      shell(B, (x, y, z) => z === FRONT && tieAt(x, y) ? T : z === FRONT && opening(x, y) ? S : y === 9 ? shade(J, .9) : J, { neck: false }); collarWings(B, S, FRONT);
      sleeves(ctx, (lx, ly) => ly === 1 ? S : J, { y0: 10 }); } },
  npc_top_suit_charcoal: { name: 'Civilian · charcoal suit', tier: 'common', neckline: 'collar', why: 'office · charcoal suit, pale blue shirt, a navy tie',
    draw(B, ctx) { const J = CIV.charcoal, S = CIV.oxford, T = CIV.navy;
      shell(B, (x, y, z) => z === FRONT && tieAt(x, y) ? T : z === FRONT && opening(x, y) ? S : y === 9 ? shade(J, .9) : J, { neck: false }); collarWings(B, S, FRONT);
      sleeves(ctx, (lx, ly) => ly === 1 ? S : J, { y0: 10 }); } },
  npc_top_shirt_tie: { name: 'Civilian · short sleeves + tie', tier: 'common', neckline: 'collar', why: 'office · short-sleeved white shirt and a grey tie: the clerk at the Hall of Justice',
    draw(B, ctx) { const S = CIV.white, T = CIV.slate;
      shell(B, (x, y, z) => z === FRONT && tieAt(x, y) ? T : S, { neck: false }); collarWings(B, S, FRONT);
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(S, .92) : S, { y0: 13 }); } },
  npc_top_oxford: { name: 'Civilian · blue oxford', tier: 'common', neckline: 'collar', why: 'office · pale blue oxford, open collar, sleeves down',
    draw(B, ctx) { const S = CIV.oxford;
      shell(B, (x, y, z) => z === FRONT && x === -1 && y >= 10 ? shade(S, .9) : S, { neck: false }); collarWings(B, S, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 1 ? hem(S, .9) : S, { y0: 10 }); } },
  npc_top_blouse: { name: 'Civilian · cream blouse', tier: 'common', neckline: 'vee', why: 'office · a cream blouse, a small V, long sleeves',
    draw(B, ctx) { const S = CIV.cream; shell(B, (x, y) => y === 9 ? hem(S, .94) : S, { skip: vee }); sleeves(ctx, (lx, ly) => ly === 1 ? hem(S, .92) : S, { y0: 10 }); } },
  npc_top_blouse_mauve: { name: 'Civilian · mauve blouse', tier: 'common', neckline: 'crew', why: 'office · a dusty mauve blouse, short sleeves: the bank teller',
    draw(B, ctx) { const S = CIV.mauve; shell(B, (x, y) => y === 9 ? hem(S, .94) : S); sleeves(ctx, (lx, ly) => ly === 4 ? hem(S, .9) : S, { y0: 13 }); } },
  npc_top_cardigan: { name: 'Civilian · cardigan', tier: 'common', neckline: 'vee', why: 'office · a beige cardigan, open over a white tee',
    draw(B, ctx) { const K = CIV.beige, T = CIV.white;
      shell(B, (x, y, z) => z === FRONT && (x === -1 || x === 0) ? T : y === 9 ? hem(K, .9) : K, { skip: vee }); sleeves(ctx, (lx, ly) => ly === 1 ? hem(K, .88) : K, { y0: 10 }); } },
  npc_top_polo: { name: 'Civilian · polo', tier: 'common', neckline: 'collar', why: 'weekend · a sage polo, two buttons done: dad at the hardware store',
    draw(B, ctx) { const P = CIV.sage;
      shell(B, (x, y, z) => z === FRONT && x === -1 && y >= 15 ? shade(P, .88) : P, { neck: false }); collarWings(B, shade(P, .94), FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(P, .88) : P, { y0: 13 }); } },
  npc_top_trench: { name: 'Civilian · trench coat', tier: 'common', neckline: 'collar', why: 'office · a beige trench, belted, collar up against the bay wind',
    draw(B, ctx) { const C = CIV.khaki;
      shell(B, (x, y, z) => y === 11 ? shade(C, .8) : z === FRONT && (x === -3 || x === 2) && (y === 13 || y === 15) ? shade(C, .72) : C, { neck: false }); collarWings(B, C, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 1 ? hem(C, .86) : C, { y0: 10 }); } },

  // ───────────────────────── trades
  npc_top_work_shirt: { name: 'Civilian · work shirt', tier: 'common', neckline: 'collar', why: 'trades · a tan work shirt, two chest pockets, sleeves rolled',
    draw(B, ctx) { const W = CIV.tan, D = shade(CIV.tan, .84);
      shell(B, (x, y, z) => z === FRONT && y >= 13 && y <= 14 && ((x >= -4 && x <= -2) || (x >= 1 && x <= 3)) ? D : W, { neck: false }); collarWings(B, W, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly <= 5 ? D : W, { y0: 13 }); } },
  npc_top_overalls: { name: 'Civilian · overalls', tier: 'common', neckline: 'crew', why: 'trades · denim bib overalls over a grey tee: the painter, the super',
    draw(B, ctx) { const D = CIV.denim, T = CIV.heather;
      const bib = (x, y, z) => (y <= 10) || (z === FRONT && x >= -3 && x <= 2 && y <= 15) || ((x === -4 || x === -3 || x === 2 || x === 3) && y >= 16 && Math.abs(z) === 3);
      shell(B, (x, y, z) => bib(x, y, z) ? D : T); sleeves(ctx, (lx, ly) => ly === 4 ? hem(T, .9) : T, { y0: 13 }); } },
  npc_top_hivis: { name: 'Civilian · faded hi-vis', tier: 'common', neckline: 'crew', why: 'trades · a sun-faded safety vest over a grey long sleeve: road crew on Route 9',
    draw(B, ctx) { const V = CIV.hivis, R = CIV.lightgrey, G = CIV.grey;
      shell(B, (x, y, z) => (x <= -6 || x >= 5) && y >= 14 ? G : (y >= 17 && (x <= -4 || x >= 3)) ? G : (y === 12 || y === 15) ? R : V);
      sleeves(ctx, (lx, ly) => ly === 1 ? hem(G, .86) : G, { y0: 10 }); } },

  // ───────────────────────── service
  npc_top_deli_apron: { name: 'Civilian · deli apron', tier: 'common', neckline: 'crew', why: 'service · a long white apron over a grey tee: the counter man at the corner deli',
    draw(B, ctx) { const A = CIV.white, T = CIV.slate;
      shell(B, (x, y, z) => (z === FRONT && x >= -4 && x <= 3 && y <= 15) || (z === FRONT && (x === -3 || x === 2) && y >= 16) || (y === 11 && Math.abs(z) < 3) ? A : T);
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(T, .88) : T, { y0: 13 }); } },
  npc_top_scrubs: { name: 'Civilian · scrubs', tier: 'common', neckline: 'vee', why: 'service · plain teal scrubs: St. Mercy, the night shift',
    draw(B, ctx) { const S = CIV.teal; shell(B, (x, y, z) => z === FRONT && x >= 1 && x <= 3 && y === 14 ? shade(S, .86) : S, { skip: vee });
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(S, .88) : S, { y0: 13 }); } },
  npc_top_security: { name: 'Civilian · guard shirt', tier: 'common', neckline: 'collar', why: 'service · a grey guard shirt, dark epaulettes: the lobby desk at the towers',
    draw(B, ctx) { const S = CIV.grey, E = CIV.charcoal;
      shell(B, (x, y, z) => z === FRONT && y === 15 && ((x >= -4 && x <= -2) || (x >= 1 && x <= 3)) ? shade(S, .85) : S, { neck: false }); collarWings(B, S, FRONT);
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(S, .88) : ly >= 7 ? E : S, { y0: 13 }); } },
  npc_top_delivery: { name: 'Civilian · delivery uniform', tier: 'common', neckline: 'collar', why: 'service · a brown uniform shirt: parcels up the walk-ups',
    draw(B, ctx) { const U = CIV.camel, D = CIV.brown;
      shell(B, (x, y) => y >= 16 ? D : U, { neck: false }); collarWings(B, D, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 4 ? hem(U, .88) : ly >= 7 ? D : U, { y0: 13 }); } },

  // ───────────────────────── everyday: students, joggers, retirees, tourists, parents
  npc_top_tee_grey: { name: 'Civilian · grey tee', tier: 'common', neckline: 'crew', why: 'everyday · a plain heather-grey tee',
    draw(B, ctx) { const G = CIV.heather; shell(B, G); sleeves(ctx, (lx, ly) => ly === 4 ? hem(G, .9) : G, { y0: 13 }); } },
  npc_top_tee_white: { name: 'Civilian · white tee', tier: 'common', neckline: 'crew', why: 'everyday · a plain off-white tee, nothing on it',
    draw(B, ctx) { const W = CIV.white; shell(B, W); sleeves(ctx, (lx, ly) => ly === 4 ? hem(W, .92) : W, { y0: 13 }); } },
  npc_top_tee_navy: { name: 'Civilian · navy tee', tier: 'common', neckline: 'crew', why: 'everyday · a plain navy tee: the student with the backpack',
    draw(B, ctx) { const N = CIV.navy; shell(B, N); sleeves(ctx, (lx, ly) => ly === 4 ? hem(N, .85) : N, { y0: 13 }); } },
  npc_top_sweater: { name: 'Civilian · crew sweater', tier: 'common', neckline: 'crew', why: 'everyday · a burgundy crew-neck sweater, ribbed hem and cuffs: the student',
    draw(B, ctx) { const S = CIV.burgundy; shell(B, (x, y) => y === 9 ? shade(S, .85) : S); sleeves(ctx, (lx, ly) => ly === 1 ? shade(S, .85) : S, { y0: 10 }); } },
  npc_top_fleece: { name: 'Civilian · quarter-zip fleece', tier: 'common', neckline: 'high', why: 'everyday · a dusty-blue quarter-zip fleece: dad, any season',
    draw(B, ctx) { const F = CIV.dusty;
      shell(B, (x, y, z) => z === FRONT && x === -1 && y >= 15 ? shade(F, .8) : F, { y0: 9, neck: false });
      for (let x = -3; x <= 2; x++) { B.set(x, 18, 4, F); B.set(x, 17, 4, F); }   // the funnel collar
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(F, .88) : F, { y0: 10 }); } },
  npc_top_windbreaker: { name: 'Civilian · windbreaker', tier: 'common', neckline: 'collar', why: 'everyday · an olive windbreaker zipped half up: the tourist on the ferry, the jogger',
    draw(B, ctx) { const W = CIV.olive;
      shell(B, (x, y, z) => z === FRONT && x === -1 && y >= 10 ? shade(W, .82) : y === 9 ? shade(W, .88) : W, { neck: false }); collarWings(B, W, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(W, .86) : W, { y0: 10 }); } },
  npc_top_running: { name: 'Civilian · running top', tier: 'common', neckline: 'crew', why: 'everyday · a slate long-sleeve running top: the morning jogger in the park',
    draw(B, ctx) { const R = CIV.slate; shell(B, (x, y) => y === 9 ? shade(R, .88) : R); sleeves(ctx, (lx, ly) => ly === 1 ? shade(R, .88) : R, { y0: 10 }); } },
};
