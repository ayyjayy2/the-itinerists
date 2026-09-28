import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { UserService } from '../../services/user.service';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';

function firebaseError(code: string): Error {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

describe('ProfileComponent recovery-email modal', () => {
  let auth: { sendRecoveryEmail: jasmine.Spy };
  const user = signal<any>({
    uid: 'u1', displayName: 'Alayna', username: 'alayna', avatarEmoji: '🌸', color: '#fff',
    authEmail: 'alayna@the-itinerists.local', pendingEmail: 'me@example.com',
  });

  beforeEach(() => {
    auth = { sendRecoveryEmail: jasmine.createSpy('sendRecoveryEmail').and.resolveTo() };
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: UserService,  useValue: { firestoreUser: user } },
        { provide: UsersService, useValue: { allUsers: signal([]) } },
        { provide: AuthService,  useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
  });

  function create(): ProfileComponent {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('opens in resend mode when a link is already waiting to be verified', () => {
    const c = create();
    c.openRecoveryModal();
    expect(c.recoveryMode()).toBe('resend');
  });

  it('does nothing without the password', async () => {
    const c = create();
    c.openRecoveryModal();
    await c.resendRecoveryEmail();
    expect(auth.sendRecoveryEmail).not.toHaveBeenCalled();
  });

  it('resends to the pending address with the password, no email to retype', async () => {
    const c = create();
    c.openRecoveryModal();
    c.recoveryPass = 'hunter22';
    await c.resendRecoveryEmail();
    expect(auth.sendRecoveryEmail).toHaveBeenCalledWith('me@example.com', 'hunter22');
    expect(c.recoverySuccess()).toBeTrue();
    expect(c.recoverySentTo).toBe('me@example.com');
  });

  it('shows a plain message for other failures', async () => {
    auth.sendRecoveryEmail.and.rejectWith(firebaseError('auth/network-request-failed'));
    const c = create();
    c.openRecoveryModal();
    c.recoveryPass = 'hunter22';
    await c.resendRecoveryEmail();
    expect(c.recoveryError()).toContain('connection');
  });

  it('switches to the full form to use a different address', () => {
    const c = create();
    c.openRecoveryModal();
    c.useDifferentEmail();
    expect(c.recoveryMode()).toBe('form');
  });

  it('opens in form mode when nothing is pending', () => {
    user.update(u => ({ ...u, pendingEmail: undefined }));
    const c = create();
    c.openRecoveryModal();
    expect(c.recoveryMode()).toBe('form');
    user.update(u => ({ ...u, pendingEmail: 'me@example.com' }));
  });
});
