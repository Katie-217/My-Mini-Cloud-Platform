"""OIDC và S3 thật; không chứa password hoặc token cố định."""
import io
import os
import re
import uuid
from urllib.parse import quote, urlsplit

import jwt
from flask import Blueprint, Response, jsonify, request, stream_with_context
from minio import Minio
from minio.commonconfig import CopySource
from minio.error import S3Error

integrations = Blueprint('integrations', __name__)
PUBLIC_URL = os.getenv('PUBLIC_URL', 'http://localhost').rstrip('/')
MINIO_PUBLIC_URL = os.getenv('MINIO_PUBLIC_URL', 'http://localhost:9000').rstrip('/')
_public_endpoint = urlsplit(MINIO_PUBLIC_URL)
if (_public_endpoint.scheme not in ('http', 'https') or not _public_endpoint.hostname
        or _public_endpoint.username or _public_endpoint.password
        or _public_endpoint.path or _public_endpoint.query or _public_endpoint.fragment):
    raise ValueError('MINIO_PUBLIC_URL phải là endpoint HTTP/HTTPS, không chứa credential, path hoặc query.')
_public_endpoint.port  # Validate a configured port before serving links.
REALM = os.getenv('OIDC_REALM', '521H0092-523H0065')
ISSUER = f'{PUBLIC_URL}/auth/realms/{REALM}'
AUTH_INTERNAL = 'http://authentication-identity-server:8080/auth'
JWKS = jwt.PyJWKClient(f'{AUTH_INTERNAL}/realms/{REALM}/protocol/openid-connect/certs', timeout=5)


def storage_client():
    return Minio('object-storage-server:9000', access_key=os.environ['MINIO_ROOT_USER'],
                 secret_key=os.environ['MINIO_ROOT_PASSWORD'], secure=False)


def validate_bucket(bucket):
    if bucket not in ('profile-pics', 'documents'):
        raise ValueError('Bucket chỉ được là profile-pics hoặc documents.')
    return bucket


def validate_object_key(key):
    if not key or not isinstance(key, str) or len(key) > 250:
        raise ValueError('Object key không hợp lệ.')
    if key.startswith('public/') or '/' in key or '\\' in key:
        raise ValueError('Object key không được chứa đường dẫn thư mục.')
    if not re.fullmatch(r'[A-Za-z0-9_.-]{1,250}', key):
        raise ValueError('Object key chỉ gồm chữ cái, chữ số, gạch dưới, gạch nối hoặc dấu chấm.')
    return key


def get_public_url(bucket, key):
    return f'{MINIO_PUBLIC_URL}/{bucket}/public/{quote(key, safe="")}'


def is_object_public(client, bucket, key):
    try:
        client.stat_object(bucket, f'public/{key}')
        return True
    except S3Error as error:
        if error.code in ('NoSuchKey', 'NoSuchObject'):
            return False
        raise


def sharing_request():
    data = request.get_json() if request.is_json else None
    if not isinstance(data, dict):
        raise ValueError('Body phải là JSON object chứa bucket và key.')
    return data


@integrations.get('/auth/config')
def auth_config():
    endpoint = ISSUER + '/protocol/openid-connect/'
    return jsonify(issuer=ISSUER, client_id='flask-app', authorization_endpoint=endpoint + 'auth',
                   token_endpoint=endpoint + 'token', end_session_endpoint=endpoint + 'logout')


@integrations.get('/secure')
def secure():
    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        return jsonify(error='Cần Bearer token từ Keycloak.'), 401
    token = authorization[7:]
    if len(token) > 16384:
        return jsonify(error='Token không hợp lệ.'), 401
    try:
        key = JWKS.get_signing_key_from_jwt(token)
        payload = jwt.decode(token, key.key, algorithms=['RS256'], audience='flask-app',
                             issuer=ISSUER, options={'require': ['exp', 'iss', 'aud', 'sub']})
    except (jwt.PyJWTError, ValueError):
        return jsonify(error='Token không hợp lệ hoặc đã hết hạn.'), 401
    return jsonify(message='Secure resource OK', preferred_username=payload.get('preferred_username'), subject=payload['sub'])


@integrations.get('/files')
def list_files():
    bucket = validate_bucket(request.args.get('bucket', 'documents'))
    client = storage_client()

    public_keys = {obj.object_name[len('public/'):] for obj in
                   client.list_objects(bucket, prefix='public/', recursive=True)}

    files = []
    for obj in client.list_objects(bucket):
        if obj.is_dir or obj.object_name.startswith('public/'):
            continue
        is_pub = obj.object_name in public_keys
        files.append({
            'key': obj.object_name,
            'size': obj.size,
            'last_modified': obj.last_modified.isoformat() if obj.last_modified else None,
            'download_url': f'/api/files/{bucket}/{quote(obj.object_name, safe="")}',
            'is_public': is_pub,
            'public_url': get_public_url(bucket, obj.object_name) if is_pub else None
        })
        if len(files) >= 200:
            break

    return jsonify(bucket=bucket, files=files)


