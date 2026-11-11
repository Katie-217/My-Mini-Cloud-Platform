"""Kiểm thử UI thật qua gateway; chỉ dọn record/object do chính test tạo."""
import base64
import json
import re
import subprocess
import os
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import requests
from playwright.sync_api import sync_playwright, expect

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
env = dict(line.split('=', 1) for line in (root / '.env').read_text(encoding='utf-8-sig').splitlines()
           if line.strip() and not line.startswith('#') and '=' in line)
base = env.get('PUBLIC_URL', 'http://localhost').rstrip('/')
evidence = root / 'docs' / 'evidence'
evidence.mkdir(parents=True, exist_ok=True)
runtime = root / '.runtime' / 'frontend-test'
runtime.mkdir(parents=True, exist_ok=True)
student_code = 'E' + uuid.uuid4().hex[:7]
student_id = None
objects = []
checks = []
errors = []
screenshots = []


def check(name, condition=True):
    assert condition, name
    checks.append(name)
    print('PASS:', name, flush=True)


def pdf_fixture():
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>',
               b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>',
               b'<< /Length 0 >>\nstream\n\nendstream']
    data = b'%PDF-1.4\n'
    offsets = []
    for index, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f'{index} 0 obj\n'.encode() + obj + b'\nendobj\n'
    start = len(data)
    data += b'xref\n0 5\n0000000000 65535 f \n'
    for offset in offsets:
        data += f'{offset:010d} 00000 n \n'.encode()
    data += b'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n' + str(start).encode() + b'\n%%EOF\n'
    return data


