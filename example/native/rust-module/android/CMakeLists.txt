cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE ON)

add_library(rust_core STATIC IMPORTED)
set_target_properties(rust_core PROPERTIES
    IMPORTED_LOCATION "${CMAKE_CURRENT_LIST_DIR}/../rust/build/android/${ANDROID_ABI}/librust_app_native_module.a"
)

add_library(
  rust-app-native-module
  STATIC
  ../cpp/RustAppImpl.cpp
)

set_target_properties(
  rust-app-native-module PROPERTIES
  CXX_STANDARD 20
  CXX_STANDARD_REQUIRED ON
  CXX_EXTENSIONS OFF
)

target_include_directories(rust-app-native-module PUBLIC ../cpp)

target_link_libraries(
  rust-app-native-module
  jsi
  reactnative
  react_codegen_RustAppSpec
    rust_core
    log
    dl
    m
)
