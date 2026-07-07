<#
.SYNOPSIS
  Creates the SharePoint closeout folder structure for one job (see
  docs/CLOSEOUT_FOLDERS.md). Run when a job is awarded.

.PREREQUISITES
  Install-Module PnP.PowerShell -Scope CurrentUser

.EXAMPLE
  ./provision-closeout-folders.ps1 `
    -SiteUrl "https://unitedmechanicalinc.sharepoint.com/sites/QualityControlManagementTeam" `
    -JobName "Perplexity 181 Fremont" -JobNumber "11836-15"
#>

param(
  [Parameter(Mandatory = $true)] [string]$SiteUrl,
  [Parameter(Mandatory = $true)] [string]$JobName,
  [Parameter(Mandatory = $true)] [string]$JobNumber,
  [string]$Library = "Shared Documents"
)

$ErrorActionPreference = "Stop"
Connect-PnPOnline -Url $SiteUrl -Interactive

$jobFolder = "$JobName ($JobNumber)"
$base = "$Library/Jobs/$jobFolder"

# Folders to create (parents first). The per-material folders are created later by the
# flow on submittal approval; this lays down the job skeleton + the handover binder.
$folders = @(
  "$Library/Jobs",
  $base,
  "$base/Submittals",
  "$base/Emails",
  "$base/Closeout",
  "$base/Closeout/_Final Handover",
  "$base/Closeout/_Final Handover/As-Builts",
  "$base/Closeout/_Final Handover/O&Ms",
  "$base/Closeout/_Final Handover/Warranty Letters",
  "$base/Closeout/_Final Handover/Test Reports & Title 24"
)

foreach ($f in $folders) {
  Resolve-PnPFolder -SiteRelativePath $f | Out-Null
  Write-Host "Ensured: $f" -ForegroundColor Green
}

Write-Host "`nCloseout structure ready for '$jobFolder'." -ForegroundColor Cyan
Write-Host "Staging (one-time, in your synced OneDrive): PM Docs/All Closeout Docs/<material>/" -ForegroundColor Yellow
