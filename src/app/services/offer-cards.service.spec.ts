import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { OfferCardsService } from './offer-cards.service';
import { DEVICE_ZONE, PartnersService } from './partners.service';
import { TripService } from './trip.service';

const OFFERS = {
  active: true,
  esim: [{ id: 'esim-a', name: 'eSIM A', offer: '$3 off', code: 'CODE3', url: 'https://example.com/a' }],
  insurance: [{ id: 'cover', name: 'Cover', offer: 'By the week', url: 'https://example.com/c' }],
};

describe('OfferCardsService', () => {
  const config = signal<any>(OFFERS);
  const trip = signal<any>({ id: 'T1', timeZone: 'Europe/Berlin', destination: 'Berlin, Germany', startDate: '2026-11-01', endDate: '2026-11-05', currency: 'EUR' });

  function make(zone = 'America/Chicago'): OfferCardsService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PartnersService, useValue: { config, ensureLoaded: () => Promise.resolve() } },
        { provide: TripService, useValue: { activeTrip: trip } },
        { provide: DEVICE_ZONE, useValue: zone },
      ],
    });
    const s = TestBed.inject(OfferCardsService);
    TestBed.flushEffects();
    return s;
  }
  const titles = (s: OfferCardsService) => s.cards().map(c => c.title);

  beforeEach(() => config.set(OFFERS));

  it('offers both cards when the trip is abroad for this phone, naming the country', () => {
    const s = make();
    expect(titles(s)).toEqual(['Need data abroad?', 'Medical cover abroad?']);
    expect(s.cards()[0].subline).toContain('Germany');
    // The insurance offer is travel medical cover, not trip cancellation (#575)
    expect(s.cards()[1].subline).toBe('Travel medical insurance for trips abroad');
  });

  it('offers nothing when the trip is in the phone\'s own country', () => {
    expect(titles(make('Europe/Berlin'))).toEqual([]);
  });

  it('offers nothing when the offers are off, and skips a card with no partners', () => {
    config.set(null);
    expect(titles(make())).toEqual([]);
    config.set({ ...OFFERS, insurance: [] });
    expect(titles(make())).toEqual(['Need data abroad?']);
  });

  it('has no way to hide a card: the cards stay, like the other tips (#480)', () => {
    expect((make() as any).hide).toBeUndefined();
  });
});
