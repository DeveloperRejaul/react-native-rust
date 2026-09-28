/**
 * Shared type definitions for the CLI entry point, the library-mode commands
 * (`init`/`generate`/`doctor`/`build`), and app-local mode.
 */

/** The subset of an npm `package.json` this CLI reads or writes. Unknown fields are preserved verbatim. */
export interface PackageManifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  files?: string[];
  codegenConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Options for {@link run} in `react-native-rust-lib`; mirrors the subset of `spawnSync` options this CLI needs. */
export interface RunOptions {
  cwd?: string;
  /** When true, the child process shares this process's stdio instead of being captured. */
  inherit?: boolean;
}

/** The outcome of running an external command via {@link run}. */
export interface CommandResult {
  ok: boolean;
  /** Captured stdout on success. */
  output?: string;
  /** Failure reason: the spawn error, or captured stderr/stdout, on failure. */
  message?: string;
}

/** The resolved identity of a C++ TurboModule library at the current working directory. */
export interface PackageRootInfo {
  root: string;
  manifest: PackageManifest;
  manifestPath: string;
  /** The TurboModule's C++ class name prefix, read from `cxxModuleHeaderName` (e.g. `Awesome` for `AwesomeImpl`). */
  moduleName: string;
}
