# Cấu hình và kết nối để demo local

## Luồng và port

Browser → gateway port 80 → hai web replica hoặc Flask :8081 / Keycloak :8080.
Flask → service `relational-database-server:1433`, database `studentdb` qua ODBC18;
Flask → MinIO `object-storage-server:9000`; JWKS lấy từ Keycloak service nội bộ.
Không dùng localhost để gọi container khác.

Network `cloud-net` do project mycloud quản lý, subnet `172.30.50.0/24` đã kiểm tra
route trước khi tạo. Static IP phục vụ zone DNS: gateway .10, app .20, MinIO .30,
Keycloak .40, Grafana .50, Bind9 .53. Những connection string dùng service name.

Named volumes: `mycloud_mssql-data`, `mycloud_keycloak-data`, `mycloud_minio-data`,
`mycloud_prometheus-data`, `mycloud_grafana-data`. Mount cấu hình đọc-only.

## Database và SSMS

1. Mở SSMS trên Windows, server type Database Engine.
2. Server name `127.0.0.1,1433`, SQL Server Authentication.
3. Login/password từ `.env`: `DB_USER`, `DB_PASSWORD`; chọn database `studentdb`.
4. Khi driver yêu cầu, trust chứng chỉ tự ký của demo local.
5. Chạy truy vấn:

```sql
USE studentdb;
SELECT id, student_id, fullname, dob, major, gpa, avatar_key, created_at
FROM dbo.students ORDER BY id;
```

SSMS GUI chưa được thao tác trong lần kiểm thử này; truy vấn/Unicode/CRUD đã
kiểm tra thật qua pyodbc và Flask. Không kết nối nhầm instance Windows SQLEXPRESS.
User cloud_app có quyền SELECT/INSERT/UPDATE/DELETE trên bảng, không có sysadmin
hoặc CREATE TABLE. SA chỉ dùng healthcheck/bootstrap và không truyền cho Flask runtime.

SQL init chạy bằng `app/init_db.py` qua pyodbc, tách batch T-SQL ở GO, có retry
readiness và seed idempotent. Không trông chờ thư mục init tự chạy theo cơ chế MySQL.

## Keycloak

- Console: `http://localhost/auth/admin/`; admin/password đọc `.env`.
- Realm: `MSSV_PLACEHOLDER`, client public `flask-app`, users sv01 và sv02.
- Demo password lấy `DEMO_USER_PASSWORD`; không ghi vào source hoặc ảnh.
- Login dùng Authorization Code + PKCE S256, state, redirect `/app/`.
- Backend kiểm tra RS256, JWKS, issuer, audience flask-app và exp; `/secure` 401
  khi token thiếu/sai. Direct Access Grants của client demo tắt.
- Tạo user mới qua Admin Console → realm → Users → Add user, đặt credential
  riêng; không dùng tài khoản admin làm tài khoản frontend.

Lấy token qua flow login của frontend sau khi Gemini bàn giao. Hiện có test tự
động thật bằng Edge `scripts/test-auth-browser.py`; script intercept callback
để kiểm tra hạ tầng độc lập, không thay thế việc nghiệm thu JS Student App.

## MinIO và file

Console 9001 dùng credential root local trong `.env`. Hai bucket private:
`profile-pics` nhận PNG/JPEG, `documents` nhận PDF; API giới hạn file 10 MiB.
Upload trong Console hoặc Student App; list/download qua `/api/files`.
Backend kiểm tra signature đầu file, không phải trình quét malware hoặc parser
kiểm định toàn bộ tài liệu. Không tự đặt bucket public.

API CRUD/file công khai cho demo local; bảo vệ token được minh họa tại `/secure`.
Không coi bucket private đồng nghĩa API đã có phân quyền production.
Xem [ngoại lệ build MinIO](minio-build-notes.md).

## DNS và monitoring

- Bind9 authoritative zone `cloud.local`, host 1053 TCP/UDP; không đổi DNS Windows.
- PowerShell tại repo: `python scripts/test-dns-host.py` hoặc
  `docker compose exec -T internal-dns-server dig '@127.0.0.1' app-backend.cloud.local +short`.
- Docker DNS phân giải service name; dig qua Bind9 kiểm tra zone riêng, hai bài test khác nhau.
- Prometheus scrape Node Exporter, chính Prometheus, Blackbox và probe hai web `/health`.
- Grafana datasource/provisioning có ba panel: CPU %, memory bytes, network bytes/s.
  Phạm vi là Linux VM/kernel và namespace Node Exporter, không phải Windows host.
- `/api/status` và `/api/metrics-summary` trả dữ liệu thật; không expose Docker socket.

## Xem và xử lý lỗi

Tại repo, PowerShell:

```powershell
docker compose -f docker-compose.yml -p mycloud ps -a
docker compose -f docker-compose.yml -p mycloud logs --tail 80 application-backend-server
docker compose -f docker-compose.yml -p mycloud logs --tail 80 auth-init storage-init
python scripts/preflight.py
```

Init job Exited (0) là thành công. Web 503 trong giai đoạn chờ Gemini là có chủ
đích; health Nginx 200 chỉ xác nhận server sẵn sàng. Sau review frontend, build
lại image web và chạy health với `--require-frontend`.

Port conflict: xác định tiến trình/container sở hữu, không tự dừng SQLEXPRESS/ICS.
SQL health fail sau đổi `.env`: đối chiếu credential đã lưu trong volume;
không xóa volume để reset. DNS NXDOMAIN: kiểm tra named.conf include, zone và IPAM.
Chart chưa có rate: chờ vài chu kỳ scrape và xem targets/probe_success trước.
Giữ nguyên issuer public khi backend lấy JWKS nội bộ; không sửa token bằng decode.
