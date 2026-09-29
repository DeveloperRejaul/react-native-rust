#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { init, generate, doctor, build, watch } from './react-native-rust-lib';
import { appModuleRoot, initApp, inDirectory, runCodegen } from './app';

/** Prints the CLI's top-level usage help to stdout. */
function printHelp(): void {
  console.log(`react-native-rust - Rust helper for React Native C++ TurboModule libraries

Usage:
  react-native-rust create <name>  Create a React Native library and initialize Rust support
  react-native-rust init             Add Rust support and generate functions from the Spec interface
  react-native-rust init --app       Add app-local Rust support to a React Native app
  react-native-rust generate         Regenerate Rust, C++, and TypeScript glue from Spec
  react-native-rust doctor [target]  Check Rust and optional ios/android/web prerequisites
  react-native-rust build ios        Build an iOS XCFramework
  react-native-rust build android    Build Android static archives for supported ABIs
  react-native-rust build web        Build a WebAssembly package for react-native-web
  react-native-rust watch            Watch the Spec and rust/ for changes and rebuild automatically
  react-native-rust --help           Show this help

Create a library first with the C++ module template from:
  npx create-react-native-library@latest`);
}

/** Scaffolds a new React Native library with `create-react-native-library`, then runs `init` in it. */
function createProject(projectName: string | undefined): void {
  if (!projectName || projectName.startsWith('-') || path.basename(projectName) !== projectName) {
    throw new Error('Usage: react-native-rust create <library-name>');
  }

  const projectPath = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(projectPath)) {
    throw new Error(`The target directory already exists: ${projectPath}`);
  }

  console.log('In the scaffolder prompts, select a TurboModule library using C++.');
  const scaffold = spawnSync('npx', ['--yes', 'create-react-native-library@latest', projectName], {
    cwd: process.cwd(),
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (scaffold.error) throw new Error(`React Native library creation failed: ${scaffold.error.message}`);
  if (scaffold.status !== 0) throw new Error('React Native library creation failed.');
  if (!fs.existsSync(path.join(projectPath, 'package.json'))) {
    throw new Error(`The scaffolder did not create ${projectPath}.`);
  }

  const initialized = spawnSync(process.execPath, [__filename, 'init'], {
    cwd: projectPath,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (initialized.error) {
    throw new Error(`Rust initialization failed in ${projectPath}: ${initialized.error.message}`);
  }
  if (initialized.status !== 0) {
    throw new Error(`Rust initialization failed in ${projectPath}.`);
  }
  console.log(`Created ${projectName}. Next run \`cd ${projectName} && yarn install\`.`);
}

/** Parses argv and dispatches to the matching command. Library-mode commands run in place; app-local commands run inside `native/rust-module/`. */
function main(args: string[]): void {
  const [command, option] = args;
  if (!command || command === '--help' || command === '-h') return printHelp();
  if (command === 'create') return createProject(option);
  if (command === 'init') {
    if (option === '--app') return initApp();
    if (option) throw new Error('Use `react-native-rust init --app` for an app, or run `react-native-rust init` from a C++ TurboModule library.');
    return init();
  }
  const appRoot = process.cwd();
  const appModule = appModuleRoot(appRoot);
  if (command === 'generate') {
    if (!appModule) return generate();
    return inDirectory(appModule, () => {
      generate();
      runCodegen(appRoot, appModule);
    });
  }
  if (command === 'doctor') {
    if (option && option !== 'ios' && option !== 'android' && option !== 'web') {
      throw new Error('Choose a doctor target: ios, android, or web.');
    }
    const target = option as 'ios' | 'android' | 'web' | undefined;
    return appModule ? inDirectory(appModule, () => doctor(target)) : doctor(target);
  }
  if (command === 'build') {
    if (!appModule) return build(option);
    runCodegen(appRoot, appModule);
    return inDirectory(appModule, () => build(option));
  }
  if (command === 'watch') {
    // The watcher runs for the life of the process, so (unlike the other app-local commands)
    // it changes into the module directory permanently instead of restoring cwd afterward.
    if (appModule) process.chdir(appModule);
    const handle = watch(appModule ? { onGenerated: () => runCodegen(appRoot, appModule) } : {});
    const shutdown = (signal: string): void => {
      console.log(`\n[Rust] Received ${signal}, stopping watcher...`);
      handle.stop().finally(() => process.exit(0));
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
    return;
  }
  throw new Error(`Unknown command: ${command}. Run react-native-rust --help for usage.`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
}
