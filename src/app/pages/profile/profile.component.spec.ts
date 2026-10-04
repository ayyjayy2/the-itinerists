import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
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
        { provide: TripService, useValue: { activeMembers: signal([]) } },
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

describe('ProfileComponent delete-account modal', () => {
  let auth: { deleteAccount: jasmine.Spy };
  const user = signal<any>({
    uid: 'u1', displayName: 'Alayna', username: 'alayna', avatarEmoji: '🌸', color: '#fff',
  });

  beforeEach(() => {
    auth = { deleteAccount: jasmine.createSpy('deleteAccount').and.resolveTo() };
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: UserService,  useValue: { firestoreUser: user } },
        { provide: TripService, useValue: { activeMembers: signal([]) } },
        { provide: AuthService,  useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
  });

  function create(): ProfileComponent {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    spyOn(c, 'leaveApp');
    return c;
  }

  it('opens with an empty password and no error', () => {
    const c = create();
    c.deletePass = 'left over';
    c.openDeleteModal();
    expect(c.showDeleteModal()).toBeTrue();
    expect(c.deletePass).toBe('');
    expect(c.deleteError()).toBe('');
  });

  it('does nothing without the password', async () => {
    const c = create();
    c.openDeleteModal();
    await c.confirmDeleteAccount();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(c.leaveApp).not.toHaveBeenCalled();
  });

  it('deletes with the password, then leaves the app', async () => {
    const c = create();
    c.openDeleteModal();
    c.deletePass = 'hunter22';
    await c.confirmDeleteAccount();
    expect(auth.deleteAccount).toHaveBeenCalledWith('hunter22');
    expect(c.leaveApp).toHaveBeenCalled();
  });

  it('names a wrong password and stays open', async () => {
    auth.deleteAccount.and.rejectWith(firebaseError('auth/invalid-credential'));
    const c = create();
    c.openDeleteModal();
    c.deletePass = 'nope';
    await c.confirmDeleteAccount();
    expect(c.deleteError()).toBe('Current password is incorrect.');
    expect(c.showDeleteModal()).toBeTrue();
    expect(c.leaveApp).not.toHaveBeenCalled();
  });

  it('shows a plain message for other failures', async () => {
    auth.deleteAccount.and.rejectWith(firebaseError('permission-denied'));
    const c = create();
    c.openDeleteModal();
    c.deletePass = 'hunter22';
    await c.confirmDeleteAccount();
    expect(c.deleteError()).toBe("You don't have permission to do that.");
    expect(c.leaveApp).not.toHaveBeenCalled();
  });
});

describe('ProfileComponent without usernames', () => {
  const user = signal<any>({ uid: 'u1', displayName: 'Maya', username: 'maya', avatarEmoji: '🌸', color: '#fff', authEmail: 'maya@example.com' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: UserService,  useValue: { firestoreUser: user } },
        { provide: TripService, useValue: { activeMembers: signal([]) } },
        { provide: AuthService,  useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
  });

  it('shows the sign-in email, no @username, and no Change Username', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('maya@example.com');
    expect(text).not.toContain('@maya');
    expect(text).not.toContain('Change Username');
    expect(text).toContain('Change Email');
  });
});
