// AI CITY world v2 — palettes. Every environment colour in tiles, props, signs, sky and light passes through
// the active palette (?pal=<name>): an explicit map from the base colour, then a fallback transform for the rest.
// Characters are never recoloured, so the PFP look stays fixed and pops against any palette.

const hexToHsl = h => { const v = parseInt(h.slice(1), 16), r = (v >> 16) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [hh * 60, s, l]; };
const hslToHex = (h, s, l) => { h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };

// Springfield: flat pastel-pop local colours, warm neutrals, purple-grey roads, cool purple bounce light
const SPRINGFIELD = {
  map: {
    '#7cb65a': '#8fd14f', '#8fc66b': '#a6e063', '#9c6d48': '#c07a4a', '#7a5a40': '#8e5f3e', '#a8a296': '#cbbfae', '#e4d09c': '#f4d98a', '#8f9195': '#9a93a8',
    '#46474d': '#4e4b5c', '#4f5057': '#57546a', '#3f4046': '#46435a', '#55565c': '#5d5a6e', '#e7c24a': '#ffd23f', '#e6e4dc': '#fff6e8', '#e9e7e0': '#fff6e8', '#5a5a5c': '#5e5870',
    '#cfcac0': '#e0d3c3', '#b7b2a7': '#c8b8a6', '#dcd7ce': '#ecdfcf', '#d9c7a8': '#f0c98f', '#bfae90': '#d9ae78', '#b86b50': '#e0745a', '#9a5540': '#c05a45',
    '#bdb9b0': '#d8cbb8', '#8f8c86': '#9d8f9e', '#aaa69d': '#c4b7a4', '#5f7f6a': '#4fa37a', '#b9674a': '#e0704a',
    '#b04e37': '#d9583c', '#d8ccbc': '#f0dcc4', '#7f503b': '#a45a3c', '#c9b9a5': '#e2c9aa', '#c89c69': '#f0b56a', '#e5d8c2': '#fbe7c8', '#e7e2d8': '#f5ecdc',
    '#5c3b34': '#6e3f4a', '#d8b456': '#f5c945',
    '#efebe1': '#fbf3e4', '#8fb2d2': '#7fc3f0', '#e8d48c': '#ffd966', '#a6cfad': '#8fe0a8', '#e7abb3': '#f59bb5', '#d8caa6': '#f2c99a', '#a8adb4': '#b3a3d9', '#b8574a': '#e0654f', '#6fa3a0': '#4fc2b4',
    '#f4f1ea': '#fffaf0', '#e8dcc3': '#ffd9a8', '#e8b8a3': '#ff9f8a', '#b8dcc8': '#9ff0c8', '#d8d1c2': '#efdcbc', '#b9b09e': '#d6b98f', '#f2f0ea': '#fbf6ee', '#d7a735': '#ffc12e',
    '#c7c3ba': '#dccfbd', '#a9a59b': '#aaa3bd', '#d9c24a': '#ffcf33',
    '#a8acb2': '#a9b3cf', '#5b7fa4': '#4f8fd9', '#6b8d6b': '#5fb06a', '#ddd4bd': '#f2dfb3', '#9a5a35': '#c9653a',
    '#e4e1d8': '#f3ecdf', '#e2cf8f': '#ffe08a', '#9fb9cf': '#8fcaf2', '#b3c7a0': '#b5e08f', '#d8c3a0': '#f2c99a', '#e2b53a': '#ffc72e',
    '#5a86ae': '#4fb0e8', '#4f8f8a': '#3fc2b0', '#34404f': '#34507f', '#8fa2b3': '#a9c4e8', '#6f98bf': '#6fc3f0', '#3b3f46': '#3d3552', '#3d5268': '#3e5f9a', '#cdbfa8': '#ecd6b0',
    '#a8c6dc': '#a8e3f7', '#6d93b5': '#5fb3e8', '#8a5a3a': '#b0602e', '#9c3b33': '#e0453a', '#35557a': '#3f6fcf', '#eeeae1': '#fbf1e0',
    '#4c4f58': '#5e5a6e', '#6d4b3b': '#8f5a3a', '#99403a': '#d0513d', '#50695a': '#3f9a78', '#4a6080': '#3f6fcf', '#b8733f': '#ec8a3f', '#5d5d61': '#6f687e', '#dcdcd6': '#efe6dc', '#9aa1a7': '#a3b0c8',
    '#5ea347': '#6fc23f', '#6cb453': '#8fd64f', '#4d8c3b': '#4f9a33', '#9cb84a': '#c6d63f', '#d98f3a': '#ff9a33', '#3d6e45': '#2f8a57', '#4f8f40': '#4faa3a', '#6e4c31': '#8a5530',
    '#4e9fd0': '#3fb4ea', '#5fc6e0': '#5fe0f0', '#2f5b9a': '#3f6fe0', '#c0392f': '#ef4433', '#2f7a4a': '#2fae5f', '#3d8fc4': '#3fa8e6', '#5aa8d8': '#6fc9f2', '#2f7db3': '#2f8fd0',
  },
  fallback(h, s, l, ch) { if (ch < .09) return l > .5 ? [32, .15 * Math.min(1, (1 - l) * 5), l] : [255, .13, l]; return [h, Math.min(.85, s * 1.25), .5 + (l - .5) * .9]; },
  key: [[0.00, '#0e1533', '#262a55', '#9fb2ff', .45, .55], [0.22, '#1a1f48', '#4a3f7a', '#ffb07a', .3, .55], [0.27, '#5a7fd6', '#ffb08a', '#ffc48f', 1.3, .95],
    [0.34, '#46a6ee', '#c9ecff', '#fff2d6', 2.1, 1.35], [0.50, '#3f9fe8', '#cdefff', '#fff5e2', 2.2, 1.4], [0.66, '#46a6ee', '#d6f0ff', '#ffecc8', 2.1, 1.35],
    [0.73, '#5a58b8', '#ff9a66', '#ff9a5a', 1.4, 1.0], [0.78, '#2a2463', '#7a3f7f', '#ff8a5a', .35, .6], [0.85, '#101838', '#2a2a5a', '#9fb2ff', .45, .55], [1.00, '#0e1533', '#262a55', '#9fb2ff', .45, .55]],
  hemiGround: '#8a6fb0', hemiGroundNight: '#2a2450',
  grade: { amt: .15, sat: 1.08, sh: '#6a5fd8', hi: '#ffd9a8' },
};

