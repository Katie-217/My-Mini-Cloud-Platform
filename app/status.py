"""Probe thực tế, không cần Docker socket hoặc giả số container runtime."""
import socket
import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlsplit

import dns.resolver
import requests
from flask import Blueprint, jsonify
from database import connection
from integrations import AUTH_INTERNAL, PUBLIC_URL, REALM

status_api = Blueprint('status_api', __name__)


def admin_url(port, path='/'):
    parsed = urlsplit(PUBLIC_URL)
    hostname = parsed.hostname or 'localhost'
    if ':' in hostname:
        hostname = '[' + hostname + ']'
    return f'{parsed.scheme}://{hostname}:{port}{path}'


PROBES = [
    ('web1', 'Web Server 1', 'Web Server', 'web-frontend-server1', 'Nginx', 'http://web-frontend-server1/health', '/blog/'),
    ('web2', 'Web Server 2', 'Web Server', 'web-frontend-server2', 'Nginx', 'http://web-frontend-server2/health', '/blog/'),
    ('app', 'Application Server', 'Application Server', 'application-backend-server', 'Flask', 'http://localhost:8081/health', '/app/'),
    ('db', 'Database Server', 'Database Server', 'relational-database-server', 'SQL Server 2022', 'sql', None),
    ('auth', 'Authentication', 'Authentication Server', 'authentication-identity-server', 'Keycloak', f'{AUTH_INTERNAL}/realms/{REALM}/.well-known/openid-configuration', '/auth/'),
    ('storage', 'Object Storage', 'File/Object Storage', 'object-storage-server', 'MinIO', 'http://object-storage-server:9000/minio/health/ready', admin_url(9001)),
    ('dns', 'Internal DNS', 'DNS/Name Service', 'internal-dns-server', 'Bind9', 'dns', None),
    ('prometheus', 'Monitoring', 'Monitoring', 'monitoring-prometheus-server', 'Prometheus', 'http://monitoring-prometheus-server:9090/-/ready', admin_url(9090, '/targets')),
    ('node', 'System metrics', 'Monitoring', 'monitoring-node-exporter-server', 'Node Exporter', 'http://monitoring-node-exporter-server:9100/metrics', None),
    ('http', 'HTTP metrics', 'Monitoring', 'monitoring-http-exporter-server', 'Blackbox Exporter', 'http://monitoring-http-exporter-server:9115/metrics', None),
    ('grafana', 'Visualization', 'Logging/Visualization', 'monitoring-grafana-dashboard-server', 'Grafana', 'http://monitoring-grafana-dashboard-server:3000/api/health', admin_url(3000, '/d/mycloud-system')),
    ('proxy', 'Reverse Proxy / Load Balancer', 'Reverse Proxy/Load Balancer', 'api-gateway-proxy-server', 'Nginx', 'http://api-gateway-proxy-server/health', '/'),
]


def probe(spec):
    started = time.perf_counter()
    key, name, group, service, technology, endpoint, url = spec
    result = dict(id=key, name=name, group=group, service=service, technology=technology,
                  status='unhealthy', detail='Probe không thành công', url=url, network='cloud-net')
    try:
        if endpoint == 'sql':
            conn = connection()
            try:
                conn.execute('SELECT TOP (1) id FROM dbo.students').fetchone()
            finally:
                conn.close()
            result['detail'] = 'Truy vấn dbo.students thành công'
        elif endpoint == 'dns':
            resolver = dns.resolver.Resolver(configure=False)
            resolver.nameservers = [socket.gethostbyname(service)]
            resolver.lifetime = 2
            answers = resolver.resolve('app-backend.cloud.local', 'A')
            if socket.gethostbyname('application-backend-server') not in [answer.address for answer in answers]:
                raise ValueError('DNS record không khớp backend')
            result['detail'] = 'Bind9 authoritative record khớp backend thực tế'
        else:
            response = requests.get(endpoint, timeout=3)
            response.raise_for_status()
            result['detail'] = f'HTTP {response.status_code}'
        result['status'] = 'healthy'
    except Exception:
        pass
    result['latency_ms'] = round((time.perf_counter() - started) * 1000, 2)
    result['checked_at'] = datetime.now(timezone.utc).isoformat()
    return result


@status_api.get('/status')
def status():
    with ThreadPoolExecutor(max_workers=8) as pool:
        services = list(pool.map(probe, PROBES))
    healthy = sum(service['status'] == 'healthy' for service in services)
    return jsonify(checked_at=datetime.now(timezone.utc).isoformat(),
                   overall='healthy' if healthy == len(services) else 'degraded',
                   groups_total=len({service['group'] for service in services}),
                   services_reachable=healthy, services_checked=len(services),
                   container_runtime_count=None, services=services)


@status_api.get('/metrics-summary')
def metrics_summary():
    endpoint = 'http://monitoring-prometheus-server:9090/api/v1/query'
    queries = {
        'cpu_percent': '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])))',
        'memory_used_bytes': 'node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes',
        'memory_total_bytes': 'node_memory_MemTotal_bytes',
        'network_rx_bytes_per_second': 'sum(rate(node_network_receive_bytes_total{device!="lo"}[2m]))',
        'network_tx_bytes_per_second': 'sum(rate(node_network_transmit_bytes_total{device!="lo"}[2m]))',
    }

    def fetch(expression):
        try:
            response = requests.get(endpoint, params={'query': expression}, timeout=3)
            response.raise_for_status()
            result = response.json()['data']['result']
            value = float(result[0]['value'][1]) if result else None
            return value if value is not None and math.isfinite(value) else None
        except (requests.RequestException, KeyError, TypeError, ValueError):
            return None

    node_available = fetch('up{job="node"}') == 1
    if node_available:
        with ThreadPoolExecutor(max_workers=5) as pool:
            values = dict(zip(queries, pool.map(fetch, queries.values())))
    else:
        values = dict.fromkeys(queries)
    total, used = values['memory_total_bytes'], values['memory_used_bytes']
    values['memory_percent'] = (100 * used / total) if total and used is not None else None
    available = all(value is not None for value in values.values())
    return jsonify(status='healthy' if available else 'unavailable',
                   checked_at=datetime.now(timezone.utc).isoformat(),
                   source='Prometheus / Node Exporter',
                   scope={'cpu': 'Linux VM', 'memory': 'Linux kernel', 'network': 'Node Exporter namespace'},
                   **values), (200 if available else 503)
