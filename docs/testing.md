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
| Frontend qua Nginx / round robin | NOT TESTED | Chờ frontend Gemini và cấu hình web/proxy |
| Keycloak / `/secure` nội bộ | PASS | 2 user login form thật, state/code, PKCE code exchange, JWT/JWKS, sai chữ ký/thiếu token bị từ chối |
| MinIO upload/download | PASS | Avatar PNG/PDF, stat/list/download đúng byte; anonymous 403; 24 checks auth/storage PASS |
| MinIO Console HTML | PASS | `http://localhost:9001/` HTTP 200 và HTML thật; chưa kiểm thử GUI quản trị trong browser |
| Keycloak qua `/auth/` public và frontend callback | NOT TESTED | Chờ Nginx và frontend; test hiện tại gọi service nội bộ với issuer/redirect URI public |
| Bind9 / Prometheus / Grafana | NOT TESTED | Chưa triển khai |
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
