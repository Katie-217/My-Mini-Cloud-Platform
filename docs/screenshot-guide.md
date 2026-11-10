# Hướng dẫn chạy lệnh và chụp minh chứng MyMiniCloud

Đối chiếu PDF [Báo Cáo Cuối Kỳ.docx.pdf](<Báo Cáo Cuối Kỳ.docx.pdf>), trang
12–20 (kiểm thử cơ bản), 21–27 (mở rộng), và [master plan](master-implementation-plan.md).
Làm lần lượt trên **PowerShell Windows**, trong cùng một cửa sổ để giữ biến CRUD.
Mỗi ảnh nên thấy lệnh, kết quả và URL/tên service. Lưu ảnh cá nhân ngoài thư mục
source, hoặc trong `.runtime/screenshots/` đã được Git ignore.

## 0. Chuẩn bị và cách đọc kết quả

```powershell
Set-Location 'D:\Cuối kì computing'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
docker compose -p mycloud config --quiet
python scripts/health-check.py --require-frontend
```

Kỳ vọng: lệnh config không xuất lỗi; health báo 12/12 reachable, ba UI HTTP 200,
metrics có dữ liệu. Nếu Docker chưa chạy project, bật Docker Desktop rồi chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1 -NoBuild -RequireFrontend
```

Nếu vừa sửa HTML/JS hoặc chưa có image, bỏ `-NoBuild` để build lại.
`curl.exe` trong hướng dẫn là curl thật; `curl` trong PowerShell 5 có thể là alias.
Không chụp `.env`, resolved `docker compose config` hoặc token/password.
Credential xem riêng trong `.env` bằng editor, không dùng `Get-Content .env` khi chụp.

Các điểm thay đổi so với ví dụ của PDF:

| Ví dụ trong đề | Bản đang chạy và cách giải thích |
| --- | --- |
| MariaDB/MySQL, notes/minicloud | SQL Server theo yêu cầu người dùng; studentdb.dbo.students, IDENTITY thay AUTO_INCREMENT |
| Backend host :8085, web :8080, Keycloak :8081 | Backend/web chỉ nội bộ; gateway localhost:80 và Keycloak `/auth/` |
| IP 10.10.10.x | Subnet đã khảo sát riêng 172.30.50.0/24; đối chiếu zone với IP thật |
| Credential admin/admin, minioadmin | Password ngẫu nhiên trong `.env` |
| Bucket demo/index.html hoặc object public | Hai bucket profile-pics/documents, PNG/JPEG và PDF; private, đọc qua backend |
| Scrape web:80 trực tiếp | Blackbox Exporter probe HTTP hai web, Prometheus scrape kết quả probe |
| 9 container | 9 nhóm; 12 container thường trực do có web replica và exporter; 3 init jobs riêng |

Realm và tiêu đề dashboard còn `MSSV_PLACEHOLDER`: phải thay bằng MSSV thật trước
khi chụp bản nộp cuối. Đừng ghi placeholder là đã đáp ứng yêu cầu cá nhân hóa.

## 1. Cấu hình Docker, network và volume — ảnh 01–03

```powershell
docker compose -p mycloud ps -a
docker compose -p mycloud images
docker volume ls --filter label=com.docker.compose.project=mycloud
docker network inspect cloud-net --format '{{json .IPAM.Config}}'
docker network inspect cloud-net --format '{{range .Containers}}{{println .Name .IPv4Address}}{{end}}'
```

**Kỳ vọng:** 12 service thường trực running, 3 init jobs Exited (0), 5 named
volumes; subnet `172.30.50.0/24`. Exited (0) của init job là thành công.
Hai exporter không khai báo Docker healthcheck nên cột health có thể trống;
bước Prometheus bên dưới kiểm tra endpoint/metric thực tế.

Chụp các đoạn cấu hình trong VS Code:

- `docker-compose.yml`: services, healthcheck/depends_on, mạng cloud-net,
  volumes và port SQL 1433/DNS 1053. Các `${...}` là tham chiếu biến, không phải
  mật khẩu đã resolve. Chụp source, không chụp tab `.env`.
- `app/database.py`: ODBC Driver 18, DB_HOST/service name, mã đọc password từ env.
- `db/init/001_init.sql`: CREATE DATABASE/schema, IDENTITY và dữ liệu seed.

**Giải thích:** Compose tạo tài nguyên riêng cho mycloud; các container liên lạc
qua cloud-net và service name, volume lưu dữ liệu ngoài vòng đời container.

## 2. Web/Blog và hai replica — ảnh 04–06

```powershell
curl.exe -sI http://localhost/
curl.exe -sI http://localhost/blog/
curl.exe -sI http://localhost/blog/posts/
curl.exe -sI http://localhost/app/
docker compose -p mycloud exec -T api-gateway-proxy-server wget -qO- http://web-frontend-server1/__replica
docker compose -p mycloud exec -T api-gateway-proxy-server wget -qO- http://web-frontend-server2/__replica
```

**Kỳ vọng:** UI trả HTTP 200, header `X-Web-Server` cho biết replica xử lý;
hai lệnh nội bộ trả JSON nhận diện web-frontend-server1 và web-frontend-server2.

Mở và chụp Portal `http://localhost/`, Blog `http://localhost/blog/`, danh sách
`http://localhost/blog/posts/`; mở từng `blog1.html`, `blog2.html`, `blog3.html`
dưới `/blog/`. Ảnh phải thấy nội dung, ảnh minh họa và liên kết quay về danh sách.

