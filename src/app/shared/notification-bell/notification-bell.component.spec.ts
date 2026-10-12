import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NotificationBellComponent } from './notification-bell.component';
import { TripEventsService } from '../../services/trip-events.service';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { TripEvent } from '../../models/trip.models';
import { SurveyService } from '../../services/survey.service';

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

describe('NotificationBellComponent', () => {
  let userStub: { firestoreUser: any; markActivitySeen: jasmine.Spy };
  let tripStub: ReturnType<typeof signal<any>>;
  let survey: { config: ReturnType<typeof signal<any>>; available: ReturnType<typeof signal<boolean>>; text: ReturnType<typeof signal<any>>; noticeUnseen: ReturnType<typeof signal<boolean>>; markNoticeSeen: jasmine.Spy; take: jasmine.Spy };

  beforeEach(() => {
    tripStub = signal<any>({ id: 't1', name: 'Berlin' });
    survey = {
      config: signal<any>(null), available: signal(false), text: signal<any>(null), noticeUnseen: signal(false),
      markNoticeSeen: jasmine.createSpy('markNoticeSeen'), take: jasmine.createSpy('take'),
    };
    userStub = {
      firestoreUser: signal({ uid: 'me', lastSeenActivityAt: 1000 }),
      markActivitySeen: jasmine.createSpy(),
    };
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        { provide: TripEventsService, useValue: { events: signal(events) } },
        { provide: UserService, useValue: userStub },
        { provide: TripService, useValue: { activeTrip: tripStub } },
        { provide: SurveyService, useValue: survey },
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
    expect(userStub.markActivitySeen).toHaveBeenCalledWith('t1');   // only the active trip is marked seen
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
    tripStub.set({ id: 't1', name: 'Sandbox', isTest: true });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bell-badge')?.textContent?.trim()).toBe('2');
    (fixture.nativeElement.querySelector('.bell-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('removed Tester 1');
  });

  describe('survey notice', () => {
    const live = { id: 's1', active: true, url: 'https://example.com/form', title: 'Hi', body: 'b', bannerText: 'Got 5 minutes? Tell me how {trip} went.' };
    function openBell() {
      const fixture = TestBed.createComponent(NotificationBellComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, el, click: () => { (el.querySelector('.bell-btn') as HTMLButtonElement).click(); fixture.detectChanges(); } };
    }

    beforeEach(() => {
      survey.config.set(live);
      survey.available.set(true);
      survey.text.set({ title: 'Hi', body: 'b', bannerText: 'Got 5 minutes? Tell me how Berlin went.' });
    });

    it('badges a new survey once, and stops badging when the bell is opened', () => {
      survey.noticeUnseen.set(true);
      const { el, click } = openBell();
      expect(el.querySelector('.bell-badge')?.textContent?.trim()).toBe('2');   // the survey + one trip update
      click();
      expect(survey.markNoticeSeen).toHaveBeenCalled();
    });

    it('lists the survey first, with their trip in the wording, linking to the survey', () => {
      const { el, click } = openBell();
      click();
      const item = el.querySelector('.bell-survey') as HTMLAnchorElement;
      expect(item).not.toBeNull();
      expect(el.querySelector('.bell-dropdown a')).toBe(item);
      expect(item.textContent).toContain('New survey');
      expect(item.textContent).toContain('Tell me how Berlin went.');
      expect(item.href).toBe('https://example.com/form');
      expect(item.target).toBe('_blank');
      item.addEventListener('click', e => e.preventDefault());
      item.click();
      expect(survey.take).toHaveBeenCalled();
    });

    it('stays in the list without a badge after it has been seen, even once they tapped it', () => {
      survey.noticeUnseen.set(false);
      const { el, click } = openBell();
      expect(el.querySelector('.bell-badge')?.textContent?.trim()).toBe('1');   // trip update only
      click();
      expect(el.querySelector('.bell-survey')).not.toBeNull();
    });

    it('is not shown when the survey is not for them (switched off, or no finished trip)', () => {
      survey.available.set(false);
      const { el, click } = openBell();
      click();
      expect(el.querySelector('.bell-survey')).toBeNull();
    });
  });
});
