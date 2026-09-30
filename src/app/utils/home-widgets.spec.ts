import { isPageHidden, visibleWidgetKeys, WIDGET_PATHS } from './home-widgets';

describe('home-widgets: isPageHidden', () => {
  it('matches a path against the hidden keys (no leading slash)', () => {
    expect(isPageHidden('/finance', ['finance'])).toBeTrue();
    expect(isPageHidden('/finance', ['map'])).toBeFalse();
    expect(isPageHidden('/accommodations', ['accommodations'])).toBeTrue();
  });
  it('is false for an empty hidden list', () => {
    expect(isPageHidden('/map', [])).toBeFalse();
  });
});

describe('home-widgets: visibleWidgetKeys', () => {
  it('returns every widget in default nav order when nothing is hidden', () => {
    expect(visibleWidgetKeys(undefined, [])).toEqual([
      'itinerary', 'finance', 'packing', 'flights', 'accommodations',
      'transportation', 'expenses', 'recs', 'outfits',
    ]);
  });
  it('drops hidden pages and closes the gap', () => {
    expect(visibleWidgetKeys(undefined, ['finance', 'transportation', 'map'])).toEqual([
      'itinerary', 'packing', 'flights', 'accommodations', 'expenses', 'recs', 'outfits',
    ]);
  });
  it('follows the personal nav order but keeps itinerary first', () => {
    const order = ['/recs', '/packing', '/itinerary', '/finance'];
    expect(visibleWidgetKeys(order, [])).toEqual([
      'itinerary', 'recs', 'packing', 'finance', 'flights', 'accommodations',
      'transportation', 'expenses', 'outfits',
    ]);
  });
  it('never includes map', () => {
    expect(visibleWidgetKeys(['/map'], [])).not.toContain('map' as never);
    expect(Object.keys(WIDGET_PATHS)).not.toContain('map');
  });
});
