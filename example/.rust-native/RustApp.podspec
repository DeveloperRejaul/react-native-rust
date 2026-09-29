Pod::Spec.new do |s|
  s.name = "RustApp"
  s.version = "0.0.1"
  s.summary = "App-local Rust TurboModule"
  s.homepage = "https://example.invalid"
  s.license = "MIT"
  s.author = "Local app"
  s.source = { :git => "https://example.invalid" }
  s.platforms = { :ios => min_ios_version_supported }
  s.source_files = "cpp/**/*.{hpp,cpp,c,h}", "ios/**/*.{h,m,mm}", "ios/generated/*.{h,cpp,mm}"
  s.vendored_frameworks = "rust-build-ios/RustAppRust.xcframework"
  install_modules_dependencies(s)
end
