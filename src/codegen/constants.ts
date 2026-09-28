import ts from 'typescript';
import { SupportedTypeInfo } from './types';

/** Marker pair delimiting the generated method block in a C++ header file. */
export const HEADER_START = '// react-native-rust:generated-methods:start';
export const HEADER_END = '// react-native-rust:generated-methods:end';
/** Marker pair delimiting the generated method block in a C++ source file. */
export const SOURCE_START = '// react-native-rust:generated-methods:start';
export const SOURCE_END = '// react-native-rust:generated-methods:end';

/** Reserved words that cannot be used as generated Rust identifiers. */
export const rustKeywords = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false',
  'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
]);

/** Reserved words that cannot be used as generated C++ identifiers. */
export const cppKeywords = new Set([
  'alignas', 'alignof', 'and', 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
  'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'namespace', 'new', 'noexcept', 'not',
  'nullptr', 'operator', 'or', 'private', 'protected', 'public', 'register', 'return', 'short', 'signed',
  'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename',
  'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while', 'xor',
]);

/** Directly-representable TypeScript keyword types, keyed by their AST syntax kind. */
export const supportedTypes = new Map<ts.SyntaxKind, SupportedTypeInfo>([
  [ts.SyntaxKind.NumberKeyword, { kind: 'number', typescript: 'number', rust: 'f64', cpp: 'double', defaultValue: '0.0' }],
  [ts.SyntaxKind.BooleanKeyword, { kind: 'boolean', typescript: 'boolean', rust: 'bool', cpp: 'bool', defaultValue: 'false' }],
  [ts.SyntaxKind.StringKeyword, { kind: 'json', typescript: 'string', rust: 'String', cpp: 'jsi::String', defaultValue: 'String::new()' }],
  [ts.SyntaxKind.VoidKeyword, { kind: 'void', typescript: 'void', rust: '()', cpp: 'void', defaultValue: null }],
]);

export { ts };