// Flash: the fit-check studio. Neutrals go clean white or near-black; colours snap to the backdrop set.
const BACKDROPS = ['#ff4fa3', '#2f5bff', '#ff7a1a', '#6cff4a', '#ffe23a', '#7cc3ff', '#c89bf5', '#ff3b30', '#008080'].map(hexToHsl);
const FLASH = {
  map: {
    '#7cb65a': '#5fcf3f', '#8fc66b': '#7fe05a', '#9c6d48': '#8a5a3a', '#46474d': '#26262b', '#4f5057': '#2c2c32', '#3f4046': '#222226', '#55565c': '#303036',
    '#e7c24a': '#ffe23a', '#e6e4dc': '#ededed', '#e9e7e0': '#ededed', '#cfcac0': '#dcdcdc', '#b7b2a7': '#c4c4c4', '#dcd7ce': '#e8e8e8',
    '#b04e37': '#ff3b30', '#7f503b': '#2f5bff', '#c89c69': '#ff7a1a', '#e7e2d8': '#ededed', '#5c3b34': '#161616', '#d8b456': '#ffe23a',
    '#d8ccbc': '#ffd2cc', '#c9b9a5': '#c9d6ff', '#e5d8c2': '#ffd9b8', '#cfc8bb': '#d6d6d6', '#8c7a6e': '#3a3a3a', '#ece0bf': '#fff5b8',
    '#efebe1': '#ededed', '#8fb2d2': '#7cc3ff', '#e8d48c': '#ffe23a', '#a6cfad': '#8ff07a', '#e7abb3': '#ff4fa3', '#d8caa6': '#ff9a5a', '#a8adb4': '#c89bf5', '#b8574a': '#ff3b30', '#6fa3a0': '#008080',
    '#4c4f58': '#161616', '#6d4b3b': '#2b2b2b', '#99403a': '#ff3b30', '#50695a': '#008080', '#4a6080': '#2f5bff', '#b8733f': '#ff7a1a', '#5d5d61': '#2a2a2e',
    '#5a86ae': '#2f5bff', '#4f8f8a': '#008080', '#34404f': '#161616', '#8fa2b3': '#7cc3ff', '#5ea347': '#3fbf3a', '#6cb453': '#6cff4a', '#4d8c3b': '#2f9a2f', '#d98f3a': '#ff7a1a', '#9cb84a': '#ffe23a',
    '#3d6e45': '#1f8a4a', '#4e9fd0': '#2f5bff', '#3d8fc4': '#2f6bff', '#5aa8d8': '#7cc3ff', '#2f7db3': '#2349c8',
  },
  fallback(h, s, l, ch) { if (ch < .12) return [0, 0, l > .5 ? .86 + (l - .5) * .2 : .1 + l * .35];
    let best = BACKDROPS[0], bd = 1e9; for (const b of BACKDROPS) { const d = Math.min(Math.abs(b[0] - h), 360 - Math.abs(b[0] - h)); if (d < bd) { bd = d; best = b; } } return [best[0], Math.max(.7, best[1] * .95), .35 + l * .45]; },
  key: [[0.00, '#07070c', '#15151c', '#c89bf5', .35, .45], [0.22, '#141225', '#3a2440', '#ff7a1a', .3, .5], [0.27, '#6f7fff', '#ffb0d0', '#ffc48f', 1.3, .95],
    [0.34, '#5aa6ff', '#e9f3ff', '#ffffff', 2.3, 1.3], [0.50, '#4f9dff', '#eef5ff', '#ffffff', 2.4, 1.35], [0.66, '#5aa6ff', '#f2f5ff', '#fff4e8', 2.3, 1.3],
    [0.73, '#8a4fd6', '#ff7a8a', '#ff7a1a', 1.4, 1.0], [0.78, '#241438', '#6a2a5a', '#ff4fa3', .35, .55], [0.85, '#08080e', '#16161e', '#c89bf5', .35, .45], [1.00, '#07070c', '#15151c', '#c89bf5', .35, .45]],
  hemiGround: '#7a7a86', hemiGroundNight: '#1a1a24',
};

export const PALETTES = { base: null, springfield: SPRINGFIELD, flash: FLASH };
const q = (() => { try { return new URLSearchParams(location.search).get('pal'); } catch { return null; } })();
export const PAL_NAME = q && q in PALETTES ? q : 'springfield';   // slime's pick, 2026-09-23
export const PAL = PALETTES[PAL_NAME];
const memo = new Map();
// c('#rrggbb') → palette colour (strings pass through untouched if they aren't plain hex)
export function c(hex) {
  if (!PAL || typeof hex !== 'string' || hex[0] !== '#' || hex.length !== 7) return hex; const k = hex.toLowerCase(); let v = memo.get(k); if (v) return v;
  const n = parseInt(k.slice(1), 16), ch = (Math.max(n >> 16, (n >> 8) & 255, n & 255) - Math.min(n >> 16, (n >> 8) & 255, n & 255)) / 255;   // chroma: near-whites are neutral
  v = PAL.map[k] || hslToHex(...PAL.fallback(...hexToHsl(k), ch)); memo.set(k, v); return v;
}
export const ci = n => (PAL ? parseInt(c('#' + n.toString(16).padStart(6, '0')).slice(1), 16) : n);   // same for 0xRRGGBB ints
