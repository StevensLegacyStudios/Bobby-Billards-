<#
.SYNOPSIS
  Provisions the United Mechanical "Job Tracking & Automation" SharePoint Lists
  (UMI System Bible v2.0, Section 3) plus the Closeout Docs list.

.DESCRIPTION
  Creates 8 lists with their key columns and choice values. Run once against your
  SharePoint site. Idempotent-ish: skips lists that already exist.

.PREREQUISITES
  Install-Module PnP.PowerShell -Scope CurrentUser
  Connect-PnPOnline -Url "https://<tenant>.sharepoint.com/sites/<YourSite>" -Interactive

.EXAMPLE
  ./provision-sharepoint.ps1 -SiteUrl "https://umi1.sharepoint.com/sites/PlumbingPM"
#>

param(
  [Parameter(Mandatory = $true)] [string]$SiteUrl
)

$ErrorActionPreference = "Stop"
Connect-PnPOnline -Url $SiteUrl -Interactive

function New-List($Title) {
  if (Get-PnPList -Identity $Title -ErrorAction SilentlyContinue) {
    Write-Host "List '$Title' already exists - skipping create." -ForegroundColor Yellow
  } else {
    New-PnPList -Title $Title -Template GenericList -OnQuickLaunch | Out-Null
    Write-Host "Created list '$Title'." -ForegroundColor Green
  }
}

function Add-Text($List, $Name) {
  Add-PnPField -List $List -DisplayName $Name -InternalName ($Name -replace '\W','') -Type Text -AddToDefaultView -ErrorAction SilentlyContinue | Out-Null
}
function Add-Note($List, $Name) {
  Add-PnPField -List $List -DisplayName $Name -InternalName ($Name -replace '\W','') -Type Note -ErrorAction SilentlyContinue | Out-Null
}
function Add-Date($List, $Name) {
  Add-PnPField -List $List -DisplayName $Name -InternalName ($Name -replace '\W','') -Type DateTime -AddToDefaultView -ErrorAction SilentlyContinue | Out-Null
}
function Add-Num($List, $Name) {
  Add-PnPField -List $List -DisplayName $Name -InternalName ($Name -replace '\W','') -Type Number -ErrorAction SilentlyContinue | Out-Null
}
function Add-Bool($List, $Name) {
  Add-PnPField -List $List -DisplayName $Name -InternalName ($Name -replace '\W','') -Type Boolean -ErrorAction SilentlyContinue | Out-Null
}
function Add-Choice($List, $Name, [string[]]$Choices) {
  Add-PnPField -List $List -DisplayName $Name -InternalName ($Name -replace '\W','') -Type Choice -Choices $Choices -AddToDefaultView -ErrorAction SilentlyContinue | Out-Null
}

# ---- LIST 1: Jobs (master) ------------------------------------------------
New-List "Jobs"
Add-Text   "Jobs" "JobNumber"
Add-Text   "Jobs" "CustomerGC"
Add-Text   "Jobs" "GCContactName"
Add-Text   "Jobs" "GCContactEmail"
Add-Text   "Jobs" "Location"
Add-Choice "Jobs" "Division" @("Plumbing","HVAC","Both")
Add-Choice "Jobs" "Status" @("Pending Decision","Bid Approved","Bid Submitted","Bid Won","Active","Closeout","Complete","No Bid","On Hold")
Add-Text   "Jobs" "PM"
Add-Text   "Jobs" "Foreman"
Add-Text   "Jobs" "ForemanPhone"
Add-Date   "Jobs" "StartDate"
Add-Date   "Jobs" "CompletionDate"
Add-Choice "Jobs" "ScheduleRisk" @("Green","Yellow","Red")
Add-Note   "Jobs" "AltNames"   # job-alias matching (Perplexity / 181 Fremont / PPLX)
Add-Note   "Jobs" "Notes"

