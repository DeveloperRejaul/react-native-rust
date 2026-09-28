/**
 * Shared type definitions for the Spec parser and code renderers.
 * These describe how a TypeScript type maps onto its Rust and C++ counterparts.
 */

/**
 * The kind of value a TypeScript type maps to on the Rust/C++ side of the ABI.
 * `json` covers strings, arrays, and `CodegenTypes.UnsafeObject`, which all cross
 * the boundary as a JSON-encoded buffer. Never produced for a callback: callbacks
 * are represented separately by {@link CallbackInfo}, whose `kind` is `'callback'`.
 */
export type ValueKind = 'number' | 'boolean' | 'json' | 'void';

/** The kind of any resolved Spec type, value or callback. */
export type TypeKind = ValueKind | 'callback';

/** The Rust/C++/TypeScript mapping for one directly-representable scalar or void type. */
export interface SupportedTypeInfo {
  kind: ValueKind;
  typescript: string;
  rust: string;
  cpp: string;
  defaultValue: string | null;
}

/** The Rust/C++/TypeScript mapping for one method parameter, return value, or callback payload. */
export interface TypeInfo {
  kind: ValueKind;
  typescript: string;
  rust: string;
  cpp: string;
  defaultValue: string | null;
  /** Set on a return type that is `Promise<T>`; absent otherwise. */
  promise?: boolean;
}

/** One named, typed parameter of a synchronous callback. */
export interface CallbackParamInfo extends TypeInfo {
  name: string;
}

/** The shape of a `(args) => void` callback parameter, distinct from a plain value type. */
export interface CallbackInfo {
  kind: 'callback';
  typescript: string;
  cpp: string;
  params: CallbackParamInfo[];
}

/** A Spec method parameter: either a plain value or a synchronous callback. */
export type ParamInfo = ({ name: string } & TypeInfo) | ({ name: string } & CallbackInfo);

/** A fully resolved, supported Spec method, ready for Rust/C++/TypeScript rendering. */
export interface MethodInfo {
  name: string;
  rustName: string;
  symbol: string;
  params: ParamInfo[];
  returnType: TypeInfo;
}

/** Where in a method signature a type was found; used to phrase "unsupported type" errors. */
export type Role = 'parameter' | 'return' | 'promise result' | 'array element' | 'callback parameter';