**Luồng:** Browser → gateway Nginx → một trong hai web → HTML/CSS/JS/ảnh.
Blog tĩnh không truy vấn database.

## 3. Backend trực tiếp và qua Reverse Proxy — ảnh 07–08

```powershell
docker compose -p mycloud exec -T api-gateway-proxy-server wget -qO- http://application-backend-server:8081/hello
curl.exe -i http://localhost/api/hello
curl.exe -s http://localhost/api/health
curl.exe -s http://localhost/api/student
curl.exe -s http://localhost/student/
```

**Kỳ vọng:** cả hello nội bộ và public có:

```json
{"message":"Hello from App Server!","service":"application-backend-server"}
```

Health trả `database=healthy`, `status=healthy`. `/api/student` và `/student/`
trả cùng danh sách **5 sinh viên** từ JSON, gồm id/name/major/gpa. Có thể xem dễ hơn:

```powershell
Invoke-RestMethod http://localhost/api/student | Format-Table
```

Chụp `proxy/nginx.conf`: upstream flask_backend, location `/api/`, `/student/`.
**Giải thích:** `/api/hello` đi qua gateway, bỏ prefix `/api/` rồi Flask nhận
`/hello`. Lệnh nội bộ thay cho cổng host8085 trong đề vì backend không publish host.

## 4. SQL Server, dữ liệu seed và CRUD — ảnh 09–13

Truy vấn SQL thật từ chính container Flask bằng ODBC, không cần in credential:

```powershell
docker compose -p mycloud exec -T application-backend-server python -c "import json; from database import connection; c=connection(); print(c.execute('SELECT DB_NAME(), USER_NAME()').fetchone()); q=c.execute('SELECT id,student_id,fullname,dob,major FROM dbo.students ORDER BY id'); print(json.dumps([dict(zip([d[0] for d in q.description],row)) for row in q],ensure_ascii=False,default=str,indent=2)); c.close()"
Invoke-RestMethod http://localhost/api/students-db | Format-Table id,student_id,fullname,dob,major,gpa
```

**Kỳ vọng:** database studentdb, user cloud_app và ít nhất 3 bản ghi mẫu.
Đây là kết nối **Flask container → SQL Server**, không phải dữ liệu JSON tĩnh.

Tạo đúng một record demo riêng; mã ngẫu nhiên để không đụng dữ liệu cũ:

```powershell
$demoCode = 'S' + [guid]::NewGuid().ToString('N').Substring(0,7)
$payload = @{
    student_id = $demoCode
    fullname = 'Nguyễn Minh Chứng'
    dob = '2004-05-12'
    major = 'Điện toán đám mây'
    gpa = 3.5
}
$body = [System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))
$created = Invoke-WebRequest -UseBasicParsing -Method Post -Uri http://localhost/api/students-db -ContentType 'application/json; charset=utf-8' -Body $body
$demoStudent = $created.Content | ConvertFrom-Json
$demoId = $demoStudent.id
$created.StatusCode
$demoStudent | Format-List
```

**Kỳ vọng:** HTTP **201**, id thật, đúng mã demo và tiếng Việt không lỗi font.
Mở Student App → Quản lý sinh viên → làm mới/tìm `$demoCode`. Chụp API và UI
cùng record. Trong SSMS: server `127.0.0.1,1433`, SQL Server Authentication,
DB_USER/DB_PASSWORD trong `.env`, database studentdb; trust certificate local.

