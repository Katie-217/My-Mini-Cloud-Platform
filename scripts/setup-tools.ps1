param([switch]$InstallChromium)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Install Python 3 and add python to PATH first.' }
    # Windows: .venv\Scripts\python.exe; macOS/Linux (pwsh): .venv/bin/python
    $taskPython = if ($PSVersionTable.PSEdition -eq 'Core' -and -not $IsWindows) { './.venv/bin/python' } else { '.\.venv\Scripts\python.exe' }
    if (-not (Test-Path -LiteralPath $taskPython)) {
        python -X utf8 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Cannot create project virtual environment.' }
    }
    & $taskPython -X utf8 -m pip install --disable-pip-version-check -r scripts/requirements-tools.txt
    if ($LASTEXITCODE -ne 0) { throw 'Cannot install browser/document tools.' }
    if ($InstallChromium) {
        & $taskPython -X utf8 -m playwright install chromium
        if ($LASTEXITCODE -ne 0) { throw 'Cannot install Playwright Chromium.' }
    }
    Write-Output 'PASS: Tools ready in .venv. No activation or machine-wide policy change required.'
    Write-Output 'Browser scripts use Microsoft Edge. Use -InstallChromium for the handoff capture fallback.'
}
finally { Pop-Location }
