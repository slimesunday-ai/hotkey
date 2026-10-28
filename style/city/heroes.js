// Hero set pieces (pass 1d): one module per location under heroes/ so each location agent owns exactly one file.
// Pass 2: nothing may import the heroes statically (one broken hero used to stop every page). Each hero is listed in manifest.js,
// loaded on its own by modules.js, and dispatched through its district kit's hero slot (districts/<name>.js: heroes). This file
// is kept only so old links resolve; it exports nothing.
export {};
