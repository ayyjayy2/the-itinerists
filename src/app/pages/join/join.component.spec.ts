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
  let renameMe: jasmine.Spy;

  function setup(signedIn: boolean) {
    order = [];
    replaceState = jasmine.createSpy('replaceState').and.callFake(() => order.push('replaceState'));
    joinAsGuest = jasmine.createSpy('joinAsGuest').and.resolveTo({ uid: 'g', members: [], clash: null });
    renameMe = jasmine.createSpy('renameMe').and.resolveTo();
    TestBed.configureTestingModule({
      imports: [JoinComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: { code: 'abc123' } } } },
        { provide: Location, useValue: { replaceState } },
        { provide: UserService, useValue: { authReadyPromise: Promise.resolve(), hasUser: () => signedIn, waitForUser: () => Promise.resolve({}) } },
        { provide: AuthService, useValue: { joinAsGuest } },
        { provide: TripService, useValue: { renameMe, joinByCode: jasmine.createSpy('joinByCode').and.callFake(() => { order.push('join'); return Promise.resolve(); }) } },
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

  it('a guest with the same name who never logged out: asks "Is this you?" (#776)', async () => {
    const { fixture } = setup(false);
    const comp = fixture.componentInstance;
    joinAsGuest.and.resolveTo({ uid: 'g', members: [], clash: { uid: 'old', name: 'Mariah', guest: true } });
    await comp.ngOnInit();
    comp.guestName = 'Mariah';
    await comp.seeTheTrip();
    expect(comp.step()).toBe('same-name');
  });

  it('someone with an account has the name: pick another (#768)', async () => {
    const { fixture } = setup(false);
    const comp = fixture.componentInstance;
    joinAsGuest.and.resolveTo({ uid: 'g', members: [], clash: { uid: 'm', name: 'Maya', guest: false } });
    await comp.ngOnInit();
    comp.guestName = 'Maya';
    await comp.seeTheTrip();
    expect(comp.step()).toBe('rename');
  });

  // #787: an unresolved taken name never sits on the trip; a guest's name on Pick another name asks "Is this you?".
  describe('a taken name', () => {
    const members = [
      { uid: 'acct', displayName: 'Alayna' },
      { uid: 'old', displayName: 'Mariah', isGuest: true },
      { uid: 'g', displayName: 'Alayna', isGuest: true },
    ];
    async function joinAs(name: string, clash: object) {
      const { fixture, router } = setup(false);
      const comp = fixture.componentInstance;
      joinAsGuest.and.resolveTo({ uid: 'g', members, clash });
      await comp.ngOnInit();
      comp.guestName = name;
      await comp.seeTheTrip();
      return { comp, router };
    }

    it('holds a placeholder name on the trip until they answer', async () => {
      const { comp } = await joinAs('Alayna', { uid: 'acct', name: 'Alayna', guest: false });
      expect(renameMe).toHaveBeenCalledWith('Alayna (guest)');
      expect(comp.step()).toBe('rename');
    });

    it('a guest\'s name on Pick another name asks "Is this you?", and Yes takes it', async () => {
      const { comp, router } = await joinAs('Alayna', { uid: 'acct', name: 'Alayna', guest: false });
      comp.newName = 'mariah';
      await comp.rename();
      expect(comp.step()).toBe('same-name');
      expect(comp.nameError()).toBe('');
      await comp.thisIsMe();
      expect(renameMe).toHaveBeenCalledWith('Mariah');
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('someone with an account\'s name on Pick another name still asks for another', async () => {
      const { comp } = await joinAs('Mariah', { uid: 'old', name: 'Mariah', guest: true });
      comp.someoneElse();
      comp.newName = 'alayna';
      await comp.rename();
      expect(comp.step()).toBe('rename');
      expect(comp.nameError()).toContain('already called Alayna');
    });
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
