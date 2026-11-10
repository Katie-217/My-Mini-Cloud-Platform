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
print('PASS: Hai bucket private đã sẵn sàng.')
