const ts = require('typescript');

const HEADER_START = '// react-native-rust:generated-methods:start';
const HEADER_END = '// react-native-rust:generated-methods:end';
const SOURCE_START = '// react-native-rust:generated-methods:start';
const SOURCE_END = '// react-native-rust:generated-methods:end';

const rustKeywords = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false',
  'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
  'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
]);

const cppKeywords = new Set([
  'alignas', 'alignof', 'and', 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
  'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'namespace', 'new', 'noexcept', 'not',
  'nullptr', 'operator', 'or', 'private', 'protected', 'public', 'register', 'return', 'short', 'signed',
  'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try', 'typedef', 'typename',
  'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'while', 'xor',
]);

const supportedTypes = new Map([
  [ts.SyntaxKind.NumberKeyword, { kind: 'number', typescript: 'number', rust: 'f64', cpp: 'double', defaultValue: '0.0' }],
  [ts.SyntaxKind.BooleanKeyword, { kind: 'boolean', typescript: 'boolean', rust: 'bool', cpp: 'bool', defaultValue: 'false' }],
  [ts.SyntaxKind.StringKeyword, { kind: 'json', typescript: 'string', rust: 'String', cpp: 'jsi::String', defaultValue: 'String::new()' }],
  [ts.SyntaxKind.VoidKeyword, { kind: 'void', typescript: 'void', rust: '()', cpp: 'void', defaultValue: null }],
]);

module.exports = {
  HEADER_START,
  HEADER_END,
  SOURCE_START,
  SOURCE_END,
  rustKeywords,
  cppKeywords,
  supportedTypes,
  ts,
};
