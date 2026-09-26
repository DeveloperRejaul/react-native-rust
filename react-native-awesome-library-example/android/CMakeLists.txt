cmake_minimum_required(VERSION 3.4.1)
project(AwesomeLibrary)

set (CMAKE_VERBOSE_MAKEFILE ON)

add_library(rust_core STATIC IMPORTED)
set_target_properties(rust_core PROPERTIES
    IMPORTED_LOCATION "${CMAKE_CURRENT_LIST_DIR}/../rust/build/android/${ANDROID_ABI}/libreact_native_awesome_library.a"
)

add_library(
    react-native-awesome-library    STATIC
    ../cpp/AwesomeLibraryImpl.cpp
)

set_target_properties(
    react-native-awesome-library PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
)

target_include_directories(
    react-native-awesome-library    PUBLIC
    ../cpp
)

target_link_libraries(
    react-native-awesome-library    jsi
    reactnative
    react_codegen_AwesomeLibrarySpec
    rust_core
    log
    dl
    m
)
