"""Kiểm tra UI Grafana/MinIO thật bằng Edge; credential chỉ đọc từ .env local."""
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
config = dict(line.split('=', 1) for line in (root / '.env').read_text(encoding='utf-8-sig').splitlines()
              if line.strip() and not line.startswith('#') and '=' in line)
evidence = root / 'docs' / 'evidence'
evidence.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    try:
        context = browser.new_context(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1)
        page = context.new_page()
        page.goto('http://localhost:3000/login', wait_until='domcontentloaded')
        page.locator('input[name="user"]').fill(config['GRAFANA_ADMIN_USER'])
        page.locator('input[name="password"]').fill(config['GRAFANA_ADMIN_PASSWORD'])
        page.get_by_role('button', name=re.compile(r'sign in|log in', re.I)).click()
        page.wait_for_url(lambda url: '/login' not in url, timeout=20000)
        page.goto('http://localhost:3000/d/mycloud-system?orgId=1&from=now-15m&to=now&refresh=5s', wait_until='domcontentloaded')
        for title in ('CPU Usage — Linux VM (%)', 'Memory Usage — Linux kernel', 'Network Traffic — Node Exporter namespace'):
            page.get_by_text(title, exact=True).first.wait_for(timeout=30000)
        page.wait_for_function('document.querySelectorAll("canvas").length >= 3', timeout=30000)
        page.wait_for_timeout(2500)
        assert page.get_by_text('No data', exact=True).count() == 0, 'Dashboard có panel No data'
        page.screenshot(path=str(evidence / 'grafana-dashboard.png'), full_page=True)
        print('PASS: Grafana login thật, 3 panel render với canvas, không có No data; đã chụp ảnh.')
        context.close()

        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        page = context.new_page()
        page.goto('http://localhost:9001/login', wait_until='domcontentloaded')
        page.locator('input[type="text"], input:not([type])').first.fill(config['MINIO_ROOT_USER'])
        page.locator('input[type="password"]').first.fill(config['MINIO_ROOT_PASSWORD'])
        page.get_by_role('button', name=re.compile(r'sign in|log in|login', re.I)).click()
        page.get_by_text('profile-pics', exact=True).first.wait_for(timeout=30000)
        page.get_by_text('documents', exact=True).first.wait_for(timeout=30000)
        page.screenshot(path=str(evidence / 'minio-console.png'), full_page=True)
        print('PASS: MinIO Console login thật và hiển thị hai bucket; đã chụp ảnh.')
        context.close()
    finally:
        browser.close()
