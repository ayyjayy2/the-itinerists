/**
 * Cloud Storage security-rules test suite for outfit photos.
 *
 * Runs against the local Storage emulator — no production impact.
 * Run with:  npm run test:rules   (requires a JDK for the emulator)
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-tripplanner',
  storage: { rules: readFileSync('storage.rules', 'utf8') },
});

const alice = testEnv.authenticatedContext('alice').storage();
const bob   = testEnv.authenticatedContext('bob').storage();
const anon  = testEnv.unauthenticatedContext().storage();

const jpeg = (kb) => new Uint8Array(kb * 1024);
const JPEG = { contentType: 'image/jpeg' };
const ALICE_PHOTO = 'outfitPhotos/alice/tripT/2026-10-01_alice_abc.jpg';
const ALICE_THUMB = 'outfitPhotos/alice/tripT/2026-10-01_alice_abc_thumb.jpg';

let failures = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ✓', name); }
  catch (err) { failures++; console.log('  ✗', name, '\n     ', err.message?.split('\n')[0]); }
}

console.log('storage.rules — outfit photos');
await testEnv.clearStorage();

await t('owner can upload a JPEG under her own uid', () =>
  assertSucceeds(uploadBytes(ref(alice, ALICE_PHOTO), jpeg(200), JPEG)));
await t('owner can upload the thumbnail too', () =>
  assertSucceeds(uploadBytes(ref(alice, ALICE_THUMB), jpeg(20), JPEG)));
await t('owner can read her own photo back', () =>
  assertSucceeds(getBytes(ref(alice, ALICE_PHOTO))));
await t('another member cannot read it', () =>
  assertFails(getBytes(ref(bob, ALICE_PHOTO))));
await t('another member cannot overwrite it', () =>
  assertFails(uploadBytes(ref(bob, ALICE_PHOTO), jpeg(1), JPEG)));
await t('another member cannot delete it', () =>
  assertFails(deleteObject(ref(bob, ALICE_PHOTO))));
await t('logged-out user cannot read it', () =>
  assertFails(getBytes(ref(anon, ALICE_PHOTO))));
await t('nobody can write under someone else\'s uid', () =>
  assertFails(uploadBytes(ref(bob, 'outfitPhotos/alice/tripT/other.jpg'), jpeg(1), JPEG)));
await t('only JPEGs are accepted', () =>
  assertFails(uploadBytes(ref(alice, 'outfitPhotos/alice/tripT/x.png'), jpeg(1), { contentType: 'image/png' })));
await t('files over 4 MB are rejected', () =>
  assertFails(uploadBytes(ref(alice, 'outfitPhotos/alice/tripT/big.jpg'), jpeg(4097), JPEG)));
await t('paths outside outfitPhotos are closed even to signed-in users', () =>
  assertFails(uploadBytes(ref(alice, 'misc/alice/anything.jpg'), jpeg(1), JPEG)));
await t('owner can delete her own photo', () =>
  assertSucceeds(deleteObject(ref(alice, ALICE_PHOTO))));

await testEnv.cleanup();
console.log(failures ? `\n${failures} storage rule test(s) FAILED` : '\nAll storage rule tests passed');
process.exit(failures ? 1 : 0);
