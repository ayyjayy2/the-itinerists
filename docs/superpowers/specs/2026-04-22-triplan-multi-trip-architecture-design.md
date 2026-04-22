# Triplan — Multi-Trip Architecture Design Spec

## Overview

Rebuild the Savannah Getaway travel planning app as **Triplan**, a standalone React Native mobile app supporting unlimited users, unlimited trips, and multi-modal travel. This spec covers the foundational architecture: Firestore data model, React Native app structure, auth, invites, trip lifecycle, and the unified Travel page.

**Framework:** React Native + Expo + TypeScript + Reanimated 3  
**Backend:** Firebase Auth + Firestore (new project, clean break)  
**Target platforms:** iOS + Android via EAS Build  

---

## 1. Firestore Data Model

### 1.1 Users (global)

```
/users/{uid}
  displayName: string           "Alayna"
  username: string              "alayna" (lowercase, unique)
  email: string                 "alayna@gmail.com"
  avatarEmoji: string           "🌸"
  color: string                 "#F4C2C2"
  createdAt: number             unix ms
```

Users are global — not tied to any single trip. A user can be in many trips simultaneously.

### 1.2 Trips

```
/trips/{tripId}
  name: string                  "Bali Girls Trip 2026"
  destination: string           "Bali, Indonesia"
  destinationPlaceId: string    Google Places ID (for maps/weather)
  destinationCoords: {          lat/lng (for weather API + map centering)
    lat: number
    lng: number
  }
  startDate: string             "2026-08-10" (YYYY-MM-DD)
  endDate: string               "2026-08-17"
  currency: string              "USD"
  coverPhotoUrl?: string        Firebase Storage URL
  createdBy: string             uid of trip creator
  createdAt: number             unix ms
  memberCount: number           denormalized count for limit checks
```

### 1.3 Trip Members

```
/trips/{tripId}/members/{uid}
  role: "owner" | "member"
  displayName: string           snapshot at join time
  avatarEmoji: string
  color: string
  joinedAt: number              unix ms
  travelMode?: "flying" | "driving" | "train" | "bus" | "other" | null
  arrivalDate?: string          YYYY-MM-DD (derived from travel entries or manual)
  arrivalTime?: string          "3:00 PM"
  departureDate?: string
  departureTime?: string
  hiddenPages?: string[]        e.g. ["cars", "outfits"] — pages this user has toggled off
```

**Permissions model — fully democratic:**
- Any member can invite new members (generate invite links)
- Any member can remove another member (except the owner)
- The owner can never be removed — only they can delete or transfer the trip
- The owner can restore previously removed members via the activity log

### 1.4 Trip Invites

```
/trips/{tripId}/invites/{code}
  code: string                  random 8-char alphanumeric
  createdBy: string             uid
  createdAt: number             unix ms
  expiresAt: number             createdAt + 7 days
  usedBy: string[]              uids of people who joined with this code
```

### 1.5 Activity Log

```
/trips/{tripId}/activityLog/{logId}
  action: "member_added" | "member_removed" | "member_restored" | "member_left"
  targetUid: string             the user who was affected
  performedByUid: string        the user who took the action
  timestamp: number             unix ms
```

### 1.6 Travel (replaces Flights)

```
/trips/{tripId}/travel/{travelId}
  uid: string                   the user this travel entry belongs to
  addedByUid: string            who entered it
  mode: "flying" | "driving" | "train" | "bus" | "other"
  direction: "arrival" | "departure"
  createdAt: number             unix ms

  // Flying-specific fields
  airline?: string              "Delta"
  flightNumber?: string         "DL47"
  from?: string                 IATA code "JFK"
  to?: string                   IATA code "DPS"

  // Driving-specific fields
  origin?: string               "Atlanta, GA"
  estimatedDuration?: string    "~5hr"

  // Train/Bus-specific fields
  carrier?: string              "Amtrak"
  departureStation?: string
  arrivalStation?: string

  // Common fields (all modes)
  departureDate: string         YYYY-MM-DD
  departureTime: string         "8:30 PM"
  arrivalDate: string           YYYY-MM-DD
  arrivalTime: string           "6:15 AM"
  notes: string
```

### 1.7 Trip Content Sub-Collections

These follow the same interfaces as the existing Angular app (`ItineraryItemDoc`, `FinanceEntryDoc`, `AccommodationDoc`, etc.) scoped under a trip:

