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

  // #665: "Youadded …": the space after the name was dropped.
  it('keeps a space between the name and what they did', () => {
    const fixture = TestBed.createComponent(UpdatesComponent);
    fixture.detectChanges();
    const texts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.feed-text')).map(t => t.textContent!.replace(/\s+/g, ' ').trim());
    expect(texts[0]).toMatch(/^You added a rec: Mine \(Food\) · /);
    expect(texts[1]).toMatch(/^Pat added Dinner/);
  });
});

// #716: "Mark as paid" and its answer reach the other person; my own side reads as what I did.
describe('UpdatesComponent: paying back', () => {
  const pay = (o: Partial<TripEvent>) => ev({ kind: 'finance', path: '/finance', itemId: 'claim-me', ...o });
  function feedText(events: TripEvent[]): string[] {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [UpdatesComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeTrip: signal({ id: 't1', name: 'Berlin' }), activeMembers: signal([{ uid: 'p1', displayName: 'Pat', color: '#abc', avatarEmoji: '🐸' }]) } },
        { provide: TripEventsService, useValue: { events: signal(events) } },
        { provide: UserService, useValue: { firestoreUser: signal({ uid: 'me' }), markActivitySeen: jasmine.createSpy() } },
      ],
    });
    const fixture = TestBed.createComponent(UpdatesComponent);
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.feed-row'));
    expect(rows.every(r => !r.href.includes('focus='))).withContext('no single item to open').toBeTrue();
    return rows.map(r => r.querySelector('.feed-text')!.textContent!.replace(/\s+/g, ' ').replace(/ · .*$/, '').trim());
  }

  it('words my side of it', () => {
    expect(feedText([pay({ action: 'paid', actorUid: 'me', actorName: 'Me', targetUid: 'p1', audience: ['p1'], summary: 'says they paid you $30.00 with Venmo. Confirm it in Finance.' })]))
      .toEqual(['You told Pat you paid them']);
    expect(feedText([pay({ action: 'received', actorUid: 'me', actorName: 'Me', targetUid: 'p1', audience: ['p1'], summary: 'got your $30.00 payment. You two are settled up.' })]))
      .toEqual(['You confirmed Pat’s payment']);
  });

  it('shows the other person\'s notice to me with their name first', () => {
    expect(feedText([pay({ action: 'not-received', actorUid: 'p1', actorName: 'Pat', targetUid: 'me', audience: ['me'], summary: 'hasn’t received your $30.00 payment yet.' })]))
      .toEqual(['Pat hasn’t received your $30.00 payment yet.']);
  });
});
