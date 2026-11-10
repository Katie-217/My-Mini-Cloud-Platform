# MyMiniCloud — Docker project `mycloud`

Đồ án mô phỏng 9 nhóm server, dùng Flask, **SQL Server 2022 Developer**, Keycloak,
MinIO, Bind9, Prometheus, Node Exporter, Grafana và Nginx Reverse Proxy.

**Trạng thái hiện tại:** phần cấu hình/hạ tầng đã chạy và kiểm thử local: 12
container thường trực, 3 init jobs hoàn tất, 5 named volumes. Frontend Portal,
Blog và Student App do Gemini làm tại worktree riêng, **chưa ghép vào main**.
Do đó `/`, `/blog/`, `/app/` đang trả HTTP 503 với thông báo chờ tích hợp;
API, đăng nhập Keycloak, MinIO, DNS và monitoring đã hoạt động thật.

## Chạy trên Windows

Yêu cầu: Docker Desktop đang chạy Linux x86_64 containers, Docker Compose v2,
Python 3 trên host. Mở PowerShell tại `D:\Cuối kì computing`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1
```

Script tạo `.env` ngẫu nhiên nếu chưa có, kiểm tra tài nguyên/port/subnet,
build image và khởi chạy đúng project mycloud. Giữ `.env` hiện có và dữ liệu
trong named volume. Nếu image đã build, dùng `scripts/start.ps1 -NoBuild`.

Xem trạng thái hoặc dừng giữ dữ liệu:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/health-check.ps1
docker compose -f docker-compose.yml -p mycloud ps -a
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop.ps1
```

Sau khi ghép frontend, kiểm tra đầy đủ bằng
`scripts/health-check.ps1 -RequireFrontend`. Script stop chỉ dừng mycloud,
không xóa container/volume. Không dùng `down -v` hoặc prune để xử lý lỗi.

Trên Ubuntu/Bash: `bash scripts/start.sh`, `bash scripts/health-check.sh`,
`bash scripts/stop.sh`. Các script Bash đã kiểm tra cú pháp; chưa chạy end-to-end
trên EC2. [Hướng dẫn triển khai](docs/deployment.md).

## Địa chỉ sử dụng

| Chức năng | URL / kết nối | Trạng thái |
| --- | --- | --- |
| Portal / Blog / Student UI | `/`, `/blog/`, `/app/` trên localhost | Chờ Gemini, HTTP 503 |
| Health ứng dụng + DB | http://localhost/api/health | PASS |
| JSON 5 sinh viên | http://localhost/api/student hoặc `/student/` | PASS |
| CRUD SQL Server | http://localhost/api/students-db | PASS |
| Status và latency | http://localhost/api/status | PASS: probe hạ tầng |
| CPU/RAM/Network | http://localhost/api/metrics-summary | PASS: dữ liệu thật |
| Replica nhận request | http://localhost/__replica | PASS: Round Robin |
| Keycloak Admin | http://localhost/auth/admin/ | PASS: routing/login |
| MinIO Console | http://localhost:9001 | PASS: GUI |
| MinIO S3 API | http://localhost:9000 | PASS: private buckets |
| Prometheus Targets | http://localhost:9090/targets | PASS: API targets |
| Grafana Dashboard | http://localhost:3000/d/mycloud-system | PASS: GUI có data |
| SQL Server / SSMS | `127.0.0.1,1433` | PASS: API/SQL, SSMS GUI chưa test |
| Bind9 | `127.0.0.1:1053` UDP/TCP | PASS |

Chỉ gateway publish `80:80`. Cổng quản trị/SQL/DNS bind loopback; các web replica,
Flask và exporter chỉ dùng mạng nội bộ `cloud-net`.

## Tài khoản và `.env`

Xem credential trong `.env` trên máy, không đưa lên Git hoặc gửi vào báo cáo.