```
/trips/{tripId}/itinerary/{itemId}      ItineraryItemDoc
/trips/{tripId}/stays/{stayId}          AccommodationDoc
/trips/{tripId}/finance/{entryId}       FinanceEntryDoc
/trips/{tripId}/settlements/{key}       { items: string[] }
/trips/{tripId}/recs/{recId}            RecDoc
/trips/{tripId}/cars/{carId}            RentalCar (as doc)
/trips/{tripId}/pins/{pinId}            MapPin
/trips/{tripId}/outfits/{uid_date}      OutfitEntry
/trips/{tripId}/packing/{uid}           { items: PackingItem[] }
/trips/{tripId}/dayLabels/{uid}         { labels: Record<string, string> }
```

### 1.8 Global Invite Index

```
/inviteIndex/{code}
  tripId: string                which trip this invite belongs to
  expiresAt: number             duplicated from invite doc for fast validation
```

When an invite is generated, a corresponding entry is written here so the join flow can resolve a code to a tripId without scanning all trips. Cleaned up when invites expire.

### 1.9 User Trips Index

```
/userTrips/{uid}
  tripIds: string[]             fast lookup of all trips this user belongs to
  lastActiveTrip: string        tripId restored on next app open
```

---

## 2. React Native App Structure

### 2.1 Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | React Native + Expo (managed workflow) | Cross-platform, EAS Build handles App Store/Play Store |
| Language | TypeScript | Already known from Angular codebase |
| Navigation | Expo Router | File-based routing, deep link support built-in |
| State | React Context + custom hooks | Lightweight, maps to Angular signals pattern |
| Animation | Reanimated 3 | Smooth native-thread animations |
| Backend | Firebase/Firestore | Real-time sync, proven at scale |
| Auth | @react-native-firebase/auth | Email/password + password reset |
| Real-time data | @react-native-firebase/firestore | onSnapshot listeners |
| Push notifications | @react-native-firebase/messaging | FCM for iOS + Android |
| Camera | expo-camera | Outfit photo uploads |
| Maps | react-native-maps | Native Google Maps rendering |
| Location autocomplete | Google Places API | Destination search with coords |
| Styling | NativeWind (Tailwind for RN) or StyleSheet | TBD in UI design phase |
| Build & Deploy | EAS Build | App Store + Google Play submission |

### 2.2 Project Structure

```
triplan/
├── app/                          Expo Router file-based routing
│   ├── (auth)/                   Unauthenticated screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── join/[code].tsx       Deep link: triplan.app/join/ABC123
│   ├── (app)/                    Authenticated screens
│   │   ├── _layout.tsx           Root layout (auth gate + TripProvider)
│   │   ├── trips/
│   │   │   ├── index.tsx         "My Trips" list
│   │   │   └── new.tsx           Create trip form
│   │   ├── (trip)/               Active trip screens
│   │   │   ├── _layout.tsx       Tab bar layout (reads hiddenPages)
│   │   │   ├── home.tsx          Trip dashboard + countdown
│   │   │   ├── itinerary.tsx
│   │   │   ├── finance.tsx
│   │   │   ├── travel.tsx        Unified travel page (all modes)
│   │   │   ├── stays.tsx
│   │   │   ├── packing.tsx
│   │   │   ├── outfits.tsx
│   │   │   ├── recs.tsx
│   │   │   ├── map.tsx
│   │   │   ├── cars.tsx
│   │   │   └── profile.tsx
│   │   └── trip-settings.tsx
│   └── _layout.tsx               Root layout (auth check)
├── components/                   Shared UI components
├── hooks/                        Custom hooks (replace Angular services)
│   ├── useAuth.ts
│   ├── useTripContext.ts
│   ├── useTrips.ts
│   ├── useMembers.ts
│   ├── useTravel.ts
│   ├── useItinerary.ts
│   ├── useFinance.ts
│   ├── useStays.ts
│   ├── usePacking.ts
│   ├── useOutfits.ts
│   ├── useRecs.ts
│   ├── useCars.ts
│   ├── usePins.ts
│   └── useActivityLog.ts
├── models/                       TypeScript interfaces
│   └── types.ts                  All Firestore document types
├── lib/
│   ├── firebase.ts               Firebase init + config
│   └── animations.ts             Shared Reanimated configs
├── contexts/
│   ├── AuthContext.tsx
│   └── TripContext.tsx
└── assets/
```

### 2.3 Core Architecture Pattern

**TripContext** is the central reactive mechanism. It holds the active trip ID and all hooks derive their Firestore paths from it:

