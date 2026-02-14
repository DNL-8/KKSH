param(
  [int]$KeepDays = 14,
  [switch]$DryRun
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogsRoot = Join-Path $ProjectRoot "logs"
$ArchiveRoot = Join-Path $LogsRoot "archive"
$RunStamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$RunRoot = Join-Path $ArchiveRoot $RunStamp

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    if (-not $DryRun) {
      New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
  }
}

function Classify-Log([string]$Name) {
  $fileName = $Name.ToLowerInvariant()
  if ($fileName -match "api") { return "api" }
  if ($fileName -match "client|web|vite") { return "client" }
  if ($fileName -match "devall|start|test|run") { return "dev" }
  return "misc"
}

function Normalize-BaseName([string]$BaseName) {
  $clean = $BaseName -replace '^\.+', ''
  $clean = $clean -replace '^tmp[_-]?', ''
  $clean = $clean -replace '[^a-zA-Z0-9._-]', '-'
  $clean = $clean -replace '-{2,}', '-'
  if ([string]::IsNullOrWhiteSpace($clean)) {
    return "log"
  }
  return $clean.ToLowerInvariant()
}

$rootLogs = Get-ChildItem -LiteralPath $ProjectRoot -File -Filter "*.log" -Force |
  Where-Object { $_.DirectoryName -eq $ProjectRoot }

if ($rootLogs.Count -eq 0) {
  Write-Host "No root .log files found in $ProjectRoot"
} else {
  Ensure-Directory $RunRoot
  $movedCount = 0
  $skippedCount = 0

  foreach ($logFile in $rootLogs) {
    $bucket = Classify-Log $logFile.Name
    $targetDir = Join-Path $RunRoot $bucket
    Ensure-Directory $targetDir

    $baseName = Normalize-BaseName $logFile.BaseName
    $targetPath = Join-Path $targetDir ($baseName + ".log")
    $suffix = 1

    while (Test-Path -LiteralPath $targetPath) {
      $targetPath = Join-Path $targetDir ("{0}-{1}.log" -f $baseName, $suffix)
      $suffix += 1
    }

    if ($DryRun) {
      Write-Host "[DRY] $($logFile.Name) -> $targetPath"
      continue
    }

    try {
      Move-Item -LiteralPath $logFile.FullName -Destination $targetPath -ErrorAction Stop
      $movedCount += 1
      Write-Host "Moved: $($logFile.Name) -> $targetPath"
    } catch {
      $skippedCount += 1
      Write-Warning "Skipped: $($logFile.Name) (file in use or locked)."
    }
  }

  if (-not $DryRun) {
    Write-Host ""
    Write-Host "Moved $movedCount file(s) into $RunRoot"
    if ($skippedCount -gt 0) {
      Write-Host "Skipped $skippedCount file(s). Run again after stopping processes."
    }
    if ($movedCount -eq 0 -and (Test-Path -LiteralPath $RunRoot)) {
      Remove-Item -LiteralPath $RunRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if (Test-Path -LiteralPath $ArchiveRoot) {
  $cutoff = (Get-Date).AddDays(-1 * [Math]::Abs($KeepDays))
  $oldRuns = Get-ChildItem -LiteralPath $ArchiveRoot -Directory -Force |
    Where-Object { $_.LastWriteTime -lt $cutoff }

  foreach ($oldRun in $oldRuns) {
    if ($DryRun) {
      Write-Host "[DRY] Remove old archive: $($oldRun.FullName)"
      continue
    }

    try {
      Remove-Item -LiteralPath $oldRun.FullName -Recurse -Force -ErrorAction Stop
      Write-Host "Removed old archive: $($oldRun.FullName)"
    } catch {
      Write-Warning "Failed to remove old archive: $($oldRun.FullName)"
    }
  }

  if (-not $DryRun) {
    Write-Host "Retention cleanup complete (keep $KeepDays days)."
  }
}
