"""Real anonymous S3 access and revocation; clean only this run's own fixtures."""
import hashlib
import json
import sys
from urllib.parse import urlsplit

import requests

from storage_test_helpers import API, MINIO, PDF, PNG, Fixtures, ROOT, container_python

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
checks = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)


with Fixtures() as fixtures:
    for bucket, name, mime, data in [('documents', 'public-test.pdf', 'application/pdf', PDF),
                                     ('profile-pics', 'public-test.png', 'image/png', PNG)]:
        uploaded = fixtures.upload(bucket, data, name, mime)
        key = uploaded['key']
        payload = {'bucket': bucket, 'key': key}
        check(bucket + ': upload starts private', uploaded['is_public'] is False and uploaded['public_url'] is None)
        check(bucket + ': original object anonymous GET denied', requests.get(f'{MINIO}/{bucket}/{key}', timeout=10).status_code == 403)
        response = requests.post(API + '/files/share', json=payload, timeout=15)
        check(bucket + ': share API succeeds', response.status_code == 200 and response.json()['is_public'] is True)
        url = response.json()['public_url']
        check(bucket + ': direct public URL has no signature or expiry', url == f'{MINIO}/{bucket}/public/{key}' and not urlsplit(url).query)
        downloaded = requests.get(url, timeout=15)
        check(bucket + ': anonymous public GET HTTP 200', downloaded.status_code == 200)
        check(bucket + ': anonymous bytes/SHA256 unchanged', hashlib.sha256(downloaded.content).digest() == hashlib.sha256(data).digest())
        check(bucket + ': content type retained, no-store supports revocation', downloaded.headers.get('Content-Type', '').startswith(mime)
              and downloaded.headers.get('Cache-Control') == 'no-store')
        check(bucket + ': original remains private after sharing', requests.get(f'{MINIO}/{bucket}/{key}', timeout=10).status_code == 403)
        check(bucket + ': anonymous bucket listing denied', requests.get(f'{MINIO}/{bucket}?list-type=2', timeout=10).status_code == 403)
        check(bucket + ': anonymous overwrite denied', requests.put(url, data=b'blocked', timeout=10).status_code == 403)
        check(bucket + ': anonymous deletion denied', requests.delete(url, timeout=10).status_code == 403)
        check(bucket + ': denied writes preserve public bytes', requests.get(url, timeout=10).content == data)
        check(bucket + ': repeated share is idempotent', requests.post(API + '/files/share', json=payload, timeout=15).status_code == 200)
        names = json.loads(container_python('import json,sys; from integrations import storage_client; '
            'print(json.dumps([o.object_name for o in storage_client().list_objects(sys.argv[1],prefix="public/"+sys.argv[2],recursive=True)]))', bucket, key))
        check(bucket + ': exactly one public copy', names == ['public/' + key])
        listed = requests.get(API + '/files', params={'bucket': bucket}, timeout=15).json()['files']
        matched = [obj for obj in listed if obj['key'] == key]
        check(bucket + ': listing has one original and no public duplicate', len(matched) == 1
              and matched[0]['is_public'] is True and matched[0]['public_url'] == url
              and not any(obj['key'].startswith('public/') for obj in listed))
        status = requests.get(API + '/files/status', params=payload, timeout=15)
        check(bucket + ': status confirms public', status.status_code == 200 and status.json()['is_public'] is True)
        method, endpoint = (requests.post, '/files/unshare') if bucket == 'documents' else (requests.delete, '/files/share')
        response = method(API + endpoint, json=payload, timeout=15)
        check(bucket + ': unshare API succeeds', response.status_code == 200 and response.json()['is_public'] is False)
        check(bucket + ': public URL revoked', requests.get(url, timeout=10).status_code in (403, 404))
        check(bucket + ': private original still downloads unchanged', requests.get(API + uploaded['download_url'].removeprefix('/api'), timeout=15).content == data)
        check(bucket + ': unshare repeated safely', method(API + endpoint, json=payload, timeout=15).status_code == 200)

    for endpoint, method in [('/files/share', requests.post), ('/files/unshare', requests.post), ('/files/share', requests.delete)]:
        for payload in ([], [1], 'bad', 123, None):
            response = method(API + endpoint, data=json.dumps(payload), headers={'Content-Type': 'application/json'}, timeout=10)
            check(endpoint + ': reject non-object JSON ' + repr(payload), response.status_code == 400 and 'error' in response.json())
        response = method(API + endpoint, data='{', headers={'Content-Type': 'application/json'}, timeout=10)
        check(endpoint + ': reject malformed JSON', response.status_code == 400 and 'error' in response.json())
    for payload in ({'bucket': 'bad', 'key': key}, {'bucket': 'documents', 'key': '../bad'},
                    {'bucket': 'documents', 'key': 'public/x.pdf'}):
        response = requests.post(API + '/files/share', json=payload, timeout=10)
        check('Reject invalid bucket/key', response.status_code == 400)
    response = requests.post(API + '/files/share', json={'bucket': 'documents', 'key': 'missing-fixture.pdf'}, timeout=10)
    check('Missing original returns 404', response.status_code == 404)

# Failure injection is limited to a separate Python test process; no service is stopped.
failure_test = '''
from unittest.mock import Mock, patch
from minio.error import S3Error
from app import app
import integrations
c = app.test_client()
error = S3Error(None, 'AccessDenied', 'test', None, None, None)
storage = Mock()
storage.remove_object.side_effect = error
with patch.object(integrations, 'storage_client', return_value=storage):
    r = c.post('/files/unshare', json={'bucket':'documents','key':'fixture.pdf'})
    assert r.status_code == 503, 'Failed deletion must not claim private'
storage = Mock()
storage.stat_object.side_effect = [Mock(), error]
with patch.object(integrations, 'storage_client', return_value=storage):
    r = c.get('/files/status?bucket=documents&key=fixture.pdf')
    assert r.status_code == 503, 'Failed status must not claim private'
print('failure guards passed')
'''
check('Delete/status failures return 503 instead of false private success', 'failure guards passed' in container_python(failure_test))
target = ROOT / '.runtime/public-storage'
target.mkdir(parents=True, exist_ok=True)
(target / 'api-result.json').write_text(json.dumps({'checks_passed': len(checks), 'checks': checks,
    'fixture_cleanup': True}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'RESULT: {len(checks)} public storage checks PASS; owned fixtures cleaned.')
