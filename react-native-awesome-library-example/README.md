# react-native-awesome-library

This example library uses a TypeScript TurboModule `Spec` as the API contract and Rust for the implementation. The Android example app calls the Rust functions through the generated C++ bridge.

## Create The Library

To create another library from this CLI checkout, run from the `rust_to_cpp` repository root:

```sh
node ./bin/react-native-rust.js create react-native-awesome-library-example
```

The command runs `create-react-native-library`, then initializes Rust. In the prompts, select a TurboModule library using C++. After this CLI is published, the equivalent command is `npx react-native-rust create react-native-awesome-library-example`.

Enter the generated project and install its dependencies:

```sh
cd react-native-awesome-library
yarn install
```

## Requirements

- Node.js 22.11 or newer and Yarn 4
- Rust (`rustup` and `cargo`)
- Android Studio with Android SDK, NDK, CMake, and an Android emulator
- `cargo-ndk` for compiling Rust for Android

## Install

Run from the library root:

```sh
yarn install
```

Install Rust and Android targets if needed:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
cargo install cargo-ndk
```

This checkout uses the sibling, local CLI repository at `../rust_to_cpp`; the creation instructions above show how to run it on a fresh library.

## Where To Write Code

The TypeScript interface is the source of truth. Add methods to [`src/NativeAwesomeLibrary.ts`](src/NativeAwesomeLibrary.ts):

```ts
export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  subtract(a: number, b: number): number;
}
```

Write the method logic in Rust:

- `rust/src/api/multiply.rs` implements `multiply(a, b)`.
- `rust/src/api/subtract.rs` implements `subtract(a, b)`.

For example:

```rust
pub fn multiply(a: f64, b: f64) -> f64 {
    a * b
}
```

The generator creates the C ABI functions, C++ TurboModule methods, and TypeScript wrappers. Avoid editing generated C++ or wrapper code directly.

## Add A Function

1. Add a supported synchronous method to `Spec` in `src/NativeAwesomeLibrary.ts`. Supported types are `number`, `boolean`, and `void`.
2. Regenerate the Rust stub and native/TypeScript glue:

	```sh
	node ../rust_to_cpp/bin/react-native-rust.js generate
	```

	Once the CLI is installed from npm, use `yarn rust:generate`.

3. Implement its generated function in `rust/src/api/<method-name>.rs`. Regeneration preserves existing Rust function bodies. Unsupported types fail with an error before generated files are changed.
4. Rebuild TurboModule Codegen and TypeScript output:

	```sh
	yarn prepare
	```

## Run On Android

Make sure Rust, `cargo-ndk`, and an Android emulator are installed and available. From the library root, build the Rust archives and generate the TurboModule sources:

```sh
source "$HOME/.cargo/env"
node ../rust_to_cpp/bin/react-native-rust.js build android
yarn prepare
```

The Rust build creates archives for `arm64-v8a`, `armeabi-v7a`, and `x86_64`. The example's `yarn android` command builds only the ABI of the connected emulator, avoiding a request for an archive that was not generated.

Open two terminals in the `example/` directory. In the first, start Metro:

```sh
yarn start
```

In the second, build and launch on the connected emulator:

```sh
yarn android
```

The example app is in `example/src/App.tsx`. It currently calls both generated methods:

```tsx
import { multiply, subtract } from 'react-native-awesome-library';

const product = multiply(3, 7);       // 21
const difference = subtract(10, 4);   // 6
```

To use two terminals instead, start Metro from the library root with `yarn workspace react-native-awesome-library-example start --reset-cache`, then run the Android command above in a second terminal.

## Run On iOS

From the library root, build the Rust device and simulator archives and generate the native module code:

```sh
source "$HOME/.cargo/env"
node ../rust_to_cpp/bin/react-native-rust.js build ios
yarn prepare
```

Install CocoaPods once, or again after native dependencies change:

```sh
cd example/ios
pod install
cd ..
```

Start Metro from `example/` in one terminal:

```sh
yarn start --reset-cache
```

In a second terminal, build and launch the iOS simulator app:

```sh
yarn ios --simulator "iPhone 17 Pro"
```

## Test

```sh
source "$HOME/.cargo/env"
cargo test --manifest-path rust/Cargo.toml
```

The generated Rust crate currently has no unit tests by default; this command verifies that the handlers compile. Add Rust unit tests alongside your implementations as the library grows.

## License

MIT
