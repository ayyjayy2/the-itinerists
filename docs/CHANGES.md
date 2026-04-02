# Savannah Getaway — Changes from Ireland Clone

This document captures all updates made when revamping the app from the Ireland St. Patrick's Day trip to the Savannah Getaway trip.

---

## Pages

### Home
- Updated trip name, header, and hero copy for Savannah
- Removed Ireland/Dublin references

### Flights
- Default view changed to **My Trip** (was All)

### Itinerary
- Removed DataService/Google Sheets dependency — now fully Firestore-backed
- Added inline day label editing (stored per-user in `itineraryPrefs/{uid}`)
- Replaced `users()` with `tripUsers()` (real registered users, not seed data)
- Added flight banners for travel days
- Default view changed to **My Trip** (was All)
- Fixed day filter so selecting a specific day shows only that day's items

### Stays (Accommodations)
- Full rewrite — new `StaysService` backed by Firestore `stays` collection
- Add/edit/delete stays with booking ref, link, and per-person `forWho` field
- Default view changed to **My Trip**

### Finance
- Full rewrite — new `FinanceService` backed by Firestore `financeEntries` collection
- **USD-only** — removed all multi-currency (EUR/GBP/ISK) and exchange rate logic
- Header updated to 💵
- Added **Drink** category (also carried into My Expenses)
- Removed `ARIELLE` / `STINKY` hardcoded Ireland user references

### Recs
- Full rewrite — new `RecsService` backed by Firestore `recs` collection for user additions
- 21 curated **Savannah seed recs** baked in as static data (always visible)
- Categories: Food / Drink / Places / Activities / Tips / Culture
- Header updated to "Savannah Tips & Recs"

### Outfits
- Full rewrite — new `OutfitsService` backed by Firestore `outfits` collection
- New `WeatherService` pointed at **Savannah, GA** (Open-Meteo, free tier)
  - Coordinates: 32.0809°N, 81.0912°W
  - Handles 16-day forecast window gracefully — shows static April suggestion when trip is out of range
  - Fixed deprecated `weathercode` → `weather_code` API param
- Trip dates pulled from `TripConfigService` reactively via `effect()`
- Outfit suggestions rewritten for warm/humid Savannah April weather, gender-neutral
- Photo uploads: raised compression from 300px/40% → **1200px/85%** for clear images
- Photos render uncropped at natural aspect ratio (`height: auto`, no `object-fit: cover`)
- Fixed Firestore save error — strips `undefined` fields before `setDoc`

### My Expenses
- Full rewrite — **USD-only**, single dollar total
- Shared expenses now pulled from `FinanceService` (Firestore) instead of DataService
- `saveFinanceEdit` uses `financeService.updateEntry()` instead of `dataService.patchFinanceEntry()`
- Added **shared** badge on expense rows to distinguish Finance tab entries from personal ones
- Fixed Firestore `updateDoc` error — strips `undefined` fields before writing
- Updated localStorage keys from `ireland_` → `savannah_` prefix
- Removed `Lodging` category (redundant with `Accommodation`)

### Admin
- Placeholders already updated to Savannah (no Ireland references)
- Added **confirmation modal** before removing a member — warns that all data will be deleted and action cannot be undone

### Profile
- *(pending review)*

---

## Services

| Service | Change |
|---|---|
| `WeatherService` | Rewritten for Savannah, GA; fixed `weather_code` param; 16-day window guard |
| `OutfitsService` | New — Firestore `outfits` collection |
| `OutfitPhotoService` | Compression raised to 1200px / 85% quality |
| `StaysService` | New — Firestore `stays` collection |
| `FinanceService` | New — Firestore `financeEntries` collection; `undefined` field stripping |
| `RecsService` | New — Firestore `recs` collection |
| `ExpensesService` | Storage keys renamed `ireland_` → `savannah_` |

---

## Data model additions (`trip.models.ts`)

- `AccommodationDoc` — stays with `forWho`, `link`, `bookingRef`
- `FinanceEntryDoc` — USD finance entries with `splitAmong`, `splits`, `paidBy`
- `RecDoc` — user-added recs extending `Rec` with `id`, `addedByUid`, `createdAt`

---

## Removed (Ireland-specific)

- `DataService` / Google Sheets integration (removed from all pages)
- Multi-currency support (EUR / GBP / ISK)
- Exchange rate editor
- Hardcoded Ireland user names (`ARIELLE`, `STINKY`, `Dad`)
- `ireland_fx_rates`, `ireland_expenses_display_currencies` localStorage keys
- Hardcoded Dublin / Ireland trip dates and city detection logic
