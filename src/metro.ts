import fs from 'node:fs';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

export interface WithRustOptions {
  /**
   * Path to the Rust project, relative to the Metro config's `projectRoot`. Defaults to `./rust`
   * (both library mode and app-local mode keep the Rust crate at the project root).
   */
  rustDir?: string;
}

/** The small, structural slice of a Metro config this module reads and extends. */
export type MetroConfig = Record<string, unknown> & {
  projectRoot?: string;
  watchFolders?: string[];
  server?: Record<string, unknown> & {
    enhanceMiddleware?: (middleware: unknown, server: unknown) => unknown;
  };
};

let watcherProcess: ChildProcess | null = null;

/** Resolves the initialized Rust project directory under `projectRoot`, or `null` if none exists yet (Rust support may not have been added with `init`/`init --app` yet). */
export function findRustDir(projectRoot: string, rustDir?: string): string | null {
  const resolved = path.resolve(projectRoot, rustDir || 'rust');
  return fs.existsSync(path.join(resolved, 'Cargo.toml')) ? resolved : null;
}

/**
 * Starts `react-native-rust watch` as a child process rooted at `projectRoot` (which resolves
 * library mode or app-local mode exactly as running the command by hand would) and forwards its
 * output into this process's own stdout/stderr, so its `[Rust]`/`[RN Rust]` lines land in the
 * same terminal as Metro's own output. No-ops if a watcher is already running, since Metro may
 * invoke `enhanceMiddleware` more than once.
 */
function ensureWatcherRunning(projectRoot: string, notify: (message: string) => void): void {
  if (watcherProcess) return;
  const cliEntry = path.join(__dirname, 'react-native-rust.js');
  const child = spawn(process.execPath, [cliEntry, 'watch'], { cwd: projectRoot });
  watcherProcess = child;
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  child.on('exit', (code) => {
    watcherProcess = null;
    if (code !== 0 && code !== null) {
      notify(`[RN Rust] The Rust watcher exited unexpectedly (code ${code}). Restart Metro to retry, or run \`npx react-native-rust watch\` manually.`);
    }
  });
  const stop = (): void => {
    if (watcherProcess) watcherProcess.kill('SIGINT');
  };
  process.once('exit', stop);
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

/**
 * Stops the watcher process started by `withRust`, if one is running, and resolves once it has
 * exited. Not needed for normal `react-native start` usage (the watcher stops itself when this
 * process exits); exposed for tests and for tools that embed Metro and need to shut it down
 * explicitly.
 */
export function stopRustWatcher(): Promise<void> {
  if (!watcherProcess) return Promise.resolve();
  const child = watcherProcess;
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGINT');
  });
}

/**
 * Wraps a Metro config so `npx react-native start` also runs the Rust dev watcher: a `rust/`
 * change triggers an incremental `cargo build`, and a Spec change regenerates native bindings
 * first, exactly like running `react-native-rust watch` by hand (this spawns that same command
 * and streams its output here). Also adds the Rust project directory to `watchFolders`.
 *
 * Runs only while Metro's dev server is actually serving: `server.enhanceMiddleware` is a hook
 * Metro calls when it starts the HTTP dev server, and never calls during a one-off production
 * bundle (`metro build` / release builds), so no watcher process starts outside development —
 * satisfying the "development-only" requirement without guessing at environment variables.
 *
 * No-ops (with a one-line console notice, and no error) if Rust hasn't been initialized yet, so
 * `withRust(...)` is safe to add to `metro.config.js` before running `react-native-rust init`.
 */
export function withRust(config: MetroConfig, options: WithRustOptions = {}): MetroConfig {
  const projectRoot = config.projectRoot || process.cwd();
  const rustDir = findRustDir(projectRoot, options.rustDir);
  const existingWatchFolders = config.watchFolders || [];
  const watchFolders = rustDir && !existingWatchFolders.includes(rustDir)
    ? [...existingWatchFolders, rustDir]
    : existingWatchFolders;
  const previousEnhanceMiddleware = config.server?.enhanceMiddleware;

  return {
    ...config,
    watchFolders,
    server: {
      ...config.server,
      enhanceMiddleware: (middleware: unknown, server: unknown) => {
        const next = previousEnhanceMiddleware ? previousEnhanceMiddleware(middleware, server) : middleware;
        if (rustDir) {
          ensureWatcherRunning(projectRoot, console.log);
        } else {
          console.log('[RN Rust] No rust/Cargo.toml found; skipping the automatic Rust watcher. Run `npx react-native-rust init` (or `init --app`) to add Rust support.');
        }
        return next;
      },
    },
  };
}
