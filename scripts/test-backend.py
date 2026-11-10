"""Chạy trong app container qua stdin; không in credential hoặc token."""
import uuid
import requests

base = 'http://localhost:8081'
checks = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)


def call(method, path, **kwargs):
    return requests.request(method, base + path, timeout=15, **kwargs)


check('Health truy vấn SQL Server', call('GET', '/health').json()['database'] == 'healthy')
check('Hello endpoint', call('GET', '/hello').json()['message'] == 'Hello from App Server!')
check('JSON có đúng 5 sinh viên', len(call('GET', '/student').json()) == 5)
initial = call('GET', '/students-db').json()
check('SQL Server có tối thiểu 3 seed', isinstance(initial, list) and len(initial) >= 3)
check('Seed hỗ trợ Unicode tiếng Việt', any('Nguyễn' in row['fullname'] for row in initial))
record = {'student_id': 'T' + uuid.uuid4().hex[:8], 'fullname': 'Kiểm thử Nguyễn Ánh',
          'dob': '2004-01-02', 'major': 'Điện toán đám mây', 'gpa': 3.75}
created = call('POST', '/students-db', json=record)
check('POST tạo bản ghi thật', created.status_code == 201)
student_id = created.json()['id']
try:
    detail = call('GET', f'/students-db/{student_id}')
    check('GET chi tiết và Unicode roundtrip', detail.json()['fullname'] == record['fullname'])
    check('Search theo mã', any(r['id'] == student_id for r in call('GET', '/students-db', params={'q': record['student_id']}).json()))
    check('Search tên tiếng Việt', any(r['id'] == student_id for r in call('GET', '/students-db', params={'q': 'Nguyễn Ánh'}).json()))
    check('Chặn Student ID trùng', call('POST', '/students-db', json=record).status_code == 409)
    for field, value in [('fullname', ''), ('gpa', 4.1), ('gpa', True), ('dob', '2099-01-01'), ('student_id', "a' OR 1=1")]:
        invalid = dict(record, **{field: value})
        check(f'Validate {field}={value!r}', call('POST', '/students-db', json=invalid).status_code == 400)
    check('JSON sai kiểu bị từ chối', call('POST', '/students-db', json=[]).status_code == 400)
    check('Search SQL injection không làm lộ toàn bảng', call('GET', '/students-db', params={'q': "' OR 1=1 --"}).json() == [])
    record['fullname'] = 'Đã cập nhật Nguyễn Ánh'
    record['gpa'] = 4
    updated = call('PUT', f'/students-db/{student_id}', json=record)
    check('PUT cập nhật database', updated.status_code == 200 and updated.json()['fullname'] == record['fullname'])
    check('PUT record thiếu trả 404', call('PUT', '/students-db/2147483647', json=record).status_code == 404)
finally:
    deleted = call('DELETE', f'/students-db/{student_id}')
check('DELETE xóa bản ghi test', deleted.status_code == 200)
check('GET sau xóa trả 404', call('GET', f'/students-db/{student_id}').status_code == 404)
check('DELETE record thiếu trả 404', call('DELETE', f'/students-db/{student_id}').status_code == 404)
check('Chỉ xóa record test, seed được giữ', len(call('GET', '/students-db').json()) == len(initial))
print(f'RESULT: {len(checks)} checks PASS')
