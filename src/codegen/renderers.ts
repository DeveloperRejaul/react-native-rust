import { MethodInfo } from './types';

/** Emits the hand-authored Rust FFI runtime shared by every generated crate. */
export function renderRustFfiModule(): string {
  return `use serde::de::DeserializeOwned;
use serde::Serialize;
use std::ffi::c_void;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::slice;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSlice {
    pub data: *const u8,
    pub len: usize,
}

#[repr(C)]
pub struct RustBuffer {
    pub data: *mut u8,
    pub len: usize,
    pub capacity: usize,
    pub is_error: bool,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustCallback {
    pub context: *mut c_void,
    pub invoke: unsafe extern "C" fn(*mut c_void, RustSlice),
}

pub unsafe fn decode_json<T: DeserializeOwned>(value: RustSlice) -> Result<T, String> {
    let bytes = if value.len == 0 {
        &[]
    } else {
        if value.data.is_null() {
            return Err("Received a null JSON buffer".to_string());
        }
        slice::from_raw_parts(value.data, value.len)
    };
    serde_json::from_slice(bytes).map_err(|error| format!("Invalid JSON input: {error}"))
}

fn into_buffer(mut bytes: Vec<u8>, is_error: bool) -> RustBuffer {
    let buffer = RustBuffer {
        data: bytes.as_mut_ptr(),
        len: bytes.len(),
        capacity: bytes.capacity(),
        is_error,
    };
    std::mem::forget(bytes);
    buffer
}

pub fn encode_result<T: Serialize>(result: Result<T, String>) -> RustBuffer {
    match result {
        Ok(value) => match serde_json::to_vec(&value) {
            Ok(bytes) => into_buffer(bytes, false),
            Err(error) => into_buffer(error.to_string().into_bytes(), true),
        },
        Err(error) => into_buffer(error.into_bytes(), true),
    }
}

pub fn catch_json<T: Serialize>(call: impl FnOnce() -> Result<T, String>) -> RustBuffer {
    let result = catch_unwind(AssertUnwindSafe(call))
        .unwrap_or_else(|_| Err("Rust handler panicked".to_string()));
    encode_result(result)
}

#[no_mangle]
pub extern "C" fn rnrs_buffer_free(buffer: RustBuffer) {
    if !buffer.data.is_null() {
        unsafe {
            drop(Vec::from_raw_parts(buffer.data, buffer.len, buffer.capacity));
        }
    }
}
`;
}

/** Emits the crate's `lib.rs`: the `#[no_mangle]` C ABI entry point for every Spec method. */
export function renderRustExports(methods: MethodInfo[]): string {
  const lines = [
    'mod api;',
    'mod ffi;',
    '#[cfg(target_arch = "wasm32")]',
    'mod wasm;',
    'pub use ffi::{rnrs_buffer_free, RustBuffer, RustCallback, RustSlice};',
    '',
  ];
  for (const method of methods) {
    const abiParams = method.params.map((param) => `${param.name}: ffi::${param.kind === 'callback' ? 'RustCallback' : 'RustSlice'}`).join(', ');
    lines.push('#[cfg(not(target_arch = "wasm32"))]');
    lines.push('#[no_mangle]');
    lines.push(`pub extern "C" fn ${method.symbol}(${abiParams}) -> ffi::RustBuffer {`);
    lines.push('    ffi::catch_json(|| {');

    for (const param of method.params) {
      if (param.kind !== 'callback') {
        lines.push(`        let ${param.name}: ${param.rust} = unsafe { ffi::decode_json(${param.name}) }?;`);
        continue;
      }
      const callbackParams = param.params.map((callbackParam) => `${callbackParam.name}: ${callbackParam.rust}`).join(', ');
      const callbackValues = param.params.map((callbackParam) => callbackParam.name).join(', ');
      const payload = callbackValues.length === 0 ? 'Vec::<u8>::new()' : `serde_json::to_vec(&(${callbackValues}${param.params.length === 1 ? ',' : ''})).unwrap_or_default()`;
      lines.push(`        let mut ${param.name}_callback = |${callbackParams}| {`);
      lines.push(`            let payload = ${payload};`);
      lines.push(`            let slice = ffi::RustSlice { data: payload.as_ptr(), len: payload.len() };`);
      lines.push(`            unsafe { (${param.name}.invoke)(${param.name}.context, slice); }`);
      lines.push('        };');
    }

    const callArgs = method.params.map((param) => param.kind === 'callback' ? `&mut ${param.name}_callback` : param.name).join(', ');
    const call = `api::${method.rustName}::${method.rustName}(${callArgs})`;
    if (method.returnType.promise) {
      lines.push(`        ${call}`);
    } else if (method.returnType.kind === 'void') {
      lines.push(`        ${call};`);
      lines.push('        Ok(())');
    } else {
      lines.push(`        Ok(${call})`);
    }
    lines.push('    })', '}', '');
  }
  return lines.join('\n');
}

