import { effectivePins, DEFAULT_HOME_PINS } from './pins';
import { FirestoreUser } from '../models/trip.models';

const base: FirestoreUser = {
  uid: 'u1', displayName: 'A', username: 'a', avatarEmoji: '🌸',
  color: '#fff', isAdmin: false, createdAt: 0,
};

describe('effectivePins', () => {
  it('returns the defaults when there is no user', () => {
    expect(effectivePins(null)).toEqual(DEFAULT_HOME_PINS);
  });

  it('returns the defaults when the user has no homePins', () => {
    expect(effectivePins(base)).toEqual(DEFAULT_HOME_PINS);
  });

  it('returns the saved pins when present (including empty = all unpinned)', () => {
    expect(effectivePins({ ...base, homePins: ['/map'] })).toEqual(['/map']);
    expect(effectivePins({ ...base, homePins: [] })).toEqual([]);
  });
});
