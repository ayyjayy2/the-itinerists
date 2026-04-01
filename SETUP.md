# Ireland - St. Patrick's App — Setup Guide

## 1. Create the Google Sheet

Create a new Google Sheet and add these **7 tabs** (exact names, case-sensitive):

### Tab: `Users`
| Name | Color | AvatarEmoji |
|------|-------|-------------|
| Alayna | #F4C2C2 | 🌸 |
| Sarah  | #88C9A1 | 🍀 |
| Megan  | #F9E4B7 | 🌻 |
| Emma   | #B5D5F5 | 💙 |
| Olivia | #D4B5F5 | 🫐 |
| Hannah | #F5D4B5 | 🧡 |
| Grace  | #B5F5D4 | 💚 |
| Claire | #F5B5D4 | 🌷 |

> Colors can be any hex value. Emojis show as the person's avatar.

---

### Tab: `Flights`
| Person | Airline | FlightNumber | From | To | DepartureDate | DepartureTime | ArrivalDate | ArrivalTime | Notes |
|--------|---------|--------------|------|----|---------------|---------------|-------------|-------------|-------|
| Alayna | Aer Lingus | EI 144 | JFK | DUB | 2025-03-14 | 18:30 | 2025-03-15 | 06:15 | |

> Dates must be **YYYY-MM-DD** format. Times in **HH:MM** (24h).

---

### Tab: `Itinerary`
| Date | DayLabel | Time | Activity | Location | Category | Notes | ForWho |
|------|----------|------|----------|----------|----------|-------|--------|
| 2025-03-15 | Day 1 – Dublin | 10:00 | Trinity College | Dublin | Sightseeing | See the Book of Kells | All |

> **ForWho**: either `All` or comma-separated names e.g. `Alayna, Sarah`

> **Category** options (used for color-coding): Food, Drink, Sightseeing, Culture, Transport, Travel, Accommodation, Activity, Free

---

### Tab: `Accommodations`
| Name | Address | CheckIn | CheckOut | Notes | BookingRef | ForWho |
|------|---------|---------|----------|-------|------------|--------|
| The Wilder Townhouse | 22 St Stephen's Green, Dublin | 2025-03-15 | 2025-03-18 | Breakfast included | ABC123 | All |

---

### Tab: `Finance`
| Date | Description | Amount | Currency | PaidBy | SplitAmong | Category |
|------|-------------|--------|----------|--------|------------|----------|
| 2025-03-15 | Dinner at Chapter One | 240 | EUR | Sarah | All | Food |

> **SplitAmong**: `All` or comma-separated names

---

### Tab: `Recs`
| Category | Title | Description | Extra |
|----------|-------|-------------|-------|
| Irish Words | Craic | Fun, good times | Pronounced "crack" |
| Food | Full Irish | Traditional breakfast with sausages, black pudding, eggs | Must try at Bewley's |
| Currency | Euro | Ireland uses the Euro (€) | £ not accepted in Republic |

> **Category** suggestions: Irish Words, Food, Drink, Currency, Tips, Places, Culture

---

### Tab: `RentalCar`
| Company | ConfirmationNumber | PickupDate | PickupTime | PickupLocation | DropoffDate | DropoffTime | DropoffLocation | Drivers | Notes |
|---------|-------------------|------------|------------|----------------|-------------|-------------|-----------------|---------|-------|
| Hertz | HR-12345 | 2025-03-17 | 09:00 | Dublin Airport T1 | 2025-03-21 | 14:00 | Dublin Airport T1 | Alayna, Sarah | Full insurance included |

---

## 2. Deploy the Apps Script

1. In your Google Sheet: **Extensions → Apps Script**
2. Delete all existing code in `Code.gs`
3. Paste the entire contents of `APPS_SCRIPT.js` from this project
4. Click **Deploy → New deployment**
5. Settings:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** → authorize if prompted
7. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

---

## 3. Add the URL to the app

Open `src/environments/environment.ts` and replace `YOUR_SCRIPT_ID`:

```typescript
export const environment = {
  production: false,
  appsScriptUrl: 'https://script.google.com/macros/s/YOUR_ACTUAL_SCRIPT_ID/exec'
};
```

Do the same in `src/environments/environment.prod.ts`.

---

## 4. Run the app

```bash
cd savannah-getaway
npm install --legacy-peer-deps --cache /tmp/npm-cache
ng serve                 # dev server at http://localhost:4200
ng build                 # production build
```

### Test offline (PWA):
```bash
npx http-server dist/savannah-getaway/browser -p 8080
# Open http://localhost:8080
# Chrome DevTools → Application → Service Workers → check "Offline"
```

### Install as PWA:
- Chrome desktop: address bar → Install icon
- iOS Safari: Share → Add to Home Screen
- Android Chrome: banner or browser menu → Add to Home Screen

---

## 5. Share with the group

1. Build the app: `ng build`
2. Deploy `dist/savannah-getaway/browser/` to any static host:
   - **Netlify**: drag & drop the folder at netlify.com
   - **Vercel**: `npx vercel dist/savannah-getaway/browser`
   - **GitHub Pages**: push to gh-pages branch
3. Share the URL with all 8 people — they each select their name on first visit

---

## Notes

- **Privacy**: The Google Sheet stays private. The Apps Script endpoint is public but URL-guessable only — no authentication token. The sheet data is read-only from the app.
- **Offline**: After first load, the app works offline. Sheet data is cached in localStorage (30-min TTL; auto-refreshes if stale).
- **Local data** (expenses, packing list) is always stored locally per-device. It does NOT sync across devices — by design.
- **Packing suggestions** are posted to the Apps Script which writes them to a `PackingSuggestions` tab. This enables cross-device suggestion delivery.

---

## Trip dates (update in code)

In `src/app/pages/home/home.component.ts`, update:
```typescript
readonly tripStart = new Date('2025-03-14');
readonly tripEnd   = new Date('2025-03-21');
```
