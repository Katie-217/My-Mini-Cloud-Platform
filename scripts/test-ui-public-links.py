"""Kiểm thử toàn diện UI Student App: Chia sẻ file PDF và Avatar qua Browser Playwright."""
import json
import sys
import urllib.request
from playwright.sync_api import sync_playwright

BASE_URL = 'http://localhost/app/'
MINIO_URL = 'http://localhost:9000'
API_BASE = 'http://localhost/api'

PNG_BYTES = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'


def upload_avatar():
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = bytearray()
    body.extend(f'--{boundary}\r\n'.encode('utf-8'))
    body.extend(b'Content-Disposition: form-data; name="bucket"\r\n\r\nprofile-pics\r\n')
    body.extend(f'--{boundary}\r\n'.encode('utf-8'))
    body.extend(b'Content-Disposition: form-data; name="file"; filename="avatar.png"\r\n')
    body.extend(b'Content-Type: image/png\r\n\r\n')
    body.extend(PNG_BYTES)
    body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))

    req = urllib.request.Request(
        f'{API_BASE}/files',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))['key']


def create_test_student(avatar_key):
    payload = {
        'student_id': 'TEST_AV01',
        'fullname': 'Sinh Viên Avatar Test',
        'dob': '2003-01-01',
        'major': 'Điện toán đám mây',
        'gpa': 3.8,
        'avatar_key': avatar_key
    }
    req = urllib.request.Request(
        f'{API_BASE}/students-db',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))['id']


