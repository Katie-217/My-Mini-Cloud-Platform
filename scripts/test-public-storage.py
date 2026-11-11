"""Kiểm thử tính năng chia sẻ URL public trực tiếp từ MinIO cho MyMiniCloud."""
import hashlib
import json
import sys
import urllib.error
import urllib.request

API_BASE = 'http://localhost/api'
MINIO_BASE = 'http://localhost:9000'

# Tạo dữ liệu test
PNG_BYTES = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
PDF_BYTES = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n164\n%%EOF\n'

PNG_SHA = hashlib.sha256(PNG_BYTES).hexdigest()
PDF_SHA = hashlib.sha256(PDF_BYTES).hexdigest()

test_results = []


def record(name, passed, detail=''):
    test_results.append((name, passed, detail))
    status = 'PASS' if passed else 'FAIL'
    print(f'[{status}] {name}{f": {detail}" if detail else ""}')


def upload_multipart(bucket, filename, file_bytes, content_type):
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    body = bytearray()
    body.extend(f'--{boundary}\r\n'.encode('utf-8'))
    body.extend(f'Content-Disposition: form-data; name="bucket"\r\n\r\n{bucket}\r\n'.encode('utf-8'))
    body.extend(f'--{boundary}\r\n'.encode('utf-8'))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode('utf-8'))
    body.extend(f'Content-Type: {content_type}\r\n\r\n'.encode('utf-8'))
    body.extend(file_bytes)
    body.extend(f'\r\n--{boundary}--\r\n'.encode('utf-8'))

    req = urllib.request.Request(
        f'{API_BASE}/files',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))


def anonymous_request(url, method='GET', data=None):
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as err:
        return err.code, err.read(), dict(err.headers)
    except Exception as exc:
        return 0, str(exc).encode('utf-8'), {}


