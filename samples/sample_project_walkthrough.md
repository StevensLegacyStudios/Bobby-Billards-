# Sample walkthrough

A scripted run that exercises the full v1 loop. (`npm run e2e` performs these same steps
deterministically and asserts on the results, without needing an API key.)

```text
$ npm run dev

/new "Acme Tower 12th-floor TI" region=East Bay
  → Creates the project, resolves UA Local 342, seeds placeholder wage rows.
  NEXT ACTION: Lease / Scope Review — confirm the basics.
  OPEN QUESTIONS:
    • Is this a public works job (> $1,000 of public funds)?
    • (region already set to East Bay → Local 342)

/ingest samples/sample_fastpipe.xlsx
  → Parses the FastPipe export: 5 line items, 338.5 labor hours, $21,420 material.
  → Reports "Notes" as an unmapped column — confirm or add an alias.

you › Public works yes. Crew is 1 foreman, 3 journeymen, 1 step-3 apprentice.
      Use 15% overhead and 10% profit. Compute the bid.
  → update_project (publicWorks, crew) → compute_labor_cost → compute_bid
  → Bid waterfall printed with every input echoed.
  → assumptionFlags: "Labor uses UNVERIFIED placeholder wage rates — confirm before quoting."

you › Confirmed journeyman base is $95/hr per the Local 342 CBA. Re-run the bid.
  → set_wage_override (journeyman, $95, verify cleared) → recompute labor + bid
  → New total; the journeyman row is no longer flagged verify.

/status
  → Deterministic NEXT ACTION + OPEN QUESTIONS footer for the active project.
```

The `samples/sample_fastpipe.xlsx` file deliberately includes a couple of title rows above
the header and an extra **Notes** column so you can see header detection and unmapped-column
reporting in action. Regenerate it with `npx tsx scripts/make_sample.ts`.
