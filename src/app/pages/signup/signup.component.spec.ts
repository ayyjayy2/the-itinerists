import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Location } from '@angular/common';
import { SignupComponent } from './signup.component';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { LocalCacheService } from '../../services/local-cache.service';

describe('SignupComponent show-password eye', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
      ],
    });
  });

  it('gives each password field its own eye: tapping one shows only that field', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const fields = () => [...el.querySelectorAll<HTMLInputElement>('.input-wrap input')];
    const eyes = () => [...el.querySelectorAll<HTMLButtonElement>('.eye-btn')];
    expect(fields().length).toBe(2);
    expect(eyes().length).toBe(2);

    eyes()[0].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['text', 'password']);

    eyes()[1].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['text', 'text']);

    eyes()[0].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['password', 'text']);
    expect(eyes().map(e => e.getAttribute('aria-label'))).toEqual(['Show password', 'Hide password']);
  });
});

/** #404: invite codes never stay in the address bar (analytics and history would keep them). */
describe('SignupComponent invite code from a link', () => {
  function setup(opts: { query?: string; state?: string }) {
    const replaceState = jasmine.createSpy('replaceState');
    TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { validateInviteCode: () => Promise.resolve('t1') } },
        { provide: UserService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(opts.query ? { code: opts.query } : {}) } } },
        { provide: Location, useValue: { replaceState, getState: () => (opts.state ? { inviteCode: opts.state } : {}) } },
      ],
    });
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    return { comp: fixture.componentInstance, replaceState };
  }

  it('takes the code handed over by the join page, without it ever being in the address', () => {
    const { comp, replaceState } = setup({ state: 'abc123' });
    expect(comp.inviteCode).toBe('ABC123');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('still accepts an old ?code= link, then takes the code out of the address bar', () => {
    const { comp, replaceState } = setup({ query: 'abc123' });
    expect(comp.inviteCode).toBe('ABC123');
    expect(replaceState).toHaveBeenCalledWith('/signup');
  });
});

/** #609: Pulse's invite-to-join rate counts who reached an invite, by link or by typing the code. */
describe('SignupComponent counts how an invite was reached', () => {
  function setup(state?: string) {
    const validateInviteCode = jasmine.createSpy('validateInviteCode').and.returnValue(Promise.resolve('t1'));
    TestBed.configureTestingModule({
      imports: [SignupComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { validateInviteCode } },
        { provide: UserService, useValue: {} },
        { provide: LocalCacheService, useValue: { recoverIfBroken: () => false } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: Location, useValue: { replaceState: () => {}, getState: () => (state ? { inviteCode: state } : {}) } },
      ],
    });
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    return { comp: fixture.componentInstance, validateInviteCode };
  }

  it('a code from an invite link counts as the link', () => {
    const { validateInviteCode } = setup('abc123');
    expect(validateInviteCode).toHaveBeenCalledWith('ABC123', 'link');
  });

  it('a typed code counts as a code, even after arriving from a link', async () => {
    const { comp, validateInviteCode } = setup('abc123');
    comp.inviteCode = 'xyz789';
    await comp.checkInviteCode();
    expect(validateInviteCode).toHaveBeenCalledWith('XYZ789', 'code');
  });
});
