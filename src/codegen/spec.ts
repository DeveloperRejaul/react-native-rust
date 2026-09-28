import { supportedTypes, rustKeywords, cppKeywords, ts } from './constants';
import { CallbackInfo, CallbackParamInfo, MethodInfo, ParamInfo, Role, TypeInfo } from './types';

/** A `ts.SourceFile` also exposes its parse errors via this internal, undocumented property. */
interface SourceFileWithDiagnostics extends ts.SourceFile {
  parseDiagnostics: readonly ts.Diagnostic[];
}

/**
 * Resolves a TypeScript type node to its Rust/C++ mapping, or throws if the type
 * is not part of the supported surface (see the Spec parsing rules in the README).
 */
export function typeInfo(typeNode: ts.TypeNode, sourceFile: ts.SourceFile, methodName: string, role: Role): TypeInfo {
  const info = supportedTypes.get(typeNode.kind);
  if (info && !(role === 'parameter' && typeNode.kind === ts.SyntaxKind.VoidKeyword)) return info;

  if (role === 'return' && ts.isTypeReferenceNode(typeNode) && typeNode.typeName.getText(sourceFile) === 'Promise') {
    if (typeNode.typeArguments?.length !== 1) throw new Error(`Promise return in ${methodName}() must declare one result type.`);
    const result = typeInfo(typeNode.typeArguments[0], sourceFile, methodName, 'promise result');
    if (result.promise) {
      throw new Error(`Nested Promise or callback results are not supported in ${methodName}().`);
    }
    return { ...result, typescript: typeNode.getText(sourceFile), promise: true };
  }

  const typeName = ts.isTypeReferenceNode(typeNode) ? typeNode.typeName.getText(sourceFile) : '';
  const objectType = typeNode.kind === ts.SyntaxKind.ObjectKeyword
    || ['CodegenTypes.UnsafeObject', 'UnsafeObject'].includes(typeName);
  if (objectType) {
    return {
      kind: 'json',
      typescript: typeNode.getText(sourceFile),
      rust: 'serde_json::Value',
      cpp: 'jsi::Object',
      defaultValue: 'serde_json::json!({})',
    };
  }

  const arrayElement = ts.isArrayTypeNode(typeNode)
    ? typeNode.elementType
    : ts.isTypeReferenceNode(typeNode)
      && ['Array', 'ReadonlyArray'].includes(typeNode.typeName.getText(sourceFile))
      && typeNode.typeArguments?.length === 1
      ? typeNode.typeArguments[0]
      : null;
  if (arrayElement) {
    const elementType = typeInfo(arrayElement, sourceFile, methodName, 'array element');
    if (elementType.promise || elementType.kind === 'void') {
      throw new Error(`Unsupported array element type in ${methodName}().`);
    }
    return {
      kind: 'json',
      typescript: typeNode.getText(sourceFile),
      rust: 'serde_json::Value',
      cpp: 'jsi::Array',
      defaultValue: 'serde_json::json!([])',
    };
  }

  const text = typeNode.getText(sourceFile);
  throw new Error(`Unsupported ${role} type "${text}" in ${methodName}(). Supported types are number, boolean, string, arrays, and CodegenTypes.UnsafeObject${role === 'return' ? ', plus void and Promise<T>' : ''}.`);
}

/**
 * Resolves a function-type node (a callback parameter) to its Rust/C++ mapping.
 * Callbacks must return `void`, have at most four named, explicitly typed,
 * required parameters, and cannot themselves accept callbacks or Promises.
 */
export function callbackInfo(typeNode: ts.TypeNode, sourceFile: ts.SourceFile, methodName: string): CallbackInfo {
  if (!ts.isFunctionTypeNode(typeNode) || typeNode.typeParameters?.length) {
    throw new Error(`Unsupported callback signature in ${methodName}().`);
  }
  if (typeNode.type.kind !== ts.SyntaxKind.VoidKeyword || typeNode.parameters.length > 4) {
    throw new Error(`Callbacks in ${methodName}() must return void and have at most four parameters.`);
  }
  const params: CallbackParamInfo[] = typeNode.parameters.map((parameter) => {
    if (!ts.isIdentifier(parameter.name) || parameter.questionToken || parameter.dotDotDotToken || !parameter.type) {
      throw new Error(`Callback parameters in ${methodName}() must be named, required, and explicitly typed.`);
    }
    const info = typeInfo(parameter.type, sourceFile, methodName, 'callback parameter');
    if (info.promise || info.kind === 'void') {
      throw new Error(`Unsupported callback parameter type in ${methodName}().`);
    }
    return { name: parameter.name.text, ...info };
  });
  return { kind: 'callback', typescript: typeNode.getText(sourceFile), cpp: 'jsi::Function', params };
}