with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get('MYCLOUD_BROWSER_CHANNEL', 'msedge'), headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(base + '/', wait_until='domcontentloaded')
        # Portal layout mới (sidebar + tab): cùng selector với test-portal-navigation.py
        expect(page.locator('#topbar-overall-badge')).to_have_text('System Healthy', timeout=20000)
        expect(page.locator('#dash-stat-cpu')).to_contain_text('%', timeout=15000)
        check('Portal đọc status và metric thật')
        page.screenshot(path=str(evidence / 'portal-desktop.png'))
        page.locator('[data-tab="services"]').click()
        cards = page.locator('.nimbus-service-card')
        expect(cards).to_have_count(9)
        check('Portal có đủ 9 card dịch vụ')
        cards.filter(has_text='SQL Server').get_by_role('button', name='Details').click()
        expect(page.locator('#modal-service-content')).to_contain_text('1433')
        page.keyboard.press('Escape')
        expect(page.locator('#service-modal')).not_to_have_class(re.compile(r'\bshow\b'))
        check('Card SQL mở chi tiết cổng 1433, modal đóng bằng Escape')
        page.locator('#nimbus-services-grid').screenshot(path=str(evidence / 'portal-services.png'))
        prom = requests.get(f'{urlsplit(base).scheme}://{urlsplit(base).hostname}:9090/api/v1/targets', timeout=10).json()['data']['activeTargets']
        page.locator('[data-tab="monitoring"]').click()
        up = sum(t['health'] == 'up' for t in prom)
        expect(page.locator('#mon-stat-targets-up')).to_have_text(f'{up} / {len(prom)} UP', timeout=15000)
        expect(page.locator('#mon-targets-table-body tr')).to_have_count(len(prom))
        check('Monitoring targets lấy thật từ Prometheus, không dùng số mẫu')
        screenshots.append('portal-desktop.png')
        screenshots.append('portal-services.png')

        for path in ('/blog/', '/blog/posts/', '/blog/blog1.html', '/blog/blog2.html', '/blog/blog3.html'):
            response = page.goto(base + path, wait_until='domcontentloaded')
            check('Blog route ' + path, response.status == 200)
            page.wait_for_function('Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)')
        # /blog/posts/ chuyển hướng về danh sách bài viết trong /blog/#articles
        page.goto(base + '/blog/posts/')
        page.wait_for_url(base + '/blog/#articles')
        expect(page.locator('.personal-blog-card')).to_have_count(3)
        check('Danh sách Blog đủ 3 bài', True)
        page.screenshot(path=str(evidence / 'blog-posts.png'), full_page=True)
        screenshots.append('blog-posts.png')

        page.goto(base + '/app/', wait_until='domcontentloaded')
        expect(page.locator('#topbar-status-pill')).to_have_text('API Connected', timeout=15000)
        initial_students = requests.get(base + '/api/students-db', timeout=10).json()
        expect(page.locator('#stat-total-students')).to_have_text(str(len(initial_students)))
        check('Student overview lấy dữ liệu SQL Server thật')
        page.locator('.top-tab-btn[data-tab="add-student"]').click()
        page.locator('#add-student-id').fill(student_code)
        page.locator('#add-fullname').fill('Kiểm thử Nguyễn Ánh')
        page.locator('#add-dob').fill('2004-01-02')
        major = page.locator('#add-major option').evaluate_all('(items) => items.map(x=>x.value).find(Boolean)')
        page.locator('#add-major').select_option(major)
        page.locator('#add-gpa').fill('3.75')
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=')
        page.locator('#add-avatar-file').set_input_files({'name': 'qa-avatar.png', 'mimeType': 'image/png', 'buffer': png})
        with page.expect_response(lambda r: urlsplit(r.url).path == '/api/students-db' and r.request.method == 'POST') as created:
            page.locator('#add-student-form button[type="submit"]').click()
        check('Form thêm sinh viên thực hiện POST', created.value.status == 201)
        record = created.value.json()
        student_id = record['id']
        objects.append(('profile-pics', record['avatar_key']))
        row = page.locator('#students-table-body tr').filter(has_text=student_code)
        expect(row).to_be_visible(timeout=15000)
        page.wait_for_function('(code) => {const rows=[...document.querySelectorAll("#students-table-body tr")];const img=rows.find(r=>r.textContent.includes(code))?.querySelector("img");return img && img.complete && img.naturalWidth > 0;}', arg=student_code)
        check('Avatar upload MinIO và hiển thị từ API download')
        row.locator('[data-action="detail"]').click()
        expect(page.locator('#modal-detail-content')).to_contain_text(student_code)
        page.keyboard.press('Escape')
        row.locator('[data-action="edit"]').click()
        page.locator('#edit-fullname').fill('Kiểm thử <b>Nguyễn Ánh</b>')
        page.locator('#edit-gpa').fill('3.95')
        with page.expect_response(lambda r: urlsplit(r.url).path == f'/api/students-db/{student_id}' and r.request.method == 'PUT') as updated:
            page.locator('#edit-student-form button[type="submit"]').click()
        check('Form sửa thực hiện PUT thật', updated.value.status == 200)
        expect(row).to_contain_text('Kiểm thử <b>Nguyễn Ánh</b>')
        check('Tên chứa HTML hiển thị dạng text an toàn', row.locator('b').count() == 0)
        check('Sửa trên UI giữ nguyên avatar cũ', requests.get(base + f'/api/students-db/{student_id}', timeout=10).json().get('avatar_key') == record['avatar_key'])
        page.locator('#search-student-input').fill(student_code)
        expect(page.locator('#students-table-body tr:not(#students-loading):not(#students-empty)')).to_have_count(1)
        page.screenshot(path=str(evidence / 'student-crud.png'), full_page=True)
        screenshots.append('student-crud.png')
        row.locator('[data-action="delete"]').click()
        with page.expect_response(lambda r: urlsplit(r.url).path == f'/api/students-db/{student_id}' and r.request.method == 'DELETE') as deleted:
            page.locator('#btn-confirm-delete').click()
        check('Xác nhận xóa thực hiện DELETE thật', deleted.value.status == 200)
        expect(row).to_have_count(0)
        student_id = None

        page.locator('.top-tab-btn[data-tab="storage"]').click()
        pdf = pdf_fixture()
        page.locator('#doc-file-input').set_input_files({'name': 'qa-report.pdf', 'mimeType': 'application/pdf', 'buffer': pdf})
        with page.expect_response(lambda r: urlsplit(r.url).path == '/api/files' and r.request.method == 'POST') as uploaded:
            page.locator('#upload-document-form button[type="submit"]').click()
        check('Upload PDF từ giao diện', uploaded.value.status == 201)
        key = uploaded.value.json()['key']
        objects.append(('documents', key))
        file_row = page.locator('#files-table-body tr').filter(has_text=key)
        expect(file_row).to_be_visible()
        href = file_row.get_by_role('link', name='Tải về').get_attribute('href')
        check('Download UI giữ nguyên PDF bytes', context.request.get(base + href).body() == pdf)

        # Đăng nhập Keycloak từ tab Auth của Portal; /app/ xử lý callback PKCE rồi quay về /#auth
        for username in ('sv01', 'sv02'):
            page.goto(base + '/')
            page.locator('.portal-nav-item[data-tab="auth"]').click()
            expect(page.locator('#auth-info-realm')).to_have_text(env['OIDC_REALM'], timeout=10000)
            page.locator('#btn-auth-sso-login').click()
            check(f'{username}: Keycloak nhận code_challenge S256', page.wait_for_selector('#username', timeout=15000) and 'code_challenge_method=S256' in page.url)
            page.locator('#username').fill(username)
            page.locator('#password').fill(env['DEMO_USER_PASSWORD'])
            page.locator('#kc-login').click()
            page.wait_for_url(base + '/#auth', timeout=20000)
            expect(page.locator('#auth-test-result-box')).to_contain_text(f'"preferred_username": "{username}"', timeout=20000)
            check(f'{username}: callback PKCE và /api/secure HTTP 200', 'HTTP 200' in page.locator('#auth-test-result-box').inner_text())
            check(f'{username}: state/verifier được dọn', page.evaluate('sessionStorage.getItem("pkce_state")===null && sessionStorage.getItem("pkce_code_verifier")===null'))
            page.locator('#btn-auth-clear-token').click()
            expect(page.locator('#portal-copy-toast')).to_contain_text('Đã đăng xuất Keycloak', timeout=20000)
            check(f'{username}: Đăng xuất Keycloak và xóa token khỏi tab', page.url == base + '/#auth' and page.evaluate('sessionStorage.getItem("mycloud_access_token")===null && sessionStorage.getItem("mycloud_id_token")===null'))
            # Không xóa cookie: vòng sau phải hiện form login trống để đổi sang user khác

        for path in ('/', '/blog/', '/app/'):
            page.set_viewport_size({'width': 390, 'height': 844})
            page.goto(base + path, wait_until='domcontentloaded')
            check('Không tràn viewport mobile ' + path, page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        page.goto(base + '/')
        expect(page.locator('#topbar-overall-badge')).to_have_text('System Healthy', timeout=20000)
        page.screenshot(path=str(evidence / 'portal-mobile.png'), full_page=True)
        screenshots.append('portal-mobile.png')

        # Lỗi metrics không được thay bằng số giả (fault test web2 nằm ở test-portal-navigation.py)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        context.route('**/api/metrics-summary', lambda route: route.fulfill(status=503, json={'status': 'unavailable'}))
        page.reload()
        expect(page.locator('#dash-stat-cpu')).to_have_text('Chưa có dữ liệu', timeout=15000)
        check('UI fault test: metrics 503 không tạo số liệu giả')
        context.unroute('**/api/metrics-summary')
        check('Không có JavaScript pageerror', not errors)
    finally:
        context.close()
        browser.close()
        if student_id is not None:
            response = requests.get(base + f'/api/students-db/{student_id}', timeout=10)
            if response.ok and response.json().get('student_id') == student_code:
                requests.delete(base + f'/api/students-db/{student_id}', timeout=10).raise_for_status()
        for bucket, key in objects:
            subprocess.run(['docker', 'compose', '-f', str(root/'docker-compose.yml'), '-p', 'mycloud',
                            'exec', '-T', 'application-backend-server', 'python', '-c',
                            'import sys; from integrations import storage_client; storage_client().remove_object(sys.argv[1],sys.argv[2])',
                            bucket, key], check=True, cwd=root)

report = {'checks_passed': len(checks), 'checks': checks, 'javascript_errors': errors,
          'screenshots': screenshots, 'fixture_cleanup': True,
          'fault_tests': 'Browser response interception only; no service stopped.'}
(evidence/'frontend-e2e.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'RESULT: {len(checks)} frontend browser checks PASS; fixture cleanup complete.')
