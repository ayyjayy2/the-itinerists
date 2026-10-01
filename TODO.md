# The Itinerists — to-do

The one live list, organised by launch phase. The plan itself (goals, who does what, when
each phase ends, storage and costs) is the "Itinerists Launch Plan" artifact:
https://claude.ai/artifact/S2rZKkQ3SgoejHD8Z7f4GP. `ROADMAP.md` is the long-range idea list
and `docs/HANDOFF.md` the orientation doc; neither tracks status. When something ships, tick
it here with its PR number. Last updated: 2026-09-30 (late evening).

**The alpha is still wrapping up** (Berlin home Oct 9, survey after). Phase 1 runs alongside it.
A marketing phase now sits between prep and beta, so the app has an audience before it has
testers. Phases renumbered: 1 Prep · 2 Marketing · 3 Beta · 4 Fix · 5 Prep for launch · 6 Launch.

## Alpha — real trips, real people (Feb 25 – mid Oct 2026, now)

- [x] Ireland and Savannah planned and travelled on the live app.
- [x] Instagram poll: 24 votes, 14 planners, 8 joiners, 2 wing it — the 14 are the beta list.
- [x] Alpha survey built and published 2026-09-30 (Google Form on the laynajay2 account).
- [ ] Berlin comes home Oct 9; nothing moves off the-itinerists.web.app before then.
- [ ] Send the survey to the Berlin group ~2026-10-10, one personal message each — *Alayna*.
- [ ] Read the answers into phase 1 (top three fixes) and phase 2 (the words people use).

Ends when: most of the Berlin group has answered, the three things they'd fix are written down,
and the sentence they use to describe the app to a friend is written down too.

## Phase 1 — Prep for beta (alongside the alpha wrap-up, ~2 weeks)

Everything a tester would notice, and everything hard to change once real data exists.
In the order things can actually happen. Only App Attest, TestFlight, universal links and the
store listing need the $99 Apple Developer Program; enrol about a week before the TestFlight
build (approval takes a day or two).

- [x] Security lockdown: private profiles, no user listing, enumeration-safe sign-up,
      joining needs a live invite — #181, #182, #203.
