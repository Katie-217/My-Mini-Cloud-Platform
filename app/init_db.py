"""Job schema/seed chạy lại an toàn, chỉ nhận credential SA ở job này."""
import os
import re
import time
from pathlib import Path

from database import connection


def main():
    for attempt in range(60):
        try:
            conn = connection(admin=True, database='master')
            break
        except Exception:
            if attempt == 59:
                raise RuntimeError('SQL Server chưa sẵn sàng sau 120 giây') from None
            time.sleep(2)
    try:
        conn.autocommit = True
        script = Path('/database/001_init.sql').read_text(encoding='utf-8-sig')
        for batch in re.split(r'^\s*GO\s*$', script, flags=re.MULTILINE | re.IGNORECASE):
            if batch.strip():
                conn.execute(batch)
        user = os.environ['DB_USER']
        if not re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_]{0,63}', user):
            raise RuntimeError('DB_USER không hợp lệ')
        # Tên/login và mật khẩu được bind; QUOTENAME tạo DDL đúng escaping.
        conn.execute("""
            USE master;
            DECLARE @name sysname = ?, @pwd nvarchar(128) = ?, @stmt nvarchar(max);
            IF SUSER_ID(@name) IS NULL
            BEGIN
              SET @stmt = N'CREATE LOGIN ' + QUOTENAME(@name)
                + N' WITH PASSWORD=' + QUOTENAME(@pwd, '''') + N', CHECK_POLICY=ON;';
              EXEC sys.sp_executesql @stmt;
            END;
            USE studentdb;
            IF DATABASE_PRINCIPAL_ID(@name) IS NULL
            BEGIN
              SET @stmt = N'CREATE USER ' + QUOTENAME(@name) + N' FOR LOGIN ' + QUOTENAME(@name);
              EXEC sys.sp_executesql @stmt;
            END;
            SET @stmt = N'GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.students TO ' + QUOTENAME(@name);
            EXEC sys.sp_executesql @stmt;
        """, user, os.environ['DB_PASSWORD'])
        print('PASS: database/schema/seed và application login đã sẵn sàng.', flush=True)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
