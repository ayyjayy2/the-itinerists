import { canPickLayout, effectiveHomeLayout } from './layout';
import { FirestoreUser } from '../models/trip.models';

const base: FirestoreUser = {
  uid: 'u1', displayName: 'A', username: 'a', avatarEmoji: '🌸',
  color: '#fff', isAdmin: false, createdAt: 0,
};

const picker: FirestoreUser = { ...base, uid: 'u2', username: 'maya', layoutPicker: true };

describe('effectiveHomeLayout', () => {
  it('defaults to C with no user', () => {
    expect(effectiveHomeLayout(null)).toBe('C');
  });

  it('defaults to C when the user has no homeLayout', () => {
    expect(effectiveHomeLayout(base)).toBe('C');
  });

  it('forces C for regular accounts even with a saved override', () => {
    expect(effectiveHomeLayout({ ...base, homeLayout: 'A' })).toBe('C');
    expect(effectiveHomeLayout({ ...base, homeLayout: 'B' })).toBe('C');
    expect(effectiveHomeLayout({ ...base, homeLayout: 'C' })).toBe('C');
  });

  it('honors an explicit choice on picker accounts', () => {
    expect(effectiveHomeLayout({ ...picker, homeLayout: 'A' })).toBe('A');
    expect(effectiveHomeLayout({ ...picker, homeLayout: 'B' })).toBe('B');
    expect(effectiveHomeLayout({ ...picker, homeLayout: 'C' })).toBe('C');
    expect(effectiveHomeLayout(picker)).toBe('C');
  });
});

describe('canPickLayout', () => {
  it('is false for regular accounts and no user', () => {
    expect(canPickLayout(null)).toBe(false);
    expect(canPickLayout(base)).toBe(false);
    expect(canPickLayout({ ...base, layoutPicker: false })).toBe(false);
  });

  it('does not depend on the username', () => {
    expect(canPickLayout({ ...base, username: 'maya' })).toBe(false);
  });

  it('is true for accounts flagged layoutPicker', () => {
    expect(canPickLayout(picker)).toBe(true);
  });
});
