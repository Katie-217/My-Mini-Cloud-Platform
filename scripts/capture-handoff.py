"""Chạy lệnh thật, lưu transcript riêng và chụp kết quả để nhúng vào hướng dẫn."""
import argparse
import base64
import hashlib
import html
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

import requests
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.runtime' / 'handoff'
OUT.mkdir(parents=True, exist_ok=True)
CONFIG = dict(line.split('=', 1) for line in (ROOT / '.env').read_text(encoding='utf-8-sig').splitlines()
              if line.strip() and not line.startswith('#') and '=' in line)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
LOCAL = timezone(timedelta(hours=7))

# Các lệnh này đồng thời được dùng làm ví dụ trong tài liệu, không thay secret vào command.
CASES = {
    'versions': ('Phiên bản công cụ', '''git --version
python --version
docker version --format 'Client={{.Client.Version}} Server={{.Server.Version}}'
docker compose version
docker info --format 'OS={{.OSType}} Arch={{.Architecture}} CPUs={{.NCPU}} RAM={{.MemTotal}} bytes' '''),
    'setup': ('Thiết lập project', 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1 -NoBuild'),
    'resources': ('Container, network, volume', '''docker compose -p mycloud config --quiet
docker compose -p mycloud ps -a
docker volume ls --filter label=com.docker.compose.project=mycloud
docker network inspect cloud-net --format '{{json .IPAM.Config}}'
docker network inspect cloud-net --format '{{range .Containers}}{{println .Name .IPv4Address}}{{end}}' '''),
    'web': ('Web và các route public', '''curl.exe --max-time 15 -sI http://localhost/
curl.exe --max-time 15 -sI http://localhost/blog/
curl.exe --max-time 15 -sI http://localhost/app/
curl.exe --max-time 15 -sI http://localhost/auth/'''),
    'backend': ('Proxy gọi Flask và database health', '''docker compose -p mycloud exec -T api-gateway-proxy-server wget -qO- http://application-backend-server:8081/hello
curl.exe --max-time 15 -i http://localhost/api/hello
curl.exe --max-time 15 -s http://localhost/api/health
Invoke-RestMethod http://localhost/student/ | Format-Table'''),
    'sql': ('Flask kết nối SQL Server bằng ODBC', '''docker compose -p mycloud exec -T application-backend-server python -c "import json; from database import connection; c=connection(); print(c.execute('SELECT DB_NAME(), USER_NAME()').fetchone()); q=c.execute('SELECT id,student_id,fullname,dob,major,gpa FROM dbo.students ORDER BY id'); print(json.dumps([dict(zip([d[0] for d in q.description],r)) for r in q],ensure_ascii=False,default=str,indent=2)); c.close()"'''),
    'crud': ('CRUD một bản ghi demo riêng', '''$demoCode = 'S' + [guid]::NewGuid().ToString('N').Substring(0,7)
$payload = @{ student_id=$demoCode; fullname='Nguyễn Minh Chứng'; dob='2004-05-12'; major='Điện toán đám mây'; gpa=3.5 }
$body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))
$created = Invoke-WebRequest -UseBasicParsing -Method Post -Uri http://localhost/api/students-db -ContentType 'application/json; charset=utf-8' -Body $body
$demoId = ($created.Content | ConvertFrom-Json).id
try {
    "POST HTTP $($created.StatusCode)"
    $created.Content
    Invoke-RestMethod "http://localhost/api/students-db/$demoId" | Format-List
    $payload.gpa = 3.9
    $body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))
    $updated = Invoke-WebRequest -UseBasicParsing -Method Put -Uri "http://localhost/api/students-db/$demoId" -ContentType 'application/json; charset=utf-8' -Body $body
    "PUT HTTP $($updated.StatusCode)"
    $updated.Content
    Invoke-RestMethod "http://localhost/api/students-db?q=$demoCode" | Format-List
} finally {
    Invoke-RestMethod -Method Delete "http://localhost/api/students-db/$demoId"
}
curl.exe --max-time 15 -i "http://localhost/api/students-db/$demoId"'''),
    'auth': ('Keycloak config và secure không token', '''Invoke-RestMethod http://localhost/api/auth/config | Format-List
curl.exe --max-time 15 -i http://localhost/api/secure'''),
    'storage': ('Upload/download PDF và kiểm tra byte', '''python scripts/create-demo-files.py
$pdfPath = (Resolve-Path .runtime/demo-files/report.pdf).Path
$uploadJson = curl.exe --max-time 60 -sS --fail -F 'bucket=documents' -F "file=@$pdfPath;type=application/pdf" http://localhost/api/files
if ($LASTEXITCODE -ne 0) { throw 'Upload failed' }
$upload = $uploadJson | ConvertFrom-Json
try {
    $upload | Format-List
    (Invoke-RestMethod 'http://localhost/api/files?bucket=documents').files | Where-Object key -eq $upload.key | Format-Table key,size,last_modified
    $downloadPath = Join-Path $PWD '.runtime/handoff/downloaded.pdf'
    New-Item -ItemType Directory -Force .runtime/handoff | Out-Null
    curl.exe --max-time 60 -sS --fail -o $downloadPath "http://localhost$($upload.download_url)"
    if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
    Get-FileHash -Algorithm SHA256 -LiteralPath $pdfPath,$downloadPath | Format-Table
    if ((Get-FileHash -LiteralPath $pdfPath).Hash -ne (Get-FileHash -LiteralPath $downloadPath).Hash) { throw 'Hash mismatch' }
    curl.exe --max-time 15 -sI "http://localhost:9000/documents/$($upload.key)"
} finally {
    docker compose -p mycloud exec -T application-backend-server python -c "import sys; from integrations import storage_client; storage_client().remove_object('documents',sys.argv[1]); print('PASS: removed only uploaded demo object')" $upload.key
}'''),
    'dns': ('Zone Bind9 và publish UDP/TCP1053', '''docker compose -p mycloud exec -T internal-dns-server named-checkconf
foreach ($record in @('web-frontend-server','app-backend','minio','keycloak')) {
    "$record.cloud.local"
    docker compose -p mycloud exec -T internal-dns-server dig '@127.0.0.1' "$record.cloud.local" +short
}
python scripts/test-dns-host.py
docker compose -p mycloud exec -T api-gateway-proxy-server nslookup app-backend.cloud.local 172.30.50.53
docker compose -p mycloud exec -T api-gateway-proxy-server nslookup application-backend-server'''),
    'monitoring': ('Prometheus targets và HTTP probe', '''$targets = Invoke-RestMethod 'http://localhost:9090/api/v1/targets'
$targets.data.activeTargets | Select-Object @{n='Job';e={$_.labels.job}},@{n='Instance';e={$_.labels.instance}},health | Format-Table -AutoSize
$probe = Invoke-RestMethod 'http://localhost:9090/api/v1/query?query=probe_success'
$probe.data.result | ForEach-Object { [pscustomobject]@{Job=$_.metric.job;Instance=$_.metric.instance;Value=$_.value[1]} } | Format-Table -AutoSize
Invoke-RestMethod http://localhost/api/metrics-summary | Format-List
Get-Content grafana/provisioning/datasources/prometheus.yml'''),
    'round-robin': ('Nginx và phân phối request hai web', '''docker compose -p mycloud exec -T api-gateway-proxy-server nginx -t
$replicas = 1..20 | ForEach-Object { (Invoke-RestMethod http://localhost/__replica).replica }
$replicas
$replicas | Group-Object | Select-Object Name,Count | Format-Table -AutoSize'''),
    'ping': ('Gateway ping các server và kiểm tra TCP SQL', '''$servers = @('web-frontend-server1','web-frontend-server2','application-backend-server','relational-database-server','authentication-identity-server','object-storage-server','internal-dns-server','monitoring-node-exporter-server','monitoring-http-exporter-server','monitoring-prometheus-server','monitoring-grafana-dashboard-server')
foreach ($server in $servers) {
    docker compose -p mycloud exec -T api-gateway-proxy-server ping -c 1 -W 2 $server
    if ($LASTEXITCODE -ne 0) { throw "Ping failed: $server" }
}
docker compose -p mycloud exec -T api-gateway-proxy-server nc -z -w 3 relational-database-server 1433
if ($LASTEXITCODE -eq 0) { 'PASS: gateway -> SQL Server TCP1433' }'''),
    'verification': ('Bộ kiểm thử backend/auth/storage/monitoring', 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1'),
    'persistence': ('Dữ liệu giữ nguyên sau restart SQL và MinIO', '''docker compose -p mycloud cp scripts/test-persistence.py application-backend-server:/tmp/test-persistence.py
docker compose -p mycloud cp scripts/test-storage-persistence.py application-backend-server:/tmp/test-storage-persistence.py
docker compose -p mycloud exec -T application-backend-server python /tmp/test-persistence.py create
if ($LASTEXITCODE -ne 0) { throw 'SQL fixture create failed; no restart performed' }
docker compose -p mycloud exec -T -e PYTHONPATH=/app application-backend-server python /tmp/test-storage-persistence.py create
if ($LASTEXITCODE -ne 0) { throw 'Storage fixture create failed; no restart performed' }
docker compose -p mycloud restart relational-database-server object-storage-server
if ($LASTEXITCODE -ne 0) { throw 'Restart failed' }
docker compose -p mycloud exec -T application-backend-server python /tmp/test-persistence.py verify
if ($LASTEXITCODE -ne 0) { throw 'SQL persistence verification failed' }
docker compose -p mycloud exec -T -e PYTHONPATH=/app application-backend-server python /tmp/test-storage-persistence.py verify
if ($LASTEXITCODE -ne 0) { throw 'Storage persistence verification failed' }
python scripts/health-check.py --wait 180 --require-frontend'''),
}


def sanitized(text):
    for key, value in CONFIG.items():
        if re.search('PASSWORD|SECRET|TOKEN', key) and value:
            text = text.replace(value, '[REDACTED]')
    text = re.sub(r'Bearer\s+[A-Za-z0-9_.-]+', 'Bearer [REDACTED]', text)
    return text


def run_case(name):
    title, command = CASES[name]
    # EncodedCommand giữ nguyên tiếng Việt và không nội suy command qua shell khác.
    source = """$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Console]::OutputEncoding
$global:LASTEXITCODE=0
try {
""" + command + "\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\n} catch { Write-Output $_.Exception.Message; exit 1 }"
    timestamp = datetime.now(LOCAL).isoformat(timespec='seconds')
    result = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
                             base64.b64encode(source.encode('utf-16-le')).decode()], cwd=ROOT,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600)
    entry = {'title': title, 'command': command.strip(), 'output': sanitized(result.stdout.decode('utf-8', errors='replace')),
             'exit_code': result.returncode, 'captured_at': timestamp}
    (OUT / f'{name}.json').write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"{'PASS' if result.returncode == 0 else 'FAIL'}: {name} (exit {result.returncode})", flush=True)
    if result.returncode:
        raise RuntimeError(f'Case {name} failed; sanitized transcript saved under .runtime/handoff.')


