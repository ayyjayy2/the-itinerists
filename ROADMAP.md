# Troupe — Implementation Roadmap
> Concrete engineering tasks, sequenced by dependency and impact.
> Cross-reference VISION.md for rationale. Update status as work progresses.

---

## Status Key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Phase 1 — Multi-Trip Architecture (Weeks 1–6)
*Everything else is blocked until this is done.*

### 1.1 Data Model & Services

- [ ] Add `TripDoc`, `TripMember`, `UserTripsDoc` interfaces to `trip.models.ts`
- [ ] Create `trip-context.service.ts` (replaces `trip-config.service.ts`)
  - Holds `activeTripId` signal, persists to localStorage
  - All other services read `activeTripId` from here
- [ ] Create `trip.service.ts`
  - `createTrip(details)` → writes `/trips/{id}`, `/trips/{id}/members/{uid}`, `/userTrips/{uid}`
  - `getUserTrips(uid)` → reads `/userTrips/{uid}`, fetches trip docs
  - `joinTrip(code)` → validates invite, adds user to members
  - `switchTrip(tripId)` → updates `TripContextService`
  - `archiveTrip(tripId)` → sets `archived: true` on trip doc
- [ ] Rewrite `data.service.ts` to use `trips/{tripId}/` sub-collections
  - Itinerary → `trips/{tripId}/itinerary/{itemId}`
  - Finance → `trips/{tripId}/finance/{entryId}`
  - Stays → `trips/{tripId}/stays/{stayId}`
  - Recs → `trips/{tripId}/recs/{recId}`
  - Cars → `trips/{tripId}/cars/{carId}`
  - Pins → `trips/{tripId}/pins/{pinId}`
  - Settlements → `trips/{tripId}/settlements/{key}`
- [ ] Move `flights.service.ts` to `trips/{tripId}/flights/{flightId}`
- [ ] Move `stays.service.ts` to `trips/{tripId}/stays/{stayId}`
- [ ] Move `itinerary.service.ts` to `trips/{tripId}/itinerary/{itemId}`
- [ ] Move `finance.service.ts` to `trips/{tripId}/finance/{entryId}`
- [ ] Move `recs.service.ts` to `trips/{tripId}/recs/{recId}`
- [ ] Move `packing.service.ts` to `trips/{tripId}/packing/{uid}` (now syncs across devices!)
- [ ] Update `outfits.service.ts` to `trips/{tripId}/outfits/{userId_date}`
- [ ] Update Firestore security rules for all new sub-collection paths
- [ ] Remove `seed-data.ts` dependency from DataService (replaced by trip creation flow)

### 1.2 Migration Script
- [ ] Write one-time migration: reads `app/tripData` → creates `trips/{uuid}` sub-collections
- [ ] Create `/userTrips/{uid}` entries for all existing users
- [ ] Mark `app/tripData` with `migrated: true` after successful migration
- [ ] Delete `app/tripData` and `app/tripConfig` after 30-day sunset

### 1.3 Auth Updates
- [ ] Move invite codes from global `invites/{code}` to `trips/{tripId}/invites/{code}`
- [ ] Update `auth.service.ts` `register()` to accept `tripId` and join trip on registration
- [ ] Update `join.component.ts` to pass tripId through the join flow

### 1.4 Trip Management UI
- [ ] New route `/trips` — "My Trips" list screen
  - Shows each trip as a card: name, destination, dates, member avatars
  - "Active" badge on current trip
  - "+ New Trip" button
- [ ] New route `/trips/new` — trip creation form
  - Trip name (e.g., "Bali 2026")
  - Destination (freeform text + optional city autocomplete)
  - Start date / End date
  - Primary currency selector
  - Optional cover photo upload
- [ ] Update home screen
  - Show active trip name + location prominently
  - "Switch Trip" button → goes to `/trips`
  - Countdown uses TripContextService instead of hardcoded dates
- [ ] Trip settings (accessible from admin panel)
  - Edit trip name, dates, destination, currency, cover photo
  - Archive trip
  - Transfer ownership

---

## Phase 2 — UX Polish & Billing (Weeks 7–10)

### 2.1 Mobile Navigation
- [ ] Replace home-screen grid with bottom tab bar (iOS/Android native feel)
  - Tab 1: Home (trip dashboard, countdown)
  - Tab 2: Itinerary
  - Tab 3: Finance
  - Tab 4: More (Flights, Stays, Packing, Outfits, Map, Recs, Profile)