# ---- LIST 2: Email Intake Log --------------------------------------------
New-List "Email Intake Log"
Add-Text   "Email Intake Log" "SenderName"
Add-Text   "Email Intake Log" "SenderEmail"
Add-Text   "Email Intake Log" "SenderCompany"
Add-Choice "Email Intake Log" "SenderRole" @("GC","Vendor","Internal","Subcontractor","Owner","Architect","Unknown")
Add-Date   "Email Intake Log" "ReceivedDate"
Add-Text   "Email Intake Log" "Job"
Add-Choice "Email Intake Log" "EmailCategory" @("Bid Invite","Bid Pricing Request","Vendor Quote Request","PO Confirmation","Delivery Update","Submittal Submission","Submittal Approval","Closeout Docs","Change Order","RFI Field Coordination","Acknowledgment","General Other")
Add-Num    "Email Intake Log" "AIConfidence"
Add-Bool   "Email Intake Log" "NeedsManualReview"
Add-Choice "Email Intake Log" "ActionRequired" @("Bid Decision Needed","Quote Approval Needed","PO Request to Send","Foreman Alert Needed","Vendor Follow-Up Needed","Submittal Action Needed","Closeout Doc to File","Field Response Needed","No Action")
Add-Choice "Email Intake Log" "ActionStatus" @("New","In Progress","Complete","No Action Needed")
Add-Note   "Email Intake Log" "KeyDataExtracted"
Add-Text   "Email Intake Log" "AttachmentsSaved"

# ---- LIST 3: Bids ---------------------------------------------------------
New-List "Bids"
Add-Text   "Bids" "Job"
Add-Text   "Bids" "GC"
Add-Choice "Bids" "Division" @("Plumbing","HVAC","Both")
Add-Date   "Bids" "BidInviteReceived"
Add-Date   "Bids" "JobWalkDate"
Add-Date   "Bids" "BidDueDate"
Add-Choice "Bids" "DecisionStatus" @("Pending Approval","Approved - Bidding","Declined - No Bid","Bid Submitted","Won","Lost","Cancelled")
Add-Text   "Bids" "AssignedEstimator"
Add-Num    "Bids" "EstimatedValue"
Add-Note   "Bids" "Notes"

# ---- LIST 4: Purchase Orders ---------------------------------------------
New-List "Purchase Orders"
Add-Text   "Purchase Orders" "Job"
Add-Text   "Purchase Orders" "Vendor"
Add-Text   "Purchase Orders" "VendorContactEmail"
Add-Text   "Purchase Orders" "PONumber"
Add-Text   "Purchase Orders" "Description"
Add-Num    "Purchase Orders" "POAmount"
Add-Date   "Purchase Orders" "RequestedDeliveryDate"
Add-Date   "Purchase Orders" "ConfirmedDeliveryDate"
Add-Text   "Purchase Orders" "DeliveryAddress"
Add-Text   "Purchase Orders" "DeliveryAttn"
Add-Text   "Purchase Orders" "ForemanPhone"
Add-Choice "Purchase Orders" "DeliveryStatus" @("Quote Pending","Awaiting PO","PO Issued","Confirmed","Delayed","In Transit","Delivered","Received & Inspected","Complete","Cancelled")
Add-Choice "Purchase Orders" "ScheduleRisk" @("Green","Yellow","Red")
Add-Note   "Purchase Orders" "Notes"

