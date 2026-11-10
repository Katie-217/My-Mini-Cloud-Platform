# Kết quả kiểm thử MyMiniCloud

Ngày thực hiện: 10/11/2026. Đây là trạng thái hiện hành, sau các khảo sát ban đầu.

## Backend và SQL Server đã chạy thật

- Docker Compose project: `mycloud`.
- Image app: `mycloud-app:1.0.0`, Flask/Gunicorn, ODBC Driver 18 và pyodbc.
- Image SQL: `mcr.microsoft.com/mssql/server:2022-CU22-ubuntu-22.04`.
- `application-backend-server` và `relational-database-server`: healthy.
- `database-init`: Exited (0), là job hoàn tất đúng thiết kế.
- Network `cloud-net`, subnet `172.30.50.0/24`; volume `mycloud_mssql-data`.
- SQL Server publish thực tế `127.0.0.1:1433:1433`.

| Hạng mục | Kết quả | Bằng chứng |
| --- | --- | --- |
| Compose schema/config | PASS | `docker compose config --quiet` thành công |
| Build và khởi chạy app/SQL | PASS | `docker compose up -d --build`, `docker compose ps -a` |
| Database/schema/seed | PASS | Job init hoàn tất; API đọc tối thiểu 3 seed tiếng Việt |
| API và CRUD thật | PASS | `scripts/test-backend.py`: 23 checks PASS |
| Least privilege SQL runtime login | PASS | USER_NAME=`cloud_app`, SELECT/INSERT=1, CREATE TABLE=0, sysadmin=0 |
| Persistence sau restart SQL | PASS | `scripts/test-persistence.py`: tạo qua API, restart đúng SQL container của mycloud, đọc lại khớp toàn bộ object, xóa đúng record test |
| Init chạy lại an toàn | PASS | `docker compose run --rm database-init` Exited (0); chạy lại test API kiểm tra seed/CRUD |
| SSMS đăng nhập bằng GUI | NOT TESTED | Port SQL publish thành công; chưa thao tác SSMS |
| Gateway / round robin | PASS | 41 gateway checks, GET/POST/PUT/DELETE, 20 request chia 10/10; cả hai web cùng image ID |
| Nội dung Portal/Blog/Student frontend | NOT TESTED | Chờ Gemini bàn giao; web trả HTTP 503 trung thực khi nội dung chưa ghép |
| Keycloak / `/secure` nội bộ | PASS | 2 user login form thật, state/code, PKCE code exchange, JWT/JWKS, sai chữ ký/thiếu token bị từ chối |
| MinIO upload/download | PASS | Avatar PNG/PDF, stat/list/download đúng byte; anonymous 403; 24 checks auth/storage PASS |
| MinIO Console HTML | PASS | `http://localhost:9001/` HTTP 200 và HTML thật; chưa kiểm thử GUI quản trị trong browser |
| Keycloak qua `/auth/` public | PASS | Edge thật localhost: 2 user login, cookie, state, PKCE, token và secure API qua proxy |
| Student JavaScript callback/login/logout | NOT TESTED | Browser test chặn callback để kiểm tra auth độc lập; chưa nghiệm thu JS frontend |
| Bind9 authoritative DNS | PASS | Record khớp IP service thật; host 1053 UDP/TCP và container dig đều đúng |
| Prometheus + Grafana datasource/dashboard API | PASS | 17 DNS/monitoring checks; node/prometheus/blackbox UP, 3 panel có sample thật, Grafana query qua datasource proxy |
| Portal metrics/status backend | PASS | `/metrics-summary` có số liệu CPU/RAM/network thật; `/status` có latency_ms và checked_at đo theo probe |
| Target web | PASS | 21 DNS/monitoring checks; 2 web targets UP và probe_success=1 |
| Grafana visualization trong browser | NOT TESTED | Datasource/PromQL có data; chưa chụp dashboard GUI |
| Kiểm thử dừng Node Exporter và phục hồi | NOT TESTED | Cơ chế kiểm duyệt tự động chặn lệnh dừng container: blocked by policy; không có container bị dừng bởi test |
| Docker Hub push / AWS | NOT TESTED | Chưa có phạm vi/credential tương ứng |

23 checks backend bao gồm health truy vấn DB, hello, JSON 5 mẫu, seed, Unicode,
POST/GET/PUT/DELETE, search mã và tên tiếng Việt, mã trùng (409), GPA sai,
ngày sinh tương lai, trường bắt buộc, JSON sai kiểu, SQL injection qua search,
record không tồn tại (404), và đảm bảo chỉ xóa bản ghi test.

## Chạy lại trong PowerShell

Tại `D:\Cuối kì computing`:

```powershell
python scripts/init-env.py
docker compose config --quiet
docker compose up -d --build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-backend.ps1
docker compose ps -a
```

Script tạo `.env` giữ nguyên file đã có, không in secret. Test copy Python file
vào `/tmp` của app để tránh PowerShell 5 làm sai encoding khi pipe source tiếng
Việt sang native process. Không cần cài thư viện app vào Python của Windows.

