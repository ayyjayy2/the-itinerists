import { buildDataExport, dataExportFileName } from './data-export';
import { FirestoreUser, TripDoc, TripMember } from '../models/trip.models';

describe('data export (#332)', () => {
  const NOW = Date.UTC(2026, 10, 1, 12);
  const profile = {
    uid: 'me', displayName: 'Maya Lopez', avatarEmoji: '🌸', color: '#fff', isAdmin: false, isDisabled: false, createdAt: NOW - 1000,
    authEmail: 'maya@example.com', payHandles: { venmo: 'maya-l' },
  } as FirestoreUser;
  const trip = { id: 't', name: 'Lisbon', startDate: '2026-12-01', endDate: '2026-12-05', destination: 'Lisbon, Portugal' } as TripDoc;
  const members = [
    { uid: 'me', displayName: 'Maya Lopez', role: 'owner', joinedAt: NOW - 500 },
    { uid: 'theo', displayName: 'Theo Brown', role: 'member', joinedAt: NOW - 400 },
  ] as TripMember[];
  const input = {
    now: NOW, uid: 'me', profile,
    myExpenses: [{ id: 'x', date: '2026-12-02', description: 'Coffee', amount: 3, currency: 'EUR', category: 'food' }],
    trips: [{
      trip, me: members[0], members,
      itinerary: [
        { id: 'i1', date: '2026-12-02', time: '', endTime: '', activity: 'Tram 28', location: '', category: '', notes: '', forWho: 'All', addedByUid: 'me', sortOrder: 0, createdAt: 0 },
        { id: 'i2', date: '2026-12-02', time: '', endTime: '', activity: "Theo's thing", location: '', category: '', notes: '', forWho: 'All', addedByUid: 'theo', sortOrder: 1, createdAt: 0 },
      ],
      flights: [
        { id: 'f1', uid: 'me', addedByUid: 'me', airline: 'TAP', flightNumber: 'TP1', notes: 'seat 2A' },
        { id: 'f2', uid: 'theo', addedByUid: 'theo', airline: 'TAP', flightNumber: 'TP2', notes: 'his seat' },
      ] as never[],
      stays: [],
      finance: [
        { id: 'e1', date: '', description: 'Dinner', amount: 60, currency: 'EUR', paidBy: 'Theo Brown', splitAmong: 'Maya Lopez, Theo Brown', category: '', addedByUid: 'theo', createdAt: 0 },
        { id: 'e2', date: '', description: 'Theo alone', amount: 9, currency: 'EUR', paidBy: 'Theo Brown', splitAmong: 'Theo Brown', category: '', addedByUid: 'theo', createdAt: 0 },
      ],
      packing: [{ id: 'p', label: 'Sunscreen', packed: false, addedAt: 0 }],
      outfits: [{ date: '2026-12-02', user: 'Maya Lopez', items: ['Linen shirt'] }, { date: '2026-12-02', user: 'Theo Brown', items: ['Hat'] }],
      photos: [{ id: 'ph', date: '2026-12-02', dataUrl: 'data:image/jpeg;base64,AAAA' }],
    }],
  };

  it('holds my profile, sign-in email, expenses and my parts of each trip', () => {
    const out = buildDataExport(input) as any;
    expect(out.profile.displayName).toBe('Maya Lopez');
    expect(out.profile.payHandles).toEqual({ venmo: 'maya-l' });
    expect(out.account.signInEmail).toBe('maya@example.com');
    expect(out.myExpenses.length).toBe(1);
    const t = out.trips[0];
    expect(t.myRole).toBe('owner');
    expect(t.myFlights.map((f: any) => f.flightNumber)).toEqual(['TP1']);
    expect(t.myPackingList[0].label).toBe('Sunscreen');
    expect(t.myOutfits.map((o: any) => o.items[0])).toEqual(['Linen shirt']);
    expect(t.myOutfitPhotos[0].dataUrl).toContain('base64');
    expect(t.itineraryIAdded.map((i: any) => i.activity)).toEqual(['Tram 28']);
    expect(t.sharedExpensesInvolvingMe.map((e: any) => e.description)).toEqual(['Dinner']);
  });

  it('shows other people by first name only, never their ids, emails or private things', () => {
    const out = buildDataExport(input) as any;
    const text = JSON.stringify(out);
    expect(out.trips[0].otherMembers).toEqual(['Theo']);
    expect(out.trips[0].sharedExpensesInvolvingMe[0].paidBy).toBe('Theo');
    for (const theirs of ['Theo Brown', '"theo"', 'his seat', 'Hat', "Theo's thing", 'Theo alone']) expect(text).not.toContain(theirs);
    expect(text).not.toContain('isAdmin');
  });

  it('counts photos instead of including them when they are too large', () => {
    const out = buildDataExport({ ...input, photoBudget: 3 }) as any;
    expect(out.trips[0].myOutfitPhotos[0].dataUrl).toBeUndefined();
    expect(out.trips[0].myOutfitPhotos[0].note).toContain('too large');
  });

  it('names the file by date', () => {
    expect(dataExportFileName(NOW)).toBe('the-itinerists-data-2026-11-01.json');
  });
});
