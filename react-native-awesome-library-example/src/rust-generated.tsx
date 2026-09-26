declare namespace CodegenTypes { type UnsafeObject = object; }

export function multiply(_a: number, _b: number): number {
  throw new Error('This method is only supported on native platforms.');
}

export function subtract(_a: number, _b: number): number {
  throw new Error('This method is only supported on native platforms.');
}

export function isPositive(_value: number): boolean {
  throw new Error('This method is only supported on native platforms.');
}

export function greet(_name: string): string {
  throw new Error('This method is only supported on native platforms.');
}

export function scaleValues(_values: number[]): number[] {
  throw new Error('This method is only supported on native platforms.');
}

export function annotateObject(_value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject {
  throw new Error('This method is only supported on native platforms.');
}

export function calculateAsync(_value: number): Promise<number> {
  throw new Error('This method is only supported on native platforms.');
}

export function inspectWithCallback(_value: CodegenTypes.UnsafeObject, _callback: (
      label: string,
      score: number,
      active: boolean,
      details: CodegenTypes.UnsafeObject
    ) => void): void {
  throw new Error('This method is only supported on native platforms.');
}
