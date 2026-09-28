import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { init as initLibrary, readJson } from './react-native-rust-lib';

const moduleDirectory = path.join('native', 'rust-module');
const moduleName = 'RustApp';
const packageName = 'rust-app-native-module';

/** Writes a map of relative path to file contents under `root`, creating parent directories as needed. */
function writeFiles(root: string, files: Record<string, string>): void {
  for (const [relativePath, contents] of Object.entries(files)) {
    const outputPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, contents);
  }
}

/** Builds the initial file set for a new app-local Rust TurboModule package, with a `multiply` demo Spec. */
function scaffoldFiles(appName: string): Record<string, string> {
  const javaPackageName = appName
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase() || 'com.rustapp';

  return {
    'package.json': `${JSON.stringify({
      name: packageName,
      version: '0.0.1',
      description: 'App-local Rust TurboModule',
      main: 'src/index.tsx',
      'react-native': 'src/index.tsx',
      types: 'src/index.tsx',
      files: ['src/', 'cpp/', 'android/', 'ios/', '*.podspec', 'react-native.config.js', 'rust/'],
      peerDependencies: { react: '*', 'react-native': '>=0.76' },
      codegenConfig: {
        name: `${moduleName}Spec`,
        type: 'modules',
        jsSrcsDir: 'src',
        outputDir: { ios: 'ios/generated', android: 'android/generated' },
        android: { javaPackageName },
        includesGeneratedCode: true,
      },
    }, null, 2)}\n`,
    'react-native.config.js': `module.exports = {
  dependency: {
    platforms: {
      android: {
        cmakeListsPath: 'generated/jni/CMakeLists.txt',
        cxxModuleCMakeListsModuleName: '${packageName}',
        cxxModuleCMakeListsPath: 'CMakeLists.txt',
        cxxModuleHeaderName: '${moduleName}Impl',
      },
    },
  },
};
`,
    [`${moduleName}.podspec`]: `Pod::Spec.new do |s|
  s.name = "${moduleName}"
  s.version = "0.0.1"
  s.summary = "App-local Rust TurboModule"
  s.homepage = "https://example.invalid"
  s.license = "MIT"
  s.author = "Local app"
  s.source = { :git => "https://example.invalid" }
  s.platforms = { :ios => min_ios_version_supported }
  s.source_files = "cpp/**/*.{hpp,cpp,c,h}", "ios/**/*.{h,m,mm}", "ios/generated/*.{h,cpp,mm}"
  s.vendored_frameworks = "rust/build/ios/${moduleName}Rust.xcframework"
  install_modules_dependencies(s)
end
`,
    '.gitignore': 'node_modules/\nrust/target/\nrust/build/\n',
    'src/NativeRustApp.ts': `import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
}

export default TurboModuleRegistry.getEnforcing<Spec>('${moduleName}');
`,
    'src/index.tsx': "export * from './rust-generated';\n",
    'cpp/RustAppImpl.h': `#pragma once

#include <${moduleName}SpecJSI.h>

#include <memory>

namespace facebook::react {

class ${moduleName}Impl : public Native${moduleName}CxxSpec<${moduleName}Impl> {
public:
  ${moduleName}Impl(std::shared_ptr<CallInvoker> jsInvoker);
  double multiply(jsi::Runtime& rt, double a, double b);
};

}
`,
    'cpp/RustAppImpl.cpp': `#include "RustAppImpl.h"

namespace facebook::react {

${moduleName}Impl::${moduleName}Impl(std::shared_ptr<CallInvoker> jsInvoker)
  : Native${moduleName}CxxSpec(std::move(jsInvoker)) {}

double ${moduleName}Impl::multiply(jsi::Runtime&, double a, double b) {
  return a * b;
}

}
`,
    'android/CMakeLists.txt': `cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE ON)

add_library(
  ${packageName}
  STATIC
  ../cpp/${moduleName}Impl.cpp
)

set_target_properties(
  ${packageName} PROPERTIES
  CXX_STANDARD 20
  CXX_STANDARD_REQUIRED ON
  CXX_EXTENSIONS OFF
)

target_include_directories(${packageName} PUBLIC ../cpp)

target_link_libraries(
  ${packageName}
  jsi
  reactnative
  react_codegen_${moduleName}Spec
)
`,
    'ios/OnLoad.mm': `#import <Foundation/Foundation.h>
#import "${moduleName}Impl.h"
#import <ReactCommon/CxxTurboModuleUtils.h>

@interface ${moduleName}OnLoad : NSObject
@end

@implementation ${moduleName}OnLoad

using namespace facebook::react;

+ (void)load
{
  registerCxxModuleToGlobalModuleMap(
    std::string(${moduleName}Impl::kModuleName),
    [](std::shared_ptr<CallInvoker> jsInvoker) {
      return std::make_shared<${moduleName}Impl>(jsInvoker);
    }
  );
}

@end
`,
  };
}