Trong lần kiểm tra đầu, PowerShell pipe source UTF-8 theo encoding mặc định làm
sai chuỗi tiếng Việt trong test. Đã xác định lỗi thuộc đường truyền source test,
không phải dữ liệu SQL; đã chạy lại bằng UTF-8 và thêm wrapper copy file. Có lỗi
encoding thông báo của script tạo `.env` trên Windows; đã bổ sung UTF-8 stdout.

Các credential nằm trong `.env` local đã ignore; không lưu resolved Compose config,
connection string, password hoặc token vào tài liệu này.

## Auth và storage

Chạy `docker compose run --rm --no-deps integration-check` sau khi `auth-init`
và `storage-init` Exited (0). Test service thuộc profile `tools`, không phải server
chạy lâu dài; có `PYTHONPATH=/app` để import module khi script nằm dưới `/checks`.

24 checks đã PASS: hai user `sv01`, `sv02` đăng nhập Keycloak bằng form thật,
trao đổi Authorization Code + PKCE, truy cập endpoint bảo vệ, chữ ký sai bị 401;
upload/list/stat/download PDF và PNG qua API, byte roundtrip, bucket private,
từ chối file giả PDF và bucket ngoài whitelist. Test xóa đúng object do nó tạo.
Không lưu token hoặc credential vào output. API CRUD và file vẫn là demo local
công khai qua backend; `/secure` là endpoint thực thi xác thực. Bucket private
không đồng nghĩa backend API đã có phân quyền production.

MinIO build từ source chính thức vì hai registry upstream từ chối pull. Console
HTML/S3 đã hoạt động thật; xem [minio-build-notes.md](minio-build-notes.md).

## DNS, monitoring và API dành cho Portal

- `python scripts/test-dns-host.py`: host localhost:1053 trả authoritative A record
  `app-backend.cloud.local=172.30.50.20` qua UDP và TCP, PASS.
- `docker compose exec -T internal-dns-server dig '@127.0.0.1' app-backend.cloud.local +short`:
  trả đúng 172.30.50.20. Khi dùng PowerShell, đặt đối số bắt đầu bằng `@` trong dấu nháy.
- `docker compose run --rm --no-deps integration-check python /checks/test-monitoring.py`:
  17 checks PASS, gồm record Bind9 khớp service, metric thật và Grafana datasource proxy.
- `/metrics-summary` nội bộ đã trả đủ CPU %, memory bytes/%, network bytes/s;
  `/status` trả 9 nhóm, các probe có duration và timestamp, runtime count vẫn null.
  Khi web/proxy chưa triển khai, overall degraded đúng thực tế.
- Phạm vi CPU/RAM là Linux VM/kernel Docker Desktop; network là namespace của
  Node Exporter. Giao diện phải ghi rõ phạm vi, không gán thành toàn bộ Windows host.
- Lỗi Bind9 đã sửa: image có `/etc/bind/named.conf` mặc định không include các
  file options/local mount rời. Đã thêm `dns/named.conf` include tường minh, mount
  file chính và recreate đúng container DNS của `mycloud`. `named-checkconf` và
  truy vấn thực tế đã thành công. Không sửa Windows ICS hoặc DNS của host.

## Gateway và hai Web Server

- `scripts/test-proxy.py`: 41 checks PASS từ Windows host qua cổng 80, gồm
  Unicode CRUD/search, `/student`/`/student/`, issuer OIDC, metrics và status.
- `nginx -t`: PASS trên proxy và cả hai web. Nginx upstream mặc định Round Robin,
  dùng Docker resolver và `resolve` để theo IP mới khi container recreate.
- Header `X-Web-Server` và endpoint `/__replica` trả hostname thật. 20 request
  nhận web1=10, web2=10; hai replica đã đối chiếu có cùng Docker image ID.
- `test-auth-storage.py` với `TEST_PUBLIC_BASE=http://api-gateway-proxy-server`:
  24 checks PASS qua proxy; sau đó kiểm tra riêng bằng Edge localhost thật.
- Ban đầu test đổi URL sang hostname nội bộ và đặt Host public làm cookie jar
  không gửi cookie login. Đã sửa cách chuyển cookie cùng session trong test,
  không thay cơ chế cookie production; Edge localhost xác nhận flow thật PASS.
- `test-auth-browser.py`: hai user PASS login/cookie/state/PKCE/JWT qua public
  route. Callback frontend được intercept để không phụ thuộc Gemini, do đó
  không tính là đã kiểm thử Student JavaScript. Ảnh login không có credential
  lưu `.runtime/browser-evidence/keycloak-login.png` (Git ignore).
- Web healthcheck dùng `127.0.0.1`: BusyBox wget chọn IPv6 khi dùng localhost
  trong khi server listen IPv4, gây false unhealthy; đã xác minh và sửa.
- Keycloak healthcheck thực hiện GET `/auth/health/ready` trên management :9000
  bằng bash builtins; auth-init chờ service healthy rồi bootstrap.
- Access logs proxy và web chỉ ghi `$uri`, không ghi query string chứa OIDC code.

**Giới hạn hiện tại:** `/`, `/blog/`, `/app/` trả trang chờ với HTTP 503 khi source
frontend còn trống. Health Nginx và probe exporter kiểm tra tiến trình HTTP,
không chứng minh nội dung frontend đã hoàn thành. Build lại web image sau khi
review/ghép code Gemini sẽ phục vụ nội dung thật; không ghi đè `web/html/**`.
