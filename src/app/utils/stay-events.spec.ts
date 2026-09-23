import { stayMomentsFor, StayLike } from './stay-events';

const guesthouse: StayLike = {
  name: 'Baan Nimman Guesthouse', checkIn: '2026-11-13', checkOut: '2026-11-19', forWho: 'All',
};

describe('stayMomentsFor', () => {
  it('emits a check-in moment on the check-in date', () => {
    const moments = stayMomentsFor([guesthouse], 'Alayna');
    expect(moments.find(m => m.kind === 'check-in')).toEqual(jasmine.objectContaining({
      date: '2026-11-13', label: 'Check in: Baan Nimman Guesthouse', kind: 'check-in',
    }));
  });

  it('emits a check-out moment on the check-out date', () => {
    const moments = stayMomentsFor([guesthouse], 'Alayna');
    expect(moments.find(m => m.kind === 'check-out')).toEqual(jasmine.objectContaining({
      date: '2026-11-19', label: 'Check out: Baan Nimman Guesthouse', kind: 'check-out',
    }));
  });

  it('includes stays listing the user by name', () => {
    const mine = { ...guesthouse, forWho: 'Maya, Alayna' };
    expect(stayMomentsFor([mine], 'Alayna').length).toBe(2);
  });

  it('excludes stays the user is not on', () => {
    const theirs = { ...guesthouse, forWho: 'Maya, Theo' };
    expect(stayMomentsFor([theirs], 'Alayna')).toEqual([]);
  });

  it('skips moments with no date', () => {
    const noOut = { ...guesthouse, checkOut: '' };
    const moments = stayMomentsFor([noOut], 'Alayna');
    expect(moments.map(m => m.kind)).toEqual(['check-in']);
  });

  it('carries the check-in and check-out times when set', () => {
    const timed = { ...guesthouse, checkInTime: '3:00 PM', checkOutTime: '11:00 AM' };
    const [inn, out] = stayMomentsFor([timed], 'Alayna');
    expect(inn.time).toBe('3:00 PM');
    expect(out.time).toBe('11:00 AM');
  });

  it('leaves time empty when the stay has none', () => {
    const [inn, out] = stayMomentsFor([guesthouse], 'Alayna');
    expect(inn.time).toBe('');
    expect(out.time).toBe('');
  });

  it('skips stays with no name', () => {
    expect(stayMomentsFor([{ ...guesthouse, name: '' }], 'Alayna')).toEqual([]);
  });
});
