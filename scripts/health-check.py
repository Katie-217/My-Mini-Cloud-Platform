"""Readiness hạ tầng từ host; tùy chọn yêu cầu cả ba UI đã ghép."""
import argparse
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost')
parser.add_argument('--wait', type=int, default=0)
parser.add_argument('--require-frontend', action='store_true')
args = parser.parse_args()
base = args.url.rstrip('/')


def get(path):
    try:
        with urlopen(base + path, timeout=12) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, error.read()


deadline = time.monotonic() + args.wait
while True:
    status = None
    try:
        status_code, payload = get('/api/status')
        status = json.loads(payload)
        metric_code, metrics = get('/api/metrics-summary')
        metrics = json.loads(metrics)
        interfaces = {path: get(path)[0] for path in ('/', '/blog/', '/app/')}
        ready = (status_code == 200 and status.get('overall') == 'healthy'
                 and status.get('services_checked', 0) > 0
                 and status.get('services_reachable') == status.get('services_checked')
                 and metric_code == 200 and metrics.get('status') == 'healthy')
        if args.require_frontend:
            ready = ready and all(value == 200 for value in interfaces.values())
    except (OSError, URLError, ValueError, KeyError):
        ready = False
        interfaces = {}
    if ready or time.monotonic() >= deadline:
        break
    time.sleep(2)
if status:
    for service in status.get('services', []):
        print(f"{service['status'].upper():10} {service['service']:40} {service.get('latency_ms', '?')} ms")
    print(f"Dịch vụ reachable: {status.get('services_reachable')}/{status.get('services_checked')}; nhóm: {status.get('groups_total')}")
for path, code in interfaces.items():
    print(f'HTTP {code}: {base}{path}')
if not ready:
    raise SystemExit('FAIL: Chưa đạt readiness yêu cầu; xem docker compose logs và docs/testing.md.')
print('PASS: Hạ tầng và metrics truy cập được.')
if not args.require_frontend and any(code != 200 for code in interfaces.values()):
    print('NOT TESTED: Nội dung giao diện còn chờ tích hợp; dùng --require-frontend sau khi ghép Gemini.')
