# The Itinerists — to-do

The one live list. `ROADMAP.md` is the long-range plan and `docs/HANDOFF.md` the orientation
doc; neither tracks status. When something ships, move it to **Done** with its PR number.
Last updated: 2026-09-29.

## Now — native app (iOS first)

- [ ] Real App Check on native: App Attest via a Capacitor App Check plugin
      (e.g. `@capacitor-firebase/app-check`), then remove the debug-token path in
      `src/app/app.config.ts`.
- [ ] Privacy policy page and route (Apple requires a URL on the listing and a link in-app;
      place the link next to the version line on Profile).
- [ ] Apple Developer Program enrollment ($99/yr) — *Alayna, cannot be done from the repo*.
- [ ] First TestFlight build (`npm run ios:sync`, archive in Xcode, upload).
- [ ] Message the 14 "Yes, as the planner" poll voters one at a time with the TestFlight
      invite (list on the Headcount artifact, Poll page).

## Next

- [ ] Custom domain — *decision: Alayna*. Unlocks branded Firebase emails (subject, body,
      sender), keeps them out of spam, and is required for invite links that open the app.
      Steps in the `custom-email-domain-paused` memory / earlier notes.
- [ ] Invite links open the native app (iOS universal links; needs the domain).
- [ ] Server-side signup or verify-email-on-signup, to close the last email-enumeration
      gap (Firebase itself still reports "email already in use" to a raw API caller).
- [ ] Android shell (`npx cap add android`) once iOS is on TestFlight.
- [ ] Optional: show the live invite on My Trips cards too (today only Admin and Trip
      Settings keep it visible).

## Later (from ROADMAP.md, unchanged in scope)

- [ ] Push notifications (FCM) and event/flight reminders.
- [ ] Shared photo albums; AI itinerary builder; activity voting; real-time flight tracking.
- [ ] Billing — note: digital subscriptions sold inside the iOS app must use Apple's
      in-app purchase, not Stripe; the ROADMAP's Stripe plan needs rework before any paid tier.
- [ ] PDF export; Google Play submission.

## Waiting on Alayna

- Custom domain: buy one (e.g. theitinerists.com; Cloudflare makes DNS scriptable) or decide to wait.
- Apple Developer Program enrollment.

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
