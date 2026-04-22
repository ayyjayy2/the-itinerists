# Triplan — Brainstorming Notes
> Decisions, visuals, and reference material from the design sessions.
> Last updated: April 2026

---

## Visual Diagrams

Open these HTML files directly in a browser (File → Open, or drag into browser):

| Diagram | File | What it shows |
|---------|------|---------------|
| **App Flow Diagram** | [`docs/app-flow-diagram.html`](app-flow-diagram.html) | Full navigation map — launch, auth, trip management, tab bar, sub-screens, invite flow |
| **Framework Comparison** | [`docs/framework-comparison.html`](framework-comparison.html) | React Native vs Flutter — real-world companies, decision matrix |
| **Travel Page Mockup** | [`docs/travel-page-mockup.html`](travel-page-mockup.html) | Three approaches for the unified Travel page — phone mockups with flying vs driving forms, onboarding setup mode |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| App name | **Triplan** (working name) | Simple, clear, travel + plan |
| Framework | **React Native + Expo** | TypeScript familiarity, faster ramp-up, large ecosystem |
| Animation | **Reanimated 3** | Bridges the UI polish gap with Flutter |
| Language | **TypeScript** | Already known, transfers from Angular codebase |
| Backend | **Firebase / Firestore** | Same as current app, proven, real-time sync |
| Auth | **Firebase Auth** | Open registration, email/password |
| Navigation | **Expo Router** | File-based routing, deep link support |
| State management | **React Context + custom hooks** | Lightweight, matches Angular signals pattern |
| Architecture | **Reactive context injection** | TripContext holds activeTripId, all hooks derive Firestore paths from it |
| Migration | **Clean break** | No existing data to preserve — new data model from scratch |
| Registration | **Open signup** | Anyone can create an account, no invite needed |
| Trip creation | **Any user** | Any logged-in user can create a trip |
| Permissions | **Fully democratic** | Any member can invite/remove (owner protected) |
| Invite model | **Trip-scoped links** | Each invite link is tied to a specific trip |
| Personal data | **Trip-scoped** | Packing lists, personal expenses are per-trip |
| App open behavior | **Last active trip** | Opens into last trip, "Switch Trip" available |
| Safeguards | **Activity log + owner restore** | Owner can undo removals, all membership changes logged |
| Destination input | **Google Places Autocomplete** | Stores place name + coords for weather API + maps |
| Travel page | **Unified "Travel" (replaces "Flights")** | One page, all transport modes. First visit = guided setup |
| Travel mode forms | **Mode-specific** | Flying = full flight form; Driving = simpler form with legs; Train/Bus = middle ground |
| Personal trip dates | **Derived from travel entries** | No separate date picker — dates come from flights/drives entered |
| Password reset | **Firebase email reset** | "Forgot password?" → Firebase sends reset link |
| Page toggles | **Per-user, per-trip** | Users can hide pages they don't need from their menu |
| Tab bar structure | **TBD** | Current 4-tab with "More" grid needs rethinking — revisit in UI phase |

---

## Firestore Data Model (starting point)

```
/users/{uid}                          — user profile (global)
/trips/{tripId}                       — trip config (name, destination, dates, currency)
  + destination, destinationPlaceId, destinationCoords {lat, lng}
/trips/{tripId}/members/{uid}         — role, display snapshot, joinedAt
  + travelMode ("flying"|"driving"|"train"|"bus"|"other"|null)
  + arrivalDate?, arrivalTime?, departureDate?, departureTime?
  + hiddenPages?: string[]
/trips/{tripId}/invites/{code}        — trip-scoped invite codes
/trips/{tripId}/activityLog/{logId}   — membership changes audit trail
/trips/{tripId}/travel/{travelId}     — all transport entries (flights, drives, trains)
  + uid, mode, legs[] (each leg has from/to/date/time/details)
/trips/{tripId}/itinerary/{itemId}
/trips/{tripId}/stays/{stayId}
/trips/{tripId}/finance/{entryId}
/trips/{tripId}/settlements/{key}
/trips/{tripId}/recs/{recId}
/trips/{tripId}/cars/{carId}
/trips/{tripId}/pins/{pinId}
/trips/{tripId}/outfits/{uid_date}
/trips/{tripId}/packing/{uid}
/trips/{tripId}/dayLabels/{uid}
/userTrips/{uid}                      — tripIds[], lastActiveTrip
```

---

## React Native Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React Native + Expo (managed workflow) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| State | React Context + custom hooks |
| Animation | Reanimated 3 |
| Backend | Firebase/Firestore |
| Auth | @react-native-firebase/auth |
| Real-time data | @react-native-firebase/firestore onSnapshot |
| Push notifications | @react-native-firebase/messaging |
| Camera | expo-camera |
| Maps | react-native-maps |
| Styling | NativeWind (Tailwind for RN) or StyleSheet |
| Build & Deploy | EAS Build → App Store + Google Play |

---

## Tab Bar Structure

```
Bottom Tabs:
├── 🏠 Home         — Trip dashboard, countdown, member avatars, quick links
├── 📅 Itinerary    — Day-by-day events, drag-to-reorder, calendar view
├── 💵 Finance      — Who owes who, add expenses, settlement tracking
└── ••• More        — Grid: Flights, Stays, Packing, Outfits, Map, Cars, Recs, Profile
```

---

## Related Documents

- [`VISION.md`](../VISION.md) — Full strategy (monetization, marketing, feature roadmap)
- [`ROADMAP.md`](../ROADMAP.md) — Engineering task checklist
- [`docs/apis.md`](apis.md) — Current API integrations
- [`docs/CHANGES.md`](CHANGES.md) — History of app evolution (Ireland → Savannah)