def browser_capture(browser):
    cfg = CONFIG
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.goto('http://localhost/')
    page.get_by_text('System Healthy', exact=True).first.wait_for(timeout=20000)
    page.locator('[data-tab="services"]').click()
    page.locator('.nimbus-service-card').first.wait_for()
    page.screenshot(path=str(OUT / 'portal-ui.png'), full_page=True)
    page.locator('[data-tab="auth"]').click()
    page.wait_for_function('(realm) => document.getElementById("auth-info-realm").textContent === realm',
                           arg=cfg['OIDC_REALM'])
    page.screenshot(path=str(OUT / 'auth-ui.png'), full_page=True)
    page.goto('http://localhost/blog/')
    page.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
    page.screenshot(path=str(OUT / 'blog-ui.png'), full_page=True)
    page.goto('http://localhost:9090/targets')
    page.get_by_text('monitoring-node-exporter-server:9100', exact=False).first.wait_for(timeout=20000)
    page.screenshot(path=str(OUT / 'prometheus-ui.png'), full_page=True)
    page.goto('http://localhost:3000/login')
    page.locator('input[name="user"]').fill(cfg['GRAFANA_ADMIN_USER'])
    page.locator('input[name="password"]').fill(cfg['GRAFANA_ADMIN_PASSWORD'])
    page.get_by_role('button', name=re.compile('sign in|log in', re.I)).click()
    page.wait_for_url(lambda url: '/login' not in url, timeout=20000)
    page.goto('http://localhost:3000/d/mycloud-system?from=now-15m&to=now')
    page.wait_for_function('document.querySelectorAll("canvas").length>=3', timeout=30000)
    page.wait_for_timeout(2500)
    assert page.get_by_text('No data', exact=True).count() == 0
    page.screenshot(path=str(OUT / 'grafana-ui.png'), full_page=True)
    page.goto('http://localhost:9001/login')
    page.locator('input[type="text"], input:not([type])').first.fill(cfg['MINIO_ROOT_USER'])
    page.locator('input[type="password"]').fill(cfg['MINIO_ROOT_PASSWORD'])
    page.get_by_role('button', name=re.compile('sign in|log in|login', re.I)).click()
    page.get_by_text('profile-pics', exact=True).first.wait_for(timeout=30000)
    page.get_by_text('documents', exact=True).first.wait_for(timeout=30000)
    page.screenshot(path=str(OUT / 'minio-ui.png'), full_page=True)
    context.close()

    # Login OIDC bằng form thật, callback được intercept để kiểm thử auth độc lập UI.
    context = browser.new_context(viewport={'width': 1280, 'height': 850})
    page = context.new_page()
    public = cfg.get('PUBLIC_URL', 'http://localhost').rstrip('/')
    issuer = public + '/auth/realms/' + cfg.get('OIDC_REALM', 'MSSV_PLACEHOLDER')
    import secrets
    verifier, state = secrets.token_urlsafe(48), secrets.token_urlsafe(24)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    redirect = public + '/app/'
    page.route(public + '/app/**', lambda route: route.fulfill(status=200, body='Callback received'))
    query = urlencode(dict(client_id='flask-app', response_type='code', scope='openid profile',
                           redirect_uri=redirect, state=state, code_challenge=challenge, code_challenge_method='S256'))
    page.goto(issuer + '/protocol/openid-connect/auth?' + query)
    page.locator('#username').wait_for()
    page.screenshot(path=str(OUT / 'keycloak-ui.png'), full_page=True)
    page.locator('#username').fill('sv01')
    page.locator('#password').fill(cfg['DEMO_USER_PASSWORD'])
    page.locator('#kc-login').click()
    page.wait_for_url(public + '/app/**')
    callback = parse_qs(urlsplit(page.url).query)
    assert callback['state'] == [state]
    token_response = requests.post(issuer + '/protocol/openid-connect/token', data=dict(grant_type='authorization_code',
        client_id='flask-app', redirect_uri=redirect, code=callback['code'][0], code_verifier=verifier), timeout=20)
    token_response.raise_for_status()
    response = requests.get(public + '/api/secure', headers={'Authorization': 'Bearer ' + token_response.json()['access_token']}, timeout=15)
    assert response.status_code == 200 and response.json()['preferred_username'] == 'sv01'
    entry = dict(title='Secure API sau login form thật và PKCE',
        command='Browser: Keycloak login sv01 -> Authorization Code + PKCE -> GET /api/secure',
        output=f'HTTP {response.status_code}\n' + json.dumps(response.json(), ensure_ascii=False, indent=2),
        exit_code=0, captured_at=datetime.now(LOCAL).isoformat(timespec='seconds'))
    (OUT / 'secure-login.json').write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding='utf-8')
    context.close()
    print('PASS: Browser screenshots and secure API200 after real login; no credentials captured.', flush=True)


