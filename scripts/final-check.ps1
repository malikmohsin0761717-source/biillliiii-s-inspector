$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host '===== Biillliiii Inspector v11.0.1 FINAL CHECK =====' -ForegroundColor Cyan

Write-Host "`n[1/2] Full release checks: JS syntax, all automated tests, versions and safe defaults" -ForegroundColor Cyan
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'verify-release.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Release verification failed. See the audit log above.' }

Write-Host "`n[2/2] Windows DPAPI CurrentUser disposable round-trip (no real key, no API call)" -ForegroundColor Cyan
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'openai-key.ps1') -Action Test
if ($LASTEXITCODE -ne 0) { throw 'DPAPI round-trip failed.' }

Write-Host "`nFINAL CHECK PASSED. Live Supabase/RLS, Chrome installation and Windows UIA acceptance remain separate manual tests." -ForegroundColor Green
