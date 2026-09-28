#!/usr/bin/env node

const { init, generate, doctor, build } = require('./react-native-rust-lib');
const { appModuleRoot, initApp, inDirectory, runCodegen } = require('./app');

function printHelp() {
  console.log(`react-native-rust - Rust helper for React Native C++ TurboModule libraries

Usage:
  react-native-rust create <name>  Create a React Native library and initialize Rust support
  react-native-rust init             Add Rust support and generate functions from the Spec interface
  react-native-rust init --app       Add app-local Rust support to a React Native app
  react-native-rust generate         Regenerate Rust, C++, and TypeScript glue from Spec
  react-native-rust doctor [target]  Check Rust and optional ios/android prerequisites
  react-native-rust build ios        Build an iOS XCFramework
  react-native-rust build android    Build Android static archives for supported ABIs
  react-native-rust --help           Show this help

Create a library first with the C++ module template from:
  npx create-react-native-library@latest`);
}

function createProject(projectName) {
  const { spawnSync } = require('node:child_process');
  const fs = require('node:fs');
  const path = require('node:path');

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

function main(args) {
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
    if (option && option !== 'ios' && option !== 'android') {
      throw new Error('Choose a doctor target: ios or android.');
    }
    return appModule ? inDirectory(appModule, () => doctor(option)) : doctor(option);
  }
  if (command === 'build') {
    if (!appModule) return build(option);
    runCodegen(appRoot, appModule);
    return inDirectory(appModule, () => build(option));
  }
  throw new Error(`Unknown command: ${command}. Run react-native-rust --help for usage.`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
