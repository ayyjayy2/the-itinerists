import { TestBed } from '@angular/core/testing';
import { CrashReporterService, CRASH_REPORTER_PLUGIN, CRASH_REPORTER_NATIVE, CrashlyticsLike } from './crash-reporter.service';

function fakePlugin(): jasmine.SpyObj<CrashlyticsLike> {
  const p = jasmine.createSpyObj<CrashlyticsLike>('Crashlytics', ['recordException', 'setUserId', 'log', 'setEnabled']);
  p.recordException.and.resolveTo();
  p.setUserId.and.resolveTo();
  p.log.and.resolveTo();
  p.setEnabled.and.resolveTo();
  return p;
}

function setup(native: boolean) {
  const plugin = fakePlugin();
  TestBed.configureTestingModule({ providers: [
    { provide: CRASH_REPORTER_PLUGIN, useValue: plugin },
    { provide: CRASH_REPORTER_NATIVE, useValue: native },
  ]});
  return { plugin, svc: TestBed.inject(CrashReporterService) };
}

describe('CrashReporterService', () => {
  it('on the web it does nothing at all', async () => {
    const { plugin, svc } = setup(false);
    await svc.record(new Error('boom'), 'js_error');
    await svc.setUser('uid1');
    expect(plugin.recordException).not.toHaveBeenCalled();
    expect(plugin.setUserId).not.toHaveBeenCalled();
    expect(svc.active).toBeFalse();
  });

  it('in the native shell it records the error message with its type and stack', async () => {
    const { plugin, svc } = setup(true);
    const err = new Error('boom');
    await svc.record(err, 'firestore_error');
    expect(svc.active).toBeTrue();
    const call = plugin.recordException.calls.mostRecent().args[0];
    expect(call.message).toBe('firestore_error: boom');
    expect(call.stacktrace?.length).toBeGreaterThan(0);
  });

  it('turns non-Error throwables into a message', async () => {
    const { plugin, svc } = setup(true);
    await svc.record('just a string', 'js_error');
    expect(plugin.recordException.calls.mostRecent().args[0].message).toBe('js_error: just a string');
  });

  it('tags reports with the signed-in uid only, never an email, and clears it on sign-out', async () => {
    const { plugin, svc } = setup(true);
    await svc.setUser('uid1');
    expect(plugin.setUserId).toHaveBeenCalledWith({ userId: 'uid1' });
    await svc.setUser(null);
    expect(plugin.setUserId).toHaveBeenCalledWith({ userId: '' });
  });

  it('never throws even if the plugin rejects', async () => {
    const { plugin, svc } = setup(true);
    plugin.recordException.and.rejectWith(new Error('plugin down'));
    await expectAsync(svc.record(new Error('x'), 'js_error')).toBeResolved();
  });
});