@integrations.post('/files')
def upload_file():
    bucket = validate_bucket(request.form.get('bucket', 'documents'))
    uploaded = request.files.get('file')
    if not uploaded or not uploaded.filename:
        raise ValueError('Cần chọn file upload.')
    data = uploaded.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        return jsonify(error='File tối đa 10 MiB.'), 413
    if bucket == 'documents' and data.startswith(b'%PDF-'):
        suffix, content_type = '.pdf', 'application/pdf'
    elif bucket == 'profile-pics' and data.startswith(b'\x89PNG\r\n\x1a\n'):
        suffix, content_type = '.png', 'image/png'
    elif bucket == 'profile-pics' and data.startswith(b'\xff\xd8\xff'):
        suffix, content_type = '.jpg', 'image/jpeg'
    else:
        return jsonify(error='Chỉ nhận PDF trong documents, PNG/JPEG trong profile-pics.'), 415
    key = uuid.uuid4().hex + suffix
    client = storage_client()
    client.put_object(bucket, key, io.BytesIO(data), len(data), content_type=content_type)
    client.stat_object(bucket, key)
    return jsonify(
        bucket=bucket,
        key=key,
        download_url=f'/api/files/{bucket}/{key}',
        is_public=False,
        public_url=None
    ), 201


@integrations.get('/files/<bucket>/<key>')
def download_file(bucket, key):
    validate_bucket(bucket)
    validate_object_key(key)
    client = storage_client()
    client.stat_object(bucket, key)
    obj = client.get_object(bucket, key)

    def generate():
        try:
            yield from obj.stream(64 * 1024)
        finally:
            obj.close()
            obj.release_conn()

    content_type = 'application/pdf' if key.endswith('.pdf') else ('image/png' if key.endswith('.png') else 'image/jpeg')
    return Response(stream_with_context(generate()), content_type=content_type,
                    headers={'Content-Disposition': f'attachment; filename="{key}"',
                             'X-Content-Type-Options': 'nosniff'})


@integrations.post('/files/share')
def share_file():
    data = sharing_request()
    bucket = validate_bucket(data.get('bucket'))
    key = validate_object_key(data.get('key'))
    client = storage_client()

    try:
        original = client.stat_object(bucket, key)
    except S3Error as err:
        if err.code in ('NoSuchKey', 'NoSuchObject'):
            return jsonify(error='Không tìm thấy file gốc.'), 404
        raise

    public_key = f'public/{key}'
    client.copy_object(bucket, public_key, CopySource(bucket, key),
                       metadata={'Content-Type': original.content_type,
                                 'Cache-Control': 'no-store',
                                 'X-Content-Type-Options': 'nosniff'},
                       metadata_directive='REPLACE')

    return jsonify(
        bucket=bucket,
        key=key,
        is_public=True,
        public_url=get_public_url(bucket, key)
    )


def handle_unshare():
    data = sharing_request() if request.is_json else {}
    bucket_val = data.get('bucket') or request.args.get('bucket')
    key_val = data.get('key') or request.args.get('key')
    bucket = validate_bucket(bucket_val)
    key = validate_object_key(key_val)
    client = storage_client()

    try:
        client.stat_object(bucket, key)
    except S3Error as err:
        if err.code in ('NoSuchKey', 'NoSuchObject'):
            return jsonify(error='Không tìm thấy file gốc.'), 404
        raise

    public_key = f'public/{key}'
    # MinIO remove_object is already idempotent for missing keys. An actual
    # delete failure must propagate; otherwise the URL can remain readable.
    client.remove_object(bucket, public_key)

    return jsonify(
        bucket=bucket,
        key=key,
        is_public=False,
        public_url=None
    )


@integrations.post('/files/unshare')
def unshare_file_post():
    return handle_unshare()


@integrations.delete('/files/share')
def unshare_file_delete():
    return handle_unshare()


@integrations.get('/files/status')
def file_status():
    bucket = validate_bucket(request.args.get('bucket'))
    key = validate_object_key(request.args.get('key'))
    client = storage_client()

    try:
        client.stat_object(bucket, key)
    except S3Error as err:
        if err.code in ('NoSuchKey', 'NoSuchObject'):
            return jsonify(error='Không tìm thấy file gốc.'), 404
        raise

    is_pub = is_object_public(client, bucket, key)
    return jsonify(
        bucket=bucket,
        key=key,
        is_public=is_pub,
        public_url=get_public_url(bucket, key) if is_pub else None
    )


@integrations.errorhandler(S3Error)
def storage_error(error):
    if error.code in ('NoSuchKey', 'NoSuchObject'):
        return jsonify(error='Không tìm thấy file.'), 404
    return jsonify(error='MinIO chưa sẵn sàng hoặc không thể thực hiện thao tác.'), 503
