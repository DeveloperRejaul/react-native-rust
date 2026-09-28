import fs from 'node:fs';
import path from 'node:path';
import {
  HEADER_START,
  HEADER_END,
  SOURCE_START,
  SOURCE_END,
} from './constants';
import { renderCppMethods, renderRustExports, renderRustHandler, renderRustModuleList, renderRustWasmModule, renderWrappers } from './renderers';
import { MethodInfo } from './types';

/** Replaces the text between a `[start, end]` marker pair, or returns `null` if the markers are missing. */
export function replaceMarkedRegion(source: string, startMarker: string, endMarker: string, generated: string): string | null {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < start) return null;
  const block = `${startMarker}\n${generated}\n${endMarker}`;
  return `${source.slice(0, start)}${block}${source.slice(end + endMarker.length)}`;
}

/** Replaces a brace-delimited C++ method body (matched by brace depth) with a marked, generated block. */
export function replaceTemplateMethod(source: string, markerStart: string, markerEnd: string, generated: string, methodNeedle: string): string {
  const functionIndex = source.indexOf(methodNeedle);
  if (functionIndex < 0) throw new Error(`Could not locate C++ template method "${methodNeedle}".`);
  const lineStart = source.lastIndexOf('\n', functionIndex) + 1;
  const bodyStart = source.indexOf('{', functionIndex);
  if (bodyStart < 0) throw new Error(`Could not locate the body for C++ method "${methodNeedle}".`);
  let depth = 0;
  let bodyEnd = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        bodyEnd = index + 1;
        break;
      }
    }
  }
  if (bodyEnd < 0) throw new Error(`Could not find the end of C++ method "${methodNeedle}".`);
  const block = `${markerStart}\n${generated}\n${markerEnd}`;
  return `${source.slice(0, lineStart)}${block}${source.slice(bodyEnd)}`;
}

/** True when the template's `multiply` method still has its unmodified demo body (`return a * b;`). */
export function hasDefaultMultiplyBody(source: string, moduleName: string): boolean {
  const methodIndex = source.indexOf(`${moduleName}Impl::multiply(`);
  if (methodIndex < 0) return false;
  const bodyStart = source.indexOf('{', methodIndex);
  if (bodyStart < 0) return false;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index).replace(/\s+/g, '') === 'returna*b;';
      }
    }
  }
  return false;
}

/**
 * Writes the generated method block into a C++ file: into existing generated markers if
 * present, or by replacing the template's demo `multiply` method on first `init`.
 */
export function updateCppFile(
  source: string,
  markers: [string, string],
  generated: string,
  templateMethod: boolean,
  methodNeedle: string,
  includeRustHeader = false,
): string {
  let updated = source;
  if (includeRustHeader && !updated.includes('../rust/include/rust_api.h')) {
    if (!updated.includes('#pragma once')) throw new Error('Unsupported C++ module header template.');
    updated = updated.replace('#pragma once', '#pragma once\n\n#include "../rust/include/rust_api.h"');
  }
  const marked = replaceMarkedRegion(updated, markers[0], markers[1], generated);
  if (marked !== null) return marked;
  if (updated.includes(markers[0]) || updated.includes(markers[1])) {
    throw new Error('Incomplete react-native-rust generated markers found in C++ source.');
  }
  if (!templateMethod) throw new Error('C++ generated markers are missing; refusing to overwrite the module.');
  if (methodNeedle.endsWith(';')) {
    const count = updated.split(methodNeedle).length - 1;
    if (count !== 1) throw new Error('Could not uniquely locate the C++ template method declaration.');
    return updated.replace(methodNeedle, `${markers[0]}\n${generated}\n${markers[1]}`);
  }
  return replaceTemplateMethod(updated, markers[0], markers[1], generated, methodNeedle);
}

/** Collapses whitespace so two differently formatted Rust signatures can be compared for equality. */
export function normalizeSignature(text: string): string {
  return text.replace(/\s+/g, '').replace(/,\)/g, ')');
}

/**
 * Ensures a previously generated Rust handler's signature still matches the current Spec method.
 * Regeneration preserves handler bodies, so a mismatch must fail loudly instead of silently drifting.
 */
