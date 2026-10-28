import { setGameMinute } from '../simclock.js';

// Same writable line as the tape player. `at` and `pageT` are real seconds, rate game minutes/second.
export function writeClock(clock, minute, { speed, running, epoch }) {
  setGameMinute(60 / speed);
  Object.assign(clock, { t: minute, at: clock.pageT, rate: running ? speed / 60 : 0, running, epoch });
}
