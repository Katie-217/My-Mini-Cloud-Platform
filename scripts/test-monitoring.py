import os
import time

import dns.resolver
import requests
import socket

count = 0


def check(name, condition):
    global count
    assert condition, name
    count += 1
    print('PASS:', name, flush=True)


resolver = dns.resolver.Resolver(configure=False)
resolver.nameservers = [socket.gethostbyname('internal-dns-server')]
resolver.lifetime = 5
for name, service in [('app-backend', 'application-backend-server'), ('minio', 'object-storage-server'),
                      ('keycloak', 'authentication-identity-server'), ('grafana', 'monitoring-grafana-dashboard-server')]:
    answer = resolver.resolve(name + '.cloud.local', 'A')
    check(f'Bind9 record {name} khớp service thật', socket.gethostbyname(service) in [r.address for r in answer])
check('Bind9 trả record qua TCP', resolver.resolve('app-backend.cloud.local', 'A', tcp=True)[0].address == socket.gethostbyname('application-backend-server'))
prometheus = 'http://monitoring-prometheus-server:9090'
for attempt in range(30):
    targets = requests.get(prometheus + '/api/v1/targets', timeout=10).json()['data']['activeTargets']
    if all(any(t['labels']['job'] == job and t['health'] == 'up' for t in targets) for job in ('node', 'prometheus', 'blackbox')):
        break
    time.sleep(1)
for job in ('node', 'prometheus', 'blackbox'):
    check(f'Prometheus target {job} UP', any(t['labels']['job'] == job and t['health'] == 'up' for t in targets))
grafana = 'http://monitoring-grafana-dashboard-server:3000'
credentials = (os.environ['GRAFANA_ADMIN_USER'], os.environ['GRAFANA_ADMIN_PASSWORD'])
source = requests.get(grafana + '/api/datasources/uid/prometheus', auth=credentials, timeout=10)
check('Grafana datasource Prometheus được provisioning', source.status_code == 200 and source.json()['type'] == 'prometheus')
dashboard = requests.get(grafana + '/api/dashboards/uid/mycloud-system', auth=credentials, timeout=10)
check('Dashboard có tối thiểu 3 panel', dashboard.status_code == 200 and len(dashboard.json()['dashboard']['panels']) >= 3)
for panel in dashboard.json()['dashboard']['panels']:
    for target in panel['targets']:
        for attempt in range(20):
            result = requests.get(prometheus + '/api/v1/query', params={'query': target['expr']}, timeout=10).json()
            if result.get('data', {}).get('result'):
                break
            time.sleep(1)
        check(f'PromQL trả sample thật: {panel["title"]} / {target["refId"]}', result['status'] == 'success' and bool(result['data']['result']))
proxied = requests.get(grafana + '/api/datasources/proxy/uid/prometheus/api/v1/query',
                       params={'query': 'up'}, auth=credentials, timeout=10)
check('Grafana query thật qua datasource proxy', proxied.status_code == 200 and bool(proxied.json()['data']['result']))
status = requests.get('http://application-backend-server:8081/status', timeout=15).json()
check('Status có 9 nhóm, runtime count Unknown', status['groups_total'] == 9 and status['container_runtime_count'] is None)
check('Status không báo mọi service healthy khi web/proxy chưa chạy', status['overall'] == 'degraded' and status['services_reachable'] < status['services_checked'])
print(f'RESULT: {count} DNS/monitoring checks PASS; web probe chờ web/proxy triển khai.')
