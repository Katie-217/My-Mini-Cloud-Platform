# MyMiniCloud — Kết quả kiểm tra, các thay đổi và việc cần làm tiếp

Cập nhật ngày 11/11/2026. Kiểm tra trên macOS Apple Silicon với Docker Desktop, PowerShell 7.4.6 và Chrome.
MSSV dùng cho realm Keycloak và dashboard Grafana: **523H0065**.

**Tóm tắt:** hệ thống chạy đủ 9 nhóm dịch vụ (12 container). Các bước 0–12 trong `screenshot-guide.md`
đều PASS, trừ ảnh GUI SSMS. Trong lúc kiểm tra đã sửa một số lỗi chức năng trên giao diện, các chỗ
hiển thị số liệu giả hoặc sai, và làm lại phong cách giao diện. Tất cả thay đổi **chưa commit**.
Phần 5 liệt kê việc còn phải làm, quan trọng nhất là **Docker Hub, AWS EC2 và báo cáo cuối kỳ**.

---

## 1. Chạy lại hệ thống

### Windows (máy x86_64)
Làm như phần A của `screenshot-guide.md`. Không cần thao tác gì thêm.

### macOS (chip Apple Silicon)
1. Cài PowerShell bản `.tar.gz` chính thức (không cần quyền admin), sau đó đưa `~/.local/bin` vào PATH:
   ```bash
   mkdir -p ~/.local/powershell ~/.local/bin && cd ~/.local/powershell
   curl -fsSLO https://github.com/PowerShell/PowerShell/releases/download/v7.4.6/powershell-7.4.6-osx-arm64.tar.gz
   tar -xzf powershell-7.4.6-osx-arm64.tar.gz && chmod +x pwsh && ln -sf ~/.local/powershell/pwsh ~/.local/bin/pwsh
   ln -sf "$(which python3)" ~/.local/bin/python      # các script gọi lệnh `python`
   export PATH="$HOME/.local/bin:$PATH"
   ```
2. Docker Desktop phải bật Rosetta, vì SQL Server chỉ có image amd64 (mặc định đã bật).
3. Chạy setup và mở PowerShell để demo:
   ```bash
   pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
   pwsh
   ```
4. Trong PowerShell trên Mac, chạy dòng này trước khi copy lệnh từ hướng dẫn (Mac không có `curl.exe`):
   ```powershell
   Set-Alias curl.exe /usr/bin/curl
   $env:MYCLOUD_BROWSER_CHANNEL = 'chrome'   # test trình duyệt dùng Chrome thay Edge
   ```
5. Muốn dùng `.venv` thì gõ `./.venv/bin/python` thay cho `.\.venv\Scripts\python.exe`.

### Đặt MSSV
- Trong `.env`: `OIDC_REALM=523H0065`. File này không lên Git; mật khẩu từng server cũng nằm ở đây.
- Trong `grafana/dashboards/system-health.json`: tiêu đề là `System Health of 523H0065`.
- Nếu máy bạn đã chạy trước đó với `MSSV_PLACEHOLDER`: sửa `.env` rồi chạy lại `setup.ps1`.
  `auth-init` sẽ tạo realm mới, realm cũ vẫn còn trong volume.

---

## 2. Kết quả kiểm tra theo `screenshot-guide.md`

