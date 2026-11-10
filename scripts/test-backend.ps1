$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    docker compose cp scripts/test-backend.py application-backend-server:/tmp/test-backend.py
    if ($LASTEXITCODE -ne 0) { throw 'Cannot copy test into app container.' }
    docker compose exec -T application-backend-server python /tmp/test-backend.py
    if ($LASTEXITCODE -ne 0) { throw 'Backend integration test failed.' }
}
finally { Pop-Location }
