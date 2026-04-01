# Project Commands & Shortcuts

## "Update seed data" / "Sync seed data" / "Sync from Firestore"
Runs the sync script that pulls live Firestore data and overwrites seed-data.ts:
```bash
npm run sync-seed
```
Also prints a Dad ↔ Alayna debug summary to the console.
Service account key lives at: `scripts/serviceAccountKey.json` (gitignored)

## Generate environment files (first-time setup, or after .env changes)
```bash
npm run gen-env
```
Reads `.env` and writes `src/environments/environment.ts` + `environment.prod.ts` (both gitignored).
Copy `.env.example` → `.env` and fill in real values first.


## Start dev server
```bash
npm start
```

## Build & deploy
```bash
npm run build
firebase deploy
```
