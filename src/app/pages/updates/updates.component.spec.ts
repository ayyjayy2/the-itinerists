import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { UpdatesComponent } from './updates.component';
import { TripService } from '../../services/trip.service';
import { TripEventsService } from '../../services/trip-events.service';
import { UserService } from '../../services/user.service';
import { TripEvent } from '../../models/trip.models';

const ev = (o: Partial<TripEvent>): TripEvent => ({
  id: 'e', kind: 'itinerary', action: 'added', actorUid: 'p1', actorName: 'Pat', itemId: 'i1',
  summary: 'added Dinner to Day 1, Sat Oct 3 at 7:00 PM', path: '/itinerary', audience: 'all', timestamp: 2000, ...o,
});
const events: TripEvent[] = [
  ev({ id: 'e1', timestamp: 3000, actorUid: 'me', actorName: 'Me', summary: 'added a rec: Mine (Food)', path: '/recs', itemId: 'r1' }),
  ev({ id: 'e2', timestamp: 2000 }),
  ev({ id: 'e3', timestamp: 1000, audience: ['someone-else'], summary: 'suggested you pack: hat' }),
];

describe('UpdatesComponent', () => {
  let userStub: { firestoreUser: any; markActivitySeen: jasmine.Spy };

  beforeEach(() => {
    userStub = { firestoreUser: signal({ uid: 'me' }), markActivitySeen: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [UpdatesComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeTrip: signal({ id: 't1', name: 'Berlin' }), activeMembers: signal([{ uid: 'p1', displayName: 'Pat', color: '#abc', avatarEmoji: '🐸' }]) } },
        { provide: TripEventsService, useValue: { events: signal(events) } },
        { provide: UserService, useValue: userStub },
      ],
    });
  });

  it('lists my own and others’ events for me, newest first, each linking to its item, and marks seen', () => {
    const fixture = TestBed.createComponent(UpdatesComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = Array.from(el.querySelectorAll('a.feed-row'));
    expect(rows.length).toBe(2);                                   // the one aimed at someone else is left out
    expect(rows[0].textContent).toContain('You');
    expect(rows[0].textContent).toContain('added a rec: Mine (Food)');
    expect(rows[0].classList).toContain('mine');
    expect(rows[0].getAttribute('href')).toBe('/recs?focus=r1');
    expect(rows[1].textContent).toContain('Pat');
    expect(rows[1].getAttribute('href')).toBe('/itinerary?focus=i1');
    expect(userStub.markActivitySeen).toHaveBeenCalled();
  });
});
