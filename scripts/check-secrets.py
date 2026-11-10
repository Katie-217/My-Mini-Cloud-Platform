"""Soát secret local trước commit; không in giá trị hoặc nội dung nghi vấn."""
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
command = ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'] if '--staged' in sys.argv else ['git', 'ls-files', '-z']
names = subprocess.check_output(command, cwd=root).decode('utf-8').split('\0')
secret_values = []
env_file = root / '.env'
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.startswith('#'):
            continue
        key, value = line.split('=', 1)
        if re.search(r'PASSWORD|SECRET|TOKEN|ACCESS_KEY', key) and len(value) > 16 and not value.startswith('REPLACE_WITH_'):
            secret_values.append(value.encode('utf-8'))
checked = 0
for name in filter(None, names):
    basename = Path(name).name.lower()
    if basename.startswith('.env') and basename != '.env.example':
        raise SystemExit('FAIL: Environment file is tracked/staged. Do not commit local secrets.')
    try:
        data = subprocess.check_output(['git', 'show', ':' + name], cwd=root)
    except subprocess.CalledProcessError:
        raise SystemExit('FAIL: Cannot read staged source.') from None
    if any(value in data for value in secret_values) or re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', data):
        raise SystemExit('FAIL: A tracked/staged file contains a local secret or private key. Review without printing its content.')
    checked += 1
print(f'PASS: {checked} tracked/staged files scanned; no local generated secrets or private keys detected.')
