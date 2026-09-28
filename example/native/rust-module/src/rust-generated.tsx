declare namespace CodegenTypes { type UnsafeObject = object; }

import wasmInit, * as rnrsWasm from '../rust/build/web/pkg/rust_app_native_module.js';

let rnrsWasmReady = false;
let rnrsWasmInit: Promise<void> | null = null;

/** Loads the compiled Rust WebAssembly module. Call and await this once before using this module on web. */
export function initRustWeb(wasmUrl?: string | URL): Promise<void> {
  if (!rnrsWasmInit) {
    rnrsWasmInit = wasmInit(wasmUrl).then(() => { rnrsWasmReady = true; });
  }
  return rnrsWasmInit;
}

function rnrsRequireWasm(): void {
  if (!rnrsWasmReady) throw new Error('Call and await initRustWeb() before using RustApp on web.');
}

export function multiply(a: number, b: number): number {
  rnrsRequireWasm();
  return JSON.parse(rnrsWasm.rnrs_multiply(JSON.stringify(a), JSON.stringify(b)));
}

export function isPositive(value: number): boolean {
  rnrsRequireWasm();
  return JSON.parse(rnrsWasm.rnrs_is_positive(JSON.stringify(value)));
}

export function greet(name: string): string {
  rnrsRequireWasm();
  return JSON.parse(rnrsWasm.rnrs_greet(JSON.stringify(name)));
}

export function scaleValues(values: number[]): number[] {
  rnrsRequireWasm();
  return JSON.parse(rnrsWasm.rnrs_scale_values(JSON.stringify(values)));
}

export function annotateObject(value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject {
  rnrsRequireWasm();
  return JSON.parse(rnrsWasm.rnrs_annotate_object(JSON.stringify(value)));
}

export function calculateAsync(value: number): Promise<number> {
  rnrsRequireWasm();
  try {
    const rnrsResult = rnrsWasm.rnrs_calculate_async(JSON.stringify(value));
    return Promise.resolve(JSON.parse(rnrsResult));
  } catch (error) {
    return Promise.reject(error instanceof Error ? error.message : String(error));
  }
}

export function inspectWithCallback(value: CodegenTypes.UnsafeObject, callback: (
      label: string,
      score: number,
      active: boolean,
      details: CodegenTypes.UnsafeObject
    ) => void): void {
  rnrsRequireWasm();
  rnrsWasm.rnrs_inspect_with_callback(JSON.stringify(value), (rnrsPayload: string) => { const rnrsArgs = JSON.parse(rnrsPayload); (callback as (...rnrsCallbackArgs: any[]) => void)(...rnrsArgs); });
}
