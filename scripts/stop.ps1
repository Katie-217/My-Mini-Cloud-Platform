$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    docker compose -f docker-compose.yml -p mycloud stop
    if ($LASTEXITCODE -ne 0) { throw 'Cannot stop mycloud services.' }
    Write-Output 'Stopped mycloud. Containers and named volumes are preserved.'
}
finally { Pop-Location }
