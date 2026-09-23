/**
 * The app runs without a service worker, so an open tab keeps the version it
 * loaded. Every deploy renames the lazy page chunks; a stale tab navigating to
 * a page it hasn't loaded yet asks for a chunk that's gone, hosting answers
 * with the app's HTML instead, and the browser rejects the import. These are
 * the messages the major browsers use for that failure.
 */
const STALE_CHUNK_PATTERNS = [
  /dynamically imported module/i,      // Chrome / Firefox
  /Importing a module script failed/i, // Safari
  /Expected a JavaScript module script/i, // MIME type mismatch (HTML served for a .js)
  /Loading chunk [\w-]+ failed/i,      // webpack-era wording, kept for safety
];

/** True when a navigation failed because the page's code chunk is from an old deploy. */
export function isStaleChunkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return !!message && STALE_CHUNK_PATTERNS.some(p => p.test(message));
}
