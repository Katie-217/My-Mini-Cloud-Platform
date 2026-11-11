"""Kiểm tra cấu hình và ownership trước khi thao tác Docker; chỉ đọc trạng thái."""
import ipaddress
import json
import os
import socket
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
compose = ['docker', 'compose', '-f', str(root / 'docker-compose.yml'), '-p', 'mycloud']


def execute(command, required=True):
    result = subprocess.run(command, cwd=root, capture_output=True, text=True, encoding='utf-8')
    if required and result.returncode:
        raise SystemExit('FAIL: Không đọc được Docker/Compose. Kiểm tra Docker Desktop và .env; không có tài nguyên nào bị sửa.')
    return result


def inspect(kind, name):
    result = execute(['docker', kind, 'inspect', name], required=False)
    return json.loads(result.stdout)[0] if result.returncode == 0 else None


platform = execute(['docker', 'info', '--format', '{{.OSType}}/{{.Architecture}}']).stdout.strip()
if platform not in ('linux/x86_64', 'linux/amd64', 'linux/aarch64', 'linux/arm64'):
    raise SystemExit('FAIL: Cần Docker Linux x86_64 (hoặc ARM64 có Rosetta) để chạy SQL Server đã chốt.')
model = json.loads(execute(compose + ['config', '--format', 'json']).stdout)
assert model['name'] == 'mycloud', 'Compose project phải là mycloud'
db = model['services']['relational-database-server']
assert db['environment']['MSSQL_PID'] == 'Developer'
assert model['services']['application-backend-server']['environment']['DB_NAME'] == 'studentdb'
for service in model['services'].values():
    for key, value in service.get('environment', {}).items():
        if 'PASSWORD' in key and (not value or str(value).startswith('REPLACE_WITH_')):
            raise SystemExit('FAIL: Có credential placeholder; chạy scripts/init-env.py hoặc cấu hình .env local.')
network_name = model['networks']['cloud-net']['name']
assert network_name == 'cloud-net'
network = inspect('network', network_name)
if network and network.get('Labels', {}).get('com.docker.compose.project') != 'mycloud':
    raise SystemExit('FAIL: Network cloud-net thuộc project khác; không thay đổi tài nguyên đó.')
subnet = ipaddress.ip_network(model['networks']['cloud-net']['ipam']['config'][0]['subnet'])
network_ids = execute(['docker', 'network', 'ls', '-q']).stdout.split()
if network_ids:
    all_networks = json.loads(execute(['docker', 'network', 'inspect', *network_ids]).stdout)
    for other in all_networks:
        if other['Name'] == network_name:
            continue
        for entry in other.get('IPAM', {}).get('Config') or []:
            candidate = entry.get('Subnet')
            if candidate and ':' not in candidate and subnet.overlaps(ipaddress.ip_network(candidate)):
                raise SystemExit('FAIL: Subnet xung đột một Docker network khác; cần thiết kế lại IPAM/DNS.')
if os.name == 'nt':
    routes = execute(['powershell', '-NoProfile', '-Command',
                      'Get-NetRoute -AddressFamily IPv4 | Select-Object DestinationPrefix | ConvertTo-Json -Compress'])
    for entry in json.loads(routes.stdout) or []:
        route = ipaddress.ip_network(entry['DestinationPrefix'], strict=False)
        if route.prefixlen >= 8 and not route.is_multicast and subnet.overlaps(route):
            if not (network and route == subnet):
                raise SystemExit('FAIL: Subnet xung đột route Windows; không tự sửa route/firewall.')
for key, definition in model.get('volumes', {}).items():
    name = definition.get('name', 'mycloud_' + key)
    volume = inspect('volume', name)
    if volume and volume.get('Labels', {}).get('com.docker.compose.project') != 'mycloud':
        raise SystemExit('FAIL: Volume dự kiến thuộc project khác; không tự tiếp quản dữ liệu.')

own_ids = execute(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=mycloud']).stdout.split()
own_ports = set()
if own_ids:
    for container in json.loads(execute(['docker', 'container', 'inspect', *own_ids]).stdout):
        for container_port, bindings in container['NetworkSettings']['Ports'].items():
            protocol = container_port.split('/')[1]
            for binding in bindings or []:
                own_ports.add((int(binding['HostPort']), protocol))
for name, service in model['services'].items():
    expected_name = service.get('container_name', f'mycloud-{name}-1')
    existing = inspect('container', expected_name)
    if existing and existing['Config'].get('Labels', {}).get('com.docker.compose.project') != 'mycloud':
        raise SystemExit('FAIL: Tên container dự kiến đang thuộc project khác.')
    for published in service.get('ports', []):
        port, protocol = int(published['published']), published.get('protocol', 'tcp')
        if (port, protocol) in own_ports:
            continue
        kind = socket.SOCK_DGRAM if protocol == 'udp' else socket.SOCK_STREAM
        with socket.socket(socket.AF_INET, kind) as probe:
            try:
                probe.bind((published.get('host_ip') or '0.0.0.0', port))
            except OSError:
                raise SystemExit(f'FAIL: Host port {port}/{protocol} không bind được; không dừng dịch vụ ngoài project.') from None
print('PASS: Linux x86_64, Compose mycloud, credential local, ownership, subnet và host ports hợp lệ.')
