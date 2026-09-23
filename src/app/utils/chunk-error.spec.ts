import { isStaleChunkError } from './chunk-error';

describe('isStaleChunkError', () => {
  it('recognizes the browsers\' failed-dynamic-import messages', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-ABC.js'))).toBeTrue();
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBeTrue();
    expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBeTrue();
    expect(isStaleChunkError(new Error("Expected a JavaScript module script but the server responded with a MIME type of \"text/html\""))).toBeTrue();
    expect(isStaleChunkError(new Error('Loading chunk 123 failed.'))).toBeTrue();
  });

  it('ignores unrelated navigation errors', () => {
    expect(isStaleChunkError(new Error('Missing or insufficient permissions.'))).toBeFalse();
    expect(isStaleChunkError(new Error('No active trip selected.'))).toBeFalse();
    expect(isStaleChunkError(undefined)).toBeFalse();
    expect(isStaleChunkError('plain string')).toBeFalse();
  });
});
