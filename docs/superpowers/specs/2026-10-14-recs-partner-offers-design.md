# Partner offers on Tips & Recs: eSIMs and travel insurance

Date: 2026-10-14 · Status: approved by the owner · Board: #474

## What and why

Before going abroad, people need mobile data and many want travel insurance. The owner has
referral links with partners: three eSIM apps (prices differ by country, so people compare them) and
one travel insurer. We show them softly on Tips & Recs, only to people whose trip leaves their own
country. This is the first step of the "enhancements, not new features" money plan (see
`docs/product/making-money.md`). It follows the standing rule that hand-offs stay low-key.

## What people see

Two rec cards at the end of the **Tips** group, with the rest of the recs (#476, the owner's call after seeing them above the filters). They show under the All and Tips filters. If the trip has no tips yet, a Tips group is added just for them. On multi-stop trips they belong to the whole trip: the Tips group of the "Anywhere" section, also when one stop is chosen. Tokens and shared classes only:

| Card | Title | Subline |
|---|---|---|
| eSIMs | 📶 Need data abroad? | "Skip roaming fees in {countries}" (the trip's foreign countries, e.g. "Germany & Czechia"; "and N more" past two) |
| Insurance | 🛡 Covered if plans change? | "Travel insurance for trips abroad" |

- **When:** only when at least one stop on the trip is in a different country from this person's
  phone (see "Abroad, per person"). Both cards follow the same rule. With no partners configured, a
  card isn't shown.
- **Hide:** each card has a small "Hide" link. Hidden cards stay hidden for that trip on that device
  (localStorage, key per trip and card). It never asks twice.
- **Tap a card:** it opens a pop-up (the app's existing sheet/dialog pattern; closes with ✕, a tap
  outside and Escape; focus moves into it and back to the card).

**eSIM pop-up, two tabs:**

1. **Pick an eSIM**: one row per partner, in the configured order. Each row has the name, the
   offer ("$3 off your first eSIM"), the code in a tap-to-copy chip ("Copied" for 2 s, falling back
   to selecting the text when the clipboard is refused), and an **Open** button. Below the rows:
   "Prices differ by country, so it's worth comparing them." (no count, so the wording holds if partners change)
2. **What's an eSIM?**: plain words for people who have never heard of one, so they feel
   confident enough to tap a link. The copy is in `src/app/utils/esim-guide.ts`. It opens with one sentence
   on what an eSIM is, then four numbered steps:
   1. Pick a plan before you go (with a data amount guide).
   2. Install it at home, on Wi-Fi.
   3. Switch it on when you land (which settings, and turning roaming off for your usual line).
   4. That's it.
   It ends with "Good to know": which phones work and a quick check, unlocked phones, calls, and
   switching back at home. A button returns to the partner list.

**Insurance pop-up:** one row per insurance partner (name, a one-line description from the config,
**Open**). There are no tabs.

**Both pop-ups end with:** "We may earn a small commission if you buy through these links. It
doesn't change your price." This is required by partner terms and US advertising rules.

**Open** is a normal link (`target="_blank" rel="noopener sponsored"`). In the browser it opens a
tab; in the iPhone app it opens Safari, the same as the app's other outside links.

## Abroad, per person

- A pure helper, `src/app/utils/abroad.ts`, with a spec beside it:
  `foreignCountries(stopZones: string[], deviceZone: string): string[]` returns the trip's country
  codes that differ from the phone's, in stop order, de-duplicated. `countryName(code)` gives the
  display name (via `Intl.DisplayNames`, falling back to the code).
- Zone → ISO country code comes from a generated file, `src/app/utils/zone-countries.ts`, written by
  `scripts/gen-zones.js` from the same source as Pulse's `zones.mjs` (`@vvo/tzdb`), so the two
  can't drift. It is codes only, to keep it small.
- **US territories count as the US:** PR, VI, GU, AS and MP map to US for both the phone and the
  stops. A US phone visiting San Juan sees nothing; a phone in San Juan visiting Chicago sees
  nothing.
- **Stop zones:** each destination's `timeZone` (`tripDestinations()`), plus the trip's primary
  `timeZone`. Stops without a zone are skipped. If no stop has a zone, there are no cards.
- **The phone's zone:** `deviceZone()` from `src/app/utils/zones.ts`. An unknown zone means no cards.

## Where the offers live

`_config/partners` in Firestore, written by `scripts/set-partners.js` from the gitignored
`scripts/partners.local.json`. It follows `scripts/set-survey.js`: `--staging`, a dry run by default,
`--run` to apply, `--off` to switch off, and it checks the key's `project_id`. No links, codes or
names are in the repository.

```jsonc
// _config/partners (PartnersConfig in trip.models.ts)
{
  "active": true,
  "esim": [      // shown in this order
    { "id": "airalo", "name": "Airalo", "offer": "$3 off your first eSIM", "code": "…", "url": "https://…" }
  ],
  "insurance": [
    { "id": "safetywing", "name": "SafetyWing", "offer": "Travel medical insurance, by the week", "url": "https://…" }
  ]
}
```

- `id` is `[a-z0-9-]{1,32}` (it's what gets counted); `code` is optional; `url` must be `https://`
  and goes through `safeLink()` when shown.
- **Rules:** the existing `_config/{docId}` rule already allows `get` for anyone signed in and no
  writes. There's no rule change, only new rules tests for `_config/partners` (signed-in read
  allowed, signed-out read denied, signed-in write denied).
- **Service:** `PartnersService` reads the document once per session with `getDoc` (offers rarely
  change) and exposes `partners()` as a signal. On an error it logs a warning and shows no cards.
- **Demo build:** the demo seed gets a `_config/partners` doc with fictional partners and
  `example.com` links, so the end-to-end tests have something to show. No real codes.

## Counting taps (for Pulse)

- Each **Open** tap records one `_activity` event: `type: 'offer'`, `page: '/recs'`, plus a new
  field `offer` set to the partner id, e.g. `"airalo"`. It records no trip content and no code.
- **Rule change:** `_activity` allows type `'offer'` and the optional key `offer` (short string, only
  with type `offer`). Rules tests: an allow, a deny for a bad type, a deny for `offer` on a `page`
  event, a deny for an overlong id.
- **Pulse:** a small "Partner taps" card (partner, taps, people) following the range, trip and Hide
  choices. Test trips and accounts stay excluded, as everywhere in Pulse. Covered by `test:pulse`.
- Copying a code isn't counted.

## Copy, privacy policy, docs

- **Privacy policy (`src/app/pages/privacy/`):** a short paragraph saying the app shows partner
  links. Tapping one opens the partner's site, which has its own privacy policy and may know you
  came from us. We count taps per partner, never who bought what.
- `docs/apis.md`: lines for the four partner hosts, as outside links (no API calls) and the
  config script.
- **No security-policy change:** these are links that leave the app, not requests it makes.

## Testing

- **Unit:**
  - `abroad.spec.ts`: same country, different country, US territories both ways, unknown zones,
    de-duplication and order.
  - The Recs component: cards show and hide with the abroad rule and with partners present or
    absent; Hide persists per trip; the pop-up tabs switch; copy falls back when the clipboard
    refuses; Open records one `offer` event.
  - `PartnersService`: reads once; an error means no cards.
- **Rules tests** as listed above. **Pulse tests** for the card.
- **End-to-end (demo, phone size):** on an abroad trip the eSIM card shows; it opens with two tabs;
  the explainer tab shows; Hide removes the card after a reload. Form fields stay at least 16px
  (the existing no-zoom check).
- **Staging:** `set-partners.js --staging --run` with test links, then a look on the staging iPhone
  app before production.

## Out of scope

- Partner offers on other pages (Home, packing). They may come later; Recs only for now.
- Choosing offers by country or price (e.g. "cheapest for Germany"). We only point to comparing.
- Any purchase inside the app.
