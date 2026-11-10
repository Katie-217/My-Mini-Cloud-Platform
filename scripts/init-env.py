"""Tạo credential local duy nhất, không in secret và không ghi đè .env hiện có."""
import secrets
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
target = root / '.env'
if target.exists():
    print('.env đã tồn tại; giữ nguyên credential.')
else:
    template = (root / '.env.example').read_text(encoding='utf-8-sig')
    import re
    template = re.sub(r'REPLACE_WITH_[A-Z_]+', lambda _: 'Mc9!' + secrets.token_urlsafe(24), template)
    with target.open('x', encoding='utf-8', newline='\n') as handle:
        handle.write(template)
    print('Đã tạo .env local (Git ignore). Mở file trên máy để xem credential; không gửi lên Git.')