/** Emits a placeholder Rust handler body for one Spec method, ready for the author to implement. */
export function renderRustHandler(method: MethodInfo): string {
  const params = method.params.map((param) => {
    if (param.kind === 'callback') {
      const callbackTypes = param.params.map((callbackParam) => callbackParam.rust).join(', ');
      return `${param.name}: &mut dyn FnMut(${callbackTypes})`;
    }
    return `${param.name}: ${param.rust}`;
  }).join(', ');
  const returnType = method.returnType.promise ? `Result<${method.returnType.rust}, String>` : method.returnType.rust;
  const lines = [`// TODO: Replace the generated placeholder with the method implementation.`, `pub fn ${method.rustName}(${params}) -> ${returnType} {`];
  for (const param of method.params) {
    lines.push(`    let _ = ${param.name};`);
  }
  if (method.returnType.promise) lines.push(`    Ok(${method.returnType.defaultValue})`);
  else if (method.returnType.defaultValue !== null) lines.push(`    ${method.returnType.defaultValue}`);
  lines.push('}', '');
  return lines.join('\n');
}

/** Emits `rust/src/api/mod.rs`, declaring one module per Spec method's handler file. */
export function renderRustModuleList(methods: MethodInfo[]): string {
  return `${methods.map((method) => `pub(crate) mod ${method.rustName};`).join('\n')}\n`;
}

/**
 * Emits `rust/src/wasm.rs`: one `#[wasm_bindgen]` export per Spec method, only compiled for
 * `wasm32` targets (see the `#[cfg(target_arch = "wasm32")] mod wasm;` line in `lib.rs`).
 * Calls the same `api::<method>` handler used by the native C ABI, unchanged. Values cross the
 * boundary as JSON strings, and callbacks are invoked directly as JS functions, both mirroring
 * the native JSI bridge's conventions.
 */
export function renderRustWasmModule(methods: MethodInfo[]): string {
  const lines = ['use wasm_bindgen::prelude::*;', ''];
  for (const method of methods) {
    const wasmParams = method.params.map((param) => (
      param.kind === 'callback' ? `${param.name}: &js_sys::Function` : `${param.name}_json: &str`
    )).join(', ');
    const isVoidSync = method.returnType.kind === 'void' && !method.returnType.promise;
    const wasmReturn = isVoidSync ? 'Result<(), JsValue>' : 'Result<String, JsValue>';

    lines.push('#[wasm_bindgen]');
    lines.push(`pub fn ${method.symbol}(${wasmParams}) -> ${wasmReturn} {`);
    for (const param of method.params) {
      if (param.kind === 'callback') continue;
      lines.push(`    let ${param.name}: ${param.rust} = serde_json::from_str(${param.name}_json).map_err(|error| JsValue::from_str(&error.to_string()))?;`);
    }
    for (const param of method.params) {
      if (param.kind !== 'callback') continue;
      const callbackParams = param.params.map((callbackParam) => `${callbackParam.name}: ${callbackParam.rust}`).join(', ');
      const callbackValues = param.params.map((callbackParam) => callbackParam.name).join(', ');
      const encode = callbackValues.length === 0
        ? 'String::from("[]")'
        : `serde_json::to_string(&(${callbackValues}${param.params.length === 1 ? ',' : ''})).unwrap_or_default()`;
      lines.push(`    let mut ${param.name}_callback = |${callbackParams}| {`);
      lines.push(`        let payload = ${encode};`);
      lines.push(`        let _ = ${param.name}.call1(&JsValue::NULL, &JsValue::from_str(&payload));`);
      lines.push('    };');
    }

    const callArgs = method.params.map((param) => param.kind === 'callback' ? `&mut ${param.name}_callback` : param.name).join(', ');
    const call = `crate::api::${method.rustName}::${method.rustName}(${callArgs})`;
    if (method.returnType.promise) {
      lines.push(`    let result = ${call};`);
      lines.push('    result');
      lines.push('        .map_err(|error| JsValue::from_str(&error))');
      lines.push('        .and_then(|value| serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string())))');
    } else if (isVoidSync) {
      lines.push(`    ${call};`);
      lines.push('    Ok(())');
    } else {
      lines.push(`    let value = ${call};`);
      lines.push('    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))');
    }
    lines.push('}', '');
  }
  return lines.join('\n');
}

