import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { DiagnosticsService, INVITE_CLOSE_SLOW_MS } from './diagnostics.service';
import { ErrorLoggerService } from './error-logger.service';

describe('DiagnosticsService (#484, #485)', () => {
  let notes: string[];
  let svc: DiagnosticsService;

  beforeEach(() => {
    notes = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorLoggerService, useValue: { logDiagnostic: (m: string) => notes.push(m) } }],
    });
    svc = TestBed.inject(DiagnosticsService);
  });

  it('notes nothing when closing an invite goes through', fakeAsync(() => {
    void svc.watchInviteClose('ABC123', () => Promise.resolve());
    tick(INVITE_CLOSE_SLOW_MS + 1);
    expect(notes).toEqual([]);
  }));

  it('notes a close that failed, with the error code, and still fails', async () => {
    const err = Object.assign(new Error('nope'), { code: 'permission-denied' });
    await expectAsync(svc.watchInviteClose('ABC123', () => Promise.reject(err))).toBeRejectedWith(err);
    expect(notes).toEqual(['invite close failed: permission-denied']);
  });

  it('notes a close the server hasn\'t answered after a while', fakeAsync(() => {
    let finish!: () => void;
    void svc.watchInviteClose('ABC123', () => new Promise<void>(r => (finish = r)));
    tick(INVITE_CLOSE_SLOW_MS);
    expect(notes).toEqual([`invite close: no reply from the server after ${INVITE_CLOSE_SLOW_MS / 1000} s`]);
    finish(); tick();
    expect(notes.length).toBe(1);
  }));

  it('notes a closed invite that comes back in the live list', fakeAsync(() => {
    void svc.watchInviteClose('ABC123', () => Promise.resolve());
    tick(3000);
    svc.invitesSeen([], { fromCache: true, pendingWrites: true });
    svc.invitesSeen(['ABC123'], { fromCache: false, pendingWrites: false });
    expect(notes).toEqual(['closed invite is live again 3.0 s after closing (from server, no pending writes)']);
  }));

  it('notes a slow start once, and not a quick one', () => {
    svc.startup({ authMs: 300, readyMs: 1500, native: true, from: 'launch' });
    svc.startup({ authMs: 300, readyMs: 9000, native: true, from: 'launch' });
    expect(notes).toEqual([]);   // only the first start of the session counts
  });

  it('notes a slow first start', () => {
    svc.startup({ authMs: 1200, readyMs: 9800, native: true, from: 'launch' });
    svc.startup({ authMs: 1200, readyMs: 9800, native: true, from: 'launch' });
    expect(notes).toEqual(['slow start: sign-in known 1.2 s after launch, trip ready 9.8 s after launch (iPhone app)']);
  });

  describe('startupTick', () => {
    const at = (authKnown: boolean, signedIn: boolean, ready: boolean) => ({ authKnown, signedIn, ready, native: true });

    it('already signed in: times from launch', () => {
      svc.startupTick(at(false, false, false), 200);
      svc.startupTick(at(true, true, false), 1200);
      svc.startupTick(at(true, true, true), 9800);
      expect(notes).toEqual(['slow start: sign-in known 1.2 s after launch, trip ready 9.8 s after launch (iPhone app)']);
    });

    it('signing in by hand: time on the form doesn\'t count', () => {
      svc.startupTick(at(true, false, false), 500);     // the sign-in form is up
      svc.startupTick(at(true, true, false), 60_000);   // a minute later they sign in
      svc.startupTick(at(true, true, true), 70_000);
      expect(notes).toEqual(['slow start: sign-in known 0.5 s after launch, trip ready 10.0 s after sign-in (iPhone app)']);
    });

    it('a quick start notes nothing and stops watching', () => {
      svc.startupTick(at(true, true, true), 900);
      svc.startupTick(at(true, true, true), 20_000);
      expect(notes).toEqual([]);
    });
  });
});
