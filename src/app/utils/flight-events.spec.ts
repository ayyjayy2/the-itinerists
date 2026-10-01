import { mirroredFlightMoment, flightMomentsForUid, FlightLike } from './flight-events';

const ordToBer: FlightLike = {
  uid: 'u1', section: 'ARRIVALS', from: 'ORD', to: 'BER',
  departureDate: '2026-09-24', departureTime: '4:20pm',
  arrivalDate: '2026-09-25', arrivalTime: '12:40pm',
};

const pragueHome: FlightLike = {
  uid: 'u1', section: 'DEPARTURES', from: 'PRG', to: 'ORD',
  departureDate: '2026-10-09', departureTime: '7:30am',
  arrivalDate: '2026-10-09', arrivalTime: '1:20pm',
};

describe('flightMomentsForUid', () => {
  it('emits a depart moment with the raw user-entered time', () => {
    const moments = flightMomentsForUid([ordToBer], 'u1', 'Berlin');
    const depart = moments.find(m => m.kind === 'depart');
    expect(depart).toEqual(jasmine.objectContaining({
      date: '2026-09-24', time: '4:20pm', label: 'Depart from ORD',
      kind: 'depart', section: 'ARRIVALS',
    }));
  });

  it('emits an arrive moment, tagged with the destination for arrivals', () => {
    const moments = flightMomentsForUid([ordToBer], 'u1', 'Berlin');
    const arrive = moments.find(m => m.kind === 'arrive');
    expect(arrive).toEqual(jasmine.objectContaining({
      date: '2026-09-25', time: '12:40pm', label: 'Arrive at BER – Berlin',
    }));
  });

  it('labels the return arrival without the destination suffix', () => {
    const moments = flightMomentsForUid([pragueHome], 'u1', 'Berlin');
    const arrive = moments.find(m => m.kind === 'arrive');
    expect(arrive?.label).toBe('Arrive at ORD');
  });

  it('only includes the given user\'s flights', () => {
    expect(flightMomentsForUid([{ ...ordToBer, uid: 'someone-else' }], 'u1', 'Berlin')).toEqual([]);
  });

  it('skips moments with no date and tolerates missing times', () => {
    const noDates = { ...ordToBer, departureDate: '', arrivalDate: '' };
    expect(flightMomentsForUid([noDates], 'u1', 'Berlin')).toEqual([]);
    const noTime = flightMomentsForUid([{ ...ordToBer, departureTime: '' }], 'u1', 'Berlin');
    expect(noTime.find(m => m.kind === 'depart')?.time).toBe('');
  });
});

describe('mirroredFlightMoment', () => {
  const moments = flightMomentsForUid([
    { uid: 'me', section: 'ARRIVALS', from: 'ORD', to: 'BER', departureDate: '2026-09-24', departureTime: '4:20pm', arrivalDate: '2026-09-25', arrivalTime: '12:40pm' },
  ], 'me', 'Berlin', c => ({ ORD: 'America/Chicago', BER: 'Europe/Berlin' } as Record<string, string>)[c]);

  it('maps "Fly Out" to the departure and "Arrive in Berlin" to the arrival', () => {
    const out = mirroredFlightMoment({ date: '2026-09-24', activity: 'Fly Out', category: 'Activity' }, moments);
    expect(out?.kind).toBe('depart'); expect(out?.time).toBe('4:20pm'); expect(out?.zone).toBe('America/Chicago');
    const inn = mirroredFlightMoment({ date: '2026-09-25', activity: 'Arrive in Berlin', category: 'Transport' }, moments);
    expect(inn?.kind).toBe('arrive'); expect(inn?.time).toBe('12:40pm'); expect(inn?.zone).toBe('Europe/Berlin');
  });

  it('leaves ordinary items and flight-like items on other days alone', () => {
    expect(mirroredFlightMoment({ date: '2026-09-24', activity: 'Dinner', category: 'Food' }, moments)).toBeNull();
    expect(mirroredFlightMoment({ date: '2026-09-26', activity: 'Taxi to the airport', category: 'Transport' }, moments)).toBeNull();
  });
});