/** Emits the hand-authored C++ helpers (JSON bridging, callback dispatch, Promise plumbing) shared by every generated module. */
export function renderCppHelpers(): string {
  return `#include <exception>
#include <string>
#include <thread>
#include <vector>

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
}`;
}

/** Emits the generated C++ TurboModule method declarations and definitions for every Spec method. */
export function renderCppMethods(methods: MethodInfo[], moduleName: string): { header: string; source: string } {
  const cppArgName = (index: number) => `rnrsArg${index}`;
  const cppType = (method: MethodInfo) => method.returnType.promise ? 'jsi::Value' : method.returnType.cpp;
  const declarations = methods.map((method) => {
    const params = method.params.map((param, index) => `${param.cpp} ${cppArgName(index)}`);
    return `  ${cppType(method)} ${method.name}(jsi::Runtime& rnrsRuntime${params.length ? `, ${params.join(', ')}` : ''});`;
  });

  const definitions = methods.map((method) => {
    const params = method.params.map((param, index) => `${param.cpp} ${cppArgName(index)}`);
    const signature = `${cppType(method)} ${moduleName}Impl::${method.name}(\n  jsi::Runtime& rnrsRuntime${params.length ? `,\n  ${params.join(',\n  ')}` : ''}\n)`;
    const jsonArgs: { json: string; slice: string }[] = [];
    const callbackArgs: { name: string; context: string; bridge: string }[] = [];
    const setup: string[] = [];
    method.params.forEach((param, index) => {
      const name = cppArgName(index);
      if (param.kind === 'callback') {
        const context = `rnrsCallbackContext${index}`;
        const bridge = `rnrsCallbackBridge${index}`;
        setup.push(`  RustCallbackContext ${context}{&rnrsRuntime, &${name}, nullptr};`);
        setup.push(`  RustCallback ${bridge}{&${context}, &rnrsDispatchCallback};`);
        callbackArgs.push({ name, context, bridge });
        return;
      }
      const json = `rnrsJson${index}`;
      const slice = `rnrsSlice${index}`;
      setup.push(`  auto ${json} = rnrsStringify(rnrsRuntime, jsi::Value(rnrsRuntime, std::move(${name})));`);
      setup.push(`  RustSlice ${slice}{reinterpret_cast<const uint8_t*>(${json}.data()), ${json}.size()};`);
      jsonArgs.push({ json, slice });
    });

    const ffiArgs = method.params.map((param, index) => (
      param.kind === 'callback' ? `rnrsCallbackBridge${index}` : `rnrsSlice${index}`
    ));
    if (method.returnType.promise) {
      const captures = jsonArgs.map(({ json }) => `${json} = std::move(${json})`);
      const workerLines: string[] = [];
      method.params.forEach((param, index) => {
        if (param.kind !== 'callback') {
          const json = `rnrsJson${index}`;
          workerLines.push(`    RustSlice rnrsSlice${index}{reinterpret_cast<const uint8_t*>(${json}.data()), ${json}.size()};`);
        }
      });
      workerLines.push(`    return ${method.symbol}(${ffiArgs.join(', ')});`);
      return [signature + ' {', ...setup, `  return rnrsMakePromise(rnrsRuntime, jsInvoker_, [${captures.join(', ')}]() mutable {`, ...workerLines, '  });', '}'].join('\n');
    }

    const call = `auto rnrsResult = ${method.symbol}(${ffiArgs.join(', ')});`;
    const callbackErrorChecks = callbackArgs.map(({ context }) => `  if (${context}.exception) { rnrs_buffer_free(rnrsResult); std::rethrow_exception(${context}.exception); }`);
    const decoded = 'auto rnrsValue = rnrsFromRust(rnrsRuntime, rnrsResult);';
    let resultLine: string;
    switch (method.returnType.kind) {
    case 'void': resultLine = '  (void)rnrsValue;\n  return;'; break;
    case 'number': resultLine = '  return rnrsValue.asNumber();'; break;
    case 'boolean': resultLine = '  return rnrsValue.asBool();'; break;
    case 'json':
      if (method.returnType.cpp === 'jsi::String') resultLine = '  return rnrsValue.asString(rnrsRuntime);';
      else if (method.returnType.cpp === 'jsi::Array') resultLine = '  return rnrsValue.asObject(rnrsRuntime).asArray(rnrsRuntime);';
      else resultLine = '  return rnrsValue.asObject(rnrsRuntime);';
      break;
    default: throw new Error(`No C++ return conversion for ${method.returnType.kind}.`);
    }
    return [signature + ' {', ...setup, `  ${call}`, ...callbackErrorChecks, `  ${decoded}`, resultLine, '}'].join('\n');
  });
  return {
    header: declarations.join('\n'),
    source: `${renderCppHelpers()}\n\n${definitions.join('\n\n')}`,
  };
}

