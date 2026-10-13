// Which commit a staging deploy should build (scripts/staging-deploy-target.mjs, #439).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDeployCommit } from '../scripts/staging-deploy-target.mjs';

test('deploys its own commit when it is still the tip of master', () => {
  assert.deepEqual(pickDeployCommit({ triggered: 'aaa', tip: 'aaa', tipCi: 'success' }), { deploy: 'aaa' });
});

test('deploys the tip instead when master has moved on and the tip has passed CI', () => {
  // Two quick merges: the older merge's CI finished last. It must not put staging back on the older commit.
  assert.deepEqual(pickDeployCommit({ triggered: 'old', tip: 'new', tipCi: 'success' }), { deploy: 'new' });
});

test("steps aside while the tip's CI is still running: that run's own deploy follows", () => {
  for (const tipCi of ['queued', 'in_progress', 'pending', 'waiting', 'requested'])
    assert.equal(pickDeployCommit({ triggered: 'old', tip: 'new', tipCi }).deploy, null, tipCi);
});

test('falls back to its own commit when the tip failed CI, so staging still moves forward', () => {
  for (const tipCi of ['failure', 'cancelled', 'timed_out'])
    assert.deepEqual(pickDeployCommit({ triggered: 'old', tip: 'new', tipCi }), { deploy: 'old' }, tipCi);
});

test("steps aside when the tip's CI hasn't started yet: it will deploy when it finishes", () => {
  assert.deepEqual(pickDeployCommit({ triggered: 'old', tip: 'new', tipCi: null }), { deploy: null });
});
