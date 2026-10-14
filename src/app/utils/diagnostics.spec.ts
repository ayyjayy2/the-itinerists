import { ClosedInviteTracker, SLOW_START_MS, startupReport } from './diagnostics';

describe('startupReport (#485)', () => {
  it('says nothing for a quick start', () => {
    expect(startupReport({ authMs: 300, readyMs: SLOW_START_MS - 1, native: true, from: 'launch' })).toBeNull();
  });

  it('describes a slow start: where the time went and on what', () => {
    expect(startupReport({ authMs: 1200, readyMs: 9800, native: true, from: 'launch' }))
      .toBe('slow start: sign-in known 1.2 s after launch, trip ready 9.8 s after launch (iPhone app)');
    expect(startupReport({ authMs: 400, readyMs: 5000, native: false, from: 'sign-in' }))
      .toBe('slow start: sign-in known 0.4 s after launch, trip ready 5.0 s after sign-in (website)');
  });
});

describe('ClosedInviteTracker (#484)', () => {
  it('reports once when a closed invite shows up as live again', () => {
    const t = new ClosedInviteTracker();
    t.closed('ABC123', 1_000);
    expect(t.check(['XYZ999'], { fromCache: false, pendingWrites: false }, 2_000)).toBeNull();
    expect(t.check(['ABC123'], { fromCache: true, pendingWrites: false }, 4_500))
      .toBe('closed invite is live again 3.5 s after closing (from cache, no pending writes)');
    expect(t.check(['ABC123'], { fromCache: false, pendingWrites: false }, 9_000)).toBeNull();
  });

  it('never puts the code itself in the report', () => {
    const t = new ClosedInviteTracker();
    t.closed('SECRET', 0);
    expect(t.check(['SECRET'], { fromCache: false, pendingWrites: true }, 100)).not.toContain('SECRET');
  });

  it('catches one that vanished and then came back', () => {
    const t = new ClosedInviteTracker();
    t.closed('ABC123', 0);
    expect(t.check([], { fromCache: true, pendingWrites: true }, 10)).toBeNull();
    expect(t.check(['ABC123'], { fromCache: false, pendingWrites: false }, 20_000)).toContain('20.0 s after closing');
  });

  it('stops watching after 10 minutes', () => {
    const t = new ClosedInviteTracker();
    t.closed('ABC123', 0);
    expect(t.check(['ABC123'], { fromCache: false, pendingWrites: false }, 10 * 60_000 + 1)).toBeNull();
  });
});
