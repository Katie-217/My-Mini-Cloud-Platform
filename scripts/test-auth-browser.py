"""Đăng nhập Keycloak qua localhost thật bằng Edge headless; không log token."""
import base64
import hashlib
import secrets
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

import requests
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
config = dict(line.split('=', 1) for line in (root / '.env').read_text(encoding='utf-8-sig').splitlines()
              if line.strip() and not line.startswith('#') and '=' in line)
public = config.get('PUBLIC_URL', 'http://localhost').rstrip('/')
realm = config.get('OIDC_REALM', 'MSSV_PLACEHOLDER')
issuer = f'{public}/auth/realms/{realm}'
evidence = root / '.runtime' / 'browser-evidence'
evidence.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    try:
        for username in ('sv01', 'sv02'):
            context = browser.new_context(viewport={'width': 1280, 'height': 800})
            page = context.new_page()
            # Frontend Gemini chưa ghép; chỉ chặn callback sau khi Keycloak đã
            # xác thực thật, vẫn test login/cookie/code/token qua gateway thật.
            page.route(public + '/app/**', lambda route: route.fulfill(
                status=200, content_type='text/plain', body='OIDC callback received for verification'))
            verifier = secrets.token_urlsafe(48)
            challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
            state = secrets.token_urlsafe(24)
            redirect = public + '/app/'
            query = urlencode({'client_id': 'flask-app', 'response_type': 'code', 'scope': 'openid profile',
                               'redirect_uri': redirect, 'state': state,
                               'code_challenge': challenge, 'code_challenge_method': 'S256'})
            page.goto(issuer + '/protocol/openid-connect/auth?' + query, wait_until='domcontentloaded')
            page.locator('#username').wait_for()
            if username == 'sv01':
                page.screenshot(path=str(evidence / 'keycloak-login.png'), full_page=True)
            page.locator('#username').fill(username)
            page.locator('#password').fill(config['DEMO_USER_PASSWORD'])
            page.locator('#kc-login').click()
            page.wait_for_url(public + '/app/**', timeout=20000)
            callback = parse_qs(urlsplit(page.url).query)
            assert callback.get('state') == [state] and callback.get('code'), 'Callback state/code không hợp lệ'
            response = requests.post(issuer + '/protocol/openid-connect/token', data={
                'grant_type': 'authorization_code', 'client_id': 'flask-app', 'redirect_uri': redirect,
                'code': callback['code'][0], 'code_verifier': verifier}, timeout=15)
            assert response.status_code == 200, 'Token exchange qua public proxy thất bại'
            token = response.json()['access_token']
            secure = requests.get(public + '/api/secure', headers={'Authorization': 'Bearer ' + token}, timeout=10)
            assert secure.status_code == 200 and secure.json()['preferred_username'] == username
            print(f'PASS: Edge localhost login {username}, cookie, state, PKCE, JWT và secure API qua proxy.')
            context.close()
    finally:
        browser.close()
print('NOT TESTED: JavaScript callback/login/logout của Student frontend chờ Gemini bàn giao.')
