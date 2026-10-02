<!-- Generated mirror of the "Launch plan · Phases" page in Itinerists HQ (https://claude.ai/artifact/4KXwSQgFrugzPq9ZfocA9d#phases, private).
     The HQ page is the source of truth: change it there, then regenerate this file.
     Synced 2026-10-02. People's names are deliberately left out (see docs/README.md). -->

# Launch plan: phases to the App Store

_Plan set **Sep 29, 2026** · revised **Sep 30, late** · app at **0.9.0** build 406_

The alpha and six phases, in order. **The alpha is still wrapping up:** Berlin is on the road until Oct 9 and its survey goes out once everyone is home. Phase 1 can start alongside. Marketing now sits between prep and beta, so the app has an audience before it has testers. Each phase ends with a plain test, and the hard-to-change things (where data lives, the paid plan) are done before anyone new arrives.

- Now · Alpha · wraps mid-Oct
- Alongside · 1 · Prep for beta · about 2 weeks
- Then · 2 · Marketing · 2 – 3 weeks
- Then · 3 · Beta · 2 – 4 weeks
- Then · 4 · Fix from feedback · 1 – 3 weeks
- Then · 5 · Prep for launch · 2 – 3 weeks
- Then · 6 · Launch · 1 – 2 weeks

> **Before paying Apple:** Only four things need the $99 Developer Program: **App Attest, the TestFlight build, universal links, and the store listing.** Everything else in phases 1, 2 and 5 can be done first, and phase 2 needs no Apple account at all. Enrolment approval takes a day or two, so enrol about a week before the first TestFlight build rather than today.

## Alpha: Real trips, real people

_Feb 25 – mid Oct 2026 · wrapping up_

**Goal:** the app has carried three real trips on a moving codebase. What is left is hearing back from the last group and writing it down before anything else is built on top.

- [x] **Ireland and Savannah** — planned and travelled on the live app, features added mid-trip _(owner: Both)_
- [x] **Instagram poll** — 24 votes · 14 would plan, 8 would join, 2 wing it, 0 don't travel · the 14 are the beta list _(owner: Alayna)_
- [x] **Alpha survey built** — Google Form, published Sep 30 on the owner's Google account · what worked, what stalled, what they'd fix _(owner: Both)_
- [ ] **Berlin comes home** — trip ends Oct 9 · nothing moves off the-itinerists.web.app until then _(owner: Both)_
- [ ] **Send the survey to the Berlin group** — around Oct 10, once they are home and the trip is fresh · one personal message each, not a broadcast _(owner: Alayna)_
- [ ] **Read the answers into the next two phases** — the three most-mentioned fixes go to the top of phase 1; the words people use for the app become the marketing story _(owner: Both)_

> **Phase ends when:** Most of the Berlin group has answered, the three things they would fix are written down, and the sentence they use to describe the app to a friend is written down too.

## Phase 1: Prep for beta

_Alongside the alpha wrap-up · about two weeks · mostly Claude_

**Goal:** everything a tester would notice, and everything that is painful to change once real data exists. Storage is set up as it will be at launch, so nothing migrates under testers' feet.

- [x] **Security lockdown** — profiles private, no user listing, sign-up never confirms an email, joining needs a live invite _(owner: Claude)_
- [x] **Privacy policy** — theitinerists.com/privacy · linked from Profile and sign-up _(owner: Claude)_
- [x] **Native iOS shell** — Capacitor · icon and launch screen · runs on Alayna's iPhone _(owner: Claude)_
- [x] **Usage analytics** — own event log + Pulse dashboard at theitinerists.com/pulse/ (filters, return rate, visits, around the trip, platform + versions) + Google Analytics on the web · Berlin's activity is arriving _(owner: Claude)_
- [ ] **Firebase pay-as-you-go plan + budget alerts** — now · same free allowances, bills only overage · creates the Storage bucket, unlocks backups and Cloud Functions · see Storage & costs _(owner: Alayna)_
- [x] **Staging project** — now · a second Firebase project with the same rules, so our own testing never touches real data _(owner: Claude)_
- [x] **Crash reporting on phones** — Crashlytics live since Sep 30 · the console shows the iOS app and two test crashes from the simulator, symbolicated · every error the app logs on a phone also lands there _(owner: Claude)_
- [ ] **Photos to Cloud Storage** — after the paid plan · create the bucket, deploy storage rules, flip the flag · the one-time move of the 19 existing photos waits until Berlin is home (Oct 10) _(owner: Claude)_
- [ ] **Fixes from the alpha survey** — after the survey comes back (mid Oct) · anything that blocked or confused them first, then asks two or more people made · the same order beta fixes will use _(owner: Both)_
- [ ] **Apple Developer Program** — $99/yr · approval takes a day or two, so enrol about a week before the first TestFlight build · everything above and all of phase 2 can happen before paying _(owner: Alayna)_
- [ ] **Real App Check on iOS** — needs Apple · App Attest through a Capacitor plugin · retire the debug token _(owner: Claude)_
- [ ] **First TestFlight build** — needs Apple · external group · one light Apple review · builds last 90 days _(owner: Both)_

> **Phase ends when:** A TestFlight build is installed on Alayna's and the co-planner's phones from the TestFlight app, photos upload to Cloud Storage, the budget alert email has arrived once, and the alpha survey's top fixes are shipped. (A crash showing up in Crashlytics: done Sep 30.)

## Phase 2: Marketing

_Two to three weeks · Alayna on camera, Claude on the page · can overlap phase 1_

**Goal:** find out whether people you don't know want this before anyone is invited to test it. Trial reels show the real app on a real trip. Traction is counted, not felt.

- [ ] **The one-line story** — who it is for and what it replaces (the group chat, the shared spreadsheet, the five apps) · lifted from the poll comments and the Berlin survey, in their words _(owner: Alayna)_
- [ ] **Landing page + waitlist on theitinerists.com** — before the first reel, so it has somewhere to send people · what it is in one line, three screenshots, one email field, "we'll tell you when it's on the App Store" · moves the waitlist form up from phase 5 · no Apple account needed _(owner: Claude)_
- [ ] **Three trial reels** — 15 – 30 s screen recordings of the real app on the phone with a voice-over: the countdown and who's coming, who owes who, the packing list ticking down · shoot on Berlin data while it is fresh _(owner: Alayna)_
- [ ] **Post where the poll ran** — Instagram first, TikTok if the same clip fits · one reel a week, the same hook told three ways · watch which one gets saves, shares and "when?" DMs _(owner: Alayna)_
- [ ] **Count what matters, weekly** — views, saves, shares, waitlist sign-ups, DMs · one sheet, one row a week · a hook is "working" when strangers sign up, not when friends like it _(owner: Both)_
- [ ] **Keep the 14 planners for beta** — they are the tester list · the reels are for people who have never heard of the app _(owner: Alayna)_

> **Phase ends when:** Three reels are up, the waitlist has its first 20 sign-ups from people you don't know, and one hook has clearly beaten the other two. That hook becomes the first line of the store listing.

## Phase 3: Beta

_Two to four weeks · Alayna runs it_

**Goal:** real people plan a trip without you in the room, and you find out what breaks and what confuses. Bugs first, opinions second.

- [x] **Write the beta plan first** — drafted Sep 30 · open "Beta details" below: goals and numbers, three waves, the invite, install steps, one channel, three surveys, bug template, weekly rhythm, thank-you · five decisions left for Alayna _(owner: Both)_
- [ ] **Invite the 14 planners one at a time** — the "Yes!! As the planner" voters · a personal message with the TestFlight link, not a broadcast _(owner: Alayna)_
- [ ] **One ask per tester** — set up one trip, real or pretend, and bring at least two joiners — that exercises invites and shared editing _(owner: Alayna)_
- [ ] **One place for feedback** — a group chat or a short form · ask for the version line from Profile with any report _(owner: Both)_
- [ ] **Watch the instruments** — Crashlytics, the error log, Pulse, Firestore usage, and who actually came back after day 1 _(owner: Claude)_
- [ ] **Fresh build every week** — fixes ship as new TestFlight builds so testers see their reports land _(owner: Claude)_

> **Phase ends when:** At least eight testers have created or joined a trip, five have come back on a second day, and a week has passed with no new crash types.

> **Could this be shorter?:** Yes. The alpha already proved the web app with people who know you. What it never tested is the **native build on phones you don't own**, which is exactly what the App Store ships. The smallest honest version is **two weeks with the 14 planners on TestFlight**, phases 3 and 4 folded together: fix as reports come in, stop when a week passes with no new crash types. Skipping TestFlight altogether means the first crash on an unfamiliar iPhone model is reported by a stranger in a store review.

**Beta details · the invite, the waves, install steps, the surveys, the bug template, the thank-you · drafted Sep 30, written to be sent as-is**

- 14 Invited the "Yes!! As the planner" voters, in three waves

- 8 — + Created or joined a trip the first exit number

- 5 — + Back on a second day Pulse → Return rate

- 7 — days No new crash types Crashlytics, on the newest build

### 1 · Goals, and how each is measured

| Goal | Number | Where it is read |
|---|---|---|
| The native build works on phones we don't own — the one thing the alpha never tested | 7 days, no new crash types | Crashlytics → Issues, filtered to the newest build |
| People get through set-up alone | 8 of 14 create or join a trip | Pulse → Trips (members per trip) and Headcount |
| People come back | 5 of 14 active on a second day | Pulse → Return rate, "back next day" and "within 7 days" |
| Planners bring joiners — invites and shared editing get exercised | half the trips have 2+ joiners | Pulse → Trips, members per trip |
| We hear what confused them | 10 of 14 answer the week-1 survey | Google Forms responses |

### 2 · Who, and in what order

Closest people first: they forgive a broken install and tell you plainly. Each wave goes out only after the previous one has installed and set up a trip, so an install problem is found by three people, not fourteen. A personal message each time, never a broadcast.

| Wave | When | Who | Why them first |
|---|---|---|---|
| Wave 1 | Day 1 | 5 people (names kept privately) | Family and the closest friends; one is already a planner on the app and serves as the control |
| Wave 2 | Day 4 – 7 | 5 people (names kept privately) | Friends who will try it properly; one tests from another time zone |
| Wave 3 | Day 8 – 10 | 4 people (names kept privately) | The rest of the planner list, once the build has survived two waves |
| Joiners | as invited | Whoever the planners invite · the 8 poll joiners are not messaged during beta | Joiners arrive through a planner's invite link, which is exactly the path to test; the 8 are told at launch |

> **A planner already on the app, and the Berlin group:** One planner is already on the app and can take the TestFlight build on day 1 without an invite message. The Berlin group has just finished a real trip on the web app and answered the alpha survey; leave them be unless one of them asks.

### 3 · The invite

### Message · one person at a time, by text or DM

Hey [name]! You voted "yes, as the planner" on my poll, so you're first in line. The Itinerists is the trip-planning app I've been building: one shared itinerary, flights, stays, who's packing what, who owes who. It's on TestFlight now (Apple's beta app), and I'd love you to be one of about a dozen people trying it before it goes on the App Store.

The ask: install it, set up one trip (real or pretend), and invite two people to it. Then tell me everything that's confusing or broken. Takes about ten minutes to set up.

Install link: [TestFlight link]. If anything at all gets in the way, text me and I'll fix it this week. Thank you 🤍

### Rules for sending it

- One person, one message, their name in it. Never a group text.
- Send a wave on a weekday evening; people install when they are on the couch.
- If someone has not installed after three days, one gentle nudge, then let it go. Non-installs are data too.
- Reply the same day to the first message back from each person. The first reply sets the tone for whether they report things.

### 4 · What the tester receives after saying yes

### Install (iPhone)

1. Install **TestFlight** from the App Store (it's Apple's free beta app).
2. Open the link I sent you on your phone and tap **Accept**, then **Install**.
3. Open The Itinerists from your home screen. Sign up with a username and password (no email needed to start).
4. A new build arrives most Mondays; TestFlight updates it for you. If it asks, tap Update.

### Your one trip

1. Tap **Create trip**: a name, where, and dates. Real or pretend, both are fine.
2. Add a couple of things: a flight, where you're staying, two or three itinerary items.
3. Open **Invite** and send the link or code to **two people**. They can use the web app at theitinerists.com if they're not on iPhone.
4. Then just use it the way you'd actually plan: expenses, packing list, the map, outfits if that's you.

### When something's off

Send it in the group (or to me) with: what you were doing, what you expected, what happened, and the version line from **Profile**, which looks like `Version 0.9.0 (406)`. A screenshot is gold. Nothing is too small.

### 5 · Feedback: one channel, three short surveys, one template

### The channel

One iMessage group, **"Itinerists beta"**, opened the day wave 1 installs. Everyone can see what others hit, which stops duplicate reports and shows that reports get answered. Anyone who prefers can DM instead. No Discord, no form for bugs: the friction kills reports.

Every report gets a reply within a day, and "fixed in build N" when it ships.

### Bug report template (pinned in the group)

- **What I was doing:**
- **What I expected:**
- **What happened instead:**
- **Version** (Profile → bottom): Version 0.9.0 (…)
- **Screenshot** if you have one

| Survey | When | Questions (all optional, Google Forms on the owner's Google account like the alpha one) |
|---|---|---|
| After set-up — 6 questions · 2 minutes | the day they create a trip | Installing from TestFlight was (Painful → Easy, 1–5) · Creating your account was (1–5) · Creating the trip was (1–5) · Did anything stop you or make you guess? (text) · Did you invite anyone yet, and how did that go? (text) · What did you expect to find that wasn't there? (text) |
| Week one — 8 questions · 4 minutes | 7 days after install | Which pages did you use at least once? (checkboxes: Home, Itinerary, Flights, Stays, Transport, Finance, Packing, Outfits, Map, Recs) · Which one did you use most? · Favourite thing, and why · Most annoying thing, and why · Anything that broke? · Did the people you invited actually use it? What did they say? · Compared to how you planned your last trip (group chat, spreadsheet, notes), this was: (much worse → much better, 1–5) · Would you plan your next real trip in it? (Probably not → Already planning one, 1–5) |
| Exit — 6 questions · 3 minutes | end of beta | In one sentence, how would you describe this app to a friend? · What would make you pay $4.99 for a trip in it? (text) · What's the one thing to fix before strangers get it? · What's the one thing to add? · Would you want to keep using it after the beta? (Y/N) · Can I quote you, first name only, on the store listing? (Y/N) |

> **Why these questions:** The after-set-up survey catches install and onboarding pain while it is fresh; those are the fixes that matter most for strangers. Week one is the product survey. Exit gives the store listing its words and tests the Trip Pass price before it exists.

### 6 · The weekly rhythm

### Every week

- **Monday:** a new TestFlight build with the week's fixes. A message in the group: three lines of what changed, in their words ("the invite link now opens the app").
- **Daily, five minutes:** Crashlytics for anything new, Pulse for who came back and which pages, the group for unanswered reports.
- **Friday:** one row in the beta sheet: installs, trips created, joiners, day-2 returns, open bugs, new crash types.

### Fix order, same as phase 4

1. Anything that blocked a tester or lost data.
2. Anything two or more people found confusing.
3. Features two or more people asked for. One voice is noted, not built.

Beta ends when the exit numbers at the top are met, or after four weeks, whichever comes first. The honest minimum is two weeks with the 14 planners.

### 7 · The thank-you

### Message at the end

[name], thank you. You were one of fourteen people who used The Itinerists before anyone else, and [one specific thing they found or said] is in the app because of you. It goes on the App Store on [date]; you'll be the first to get the link. [Gift line.] 🤍

### Gift options · your call

- A Trip Pass on the house when purchases ship (costs nothing now, and it is the thing the app sells).
- Their first name in a "thank you" line on the About screen.
- Nothing but the message. Also fine: friends tested it for you, not for a reward.

### 8 · Before day 1: the checklist

- [ ] **TestFlight build on Alayna's and the co-planner's phones** — phase 1 exit test _(owner: Both)_
- [ ] **Alpha survey's top fixes shipped** — so beta does not re-find what Berlin already found _(owner: Claude)_
- [ ] **The three surveys built** — Google Forms, same account as the alpha survey, links ready to paste _(owner: Claude)_
- [ ] **The beta sheet** — one row per week, columns from section 6 _(owner: Claude)_
- [ ] **Pulse: testers' trips are real trips** — nothing to do; only Alayna's own test trips are hidden _(owner: Claude)_
- [ ] **Decide the gift and the channel** — section 7, and iMessage group vs DMs _(owner: Alayna)_

### 9 · Decisions still yours

- **Waves as drawn, or shuffle them?** — The split is a guess at closeness from the poll. Move anyone; the rule that matters is three to five people per wave and a gap between waves.

- **One iMessage group, or DMs only?** — The group makes reports visible and halves duplicates, but some people only report in private. Both can run; the group is the default.

- **Two weeks or four?** — Two is the honest minimum. Four only if wave 3 goes out late or a crash type keeps appearing.

- **Pretend trips allowed?** — Yes as drafted. A real trip tests more, but requiring one halves who takes part.

- **The gift.** — Section 7. A free Trip Pass is the cheapest and most on-brand; decide before the thank-you goes out, not before day 1.

## Phase 4: Fix from feedback

_One to three weeks, depending on what beta finds_

**Goal:** close what beta surfaced, in this order: bugs, then confusing moments, then features more than one person asked for. Resist requests from a single voice.

- [ ] **Bug list to zero** — anything that blocked a tester or lost data goes first _(owner: Claude)_
- [ ] **Onboarding polish** — beta will have shown where people stall on sign-up, invites and the first trip _(owner: Both)_
- [ ] **Email verification on sign-up** — standard practice; also closes the last email-enumeration gap · done here because it changes onboarding _(owner: Claude)_
- [ ] **Decide the feature asks** — keep the ones two or more testers wanted; park the rest on the board _(owner: Alayna)_

> **Phase ends when:** Testers on the newest build report nothing new for a week, and the parked list is written down.

## Phase 5: Prep for launch

_Two to three weeks_

**Goal:** the things that only matter once strangers arrive, plus the store listing itself.

- [x] **Custom domain** — theitinerists.com bought Sep 29, 2026 (Hostinger, 2 years) _(owner: Alayna)_
- [x] **Domain on Firebase** — mail goes out as noreply@theitinerists.com (SPF + DKIM) · site live on theitinerists.com since Sep 30 · the old address keeps working _(owner: Both)_
- [ ] **Switch the app's own links to the domain** — privacy URL, invite links · the redirect off the-itinerists.web.app is a separate decision after Berlin _(owner: Claude)_
- [ ] **Branded email wording** — Firebase blocks template edits on this project · open a support request once on the paid plan _(owner: Alayna)_
- [ ] **Backups** — Firestore point-in-time recovery plus a weekly export to a bucket · needs the paid plan _(owner: Claude)_
- [ ] **Trips delete themselves 30 days after they end** — a daily Cloud Function runs the same teardown as the owner's delete button (itinerary, finance, stays, photos, invites, members) · from the end date, Trip Settings and the My Trips card show "deletes on {date}" with the "Keep this trip" purchase ($1.99 once) beside it; Plus and Pass trips are exempt · emails to the planner at 7 days and 1 day · the privacy policy's "How long we keep data" section says so · the clock starts the day purchases ship, so nobody loses a trip before they can keep it _(owner: Claude)_
- [x] **Tests on every pull request** — GitHub Actions runs the app tests and the rules tests · no merge on red _(owner: Claude)_
- [ ] **Pagination** — activity log and other lists that grow without limit _(owner: Claude)_
- [ ] **Terms of service + data export + retention wording** — beside the privacy policy · "download my data" on Profile · the policy now states the 30-day trip retention and the paid keep option _(owner: Both)_
- [ ] **Email updates list** — the phase 2 waitlist moves onto a mailing service (Brevo or Mailchimp, free tier) on theitinerists.com · "send me updates" at sign-up and on Profile · postal address + unsubscribe in every send · kept separate from Firebase's transactional mail _(owner: Both)_
- [ ] **Invite links open the app** — needs Apple · iOS universal links (associated domains entitlement) · the domain is ready _(owner: Claude)_
- [ ] **Store listing** — needs Apple · name, subtitle, description, keywords, screenshots on each phone size, age rating, the privacy questionnaire (the policy page already answers it), support URL · first line = the winning hook from phase 2 _(owner: Both)_

> **Phase ends when:** The listing is complete in App Store Connect, a backup has been restored once on staging, and a pull request with a failing test cannot be merged.

## Phase 6: Launch

_One to two weeks, mostly waiting on Apple_

**Goal:** approved and live. Expect one round of questions from review; answer the same day.

- [ ] **Submit for review** — 1.0.0 · reviewers get a test account on a demo trip _(owner: Both)_
- [ ] **Release** — manual release after approval, on a day you can watch it _(owner: Alayna)_
- [ ] **Tell the waitlist and the poll voters** — the phase 2 sign-ups first, then the 8 "if someone else plans" people, who are the first joiners your planners will invite _(owner: Alayna)_
- [ ] **Post the launch reel** — the winning hook, now with an App Store link _(owner: Alayna)_
- [ ] **Next cycle: Android** — Capacitor's Android shell and Google Play, after iOS is out rather than alongside it _(owner: Claude)_

> **Phase ends when:** The Itinerists is on the App Store and the first stranger has created a trip.

### Why storage moves in phase 1, not phase 5

- Beta testers create real data, and photos are the one kind that is expensive to move once it exists. Moving a hundred photos while fourteen people are using the app is avoidable.
- Nothing here is "sized" for launch. Firebase has no tiers: it scales on its own and bills for use. Phase 1 chooses the right places for data and turns on the plan; capacity takes care of itself.
- The live checklist mirroring these phases is `TODO.md` in the repository.
