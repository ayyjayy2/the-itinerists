/**
 * Trims all string properties in an object and removes empty strings from
 * string arrays. Applied at every Firestore write boundary so components
 * don't need to remember to do it individually.
 *
 * - String fields: leading/trailing whitespace stripped
 * - String array fields: each element trimmed; blank elements removed
 * - All other field types: passed through unchanged
 */
export function sanitizeStrings<T extends object>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === 'string') {
      result[key] = val.trim();
    } else if (Array.isArray(val) && val.every(v => typeof v === 'string')) {
      result[key] = (val as string[]).map(v => v.trim()).filter(v => v.length > 0);
    }
  }
  return result as T;
}
