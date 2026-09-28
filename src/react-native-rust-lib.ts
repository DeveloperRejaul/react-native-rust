import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseSpec, renderProjectBindings, renderRustFfiModule } from './codegen';
import { CommandResult, PackageManifest, PackageRootInfo, RunOptions } from './types';

const rustDirectory = 'rust';
const iosTargets = ['aarch64-apple-ios', 'aarch64-apple-ios-sim', 'x86_64-apple-ios'];
const androidTargets: [string, string][] = [
  ['arm64-v8a', 'aarch64-linux-android'],
  ['armeabi-v7a', 'armv7-linux-androideabi'],
  ['x86', 'i686-linux-android'],
  ['x86_64', 'x86_64-linux-android'],
];

/** Runs an external command synchronously, capturing output unless `options.inherit` is set. */
export function run(command: string, args: string[], options: RunOptions = {}): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  });
  if (result.error) return { ok: false, message: result.error.message };
  if (result.status !== 0) {
    return {
      ok: false,
      message: (result.stderr || result.stdout || `${command} exited with ${result.status}`).trim(),
    };
  }
  return { ok: true, output: (result.stdout || '').trim() };
}

/** Reads and parses a JSON file, wrapping any read/parse failure with the file path. */
export function readJson(filePath: string): PackageManifest {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${filePath}: ${(error as Error).message}`, { cause: error });
  }
}

/**
 * Resolves the current working directory as a C++ TurboModule library root: validates it
 * declares `react-native`, has a `react-native.config.js` configured for the C++ module
 * template, and extracts the module's C++ class name prefix from it.
 */
export function packageRoot(): PackageRootInfo {
  const root = process.cwd();
  const manifestPath = path.join(root, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Run this command from the root of a React Native library.');
  }
  const manifest = readJson(manifestPath);
  const dependencies = { ...manifest.dependencies, ...manifest.peerDependencies };
  if (!dependencies['react-native']) {
    throw new Error('This package does not declare react-native as a dependency or peer dependency.');
  }

  const configPath = path.join(root, 'react-native.config.js');
  if (!fs.existsSync(configPath)) {
    throw new Error('Missing react-native.config.js. Create the library with the C++ module template.');
  }
  const config = fs.readFileSync(configPath, 'utf8');
  const moduleMatch = config.match(/cxxModuleHeaderName\s*:\s*['"]([a-zA-Z0-9_]+)Impl['"]/);
  if (!moduleMatch || !config.includes('cxxModuleCMakeListsPath')) {
    throw new Error('The library is not configured as a C++ TurboModule. Choose the C++ module template.');
  }
  return { root, manifest, manifestPath, moduleName: moduleMatch[1] };
}

/** Reads the Rust crate's package name from its `Cargo.toml` `[package] name` field. */
function readCrateName(rustRoot: string): string {
  const manifestPath = path.join(rustRoot, 'Cargo.toml');
  const cargoManifest = fs.readFileSync(manifestPath, 'utf8');
  const crateMatch = cargoManifest.match(/^name\s*=\s*"([a-zA-Z0-9_-]+)"/m);
  if (!crateMatch) throw new Error('Could not read the Rust crate name from rust/Cargo.toml.');
  return crateMatch[1];
}

/**
 * Initializes Rust support in a freshly scaffolded C++ TurboModule library: generates the
 * Rust crate, C ABI, and native/TypeScript bindings from the template's demo `Spec`, and
 * rewires the Android CMake and iOS podspec to link the (not-yet-built) Rust archive.
 * Refuses to run if `rust/` already exists or the template was customized.
 */
export function init(): void {
  const { root, manifest, manifestPath, moduleName } = packageRoot();
  const rustPath = path.join(root, rustDirectory);
  if (fs.existsSync(rustPath)) {
    throw new Error('The rust/ directory already exists; no files were changed.');
  }
  const scripts = manifest.scripts || {};
  if (scripts['rust:test'] || scripts['rust:generate']) {
    throw new Error('package.json already defines a rust:test or rust:generate script; no files were changed.');
  }

  const projectFiles: Record<string, string> = {
    cppHeader: path.join(root, 'cpp', `${moduleName}Impl.h`),
    cppSource: path.join(root, 'cpp', `${moduleName}Impl.cpp`),
    nativeSpec: path.join(root, 'src', `Native${moduleName}.ts`),
    libraryIndex: path.join(root, 'src', 'index.tsx'),
    androidCmake: path.join(root, 'android', 'CMakeLists.txt'),
  };
  const podspecs = fs.readdirSync(root).filter((fileName) => fileName.endsWith('.podspec'));
  if (podspecs.length !== 1) throw new Error('Expected exactly one CocoaPods spec file. No files were changed.');
  projectFiles.podspec = path.join(root, podspecs[0]);
  if (Object.values(projectFiles).some((filePath) => !fs.existsSync(filePath))) {
    throw new Error('Expected C++ library template files were not found. No files were changed.');
  }

  const contents = Object.fromEntries(Object.entries(projectFiles).map(([key, filePath]) => [
    key,
    fs.readFileSync(filePath, 'utf8'),
  ]));
  const targetMatch = contents.androidCmake.match(/add_library\(\s*([a-zA-Z0-9_-]+)\s+STATIC/);
  if (!targetMatch || !contents.cppHeader.includes('#pragma once')) {
    throw new Error('The native files do not match the supported C++ TurboModule template. No files were changed.');
  }
  const methods = parseSpec(contents.nativeSpec, path.relative(root, projectFiles.nativeSpec));

  const crateName = (manifest.name || 'react-native-rust')
    .replace(/^@[^/]+\//, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_');
  const crateDirName = /^\d/.test(crateName) ? `rust_${crateName.toLowerCase()}` : crateName.toLowerCase();
  const targetName = targetMatch[1];
  const linkMatch = contents.androidCmake.match(/target_link_libraries\(\s*([a-zA-Z0-9_-]+)([\s\S]*?)\n\)/);
  if (!linkMatch || linkMatch[1] !== targetName) {
    throw new Error('Could not locate the C++ target link block in android/CMakeLists.txt.');
  }
  const androidLink = `${linkMatch[0].slice(0, -2)}\n    rust_core\n    log\n    dl\n    m\n)`;
  const rustImport = `add_library(rust_core STATIC IMPORTED)\nset_target_properties(rust_core PROPERTIES\n    IMPORTED_LOCATION "\${CMAKE_CURRENT_LIST_DIR}/../rust/build/android/\${ANDROID_ABI}/lib${crateDirName}.a"\n)\n\n`;
  const androidCmake = contents.androidCmake
    .replace(linkMatch[0], androidLink)
    .replace(/add_library\(/, `${rustImport}add_library(`);

  const podspecSource = contents.podspec.match(/^\s*s\.source_files\s*=.*$/m);
  if (!podspecSource) throw new Error('Could not locate source_files in the CocoaPods spec.');
  const podspec = contents.podspec.replace(
    podspecSource[0],
    `${podspecSource[0]}\n  s.vendored_frameworks = "rust/build/ios/${moduleName}Rust.xcframework"`,
  );

  const rustFiles: Record<string, string> = {
    'Cargo.toml': `[package]\nname = "${crateDirName}"\nversion = "0.1.0"\nedition = "2021"\n\n[lib]\ncrate-type = ["staticlib", "cdylib"]\n\n[dependencies]\nserde = { version = "1", features = ["derive"] }\nserde_json = "1"\n\n[target.'cfg(target_arch = "wasm32")'.dependencies]\nwasm-bindgen = "0.2"\njs-sys = "0.3"\n\n[build-dependencies]\ncbindgen = "0.26"\n`,
    'build.rs': `use std::path::PathBuf;\n\nfn main() {\n    let crate_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();\n    let output = PathBuf::from(&crate_dir).join("include/rust_api.h");\n    std::fs::create_dir_all(output.parent().unwrap()).unwrap();\n    cbindgen::generate(&crate_dir)\n        .expect("failed to generate the Rust C header")\n        .write_to_file(output);\n}\n`,
    'cbindgen.toml': `language = "C++"\n`,
    'src/ffi.rs': renderRustFfiModule(),
    'README.md': `# Rust core\n\nRust handlers are generated from the TurboModule Spec interface in src/Native${moduleName}.ts. Edit the generated functions under rust/src/api/ and regenerate native glue with npx react-native-rust generate.\n\nRun cargo test --manifest-path rust/Cargo.toml for Rust tests. Build iOS and Android artifacts with npx react-native-rust build ios and npx react-native-rust build android before native app builds. Build the react-native-web WebAssembly package with npx react-native-rust build web (requires wasm-pack and the wasm32-unknown-unknown Rust target).\n`,
  };

  const updates = renderProjectBindings(root, moduleName, methods, true, crateDirName);
  updates.set(projectFiles.androidCmake, androidCmake);
  updates.set(projectFiles.podspec, podspec);
  const cliManifest = readJson(path.join(__dirname, '..', 'package.json'));
  const cliRoot = path.resolve(__dirname, '..');
  const cliIsInstalled = cliRoot.split(path.sep).includes('node_modules');
  const cliDependency = cliIsInstalled
    ? `^${cliManifest.version}`
    : `file:${path.relative(root, cliRoot).split(path.sep).join('/') || '.'}`;
  const updatedManifest: PackageManifest = {
    ...manifest,
    devDependencies: {
      ...manifest.devDependencies,
      [cliManifest.name as string]: manifest.devDependencies?.[cliManifest.name as string] || cliDependency,
    },
    scripts: {
      ...scripts,
      'rust:test': 'cargo test --manifest-path rust/Cargo.toml',
      'rust:generate': 'react-native-rust generate',
      'rust:build:ios': 'react-native-rust build ios',
      'rust:build:android': 'react-native-rust build android',
      'rust:build:web': 'react-native-rust build web',
    },
  };
  const packageFiles = Array.isArray(updatedManifest.files) ? [...updatedManifest.files] : [];
  for (const filePath of ['rust/', 'rust/build/', 'rust/include/']) {
    if (!packageFiles.includes(filePath)) packageFiles.push(filePath);
  }
  updatedManifest.files = packageFiles;
  updates.set(manifestPath, `${JSON.stringify(updatedManifest, null, 2)}\n`);

  const gitignorePath = path.join(root, '.gitignore');
  const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const ignoredRustOutputs = ['rust/target/', 'rust/build/']
    .filter((entry) => !gitignore.split(/\r?\n/).includes(entry));
  if (ignoredRustOutputs.length > 0) {
    const separator = gitignore.length > 0 && !gitignore.endsWith('\n') ? '\n' : '';
    updates.set(gitignorePath, `${gitignore}${separator}${ignoredRustOutputs.join('\n')}\n`);
  }

  for (const [relativePath, fileContents] of Object.entries(rustFiles)) {
    const outputPath = path.join(rustPath, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, fileContents);
  }
  for (const [filePath, fileContents] of updates) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, fileContents);
  }

  console.log(`Generated ${methods.length} Rust handler(s) and native bindings from Spec.`);
  console.log('Run `npx react-native-rust build ios` or `npx react-native-rust build android` before building the React Native app.');
}

