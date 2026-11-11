"""Kết nối SQL Server từ máy host giống SSMS (127.0.0.1,1433, SQL Authentication); chỉ đọc, không in mật khẩu.

Dùng khi không có SSMS (ví dụ macOS): chứng minh port host + login DB_USER + database studentdb hoạt động
ngoài Docker, rồi chạy đúng truy vấn của bước 4 trong hướng dẫn.
Chạy: .venv/bin/python scripts/test-sql-host.py   (Windows: .\\.venv\\Scripts\\python.exe scripts/test-sql-host.py)
"""
import sys
from pathlib import Path

import pytds

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[1]
env = dict(line.split('=', 1) for line in (root / '.env').read_text(encoding='utf-8-sig').splitlines()
           if line.strip() and not line.startswith('#') and '=' in line)

try:
    conn = pytds.connect(server='127.0.0.1', port=1433, database=env.get('DB_NAME', 'studentdb'),
                         user=env['DB_USER'], password=env['DB_PASSWORD'], login_timeout=10)
except Exception as error:
    raise SystemExit(f'FAIL: Không kết nối được 127.0.0.1,1433 bằng {env.get("DB_USER")}: {type(error).__name__}')

with conn:
    with conn.cursor() as cur:
        cur.execute("SELECT DB_NAME(), SUSER_SNAME(), CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50)), "
                    "CAST(SERVERPROPERTY('Edition') AS nvarchar(100))")
        database, login, version, edition = cur.fetchone()
        print(f'Database: {database} | Login: {login} | SQL Server {version} {edition}')
        cur.execute('SELECT id, student_id, fullname, dob, major, gpa, avatar_key, created_at '
                    'FROM dbo.students ORDER BY id DESC')
        rows = cur.fetchall()
        print(f'{"id":>4}  {"student_id":<10}  {"fullname":<24}  {"dob":<10}  {"major":<22}  gpa')
        for row in rows:
            print(f'{row[0]:>4}  {row[1]:<10}  {row[2]:<24}  {str(row[3]):<10}  {row[4]:<22}  {row[5]}')

assert database == env.get('DB_NAME', 'studentdb') and login == env['DB_USER'], 'Sai database/login'
assert len(rows) >= 3, 'Cần ít nhất 3 bản ghi'
print(f'PASS: host 127.0.0.1,1433 SQL Authentication -> {database}, {len(rows)} bản ghi (tương đương kết nối SSMS).')
