declare namespace CodegenTypes { type UnsafeObject = object; }
import RustApp from './NativeRustApp';

export function multiply(a: number, b: number): number {
  return RustApp.multiply(a, b);
}

export function isPositive(value: number): boolean {
  return RustApp.isPositive(value);
}

export function greet(name: string): string {
  return RustApp.greet(name);
}

export function scaleValues(values: number[]): number[] {
  return RustApp.scaleValues(values);
}

export function annotateObject(value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject {
  return RustApp.annotateObject(value);
}

export function calculateAsync(value: number): Promise<number> {
  return RustApp.calculateAsync(value);
}

export function inspectWithCallback(value: CodegenTypes.UnsafeObject, callback: (
      label: string,
      score: number,
      active: boolean,
      details: CodegenTypes.UnsafeObject
    ) => void): void {
  RustApp.inspectWithCallback(value, callback);
}
