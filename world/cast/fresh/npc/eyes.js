// NPC POOL · eyes (slot 'eyes'). Plain faces: small dark pupils, a thin brow, no lashes, no colour, no ink, no special shapes. The
// agents' eyes are expressive designs; a civilian's are the city's background face. README § The NPC pool. Only import: './kit.js'.
export default {
  npc_eyes_dots: { name: 'Civilian · dot eyes', tier: 'common', why: 'two dark dots and a thin brow: the background face',
    rows: ['.....', '.PP..', '.PP..', '.....'], brow: ['.....', '.BBB.', '.....'] },
  npc_eyes_plain: { name: 'Civilian · plain eyes', tier: 'common', why: 'whites and a pupil, nothing else going on',
    rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.....'] },
  npc_eyes_tired: { name: 'Civilian · tired eyes', tier: 'common', why: 'half-lidded: the end of a double shift',
    rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', '.....', '.BBB.'] },
};
