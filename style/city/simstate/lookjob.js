// SIM LIVE pass · the look-bake job, run in a worker of its own (looks.js makes a one-worker pool.js pool with this as its entry: worker.js
// hands every job that isn't 'far' or 'peds' to the entry's jobBlock). A bake is ~5–20 ms of chars.js building, never on the frame.
import * as CH from '../cast.js';   // (cast pass, 2026-10-02: the city's cast: the fresh construction and the traits slime didn't kill)
import { bake } from './looks.js';
export const installModules = () => ({ errors: [] });
export function jobBlock(job) { return bake(CH, job.look); }
