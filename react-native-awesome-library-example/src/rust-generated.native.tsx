declare namespace CodegenTypes { type UnsafeObject = object; }
import AwesomeLibrary from './NativeAwesomeLibrary';

export function multiply(a: number, b: number): number {
  return AwesomeLibrary.multiply(a, b);
}

export function subtract(a: number, b: number): number {
  return AwesomeLibrary.subtract(a, b);
}

export function isPositive(value: number): boolean {
  return AwesomeLibrary.isPositive(value);
}

export function greet(name: string): string {
  return AwesomeLibrary.greet(name);
}

export function scaleValues(values: number[]): number[] {
  return AwesomeLibrary.scaleValues(values);
}

export function annotateObject(value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject {
  return AwesomeLibrary.annotateObject(value);
}

export function calculateAsync(value: number): Promise<number> {
  return AwesomeLibrary.calculateAsync(value);
}

export function inspectWithCallback(value: CodegenTypes.UnsafeObject, callback: (
      label: string,
      score: number,
      active: boolean,
      details: CodegenTypes.UnsafeObject
    ) => void): void {
  AwesomeLibrary.inspectWithCallback(value, callback);
}
