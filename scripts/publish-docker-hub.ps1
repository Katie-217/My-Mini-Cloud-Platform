<#
.SYNOPSIS
    Script build, tag, push và verify các custom image Docker Hub cho MyMiniCloud.
.DESCRIPTION
    Script này hỗ trợ build cho Linux amd64, tag theo namespace
    và version chỉ định, push lên Docker Hub, inspect manifest SHA256 digest, pull lại
    và chạy smoke test độc lập.
    Không lưu hay in mật khẩu/token ra màn hình.
.PARAMETER Namespace
    Docker Hub username hoặc organization namespace (bắt buộc).
.PARAMETER Version
    Phiên bản tag phát hành (mặc định: 1.0.0).
.PARAMETER SkipPush
    Chỉ build và tag local, không thực hiện docker push (dùng để kiểm tra trước).
.PARAMETER SkipSmokeTest
    Bỏ qua bước smoke test container tạm thời sau khi pull.
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Namespace,

    [Parameter(Mandatory = $false, Position = 1)]
    [string]$Version = "1.0.0",

    [Parameter(Mandatory = $false)]
    [switch]$SkipPush,

    [Parameter(Mandatory = $false)]
    [switch]$SkipSmokeTest
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$scriptRoot = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  MyMiniCloud - Phat Hanh Docker Hub Custom Images" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Repo Root: $repoRoot"
Write-Host "Namespace: $Namespace"
Write-Host "Version  : $Version"
Write-Host ""

# 1. Kiem tra xac thuc Docker neu khong SkipPush
if (-not $SkipPush) {
    Write-Host "[1/6] Kiem tra trang thai dang nhap Docker..." -ForegroundColor Yellow
    try {
        $null = docker info --format '{{json .RegistryConfig.IndexConfigs}}' 2>&1
    } catch {
        throw "Khong the ket noi den Docker daemon. Vui long dam bao Docker Desktop dang chay."
    }
}

# 2. Build local images tu source moi nhat (target linux/amd64)
Write-Host "[2/6] Build cac custom image tu source (linux/amd64)..." -ForegroundColor Yellow

# Web Frontend Image
$webTag = "$Namespace/mycloud-web:$Version"
Write-Host "-> Building Web Frontend: $webTag"
docker build --platform linux/amd64 -t $webTag -t "mycloud-web:$Version" -f (Join-Path $repoRoot "web/Dockerfile") (Join-Path $repoRoot "web")
if ($LASTEXITCODE -ne 0) { throw "Build image web that bai." }

# App Backend Image
$appTag = "$Namespace/mycloud-app:$Version"
Write-Host "-> Building App Backend: $appTag"
docker build --platform linux/amd64 -t $appTag -t "mycloud-app:$Version" -f (Join-Path $repoRoot "app/Dockerfile") (Join-Path $repoRoot "app")
if ($LASTEXITCODE -ne 0) { throw "Build image app that bai." }

Write-Host "PASS: Build thanh cong ca 2 image local." -ForegroundColor Green

# 3. Push len Docker Hub (neu khong SkipPush)
if (-not $SkipPush) {
    Write-Host "[3/6] Push image len Docker Hub..." -ForegroundColor Yellow
    
    Write-Host "-> Pushing $webTag..."
    docker push $webTag
    if ($LASTEXITCODE -ne 0) { throw "Push image $webTag that bai. Hay chac chan da chay 'docker login' thanh cong." }
    
    Write-Host "-> Pushing $appTag..."
    docker push $appTag
    if ($LASTEXITCODE -ne 0) { throw "Push image $appTag that bai. Hay chac chan da chay 'docker login' thanh cong." }
    
    Write-Host "PASS: Push thanh cong 2 image len Docker Hub." -ForegroundColor Green

    # 4. Kiem tra manifest va digest
    Write-Host "[4/6] Kiem tra manifest va digest..." -ForegroundColor Yellow
    Write-Host "Manifest Web:"
    docker manifest inspect $webTag
    Write-Host "Manifest App:"
    docker manifest inspect $appTag

    # 5. Pull lai theo tag de xac minh
    Write-Host "[5/6] Pull lai image tu Docker Hub..." -ForegroundColor Yellow
    docker pull $webTag
    if ($LASTEXITCODE -ne 0) { throw "Pull lai image $webTag that bai." }
    docker pull $appTag
    if ($LASTEXITCODE -ne 0) { throw "Pull lai image $appTag that bai." }
} else {
    Write-Host "[INFO] Bo qua buoc push theo tham so -SkipPush." -ForegroundColor Cyan
}

# 6. Smoke test tren image
if (-not $SkipSmokeTest) {
    Write-Host "[6/6] Thuc hien Smoke Test tren image..." -ForegroundColor Yellow
    
    # Test Web Image: Chay container tam thoi, kiem tra HTTP 200 tra ve Portal
    $testWebContainer = "test-smoke-web-" + [guid]::NewGuid().ToString().Substring(0, 8)
    Write-Host "-> Khoi dong container test Web: $testWebContainer"
    docker run -d --name $testWebContainer -p 18080:80 $webTag
    try {
        Start-Sleep -Seconds 2
        $resp = Invoke-WebRequest -Uri "http://localhost:18080/" -UseBasicParsing -TimeoutSec 5
        if ($resp.StatusCode -ne 200) { throw "Web container tra ve ma $($resp.StatusCode)" }
        Write-Host "PASS: Smoke test Web container HTTP 200 OK." -ForegroundColor Green
    } finally {
        docker rm -f $testWebContainer | Out-Null
    }

    # Test App Image: Chay lenh kiem tra cu phap Python va import dependencies
    Write-Host "-> Kiem tra dependencies Backend trong App container..."
    $appTestOutput = docker run --rm $appTag python -c "import flask, pyodbc, jwt, minio, dns, gunicorn; print('IMPORTS_OK')"
    if ($LASTEXITCODE -ne 0 -or $appTestOutput -notmatch "IMPORTS_OK") { throw "App container thieu dependencies hoac import loi." }
    Write-Host "PASS: Smoke test App container imports OK." -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Hoan tat quy trinh kiem thu Docker Hub custom images!" -ForegroundColor Green
Write-Host "  Web Tag: $webTag"
Write-Host "  App Tag: $appTag"
Write-Host "==========================================================" -ForegroundColor Green
