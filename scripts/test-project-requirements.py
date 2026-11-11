"""Đối chiếu tài nguyên và dữ liệu chạy thật với yêu cầu local; không in secret."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.request import urlopen

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
compose = ['docker', 'compose', '-f', str(root / 'docker-compose.yml'), '-p', 'mycloud']
checks = []


def run(command):
    process = subprocess.run(command, cwd=root, capture_output=True, timeout=60)
    if process.returncode:
        raise RuntimeError('Command failed; inspect service logs locally (output withheld to protect credentials).')
    return process.stdout


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)
    print('PASS:', name, flush=True)


def get_json(path):
    with urlopen('http://localhost' + path, timeout=20) as response:
        return json.load(response)


model = json.loads(run(compose + ['config', '--format', 'json']))
ids = run(compose + ['ps', '-aq']).decode().split()
containers = json.loads(run(['docker', 'inspect', *ids]))
runtime = {c['Config']['Labels']['com.docker.compose.service']: c for c in containers}
servers = [name for name, spec in model['services'].items()
           if spec.get('restart') == 'unless-stopped' and not spec.get('profiles')]
check('Compose project mycloud có 12 server cho 9 nhóm',
      model['name'] == 'mycloud' and len(servers) == 12 and get_json('/api/status')['groups_total'] == 9)
check('Mỗi server có tên container riêng, label mycloud và trạng thái running',
      len({c['Name'] for c in containers}) == len(containers)
      and all(runtime[name]['State']['Running']
              and runtime[name]['Config']['Labels']['com.docker.compose.project'] == 'mycloud'
              for name in servers))
check('12 server cùng cloud-net và restart unless-stopped',
      all('cloud-net' in runtime[name]['NetworkSettings']['Networks']
          and runtime[name]['HostConfig']['RestartPolicy']['Name'] == 'unless-stopped'
          for name in servers))
check('Ba init jobs hoàn thành exit 0 trên cloud-net',
      all(runtime[name]['State']['Status'] == 'exited' and runtime[name]['State']['ExitCode'] == 0
          and 'cloud-net' in runtime[name]['NetworkSettings']['Networks']
          for name in ('database-init', 'auth-init', 'storage-init')))
mounts = [('relational-database-server', 'mycloud_mssql-data', '/var/opt/mssql'),
          ('object-storage-server', 'mycloud_minio-data', '/data'),
          ('authentication-identity-server', 'mycloud_keycloak-data', '/opt/keycloak/data'),
          ('monitoring-prometheus-server', 'mycloud_prometheus-data', '/prometheus'),
          ('monitoring-grafana-dashboard-server', 'mycloud_grafana-data', '/var/lib/grafana')]
for service, volume, target in mounts:
    check('Persistent volume ' + volume,
          any(m.get('Name') == volume and m['Destination'] == target
              for m in runtime[service]['Mounts']))

query = ("from database import connection; import json; c=connection(); "
         "q=c.execute(\"SELECT DB_NAME(), USER_NAME(), IS_SRVROLEMEMBER('sysadmin'), "
         "HAS_PERMS_BY_NAME('dbo.students','OBJECT','SELECT'), "
         "HAS_PERMS_BY_NAME('dbo.students','OBJECT','INSERT'), "
         "HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CREATE TABLE')\"); "
         "print(json.dumps(list(q.fetchone()))); c.close()")
database, login, sysadmin, can_select, can_insert, can_create = json.loads(run(
    compose + ['exec', '-T', 'application-backend-server', 'python', '-c', query]))
check('Flask dùng studentdb và SQL login giới hạn quyền',
      database == 'studentdb' and login == 'cloud_app' and sysadmin == 0
      and can_select == can_insert == 1 and can_create == 0)
query = ("from database import connection; import json; c=connection(); "
         "print(json.dumps([r[0] for r in c.execute('SELECT physical_name FROM sys.database_files')])); c.close()")
files = json.loads(run(compose + ['exec', '-T', 'application-backend-server', 'python', '-c', query]))
check('File SQL dữ liệu/log nằm dưới /var/opt/mssql được gắn volume',
      len(files) >= 2 and all(path.startswith('/var/opt/mssql/') for path in files))
auth = get_json('/api/auth/config')
realm = model['services']['application-backend-server']['environment']['OIDC_REALM']
check('Issuer realm chung ghi nhận cả hai MSSV',
      realm == '521H0092-523H0065' and auth['issuer'].endswith('/realms/' + realm))
for service in ('api-gateway-proxy-server', 'web-frontend-server1', 'web-frontend-server2'):
    run(compose + ['exec', '-T', service, 'nginx', '-t'])
    check('Nginx config hợp lệ: ' + service, True)
check('Hai web replica dùng cùng một image đã build',
      runtime['web-frontend-server1']['Image'] == runtime['web-frontend-server2']['Image'])
for name in ('assets/js/portal.js', 'assets/js/app.js', 'blog/blog3.html'):
    expected = hashlib.sha256((root / 'web/html' / name).read_bytes()).hexdigest()
    for service in ('web-frontend-server1', 'web-frontend-server2'):
        digest = run(compose + ['exec', '-T', service, 'sha256sum', '/usr/share/nginx/html/' + name]).decode().split()[0]
        check(service + ' phục vụ đúng source ' + name, digest == expected)
article = (root / 'web/html/blog/blog3.html').read_text(encoding='utf-8')
domains = sorted(set(re.findall(r'\b[a-z0-9-]+\.cloud\.local\b', article)))
for domain in domains:
    answers = run(compose + ['exec', '-T', 'internal-dns-server', 'dig', '@127.0.0.1', domain, '+short']).decode().strip()
    check('Domain trong Blog 3 phân giải thật: ' + domain, bool(answers))
direct = json.loads(run(compose + ['exec', '-T', 'api-gateway-proxy-server', 'wget', '-qO-',
                                'http://application-backend-server:8081/hello']))
check('Hello trực tiếp từ container và qua gateway giống nhau', direct == get_json('/api/hello'))
print(f'RESULT: {len(checks)} local requirement checks PASS')
print('NOT TESTED: Docker Hub, AWS EC2, SSMS GUI và báo cáo/video nộp bài không được xác nhận bởi script này.')
