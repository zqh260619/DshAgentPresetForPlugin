# screen-capture.ps1 — OS-level screen capture for DSH agent verification.
#
# Why this exists: `browser_take_screenshot` (Playwright MCP) can only capture
# web pages. Native toasts, OS dialogs, tray popups and other applications are
# invisible to it. This script captures the real desktop, either once or as a
# diff-filtered frame watch, and is invoked through the session's ordinary
# pwsh tool — no extra package, no global tool registration.
#
# Gate: refuses to run unless the marker file below exists. Screen capture is
# privacy-sensitive, so it stays off by default and the human opts in once:
#     New-Item -ItemType File -Force "$env:DSH_HOME\screen-capture.enabled"
#
# Usage (all coordinates are PHYSICAL pixels; the process declares
# per-monitor-V2 DPI awareness before measuring anything):
#   -Mode capture -Clip "x,y,w,h"                 # region (preferred)
#   -Mode capture -Fullscreen                     # whole virtual screen (explicit)
#   -Mode watch   -Clip "x,y,w,h" -DurationMs 15000 -IntervalMs 700
#                                                 # keep only frames that differ
#                                                 # from the baseline
# Output: one JSON object on stdout.

param(
    [ValidateSet('capture', 'watch')]
    [string]$Mode = 'capture',
    [string]$Clip,
    [switch]$Fullscreen,
    [string]$Out,
    [string]$OutDir,
    [int]$DurationMs = 0,
    [int]$IntervalMs = 700,
    [int]$Threshold = 30,
    [int]$DedupeThreshold = 0,
    [int]$MaxFrames = 60,
    [int]$MaxBytes = 8388608
)

$ErrorActionPreference = 'Stop'

function Write-Result($obj) {
    $obj | ConvertTo-Json -Compress -Depth 6
}

# ── gate ────────────────────────────────────────────────────────────────────
$dshHome = $env:DSH_HOME
if ([string]::IsNullOrWhiteSpace($dshHome)) { $dshHome = Join-Path $env:USERPROFILE '.dsh' }
$gate = Join-Path $dshHome 'screen-capture.enabled'
if (-not (Test-Path -LiteralPath $gate)) {
    Write-Result ([ordered]@{
        error = "screen capture is disabled; the human must opt in once by creating: $gate"
        enabled = $false
    })
    exit 2
}

# ── DPI awareness + screen geometry ─────────────────────────────────────────
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ScreenDpi {
    [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern uint GetDpiForSystem();
}
"@
$aware = [ScreenDpi]::SetProcessDpiAwarenessContext([IntPtr](-4))
if (-not $aware) { [ScreenDpi]::SetProcessDPIAware() | Out-Null }

$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
$scale = 1.0
try { $dpi = [ScreenDpi]::GetDpiForSystem(); if ($dpi -gt 0) { $scale = [Math]::Round($dpi / 96.0, 2) } } catch { }
$screen = [ordered]@{ x = $vs.X; y = $vs.Y; width = $vs.Width; height = $vs.Height }

function Get-Region {
    if (-not [string]::IsNullOrWhiteSpace($Clip)) {
        $parts = $Clip -split ','
        if ($parts.Count -ne 4) { throw "Clip must be 'x,y,width,height' in physical pixels" }
        $x = [int]$parts[0]; $y = [int]$parts[1]; $w = [int]$parts[2]; $h = [int]$parts[3]
        if ($w -le 0 -or $h -le 0) { throw 'Clip width and height must be positive' }
        return [ordered]@{ x = $x; y = $y; width = $w; height = $h; fullscreen = $false }
    }
    if ($Fullscreen) { return [ordered]@{ x = $vs.X; y = $vs.Y; width = $vs.Width; height = $vs.Height; fullscreen = $true } }
    throw 'specify -Clip "x,y,width,height" for a region, or -Fullscreen to capture the whole screen'
}

$region = Get-Region

function New-Capture([hashtable]$r) {
    $bmp = New-Object System.Drawing.Bitmap $r.width, $r.height
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $graphics.CopyFromScreen($r.x, $r.y, 0, 0, $bmp.Size)
    } finally {
        $graphics.Dispose()
    }
    return $bmp
}

function Get-Thumb([System.Drawing.Bitmap]$bmp, [int]$n = 20) {
    $thumb = New-Object System.Drawing.Bitmap $n, $n
    $g = [System.Drawing.Graphics]::FromImage($thumb)
    try {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
        $g.DrawImage($bmp, 0, 0, $n, $n)
    } finally {
        $g.Dispose()
    }
    return $thumb
}

function Get-DiffScore([System.Drawing.Bitmap]$a, [System.Drawing.Bitmap]$b) {
    $sum = 0.0; $max = 0
    for ($y = 0; $y -lt $a.Height; $y++) {
        for ($x = 0; $x -lt $a.Width; $x++) {
            $pa = $a.GetPixel($x, $y); $pb = $b.GetPixel($x, $y)
            $d = [Math]::Abs($pa.R - $pb.R) + [Math]::Abs($pa.G - $pb.G) + [Math]::Abs($pa.B - $pb.B)
            if ($d -gt $max) { $max = $d }
            $sum += $d
        }
    }
    return [ordered]@{
        mean = [Math]::Round($sum / ($a.Width * $a.Height), 2)
        max = $max
    }
}

