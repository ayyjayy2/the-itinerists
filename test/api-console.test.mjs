/** Unit tests for the API console's helpers. Run: npm run test:console */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityQuery } from '../public/api-console/normalize.mjs';

test('cityQuery turns a zone name or underscores into a city a place search understands', () => {
  assert.equal(cityQuery('port moresby'), 'port moresby');
  assert.equal(cityQuery('Port_Moresby'), 'Port Moresby');
  assert.equal(cityQuery('Pacific/Port_Moresby'), 'Port Moresby');
  assert.equal(cityQuery('America/Argentina/Buenos_Aires'), 'Buenos Aires');
  assert.equal(cityQuery('  Berlin  '), 'Berlin');
  assert.equal(cityQuery('New__York'), 'New York');
  assert.equal(cityQuery(''), '');
});
