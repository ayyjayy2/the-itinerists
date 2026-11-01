import { DataExportService } from '../../services/data-export.service';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { UserService } from '../../services/user.service';
import { TripService } from '../../services/trip.service';
import { AuthService } from '../../services/auth.service';

/** Download my data (#332) stand-in: the file itself is tested in utils/data-export.spec.ts. */
const dataExport = { download: jasmine.createSpy('download').and.resolveTo() };

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
        { provide: DataExportService, useValue: dataExport },
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
        { provide: DataExportService, useValue: dataExport },
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
        { provide: DataExportService, useValue: dataExport },
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

describe('ProfileComponent show-password eye', () => {
  const user = signal<any>({
    uid: 'u1', displayName: 'Maya', username: 'maya', avatarEmoji: '🌸', color: '#fff',
    authEmail: 'maya@the-itinerists.local', pendingEmail: '',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: UserService,  useValue: { firestoreUser: user } },
        { provide: TripService, useValue: { activeMembers: signal([]) } },
        { provide: AuthService,  useValue: {} },
        { provide: DataExportService, useValue: dataExport },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });
  });

  function open(which: 'openPasswordModal' | 'openDeleteModal' | 'openRecoveryModal') {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    fixture.componentInstance[which]();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const fields = () => [...el.querySelectorAll<HTMLInputElement>('.modal-box .input-wrap input')];
    const eyes = () => [...el.querySelectorAll<HTMLButtonElement>('.modal-box .eye-btn')];
    return { fixture, el, fields, eyes };
  }

  for (const [which, count] of [['openPasswordModal', 3], ['openDeleteModal', 1], ['openRecoveryModal', 1]] as const) {
    it(`${which}: every password field has an eye that shows and hides it`, () => {
      const { fixture, el, fields, eyes } = open(which);
      expect(el.querySelectorAll('.modal-box input[type=password]').length).toBe(count);
      expect(fields().length).toBe(count);
      expect(eyes().length).toBe(count);
      expect(eyes()[0].getAttribute('aria-label')).toBe('Show password');

      eyes()[0].click();
      fixture.detectChanges();
      expect(fields()[0].type).toBe('text');
      expect(fields().slice(1).every(f => f.type === 'password')).withContext('other fields stay hidden').toBeTrue();
      expect(eyes()[0].getAttribute('aria-label')).toBe('Hide password');

      eyes()[0].click();
      fixture.detectChanges();
      expect(fields().every(f => f.type === 'password')).toBeTrue();
    });
  }

  it('in Change password, each field has its own eye', () => {
    const { fixture, fields, eyes } = open('openPasswordModal');
    eyes()[2].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['password', 'password', 'text']);
    eyes()[1].click();
    fixture.detectChanges();
    expect(fields().map(f => f.type)).toEqual(['password', 'text', 'text']);
  });

  it('hides the password again when a modal is reopened', () => {
    const { fixture, eyes, fields } = open('openDeleteModal');
    eyes()[0].click();
    fixture.componentInstance.closeDeleteModal();
    fixture.componentInstance.openDeleteModal();
    fixture.detectChanges();
    expect(fields()[0].type).toBe('password');
  });
});

describe('ProfileComponent download my data (#332)', () => {
  it('shows a busy label while gathering, and a way forward if it fails', async () => {
    TestBed.resetTestingModule();
    let finish!: () => void;
    const stub = { download: jasmine.createSpy('download').and.returnValue(new Promise<void>(r => { finish = r; })) };
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        { provide: DataExportService, useValue: stub },
        { provide: UserService, useValue: { firestoreUser: signal({ uid: 'u', displayName: 'Maya', avatarEmoji: '🌸', color: '#fff', isAdmin: false, createdAt: 0 }), currentUser: signal(null), isGuest: signal(false), updateHomeLayout: () => {} } },
        { provide: TripService, useValue: { activeMembers: signal([]) } },
      ],
    });
    const comp = TestBed.createComponent(ProfileComponent).componentInstance;
    const run = comp.downloadData();
    expect(comp.dataBusy()).toBeTrue();
    finish();
    await run;
    expect(comp.dataBusy()).toBeFalse();
    stub.download.and.rejectWith(new Error('offline'));
    await comp.downloadData();
    expect(comp.dataError()).toBeTruthy();
  });
});
