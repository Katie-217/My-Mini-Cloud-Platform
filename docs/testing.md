# Kết quả kiểm thử MyMiniCloud

Ngày thực hiện: 10/11/2026. Đây là trạng thái hiện hành, sau các khảo sát ban đầu.

## Script setup và tài liệu bàn giao có ảnh

- PASS: setup.ps1 với cả build mặc định và -NoBuild trên Docker hiện có. Tạo lại
  các init jobs an toàn, giữ env/volumes và phục hồi readiness12/12/baUI200.
- PASS: setup-tools.ps1 cài tools pinned trong .venv, xử lý UTF8 cho đường dẫn
  tiếng Việt; PowerShell AST của các script hợp lệ.
- PASS: rehearsal source sạch trong thư mục runtime riêng, chưa có env; init
  tạo credential mới, lần2 giữ nguyên; Compose config hợp lệ. Rehearsal chỉ
  đọc config, không tạo thêm Docker resource hoặc dùng password mới với volume cũ.
- PASS: verify.ps1 -Browser hoàn tất backend23, gateway41, monitoring21,
  auth/storage24, DNS hostUDP/TCP và portal navigation29checks.
- PASS: capture-handoff.py chạy CRUD/upload-download/hash/DNS/ping11đích/metrics,
  restart đúng SQL/MinIO và verify record/PNG/PDF còn nguyên; chỉ dọn fixture riêng.
  Script storage dưới /tmp cần PYTHONPATH=/app, đã bổ sung trong lệnh hướng dẫn.
- PASS: login Keycloak thật/PKCE và secure200; chụp Grafana/MinIO/Prometheus/Portal/
  Blog trên browser. Callback auth test được intercept, không coi là đã retest
  toàn bộ Student JavaScript. Ảnh không chứa credential/token.
- PASS: screenshot-guide.html chứa16phần response/32ảnh nhúng tại đúng bước,
  mở offline và mọi ảnh tải được; không cần thư mục ảnh khi gửi riêng.
- NOT TESTED: cài Windows/WSL/Docker mới, engine trống hoàn toàn hoặc máy của
  partner. Browser/CLI captures là snapshot theo timestamp, giao diện có thể
  tiếp tục thay đổi trên nhánh frontend. DockerHub/AWS/SSMSGUI chưa chạy lượt này.

## Kiểm tra lại liên kết sau các lần chỉnh giao diện

`python scripts/test-portal-navigation.py`: **29 checks PASS** trên Edge, sau
khi khởi động lại Docker Desktop và cập nhật hai web replica. Script kiểm tra:

- Click Blog từ sidebar, ba bài viết, tám link card HTTP, DNS modal/Escape và
  năm link trong bảng DNS. Grafana giữ redirect tới dashboard khi cần login.
- Đăng nhập Grafana thật, ba panel render canvas, không No data. Portal không
  có JavaScript pageerror. Hai replica có cùng SHA256 file portal.js.
- DNS không mở URL HTTP1053; không còn link HTTP9115 nội bộ. Bảng DNS bỏ record
  Prometheus .90 không tồn tại trong zone; Grafana trỏ đúng dashboard.
- Status web2 lỗi làm nhóm Web unhealthy; nguồn status/metrics503 không tạo
  Online/latency/số liệu mẫu. Hai fault test chỉ intercept response trong browser.
- Hostname127.0.0.1 được dùng đúng cho quick links khi truy cập qua địa chỉ đó.

