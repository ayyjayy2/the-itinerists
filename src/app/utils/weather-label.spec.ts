import { weatherLabel } from './weather-label';

describe('weatherLabel', () => {
  it('maps the common WMO codes to conditions', () => {
    expect(weatherLabel(0).label).toBe('Sunny');
    expect(weatherLabel(2).label).toBe('Partly cloudy');
    expect(weatherLabel(3).label).toBe('Cloudy');
    expect(weatherLabel(45).label).toBe('Foggy');
    expect(weatherLabel(53).label).toBe('Drizzly');
    expect(weatherLabel(63).label).toBe('Rainy');
    expect(weatherLabel(81).label).toBe('Rainy');
    expect(weatherLabel(73).label).toBe('Snowy');
    expect(weatherLabel(95).label).toBe('Stormy');
  });

  it('pairs every condition with an emoji and falls back gracefully', () => {
    expect(weatherLabel(0).emoji).toBe('☀️');
    expect(weatherLabel(63).emoji).toBe('🌧️');
    expect(weatherLabel(999)).toEqual({ emoji: '🌡️', label: 'Mixed' });
  });
});
