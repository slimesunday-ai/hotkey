// THE BAY · hero · THE WRECK (block 6,−12) · owner: the water-side agent (batch 5).
// Off Iron Island's north-west rocks a trawler went down by the stern and stayed: the bow up at 22°, rust with the old teal showing, the
// wheelhouse leaning with it, a snapped boom, surf where it meets the water, gulls along the rail and two over it. The island's keep-off
// buoy rides beyond it (the kit's buoys). Nobody swims off Iron Island twice.
import { kitNow } from '../gen.js';
import { seaHero, wreck } from '../districts/sea/bay.js';

export function wreckBlock(bank, b, A) { seaHero(bank, b, A, kitNow(), wreck); }
