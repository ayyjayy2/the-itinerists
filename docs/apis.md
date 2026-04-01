# APIs & External Services

## Active

| Service | Purpose | Cost | Auth |
|---|---|---|---|
| **Firebase Firestore** | Database — trip data, finances, itinerary, map pins, outfits, etc. | Free tier | API key (`.env`) |
| **Firebase Storage** | Outfit photo uploads | Free tier | API key (`.env`) |
| **Open-Meteo** | Weather forecasts for trip cities | Free, no key needed | None |
| **OpenStreetMap (Leaflet)** | Interactive map tile rendering | Free | None |
| **Nominatim (OSM)** | Geocoding — converts location names to lat/lng coordinates | Free | None |
| **Google Fonts** | Nunito font via CDN | Free | None |

## Key config files

- Firebase credentials: `.env` → auto-generated into `src/environments/`
- Firebase + App Check setup: `src/app/app.config.ts`
- Weather API calls: `src/app/services/weather.service.ts`
- Map + geocoding: `src/app/pages/map/map.component.ts`
- Firestore read/write: `src/app/services/data.service.ts`
