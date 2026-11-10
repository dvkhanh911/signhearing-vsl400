param(
    [ValidateSet('cpu')][string]$Device = 'cpu',
    [int]$Port = 8018,
    [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
$env:AI_DEVICE = $Device
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:TF_CPP_MIN_LOG_LEVEL = '2'
& $Python -B -m uvicorn ai_inference.app.main:app --host 127.0.0.1 --port $Port --no-access-log
exit $LASTEXITCODE
