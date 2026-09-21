# Portfolio demo mode — design

**Date:** 2026-09-20
**Goal:** Let the portfolio site embed a working, sign-in-free copy of The Itinerists in a phone frame, seeded with a mock trip, where anything a visitor changes lives only for that page session.

## Why the live app can't be embedded today

1. Firebase Hosting sends `X-Frame-Options: DENY` for the production site, so browsers refuse to render it inside any iframe.
2. Every page sits behind `authGuard`, which needs a Firebase Auth session. Third-party iframes frequently block the storage Firebase Auth persists to, so sign-in fails or doesn't stick.

## Approach: a separate demo build with the Firebase modules swapped out

The app talks to Firebase through five `@angular/fire/*` entry points. A new `demo` build configuration uses a `tsconfig.demo.json` whose `paths` map each of those module specifiers to a local stand-in under `src/demo/`. Every service, guard and page compiles unchanged; only the module they import is different.

- `@angular/fire/firestore` → `src/demo/fire-firestore.ts`: `Firestore` token, `collection`, `doc`, `onSnapshot`, `getDoc`, `getDocs`, `setDoc` (with deep `merge`), `updateDoc` (rejects on a missing doc, like Firestore), `deleteDoc`, `addDoc`, `writeBatch`, `query`, `where`, `increment`, `arrayUnion`, `arrayRemove`, `Unsubscribe`, plus no-op `initializeFirestore`, `persistentLocalCache`, `persistentMultipleTabManager`, `provideFirestore`. All backed by `MemoryStore` (`src/demo/memory-store.ts`): a path-keyed map with document and collection listeners that emit asynchronously, the way the real SDK does.
- `@angular/fire/auth` → `src/demo/fire-auth.ts`: an `Auth` that starts signed in as the demo traveller. `signOut` signs out; `signInWithEmailAndPassword` signs back in as the demo traveller regardless of input; `createUserWithEmailAndPassword` mints a throwaway uid so the self-serve signup flow works in memory; password and email helpers resolve without doing anything.
- `@angular/fire/app`, `@angular/fire/storage`, `@angular/fire/app-check` → inert stubs.

Alternatives rejected: keeping the real SDK with its network disabled (write promises never resolve, so every awaited save hangs); refactoring all services onto a data-access interface (2,600 lines of production code touched for a demo).

## Session-only data

- `src/main.demo.ts` is the demo entry point. Before bootstrapping it clears every `tripplanner_*` and `tripmap_*` key in localStorage, then seeds `MemoryStore` with the mock trip. A reload therefore always starts fresh; nothing a visitor enters survives the tab.
- The production entry point, `src/main.ts`, is untouched.

## Mock trip

A fictional week in Chiang Mai, Thailand, 12–19 November 2026, currency THB. Four members: Alayna (owner, the signed-in demo user) and three invented friends, Maya, Theo and Jo. Seeded collections: `users`, `userTrips`, `trips/{id}` with `members`, `itinerary`, `flights`, `stays`, `finance`, `recs`, `cars`, `pins`, `packing`, `packingSuggestions`, `dayLabels`, `activityLog`, and `userExpenses`. Trip id is the constant `demo-chiang-mai`. No real person other than Alayna appears.

## In-app signal

A `DEMO` flag (`src/app/demo-flag.ts`, replaced by `demo-flag.demo.ts` via `fileReplacements`) drives a slim banner in the app shell: "Demo · a sample trip, no sign-in. Changes live only in this tab."

## Hosting

`firebase.json` gains a second hosting entry for site `the-itinerists-demo` serving `dist/the-itinerists-demo/browser`. Its headers drop `X-Frame-Options` and add `frame-ancestors 'self' https://alaynajohnston.netlify.app https://*.netlify.app http://localhost:*` to the CSP. `connect-src` lists only the public APIs the app calls (Open-Meteo, Nominatim, Frankfurter). The production site's config is unchanged.

Scripts: `build:demo` (`ng build --configuration demo`), `start:demo` (`ng serve --configuration demo`), `deploy:demo` (build then `firebase deploy --only hosting:the-itinerists-demo`).

## Portfolio side

The phone frame points at `https://the-itinerists-demo.web.app/home` and loads as soon as it scrolls into view, since there is nothing to sign in to. "Reset the phone" reloads the frame, which wipes the session.

## Testing

- `src/demo/memory-store.spec.ts` covers set/merge/update/delete, auto ids, `increment`/`arrayUnion`/`arrayRemove`, `where` filtering, batch commit, and that document and collection listeners fire for the right paths.
- `src/demo/seed.spec.ts` checks the seeded trip is internally consistent (members match `memberCount`, the index points at the trip, every sub-collection has at least one row).
- Manual: `npm run start:demo`, walk Home → Itinerary → Finance → Packing, add and edit rows, reload, confirm the edits are gone.

## Out of scope

Outfit photo upload works (it stores a data URL in memory) but is not seeded. The admin page is unreachable because the demo user is not an admin.
