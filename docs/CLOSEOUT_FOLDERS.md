# Closeout folder design (UMI plumbing)

A clean, cloud-reachable structure for closeout docs that matches how you already work
(stage by material) and produces the by-doc-type binder the GC actually wants at handover.
Two locations, because they have two jobs:

## 1. Staging — OneDrive for Business (your working area)

Where docs land as vendors send them, **before** the submittal is approved. Stays synced to
your desktop so nothing changes about how you work — but because it's OneDrive (not a
local-only folder), Power Automate can file into it.

```
OneDrive - United Mechanical/
└── PM Docs/
    └── All Closeout Docs/
        └── <Material>/                     ← e.g. "Kohler K-30810 Water Closet"
            ├── Cut Sheets/
            ├── Installation/
            ├── O&M/
            └── Warranty/
```

The tool's `request_closeout_docs` / `log_closeout_doc_received` point here
(`PM Docs/All Closeout Docs/<material>`). One-time setup: drag the existing desktop
`PM Docs` folder into your OneDrive folder until it shows the green sync check.

## 2. Job record — SharePoint (shared, per job)

When the **GC returns the submittal approved**, that material's docs move from staging into
the job's closeout folder. Organized by material (your system of record) **plus** a
`_Final Handover` folder where the by-doc-type binder is assembled for the GC.

```
Documents/                                  (SharePoint PM site library)
└── Jobs/
    └── <Job Name> (<Job#>)/                ← e.g. "Perplexity 181 Fremont (11836-15)"
        ├── Submittals/
        ├── Emails/                         ← Flow 1 auto-saves attachments here
        └── Closeout/
            ├── <Material>/                 ← filed per material on approval (tool target)
            │   ├── Cut Sheets/
            │   ├── Installation/
            │   ├── O&M/
            │   └── Warranty/
            └── _Final Handover/            ← the deliverable, by doc type
                ├── As-Builts/              ← from Engineering (Natalie Ryan)
                ├── O&Ms/
                ├── Warranty Letters/       ← UMI template
                └── Test Reports & Title 24/
```

The tool's `file_closeout_docs` targets `Jobs/<Job> (Job#)/Closeout/<material>` — exactly
this tree under the `Documents` library.

## The rule (what moves, when)

1. **Submittal assembled →** request closeout docs from the vendor in the same email
   (`request_closeout_docs`). Rows created in the **Closeout Docs** SharePoint list.
2. **Docs arrive →** drop into `PM Docs/All Closeout Docs/<material>/...`
   (`log_closeout_doc_received`); rows flip to **Received**.
3. **GC approves the submittal →** Power Automate moves that material's files from OneDrive
   staging into `…/Closeout/<material>/` and copies the As-Built / O&M / Warranty into
   `_Final Handover/`; rows flip to **Filed** (`file_closeout_docs`).
4. **Job hits Closeout status →** `_Final Handover` is the complete package to send the GC.

## Provisioning

Per-job SharePoint closeout folders (run when a job is awarded):

```powershell
./scripts/provision-closeout-folders.ps1 `
  -SiteUrl "https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam" `
  -JobName "Perplexity 181 Fremont" -JobNumber "11836-15"
```

The OneDrive staging root (`PM Docs/All Closeout Docs`) you create once, by hand, in your
synced OneDrive folder.
