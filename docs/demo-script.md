# Kịch bản demo MyMiniCloud — khoảng 12–15 phút

Trạng thái hiện tại: phần hạ tầng/API đã PASS; ba giao diện frontend chờ Gemini.
Các bước UI bên dưới là kịch bản nghiệm thu sau khi review/ghép frontend, chưa
được tự đánh dấu PASS. Mở `.env` trên máy để biết credential, không chiếu password/token.

## Chuẩn bị

PowerShell tại `D:\Cuối kì computing`: chạy `scripts/health-check.ps1`.
Khi frontend đã ghép, thêm `-RequireFrontend`. Chuẩn bị SSMS, browser, Docker Desktop
và terminal; realm/dashboard vẫn dùng MSSV_PLACEHOLDER nếu chưa bổ sung MSSV.

| Bước | Thời gian | URL/thao tác | Kết quả mong đợi và server xử lý | Trạng thái hiện tại |
| --- | --- | --- | --- | --- |
| 1 | 1 phút | `/`, giới thiệu Portal và sơ đồ | Browser → proxy → web; giải thích 9 nhóm | UI NOT TESTED |
| 2 | 1 phút | Card dịch vụ/metrics Portal | Status/latency/CPU/RAM/network từ Flask probes và Prometheus | API PASS, UI NOT TESTED |
| 3 | 1 phút | `/blog/`, `/blog/posts/`, mở ba bài | HTML/CSS/ảnh do Nginx phục vụ; không gọi DB | UI NOT TESTED |
| 4 | 1 phút | `/app/`, xem/search sinh viên | JS → proxy → Flask → SQL Server | API PASS, UI NOT TESTED |
| 5 | 1,5 phút | Thêm, sửa, xem chi tiết và xóa record demo | Dữ liệu thật, validate/duplicate rõ ràng | API PASS, UI NOT TESTED |
| 6 | 1 phút | SSMS `127.0.0.1,1433`, SELECT bảng | Cùng dữ liệu với Student API | SQL PASS, SSMS GUI NOT TESTED |
| 7 | 1 phút | Account Login → Keycloak, gọi secure API | PKCE, JWT/JWKS; không token 401, token đúng 200 | Auth browser PASS, Student callback NOT TESTED |
| 8 | 1 phút | Upload avatar/PDF, mở MinIO :9001 | Hai bucket private có object, download đúng file | API/Console PASS, Student UI NOT TESTED |
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
Không in access token khi đang trình chiếu. Browser auth test độc lập có tại
`scripts/test-auth-browser.py`, không coi nó là code callback Student đã hoàn thành.

## Ảnh cho báo cáo

- Đã có [Grafana](evidence/grafana-dashboard.png), [MinIO](evidence/minio-console.png)
  và [snapshot hạ tầng](evidence/local-infrastructure.json).
- Cần chụp sau khi frontend ghép: Portal card/metrics, ba trang Blog, CRUD Student,
  upload/download từ UI, login/account và thông báo API thật.
- SSMS query, Prometheus Targets, header/replica và Compose ps là ảnh/bằng chứng bổ sung.
- Persistence dùng testcase đã chạy và ID container mới; không xóa volume trong buổi demo.
