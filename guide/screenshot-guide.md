# MyMiniCloud — Bàn giao, setup Docker và test thủ công

Dành cho người nhận source dựng hệ thống trên Windows x86_64. Dùng PowerShell,
làm lần lượt từ đầu và giữ cùng cửa sổ khi dùng các biến CRUD.

**Bản gửi riêng: screenshot-guide.html** chứa toàn bộ hướng dẫn, lệnh, ý nghĩa,
cách đọc response và ảnh nhúng ngay trong từng bước. Mở bằng Edge/Chrome, không
cần thư mục ảnh đi kèm; không có tài liệu ảnh riêng. Markdown này là bản nguồn.

Ảnh console hiển thị transcript của lệnh đã chạy thật, có timestamp và exit code;
không phải ảnh cửa sổ PowerShell. Ảnh UI chụp trình duyệt thật. Số liệu, ID, key và
IP động trên máy mới có thể khác; không dùng ảnh mẫu để đánh dấu máy mới đã PASS.

## A. Chuẩn bị máy mới và dựng toàn bộ container

1. Cài [Git for Windows](https://git-scm.com/install/windows).
2. Cài Python 3.10+; máy hiện tại dùng 3.12. Thêm Python vào PATH và mở PowerShell
   mới; xem [hướng dẫn Python Windows](https://docs.python.org/3.12/using/windows.html).
3. Cài [Docker Desktop x86_64](https://docs.docker.com/desktop/setup/install/windows-install/).
   Chọn WSL2 backend và Linux containers; bật virtualization nếu được yêu cầu.
   Nếu chưa có WSL, làm theo mục WSL trong hướng dẫn Docker, restart Windows khi
   trình cài yêu cầu. Script dự án không tự sửa BIOS/firewall/Windows services.
4. Mở Docker Desktop, đợi engine sẵn sàng. Máy đã chạy có khoảng 15.48 GiB RAM
   cấp cho Docker; đây là cấu hình tham khảo, chưa benchmark mức tối thiểu.
   Cần Internet lần đầu để pull image và build MinIO từ source Go.
5. Microsoft Edge dùng cho browser tests; SSMS tùy chọn để chụp SQL GUI.
   Backend/SQL/ODBC chạy trong Docker, không cần cài SQL Server/ODBC trên host.

Clone repository của nhóm:

```powershell
Set-Location D:\
git clone https://github.com/Katie-217/My-Mini-Cloud-Platform.git mycloud
Set-Location .\mycloud
git status
python scripts/init-env.py
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
```

**Ý nghĩa:** clone tải source/lịch sử; Set-Location đổi thư mục; status xem branch;
init-env sinh password riêng trong .env nếu thiếu. Setup kiểm tra công cụ,
thử mở Docker Desktop nếu engine chưa chạy, kiểm port/subnet/ownership, build,
chạy Compose và chờ readiness. Chạy lại giữ nguyên env và dữ liệu volume.

**Đọc kết quả:** cuối setup cần PASS, 12/12 probe, metrics có dữ liệu, ba UI200.
Init jobs Exited(0) là hoàn tất đúng. Không dùng -NoBuild ở máy mới/chưa có image
hoặc sau sửa HTML/JS/Dockerfile. -ExecutionPolicy Bypass chỉ cho tiến trình này,
không đổi policy toàn máy; -NoProfile bỏ cấu hình PowerShell cá nhân.

| Thành phần | Tự chuẩn bị khi chạy setup |
| --- | --- |
| Network/volumes | cloud-net172.30.50.0/24 và 5 named volumes |
| Web/backend | 2 Nginx cùng image Portal/Blog/Student; Flask/Gunicorn/ODBC18 |
| SQL Server | studentdb.dbo.students, cloud_app, ít nhất 3 seed |
| Keycloak | Realm từ env, flask-app public/PKCE S256, sv01/sv02 |
| MinIO | Buckets private profile-pics/documents |
| DNS | Bind9 cloud.local, host1053 TCP/UDP |
| Monitoring/Grafana | Prometheus/Node/Blackbox, hai web targets, datasource và 3 panel |
| Gateway | Port80, /api/, /auth/, /student/ và Round Robin |

Mở .env bằng editor để xem tài khoản từng server. Không lấy env từ máy khác hoặc
xóa/tạo lại khi đã có volume. Realm chung mặc định là `521H0092-523H0065`,
ghi nhận cả hai thành viên. Dashboard có tiêu đề `System Health of 521H0092 & 523H0065`.
Máy đã chạy realm cũ: đặt `OIDC_REALM=521H0092-523H0065` trong `.env`, rồi chạy
lại `scripts/setup.ps1`. Bootstrap tạo realm chung; realm cũ vẫn giữ trong volume.
PUBLIC_URL=http://localhost phục vụ demo tại máy đó; đổi host cần chỉnh cả OIDC
issuer/redirect và truy cập port quản trị đang bind loopback.

Ảnh dưới là kiểm tra công cụ và setup -NoBuild trên máy đang có image/volume,
không phải bằng chứng cài OS hay deploy trên máy riêng của partner.

<!-- evidence:versions -->
<!-- evidence:setup -->

## 0. Chuẩn bị và cách đọc kết quả

```powershell
# Thay bằng thư mục đã clone trên máy bạn:
Set-Location 'D:\mycloud'
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

Realm và tiêu đề dashboard phải ghi nhận cả `521H0092` và `523H0065` trước
khi chụp bản nộp cuối. Đừng ghi placeholder là đã đáp ứng yêu cầu cá nhân hóa.

## 1. Cấu hình Docker, network và volume

**Ý nghĩa/cách đọc lệnh:** config --quiet kiểm schema/env mà không in resolved
secret; ps -a xem cả jobs đã dừng; volume ls --filter chỉ liệt kê mycloud;
network inspect xem subnet/IP thực tế. Exit0 và không lỗi là config hợp lệ.
Những lệnh này không xóa hoặc sửa tài nguyên.

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

<!-- evidence:resources -->

## 2. Web/Blog và hai replica

**Ý nghĩa:** curl.exe là curl thật, -s bỏ progress, -I gửi HEAD chỉ lấy header;
exec -T chạy trong container không TTY; wget -qO- in body ra stdout.
HTTP200 là thành công;302/Location là redirect; X-Web-Server nhận diện replica.
HEAD200 cần kiểm thêm nội dung UI. Có thể thêm --max-time15 để tránh đợi lâu.

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

<!-- evidence:web -->
<!-- ui:portal-ui -->
<!-- ui:blog-ui -->

## 3. Backend trực tiếp và qua Reverse Proxy

**Ý nghĩa:** lệnh wget chạy từ gateway đến Flask nội bộ bằng service name;
curl -i in cả status/header/body. Invoke-RestMethod parse JSON thành object,
Format-Table chỉ định dạng, không ghi dữ liệu. So sánh hello nội bộ/public để
chứng minh proxy chuyển tiếp đúng. JSON5mẫu khác với bảng SQL bên dưới.

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

<!-- evidence:backend -->

## 4. SQL Server, dữ liệu seed và CRUD

**Ý nghĩa query:** Python -c chạy đoạn ngắn trong app, connection() lấy credential
env mà không in connection string. DB_NAME/USER_NAME xác nhận DB/login; SELECT
đọc bảng rồi serialize JSON, close() đóng kết nối. Cần thấy studentdb/cloud_app.

**Ý nghĩa CRUD:** Guid tạo mã riêng; ConvertTo-Json+UTF8.GetBytes giữ tiếng Việt
PowerShell5; WebRequest giữ StatusCode/Content. POST201 tạo ID, GET200 đọc record,
PUT200 đổi GPA, q tìm mã; DELETE trả message/id, GET lại404 là mong đợi.
Biến demoId chỉ còn trong cửa sổ hiện tại. Không dùng ID seed1/2/3 để demo xóa.

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

Ảnh SQL và CRUD dưới là các lệnh cùng luồng đã chạy thật; bản ghi test riêng đã
dọn sau khi chụp. SSMS GUI chưa được thao tác trong lượt thu thập này.

<!-- evidence:sql -->
<!-- evidence:crud -->

## 5. Keycloak, hai user và secure API

**Ý nghĩa/cách đọc:** auth/config là metadata issuer/client/endpoints, không phải
token. Secure thiếu Authorization phải401+JSON yêu cầu Bearer, không được200.
Login đúng form+PKCE rồi secure200 có username/subject chứng minh backend kiểm
JWT. Redirect302 ở auth là bình thường; không chụp Authorization/password.

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

1. Chọn realm **521H0092-523H0065** → Users: đủ **sv01, sv02**.
2. Clients → **flask-app**: client public (Client authentication Off),
   Standard flow bật, PKCE S256 và redirect URI `/app/`.
3. Nếu cần minh chứng thao tác tạo user theo đề: Users → Add user, đặt một tên
   mới riêng (không tạo trùng sv01/sv02), Save → Credentials → Set password.
   Chụp sau khi lưu, không chụp trường password.

1. Mở `http://localhost/#auth` hoặc Portal → tab **Xác thực**.
2. Kiểm tra Realm Name là **521H0092-523H0065**, Client ID là **flask-app**.
3. Bấm **Đăng nhập Keycloak SSO**, nhập username **sv01** và giá trị
   `DEMO_USER_PASSWORD` đọc từ `.env` local. Không nhập tên biến làm mật khẩu.
4. Keycloak chuyển qua `/app/` để xử lý callback PKCE, rồi quay về Portal
   `/#auth`. Kết quả `/api/secure` phải hiện **HTTP 200**, `message=Secure resource OK`,
   `preferred_username=sv01` và subject có giá trị. Chụp phần kết quả này.
5. Bấm **Đăng xuất / Xóa Token**; cần hiện thông báo đã đăng xuất Keycloak.
   Đăng nhập lại bằng **sv02** để chụp minh chứng thứ hai. Không cần tự xóa cookie.

Nếu đang mở tab Portal từ trước khi cập nhật realm, đăng xuất và nhấn **Ctrl+F5**
để bỏ phiên/giao diện cũ. Không cần xóa volume hoặc tạo lại mật khẩu.

Muốn thấy rõ HTTP status/JSON trong DevTools Console mà không in token, chạy
trong tab Portal **sau khi đã login**:

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

Ảnh secure200 ghi nhận login form sv01/PKCE thật; callback được intercept để
kiểm auth độc lập UI, không thay nghiệm thu toàn bộ JavaScript Student.

<!-- evidence:auth -->
<!-- ui:auth-ui -->
<!-- ui:keycloak-ui -->
<!-- evidence:secure-login -->

## 6. MinIO avatar/PDF và tải về

**Ý nghĩa:** -F gửi multipart file/bucket, không phải JSON; --fail làm curl lỗi
khi HTTP lỗi; -o lưu file download; Get-FileHash tính SHA256. Key do API tạo riêng.
Hai SHA256 bằng nhau chứng minh byte không đổi. S3 anonymous403 là đúng với file
gốc private; bản sao được chọn công khai dưới public/ trả200.415 là sai định dạng.

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

Nếu muốn upload bằng lệnh, tạo file mẫu bằng script đi kèm repo:

```powershell
python scripts/create-demo-files.py
$pdfPath = (Resolve-Path .runtime/demo-files/report.pdf).Path
$uploadJson = curl.exe -sS -F 'bucket=documents' -F "file=@$pdfPath;type=application/pdf" http://localhost/api/files
$upload = $uploadJson | ConvertFrom-Json
$upload | Format-List
New-Item -ItemType Directory -Force .runtime\screenshots | Out-Null
$downloadPath = Join-Path $PWD '.runtime\screenshots\downloaded-report.pdf'
curl.exe -sS --fail -o $downloadPath "http://localhost$($upload.download_url)"
Get-FileHash -Algorithm SHA256 -LiteralPath $pdfPath,$downloadPath | Format-Table
```

**Kỳ vọng:** hai SHA256 bằng nhau. Có thể thay pdfPath bằng PDF thật của bạn.
**Luồng:** Browser/curl → gateway → Flask multipart → MinIO S3 → object metadata;
download theo chiều ngược lại. Không dùng bucket demo/index.html của ví dụ cơ bản.

Ảnh lệnh dưới dùng PDF mẫu do script tạo, tải lại và so hash rồi chỉ dọn
object do bài test tạo. Console chụp sau khi dọn; bucket rỗng không phủ nhận upload.

<!-- evidence:storage -->
<!-- ui:minio-ui -->

### 6.1. URL public trực tiếp MinIO, sao chép và bỏ công khai

Trong Student App → **Tài liệu**, chọn đúng PDF vừa upload → **Công khai**.
Chụp nhãn Công khai, nút **Mở file**, **Sao chép**, **Bỏ công khai**.
Sao chép link và mở trong cửa sổ ẩn danh. URL dạng
`http://localhost:9000/documents/public/<key>.pdf`, không có chữ ký hay thời hạn.
Với avatar: Sinh viên → Chi tiết → **Công khai avatar** → **Mở ảnh/Sao chép link**.

Lệnh dưới dùng `$upload` và `$pdfPath` từ bước upload trước, trong cùng cửa sổ:

```powershell
$shareBody = @{bucket='documents';key=$upload.key} | ConvertTo-Json
$shared = Invoke-RestMethod -Method Post -Uri 'http://localhost/api/files/share' -ContentType 'application/json' -Body $shareBody
$shared | Format-List
New-Item -ItemType Directory -Force .runtime/screenshots | Out-Null
$publicPdf = Join-Path $PWD '.runtime/screenshots/public-report.pdf'
$publicHeaders = Join-Path $PWD '.runtime/screenshots/public-headers.txt'
curl.exe -sS --fail -D $publicHeaders -o $publicPdf $shared.public_url
Get-Content -LiteralPath $publicHeaders
Get-FileHash -Algorithm SHA256 -LiteralPath $pdfPath,$publicPdf | Format-Table -AutoSize
```

**Ý nghĩa/kỳ vọng:** POST yêu cầu tạo bản sao công khai; response có
`is_public=True` và URL MinIO port9000. Curl dùng URL trực tiếp không gửi token,
ghi header/body ra runtime. Cần HTTP200, Content-Type application/pdf,
Cache-Control no-store và hai SHA256 bằng nhau. Đây là Browser/curl → MinIO,
khác với đường download qua Flask. Link localhost chỉ mở trên máy đang chạy Docker.

Chụp xong, bỏ công khai và kiểm tra cả hai đường:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost/api/files/unshare' -ContentType 'application/json' -Body $shareBody
curl.exe -sI $shared.public_url
curl.exe -sI "http://localhost/api/files/documents/$($upload.key)"
```

**Kỳ vọng:** response bỏ công khai có is_public=False; URL public trả404/403,
file gốc qua Flask vẫn200. Bỏ công khai chặn lần truy cập mới, không xóa file
người nhận đã tải về. Chỉ prefix public/* cấp quyền đọc anonymous; không cấp
ListBucket/PutObject/DeleteObject, không công khai mọi file có sẵn.

Ảnh và transcript dưới dùng fixture riêng, đã dọn sau nghiệm thu; URL trong ảnh
minh họa trạng thái tại thời điểm chạy. Kết quả mới: 63 kiểm tra API và 20 browser.

<!-- evidence:public-storage -->
<!-- ui:public-pdf-ui -->
<!-- ui:public-avatar-ui -->

## 7. DNS Bind9 và phân biệt Docker DNS

**Ý nghĩa:** named-checkconf kiểm cú pháp; dig trong container hỏi Bind9port53,
+short chỉ in IP; nháy @ tránh cú pháp PowerShell. Testhost gửi gói DNS thật tới
1053 UDP/TCP. Nslookup hỏi Bind9.53 khác với DockerDNS mặc định127.0.0.11.
IP phải khớp zone, không dùng ping service name để tự kết luận Bind9 đã đúng.

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

<!-- evidence:dns -->

## 8. Prometheus → exporter → web

**Ý nghĩa/cách đọc:** targets API trả job/instance/health; Select-Object chọn cột;
probe_success là kết quả HTTP đích từ Blackbox. Cần 5 targets UP và 2 probe_success=1.
up=1 riêng lẻ chỉ nói exporter được scrape, chưa đủ chứng minh web đích phản hồi.
Metric null/503 là chưa có nguồn; không tự đổi thành số 0 giả.

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

<!-- evidence:monitoring -->
<!-- ui:prometheus-ui -->

## 9. Grafana → Prometheus, ba biểu đồ thật

**Ý nghĩa/cách đọc:** Grafana query Prometheus nội bộ theo datasource đã provision;
không cần tạo trùng. Ba panel phải có đường dữ liệu trong time range đang xem;
No data là thiếu sample/query lỗi, không phải bằng 0. Chọn Last 15 minutes/Refresh 5s.

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

<!-- ui:grafana-ui -->

## 10. Routing, Round Robin và ping các server

**Ý nghĩa:** nginx -t kiểm config; 1..20 phát 20 request; ForEach-Object lấy replica
JSON; Group-Object đếm request mỗi server. Ping chạy từ gateway; -c 1 gửi 1 gói,
-W 2 đợi 2 giây. nc -z -w 3 chỉ thử TCP 1433 trong 3 giây, không đăng nhập SQL.
Tổng 20 request qua 2 replica và ping 11 đích không đồng nghĩa đã thử mọi cặp server.

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

<!-- evidence:round-robin -->
<!-- evidence:ping -->

## 11. Persistence SQL/MinIO — tùy chọn lúc demo

**Ý nghĩa/cách đọc:** restart dừng/chạy lại đúng 2 process mycloud, gây gián đoạn
ngắn. Named volumes giữ dữ liệu ngoài process. Cần đối chiếu cùng ID/fields/file
bytes trước/sau, không chỉ thấy container Up. Restart giữ container ID; không gọi
là recreate. Test script trong ảnh tạo fixture/marker rồi dọn đúng fixture riêng.

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

Ảnh dưới chạy các script persistence riêng: copy bằng compose cp; thêm
PYTHONPATH=/app để script /tmp import integrations; create lưu record/object và
marker; verify retry khi SQL/MinIO phục hồi, so byte/Unicode rồi dọn fixture.
Không restart app ở giữa create/verify vì marker nằm trong app. Nếu có marker
cũ, dừng kiểm tra bài test trước, không tự xóa marker/volume.

<!-- evidence:persistence -->

## 12. Tổng kết và đối chiếu minh chứng

**Ý nghĩa/cách đọc:** script kiểm thử dùng fixture riêng rồi dọn; exit 0/PASS mới
là đạt. Số checks là số kiểm tra kỹ thuật, không phải điểm đồ án; API PASS không
tự chứng minh GUI SSMS. verify.ps1 dừng khi bước con lỗi, không in PASS chung giả.

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

| Hạng mục | Bước hướng dẫn | Chứng minh |
| --- | --- | --- |
| Compose/network/volume | 1 | Tài nguyên mycloud, cấu hình và persistence mount |
| Web/Blog | 2 | Website thật, đủ 3 bài, ảnh/backlink |
| Backend/JSON | 3 | Hello nội bộ/public giống nhau; 5 JSON samples |
| SQL Server/CRUD | 4 | Seed, query, record API/UI/SSMS khớp |
| Keycloak | 5 | Realm/client/2 user, 401 và authenticated 200 |
| MinIO | 6 | Avatar/PDF trong bucket, tải đúng file, private |
| DNS | 7 | Zone đúng, dig/UDP/TCP và Bind9 từ container khác |
| Prometheus | 8 | Targets UP, metric sample, probe_success=1 |
| Grafana | 9 | Datasource và ba biểu đồ dữ liệu |
| Proxy/Round Robin/mạng | 10 | Route/header, hai replica nhận request, ping 11 đích |
| Persistence và DELETE | 11 | Giữ record/file sau restart; xóa đúng demo record |

<!-- evidence:verification -->

## B. Scripts thiết lập và chạy lại trên máy nhận source

| Script | Tác dụng |
| --- | --- |
| setup.ps1 | Dựng toàn hệ thống, build mặc định; -NoBuild khi đã có image |
| start.ps1 | Khởi chạy, preflight và readiness |
| stop.ps1 | Dừng mycloud, giữ containers/volumes |
| health-check.ps1 -RequireFrontend | Kiểm probe, metric và ba UI |
| setup-tools.ps1 | Cài tools pinned vào .venv, không cần activate |
| verify.ps1 | Backend 23, gateway 41, DNS host, monitoring 21, auth/storage 24 checks |
| verify.ps1 -Browser | Thêm 29 kiểm tra điều hướng trình duyệt, cần Edge/tools |
| create-demo-files.py | Tạo PDF/PNG mẫu trong runtime, không cần PDF đề gốc |
| capture-handoff.py | Chạy lệnh thật/chụp UI và transcript vào runtime |
| build-handoff.py | Nhúng ảnh vào đúng các bước trong cùng hướng dẫn HTML |

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-tools.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1 -Browser
.\.venv\Scripts\python.exe scripts/capture-handoff.py --include-restart
.\.venv\Scripts\python.exe scripts/build-handoff.py
```

Browser mặc định Microsoft Edge. Nếu không có Edge và chỉ cần capture tài liệu,
chạy setup-tools.ps1 -InstallChromium rồi thêm --browser chromium cho capture.
--include-restart cho phép bước persistence; bỏ cờ nếu chưa muốn gián đoạn
SQL/MinIO. Không dùng ảnh cũ để xác nhận lần chưa chạy. Ảnh/transcript trung gian
ở .runtime/handoff đã Git ignore, không cần gửi riêng; HTML đã chứa toàn bộ ảnh.

Vận hành thường ngày:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1 -NoBuild
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/health-check.ps1 -RequireFrontend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop.ps1
```

Sửa HTML/JS/Dockerfile thì setup bỏ -NoBuild để build mới. Máy partner có volume
riêng/seed mới, không tự mang dữ liệu từ máy tác giả. Không xóa env/volume để reset.

## C. Xử lý lỗi và trạng thái bàn giao

| Hiện tượng | Kiểm tra tiếp |
| --- | --- |
| Tất cả site không mở | Docker Desktop/engine Linux, docker info, sau đó setup |
| Port/subnet conflict | Preflight, network/route/VPN; không tự dừng dự án khác/SQLEXPRESS; đổi IPAM/zone đồng bộ nếu cần |
| API 503/SQL login lỗi | Health, logs app/database-init, credential trong volume; không xóa env/volume |
| Chart thiếu dữ liệu | Targets/probe_success, đợi scrape/rate window, time range |
| Frontend cũ | Build lại setup, cả 2 replica cùng image, Ctrl+F5 |
| Init job Exited (0) | Bình thường; exit khác 0 đọc logs init |
| Build/pull lỗi | Internet/registry/build log; MinIO build tag nguồn upstream; không bỏ lỗi bằng -NoBuild |

Ảnh thu thập theo timestamp UTC+7 hiển thị tại từng phần trên máy dự án, gồm CRUD, upload/download,
persistence sau restart, DNS, monitoring, Round Robin và GUI Grafana/MinIO/Keycloak.
Setup đã chạy trên engine/image/volume hiện có; cài OS/tools hoặc deploy trên máy
riêng của partner cần partner chạy rồi xác nhận. SSMS GUI/Docker Hub/AWS vẫn NOT TESTED.

Chưa có URL GitHub nên hiện chỉ commit local, chưa push. Có URL thật thì chủ
dự án thêm remote/push, partner clone và làm từ phần A. Không commit/gửi .env,
token, password hoặc dữ liệu volume. Phân biệt PASS (đã chạy/đúng), FAIL (đã chạy/sai),
NOT TESTED (chưa thao tác); không dùng ảnh mẫu làm kết quả của máy chưa chạy.
