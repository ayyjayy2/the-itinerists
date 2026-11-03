/** Waiting took longer than it ever should: the caller says so instead of spinning (#703). */
export class StalledError extends Error {
  constructor() { super('Still waiting after the time limit'); }
}

/**
 * Waits for `value`, but not forever (#703). After `nudgeAfterMs` it calls
 * `nudge` once (e.g. restart the database connection, which is what a refresh
 * did); after `giveUpAfterMs` it rejects with StalledError. A failure of
 * `value` itself is passed on unchanged.
 */
export function waitWithNudge<T>(value: Promise<T>, nudge: () => unknown, opts: { nudgeAfterMs: number; giveUpAfterMs: number }): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const nudger = setTimeout(() => {
      try { void Promise.resolve(nudge()).catch(() => { /* keep waiting */ }); } catch { /* keep waiting */ }
    }, opts.nudgeAfterMs);
    const quitter = setTimeout(() => reject(new StalledError()), opts.giveUpAfterMs);
    const done = () => { clearTimeout(nudger); clearTimeout(quitter); };
    value.then(v => { done(); resolve(v); }, e => { done(); reject(e); });
  });
}
