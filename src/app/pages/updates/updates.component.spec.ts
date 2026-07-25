import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { UpdatesComponent } from './updates.component';
import { TripService } from '../../services/trip.service';
import { UserService } from '../../services/user.service';
import { ActivityLogEntry } from '../../models/trip.models';

const entries: ActivityLogEntry[] = [
  { id: 'e1', action: 'member_added', targetUid: 't1', targetName: 'Tess',
    performedByUid: 'p1', performedByName: 'Pat', timestamp: 2000 },
  { id: 'e2', action: 'member_left', targetUid: 't2', targetName: 'Lou',
    performedByUid: 'p2', performedByName: 'Lou', timestamp: 1000 },
];

describe('UpdatesComponent', () => {
  let userStub: { firestoreUser: any; markActivitySeen: jasmine.Spy };

  beforeEach(() => {
    userStub = { firestoreUser: signal({ uid: 'me' }), markActivitySeen: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [UpdatesComponent],
      providers: [
        provideRouter([]),
        { provide: TripService, useValue: { activeActivity: signal(entries), activeMembers: signal([]) } },
        { provide: UserService, useValue: userStub },
      ],
    });
  });

  it('lists entries newest-first and marks activity seen on init', () => {
    const fixture = TestBed.createComponent(UpdatesComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.indexOf('Tess joined the trip')).toBeLessThan(text.indexOf('Lou left the trip'));
    expect(userStub.markActivitySeen).toHaveBeenCalled();
  });
});
