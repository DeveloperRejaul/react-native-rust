# Project Agent Instructions

## Project Goal

This project is a helping tool for developing Rust libraries that can be used from React Native. Improve the developer workflow for writing Rust APIs, exposing them safely across the native boundary, building for mobile targets, and integrating the results into React Native apps. Keep the tooling approachable and make its supported platforms and generated outputs clear.

The repository is an npm CLI for React Native library authors and app developers. It targets C++ TurboModules: it parses methods in a TypeScript `Spec`, scaffolds Rust handler functions, emits matching C ABI and C++/TypeScript glue, and configures iOS/Android linking. Library mode initializes an existing C++ TurboModule library. App mode (`init --app`) adds a private local TurboModule package to an existing React Native Community CLI app with both Android and iOS projects. The requested type surface is number/f64, boolean/bool, string, JSON-safe arrays and `CodegenTypes.UnsafeObject`, Promise returns over supported payload types, and synchronous callback parameters with supported payload types. Reject typed object structs, nested promises, callbacks retained past the native call, callbacks in Promise methods, and all other unsupported signatures until their ABI and lifecycle are implemented and tested. Do not claim unsupported type mappings or broader React Native integration are complete.

## Current Structure

- `src/react-native-rust.ts`: npm CLI entry point for initializing Rust and generating/building mobile bindings.
- `src/react-native-rust-lib.ts`: library-mode `init`/`generate`/`doctor`/`build` commands.
- `src/app.ts`: app-local TurboModule scaffolding and React Native Codegen integration.
- `src/codegen/`: TypeScript `Spec` parser and Rust/C++/TypeScript scaffold generator, with shared types in `src/codegen/types.ts`.
- `src/types.ts`: shared CLI-level types (package manifest shape, command results, etc.).
- `dist/`: build output (`npm run build`, via esbuild); not committed to git. `npm run typecheck` runs `tsc` for type-checking only.
- `example/`: React Native CLI app used to exercise app-local Rust mode.
- `react-native-awesome-library-example/`: generated C++ TurboModule library (library mode output) with its own `example/` app exercising the full supported type surface, including Promise and callback methods.
- `test/cli.test.js`: Node tests for CLI setup behavior.
- `package.json`: npm package metadata and CLI test command.
- `README.md`: setup, usage, and platform documentation.

## Supported API Surface

Keep generated claims and examples within these tested mappings:

| TypeScript | Rust handler | C++ bridge |
| --- | --- | --- |
| `number` | `f64` | `double` |
| `boolean` | `bool` | `bool` |
| `string` | `String` | `jsi::String` |
| JSON-safe arrays | `serde_json::Value` | `jsi::Array` |
| `CodegenTypes.UnsafeObject` | `serde_json::Value` | `jsi::Object` |
| `void` return | `()` | `void` |
| `Promise<T>` return | `Result<T, String>` | `jsi::Value` Promise |
| Synchronous callback parameter | `&mut dyn FnMut(...)` | `jsi::Function` |

Promise results may contain supported payload types; nested Promises are unsupported. Callbacks must return `void`, have at most four required explicitly typed parameters, and only run during the handler call. Promise methods cannot accept callbacks. Arrays and `UnsafeObject` values use JSON serialization and therefore must contain JSON-safe values. Typed object structs, optional/rest/destructured parameters, generic methods, and overloads are unsupported and must be rejected before generating files.

## Development Guidance

- Follow the existing Rust, C++, and JavaScript conventions, and keep changes focused on the requested developer workflow.
- Treat Rust-to-native calls as a C ABI contract. Keep Rust declarations and generated C headers in sync; do not hand-edit generated headers. Use length-delimited UTF-8/JSON buffers, document who owns each buffer, and provide a matching Rust deallocator for every Rust allocation returned to C++.
- Never unwind across the C ABI. Convert Rust panics/errors into explicit result status and reject Promise results on the JS runtime thread through `CallInvoker`.
- C++ must free returned Rust buffers exactly once on success and error paths. Copy/serialize JSI values before moving Promise work off the JS thread; never access a JSI runtime or retain a callback from a Rust worker thread.
- Callback parameters are scoped to the synchronous Rust handler call unless a separately designed, owned async subscription API is introduced. Promise methods must not accept callback parameters.
- Treat the TypeScript TurboModule `Spec` as the source of truth. Generate Rust ABI wrappers and C++ methods from its supported method signatures. Preserve Rust handler bodies on regeneration and fail before writing files when a signature is unsupported or inconsistent.
- Test TypeScript-to-Rust/C++ mappings, JSON round trips, Rust buffer deallocation/error handling, Promise resolve/reject lifecycle, synchronous callback lifetime, regeneration idempotency, and unsupported signatures.
- Design exported APIs with React Native/mobile callers in mind. Avoid exposing Rust-specific types, references, or unwinding across the C ABI. Use explicit, ABI-compatible types and define ownership and error behavior for any pointers or allocated data.
- When changing code generation or packaging behavior, update the relevant tests and make generated artifacts, target platforms, and prerequisites explicit in the README.
- Do not introduce a React Native framework or dependency unless the requested feature needs it.
- Do not commit generated binaries or build output. Keep platform-specific commands and assumptions clear, especially for Xcode/iOS and Android NDK builds.

## Validation

Run the narrowest relevant checks for the change. Available project commands include:

- `npm test` for CLI fixture tests (requires Node.js 18+); runs `tsc` type-checking and the esbuild `dist/` build first via `pretest`.
- `npm run typecheck` (`tsc`, no emit) and `npm run lint` (ESLint over `src/`) for source-only checks.
- Rust tests run from the generated React Native library using `npm run rust:test` (requires Rust/Cargo).
- iOS/Android builds run from the generated React Native library using the `react-native-rust build` command (requires the respective platform toolchain).

Mention any platform-specific checks that could not be run.