def terminal_screenshots(browser):
    page = browser.new_page(viewport={'width': 1200, 'height': 850}, device_scale_factor=1)
    for path in sorted(OUT.glob('*.json')):
        if path.name in ('manifest.json',):
            continue
        entry = json.loads(path.read_text(encoding='utf-8'))
        if 'command' not in entry:
            continue
        text = entry['output']
        # Mỗi ảnh giữ trọn một phần response; không rút gọn hoặc dựng output mẫu.
        parts = [text.splitlines()[i:i+34] for i in range(0, max(1, len(text.splitlines())), 34)]
        images = []
        for index, lines in enumerate(parts):
            body = f"$ {entry['command']}\n\n" if index == 0 else f"[Tiếp response {path.stem}, phần {index+1}]\n\n"
            body += '\n'.join(lines)
            page.set_content('<html lang="vi"><meta charset="utf-8"><style>body{margin:0;padding:25px;background:#101827;color:#ecf2ff;font:16px/1.6 Consolas,"Segoe UI",monospace}h1{font:600 23px "Segoe UI";color:#7dd3fc}small{color:#a5b4cf}pre{white-space:pre-wrap;overflow-wrap:anywhere}footer{border-top:1px solid #475569;color:#a5b4cf;padding-top:12px}</style><h1>' + html.escape(entry['title']) + '</h1><small>' + html.escape(entry['captured_at']) + ' · Bản ghi lệnh chạy thật · Exit ' + str(entry['exit_code']) + '</small><pre>' + html.escape(body) + '</pre><footer>MyMiniCloud · Ảnh hiển thị transcript thực thi, không phải ảnh cửa sổ PowerShell.</footer></html>')
            image_name = f'{path.stem}-{index+1}.png'
            page.locator('body').screenshot(path=str(OUT / image_name))
            images.append(image_name)
        entry['images'] = images
        path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding='utf-8')
    page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cases', nargs='*', choices=list(CASES), default=list(CASES))
    parser.add_argument('--include-restart', action='store_true', help='Restart only mycloud SQL/MinIO for persistence evidence')
    parser.add_argument('--render-only', action='store_true')
    parser.add_argument('--browser', default='msedge', choices=('msedge', 'chromium'))
    args = parser.parse_args()
    if not args.render_only:
        for name in args.cases:
            if name == 'persistence' and not args.include_restart:
                continue
            run_case(name)
    with sync_playwright() as p:
        browser = p.chromium.launch(**({'channel': 'msedge'} if args.browser == 'msedge' else {}), headless=True)
        try:
            if not args.render_only:
                browser_capture(browser)
            terminal_screenshots(browser)
        finally:
            browser.close()
    print('PASS: Evidence ready under .runtime/handoff; run scripts/build-handoff.py to embed in the guide.')


if __name__ == '__main__':
    main()
