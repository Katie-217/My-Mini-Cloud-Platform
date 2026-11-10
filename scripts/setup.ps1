param([switch]$NoBuild, [switch]$WithBrowserTools)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    foreach ($taskCommand in @('python', 'docker')) {
        if (-not (Get-Command $taskCommand -ErrorAction SilentlyContinue)) { throw "Missing $taskCommand. Install prerequisites from docs/screenshot-guide.md." }
    }
    python -c "import sys; assert sys.version_info >= (3, 10), 'Python 3.10+ required'"
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.10+ required.' }
    docker compose version
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose v2 is required.' }
    $taskPlatform = & python -c "import subprocess; p=subprocess.run(['docker','info','--format','{{.OSType}}/{{.Architecture}}'],capture_output=True,text=True,timeout=20); print(p.stdout.strip()); raise SystemExit(p.returncode)"
    if ($LASTEXITCODE -ne 0) {
        $taskCandidates = @(
            (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
            (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe')
        )
        $taskDesktop = $taskCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $taskDesktop) { throw 'Start Docker Desktop manually, select Linux containers, and rerun setup.' }
        Write-Output 'Starting Docker Desktop; waiting for its Linux engine...'
        Start-Process -FilePath $taskDesktop -WindowStyle Hidden
        $taskDeadline = [DateTime]::UtcNow.AddSeconds(180)
        do {
            Start-Sleep -Seconds 3
            $taskPlatform = & python -c "import subprocess; p=subprocess.run(['docker','info','--format','{{.OSType}}/{{.Architecture}}'],capture_output=True,text=True,timeout=20); print(p.stdout.strip()); raise SystemExit(p.returncode)"
        } while ($LASTEXITCODE -ne 0 -and [DateTime]::UtcNow -lt $taskDeadline)
        if ($LASTEXITCODE -ne 0) { throw 'Docker engine did not become ready. Open Docker Desktop and check WSL2.' }
    }
    if ($taskPlatform -notmatch '^linux/(x86_64|amd64)$') { throw 'Select Docker Linux x86_64 containers for SQL Server.' }
    $taskStart = @{ RequireFrontend = $true }
    if ($NoBuild) { $taskStart.NoBuild = $true }
    & (Join-Path $PSScriptRoot 'start.ps1') @taskStart
    if ($WithBrowserTools) { & (Join-Path $PSScriptRoot 'setup-tools.ps1') }
    Write-Output 'PASS: MyMiniCloud setup completed. Open http://localhost/ and read .env locally for credentials.'
}
finally { Pop-Location }
