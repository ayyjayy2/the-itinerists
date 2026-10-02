<!-- Generated mirror of the User Flow artifact (https://claude.ai/artifact/FJvWmn2rFgh9cHxXGr2TwD, private; a copy is in Itinerists HQ).
     The artifact is the source of truth: change it there, then regenerate this file. Synced 2026-10-02. -->

# User flow

The whole app as one connected map, top to bottom, with every step tagged **entry**, **action**, **decision** or **outcome**: getting in, the first trip, Home, navigation, the planning pages and what they feed, running the trip, and the account.

- **Entry** is where a journey starts; **action** is something the person does; **decision** is a question with one answer per branch; **outcome** is what they end up with.
- Automatic data flows (shown dashed in the diagram) carry information to another page without a tap, and all of it rolls up into Home.
- Loops: an invite link brings a friend back to "Join with invite code"; logging out returns to "Open the app".
- "Already have an account?" is the person's own choice, not a screen: the app lands everyone on Sign in, which links to Sign up and Forgot password; Join is only reached from a shared link.

The steps below are in order. Each **screen** names its screenshot (the artifact's `shots/` folder, captured from the demo build Oct 1–2, 2026); each **decision** answer says where it leads, placed right before the screen it leads to.

## Getting in

- **Open the app** (entry) — a split second of the logo while the app starts · screen `launch.png`
- Decision: Already signed in? **Yes** → On any trip yet? (end of this row)
- Decision: Already signed in? **No** → Already have an account?
- Decision: Already have an account? **No, new here** → Join with an invite link or Sign up
- **Join with invite code** (action) — the link opens the sign-up form with the code filled in · screen `join.png`
- **Sign up** (action) — name · username · email · icon · color · password · screen `signup.png`
- Decision: Already have an account? **Yes** → Sign in
- **Sign in** (action) — username + password · links to Sign up and Forgot password · screen `login.png`
- **Forgot password** (action) — username or email → reset link → sign in again · screen `forgot-password.png`
- Decision: On any trip yet? **Yes** → Home · the active trip (Home section)
- Decision: On any trip yet? **No** → First time

## First time

- Decision: Entered an invite code? **Yes** → Home on that trip (Home section)
- Decision: Entered an invite code? **No** → Get started
- **Get started** (action) — Set up a trip · Do this later · screen `get-started.png`
- Choice: Get started **Set up a trip** → New trip
- **New trip** (action) — name · stops · dates · currency → Home, you own it · screen `trip-new.png`
- Choice: Get started **Do this later** → Home without a trip
- **Home without a trip** (outcome) — Set up a trip · I have an invite code (every page offers the same) · screen `home-no-trip.png`

## Home

- **Home · the active trip** (outcome) — countdown · pinned shortcuts · at a glance · next up on the map · screen `home.png`
- **Bell · Updates** (action) — what the group changed on this trip · screen `updates.png`

## Navigation

- **Bottom bar (phone)** (action) — Home + the top 3 of your order + More · screen `home.png`
- **More sheet** (action) — every other page, in your order · drag to reorder · screen `more-sheet.png`
- **Trip page toggles** (action) — hide pages you don't need on this trip · screen `trip-settings.png`
- Decision: Page hidden on this trip? **Yes** → out of the bar and the sheet until toggled back
- Decision: Page hidden on this trip? **No** → the page opens (Planning)

## Planning

- **Flights** (action) — arrivals + departures, per person · source of truth for flight times · screen `flights.png`
- **Stays** (action) — check-in / out, who it's for · screen `stays.png`
- **Transportation** (action) — pick-up & drop-off, passengers, drivers · screen `transportation.png`
- **Trip destinations** (action) — one stop or several · set by the owner · screen `trip-settings.png`
- Decision: Same day as a hand-typed item? **Yes** → the flight time wins on Home's First up
- Decision: Same day as a hand-typed item? **No** → the banners are just added to the Itinerary
- **Itinerary** (action) — day by day · auto banners from flights, stays and transport · screen `itinerary.png`
- **Map** (outcome) — pins for stays, transport and the itinerary's places · screen `map.png`
- **Weather** (outcome) — forecast per stop on Home · feeds outfit tips · screen `home.png`
- **Outfits** (action) — a look per day · tips from the day's weather · screen `outfits.png`
- Decision: Already on your list? **Yes** → skipped, no duplicate
- Decision: Already on your list? **No** → added to your Packing list
- **Packing** (action) — your list by category · suggest to a friend · inbox · screen `packing.png`
- Decision: Multi-stop trip? **No** → one list in Recs
- Decision: Multi-stop trip? **Yes** → a Recs section per stop
- **Recs** (action) — tips & spots by category · screen `recs.png`
- **Finance · Expenses** (action) — shared: who paid, split · private: My Expenses · screen `finance.png`
- **My Expenses** (action) — your private log · screen `expenses.png`
- Decision: Settled up? **No** → the balance stays on Who owes whom
- Decision: Settled up? **Yes** → mark paid, balances refresh
- **Who owes whom** (outcome) — per person · Home shows yours · screen `finance.png`

## The trip

- **From the More sheet** (entry) · screen `more-sheet.png`
- **My Trips** (action) — switch the active trip · new · archive · screen `trips.png`
- **Trip Settings** (action) — name · stops · dates · currency · members · log · screen `trip-settings.png`
- Decision: Are you the owner? **No** → view members and the activity log only
- Decision: Are you the owner? **Yes** → Admin
- **Admin** (action) — members · remove · generate invite link · screen `admin.png`
- **Invite link** (outcome) — /join?code=… · 7 days · share it · screen `admin.png`

## Account

- **Profile · menu or header chip** (entry) · screen `profile.png`
- **Update, or leave** (action) — avatar · name · username · password · recovery email · Log out · screen `profile.png`
- Decision: "Do you want to log out?" **No** → stay on Profile
- Decision: "Do you want to log out?" **Yes** → Signed out
- **Signed out** (outcome) — fresh load of Sign in → back to the top · screen `login.png`
