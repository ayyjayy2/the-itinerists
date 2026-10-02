<!-- Generated mirror of the "Launch plan · Making money" page in Itinerists HQ (https://claude.ai/artifact/4KXwSQgFrugzPq9ZfocA9d#money, private).
     The HQ page is the source of truth: change it there, then regenerate this file.
     Synced 2026-10-02. People's names are deliberately left out (see docs/README.md). -->

# Making money

_Terms as of **Sep 30, 2026** · revised **Sep 30** with the pays-for-itself check · nothing here is built yet · prices in USD, Apple localises_

People pay **before and during a trip**, when the group is active and the planner is invested. Nobody pays a year later for something they have half forgotten. So the product is a per-trip pass sold while the trip matters, a subscription for people who plan often, and a short free window after each trip: **30 days, then keep it for $1.99 once or hold Plus by the month.** Three rules keep the growth loop intact: **never charge someone for joining a trip**, never gate invites, and charge the planner, because the poll says planners are the majority and the ones who care most.

## 1 · The catalogue

Trip Pass

$4.99

once, per trip

The main product. One trip, every paid feature, everyone on it, kept forever. Bought by the planner at trip creation or any time during the trip.

- Unlocks multi-destination legs, unlimited outfit photos, calendar (.ics) and PDF export, a cover photo and photo avatars on that trip
- A trip with a Pass does not count toward the free active-trip limit, so the Pass is also how a third trip gets planned
- Offered at the three moments it is needed: choosing "more than one destination" when creating a trip, hitting the active-trip limit, and on Home while the trip is live ("Make this trip a Pass trip")
- Belongs to the trip: ownership transfers and people leaving change nothing

Apple type: consumable, tied to a trip id. Written to

trips/{id}.pass

by a Cloud Function, never by the phone.

Plus

$19.99

/ year · or $2.99 / month

For people who plan three or more trips a year. Everything Trip Pass gives, on every trip they plan, while subscribed. No active-trip limit.

- Every trip the subscriber plans is kept while Plus is active. This is the "pay by the month" way to hold trips.
- On lapse, paid features switch off and each ended trip gets a fresh 30 days with the Keep offer before deletion. Nothing is deleted on the day a card expires.
- Follows the planner: joining a Plus planner's trip gets you the features on that trip, not on your own
- 7-day free trial, once per Apple ID; annual is the default choice on the paywall

Apple type: auto-renewable subscription, one group with monthly and annual. Built after Trip Pass has sold for a few months and repeat planners are asking for "all my trips".

Keep this trip

$1.99

once, per trip

A free trip is kept

30 days after its end date

, then deleted. Keep removes the deletion date for good, for a trip that never had a Pass. The other way to hold a trip is Plus, by the month.

- Offered from the day the trip ends: a "deletes on {date}" line in Trip Settings and a badge on the My Trips card, both with the button; emails to the planner at 7 days and 1 day
- Sold while the trip is still fresh: the group is settling up, the photos are being shared, the itinerary is the diary
- Anyone on the trip can buy it; the trip stays kept if they leave

Apple type: consumable. Hidden on any trip that already has a Pass. There is no free extension; the 30 days are the extension.

Booking links

3 – 8%

of a booking, paid by the merchant

Stays, cars and tours already have link fields. A booking made through a partner link pays a commission. The user pays nothing extra and the price never changes.

- Booking.com and Expedia partner programs for stays, GetYourGuide and Viator for activities, Kiwi.com for flights (flights pay least)
- A small "find a place" button beside a stay or a rec that has no link yet; never replaces a link someone pasted
- One line in the privacy policy: "some booking links earn us a commission; it never changes your price"

Sign up once monthly active users pass a few thousand. Before that the forms aren't worth the hour.

## 2 · Who gets what

| Feature | Free | Trip Pass — that trip | Plus — every trip I plan | Built today? |
|---|---|---|---|---|
| Join any trip, everything on it — joiners never pay | Yes | Yes | Yes | Yes |
| Every current page — itinerary, finance, packing, outfits, map, recs, flights, stays, cars, invites, weather | Yes | Yes | Yes | Yes |
| Active trips as planner — trips you own whose end date hasn't passed | 2 at a time | Pass trips don't count | Unlimited | Cap not built |
| Destinations per trip | 1 | Many legs | Many legs | Built, currently free |
| Outfit photos — the one thing that costs real storage | 10 per person per trip | Unlimited | Unlimited | Built; cap not built |
| Trip kept after it ends | 30 days, then Keep for $1.99 | Forever | While subscribed, then 30 days | Deletion not built |
| Calendar export — .ics of the itinerary and flights, opens in Apple/Google Calendar | No | Yes | Yes | Small job |
| PDF export — itinerary and the settlement sheet | No | Yes | Yes | Medium job |
| Cover photo and photo avatars | Emoji only | On that trip | Everywhere | Medium job (#198) |
| Flight tracking and reminders — paid flight-data API behind it, so never free | No | Later | Later | Not started |
| Export your data, delete your account | Yes | Yes | Yes | Phase 5 |

### What never gets a paywall

- Anything a joiner needs. Joiners are how the app spreads: six people on a trip is six people who see it and one who pays.
- Invite links and codes, and the number of people on a trip.
- Safety and privacy: export your data, delete your account.
- Nothing that uses an outside AI. There is no AI itinerary or AI anything in the plan.

## 3 · Exact terms and edge cases

### What counts as an active trip?

A trip you own whose end date is today or later, not archived. Ended, archived and Pass trips don't count. Trips you joined never count. Free planners can have **two** at once.

### Hitting the limit

"Create trip" still opens. On save: "You have two trips on the go. Make this one a Pass trip ($4.99) or get Plus." Archiving or finishing a trip frees the slot. Nothing is ever blocked from being *viewed*.

### Multi-destination on Free

The second leg is where the Pass is offered, in the create form. Trips that already have legs when the rule ships (the alpha trips) keep them: rules apply to new trips only.

### Photo cap on Free

Ten outfit photos per person per trip. The eleventh upload offers the Pass. Existing photos are never removed; the cap only stops new uploads.

### When do the 30 days start?

On the trip's **end date**, not the day it was created. Multi-destination: the last leg's end. Editing the end date moves the clock with it. Trips that ended before purchases exist get their 30 days from the day purchases ship.

### Why 30 days and not longer?

People decide about a trip while it is fresh. A year later nobody pays; a month later the group is still settling up and sharing photos, which is exactly when "keep this" is an easy yes. It also keeps storage flat: a trip lives on average about two months.

### Who can buy a Pass or Keep?

Anyone on the trip. The entitlement belongs to the trip, not the buyer, so it survives the buyer leaving or ownership changing.

### Pass on a trip that has Keep

Full price, no proration. The button says "Trip Pass · $4.99 · this trip is already kept". Keep is hidden once a Pass exists.

### Owner deletes a Pass or kept trip

It is deleted; the purchase is spent. The delete dialog says "This trip has a Trip Pass" before the button. Refunds are Apple's decision.

### Apple refunds a purchase

RevenueCat's webhook calls a Cloud Function that removes the entitlement. Paid features switch off and the trip gets a fresh 30 days from the refund, with the warnings again. Legs and photos already there stay until then.

### Plus lapses

Paid features switch off. Every ended trip the person planned gets a fresh 30 days from the lapse, with the Keep offer on each. New trips follow the free rules, including the active-trip limit. Nothing is deleted on the day a card expires.

### Plus subscriber joins someone else's trip

That trip is on whatever its planner has. Plus follows the planner, not the passenger.

### Bought on the web, opened on the phone

Same entitlement, on the trip and account documents, so it is there on every device. "Restore purchases" on iOS re-syncs anything bought from Apple.

### Family Sharing, gifting

Off at first. Gifting a Pass to the planner is a nice later idea, through Apple's gifting or a redeem code.

### Archived trips

Same deletion clock as any other trip. Archiving hides it and frees an active slot; it does not keep it.

### Settling up after the 30 days

The Finance page goes with the trip. The 7-day email says so and links the settlement sheet; with PDF export built, that email attaches it. If a group needs longer, Keep is $1.99.

## 4 · When each one arrives

| Step | What ships | Trigger | What to watch |
|---|---|---|---|
| Launch | Everything free, no caps — the 30-day rule is in the policy but no trip is deleted until purchases exist; calendar export built and free for now | App Store release | Pulse: trips per planner, legs per trip, photos per person, who opens a trip after it ends |
| + 2 – 3 months | Trip Pass, the caps, Keep, and the deletion job — RevenueCat, the entitlement function, paywall screens, policy lines · caps apply to new trips only · every already-ended trip gets 30 days from this day | Enough Pulse data to set the cap numbers; PDF export or cover photos built so the Pass has three things in it | Pass buys per 100 new trips; share of ended trips kept; which offer moment converts; refunds |
| + 6 – 9 months | Plus — monthly + annual, 7-day trial | Pass buyers with 3+ trips a year exist | Trial-to-paid, annual share, churn at month 2 |
| A few thousand monthly users | Booking links — partner sign-ups, one URL parameter, policy line | Enough stays and recs to measure clicks | Click-through and confirmed bookings per program |

## 5 · How a purchase actually works

### Apple's rules

- Digital things bought inside the iOS app go through **Apple in-app purchase**. No Stripe and no "pay on our website" link inside the app (the rules on external links keep changing by country; not worth the review risk).
- Apple's cut is **15%** under the Small Business Program (under $1M a year; apply once enrolled), otherwise 30%. Subscriptions drop to 15% after a subscriber's first year regardless.
- The paywall must show the price before the buy button, link to terms and the privacy policy, and offer "Restore purchases". Subscriptions must state the renewal terms.
- Apple handles tax, currency and receipts. Payouts arrive about 45 days after the month ends.

### Our side

- **RevenueCat** in front of Apple, Stripe (web) and later Google Play: one SDK, one webhook, free under $2.5k a month of revenue.
- A Cloud Function receives the webhook, verifies it, and writes the entitlement: `trips/{id}.pass = true` or `.kept = true` for trip products; `users/{uid}/private/account.plus = {until}` for the subscription; `trips/{id}.keptByPlus = true` at creation when the planner has Plus. Phones never write entitlements.
- Security rules: only the function may set those fields; the app only reads them. The active-trip limit and the photo cap are enforced in the rules too, not just in the UI.
- The daily deletion function skips any trip with `pass`, `kept` or `keptByPlus`.
- Product ids: `trip_pass`, `keep_trip`, `plus_monthly`, `plus_annual`. Same ids on web and iOS.

## 6 · What it could add up to

Assumptions shown so they can be argued with: **60% of users plan** (the poll: 14 of 22), **1.5 trips per planner per year**, Apple's 15% taken off. "Low" and "high" are typical consumer-app conversion ranges, not forecasts.

| Users | Trips / yr | Trip Pass — 3 – 8% of new trips | Plus — 0.5 – 2% of planners | Keep — 5 – 12% of ended trips | Net / yr after Apple |
|---|---|---|---|---|---|
| 1,000 | 900 | $135 – $360 | $60 – $240 | $90 – $215 | **$240 – $690** |
| 10,000 | 9,000 | $1.3k – $3.6k | $600 – $2.4k | $900 – $2.1k | **$2.4k – $6.9k** |
| 50,000 | 45,000 | $6.7k – $18k | $3k – $12k | $4.5k – $10.7k | **$12k – $35k**, plus booking links |

### Booking links at 50,000 users

If 3% of trips book one stay through a partner link at an average $500 booking and 5% commission, that is about 1,350 bookings × $25 ≈ **$34k a year**. At 1% of trips it is $11k. This is the line that can outgrow purchases, and it depends entirely on how many stays get booked from inside the app rather than pasted in afterwards.

### What the numbers say

- Under 10,000 users, paid features cover Apple's $99 and Firebase and teach you what people value. That is the goal; it is why launch is free.
- Trip Pass and Keep are both sold while people care, which is why Keep at 30 days earns several times what it would at a year.
- The lever is planners per trip, not price. Growth comes from joiners; money comes from planners.
- Every price here is an Apple tier and can move one step either way without redesign.

## 7 · Does it pay for itself?

The rule this page has to pass: **at every size, the low-case income beats every cost put together.** Costs are the Storage & costs page plus the fixed bills; income is the low–high net from section 6. Both are per year.

- 170 — – 500 users Break-even once purchases are live · fixed $111 a year ÷ $0.22 – $0.67 net per user

- $0.24 — – $0.69 Income per user / yr net of Apple, section 6 assumptions

- 1 — – 4 ¢ Running cost per user / yr Firebase, at every size · joiners included

- $111 — / yr Fixed Apple $99 + domain $11.69 · the only bills that exist at zero users

| Size | Fixed | Firebase — Storage & costs page × 12 | RevenueCat — free under $2.5k / mo | All costs / yr | Net income / yr — section 6, low – high | Verdict |
|---|---|---|---|---|---|---|
| Beta and the free launch — 20 testers, then the first 2 – 3 months on the store | $111 | $0 – $12 | $0 | $111 – $123 | $0 | Costs win, on purpose — nothing is for sale yet; the $10 budget alert caps the surprise |
| 1,000 users | $111 | $12 – $36 | $0 | $123 – $147 | $240 – $690 | Income wins — 1.6× costs in the low case, 5× in the high |
| 10,000 users | $111 | $240 – $360 | $0 | $350 – $470 | $2.4k – $6.9k | Income wins — 5× to 20× |
| 50,000 users | $111 | $1.2k – $1.8k — five times the 10,000 line | $0 – $350 — about 1% of revenue above $2.5k / mo | $1.3k – $2.3k | $12k – $35k — before booking links | Income wins — 5× to 27× |

### Why the gap only widens

- Running cost is a few cents per user per year and stays there, because Firebase bills for use and the expensive data (photos) sits in Cloud Storage with caps. Income is a few dimes per user per year. That ratio, **roughly 10 to 1 in the low case**, is what the check guards.
- Joiners cost reads but never pay. At a cent or two a year each, a planner can bring ten joiners and the trip still pays for itself many times over.
- The fixed $111 is the whole reason there is a break-even at all. Past a few hundred users it stops mattering.

### What could flip it, and the rule for each

- **A paid API behind a feature** (flight tracking is the known one): per-call pricing can cost more per user than the Pass earns. Rule: it ships only inside Pass or Plus, priced so one Pass covers a trip's calls with room to spare, and never on Free.
- **Photos back in Firestore**, or no photo cap on Free: the one line that can grow past income. Rule: Storage only, caps on Free, thumbnails in lists.
- **Long sessions with many listeners**: reads rise faster than users. Rule: pagination before launch (phase 5), and the $25 budget alert as the tripwire.
- **Refunds and Apple's cut**: the 15% rate holds under $1M a year; refunds are a few percent. Both are already inside the low case.

### How to keep this true

- Before any price or any new cost line changes, redo this table. Income per user must stay at least **five times** running cost per user in the low case; if it does not, the feature goes behind the Pass or the price moves one Apple tier.
- Once purchases ship, Pulse plus RevenueCat give the real numbers: paying planners per hundred trips, and the Firebase bill. Replace the assumptions here with those within the first quarter.
- The only period where costs win is before anything is for sale. It is bounded: about $10 a month, by design, and ends when the Pass ships.

## 8 · Decisions still yours

- **30 days after the trip, or 60?** — 30 keeps storage flat and sells while the trip is fresh. 60 gives slow settle-ups more room at the cost of a lower keep rate. The 7-day email with the settlement sheet is the safety net either way.

- **Two active trips on Free, or three?** — Two makes the Pass matter for anyone planning a summer trip and a wedding weekend at once; three only catches heavy planners. Pulse will show the real distribution before the cap ships.

- **Ten photos per person per trip, or fifteen?** — Ten is roughly one outfit a day for a long weekend plus a few extras. The Berlin group's actual counts are the right guide.

- **Is $4.99 right for the Pass?** — $2.99 converts more; $4.99 is under one coffee per person on a group of six and reads as "obviously fine" to a planner. $6.99 starts to need justifying.

- **Calendar export: free forever as a hook, or in the Pass?** — The table puts it in the Pass. Making it free is a strong "look what this does" moment for the reels, and it costs nothing to run. Either is defensible.

- **Web purchases at all?** — Yes if RevenueCat's Stripe path is painless; otherwise iOS-only at first, with the web showing "buy in the app".
