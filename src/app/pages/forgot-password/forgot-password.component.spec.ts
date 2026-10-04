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

  it('names the problem when an entered email matches no account', async () => {
    auth.sendPasswordReset.and.rejectWith({ code: 'auth/user-not-found' });
    const { comp } = create();
    comp.email = 'typo@gmail.com';
    await comp.submit();
    expect(comp.error()).toBe('No account uses that email.');
  });

  it('asks for the email when a username belongs to an email account', async () => {
    auth.sendPasswordReset.and.rejectWith(new UseEmailToSignInError());
    const { comp } = create();
    comp.email = 'maya';
    await comp.submit();
    expect(comp.error()).toContain('Use your email address');
  });
});