def delete_test_student(student_id):
    req = urllib.request.Request(
        f'{API_BASE}/students-db/{student_id}',
        method='DELETE'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            pass
    except Exception:
        pass


def test_ui():
    print('=== BẮT ĐẦU KIỂM THỬ GIAO DIỆN STUDENT APP (PLAYWRIGHT) ===\n')

    # Tạo trước fixture sinh viên có avatar
    print('[Fixture] Upload avatar mẫu và tạo sinh viên kiểm thử có avatar...')
    avatar_key = upload_avatar()
    test_student_id = create_test_student(avatar_key)
    print(f'    PASS: Sinh viên test ID {test_student_id} tạo thành công kèm avatar_key {avatar_key}.\n')

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context_user = browser.new_context(viewport={'width': 1280, 'height': 800})
            page = context_user.new_page()

            print('[1] Điều hướng đến Student App...')
            page.goto(BASE_URL, wait_until='networkidle')
            assert 'Quản lý sinh viên' in page.title(), 'Tiêu đề không đúng'
            print('    PASS: Tải trang thành công.')

            # 1. Chuyển sang Tab Tài liệu
            print('[2] Chuyển sang tab Tài liệu (Lưu trữ PDF)...')
            page.click('button[data-tab="storage"]')
            page.wait_for_timeout(1000)
            page.wait_for_selector('#files-table-body tr', timeout=5000)
            print('    PASS: Tab Tài liệu hiển thị bảng file.')

            share_btn = page.query_selector('[data-action="share-file"]')
            unshare_btn = page.query_selector('[data-action="unshare-file"]')

            if not share_btn and unshare_btn:
                unshare_btn.click()
                page.wait_for_timeout(1000)
                share_btn = page.wait_for_selector('[data-action="share-file"]', timeout=5000)

            if share_btn:
                print('[3] Bấm nút Công khai trên tài liệu PDF...')
                page.click('[data-action="share-file"]')
                page.wait_for_timeout(1000)
                open_link = page.wait_for_selector('a[title="Mở trực tiếp link public MinIO"]', timeout=5000)
                public_url = open_link.get_attribute('href')
                print(f'    PASS: Nút công khai thành công, public URL: {public_url}')
                assert public_url.startswith(MINIO_URL), 'URL không trỏ vào MinIO public port 9000'
                assert 'X-Amz-Signature' not in public_url, 'URL không được chứa chữ ký'

                print('[4] Context ẩn danh tải trực tiếp tài liệu PDF...')
                incognito = browser.new_context()
                api_res = incognito.request.get(public_url)
                assert api_res.status == 200, f'HTTP {api_res.status} != 200'
                content_type = api_res.headers.get('content-type', '')
                print(f'    PASS: Tải PDF thành công, HTTP 200, Content-Type: {content_type}')
                incognito.close()

                print('[5] Bấm nút Bỏ công khai tài liệu...')
                page.click('[data-action="unshare-file"]')
                page.wait_for_timeout(1000)
                page.wait_for_selector('[data-action="share-file"]', timeout=5000)
                print('    PASS: Bỏ công khai tài liệu thành công.')

                print('[6] Context ẩn danh kiểm tra lại link PDF sau khi bỏ công khai...')
                incognito2 = browser.new_context()
                api_res2 = incognito2.request.get(public_url)
                assert api_res2.status in (403, 404), f'Trạng thái không mong đợi: {api_res2.status}'
                print(f'    PASS: Link public bị thu hồi quyền truy cập (HTTP {api_res2.status}).')
                incognito2.close()

            # 2. Kiểm thử Avatar trên Modal Chi tiết Sinh viên
            print('[7] Chuyển sang tab Sinh viên, tìm sinh viên có avatar vừa tạo...')
            page.click('button[data-tab="students"]')
            page.wait_for_timeout(1000)
            page.wait_for_selector('#students-table-body tr', timeout=5000)

            # Click nút Chi tiết của sinh viên test vừa tạo
            detail_btn = page.wait_for_selector(f'[data-action="detail"][data-id="{test_student_id}"]', timeout=5000)
            detail_btn.click()
            page.wait_for_selector('#modal-student-detail.show', timeout=5000)
            page.wait_for_timeout(1000)
            print('    PASS: Mở modal chi tiết sinh viên thành công.')

            # Kiểm tra xem có nút "Công khai avatar" không
            share_av_btn = page.wait_for_selector('#btn-share-avatar', timeout=5000)
            print('[8] Nhấn nút Công khai avatar...')
            share_av_btn.click()
            page.wait_for_timeout(1000)

            # Nút "Sao chép link" và "Mở ảnh" xuất hiện
            copy_av_btn = page.wait_for_selector('#btn-copy-avatar-link', timeout=5000)
            open_av_link = page.wait_for_selector('a[title="Mở ảnh trực tiếp từ MinIO"]', timeout=5000)
            av_public_url = open_av_link.get_attribute('href')
            print(f'    PASS: Công khai avatar thành công, URL: {av_public_url}')
            assert av_public_url.startswith(f'{MINIO_URL}/profile-pics/public/'), 'URL avatar không đúng định dạng MinIO'

            print('[9] Context ẩn danh tải trực tiếp ảnh Avatar qua public URL...')
            incognito_av = browser.new_context()
            res_av = incognito_av.request.get(av_public_url)
            assert res_av.status == 200, f'HTTP {res_av.status} != 200'
            assert res_av.headers.get('content-type', '').startswith('image/'), 'Content-type không phải image'
            print(f'    PASS: Cửa sổ ẩn danh xem ảnh đại diện thành công, HTTP 200, Content-Type: {res_av.headers.get("content-type")}')
            incognito_av.close()

            print('[10] Nhấn nút Bỏ công khai avatar trong modal...')
            page.click('#btn-unshare-avatar')
            page.wait_for_timeout(1000)
            page.wait_for_selector('#btn-share-avatar', timeout=5000)
            print('    PASS: Bỏ công khai avatar thành công, chuyển về Riêng tư.')

            print('[11] Context ẩn danh kiểm tra lại link avatar sau khi bỏ công khai...')
            incognito_av2 = browser.new_context()
            res_av2 = incognito_av2.request.get(av_public_url)
            assert res_av2.status in (403, 404), f'Trạng thái không mong đợi: {res_av2.status}'
            print(f'    PASS: Link avatar bị thu hồi quyền truy cập (HTTP {res_av2.status}).')
            incognito_av2.close()

            # Đóng modal
            page.click('[data-close-modal]')
            page.wait_for_timeout(500)

            browser.close()
            print('\n=== KIỂM THỬ GIAO DIỆN PLAYWRIGHT THÀNH CÔNG 100% ===')

    finally:
        print('[Cleanup] Dọn dẹp sinh viên kiểm thử...')
        delete_test_student(test_student_id)
        print('    PASS: Đã dọn dẹp fixture sạch sẽ.')


if __name__ == '__main__':
    test_ui()
