import { bookingsOn } from './day-bookings';

const sources = {
  flights:    [{ date: '2027-05-10', label: 'Arrive LIS', time: '8:00 AM', zoneLabel: 'WEST' },
               { date: '2027-05-09', label: 'Depart ORD', time: '6:00 PM', zoneLabel: 'CDT' }],
  transports: [{ date: '2027-05-13', label: 'Depart: Lisbon–Porto train', time: '10:00', icon: 'train' },
               { date: '2027-05-13', label: 'Arrive: Lisbon–Porto train', time: '13:00', icon: 'train' }],
  stays:      [{ date: '2027-05-10', label: 'Check in: Alfama stay', time: '' },
               { date: '2027-05-13', label: 'Check out: Alfama stay', time: '11:00' }],
};

describe('bookingsOn', () => {
  it("gathers a day's flights, transport and stays (the arrival day)", () => {
    expect(bookingsOn('2027-05-10', sources).map(b => b.label)).toEqual(['Arrive LIS', 'Check in: Alfama stay']);
  });

  it('puts them in time order, untimed ones last', () => {
    expect(bookingsOn('2027-05-13', sources).map(b => b.label))
      .toEqual(['Depart: Lisbon–Porto train', 'Check out: Alfama stay', 'Arrive: Lisbon–Porto train']);
  });

  it('keeps what each needs to show: kind, icon, time and zone', () => {
    const [arrive, checkIn] = bookingsOn('2027-05-10', sources);
    expect(arrive).toEqual({ kind: 'flight', icon: 'flights', label: 'Arrive LIS', time: '8:00 AM', zoneLabel: 'WEST' });
    expect(checkIn.kind).toBe('stay');
    expect(checkIn.icon).toBe('stays');
    expect(bookingsOn('2027-05-13', sources)[0].icon).toBe('train');
  });

  it('passes transport and stay zone codes through (#537)', () => {
    const zoned = {
      ...sources,
      transports: sources.transports.map(t => ({ ...t, zoneLabel: 'WEST' })),
      stays:      sources.stays.map(s => ({ ...s, zoneLabel: 'WEST' })),
    };
    expect(bookingsOn('2027-05-13', zoned).map(b => b.zoneLabel)).toEqual(['WEST', 'WEST', 'WEST']);
  });

  it('is empty on a day with no bookings', () => {
    expect(bookingsOn('2027-05-11', sources)).toEqual([]);
  });
});
