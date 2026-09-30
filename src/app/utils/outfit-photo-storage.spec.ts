import { outfitPhotoPaths, photoSource, PHOTO_MAX_PX, THUMB_MAX_PX } from './outfit-photo-storage';

describe('outfitPhotoPaths', () => {
  it('puts both files under the owner, then the trip, so rules can gate on the uid segment', () => {
    const p = outfitPhotoPaths('uidA', 'tripX', '2026-10-01_uidA_abc123');
    expect(p.path).toBe('outfitPhotos/uidA/tripX/2026-10-01_uidA_abc123.jpg');
    expect(p.thumbPath).toBe('outfitPhotos/uidA/tripX/2026-10-01_uidA_abc123_thumb.jpg');
  });

  it('uses the agreed sizes: 1600 px full, 300 px thumbnail', () => {
    expect(PHOTO_MAX_PX).toBe(1600);
    expect(THUMB_MAX_PX).toBe(300);
  });
});

describe('photoSource', () => {
  it('reads a legacy doc that still carries the inline data URL', () => {
    expect(photoSource({ ownerUid: 'u', date: '2026-10-01', dataUrl: 'data:image/jpeg;base64,AAA' }))
      .toEqual({ kind: 'inline', dataUrl: 'data:image/jpeg;base64,AAA' });
  });

  it('reads a Cloud Storage doc by its object paths', () => {
    expect(photoSource({ ownerUid: 'u', date: '2026-10-01', path: 'outfitPhotos/u/t/x.jpg', thumbPath: 'outfitPhotos/u/t/x_thumb.jpg' }))
      .toEqual({ kind: 'storage', path: 'outfitPhotos/u/t/x.jpg', thumbPath: 'outfitPhotos/u/t/x_thumb.jpg' });
  });

  it('prefers the storage copy when a migrated doc still has both', () => {
    const src = photoSource({ ownerUid: 'u', date: 'd', dataUrl: 'data:x', path: 'p.jpg', thumbPath: 'p_thumb.jpg' });
    expect(src?.kind).toBe('storage');
  });

  it('returns null for a doc with neither', () => {
    expect(photoSource({ ownerUid: 'u', date: 'd' })).toBeNull();
    expect(photoSource(undefined)).toBeNull();
  });
});
