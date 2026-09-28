const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { afterEach, test } = require('node:test');
const { build } = require('../dist/react-native-rust-lib.js');

const cliPath = path.resolve(__dirname, '../dist/react-native-rust.js');
const temporaryDirectories = [];

function createLibrary({ cppModule = true, scripts = {} } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-cli-'));
  temporaryDirectories.push(directory);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    name: 'react-native-rust-demo',
    peerDependencies: { 'react-native': '>=0.76' },
    codegenConfig: { name: 'RustDemoSpec', type: 'modules', jsSrcsDir: 'src' },
    scripts,
  }));
  fs.writeFileSync(path.join(directory, '.gitignore'), 'node_modules/\n');
  fs.writeFileSync(path.join(directory, 'react-native.config.js'), cppModule
    ? "module.exports = { dependency: { platforms: { android: { cxxModuleHeaderName: 'RustDemoImpl', cxxModuleCMakeListsPath: 'CMakeLists.txt' } } } };"
    : 'module.exports = {};');
  if (cppModule) {
    fs.mkdirSync(path.join(directory, 'cpp'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'android'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'cpp/RustDemoImpl.h'), '#pragma once\n\n#include <RustDemoSpecJSI.h>\n\n#include <memory>\n\nnamespace facebook::react {\n\nclass RustDemoImpl : public NativeRustDemoCxxSpec<RustDemoImpl> {\n public:\n  RustDemoImpl(std::shared_ptr<CallInvoker> jsInvoker);\n\n  double multiply(jsi::Runtime& rt, double a, double b);\n};\n\n}\n');
    fs.writeFileSync(path.join(directory, 'cpp/RustDemoImpl.cpp'), '#include "RustDemoImpl.h"\n\nnamespace facebook::react {\n\nRustDemoImpl::RustDemoImpl(std::shared_ptr<CallInvoker> jsInvoker)\n    : NativeRustDemoCxxSpec(std::move(jsInvoker)) {}\n\ndouble RustDemoImpl::multiply(jsi::Runtime& rt, double a, double b) {\n  return a * b;\n}\n\n}\n');
    fs.writeFileSync(path.join(directory, 'src/NativeRustDemo.ts'), "import { TurboModuleRegistry, type TurboModule } from 'react-native';\n\nexport interface Spec extends TurboModule {\n  multiply(a: number, b: number): number;\n}\n");
    fs.writeFileSync(path.join(directory, 'src/index.tsx'), "export { multiply } from './multiply';\n");
    fs.writeFileSync(path.join(directory, 'android/CMakeLists.txt'), 'add_library(\n  react_native_rust_demo\n  STATIC\n  ../cpp/RustDemoImpl.cpp\n)\n\ntarget_link_libraries(\n  react_native_rust_demo\n  jsi\n  reactnative\n)\n');
    fs.writeFileSync(path.join(directory, 'RustDemo.podspec'), 'Pod::Spec.new do |s|\n  s.source_files = "cpp/**/*.{h,cpp}"\nend\n');
  }
  return directory;
}

function createReactNativeApp() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-app-'));
  temporaryDirectories.push(directory);
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    name: 'rust-app-fixture',
    dependencies: { 'react-native': '0.86.2' },
    devDependencies: {},
    scripts: {},
  }));
  for (const folder of ['android', 'ios', 'node_modules/react-native/scripts']) {
    fs.mkdirSync(path.join(directory, folder), { recursive: true });
  }
  fs.writeFileSync(
    path.join(directory, 'node_modules/react-native/scripts/generate-codegen-artifacts.js'),
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "const projectRoot = process.argv[process.argv.indexOf('-p') + 1];",
      "const config = require(path.join(projectRoot, 'package.json')).codegenConfig;",
      "for (const platform of ['android', 'ios']) {",
      '  const outputPath = path.join(projectRoot, config.outputDir[platform]);',
      "  const generatedPath = platform === 'android' ? path.join(outputPath, 'jni', 'CMakeLists.txt') : path.join(outputPath, 'ReactCodegen', 'RustAppSpecJSI.h');",
      "  fs.mkdirSync(path.dirname(generatedPath), { recursive: true });",
      "  fs.writeFileSync(generatedPath, 'generated');",
      '}',
      "fs.writeFileSync(path.join(projectRoot, 'codegen-ran'), 'yes');",
      '',
    ].join('\n'),
  );
  return directory;
}