/** Returns the app-local Rust module's root directory if `init --app` has already run there, else `null`. */
export function appModuleRoot(appRoot: string = process.cwd()): string | null {
  const moduleRoot = path.join(appRoot, moduleDirectory);
  return fs.existsSync(path.join(moduleRoot, 'rust', 'Cargo.toml')) ? moduleRoot : null;
}

/** Runs `callback` with the process's working directory temporarily changed to `directory`. */
export function inDirectory<T>(directory: string, callback: () => T): T {
  const previousDirectory = process.cwd();
  process.chdir(directory);
  try {
    return callback();
  } finally {
    process.chdir(previousDirectory);
  }
}

/** Invokes React Native's own Codegen script so the app-local module's generated native code stays current. */
export function runCodegen(appRoot: string, moduleRoot: string): void {
  const script = path.join(appRoot, 'node_modules', 'react-native', 'scripts', 'generate-codegen-artifacts.js');
  if (!fs.existsSync(script)) {
    throw new Error('React Native dependencies are missing. Install the app dependencies, then run `react-native-rust generate`.');
  }
  const result = spawnSync(process.execPath, [script, '-p', moduleRoot, '-t', 'all', '-s', 'library'], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.error || result.status !== 0) {
    throw new Error(`React Native Codegen failed: ${(result.stderr || result.stdout || result.error?.message || '').trim()}`);
  }
}

/**
 * Scaffolds a private, app-local Rust TurboModule package under `native/rust-module/` inside
 * an existing React Native Community CLI app, wires it up as a local file: dependency, adds
 * `rust:*` npm scripts, and runs Codegen once to produce its initial generated native code.
 * Rolls back (removes the module directory) if any step fails.
 */
export function initApp(): void {
  const appRoot = process.cwd();
  const appManifestPath = path.join(appRoot, 'package.json');
  if (!fs.existsSync(appManifestPath)) throw new Error('Run `react-native-rust init --app` from a React Native app root.');
  const appManifest = readJson(appManifestPath);
  if (!(appManifest.dependencies || {})['react-native']) throw new Error('This project does not declare react-native as a dependency.');
  if (!fs.existsSync(path.join(appRoot, 'android')) || !fs.existsSync(path.join(appRoot, 'ios'))) {
    throw new Error('App-local Rust currently requires both Android and iOS native project folders.');
  }
  const moduleRoot = path.join(appRoot, moduleDirectory);
  if (fs.existsSync(moduleRoot)) throw new Error(`${moduleDirectory} already exists; no files were changed.`);

  fs.mkdirSync(moduleRoot, { recursive: true });
  try {
    writeFiles(moduleRoot, scaffoldFiles(appManifest.name || 'rust-app'));
    inDirectory(moduleRoot, initLibrary);

    const cliManifest = readJson(path.join(__dirname, '..', 'package.json'));
    const cliRoot = path.resolve(__dirname, '..');
    const cliIsInstalled = cliRoot.split(path.sep).includes('node_modules');
    const cliDependency = cliIsInstalled
      ? `^${cliManifest.version}`
      : `file:${path.relative(appRoot, cliRoot).split(path.sep).join('/') || '.'}`;
    const moduleManifestPath = path.join(moduleRoot, 'package.json');
    const moduleManifest = readJson(moduleManifestPath);
    delete moduleManifest.devDependencies?.[cliManifest.name as string];
    fs.writeFileSync(moduleManifestPath, `${JSON.stringify(moduleManifest, null, 2)}\n`);

    appManifest.dependencies = {
      ...appManifest.dependencies,
      [packageName]: `file:./${moduleDirectory.split(path.sep).join('/')}`,
    };
    appManifest.devDependencies = {
      ...appManifest.devDependencies,
      [cliManifest.name as string]: appManifest.devDependencies?.[cliManifest.name as string] || cliDependency,
    };
    appManifest.scripts = {
      ...appManifest.scripts,
      'rust:generate': 'react-native-rust generate',
      'rust:build:ios': 'react-native-rust build ios',
      'rust:build:android': 'react-native-rust build android',
      'rust:test': `cargo test --manifest-path ${moduleDirectory.split(path.sep).join('/')}/rust/Cargo.toml`,
    };
    runCodegen(appRoot, moduleRoot);
    fs.writeFileSync(appManifestPath, `${JSON.stringify(appManifest, null, 2)}\n`);
  } catch (error) {
    fs.rmSync(moduleRoot, { recursive: true, force: true });
    throw error;
  }

  console.log(`Created app-local Rust TurboModule in ${path.relative(appRoot, moduleRoot)}.`);
  console.log('Install app dependencies, then run `npm run rust:build:android` or `npm run rust:build:ios`.');
}
