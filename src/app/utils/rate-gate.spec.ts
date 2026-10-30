import { RateGate, missIsFresh } from './rate-gate';

describe('RateGate', () => {
  let clock = 0;
  const slept: number[] = [];
  const sleep = async (ms: number) => { slept.push(ms); clock += ms; };
  beforeEach(() => { clock = 1_000_000; slept.length = 0; });

  it('lets the first request through at once', async () => {
    const gate = new RateGate(1100, () => clock, sleep);
    await gate.wait();
    expect(slept).toEqual([]);
  });

  it('spaces requests one interval apart, counting the time already passed', async () => {
    const gate = new RateGate(1100, () => clock, sleep);
    await gate.wait();
    clock += 800;                    // the request took 0.8 s
    await gate.wait();
    expect(slept).toEqual([300]);    // only the rest of the second
  });

  it('does not wait when a request took longer than the interval', async () => {
    const gate = new RateGate(1100, () => clock, sleep);
    await gate.wait();
    clock += 2000;
    await gate.wait();
    expect(slept).toEqual([]);
  });

  it('queues callers that arrive together, one interval apart', async () => {
    const gate = new RateGate(1100, () => clock, sleep);
    await Promise.all([gate.wait(), gate.wait(), gate.wait()]);
    expect(slept).toEqual([1100, 1100]);
  });
});

describe('missIsFresh', () => {
  const day = 86_400_000;
  it('remembers a place that was not found for a week', () => {
    expect(missIsFresh(0, 6 * day)).toBeTrue();
    expect(missIsFresh(0, 8 * day)).toBeFalse();
  });
});
