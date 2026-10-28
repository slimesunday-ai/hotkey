// Shared by the page and the build workers: where `three` lives, and the import-specifier pattern the source bundler rewrites.
export const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';
export const ADDONS_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/';
export const FROM_RE = /((?:^|[\s;{}])(?:import|export)\s[^'"`;]*?from\s*|(?:^|[\s;{}])import\s*)(['"])([^'"]+)\2/g;
