param([switch]$Browser)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCompose = @('compose', '-f', (Join-Path $taskRoot 'docker-compose.yml'), '-p', 'mycloud')
Push-Location -LiteralPath $taskRoot
try {
    & (Join-Path $PSScriptRoot 'health-check.ps1') -RequireFrontend
    & python (Join-Path $PSScriptRoot 'test-project-requirements.py')
    if ($LASTEXITCODE -ne 0) { throw 'Local project requirements verification failed.' }
    & (Join-Path $PSScriptRoot 'test-backend.ps1')
    foreach ($taskScript in @('test-proxy.py', 'test-dns-host.py')) {
        $taskArgs = @((Join-Path $PSScriptRoot $taskScript))
        if ($taskScript -eq 'test-proxy.py') { $taskArgs += '--frontend-ready' }
        & python @taskArgs
        if ($LASTEXITCODE -ne 0) { throw "Verification failed: $taskScript" }
    }
    & docker @taskCompose run --rm --no-deps integration-check python /checks/test-monitoring.py --with-web
    if ($LASTEXITCODE -ne 0) { throw 'DNS/monitoring verification failed.' }
    & docker @taskCompose run --rm --no-deps -e TEST_PUBLIC_BASE=http://api-gateway-proxy-server integration-check
    if ($LASTEXITCODE -ne 0) { throw 'Auth/storage verification failed.' }
    if ($Browser) {
        # Windows: .venv\Scripts\python.exe; macOS/Linux (pwsh): .venv/bin/python
        $taskPython = if ($PSVersionTable.PSEdition -eq 'Core' -and -not $IsWindows) { Join-Path $taskRoot '.venv/bin/python' } else { Join-Path $taskRoot '.venv\Scripts\python.exe' }
        if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Run scripts/setup-tools.ps1 first.' }
        foreach ($taskBrowserTest in @('test-portal-navigation.py', 'test-frontend-browser.py')) {
            & $taskPython (Join-Path $PSScriptRoot $taskBrowserTest)
            if ($LASTEXITCODE -ne 0) { throw "Browser verification failed: $taskBrowserTest" }
        }
    }
    Write-Output 'PASS: Requested verification completed. Test fixtures were cleaned by their own scripts.'
}
finally { Pop-Location }
