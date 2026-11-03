import { StalledError, waitWithNudge } from './wait-with-nudge';

// #703: in the iPhone app, sign-in could wait for the profile forever when the
// database connection stalled; a refresh made it quick. Waiting now nudges the
// connection (what the refresh did), then gives up and says so.
describe('waitWithNudge', () => {
  beforeEach(() => jasmine.clock().install());
  afterEach(() => jasmine.clock().uninstall());
  const opts = { nudgeAfterMs: 6000, giveUpAfterMs: 20000 };

  it('answers straight away, without nudging, when the value comes quickly', async () => {
    const nudge = jasmine.createSpy('nudge');
    const result = waitWithNudge(Promise.resolve('maya'), nudge, opts);
    expect(await result).toBe('maya');
    jasmine.clock().tick(30000);
    expect(nudge).not.toHaveBeenCalled();
  });

  it('nudges once when it is slow, then answers when the value comes', async () => {
    let arrive!: (v: string) => void;
    const nudge = jasmine.createSpy('nudge');
    const result = waitWithNudge(new Promise<string>(r => { arrive = r; }), nudge, opts);
    jasmine.clock().tick(6001);
    expect(nudge).toHaveBeenCalledTimes(1);
    arrive('maya');
    expect(await result).toBe('maya');
    jasmine.clock().tick(30000);
    expect(nudge).toHaveBeenCalledTimes(1);
  });

  it('gives up with StalledError when nothing comes', async () => {
    const result = waitWithNudge(new Promise<string>(() => {}), () => {}, opts);
    jasmine.clock().tick(20001);
    await expectAsync(result).toBeRejectedWithError(StalledError);
  });

  it('passes on a real failure as it is', async () => {
    const result = waitWithNudge(Promise.reject(new Error('Missing or insufficient permissions.')), () => {}, opts);
    await expectAsync(result).toBeRejectedWithError('Missing or insufficient permissions.');
  });

  it('keeps waiting if the nudge itself fails', async () => {
    let arrive!: (v: string) => void;
    const result = waitWithNudge(new Promise<string>(r => { arrive = r; }), () => Promise.reject(new Error('offline')), opts);
    jasmine.clock().tick(6001);
    arrive('maya');
    expect(await result).toBe('maya');
  });
});
