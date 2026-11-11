"""Owned fixtures for MinIO tests; never select or alter a user's existing file."""
import base64
import json
import os
import subprocess
import uuid
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = os.getenv('TEST_PUBLIC_BASE', 'http://localhost').rstrip('/')
API = BASE + '/api'
MINIO = os.getenv('MINIO_PUBLIC_URL', 'http://localhost:9000').rstrip('/')
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=')


def pdf_bytes():
    content = b'BT /F1 18 Tf 40 240 Td (MyMiniCloud public file demo) Tj ET\n'
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
               b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'endstream',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    data, offsets = b'%PDF-1.4\n', []
    for number, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f'{number} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(data)
    data += b'xref\n0 6\n0000000000 65535 f \n'
    data += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets)
    return data + b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + str(xref).encode() + b'\n%%EOF\n'


PDF = pdf_bytes()


def container_python(code, *args):
    result = subprocess.run(['docker', 'compose', '-f', str(ROOT / 'docker-compose.yml'), '-p', 'mycloud',
                             'exec', '-T', '-e', 'PYTHONPATH=/app', 'application-backend-server',
                             'python', '-c', code, *args], cwd=ROOT, capture_output=True, text=True,
                            encoding='utf-8', timeout=90)
    if result.returncode:
        raise RuntimeError('Container verification failed: ' + result.stderr[-2500:])
    return result.stdout


class Fixtures:
    def __init__(self):
        self.objects = []
        self.students = []

    def __enter__(self):
        return self

    def track(self, bucket, key):
        self.objects.append((bucket, key))
        return key

    def upload(self, bucket, data, name, mime):
        response = requests.post(API + '/files', data={'bucket': bucket}, files={'file': (name, data, mime)}, timeout=15)
        response.raise_for_status()
        self.track(bucket, response.json()['key'])
        return response.json()

    def student(self, avatar_key):
        code = 'U' + uuid.uuid4().hex[:8]
        response = requests.post(API + '/students-db', json={'student_id': code,
            'fullname': 'Kiểm thử chia sẻ avatar', 'dob': '2004-01-02', 'major': 'Điện toán đám mây',
            'gpa': 3.8, 'avatar_key': avatar_key}, timeout=15)
        response.raise_for_status()
        self.students.append((response.json()['id'], code))
        return response.json()

    def __exit__(self, *exception):
        try:
            for student_id, code in self.students:
                response = requests.get(API + f'/students-db/{student_id}', timeout=15)
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                if response.json()['student_id'] != code:
                    raise RuntimeError('Refusing to delete an unowned student fixture.')
                requests.delete(API + f'/students-db/{student_id}', timeout=15).raise_for_status()
        finally:
            if self.objects:
                container_python('import sys,json; from integrations import storage_client; c=storage_client(); '
                    '[(c.remove_object(b,"public/"+k),c.remove_object(b,k)) for b,k in json.loads(sys.argv[1])]',
                    json.dumps(self.objects))
