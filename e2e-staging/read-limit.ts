import { execSync } from 'node:child_process';

/**
 * Runs before the staging checks (#587). Staging is on Firebase's free plan:
 * 50,000 Firestore reads a day, reset at midnight Pacific, and a full run costs
 * several thousand. This asks Cloud Monitoring (which costs no Firestore reads)
 * how many staging has used today, and refuses to start above the limit.
 *
 * Needs the owner's gcloud sign-in (`gcloud auth login`); the staging service
 * account can't read Monitoring on a project without billing.
 * STAGING_READ_LIMIT=… changes the limit; STAGING_READS_OK=1 skips the check,
 * only when the owner says so.
 */
const PROJECT = 'the-itinerists-staging';
const DAILY = 50_000;
const LIMIT = Number(process.env['STAGING_READ_LIMIT'] || 35_000);

export default async function readLimit() {
  if (process.env['STAGING_READS_OK'] === '1') {
    console.warn('[read limit] skipped (STAGING_READS_OK=1)');
    return;
  }
  const now = new Date();
  const since = pacificMidnight(now);
  let used: number;
  try {
    used = await readsSince(since, now, accessToken());
  } catch (e) {
    stop(`couldn't read staging's read count: ${(e as Error).message}\n` +
      'Sign in with `gcloud auth login`, or run with STAGING_READS_OK=1 if the owner says so.');
  }
  const resets = `${hoursUntil(since, now)} at midnight Pacific`;
  if (used >= LIMIT) {
    stop(`staging has used ${used.toLocaleString('en-US')} of its ${DAILY.toLocaleString('en-US')} free reads today ` +
      `(this check stops at ${LIMIT.toLocaleString('en-US')}). It resets in ${resets}.\n` +
      'Test locally until then: npm run start:demo, npm run test:e2e.');
  }
  console.log(`[read limit] staging has used ${used.toLocaleString('en-US')} of ${DAILY.toLocaleString('en-US')} reads today; resets in ${resets}`);
}

function stop(message: string): never {
  throw new Error(`[read limit] Not running the staging checks: ${message}`);
}

function accessToken(): string {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** Firestore document reads on staging between `start` and `end`, summed over every series. */
async function readsSince(start: Date, end: Date, token: string): Promise<number> {
  const seconds = Math.max(60, Math.ceil((end.getTime() - start.getTime()) / 1000));
  const query = new URLSearchParams({
    filter: 'metric.type="firestore.googleapis.com/document/read_count"',
    'interval.startTime': start.toISOString(),
    'interval.endTime': end.toISOString(),
    'aggregation.alignmentPeriod': `${seconds}s`,
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? `Monitoring answered ${res.status}`);
  // No series at all means no reads yet today.
  return (body.timeSeries ?? []).flatMap((s: any) => s.points ?? [])
    .reduce((sum: number, p: any) => sum + Number(p.value?.int64Value ?? 0), 0);
}

/** The last midnight in Pacific time (an hour out on the two clock-change days, which is fine here). */
export function pacificMidnight(now: Date): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(now).map(p => [p.type, Number(p.value)]));
  const elapsed = ((parts['hour'] * 60 + parts['minute']) * 60 + parts['second']) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - elapsed);
}

function hoursUntil(midnight: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((midnight.getTime() + 24 * 3600_000 - now.getTime()) / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