Ảnh/report mới lưu tại `.runtime/portal-navigation/`, Git ignore và không chứa
credential. Readiness PASS: 12/12 probe, Portal/Blog/Student HTTP200. Lần này chỉ
kiểm thử navigation và dashboard; 27 checks Student CRUD/PKCE đầy đủ bên dưới
là kết quả của bản tích hợp trước các lần Gemini chỉnh UI, chưa chạy lại toàn
bộ trên UI mới. Không suy navigation PASS thành toàn bộ nghiệp vụ UI đã retest.

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
| Persistence SQL Server | PASS | Restart/recreate container mới giữ record/Unicode/timestamp; ID container đã đổi, chỉ xóa record test |
| Persistence MinIO | PASS | ID container mới; PNG/PDF ở cả hai bucket giữ nguyên byte sau recreate; chỉ dọn object test |
| Init chạy lại an toàn | PASS | `docker compose run --rm database-init` Exited (0); chạy lại test API kiểm tra seed/CRUD |
| SSMS đăng nhập bằng GUI | NOT TESTED | Port SQL publish thành công; chưa thao tác SSMS |
| Gateway / round robin | PASS | 41 gateway checks, GET/POST/PUT/DELETE, 20 request chia 10/10; cả hai web cùng image ID |
| Nội dung Portal/Blog/Student frontend | PASS | Edge thật, 27 checks; ba UI 200, đủ 3 bài Blog và ảnh local |
| Keycloak / `/secure` nội bộ | PASS | 2 user login form thật, state/code, PKCE code exchange, JWT/JWKS, sai chữ ký/thiếu token bị từ chối |
| MinIO upload/download | PASS | Avatar PNG/PDF, stat/list/download đúng byte; anonymous 403; 24 checks auth/storage PASS |
| MinIO Console GUI | PASS | Đăng nhập Edge thật, thấy cả hai bucket và đã chụp ảnh |
| Keycloak qua `/auth/` public | PASS | Edge thật localhost: 2 user login, cookie, state, PKCE, token và secure API qua proxy |
| Student JavaScript callback/login/logout | PASS | Login UI → Keycloak → callback PKCE → secure API; logout xóa token và kết thúc SSO |
| Student CRUD/avatar/PDF qua UI | PASS | POST/PUT/DELETE thật, literal HTML an toàn, ảnh MinIO hiển thị, PDF download đúng byte |
| Portal card/metrics và responsive | PASS | 9 card với latency/timestamp, CPU/RAM/network thật; viewport 390 px không tràn ngang trên 3 UI |
| Frontend khi web2 lỗi / metrics 503 | PASS | Intercept response riêng trong browser: nhóm Web unhealthy, metric không có số giả; không dừng container |
| Bind9 authoritative DNS | PASS | Record khớp IP service thật; host 1053 UDP/TCP và container dig đều đúng |
| Prometheus + Grafana datasource/dashboard API | PASS | 17 DNS/monitoring checks; node/prometheus/blackbox UP, 3 panel có sample thật, Grafana query qua datasource proxy |
| Portal metrics/status backend | PASS | `/metrics-summary` có số liệu CPU/RAM/network thật; `/status` có latency_ms và checked_at đo theo probe |
| Target web | PASS | 21 DNS/monitoring checks; 2 web targets UP và probe_success=1 |
| Script vận hành PowerShell | PASS | start.ps1 -NoBuild và health-check.ps1 chạy thành công; preflight kiểm tra ownership/subnet/ports |
| Bash syntax | PASS | bash -n thành công |
| Bash lifecycle / stop scripts | NOT TESTED | Chưa chạy start/stop qua Bash trên Ubuntu hoặc dừng toàn bộ mycloud |
| Grafana visualization trong browser | PASS | Login Edge thật, 3 panel có canvas/data, không có No data; ảnh đã xem lại |
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
  Lúc chưa triển khai web/proxy, overall degraded đúng thực tế; sau tích hợp,
  cả 12 probe healthy. Runtime count vẫn Unknown trên Portal vì không đọc Docker socket.
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
  không tính riêng test đó là đã kiểm thử Student JavaScript. Bài
  `test-frontend-browser.py` chạy thêm callback và logout JS thật, PASS.
  Ảnh login không có credential
  lưu `.runtime/browser-evidence/keycloak-login.png` (Git ignore).
- Web healthcheck dùng `127.0.0.1`: BusyBox wget chọn IPv6 khi dùng localhost
  trong khi server listen IPv4, gây false unhealthy; đã xác minh và sửa.
- Keycloak healthcheck thực hiện GET `/auth/health/ready` trên management :9000
  bằng bash builtins; auth-init chờ service healthy rồi bootstrap.
- Access logs proxy và web chỉ ghi `$uri`, không ghi query string chứa OIDC code.