- [ ] Pull-to-refresh on main data screens
- [ ] Swipe between itinerary days (touch gesture)
- [ ] Floating action button (FAB) consistency across all list screens

### 2.2 Brand & Visual
- [ ] Choose final app name
- [ ] Update `package.json` name field
- [ ] New app icon (all required sizes for iOS/Android)
- [ ] Splash screen
- [ ] Update all "Savannah" hardcoded strings to use TripContextService
- [ ] Update all "savannah-getaway" references in code and configs
- [ ] Dark mode (system-aware `prefers-color-scheme`)

### 2.3 Onboarding Flow
- [ ] First-time user flow (shown once after first login):
  - Screen 1: "Welcome to [AppName]" — value prop
  - Screen 2: "Create your first trip or join one"
  - Screen 3: Quick feature tour (skip-able)
- [ ] Empty states for all screens (when trip has no itinerary, no expenses, etc.)

### 2.4 Stripe Billing Integration
- [ ] Add Stripe npm package: `@stripe/stripe-js`
- [ ] Firebase Function: `createCheckoutSession(uid, tier)` → returns Stripe checkout URL
- [ ] Firebase Function: `stripeWebhook` → handles `customer.subscription.created/updated/deleted`
  - Updates `users/{uid}.subscriptionTier` in Firestore
- [ ] `subscription.service.ts` — reads user's tier, exposes as signal
- [ ] Pro upgrade modal — shown at feature gates
  - Lists Pro benefits
  - "Upgrade for $4.99/mo" CTA → calls createCheckoutSession
- [ ] Profile screen: show current plan + "Manage Subscription" link (Stripe customer portal)
- [ ] Tier enforcement:
  - Free: block trip creation after 1 active trip
  - Free: block join after 6th member in a trip
  - Free: hide AI Builder, flight tracking, vault features

---

## Phase 3 — Differentiating Features (Weeks 11–16)

### 3.1 AI Itinerary Builder (Pro)
- [ ] Firebase Function: `generateItinerary(tripId, prompt, uid)`
  - Calls Claude API (claude-sonnet-4-6)
  - Returns structured JSON itinerary
  - Decrements `users/{uid}.aiCreditsRemaining` (20/month Pro, 0 Free)
- [ ] UI: "AI Suggest" button on Itinerary screen
  - Input: freeform prompt OR structured form (destination, days, vibe, budget, interests)
  - Shows streaming response (word by word)
  - "Import to trip" button on result → writes to `trips/{tripId}/itinerary/`
  - "Regenerate" button

