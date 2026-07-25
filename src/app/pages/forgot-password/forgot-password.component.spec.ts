import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../services/auth.service';

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
    auth.sendPasswordReset.and.resolveTo('makaela@gmail.com');
    const { comp } = create();
    comp.username = 'makaela';
    await comp.submit();
    expect(comp.sentTo()).toBe('m•••@gmail.com');
    expect(comp.noRecovery()).toBeFalse();
  });

  it('shows the no-recovery message when reset returns null', async () => {
    auth.sendPasswordReset.and.resolveTo(null);
    const { comp } = create();
    comp.username = 'makaela';
    await comp.submit();
    expect(comp.noRecovery()).toBeTrue();
    expect(comp.sentTo()).toBe('');
  });

  it('shows an error when the send fails', async () => {
    auth.sendPasswordReset.and.rejectWith(new Error('boom'));
    const { comp } = create();
    comp.username = 'makaela';
    await comp.submit();
    expect(comp.error()).toContain('Something went wrong');
  });
});
