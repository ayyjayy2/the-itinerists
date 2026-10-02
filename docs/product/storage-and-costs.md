<!-- Generated mirror of the "Launch plan · Storage & costs" page in Itinerists HQ (https://claude.ai/artifact/4KXwSQgFrugzPq9ZfocA9d#plan-costs, private).
     The HQ page is the source of truth: change it there, then regenerate this file.
     Synced 2026-10-02. People's names are deliberately left out (see docs/README.md). -->

# Storage & costs

_Firebase prices as of **Sep 2026** · estimates, not quotes_

There is no storage tier to pick. Firebase's paid plan keeps the same free allowance as today and charges only for use above it, per gigabyte and per operation. What phase 1 changes is **where** data lives, so the bill stays small as the numbers grow.

- $0 — – $1 Beta 20 people · a few trips

- $1 — – $3 1,000 users per month

- $20 — – $30 10,000 users per month

- $99 — / yr Apple plus the domain: $23.38 for 2 years, bought

## Where data lives after phase 1

| Data | Where | Why there | Rules |
|---|---|---|---|
| Accounts, trips, itineraries, expenses, lists | Firestore | Small documents, live sync, already built and tested | Members of the trip; private docs self-only |
| Outfit photos — today: inside Firestore documents | Cloud Storage — trips/{trip}/outfits/{user}/{photo}.jpg | Built for files: 7× cheaper per GB, no 1 MB document ceiling, served straight to the phone | Owner-only read and write |
| Photo sizes | Resized on the phone before upload | A 1,600 px JPEG at quality 0.8 is ~200 KB, plus a 300 px thumbnail for lists; today's photos average 480 KB | — |
| Backups — phase 5 | Point-in-time recovery (7 days) + weekly export to a bucket | Undo for a bad migration or a mistaken delete | Admin only |
| Staging | A second Firebase project, free plan | Our own testing stops touching real people's data | Same rules file, deployed to both |

## What Firebase charges above the free allowance

| Service | Free every day / month | Then | What drives it here |
|---|---|---|---|
| Firestore reads | 50,000 / day | $0.06 per 100,000 | Every page load reads a few dozen documents; live listeners re-read on change |
| Firestore writes | 20,000 / day | $0.18 per 100,000 | Each edit, expense, packing tick |
| Firestore storage | 1 GiB | $0.18 per GiB / month | Small once photos move out: today's non-photo data is under 100 KB |
| Cloud Storage | 5 GB stored · 1 GB / day downloaded | $0.026 per GB / month · $0.12 per GB downloaded | Photos. Thumbnails keep downloads small |
| Hosting | 10 GB stored · 360 MB / day served | $0.15 per GB served | The web app and the demo; the native app ships its own copy |
| Authentication | Unlimited | $0 | Email and password only |
| Cloud Functions — if used, phase 4–5 | 2 million calls / month | $0.40 per million + compute | Server-side sign-up or join, if we go that way |
| App Check, Crashlytics | Unlimited | $0 | — |

## Worked estimates

### Beta · ~20 people, 5 trips

A few thousand reads a day, a few hundred photos at most. Everything stays inside the free allowance. **$0 – $1 / month.** The only fixed cost is Apple's $99 a year.

### 1,000 users · ~20 sessions each per month

- Reads: ~2 million / month, ~65,000 / day → about 0.5 million billable → **$0.30**
- Writes: ~100,000 / month → inside the free allowance
- Photos: 20 each at 200 KB → 4 GB → inside the free 5 GB; downloads with thumbnails stay near the free line
- Hosting: mostly cached after first load → ~$0

**About $1 – $3 / month.**

### 10,000 users

- Reads: ~20 million / month → **~$11**
- Writes: ~1 million / month → **~$1**
- Photos: 40 GB stored → **~$1**; ~60 GB downloaded → **~$4**
- Hosting and functions → **a few dollars**

**About $20 – $30 / month**, and a budget alert at $25 would tell you before it matters.

### What would change these numbers

- **Photos left in Firestore**: at 10,000 users that's ~$7 storage plus reads carrying 480 KB each — the main reason to move them now.
- **Listeners**: each open page keeps live listeners; if usage skews to long sessions, reads rise. Pagination in phase 5 caps the worst case.
- **Push notifications** (later) add Cloud Functions calls, still cents per thousand.

### Setting up the plan

- Firebase console → project settings → Usage and billing → Modify plan → Blaze. Attach a card; nothing is charged until an allowance is exceeded.
- Same screen → Budget: set an alert at $10, and a second at $25. Alerts email you; they do not stop the app.
- The three older projects (Ireland, Savannah, California) stay on the free plan and never need a card.
