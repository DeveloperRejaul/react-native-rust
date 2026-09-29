/**
 * A single-flight, coalescing task runner for the Rust dev watcher.
 *
 * File-change events can arrive faster than a Cargo build completes. Running one build per
 * event would overlap builds and corrupt Cargo's incremental cache; queuing one run per event
 * would fall further and further behind. This runner keeps at most one build in flight and at
 * most one more pending: extra requests that arrive while a build is running are coalesced into
 * that single pending run instead of queuing up.
 */
export class SingleFlightQueue {
  private running = false;

  private pending = false;

  constructor(private readonly task: () => Promise<void>) {}

  /** Requests a run. Coalesced into the in-flight run's follow-up if one is already running. */
  request(): void {
    if (this.running) {
      this.pending = true;
      return;
    }
    void this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    do {
      this.pending = false;
      try {
        await this.task();
      } catch {
        // The task reports its own failures (e.g. a failed cargo build); swallow here so one
        // failed run does not stop the watcher from reacting to the next change.
      }
    } while (this.pending);
    this.running = false;
  }
}