- [x] Privacy policy at /privacy, linked from Profile and sign-up — #201.
- [x] Native iOS shell with icon and launch screen; runs on Alayna's iPhone — #191–#196.
- [x] Usage analytics (design: `docs/superpowers/specs/2026-09-30-usage-analytics-design.md`):
      own `_activity` event log (rules deployed 2026-09-30); Pulse dashboard at
      theitinerists.com/pulse/ (owner only, live; filters + four more cards, #234); Google
      Analytics 4 (G-EZQ46BTZY7) on the web.
      Later: Capacitor Firebase Analytics plugin for iOS; App Store privacy label.
- [ ] Now: Firebase pay-as-you-go (Blaze) plan + budget alerts at $10 and $25 — *Alayna*
      (console → Usage and billing → Modify plan). Creates the Storage bucket, unlocks backups
      and Cloud Functions.
- [x] Staging Firebase project `the-itinerists-staging` (free plan), same rules and indexes; master
      auto-deploys there after CI; seeded demo trip + 4 test accounts — 2026-10-01.
- [x] Crashlytics — code shipped (#223); live since 2026-09-30: the console shows the iOS app,
      two test crashes from the simulator were received and symbolicated (dSYMs uploaded with
      `upload-symbols`; `cap run ios` debug builds make none, archive builds do).
- [ ] After Blaze: Firebase console → Storage → Get started (creates the default bucket
      trip-planner-ayyjayy2.firebasestorage.app) → `node scripts/set-storage-cors.js` →
      `firebase deploy --only storage` → flip OUTFIT_PHOTO_STORAGE_ENABLED to true → rerun
      the live check → deploy hosting. (Photo code is done: resize to 1,600 px + 300 px
      thumbnail, owner-only storage.rules with tests, dual-format reader, migration script.)
- [ ] After 2026-10-10 (Berlin trip over) and once the bucket exists:
      `node scripts/migrate-outfit-photos.js` (dry run), then `--run`.
- [ ] After the survey comes back (mid Oct): fixes from the alpha survey — anything that blocked
      or confused them first, then asks two or more people made (same order beta fixes will use).
- [ ] Apple Developer Program enrollment ($99/yr) — *Alayna*. About a week before TestFlight.
- [ ] Needs Apple: real App Check on iOS — App Attest via a Capacitor App Check plugin; remove
      the debug-token path in `src/app/app.config.ts`.
- [ ] Needs Apple: first TestFlight build — `npm run ios:sync`, archive in Xcode, upload,
      external group.

Ends when: a TestFlight build is on Alayna's and Makaela's phones, photos upload to Cloud
Storage, a crash appears in Crashlytics, a budget alert email has arrived once, and the alpha
survey's top fixes are shipped.

## Phase 2 — Marketing (2–3 weeks, can overlap phase 1; no Apple account needed)

Find out whether people who don't know us want this, before anyone is invited to test it.

- [ ] The one-line story: who it's for and what it replaces, in the words from the poll
      comments and the Berlin survey — *Alayna*.
- [ ] Waitlist, before the first reel so it has somewhere to send people: one email field
      reachable from theitinerists.com ("we'll tell you when it's on the App Store"); the app's
      sign-in screen keeps the root until the store launch. — *Claude*.
      Decided 2026-09-30: the real landing page comes with the store launch (phase 6): mobile
      first, a "Download on the App Store" button with a smaller "continue in browser" link
      under it. Not before, since there is nothing to download yet.
- [ ] Three trial reels (15–30 s screen recordings of the real app on the phone + voice-over:
      countdown and who's coming; who owes who; packing list ticking down). Shoot on Berlin
      data while it's fresh — *Alayna*.
- [ ] Post where the poll ran (Instagram first, TikTok if the clip fits): one reel a week, the
      same hook three ways; watch saves, shares and "when?" DMs — *Alayna*.
- [ ] Count weekly: views, saves, shares, waitlist sign-ups, DMs — one sheet, one row a week.
- [ ] Keep the 14 planners for beta; the reels are for strangers.

Ends when: three reels are up, the waitlist has 20 sign-ups from people we don't know, and one
hook has clearly beaten the other two (it becomes the store listing's first line).

## Phase 3 — Beta (2–4 weeks, Alayna runs it)

Could be shorter: the alpha proved the web app with friends; what it never tested is the
native build on phones we don't own. Smallest honest version = two weeks on TestFlight with
the 14 planners, phases 3 and 4 folded together. Skipping TestFlight entirely means the first
crash on an unfamiliar iPhone is reported by a stranger in a store review.

- [~] Beta plan drafted 2026-09-30 under "Beta details" in Phase 3 of the Launch Plan artifact: goals
      and numbers, three invite waves, the invite message, TestFlight install steps, one
      iMessage group as the channel, three short surveys (after set-up, week one, exit), the
      bug-report template with the version line, the Monday build rhythm, the thank-you.
      Left for Alayna: wave order, group vs DMs, two or four weeks, pretend trips, the gift.
      Still to build before day 1: the three Google Forms and the weekly beta sheet.
- [ ] Invite the 14 "Yes!! As the planner" voters one at a time (Headcount artifact, Poll page).
- [ ] Ask each to set up one trip and bring at least two joiners.
- [ ] One place for feedback (group chat or short form); ask for the version line with reports.
- [ ] Watch Crashlytics, the error log, Firestore usage, and day-2 return.
- [ ] Ship a fresh TestFlight build each week with fixes.

Ends when: 8+ testers created or joined a trip, 5 came back on a second day, one week
with no new crash types.

## Phase 4 — Fix from feedback (1–3 weeks)

- [ ] Bug list to zero (blocked a tester or lost data first).
- [ ] Onboarding polish where testers stalled.
- [ ] Email verification on sign-up (closes the last enumeration gap).
- [ ] Decide feature asks: keep those two or more testers wanted; park the rest on the board.

Ends when: a week of no new reports on the newest build, and the parked list is written down.

## Phase 5 — Prep for launch (2–3 weeks)

- [x] Custom domain bought: theitinerists.com at Hostinger, 2026-09-29, $23.38 for 2 years — *Alayna*.
- [x] Firebase Auth email domain verified 2026-09-29: mail now goes out as
      noreply@theitinerists.com with SPF (merged with Hostinger's) + DKIM; reply-to hello@.
- [ ] Email body/subject wording ("Thanks! / The Itinerists Team", sage button): Firebase
      says "Email template updates are currently unavailable for this project — contact
      Firebase Support". Do after the Blaze upgrade: open a Firebase Support request asking
      to enable template customization (project has a verified custom sender domain).
- [x] theitinerists.com live on Firebase Hosting 2026-09-30 (www redirects to it; Auth authorized
      domains and the reCAPTCHA key include it).
- [ ] Switch the app's own links (privacy URL, invite links, App Store listing) to
      https://theitinerists.com. The old address keeps working.
- [ ] NOT before 2026-10-10 (after the Berlin trip ends): decide with Alayna whether to redirect
      the-itinerists.web.app → theitinerists.com. A redirect signs the existing group out once.
- [ ] Backups: Firestore point-in-time recovery + weekly export to a bucket.
- [ ] Trips delete themselves 30 days after they end: a daily Cloud Function runs the same
      teardown as the owner's delete button. From the end date, Trip Settings and the My Trips
      card show "deletes on {date}" with the "Keep this trip" purchase ($1.99 once) beside it;
      Plus and Pass trips are exempt; emails to the planner at 7 days and 1 day (with the
      settlement sheet). Privacy policy "How long we keep data" updated. The clock starts the day
      purchases ship, never before. See the Making money page.
- [x] CI: GitHub Actions on every PR and push to master: `ng test`, Pulse tests, production build,
      rules tests, and a Playwright end-to-end suite of the beta flows on the demo build; master
      requires it green — 2026-10-01.
- [ ] Pagination for the activity log and other unbounded lists.
- [ ] Terms of service beside the privacy policy; "download my data" on Profile; the policy
      states the 30-day trip retention and the paid keep option.
- [ ] Email updates list: move the phase 2 waitlist onto a mailing service (Brevo or Mailchimp free tier) authenticated on
      theitinerists.com (its DKIM records + one more SPF include); a "send me updates" checkbox
      at sign-up and a toggle on Profile stored on the private account doc; a one-field
      waitlist form on theitinerists.com for people not yet in the app. Marketing mail needs
      a postal address in the footer and an unsubscribe link (the service handles both);
      keep it separate from Firebase's transactional mail.

- [ ] Needs Apple: invite links open the native app (iOS universal links; the domain is ready).
- [ ] Needs Apple: store listing: name, subtitle, description, keywords, screenshots per phone size, age
      rating, privacy questionnaire, support URL.
Ends when: the listing is complete in App Store Connect, a backup has been restored once on
staging, and a PR with a failing test cannot merge.

## Phase 6 — Launch (1–2 weeks, mostly waiting on Apple)

- [ ] Submit 1.0.0 for review with a reviewer test account on a demo trip.
- [ ] Manual release after approval.
- [ ] Tell the waitlist first, then the 8 "if someone else plans" voters.
- [ ] Post the launch reel (the winning hook, now with an App Store link).
- [ ] Next cycle: Android shell and Google Play.

## Parked (after launch)

- [ ] Push notifications: the in-app feed + deep links shipped (trip events); next, after the
      Blaze plan: Cloud Function fan-out, device tokens, web push, Profile switches; after the
      Apple program: iOS push via APNs + icon badge. Spec:
      `docs/superpowers/specs/2026-09-30-trip-events-and-push-design.md`.
- [ ] Shared photo albums; activity voting; real-time flight tracking (Plus/Pass feature).
- [ ] Billing — see the "Making money" page of the launch plan artifact. Launch free with no
      caps; 2–3 months in: Trip Pass ($4.99 per trip: multi-destination, unlimited outfit photos,
      calendar + PDF export, cover photo, kept forever; Pass trips don't count toward the free
      limit of 2 active trips), the caps (new trips only), and Keep this trip ($1.99 once,
      offered in the 30 days after a trip ends); Plus ($2.99/mo or $19.99/yr) holds every trip
      the subscriber plans while subscribed, then each gets a fresh 30 days. Apple IAP on
      iOS (15% small-business rate), Stripe on web, RevenueCat for both; entitlements written by
      a Cloud Function to the trip and account docs; caps enforced in rules. No AI features.
- [ ] PDF export (Pass/Plus feature); calendar .ics export (small job, Pass/Plus or free hook).
- [ ] Optional: live invite on My Trips cards.
- [ ] Optional: custom avatar images instead of emoji (issue #198); not required for the store.

## Done recently (Sep 25–29, 2026)

- [x] Security lockdown: profiles self/admin-only and never listable; emails in
      `users/{uid}/private/account`; `usernames/{username}` index; migration run — #181, #182.
- [x] Sign-up never confirms an email exists (reset email + "check your inbox") — #181.
- [x] Account: Delete Account (#178), Log Out in Account section (#179), avatar-only header
      (#179), recovery email on Profile (#177), resend-link view (#172, #173, #174, #175),
      sign in with username or email (#176).
- [x] Sign-up form: order, live avatar preview, per-field validation, summary box, username
      policy, optional invite code on the one form; `/join` is the link landing only — #180, #185.
- [x] Invites: code + link panel, Share sheet, Close invite, one live invite per trip,
      always visible to the owner, phone layout — #186 to #190.
- [x] Loading: delayed spinners, no empty-state flash, busy bar, first-paint splash — #172.
- [x] Reliability: plain-English errors, Firestore cache/crash self-heal, active trip stored
      per account (fixed the signup hang), listeners follow the signed-in user — #171, #183.
- [x] Date pairs: end never before start, everywhere — #184.
- [x] Native: Capacitor 8 iOS shell, runs on simulator and on Alayna's iPhone; Auth and App
      Check adapted; safe areas and pinned header/tab bar; faster sign-in — #191, #192, #194.
- [x] Version 0.9.0 from `package.json`, build = commit count, shown only on Profile — #193.
- [x] Artifacts: Headcount now has Costs, Timeline (day one 2026-02-25) and Poll pages;
      User Flow v10 with the invite-code decision.
- [x] Instagram poll: 24 votes, 14 planners, 8 joiners, 2 wing it, 0 don't travel.
- [x] Removed the unused `seed-data.ts`.
- [x] iOS app icon + branded launch screen (splash plugin held until sign-in resolves); web icons the manifest referenced — #196.
- [x] Privacy policy page at /privacy, linked from Profile and sign-up — #201.
- [x] Self-join gated on a live invite in the security rules (a trip id alone is no longer enough to join) — #203.