/** Regenerates the Rust ABI, C++ methods, and TypeScript wrappers from the current Spec, preserving Rust handler bodies. */
export function generate(): void {
  const { root, moduleName } = packageRoot();
  const rustPath = path.join(root, rustDirectory);
  if (!fs.existsSync(path.join(rustPath, 'Cargo.toml'))) {
    throw new Error('Rust is not initialized. Run `npx react-native-rust init` first.');
  }
  const nativeSpecPath = path.join(root, 'src', `Native${moduleName}.ts`);
  const methods = parseSpec(fs.readFileSync(nativeSpecPath, 'utf8'), path.relative(root, nativeSpecPath));
  const updates = renderProjectBindings(root, moduleName, methods, false, readCrateName(rustPath));
  for (const [filePath, fileContents] of updates) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, fileContents);
  }
  console.log(`Regenerated Rust, C++, and TypeScript glue for ${methods.length} Spec method(s).`);
}

/** Checks that the Rust toolchain, and optionally the iOS, Android, or web toolchain, are available. Sets `process.exitCode` on failure. */
export function doctor(target: 'ios' | 'android' | 'web' | undefined): void {
  const { root } = packageRoot();
  if (!fs.existsSync(path.join(root, rustDirectory, 'Cargo.toml'))) {
    throw new Error('Rust is not initialized. Run `npx react-native-rust init` first.');
  }
  let failed = false;
  for (const command of ['rustc', 'cargo']) {
    const result = run(command, ['--version']);
    console.log(`${result.ok ? 'OK' : 'MISSING'} ${command}${result.output ? `: ${result.output}` : ''}`);
    failed ||= !result.ok;
  }

  if (target === 'ios') {
    const xcode = run('xcodebuild', ['-version']);
    const lipo = run('lipo', ['-version']);
    console.log(`${xcode.ok ? 'OK' : 'MISSING'} Xcode`);
    console.log(`${lipo.ok ? 'OK' : 'MISSING'} lipo`);
    failed ||= process.platform !== 'darwin' || !xcode.ok || !lipo.ok;
  }
  if (target === 'android') {
    const ndkPath = process.env.ANDROID_NDK_HOME || process.env.ANDROID_NDK_ROOT;
    const cargoNdk = run('cargo', ['ndk', '--version']);
    console.log(`${ndkPath ? 'OK' : 'CHECK'} Android NDK path (cargo-ndk can auto-detect Android Studio installs)`);
    console.log(`${cargoNdk.ok ? 'OK' : 'MISSING'} cargo-ndk`);
    failed ||= !cargoNdk.ok;
  }
  if (target === 'web') {
    const wasmPack = run('wasm-pack', ['--version']);
    const installedTargets = run('rustup', ['target', 'list', '--installed']);
    const hasWasmTarget = installedTargets.ok && (installedTargets.output || '').includes('wasm32-unknown-unknown');
    console.log(`${wasmPack.ok ? 'OK' : 'MISSING'} wasm-pack`);
    console.log(`${hasWasmTarget ? 'OK' : 'MISSING'} wasm32-unknown-unknown Rust target (rustup target add wasm32-unknown-unknown)`);
    failed ||= !wasmPack.ok || !hasWasmTarget;
  }
  if (failed) process.exitCode = 1;
}

