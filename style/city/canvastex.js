// BLACK-GROUND FIX (2026-10-06) · A canvas texture that survives a GPU-process reset. When Chrome restarts its GPU process (a driver
// hiccup, memory pressure: slime's did while flying), the WebGL context AND every 2D canvas are lost; each canvas fires `contextlost`,
// then `contextrestored`, and comes back BLANK (in Chrome 153 every size, down to the 12 × 14 walk icons). three restores its context and
// re-uploads every texture from its image, so a canvas painted once went up transparent black: the ground (ground.js) turned black under
// intact buildings, the WALK / DON'T WALK icons, signal halos, night pools and contact blobs vanished. `paint(g)` draws the whole canvas
// from scratch (the canvas and its state are reset by then); it is run once now and again on every restore, and the texture re-uploads.
// release: a texture whose dispose is final (ground tiles) frees its canvas at once instead of leaving it to GC, and stops repainting.
// Worker-safe at module level (ground.js and traffic/lamps.js ride in the build workers' bundle); call it on the page only.
import * as THREE from 'three';
export function paintedTexture(w, h, paint, { release = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; paint(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv), redo = () => { paint(cv.getContext('2d')); t.needsUpdate = true; };
  cv.addEventListener('contextrestored', redo);
  if (release) t.addEventListener('dispose', () => { cv.removeEventListener('contextrestored', redo); cv.width = cv.height = 0; });
  return t;
}
