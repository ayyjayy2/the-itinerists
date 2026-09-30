#!/usr/bin/env node
/**
 * One-time move of outfit photos from inline Firestore data URLs to Cloud
 * Storage (1600 px JPEG + 300 px thumbnail), the format the app writes since
 * the outfit-photos-storage change. Reads every `outfitPhotos` doc that still
 * has `dataUrl`, uploads both sizes under `outfitPhotos/{ownerUid}/{tripId}/`,
 * then rewrites the doc with `path` / `thumbPath` and drops `dataUrl`.
 *
 *   node scripts/migrate-outfit-photos.js            # dry run: lists what would move
 *   node scripts/migrate-outfit-photos.js --run      # do it
 *   node scripts/migrate-outfit-photos.js --run --trip <tripId>   # one trip only
 *
 * Safe to re-run: docs already moved are skipped. The app keeps reading inline
 * docs, so nothing breaks if this is interrupted. It refuses to run before
 * 2026-10-10 (the Berlin trip is live until 2026-10-09) unless --force.
 */
const admin = require('firebase-admin');
const sharp = require('sharp');
const serviceAccount = require('./serviceAccountKey.json');

const RUN   = process.argv.includes('--run');
const FORCE = process.argv.includes('--force');
const tripArg = process.argv.indexOf('--trip');
const ONLY_TRIP = tripArg > -1 ? process.argv[tripArg + 1] : null;

if (serviceAccount.project_id !== 'trip-planner-ayyjayy2') {
  console.error(`Refusing: service account is for ${serviceAccount.project_id}`); process.exit(1);
}
if (RUN && !FORCE && new Date() < new Date('2026-10-10T00:00:00-04:00')) {
  console.error('Refusing to run before 2026-10-10: the Berlin trip is still live. Use --force to override.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'trip-planner-ayyjayy2.firebasestorage.app',
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

async function resize(buffer, maxPx) {
  const out = await sharp(buffer).rotate()
    .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
  return out;
}

(async () => {
  const snap = await db.collectionGroup('outfitPhotos').get();
  const pending = snap.docs.filter(d => typeof d.data().dataUrl === 'string' && !d.data().path)
    .filter(d => !ONLY_TRIP || d.ref.parent.parent.id === ONLY_TRIP);
  console.log(`${snap.size} outfit photo docs, ${pending.length} still inline${ONLY_TRIP ? ` in trip ${ONLY_TRIP}` : ''}. ${RUN ? 'Migrating.' : 'Dry run.'}`);

  let moved = 0, failed = 0;
  for (const d of pending) {
    const data   = d.data();
    const tripId = d.ref.parent.parent.id;
    const uid    = data.ownerUid;
    const base   = `outfitPhotos/${uid}/${tripId}/${d.id}`;
    const inlineKb = Math.round(data.dataUrl.length * 0.75 / 1024);
    if (!uid) { console.log(`  skip ${tripId}/${d.id}: no ownerUid`); failed++; continue; }
    if (!RUN) { console.log(`  would move ${tripId}/${d.id} (${inlineKb} KB inline) -> ${base}.jpg`); continue; }
    try {
      const buffer = Buffer.from(data.dataUrl.split(',')[1], 'base64');
      const full   = await resize(buffer, 1600);
      const thumb  = await resize(full.data, 300);
      const meta   = { contentType: 'image/jpeg', resumable: false };
      await bucket.file(`${base}.jpg`).save(full.data, meta);
      await bucket.file(`${base}_thumb.jpg`).save(thumb.data, meta);
      await d.ref.update({
        path: `${base}.jpg`, thumbPath: `${base}_thumb.jpg`,
        width: full.info.width, height: full.info.height,
        dataUrl: admin.firestore.FieldValue.delete(),
      });
      moved++;
      console.log(`  moved ${tripId}/${d.id}: ${inlineKb} KB inline -> ${Math.round(full.info.size / 1024)} KB + ${Math.round(thumb.info.size / 1024)} KB`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${tripId}/${d.id}:`, err.message);
    }
  }
  console.log(RUN ? `Done: ${moved} moved, ${failed} failed.` : 'Dry run complete; nothing changed.');
  process.exit(failed ? 1 : 0);
})();
