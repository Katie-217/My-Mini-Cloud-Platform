"""Share only owned PDF/avatar fixtures through the UI and verify anonymous access."""
import hashlib
import json
import os
import sys

import requests
from playwright.sync_api import expect, sync_playwright

from storage_test_helpers import API, BASE, MINIO, PDF, PNG, ROOT, Fixtures

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
checks = []
target = ROOT / '.runtime/public-storage'
target.mkdir(parents=True, exist_ok=True)


def check(name, condition=True):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)


with Fixtures() as fixtures, sync_playwright() as playwright:
    avatar = fixtures.upload('profile-pics', PNG, 'own-avatar.png', 'image/png')
    student = fixtures.student(avatar['key'])
    browser = playwright.chromium.launch(channel=os.getenv('MYCLOUD_BROWSER_CHANNEL', 'msedge'), headless=True)
    try:
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, permissions=['clipboard-read', 'clipboard-write'])
        anonymous = browser.new_context()
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/app/', wait_until='domcontentloaded')
        page.locator('button[data-tab="storage"]').click()
        page.locator('#doc-file-input').set_input_files({'name': 'own-public-test.pdf', 'mimeType': 'application/pdf', 'buffer': PDF})
        with page.expect_response(lambda r: r.request.method == 'POST' and r.url.endswith('/api/files')) as uploaded:
            page.locator('#upload-document-form button[type="submit"]').click()
        data = uploaded.value.json()
        fixtures.track('documents', data['key'])
        check('Upload own PDF through UI', uploaded.value.status == 201)
        row = page.locator('#files-table-body tr').filter(has_text=data['key'])
        expect(row).to_contain_text('Riêng tư')
        with page.expect_response(lambda r: r.request.method == 'POST' and r.url.endswith('/api/files/share')) as shared:
            row.locator('[data-action="share-file"]').click()
        check('Share own PDF through UI', shared.value.status == 200)
        expect(row).to_contain_text('Công khai')
        url = row.get_by_role('link', name='Mở file').get_attribute('href')
        check('PDF link goes directly to MinIO without signature', url == MINIO + '/documents/public/' + data['key'])
        row.locator('[data-action="copy-url"]').click()
        expect(page.locator('#app-floating-toast')).to_contain_text('Đã sao chép')
        check('PDF clipboard contains public URL', page.evaluate('navigator.clipboard.readText()') == url)
        response = anonymous.request.get(url)
        check('Fresh anonymous context reads exact PDF bytes', response.status == 200 and response.body() == PDF)
        page.screenshot(path=str(target / 'pdf-public-ui.png'), full_page=True)
        for theme in ('light', 'dark'):
            page.evaluate('(theme) => {document.documentElement.setAttribute("data-theme",theme)}', theme)
            page.set_viewport_size({'width': 390, 'height': 844})
            check('Public document actions stay inside mobile viewport: ' + theme,
                  page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.evaluate('document.documentElement.setAttribute("data-theme","light")')
        with page.expect_response(lambda r: r.request.method == 'POST' and r.url.endswith('/api/files/unshare')) as revoked:
            row.locator('[data-action="unshare-file"]').click()
        check('Unshare own PDF through UI', revoked.value.status == 200)
        expect(row).to_contain_text('Riêng tư')
        check('Anonymous PDF URL revoked', anonymous.request.get(url).status in (403, 404))
        check('Original PDF still downloads', requests.get(BASE + data['download_url'], timeout=15).content == PDF)

        page.locator('button[data-tab="students"]').click()
        page.locator(f'[data-action="detail"][data-id="{student["id"]}"]').click()
        expect(page.locator('#btn-share-avatar')).to_be_visible()
        with page.expect_response(lambda r: r.request.method == 'POST' and r.url.endswith('/api/files/share')) as shared_avatar:
            page.locator('#btn-share-avatar').click()
        check('Share only owned student avatar', shared_avatar.value.status == 200)
        image_link = page.get_by_role('link', name='Mở ảnh')
        avatar_url = image_link.get_attribute('href')
        check('Avatar URL goes directly to MinIO', avatar_url == MINIO + '/profile-pics/public/' + avatar['key'])
        page.locator('#btn-copy-avatar-link').click()
        expect(page.locator('#app-floating-toast')).to_contain_text('Đã sao chép link avatar')
        check('Avatar clipboard contains public URL', page.evaluate('navigator.clipboard.readText()') == avatar_url)
        image_page = anonymous.new_page()
        response = image_page.goto(avatar_url, wait_until='domcontentloaded')
        image_page.wait_for_function('document.images.length > 0 && document.images[0].complete && document.images[0].naturalWidth > 0')
        check('Anonymous browser displays actual PNG', response.status == 200)
        check('Anonymous avatar SHA256 unchanged', hashlib.sha256(anonymous.request.get(avatar_url).body()).digest() == hashlib.sha256(PNG).digest())
        image_page.screenshot(path=str(target / 'avatar-anonymous.png'))
        page.screenshot(path=str(target / 'avatar-public-ui.png'), full_page=True)
        page.locator('#btn-unshare-avatar').click()
        expect(page.locator('#btn-share-avatar')).to_be_visible()
        check('Anonymous avatar URL revoked', anonymous.request.get(avatar_url).status in (403, 404))
        current = requests.get(API + f'/students-db/{student["id"]}', timeout=15).json()
        check('Avatar key and student data preserved', current['avatar_key'] == avatar['key'] and current['fullname'] == student['fullname'])
        check('Private original avatar still reads', requests.get(API + '/files/profile-pics/' + avatar['key'], timeout=15).content == PNG)
        page.keyboard.press('Escape')

        # A failed storage status must be shown as unknown rather than private.
        current.update(avatar_is_public=None, avatar_public_url=None, avatar_sharing_error='Storage unavailable')
        context.route('**/api/students-db/' + str(student['id']), lambda route: route.fulfill(json=current))
        page.locator(f'[data-action="detail"][data-id="{student["id"]}"]').click()
        expect(page.locator('#modal-detail-content')).to_contain_text('Chưa xác định')
        expect(page.locator('#btn-share-avatar')).to_have_count(0)
        check('Storage errors show unknown status, not a private claim')
        check('No JavaScript errors', not errors)
        anonymous.close()
        context.close()
    finally:
        browser.close()

(target / 'ui-result.json').write_text(json.dumps({'checks_passed': len(checks), 'checks': checks,
    'fixture_cleanup': True}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'RESULT: {len(checks)} public link browser checks PASS; owned fixtures cleaned.')
