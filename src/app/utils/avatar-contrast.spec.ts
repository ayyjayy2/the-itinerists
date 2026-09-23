import {
  contrastRatio, readableLetterColors, pickLetterColor, colorDistance,
  LETTER_COLORS, BACKGROUND_COLORS, MIN_CONTRAST,
} from './avatar-contrast';

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#88C9A1', '#88C9A1')).toBeCloseTo(1, 5);
  });

  it('is symmetric and accepts 3-digit hex', () => {
    expect(contrastRatio('#F4C2C2', '#3A3A3A')).toBeCloseTo(contrastRatio('#3A3A3A', '#F4C2C2'), 5);
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 0);
  });
});

describe('readableLetterColors', () => {
  it('keeps charcoal and drops white on a pastel background', () => {
    const ok = readableLetterColors('#F4C2C2');
    expect(ok).toContain('#3A3A3A');
    expect(ok).not.toContain('#FFFFFF');
  });

  it('only returns colors that meet the minimum ratio', () => {
    for (const bg of ['#F4C2C2', '#88C9A1', '#D4B5F5', '#F9E4B7', '#F5B5D4', '#B5D5F5', '#F5D4B5', '#B5F5D4']) {
      for (const c of readableLetterColors(bg)) {
        expect(contrastRatio(c, bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it('every palette background has at least one readable letter color', () => {
    for (const bg of ['#F4C2C2', '#88C9A1', '#D4B5F5', '#F9E4B7', '#F5B5D4', '#B5D5F5', '#F5D4B5', '#B5F5D4']) {
      expect(readableLetterColors(bg).length).toBeGreaterThan(0);
    }
  });
});

describe('pickLetterColor', () => {
  it('keeps the preferred color when it is readable on the background', () => {
    expect(pickLetterColor('#F4C2C2', '#3A3A3A')).toBe('#3A3A3A');
  });

  it('swaps to the highest-contrast option when the preferred color is unreadable', () => {
    const picked = pickLetterColor('#F4C2C2', '#FFFFFF');
    expect(picked).not.toBe('#FFFFFF');
    expect(contrastRatio(picked, '#F4C2C2')).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it('falls back to the highest-contrast option when nothing is preferred', () => {
    const picked = pickLetterColor('#88C9A1', '');
    expect(LETTER_COLORS).toContain(picked);
    expect(contrastRatio(picked, '#88C9A1')).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});

// ── Palette distinctness ─────────────────────────────────────────────────────

function minPairwise(colors: readonly string[]): number {
  let min = Infinity;
  for (let i = 0; i < colors.length; i++)
    for (let j = i + 1; j < colors.length; j++)
      min = Math.min(min, colorDistance(colors[i], colors[j]));
  return min;
}

describe('colorDistance', () => {
  it('is 0 for identical colors and large for black vs white', () => {
    expect(colorDistance('#88C9A1', '#88C9A1')).toBe(0);
    expect(colorDistance('#000000', '#FFFFFF')).toBeGreaterThan(90);
  });
});

describe('palettes', () => {
  it('offers at least a dozen background colors, each clearly different from the others', () => {
    expect(BACKGROUND_COLORS.length).toBeGreaterThanOrEqual(12);
    expect(minPairwise(BACKGROUND_COLORS)).toBeGreaterThanOrEqual(15);
  });

  it('offers at least a dozen letter colors, each clearly different from the others', () => {
    expect(LETTER_COLORS.length).toBeGreaterThanOrEqual(12);
    expect(minPairwise(LETTER_COLORS)).toBeGreaterThanOrEqual(20);
  });

  it('every background color is light enough for a dark letter to read on it', () => {
    for (const bg of BACKGROUND_COLORS) {
      expect(contrastRatio('#3A3A3A', bg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});
