param([switch]$Production)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$processRecordPath = Join-Path $runtimeRoot 'processes.json'
$recordedProcesses = $null
if (Test-Path -LiteralPath $processRecordPath) {
    try { $recordedProcesses = Get-Content -LiteralPath $processRecordPath -Raw | ConvertFrom-Json }
    catch { Write-Warning 'Cannot read .runtime/processes.json; occupied ports will not be reused.' }
}

function Get-ServiceProcessId {
    param([string]$Name, [int]$Port, [string]$ExpectedPath, [string]$CommandPattern)
    $probe = New-Object System.Net.Sockets.TcpClient
    $occupied = $false
    try { $occupied = $probe.ConnectAsync('127.0.0.1', $Port).Wait(250) -and $probe.Connected }
    catch { $occupied = $false }
    finally { $probe.Dispose() }
    if (-not $occupied) { return 0 }

    $rootProcessId = 0
    $hasRecordedId = [int]::TryParse([string]$recordedProcesses.$Name, [ref]$rootProcessId)
    $processSnapshot = @{}
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'python.exe'" | ForEach-Object {
        $processSnapshot[[int]$_.ProcessId] = $_
    }
    $rootProcess = $processSnapshot[$rootProcessId]
    $commandLine = if ($rootProcess) { [string]$rootProcess.CommandLine } else { '' }
    $matchesProject = $hasRecordedId -and $rootProcessId -gt 0 -and
        $commandLine.Replace('/', '\').IndexOf($ExpectedPath.Replace('/', '\'), [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $commandLine -match $CommandPattern
    if (-not $matchesProject) {
        throw "Port $Port is occupied by an unrecognized $Name process. Check that application before starting SignHearing."
    }

    # Next.js and the Python venv launcher can own the listening socket in a child.
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object {
        $_.LocalAddress -in @('127.0.0.1', '0.0.0.0')
    })
    if ($listeners.Count -eq 0) { throw "Cannot identify the process listening on port $Port." }
    foreach ($listener in $listeners) {
        $ownerProcessId = [int]$listener.OwningProcess
        $belongsToProject = $false
        for ($depth = 0; $depth -lt 8; $depth++) {
            if ($ownerProcessId -eq $rootProcessId) { $belongsToProject = $true; break }
            $ownerProcess = $processSnapshot[$ownerProcessId]
            if (-not $ownerProcess) { break }
            $ownerProcessId = [int]$ownerProcess.ParentProcessId
        }
        if (-not $belongsToProject) { throw "Port $Port is occupied by another application. Check that application before starting SignHearing." }
    }
    return $rootProcessId
}

function Wait-ServiceReady {
    param([string]$Name, [string]$Url, [string]$ContentPattern)
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content -match $ContentPattern) { return }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    throw "$Name is not ready. Check the logs in $runtimeRoot and run this command again."
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
    $portableRoot = Join-Path $projectRoot '.tools'
    $candidate = Get-ChildItem -LiteralPath $portableRoot -Filter 'node-v*-win-x64' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($candidate) { Join-Path $candidate.FullName 'node.exe' }
}
if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath)) { throw 'Install Node.js 22+ and run npm ci in frontend first.' }
$pythonPath = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Run uv sync in backend first.' }
$nextCli = Join-Path $projectRoot 'frontend\node_modules\next\dist\bin\next'
if (-not (Test-Path -LiteralPath $nextCli)) { throw 'Run npm ci in frontend first.' }
if ($Production -and -not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\.next\BUILD_ID'))) {
    throw 'Run npm run build in frontend before starting production mode.'
}
$nextCommand = if ($Production) { 'start' } else { 'dev' }
$frontendProcessId = Get-ServiceProcessId -Name 'frontend' -Port 3000 -ExpectedPath $nextCli -CommandPattern "\s$nextCommand(?:\s|$)"
$backendProcessId = Get-ServiceProcessId -Name 'backend' -Port 8001 -ExpectedPath $pythonPath -CommandPattern '\s-m\s+uvicorn\s+app\.main:app(?:\s|$)'
if (-not $Production -and -not $frontendProcessId) {
    & $nodePath (Join-Path $projectRoot 'frontend\scripts\sync-content.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Content synchronization failed.' }
}
if ($backendProcessId) {
    Write-Output "Backend is already running; reusing PID $backendProcessId."
} else {
    $backendProcess = Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8001') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'backend.out.log') -RedirectStandardError (Join-Path $runtimeRoot 'backend.err.log') -PassThru
    $backendProcessId = $backendProcess.Id
    @{ backend = $backendProcessId; frontend = $frontendProcessId } | ConvertTo-Json | Set-Content -LiteralPath $processRecordPath -Encoding UTF8
}
if ($frontendProcessId) {
    Write-Output "Frontend is already running; reusing PID $frontendProcessId."
} else {
    $frontendProcess = Start-Process -FilePath $nodePath -ArgumentList @($nextCli,$nextCommand,'--hostname','127.0.0.1','--port','3000') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'frontend.out.log') -RedirectStandardError (Join-Path $runtimeRoot 'frontend.err.log') -PassThru
    $frontendProcessId = $frontendProcess.Id
}
@{ backend = $backendProcessId; frontend = $frontendProcessId } | ConvertTo-Json | Set-Content -LiteralPath $processRecordPath -Encoding UTF8
Wait-ServiceReady -Name 'Backend' -Url 'http://127.0.0.1:8001/api/health' -ContentPattern '"status"\s*:\s*"ok"'
Wait-ServiceReady -Name 'Homepage' -Url 'http://127.0.0.1:3000/?lang=vi' -ContentPattern 'immersive-landing'
Write-Output "Homepage: http://127.0.0.1:3000 (PID $frontendProcessId)"
Write-Output "Features: http://127.0.0.1:3000/features"
Write-Output "Learning: http://127.0.0.1:3000/app"
Write-Output "API: http://127.0.0.1:8001/api/health (PID $backendProcessId)"
Write-Output "Logs: $runtimeRoot"
