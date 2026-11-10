param([switch]$NoBuild, [switch]$RequireFrontend)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCompose = @('compose', '-f', (Join-Path $taskRoot 'docker-compose.yml'), '-p', 'mycloud')
Push-Location -LiteralPath $taskRoot
try {
    python scripts/init-env.py
    if ($LASTEXITCODE -ne 0) { throw 'Local environment setup failed.' }
    python scripts/preflight.py
    if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; resources left unchanged.' }
    if (-not $NoBuild) {
        & docker @taskCompose build
        if ($LASTEXITCODE -ne 0) { throw 'Image build failed.' }
    }
    & docker @taskCompose up -d --no-build
    if ($LASTEXITCODE -ne 0) { throw 'Project startup failed.' }
    $taskHealthArguments = @('scripts/health-check.py', '--wait', '180')
    if ($RequireFrontend) { $taskHealthArguments += '--require-frontend' }
    & python @taskHealthArguments
    if ($LASTEXITCODE -ne 0) { throw 'Readiness check failed.' }
}
finally { Pop-Location }
