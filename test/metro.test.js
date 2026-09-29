const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');
const { findRustDir, withRust, stopRustWatcher } = require('../dist/metro.js');

const cliPath = path.resolve(__dirname, '../dist/react-native-rust.js');
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createInitializedLibrary() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-metro-'));
  temporaryDirectories.push(directory);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    name: 'react-native-rust-metro-demo',
    peerDependencies: { 'react-native': '>=0.76' },
    codegenConfig: { name: 'RustMetroDemoSpec', type: 'modules', jsSrcsDir: 'src' },
  }));
  fs.writeFileSync(path.join(directory, 'react-native.config.js'), "module.exports = { dependency: { platforms: { android: { cxxModuleHeaderName: 'RustMetroDemoImpl', cxxModuleCMakeListsPath: 'CMakeLists.txt' } } } };");
  fs.mkdirSync(path.join(directory, 'cpp'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'android'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'cpp/RustMetroDemoImpl.h'), '#pragma once\n\n#include <RustMetroDemoSpecJSI.h>\n\n#include <memory>\n\nnamespace facebook::react {\n\nclass RustMetroDemoImpl : public NativeRustMetroDemoCxxSpec<RustMetroDemoImpl> {\n public:\n  RustMetroDemoImpl(std::shared_ptr<CallInvoker> jsInvoker);\n\n  double multiply(jsi::Runtime& rt, double a, double b);\n};\n\n}\n');
  fs.writeFileSync(path.join(directory, 'cpp/RustMetroDemoImpl.cpp'), '#include "RustMetroDemoImpl.h"\n\nnamespace facebook::react {\n\nRustMetroDemoImpl::RustMetroDemoImpl(std::shared_ptr<CallInvoker> jsInvoker)\n    : NativeRustMetroDemoCxxSpec(std::move(jsInvoker)) {}\n\ndouble RustMetroDemoImpl::multiply(jsi::Runtime& rt, double a, double b) {\n  return a * b;\n}\n\n}\n');
  fs.writeFileSync(path.join(directory, 'src/NativeRustMetroDemo.ts'), "import { TurboModuleRegistry, type TurboModule } from 'react-native';\n\nexport interface Spec extends TurboModule {\n  multiply(a: number, b: number): number;\n}\n");
  fs.writeFileSync(path.join(directory, 'src/index.tsx'), "export { multiply } from './multiply';\n");
  fs.writeFileSync(path.join(directory, 'android/CMakeLists.txt'), 'add_library(\n  react_native_rust_metro_demo\n  STATIC\n  ../cpp/RustMetroDemoImpl.cpp\n)\n\ntarget_link_libraries(\n  react_native_rust_metro_demo\n  jsi\n  reactnative\n)\n');
  fs.writeFileSync(path.join(directory, 'RustMetroDemo.podspec'), 'Pod::Spec.new do |s|\n  s.source_files = "cpp/**/*.{h,cpp}"\nend\n');

  const initResult = spawnSync(process.execPath, [cliPath, 'init'], { cwd: directory, encoding: 'utf8' });
  assert.equal(initResult.status, 0, initResult.stderr);
  return directory;
}

test('findRustDir resolves the project-root rust/ directory (library mode and app-local mode both use it), and null when missing', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-metro-empty-'));
  temporaryDirectories.push(empty);
  assert.equal(findRustDir(empty), null);

  const library = createInitializedLibrary();
  assert.equal(findRustDir(library), path.join(library, 'rust'));

  const appLike = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-metro-app-'));
  temporaryDirectories.push(appLike);
  const appRust = path.join(appLike, 'rust');
  fs.mkdirSync(appRust, { recursive: true });
  fs.writeFileSync(path.join(appRust, 'Cargo.toml'), '[package]\nname = "fixture"\n');
  assert.equal(findRustDir(appLike), appRust);
});

test('withRust adds the Rust directory to watchFolders without duplicating an existing entry', () => {
  const library = createInitializedLibrary();
  const rustDir = path.join(library, 'rust');

  const config = withRust({ projectRoot: library });
  assert.deepEqual(config.watchFolders, [rustDir]);

  const alreadyWatching = withRust({ projectRoot: library, watchFolders: [rustDir, '/other'] });
  assert.deepEqual(alreadyWatching.watchFolders, [rustDir, '/other']);
});

test('withRust chains an existing server.enhanceMiddleware instead of replacing it', async () => {
  const library = createInitializedLibrary();
  const calls = [];
  const config = withRust({
    projectRoot: library,
    server: {
      enhanceMiddleware: (middleware, server) => {
        calls.push([middleware, server]);
        return 'wrapped-middleware';
      },
    },
  });

  // enhanceMiddleware() also spawns the real watcher as a side effect; stop it before the
  // fixture directory is removed, or the leaked child is left pointing at a deleted cwd.
  let result;
  try {
    result = config.server.enhanceMiddleware('original-middleware', 'the-server');
  } finally {
    await stopRustWatcher();
  }
  assert.deepEqual(calls, [['original-middleware', 'the-server']]);
  assert.equal(result, 'wrapped-middleware');
});

test('withRust starts the watch command on enhanceMiddleware, and it actually rebuilds on a Rust change', async () => {
  const library = createInitializedLibrary();
  const markerPath = path.join(library, 'cargo-calls.log');
  fs.writeFileSync(markerPath, '');
  const fakeBinDirectory = path.join(library, '.fake-bin');
  fs.mkdirSync(fakeBinDirectory);
  const fakeCargoPath = path.join(fakeBinDirectory, 'cargo');
  fs.writeFileSync(fakeCargoPath, [
    '#!/usr/bin/env node',
    "const fs = require('node:fs');",
    `fs.appendFileSync(${JSON.stringify(markerPath)}, 'build\\n');`,
    '',
  ].join('\n'));
  fs.chmodSync(fakeCargoPath, 0o755);

  // The spawned child inherits process.env at spawn time, so PATH must be set before
  // enhanceMiddleware() (which spawns it) is called.
  const previousPath = process.env.PATH;
  process.env.PATH = `${fakeBinDirectory}${path.delimiter}${previousPath}`;
  const config = withRust({ projectRoot: library });

  try {
    config.server.enhanceMiddleware(null, null);
    // Give the spawned watcher time to boot and start watching before the first save.
    await new Promise((resolve) => { setTimeout(resolve, 1000); });
    fs.writeFileSync(path.join(library, 'rust/src/api/multiply.rs'), 'pub fn multiply(a: f64, b: f64) -> f64 {\n    a * b * 2.0\n}\n');

    const start = Date.now();
    while (fs.readFileSync(markerPath, 'utf8').trim().length === 0) {
      if (Date.now() - start > 8000) throw new Error('Timed out waiting for the Metro-spawned watcher to rebuild.');
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { setTimeout(resolve, 50); });
    }
  } finally {
    process.env.PATH = previousPath;
    await stopRustWatcher();
  }
});
