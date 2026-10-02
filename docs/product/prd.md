<!-- Generated mirror of the "Launch plan · PRD" page in Itinerists HQ (https://claude.ai/artifact/4KXwSQgFrugzPq9ZfocA9d#prd, private).
     The HQ page is the source of truth: change it there, then regenerate this file.
     Synced 2026-10-02. People's names are deliberately left out (see docs/README.md). -->

# Product requirements · 1.0

_Written **Oct 2, 2026** · for the App Store release · app at **0.9.0** build 546_

What version 1.0 has to do, for whom, and how we will know it works. **Phases** says when, **Making money** says what is paid; this page says what ships. Every requirement carries a priority and its status in the code today.

- 2 Roles the planner, who sets up and invites; the joiners, who never pay

- 5 Goals for 1.0 set-up alone, one shared plan, money settled, stable on iPhone, private

- 32 Requirements 22 built · 10 still to do

- 2 Blockers outside code Firebase paid plan · Apple Developer Program

## 1 · The problem

### Today

A group trip is planned across a group chat, a shared spreadsheet, a notes app and a payment app. One person, the planner, does most of the work and answers the same questions again and again: what time is the flight, where are we staying, who owes whom. Details get buried and nobody has the whole plan.

### What we know

- Three real trips ran on the app: Ireland, Savannah and Berlin, the last with six people across five cities.
- An Instagram poll of 24: **14 would use it as the planner**, 8 if someone else plans, 2 would rather wing it.
- On Berlin, one planner brought five joiners. Joiners are how the app spreads.

## 2 · Who it is for

| Role | What they do | What they need from 1.0 |
|---|---|---|
| Planner — owns the trip · 14 of 24 in the poll | Creates the trip, sets the stops and dates, invites people, keeps the plan current | Set-up in minutes without help; invites that just work; control over members and settings; the paid features later |
| Joiner — invited by a planner · 5 per planner on Berlin | Adds their own flights and expenses, packs, checks what is next | Join from one link and a short sign-up; see the whole plan; never hit a paywall |

## 3 · Goals, and what is out of scope

### Goals for 1.0

1. **A planner sets up a trip and invites people alone,** in about ten minutes.
2. **Everyone on a trip sees the same plan,** with every time in the right zone and labelled with its code.
3. **The group settles money without a spreadsheet,** in any mix of currencies.
4. **The iPhone app is stable on phones we don't own.**
5. **Private by default:** trips are visible only to their members, and our analytics never read content.

### Not in 1.0

- AI itineraries or AI anything.
- Booking inside the app. Booking links come later, from partner programs.
- A native Android app. Android users join through the web app at theitinerists.com.
- Public trips, a social feed, or discovering other people's trips.
- Live flight tracking: it needs a paid flight-data service.
- Purchases. They follow 2 to 3 months after launch, as Making money sets out.

## 4 · How we will know it works

| Measure | Target | Where it is read |
|---|---|---|
| Beta testers who create or join a trip | 8 of 14 | Pulse → Trips |
| Testers back on a second day | 5 of 14 | Pulse → Return rate |
| Trips with two or more joiners | half | Pulse → members per trip |
| Crash-free run on the newest build | 7 days, no new crash type | Crashlytics |
| Strangers on the waitlist before beta | 20 | Waitlist sign-ups (phase 2) |
| After launch: trips per planner, joiners per trip, day-7 return | set from beta numbers | Pulse · targets written at the end of phase 4 |

## 5 · Requirements

**Must** ships in 1.0. **Should** ships in 1.0 if time allows and is first after it. **Later** is planned, not in 1.0.

| Requirement | Priority | Status |
|---|---|---|
| **Accounts and getting started** |
| Sign up with name, username, email and password — the email is required and becomes the sign-in and password-reset address; every field checked as you type | Must | Built |
| Sign in with username or email; reset the password by email | Must | Built |
| Get started: set up a trip, or do it later — every page offers "Set up a trip" and "I have an invite code" until there is one | Must | Built |
| Delete my account — Apple requires it for apps with sign-up | Must | Built |
| Download my data | Must | Not started — phase 5 |
| Confirm the email address at sign-up, gently — a link is emailed at sign-up; nothing waits on it; Home reminds with "Send link" until it is tapped | Should | Built — Oct 2 |
| **Trips and sharing** |
| Create a trip: name, one or more stops with dates, currency — each stop's time zone is found automatically; picking a start date moves to the end date | Must | Built |
| Invite by link or code — valid 7 days; the owner can revoke it; a new person signs up with the code filled in | Must | Built |
| Several trips, one open at a time — switch, archive, leave · the last member leaving deletes the trip · an owner leaving hands ownership on | Must | Built |
| Owner controls — members, remove someone, activity log, restore | Must | Built |
| Hide pages a person doesn't need on a trip | Should | Built |
| Trips delete 30 days after they end unless kept — ships with purchases, never before | Later | Not started |
| **Planning** |
| Itinerary, day by day — list or calendar; drag to reorder; day labels; flights, stays and transport appear on their own | Must | Built |
| Flights per person — departure in the departure airport's zone, arrival in the arrival airport's, each with its zone code | Must | Built |
| Stays, transportation, map, recs per stop, packing with suggestions, outfits | Must | Built |
| Home: countdown, who's going, first up next, balance, weather, packing progress | Must | Built |
| Calendar export (.ics) — "Add to my calendar" on the Itinerary page: your items, flights, stays and transport, in Apple or Google Calendar; free at launch, then part of Trip Pass | Should | Built — Oct 2 |
| PDF export of the itinerary and the settlement sheet | Later | Not started |
| **Money** |
| Shared expenses — who paid, split equally or per person, any currency converted to the trip's, who owes whom, mark settled | Must | Built |
| Private expenses only you can see | Should | Built |
| **Staying in sync** |
| Updates bell and page, per trip — what the group changed, with times and zone codes; "seen" is tracked per trip and across devices | Must | Built |
| Push notifications on the phone — needs Cloud Functions, so the Firebase paid plan | Should | Not started |
| **Platform and trust** |
| iPhone app on the App Store, through TestFlight first | Must | In progress — runs on our phones; needs the Apple Developer Program |
| Web app for anyone not on an iPhone — theitinerists.com, installable to the home screen | Must | Built |
| App Attest on iPhone — proves requests come from the real app; replaces the debug token | Must | Not started — needs Apple |
| Photos in Cloud Storage | Must | Not started — code written, switched off until the paid plan |
| Backups — point-in-time recovery and a weekly export | Must | Not started — needs the paid plan |
| Crash reporting on phones | Must | Built |
| Privacy policy, linked from sign-up and Profile | Must | Built |
| Invite links open the app — universal links | Should | Not started — needs Apple |
| Landing page with a waitlist | Must | Not started — phase 2, before the first reel |
| Staging site and tests on every change — unit, security-rules and end-to-end tests block a merge; master deploys to staging first | Must | Built |

## 6 · Quality bars

| Bar | Requirement | Today |
|---|---|---|
| Fast sign-in | Tap Sign in to Home on screen: 1.5 s or less, median, on 4G | 1.31 s (Oct 2) |
| Stable | No new crash type for 7 days on the newest build | Measured from beta |
| Right times | Every time carries its zone code; flights use their airports' zones | Met · checked against all 418 zones |
| Steady on a phone | Header and tab bar never move; nothing scrolls sideways; fields never zoom the page | Met · an automated test checks every form |
| Secure | Only members read a trip; every request proves it comes from the real app | Met on the web · iPhone waits on App Attest |
| Private analytics | Usage counts visits and edits, never what was written; only the owner can read it | Met · proved by the security-rules tests |

## 7 · The flows that must work end to end

### Planner

1. Downloads the app, signs up, taps **Set up a trip**.
2. Adds the stops and dates, then a flight and where they are staying.
3. Shares the invite link in the group chat.
4. Watches the bell as people join and add their flights.

### Joiner

1. Taps the link; signs up with name, username, email and password, the code already filled in, or joins straight away if signed in.
2. Lands on Home for that trip: countdown, who's going, first up.
3. Adds their own flight and their expenses.
4. After the trip, sees what they owe and marks it settled.

## 8 · Dependencies

| Waiting on | Unblocks | Who |
|---|---|---|
| Firebase pay-as-you-go plan — same free allowances, bills only overage | Photos in Cloud Storage, backups, push notifications, the trip-deletion job | Alayna |
| Apple Developer Program — $99 a year · enrol about a week before the first TestFlight build | TestFlight, App Attest, universal links, the store listing | Alayna |
| Berlin alpha survey — goes out around Oct 10 | The three fixes at the top of phase 1, and the words for the marketing story | Alayna, then both |

## 9 · Decisions still open

- **Push notifications: in 1.0, or first after it?** — The in-app bell already covers each trip. Push needs the paid plan and a little server code; drafted here as Should.

- **Android** — The web app covers Android joiners. A native Android build is a later decision, driven by how many planners ask.