# ---- LIST 5: Submittals ---------------------------------------------------
New-List "Submittals"
Add-Text   "Submittals" "Job"
Add-Text   "Submittals" "SubmittalNumber"
Add-Choice "Submittals" "Type" @("Plumbing Equipment Package","HVAC Equipment Package","Plumbing Fixtures","Controls / BMS","Product Data Sheets","Shop Drawings","Coordination Drawings","O&M Package","Closeout Documents","Other")
Add-Text   "Submittals" "VendorManufacturer"
Add-Text   "Submittals" "Description"
Add-Text   "Submittals" "SubmittedToGC"
Add-Date   "Submittals" "InitialSentDate"
Add-Choice "Submittals" "Status" @("Not Yet Submitted","Submitted - Awaiting Review","Under Review","Approved","Approved as Noted","Revise & Resubmit","Rejected","Resubmitted - Awaiting Review","Complete")
Add-Num    "Submittals" "LongestLeadTimeDays"
Add-Date   "Submittals" "OrderByDate"
Add-Choice "Submittals" "ScheduleRisk" @("Green","Yellow","Red")
Add-Bool   "Submittals" "CutSheetsReceived"
Add-Bool   "Submittals" "InstallSheetsReceived"
Add-Bool   "Submittals" "OMManualsReceived"
Add-Bool   "Submittals" "WarrantyReceived"
Add-Note   "Submittals" "Notes"

# ---- LIST 6: Change Orders ------------------------------------------------
New-List "Change Orders"
Add-Text   "Change Orders" "Job"
Add-Text   "Change Orders" "CONumber"
Add-Text   "Change Orders" "Description"
Add-Choice "Change Orders" "InitiatedBy" @("GC","Owner","UMI","Vendor")
Add-Date   "Change Orders" "RequestedDate"
Add-Num    "Change Orders" "Amount"
Add-Num    "Change Orders" "ScheduleImpactDays"
Add-Choice "Change Orders" "Status" @("Identified","Draft","Submitted to GC","Under Review","Approved","Rejected","Pending More Info","Invoiced","Paid","Closed")
Add-Note   "Change Orders" "Notes"

# ---- LIST 7: Quotes In Progress ------------------------------------------
New-List "Quotes In Progress"
Add-Text   "Quotes In Progress" "Job"
Add-Bool   "Quotes In Progress" "IsBidRelated"
Add-Text   "Quotes In Progress" "Vendor"
Add-Text   "Quotes In Progress" "VendorEmail"
Add-Note   "Quotes In Progress" "WhatWereRequesting"
Add-Date   "Quotes In Progress" "RequestDate"
Add-Date   "Quotes In Progress" "QuoteNeededBy"
Add-Num    "Quotes In Progress" "QuoteAmount"
Add-Text   "Quotes In Progress" "LeadTimeQuoted"
Add-Choice "Quotes In Progress" "Status" @("Requested","Follow-Up Sent","Quote Received","Pending Approval","Approved - PO Requested","Rejected","Closed - No Longer Needed")
Add-Num    "Quotes In Progress" "FollowUpCount"

# ---- LIST 8: Closeout Docs (NEW) -----------------------------------------
New-List "Closeout Docs"
Add-Text   "Closeout Docs" "Job"
Add-Text   "Closeout Docs" "Material"
Add-Text   "Closeout Docs" "SubmittalNumber"
Add-Choice "Closeout Docs" "DocType" @("As-Built","O&M Manual","Warranty Letter","Cut Sheet","Installation","ADA Cert","Test Report","Title 24","Other")
Add-Choice "Closeout Docs" "Source" @("Vendor","Engineering","Internal","GC","Other")
Add-Choice "Closeout Docs" "Status" @("Needed","Requested","Received","Filed","Waived")
Add-Text   "Closeout Docs" "RequestedFrom"
Add-Date   "Closeout Docs" "RequestedDate"
Add-Date   "Closeout Docs" "ReceivedDate"
Add-Date   "Closeout Docs" "FiledDate"
Add-Text   "Closeout Docs" "StagingPath"
Add-Text   "Closeout Docs" "JobPath"
Add-Note   "Closeout Docs" "Notes"

Write-Host "`nDone. 8 lists provisioned on $SiteUrl." -ForegroundColor Cyan
Write-Host "Next: build Power Automate Flow 1 (see docs/MICROSOFT_365_BUILD.md)." -ForegroundColor Cyan
