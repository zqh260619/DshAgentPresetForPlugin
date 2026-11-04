# agent-chrome.ps1 — inspect / start / stop the dedicated Chrome that the preset's
# Playwright MCP client attaches to (CDP on 127.0.0.1:9222, own user-data-dir).
#
# Why this exists: the MCP client connects when a preset revision activates, and the
# agent cannot see the user's normal Chrome (Chrome refuses remote debugging on the
# default profile). This helper lets the agent check the endpoint, start the
# dedicated browser when it is missing, and stop it without ever touching the
# user's own Chrome — matching by `--user-data-dir` / `--remote-debugging-port`
# and by the absence of `--type=`, never by image name alone. Child processes
# (renderer/gpu/utility/crashpad) inherit those flags, so they are reported but
# never killed individually: killing the browser process takes them down.
#
# The profile keeps the signed GUI cookie (default 30 days), so a restarted browser
# is still logged in; only a fresh/cleared profile needs one tokenized visit.

param(
    [ValidateSet('status', 'start', 'stop')]
    [string]$Action = 'status',
    [int]$Port = 9222,
    [string]$ProfileDir = (Join-Path $env:USERPROFILE 'dsh-agent-chrome'),
    [int]$TimeoutMs = 20000
)

$ErrorActionPreference = 'Stop'
$endpoint = "http://127.0.0.1:$Port"

function Get-Result($obj) { $obj | ConvertTo-Json -Compress -Depth 5 }

function Find-Chrome {
    $candidates = @(
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    )
    foreach ($path in $candidates) {
        if ($path -and (Test-Path -LiteralPath $path)) { return (Resolve-Path -LiteralPath $path).Path }
    }
    return $null
}

# Split matches into the browser process (no `--type=`) and its children.
function Get-DedicatedProcesses {
    $browser = @()
    $children = @()
    foreach ($proc in (Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue)) {
        $cmd = $proc.CommandLine
        if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
        $ownsProfile = $cmd -match [regex]::Escape($ProfileDir)
        $ownsPort = $cmd -match [regex]::Escape("--remote-debugging-port=$Port")
        if (-not ($ownsProfile -or $ownsPort)) { continue }
        $isChild = $cmd -match '--type='
        if ($isChild) {
            $kind = if ($cmd -match '--type=([a-z-]+)') { $Matches[1] } else { 'child' }
            $children += [ordered]@{ pid = $proc.ProcessId; parent = $proc.ParentProcessId; type = $kind }
        } else {
            $browser += [ordered]@{ pid = $proc.ProcessId; parent = $proc.ParentProcessId }
        }
    }
    return [ordered]@{ browser = $browser; children = $children }
}

function Get-Endpoint {
    try {
        $version = Invoke-RestMethod "$endpoint/json/version" -TimeoutSec 3
        return [ordered]@{ reachable = $true; browser = $version.Browser; webSocketDebuggerUrl = $version.webSocketDebuggerUrl }
    } catch {
        return [ordered]@{ reachable = $false; error = $_.Exception.Message }
    }
}

function Wait-Endpoint([bool]$Wanted, [int]$LimitMs) {
    $deadline = (Get-Date).AddMilliseconds($LimitMs)
    do {
        $state = Get-Endpoint
        if ($state.reachable -eq $Wanted) { return $state }
        Start-Sleep -Milliseconds 400
    } while ((Get-Date) -lt $deadline)
    return $state
}

if ($Action -eq 'status') {
    $procs = Get-DedicatedProcesses
    $running = $procs.browser.Count -gt 0
    Get-Result ([ordered]@{
        action = 'status'
        endpoint = $endpoint
        profileDir = $ProfileDir
        chromePath = Find-Chrome
        running = $running
        browserProcesses = $procs.browser
        childProcessCount = $procs.children.Count
        cdp = Get-Endpoint
        hint = if ($running) { 'running' } else { 'not running: start it with -Action start; the MCP client reconnects automatically while its retry window lasts' }
    })
    exit 0
}

if ($Action -eq 'start') {
    $before = Get-DedicatedProcesses
    if ($before.browser.Count -gt 0) {
        $cdp = Wait-Endpoint $true $TimeoutMs
        Get-Result ([ordered]@{
            action = 'start'
            started = $cdp.reachable
            alreadyRunning = $true
            endpoint = $endpoint
            browserProcesses = $before.browser
            cdp = $cdp
        })
        exit $(if ($cdp.reachable) { 0 } else { 4 })
    }
    $chrome = Find-Chrome
    if (-not $chrome) { Get-Result ([ordered]@{ action = 'start'; started = $false; error = 'chrome.exe not found in the standard install locations' }); exit 3 }
    New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
    Start-Process -FilePath $chrome -ArgumentList @("--remote-debugging-port=$Port", "--user-data-dir=$ProfileDir") | Out-Null
    $cdp = Wait-Endpoint $true $TimeoutMs
    $after = Get-DedicatedProcesses
    Get-Result ([ordered]@{
        action = 'start'
        started = $cdp.reachable
        chromePath = $chrome
        endpoint = $endpoint
        profileDir = $ProfileDir
        browserProcesses = $after.browser
        cdp = $cdp
        note = if ($cdp.reachable) { 'endpoint is up; the MCP client registers its tools as soon as its reconnect attempt succeeds' } else { 'endpoint did not come up in time — check that no other program owns the port' }
    })
    exit $(if ($cdp.reachable) { 0 } else { 4 })
}

if ($Action -eq 'stop') {
    $procs = Get-DedicatedProcesses
    if ($procs.browser.Count -eq 0) {
        Get-Result ([ordered]@{ action = 'stop'; stopped = $false; reason = 'no dedicated chrome browser process is running'; profileDir = $ProfileDir; cdp = Get-Endpoint })
        exit 0
    }
    $killed = @()
    foreach ($proc in $procs.browser) {
        try { Stop-Process -Id $proc.pid -Force -ErrorAction Stop; $killed += $proc.pid } catch { }
    }
    # Killing the browser process takes its children down; wait for the endpoint to die.
    $gone = Wait-Endpoint $false 6000
    $remaining = Get-DedicatedProcesses
    Get-Result ([ordered]@{
        action = 'stop'
        stopped = -not $gone.reachable
        killedProcessIds = $killed
        remainingBrowserProcesses = $remaining.browser.Count
        cdp = $gone
        note = "stopping the browser makes this session's mcp__playwright__* tools unusable until it is started again (the client reconnects while its retry window lasts); the user's own Chrome is untouched"
    })
    exit $(if ($gone.reachable) { 5 } else { 0 })
}
