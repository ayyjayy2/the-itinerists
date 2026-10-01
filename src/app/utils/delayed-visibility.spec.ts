import { DelayedVisibility } from './delayed-visibility';

describe('DelayedVisibility', () => {
  let dv: DelayedVisibility;

  beforeEach(() => { jasmine.clock().install(); dv = new DelayedVisibility(300, 300); });
  afterEach(() => { dv.destroy(); jasmine.clock().uninstall(); });

  it('starts hidden', () => {
    expect(dv.visible()).toBeFalse();
  });

  it('does not show for a wait shorter than the delay', () => {
    dv.set(true);
    jasmine.clock().tick(200);
    dv.set(false);
    jasmine.clock().tick(1000);
    expect(dv.visible()).toBeFalse();
  });

  it('shows once the wait passes the delay', () => {
    dv.set(true);
    jasmine.clock().tick(299);
    expect(dv.visible()).toBeFalse();
    jasmine.clock().tick(1);
    expect(dv.visible()).toBeTrue();
  });

  it('stays up for the minimum time even if the work finishes sooner', () => {
    dv.set(true);
    jasmine.clock().tick(300);   // shown at t=300
    dv.set(false);               // finished at t=300
    jasmine.clock().tick(299);
    expect(dv.visible()).toBeTrue();
    jasmine.clock().tick(1);     // t=600
    expect(dv.visible()).toBeFalse();
  });

  it('hides right away when the work finished after the minimum time', () => {
    dv.set(true);
    jasmine.clock().tick(1000);
    dv.set(false);
    expect(dv.visible()).toBeFalse();
  });

  it('keeps showing if work restarts during the minimum window', () => {
    dv.set(true);
    jasmine.clock().tick(300);
    dv.set(false);
    jasmine.clock().tick(100);
    dv.set(true);                // busy again before it could hide
    jasmine.clock().tick(1000);
    expect(dv.visible()).toBeTrue();
  });

  it('ignores repeated busy=true calls (one timer, no reset)', () => {
    dv.set(true);
    jasmine.clock().tick(200);
    dv.set(true);
    jasmine.clock().tick(100);   // 300ms since the first call
    expect(dv.visible()).toBeTrue();
  });

  it('shows at once when asked to (right after sign-in)', () => {
    dv.set(true, true);
    expect(dv.visible()).toBeTrue();
    dv.set(false);
    jasmine.clock().tick(300);
    expect(dv.visible()).toBeFalse();
  });
});
