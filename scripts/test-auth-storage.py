"""Kiểm thử tích hợp thật; không in access token hoặc credential."""
import base64
import hashlib
import html
import os
import re
import secrets
from urllib.parse import parse_qs, urlparse

import requests
from minio.error import S3Error
from integrations import storage_client

proxy_base = os.environ.get('TEST_PUBLIC_BASE', '').rstrip('/')
api = proxy_base + '/api' if proxy_base else 'http://application-backend-server:8081'
auth = proxy_base or 'http://authentication-identity-server:8080'
realm = os.getenv('OIDC_REALM', 'MSSV_PLACEHOLDER')
public = os.getenv('PUBLIC_URL', 'http://localhost').rstrip('/')
count = 0


def check(name, condition):
    global count
    assert condition, name
    count += 1
    print('PASS:', name, flush=True)


check('Secure từ chối request không token', requests.get(api + '/secure', timeout=10).status_code == 401)
check('Secure từ chối token sai', requests.get(api + '/secure', headers={'Authorization': 'Bearer invalid'}, timeout=10).status_code == 401)
for username in ('sv01', 'sv02'):
    session = requests.Session()
    if proxy_base:
        session.headers['Host'] = urlparse(public).netloc
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
    state = secrets.token_urlsafe(24)
    redirect = public + '/app/'
    response = session.get(f'{auth}/auth/realms/{realm}/protocol/openid-connect/auth', params={
        'client_id': 'flask-app', 'redirect_uri': redirect, 'response_type': 'code',
        'scope': 'openid profile', 'state': state, 'code_challenge': challenge,
        'code_challenge_method': 'S256'}, timeout=15)
    response.raise_for_status()
    match = re.search(r'<form[^>]+action="([^"]+)"', response.text)
    check(f'{username}: Keycloak trả login form thật', match is not None)
    parsed_action = urlparse(html.unescape(match.group(1)))
    action = auth + parsed_action.path + '?' + parsed_action.query
    # Proxy test dùng URL nội bộ nhưng Host public: chuyển cookie cùng session
    # khi rewrite URL để mô phỏng đúng cùng origin mà trình duyệt nhìn thấy.
    login_headers = {'Cookie': '; '.join(f'{cookie.name}={cookie.value}' for cookie in session.cookies)} if proxy_base else {}
    login = session.post(action, data={'username': username, 'password': os.environ['DEMO_USER_PASSWORD'],
                                      'credentialId': ''}, headers=login_headers, allow_redirects=False, timeout=15)
    callback = parse_qs(urlparse(login.headers.get('Location', '')).query)
    if not callback.get('code'):
        feedback = re.search(r'kc-feedback-text[^>]*>([^<]*)', login.text)
        title = re.search(r'<title>([^<]*)', login.text)
        print('LOGIN_DIAGNOSTIC:', login.status_code,
              html.unescape(feedback.group(1) if feedback else title.group(1) if title else 'No feedback'),
              'cookie_names=' + ','.join(cookie.name for cookie in session.cookies), flush=True)
    check(f'{username}: login redirect có state/code', callback.get('state') == [state] and bool(callback.get('code')))
    exchange = session.post(f'{auth}/auth/realms/{realm}/protocol/openid-connect/token', data={
        'grant_type': 'authorization_code', 'client_id': 'flask-app', 'redirect_uri': redirect,
        'code': callback['code'][0], 'code_verifier': verifier}, timeout=15)
    check(f'{username}: trao đổi code PKCE thành công', exchange.status_code == 200)
    token = exchange.json()['access_token']
    secure = requests.get(api + '/secure', headers={'Authorization': 'Bearer ' + token}, timeout=10)
    check(f'{username}: JWT/JWKS issuer/audience hợp lệ', secure.status_code == 200 and secure.json()['preferred_username'] == username)
    parts = token.split('.')
    parts[2] = ('A' if parts[2][0] != 'A' else 'B') + parts[2][1:]
    check(f'{username}: sai chữ ký bị từ chối', requests.get(api + '/secure', headers={
        'Authorization': 'Bearer ' + '.'.join(parts)}, timeout=10).status_code == 401)

client = storage_client()
uploads = []
try:
    fixtures = [('documents', 'report.pdf', b'%PDF-1.4\n% Test document\n%%EOF', 'application/pdf'),
                ('profile-pics', 'avatar.png', base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII='), 'image/png')]
    for bucket, filename, data, mime in fixtures:
        uploaded = requests.post(api + '/files', data={'bucket': bucket}, files={'file': (filename, data, mime)}, timeout=15)
        check(f'{bucket}: upload file thật', uploaded.status_code == 201)
        key = uploaded.json()['key']
        uploads.append((bucket, key))
        check(f'{bucket}: object tồn tại và đúng size', client.stat_object(bucket, key).size == len(data))
        downloaded = requests.get(api + f'/files/{bucket}/{key}', timeout=15)
        check(f'{bucket}: download giữ nguyên byte', downloaded.status_code == 200 and downloaded.content == data)
        listed = requests.get(api + '/files', params={'bucket': bucket}, timeout=10)
        check(f'{bucket}: list có object đã upload', any(obj['key'] == key for obj in listed.json()['files']))
        anonymous = requests.get(f'http://object-storage-server:9000/{bucket}/{key}', timeout=10)
        check(f'{bucket}: bucket private chặn anonymous', anonymous.status_code == 403)
    invalid = requests.post(api + '/files', data={'bucket': 'documents'}, files={'file': ('fake.pdf', b'not-pdf', 'application/pdf')}, timeout=10)
    check('Từ chối file giả PDF', invalid.status_code == 415)
    check('Từ chối bucket ngoài whitelist', requests.get(api + '/files?bucket=secret', timeout=10).status_code == 400)
finally:
    for bucket, key in uploads:
        client.remove_object(bucket, key)
print(f'RESULT: {count} authentication/storage checks PASS')