function Save-Frame([System.Drawing.Bitmap]$bmp, [string]$path) {
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = (Get-Item -LiteralPath $path).Length
    if ($bytes -gt $MaxBytes) {
        Remove-Item -LiteralPath $path -Force
        throw "captured frame exceeds the $MaxBytes-byte limit; use a smaller -Clip"
    }
    return $bytes
}

# ── capture mode ────────────────────────────────────────────────────────────
if ($Mode -eq 'capture') {
    if ([string]::IsNullOrWhiteSpace($Out)) {
        $dir = Join-Path $dshHome 'cache\screen-captures'
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $Out = Join-Path $dir ("screen-{0:yyyyMMdd-HHmmss-fff}.png" -f (Get-Date))
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Out) | Out-Null
    }
    $bmp = New-Capture $region
    try {
        $bytes = Save-Frame $bmp $Out
        Write-Result ([ordered]@{
            path = (Resolve-Path -LiteralPath $Out).Path
            width = $bmp.Width
            height = $bmp.Height
            scale = $scale
            screen = $screen
            region = $region
            mimeType = 'image/png'
            bytes = $bytes
        })
    } finally { $bmp.Dispose() }
    exit 0
}

# ── watch mode ──────────────────────────────────────────────────────────────
if ($DurationMs -le 0) { throw 'watch mode needs -DurationMs (ms)' }
if ($DurationMs -gt 120000) { throw 'DurationMs must be <= 120000 (2 minutes)' }
if ($IntervalMs -lt 100 -or $IntervalMs -gt 5000) { throw 'IntervalMs must be between 100 and 5000' }
if ($MaxFrames -lt 1 -or $MaxFrames -gt 300) { throw 'MaxFrames must be between 1 and 300' }
if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path $dshHome ('cache\screen-captures\watch-{0:yyyyMMdd-HHmmss}' -f (Get-Date))
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$baseline = New-Capture $region
$baselineThumb = Get-Thumb $baseline
$started = (Get-Date)
$frames = New-Object System.Collections.ArrayList
$captured = 0
$dedupe = if ($DedupeThreshold -gt 0) { $DedupeThreshold } else { $Threshold }
$lastAcceptedThumb = $null
$changedEver = $false
$restored = $false

try {
    while (((Get-Date) - $started).TotalMilliseconds -lt $DurationMs) {
        Start-Sleep -Milliseconds $IntervalMs
        $elapsed = [int](((Get-Date) - $started).TotalMilliseconds)
        $bmp = New-Capture $region
        try {
            $thumb = Get-Thumb $bmp
            $keepThumb = $false
            try {
                $diff = Get-DiffScore $baselineThumb $thumb
                $captured++
                if ($diff.max -lt $Threshold) {
                    # Back to the quiet baseline: note it once, write nothing.
                    if ($changedEver) { $restored = $true }
                } else {
                    # A state different from the baseline. Accept it only when it is
                    # also a NEW state, so a popup that stays on screen for seconds
                    # does not produce one duplicate frame per interval.
                    $novel = $true
                    if ($null -ne $lastAcceptedThumb) {
                        $novelDiff = Get-DiffScore $lastAcceptedThumb $thumb
                        if ($novelDiff.max -lt $dedupe) { $novel = $false }
                    }
                    if ($novel) {
                        $stamp = ('{0:yyyyMMdd-HHmmss-fff}' -f (Get-Date))
                        $path = Join-Path $OutDir ("frame-{0:D3}-{1}.png" -f $frames.Count, $stamp)
                        $bytes = Save-Frame $bmp $path
                        [void]$frames.Add([ordered]@{ path = (Resolve-Path -LiteralPath $path).Path; at = $elapsed; diff = $diff; bytes = $bytes })
                        $changedEver = $true
                        if ($null -ne $lastAcceptedThumb) { $lastAcceptedThumb.Dispose() }
                        $lastAcceptedThumb = $thumb
                        $keepThumb = $true
                        if ($frames.Count -ge $MaxFrames) { break }
                    }
                }
            } finally {
                if (-not $keepThumb) { $thumb.Dispose() }
            }
        } finally { $bmp.Dispose() }
    }
} finally {
    $baseline.Dispose(); $baselineThumb.Dispose()
    if ($null -ne $lastAcceptedThumb) { $lastAcceptedThumb.Dispose() }
}

Write-Result ([ordered]@{
    frames = $frames
    changed = ($frames.Count -gt 0)
    restored = $restored
    captured = $captured
    threshold = $Threshold
    dedupeThreshold = $dedupe
    intervalMs = $IntervalMs
    durationMs = $DurationMs
    scale = $scale
    screen = $screen
    region = $region
    dir = (Resolve-Path -LiteralPath $OutDir).Path
    note = 'only NEW states (baseline max-delta >= threshold and different from the previous kept frame) are written; every other frame is never saved, so there is nothing to delete afterwards'
})
