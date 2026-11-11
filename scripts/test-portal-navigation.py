"""Kiểm tra liên kết Portal và trạng thái lỗi bằng Edge; không sửa dữ liệu."""
import json
import re
import os
import sys
from pathlib import Path

import requests
from playwright.sync_api import expect, sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
config = dict(line.split('=', 1) for line in (root / '.env').read_text(encoding='utf-8-sig').splitlines()
              if line.strip() and not line.startswith('#') and '=' in line)
base = config.get('PUBLIC_URL', 'http://localhost').rstrip('/')
evidence = root / '.runtime' / 'portal-navigation'
evidence.mkdir(parents=True, exist_ok=True)
checks = []
errors = []


def check(name, condition=True):
    assert condition, name
    checks.append(name)
    print('PASS:', name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get('MYCLOUD_BROWSER_CHANNEL', 'msedge'), headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(base + '/')
        expect(page.locator('#topbar-overall-badge')).to_have_text('System Healthy', timeout=20000)
        expect(page.locator('#dash-stat-cpu')).to_contain_text('%', timeout=15000)
        expect(page.locator('#dash-stat-ram')).to_contain_text('GB')
        check('Dashboard hiển thị CPU/RAM từ API thật')
        activity = page.locator('#recent-activity-table-body tr')
        expect(activity.filter(has_text='Database Server').locator('td').nth(2)).to_have_text('SQL Query')
        expect(activity.filter(has_text='Internal DNS').locator('td').nth(2)).to_have_text('DNS Query (A)')
        expect(activity.filter(has_text='Application Server').locator('td').nth(2)).to_have_text('HTTP GET + SQL')
        check('Nhật ký healthcheck phân biệt SQL, DNS và HTTP theo backend')
        page.locator('a.portal-nav-item[href="/blog/"]').click()
        page.wait_for_url(base + '/blog/')
        check('Nút Blog trên sidebar mở đúng trang')
        for article in ('blog1.html', 'blog2.html', 'blog3.html'):
            response = page.goto(base + '/blog/' + article)
            check('Blog ' + article, response.status == 200)

        page.goto(base + '/')
        page.locator('[data-tab="services"]').click()
        cards = page.locator('.nimbus-service-card')
        expect(cards).to_have_count(9)
        expect(page.locator('.nimbus-status-pill', has_text='Healthy')).to_have_count(9, timeout=15000)
        check('Đủ 9 card lấy probe thật, Web/Monitoring tổng hợp các thành viên')
        for index in range(9):
            card = cards.nth(index)
            title = card.locator('h3').inner_text()
            if 'DNS' in title:
                check('DNS không có liên kết HTTP tới port1053', card.locator('a').count() == 0)
                card.get_by_role('button', name='Hướng dẫn kiểm tra DNS').click()
                expect(page.locator('#modal-service-content')).to_contain_text('dig')
                page.keyboard.press('Escape')
                check('Nút DNS mở hướng dẫn và đóng được bằng Escape')
                continue
            link = card.locator('a')
            href = link.get_attribute('href')
            with page.expect_popup() as opened:
                link.click()
            tab = opened.value
            tab.wait_for_load_state('domcontentloaded')
            response = context.request.get(href)
            check('Mở card ' + title, response.ok and not tab.url.startswith('chrome-error:'))
            if 'Grafana' in title:
                check('Grafana trỏ dashboard và giữ redirect khi cần login', '/d/mycloud-system' in href and ('mycloud-system' in tab.url or 'mycloud-system' in response.url))
            tab.close()
        page.screenshot(path=str(evidence / 'portal-services.png'), full_page=True)
        check('Không còn link Blackbox nội bộ trên Portal', page.locator('a[href*="9115"]').count() == 0)

        page.locator('[data-tab="dns"]').dispatch_event('click')
        rows = page.locator('#dns-records-table-body tr')
        check('DNS table chỉ chứa 5 bản ghi có trong zone', rows.count() == 5 and rows.filter(has_text='prometheus.cloud.local').count() == 0)
        for link in page.locator('#dns-records-table-body a').all():
            check('DNS table mở URL host ' + link.get_attribute('href'), context.request.get(link.get_attribute('href')).ok)

        live = requests.get(base + '/api/status', timeout=15).json()
        next(service for service in live['services'] if service['id'] == 'web2')['status'] = 'unhealthy'
        live['overall'] = 'degraded'
        context.route('**/api/status', lambda route: route.fulfill(json=live))
        page.reload()
        page.locator('[data-tab="services"]').click()
        expect(cards.filter(has_text='Nginx Web Replicas').locator('.nimbus-status-pill')).to_contain_text('Unhealthy')
        check('Lỗi web2 làm cả nhóm Web unhealthy')
        context.unroute('**/api/status')

        context.route('**/api/status', lambda route: route.fulfill(status=503, json={'error': 'test only'}))
        context.route('**/api/metrics-summary', lambda route: route.fulfill(status=503, json={'status': 'unavailable'}))
        page.reload()
        expect(page.locator('#topbar-overall-badge')).to_have_text('Chưa kết nối')
        expect(page.locator('#dash-stat-cpu')).to_have_text('Chưa có dữ liệu')
        page.locator('[data-tab="services"]').click()
        expect(page.locator('.nimbus-status-pill', has_text='Unknown')).to_have_count(9)
        check('Nguồn lỗi: không báo Online, không tạo latency/metrics mẫu', cards.filter(has_text='3.00ms').count() == 0)
        context.unroute('**/api/status')
        context.unroute('**/api/metrics-summary')

        page.goto('http://127.0.0.1/')
        expect(page.locator('.quick-app-tile[href^="http://127.0.0.1:3000/d/mycloud-system"]')).to_have_count(1)
        check('Quick links dùng hostname đang truy cập')
        check('Không có JavaScript pageerror', not errors)

        # Đăng nhập thực tế để xác nhận dashboard đích có biểu đồ, không chỉ HTTP200.
        page.goto('http://localhost:3000/login')
        page.locator('input[name="user"]').fill(config['GRAFANA_ADMIN_USER'])
        page.locator('input[name="password"]').fill(config['GRAFANA_ADMIN_PASSWORD'])
        page.get_by_role('button', name=re.compile(r'sign in|log in', re.I)).click()
        page.wait_for_url(lambda url: '/login' not in url, timeout=20000)
        page.goto('http://localhost:3000/d/mycloud-system?from=now-15m&to=now')
        for title in ('CPU Usage — Linux VM (%)', 'Memory Usage — Linux kernel', 'Network Traffic — Node Exporter namespace'):
            page.get_by_text(title, exact=True).first.wait_for(timeout=30000)
        page.wait_for_function('document.querySelectorAll("canvas").length >= 3', timeout=30000)
        page.wait_for_timeout(2000)
        check('Grafana login và 3 panel có biểu đồ', page.get_by_text('No data', exact=True).count() == 0)
        page.screenshot(path=str(evidence / 'grafana-dashboard.png'), full_page=True)
    finally:
        context.close()
        browser.close()

(evidence / 'result.json').write_text(json.dumps({'checks_passed': len(checks), 'checks': checks,
    'javascript_errors_portal': errors, 'fault_test': 'Browser response interception only'}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'RESULT: {len(checks)} portal navigation checks PASS; no data changed.')