def post_json(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as err:
        try:
            body = json.loads(err.read().decode('utf-8'))
        except Exception:
            body = {}
        return err.code, body


def main():
    print('=== BẮT ĐẦU KIỂM THỬ MINIO PUBLIC OBJECT LINKS ===\n')

    # 1. Upload PNG và PDF
    try:
        doc_res = upload_multipart('documents', 'test-doc.pdf', PDF_BYTES, 'application/pdf')
        doc_key = doc_res['key']
        record('Upload PDF vao documents', True, f'Key: {doc_key}')
    except Exception as e:
        record('Upload PDF vao documents', False, str(e))
        return

    try:
        pic_res = upload_multipart('profile-pics', 'test-avatar.png', PNG_BYTES, 'image/png')
        pic_key = pic_res['key']
        record('Upload PNG vao profile-pics', True, f'Key: {pic_key}')
    except Exception as e:
        record('Upload PNG vao profile-pics', False, str(e))
        return

    # 2. Object gốc chưa công khai: anonymous GET trả 403 Forbidden
    status_doc, _, _ = anonymous_request(f'{MINIO_BASE}/documents/{doc_key}')
    record('Anonymous GET object goc documents chua cong khai tra 403', status_doc == 403, f'HTTP {status_doc}')

    status_pic, _, _ = anonymous_request(f'{MINIO_BASE}/profile-pics/{pic_key}')
    record('Anonymous GET object goc profile-pics chua cong khai tra 403', status_pic == 403, f'HTTP {status_pic}')

    # 3. Anonymous không thể list bucket, put object hoặc delete object
    status_list, _, _ = anonymous_request(f'{MINIO_BASE}/documents')
    record('Anonymous ListBucket bi cam tra 403', status_list == 403, f'HTTP {status_list}')

    status_put, _, _ = anonymous_request(f'{MINIO_BASE}/documents/public/hacker.txt', method='PUT', data=b'evil')
    record('Anonymous PutObject bi cam tra 403', status_put == 403, f'HTTP {status_put}')

    status_del, _, _ = anonymous_request(f'{MINIO_BASE}/documents/public/test.pdf', method='DELETE')
    record('Anonymous DeleteObject bi cam tra 403', status_del == 403, f'HTTP {status_del}')

    # 4. Công khai object: POST /api/files/share
    share_status, share_data = post_json(f'{API_BASE}/files/share', {'bucket': 'documents', 'key': doc_key})
    doc_pub_url = share_data.get('public_url', '')
    is_pub = share_data.get('is_public') is True
    no_sig = ('X-Amz-Signature' not in doc_pub_url) and ('X-Amz-Expires' not in doc_pub_url)
    record('API POST /api/files/share tra ve 200 va is_public=True', share_status == 200 and is_pub)
    record('URL public khong chua chu ky hoac thoi han', no_sig, doc_pub_url)

    # 5. Anonymous GET URL MinIO công khai: trả về 200 và SHA256 khớp 100%
    get_status, get_body, get_headers = anonymous_request(doc_pub_url)
    get_sha = hashlib.sha256(get_body).hexdigest()
    record('Anonymous GET URL public tra HTTP 200', get_status == 200, f'HTTP {get_status}')
    record('Anonymous GET URL public dung byte va SHA256 goc', get_sha == PDF_SHA, f'SHA khớp: {get_sha[:16]}...')

    # Công khai avatar PNG
    share_pic_st, share_pic_data = post_json(f'{API_BASE}/files/share', {'bucket': 'profile-pics', 'key': pic_key})
    pic_pub_url = share_pic_data.get('public_url', '')
    pic_st, pic_body, _ = anonymous_request(pic_pub_url)
    pic_sha = hashlib.sha256(pic_body).hexdigest()
    record('Anonymous GET Avatar public tra HTTP 200 va dung SHA256', pic_st == 200 and pic_sha == PNG_SHA)

    # 6. Công khai lặp lại không tạo bản sao dư thừa (idempotent)
    share2_st, share2_data = post_json(f'{API_BASE}/files/share', {'bucket': 'documents', 'key': doc_key})
    record('Cong khai lap lai tra 200 idempotent', share2_st == 200 and share2_data.get('is_public') is True)

    # 7. Danh sách file (GET /api/files) không hiển thị bản sao public/ trùng lặp
    req_list = urllib.request.Request(f'{API_BASE}/files?bucket=documents')
    with urllib.request.urlopen(req_list, timeout=5) as r:
        list_data = json.loads(r.read().decode('utf-8'))
    doc_items = [f for f in list_data.get('files', []) if f['key'] == doc_key]
    public_items = [f for f in list_data.get('files', []) if f['key'].startswith('public/')]
    record('Danh sach files khong chua ban sao public/', len(public_items) == 0, f'Số item public/: {len(public_items)}')
    record('Object goc co is_public=True va public_url trong danh sach', len(doc_items) == 1 and doc_items[0].get('is_public') is True)

    # 8. Validation: bucket sai, key sai, key không tồn tại
    err_b_st, _ = post_json(f'{API_BASE}/files/share', {'bucket': 'wrong_bucket', 'key': doc_key})
    record('Bucket sai tra 400', err_b_st == 400, f'HTTP {err_b_st}')

    err_k_st, _ = post_json(f'{API_BASE}/files/share', {'bucket': 'documents', 'key': '../escape/path'})
    record('Key chua duong dan thu muc tra 400', err_k_st == 400, f'HTTP {err_k_st}')

    err_nf_st, _ = post_json(f'{API_BASE}/files/share', {'bucket': 'documents', 'key': 'non_existent_file.pdf'})
    record('Key khong ton tai tra 404', err_nf_st == 404, f'HTTP {err_nf_st}')

    # 9. Bỏ công khai: link public không còn đọc được; object gốc vẫn tải được
    unshare_st, unshare_data = post_json(f'{API_BASE}/files/unshare', {'bucket': 'documents', 'key': doc_key})
    record('API POST /api/files/unshare tra 200 va is_public=False', unshare_st == 200 and unshare_data.get('is_public') is False)

    unshare_pic_st, _ = post_json(f'{API_BASE}/files/unshare', {'bucket': 'profile-pics', 'key': pic_key})
    record('Bo cong khai avatar tra 200', unshare_pic_st == 200)

    # Anonymous GET tới link public sau khi unshare: 404 hoặc 403
    pub_after_st, _, _ = anonymous_request(doc_pub_url)
    record('Link public sau khi bo cong khai khong doc duoc (404/403)', pub_after_st in (403, 404), f'HTTP {pub_after_st}')

    # Tải lại file gốc qua backend download_url: Phải thành công và SHA256 khớp
    backend_dl_url = f'{API_BASE}/files/documents/{doc_key}'
    req_dl = urllib.request.Request(backend_dl_url)
    with urllib.request.urlopen(req_dl, timeout=5) as r_dl:
        backend_bytes = r_dl.read()
    record('Object goc van tai duoc qua backend voi SHA256 khop', hashlib.sha256(backend_bytes).hexdigest() == PDF_SHA)

    print('\n=== TỔNG HỢP KẾT QUẢ KIỂM THỬ ===')
    total = len(test_results)
    passed = sum(1 for _, p, _ in test_results if p)
    print(f'Kết quả: {passed}/{total} bài kiểm tra PASS.')
    if passed != total:
        print('CẢNH BÁO: Có bài kiểm tra không đạt!')
        sys.exit(1)
    else:
        print('TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ PASS HOÀN TOÀN!')


if __name__ == '__main__':
    main()
