# Provisioning the 10 lists WITHOUT PowerShell (plan B)

PowerShell is blocked on company machines more often than not — this route needs no
downloads, no admin rights, and nothing from IT. You build a small **one-time flow in
Power Automate** that creates all 10 lists and their 121 columns using the standard
SharePoint connector, signed in as you.

Time: ~20 minutes to build, ~3 minutes to run. You run it ONCE and then delete or ignore it.

> If a list already exists on the site (e.g. you created one by hand earlier), the flow
> will show a failure for that list's create step and keep going on the next loop pass —
> that specific list just keeps whatever columns it already had.

---

## Step 1 — new flow

1. Power Automate → **My flows** → **+ New flow** → **Instant cloud flow**.
2. Name: `Provision UMI Lists (run once)`.
3. Trigger: **Manually trigger a flow** → Create.

## Step 2 — Compose action holding the blueprint

1. Click **⊕** under the trigger → **Add an action** → search **compose** → pick
   **Compose** (Data Operations).
2. Click the action's title and **rename it to exactly**: `Blueprint`
3. In its **Inputs** box, paste the ENTIRE JSON blob from the bottom of this file
   (everything between the BEGIN/END markers, markers not included).

## Step 3 — outer loop (one pass per list)

1. **⊕** under Blueprint → **Add an action** → search **apply to each** → pick
   **Apply to each** (Control).
2. **Rename it to exactly**: `EachList`
3. Click its **Select an output** box → click the **fx** (function) icon → paste:
   `outputs('Blueprint')` → **Add/OK**.

## Step 4 — create the list (inside EachList)

1. Inside the EachList box, click **⊕ Add an action** → search
   **send an http request to sharepoint** → pick **Send an HTTP request to SharePoint**.
2. **Rename it to exactly**: `CreateList`
3. Fill in:
   - **Site Address**: pick `https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam` from the dropdown (or Enter custom value and paste it).
   - **Method**: `POST`
   - **Uri**: `_api/web/lists`
   - **Headers** — two rows:
     | key | value |
     | --- | --- |
     | accept | application/json;odata=verbose |
     | content-type | application/json;odata=verbose |
   - **Body**: click in the box → **fx** → paste this WHOLE expression → OK:
     ```
     concat('{"__metadata":{"type":"SP.List"},"BaseTemplate":100,"OnQuickLaunch":true,"Title":"', items('EachList')?['title'], '"}')
     ```

## Step 5 — inner loop (one pass per column)

1. STILL INSIDE EachList, click **⊕ Add an action** BELOW CreateList → **Apply to each** (Control).
2. **Rename it to exactly**: `EachField`
3. Its **Select an output** → **fx** → paste: `items('EachList')?['fields']` → OK.
4. So CreateList failures don't stop the run: click **EachField** → **⋯ / Settings** →
   **Run after** → check BOTH **is successful** and **has failed** for CreateList → save.

## Step 6 — create the column (inside EachField)

1. Inside EachField → **⊕ Add an action** → **Send an HTTP request to SharePoint** again.
2. **Rename it to exactly**: `CreateField`
3. Fill in:
   - **Site Address**: same site.
   - **Method**: `POST`
   - **Uri**: **fx** → paste:
     ```
     concat('_api/web/lists/getbytitle(''', items('EachList')?['title'], ''')/fields/createfieldasxml')
     ```
   - **Headers**: same two rows as Step 4.
   - **Body**: **fx** → paste:
     ```
     concat('{"parameters":{"__metadata":{"type":"SP.XmlSchemaFieldCreationInformation"},"SchemaXml":"', items('EachField')?['xml'], '","Options":', string(items('EachField')?['opts']), '}}')
     ```

## Step 7 — run it

1. **Save** (top right). Fix any red errors it flags (usually a typo in a rename or expression).
2. **Test** (top right) → **Manually** → **Test** → **Run flow**.
3. It grinds through ~131 SharePoint calls — takes 2–4 minutes. Green check = done.
4. Verify: site → ⚙ → **Site contents** → the 10 lists are there. Open `AgentMemory` →
   its columns (EntryType, Job, JobNumber, Content, Active, Source) are there.
