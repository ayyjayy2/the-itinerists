import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NotificationBellComponent } from './notification-bell.component';
import { TripEventsService } from '../../services/trip-events.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { TripEvent } from '../../models/trip.models';

const ev = (o: Partial<TripEvent>): TripEvent => ({
  id: 'e', kind: 'itinerary', action: 'added', actorUid: 'other', actorName: 'Pat', itemId: 'i1',
  summary: 'added Dinner to Day 1, Sat Oct 3 at 7:00 PM', path: '/itinerary', audience: 'all', timestamp: 2000, ...o,
});
const events: TripEvent[] = [
  ev({ id: 'e1' }),                                                        // unseen, for me
  ev({ id: 'e2', actorUid: 'me', actorName: 'Me', timestamp: 3000 }),      // mine → never counts
  ev({ id: 'e3', audience: ['someone-else'], timestamp: 4000 }),           // not for me
  ev({ id: 'e4', timestamp: 500, summary: 'added a rec: Old (Food)', path: '/recs', itemId: 'r1' }), // seen
  ev({ id: 'e5', timestamp: 6000, test: true, summary: 'removed Tester 1', kind: 'member', action: 'kicked', path: '/trip-settings', itemId: '' }), // tester
];

const inTrip = (e: TripEvent, tripId = 't1', tripName = 'Berlin', tripIsTest = false) => ({ ...e, tripId, tripName, tripIsTest });

describe('NotificationBellComponent', () => {
  let allEvents: ReturnType<typeof signal<any[]>>;
  let switchSpy: jasmine.Spy;
  let userStub: { firestoreUser: any; markActivitySeen: jasmine.Spy };
  let tripStub: ReturnType<typeof signal<any>>;

  beforeEach(() => {
    allEvents = signal<any[]>(events.map(e => inTrip(e)));
    switchSpy = jasmine.createSpy('switchTrip').and.resolveTo();
    tripStub = signal<any>({ id: 't1', name: 'Berlin' });
    userStub = {
      firestoreUser: signal({ uid: 'me', lastSeenActivityAt: 1000 }),
      markActivitySeen: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        { provide: TripEventsService, useValue: { events: signal(events), allEvents: allEvents } },
        { provide: UserService, useValue: userStub },
        { provide: TripService, useValue: { activeTrip: tripStub, switchTrip: switchSpy } },
      ],
    });
  });

  it('badges only unseen events meant for me, and lists them as links to the item', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bell-badge')?.textContent?.trim()).toBe('1');
    (el.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.bell-head')?.textContent).toContain('1 update');
    const row = el.querySelector('a.bell-item') as HTMLAnchorElement;
    expect(row.textContent).toContain('Pat');
    expect(row.textContent).toContain('added Dinner to Day 1, Sat Oct 3 at 7:00 PM');
    expect(row.getAttribute('href')).toBe('/itinerary?focus=i1');
  });

  it('marks activity seen on open, and keeps showing the snapshot after the marker moves', () => {
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(userStub.markActivitySeen).toHaveBeenCalled();
    userStub.firestoreUser.set({ uid: 'me', lastSeenActivityAt: 5000 });
    fixture.detectChanges();
    expect(el.textContent).toContain('added Dinner to Day 1');   // snapshot survives
    expect(el.querySelector('.bell-badge')).toBeNull();          // badge cleared
  });

  it('with nothing unseen it shows the latest for me without marking seen', () => {
    userStub.firestoreUser.set({ uid: 'me', lastSeenActivityAt: 5000 });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(userStub.markActivitySeen).not.toHaveBeenCalled();
    const hrefs = Array.from(el.querySelectorAll('a.bell-item')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/itinerary?focus=i1', '/recs?focus=r1']);
  });

  it('hides tester events on a real trip and shows them on a test trip', () => {
    let fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bell-badge')?.textContent?.trim()).toBe('1');
    // The rule now follows each event's own trip: the same events on a test trip include the tester's.
    allEvents.set(events.map(e => inTrip(e, 't1', 'Sandbox', true)));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bell-badge')?.textContent?.trim()).toBe('2');
    (fixture.nativeElement.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('removed Tester 1');
  });

  it('counts updates from my other trips, labels them, and switches trip when one is opened', () => {
    allEvents.set([...events.map(e => inTrip(e)), inTrip(ev({ id: 'x1', actorName: 'Maya', timestamp: 7000, summary: 'added Sunset to Day 2' }), 't2', 'Lisbon')]);
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bell-badge')?.textContent?.trim()).toBe('2');
    (el.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const rows = Array.from(el.querySelectorAll('a.bell-item')) as HTMLAnchorElement[];
    expect(rows[0].textContent).toContain('Lisbon');
    expect(rows[0].querySelector('.bell-trip.other')).not.toBeNull();
    rows[0].click();
    expect(switchSpy).toHaveBeenCalledWith('t2');
  });

  it('shows tester activity only on a test trip', () => {
    const tester = ev({ id: 't9', timestamp: 8000, test: true, summary: 'added Probe item' });
    allEvents.set([inTrip(tester, 't3', 'Lisbon', true), inTrip({ ...tester, id: 't10' }, 't1', 'Berlin', false)]);
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bell-badge')?.textContent?.trim()).toBe('1');
  });
});