function runCli(directory, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
}

function runCliWithEnv(directory, env, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: directory,
    encoding: 'utf8',
    env,
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('help prints supported commands without requiring a React Native project', () => {
  const result = runCli(os.tmpdir(), '--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /react-native-rust create <name>/);
  assert.match(result.stdout, /react-native-rust init/);
  assert.match(result.stdout, /react-native-rust build android/);
});

test('create scaffolds a C++ library and initializes Rust from the generated Spec', () => {
  const fixture = createLibrary();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-create-'));
  temporaryDirectories.push(workspace);
  const fakeBin = path.join(workspace, 'bin');
  fs.mkdirSync(fakeBin);
  const fakeNpx = path.join(fakeBin, 'npx');
  fs.writeFileSync(fakeNpx, [
    '#!/usr/bin/env node',
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    'const args = process.argv.slice(2);',
    "if (args[0] !== '--yes' || args[1] !== 'create-react-native-library@latest') process.exit(2);",
    'fs.cpSync(process.env.REACT_NATIVE_RUST_FIXTURE_PATH, path.join(process.cwd(), args[2]), { recursive: true });',
    '',
  ].join('\n'));
  fs.chmodSync(fakeNpx, 0o755);

  const result = runCliWithEnv(workspace, {
    ...process.env,
    PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
    REACT_NATIVE_RUST_FIXTURE_PATH: fixture,
  }, 'create', 'awesome-rust-library');

  const projectPath = path.join(workspace, 'awesome-rust-library');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(projectPath, 'rust/src/api/multiply.rs')), true);
  const manifest = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
  assert.match(manifest.devDependencies['@rejaul/react-native-rust'], /^file:/);
  assert.equal(manifest.scripts['rust:generate'], 'react-native-rust generate');
});

test('create requires a name and refuses to overwrite an existing directory', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'react-native-rust-create-'));
  temporaryDirectories.push(workspace);
  const missingName = runCli(workspace, 'create');
  assert.notEqual(missingName.status, 0);
  assert.match(missingName.stderr, /Usage: react-native-rust create <library-name>/);

  fs.mkdirSync(path.join(workspace, 'existing-library'));
  const existingTarget = runCli(workspace, 'create', 'existing-library');
  assert.notEqual(existingTarget.status, 0);
  assert.match(existingTarget.stderr, /target directory already exists/);
});

