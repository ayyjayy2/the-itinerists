/**
 * Avatar palettes plus the color math behind them: WCAG contrast (so a letter
 * gets a readable default) and CIE76 ΔE (so palette entries stay distinct).
 */

/** Avatar background colors: soft tints, all light enough for a dark letter. */
export const BACKGROUND_COLORS: readonly string[] = [
  '#F4C2C2', // pink
  '#88C9A1', // sage
  '#D4B5F5', // lavender
  '#F9E4B7', // cream
  '#F5B5D4', // blush
  '#B5D5F5', // sky
  '#B5F5D4', // mint
  '#C5E384', // spring
  '#FDBA74', // tangerine
  '#F4D06F', // honey
  '#9EDCD8', // aqua
  '#F2A59B', // coral
];

/** Letter colors: a neutral pair plus deep tones that read on the tints above. */
export const LETTER_COLORS: readonly string[] = [
  '#3A3A3A', // charcoal
  '#FFFFFF', // white
  '#6A8F5E', // sage
  '#7E6FA8', // lavender
  '#B97F35', // gold
  '#B5485D', // rose
  '#2F4A6D', // navy
  '#2E7D6B', // teal
  '#A0338A', // magenta
  '#4B2E83', // plum
  '#7A4E2D', // cocoa
  '#B4552D', // rust
];

/** WCAG AA for large / bold text. Avatar letters are big and heavy, so 3:1 applies. */
export const MIN_CONTRAST = 3;

/** #rgb or #rrggbb → linear-light sRGB channels in 0..1. */
function linearRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

/** Relative luminance per WCAG 2.x. */
function luminance(hex: string): number {
  const [r, g, b] = linearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** CIE L*a*b* (D65) for perceptual distance. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = linearRgb(hex);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y =  r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Perceptual distance (CIE76 ΔE) between two hex colors. Roughly: under 2 is
 * indistinguishable, 10+ is clearly different, 20+ reads as a different color.
 */
export function colorDistance(a: string, b: string): number {
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The palette colors that read clearly on `background`. */
export function readableLetterColors(background: string): string[] {
  return LETTER_COLORS.filter(c => contrastRatio(c, background) >= MIN_CONTRAST);
}

/**
 * `preferred` if it reads on `background`, else the palette color with the
 * highest contrast — used only as a starting point the first time a letter is picked.
 */
export function pickLetterColor(background: string, preferred: string | undefined): string {
  if (preferred && contrastRatio(preferred, background) >= MIN_CONTRAST) return preferred;
  return [...LETTER_COLORS].sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0];
}