```typescript
// contexts/TripContext.tsx
const TripContext = createContext<{
  activeTripId: string | null;
  activeTrip: TripDoc | null;
  switchTrip: (id: string) => void;
}>(null!);

// hooks/useFinance.ts
function useFinanceEntries() {
  const { activeTripId } = useTripContext();
  // Subscribes to /trips/{activeTripId}/finance
  // Re-subscribes automatically when activeTripId changes
}
```

Every data hook follows this pattern:
1. Read `activeTripId` from TripContext
2. Subscribe to `trips/{activeTripId}/{collection}` via onSnapshot
3. Return reactive state (data, loading, error)
4. Unsubscribe and resubscribe when `activeTripId` changes

---

## 3. Authentication

### 3.1 Registration (open signup)

1. User opens app → Register screen
2. Fields: display name, username, email, password, avatar emoji, color picker
3. On submit:
   - `createUserWithEmailAndPassword(email, password)`
   - Write `/users/{uid}` doc to Firestore
4. After registration → "My Trips" screen (empty state: "Create your first trip")

No invite code required. Anyone can register.

### 3.2 Login

1. Email + password → `signInWithEmailAndPassword`
2. On success → read `/userTrips/{uid}`
   - If `lastActiveTrip` exists → load that trip directly
   - If no trips → "My Trips" screen

### 3.3 Password Reset

1. Login screen → "Forgot password?" link
2. User enters email
3. App calls `sendPasswordResetEmail(email)`
4. Firebase delivers reset email with link
5. User resets password via Firebase-hosted page
6. Returns to login with new password

### 3.4 Auth State Persistence

Firebase Auth persists the session automatically. On app cold start:
1. Check `auth().currentUser`
2. If authenticated → check `lastActiveTrip` → enter trip or show My Trips
3. If not authenticated → Login screen

---

## 4. Trip-Scoped Invite Flow

This is the viral growth loop — every invite brings a new user into the app.

### 4.1 Generating an Invite

1. Any member taps "Invite" inside a trip
2. App generates a random 8-char code
3. Writes to `/trips/{tripId}/invites/{code}`:
   - `createdBy`: current user's uid
   - `expiresAt`: now + 7 days
   - `usedBy`: []
4. Also writes to `/inviteIndex/{code}`:
   - `tripId`: the trip ID
   - `expiresAt`: same value
5. App produces deep link: `triplan.app/join/{code}`
6. Member shares via native share sheet (iMessage, WhatsApp, etc.)

### 4.2 Receiving an Invite

1. Recipient taps link → app opens (or App Store/Play Store if not installed)
2. Expo Router matches `/join/[code]` route
3. Read `/inviteIndex/{code}` to resolve code → tripId (this collection is readable by any authenticated user)
4. Read `/trips/{tripId}/invites/{code}` to validate expiration and get full invite data
5. Check auth state:
   - **Logged in:** validate code → join trip immediately
   - **Not logged in:** show Register screen with invite context preserved → after registration, auto-join trip
6. On successful join:
   - Add user to `/trips/{tripId}/members/{uid}`
   - Append tripId to `/userTrips/{uid}.tripIds`
   - Increment `/trips/{tripId}.memberCount`
   - Write to `/trips/{tripId}/activityLog` (member_added)
   - Append uid to invite doc's `usedBy` array
7. Navigate into the trip → Travel page setup mode (first visit)

### 4.3 Deep Linking

- **iOS:** Universal Links via apple-app-site-association
- **Android:** App Links via assetlinks.json
- **Fallback:** If app not installed, link opens a web page with App Store/Play Store buttons
- Expo Router handles all deep link parsing natively

---

## 5. Trip Lifecycle

### 5.1 Creating a Trip

Any logged-in user can create a trip.

**Create Trip form fields:**
- Trip name (required) — "Bali Girls Trip 2026"
- Destination (required) — Google Places Autocomplete
  - Stores: `destination` (display name), `destinationPlaceId`, `destinationCoords` (lat/lng)
- Start date / End date (required)
- Primary currency — dropdown (USD, EUR, GBP, JPY, etc.)
- Cover photo (optional) — upload to Firebase Storage

**On submit:**
1. Generate tripId (Firestore auto-ID)
2. Write `/trips/{tripId}` doc
3. Write `/trips/{tripId}/members/{uid}` with `role: "owner"`
4. Append tripId to `/userTrips/{uid}.tripIds`
5. Set `/userTrips/{uid}.lastActiveTrip` to new tripId
6. Navigate into the new trip

### 5.2 Switching Trips