/**
 * Emits the TypeScript wrapper module pair: the native-backed export (`.native.tsx`, resolved by
 * Metro) and the WASM-backed web export (plain `.tsx`, resolved by web bundlers like Vite that
 * don't understand the `.native.` convention). The web module loads the `wasm-pack --target web`
 * output from `rust/build/web/pkg/` and must be initialized once via `initRustWeb()` before use,
 * since loading a `.wasm` file is asynchronous even though the generated calls are not.
 */
export function renderWrappers(methods: MethodInfo[], moduleName: string, crateName: string): { native: string; web: string } {
  const nativeLines = [
    `import ${moduleName} from './Native${moduleName}';`,
    '',
    '/** No-op on native, where methods are always ready to call; matches the web module\'s async init so callers don\'t need to branch on platform. */',
    'export function initRustWeb(): Promise<void> {',
    '  return Promise.resolve();',
    '}',
    '',
  ];
  const webLines = [
    `import wasmInit, * as rnrsWasm from '../rust/build/web/pkg/${crateName}.js';`,
    '',
    'let rnrsWasmReady = false;',
    'let rnrsWasmInit: Promise<void> | null = null;',
    '',
    '/** Loads the compiled Rust WebAssembly module. Call and await this once before using this module on web. */',
    'export function initRustWeb(wasmUrl?: string | URL): Promise<void> {',
    '  if (!rnrsWasmInit) {',
    '    rnrsWasmInit = wasmInit(wasmUrl).then(() => { rnrsWasmReady = true; });',
    '  }',
    '  return rnrsWasmInit;',
    '}',
    '',
    'function rnrsRequireWasm(): void {',
    `  if (!rnrsWasmReady) throw new Error('Call and await initRustWeb() before using ${moduleName} on web.');`,
    '}',
    '',
  ];
  const usesUnsafeObject = methods.some((method) => (
    method.returnType.typescript.includes('UnsafeObject')
    || method.params.some((param) => param.typescript.includes('UnsafeObject'))
  ));
  if (usesUnsafeObject) {
    const codegenTypesDeclaration = 'declare namespace CodegenTypes { type UnsafeObject = object; }';
    nativeLines.unshift(codegenTypesDeclaration);
    webLines.unshift(codegenTypesDeclaration, '');
  }
  for (const method of methods) {
    const tsParams = method.params.map((param) => `${param.name}: ${param.typescript}`).join(', ');
    const args = method.params.map((param) => param.name).join(', ');
    const nativeCall = `${moduleName}.${method.name}(${args})`;
    nativeLines.push(`export function ${method.name}(${tsParams}): ${method.returnType.typescript} {`);
    nativeLines.push(method.returnType.typescript === 'void' ? `  ${nativeCall};` : `  return ${nativeCall};`);
    nativeLines.push('}', '');

    const wasmArgs = method.params.map((param) => (
      param.kind === 'callback'
        ? `(rnrsPayload: string) => { const rnrsArgs = JSON.parse(rnrsPayload); (${param.name} as (...rnrsCallbackArgs: any[]) => void)(...rnrsArgs); }`
        : `JSON.stringify(${param.name})`
    )).join(', ');
    const wasmCall = `rnrsWasm.${method.symbol}(${wasmArgs})`;
    webLines.push(`export function ${method.name}(${tsParams}): ${method.returnType.typescript} {`);
    webLines.push('  rnrsRequireWasm();');
    if (method.returnType.promise) {
      webLines.push('  try {');
      if (method.returnType.kind === 'void') {
        webLines.push(`    ${wasmCall};`);
        webLines.push('    return Promise.resolve();');
      } else {
        webLines.push(`    const rnrsResult = ${wasmCall};`);
        webLines.push('    return Promise.resolve(JSON.parse(rnrsResult));');
      }
      webLines.push('  } catch (error) {');
      webLines.push('    return Promise.reject(error instanceof Error ? error.message : String(error));');
      webLines.push('  }');
    } else if (method.returnType.kind === 'void') {
      webLines.push(`  ${wasmCall};`);
    } else {
      webLines.push(`  return JSON.parse(${wasmCall});`);
    }
    webLines.push('}', '');
  }
  return {
    native: nativeLines.join('\n'),
    web: webLines.join('\n'),
  };
}