| Dịch vụ | Username | Password field |
| --- | --- | --- |
| SQL runtime / SSMS | `DB_USER` (mặc định cloud_app) | `DB_PASSWORD` |
| SQL bootstrap | sa | `MSSQL_SA_PASSWORD` |
| Keycloak Admin | `KEYCLOAK_ADMIN` | `KEYCLOAK_ADMIN_PASSWORD` |
| Keycloak demo realm | sv01, sv02 | `DEMO_USER_PASSWORD` |
| MinIO | `MINIO_ROOT_USER` | `MINIO_ROOT_PASSWORD` |
| Grafana | `GRAFANA_ADMIN_USER` | `GRAFANA_ADMIN_PASSWORD` |

Realm hiện là `MSSV_PLACEHOLDER`; đổi `OIDC_REALM` theo MSSV rồi khởi chạy lại
bootstrap. Cập nhật tiêu đề dashboard trong `grafana/dashboards/system-health.json`.
Giữ `.env` cùng dữ liệu volume; thay password phải theo quy trình từng dịch vụ,
không xóa `.env`/volume để reset. SQL runtime không dùng tài khoản sa.

SSMS: chọn SQL Server Authentication, server `127.0.0.1,1433`, login/password
theo DB_USER/DB_PASSWORD, database `studentdb`. Demo local dùng chứng chỉ tự ký:
chọn Trust server certificate khi cần. Đây là SQL Server container; dịch vụ
`MSSQL$SQLEXPRESS` Windows vẫn giữ nguyên. [Chi tiết cấu hình](docs/configuration.md).

## Kiểm thử đã có

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-backend.ps1
python scripts/test-proxy.py
python scripts/test-dns-host.py
docker compose run --rm --no-deps -e TEST_PUBLIC_BASE=http://api-gateway-proxy-server integration-check
docker compose run --rm --no-deps integration-check python /checks/test-monitoring.py --with-web
```

Browser QA trên máy này: `python scripts/test-auth-browser.py` và
`python scripts/capture-admin-ui.py`, cần Playwright, requests và Microsoft Edge.
Đã chạy với Playwright 1.59.0, requests 2.33.1 trên Python Windows hiện có.
Các test không in token/password. Persistence đã kiểm tra bằng recreate đúng
container SQL/MinIO và đối chiếu record/file; không xóa named volume.

[Kết quả chi tiết](docs/testing.md), [ảnh và metadata](docs/evidence/README.md),
[kịch bản demo 12–15 phút](docs/demo-script.md).

## Cấu trúc và cộng tác

- `web/`: Dockerfile/Nginx do Codex; `web/html/**` do Gemini.
- `app/`: Flask, ODBC, SQL bootstrap, JWT/JWKS, MinIO, status và metrics API.
- `db/init/001_init.sql`: T-SQL schema/seed `studentdb.dbo.students`.
- `auth/`: readiness Keycloak; bootstrap realm/users nằm ở `app/init_auth.py`.
- `storage/`: Dockerfile MinIO build từ tag nguồn chính thức vì registry từ chối pull.
- `dns/`, `monitor/`, `grafana/`, `proxy/`: cấu hình hạ tầng tương ứng.
- `scripts/`: preflight, vận hành, kiểm thử và chụp bằng chứng.
- `storage/data/` là khung cũ; dữ liệu thật dùng named volumes Docker.
- `docker-compose.ym yes` và `proxy/empty` là placeholder khung cũ, không được dùng.

[Kiến trúc](docs/architecture.md), [API contract](docs/api-contract.md),
[phân công Git/worktree](docs/collaboration-plan.md),
[yêu cầu UI](docs/ui-requirements.md), [prompt Gemini](docs/gemini-frontend-prompt.md).

Mỗi phần làm trên nhánh tính năng, commit có mô tả liệt kê tiếng Việt. Hiện chỉ
commit local; chưa có Git remote, chưa push Docker Hub và chưa triển khai AWS.
[Hướng dẫn Docker Hub](docs/docker-hub.md).
