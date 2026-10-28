// BLACKPINE WOODS · the sign log (owner: the Blackpine Woods agent). Every board the kit paints is logged for the audit's sign-repeat
// check (tools/audit.mjs: the same words within 96 m; regulatory plates like KEEP OUT or NO TRESPASSING never count).
import { REG } from '../../audit.js';
export function logSign(key, x, z, r = 96) { const b = REG.blk; if (!b || !key) return; (b.signs ??= []).push({ fam: 'kit', key: String(key), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r, group: b.group }); }
