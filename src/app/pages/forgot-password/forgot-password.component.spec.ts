import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService, UseEmailToSignInError } from '../../services/auth.service';

describe('ForgotPasswordComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['sendPasswordReset']);
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
    return { fixture, comp: fixture.componentInstance };
  }

  it('shows the masked email after a successful send', async () => {
    auth.sendPasswordReset.and.resolveTo('maya@gmail.com');
    const { comp } = create();
    comp.email = 'maya@example.com';
    await comp.submit();
    expect(comp.sentTo()).toBe('m•••@gmail.com');
    expect(comp.noRecovery()).toBeFalse();
  });

  it('shows the no-recovery message when reset returns null', async () => {
    auth.sendPasswordReset.and.resolveTo(null);
    const { comp } = create();
    comp.email = 'maya@example.com';
    await comp.submit();
    expect(comp.noRecovery()).toBeTrue();
    expect(comp.sentTo()).toBe('');
  });

  it('shows an error when the send fails', async () => {
    auth.sendPasswordReset.and.rejectWith(new Error('boom'));
    const { comp } = create();
    comp.email = 'maya@example.com';
    await comp.submit();
    expect(comp.error()).toContain('Something went wrong');
  });

  it("answers the same whether or not an account uses the address, so it can't be used to look people up (#405)", async () => {
    auth.sendPasswordReset.and.rejectWith({ code: 'auth/user-not-found' });
    const { comp } = create();
    comp.email = 'typo@gmail.com';
    await comp.submit();
    expect(comp.error()).toBe('');
    expect(comp.sentTo()).toBe('t•••@gmail.com');
  });

  it("doesn't claim the link was sent: it says one is on its way if an account uses the address", async () => {
    auth.sendPasswordReset.and.resolveTo('maya@gmail.com');
    const { comp, fixture } = create();
    comp.email = 'maya@gmail.com';
    await comp.submit();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('If an account uses m•••@gmail.com, a reset link is on its way.');
  });

  it('says to wait after too many requests', async () => {
    auth.sendPasswordReset.and.rejectWith({ code: 'auth/too-many-requests' });
    const { comp } = create();
    comp.email = 'maya@gmail.com';
    await comp.submit();
    expect(comp.error()).toBe('Too many attempts. Please wait a few minutes and try again.');
  });

  it('asks for the email when a username belongs to an email account', async () => {
    auth.sendPasswordReset.and.rejectWith(new UseEmailToSignInError());
    const { comp } = create();
    comp.email = 'maya';
    await comp.submit();
    expect(comp.error()).toContain('signs in with its email address');
  });
});
