"""Hai pha trước/sau restart SQL Server; chỉ xóa record do chính test tạo."""
import json
import sys
import time
import uuid
from pathlib import Path

import requests

base = 'http://localhost:8081'
marker = Path('/tmp/mycloud-persistence-marker.json')
if sys.argv[1] == 'create':
    if marker.exists():
        raise RuntimeError('Marker cũ tồn tại; cần kiểm tra trước khi tạo test mới.')
    payload = {'student_id': 'P' + uuid.uuid4().hex[:8], 'fullname': 'Kiểm thử lưu bền vững',
               'dob': '2004-03-12', 'major': 'Điện toán đám mây', 'gpa': 3.5}
    response = requests.post(base + '/students-db', json=payload, timeout=10)
    response.raise_for_status()
    marker.write_text(json.dumps(response.json()), encoding='utf-8')
    print('PASS: Tạo bản ghi persistence qua Flask API.')
else:
    expected = json.loads(marker.read_text(encoding='utf-8'))
    for attempt in range(60):
        try:
            response = requests.get(base + '/health', timeout=6)
            if response.status_code == 200:
                break
        except requests.RequestException:
            pass
        time.sleep(2)
    else:
        raise AssertionError('Database không phục hồi sau restart.')
    response = requests.get(base + f"/students-db/{expected['id']}", timeout=10)
    response.raise_for_status()
    assert all(response.json().get(key) == value for key, value in expected.items()), 'Bản ghi không giống trước restart.'
    print('PASS: SQL Server restart giữ nguyên bản ghi, Unicode và timestamp.')
    removed = requests.delete(base + f"/students-db/{expected['id']}", timeout=10)
    removed.raise_for_status()
    marker.unlink()
    print('PASS: Chỉ xóa bản ghi persistence do test tạo.')