```sql
USE studentdb;
SELECT id, student_id, fullname, dob, major, gpa, avatar_key, created_at
FROM dbo.students ORDER BY id DESC;
```

Chụp tab kết quả sau khi kết nối; đóng hộp đăng nhập trước khi chụp.
Đọc/sửa/tìm lại chính record vừa tạo:

```powershell
Invoke-RestMethod "http://localhost/api/students-db/$demoId" | Format-List
$payload.gpa = 3.9
$body = [System.Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))
$updated = Invoke-WebRequest -UseBasicParsing -Method Put -Uri "http://localhost/api/students-db/$demoId" -ContentType 'application/json; charset=utf-8' -Body $body
$updated.StatusCode
$updated.Content
Invoke-RestMethod "http://localhost/api/students-db?q=$demoCode" | Format-List
```

**Kỳ vọng:** PUT **200**, GPA **3.9** trong API, UI và SSMS. Giữ record này tới
bước persistence; chỉ xóa nó ở bước 11. Không dùng ID 1/2/3 để demo DELETE.

**Luồng:** Browser/PowerShell → gateway → Flask → ODBC18 → SQL Server → JSON.

## 5. Keycloak, hai user và secure API — ảnh 14–17

```powershell
curl.exe -sI http://localhost/auth/
Invoke-RestMethod http://localhost/api/auth/config | Format-List
curl.exe -i http://localhost/api/secure
```

**Kỳ vọng:** `/auth/` hiện trả **302** về `/auth/admin/`; tiếp tục truy cập Admin
Console mới đi vào luồng login khi chưa có session. Auth config có issuer,
client_id=flask-app và token_endpoint. Secure không token trả **401** và JSON lỗi.

Mở `http://localhost/auth/admin/`, đăng nhập bằng KEYCLOAK_ADMIN và
KEYCLOAK_ADMIN_PASSWORD từ `.env`. Chụp:

1. Realm hiện tại → Users: đủ **sv01, sv02**.
2. Clients → **flask-app**: client public (Client authentication Off),
   Standard flow bật, PKCE S256 và redirect URI `/app/`.
3. Nếu cần minh chứng thao tác tạo user theo đề: Users → Add user, đặt một tên
   mới riêng (không tạo trùng sv01/sv02), Save → Credentials → Set password.
   Chụp sau khi lưu, không chụp trường password.

Mở `http://localhost/app/` → Đăng nhập Keycloak → login **sv01** bằng
DEMO_USER_PASSWORD. Chụp kết quả backend xác minh `/api/secure`: HTTP200,
`message=Secure resource OK`, `preferred_username=sv01`, subject có giá trị.
Logout rồi thử **sv02** để có ảnh thứ hai.

Muốn thấy rõ HTTP status/JSON trong DevTools Console mà không in token, chạy
trong tab Student App **sau khi đã login**:

```javascript
(async () => {
  const response = await fetch('/api/secure', {
    headers: {Authorization: 'Bearer ' + sessionStorage.getItem('mycloud_access_token')}
  });
  console.log('HTTP', response.status, await response.json());
})();
```

Không mở phần Request Headers chứa Authorization khi chụp. Frontend dùng
Authorization Code + PKCE; không dùng password grant/copy token công khai.

**Luồng:** Browser ↔ Keycloak lấy token; Browser → gateway → Flask `/secure`;
Flask lấy JWKS Keycloak và xác minh chữ ký RS256/issuer/audience/hạn token.

## 6. MinIO avatar/PDF và tải về — ảnh 18–20

Trong Student App: thêm sinh viên demo có avatar PNG/JPEG; tab Lưu trữ tệp
upload PDF thật. Chụp thông báo thành công, avatar và file trong danh sách.
Mở `http://localhost:9001`, login bằng MINIO_ROOT_USER/MINIO_ROOT_PASSWORD,
chụp bucket **profile-pics** chứa ảnh và **documents** chứa PDF tương ứng.

Xem metadata từ API:

```powershell
$documents = Invoke-RestMethod 'http://localhost/api/files?bucket=documents'
$documents.files | Format-Table key,size,last_modified,download_url -AutoSize
$avatars = Invoke-RestMethod 'http://localhost/api/files?bucket=profile-pics'
$avatars.files | Format-Table key,size,last_modified -AutoSize
```

