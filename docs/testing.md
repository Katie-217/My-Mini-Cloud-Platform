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
| Keycloak / `/secure` | NOT TESTED | Chưa triển khai; không trả kết quả xác thực giả |
| MinIO upload/download | NOT TESTED | Chưa triển khai |
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
