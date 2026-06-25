# Troupe — App Vision, Architecture & Strategy
> Superpowers brainstorming document. Living file — update as decisions are made.
> Last updated: April 2026

---

## Table of Contents

1. [What We Have Today](#1-what-we-have-today)
2. [The Vision](#2-the-vision)
3. [Brand Identity](#3-brand-identity)
4. [Architecture Redesign](#4-architecture-redesign)
5. [Feature Roadmap](#5-feature-roadmap)
6. [Monetization Plan](#6-monetization-plan)
7. [Marketing Plan](#7-marketing-plan)
8. [Technical Execution Path](#8-technical-execution-path)
9. [Competitive Landscape](#9-competitive-landscape)
10. [Decision Log](#10-decision-log)

---

## 1. What We Have Today

### Tech Stack
- **Angular 19** PWA — installable on iOS/Android via "Add to Home Screen"
- **Firebase Auth** — email/password, invite-code-based registration (closed system)
- **Firestore** — real-time sync across all members, offline backup via localStorage
- **Firebase Storage** — outfit photos
- **Leaflet** — custom interactive map with pins
- **Angular CDK** — drag-and-drop itinerary reordering
- **Angular Service Worker** — offline capability, PWA install

### Current Feature Set (fully built)
| Module | What it does |
|--------|-------------|
| Flights | Arrivals/departures per person, flight countdown, auto-injects into itinerary |
| Itinerary | Day-by-day events, drag-to-reorder, per-person filtering, calendar view |
| Accommodations | Hotel/stay cards with check-in/out, booking refs, forWho filtering |
| Finance | Shared expense log, smart debt splitting, individual/equal splits, settlement tracking |
| Expenses | Personal expense tracker (local only) |
| Packing List | Per-user checklist, cross-device suggestion system |
| Outfits | Per-day outfit log with photo upload |
| Map | Custom pins, categories, interactive Leaflet map |
| Rental Car | Car booking details, driver/passenger tracking |
| Recs | Community tips by category (food, culture, currency, etc.) |
| Admin | Trip config, member management, invite link generation |
| Profile | Avatar, username, password management |

### Current Limitations (what's holding it back)
1. **Single-trip architecture** — `app/tripData` is one Firestore doc. Everything assumes one global trip.
2. **Single Firestore project** — each new trip requires deploying a new Firebase project
3. **Invite-only registration** — no self-service signup; must know someone with admin access
4. **Hardcoded trip-specific strings** — "Savannah," location labels baked into components
5. **No billing** — completely free with no monetization layer
6. **No App Store presence** — PWA only; discoverable only by direct URL
7. **No push notifications** — no way to alert members of new expenses, itinerary changes
8. **Local-only personal data** — expenses and packing lists don't sync across user's own devices
9. **Trip data in one giant Firestore document** — will hit the 1MB document limit at scale
10. **No trip creation UX** — trips are seeded by hardcoded `seed-data.ts`, not user-created

---

## 2. The Vision

**Troupe** is the trip-planning app built for groups of real friends. Not for corporate travel. Not for solo backpackers. For the 8 girls going to Bali, the family reunion in Charleston, the bachelorette weekend in Nashville.

The core value proposition:
> "One app, every detail — flights, itinerary, who owes who, what to pack. Your group stays in sync from the moment someone says 'let's go' to the moment the last suitcase is unpacked."

### Why this wins
- **Splitwise handles money. Google Calendar handles events. Notes apps handle packing.** Nobody built the one app that handles all of it for a specific trip with a specific group. That's the gap.
- **The finance module alone is competitive with Splitwise** — and it's embedded inside full trip context.
- **The invite-code model creates natural virality** — every new member is recruited by someone already in the app.
- **Group trips are emotionally high-stakes** — people will pay for something that reduces the planning stress.

### Who we're building for (primary persona)
**The Planner** — typically a woman 24–35 who ends up being the "trip lead" by default because she's the most organized. She's the one who starts the group chat, books the Airbnb, creates the itinerary spreadsheet, and Venmos everyone at the end. She's exhausted and underappreciated. Troupe makes her feel powerful instead of overwhelmed.

**The Group Member** — doesn't want to plan anything but wants to know what's happening. Checks the app to see tomorrow's itinerary, mark packing items done, see if they owe anyone money. Needs it to be dead simple.

---

## 3. Brand Identity

### Name Options (pick one)
| Name | Why it works | Concern |
|------|-------------|---------|
| **Troupe** | Group, ensemble, traveling together — perfect double meaning | May be seen as theatrical |
| **Flock** | Friends traveling together, birds of a feather | More casual, harder to take premium |
| **Caravan** | Classic group-travel word, evokes adventure | Might read as road-trip specific |
| **Wayfarer** | Evokes wandering, adventure, freedom | Less "group" feel |
| **Pack** | Group travel + packing — double meaning | Taken, too generic |
| **Roam** | Simple, wanderlust | Almost certainly taken |

**Recommendation: Troupe** — premium enough to charge for, memorable, perfectly captures group travel.

### Visual Identity Direction
- **Color palette:** Warm, travel-inspired. Deep terracotta + warm sand + sage green. Not the typical blue-and-white of corporate travel apps.
- **Typography:** Rounded sans-serif for friendliness. Nothing sharp or corporate.
- **Vibe:** Your most organized friend's aesthetic. Clean, warm, slightly editorial. Think: Airbnb x Notion x a travel journal.
- **Logo concept:** A simple pin/map marker made of a group of dots (people) — represents a "troupe" at a location.

### App Icon
- Rounded square (iOS style)
- Terracotta background
- White icon: stylized group of 3 people with a location pin
- Clean, reads well at small sizes

### Tagline options
- "Plan together. Travel together."
- "Every trip. Every detail. Together."
- "The app your group actually uses."
- "Stop planning in a spreadsheet."

---

## 4. Architecture Redesign

### The core problem to solve
Right now every service reads from `app/tripData` — one document, one trip, one Firebase project. To support unlimited trips and users, we need to make trips first-class objects that users can create, join, and switch between.

### New Firestore Data Model

```
/users/{uid}
  displayName: string
  username: string
  avatarEmoji: string
  color: string
  isAdmin: boolean          ← global app admin (us), not trip admin
  subscriptionTier: 'free' | 'pro' | 'group'
  stripeCustomerId?: string
  createdAt: number

/trips/{tripId}
  name: string              ← "Bali Girls Trip 2026"
  description?: string
  destination: string       ← IATA city code or freeform
  destinationLabel: string  ← "Bali, Indonesia"
  startDate: string         ← YYYY-MM-DD
  endDate: string
  currency: string          ← primary currency code
  coverPhotoUrl?: string
  timezone?: string
  createdBy: uid
  createdAt: number
  memberCount: number       ← denormalized for rules/limits
  
  /members/{uid}            ← sub-collection
    role: 'owner' | 'admin' | 'member'
    displayName: string     ← snapshot at join time
    avatarEmoji: string
    color: string
    joinedAt: number

  /invites/{code}           ← trip-scoped invite codes
    createdBy: uid
    createdAt: number
    expiresAt: number
    usedBy: uid[]
    maxUses?: number        ← null = unlimited (pro feature)

  /flights/{flightId}       ← was SheetData.flights[]
  /itinerary/{itemId}       ← was SheetData.itinerary[] (was a giant array in one doc)
  /stays/{stayId}           ← was SheetData.accommodations[]
  /finance/{entryId}        ← was SheetData.finance[]
  /settlements/{key}        ← was app/paidItems
  /recs/{recId}             ← was SheetData.recs[]
  /cars/{carId}             ← was SheetData.rentalCar[]
  /pins/{pinId}             ← was SheetData.mapPins[]
  /outfits/{userId_date}    ← already a sub-collection ✓
  /packing/{uid}            ← per-user packing list (syncs across devices now!)
  /dayLabels/{uid}          ← per-user custom day label overrides

/userTrips/{uid}
  tripIds: string[]         ← fast lookup of "which trips does this user belong to?"
  lastActiveTrip: string    ← restored on next app open
```

### Why sub-collections instead of one giant document
- Firestore documents max at 1MB. A trip with 200 itinerary items, 60 expenses, and pinned photos will exceed this.
- Sub-collections are unbounded. Each item is its own document with its own real-time listener.
- Granular security rules per collection (e.g., only trip members can read/write).
- Enables server-side queries (filter itinerary by date, sort finance by amount) — impossible on arrays in one doc.

### Migration Strategy (current → new)
1. Keep existing `app/tripData` document as-is for existing users
2. Write a one-time migration function that reads the current doc and writes all items to sub-collections under a new `trips/{generatedId}` path
3. Add trip membership record for all existing users
4. Update all services to read from the new path
5. Mark old doc as migrated, stop writing to it
6. After 30 days, delete the old doc

### Service Architecture Changes

**New `TripContextService`** — replaces `TripConfigService`, holds the active trip ID signal:
```typescript
activeTripId = signal<string | null>(null);
activeTrip   = signal<TripDoc | null>(null);
```

All other services receive the trip ID from this service and scope their Firestore paths to `trips/{tripId}/...`. No more `app/tripData`.

**New `TripService`** — CRUD for trips:
- `createTrip(details)` → writes to `/trips/{newId}`, adds creator to `/trips/{newId}/members/{uid}`, adds tripId to `/userTrips/{uid}`
- `joinTrip(code)` → validates invite code, adds user to members sub-collection
- `getUserTrips(uid)` → reads `/userTrips/{uid}`, fetches trip docs in parallel
- `switchTrip(tripId)` → updates `TripContextService.activeTripId`

**Packing service now syncs** — since packing is in `trips/{tripId}/packing/{uid}`, it's real-time across a user's own devices, and members can optionally see each other's lists.

### Security Rules Philosophy
```
// Only trip members can read trip data
match /trips/{tripId}/{document=**} {
  allow read: if request.auth.uid in get(/databases/$(database)/documents/trips/$(tripId)/members/$(request.auth.uid)).data;
  allow write: if [member + role check];
}
// Owners/admins can write config
// Members can write their own flights, packing
// Finance: members can add, only paidBy or admin can edit/delete
```

---

## 5. Feature Roadmap

### Phase 1 — Foundation (Months 1–2)
*Get the architecture right before adding features*

- [ ] Multi-trip Firestore data model (see §4)
- [ ] Trip creation flow — name, destination, dates, currency
- [ ] Trip switcher — home screen shows "My Trips" cards, tap to enter
- [ ] Trip join flow — invite link → validate code → join → enter trip
- [ ] Trip cover photo upload
- [ ] Packing list now syncs across devices (via Firestore per §4)
- [ ] Remove all hardcoded "Savannah" strings from components
- [ ] App rename to Troupe (or chosen name)

### Phase 2 — Polish & Billing (Month 3)
- [ ] Onboarding flow for new users (first-time experience)
- [ ] Bottom tab bar navigation (replaces home grid for mobile feel)
- [ ] Dark mode (system-aware)
- [ ] Stripe integration — Pro subscription
- [ ] Free tier limits enforcement (1 active trip, 6 members)
- [ ] Upgrade prompts at friction points
- [ ] "Trip complete" archive state — trip ends, moves to archived view
- [ ] Trip cover photo for each trip card

### Phase 3 — Differentiating Features (Month 4)
- [ ] AI Itinerary Builder — Claude API integration:
  - User types: "5 days in Kyoto, food-focused, 4 people, moderate budget"
  - Returns: structured itinerary ready to import into their trip
  - Pro feature: 20 uses/month; unlimited on Group tier
- [ ] Real-time flight status — AviationStack API
  - Enter flight number → get live gate, status, delay alerts
  - Push notification if flight is delayed
- [ ] Activity voting — suggest an activity, group votes thumbs up/down
  - Activities with enough votes auto-promote to itinerary
- [ ] Shared photo album per trip day (beyond just outfits)
- [ ] Budget tracker — set a trip budget per person, show spend progress
- [ ] Currency converter with live rates (Open Exchange Rates API)

### Phase 4 — Distribution & Growth (Month 5–6)
- [ ] Capacitor wrapper — native iOS/Android app from Angular codebase
- [ ] App Store + Google Play submission
- [ ] Push notifications (FCM)
  - "Sarah added a new expense: Dinner $120"
  - "New itinerary item added for Day 3"
  - "Your flight departs in 2 hours"
- [ ] Web Share API — native share sheet for inviting friends
- [ ] PDF export — full trip summary as printable PDF
- [ ] Trip templates — "Bachelorette Weekend," "Beach Week," "City Break"

### Phase 5 — Scale Features (Month 7+)
- [ ] Travel document vault — passport photos, e-tickets, booking confirmations
- [ ] Venmo/PayPal/Zelle settlement links generated from finance screen
- [ ] Public trip discovery — optional "share this itinerary" with anonymized copy-to-use
- [ ] Group video/voice calls embedded (Daily.co API)
- [ ] Offline-first architecture — full trip accessible with zero connectivity
- [ ] Multi-currency finance — expense in any currency, settle in another
- [ ] Sub-groups within a trip — "Team A goes to the spa, Team B goes to the museum"
- [ ] Task assignments — "Alayna books restaurant, Megan handles airport transport"

### Feature Ideas Parking Lot (evaluate later)
- Countdown widget for iOS/Android home screen
- Trip playlist integration (Spotify API) — collaborative playlist per trip
- AI packing suggestions by destination + weather + trip type
- "Trip memories" — auto-assembled photo book after the trip ends
- Vibe check voting — before the trip, vote on trip style ("adventure vs. relaxation")
- Local weather per itinerary day (already partially built)
- Anonymous complaints box — "someone keeps leaving dishes in the sink" 😂
- Shared notes/links doc per trip day
- Integration with Google Maps for directions from itinerary items
- Restaurant reservation links from itinerary items

---

## 6. Monetization Plan

### Pricing Tiers

#### Free — "Explorer"
> Perfect for trying it out. One trip at a time with a small group.
- 1 active trip at a time
- Up to 6 members per trip
- All core features: itinerary, flights, accommodations, basic expense splitting
- 5 invite uses per trip
- 200MB photo storage per trip
- Troupe branding on exported PDFs

#### Pro — $4.99/month or $39.99/year (save 33%)
> For the person who's always planning. Your trips, your way.
- Unlimited active trips
- Up to 15 members per trip
- AI Itinerary Builder (20 uses/month)
- Real-time flight tracking & delay push alerts
- Photo albums (10GB per trip)
- Budget forecasting + analytics
- Travel document vault
- PDF export (no branding)
- Unlimited invite uses

#### Group — $2.99/member/month (billed per trip, shared among members)
> Everyone chips in. Everyone gets Pro.
- Everything in Pro
- Up to 50 members per trip
- AI Itinerary Builder (unlimited)
- 50GB shared photo storage
- Venmo/PayPal/Zelle settlement links
- Priority support
- Early access to new features

### Revenue Projections (conservative model)

| Month | MAU | Paying Users | Avg ARPU | MRR |
|-------|-----|-------------|----------|-----|
| 6     | 1,000 | 80 (8%) | $4.50 | $360 |
| 12    | 5,000 | 600 (12%) | $4.80 | $2,880 |
| 18    | 15,000 | 2,400 (16%) | $5.00 | $12,000 |
| 24    | 40,000 | 8,000 (20%) | $5.20 | $41,600 |

Key assumption: Group trips are inherently viral — each trip invites 5–15 new people to the platform. CAC is low because users recruit each other.

### Affiliate Revenue (secondary stream)

When a user adds an accommodation or flight, surface affiliate booking links:

| Partner | Commission | Trigger |
|---------|------------|---------|
| Booking.com | 4–6% of booking | User views "Book this stay" |
| Airbnb | $25–75 per booking | Referral link in accommodations |
| Kayak/Skyscanner | 1–3% or per-click | Flights screen "Book this flight" |
| GetYourGuide | 8% | Activity booking from itinerary |
| World Nomads | $15–30 per policy | Travel insurance prompt on trip creation |
| SafetyWing | 10% | Same |

Conservative: 10K users booking 2 trips/year avg $300 in bookings = **$60K/year in affiliate revenue** at scale.

### One-Time Purchases (additional)

- **Premium Packing Templates** — $1.99 per template pack
  - "Bachelorette Beach Week," "Euro Backpacking," "Ski Trip," "Luxury City Break"
  - Curated by travel bloggers → revenue share
- **Trip Themes/Skins** — $2.99 to unlock custom color themes per trip
- **AI Credits Top-Up** — $4.99 for 50 additional AI itinerary generations

### Freemium Strategy — Where to Create Friction

The free tier must be genuinely useful (or no one converts) but must create pain that Pro solves:

| Free Limit | The Friction | The Upgrade Message |
|-----------|-------------|---------------------|
| 1 active trip | User creates second trip | "You already have an active trip. Upgrade to Pro to plan unlimited trips simultaneously." |
| 6 members | 7th person tries to join | "Your troupe is at capacity. Upgrade so everyone can join." |
| No push notifications | User misses a finance update | "Get instant alerts when expenses are added. Upgrade to Pro." |
| No AI builder | User spends 2hrs planning | "Let AI plan your first draft in 30 seconds. Try Pro." |
| PDF has branding | User shares PDF | "Remove Troupe branding from your exports with Pro." |

The most powerful trigger: **the group member limit**. The planner doesn't pay for themselves — she pays because she can't leave her friend out.

---

## 7. Marketing Plan

### Target Audiences (ranked by priority)

**Primary: The Planner (24–35, female)**
She's in 4 group chats right now planning trips. She uses Google Sheets for itineraries and Splitwise for expenses but hates switching between tools. She's the one who gets asked "wait, what time does the hotel check-in?" and has to dig through 47 emails. She will evangelize this app to every group she's in if it genuinely solves her problem.

**Secondary: Bachelorette Party Planners**
This is the highest-value group trip category. Average bachelorette trip spend: $500–$2,000/person. The maid of honor is under intense pressure to make it perfect. She will pay for tools that reduce her stress.

**Tertiary: Post-college friend groups (22–30)**
The "annual girls trip" crowd. These trips are planned 3–6 months in advance with 4–12 people. High engagement, high word-of-mouth.

**Later: Family Reunions, Multigenerational Travel**
Larger groups, older users, less tech-savvy — different UX requirements. Address after achieving product-market fit with primary audience.

### Channel Strategy

#### TikTok (highest priority, organic)
This is how you build the initial audience before spending any money.

**Content pillars:**
1. **"POV: you're the friend who plans everything"** — show the app handling all the chaos
2. **Bachelorette planning content** — massive search volume, passionate audience
3. **"I planned our whole girls trip in this app"** — real trip walkthroughs
4. **Finance/splitting drama content** — "here's how we actually track who owes who" — relatable
5. **Before vs. after** — "before Troupe (chaotic group chat) vs. after (organized app)"
6. **"React to my trip itinerary"** — share a completed itinerary, get engagement

Posting cadence: 5x/week minimum. First 3 months focus entirely on organic growth.

**TikTok SEO targets:** "bachelorette trip planning," "girls trip app," "group travel app," "how to plan a group trip," "travel planning hack"

#### Instagram (complementary to TikTok)
- Reels mirroring best TikToks
- Stories: real trip "day in the life" content
- Carousels: "10 things to do in [destination]" — builds a travel content audience that also wants the planning tool
- Collaborations with travel accounts

#### Pinterest (high-intent discovery)
Pinterest users are in planning mode. They're already searching for travel content.

**Pin content:**
- "Girls trip packing list for [destination]"
- "Bachelorette itinerary template"
- "How to split expenses on a group trip"
- "Group trip planning checklist"

Each pin links to a landing page for that content type, with app download CTA. Pinterest users convert at 2x the rate of social media because they're already in decision-making mode.

#### Travel Influencer Partnerships
**Micro-influencer strategy** (10K–150K followers) — higher engagement, more affordable:

Target niches:
- Bachelorette/bridesmaid accounts
- Girls trip / female travel
- Budget group travel
- "Friend group" lifestyle content

Offer structure:
- Free Pro account (lifetime, for genuine use)
- 20% affiliate commission on subscriptions from their link
- $200–500 flat fee for dedicated content (larger accounts)

Do NOT do gifted deals with massive travel accounts — they have low engagement and their audience doesn't trust app recs from someone paid to promote everything.

#### Reddit (community seeding)
Relevant subreddits:
- r/TravelHacks — "built a group travel planning app, here's what I learned"
- r/solotravel / r/travel — when group trip discussions come up
- r/weddingplanning — bachelorette party planning threads
- r/bachelorette — direct audience
- r/personalfinance — the expense splitting angle
- r/sideprojects — developer community launch

Rule: always add genuine value. Never post "check out my app." Share the app only when it's the natural answer to someone's specific problem.

#### Product Hunt Launch
This builds developer/tech credibility and drives initial user surge.

Pre-launch checklist:
- Build a "notify me" landing page 30 days before
- Collect 200+ emails of interested users from existing network
- Line up 10+ hunters who will upvote and comment day-of
- Schedule for a Tuesday (highest traffic)
- First comment from a real user describing a real problem it solved
- Aim for #1 Product of the Day in the Travel category

Target: 800+ upvotes, 5,000+ website visitors on launch day.

#### Email Marketing
Build a list from day one. Every person who signs up to the waitlist or creates an account gets sequenced emails:

1. **Day 0:** Welcome + "here's how to plan your first trip in 5 minutes"
2. **Day 3:** Case study — real trip planned with the app
3. **Day 7:** Finance feature deep dive — "the best part of the app most people miss"
4. **Day 14:** "Planning another trip? Here's how to invite your group"
5. **Day 30:** Upgrade prompt — personalized based on feature usage

#### App Store Optimization (ASO)
Once native app is live (Phase 4):

**Keywords to target:**
- "group trip planner" (high volume)
- "bachelorette trip planner" (high intent)
- "travel expense splitter" (moderate volume)
- "vacation itinerary app" (moderate volume)
- "splitwise travel" (competitor branded)
- "girls trip app" (emerging)

**Screenshots:**
1. Hero: Trip home screen with countdown + quick links
2. Finance: "Who owes who" summary screen
3. Itinerary: Day view with beautiful cards
4. Map: Pins for the trip
5. Packing: Checked off items with group member avatars

**App Store Review Strategy:**
- In-app prompt after 3 successful sessions AND after user completes their first expense entry (moment of value)
- Never prompt after a frustrating moment (failed action, error state)

#### Paid Ads (Month 6+, not before)
Don't spend on paid acquisition until organic is working and conversion is proven. Then:

- **TikTok Spark Ads** — amplify organic content that's already performing
- **Instagram/Facebook** — retargeting people who visited the landing page
- **Google** — "group trip planner app" search intent
- **Pinterest Promoted Pins** — amplify high-performing organic pins

Start budget: $500/month test. Scale only what converts.

### Launch Sequence

```
Month 1:  Architecture rewrite (multi-trip data model)
          → Buy domain, set up landing page with email capture
          → Start TikTok account (don't announce app yet — build audience with travel content)

Month 2:  App rebrand (Troupe), onboarding flow, trip creation/switching
          → First TikTok showing the app — keep it casual, not promotional

Month 3:  Stripe billing + Pro tier
          → Invite 20 "founding users" from network — friends who travel a lot
          → Collect feedback, iterate fast

Month 4:  Capacitor native app build
          → Submit to App Store + Google Play (2-3 week review process)
          → Record TikToks while building — "building my travel app" dev-log content

Month 5:  Push notifications live
          → Product Hunt launch day
          → DM 30 micro-influencers with a pitch

Month 6:  Full marketing push
          → TikTok posting schedule: 5x/week
          → Pinterest boards live
          → 3 influencer partnerships active
          → First paid ad tests ($500 budget)

Month 9:  First 1,000 paying users milestone
          → Case studies from real trips
          → Expand affiliate partnerships
          → Press outreach: TechCrunch, The Points Guy, travel bloggers
```

### Referral Program
The most powerful growth lever for this app is built-in: every trip invitation is a referral.

Amplify this with:
- **Trip Owner bonus** — owner gets 1 free month of Pro for every 3 people who join their trip
- **Joinee bonus** — new user who joins via invite gets 30 days Pro free
- **Social proof moment** — when a user joins, they see "[Planner Name] is sharing this trip with you" — personal touch that builds trust before they've even used the app

---

## 8. Technical Execution Path

### Immediate Priorities (no other coding until these are done)

#### Priority 1: Multi-trip Architecture
This is the load-bearing change everything else depends on.

Files that need refactoring:
- `data.service.ts` — entire service rewritten around `trips/{tripId}/` sub-collections
- `trip-config.service.ts` → becomes `trip-context.service.ts`
- Every page component that injects DataService
- Firestore security rules (add new rules for trip sub-collections)
- `app.routes.ts` — add `/trips`, `/trips/new`, `/trips/:id` routes
- `trip.models.ts` — add `TripDoc`, `TripMember` interfaces

**New services needed:**
- `trip.service.ts` — create, join, list, delete trips
- `trip-context.service.ts` — holds active tripId signal, persists to localStorage

**Migration script** (runs once on first load after update):
- Reads `app/tripData` document
- Creates `trips/{uuid}` document with all sub-collections populated
- Creates `/userTrips/{uid}` entry for all current users
- Sets `migrated: true` on old doc

#### Priority 2: Trip Creation UX
New screens:
- `/trips` — "My Trips" list with + button to create new
- `/trips/new` — form: trip name, destination, dates, primary currency, optional cover photo
- Home screen shows active trip name + countdown, with "Switch Trip" button

#### Priority 3: Stripe Billing
- `stripe.service.ts` — client-side Stripe.js integration
- Firebase Function: `createCheckoutSession` — creates Stripe session, returns URL
- Firebase Function: `stripeWebhook` — handles subscription events (created, cancelled, past due)
- Firestore: `users/{uid}.subscriptionTier` updated by webhook
- All Premium feature gates check `userService.subscriptionTier() === 'pro'`

### Native App (Capacitor)
Add Capacitor to existing Angular project without rewriting anything:
```bash
npm install @capacitor/core @capacitor/cli
npx cap init Troupe com.troupe.app
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

Capacitor plugins to add:
- `@capacitor/push-notifications` — FCM push notifications
- `@capacitor/share` — native share sheet for invites
- `@capacitor/haptics` — haptic feedback on key actions
- `@capacitor/camera` — better photo capture for outfits
- `@capacitor/local-notifications` — flight countdown alerts
- `@capacitor/status-bar` — control status bar color

### AI Integration (Claude API)
For the AI Itinerary Builder:

```typescript
// Firebase Function: generateItinerary
const response = await anthropic.messages.create({
  model: 'claude-opus-4-6',
  max_tokens: 2048,
  messages: [{
    role: 'user',
    content: `Generate a ${tripDays}-day itinerary for ${destination}.
    Group: ${memberCount} people
    Style: ${style}
    Budget: ${budget}
    Interests: ${interests}
    
    Return as JSON array of itinerary items with fields:
    date, time, activity, location, category, notes`
  }]
});
```

Decrement AI credit counter in Firestore after each successful call. Show counter in UI.

### Push Notifications Strategy
Firebase Cloud Messaging (FCM) triggered by Firestore Functions:

Trigger events:
- New finance entry added → notify all trip members except adder
- New itinerary item added → notify all trip members except adder
- Packing suggestion sent → notify recipient
- Flight status change (via AviationStack webhook) → notify flight owner
- Trip invite accepted → notify trip owner
- Settlement marked paid → notify relevant parties

---

## 9. Competitive Landscape

| App | Strength | Weakness | How Troupe Wins |
|-----|---------|---------|----------------|
| **Splitwise** | Best-in-class expense splitting | No itinerary, flights, packing, map, accommodations | All-in-one; trip context makes splitting smarter |
| **TripIt** | Auto-parses booking emails, solid itinerary | No group collaboration, no expense splitting, no packing | Group-first; built for coordination not just organization |
| **Google Trips** (discontinued) | Google integration | Dead | Market gap we fill |
| **Wanderlog** | Decent group planning, nice map | No expense splitting, clunky mobile experience, less social | Finance + beautiful mobile UX |
| **TripAdvisor / Viator** | Huge content database | Not a planner; booking tool | Different intent; we can affiliate with them |
| **BeRealTravel** | Social trip sharing | Not a planner | Different use case |
| **Notion trip templates** | Flexible | Not a real app, huge learning curve, no sync for non-tech users | Ready-made, no setup required |

**The honest gap in the market:** Nobody has nailed group trip planning + expense splitting in a mobile-native, beautifully designed app with viral invite mechanics. Splitwise is for money. TripIt is for business travel. Wanderlog is close but misses finance and has poor mobile UX.

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|---------|-----------|
| Apr 2026 | Keep Angular (don't rewrite in React Native) | Existing codebase is high quality; Capacitor makes it native without a rewrite. Rebuilding would delay launch 6+ months. |
| Apr 2026 | Prioritize multi-trip architecture before features | Everything else is blocked by this. Adding AI features to a single-trip app adds complexity without enabling growth. |
| Apr 2026 | Freemium with trip-member limit as primary friction | The planner pays not for herself but to include her friends. This is a more compelling upgrade driver than feature gates alone. |
| Apr 2026 | Start TikTok immediately, paid ads never before Month 6 | Organic first. Paid without proven conversion wastes money. Build audience before spending. |

---

## Open Questions

1. **What's the app name?** Need to decide before any public-facing work.
2. **Solo trips vs group-only?** Do we allow trips with 1 person? (Probably yes — solo traveler still wants itinerary, finance tracking, packing list)
3. **Trip archival model?** When a trip ends, does it auto-archive? Can you view archived trips without a Pro subscription?
4. **Offline-first depth?** How much trip data do we pre-cache for offline? All itinerary? Finance? Photos? (Photos are too large for full offline)
5. **Which AI model for itinerary builder?** Haiku (fast, cheap, less capable) vs Sonnet (balanced) vs Opus (best quality, most expensive). Probably Sonnet for Pro, Haiku for Free tier.
6. **When to add Google OAuth?** Username/password works but Google sign-in reduces friction significantly. Worth adding in Phase 2.
7. **Group pricing model: per-member or per-trip?** Per-member is fairer but harder to explain. Per-trip is simpler but creates incentive to keep groups small.
8. **Currency for settlement?** Currently USD-only. Multi-currency is a big but necessary feature for international trips.
9. **What happens to local packing/expense data when migrating to cloud sync?** Need a migration UX that imports existing localStorage data.

---

*This document is the living strategy for Troupe. Update it as decisions are made, features ship, and the market gives feedback.*
