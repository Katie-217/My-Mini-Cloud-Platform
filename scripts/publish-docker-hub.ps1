<#
.SYNOPSIS
Build, publish and verify the MyMiniCloud images. See docs/docker-hub.md.
.PARAMETER VerifyOnly
Pull existing images by immutable digest and run smoke tests; no build or push.
.PARAMETER SkipPush
Build and smoke test local images only; no registry verification.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$Namespace,
    [ValidatePattern('^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$')]
    [string]$Version = '1.0.0',
    [switch]$SkipPush,
    [switch]$SkipSmokeTest,
    [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$repoRoot = Split-Path -Parent $PSScriptRoot
if ($SkipPush -and $VerifyOnly) { throw 'Choose SkipPush or VerifyOnly, not both.' }

function Invoke-Docker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($Arguments[0])" }
}

function Test-RemoteTag {
    param([string]$Tag)
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = (& docker manifest inspect $Tag 2>&1 | Out-String)
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    if ($code -eq 0) { return $true }
    if ($output -match '(?i)manifest unknown|no such manifest|manifest_unknown') { return $false }
    throw "Cannot verify whether $Tag exists. Check network/authentication before publishing."
}

function Get-RegistryDigest {
    param([string]$Tag)
    $description = (Invoke-Docker -Arguments @('buildx', 'imagetools', 'inspect', $Tag)) -join "`n"
    $match = [regex]::Match($description, '(?m)^Digest:\s+(sha256:[0-9a-f]{64})\s*$')
    if (-not $match.Success) { throw "Registry did not return an immutable digest for $Tag." }
    return $match.Groups[1].Value
}

function Test-HttpImage {
    param([string]$Reference, [string]$Kind)
    $port = if ($Kind -eq 'web') { 80 } else { 8081 }
    $name = 'mycloud-hub-' + $Kind + '-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    $id = $null
    try {
        $id = (Invoke-Docker -Arguments @('run', '-d', '--name', $name,
            '--label', 'com.docker.compose.project=mycloud', '--label', 'mycloud.role=hub-smoke',
            '-p', "127.0.0.1::${port}", $Reference) | Select-Object -Last 1).Trim()
        $binding = (Invoke-Docker -Arguments @('port', $id, "$port/tcp")) -join ''
        if ($binding -notmatch '^127\.0\.0\.1:(\d+)\s*$') { throw 'Expected a temporary loopback port.' }
        $base = 'http://127.0.0.1:' + $Matches[1]
        $paths = if ($Kind -eq 'web') {
            @('/', '/blog/', '/app/', '/blog/blog1.html', '/blog/blog2.html', '/blog/blog3.html')
        } else { @('/hello', '/student') }
        foreach ($path in $paths) {
            $response = $null
            $deadline = [DateTime]::UtcNow.AddSeconds(30)
            do {
                try { $response = Invoke-WebRequest -UseBasicParsing -Uri ($base + $path) -TimeoutSec 3 } catch { $response = $null }
                if ($null -eq $response -or $response.StatusCode -ne 200) { Start-Sleep -Milliseconds 400 }
            } while (($null -eq $response -or $response.StatusCode -ne 200) -and [DateTime]::UtcNow -lt $deadline)
            if ($null -eq $response -or $response.StatusCode -ne 200) { throw "$Kind smoke test failed: $path" }
            if ($Kind -eq 'web' -and $response.Content -notmatch '(?i)<html') { throw 'Expected an HTML page.' }
            if ($Kind -eq 'app') {
                $data = $response.Content | ConvertFrom-Json
                if ($path -eq '/hello' -and $data.message -ne 'Hello from App Server!') { throw 'Unexpected hello response.' }
                if ($path -eq '/student' -and @($data).Count -ne 5) { throw 'Expected five JSON students.' }
            }
            Write-Host "PASS: $Kind $path HTTP 200"
        }
    } finally {
        if ($id) {
            $labels = (Invoke-Docker -Arguments @('inspect', $id, '--format', '{{json .Config.Labels}}')) | ConvertFrom-Json
            if ($labels.'com.docker.compose.project' -ne 'mycloud' -or $labels.'mycloud.role' -ne 'hub-smoke') {
                throw 'Refusing to remove a container without matching smoke-test labels.'
            }
            Invoke-Docker -Arguments @('rm', '-f', $id) | Out-Null
        }
    }
}

