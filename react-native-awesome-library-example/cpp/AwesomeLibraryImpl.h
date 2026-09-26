#pragma once

#include "../rust/include/rust_api.h"

#include <AwesomeLibrarySpecJSI.h>

#include <memory>

namespace facebook::react {

class AwesomeLibraryImpl
  : public NativeAwesomeLibraryCxxSpec<AwesomeLibraryImpl> {
public:
  AwesomeLibraryImpl(std::shared_ptr<CallInvoker> jsInvoker);

  // react-native-rust:generated-methods:start
  double multiply(jsi::Runtime& rnrsRuntime, double rnrsArg0, double rnrsArg1);
  double subtract(jsi::Runtime& rnrsRuntime, double rnrsArg0, double rnrsArg1);
  bool isPositive(jsi::Runtime& rnrsRuntime, double rnrsArg0);
  jsi::String greet(jsi::Runtime& rnrsRuntime, jsi::String rnrsArg0);
  jsi::Array scaleValues(jsi::Runtime& rnrsRuntime, jsi::Array rnrsArg0);
  jsi::Object annotateObject(jsi::Runtime& rnrsRuntime, jsi::Object rnrsArg0);
  jsi::Value calculateAsync(jsi::Runtime& rnrsRuntime, double rnrsArg0);
  void inspectWithCallback(jsi::Runtime& rnrsRuntime, jsi::Object rnrsArg0, jsi::Function rnrsArg1);
// react-native-rust:generated-methods:end
};

}