Chọn đúng PDF vừa upload trong danh sách; thay REPLACE_WITH_OBJECT_KEY bằng key:

```powershell
$pdfKey = 'REPLACE_WITH_OBJECT_KEY'
curl.exe -sI "http://localhost/api/files/documents/$pdfKey"
curl.exe -sI "http://localhost:9000/documents/$pdfKey"
```

**Kỳ vọng:** đường qua Flask **200**, Content-Type application/pdf; đường S3
anonymous **403**. Bucket private; backend cung cấp đường đọc file của demo local.
File đã upload phải xuất hiện thật trong Console, không chỉ có thông báo UI.

Nếu muốn upload bằng lệnh (chọn PDF có sẵn trên máy):

```powershell
$pdfPath = 'C:\duong-dan\bao-cao.pdf'
$uploadJson = curl.exe -sS -F 'bucket=documents' -F "file=@$pdfPath;type=application/pdf" http://localhost/api/files
$upload = $uploadJson | ConvertFrom-Json
$upload | Format-List
New-Item -ItemType Directory -Force .runtime\screenshots | Out-Null
$downloadPath = Join-Path $PWD '.runtime\screenshots\downloaded-report.pdf'
curl.exe -sS --fail -o $downloadPath "http://localhost$($upload.download_url)"
Get-FileHash -Algorithm SHA256 -LiteralPath $pdfPath,$downloadPath | Format-Table
```

**Kỳ vọng:** hai SHA256 bằng nhau. Chỉ chạy khi đã thay đường dẫn PDF thật.
**Luồng:** Browser/curl → gateway → Flask multipart → MinIO S3 → object metadata;
download theo chiều ngược lại. Không dùng bucket demo/index.html của ví dụ cơ bản.

## 7. DNS Bind9 và phân biệt Docker DNS — ảnh 21–22

Chụp `dns/named.conf`, `dns/named.conf.local`, `dns/db.cloud.local` trong editor.
Sau đó:

```powershell
docker compose -p mycloud exec -T internal-dns-server named-checkconf
docker compose -p mycloud exec -T internal-dns-server dig '@127.0.0.1' web-frontend-server.cloud.local +short
docker compose -p mycloud exec -T internal-dns-server dig '@127.0.0.1' app-backend.cloud.local +short
docker compose -p mycloud exec -T internal-dns-server dig '@127.0.0.1' minio.cloud.local +short
docker compose -p mycloud exec -T internal-dns-server dig '@127.0.0.1' keycloak.cloud.local +short
python scripts/test-dns-host.py
```

**Kỳ vọng:** config không lỗi; lần lượt **172.30.50.10**, **.20**, **.30**,
**.40**. Test từ Windows host báo PASS cả **UDP và TCP 127.0.0.1:1053**,
authoritative A record .20. Trong container Bind9 dùng port53; từ host dùng1053.
Record web trỏ **gateway .10**, không trỏ IP động của một web replica.

Truy vấn Bind9 từ container khác:

```powershell
docker compose -p mycloud exec -T api-gateway-proxy-server nslookup app-backend.cloud.local 172.30.50.53
docker compose -p mycloud exec -T api-gateway-proxy-server nslookup application-backend-server
```

**Giải thích:** lệnh đầu hỏi Bind9 cho zone cloud.local; lệnh sau hỏi Docker DNS
cho service name. Ping service name thành công riêng lẻ chưa chứng minh Bind9.

## 8. Prometheus → exporter → web — ảnh 23–25

Chụp `monitor/prometheus.yml`: jobs node, prometheus, blackbox và web, cùng
relabel_configs chuyển target web tới Blackbox Exporter.

```powershell
$targets = Invoke-RestMethod 'http://localhost:9090/api/v1/targets'
$targets.data.activeTargets | Select-Object @{n='Job';e={$_.labels.job}},@{n='Instance';e={$_.labels.instance}},health | Format-Table -AutoSize
$probe = Invoke-RestMethod 'http://localhost:9090/api/v1/query?query=probe_success'
$probe.data.result | ForEach-Object { [pscustomobject]@{Job=$_.metric.job;Instance=$_.metric.instance;Value=$_.value[1]} } | Format-Table -AutoSize
```

