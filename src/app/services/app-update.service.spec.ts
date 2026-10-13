import { TestBed } from '@angular/core/testing';
import { AppUpdateService } from './app-update.service';
import { APP_BUILD } from '../../version';

describe('AppUpdateService', () => {
  let service: AppUpdateService;
  let reload: jasmine.Spy;
  let liveBuild: jasmine.Spy;
  let visibility: DocumentVisibilityState;
  let focused: Element | null;

  const newer = String(Number(APP_BUILD) + 1);
  const flush = () => new Promise(r => setTimeout(r));
  const show = () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); };
  const hide = () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); };
  const comeBack = async () => { hide(); show(); await flush(); };

  beforeEach(() => {
    visibility = 'visible';
    focused = null;
    spyOnProperty(document, 'visibilityState').and.callFake(() => visibility);
    spyOnProperty(document, 'activeElement').and.callFake(() => focused);
    service = TestBed.inject(AppUpdateService);
    reload = spyOn(service as any, 'reload');
    liveBuild = spyOn(service as any, 'liveBuild').and.resolveTo(APP_BUILD);
    service.start();
  });

  afterEach(() => service.stop());

  it('asks which version is live when the app comes back on screen', async () => {
    await comeBack();
    expect(liveBuild).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask again within a minute", async () => {
    await comeBack();
    await comeBack();
    expect(liveBuild).toHaveBeenCalledTimes(1);
  });

  it('stays put when it is already on the live version', async () => {
    await comeBack();
    expect(reload).not.toHaveBeenCalled();
  });

  it('refreshes into a newer version straight away', async () => {
    liveBuild.and.resolveTo(newer);
    await comeBack();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('waits while someone is typing, and refreshes the next time the app is back on screen', async () => {
    liveBuild.and.resolveTo(newer);
    focused = document.createElement('textarea');
    await comeBack();
    expect(reload).not.toHaveBeenCalled();

    await comeBack();
    expect(reload).not.toHaveBeenCalled();  // still in the field

    focused = null;
    await comeBack();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('carries on quietly when it is offline or the check fails', async () => {
    liveBuild.and.rejectWith(new Error('offline'));
    spyOn(console, 'warn');
    await comeBack();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does nothing in the iPhone app, which only changes when a new build is installed', async () => {
    service.stop();
    (service as any).native = true;
    service.start();
    await comeBack();
    expect(liveBuild).not.toHaveBeenCalled();
  });
});
