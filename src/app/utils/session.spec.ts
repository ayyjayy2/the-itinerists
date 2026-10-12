import { SESSION_EXPIRED_MESSAGE, SESSION_MAX_DAYS, sessionExpired } from './session';

describe('sessionExpired', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.parse('2027-01-10T12:00:00Z');

  it('keeps a session signed in within the last 90 days', () => {
    expect(sessionExpired(new Date(now - 89 * DAY).toUTCString(), now)).toBeFalse();
  });

  it('ends a session whose last password sign-in was 90 days ago or more', () => {
    expect(sessionExpired(new Date(now - SESSION_MAX_DAYS * DAY).toUTCString(), now)).toBeTrue();
    expect(sessionExpired(new Date(now - 200 * DAY).toUTCString(), now)).toBeTrue();
  });

  it('leaves the decision to the rules when the time is unknown', () => {
    expect(sessionExpired(undefined, now)).toBeFalse();
    expect(sessionExpired('not a date', now)).toBeFalse();
  });

  it('tells the person why and for how long', () => {
    expect(SESSION_EXPIRED_MESSAGE).toContain('sign in again');
    expect(SESSION_EXPIRED_MESSAGE).toContain('90 days');
  });
});
