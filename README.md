# 🦀 Rust to C++ for React Native

A production-ready boilerplate for calling **Rust functions from C++** and deploying to **React Native** (iOS & Android).

## ✨ Features

- 🚀 **Simple Workflow** - Write Rust, build instantly
- 📱 **Cross-Platform** - iOS (device + simulator) & Android support
- 🔗 **Auto-Generated Headers** - cbindgen handles C bindings
- ✅ **Built-In Tests** - Rust unit tests included
- 📦 **Ready for React Native** - Deploy to mobile apps directly

## 📋 Requirements

- **Rust** (`rustup`)
- **Node.js** (v14+)
- **C++ Compiler** (Xcode on macOS)
- **For Android:** Android NDK + cargo-ndk

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install dependencies
npm install
```

### 2. Run the Example

```bash
# Build & run C++ (automatically generates header files)
npm run cpp:run

# Output:
# 30
```

That's it! Your Rust code is running in C++ ✨

## 📖 Commands

| Command | Description |
|---------|-------------|
| `npm run cpp:run` | **Build + Run** - generates header, builds Rust, runs C++ |
| `npm run cpp:header` | Build & generate C header file |
| `npm run rust:test` | Run Rust unit tests |
| `npm run build:ios` | Build for iOS (device + simulator) |
| `npm run build:android` | Build for Android (all ABIs) |

## 🏗️ Project Structure

```
.
├── src/
│   └── lib.rs              # Your Rust code here
├── app.cpp                 # C++ example (calls Rust)
├── add_rust.h              # Auto-generated C header
├── build.rs                # Rust build script (generates headers)
├── Cargo.toml              # Rust configuration
├── package.json            # npm scripts
└── index.js                # Node.js runner
```

## 💡 How It Works

### 1. Write Rust Code (`src/lib.rs`)

```rust
#[no_mangle]
pub extern "C" fn add_rust(left: u64, right: u64) -> u64 {
    left + right
}
```

### 2. Use from C++ (`app.cpp`)

```cpp
#include "add_rust.h"
#include <iostream>

int main() {
    int result = add_rust(10, 20);  // Calls Rust!
    std::cout << result << std::endl;  // Output: 30
    return 0;
}
```

### 3. Build & Run

```bash
npm run cpp:run
```

**That's it!** The header file is auto-generated, Rust is compiled, and C++ runs.

## 🔧 For React Native

### 1. Build for Mobile

```bash
# Build for both iOS & Android
npm run build:ios
npm run build:android
```

### 2. Libraries Generated in `target/`

**iOS:**
- `target/aarch64-apple-ios/release/librust_to_cpp.dylib` (Device)
- `target/x86_64-apple-ios/release/librust_to_cpp.dylib` (Simulator)

**Android:**
- `target/aarch64-linux-android/release/librust_to_cpp.so` (ARM64)
- `target/armv7-linux-androideabi/release/librust_to_cpp.so` (ARMv7)
- `target/x86_64-linux-android/release/librust_to_cpp.so` (x86_64)

### 3. Integrate with React Native Module

Copy libraries to your React Native native module and link them in your build configuration.

## 📝 Modifying the Code

### Add a New Rust Function

**Edit `src/lib.rs`:**

```rust
#[no_mangle]
pub extern "C" fn add_rust(left: u64, right: u64) -> u64 {
    left + right
}

#[no_mangle]
pub extern "C" fn multiply_rust(left: u64, right: u64) -> u64 {
    left * right
}
```

**Edit `app.cpp`:**

```cpp
int multiply_result = multiply_rust(5, 6);
std::cout << multiply_result << std::endl;  // Output: 30
```

**Run:**

```bash
npm run cpp:run
```

Headers are automatically updated! ✨

### Run Rust Tests

```bash
npm run rust:test

# Output:
# running 1 test
# test tests::test_add_rust ... ok
```

## 🎯 Example Workflow

```bash
# 1. Modify Rust code
nano src/lib.rs

# 2. Test locally
npm run rust:test

# 3. Build & run with C++
npm run cpp:run

# 4. Ready for mobile? Build for iOS & Android
npm run build:ios
npm run build:android
```

## ⚙️ Configuration

### Cargo.toml

- **`edition = "2021"`** - Latest Rust edition
- **`crate-type = ["cdylib"]`** - Compiles as shared library
- **`cbindgen`** - Auto-generates C headers

### build.rs

Automatically runs during build to generate `add_rust.h` from your Rust code.

## 🐛 Troubleshooting

### Error: "cbindgen not found"

Already included! It's installed as a build dependency.

### iOS build fails

```bash
# Install iOS targets
rustup target add aarch64-apple-ios x86_64-apple-ios

# Build again
npm run build:ios
```

### Android build fails

```bash
# Install cargo-ndk
cargo install cargo-ndk

# Build
npm run build:android
```

## 📚 Learn More

- [Rust FFI](https://doc.rust-lang.org/nomicon/ffi.html)
- [cbindgen](https://github.com/estebank/cbindgen)
- [React Native Native Modules](https://reactnative.dev/docs/native-modules-intro)

## 📄 License

ISC

## 🤝 Contributing

Questions or improvements? Open an issue!

---

**Happy coding!** 🚀
