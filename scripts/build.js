#!/usr/bin/env node

// Transpiles every src/**/*.ts file to dist/ with esbuild (fast, no type-checking).
// Each file is compiled independently (bundle: false) so the require() calls between
// dist/*.js files still resolve the same way they did between src/*.ts files. Run
// `npm run typecheck` (tsc --noEmit) separately to catch type errors.

const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

const srcDir = path.join(__dirname, '..', 'src');

function collectEntryPoints(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectEntryPoints(entryPath);
    return entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

esbuild.buildSync({
  entryPoints: collectEntryPoints(srcDir),
  outdir: path.join(__dirname, '..', 'dist'),
  outbase: srcDir,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  logLevel: 'info',
});
