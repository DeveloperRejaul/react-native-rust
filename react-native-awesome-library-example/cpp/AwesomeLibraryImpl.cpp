#include "AwesomeLibraryImpl.h"

#include <exception>
#include <string>
#include <thread>
#include <vector>
namespace facebook::react {

AwesomeLibraryImpl::AwesomeLibraryImpl(
  std::shared_ptr<CallInvoker> jsInvoker
)
  : NativeAwesomeLibraryCxxSpec(std::move(jsInvoker)) {}

// react-native-rust:generated-methods:start

struct RustBufferOwner {
  RustBuffer value;
  ~RustBufferOwner() { rnrs_buffer_free(value); }
};

static std::string rnrsStringify(jsi::Runtime& runtime, const jsi::Value& value) {
  auto json = runtime.global().getPropertyAsObject(runtime, "JSON");
  auto stringify = json.getPropertyAsFunction(runtime, "stringify");
  auto result = stringify.call(runtime, value);
  if (!result.isString()) throw jsi::JSError(runtime, "Value cannot be serialized as JSON");
  return result.getString(runtime).utf8(runtime);
}

static jsi::Value rnrsParseJson(jsi::Runtime& runtime, const uint8_t* data, size_t length) {
  auto json = runtime.global().getPropertyAsObject(runtime, "JSON");
  auto parse = json.getPropertyAsFunction(runtime, "parse");
  auto text = jsi::String::createFromUtf8(runtime, data, length);
  return parse.call(runtime, std::move(text));
}

static jsi::Value rnrsFromRust(jsi::Runtime& runtime, RustBuffer buffer) {
  RustBufferOwner owner{buffer};
  if (buffer.is_error) {
    std::string message(reinterpret_cast<const char*>(buffer.data), buffer.len);
    throw jsi::JSError(runtime, message);
  }
  return rnrsParseJson(runtime, buffer.data, buffer.len);
}

struct RustCallbackContext {
  jsi::Runtime* runtime;
  jsi::Function* function;
  std::exception_ptr exception;
};

extern "C" void rnrsDispatchCallback(void* context, RustSlice payload) noexcept {
  auto* callback = static_cast<RustCallbackContext*>(context);
  try {
    auto value = rnrsParseJson(*callback->runtime, payload.data, payload.len);
    auto array = value.asObject(*callback->runtime).asArray(*callback->runtime);
    std::vector<jsi::Value> arguments;
    arguments.reserve(array.size(*callback->runtime));
    for (size_t index = 0; index < array.size(*callback->runtime); index++) {
      arguments.push_back(array.getValueAtIndex(*callback->runtime, index));
    }
    callback->function->call(*callback->runtime, static_cast<const jsi::Value*>(arguments.data()), arguments.size());
  } catch (...) {
    callback->exception = std::current_exception();
  }
}

template <typename Work>
static jsi::Value rnrsMakePromise(
    jsi::Runtime& runtime,
    std::shared_ptr<CallInvoker> jsInvoker,
    Work work) {
  auto promiseConstructor = runtime.global().getPropertyAsFunction(runtime, "Promise");
  auto executor = jsi::Function::createFromHostFunction(
      runtime,
      jsi::PropNameID::forAscii(runtime, "reactNativeRustExecutor"),
      2,
      [jsInvoker = std::move(jsInvoker), work = std::move(work)](
          jsi::Runtime& executorRuntime,
          const jsi::Value&,
          const jsi::Value* arguments,
          size_t count) mutable -> jsi::Value {
        if (count != 2) throw jsi::JSError(executorRuntime, "Promise executor requires resolve and reject");
        auto resolve = std::make_shared<jsi::Function>(arguments[0].asObject(executorRuntime).asFunction(executorRuntime));
        auto reject = std::make_shared<jsi::Function>(arguments[1].asObject(executorRuntime).asFunction(executorRuntime));
        std::thread([
            jsInvoker,
            work = std::move(work),
            resolve,
            reject]() mutable {
          RustBuffer result = work();
          jsInvoker->invokeAsync([
              result,
              resolve,
              reject](jsi::Runtime& callbackRuntime) mutable {
            if (result.is_error) {
              std::string message(reinterpret_cast<const char*>(result.data), result.len);
              rnrs_buffer_free(result);
              reject->call(callbackRuntime, jsi::String::createFromUtf8(callbackRuntime, message));
              return;
            }
            try {
              auto value = rnrsFromRust(callbackRuntime, result);
              resolve->call(callbackRuntime, std::move(value));
            } catch (...) {
              reject->call(callbackRuntime, jsi::String::createFromUtf8(callbackRuntime, "Could not decode Rust Promise result"));
            }
          });
        }).detach();
        return jsi::Value::undefined();
      });
  return promiseConstructor.callAsConstructor(runtime, std::move(executor));
}

double AwesomeLibraryImpl::multiply(
  jsi::Runtime& rnrsRuntime,
  double rnrsArg0,
  double rnrsArg1
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  auto rnrsJson1 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg1)));
  RustSlice rnrsSlice1{reinterpret_cast<const uint8_t*>(rnrsJson1.data()), rnrsJson1.size()};
  auto rnrsResult = rnrs_multiply(rnrsSlice0, rnrsSlice1);
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  return rnrsValue.asNumber();
}

