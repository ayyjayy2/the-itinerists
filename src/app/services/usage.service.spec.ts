import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Firestore } from '@angular/fire/firestore';
import { UsageService } from './usage.service';
import { UserService } from './user.service';
import { TripContextService } from './trip-context.service';

describe('UsageService', () => {
  let service: UsageService;
  const user = signal<{ uid: string } | null>({ uid: 'u1' });

  beforeEach(() => {
    user.set({ uid: 'u1' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Firestore, useValue: {} },
        { provide: UserService, useValue: { currentUser: user, hasUser: () => !!user() } },
        { provide: TripContextService, useValue: { activeTripId: signal('T1') } },
      ],
    });
    service = TestBed.inject(UsageService);
  });

  it('records a partner-offer tap as one offer event, partner id only (#474)', () => {
    const write = spyOn<any>(service, 'write');
    service.recordOffer('airalo');
    expect(write).toHaveBeenCalledTimes(1);
    const ev = write.calls.mostRecent().args[0] as any;
    expect(ev.type).toBe('offer');
    expect(ev.offer).toBe('airalo');
    expect(ev.page).toBe('/recs');
    expect(ev.uid).toBe('u1');
    expect(ev.tripId).toBe('T1');
  });

  it('records nothing while signed out', () => {
    const write = spyOn<any>(service, 'write');
    user.set(null);
    service.recordOffer('airalo');
    expect(write).not.toHaveBeenCalled();
  });
});