/** Converts a TypeScript `camelCase` identifier to a Rust `snake_case` identifier. */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/** Rejects identifiers that would be invalid or reserved in the generated Rust or C++ code. */
export function validateIdentifier(name: string, location: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) || rustKeywords.has(name) || cppKeywords.has(name)) {
    throw new Error(`Unsupported identifier "${name}" in ${location}; use a non-keyword identifier.`);
  }
}

/**
 * Parses a TurboModule `Spec` interface from TypeScript source text and returns
 * one {@link MethodInfo} per supported method. Throws on the first unsupported or
 * malformed signature, before any files are generated.
 */
export function parseSpec(sourceText: string, fileName = 'NativeModule.ts'): MethodInfo[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) as SourceFileWithDiagnostics;
  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostic = sourceFile.parseDiagnostics[0];
    throw new Error(`Could not parse ${fileName}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }

  const spec = sourceFile.statements.find((statement): statement is ts.InterfaceDeclaration => (
    ts.isInterfaceDeclaration(statement) && statement.name.text === 'Spec'
  ));
  if (!spec) throw new Error(`No "Spec" interface was found in ${fileName}.`);
  if (spec.typeParameters?.length) throw new Error('Generic TurboModule Spec interfaces are not supported.');
  if (spec.members.length === 0) throw new Error('The Spec interface must declare at least one method.');

  const names = new Set<string>();
  const rustNames = new Set<string>();
  const methods: MethodInfo[] = spec.members.map((member) => {
    if (!ts.isMethodSignature(member)) {
      throw new Error('Only method signatures are supported in the Spec interface.');
    }
    if (!member.name || !ts.isIdentifier(member.name) || member.questionToken || member.typeParameters?.length) {
      throw new Error('Optional, computed, and generic Spec methods are not supported.');
    }

    const name = member.name.text;
    validateIdentifier(name, 'Spec method');
    if (names.has(name)) throw new Error(`Overloaded method "${name}" is not supported.`);
    names.add(name);
    const rustName = toSnakeCase(name);
    validateIdentifier(rustName, `Rust mapping for ${name}()`);
    if (rustNames.has(rustName)) throw new Error(`Multiple Spec methods map to the Rust name "${rustName}".`);
    rustNames.add(rustName);

    const params: ParamInfo[] = member.parameters.map((parameter) => {
      if (!ts.isIdentifier(parameter.name) || parameter.dotDotDotToken || parameter.questionToken || parameter.initializer) {
        throw new Error(`Rest, optional, and destructured parameters are not supported in ${name}().`);
      }
      const paramName = parameter.name.text;
      validateIdentifier(paramName, `parameter in ${name}()`);
      if (!parameter.type) throw new Error(`Parameter "${paramName}" in ${name}() needs an explicit type.`);
      const info = ts.isFunctionTypeNode(parameter.type)
        ? callbackInfo(parameter.type, sourceFile, name)
        : typeInfo(parameter.type, sourceFile, name, 'parameter');
      return { name: paramName, ...info } as ParamInfo;
    });
    if (new Set(params.map((param) => param.name)).size !== params.length) {
      throw new Error(`Duplicate parameter names are not supported in ${name}().`);
    }
    if (!member.type) throw new Error(`Method "${name}()" needs an explicit return type.`);
    return {
      name,
      rustName,
      symbol: `rnrs_${rustName}`,
      params,
      returnType: typeInfo(member.type, sourceFile, name, 'return'),
    };
  });
  for (const method of methods) {
    if (method.returnType.promise && method.params.some((param) => param.kind === 'callback')) {
      throw new Error(`Callbacks in Promise method ${method.name}() are not supported. Use a Codegen event emitter for asynchronous callbacks.`);
    }
  }
  return methods;
}
