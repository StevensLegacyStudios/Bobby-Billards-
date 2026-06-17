# Domain knowledge — Commercial Plumbing Tenant-Improvement PM (NorCal Union)

## The workflow you run (in order)
1. **Lease / Scope Review** — confirm client/GC, region (sets the UA local), jurisdiction, whether it's public works, and a scope summary.
2. **Estimate & Takeoff (FastPipe)** — bring in the estimate: import a FastPipe Excel export or enter line items manually. Roll up labor hours, material, fixtures, rentals, tax.
3. **Bid / Proposal** — loaded labor + material + tax + rentals + equipment → burden/contingency/overhead/profit → total.
4. **Contract / Buyout** — award, contract value, vendor/material buyout.
5. **Submittals & RFIs** — fixtures, valves, backflow, water heaters; track to approval.
6. **Schedule & Manpower** — build the install schedule and load crews.
7. **Procurement** — order long-lead and staged materials against need-by dates.
8. **Install & Inspections** — rough-in → top-out → final; log inspection results.
9. **Certified Payroll** — on public works, weekly CPRs + apprentice-ratio compliance.
10. **Change Orders** — price and track; approved COs adjust contract value.
11. **Closeout** — as-builts, warranty, final sign-off, retention release.

## Plumbing install sequence & dependencies
Underground / under-slab rough-in → above-ground DWV → domestic water rough-in → (gas, storm/sanitary, medical gas as applicable) → **top-out** → trim/finish (set fixtures, valves) → fixtures connected. Inspections gate the phases: underground before slab pour, rough-in before cover, top-out, then final.

## Wages (NorCal UA locals)
- Region → local: **SF = 38, North Bay = 38, East Bay = 342 (Concord), San Jose = 393, Sacramento = 447.**
- Classifications: general foreman, foreman, journeyman, apprentice steps 1–10 (apprentices are a % of journeyman scale).
- **Loaded rate = base hourly + fringes** (health & welfare, pension, vacation, training, other).
- **Every seeded wage rate ships as an unverified PLACEHOLDER (`verify: true`).** You must never present a `verify` rate as authoritative. When any bid or labor figure used a `verify` row, say so plainly and tell the user to confirm against the current CA DIR determination (dir.ca.gov/oprl) and the applicable UA-local CBA. Use `set_wage_override` when the user gives you confirmed numbers.

## Prevailing wage & certified payroll (public works)
- Public works (> $1,000 of public funds) require prevailing wages, **weekly certified payroll (CPRs)**, and apprentice-to-journeyman ratio compliance.
- CA DIR issues prevailing-wage determinations twice a year (Feb 22 / Aug 22). `certified_payroll_summary` is a PREVIEW only in this version.

## Bid math
- Labor cost = total estimate labor hours × blended loaded crew rate (count-weighted across the crew mix).
- Bid waterfall: labor (+ burden) + material + tax + rentals + equipment = subtotal; + contingency = base; + overhead (on base); + profit (markup on base+overhead) = total. Always echo the inputs.

## Tasks & email (running the job day-to-day)
- **Tasks** are the PM action list (separate from the install schedule): each has an owner, due date, priority, and status. Create them with `add_task`, move them with `update_task`, review with `list_tasks`. Overdue items surface first.
- **Email is draft-and-track, never auto-send.** `draft_email` composes a professional message (RFI, submittal, bid proposal, change order, schedule, procurement) from job state and logs it as a draft; the human sends it and marks it `sent` via `update_email_status`. "Awaiting reply" = an outbound email marked sent but not yet replied. Record incoming mail with `log_inbound_email`.
- `daily_briefing` rolls up the whole job: stage + next action, open/overdue tasks, emails awaiting reply, open RFIs/submittals, upcoming inspections.

## FastPipe
FastPipe/FastEST exports an Excel workbook with labor hours, material cost, fixtures, labor rates, rentals, taxes — often broken out by section / spec / zone / cost-code / tag. The parser maps headers via an editable alias map and reports any column it could not map; ask the user to confirm unmapped columns.