**Sau tích hợp frontend:** `/`, `/blog/`, `/app/` đều HTTP 200, phục vụ source
Gemini đã review và sửa trên nhánh `fix/connect-reviewed-frontend-services`.
Chạy `python scripts/test-proxy.py --frontend-ready` và
`python scripts/health-check.py --require-frontend`: PASS. Hai web cùng image ID.
Health Nginx riêng lẻ vẫn không chứng minh nội dung hoặc thao tác UI đúng.

## Nghiệm thu frontend bằng Edge thật

`python scripts/test-frontend-browser.py`: **27 checks PASS**, 0 JavaScript
pageerror. Kiểm tra đủ Portal status/metrics/card, Blog home/list/3 bài và ảnh,
Student CRUD/search/detail, avatar upload và hiển thị, PDF roundtrip, PKCE callback,
secure API và kết thúc SSO khi logout. Viewport mobile 390 px không tràn ngang.

Test trạng thái lỗi chỉ intercept response trong browser, không thay đổi backend
hoặc dừng container. Chỉ xóa record/object có ID/key do test tạo. Không lưu
credential/token vào ảnh hoặc báo cáo. Report `docs/evidence/frontend-e2e.json`
và các ảnh rời là output local, không đưa lên Git. Ảnh phục vụ bàn giao nằm trong
[hướng dẫn có ảnh nhúng](screenshot-guide.html).

## Script vận hành và kiểm tra secret

- `scripts/preflight.py`: chỉ đọc Docker/Compose/route và thử bind port khi chưa
  được chính project publish; kiểm tra Linux x86_64, project mycloud, owner
  network/volume/container, overlap subnet, credential placeholder và port.
  Không tự dừng dịch vụ ngoài project, không sửa route/firewall.
- `start.ps1 -NoBuild`: đã chạy thành công bằng Compose file/project chỉ định
  tường minh; giữ `.env` và volume hiện có; init jobs chạy lại an toàn.
- `health-check.py` phân biệt infrastructure readiness với `--require-frontend`.
  Mặc định không coi trang chờ 503 là UI đã hoàn thành.
- `stop.ps1`/`stop.sh` chỉ gọi Compose stop cho mycloud, không xóa container/volume.
  Chưa chạy stop lifecycle vì cần giữ dịch vụ cho Gemini tích hợp.
- PowerShell AST parse và Bash `-n`: PASS. Bash start/stop end-to-end trên Ubuntu
  vẫn NOT TESTED. Không suy từ cú pháp hợp lệ thành đã chạy thành công.
- `scripts/check-secrets.py`: soát file tracked hoặc `--staged`, đối chiếu secret
  local và private key, không xuất giá trị. `.env` và `.runtime/` được Git ignore.

## Persistence và ảnh minh chứng cuối lượt cấu hình

- Tạo record riêng qua API và upload PNG/PDF riêng vào hai bucket, lưu marker
  trong `/tmp` app container. Recreate chỉ `relational-database-server` và
  `object-storage-server` bằng Compose project mycloud; xác nhận cả hai ID đổi.
- `test-persistence.py verify`: đọc lại record khớp toàn bộ object, Unicode,
  timestamp; `test-storage-persistence.py verify`: tải lại PNG/PDF đúng byte.
- Sau kiểm tra chỉ xóa record/object có ID/key do bài test tạo. Không xóa volume.
  Hạ tầng phục hồi 12/12 reachable và metric thật sau recreate.
- `capture-admin-ui.py`: login Edge thật vào Grafana và MinIO. Grafana có 3
  panel với canvas, không No data; MinIO hiển thị hai bucket. Đã xem lại ảnh.
- Ảnh Grafana/MinIO và metadata ở `docs/evidence/` chỉ giữ local, được Git ignore.
  Bản bàn giao có ảnh nhúng tại [screenshot-guide.html](screenshot-guide.html).
- Kiểm tra cuối: 12 container thường trực, 3 init jobs Exited (0), 5 named
  volumes mycloud; 37 container ngoài project không chạy. Không dùng prune,
  không thay đổi SQLEXPRESS/ICS hoặc tài nguyên ngoài mycloud.