**Kỳ vọng:** 5 targets UP (Prometheus, node, blackbox và hai web), hai
probe_success=**1**. `up=1` của web job chỉ nói scrape exporter thành công;
probe_success=1 mới chứng minh web đích phản hồi HTTP thành công.

Mở `http://localhost:9090/targets`, chụp targets. Trong trang Query/Graph thử
lần lượt, chụp bảng series hoặc đồ thị có sample:

```promql
up
node_cpu_seconds_total
probe_success{job="web"}
100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])))
```

**Luồng:** Prometheus scrape Node Exporter :9100 để lấy metric CPU/RAM/network;
với job web, Prometheus gọi Blackbox :9115/probe, Blackbox gọi web /health.
Không scrape HTML Nginx như Prometheus metrics.

## 9. Grafana → Prometheus, ba biểu đồ thật — ảnh 26–27

Chụp `grafana/provisioning/datasources/prometheus.yml`: URL nội bộ
`http://monitoring-prometheus-server:9090`, access proxy, UID prometheus.
Đăng nhập `http://localhost:3000` bằng GRAFANA_ADMIN_USER/GRAFANA_ADMIN_PASSWORD.
Mở Connections → Data sources → Prometheus, chụp URL/data source đã provision;
không tạo datasource trùng. Mở:

`http://localhost:3000/d/mycloud-system`

Chọn Last 15 minutes/Refresh5s, chờ vài chu kỳ nếu vừa khởi chạy. Chụp đủ
CPU Usage, Memory Usage, Network Traffic có đường dữ liệu, không No data.
Nếu cần query, xem `grafana/dashboards/system-health.json` hoặc panel Inspect/Query.

**Giải thích:** Grafana query Prometheus qua mạng cloud-net. CPU/RAM đo Linux
VM/kernel của Docker Desktop; mạng thuộc namespace Node Exporter. Không ghi
đây là số liệu toàn Windows host hoặc tổng mọi container.

## 10. Routing, Round Robin và ping các server — ảnh 28–31

Chụp `proxy/nginx.conf`: web_pool có hai server, location `/api/`, `/auth/`,
`/student/` và `/`. Kiểm tra cấu hình Nginx:

```powershell
docker compose -p mycloud exec -T api-gateway-proxy-server nginx -t
curl.exe -sI http://localhost/
curl.exe -s http://localhost/api/hello
curl.exe -sI http://localhost/auth/
curl.exe -s http://localhost/student/
$replicas = 1..20 | ForEach-Object { (Invoke-RestMethod http://localhost/__replica).replica }
$replicas
$replicas | Group-Object | Select-Object Name,Count | Format-Table -AutoSize
```

**Kỳ vọng:** nginx syntax ok; web200, API JSON, auth302, /student/5 mẫu;
cả hai replica đều xuất hiện. Khi không có traffic web khác xen vào, thường
20 request chia10/10; không bắt buộc luân phiên tuyệt đối trên màn hình nếu
browser/healthcheck đang phát sinh thêm request.

Ping **từ container gateway** tới các server còn lại (đề trang20). Windows host
không dùng trực tiếp Docker service name. Không cần cài ping vào các image khác:

```powershell
$servers = @(
  'web-frontend-server1','web-frontend-server2','application-backend-server',
  'relational-database-server','authentication-identity-server','object-storage-server',
  'internal-dns-server','monitoring-node-exporter-server','monitoring-http-exporter-server',
  'monitoring-prometheus-server','monitoring-grafana-dashboard-server'
)
foreach ($server in $servers) {
    docker compose -p mycloud exec -T api-gateway-proxy-server ping -c 1 -W 2 $server
    if ($LASTEXITCODE -ne 0) { throw "Ping failed: $server" }
}
```

**Kỳ vọng:** 11 đích có reply, 0% packet loss. IP động của web/SQL/exporter có
thể đổi sau recreate; dùng service name. Đây là gateway → mọi server, không
phải đã thử tất cả cặp server. Ping chỉ xác nhận ICMP; các bước API/SQL/file/metrics
mới chứng minh ứng dụng tương tác thật.

Muốn minh chứng port SQL được kết nối từ gateway:

```powershell
docker compose -p mycloud exec -T api-gateway-proxy-server nc -z -w 3 relational-database-server 1433
if ($LASTEXITCODE -eq 0) { 'PASS: gateway -> SQL Server TCP 1433' }
```

