import { outfitPhotoIds, legacyPhotoId, newOutfitPhotoId, MAX_OUTFIT_PHOTOS } from './outfit-photos';

describe('outfitPhotoIds', () => {
  it('returns the stored list of photo ids when present', () => {
    expect(outfitPhotoIds({ photoIds: ['a', 'b'] }, '2026-11-13', 'u1')).toEqual(['a', 'b']);
  });

  it('reads a legacy single photo as a one-item list', () => {
    expect(outfitPhotoIds({ photoUrl: 'stored' }, '2026-11-13', 'u1')).toEqual(['2026-11-13_u1']);
    expect(legacyPhotoId('2026-11-13', 'u1')).toBe('2026-11-13_u1');
  });

  it('is empty with neither', () => {
    expect(outfitPhotoIds({}, '2026-11-13', 'u1')).toEqual([]);
    expect(outfitPhotoIds({ photoIds: [] , photoUrl: 'stored' }, '2026-11-13', 'u1')).toEqual([]);
  });
});

describe('newOutfitPhotoId', () => {
  it('is unique per call and carries the day and owner so rules can scope it', () => {
    const a = newOutfitPhotoId('2026-11-13', 'u1');
    const b = newOutfitPhotoId('2026-11-13', 'u1');
    expect(a).not.toBe(b);
    expect(a.startsWith('2026-11-13_u1_')).toBeTrue();
    expect(a).toMatch(/^[\w-]+$/);
  });
});

describe('MAX_OUTFIT_PHOTOS', () => {
  it('is two per person per day', () => {
    expect(MAX_OUTFIT_PHOTOS).toBe(2);
  });
});
