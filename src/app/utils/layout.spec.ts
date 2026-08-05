import { canPickLayout, effectiveHomeLayout } from './layout';
import { FirestoreUser } from '../models/trip.models';

const base: FirestoreUser = {
  uid: 'u1', displayName: 'A', username: 'a', avatarEmoji: '🌸',
  color: '#fff', isAdmin: false, createdAt: 0,
};

const alayna: FirestoreUser = { ...base, uid: 'u2', username: 'alayna' };
const makaela: FirestoreUser = { ...base, uid: 'u3', username: 'makaelajohnston' };

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
    expect(effectiveHomeLayout({ ...alayna, homeLayout: 'A' })).toBe('A');
    expect(effectiveHomeLayout({ ...alayna, homeLayout: 'B' })).toBe('B');
    expect(effectiveHomeLayout({ ...alayna, homeLayout: 'C' })).toBe('C');
    expect(effectiveHomeLayout({ ...makaela, homeLayout: 'B' })).toBe('B');
    expect(effectiveHomeLayout(makaela)).toBe('C');
  });
});

describe('canPickLayout', () => {
  it('is false for regular accounts and no user', () => {
    expect(canPickLayout(null)).toBe(false);
    expect(canPickLayout(base)).toBe(false);
  });

  it('is true for the picker accounts', () => {
    expect(canPickLayout(alayna)).toBe(true);
    expect(canPickLayout({ ...base, uid: 'qdhJLMDxSdVdILg2CTCcIhZyBDz2' })).toBe(true);
    expect(canPickLayout(makaela)).toBe(true);
    expect(canPickLayout({ ...base, uid: 'SIXcW7K34VTOD8yZcHWSTg0yFS02' })).toBe(true);
  });
});