| Bước | Kết quả | Ghi chú |
| --- | --- | --- |
| A. Setup | PASS | 12/12 service healthy, 3 init job Exited (0), 3 UI trả 200 |
| 0–1. Config, Docker, network, volume | PASS | 5 volume, subnet 172.30.50.0/24 |
| 2. Web/Blog, 2 replica | PASS | 3 bài blog trả 200, header `X-Web-Server` luân phiên |
| 3. Backend trực tiếp và qua proxy | PASS | `/hello` giống nhau, database healthy, 5 JSON mẫu |
| 4. SQL + CRUD bằng PowerShell | PASS | `studentdb` / `cloud_app`, POST 201, PUT 200, GET 404 sau DELETE |
| 4. SQL từ host (thay SSMS) | PASS | `scripts/test-sql-host.py`: `127.0.0.1,1433`, SQL Login, chạy câu SELECT của bước 4 |
| 4. Ảnh GUI SSMS | NOT TESTED | SSMS chỉ có trên Windows. Mac dùng VS Code extension "SQL Server (mssql)" |
| 5. Keycloak | PASS | Realm 523H0065, `/auth/` 302, không token 401, sv01/sv02 đăng nhập → 200 |
| 6. MinIO | PASS | SHA256 khớp, qua Flask 200 `application/pdf`, S3 ẩn danh 403 |
| 7. DNS Bind9 | PASS | .10/.20/.30/.40, UDP và TCP 1053 từ host |
| 8. Prometheus | PASS | 5/5 target UP, `probe_success`=1 cho cả 2 web |
| 9. Grafana | PASS | Datasource đúng, 3 panel có dữ liệu, tiêu đề có MSSV |
| 10. Round Robin, ping | PASS | 20 request chia 10/10, ping 11 server 0% loss, TCP 1433 OK |
| 11. Persistence + DELETE | PASS | Record và PDF còn nguyên sau restart, xóa bản ghi demo → 404 |
| 12. `verify.ps1 -Browser` | PASS | backend 23, gateway 41, DNS/monitoring 21, auth/storage 24, portal 29 |
| Test UI `test-frontend-browser.py` | PASS | 32 check: CRUD trên UI, upload/download, SSO sv01 → đăng xuất → sv02 |
| Không tràn ngang (390px và 1440px) | PASS | `/`, `/app/`, `/blog/`, `blog1–3.html` |

---

## 3. Lỗi đã sửa

### 3.1. Lỗi chức năng trên giao diện
| Lỗi | Nguyên nhân | File |
| --- | --- | --- |
| Bấm **Đăng nhập Keycloak SSO** trên Portal → Keycloak báo `Missing parameter: code_challenge_method` | Không gửi PKCE, và không có đoạn nào đổi `code` lấy token | `portal.js`, `app.js` |
| Đăng xuất xong không đổi được sang sv02 (Keycloak tự đăng nhập lại sv01) | Nút "Xóa Token" chỉ xóa token trong tab, phiên Keycloak vẫn còn | `portal.js`, `app.js` |
| **Sửa sinh viên** trên UI luôn lỗi 400 | Form không gửi `student_id` | `app.js` |
| Sửa sinh viên làm **mất avatar** | PUT ghi đè cả bản ghi, form không gửi `avatar_key` cũ | `app.js` |
| Tab **Tài liệu** luôn báo "Chưa có tài liệu" | Đọc sai format API (`{files:[{key}]}`) | `app.js` |
| Blog: danh sách bài viết vỡ (gạch chân như link, ảnh rơi xuống dưới), hashtag và "Truy cập nhanh" không có style | HTML đổi tên class nhưng CSS chưa đổi theo | `blog.css` |
| Blog và 3 bài viết tràn ngang trên điện thoại | `body` là flex column, khung bài viết co theo bảng/ảnh | `blog.css` |

Cách đăng nhập hiện tại: Portal → tab **Xác thực** → **Đăng nhập Keycloak SSO**. Keycloak trả về
`/app/` (redirect URI giữ nguyên `/app/*` như hướng dẫn), `/app/` đổi code lấy token rồi quay về
`/#auth`, kết quả `/api/secure` hiện ngay trong tab. Token vẫn lưu ở `sessionStorage.mycloud_access_token`,
nên đoạn DevTools ở bước 5 vẫn dùng được.

### 3.2. Số liệu giả hoặc thông tin sai trên giao diện
- Tab Giám sát: ô "Targets UP" ghi cứng `4 / 4 UP`. Bảng target ghi cứng IP sai và 2 target không tồn tại
  (`backend-api`, `keycloak-sso`). Giờ lấy thật từ Prometheus `/api/v1/targets`.
- Tab Xác thực: ghi cứng "Realm mini-cloud", "localhost:8080". Giờ lấy từ `/api/auth/config`.
- Tab Cân bằng tải: request lỗi hoặc thiếu header bị gán tên server theo chẵn/lẻ (Round Robin giả). Giờ ghi
  "không xác định" và không cộng vào replica nào. Nhãn server1 trước đây dùng màu lỗi (đỏ), đã đổi.
