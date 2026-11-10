param([int]$Port = 8018)
$ErrorActionPreference = 'Stop'
$ready = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ready" -TimeoutSec 5
if (-not $ready.ready) { throw 'SiFormer is not ready. Start and verify inference first.' }
# Authentication and exact-origin CORS remain enforced by the inference API.
cloudflared tunnel --url "http://127.0.0.1:$Port" --no-autoupdate
exit $LASTEXITCODE
