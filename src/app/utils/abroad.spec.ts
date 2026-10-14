import { countryList, countryName, foreignCountries } from './abroad';

describe('foreignCountries', () => {
  it('is empty when every stop is in the phone\'s country', () => {
    expect(foreignCountries(['America/New_York', 'America/Los_Angeles'], 'America/Chicago')).toEqual([]);
  });
  it('lists the other countries in stop order, once each', () => {
    expect(foreignCountries(['Europe/Berlin', 'Europe/Prague', 'Europe/Berlin'], 'America/Chicago')).toEqual(['DE', 'CZ']);
  });
  it('treats US territories as the US, both ways', () => {
    expect(foreignCountries(['America/Puerto_Rico', 'America/St_Thomas'], 'America/Chicago')).toEqual([]);
    expect(foreignCountries(['America/Chicago'], 'America/Puerto_Rico')).toEqual([]);
    expect(foreignCountries(['Pacific/Guam'], 'America/New_York')).toEqual([]);
  });
  it('counts a trip from a territory to another country as abroad', () => {
    expect(foreignCountries(['Europe/Lisbon'], 'America/Puerto_Rico')).toEqual(['PT']);
  });
  it('skips stops with no or unknown zones, and needs a known phone zone', () => {
    expect(foreignCountries([undefined, '', 'Not/AZone', 'Asia/Bangkok'], 'Europe/London')).toEqual(['TH']);
    expect(foreignCountries(['Asia/Bangkok'], 'UTC')).toEqual([]);
  });
});

describe('countryName and countryList', () => {
  it('names a country, falling back to its code', () => {
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('ZZ')).toBe('ZZ');
  });
  it('joins one, two, or more names', () => {
    expect(countryList(['Thailand'])).toBe('Thailand');
    expect(countryList(['Germany', 'Czechia'])).toBe('Germany & Czechia');
    expect(countryList(['Germany', 'Czechia', 'Austria'])).toBe('Germany, Czechia + 1 more');
    expect(countryList(['Germany', 'Czechia', 'Austria', 'Italy'])).toBe('Germany, Czechia + 2 more');
  });
});
