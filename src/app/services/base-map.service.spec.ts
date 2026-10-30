import { TestBed } from '@angular/core/testing';
import { BaseMapService, LABEL_MODE_KEY } from './base-map.service';

/** A stand-in for a MapLibre map: one place label and one road-number label. */
function fakeGlMap() {
  const set: Record<string, unknown> = {};
  return {
    set,
    getStyle: () => ({ layers: [
      { id: 'place', layout: { 'text-field': ['get', 'name'] } },
      { id: 'shield', layout: { 'text-field': ['get', 'ref'] } },
    ] }),
    setLayoutProperty: (layer: string, _name: string, value: unknown) => { set[layer] = value; },
  };
}

describe('BaseMapService', () => {
  beforeEach(() => localStorage.removeItem(LABEL_MODE_KEY));
  afterEach(() => localStorage.removeItem(LABEL_MODE_KEY));

  it('labels every map it draws in the app\'s language by default', () => {
    const svc = TestBed.inject(BaseMapService);
    const gl = fakeGlMap();
    svc.track(gl);
    expect(svc.localNames()).toBeFalse();
    expect(gl.set['place']).toEqual(['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]);
    expect(gl.set['shield']).toBeUndefined();          // road numbers stay as they are
  });

  it('switches every map at once, so Home and the Map page match, and remembers it', () => {
    const svc = TestBed.inject(BaseMapService);
    const home = fakeGlMap(), page = fakeGlMap();
    svc.track(home); svc.track(page);
    svc.setLocalNames(true);
    expect(home.set['place']).toEqual(['get', 'name']);
    expect(page.set['place']).toEqual(['get', 'name']);
    expect(localStorage.getItem(LABEL_MODE_KEY)).toBe('local');
  });

  it('stops updating a map once it is gone', () => {
    const svc = TestBed.inject(BaseMapService);
    const gl = fakeGlMap();
    const untrack = svc.track(gl);
    untrack();
    svc.setLocalNames(true);
    expect(gl.set['place']).not.toEqual(['get', 'name']);
  });
});
