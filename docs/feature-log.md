# Feature Log — work after Design Phase 2

Design Phases (see `docs/design-phases.md`) are about the app's **look & feel**. The visual
redesign was frozen at the **`design-phase-2`** tag (commit `9f45063`, PR #82). Everything below
is **functional feature work** built on top of that frozen design system, grouped into milestones.

To see exactly what's in a milestone: `git log design-phase-2..master --oneline`.

---

## Milestone 1 — Map & Transportation (Jul 2026, PRs #84–#93)

### Orphaned-page revival
During this milestone we found the only two page components that the Phase 1 multi-trip rewrite
left **built but unrouted** (visiting them fell through the `**` wildcard to Home): **Map** and
**Rental Car**. Both were wired to the current `DataService` — just never re-linked. Both are now
revived and routed; **no orphaned page components remain** (audited: every `src/app/pages/*` has a
route + nav entry).

### Map (`/map`)
- **Revived + restyled** to the Dusk Garden system — Leaflet markers/legend recoloured to the
  palette; add-pin modal + legend on the line-icon set (part of #81).
- **Destination-aware geocoding fix** (#82) — removed the legacy Ireland viewbox bias; queries now
  append the trip destination ("Baixa" → "Baixa, Lisbon"), so pins land in the right place. Bare
  IATA airport codes query as "&lt;code&gt; airport" (LHR → Heathrow, not Lahore). Cache keys are
  destination-namespaced; local cache version + shared Firestore cache doc bumped.
- **Locations list below the map** (#86) — mirrors the pins for the current scope/day; numbered to
  match the pins when a day is selected; **tap a row to fly to it**.
- **Full-size map** (#87) — the list sits below a full-height map and the page scrolls; tapping a
  row scrolls the map back into view (#93).
- **Mobile fixes** — day-chip labels + Add-Pin button no longer cut off (#85); the map no longer
  covers the "More" sheet (contain Leaflet's z-index via `isolation: isolate`) (#91).

### Transportation (`/transportation`)
- **Revived the orphaned rental-car page and generalised it** to a multi-mode Transportation page:
  a mode selector — **Rental Car / Train / Bus / Ferry / Rideshare / Other** — with mode-aware form
  labels ("Rental company" → "Train line", "Pick-up/Drop-off" → "Depart/Arrive") and per-mode
  line-icons (new `train` / `bus` / `boat` icons) (#88). Card header: mode chip under the title,
  Edit in the corner (#92).
- **Surfaced across the app:** Home "Pin pages" option (#89); **Itinerary** day banners on
  pick-up/drop-off dates (gold, distinct from the lavender flight banners) (#90); **Map** pins +
  list rows + a "Transport" legend entry (#93).
- **Storage:** reuses the existing `cars` sub-collection; each entry carries a `mode` field —
  legacy rows default to Rental Car, **no data migration**. Model: `RentalCar` + `TransportMode`
  in `trip.models.ts`.

### Home
- "At a glance" **finance card** now shows the running **"tracked so far"** total (#84), matching
  the prototype (net owed/owe title + total subtitle).

---

## Conventions (same as design phases)
- Group feature work into **milestones**; list the PR numbers so `git log <tag>..master` is
  unambiguous.
- If a milestone is big enough to want a restore point, freeze it with its own tag + GitHub
  Release (e.g. `feature-map-transport`) — not yet done for Milestone 1.
