import { TestBed } from '@angular/core/testing';
import { AccountSheetComponent } from './account-sheet.component';
import { AccountPromptService } from '../../services/account-prompt.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TripService } from '../../services/trip.service';

/** #610: a guest creates their account from the sheet and stays on the trip. */
describe('AccountSheetComponent', () => {
  let upgradeGuest: jasmine.Spy;

  function setup(purpose: 'change' | 'plan' = 'change') {
    upgradeGuest = jasmine.createSpy('upgradeGuest').and.resolveTo();
    TestBed.configureTestingModule({
      imports: [AccountSheetComponent],
      providers: [
        { provide: AuthService, useValue: { upgradeGuest } },
        { provide: UserService, useValue: { isGuest: signal(true) } },
        { provide: TripService, useValue: { activeTrip: signal({ id: 't', name: 'Chiang Mai, November' }) } },
        provideRouter([]),
      ],
    });
    TestBed.inject(AccountPromptService).ask(purpose);
    const fixture = TestBed.createComponent(AccountSheetComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('checks the email and password before trying', async () => {
    const fixture = setup();
    const comp = fixture.componentInstance;
    comp.email = 'not-an-email';
    comp.password = 'short';
    await comp.create();
    expect(upgradeGuest).not.toHaveBeenCalled();
    expect(comp.fieldError('email')).toBeTruthy();
    expect(comp.fieldError('password')).toBeTruthy();
  });

  it('creates the account and says they are all set', async () => {
    const fixture = setup();
    const comp = fixture.componentInstance;
    comp.email = 'robin@example.com';
    comp.password = 'Sunshine2026';
    await comp.create();
    expect(upgradeGuest).toHaveBeenCalledWith('robin@example.com', 'Sunshine2026');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("You're all set");
  });

  it('shows why it could not, and stays open', async () => {
    const fixture = setup();
    const comp = fixture.componentInstance;
    upgradeGuest.and.rejectWith(new Error('That email already has an account. Sign in with it, then open the invite link again to join.'));
    comp.email = 'robin@example.com';
    comp.password = 'Sunshine2026';
    await comp.create();
    expect(comp.error()).toContain('already has an account');
    expect(TestBed.inject(AccountPromptService).open()).toBeTrue();
  });

  it('has no note under Email, and more room above the buttons (#746)', () => {
    const el = setup().nativeElement as HTMLElement;
    expect(el.querySelector('#account-email-hint')).toBeNull();
    expect(el.querySelector('#account-email')!.getAttribute('aria-describedby')).toBeNull();
    expect(parseFloat(getComputedStyle(el.querySelector('form .actions')!).marginTop)).toBeGreaterThanOrEqual(20);
  });

  it('from "+ Plan your own" (#744): asks for an account to plan a trip, then opens New trip', async () => {
    const fixture = setup('plan');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#account-sheet-title')!.textContent).toBe('Plan your own trip');
    expect(el.textContent).toContain("You'll stay on Chiang Mai, November too.");
    const comp = fixture.componentInstance;
    comp.email = 'robin@example.com';
    comp.password = 'Sunshine2026';
    await comp.create();
    fixture.detectChanges();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const next = Array.from(el.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Plan your trip') as HTMLButtonElement;
    next.click();
    expect(navigate).toHaveBeenCalledWith(['/trips/new']);
    expect(TestBed.inject(AccountPromptService).open()).toBeFalse();
  });
});
