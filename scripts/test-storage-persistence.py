"""Fixture nhỏ qua API, kiểm tra sau recreate MinIO, chỉ dọn object test."""
import base64
import json
import sys
import time
from pathlib import Path

import requests
from integrations import storage_client

base = 'http://localhost:8081'
marker = Path('/tmp/mycloud-storage-persistence.json')
if sys.argv[1] == 'create':
    if marker.exists():
        raise RuntimeError('Marker test cũ tồn tại; không ghi đè.')
    fixtures = [
        ('documents', 'persistence.pdf', b'%PDF-1.4\n% persistent fixture\n%%EOF', 'application/pdf'),
        ('profile-pics', 'persistence.png', base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII='), 'image/png'),
    ]
    objects = []
    for bucket, filename, data, mime in fixtures:
        response = requests.post(base + '/files', data={'bucket': bucket},
                                 files={'file': (filename, data, mime)}, timeout=15)
        response.raise_for_status()
        objects.append({'bucket': bucket, 'key': response.json()['key'],
                        'data': base64.b64encode(data).decode()})
        marker.write_text(json.dumps(objects), encoding='utf-8')
    print('PASS: Tạo PDF và PNG qua Flask vào hai bucket private.')
else:
    objects = json.loads(marker.read_text(encoding='utf-8'))
    assert len(objects) == 2
    for item in objects:
        for attempt in range(60):
            try:
                response = requests.get(base + f'/files/{item["bucket"]}/{item["key"]}', timeout=6)
                if response.status_code == 200:
                    break
            except requests.RequestException:
                pass
            time.sleep(1)
        else:
            raise AssertionError('Không đọc lại được object sau recreate; giữ marker để điều tra.')
        assert response.content == base64.b64decode(item['data'])
        print(f'PASS: {item["bucket"]} giữ nguyên object bytes sau recreate MinIO.')
    client = storage_client()
    for item in objects:
        client.remove_object(item['bucket'], item['key'])
    marker.unlink()
    print('PASS: Chỉ xóa hai object persistence do test tạo.')
