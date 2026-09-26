# Contributing

Thanks for helping improve `@rejaul/react-native-rust`.

## Project scope

This repository contains an npm CLI for React Native library authors. It targets the C++ TurboModule template produced by `create-react-native-library` and generates Rust handlers plus C ABI, C++, and TypeScript glue from the library's TypeScript `Spec`.

The current supported method types are synchronous `number` (`f64`), `boolean` (`bool`), and `void`. Unsupported signatures should fail with a clear error before generated files are changed. Do not claim support for strings, collections, promises, callbacks, or other unsupported types without implementing and testing the complete native mapping.

## Development setup

Requirements: Node.js 18 or newer and npm.

```sh
npm install
npm test
```

The test suite uses temporary C++ TurboModule fixtures; it does not require Rust, Xcode, or the Android NDK. To check the publish contents:

```sh
npm pack --dry-run
```

## Code generation changes

- Treat the TypeScript `Spec` as the source of truth.
- Keep generated C ABI declarations, C++ methods, and TypeScript wrappers consistent with each other.
- Preserve user-authored Rust handler bodies when `generate` is run again.
- Validate all signatures and existing handler compatibility before writing generated files.
- Add tests for supported type mappings, unsupported types, signature changes, repeat generation, and files that must not be overwritten.
- Keep generator output deterministic so a second generation with an unchanged `Spec` produces no diff.

## Manual platform validation

For changes affecting native linking, try the relevant platform build when the toolchain is available.

Android requires Rust Android targets, `cargo-ndk`, Android SDK/NDK, and an emulator or device:

```sh
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
cargo install cargo-ndk
react-native-rust build android
```

iOS requires macOS, Xcode, and Rust Apple targets:

```sh
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
react-native-rust build ios
```

If a platform build cannot be run, say which prerequisite is unavailable and rely on the fixture tests for the parts they cover.

## Pull requests

- Keep changes focused and explain the user-visible behavior or generator contract being changed.
- Include or update tests for behavior changes.
- Update the README when commands, supported types, platform requirements, or generated outputs change.
- Run `npm test`, `npm pack --dry-run`, and `git diff --check` before submitting when possible.
- Do not commit `node_modules`, Rust `target/` output, Android build output, or generated binaries.

## Reporting issues

For bugs or feature requests, include the CLI command, the relevant TypeScript `Spec` signature, operating system, toolchain versions, and the complete error output. Remove credentials and other private information before posting logs.
