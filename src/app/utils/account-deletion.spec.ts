import { deletionRecord } from './account-deletion';

describe('deletionRecord (#452)', () => {
  it('counts trips and keeps the latest trip end, with no name or email', () => {
    const r = deletionRecord({ uid: 'u1', createdAt: 1_780_000_000_000.4, displayName: 'Maya', email: 'm@x.io' } as never,
      [{ endDate: '2026-10-09' }, { endDate: '2026-12-01' }, { endDate: '2026-03-02' }]);
    expect(r).toEqual({ uid: 'u1', accountCreatedAt: 1_780_000_000_000, trips: 3, lastTripEnd: '2026-12-01', test: false });
  });

  it('no trips: no last trip end', () => {
    expect(deletionRecord({ uid: 'u1', createdAt: 5 }, []).lastTripEnd).toBeNull();
    expect(deletionRecord({ uid: 'u1', createdAt: 5 }, []).trips).toBe(0);
  });

  it('ignores trips without a usable end date, and copes with a missing creation time', () => {
    const r = deletionRecord({ uid: 'u1' }, [{ endDate: '' }, { endDate: 'soon' }, {}]);
    expect(r.lastTripEnd).toBeNull();
    expect(r.trips).toBe(3);
    expect(r.accountCreatedAt).toBe(0);
  });

  it('marks test accounts, so Pulse can hide them', () => {
    expect(deletionRecord({ uid: 'u1', isTest: true }, []).test).toBeTrue();
  });
});
