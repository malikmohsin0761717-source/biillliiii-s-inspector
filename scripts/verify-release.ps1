$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logDir = Join-Path $env:TEMP ("BI_v11_Audit_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$checkLog = Join-Path $logDir 'syntax-check.txt'
$testLog = Join-Path $logDir 'automated-tests.txt'
$failures = New-Object System.Collections.Generic.List[string]

Write-Host "===== Biillliiii Inspector v11.0.1 release verification =====" -ForegroundColor Cyan

Write-Host "`n[1/5] JavaScript syntax check" -ForegroundColor Cyan
npm.cmd run check *> $checkLog
$checkExit = $LASTEXITCODE
if ($checkExit -ne 0) { $failures.Add('npm run check'); Get-Content $checkLog -Tail 30 } else { Write-Host 'PASS' -ForegroundColor Green }

Write-Host "`n[2/5] Automated tests" -ForegroundColor Cyan
npm.cmd test *> $testLog
$testExit = $LASTEXITCODE
if ($testExit -ne 0) { $failures.Add('npm test'); Get-Content $testLog -Tail 60 } else { Write-Host 'PASS' -ForegroundColor Green }
Select-String -Path $testLog -Pattern '^# tests |^# pass |^# fail |^# skipped ' | ForEach-Object { Write-Host $_.Line }

Write-Host "`n[3/5] PowerShell script parse (no script execution)" -ForegroundColor Cyan
$parseFailed = $false
foreach ($file in @('monitoring/windows-snapshot.ps1','monitoring/desktop-inspector.ps1','scripts/openai-key.ps1','scripts/final-check.ps1')) {
    $path = Join-Path $root $file
    $tokens = $null; $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$parseErrors) | Out-Null
    if ($parseErrors.Count -gt 0) {
        $parseFailed = $true; $failures.Add("PowerShell parse: $file")
        $parseErrors | ForEach-Object { Write-Host $_.Message -ForegroundColor Red }
    } else { Write-Host "PASS: $file" -ForegroundColor Green }
}

Write-Host "`n[4/5] Manifest and release version" -ForegroundColor Cyan
try {
    $manifest = Get-Content (Join-Path $root 'browser-extension/manifest.json') -Raw | ConvertFrom-Json
    $package = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
    if ($manifest.version -ne '11.0.1' -or $package.version -ne '11.0.1') { throw 'Version mismatch.' }
    Write-Host 'PASS: Chrome Manifest JSON + package version 11.0.1' -ForegroundColor Green
} catch { $failures.Add('Manifest/version validation'); Write-Host $_.Exception.Message -ForegroundColor Red }

Write-Host "`n[5/5] Safe test fixture and API defaults" -ForegroundColor Cyan
$seed = Get-Content (Join-Path $root 'data/projects.seed.json') -Raw | ConvertFrom-Json
$envExample = Get-Content (Join-Path $root '.env.example') -Raw
if (@($seed.projects).Count -ne 0 -or $envExample -notmatch 'OPENAI_API_ENABLED=false' -or $envExample -notmatch 'OPENAI_API_KEY=') {
    $failures.Add('Fresh-install seed or disabled-by-default AI configuration check')
    Write-Host 'FAIL: check seed and .env.example' -ForegroundColor Red
} else { Write-Host 'PASS: empty fresh-install seed; AI remains disabled until the owner explicitly saves a key' -ForegroundColor Green }
Write-Host 'Verifier does not open, copy or modify data/projects.json, data/auth.json or .env.' -ForegroundColor DarkGray

Write-Host "`nLogs: $logDir" -ForegroundColor DarkGray
if ($failures.Count -gt 0) {
    Write-Host "FAILED CHECKS: $($failures -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "`nAll automated release checks passed. DPAPI round-trip is run by final-check.ps1. Live Supabase, Chrome and Windows UIA acceptance are separate manual checks." -ForegroundColor Green
exit 0