## 11. Persistence SQL/MinIO — ảnh 32–33, tùy chọn lúc demo

Đảm bảo đang giữ `$demoId` từ bước4 và đã upload ảnh/PDF bước6. Các lệnh restart
dưới đây gây gián đoạn ngắn đúng hai service mycloud; thực hiện sau các ảnh khác.
Không dừng toàn hệ thống hoặc xóa volume.

```powershell
Invoke-RestMethod "http://localhost/api/students-db/$demoId" | Format-List
docker compose -p mycloud restart relational-database-server object-storage-server
```

Chờ Docker báo SQL/MinIO healthy bằng `docker compose -p mycloud ps`, rồi:

```powershell
python scripts/health-check.py --require-frontend
Invoke-RestMethod "http://localhost/api/students-db/$demoId" | Format-List
Invoke-RestMethod 'http://localhost/api/files?bucket=documents' | ConvertTo-Json -Depth 5
```

Chụp record trước/sau vẫn cùng id/mã/GPA; mở lại MinIO và tải đúng PDF/ảnh cũ.
Nếu đã có `$upload`/`$pdfPath` ở bước6, download lại và đối chiếu SHA256 lần nữa.
**Giải thích:** dữ liệu SQL/MinIO lưu trong named volumes, restart không làm mất.
Restart giữ nguyên container ID; không gọi đó là bằng chứng recreate.
Recreate SQL/MinIO đã có bài test riêng ghi tại [testing.md](testing.md).

Sau khi chụp xong, xóa **đúng record demo tạo bằng lệnh** và chụp kết quả:

```powershell
Invoke-RestMethod -Method Delete "http://localhost/api/students-db/$demoId"
curl.exe -i "http://localhost/api/students-db/$demoId"
```

**Kỳ vọng:** DELETE trả message Student deleted/id; GET lại **404**.
Các file/người dùng bạn chủ động tạo để làm minh chứng được giữ lại; không
chạy script xóa rộng để dọn. Tránh chụp ảnh rồi tự mô tả kết quả chưa chạy là PASS.

## 12. Tổng kết và đối chiếu minh chứng

Có thể chạy lại kiểm tra tự động để chụp dòng tổng kết:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-backend.ps1
python scripts/test-proxy.py --frontend-ready
python scripts/test-dns-host.py
docker compose -p mycloud run --rm --no-deps integration-check python /checks/test-monitoring.py --with-web
```

Các script test dùng fixture riêng và dọn fixture; không thay thế ảnh UI cấu hình.
Nếu giao diện đã đổi sau lần nghiệm thu cũ, chỉ ghi PASS UI khi đã thao tác lại
hoặc chạy browser test tương ứng trên bản mới.

| Hạng mục đề bài | Ảnh cần có | Chứng minh |
| --- | --- | --- |
| Compose/network/volume | 01–03 | Tài nguyên mycloud, cấu hình và persistence mount |
| Web/Blog mở rộng | 04–06 | Website thật, đủ 3 bài, ảnh/backlink |
| Backend/JSON | 07–08 | Hello nội bộ/public giống nhau; 5 JSON samples |
| SQL Server/CRUD | 09–13 | Seed, query, record API/UI/SSMS khớp |
| Keycloak | 14–17 | Realm/client/2 user, 401 và authenticated200 |
| MinIO | 18–20 | Avatar/PDF trong bucket, tải đúng file, private |
| DNS | 21–22 | Zone đúng, dig/UDP/TCP và Bind9 từ container khác |
| Prometheus | 23–25 | Targets UP, metric sample, probe_success=1 |
| Grafana | 26–27 | Datasource và ba biểu đồ dữ liệu |
| Proxy/Round Robin/mạng | 28–31 | Route/header, hai replica nhận request, ping11 đích |
| Persistence và DELETE | 32–33 | Giữ record/file sau restart; xóa đúng demo record |

Các kết quả lệnh chỉ đọc đã kiểm lại khi soạn ngày10/11/2026: hello/health,
auth302/config, query SQL từ Flask, bucket list, DNS, targets/probe và ping11
đích PASS. Các bước GUI, CRUD thủ công, upload đường dẫn cá nhân và restart ở
tài liệu này là **hướng dẫn để bạn tự chạy/chụp**, không tự suy thành PASS mới.
SSMS GUI/Docker Hub/AWS vẫn NOT TESTED cho đến khi có thao tác thật tương ứng.
