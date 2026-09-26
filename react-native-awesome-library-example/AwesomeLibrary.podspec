require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AwesomeLibrary"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/DeveloperRejaul/react-native-awesome-library.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}", "cpp/**/*.{hpp,cpp,c,h}", "ios/generated/*.{h,cpp,mm}"
  s.vendored_frameworks = "rust/build/ios/AwesomeLibraryRust.xcframework"
  s.private_header_files = "ios/**/*.h"

  install_modules_dependencies(s)
end
