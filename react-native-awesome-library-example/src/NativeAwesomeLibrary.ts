import { TurboModuleRegistry, type TurboModule } from 'react-native';

declare namespace CodegenTypes {
  type UnsafeObject = object;
}

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  subtract(a: number, b: number): number;
  isPositive(value: number): boolean;
  greet(name: string): string;
  scaleValues(values: number[]): number[];
  annotateObject(value: CodegenTypes.UnsafeObject): CodegenTypes.UnsafeObject;
  calculateAsync(value: number): Promise<number>;
  inspectWithCallback(
    value: CodegenTypes.UnsafeObject,
    callback: (
      label: string,
      score: number,
      active: boolean,
      details: CodegenTypes.UnsafeObject
    ) => void
  ): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AwesomeLibrary');