1. From Home → "Switch Trip" button → My Trips screen
2. Tap a trip card → `TripContext.switchTrip(tripId)`
3. Updates `/userTrips/{uid}.lastActiveTrip` in Firestore
4. Updates `activeTripId` in local context
5. All hooks re-subscribe to new trip's Firestore paths
6. Previous trip data clears as new listeners fire

### 5.3 Trip Settings

**Any member can:**
- View trip name, destination, dates, currency, members list, activity log
- Edit trip details (name, dates, destination, currency, cover photo)
- Generate and share invite links
- Remove another member (except the owner)
- Leave the trip voluntarily

**Owner-only actions:**
- Delete trip — confirmation required, permanently removes all sub-collections
- Transfer ownership — promote a member to owner, demote self to member
- Restore a removed member — from the activity log

### 5.4 Trip Archival

- After `endDate` passes, trip card on My Trips shows a subtle "Complete" badge
- Archived trips remain fully accessible (read + write) — no lockdown
- Users can manually archive a trip to move it to an "Archived" section
- Archived trips won't count toward any future free-tier limits

### 5.5 Page Toggles

Each user can customize which pages appear in their navigation, per trip.

- Stored in `/trips/{tripId}/members/{uid}.hiddenPages` as a string array
- Settings screen → "Customize Menu" section with toggles for each page
- Toggling a page off hides it from navigation; data is preserved
- Toggling it back on restores access with all data intact
- Core pages (Home, Itinerary, Finance) are not hideable

---

## 6. Unified Travel Page

The "Flights" page from the original app is replaced by a unified **"Travel"** page that handles all transport modes.

### 6.1 First Visit — Setup Mode

When a user enters the Travel page for the first time in a trip (no travel entries exist for their uid), the page shows a guided setup:

1. **Pick travel mode:** horizontal selector — Flying, Driving, Train/Bus, Not sure yet
2. **Mode-specific form appears:**
   - **Flying:** full flight form — airline, flight number, from airport, to airport, departure date/time, arrival date/time, notes
   - **Driving:** origin city, departure date/time, arrival date/time, estimated duration, notes. "+ Add another leg" for multi-stop road trips
   - **Train/Bus:** carrier, departure station, arrival station, departure date/time, arrival date/time, notes
   - **Not sure yet:** just arrival date/time + departure date/time (manual override)
3. User fills in arrival travel details
4. Prompted to add departure travel details (or skip)
5. "Continue" saves to `/trips/{tripId}/travel/{travelId}` and transitions to dashboard mode

### 6.2 Return Visits — Dashboard Mode

- Shows saved travel entries as cards (flight cards, drive cards, etc.)
- "Edit" on any card to modify details
- "+ Add a leg" to add connections or additional travel segments
- Travel mode icon displayed on each card
- Can change travel mode (e.g., "Not sure yet" → "Flying" once booked)

### 6.3 "Everyone" Tab

- Shows all trip members' travel status as chips/pills
- Each chip: avatar emoji + name + mode icon + date range
- Example: `🌸 Alayna ✈️ Mar 14–21` / `🍀 Sarah 🚗 Mar 14–19` / `🌻 Megan TBD`
- Useful for planning: see at a glance who arrives when

### 6.4 Date Derivation

Personal trip dates for itinerary "My Trip" filtering are derived from travel entries:
- If travel entries exist → earliest arrival date to latest departure date
- If only manual dates set on member doc → use those
- If nothing → show full trip date range

Priority: travel entries > manual member dates > trip global dates.

---

