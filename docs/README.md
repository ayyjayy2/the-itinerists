# Docs for people and agents

Start here, after [AGENTS.md](../AGENTS.md) (the rules for every change). These files describe what The Itinerists is, how it is built and how it should look, so
any agent (or person) can work on it consistently. Several are generated mirrors of private Claude
artifacts; the artifact is the source of truth and the file says so in its first lines.

## Map

| File | What it covers | Source of truth |
|---|---|---|
| [architecture.md](architecture.md) | How the app is structured and how its systems connect: layers, data model, how a change travels, sign-in, time zones, the iPhone app, delivery, security | Itinerists HQ → Technical docs → Architecture |
| [design/design-system.md](design/design-system.md) | Brand book, UI rules, every token, the shared components | "The Itinerists" design system artifact (built from `src/styles.scss`) |
| [design/tokens.json](design/tokens.json) | The same tokens, machine-readable (colours per theme, type, spacing, radius, shadow, layout) | as above |
| [design/user-flow.md](design/user-flow.md) | The whole app as steps and decisions, with each screen's screenshot name | User Flow artifact |
| [product/prd.md](product/prd.md) | What version 1.0 must do, each requirement's priority and status | Itinerists HQ → Launch plan → PRD |
| [product/launch-plan.md](product/launch-plan.md) | The alpha and six phases to the App Store, with checklists and exit tests | Itinerists HQ → Launch plan → Phases |
| [product/making-money.md](product/making-money.md) | Trip Pass, Plus, Keep, booking links: terms and edge cases | Itinerists HQ → Launch plan → Making money |
| [product/storage-and-costs.md](product/storage-and-costs.md) | What storage and Firebase cost, now and at scale | Itinerists HQ → Launch plan → Storage & costs |
| [apis.md](apis.md) | Every tool, service and script the project uses | this file (edit it directly) |
| [HANDOFF.md](HANDOFF.md) | Project snapshot and history | this file |

## Working with the data

- **The data model is in [architecture.md](architecture.md)**, and the exact field shapes are in `src/app/models/trip.models.ts`. Read both before adding a field or a collection.
- **Every read and write must pass `firestore.rules`.** Add a rules test (`test/firestore-rules.test.mjs`) for each new allow and each new deny; CI runs them.
- **Times always carry their zone code** (CDT, WEST), never an offset. Use `src/app/utils/zones.ts`; a flight's departure is in its departure airport's zone, its arrival in its arrival airport's.
- **Analytics count, they never read.** `_activity` and `_writes` record that something happened, not what was written. Test accounts and test trips are excluded from every number, and only the owner can read these collections.
- **Admin scripts** check that their service-account key's project is the one intended (`trip-planner-ayyjayy2` for production, `the-itinerists-staging` for staging) before doing anything.

## Privacy: what never goes in this repository

- **No real people's names, usernames, emails or handles** in code, docs, tests, commit messages or pull requests. The private Headcount artifact (users, trips, the poll) is deliberately not mirrored here, and `scripts/stats.js` is gitignored. Refer to people by role ("a beta tester", "the co-planner") or by count.
- **No keys or local account files** (`scripts/serviceAccountKey*.json`, `scripts/*.local.*`, `.env`): they are gitignored; keep them that way.
- Demo and test names (Maya, Theo, Jo, Rafa, Sam…) are fictional and fine.

## Keeping the mirrors current

When an artifact page changes, regenerate its mirror in the same pull request as the code it describes, keep the
"Generated mirror" header, and re-check the privacy rules above before committing.