### 3.2 Real-Time Flight Tracking (Pro)
- [ ] AviationStack API integration (Firebase Function: `getFlightStatus`)
- [ ] Cache flight status in Firestore with TTL (don't hammer the API)
- [ ] Flights screen: show live status badge (On Time / Delayed / Cancelled)
- [ ] Push notification on status change → see §3.4

### 3.3 Activity Voting
- [ ] New Firestore sub-collection: `trips/{tripId}/suggestions/{suggestionId}`
  - Fields: activity, proposedDate, proposedTime, proposedBy, votes: {uid: 'up'|'down'}
- [ ] UI on Itinerary screen: "Suggest an Activity" button → form
- [ ] Suggestion cards with thumbs up/down voting
- [ ] "Add to itinerary" button appears when votes >= half the group
- [ ] Admin can promote any suggestion to itinerary

### 3.4 Push Notifications (FCM)
- [ ] Install `@capacitor/push-notifications`
- [ ] Permission prompt — ask for notifications at the right moment (after first value, not on open)
- [ ] Firebase Functions triggers:
  - `onFinanceEntryCreate` → notify all trip members except `addedByUid`
  - `onItineraryItemCreate` → notify all trip members except `addedByUid`
  - `onMemberJoin` → notify trip owner
  - `onFlightStatusChange` → notify flight owner
- [ ] Notification tap → deep link into the relevant screen

### 3.5 Shared Photo Albums
- [ ] New Firestore sub-collection: `trips/{tripId}/photos/{photoId}`
  - Fields: url, uploadedBy, date, caption, dayLabel, createdAt
- [ ] New route `/photos` — day-grouped photo album grid
- [ ] Upload from camera or photo library
- [ ] Day-based grouping same as itinerary
- [ ] Full-screen viewer with caption + uploader name
- [ ] Photo count badge on "More" tab

---

## Phase 4 — Native App & Distribution (Weeks 17–20)

### 4.1 Capacitor Setup
- [ ] `npm install @capacitor/core @capacitor/cli`
- [ ] `npx cap init "Troupe" com.troupe.app`
- [ ] `npm install @capacitor/ios @capacitor/android`
- [ ] `npx cap add ios && npx cap add android`
- [ ] Configure `capacitor.config.ts` (web dir, app ID, app name)
- [ ] Install and configure Capacitor plugins:
  - `@capacitor/push-notifications`
  - `@capacitor/share`
  - `@capacitor/haptics`
  - `@capacitor/camera`
  - `@capacitor/local-notifications`
  - `@capacitor/status-bar`

### 4.2 iOS App Store Submission
- [ ] Apple Developer Program enrollment ($99/year)
- [ ] App Store Connect setup
- [ ] iOS-specific UI fixes (safe area insets, keyboard handling)
- [ ] All required icon sizes generated
- [ ] App Store screenshots (6.5" + 5.5" iPhone, optional iPad)
- [ ] App Store description + keywords (see VISION.md §7)
- [ ] Privacy Policy page (required)
- [ ] TestFlight beta with 10 real users before submission
- [ ] Submit for App Store review

### 4.3 Google Play Submission
- [ ] Google Play Developer Account ($25 one-time)
- [ ] Android-specific fixes (back button behavior, keyboard types)
- [ ] Play Store screenshots + feature graphic
- [ ] Internal testing track → closed testing → open testing → production

### 4.4 Web Share API
- [ ] Replace clipboard-only invite sharing with native share sheet
- [ ] `navigator.share({ title, text, url })` with clipboard fallback

### 4.5 PDF Export (Pro)
- [ ] Firebase Function: `exportTripPDF(tripId, uid)`
  - Generates PDF: trip overview, itinerary by day, members, expense summary
  - Returns download URL (stored temporarily in Firebase Storage)
- [ ] UI: "Export Trip" button in trip settings / admin

---

## Phase 5 — Growth Features (Month 6+)

- [ ] Google OAuth sign-in (reduce friction)
- [ ] Travel document vault (Firebase Storage, per-user encrypted)
- [ ] Budget tracking (set per-person budget, show progress vs. actual)
- [ ] Venmo/PayPal/Zelle deeplinks from finance screen
- [ ] Live currency exchange rates (Open Exchange Rates API)
- [ ] Multi-currency settlement (pay in any currency, track in one)
- [ ] Packing templates (community + premium)
- [ ] Task assignments ("Alayna: book restaurant by Friday")
- [ ] Trip memories / post-trip recap screen
- [ ] Sub-groups within a trip ("Team Spa" vs "Team Museum")
- [ ] API for travel agencies / corporate (enterprise tier)

---

## Infrastructure & Operations

- [ ] Error monitoring: add Sentry (replace custom ErrorLoggerService)
- [ ] Analytics: Firebase Analytics or Mixpanel — track trip creation, feature usage, funnel
- [ ] Performance monitoring: Firebase Performance
- [ ] Rate limiting on Firebase Functions (prevent abuse of AI endpoint)
- [ ] Firestore backups: daily automated backups (Firebase has this built-in)
- [ ] Staging Firebase project for testing before prod deploys
- [ ] CI/CD: GitHub Actions → build → test → deploy to Firebase Hosting
- [ ] Status page (e.g., Instatus) — for when Firebase is down

---

## Design Assets Needed

- [ ] App icon (all sizes: 20pt, 29pt, 40pt, 60pt, 76pt, 83.5pt + Android sizes)
- [ ] Splash screen (iOS + Android)
- [ ] App Store screenshots (at least 3 per device size)
- [ ] Open Graph image for social sharing
- [ ] Landing page (before App Store launch)
- [ ] Email template (welcome + upgrade prompts)
- [ ] App Store preview video (optional but increases conversion)

---

*Sequenced based on dependencies: Architecture → Billing → Features → Native → Growth.*
*Don't build Phase 3 features on the Phase 1 architecture — you'll just have to redo them.*