- Card dịch vụ và sơ đồ kiến trúc: sửa tên miền/IP không có thật (`sql.cloud.local → .15`,
  `prometheus.cloud.local → .90`, `gateway.cloud.local`, replica `.11/.12`). Giờ ghi record có trong zone,
  hoặc tên service Docker kèm "IP động".
- Card Keycloak ở Tổng quan: bỏ "Port 8080" và realm "mini-cloud".
- Student App: "Active/Inactive" đổi thành "GPA từ 2.5 / dưới 2.5" cho đúng cách code tính. Bỏ số chuyên
  ngành giả `|| 5`. Nhãn "API Connected" trước là chữ tĩnh, giờ đổi theo kết quả gọi API thật.

### 3.3. Chạy được trên Mac / PowerShell 7 (Windows không đổi)
- `docker-compose.yml`: `platform: linux/amd64` cho SQL Server.
- `scripts/preflight.py`, `scripts/setup.ps1`: chấp nhận Docker ARM64.
- `scripts/health-check.ps1`: đường dẫn `scripts\health-check.py` chỉ chạy được trên Windows.
- `scripts/setup-tools.ps1`, `scripts/verify.ps1`: dùng `.venv/bin/python` khi không phải Windows.
- 3 script test trình duyệt: thêm biến `MYCLOUD_BROWSER_CHANNEL` (mặc định `msedge`).

### 3.4. Giao diện
- **Chế độ sáng/tối (mới)**: nút ☾/☀ ở thanh trên cùng của cả 3 ứng dụng (Portal cạnh nút "Làm mới",
  Student App cạnh "API Connected", Blog cuối thanh điều hướng).
  - `web/html/assets/js/theme.js` (mới): nạp trong `<head>`, áp chế độ trước khi trang hiện (không nháy
    trắng). Lựa chọn lưu trong `localStorage` (`mycloud-theme`), dùng chung cho cả 3 trang. Lần đầu theo
    cài đặt sáng/tối của máy.
  - Chế độ tối dùng tông slate/navy. Các màu viết thẳng trong HTML/JS (inline style) được đổi bằng rule
    riêng trong `theme.css`. Đã dò tự động 15 màn hình ở chế độ tối: không còn khối nền trắng hay chữ
    tương phản thấp (tỉ lệ < 3).
- **`web/html/assets/css/theme.css` (mới)**: nạp sau cùng ở 6 trang HTML. CSS gốc không bị sửa.
  Muốn quay lại giao diện cũ: bỏ dòng `<link href="/assets/css/theme.css">` và
  `<script src="/assets/js/theme.js">` trong 6 file HTML.
  - **Giữ bảng màu gốc của dự án**: sidebar navy `#0f172a` với mục đang chọn tô xanh `#2563eb`, các
    tông slate, icon có nền màu nhạt (xanh, xanh lá, tím, cam) ở thẻ số liệu, logo màu theo từng nhóm dịch
    vụ, màu riêng cho từng chuyên mục blog, banner xanh của Student App và Blog.
  - Làm gọn: banner dạng phẳng (bỏ gradient), bỏ bóng đổ, bỏ hiệu ứng nổi khi hover, bỏ card lồng trong
    card ở các tab, nhãn chữ thường thay vì IN HOA, giới hạn bề rộng nội dung.
  - API Explorer: khối trắng, viền trái và nhãn GET/POST/PUT/DELETE giữ màu theo method.
  - Nhật ký cân bằng tải: trước đây server1 dùng màu lỗi (đỏ). Giờ server1 xanh dương, server2 xanh lá.
- Chữ trong giao diện: Việt hóa menu, tiêu đề, nhãn. Đổi **173 chỗ** "Viết Hoa Mọi Từ" sang viết hoa
  đầu câu, giữ nguyên tên riêng và thuật ngữ. Áp dụng cho cả tiêu đề các mục trong 3 bài blog; nội dung
  bài viết không đổi.
- RAM hiện theo GB (trước là MB). Kích thước file hiện "606 B" thay vì "606.00 B".
- Nhãn "System Healthy", "Healthy", "API Connected" **cố ý giữ tiếng Anh** vì test tự động kiểm tra đúng
  các chữ này.

