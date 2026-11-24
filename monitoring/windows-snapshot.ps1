$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SaathiForegroundWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
'@

$activeApp = 'Unknown'
try {
    $hwnd = [SaathiForegroundWindow]::GetForegroundWindow()
    if ($hwnd -ne [IntPtr]::Zero) {
        [uint32]$processId = 0
        [void][SaathiForegroundWindow]::GetWindowThreadProcessId($hwnd, [ref]$processId)
        if ($processId -gt 0) {
            $proc = Get-Process -Id $processId -ErrorAction Stop
            $name = [string]$proc.ProcessName
            $sensitive = @('LogonUI','LockApp','CredentialUIBroker','1Password','KeePass','Bitwarden','LastPass','Dashlane','Authy','NordPass','OUTLOOK','olk','thunderbird','HxOutlook','Mail','WindowsMail','PayPal','Paytm','PhonePe','Easypaisa','JazzCash','HBL','Meezan','UBL','Banking','Bank')
            if ($sensitive -contains $name) {
                $activeApp = 'Private app (excluded)'
            } else {
                $activeApp = $name
            }
        }
    }
} catch {
    $activeApp = 'Unknown'
}

$cpuPercent = $null
$ramTotalMb = $null
$ramAvailableMb = $null
$ramUsedPercent = $null
$driveFreeGb = $null
$driveName = $env:SystemDrive

try {
    $cpu = Get-CimInstance -ClassName Win32_Processor | Measure-Object -Property LoadPercentage -Average
    if ($null -ne $cpu.Average) { $cpuPercent = [math]::Round([double]$cpu.Average, 1) }
} catch {}

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $ramTotalMb = [math]::Round([double]$os.TotalVisibleMemorySize / 1024, 0)
    $ramAvailableMb = [math]::Round([double]$os.FreePhysicalMemory / 1024, 0)
    if ($ramTotalMb -gt 0) {
        $ramUsedPercent = [math]::Round((($ramTotalMb - $ramAvailableMb) / $ramTotalMb) * 100, 1)
    }
} catch {}

try {
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$driveName'"
    if ($null -ne $disk.FreeSpace) { $driveFreeGb = [math]::Round([double]$disk.FreeSpace / 1GB, 1) }
} catch {}

[pscustomobject]@{
    timestamp = (Get-Date).ToString('o')
    activeApp = $activeApp
    cpuPercent = $cpuPercent
    ramTotalMb = $ramTotalMb
    ramAvailableMb = $ramAvailableMb
    ramUsedPercent = $ramUsedPercent
    systemDrive = $driveName
    driveFreeGb = $driveFreeGb
} | ConvertTo-Json -Compress
