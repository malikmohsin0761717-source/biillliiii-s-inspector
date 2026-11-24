param(
  [ValidateSet('Set','Read','Enable','Disable','Remove','Test')]
  [string]$Action = 'Read'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
$base = Join-Path $env:LOCALAPPDATA 'BiillliiiiInspector\secrets'
$keyFile = Join-Path $base 'openai-key.dpapi'
$disabledFile = Join-Path $base 'openai-disabled.flag'

function Ensure-SecureDirectory {
  if (-not (Test-Path -LiteralPath $base)) {
    New-Item -ItemType Directory -Path $base -Force | Out-Null
  }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $acl = New-Object System.Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner($identity.User)
  $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule -ArgumentList @(
    $identity.User,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    $inherit,
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  [void]$acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $base -AclObject $acl
}

function Set-LocalAiSetting([bool]$Enabled) {
  $value = if ($Enabled) { 'true' } else { 'false' }
  if (Test-Path -LiteralPath $envFile) {
    $content = [System.IO.File]::ReadAllText($envFile)
  } else {
    $content = ''
  }
  # The encrypted DPAPI file is the only place this helper stores the API key.
  $content = [regex]::Replace($content, '(?m)^[ \t]*(?:export[ \t]+)?OPENAI_API_KEY[ \t]*=.*(?:\r?\n|$)', '')
  if ($content -match '(?m)^[ \t]*OPENAI_API_ENABLED[ \t]*=.*$') {
    $content = [regex]::Replace($content, '(?m)^[ \t]*OPENAI_API_ENABLED[ \t]*=.*$', "OPENAI_API_ENABLED=$value")
  } else {
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $content += [Environment]::NewLine }
    $content += "OPENAI_API_ENABLED=$value$([Environment]::NewLine)"
  }
  [System.IO.File]::WriteAllText($envFile, $content, [System.Text.UTF8Encoding]::new($false))
}

function Read-LocalKey {
  if ((Test-Path -LiteralPath $disabledFile) -or -not (Test-Path -LiteralPath $keyFile)) { return }
  $cipher = [System.IO.File]::ReadAllText($keyFile).Trim()
  if (-not $cipher) { return }
  $secure = ConvertTo-SecureString -String $cipher
  $bstr = [IntPtr]::Zero
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Console]::Out.Write($plain)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if ($null -ne $secure) { $secure.Dispose() }
  }
}

switch ($Action) {
  'Set' {
    $secure = Read-Host 'OpenAI API key (input hidden)' -AsSecureString
    if ($null -eq $secure -or $secure.Length -eq 0) { throw 'Empty key; nothing was saved.' }
    $cipher = $null
    try {
      # Windows PowerShell uses Windows DPAPI CurrentUser when no custom key is supplied.
      $cipher = ConvertFrom-SecureString -SecureString $secure
      Ensure-SecureDirectory
      $temp = "$keyFile.tmp"
      [System.IO.File]::WriteAllText($temp, $cipher, [System.Text.UTF8Encoding]::new($false))
      Move-Item -LiteralPath $temp -Destination $keyFile -Force
      if (Test-Path -LiteralPath $disabledFile) { Remove-Item -LiteralPath $disabledFile -Force }
      Set-LocalAiSetting $true
      Write-Output 'PASS: API key DPAPI CurrentUser encryption ke sath save ho gayi.'
      Write-Output 'Plaintext API key project folder ya .env mein save nahi hoti.'
    } finally {
      if ($null -ne $secure) { $secure.Dispose() }
      $cipher = $null
    }
  }
  'Read' {
    Read-LocalKey
  }
  'Enable' {
    if (-not (Test-Path -LiteralPath $keyFile)) { throw 'Encrypted key nahi mili. Pehle npm run ai:key:set chalayein.' }
    if (Test-Path -LiteralPath $disabledFile) { Remove-Item -LiteralPath $disabledFile -Force }
    Set-LocalAiSetting $true
    Write-Output 'PASS: OpenAI AI next app start par enabled hogi.'
  }
  'Disable' {
    Ensure-SecureDirectory
    [System.IO.File]::WriteAllText($disabledFile, 'disabled')
    Set-LocalAiSetting $false
    Write-Output 'PASS: OpenAI AI disabled. Encrypted key local rahegi.'
  }
  'Remove' {
    if (Test-Path -LiteralPath $keyFile) { Remove-Item -LiteralPath $keyFile -Force }
    if (Test-Path -LiteralPath $disabledFile) { Remove-Item -LiteralPath $disabledFile -Force }
    Set-LocalAiSetting $false
    Write-Output 'PASS: Local encrypted API key remove ho gayi.'
  }
  'Test' {
    $sample = ConvertTo-SecureString -String 'BI-DPAPI-ROUNDTRIP-TEST-ONLY' -AsPlainText -Force
    $cipher = ConvertFrom-SecureString -SecureString $sample
    $roundtrip = ConvertTo-SecureString -String $cipher
    $bstr = [IntPtr]::Zero
    try {
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($roundtrip)
      $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
      if ($plain -cne 'BI-DPAPI-ROUNDTRIP-TEST-ONLY') { throw 'DPAPI round-trip mismatch.' }
      Write-Output 'PASS: Windows DPAPI CurrentUser encrypt/decrypt round-trip.'
    } finally {
      if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
      $sample.Dispose()
      $roundtrip.Dispose()
      $cipher = $null
    }
  }
}
