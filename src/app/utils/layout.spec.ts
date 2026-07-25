import { effectiveHomeLayout } from './layout';
import { FirestoreUser } from '../models/trip.models';

const base: FirestoreUser = {
  uid: 'u1', displayName: 'A', username: 'a', avatarEmoji: '🌸',
  color: '#fff', isAdmin: false, createdAt: 0,
};

describe('effectiveHomeLayout', () => {
  it('defaults to B with no user', () => {
    expect(effectiveHomeLayout(null)).toBe('B');
  });

  it('defaults to B when the user has no homeLayout', () => {
    expect(effectiveHomeLayout(base)).toBe('B');
  });

  it('honors an explicit choice', () => {
    expect(effectiveHomeLayout({ ...base, homeLayout: 'A' })).toBe('A');
    expect(effectiveHomeLayout({ ...base, homeLayout: 'B' })).toBe('B');
  });
});
