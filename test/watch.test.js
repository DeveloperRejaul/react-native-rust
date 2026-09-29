const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { classifyChange } = require('../dist/dev/watcher.js');
const { SingleFlightQueue } = require('../dist/dev/buildQueue.js');

const target = { rustRoot: path.join('/proj/rust'), specPath: path.join('/proj/src/NativeDemo.ts') };

test('classifyChange identifies the Spec file, Rust sources, Cargo files, and unrelated files', () => {
  assert.equal(classifyChange(path.join('/proj/src/NativeDemo.ts'), target), 'spec');
  assert.equal(classifyChange(path.join('/proj/rust/src/api/multiply.rs'), target), 'rust');
  assert.equal(classifyChange(path.join('/proj/rust/src/lib.rs'), target), 'rust');
  assert.equal(classifyChange(path.join('/proj/rust/Cargo.toml'), target), 'rust');
  assert.equal(classifyChange(path.join('/proj/rust/Cargo.lock'), target), 'rust');
  assert.equal(classifyChange(path.join('/proj/README.md'), target), 'other');
  assert.equal(classifyChange(path.join('/proj/rust/target/debug/build/output.rs'), target), 'other');
  assert.equal(classifyChange(path.join('/proj/rust/src/api/multiply.rs.swp'), target), 'other');

  const appTarget = { rustRoot: path.join('/app/rust'), specPath: path.join('/app/.rust-native/src/NativeApp.ts') };
  assert.equal(classifyChange(path.join('/app/rust/src/api/multiply.rs'), appTarget), 'rust');
  assert.equal(classifyChange(path.join('/app/.rust-native/src/NativeApp.ts'), appTarget), 'spec');
  assert.equal(classifyChange(path.join('/app/.rust-native/cpp/AppImpl.cpp'), appTarget), 'other');
});

test('SingleFlightQueue runs one task per request and never overlaps two runs', async () => {
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const queue = new SingleFlightQueue(async () => {
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    active -= 1;
  });

  queue.request();
  await new Promise((resolve) => { setTimeout(resolve, 60); });
  assert.equal(calls, 1);
  assert.equal(maxActive, 1);
});

test('SingleFlightQueue coalesces requests that arrive mid-run into exactly one follow-up run', async () => {
  let calls = 0;
  const queue = new SingleFlightQueue(async () => {
    calls += 1;
    await new Promise((resolve) => { setTimeout(resolve, 30); });
  });

  queue.request();
  queue.request();
  queue.request();
  await new Promise((resolve) => { setTimeout(resolve, 120); });
  assert.equal(calls, 2, 'three requests during one run should produce the original run plus one coalesced follow-up, not three runs');
});

test('SingleFlightQueue keeps accepting requests after a task throws', async () => {
  let calls = 0;
  const queue = new SingleFlightQueue(async () => {
    calls += 1;
    if (calls === 1) throw new Error('simulated build failure');
  });

  queue.request();
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  assert.equal(calls, 1);

  queue.request();
  await new Promise((resolve) => { setTimeout(resolve, 20); });
  assert.equal(calls, 2, 'a failed run must not stop the queue from accepting further requests');
});
