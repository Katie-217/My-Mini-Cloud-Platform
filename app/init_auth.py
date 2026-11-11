"""Bootstrap Keycloak từ env local, không commit realm export chứa password."""
import os
import time

import requests

base = 'http://authentication-identity-server:8080/auth'
public = os.getenv('PUBLIC_URL', 'http://localhost').rstrip('/')
realm = os.getenv('OIDC_REALM', '521H0092-523H0065')
for attempt in range(90):
    try:
        response = requests.post(base + '/realms/master/protocol/openid-connect/token', data={
            'grant_type': 'password', 'client_id': 'admin-cli',
            'username': os.environ['KEYCLOAK_ADMIN'], 'password': os.environ['KEYCLOAK_ADMIN_PASSWORD']}, timeout=5)
        if response.ok:
            break
    except requests.RequestException:
        pass
    time.sleep(2)
else:
    raise RuntimeError('Keycloak bootstrap không sẵn sàng sau thời gian chờ.')
session = requests.Session()
session.headers['Authorization'] = 'Bearer ' + response.json()['access_token']
root = base + '/admin/realms'
if session.get(f'{root}/{realm}', timeout=10).status_code == 404:
    created = session.post(root, json={'realm': realm, 'enabled': True, 'sslRequired': 'none',
                                      'registrationAllowed': False, 'resetPasswordAllowed': False}, timeout=10)
    created.raise_for_status()
client_url = f'{root}/{realm}/clients'
clients = session.get(client_url, params={'clientId': 'flask-app'}, timeout=10)
clients.raise_for_status()
config = {'clientId': 'flask-app', 'enabled': True, 'publicClient': True,
          'standardFlowEnabled': True, 'directAccessGrantsEnabled': False,
          'redirectUris': [public + '/app/*'], 'webOrigins': [public],
          'attributes': {'pkce.code.challenge.method': 'S256',
                         'post.logout.redirect.uris': public + '/app/'},
          'protocolMappers': [{'name': 'flask-audience', 'protocol': 'openid-connect',
                              'protocolMapper': 'oidc-audience-mapper', 'config': {
                                  'included.client.audience': 'flask-app', 'access.token.claim': 'true',
                                  'id.token.claim': 'false'}}]}
if not clients.json():
    session.post(client_url, json=config, timeout=10).raise_for_status()
else:
    session.put(client_url + '/' + clients.json()[0]['id'], json=config, timeout=10).raise_for_status()
for username in ('sv01', 'sv02'):
    users_url = f'{root}/{realm}/users'
    found = session.get(users_url, params={'username': username, 'exact': 'true'}, timeout=10)
    found.raise_for_status()
    if not found.json():
        user = {'username': username, 'enabled': True, 'emailVerified': True,
                'firstName': 'Sinh viên', 'lastName': username, 'email': username + '@example.invalid',
                'credentials': [{'type': 'password', 'value': os.environ['DEMO_USER_PASSWORD'], 'temporary': False}]}
        session.post(users_url, json=user, timeout=10).raise_for_status()
print('PASS: Keycloak realm, flask-app PKCE và 2 demo users đã sẵn sàng.')