double AwesomeLibraryImpl::subtract(
  jsi::Runtime& rnrsRuntime,
  double rnrsArg0,
  double rnrsArg1
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  auto rnrsJson1 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg1)));
  RustSlice rnrsSlice1{reinterpret_cast<const uint8_t*>(rnrsJson1.data()), rnrsJson1.size()};
  auto rnrsResult = rnrs_subtract(rnrsSlice0, rnrsSlice1);
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  return rnrsValue.asNumber();
}

bool AwesomeLibraryImpl::isPositive(
  jsi::Runtime& rnrsRuntime,
  double rnrsArg0
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  auto rnrsResult = rnrs_is_positive(rnrsSlice0);
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  return rnrsValue.asBool();
}

jsi::String AwesomeLibraryImpl::greet(
  jsi::Runtime& rnrsRuntime,
  jsi::String rnrsArg0
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  auto rnrsResult = rnrs_greet(rnrsSlice0);
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  return rnrsValue.asString(rnrsRuntime);
}

jsi::Array AwesomeLibraryImpl::scaleValues(
  jsi::Runtime& rnrsRuntime,
  jsi::Array rnrsArg0
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  auto rnrsResult = rnrs_scale_values(rnrsSlice0);
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  return rnrsValue.asObject(rnrsRuntime).asArray(rnrsRuntime);
}

jsi::Object AwesomeLibraryImpl::annotateObject(
  jsi::Runtime& rnrsRuntime,
  jsi::Object rnrsArg0
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  auto rnrsResult = rnrs_annotate_object(rnrsSlice0);
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  return rnrsValue.asObject(rnrsRuntime);
}

jsi::Value AwesomeLibraryImpl::calculateAsync(
  jsi::Runtime& rnrsRuntime,
  double rnrsArg0
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  return rnrsMakePromise(rnrsRuntime, jsInvoker_, [rnrsJson0 = std::move(rnrsJson0)]() mutable {
    RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
    return rnrs_calculate_async(rnrsSlice0);
  });
}

void AwesomeLibraryImpl::inspectWithCallback(
  jsi::Runtime& rnrsRuntime,
  jsi::Object rnrsArg0,
  jsi::Function rnrsArg1
) {
  auto rnrsJson0 = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(rnrsArg0)));
  RustSlice rnrsSlice0{reinterpret_cast<const uint8_t*>(rnrsJson0.data()), rnrsJson0.size()};
  RustCallbackContext rnrsCallbackContext1{&rnrsRuntime, &rnrsArg1, nullptr};
  RustCallback rnrsCallbackBridge1{&rnrsCallbackContext1, &rnrsDispatchCallback};
  auto rnrsResult = rnrs_inspect_with_callback(rnrsSlice0, rnrsCallbackBridge1);
  if (rnrsCallbackContext1.exception) { rnrs_buffer_free(rnrsResult); std::rethrow_exception(rnrsCallbackContext1.exception); }
  auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);
  (void)rnrsValue;
  return;
}
// react-native-rust:generated-methods:end

}
