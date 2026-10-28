// C1-6 · the clips each staged kind of the show may play: the named agent's own (loops.js SHOW_LOOPS) and the stage's (stage/record.js).
// Node-safe (no three.js), for tools/showscenario.mjs's "staged by its kind".
import { SHOW_LOOPS, BEAT_LOOPS } from '../simstate/record/loops.js';

// the clips each staged kind may play (the agent's own, from SHOW_LOOPS, and the stage's), for the scenario's "staged by its kind"
export const STAGE_CLIPS = Object.freeze({
  hit: ['rob_lunge_grab', 'punch', 'haymaker_wind', 'haymaker', 'stagger', 'cower', 'run_getaway', 'flee_run', 'winded_rest'],
  corner: ['rob_lunge_grab', 'punch', 'haymaker_wind', 'haymaker', 'stagger', 'cower', 'run_getaway', 'flee_run', 'winded_rest'],
  breakin: ['pick_lock', 'creep_walk', 'flashlight_search', 'lookout_wave', 'run_getaway', 'flee_run'],
  // C1-7: a grab's set (grab.md: the scramble, crate_tug ⇄ crate_tug_lose, crate_ram ⇄ crate_rammed into the fall, crate_run off; a lost
  // one's struggle) and the vault's (heist.md: vault_shove ⇄ guard_bowled into the fall, vault_drill, vault_heave, loot_carry, the lookout)
  grab: ['punch', 'haymaker_wind', 'haymaker', 'stagger', 'crate_lift', 'crate_run', 'winded_rest', 'lookout_wave', 'crate_tug', 'crate_tug_lose', 'crate_ram', 'crate_rammed',
    'shove_fall', 'lie_hurt', 'scuffle_pair', 'scuffle_partner', 'guarded_walk', 'run_getaway', 'flee_run'],
  vault: ['vault_shove', 'guard_bowled', 'shove_fall', 'lie_hurt', 'vault_drill', 'vault_heave', 'loot_carry', 'lookout_wave', 'scuffle_pair', 'scuffle_partner', 'guard_post',
    'deal_lookout', 'run_getaway', 'flee_run', 'winded_rest'],
  collar: ['scuffle_pair', 'scuffle_partner', 'stagger', 'cower', 'winded_rest', 'patrol_walk'],
  arrest: ['cuff_apply', 'cuffed_idle', 'cuffed_walk'],
  hooded: ['creep_walk', 'deal_lookout', 'lookout_wave'],
  // C1-7, night 14 (SHOW.md "Finale and day 15"): a walk arrives as a boarder does (loops.js SHOW_LOOPS.walk; an unnamed walker's
  // stand-in the same); the ferry's dockhand waves her off
  walk: ['evicted_carry', 'deal_lookout'],
  ferry: ['lookout_wave'],
  // C1-7d: a boarding (the queue on the quay, up the gangway with everything it owns) and the missed boat (at the empty berth, or in jail)
  board: ['evicted_carry', 'deal_lookout'],
  missed: ['deal_lookout'],
  partner: ['hands_up_point', 'cower', 'hit_stumble_back', 'spaced_drift', 'brush_pass', 'deal_lookout', 'smoke', 'listen_nod'],
});
const loopsOf = sc => [...(SHOW_LOOPS[sc.variant ? `hustle:${sc.variant}` : sc.kind] ?? SHOW_LOOPS.default).map(([c]) => c),
  ...(sc.beats || []).flatMap(b => (BEAT_LOOPS[`${sc.kind}:${b.name}`] || []).map(([c]) => c)), ...(sc.beats && sc.kind === 'run' ? ['crate_run'] : [])];
export const clipsFor = sc => sc.beat === 'ambient' && sc.kind !== 'hooded' ? [...loopsOf(sc), ...(sc.kind === 'laylow' ? ['lean_wall'] : [])]
  : sc.kind === 'hooded' ? STAGE_CLIPS.hooded : STAGE_CLIPS[sc.kind] ?? [];

