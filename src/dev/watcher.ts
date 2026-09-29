import path from 'node:path';
import chokidar, { FSWatcher } from 'chokidar';

/**
 * `spec`: the TurboModule `Spec` interface changed — the API surface may have changed and
 * `generate()` must re-run. `rust`: a Rust source file, `Cargo.toml`, or `Cargo.lock` changed —
 * an implementation-only edit that only needs a Cargo rebuild. `other`: outside both, ignored.
 */
export type ChangeKind = 'spec' | 'rust' | 'other';

/**
 * The Rust crate's own root (may live outside `specPath`'s package, e.g. an app's own root in
 * app-local mode — see `reactNativeRust.rustDir`) and the Spec file to watch alongside it.
 */
export interface WatchTarget {
  rustRoot: string;
  specPath: string;
}

/** Classifies an absolute file path as a Spec edit, a Rust source edit, or unrelated. */
export function classifyChange(filePath: string, target: WatchTarget): ChangeKind {
  const resolved = path.resolve(filePath);
  if (resolved === path.resolve(target.specPath)) return 'spec';
  const rustSrc = path.resolve(target.rustRoot, 'src');
  const cargoToml = path.resolve(target.rustRoot, 'Cargo.toml');
  const cargoLock = path.resolve(target.rustRoot, 'Cargo.lock');
  if (resolved === cargoToml || resolved === cargoLock) return 'rust';
  if (resolved.startsWith(`${rustSrc}${path.sep}`) && resolved.endsWith('.rs')) return 'rust';
  return 'other';
}

export interface RustWatcherOptions {
  target: WatchTarget;
  /** Called with the union of change kinds observed since the last debounced batch. */
  onChange: (kinds: Set<ChangeKind>) => void;
  /** Debounce window, in milliseconds, between the first change in a burst and acting on it. */
  debounceMs?: number;
  log?: (message: string) => void;
}

/**
 * Watches a module's Spec file and `rust/` sources (`.rs`, `Cargo.toml`, `Cargo.lock`),
 * debouncing bursts of changes (editor atomic saves, rapid successive saves) into one batch
 * per {@link RustWatcherOptions.debounceMs} window before invoking `onChange`.
 */
export function watchRustProject(options: RustWatcherOptions): FSWatcher {
  const { target, onChange, debounceMs = 200, log = console.log } = options;

  const watcher = chokidar.watch(
    [path.join(target.rustRoot, '**', '*.rs'), path.join(target.rustRoot, 'Cargo.toml'), path.join(target.rustRoot, 'Cargo.lock'), target.specPath],
    {
      ignored: [
        path.join(target.rustRoot, 'target', '**'),
        path.join(target.rustRoot, 'build', '**'),
        path.join(target.rustRoot, 'include', '**'),
        '**/node_modules/**',
        '**/.git/**',
      ],
      ignoreInitial: true,
      // Waits for a file's size to stop changing before firing, so editors that write in
      // multiple chunks (atomic saves, rename-into-place) produce one event, not several.
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
    },
  );

  let pendingKinds = new Set<ChangeKind>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = (filePath: string, eventLabel: string): void => {
    const kind = classifyChange(filePath, target);
    if (kind === 'other') return;
    pendingKinds.add(kind);
    log(`[Rust] ${eventLabel} ${path.relative(path.dirname(target.rustRoot), filePath)}`);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const kinds = pendingKinds;
      pendingKinds = new Set();
      timer = null;
      onChange(kinds);
    }, debounceMs);
  };

  watcher.on('add', (filePath) => schedule(filePath, 'Added'));
  watcher.on('change', (filePath) => schedule(filePath, 'Changed'));
  watcher.on('unlink', (filePath) => schedule(filePath, 'Deleted'));
  watcher.on('error', (error) => log(`[Rust] Watcher error: ${(error as Error).message}`));

  return watcher;
}
