# Seed Data — harvested from Shawn's real inbox (sweep of 165 emails, 2026-07-06)

Paste-ready content for **SETUP.md step 4** (seed the `Jobs` list and `AgentMemory`)
plus the day-one backlog for `OpenItems`. Verify each row as you enter it — this was
extracted from email traffic, and a human should confirm job numbers before they drive
automation.

---

## 1. `Jobs` list — active jobs

| Job (Title) | JobNumber | CustomerGC | GC contact | AltNames (aliases) | Notes |
| --- | --- | --- | --- | --- | --- |
| Perplexity 181 Fremont 10th & 11th | 11836-45 | SC Builders | Wai Wai Khine — wkhine@scbuildersinc.com | Perplexity; PPLX; 181 Fremont; 10th & 11th Floors | Foreman: Brandon Whitaker. Other SC contacts: Cortney Kiner, Jack Foley, Dominic Gelao (field), Antonio Giovannini |
| 535 Mission 9th Floor — Headway | 11678-45 | GCI | jolaso@gcigc.com; vcervantes@gcigc.com | 535 Mission; Headway; GNR water heater | Super: Brian Price. Startup: Adam Reza |
| 208 Utah St — Abridge AI | 11700-45 | MCS Construction | Heather Prado — hprado@mcsconst.com | 208 Utah; Abridge; Abridge AI; 25-078 (MCS ref) | Closeout phase. MCS PMs: Jeff Peng, Wesley Forbes. As-builts: Rob Aguilar |
| 242 Turk St — Salvation Army | 11670-45 | MCS Construction | Jacob Higle-Ralbovsky — jhralbovsky@mcsconst.com | 242 Turk; Salvation Army | Labor tracking set up 6/17. Coring: Cal Core, PO 1167045-037 |
| 706 Sansome — Shegerian Law | 11689-45 | — | — | Shegerian; 706 Sansome | Break sinks delivered 6/12 (Cal Steam) |
| 345 Spear St | 11922-45 | SC Builders | Dominic Gelao (field) | 345 Spear | ⚠ Brandon reports this job number "isn't popping up in Miter" — fix before billing the tag work |

## 2. `Bids` list — active pursuits

| Job | GC | Contact | Status / dates seen |
| --- | --- | --- | --- |
| Perplexity - 181 Fremont - 8th Floor (B26-294) | SC Builders | Todd Merrill | **Bid due 7/13** (extended from 7/2). Job walk done 6/30. RFI #39 response received 7/6 (EQ-17 plumbing) |
| Deloitte (400 Capitol Mall, L21) | BCCI | Daniel D. Guzman | Bid extended to 6/10; VE master list submitted with bid |
| Disney (1 Market Plaza, 6th Floor) — RFP budget | BCCI | Carlos Salinas / Mik Chemburkar | Addendum No. 3 pricing docs; ADD ALT for off-hours requested |
| Undisclosed Client OMP 6th Floor | GCI | James Collins | Off-hours breakout required on bid form; Addendum #3 w/ RFI responses |
| 26-250 101 Cal Restrooms Fls 10/39/45/46/47 (HVAC) | Source Planning & Construction | Kevin Dearborn | Bid notes 6/30–7/1. Scott M. skeptical of this GC — weigh before spending hours |
| One Front 2nd Floor | Paramount Group | (via Bianca Herrera, Smartsheet row 193) | Pending decision — Bianca waiting on you/Rod |
| 555 Mission 28th | BCLP | (via Bianca Herrera, Smartsheet row 186) | Budgeting request 6/12; Bianca waiting on answer |
| [BUDGET] 384 Post Renovation | Hathaway Dinwiddie | Esteban Ochoa-Black | Proposed schedule posted 7/6 — comments requested |
| Together AI - 2 Henry Adams TI | SC Builders | Alex Lowry | IFP set 6/5; MEP as-builts posted; Jeff Knobel requested bid # |
| Red & White Fleet Ticket Pavilion, Pier 43½ (HVAC) | Rossi Builders | Tim Sheehan | Prevailing wage decision; job-walk photos + RFIs 6/26–27 |
| Robinhood 275 Middlefield Rd, Menlo Park | — | Ferguson quote rec'd 6/8 (Emily McPherson, bidtracer) | Drains no longer at LIST pricing |
| Illumio 3315 Scott TI | — | — | Carlos Corona picking up the budget |