### 3.5. Test và script
- `scripts/test-frontend-browser.py`: cập nhật theo giao diện mới. Thêm kiểm tra SSO sv01 → đăng xuất →
  sv02, avatar được giữ khi sửa, target Monitoring thật, metrics 503 không hiện số giả. Hiện 32/32 PASS.
- `scripts/test-portal-navigation.py`: kiểm tra RAM theo "GB".
- `scripts/test-auth-browser.py`: bỏ dòng "NOT TESTED … chờ Gemini bàn giao".
- **`scripts/test-sql-host.py` (mới)**: kết nối SQL Server từ host đúng như SSMS, chỉ đọc, không in mật khẩu.
  Đã thêm `python-tds` vào `scripts/requirements-tools.txt`.

### 3.6. Danh sách file đã thay đổi
```
docker-compose.yml                      grafana/dashboards/system-health.json
scripts/preflight.py                    scripts/setup.ps1
scripts/health-check.ps1                scripts/setup-tools.ps1
scripts/verify.ps1                      scripts/requirements-tools.txt
scripts/test-frontend-browser.py        scripts/test-portal-navigation.py
scripts/test-auth-browser.py            scripts/test-sql-host.py            (mới)
web/html/index.html                     web/html/app/index.html
web/html/blog/index.html                web/html/blog/blog1.html, blog2.html, blog3.html
web/html/assets/js/portal.js            web/html/assets/js/app.js
web/html/assets/js/theme.js             (mới)
web/html/assets/css/portal.css          web/html/assets/css/app.css
web/html/assets/css/blog.css            web/html/assets/css/theme.css       (mới)
```
Xem chi tiết từng dòng bằng `git diff`. Sau khi sửa HTML/JS/CSS phải chạy `setup.ps1` **không có**
`-NoBuild` để build lại image web.

---

## 4. Đối chiếu với đề bài cuối kỳ

| Yêu cầu trong đề | Tình trạng |
| --- | --- |
| 9 loại server, chung mạng `cloud-net`, dùng `docker-compose.yml` | Đạt |
| `restart: unless-stopped`, volume | Đạt |
| Phần mở rộng 10 mục (blog, `/student`, studentdb, realm MSSV, MinIO, DNS, job `web`, dashboard MSSV, `/student/`, Round Robin) | Đạt 10/10. Ghi rõ "10/10" trong báo cáo |
| Mỗi service có **tên container riêng** | **Chưa**: chưa đặt `container_name`, container đang tên kiểu `mycloud-web-frontend-server1-1` |
| Lệnh demo trong đề: `localhost:8080` (web), `localhost:8085/hello` (app), `localhost:8081` (Keycloak) | **Không chạy được**: web/app/Keycloak chỉ đi qua gateway port 80. Hoặc mở thêm port, hoặc giải thích trong báo cáo |
| MinIO: "lấy URL public object và kiểm tra truy cập" | **Lệch**: bucket để private (truy cập ẩn danh 403), tải qua Flask. Cần quyết định đổi hay giải thích |
| Database gợi ý MySQL/MariaDB | Dùng SQL Server 2022. Hợp lệ (đề chỉ gợi ý), nhưng phải giải thích và đổi lệnh demo |
| **Push ít nhất 1 image lên Docker Hub** | **Chưa làm** (xem `docs/docker-hub.md`) |
| **Deploy AWS EC2 Ubuntu, chạy qua public IP** | **Chưa làm** (xem `docs/deployment.md`) |
| Báo cáo chương 1–5 và phụ lục (link Docker Hub, video demo, log) | **Chưa có** bản báo cáo theo đúng cấu trúc đề |

---

## 5. Việc cần làm tiếp (theo thứ tự ưu tiên)

### Bắt buộc theo đề
1. **Docker Hub**: `docker login`, tag và push ít nhất 1 image tự build (ví dụ `mycloud-web:1.0.0` hoặc
   `mycloud-app:1.0.0`), rồi ghi link và digest vào phụ lục. Các lệnh có trong `docs/docker-hub.md`.