## 7. Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: any authenticated user can read, only the user can write their own doc
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }

    // UserTrips: only the user can read/write their own index
    match /userTrips/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Invite index: any authenticated user can read (needed for join flow)
    match /inviteIndex/{code} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // members write when generating invites
    }

    // Trips: only members can read/update, anyone can create
    match /trips/{tripId} {
      allow read: if isMember(tripId);
      allow create: if request.auth != null;
      allow update: if isMember(tripId);
      allow delete: if isOwner(tripId);
    }

    // Invite sub-collection: readable by any auth user (for join validation)
    match /trips/{tripId}/invites/{code} {
      allow read: if request.auth != null;
      allow write: if isMember(tripId);
    }

    // Members sub-collection: special rules for join/remove
    match /trips/{tripId}/members/{uid} {
      allow read: if isMember(tripId) || request.auth.uid == uid;
      allow create: if request.auth.uid == uid; // user can only add themselves (join flow)
      allow update: if request.auth.uid == uid || isOwner(tripId);
      allow delete: if isMember(tripId) && uid != getOwnerUid(tripId);
    }

    // Activity log: members can read and create
    match /trips/{tripId}/activityLog/{logId} {
      allow read: if isMember(tripId);
      allow create: if isMember(tripId) || request.auth != null; // join writes log too
    }

    // All other trip sub-collections: only members can read/write
    match /trips/{tripId}/{collection}/{docId} {
      allow read: if isMember(tripId);
      allow create: if isMember(tripId);
      allow update: if isMember(tripId);
      allow delete: if isMember(tripId);
    }

    // Helper functions
    function isMember(tripId) {
      return exists(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid));
    }

    function isOwner(tripId) {
      return get(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid)).data.role == "owner";
    }

    function getOwnerUid(tripId) {
      return get(/databases/$(database)/documents/trips/$(tripId)).data.createdBy;
    }
  }
}
```

---

## 8. Navigation Structure

### 8.1 Route Map

```
/ (root)
├── (auth)/
│   ├── login            — email + password, "Forgot password?" link
│   ├── register         — open signup form
│   └── join/[code]      — deep link invite handler
├── (app)/
│   ├── trips/           — "My Trips" list + "New Trip" button
│   ├── trips/new        — create trip form (Places autocomplete)
│   ├── trip-settings    — trip config, members, activity log
│   └── (trip)/          — active trip screens
│       ├── home         — dashboard, countdown, quick links, "Switch Trip"
│       ├── itinerary    — day-by-day events, drag reorder, calendar view
│       ├── finance      — settlements, expenses, add/edit, paid tracking
│       ├── travel       — unified travel page (all modes)
│       ├── stays        — accommodation cards
│       ├── packing      — per-user checklist (syncs across devices)
│       ├── outfits      — per-day outfit log with photos
│       ├── recs         — tips by category
│       ├── map          — interactive map with pins
│       ├── cars         — rental car bookings
│       └── profile      — avatar, account settings, page toggles
```

### 8.2 Tab Bar

The bottom tab bar structure is **TBD** — flagged for the UI design phase. The initial proposal of 4 tabs (Home, Itinerary, Finance, More) felt cluttered with 8+ items in "More." The page toggle feature may help reduce this, and alternative patterns (collapsible nav, swipeable home cards, contextual grouping) will be explored during UI design.

### 8.3 Auth Gate

The root `_layout.tsx` checks Firebase auth state:
- Authenticated → render `(app)/` routes
- Not authenticated → render `(auth)/` routes
- Loading → splash screen

---

## 9. What Transfers from the Angular Codebase

The existing app is a **reference implementation**, not production code. The React Native app is built from scratch, but substantial logic and design transfers directly:

| What | How it transfers |
|------|-----------------|
| **TypeScript interfaces** | `trip.models.ts` interfaces copy to `models/types.ts` with minor adaptations |
| **Business logic** | Expense splitting math, debt calculation, countdown timers → utility functions |
| **Firestore patterns** | onSnapshot subscription pattern identical in @react-native-firebase |
| **Auth flow** | Same Firebase Auth calls (createUser, signIn, sendPasswordReset) |
| **Security rules** | Updated for new path structure but same authorization concepts |
| **Feature knowledge** | Every screen's requirements are already defined by the working Angular app |
| **UX patterns** | "My Trip" vs "Full Trip" filtering, settlement tracking, forWho system |

---

## 10. Out of Scope (future specs)

The following are explicitly **not** part of this spec and will be designed separately:

- Monetization / Stripe billing / tier enforcement
- AI Itinerary Builder (Claude API integration)
- Push notifications (FCM triggers)
- Real-time flight status tracking
- Photo albums (beyond outfits)
- UI visual design (colors, typography, component styling)
- Tab bar final design
- App Store / Play Store submission process
- Marketing and growth strategy

---

## 11. Open Questions

1. **Tab bar structure** — 4 tabs with "More" grid, or a different navigation pattern? Deferred to UI design phase.
2. **NativeWind vs StyleSheet** — styling approach TBD based on team preference during implementation.
3. **Google Places API billing** — autocomplete calls cost ~$2.83 per 1,000 sessions. Acceptable at early scale, may need caching strategy later.
4. **Offline support depth** — how much trip data to cache locally for offline access? Firestore has built-in offline persistence, but photo/image caching needs explicit handling.
5. **Member count limit enforcement** — where does `memberCount` get enforced? Client-side check + Firestore rules, or Cloud Function?
