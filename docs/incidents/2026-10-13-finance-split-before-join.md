# Incident: two members owed nothing for two shared expenses (Oct 13, 2026)

After a six-person trip, the trip organizer saw that two members owed her nothing for two shared expenses.
The app hadn't changed and its maths was right: two expenses had been split with **individual amounts before
those two people joined**, so their shares sat on the organizer. The data was corrected in place with the owner's
go-ahead, every real trip was checked, and Finance now points this out (#447, PR #449).

## Scenario

A trip of six (Sep 24 – Oct 9) logged 34 shared expenses in USD. Afterwards the organizer reported that she owed
one member exactly what everyone owed that member for an Airbnb, but that member and a second member owed her nothing.

## Investigation

| Possible cause | Check | Result |
|---|---|---|
| A recent change to Finance | Git history of the settle-up code | Ruled out: nothing since Oct 1 |
| Split names not matching members | Every payer and split name against the members | Ruled out |
| Wrong maths | Every pair's debts rebuilt with the app's own rules | Ruled out |
| Debts ticked as paid | Ticks are device-only (localStorage) | Not visible; not needed |
| **Expenses split before people joined** | Member join times against when each expense was saved | **Confirmed** |

| Expense | Total | Last saved | Each of 3 others | 2 late joiners (joined Sep 26) | Organizer |
|---|---|---|---|---|---|
| Rental car | $341.50 | Sep 23 | $56.92 (1/6) | $0 | $170.74 (3/6) |
| Castle tickets | $163.38 | Sep 23 | $27.23 (1/6) | $0 | $81.69 (3/6) |

Nobody overpaid: the three others paid exactly one sixth. The organizer was short $84.15 from each late joiner.

## Root cause

- An **equal** "Everyone" split stores no amounts; it divides among whoever is on the trip, so it follows joins.
- An **individual** split stores the typed amounts. Saved as "All" with amounts for only the people present, it
  leaves out later joiners, and Finance counted a missing amount as **$0** (`splits[debtor] ?? 0` in
  `finance.component.ts`). My Expenses showed the same person an equal share, so the two pages disagreed.

The organizer split both for six ($341.50 ÷ 6 = $56.92) while four people were on the trip; the two missing shares
could only go on her own line.

## Fix

1. **Data, owner-approved:** both expenses re-split into equal sixths (the payer takes the rounding cent). The
   script checked that the new shares summed to the total before writing. Each late joiner now owes the organizer
   $84.15; no one else's numbers changed.
2. **Product (PR #449):** `utils/split-gaps.ts` `leftOutOfSplit()` finds current members an "Everyone" individual
   split has no amount for (a deliberate 0 is not flagged; equal splits and splits among chosen people never are).
   Finance shows a notice per such expense with **Split equally with everyone** / **Set amounts**, and a
   "Leaves out …" chip on its row.
3. **Bug found on the way:** switching an expense back to an equal split in the edit form never cleared its
   amounts (`splits: undefined` is dropped by `updateEntry`). It now saves `splits: null`.

## Follow-ups

- Paid ticks are device-only: #448.
- A scan of every real trip found no other expense leaving people out. Three **equal** "Everyone" expenses on the
  same trip predate the late joiners and re-split into sixths when they joined. That's correct only if they were for
  all six, so the group was asked to confirm.

## Lessons

- A silent default ($0 for a missing amount) made a data-entry gap look like a maths bug: point gaps out instead.
- Groups form over time; split rules have to hold when people join after expenses are logged.
- Rebuild the numbers from the data before touching code.
- When correcting real data: get the owner's go-ahead, change only the named records, and verify totals before writing.
