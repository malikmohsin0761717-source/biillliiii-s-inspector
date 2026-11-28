param(
    [string]$TargetPath = 'C:\Programs  Pivates\Agent Start\Biillliiii_Inspector_v0.4_Automatic_Sessions\biillliiii_inspector_v5_development'
)

$ErrorActionPreference = 'Stop'
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Files = @(
    'cloud-auth.js',
    'ui\app.js',
    'ui\styles.css',
    'tests\cloud-auth.test.js',
    'tests\cloud-auth-email-ux.test.js'
)
$Preserve = @('data\projects.json', 'data\auth.json', '.env')

function Get-RelativeHash([string]$Root, [string]$RelativePath) {
    $Path = Join-Path $Root $RelativePath
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    }
    return 'MISSING'
}

if (-not (Test-Path -LiteralPath $TargetPath -PathType Container)) {
    throw "Target project folder nahi mila: $TargetPath"
}
$TargetPath = (Resolve-Path -LiteralPath $TargetPath).Path
$TargetPackage = Join-Path $TargetPath 'package.json'
$SourcePackage = Join-Path $SourceRoot 'package.json'
if (-not (Test-Path -LiteralPath $TargetPackage -PathType Leaf)) { throw 'Target folder mein package.json nahi mila.' }
if (-not (Test-Path -LiteralPath (Join-Path $TargetPath 'server.js') -PathType Leaf)) { throw 'Target folder Biillliiii Inspector project nahi lagta: server.js missing.' }
if (-not (Test-Path -LiteralPath $SourcePackage -PathType Leaf)) { throw 'Patch source package.json missing hai. ZIP ko poora extract karein.' }

$TargetInfo = Get-Content -LiteralPath $TargetPackage -Raw | ConvertFrom-Json
$SourceInfo = Get-Content -LiteralPath $SourcePackage -Raw | ConvertFrom-Json
if ($TargetInfo.name -ne 'biillliiii-inspector-local-monitoring' -or $TargetInfo.version -ne '11.0.1') {
    throw "Target version expected 11.0.1 hai; mila: $($TargetInfo.name) v$($TargetInfo.version). Koi file change nahi ki gayi."
}
if ($SourceInfo.version -ne '11.0.1') { throw 'Patch source version target se match nahi karti.' }

foreach ($RelativePath in $Files) {
    if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot $RelativePath) -PathType Leaf)) { throw "Patch file missing: $RelativePath" }
    if (-not (Test-Path -LiteralPath (Join-Path $TargetPath $RelativePath) -PathType Leaf)) { throw "Target file missing: $RelativePath" }
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $TargetPath ('.patch-backups\local-auth-fix-' + $Stamp)
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$PreserveBefore = @{}
foreach ($RelativePath in $Preserve) { $PreserveBefore[$RelativePath] = Get-RelativeHash $TargetPath $RelativePath }