test('init scaffolds Rust handlers from methods in the TurboModule Spec', () => {
  const directory = createLibrary();
  const result = runCli(directory, 'init');
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(directory, 'rust/Cargo.toml'), 'utf8'), /crate-type = \["staticlib"\]/);
  assert.match(fs.readFileSync(path.join(directory, 'rust/src/lib.rs'), 'utf8'), /rnrs_multiply/);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['rust:test'], 'cargo test --manifest-path rust/Cargo.toml');
  assert.equal(manifest.scripts['rust:generate'], 'react-native-rust generate');
  assert.equal(manifest.scripts['rust:build:ios'], 'react-native-rust build ios');
  assert.equal(manifest.scripts['rust:build:android'], 'react-native-rust build android');
  assert.ok(manifest.files.includes('rust/'));
  assert.match(fs.readFileSync(path.join(directory, 'rust/Cargo.toml'), 'utf8'), /serde_json = "1"/);
  assert.match(fs.readFileSync(path.join(directory, 'rust/src/ffi.rs'), 'utf8'), /pub struct RustBuffer/);
  assert.match(fs.readFileSync(path.join(directory, 'rust/src/ffi.rs'), 'utf8'), /rnrs_buffer_free/);
  assert.match(fs.readFileSync(path.join(directory, 'rust/src/api/multiply.rs'), 'utf8'), /pub fn multiply\(a: f64, b: f64\) -> f64/);
  assert.match(fs.readFileSync(path.join(directory, 'cpp/RustDemoImpl.h'), 'utf8'), /rust\/include\/rust_api\.h/);
  assert.match(fs.readFileSync(path.join(directory, 'cpp/RustDemoImpl.cpp'), 'utf8'), /rnrs_multiply\(rnrsSlice0, rnrsSlice1\)/);
  assert.match(fs.readFileSync(path.join(directory, 'src/NativeRustDemo.ts'), 'utf8'), /multiply\(a: number, b: number\): number/);
  assert.match(fs.readFileSync(path.join(directory, 'src/index.tsx'), 'utf8'), /export \* from '\.\/rust-generated'/);
  assert.match(fs.readFileSync(path.join(directory, 'src/rust-generated.native.tsx'), 'utf8'), /RustDemo\.multiply\(a, b\)/);
  assert.match(fs.readFileSync(path.join(directory, 'src/rust-generated.native.tsx'), 'utf8'), /from '\.\/NativeRustDemo'/);
  assert.match(fs.readFileSync(path.join(directory, 'android/CMakeLists.txt'), 'utf8'), /rust\/build\/android/);
  assert.match(fs.readFileSync(path.join(directory, 'android/CMakeLists.txt'), 'utf8'), /rust_core[\s\S]*log[\s\S]*dl[\s\S]*m/);
  assert.match(fs.readFileSync(path.join(directory, 'RustDemo.podspec'), 'utf8'), /rust\/build\/ios\/RustDemoRust\.xcframework/);
  assert.match(fs.readFileSync(path.join(directory, '.gitignore'), 'utf8'), /rust\/target\//);
  assert.match(fs.readFileSync(path.join(directory, '.gitignore'), 'utf8'), /rust\/build\//);
});

test('init --app creates an app-local Rust TurboModule and app commands regenerate it', () => {
  const directory = createReactNativeApp();
  const result = runCli(directory, 'init', '--app');
  assert.equal(result.status, 0, result.stderr);

  const moduleRoot = path.join(directory, 'native/rust-module');
  const appManifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const moduleManifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'package.json'), 'utf8'));
  assert.equal(appManifest.dependencies['rust-app-native-module'], 'file:./native/rust-module');
  assert.equal(appManifest.scripts['rust:build:android'], 'react-native-rust build android');
  assert.equal(moduleManifest.codegenConfig.name, 'RustAppSpec');
  assert.match(fs.readFileSync(path.join(moduleRoot, 'rust/src/api/multiply.rs'), 'utf8'), /pub fn multiply\(a: f64, b: f64\)/);
  assert.match(fs.readFileSync(path.join(moduleRoot, 'cpp/RustAppImpl.cpp'), 'utf8'), /rnrs_multiply/);
  const androidCmake = fs.readFileSync(path.join(moduleRoot, 'android/CMakeLists.txt'), 'utf8');
  assert.match(androidCmake, /CXX_STANDARD 20/);
  assert.match(androidCmake, /react_codegen_RustAppSpec/);
  assert.equal(fs.existsSync(path.join(moduleRoot, 'android/generated/jni/CMakeLists.txt')), true);
  assert.equal(fs.existsSync(path.join(moduleRoot, 'ios/generated/ReactCodegen/RustAppSpecJSI.h')), true);
  assert.equal(fs.existsSync(path.join(moduleRoot, 'codegen-ran')), true);

  const regenerate = runCli(directory, 'generate');
  assert.equal(regenerate.status, 0, regenerate.stderr);
  const repeatedInit = runCli(directory, 'init', '--app');
  assert.notEqual(repeatedInit.status, 0);
  assert.match(repeatedInit.stderr, /already exists; no files were changed/);
});

