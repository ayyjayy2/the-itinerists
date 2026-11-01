import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { JoinComponent } from './join.component';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { LocalCacheService } from '../../services/local-cache.service';
import { AuthService } from '../../services/auth.service';

/** #404: an invite code is taken out of the address bar before anything else happens. */
describe('JoinComponent', () => {
  let order: string[];
  let replaceState: jasmine.Spy;
  let joinAsGuest: jasmine.Spy;

  function setup(signedIn: boolean) {
    order = [];
    replaceState = jasmine.createSpy('replaceState').and.callFake(() => order.push('replaceState'));
    joinAsGuest = jasmine.createSpy('joinAsGuest').and.resolveTo();
    TestBed.configureTestingModule({
      imports: [JoinComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: { code: 'abc123' } } } },
        { provide: Location, useValue: { replaceState } },
        { provide: UserService, useValue: { authReadyPromise: Promise.resolve(), hasUser: () => signedIn, waitForUser: () => Promise.resolve({}) } },
        { provide: AuthService, useValue: { joinAsGuest } },
        { provide: TripService, useValue: { joinByCode: jasmine.createSpy('joinByCode').and.callFake(() => { order.push('join'); return Promise.resolve(); }) } },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
      ],
    });
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    return { fixture: TestBed.createComponent(JoinComponent), router };
  }

  it('signed in: clears the code from the address before joining (joining logs an analytics event)', async () => {
    const { fixture } = setup(true);
    await fixture.componentInstance.ngOnInit();
    expect(replaceState).toHaveBeenCalledWith('/join');
    expect(order).toEqual(['replaceState', 'join']);
  });

  it('signed in: the join counts as reached by the link (#609)', async () => {
    const { fixture } = setup(true);
    await fixture.componentInstance.ngOnInit();
    expect(TestBed.inject(TripService).joinByCode).toHaveBeenCalledWith('ABC123', 'link');
  });

  it('signed out: offers the trip without an account (#610)', async () => {
    const { fixture, router } = setup(false);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(fixture.componentInstance.step()).toBe('guest');
    expect(router.navigate).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('What should the group call you?');
  });

  it('signed out: a name is needed, then they join as a guest and go Home (#610)', async () => {
    const { fixture, router } = setup(false);
    const comp = fixture.componentInstance;
    await comp.ngOnInit();
    await comp.seeTheTrip();
    expect(comp.nameError()).toContain('Enter your name');
    expect(joinAsGuest).not.toHaveBeenCalled();
    comp.guestName = 'Robin';
    await comp.seeTheTrip();
    expect(joinAsGuest).toHaveBeenCalledWith('ABC123', 'Robin');
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('signed out: "Create an account instead" hands the code to sign-up privately, never in the address', async () => {
    const { fixture, router } = setup(false);
    await fixture.componentInstance.ngOnInit();
    fixture.componentInstance.createAccount();
    const [commands, extras] = (router.navigate as jasmine.Spy).calls.mostRecent().args;
    expect(commands).toEqual(['/signup']);
    expect(extras.queryParams).toBeUndefined();
    expect(extras.state).toEqual({ inviteCode: 'ABC123' });
  });
});
