"""Test gateway từ host bằng Python stdlib; chỉ dọn record do test tạo."""
import json
import os
import sys
import uuid
from collections import Counter
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
base = os.environ.get('TEST_URL', 'http://localhost').rstrip('/')
count = 0


def call(path, method='GET', payload=None):
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
    req = Request(base + path, data=data, method=method,
                  headers={'Content-Type': 'application/json'} if data else {})
    try:
        response = urlopen(req, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


def check(name, condition):
    global count
    assert condition, name
    count += 1
    print('PASS:', name, flush=True)


check('Gateway host port 80 phục vụ health', call('/health')[0] == 200)
check('API strip prefix đúng /hello', json.loads(call('/api/hello')[2])['message'] == 'Hello from App Server!')
reference = json.loads(call('/api/student')[2])
check('JSON student đúng 5 mẫu', len(reference) == 5)
for alias in ('/student', '/student/'):
    check('Alias ' + alias, json.loads(call(alias)[2]) == reference)
health = json.loads(call('/api/health')[2])
check('API qua proxy kết nối SQL Server', health['database'] == 'healthy')
body = {'student_id': 'R' + uuid.uuid4().hex[:8], 'fullname': 'Thử qua cổng Nginx',
        'dob': '2004-01-15', 'major': 'Điện toán đám mây', 'gpa': 3.2}
created = call('/api/students-db', 'POST', body)
check('POST qua proxy', created[0] == 201)
student_id = json.loads(created[2])['id']
try:
    detail = json.loads(call(f'/api/students-db/{student_id}')[2])
    check('GET giữ Unicode qua Nginx/Flask/ODBC/SQL', detail['fullname'] == body['fullname'])
    check('Query string search giữ nguyên', any(x['id'] == student_id for x in json.loads(call('/api/students-db?q=' + body['student_id'])[2])))
    body['gpa'] = 3.9
    updated = call(f'/api/students-db/{student_id}', 'PUT', body)
    check('PUT qua proxy', updated[0] == 200 and json.loads(updated[2])['gpa'] == 3.9)
finally:
    deleted = call(f'/api/students-db/{student_id}', 'DELETE')
check('DELETE qua proxy', deleted[0] == 200)
check('404 sau xóa', call(f'/api/students-db/{student_id}')[0] == 404)
check('Thiếu token bị 401 qua proxy', call('/api/secure')[0] == 401)
config = json.loads(call('/api/auth/config')[2])
discovery = json.loads(call(urlsplit(config['issuer']).path + '/.well-known/openid-configuration')[2])
check('OIDC issuer public thống nhất', discovery['issuer'] == config['issuer'])
replicas = []
for _ in range(20):
    status, headers, data = call('/__replica')
    check('Replica endpoint/header hợp lệ', status == 200 and json.loads(data)['replica'] == headers.get('X-Web-Server'))
    replicas.append(headers['X-Web-Server'])
distribution = Counter(replicas)
check('Round Robin phân phối qua cả 2 server', set(distribution) == {'web-frontend-server1', 'web-frontend-server2'})
check('Round Robin đều trong chuỗi request riêng', abs(distribution['web-frontend-server1'] - distribution['web-frontend-server2']) <= 2)
print('DISTRIBUTION:', dict(distribution))
status = json.loads(call('/api/status')[2])
check('12 probe dịch vụ reachable qua gateway', status['overall'] == 'healthy' and status['services_reachable'] == 12)
metrics = json.loads(call('/api/metrics-summary')[2])
check('Portal nhận CPU/RAM/network thật qua proxy', metrics['status'] == 'healthy' and metrics['cpu_percent'] is not None)
for path in ('/', '/blog/', '/app/'):
    result = call(path)
    if '--frontend-ready' in sys.argv:
        check('Giao diện đã ghép ' + path, result[0] == 200 and bool(result[2]))
    else:
        check('Giao diện chờ ghép trả 503 trung thực ' + path, result[0] == 503)
print(f'RESULT: {count} gateway checks PASS; frontend UI chưa được nghiệm thu nếu không có --frontend-ready.')