test('generate maps boolean and void methods and preserves Rust handler logic', () => {
  const directory = createLibrary();
  assert.equal(runCli(directory, 'init').status, 0);
  const multiplyPath = path.join(directory, 'rust/src/api/multiply.rs');
  const originalHandler = fs.readFileSync(multiplyPath, 'utf8');
  fs.writeFileSync(multiplyPath, originalHandler.replace('    0.0', '    a * b'));

  const specPath = path.join(directory, 'src/NativeRustDemo.ts');
  const spec = fs.readFileSync(specPath, 'utf8').replace(
    '  multiply(a: number, b: number): number;',
    '  multiply(a: number, b: number): number;\n  enabled(value: boolean): boolean;\n  clear(): void;',
  );
  fs.writeFileSync(specPath, spec);

  const result = runCli(directory, 'generate');
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(multiplyPath, 'utf8'), /a \* b/);
  assert.match(fs.readFileSync(path.join(directory, 'rust/src/api/enabled.rs'), 'utf8'), /value: bool\) -> bool/);
  assert.match(fs.readFileSync(path.join(directory, 'rust/src/api/clear.rs'), 'utf8'), /pub fn clear\(\) -> \(\)/);
  assert.match(fs.readFileSync(path.join(directory, 'cpp/RustDemoImpl.cpp'), 'utf8'), /bool RustDemoImpl::enabled/);
  assert.match(fs.readFileSync(path.join(directory, 'src/rust-generated.native.tsx'), 'utf8'), /RustDemo\.clear\(\);/);

  const generatedPaths = [
    'rust/src/lib.rs',
    'cpp/RustDemoImpl.h',
    'cpp/RustDemoImpl.cpp',
    'src/rust-generated.tsx',
    'src/rust-generated.native.tsx',
  ];
  const generatedBefore = generatedPaths.map((filePath) => fs.readFileSync(path.join(directory, filePath), 'utf8'));
  const secondRun = runCli(directory, 'generate');
  assert.equal(secondRun.status, 0, secondRun.stderr);
  const generatedAfter = generatedPaths.map((filePath) => fs.readFileSync(path.join(directory, filePath), 'utf8'));
  assert.deepEqual(generatedAfter, generatedBefore);
});

test('generate preserves string, array, and UnsafeObject return types across bindings', () => {
  const directory = createLibrary();
  assert.equal(runCli(directory, 'init').status, 0);

  const specPath = path.join(directory, 'src/NativeRustDemo.ts');
  const spec = fs.readFileSync(specPath, 'utf8')
    .replace(
      "import { TurboModuleRegistry, type TurboModule } from 'react-native';",
      "import { TurboModuleRegistry, type TurboModule } from 'react-native';\ndeclare namespace CodegenTypes { type UnsafeObject = object; }",
    )
    .replace(
      '  multiply(a: number, b: number): number;',
      [
        '  multiply(a: number, b: number): number;',
        '  greet(name: string): string;',
        '  scale(values: number[]): number[];',
        '  record(value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject;',
        '  calculate(value: number): Promise<number>;',
        '  inspect(\n    value: CodegenTypes.UnsafeObject,\n    callback: (label: string, score: number) => void\n  ): void;',
      ].join('\n'),
    );
  fs.writeFileSync(specPath, spec);

  const result = runCli(directory, 'generate');
  assert.equal(result.status, 0, result.stderr);
  const cpp = fs.readFileSync(path.join(directory, 'cpp/RustDemoImpl.cpp'), 'utf8');
  const native = fs.readFileSync(path.join(directory, 'src/rust-generated.native.tsx'), 'utf8');
  const fallback = fs.readFileSync(path.join(directory, 'src/rust-generated.tsx'), 'utf8');
  assert.match(cpp, /return rnrsValue\.asString\(rnrsRuntime\);/);
  assert.match(cpp, /return rnrsValue\.asObject\(rnrsRuntime\)\.asArray\(rnrsRuntime\);/);
  assert.match(cpp, /std::make_shared<jsi::Function>/);
  assert.match(cpp, /resolve->call\(callbackRuntime/);
  assert.match(cpp, /#include <thread>/);
  assert.ok(cpp.indexOf('#include <thread>') < cpp.indexOf('namespace facebook::react {'));
  assert.match(cpp, /static_cast<const jsi::Value\*>\(arguments\.data\(\)\)/);
  assert.match(native, /declare namespace CodegenTypes \{ type UnsafeObject = object; \}/);
  assert.match(fallback, /declare namespace CodegenTypes \{ type UnsafeObject = object; \}/);
  const callbackPath = path.join(directory, 'rust/src/api/inspect.rs');
  const callbackHandler = fs.readFileSync(callbackPath, 'utf8').replace(
    'pub fn inspect(value: serde_json::Value, callback: &mut dyn FnMut(String, f64)) -> () {',
    'pub fn inspect(\n    value: serde_json::Value,\n    callback: &mut dyn FnMut(String, f64),\n) -> () {',
  );
  fs.writeFileSync(callbackPath, callbackHandler);
  const regenerated = runCli(directory, 'generate');
  assert.equal(regenerated.status, 0, regenerated.stderr);
  assert.match(fs.readFileSync(callbackPath, 'utf8'), /callback: &mut dyn FnMut\(String, f64\),\n\) -> \(\)/);
});

test('generate rejects unsupported TypeScript types without changing generated files', () => {
  const directory = createLibrary();
  assert.equal(runCli(directory, 'init').status, 0);
  const specPath = path.join(directory, 'src/NativeRustDemo.ts');
  const spec = fs.readFileSync(specPath, 'utf8').replace(
    '  multiply(a: number, b: number): number;',
    '  multiply(a: number, b: number): number;\n  format(value: { label: string }): string;',
  );
  fs.writeFileSync(specPath, spec);
  const cppBefore = fs.readFileSync(path.join(directory, 'cpp/RustDemoImpl.cpp'), 'utf8');

  const result = runCli(directory, 'generate');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported parameter type "\{ label: string \}" in format\(\)/);
  assert.equal(fs.readFileSync(path.join(directory, 'cpp/RustDemoImpl.cpp'), 'utf8'), cppBefore);
  assert.equal(fs.existsSync(path.join(directory, 'rust/src/api/format.rs')), false);
});

