import { RECONNECT_AFTER_HIDDEN_MS, shouldReconnect } from './firestore-resume';

describe('shouldReconnect', () => {
  const now = 1_000_000;

  it('does nothing if the app was never hidden', () => {
    expect(shouldReconnect(null, now)).toBeFalse();
  });

  it('does nothing after a quick switch away and back', () => {
    expect(shouldReconnect(now - (RECONNECT_AFTER_HIDDEN_MS - 1), now)).toBeFalse();
  });

  it('reconnects once the app was hidden long enough for the phone to pause it', () => {
    expect(shouldReconnect(now - RECONNECT_AFTER_HIDDEN_MS, now)).toBeTrue();
    expect(shouldReconnect(now - 30 * 60_000, now)).toBeTrue();
  });

  it('does nothing if the clock went backwards', () => {
    expect(shouldReconnect(now + 5_000, now)).toBeFalse();
  });
});
