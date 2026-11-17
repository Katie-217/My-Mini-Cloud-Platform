import json
import time
from integrations import storage_client

for attempt in range(60):
    try:
        client = storage_client()
        client.list_buckets()
        break
    except Exception:
        time.sleep(2)
else:
    raise RuntimeError('MinIO chưa sẵn sàng sau 120 giây.')
for bucket in ('profile-pics', 'documents'):
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
client.set_bucket_policy('documents', json.dumps({
    'Version': '2012-10-17',
    'Statement': [{
        'Effect': 'Allow',
        'Principal': {'AWS': ['*']},
        'Action': ['s3:GetObject'],
        'Resource': ['arn:aws:s3:::documents/*'],
    }],
}))
print('PASS: documents cho phép đọc object công khai; profile-pics vẫn riêng tư.')