test('android build generates the x86 archive required by the Android emulator ABI', () => {
  const directory = createLibrary();
  const initResult = runCli(directory, 'init');
  assert.equal(initResult.status, 0, initResult.stderr);

  const previousCwd = process.cwd();
  process.chdir(directory);
  try {
    const result = build('android');
    assert.equal(result, undefined);
  } finally {
    process.chdir(previousCwd);
  }

  const crateName = 'react_native_rust_demo';
  assert.ok(fs.existsSync(path.join(directory, 'rust/build/android/x86', `lib${crateName}.a`)));
  assert.ok(fs.existsSync(path.join(directory, 'rust/build/android/arm64-v8a', `lib${crateName}.a`)));
  assert.ok(fs.existsSync(path.join(directory, 'rust/build/android/x86_64', `lib${crateName}.a`)));
});

test('init rejects non-C++ React Native templates without writing files', () => {
  const directory = createLibrary({ cppModule: false });
  const result = runCli(directory, 'init');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not configured as a C\+\+ TurboModule/);
  assert.equal(fs.existsSync(path.join(directory, 'rust')), false);
});

test('init refuses to overwrite a customized C++ demo implementation', () => {
  const directory = createLibrary();
  const sourcePath = path.join(directory, 'cpp/RustDemoImpl.cpp');
  const customizedSource = fs.readFileSync(sourcePath, 'utf8').replace('return a * b;', 'return a + b;');
  fs.writeFileSync(sourcePath, customizedSource);

  const result = runCli(directory, 'init');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /C\+\+ multiply demo was customized/);
  assert.equal(fs.readFileSync(sourcePath, 'utf8'), customizedSource);
  assert.equal(fs.existsSync(path.join(directory, 'rust')), false);
});

test('init detects script conflicts before creating the Rust crate', () => {
  const directory = createLibrary({ scripts: { 'rust:test': 'custom-test-command' } });
  const result = runCli(directory, 'init');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already defines a rust:test or rust:generate script/);
  assert.equal(fs.existsSync(path.join(directory, 'rust')), false);
});