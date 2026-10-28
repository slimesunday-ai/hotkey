# Performance foundation (pass 1c)

## Architecture
- **Streaming** (`stream.js`): only blocks within the draw distance exist. The haze closes at 0.92 × the draw distance (pass 1d), so blocks appear and disappear behind it. Each block picks a tier by distance, with budgets and hysteresis, and always shows the best tier it already has, so nothing pops in empty.
- **Dissolves** (pass 1d): a new block, or a new tier, dithers in over 0.5 s while the old tier dithers out in the complementary pattern. They run on pooled clones of the tier materials that share the compiled program, so there are no recompiles and no extra draw calls once a fade ends. Shots skip them.
- **Block tiers**, all in the same cube grammar:
  - **near:** the full 0.1 build
  - **mid:** voxels downsampled 2×, one mesh per block; set pieces stay full
  - **far:** 0.5 cubes built from the spec pass (`far.js`), a few ms per block
- **Character tiers**, per 16 m cluster (`charbake.js`):
  - **full:** `chars.js` bodies, capped at 24, 60 or 120 by preset
  - **mid:** the posed voxels resampled to 0.1 cubes
  - **far:** three boxes each, in one instanced draw
- **Workers** (`pool.js`, `worker.js`, `jobs.js`): builds and character bakes run off the main thread, with `world/chars.js` loaded unedited.
- **Cache** (`cache.js`): IndexedDB, one record per block per tier, keyed by a hash of the job sources.
- **Presets:** `?q=low|medium|high|auto` sets draw distance (330/460/640 m), tier budgets, character caps, shadow map (1K/2K/4K, cached) and pixel ratio. **Auto** reads the GPU name. **Dynamic resolution** follows GPU timer queries.
- **`?stress=1`** builds every urban block. **`?bench=1`** flies overview, avenue, side street and a stress fly-over, then shows a panel.

## Measured (M3 Ultra, headless Chrome, 1080p)
Frame p50 is vsync-capped at 16.7 ms, so GPU time is the real cost.

| preset | view | calls | tris (M) | GPU p50/p95 ms | frame p95 ms |
|---|---|---|---|---|---|
| medium | overview (default) | 96 | 2.03 | 1.16 / 1.60 | 21 |
| medium | avenue | 140 | 3.13 | 0.97 / 1.49 | 19 |
| medium | side street | 107 | 2.55 | 0.81 / 1.32 | 19 |
| medium | stress fly-over | 106 | 2.28 | 0.82 / 1.50 | 21 |
| high | stress fly-over | 122 | 4.02 | 1.13 / 2.12 | 21 |
| low, 4× CPU throttle | stress fly-over | 87 | 1.84 | 0.68 / 1.21 | 33 |

- **Stress overview at island scale:** 107 calls, 0.62M tris.
- **Pass 1b, for comparison:** overview 265 calls, 16.5M tris, GPU 4.1 ms.
- **Load, cold:** first view 1.3–1.6 s, fully streamed 2.7–3.0 s (was 5.3 s).
- **Load, warm:** first view 0.50 s, fully streamed 0.85 s.
- **Frame p95 spikes** are main-thread uploads while streaming, not GPU work.
- **Laptop, unmeasured:** an M1 Air is roughly 1/10 of this GPU, so near 12 ms on medium.

## On your laptop
1. Run `node style/serve.mjs 5320` on the laptop, or tunnel: `ssh -L 5320:127.0.0.1:5320 <studio>`.
2. Open `http://127.0.0.1:5320/style/city/?bench=1` in Chrome, full screen, and don't touch it for about 45 s.
3. Press **Copy results** and paste the block back.
4. Reload once and paste the second block as well; that one is the warm cache.
5. Optionally add `&q=low` or `&q=high`.

## Pass 1d re-run (medium, 1080p, cold cache)
| view | calls | tris (M) | GPU p50/p95 ms |
|---|---|---|---|
| overview | 96 | 1.98 | 1.16 / 1.52 |
| avenue | 141 | 2.88 | 1.01 / 1.49 |
| side street | 126 | 2.91 | 0.88 / 1.39 |
| stress fly-over | 118 | 3.17 | 0.94 / 1.62 |

- **Load:** first view 1.56 s, fully streamed 3.23 s.
- **`?blur=1`** adds two full-screen passes: an MSAA half-float scene target, then a separable 9-tap blur.
- **`?audit=1`** builds without the cache, with the checks in the workers: the section is fully streamed in 5.4 s.

## Pass 2 re-run (medium, 1080p, cold cache, `&nocache=1`)
| view | calls | tris (M) | GPU p50 ms |
|---|---|---|---|
| overview | 106 | 1.87 | 1.17 |
| avenue | 165 | 3.25 | 1.15 |
| side street | 140 | 2.59 | 0.86 |
| stress fly-over | 123 | 2.97 | 1.38 |

- **Load:** first view 1.99 s (pass 1d: 1.56 s), fully streamed 3.71 s (3.23 s).
- **Where the extra load time goes:** the whole island is now one universe of blocks (every district's far tier), the kits and heroes load as isolated modules, and the walkers bake 24 looks in a worker.
- **Walkers** add about 5 draw calls and 0.3–0.5M triangles near the camera: one BatchedMesh near, one mid, and one InstancedMesh far.
- **Budget for every district:** street views need 300 draw calls or fewer, and the first view must appear within about 2 s.
