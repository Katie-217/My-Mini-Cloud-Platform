# Kịch bản demo MyMiniCloud — khoảng 12–15 phút

Để chụp báo cáo theo từng mục Kỳ vọng trong PDF, dùng
[hướng dẫn lệnh và minh chứng](screenshot-guide.md): có lệnh PowerShell,
response mong đợi và ảnh tương ứng cho từng nhóm server.

Trạng thái hiện tại: hạ tầng/API và ba giao diện đã tích hợp, kiểm thử local PASS.
27 checks Edge thật bao gồm CRUD, file và login/logout. Mở `.env` trên máy để
biết credential, không chiếu password/token.

## Chuẩn bị

PowerShell tại `D:\Cuối kì computing`: chạy `scripts/health-check.ps1 -RequireFrontend`.
Chuẩn bị SSMS, browser, Docker Desktop
và terminal; realm/dashboard vẫn dùng MSSV_PLACEHOLDER nếu chưa bổ sung MSSV.

| Bước | Thời gian | URL/thao tác | Kết quả mong đợi và server xử lý | Trạng thái hiện tại |
| --- | --- | --- | --- | --- |
| 1 | 1 phút | `/`, giới thiệu Portal và sơ đồ | Browser → proxy → web; giải thích 9 nhóm | UI PASS |
| 2 | 1 phút | Card dịch vụ/metrics Portal | Status/latency/CPU/RAM/network từ Flask probes và Prometheus | API/UI PASS |
| 3 | 1 phút | `/blog/`, `/blog/posts/`, mở ba bài | HTML/CSS/ảnh do Nginx phục vụ; không gọi DB | UI PASS |
| 4 | 1 phút | `/app/`, xem/search sinh viên | JS → proxy → Flask → SQL Server | API/UI PASS |
| 5 | 1,5 phút | Thêm, sửa, xem chi tiết và xóa record demo | Dữ liệu thật, validate/duplicate rõ ràng | API/UI CRUD PASS |
| 6 | 1 phút | SSMS `127.0.0.1,1433`, SELECT bảng | Cùng dữ liệu với Student API | SQL PASS, SSMS GUI NOT TESTED |
| 7 | 1 phút | Account Login → Keycloak, gọi secure API, Logout | PKCE, JWT/JWKS; không token 401, token đúng 200; logout kết thúc SSO | UI/callback/logout PASS |
| 8 | 1 phút | Upload avatar/PDF, mở MinIO :9001 | Hai bucket private có object, download đúng file | API/Console/Student UI PASS |
| 9 | 0,5 phút | DNS bằng dig hoặc test host | Bind9 authoritative records khớp service | PASS |
| 10 | 0,5 phút | Prometheus :9090/targets | Node và web exporter targets UP, probe_success=1 | API PASS |
| 11 | 1 phút | Grafana :3000/d/mycloud-system | Ba biểu đồ CPU/RAM/network có dữ liệu thật | GUI PASS |
| 12 | 0,5 phút | `/__replica` nhiều lần | X-Web-Server/hostname luân phiên hai replica | PASS |
| 13 | 0,5 phút | Docker Desktop hoặc Compose ps -a | 12 container thường trực, 3 jobs Exited (0), cloud-net | PASS |
| 14 | 0,5 phút | Giải thích persistence qua bằng chứng | SQL/MinIO đã recreate, dữ liệu giữ nguyên trong named volume | PASS |
| 15 | 0,5 phút | Tổng kết checklist, ảnh, phần còn thiếu | Phân biệt local/Docker Hub/AWS và kết quả chưa chạy | Hub/AWS NOT TESTED |

## Lệnh ngắn để chứng minh hạ tầng

PowerShell, tại repo:

```powershell
Invoke-RestMethod http://localhost/api/hello
Invoke-RestMethod http://localhost/api/student
Invoke-RestMethod http://localhost/api/students-db
1..10 | ForEach-Object { (Invoke-RestMethod http://localhost/__replica).replica }
python scripts/test-dns-host.py
docker compose -f docker-compose.yml -p mycloud ps -a
```

Kiểm tra không token: `curl.exe -i http://localhost/api/secure` phải trả 401.
Không in access token khi đang trình chiếu. Test UI và callback Student thật:
`python scripts/test-frontend-browser.py`; auth độc lập: `scripts/test-auth-browser.py`.

## Ảnh cho báo cáo

- [Hướng dẫn có ảnh nhúng](screenshot-guide.html) chứa ảnh Portal, Blog, response
  CRUD, Grafana/MinIO và các lệnh hạ tầng.
- Ảnh rời, report và snapshot ở `docs/evidence/` chỉ giữ local, không đưa lên Git.
- Có thể bổ sung ảnh từng bài Blog, upload/download và Account khi trình bày báo cáo.
- SSMS query, Prometheus Targets, header/replica và Compose ps là ảnh/bằng chứng bổ sung.
- Persistence dùng testcase đã chạy và ID container mới; không xóa volume trong buổi demo.