Push-Location -LiteralPath $repoRoot
try {
    Invoke-Docker -Arguments @('info', '--format', '{{.OSType}}/{{.Architecture}}')
    $revision = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot identify source revision.' }
    $source = 'https://github.com/Katie-217/My-Mini-Cloud-Platform'
    if (-not $VerifyOnly -and -not $SkipPush) {
        $dirty = & git status --porcelain
        if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Publish from a clean committed worktree.' }
        foreach ($kind in @('web', 'app')) {
            $tag = "$Namespace/mycloud-${kind}:$Version"
            if (Test-RemoteTag -Tag $tag) { throw "Tag $tag already exists. Choose a new version; existing tags are preserved." }
        }
    }
    if (-not $VerifyOnly) {
        foreach ($kind in @('web', 'app')) {
            $tag = "$Namespace/mycloud-${kind}:$Version"
            Invoke-Docker -Arguments @('build', '--platform', 'linux/amd64', '-t', $tag,
                '--label', "org.opencontainers.image.revision=$revision",
                '--label', "org.opencontainers.image.source=$source",
                '-f', (Join-Path $repoRoot "$kind/Dockerfile"), (Join-Path $repoRoot $kind))
        }
        if (-not $SkipPush) {
            foreach ($kind in @('web', 'app')) { Invoke-Docker -Arguments @('push', "$Namespace/mycloud-${kind}:$Version") }
        }
    }
    $results = @()
    foreach ($kind in @('web', 'app')) {
        $repository = "$Namespace/mycloud-$kind"
        $tag = "${repository}:$Version"
        $digest = if ($SkipPush) { $null } else { Get-RegistryDigest -Tag $tag }
        $reference = if ($digest) { "$repository@$digest" } else { $tag }
        if (-not $SkipPush) { Invoke-Docker -Arguments @('pull', '--platform', 'linux/amd64', $reference) }
        $metadata = (Invoke-Docker -Arguments @('image', 'inspect', $reference)) | ConvertFrom-Json
        $metadata = @($metadata)[0]
        if ($metadata.Os -ne 'linux' -or $metadata.Architecture -ne 'amd64') { throw "Expected linux/amd64 for $tag." }
        if (-not $SkipSmokeTest) {
            if ($kind -eq 'app') {
                Invoke-Docker -Arguments @('run', '--rm', '--label', 'com.docker.compose.project=mycloud',
                    '--label', 'mycloud.role=hub-smoke', $reference, 'python', '-c',
                    "import flask, pyodbc, jwt, minio, dns, gunicorn; assert 'ODBC Driver 18 for SQL Server' in pyodbc.drivers(); print('PASS: app imports and ODBC Driver 18')")
            }
            Test-HttpImage -Reference $reference -Kind $kind
        }
        $results += [pscustomobject]@{
            tag = $tag; digest = $digest; image_id = $metadata.Id; platform = 'linux/amd64'
            image_revision = $metadata.Config.Labels.'org.opencontainers.image.revision'
            registry_verified = (-not $SkipPush); smoke_tested = (-not $SkipSmokeTest)
        }
        Write-Host "PASS: $tag | linux/amd64 | $digest"
    }
    $runtime = Join-Path $repoRoot '.runtime'
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    [pscustomobject]@{ verification_source = $revision; verified_at = [DateTime]::UtcNow.ToString('o'); images = $results } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runtime 'docker-hub-release.json') -Encoding UTF8
    if ($SkipPush) { Write-Host 'NOT TESTED: Docker Hub push/pull (SkipPush).' }
    if ($SkipSmokeTest) { Write-Host 'NOT TESTED: Container smoke tests (SkipSmokeTest).' }
    Write-Host 'NOT TESTED by this script: backend SQL/OIDC/storage integration; run the integration suite separately.'
} finally { Pop-Location }
