import { PlaceSearch, PlaceUnavailable } from './place-search';
import { RateGate } from './rate-gate';

// #696: OpenStreetMap's free lookup refused us (429) after a busy day. Every place
// lookup now goes through one helper: answers are kept, requests go out one a
// second app-wide, and a refusal pauses lookups instead of hammering it.
describe('PlaceSearch', () => {
  let now: number;
  let calls: string[];
  let reply: () => Promise<Response>;
  let store: Record<string, string>;
  const storage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
  } as unknown as Storage;
  const ok = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  function make() {
    const fetchFn = (url: string) => { calls.push(url); return reply(); };
    return new PlaceSearch(fetchFn as typeof fetch, storage, () => now, new RateGate(1100, () => now, async () => {}));
  }
  beforeEach(() => { now = 1_000_000; calls = []; store = {}; reply = ok([{ lat: '18.79', lon: '98.98' }]); });

  it('asks once and remembers the answer, on this device across visits', async () => {
    expect(await make().find('Pai, Thailand')).toEqual({ lat: 18.79, lng: 98.98 });
    expect(await make().find('Pai, Thailand')).toEqual({ lat: 18.79, lng: 98.98 });
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('q=Pai%2C%20Thailand');
  });

  it('shares one request when the same place is asked for twice at once', async () => {
    const s = make();
    await Promise.all([s.find('Pai'), s.find('Pai')]);
    expect(calls.length).toBe(1);
  });

  it('remembers a place that is not found for a while, then asks again', async () => {
    reply = ok([]);
    expect(await make().find('Nowhere')).toBeNull();
    expect(await make().find('Nowhere')).toBeNull();
    expect(calls.length).toBe(1);
    now += 8 * 86_400_000;
    await make().find('Nowhere');
    expect(calls.length).toBe(2);
  });

  it('keeps the extra search settings apart in what it remembers', async () => {
    const s = make();
    await s.find('Old Town', '&viewbox=1,2,3,4&bounded=1');
    await s.find('Old Town');
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain('&viewbox=1,2,3,4&bounded=1');
  });

  it('when refused, says so (never "not found") and pauses before asking again', async () => {
    reply = () => Promise.resolve(new Response('Too many requests', { status: 429 }));
    const s = make();
    await expectAsync(s.find('Pai')).toBeRejectedWithError(PlaceUnavailable);
    reply = ok([{ lat: '1', lon: '2' }]);
    await expectAsync(s.find('Chiang Mai')).toBeRejectedWithError(PlaceUnavailable);
    expect(calls.length).toBe(1);                        // paused: nothing sent
    now += 3 * 60_000;
    expect(await s.find('Chiang Mai')).toEqual({ lat: 1, lng: 2 });
    expect(await s.find('Pai')).toEqual({ lat: 1, lng: 2 });   // the refusal wasn't remembered as a miss
  });

  it('treats no connection the same way', async () => {
    reply = () => Promise.reject(new TypeError('Failed to fetch'));
    await expectAsync(make().find('Pai')).toBeRejectedWithError(PlaceUnavailable);
  });
});