/** Builds the Rust archive(s) for `ios` (an XCFramework) or `android` (per-ABI static archives). */
export function build(platform: string | undefined): void {
  const { root, manifest, moduleName } = packageRoot();
  const rustRoot = path.join(root, rustDirectory);
  const manifestPath = path.join(rustRoot, 'Cargo.toml');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Rust is not initialized. Run `npx react-native-rust init` first.');
  }
  const crateName = readCrateName(rustRoot);
  const releasePath = (target: string) => path.join(rustRoot, 'target', target, 'release', `lib${crateName}.a`);

  if (platform === 'ios') {
    for (const target of iosTargets) {
      const result = run('cargo', ['build', '--release', '--target', target, '--manifest-path', manifestPath], { inherit: true });
      if (!result.ok) throw new Error(`iOS build failed for ${target}: ${result.message}`);
    }
    const buildPath = path.join(rustRoot, 'build', 'ios');
    fs.mkdirSync(buildPath, { recursive: true });
    const simulatorDirectory = path.join(buildPath, 'simulator');
    fs.mkdirSync(simulatorDirectory, { recursive: true });
    const simulatorArchive = path.join(simulatorDirectory, `lib${crateName}.a`);
    const lipo = run('lipo', [
      '-create',
      releasePath('aarch64-apple-ios-sim'),
      releasePath('x86_64-apple-ios'),
      '-output', simulatorArchive,
    ], { inherit: true });
    if (!lipo.ok) throw new Error(`Could not combine iOS simulator archives: ${lipo.message}`);

    const frameworkPath = path.join(buildPath, `${moduleName}Rust.xcframework`);
    fs.rmSync(frameworkPath, { recursive: true, force: true });
    const xcframework = run('xcodebuild', [
      '-create-xcframework',
      '-library', releasePath('aarch64-apple-ios'),
      '-headers', path.join(rustRoot, 'include'),
      '-library', simulatorArchive,
      '-headers', path.join(rustRoot, 'include'),
      '-output', frameworkPath,
    ], { inherit: true });
    if (!xcframework.ok) throw new Error(`Could not create the iOS XCFramework: ${xcframework.message}`);
    console.log(`Built ${path.relative(root, frameworkPath)} for ${manifest.name}.`);
    return;
  }

  if (platform === 'android') {
    const result = run('cargo', ['ndk',
      '-t', 'arm64-v8a',
      '-t', 'armeabi-v7a',
      '-t', 'x86',
      '-t', 'x86_64',
      'build', '--release',
    ], { inherit: true, cwd: rustRoot });
    if (!result.ok) throw new Error(`Android build failed: ${result.message}`);
    for (const [abi, target] of androidTargets) {
      const outputDirectory = path.join(rustRoot, 'build', 'android', abi);
      fs.mkdirSync(outputDirectory, { recursive: true });
      fs.copyFileSync(releasePath(target), path.join(outputDirectory, `lib${crateName}.a`));
    }
    console.log(`Built Android static archives for ${manifest.name}.`);
    return;
  }

  if (platform === 'web') {
    const result = run('wasm-pack', ['build', '--target', 'web', '--out-dir', path.join('build', 'web', 'pkg')], { inherit: true, cwd: rustRoot });
    if (!result.ok) throw new Error(`Web build failed: ${result.message}`);
    console.log(`Built rust/build/web/pkg for ${manifest.name}.`);
    return;
  }
  throw new Error('Choose a build target: ios, android, or web.');
}