$BackedUp = New-Object System.Collections.Generic.List[string]
$Applied = New-Object System.Collections.Generic.List[string]
try {
    foreach ($RelativePath in $Files) {
        $TargetFile = Join-Path $TargetPath $RelativePath
        $SourceFile = Join-Path $SourceRoot $RelativePath
        $BackupFile = Join-Path $BackupRoot $RelativePath
        $BackupDirectory = Split-Path -Parent $BackupFile
        New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
        Copy-Item -LiteralPath $TargetFile -Destination $BackupFile -Force
        $BackedUp.Add($RelativePath)
        Copy-Item -LiteralPath $SourceFile -Destination $TargetFile -Force
        $SourceHash = (Get-FileHash -LiteralPath $SourceFile -Algorithm SHA256).Hash
        $TargetHash = (Get-FileHash -LiteralPath $TargetFile -Algorithm SHA256).Hash
        if ($SourceHash -ne $TargetHash) { throw "SHA-256 verification fail: $RelativePath" }
        $Applied.Add($RelativePath)
    }

    Push-Location $TargetPath
    try {
        $CheckCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($null -eq $CheckCommand) { throw 'npm.cmd nahi mila. Node.js/npm install check karein.' }
        Write-Host ''
        Write-Host 'Syntax checks chal rahe hain...' -ForegroundColor Cyan
        & npm.cmd run check
        $CheckExit = $LASTEXITCODE
        Write-Host ''
        Write-Host 'Full test suite chal rahi hai...' -ForegroundColor Cyan
        & npm.cmd test
        $TestExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($CheckExit -ne 0 -or $TestExit -ne 0) {
        throw "Verification fail hui. Syntax exit=$CheckExit; tests exit=$TestExit."
    }

    Write-Host ''
    Write-Host 'One-shot Windows monitoring snapshot test...' -ForegroundColor Cyan
    $SnapshotRaw = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $TargetPath 'monitoring\windows-snapshot.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Windows snapshot PowerShell script fail hui.' }
    $Snapshot = ($SnapshotRaw -join "`n") | ConvertFrom-Json
    if ($null -eq $Snapshot -or -not ($Snapshot.PSObject.Properties.Name -contains 'activeApp')) { throw 'Windows snapshot output invalid hai.' }

    Write-Host 'Desktop UIA privacy guard test (empty approved-app list)...' -ForegroundColor Cyan
    $DesktopRaw = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $TargetPath 'monitoring\desktop-inspector.ps1') -ApprovedApps ''
    if ($LASTEXITCODE -ne 0) { throw 'Desktop UIA privacy guard script fail hui.' }
    $DesktopCheck = ($DesktopRaw -join "`n") | ConvertFrom-Json
    if ($null -eq $DesktopCheck -or @('not-approved','blocked','unsupported') -notcontains [string]$DesktopCheck.status) {
        throw 'Desktop UIA privacy guard returned an unexpected status.'
    }

    $PreserveAfter = @{}
    foreach ($RelativePath in $Preserve) { $PreserveAfter[$RelativePath] = Get-RelativeHash $TargetPath $RelativePath }

    $Report = New-Object System.Collections.Generic.List[string]
    $Report.Add('Biillliiii Inspector local auth patch result')
    $Report.Add("Applied: $(Get-Date -Format o)")
    $Report.Add("Target: $TargetPath")
    $Report.Add("Backup: $BackupRoot")
    $Report.Add('Updated files:')
    foreach ($RelativePath in $Applied) { $Report.Add("  $RelativePath") }
    $Report.Add('Preserved files (before => after SHA-256):')
    foreach ($RelativePath in $Preserve) { $Report.Add("  $RelativePath : $($PreserveBefore[$RelativePath]) => $($PreserveAfter[$RelativePath])") }
    $Report.Add('Syntax checks: PASS')
    $Report.Add('Full test suite: PASS')
    $Report.Add('One-shot Windows snapshot: PASS')
    $Report.Add("Foreground process classification: $($Snapshot.activeApp)")
    $Report.Add("Desktop UIA privacy guard: $($DesktopCheck.status)")
    $Report | Set-Content -LiteralPath (Join-Path $BackupRoot 'APPLY_REPORT.txt') -Encoding UTF8

    Write-Host ''
    Write-Host 'PATCH APPLY AUR VERIFICATION SUCCESSFUL' -ForegroundColor Green
    Write-Host "Backup: $BackupRoot"
    Write-Host "Windows snapshot: PASS ($($Snapshot.activeApp))" -ForegroundColor Green
    Write-Host "Desktop UIA privacy guard: PASS ($($DesktopCheck.status))" -ForegroundColor Green
    Write-Host 'data/projects.json, data/auth.json aur .env patch script ne copy ya overwrite nahi ki.'
} catch {
    Write-Host ''
    Write-Host "Patch/verification fail: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Original code files restore ki ja rahi hain...'
    foreach ($RelativePath in $BackedUp) {
        $BackupFile = Join-Path $BackupRoot $RelativePath
        if (Test-Path -LiteralPath $BackupFile -PathType Leaf) {
            Copy-Item -LiteralPath $BackupFile -Destination (Join-Path $TargetPath $RelativePath) -Force
        }
    }
    Write-Host "Code rollback complete. Backup: $BackupRoot" -ForegroundColor Yellow
    throw
}
