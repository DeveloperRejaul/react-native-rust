# Rust core

Rust handlers are generated from the TurboModule Spec interface in src/NativeRustApp.ts. Edit the generated functions under rust/src/api/ and regenerate native glue with npx react-native-rust generate.

Run cargo test --manifest-path rust/Cargo.toml for Rust tests. Build iOS and Android artifacts with npx react-native-rust build ios and npx react-native-rust build android before native app builds. Build the react-native-web WebAssembly package with npx react-native-rust build web (requires wasm-pack and the wasm32-unknown-unknown Rust target).
