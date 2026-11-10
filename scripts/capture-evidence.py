"""Lưu metadata đã lọc; không lưu Docker Config.Env hoặc .env."""
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]


def command(arguments):
    return subprocess.check_output(arguments, cwd=root).decode('utf-8').strip()


def fetch(path):
    try:
        response = urlopen('http://localhost' + path, timeout=15)
    except HTTPError as error:
        response = error
    with response:
        body = response.read()
        try:
            content = json.loads(body)
        except ValueError:
            content = None
        return {'http_status': response.status, 'json': content}


all_ids = command(['docker', 'ps', '-aq']).split()
all_containers = json.loads(command(['docker', 'container', 'inspect', *all_ids])) if all_ids else []
own = [c for c in all_containers if c['Config'].get('Labels', {}).get('com.docker.compose.project') == 'mycloud']
other = [c for c in all_containers if c not in own]
containers = []
for container in own:
    containers.append({
        'name': container['Name'].lstrip('/'),
        'service': container['Config']['Labels'].get('com.docker.compose.service'),
        'state': container['State']['Status'], 'exit_code': container['State']['ExitCode'],
        'health': container['State'].get('Health', {}).get('Status'),
        'image_reference': container['Config']['Image'], 'image_id': container['Image'],
        'ports': container['NetworkSettings']['Ports'],
        'volumes': [mount['Name'] for mount in container['Mounts'] if mount['Type'] == 'volume'],
    })
network = json.loads(command(['docker', 'network', 'inspect', 'cloud-net']))[0]
volumes = command(['docker', 'volume', 'ls', '--filter', 'label=com.docker.compose.project=mycloud', '--format', '{{.Name}}']).split()
images = json.loads(command(['docker', 'image', 'inspect', *sorted({c['Image'] for c in own})]))
snapshot = {
    'captured_at_utc': datetime.now(timezone.utc).isoformat(), 'client_timezone': 'Asia/Saigon',
    'source_commit': command(['git', 'rev-parse', 'HEAD']), 'compose_project': 'mycloud',
    'containers': sorted(containers, key=lambda item: item['service']),
    'long_running_count': sum(c['state'] == 'running' for c in containers),
    'completed_jobs': [c['service'] for c in containers if c['state'] == 'exited' and c['exit_code'] == 0],
    'network': {'name': network['Name'], 'project': network['Labels'].get('com.docker.compose.project'), 'ipam': network['IPAM']['Config']},
    'volumes': sorted(volumes),
    'images': [{'id': item['Id'], 'tags': item.get('RepoTags', []), 'digests': item.get('RepoDigests', [])} for item in images],
    'outside_project': {'container_count': len(other), 'running_count': sum(c['State']['Running'] for c in other)},
    'status_api': fetch('/api/status'), 'metrics_api': fetch('/api/metrics-summary'),
    'frontend_http_status': {path: fetch(path)['http_status'] for path in ('/', '/blog/', '/app/')},
}
target = root / 'docs' / 'evidence' / 'local-infrastructure.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PASS: Sanitized evidence saved; no environment values.')
