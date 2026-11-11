import os
import sys
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
check('Status count khớp từng probe thực tế', status['services_reachable'] == sum(x['status'] == 'healthy' for x in status['services']))
by_id = {service['id']: service for service in status['services']}
check('Database dùng SQL Query, DNS dùng DNS Query',
      by_id['db']['probe_type'] == 'sql' and by_id['db']['probe_label'] == 'SQL Query'
      and by_id['dns']['probe_type'] == 'dns' and by_id['dns']['probe_label'] == 'DNS Query (A)')
check('HTTP probe có nhãn và đích thực tế, app kiểm tra cả SQL',
      all(service['probe_type'] == 'http' and service['probe_target'].startswith('http')
          and service['probe_label'] for service in status['services'] if service['id'] not in ('db', 'dns'))
      and by_id['app']['probe_label'] == 'HTTP GET + SQL')
if '--with-web' in sys.argv:
    check('12 service probes truy cập được', status['overall'] == 'healthy' and status['services_reachable'] == 12)
    web_targets = [target for target in targets if target['labels']['job'] == 'web']
    check('HTTP exporter scrape được cả 2 web', len(web_targets) == 2 and all(target['health'] == 'up' for target in web_targets))
    for target in web_targets:
        result = requests.get(prometheus + '/api/v1/query', params={'query': 'probe_success{job="web",instance="' + target['labels']['instance'] + '"}'}, timeout=10).json()
        check(f'HTTP probe_success=1: {target["labels"]["instance"]}', bool(result['data']['result']) and result['data']['result'][0]['value'][1] == '1')
print(f'RESULT: {count} DNS/monitoring checks PASS')