## 3. `AgentMemory` — starter rows

**EntryType = Job Alias** — one row per job above; Content e.g.
`"Perplexity" = "PPLX" = "181 Fremont" = "10th & 11th Floors" → Perplexity 181 Fremont 10th & 11th (11836-45)`

**EntryType = House Rule:**

| Title | Content |
| --- | --- |
| July wage escalation | Any bid whose labor crosses July 2026: include ~$4/hr labor escalation for the wage increase (per David Ortiz, Deloitte bid, 6/10). |
| Job number format | UMI job numbers look like #####-45 (e.g. 11836-45). A number in a subject line is almost always the job. |
| Smartsheet bid mentions | Emails from automation@app.smartsheet.com about "BIDDING-PENDING Bids" are internal bid coordination (usually Bianca Herrera or Scott Molkenbuhr needing an answer) → Bid Pricing Request, action needed. |
| BuildingConnected wrapper | Emails from team@buildingconnected.com: the real sender and GC are named in the body ("X of <GC> sent your company a message"). Match the job from the project name line, not the sender. |
| Signed field tags | A foreman email with a signed T&M / premium-time tag attached = billable extra work → Change Order row + submit to the GC. |
| Bid folder path | Bid proposals live under P:\Bid Proposals\2026 Bid Proposals\<bid #> <job>. |

**EntryType = Contact** (starter set):

| Name | Company / role | Email |
| --- | --- | --- |
| Bonnie Lockner | Ferguson Plumbing Supply | bonnie.lockner@ferguson.com |
| Matthew Cogswell | Cal Steam — Hayward, PM | mcogswell@calsteam.com |
| Casey D'Arcy | Cal Core (coring) | admin@cal-core.com |
| Wai Wai Khine | SC Builders, PM (Perplexity) | wkhine@scbuildersinc.com |
| Heather Prado | MCS Construction, Proj Coordinator | hprado@mcsconst.com |

Internal roster the agent should know: Rod Blackmon (PM), Brian Price (Local 38 Super),
Brandon Whitaker (Foreman, 181 Fremont), Omar Hashem (APM), Vern Leyba, Scott Molkenbuhr
(VP — wants pursuit status updates), Jeff Knobel (PX), Bianca Herrera (bid admin), Jose
Menjivar (VP HVAC), David Ortiz (PM), Rob Aguilar (as-builts), Jenn Thomas (purchasing),
Ana Salazar (project admin).

## 4. `OpenItems` — day-one backlog (real, from the sweep)

| Title | Kind | Job | Status when seeded |
| --- | --- | --- | --- |
| Send floor-drain CO with backup to Wai Wai (approved 6/16 — 3 weeks stale) | Task | Perplexity 11836-45 | Open, DueDate = ASAP |
| Submit 181 Fremont Saturday premium-time tag to SC Builders | Task | 11836-45 | Open |
| Submit 345 Spear 2-hr show-up T&M tag + fix Miter job number | Task | 11922-45 | Open |
| Answer MCS "call it even" proposal on PCO-06 ($500) | Task | Salvation Army 11670-45 | Open — money decision |
| Capture Newport Brass faucet cost/schedule impact (42-day lead) as CO | Task | Perplexity 11836-45 | Open |
| Perplexity 8th Floor bid due 7/13 — submit RFIs + pricing | Task | B26-294 | Open, DueDate 2026-07-13 |
| Confirm 535 Mission startup day (Adam: Tue or Wed) with GCI | Task | 11678-45 | Open |
| Reply to Scott M. with pursuit status updates | Task | — | Open |
| Answer Bianca — One Front row 193 + 555 Mission row 186 | Task | — | Open |
| Comment on 384 Post proposed schedule | Task | 384 Post | Open |