5. You never need this flow again. Turn it off or delete it.

Then continue with `docs/SETUP.md` step 3's remaining bits (closeout folders can be made
by hand in the library for now; OneDrive move) and step 4 (paste `docs/SEED_DATA.md`).

---

## The blueprint JSON (paste into the `Blueprint` Compose action)

BEGIN — copy everything AFTER this line
```json
[
 {
  "title": "Jobs",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='JobNumber' Name='JobNumber' StaticName='JobNumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='CustomerGC' Name='CustomerGC' StaticName='CustomerGC'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='GCContactName' Name='GCContactName' StaticName='GCContactName'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='GCContactEmail' Name='GCContactEmail' StaticName='GCContactEmail'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Location' Name='Location' StaticName='Location'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Division' Name='Division' StaticName='Division' Format='Dropdown'><CHOICES><CHOICE>Plumbing</CHOICE><CHOICE>HVAC</CHOICE><CHOICE>Both</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Status' Name='Status' StaticName='Status' Format='Dropdown'><CHOICES><CHOICE>Pending Decision</CHOICE><CHOICE>Bid Approved</CHOICE><CHOICE>Bid Submitted</CHOICE><CHOICE>Bid Won</CHOICE><CHOICE>Active</CHOICE><CHOICE>Closeout</CHOICE><CHOICE>Complete</CHOICE><CHOICE>No Bid</CHOICE><CHOICE>On Hold</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='PM' Name='PM' StaticName='PM'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Foreman' Name='Foreman' StaticName='Foreman'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='ForemanPhone' Name='ForemanPhone' StaticName='ForemanPhone'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='StartDate' Name='StartDate' StaticName='StartDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='CompletionDate' Name='CompletionDate' StaticName='CompletionDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='ScheduleRisk' Name='ScheduleRisk' StaticName='ScheduleRisk' Format='Dropdown'><CHOICES><CHOICE>Green</CHOICE><CHOICE>Yellow</CHOICE><CHOICE>Red</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='AltNames' Name='AltNames' StaticName='AltNames'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "Email Intake Log",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='SenderName' Name='SenderName' StaticName='SenderName'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='SenderEmail' Name='SenderEmail' StaticName='SenderEmail'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='SenderCompany' Name='SenderCompany' StaticName='SenderCompany'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='SenderRole' Name='SenderRole' StaticName='SenderRole' Format='Dropdown'><CHOICES><CHOICE>GC</CHOICE><CHOICE>Vendor</CHOICE><CHOICE>Internal</CHOICE><CHOICE>Subcontractor</CHOICE><CHOICE>Owner</CHOICE><CHOICE>Architect</CHOICE><CHOICE>Unknown</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='ReceivedDate' Name='ReceivedDate' StaticName='ReceivedDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='EmailCategory' Name='EmailCategory' StaticName='EmailCategory' Format='Dropdown'><CHOICES><CHOICE>Bid Invite</CHOICE><CHOICE>Bid Pricing Request</CHOICE><CHOICE>Vendor Quote Request</CHOICE><CHOICE>PO Confirmation</CHOICE><CHOICE>Delivery Update</CHOICE><CHOICE>Submittal Submission</CHOICE><CHOICE>Submittal Approval</CHOICE><CHOICE>Closeout Docs</CHOICE><CHOICE>Change Order</CHOICE><CHOICE>RFI Field Coordination</CHOICE><CHOICE>Acknowledgment</CHOICE><CHOICE>General Other</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='AIConfidence' Name='AIConfidence' StaticName='AIConfidence'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='NeedsManualReview' Name='NeedsManualReview' StaticName='NeedsManualReview'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Choice' DisplayName='ActionRequired' Name='ActionRequired' StaticName='ActionRequired' Format='Dropdown'><CHOICES><CHOICE>Bid Decision Needed</CHOICE><CHOICE>Quote Approval Needed</CHOICE><CHOICE>PO Request to Send</CHOICE><CHOICE>Foreman Alert Needed</CHOICE><CHOICE>Vendor Follow-Up Needed</CHOICE><CHOICE>Submittal Action Needed</CHOICE><CHOICE>Closeout Doc to File</CHOICE><CHOICE>Field Response Needed</CHOICE><CHOICE>No Action</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='ActionStatus' Name='ActionStatus' StaticName='ActionStatus' Format='Dropdown'><CHOICES><CHOICE>New</CHOICE><CHOICE>In Progress</CHOICE><CHOICE>Complete</CHOICE><CHOICE>No Action Needed</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='KeyDataExtracted' Name='KeyDataExtracted' StaticName='KeyDataExtracted'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Text' DisplayName='AttachmentsSaved' Name='AttachmentsSaved' StaticName='AttachmentsSaved'/>",
    "opts": 8
   }
  ]
 },
 {
  "title": "Bids",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='GC' Name='GC' StaticName='GC'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Division' Name='Division' StaticName='Division' Format='Dropdown'><CHOICES><CHOICE>Plumbing</CHOICE><CHOICE>HVAC</CHOICE><CHOICE>Both</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='BidInviteReceived' Name='BidInviteReceived' StaticName='BidInviteReceived'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='JobWalkDate' Name='JobWalkDate' StaticName='JobWalkDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='BidDueDate' Name='BidDueDate' StaticName='BidDueDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='DecisionStatus' Name='DecisionStatus' StaticName='DecisionStatus' Format='Dropdown'><CHOICES><CHOICE>Pending Approval</CHOICE><CHOICE>Approved - Bidding</CHOICE><CHOICE>Declined - No Bid</CHOICE><CHOICE>Bid Submitted</CHOICE><CHOICE>Won</CHOICE><CHOICE>Lost</CHOICE><CHOICE>Cancelled</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='AssignedEstimator' Name='AssignedEstimator' StaticName='AssignedEstimator'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='EstimatedValue' Name='EstimatedValue' StaticName='EstimatedValue'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "Purchase Orders",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Vendor' Name='Vendor' StaticName='Vendor'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='VendorContactEmail' Name='VendorContactEmail' StaticName='VendorContactEmail'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='PONumber' Name='PONumber' StaticName='PONumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Description' Name='Description' StaticName='Description'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='POAmount' Name='POAmount' StaticName='POAmount'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='RequestedDeliveryDate' Name='RequestedDeliveryDate' StaticName='RequestedDeliveryDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='ConfirmedDeliveryDate' Name='ConfirmedDeliveryDate' StaticName='ConfirmedDeliveryDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='DeliveryAddress' Name='DeliveryAddress' StaticName='DeliveryAddress'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='DeliveryAttn' Name='DeliveryAttn' StaticName='DeliveryAttn'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='ForemanPhone' Name='ForemanPhone' StaticName='ForemanPhone'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='DeliveryStatus' Name='DeliveryStatus' StaticName='DeliveryStatus' Format='Dropdown'><CHOICES><CHOICE>Quote Pending</CHOICE><CHOICE>Awaiting PO</CHOICE><CHOICE>PO Issued</CHOICE><CHOICE>Confirmed</CHOICE><CHOICE>Delayed</CHOICE><CHOICE>In Transit</CHOICE><CHOICE>Delivered</CHOICE><CHOICE>Received &amp; Inspected</CHOICE><CHOICE>Complete</CHOICE><CHOICE>Cancelled</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='ScheduleRisk' Name='ScheduleRisk' StaticName='ScheduleRisk' Format='Dropdown'><CHOICES><CHOICE>Green</CHOICE><CHOICE>Yellow</CHOICE><CHOICE>Red</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "Submittals",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='SubmittalNumber' Name='SubmittalNumber' StaticName='SubmittalNumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Type' Name='Type' StaticName='Type' Format='Dropdown'><CHOICES><CHOICE>Plumbing Equipment Package</CHOICE><CHOICE>HVAC Equipment Package</CHOICE><CHOICE>Plumbing Fixtures</CHOICE><CHOICE>Controls / BMS</CHOICE><CHOICE>Product Data Sheets</CHOICE><CHOICE>Shop Drawings</CHOICE><CHOICE>Coordination Drawings</CHOICE><CHOICE>O&amp;M Package</CHOICE><CHOICE>Closeout Documents</CHOICE><CHOICE>Other</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='VendorManufacturer' Name='VendorManufacturer' StaticName='VendorManufacturer'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Description' Name='Description' StaticName='Description'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='SubmittedToGC' Name='SubmittedToGC' StaticName='SubmittedToGC'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='InitialSentDate' Name='InitialSentDate' StaticName='InitialSentDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Status' Name='Status' StaticName='Status' Format='Dropdown'><CHOICES><CHOICE>Not Yet Submitted</CHOICE><CHOICE>Submitted - Awaiting Review</CHOICE><CHOICE>Under Review</CHOICE><CHOICE>Approved</CHOICE><CHOICE>Approved as Noted</CHOICE><CHOICE>Revise &amp; Resubmit</CHOICE><CHOICE>Rejected</CHOICE><CHOICE>Resubmitted - Awaiting Review</CHOICE><CHOICE>Complete</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='LongestLeadTimeDays' Name='LongestLeadTimeDays' StaticName='LongestLeadTimeDays'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='OrderByDate' Name='OrderByDate' StaticName='OrderByDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='ScheduleRisk' Name='ScheduleRisk' StaticName='ScheduleRisk' Format='Dropdown'><CHOICES><CHOICE>Green</CHOICE><CHOICE>Yellow</CHOICE><CHOICE>Red</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='CutSheetsReceived' Name='CutSheetsReceived' StaticName='CutSheetsReceived'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='InstallSheetsReceived' Name='InstallSheetsReceived' StaticName='InstallSheetsReceived'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='OMManualsReceived' Name='OMManualsReceived' StaticName='OMManualsReceived'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='WarrantyReceived' Name='WarrantyReceived' StaticName='WarrantyReceived'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "Change Orders",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='CONumber' Name='CONumber' StaticName='CONumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Description' Name='Description' StaticName='Description'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='InitiatedBy' Name='InitiatedBy' StaticName='InitiatedBy' Format='Dropdown'><CHOICES><CHOICE>GC</CHOICE><CHOICE>Owner</CHOICE><CHOICE>UMI</CHOICE><CHOICE>Vendor</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='RequestedDate' Name='RequestedDate' StaticName='RequestedDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='Amount' Name='Amount' StaticName='Amount'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Number' DisplayName='ScheduleImpactDays' Name='ScheduleImpactDays' StaticName='ScheduleImpactDays'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Status' Name='Status' StaticName='Status' Format='Dropdown'><CHOICES><CHOICE>Identified</CHOICE><CHOICE>Draft</CHOICE><CHOICE>Submitted to GC</CHOICE><CHOICE>Under Review</CHOICE><CHOICE>Approved</CHOICE><CHOICE>Rejected</CHOICE><CHOICE>Pending More Info</CHOICE><CHOICE>Invoiced</CHOICE><CHOICE>Paid</CHOICE><CHOICE>Closed</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "Quotes In Progress",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='IsBidRelated' Name='IsBidRelated' StaticName='IsBidRelated'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Text' DisplayName='Vendor' Name='Vendor' StaticName='Vendor'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='VendorEmail' Name='VendorEmail' StaticName='VendorEmail'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='WhatWereRequesting' Name='WhatWereRequesting' StaticName='WhatWereRequesting'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='RequestDate' Name='RequestDate' StaticName='RequestDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='QuoteNeededBy' Name='QuoteNeededBy' StaticName='QuoteNeededBy'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='QuoteAmount' Name='QuoteAmount' StaticName='QuoteAmount'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Text' DisplayName='LeadTimeQuoted' Name='LeadTimeQuoted' StaticName='LeadTimeQuoted'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Status' Name='Status' StaticName='Status' Format='Dropdown'><CHOICES><CHOICE>Requested</CHOICE><CHOICE>Follow-Up Sent</CHOICE><CHOICE>Quote Received</CHOICE><CHOICE>Pending Approval</CHOICE><CHOICE>Approved - PO Requested</CHOICE><CHOICE>Rejected</CHOICE><CHOICE>Closed - No Longer Needed</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='FollowUpCount' Name='FollowUpCount' StaticName='FollowUpCount'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "Closeout Docs",
  "fields": [
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Material' Name='Material' StaticName='Material'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='SubmittalNumber' Name='SubmittalNumber' StaticName='SubmittalNumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='DocType' Name='DocType' StaticName='DocType' Format='Dropdown'><CHOICES><CHOICE>As-Built</CHOICE><CHOICE>O&amp;M Manual</CHOICE><CHOICE>Warranty Letter</CHOICE><CHOICE>Cut Sheet</CHOICE><CHOICE>Installation</CHOICE><CHOICE>ADA Cert</CHOICE><CHOICE>Test Report</CHOICE><CHOICE>Title 24</CHOICE><CHOICE>Other</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Source' Name='Source' StaticName='Source' Format='Dropdown'><CHOICES><CHOICE>Vendor</CHOICE><CHOICE>Engineering</CHOICE><CHOICE>Internal</CHOICE><CHOICE>GC</CHOICE><CHOICE>Other</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Status' Name='Status' StaticName='Status' Format='Dropdown'><CHOICES><CHOICE>Needed</CHOICE><CHOICE>Requested</CHOICE><CHOICE>Received</CHOICE><CHOICE>Filed</CHOICE><CHOICE>Waived</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='RequestedFrom' Name='RequestedFrom' StaticName='RequestedFrom'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='RequestedDate' Name='RequestedDate' StaticName='RequestedDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='ReceivedDate' Name='ReceivedDate' StaticName='ReceivedDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='FiledDate' Name='FiledDate' StaticName='FiledDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='StagingPath' Name='StagingPath' StaticName='StagingPath'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='JobPath' Name='JobPath' StaticName='JobPath'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "OpenItems",
  "fields": [
   {
    "xml": "<Field Type='Choice' DisplayName='Kind' Name='Kind' StaticName='Kind' Format='Dropdown'><CHOICES><CHOICE>Quote Request</CHOICE><CHOICE>PO Confirmation</CHOICE><CHOICE>Submittal</CHOICE><CHOICE>Closeout Docs</CHOICE><CHOICE>Task</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='JobNumber' Name='JobNumber' StaticName='JobNumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Vendor' Name='Vendor' StaticName='Vendor'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='ContactName' Name='ContactName' StaticName='ContactName'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='ContactEmail' Name='ContactEmail' StaticName='ContactEmail'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='ThreadSubject' Name='ThreadSubject' StaticName='ThreadSubject'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='SentAt' Name='SentAt' StaticName='SentAt'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='LastNudgeAt' Name='LastNudgeAt' StaticName='LastNudgeAt'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='DateTime' DisplayName='DueDate' Name='DueDate' StaticName='DueDate'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Number' DisplayName='NudgeCount' Name='NudgeCount' StaticName='NudgeCount'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Urgency' Name='Urgency' StaticName='Urgency' Format='Dropdown'><CHOICES><CHOICE>High</CHOICE><CHOICE>Normal</CHOICE><CHOICE>Low</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Choice' DisplayName='Status' Name='Status' StaticName='Status' Format='Dropdown'><CHOICES><CHOICE>Open</CHOICE><CHOICE>Nudged</CHOICE><CHOICE>Escalated</CHOICE><CHOICE>Closed</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='Notes' Name='Notes' StaticName='Notes'/>",
    "opts": 0
   }
  ]
 },
 {
  "title": "AgentMemory",
  "fields": [
   {
    "xml": "<Field Type='Choice' DisplayName='EntryType' Name='EntryType' StaticName='EntryType' Format='Dropdown'><CHOICES><CHOICE>Job Alias</CHOICE><CHOICE>Correction</CHOICE><CHOICE>Contact</CHOICE><CHOICE>House Rule</CHOICE></CHOICES></Field>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='Job' Name='Job' StaticName='Job'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Text' DisplayName='JobNumber' Name='JobNumber' StaticName='JobNumber'/>",
    "opts": 8
   },
   {
    "xml": "<Field Type='Note' DisplayName='Content' Name='Content' StaticName='Content'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Boolean' DisplayName='Active' Name='Active' StaticName='Active'/>",
    "opts": 0
   },
   {
    "xml": "<Field Type='Text' DisplayName='Source' Name='Source' StaticName='Source'/>",
    "opts": 8
   }
  ]
 }
]
```
END — copy everything BEFORE this line
