param([string]$ApprovedApps = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result($status, $app, $text, $reason) {
    [pscustomobject]@{ status=$status; source='desktop-uia'; capturedAt=(Get-Date).ToString('o'); app=$app; text=$text; reason=$reason } | ConvertTo-Json -Compress
}

$allowed = @()
if (-not [string]::IsNullOrWhiteSpace($ApprovedApps)) {
    $allowed = @($ApprovedApps.Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
}
$blocked = @('logonui','lockapp','credentialuibroker','1password','keepass','bitwarden','lastpass','dashlane','authy','nordpass','outlook','olk','thunderbird','hxoutlook','windowsmail','paytm','phonepe','easypaisa','jazzcash','hbl','meezan','ubl','banking','bank')
$hwnd = [IntPtr]::Zero
$processName = 'Unknown'
try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BIWindowInfo {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@
    $hwnd = [BIWindowInfo]::GetForegroundWindow()
    if ($hwnd -eq [IntPtr]::Zero) { Write-Result 'unsupported' $processName '' 'Active window available nahi.'; exit 0 }
    [uint32]$processId = 0
    [void][BIWindowInfo]::GetWindowThreadProcessId($hwnd, [ref]$processId)
    if ($processId -gt 0) { $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName.ToLowerInvariant() }
} catch { Write-Result 'unsupported' $processName '' 'Active application identify nahi ho saki.'; exit 0 }

if ($blocked -contains $processName) { Write-Result 'blocked' $processName '' 'Sensitive application excluded by default.'; exit 0 }
if ($allowed -notcontains $processName) { Write-Result 'not-approved' $processName '' 'Yeh app Settings ki approved list mein nahi hai.'; exit 0 }

try {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    if ($null -eq $root) { Write-Result 'unsupported' $processName '' 'Application UI Automation expose nahi karti.'; exit 0 }
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $queue = New-Object System.Collections.Generic.Queue[System.Windows.Automation.AutomationElement]
    $queue.Enqueue($root)
    $lines = New-Object System.Collections.Generic.List[string]
    $visited = 0
    $sensitive = $false
    while ($queue.Count -gt 0 -and $visited -lt 500 -and $lines.Count -lt 80) {
        $element = $queue.Dequeue(); $visited++
        try {
            $current = $element.Current
            if ($current.IsPassword) { $sensitive = $true; break }
            $control = $current.ControlType.ProgrammaticName
            $name = [string]$current.Name
            if ($control -eq 'ControlType.Edit' -and $name -match '(?i)password|passcode|otp|one.time|verification|card|cvv|bank|email|login|security') { $sensitive = $true; break }
            if (-not $current.IsOffscreen -and $control -eq 'ControlType.Text' -and $name.Trim()) {
                $clean = ($name -replace '[\r\n\t]+',' ').Trim()
                if ($clean.Length -le 300) { $lines.Add($clean) }
            }
            $child = $walker.GetFirstChild($element)
            while ($null -ne $child -and $queue.Count -lt 500) { $queue.Enqueue($child); $child = $walker.GetNextSibling($child) }
        } catch { }
    }
    if ($sensitive) { Write-Result 'blocked' $processName '' 'Password ya sensitive input control detect hua; poori capture rok di gayi.'; exit 0 }
    $text = (($lines | Select-Object -Unique) -join "`n").Trim()
    if (-not $text) { Write-Result 'unsupported' $processName '' 'Is app ne readable text expose nahi kiya.'; exit 0 }
    $cardDigits = ($text -replace '[^0-9]','')
    if ($text -match '(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' -or $cardDigits.Length -ge 13 -and $cardDigits.Length -le 19 -or $text -match '(?i)one.time.password|one.time.code|OTP|CVV|security code|bank account|credit card|debit card') {
        Write-Result 'blocked' $processName '' 'Potential email, OTP, payment ya account detail detect hui; poori capture rok di gayi.'; exit 0
    }
    if ($text.Length -gt 12000) { $text = $text.Substring(0,12000) }
    Write-Result 'captured' $processName $text ''
} catch { Write-Result 'unsupported' $processName '' 'UI Automation is app par supported nahi ya access denied hai.' }