export function validateExistingHandler(filePath: string, method: MethodInfo): void {
  const contents = fs.readFileSync(filePath, 'utf8');
  const signaturePattern = new RegExp(`pub\\s+fn\\s+${method.rustName}\\s*\\(([^)]*)\\)\\s*->\\s*([^\\{]+)\\{`);
  const match = contents.match(signaturePattern);
  const args = method.params.map((param) => {
    if (param.kind !== 'callback') return `${param.name}: ${param.rust}`;
    const callbackTypes = param.params.map((callbackParam) => callbackParam.rust).join(', ');
    return `${param.name}: &mut dyn FnMut(${callbackTypes})`;
  }).join(', ');
  const returnType = method.returnType.promise
    ? `Result<${method.returnType.rust}, String>`
    : method.returnType.rust;
  const expected = `${method.rustName}(${args}) -> ${returnType}`;
  const expectedSignature = `pub fn ${expected} {`;
  if (normalizeSignature(contents).includes(normalizeSignature(expectedSignature))) return;
  if (!match || normalizeSignature(match[0].replace(/^pub\s+fn\s+/, '').replace(/\{\s*$/, '')) !== normalizeSignature(expected)) {
    throw new Error(`Rust handler ${path.relative(process.cwd(), filePath)} does not match the TypeScript Spec. Update its signature before regenerating.`);
  }
}

/**
 * Renders every generated file for a library or app-local module: the C++ TurboModule
 * methods, the Rust FFI and WASM exports and handler stubs, and the TypeScript wrappers.
 * `crateName` is the Rust crate's package name (from `rust/Cargo.toml`), used to import the
 * `wasm-pack --target web` output from the generated web wrapper. Returns a map of absolute
 * file path to new contents; the caller is responsible for writing them.
 */
export function renderProjectBindings(root: string, moduleName: string, methods: MethodInfo[], initialize: boolean, crateName: string): Map<string, string> {
  const headerPath = path.join(root, 'cpp', `${moduleName}Impl.h`);
  const sourcePath = path.join(root, 'cpp', `${moduleName}Impl.cpp`);
  const header = fs.readFileSync(headerPath, 'utf8');
  const source = fs.readFileSync(sourcePath, 'utf8');
  if (initialize && !hasDefaultMultiplyBody(source, moduleName)) {
    throw new Error('The C++ multiply demo was customized; move its logic into Rust before running init. No files were changed.');
  }
  const cpp = renderCppMethods(methods, moduleName);
  const generatedIncludes = cpp.source.match(/^#include .+$/gm) || [];
  const cppSource = cpp.source.replace(/^#include .+\n/gm, '');
  const headerTemplateMethod = 'double multiply(jsi::Runtime& rt, double a, double b);';
  const sourceTemplateMethod = `${moduleName}Impl::multiply(`;
  const updatedHeader = updateCppFile(header, [HEADER_START, HEADER_END], cpp.header, initialize, headerTemplateMethod, true);
  let updatedSource = updateCppFile(source, [SOURCE_START, SOURCE_END], cppSource, initialize, sourceTemplateMethod);
  if (generatedIncludes.length > 0) {
    const namespaceIndex = updatedSource.indexOf('\nnamespace facebook::react {');
    if (namespaceIndex < 0) throw new Error('Could not locate the C++ namespace for generated includes.');
    const missingIncludes = generatedIncludes.filter((include) => !updatedSource.includes(include));
    if (missingIncludes.length > 0) {
      const insertionPoint = namespaceIndex + 1;
      updatedSource = `${updatedSource.slice(0, insertionPoint)}${missingIncludes.join('\n')}\n${updatedSource.slice(insertionPoint)}`;
    }
  }

  const rustDirectory = path.join(root, 'rust', 'src');
  const moduleList = renderRustModuleList(methods);
  const updates = new Map<string, string>([
    [headerPath, updatedHeader],
    [sourcePath, updatedSource],
    [path.join(rustDirectory, 'lib.rs'), renderRustExports(methods)],
    [path.join(rustDirectory, 'api', 'mod.rs'), moduleList],
    [path.join(rustDirectory, 'wasm.rs'), renderRustWasmModule(methods)],
  ]);
  for (const method of methods) {
    const handlerPath = path.join(rustDirectory, 'api', `${method.rustName}.rs`);
    if (fs.existsSync(handlerPath)) validateExistingHandler(handlerPath, method);
    else updates.set(handlerPath, renderRustHandler(method));
  }

  const wrappers = renderWrappers(methods, moduleName, crateName);
  const generatedModulePath = path.join(root, 'src', 'rust-generated');
  updates.set(`${generatedModulePath}.tsx`, wrappers.web);
  updates.set(`${generatedModulePath}.native.tsx`, wrappers.native);
  const indexPath = path.join(root, 'src', 'index.tsx');
  let index = fs.readFileSync(indexPath, 'utf8');
  for (const method of methods) {
    const oldExport = new RegExp(`^export\\s*\\{\\s*${method.name}\\s*\\}\\s*from\\s*['"]\\./${method.name}['"];?\\s*$`, 'm');
    index = index.replace(oldExport, '');
  }
  if (!index.includes("export * from './rust-generated';")) {
    index = `${index.trimEnd()}\nexport * from './rust-generated';\n`;
  }
  updates.set(indexPath, index);
  return updates;
}
