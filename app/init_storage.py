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


def configure_bucket_policy(client, bucket):
    policy = {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Sid': 'PublicReadOnlyPrefix',
                'Effect': 'Allow',
                'Principal': '*',
                'Action': ['s3:GetObject'],
                'Resource': [f'arn:aws:s3:::{bucket}/public/*'],
            }
        ],
    }
    client.set_bucket_policy(bucket, json.dumps(policy))


for bucket in ('profile-pics', 'documents'):
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    configure_bucket_policy(client, bucket)

print('PASS: Hai bucket đã sẵn sàng với policy public cho prefix public/*.')
