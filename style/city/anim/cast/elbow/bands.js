// ELBOW · the band tags, a shared bake helper any bend style may call from its bake() (styles.js § THE BAND TAGS). A module of its
// own: the styles import it, and styles.js imports the styles, so it can't live in styles.js (an import cycle; the city's worker
// bundler refuses cycles, tools/sync-cast.mjs).
// Every arm face that spans a band of rows (±x, ±z faces)
// tells each of its four vertices whether the face lies above or below it, in aPart's spare fraction (walk2.js decodes it as `band`).
// aPart = part + hold / 64 + band / 1024: whole-part readers (the overlap check, the pixel gate) and the grip decode are unchanged.
export function tagBands(full) {
  const n = full.P.length / 3, K = full.K instanceof Float32Array ? full.K : Float32Array.from(full.K);
  for (let f = 0; f < n; f += 4) { const part = Math.floor(K[f] + .5); if (part !== 3 && part !== 4) continue;
    let y0 = 1e9, y1 = -1e9; for (let v = f; v < f + 4; v++) { const y = full.P[v * 3 + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const h = y1 - y0; if (h < 1e-6) continue; const fine = h < .04 ? 2 : 0;
    for (let v = f; v < f + 4; v++) { const up = full.P[v * 3 + 1] < (y0 + y1) / 2; K[v] = Math.round((K[v] - Math.floor(K[v] + .5)) * 64) / 64 + part + (1 + (up ? 0 : 1) + fine) / 1024; } }
  full.K = K; return full;
}
