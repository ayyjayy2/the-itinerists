# Privacy, outside services and deletion check

Run on **2026-10-13** for #408, from the review's SEC-05. Visibility was read from `firestore.rules`, outside services
from the code, secrets from a scan of the production build, and deletion was tested on staging through the real app.

## Who can see what

Enforced by the security rules, not just the screens.

| Data | Who can read it |
|---|---|
| Trip name, destinations, dates, currency | Everyone on the trip; the app owner (support, Pulse) |
| Member list | Everyone on the trip; the app owner |
| Itinerary, flights, stays (addresses, booking references, links, notes), transport, shared expenses, recommendations, map pins, update feed, activity log | Everyone on the trip |
| Outfit photos | Only the person who added them |
| Packing list | Only its owner (the trip owner may delete it when tearing a trip down) |
| My Expenses | Only its owner |
| Profile (name, avatar, preferences) | The person; app admins. Trip members see name and avatar through the member list |
| Sign-in email | Only the person (`users/{uid}/private`); app admins |
| Usage and edit logs (`_activity`, `_writes`) | Only the app owner |

**"For" is a display filter, not a permission.** Marking who an item is for changes what each person's screens
show; everyone on the trip can still read it. The privacy policy now says so.

## Outside services

Listed with exactly what each receives in [apis.md](apis.md#what-each-outside-service-receives). No notes, booking
references, links, amounts or names go to any of them. The built web app holds no secrets; its only key is the public
Firebase web key.

## Deletion, tested on staging

`npx playwright test -c playwright.staging.config.ts --project deletion` creates a throwaway account with data
everywhere the app stores things: a trip it is alone on, and a trip it shares with someone else. The account then
deletes itself through Profile, and the Admin SDK lists anything left behind. The test removes everything it made.

**Before the fix, 6 things were left behind:**

| Left behind | Why | Fix |
|---|---|---|
| The private account record (sign-in email) | A listener writes the email back whenever the record is missing, so it reappeared mid-deletion | Profile listeners stop first (`UserService.stopListening`) |
| My Expenses | The listener restores a missing list from the device's backup, so it reappeared mid-deletion | Expenses stop listening and the device copies are dropped first (`ExpensesService.forget`) |
| Outfit photos on a trip the person left | Never deleted when leaving | Deleted with the rest of their personal data |
| Outfit photos on a trip that was deleted | Not on the list of things a trip deletion clears | Added (your own; nobody can see anyone else's) |
| A deleted trip's update feed | Not on the list | Added |
| A deleted trip's removed-members list | Not on the list | Added, cleared last (packing lists are found through it) |

**After the fix:** nothing is left. The shared trip keeps its shared items and the other member.

## Still open

- **Usage records** (`_activity`, `_writes`) stay after an account is deleted, keyed by the old account id. **Owner's
  decision (Oct 13): keep them**, and the privacy policy says so. Each deletion also leaves a record in `_deletions`
  (when, account age, trips, last trip end; no name, email or content) for Pulse's "Accounts deleted" card (#452).
- **Daily-limit counters** from the last 24 hours stay (a count and a time, nothing else). By design they can't be
  removed early, or deleting one would reset the limit.
- **A removed member's** outfit photos and packing list stay on the trip, because nobody else may read or delete them. A
  clean-up after Blaze (with #333) would cover them.
- Outfits and packing suggestions are matched by **display name** when someone leaves. A person who renamed
  themselves would leave theirs behind.
- Related: #356 (the shared place-lookup cache is readable by any signed-in account), #332 (download my data).
