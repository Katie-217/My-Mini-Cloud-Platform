param([switch]$RequireFrontend)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskArguments = @((Join-Path $taskRoot 'scripts\health-check.py'))
if ($RequireFrontend) { $taskArguments += '--require-frontend' }
& python @taskArguments
if ($LASTEXITCODE -ne 0) { throw 'Readiness check failed.' }
