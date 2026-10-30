import { labelExpression, nameLabelLayers } from './map-labels';

describe('labelExpression', () => {
  it('shows names in the app\'s language, then the Latin spelling, then the local name', () => {
    expect(labelExpression('app', 'en')).toEqual(
      ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]);
  });

  it('follows the app\'s language when it changes', () => {
    expect(labelExpression('app', 'fr')[1]).toEqual(['get', 'name:fr']);
  });

  it('shows the local name when asked', () => {
    expect(labelExpression('local', 'en')).toEqual(['get', 'name']);
  });
});

describe('nameLabelLayers', () => {
  it('picks the layers that label places by name, not house numbers or road numbers', () => {
    const layers = [
      { id: 'water', layout: {} },
      { id: 'place_city', layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']] } },
      { id: 'road_label', layout: { 'text-field': ['get', 'name'] } },
      { id: 'housenumber', layout: { 'text-field': '{housenumber}' } },
      { id: 'road_shield', layout: { 'text-field': ['get', 'ref'] } },
      { id: 'poi', layout: { 'text-field': '{name}' } },
      { id: 'background' },
    ];
    expect(nameLabelLayers(layers)).toEqual(['place_city', 'road_label', 'poi']);
  });
});