2. **AWS EC2**: cần tài khoản AWS và **có tốn phí**.
   - Chọn Ubuntu x86_64, RAM ≥ 4 GB (ví dụ t3.medium), vì SQL Server không chạy trên ARM/Graviton.
   - Đặt `PUBLIC_URL=http://<IP public>` trong `.env` trước khi chạy setup, vì issuer và redirect của
     Keycloak phụ thuộc giá trị này.
   - Grafana (3000), MinIO (9000/9001), Prometheus (9090), SQL (1433), DNS (1053) đang bind `127.0.0.1`.
     Muốn mở qua public IP thì phải đổi port mapping và mở Security Group. Chỉ mở những port cần demo.
3. **Báo cáo cuối kỳ** theo đề: Chương 1–5 và phụ lục. Có thể lấy tư liệu từ `docs/architecture.md`,
   `docs/testing.md` và mục 2–4 của file này. Quay **video demo** cả phần UI lẫn PowerShell.
4. Quyết định các điểm lệch so với đề ở mục 4: `container_name`, port 8080/8085/8081, URL public của MinIO.
   Làm theo đề hoặc giải thích lý do trong báo cáo.

### Cập nhật hướng dẫn và ảnh minh chứng
5. **`screenshot-guide.md` bước 5 đã cũ**: đăng nhập giờ ở Portal → tab **Xác thực**, không còn ở `/app/`.
   Sửa cả `docs/screenshot-guide.md` và `guide/screenshot-guide.md`/`.html`.
6. **Chụp lại toàn bộ ảnh UI**, vì giao diện đã đổi hẳn. Ảnh lệnh PowerShell vẫn dùng được nếu kết quả
   không đổi. Nhớ ảnh Grafana và Keycloak phải thấy MSSV 523H0065.
7. Thêm phần chạy trên Mac (mục 1 của file này) vào hướng dẫn, nếu demo trên Mac.
8. **Sửa nội dung bài blog 3** (`web/html/blog/blog3.html`): bảng "Bóc tách 9 nhóm dịch vụ" và vài đoạn
   ghi thông tin không khớp hệ thống thật, gồm `sqlserver.cloud.local`, `gateway.cloud.local`,
   `dns.cloud.local`, `prometheus.cloud.local` (không có trong zone `dns/db.cloud.local`), realm
   `mini-cloud` (thực tế là MSSV), tên container `database-sqlserver-2022`, `dns-bind9-server` (thực tế là
   `relational-database-server`, `internal-dns-server`). Đây là nội dung bạn viết nên chưa tự sửa.
9. Nếu chụp ảnh nộp, chọn một chế độ (sáng hoặc tối) và chụp thống nhất cho tất cả.
10. Ảnh GUI SSMS: chụp trên máy Windows nếu giảng viên bắt buộc SSMS. Nếu không, dùng VS Code extension
   "SQL Server (mssql)" với Server `127.0.0.1,1433`, SQL Login `DB_USER`/`DB_PASSWORD`,
   Database `studentdb`, Trust server certificate = Yes.

### Kỹ thuật nhỏ (không chặn demo)
11. Thêm `scripts/test-frontend-browser.py` vào `verify.ps1 -Browser`. Script tự dọn record/object test.
12. Bảng "Nhật ký kiểm tra sức khỏe" ở Tổng quan ghi "HTTP Probe" cho mọi dịch vụ, kể cả Database và DNS
    (thực tế là truy vấn SQL/DNS). Nên lấy loại probe từ `/api/status`.
13. Thẻ thống kê của Student App tính theo danh sách đang lọc, nên khi gõ tìm kiếm thì "Tổng sinh viên"
    thay đổi theo.
14. Biến `currentStatusData` trong `portal.js` khai báo nhưng không dùng.
15. Commit các thay đổi lên branch riêng (đừng commit thẳng `main`). **Không commit `.env`.**

---

## 6. Dữ liệu đang có trong hệ thống

- SQL: 3 bản ghi mẫu SV001–SV003. Bản ghi demo đã xóa ở bước 11, fixture test tự dọn.
- MinIO `documents`: 1 PDF minh chứng `e6fa63a5ebd34183a5492f91910aea44.pdf` upload ở bước 6, để lại theo
  hướng dẫn.
- Keycloak realm `523H0065` có user sv01, sv02 (mật khẩu `DEMO_USER_PASSWORD` trong `.env`).
