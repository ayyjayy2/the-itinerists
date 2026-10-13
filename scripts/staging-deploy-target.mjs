#!/usr/bin/env node
/**
 * Which commit a staging deploy should build (#439).
 *
 * Each green CI run on master starts a deploy, and a new deploy cancels one in
 * progress. When two merges land close together and the older one's CI
 * finishes last, its deploy would cancel the newer one and leave staging on
 * the older commit. So a deploy builds the newest master that has passed CI:
 *
 *   tip is its own commit        -> deploy it
 *   tip passed CI                -> deploy the tip
 *   tip's CI not finished/started -> deploy nothing; the tip's own run follows
 *   tip failed CI                -> deploy its own (green) commit
 *
 * Used by .github/workflows/deploy-staging.yml:
 *   node scripts/staging-deploy-target.mjs <triggered-sha> <tip-sha> <tip-ci-conclusion-or-status>
 * prints the commit to deploy, or nothing.
 */
const PASSED = 'success';
const FAILED = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale', 'skipped', 'neutral']);

/** @returns {{ deploy: string | null }} */
export function pickDeployCommit({ triggered, tip, tipCi }) {
  if (!tip || tip === triggered) return { deploy: triggered };
  if (tipCi === PASSED) return { deploy: tip };
  if (FAILED.has(tipCi)) return { deploy: triggered };
  return { deploy: null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [triggered, tip, tipCi] = process.argv.slice(2);
  const { deploy } = pickDeployCommit({ triggered, tip, tipCi: tipCi || null });
  if (deploy) process.stdout.write(deploy);
}
