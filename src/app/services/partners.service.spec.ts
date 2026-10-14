import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { PartnersService, cleanPartners } from './partners.service';

describe('cleanPartners', () => {
  const ok = { id: 'airalo', name: 'Airalo', offer: '$3 off', code: 'X1', url: 'https://example.com/a' };

  it('keeps well-formed offers and drops broken ones', () => {
    const c = cleanPartners({ active: true, esim: [ok, { ...ok, id: 'Bad Id' }, { ...ok, url: 'javascript:alert(1)' }, { ...ok, url: 'http://example.com' }], insurance: [] });
    expect(c!.esim.map(p => p.id)).toEqual(['airalo']);
  });

  it('keeps an offer without a code', () => {
    const { code, ...noCode } = ok;
    expect(cleanPartners({ active: true, esim: [], insurance: [noCode] })!.insurance).toEqual([noCode]);
  });

  it('is null when switched off or missing', () => {
    expect(cleanPartners({ active: false, esim: [ok], insurance: [] })).toBeNull();
    expect(cleanPartners(null)).toBeNull();
  });
});

describe('PartnersService', () => {
  let service: PartnersService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: Firestore, useValue: {} }] });
    service = TestBed.inject(PartnersService);
  });

  it('reads the offers once, however often they are asked for', async () => {
    const load = spyOn<any>(service, 'load').and.resolveTo({ active: true, esim: [], insurance: [] });
    await service.ensureLoaded();
    await service.ensureLoaded();
    expect(load).toHaveBeenCalledTimes(1);
    expect(service.config()).toEqual({ active: true, esim: [], insurance: [] });
  });

  it('shows no offers when reading fails', async () => {
    spyOn<any>(service, 'load').and.rejectWith(new Error('offline'));
    await service.ensureLoaded();
    expect(service.config()).toBeNull();
  });
});
